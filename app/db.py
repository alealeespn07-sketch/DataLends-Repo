from pathlib import Path
import sqlite3
from datetime import datetime
from flask import current_app

def get_connection():
    conn=sqlite3.connect(current_app.config["DATABASE_PATH"])
    conn.row_factory=sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db(database_path):
    Path(database_path).parent.mkdir(parents=True,exist_ok=True)
    conn=sqlite3.connect(database_path)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS app_config(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_name TEXT NOT NULL,
            version TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS datasets(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            row_count INTEGER NOT NULL,
            column_count INTEGER NOT NULL,
            columns_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    row=conn.execute(
        "SELECT id FROM app_config LIMIT 1"
    ).fetchone()

    if not row:
        conn.execute("""
            INSERT INTO app_config(app_name,version,created_at)
            VALUES(?,?,?)
        """,("DataLends","0.3",datetime.now().isoformat()))
    else:
        conn.execute(
            "UPDATE app_config SET version=?",
            ("0.3",)
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
        "version":row["version"] if row else "0.3"
    }