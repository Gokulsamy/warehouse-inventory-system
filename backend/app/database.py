import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Default to SQLite local file, but allow override for MySQL/PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./warehouse.db")

is_sqlite = DATABASE_URL.startswith("sqlite")

if is_sqlite:
    # check_same_thread is only needed for SQLite
    engine = create_engine(
        DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get db session in endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
