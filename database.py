from pathlib import Path
import sqlite3
from datetime import datetime

BASE_DIR=Path(__file__).resolve().parent
INSTANCE_DIR=BASE_DIR/"instance"
DB_PATH=INSTANCE_DIR/"datalends.db"

INSTANCE_DIR.mkdir(exist_ok=True)

def get_connection():
    conn=sqlite3.connect(DB_PATH)
    conn.row_factory=sqlite3.Row
    return conn

def init_db():
    conn=get_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS app_config(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_name TEXT NOT NULL,
            version TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    exists=conn.execute(
        "SELECT id FROM app_config LIMIT 1"
    ).fetchone()

    if not exists:
        conn.execute(
            """
            INSERT INTO app_config
            (app_name,version,created_at)
            VALUES(?,?,?)
            """,
            (
                "DataLends",
                "0.2",
                datetime.now().isoformat()
            )
        )

    conn.commit()
    conn.close()

def database_status():
    conn=get_connection()

    row=conn.execute(
        "SELECT * FROM app_config LIMIT 1"
    ).fetchone()

    conn.close()

    return {
        "connected":True,
        "app_name":row["app_name"] if row else "DataLends",
        "version":row["version"] if row else "0.2"
    }