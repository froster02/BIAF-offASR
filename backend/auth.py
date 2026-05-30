import sqlite3
import jwt
import datetime
import os
from passlib.context import CryptContext
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# Configuration
SECRET_KEY = "baif_offline_portal_secure_secret_key_32_chars_long!" # In production, this should be an env var
ALGORITHM = "HS256"
DB_PATH = os.path.join(os.path.dirname(__file__), "users.db")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (username TEXT PRIMARY KEY, password TEXT, role TEXT)''')
    
    # Create default admin if not exists
    c.execute("SELECT * FROM users WHERE username='admin'")
    if not c.fetchone():
        hashed_pw = pwd_context.hash("admin123")
        c.execute("INSERT INTO users VALUES ('admin', ?, 'admin')", (hashed_pw,))
    
    # Create default user if not exists
    c.execute("SELECT * FROM users WHERE username='user'")
    if not c.fetchone():
        hashed_pw = pwd_context.hash("user123")
        c.execute("INSERT INTO users VALUES ('user', ?, 'user')", (hashed_pw,))
        
    conn.commit()
    conn.close()

def get_db_conn():
    return sqlite3.connect(DB_PATH)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(auth: HTTPAuthorizationCredentials = Security(security)):
    token = auth.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_admin(user = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

init_db()
