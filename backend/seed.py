from database import SessionLocal
from models.user import User
from auth.dependencies import hash_password

def seed():
    db = SessionLocal()
    try:
        if db.query(User).filter(User.username == "admin").first():
            print("Admin user already exists, skipping.")
            return
        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            role="admin",
        )
        db.add(admin)
        db.commit()
        print("Admin user created: admin / admin123")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
