from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import bcrypt

db = SQLAlchemy()

class WorkspaceMember(db.Model):
    __tablename__ = 'workspace_members'
    workspace_id = db.Column(db.Integer, db.ForeignKey('workspaces.id', ondelete='CASCADE'), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    role = db.Column(db.String(20), default='member')  # 'admin' or 'member'

    user = db.relationship('User', back_populates='workspace_memberships')
    workspace = db.relationship('Workspace', back_populates='member_associations')

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(20), default='user')  # 'admin' or 'user' (system-wide role)
    profile_pic = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    created_workspaces = db.relationship('Workspace', back_populates='creator', foreign_keys='Workspace.created_by', cascade="all, delete-orphan")
    workspace_memberships = db.relationship('WorkspaceMember', back_populates='user', cascade="all, delete-orphan")
    assigned_tasks = db.relationship('Task', back_populates='assignee', foreign_keys='Task.assigned_to')
    created_tasks = db.relationship('Task', back_populates='creator', foreign_keys='Task.created_by')
    expenses = db.relationship('Expense', back_populates='user', cascade="all, delete-orphan")

    def set_password(self, password):
        # Generate salt and hash password
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    def check_password(self, password):
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'profile_pic': self.profile_pic,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Workspace(db.Model):
    __tablename__ = 'workspaces'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    creator = db.relationship('User', back_populates='created_workspaces', foreign_keys=[created_by])
    member_associations = db.relationship('WorkspaceMember', back_populates='workspace', cascade="all, delete-orphan")
    tasks = db.relationship('Task', back_populates='workspace', cascade="all, delete-orphan")
    expenses = db.relationship('Expense', back_populates='workspace', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'members': [
                {
                    'id': assoc.user.id,
                    'username': assoc.user.username,
                    'email': assoc.user.email,
                    'role': assoc.role
                } for assoc in self.member_associations
            ]
        }

class Task(db.Model):
    __tablename__ = 'tasks'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), default='todo')  # 'todo', 'in_progress', 'on_hold', 'blocked', 'completed'
    priority = db.Column(db.String(50), default='medium')  # 'low', 'medium', 'high'
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    estimated_end_date = db.Column(db.DateTime, nullable=False)  # Mandatory date-time selection
    status_notes = db.Column(db.Text, nullable=True)  # Non-mandatory explanations for Blocked/On Hold
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    workspace_id = db.Column(db.Integer, db.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)

    # Relationships
    workspace = db.relationship('Workspace', back_populates='tasks')
    assignee = db.relationship('User', back_populates='assigned_tasks', foreign_keys=[assigned_to])
    creator = db.relationship('User', back_populates='created_tasks', foreign_keys=[created_by])

    def validate(self):
        # Ensure created_at is set before saving
        if not self.created_at:
            self.created_at = datetime.utcnow()

        # Validation rules:
        # 1. estimated_end_date must be set
        # 2. estimated_end_date must be in the future relative to creation/save time
        if not self.estimated_end_date:
            return False, "Estimated end date is mandatory."
        
        if self.estimated_end_date <= self.created_at:
            return False, "Estimated end date must be in the future."
        return True, ""

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'priority': self.priority,
            'created_at': (self.created_at.isoformat() + 'Z') if self.created_at else None,
            'estimated_end_date': (self.estimated_end_date.isoformat() + 'Z') if self.estimated_end_date else None,
            'status_notes': self.status_notes,
            'assigned_to': self.assigned_to,
            'assigned_user': self.assignee.to_dict() if self.assignee else None,
            'created_by': self.created_by,
            'creator_user': self.creator.to_dict() if self.creator else None,
            'workspace_id': self.workspace_id
        }

class Expense(db.Model):
    __tablename__ = 'expenses'
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(100), nullable=False)  # Travel, Meals, Software, etc.
    date = db.Column(db.DateTime, nullable=False)  # Date of expense
    notes = db.Column(db.Text, nullable=True)
    attachment_url = db.Column(db.String(255), nullable=True)  # Filename in uploads
    workspace_id = db.Column(db.Integer, db.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    workspace = db.relationship('Workspace', back_populates='expenses')
    user = db.relationship('User', back_populates='expenses')

    def validate(self):
        # Ensure created_at is set before saving
        if not self.created_at:
            self.created_at = datetime.utcnow()

        # Validation rules:
        # 1. amount must be > 0
        # 2. date must not be in the future relative to current time
        if self.amount <= 0:
            return False, "Expense amount must be greater than zero."
        if self.date > datetime.utcnow():
            return False, "Expense date cannot be in the future."
        return True, ""

    def to_dict(self):
        return {
            'id': self.id,
            'amount': self.amount,
            'category': self.category,
            'date': (self.date.isoformat() + 'Z') if self.date else None,
            'notes': self.notes,
            'attachment_url': self.attachment_url,
            'workspace_id': self.workspace_id,
            'user_id': self.user_id,
            'user': self.user.to_dict() if self.user else None,
            'created_at': (self.created_at.isoformat() + 'Z') if self.created_at else None
        }
