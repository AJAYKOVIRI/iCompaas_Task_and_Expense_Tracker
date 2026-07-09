import os
import uuid
from functools import wraps
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from config import Config
from models import db, User, Workspace, WorkspaceMember, Task, Expense

app = Flask(__name__, static_folder='../frontend/dist', static_url_path='/')
app.config.from_object(Config)

# Enable CORS for frontend integration
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize database
db.init_app(app)

with app.app_context():
    db.create_all()
    # Migration helper to dynamically add columns to existing SQLite database users table if they don't exist
    try:
        db.session.execute(db.text("ALTER TABLE users ADD COLUMN otp VARCHAR(10)"))
        db.session.commit()
    except Exception:
        db.session.rollback()
    try:
        db.session.execute(db.text("ALTER TABLE users ADD COLUMN otp_expiry DATETIME"))
        db.session.commit()
    except Exception:
        db.session.rollback()
    try:
        db.session.execute(db.text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0"))
        db.session.commit()
    except Exception:
        db.session.rollback()

    # Create default admin user if not exists
    admin_user = User.query.filter_by(role='admin').first()
    if not admin_user:
        admin = User(username='admin', email='admin@tracker.com', role='admin', is_verified=True)
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()
        print("Created default admin user (admin / admin123)")
    else:
        # Ensure existing admin is verified
        if not admin_user.is_verified:
            admin_user.is_verified = True
            db.session.commit()

# --- Utility Helpers ---

def save_and_print_otp(user, otp, type_str):
    import os
    # Print to backend console log
    print(f"\n=======================================================")
    print(f"[OTP EMAIL SIMULATION] To: {user.email}")
    print(f"Subject: {type_str}")
    print(f"Body: Hello {user.username}, your verification code is: {otp}")
    print(f"=======================================================\n")
    
    # Save the raw OTP to a file in the root workspace directory for easy retrieval
    try:
        root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        otp_file_path = os.path.join(root_dir, 'latest_otp.txt')
        with open(otp_file_path, 'w') as f:
            f.write(otp)
        print(f"Saved latest OTP to {otp_file_path}")
    except Exception as e:
        print(f"Error writing OTP to file: {e}")

def generate_token(user_id):
    import jwt
    payload = {
        'exp': datetime.utcnow() + timedelta(days=7),
        'iat': datetime.utcnow(),
        'sub': user_id
    }
    return jwt.encode(payload, app.config['JWT_SECRET'], algorithm='HS256')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        import jwt
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'message': 'Access token is missing!'}), 401
        
        try:
            data = jwt.decode(token, app.config['JWT_SECRET'], algorithms=['HS256'])
            current_user = User.query.get(data['sub'])
            if not current_user:
                return jsonify({'message': 'User associated with token not found!'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token!'}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

def check_workspace_access(user, workspace_id):
    """
    Checks if a user has access to a workspace.
    Returns: (has_access, role_in_workspace)
    """
    if user.role == 'admin':
        return True, 'admin'
    
    assoc = WorkspaceMember.query.filter_by(workspace_id=workspace_id, user_id=user.id).first()
    if assoc:
        return True, assoc.role
    
    ws = Workspace.query.get(workspace_id)
    if ws and ws.created_by == user.id:
        return True, 'admin'
        
    return False, None

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def parse_datetime(dt_str):
    if not dt_str:
        return None
    try:
        if dt_str.endswith('Z'):
            dt_str = dt_str[:-1]
        if 'T' in dt_str:
            parts = dt_str.split('T')
            date_part = parts[0]
            time_part = parts[1].split('.')[0]
            if len(time_part) == 5:
                time_part += ":00"
            return datetime.strptime(f"{date_part} {time_part}", "%Y-%m-%d %H:%M:%S")
        else:
            # Maybe just YYYY-MM-DD
            if len(dt_str) == 10:
                return datetime.strptime(dt_str, "%Y-%m-%d")
            return datetime.fromisoformat(dt_str)
    except Exception as e:
        print(f"Error parsing date string '{dt_str}': {e}")
        return None

# --- API Routes ---

# 1. Static file serving (receipt uploads & profile pics)
@app.route('/api/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# 2. Authentication & Profiles
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Username, email, and password are required.'}), 400
    
    # Check if user already exists
    existing_user = User.query.filter_by(email=data['email']).first()
    if existing_user:
        if existing_user.is_verified:
            return jsonify({'message': 'Email already registered.'}), 400
        else:
            # Overwrite unverified user to prevent locking out email/username
            user = existing_user
            user.username = data['username']
            user.role = data.get('role', 'user')
    else:
        user = None

    # Check if username is taken by a verified user
    existing_username = User.query.filter_by(username=data['username']).first()
    if existing_username:
        if existing_username.is_verified:
            return jsonify({'message': 'Username already exists.'}), 400
        else:
            # If it's a different user, delete it so we don't have constraints conflict
            if not user or user.id != existing_username.id:
                db.session.delete(existing_username)
                db.session.commit()
        
    if not user:
        user = User(
            username=data['username'],
            email=data['email'],
            role=data.get('role', 'user')
        )

    user.set_password(data['password'])
    
    # Generate 6-digit OTP
    import random
    otp = f"{random.randint(100000, 999999)}"
    user.otp = otp
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    user.is_verified = False

    db.session.add(user)
    db.session.commit()

    # Simulate email sending
    save_and_print_otp(user, otp, "Verify your iCompaas account")

    return jsonify({
        'message': 'Verification OTP sent to email.',
        'email': user.email,
        'is_verified': False
    }), 200

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Email and password are required.'}), 400
        
    user = User.query.filter_by(email=data['email']).first()
    if not user or not user.check_password(data['password']):
        return jsonify({'message': 'Invalid email or password.'}), 401
        
    if not user.is_verified:
        # User registered but did not verify. Send a verification OTP.
        import random
        otp = f"{random.randint(100000, 999999)}"
        user.otp = otp
        user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
        db.session.commit()

        save_and_print_otp(user, otp, "Verify your iCompaas account")

        return jsonify({
            'message': 'Your account email is unverified. Verification OTP sent to your email.',
            'email': user.email,
            'is_verified': False,
            'require_registration_verification': True
        }), 200

    # User is verified - trigger 2FA OTP
    import random
    otp = f"{random.randint(100000, 999999)}"
    user.otp = otp
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    db.session.commit()

    save_and_print_otp(user, otp, "iCompaas Two-Factor Authentication (2FA) OTP")

    return jsonify({
        'message': '2FA OTP sent to email.',
        'email': user.email,
        'two_factor_required': True
    }), 200

@app.route('/api/auth/verify-registration-otp', methods=['POST'])
def verify_registration_otp():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('otp'):
        return jsonify({'message': 'Email and OTP are required.'}), 400

    user = User.query.filter_by(email=data['email']).first()
    if not user:
        return jsonify({'message': 'User not found.'}), 404

    if user.is_verified:
        return jsonify({'message': 'Email already verified.'}), 400

    if not user.otp or user.otp != data['otp']:
        return jsonify({'message': 'Invalid verification code.'}), 400

    if user.otp_expiry and user.otp_expiry < datetime.utcnow():
        return jsonify({'message': 'Verification code has expired.'}), 400

    # Verification successful!
    user.is_verified = True
    user.otp = None
    user.otp_expiry = None
    db.session.commit()

    # Create default workspace for this user
    default_ws = Workspace.query.filter_by(created_by=user.id).first()
    if not default_ws:
        default_ws = Workspace(
            name=f"{user.username}'s Workspace",
            description="Auto-generated default workspace",
            created_by=user.id
        )
        db.session.add(default_ws)
        db.session.commit()

        member_assoc = WorkspaceMember(workspace_id=default_ws.id, user_id=user.id, role='admin')
        db.session.add(member_assoc)
        db.session.commit()
    else:
        member_assoc = WorkspaceMember.query.filter_by(workspace_id=default_ws.id, user_id=user.id).first()
        if not member_assoc:
            member_assoc = WorkspaceMember(workspace_id=default_ws.id, user_id=user.id, role='admin')
            db.session.add(member_assoc)
            db.session.commit()

    token = generate_token(user.id)
    return jsonify({
        'message': 'Registration and email verification successful.',
        'token': token,
        'user': user.to_dict(),
        'default_workspace_id': default_ws.id
    }), 200

@app.route('/api/auth/verify-login-otp', methods=['POST'])
def verify_login_otp():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('otp'):
        return jsonify({'message': 'Email and OTP are required.'}), 400

    user = User.query.filter_by(email=data['email']).first()
    if not user:
        return jsonify({'message': 'User not found.'}), 404

    if not user.is_verified:
        return jsonify({'message': 'Email not verified. Please complete registration verification.'}), 400

    if not user.otp or user.otp != data['otp']:
        return jsonify({'message': 'Invalid verification code.'}), 400

    if user.otp_expiry and user.otp_expiry < datetime.utcnow():
        return jsonify({'message': 'Verification code has expired.'}), 400

    # Verification successful!
    user.otp = None
    user.otp_expiry = None
    db.session.commit()

    token = generate_token(user.id)
    return jsonify({
        'message': 'Login successful.',
        'token': token,
        'user': user.to_dict()
    }), 200

@app.route('/api/auth/resend-otp', methods=['POST'])
def resend_otp():
    data = request.get_json()
    if not data or not data.get('email'):
        return jsonify({'message': 'Email is required.'}), 400

    user = User.query.filter_by(email=data['email']).first()
    if not user:
        return jsonify({'message': 'User not found.'}), 404

    import random
    otp = f"{random.randint(100000, 999999)}"
    user.otp = otp
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    db.session.commit()

    save_and_print_otp(user, otp, "Resend iCompaas Verification Code")

    return jsonify({
        'message': 'Verification code resent successfully.',
        'email': user.email
    }), 200

@app.route('/api/auth/profile', methods=['GET', 'PUT'])
@token_required
def profile(current_user):
    if request.method == 'GET':
        return jsonify(current_user.to_dict()), 200
        
    elif request.method == 'PUT':
        # Can be multipart form data or JSON
        if request.content_type and 'multipart/form-data' in request.content_type:
            username = request.form.get('username')
            email = request.form.get('email')
            password = request.form.get('password')
            
            file = request.files.get('profile_pic')
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                unique_filename = f"avatar_{uuid.uuid4().hex}_{filename}"
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_filename))
                current_user.profile_pic = unique_filename
        else:
            data = request.get_json() or {}
            username = data.get('username')
            email = data.get('email')
            password = data.get('password')

        if username:
            existing = User.query.filter_by(username=username).first()
            if existing and existing.id != current_user.id:
                return jsonify({'message': 'Username is already taken.'}), 400
            current_user.username = username
            
        if email:
            existing = User.query.filter_by(email=email).first()
            if existing and existing.id != current_user.id:
                return jsonify({'message': 'Email is already taken.'}), 400
            current_user.email = email

        if password:
            current_user.set_password(password)

        db.session.commit()
        return jsonify({
            'message': 'Profile updated successfully.',
            'user': current_user.to_dict()
        }), 200

@app.route('/api/admin/users', methods=['GET'])
@token_required
def get_admin_users(current_user):
    if current_user.role != 'admin':
        return jsonify({'message': 'Unauthorized.'}), 403
    all_users = User.query.all()
    return jsonify([{
        'id': u.id,
        'username': u.username,
        'email': u.email,
        'role': u.role,
        'created_at': (u.created_at.isoformat() + 'Z') if u.created_at else None
    } for u in all_users]), 200

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@token_required
def delete_admin_user(current_user, user_id):
    if current_user.role != 'admin':
        return jsonify({'message': 'Unauthorized.'}), 403
    
    user_to_delete = User.query.get_or_404(user_id)
    if user_to_delete.id == current_user.id:
        return jsonify({'message': 'Cannot delete your own admin account.'}), 400

    # Delete related records to prevent SQLite foreign key constraint fails
    WorkspaceMember.query.filter_by(user_id=user_to_delete.id).delete()
    Task.query.filter_by(created_by=user_to_delete.id).delete()
    Task.query.filter_by(assigned_to=user_to_delete.id).update({Task.assigned_to: None})
    Expense.query.filter_by(user_id=user_to_delete.id).delete()
    Workspace.query.filter_by(created_by=user_to_delete.id).delete()

    db.session.delete(user_to_delete)
    db.session.commit()
    return jsonify({'message': 'User deleted successfully.'}), 200

# 3. Workspace Management
@app.route('/api/workspaces', methods=['GET', 'POST'])
@token_required
def workspaces(current_user):
    if request.method == 'GET':
        if current_user.role == 'admin':
            # System admin gets all workspaces
            all_ws = Workspace.query.all()
            return jsonify([ws.to_dict() for ws in all_ws]), 200
        
        # Normal user gets workspaces where they are a member
        memberships = WorkspaceMember.query.filter_by(user_id=current_user.id).all()
        user_ws = [m.workspace.to_dict() for m in memberships if m.workspace]
        return jsonify(user_ws), 200

    elif request.method == 'POST':
        data = request.get_json()
        if not data or not data.get('name'):
            return jsonify({'message': 'Workspace name is required.'}), 400
            
        ws = Workspace(
            name=data['name'],
            description=data.get('description'),
            created_by=current_user.id
        )
        db.session.add(ws)
        db.session.commit()

        # Workspace creator is auto-added as workspace admin
        assoc = WorkspaceMember(workspace_id=ws.id, user_id=current_user.id, role='admin')
        db.session.add(assoc)
        db.session.commit()

        return jsonify({
            'message': 'Workspace created successfully.',
            'workspace': ws.to_dict()
        }), 201

@app.route('/api/workspaces/<int:workspace_id>', methods=['DELETE'])
@token_required
def delete_workspace(current_user, workspace_id):
    ws = Workspace.query.get_or_404(workspace_id)
    # Only the creator of the workspace or system admin can delete it
    if current_user.role != 'admin' and ws.created_by != current_user.id:
        return jsonify({'message': 'Unauthorized to delete this workspace.'}), 403
        
    db.session.delete(ws)
    db.session.commit()
    return jsonify({'message': 'Workspace deleted successfully.'}), 200

@app.route('/api/workspaces/<int:workspace_id>/members', methods=['POST'])
@token_required
def add_member(current_user, workspace_id):
    has_access, role = check_workspace_access(current_user, workspace_id)
    if not has_access or role != 'admin':
        return jsonify({'message': 'Only workspace or system admins can add members.'}), 403

    data = request.get_json()
    if not data or not data.get('identifier'):
        return jsonify({'message': 'Username or Email is required.'}), 400

    ident = data['identifier']
    new_member = User.query.filter((User.username == ident) | (User.email == ident)).first()
    if not new_member:
        return jsonify({'message': 'User not found.'}), 404

    # Check if already a member
    existing = WorkspaceMember.query.filter_by(workspace_id=workspace_id, user_id=new_member.id).first()
    if existing:
        return jsonify({'message': 'User is already a member of this workspace.'}), 400

    assoc = WorkspaceMember(
        workspace_id=workspace_id,
        user_id=new_member.id,
        role=data.get('role', 'member')
    )
    db.session.add(assoc)
    db.session.commit()
    
    ws = Workspace.query.get(workspace_id)
    return jsonify({
        'message': 'Member added successfully.',
        'workspace': ws.to_dict()
    }), 200

# 4. Tasks Management
@app.route('/api/workspaces/<int:workspace_id>/tasks', methods=['GET', 'POST'])
@token_required
def workspace_tasks(current_user, workspace_id):
    if request.method == 'GET':
        if workspace_id == 0:
            if current_user.role != 'admin':
                return jsonify({'message': 'Unauthorized.'}), 403
            query = Task.query
        else:
            has_access, role = check_workspace_access(current_user, workspace_id)
            if not has_access:
                return jsonify({'message': 'Unauthorized to access this workspace.'}), 403
            query = Task.query.filter_by(workspace_id=workspace_id)
        
        # Filtering parameters
        status = request.args.get('status')
        priority = request.args.get('priority')
        assigned_to = request.args.get('assigned_to')
        search = request.args.get('search')

        if status:
            query = query.filter_by(status=status)
        if priority:
            query = query.filter_by(priority=priority)
        if assigned_to:
            query = query.filter_by(assigned_to=int(assigned_to))
        if search:
            query = query.filter(Task.title.ilike(f'%{search}%') | Task.description.ilike(f'%{search}%'))

        tasks = query.order_by(Task.created_at.desc()).all()
        return jsonify([t.to_dict() for t in tasks]), 200

    elif request.method == 'POST':
        if workspace_id == 0:
            return jsonify({'message': 'Cannot create tasks in system-wide view. Choose a workspace first.'}), 400
        has_access, role = check_workspace_access(current_user, workspace_id)
        if not has_access:
            return jsonify({'message': 'Unauthorized to access this workspace.'}), 403

        data = request.get_json()
        if not data or not data.get('title') or not data.get('estimated_end_date'):
            return jsonify({'message': 'Title and estimated end date are mandatory.'}), 400

        estimated_date = parse_datetime(data.get('estimated_end_date'))
        if not estimated_date:
            return jsonify({'message': 'Invalid estimated end date format. Use calendar picker.'}), 400

        status = data.get('status', 'todo')
        status_notes = data.get('status_notes') if status in ['blocked', 'on_hold'] else None

        task = Task(
            title=data['title'],
            description=data.get('description'),
            status=status,
            priority=data.get('priority', 'medium'),
            estimated_end_date=estimated_date,
            status_notes=status_notes,
            assigned_to=data.get('assigned_to'),
            created_by=current_user.id,
            workspace_id=workspace_id,
            created_at=datetime.utcnow() # Always save current date/time when task is saved
        )

        valid, error_msg = task.validate()
        if not valid:
            return jsonify({'message': error_msg}), 400

        db.session.add(task)
        db.session.commit()
        return jsonify({
            'message': 'Task created successfully.',
            'task': task.to_dict()
        }), 201

@app.route('/api/tasks/<int:task_id>', methods=['PUT', 'DELETE'])
@token_required
def modify_task(current_user, task_id):
    task = Task.query.get_or_404(task_id)
    has_access, role = check_workspace_access(current_user, task.workspace_id)
    if not has_access:
        return jsonify({'message': 'Unauthorized to modify tasks in this workspace.'}), 403

    # Role-based access: Admin can do anything, standard users can only modify tasks they created/are assigned to
    is_authorized = (current_user.role == 'admin') or (role == 'admin') or \
                    (task.created_by == current_user.id) or (task.assigned_to == current_user.id)
    
    if not is_authorized:
        return jsonify({'message': 'Unauthorized to modify this task.'}), 403

    if request.method == 'PUT':
        data = request.get_json() or {}
        
        if 'title' in data:
            if not data['title']:
                return jsonify({'message': 'Title cannot be empty.'}), 400
            task.title = data['title']
            
        if 'description' in data:
            task.description = data['description']
            
        if 'status' in data:
            task.status = data['status']
            # Auto-clear status notes if not blocked or on hold
            if task.status not in ['blocked', 'on_hold']:
                task.status_notes = None
            
        if 'priority' in data:
            task.priority = data['priority']
            
        if 'status_notes' in data:
            # Only save status notes if status is blocked or on hold
            if task.status in ['blocked', 'on_hold']:
                task.status_notes = data['status_notes']
            else:
                task.status_notes = None
            
        if 'assigned_to' in data:
            task.assigned_to = data['assigned_to']

        if 'estimated_end_date' in data:
            new_est = parse_datetime(data['estimated_end_date'])
            if not new_est:
                return jsonify({'message': 'Invalid estimated end date format.'}), 400
            
            # If the user changed the date, make sure it is in the future
            if new_est != task.estimated_end_date:
                if new_est <= datetime.utcnow():
                    return jsonify({'message': 'Estimated end date must be in the future.'}), 400
            task.estimated_end_date = new_est
            
            valid, error_msg = task.validate()
            if not valid:
                return jsonify({'message': error_msg}), 400

        db.session.commit()
        return jsonify({
            'message': 'Task updated successfully.',
            'task': task.to_dict()
        }), 200

    elif request.method == 'DELETE':
        db.session.delete(task)
        db.session.commit()
        return jsonify({'message': 'Task deleted successfully.'}), 200

# 5. Expenses Management
@app.route('/api/workspaces/<int:workspace_id>/expenses', methods=['GET', 'POST'])
@token_required
def workspace_expenses(current_user, workspace_id):
    if request.method == 'GET':
        if workspace_id == 0:
            if current_user.role != 'admin':
                return jsonify({'message': 'Unauthorized.'}), 403
            query = Expense.query
        else:
            has_access, role = check_workspace_access(current_user, workspace_id)
            if not has_access:
                return jsonify({'message': 'Unauthorized to access this workspace.'}), 403
            query = Expense.query.filter_by(workspace_id=workspace_id)
            # Enforce RBAC: Standard members (non-admins) only see their own expenses
            if current_user.role != 'admin' and role != 'admin':
                query = query.filter_by(user_id=current_user.id)
        
        # Filtering by category and month
        category = request.args.get('category')
        month = request.args.get('month') # expected format YYYY-MM
        
        if category:
            query = query.filter_by(category=category)
        if month:
            # Parse year and month
            try:
                yr, mn = map(int, month.split('-'))
                query = query.filter(db.extract('year', Expense.date) == yr,
                                     db.extract('month', Expense.date) == mn)
            except ValueError:
                pass # ignore malformed month

        expenses = query.order_by(Expense.date.desc()).all()
        return jsonify([e.to_dict() for e in expenses]), 200

    elif request.method == 'POST':
        if workspace_id == 0:
            return jsonify({'message': 'Cannot log expenses in system-wide view. Choose a workspace first.'}), 400
        has_access, role = check_workspace_access(current_user, workspace_id)
        if not has_access:
            return jsonify({'message': 'Unauthorized to access this workspace.'}), 403

        # Form-data to handle attachments
        amount_val = request.form.get('amount')
        category_val = request.form.get('category')
        date_val = request.form.get('date')
        notes_val = request.form.get('notes')

        if not amount_val or not category_val or not date_val:
            return jsonify({'message': 'Amount, category, and date are required.'}), 400

        try:
            amount = float(amount_val)
        except ValueError:
            return jsonify({'message': 'Amount must be a decimal number.'}), 400

        expense_date = parse_datetime(date_val)
        if not expense_date:
            return jsonify({'message': 'Invalid date format.'}), 400

        # Create expense container
        expense = Expense(
            amount=amount,
            category=category_val,
            date=expense_date,
            notes=notes_val,
            workspace_id=workspace_id,
            user_id=current_user.id,
            created_at=datetime.utcnow()
        )

        # File attachment
        file = request.files.get('attachment')
        if file and file.filename != '':
            if allowed_file(file.filename):
                filename = secure_filename(file.filename)
                unique_filename = f"bill_{uuid.uuid4().hex}_{filename}"
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_filename))
                expense.attachment_url = unique_filename
            else:
                return jsonify({'message': 'File type not allowed.'}), 400

        # Validate expense amount and date constraints
        valid, error_msg = expense.validate()
        if not valid:
            return jsonify({'message': error_msg}), 400

        db.session.add(expense)
        db.session.commit()
        return jsonify({
            'message': 'Expense logged successfully.',
            'expense': expense.to_dict()
        }), 201

@app.route('/api/expenses/<int:expense_id>', methods=['PUT', 'DELETE'])
@token_required
def modify_expense(current_user, expense_id):
    expense = Expense.query.get_or_404(expense_id)
    has_access, role = check_workspace_access(current_user, expense.workspace_id)
    if not has_access:
        return jsonify({'message': 'Unauthorized to modify expenses in this workspace.'}), 403

    # Admin/creator check
    is_authorized = (current_user.role == 'admin') or (role == 'admin') or (expense.user_id == current_user.id)
    if not is_authorized:
        return jsonify({'message': 'Unauthorized to modify this expense.'}), 403

    if request.method == 'PUT':
        # Let's support both form-data and json
        if request.content_type and 'multipart/form-data' in request.content_type:
            amount_val = request.form.get('amount')
            category_val = request.form.get('category')
            date_val = request.form.get('date')
            notes_val = request.form.get('notes')
            file = request.files.get('attachment')
        else:
            data = request.get_json() or {}
            amount_val = data.get('amount')
            category_val = data.get('category')
            date_val = data.get('date')
            notes_val = data.get('notes')
            file = None

        if amount_val is not None:
            try:
                expense.amount = float(amount_val)
            except ValueError:
                return jsonify({'message': 'Amount must be a decimal number.'}), 400

        if category_val is not None:
            expense.category = category_val

        if date_val is not None:
            new_date = parse_datetime(date_val)
            if not new_date:
                return jsonify({'message': 'Invalid date format.'}), 400
            expense.date = new_date

        if notes_val is not None:
            expense.notes = notes_val

        if file and file.filename != '':
            if allowed_file(file.filename):
                filename = secure_filename(file.filename)
                unique_filename = f"bill_{uuid.uuid4().hex}_{filename}"
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_filename))
                # Delete old attachment file if it exists
                if expense.attachment_url:
                    old_path = os.path.join(app.config['UPLOAD_FOLDER'], expense.attachment_url)
                    if os.path.exists(old_path):
                        try:
                            os.remove(old_path)
                        except OSError:
                            pass
                expense.attachment_url = unique_filename
            else:
                return jsonify({'message': 'File type not allowed.'}), 400

        valid, error_msg = expense.validate()
        if not valid:
            return jsonify({'message': error_msg}), 400

        db.session.commit()
        return jsonify({
            'message': 'Expense updated successfully.',
            'expense': expense.to_dict()
        }), 200

    elif request.method == 'DELETE':
        # Remove receipt file
        if expense.attachment_url:
            old_path = os.path.join(app.config['UPLOAD_FOLDER'], expense.attachment_url)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except OSError:
                    pass
        db.session.delete(expense)
        db.session.commit()
        return jsonify({'message': 'Expense deleted successfully.'}), 200

# 6. Dashboard Metrics
@app.route('/api/workspaces/<int:workspace_id>/dashboard', methods=['GET'])
@token_required
def dashboard_stats(current_user, workspace_id):
    if workspace_id == 0:
        if current_user.role != 'admin':
            return jsonify({'message': 'Unauthorized.'}), 403
        all_tasks = Task.query.all()
        all_expenses = Expense.query.all()
    else:
        has_access, role = check_workspace_access(current_user, workspace_id)
        if not has_access:
            return jsonify({'message': 'Unauthorized to access this workspace.'}), 403
        all_tasks = Task.query.filter_by(workspace_id=workspace_id).all()
        all_expenses = Expense.query.filter_by(workspace_id=workspace_id).all()

    # Tasks stats
    total_tasks = len(all_tasks)
    todo_count = len([t for t in all_tasks if t.status == 'todo'])
    in_progress_count = len([t for t in all_tasks if t.status == 'in_progress'])
    on_hold_count = len([t for t in all_tasks if t.status == 'on_hold'])
    blocked_count = len([t for t in all_tasks if t.status == 'blocked'])
    completed_count = len([t for t in all_tasks if t.status == 'completed'])
    total_expense_amount = sum([e.amount for e in all_expenses])

    # Expenses by category (pie chart data)
    category_map = {}
    for e in all_expenses:
        category_map[e.category] = category_map.get(e.category, 0.0) + e.amount
    
    expenses_by_category = [{'category': k, 'amount': round(v, 2)} for k, v in category_map.items()]

    # Expenses by month (bar chart data) - past 6 months
    # Group by YYYY-MM
    monthly_map = {}
    for e in all_expenses:
        m_key = e.date.strftime('%Y-%m')
        monthly_map[m_key] = monthly_map.get(m_key, 0.0) + e.amount
    
    # Sort keys
    sorted_months = sorted(monthly_map.keys())[-6:] # past 6 records
    expenses_by_month = [{'month': m, 'amount': round(monthly_map[m], 2)} for m in sorted_months]

    # Fetch system users and roles if the requester is an admin
    users_data = None
    if current_user.role == 'admin':
        all_users = User.query.all()
        users_data = [{
            'id': u.id,
            'username': u.username,
            'email': u.email,
            'role': u.role,
            'created_at': (u.created_at.isoformat() + 'Z') if u.created_at else None
        } for u in all_users]

    return jsonify({
        'tasks': {
            'total': total_tasks,
            'todo': todo_count,
            'in_progress': in_progress_count,
            'on_hold': on_hold_count,
            'blocked': blocked_count,
            'completed': completed_count
        },
        'expenses': {
            'total_amount': round(total_expense_amount, 2),
            'by_category': expenses_by_category,
            'by_month': expenses_by_month
        },
        'users': users_data
    }), 200

# 7. Serve Frontend in Production
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path.startswith("api/") or path.startswith("api"):
        return jsonify({'message': 'API Route Not Found'}), 404
    
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    # Run server locally
    app.run(host='0.0.0.0', port=5000, debug=True)
