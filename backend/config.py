import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev_key_tasks_and_expenses_12345')
    JWT_SECRET = os.environ.get('JWT_SECRET', 'jwt_secret_token_change_in_prod_9988')
    db_url = os.environ.get('DATABASE_URL', f'sqlite:///{os.path.join(BASE_DIR, "tracker.db")}')
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI = db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max upload size
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx'}
    
    # SMTP Mail Configurations
    MAIL_SERVER = os.environ.get('MAIL_SERVER', '')
    MAIL_PORT = os.environ.get('MAIL_PORT', '587')
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', '')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', '')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', '')
