import json
from datetime import datetime
from app.db import get_connection

def row_to_dashboard(row):
    if not row:
        return None
    return {
        "id":row["id"],
        "name":row["name"],
        "dataset_id":row["dataset_id"],
        "config":json.loads(row["config_json"]),
        "created_at":row["created_at"],
        "updated_at":row["updated_at"]
    }

def list_dashboards():
    conn=get_connection()
    rows=conn.execute(
        "SELECT * FROM dashboards ORDER BY id DESC"
    ).fetchall()
    conn.close()
    return [row_to_dashboard(row) for row in rows]

def get_dashboard(dashboard_id):
    conn=get_connection()
    row=conn.execute(
        "SELECT * FROM dashboards WHERE id=?",
        (dashboard_id,)
    ).fetchone()
    conn.close()
    return row_to_dashboard(row)

def create_dashboard(name,dataset_id,config):
    now=datetime.now().isoformat()
    conn=get_connection()

    cur=conn.execute("""
        INSERT INTO dashboards(
            name,dataset_id,config_json,created_at,updated_at
        )
        VALUES(?,?,?,?,?)
    """,(
        name,dataset_id,
        json.dumps(config,ensure_ascii=False),
        now,now
    ))

    conn.commit()
    dashboard_id=cur.lastrowid
    conn.close()
    return dashboard_id

def update_dashboard(dashboard_id,name,config):
    conn=get_connection()
    cur=conn.execute("""
        UPDATE dashboards
        SET name=?,config_json=?,updated_at=?
        WHERE id=?
    """,(
        name,
        json.dumps(config,ensure_ascii=False),
        datetime.now().isoformat(),
        dashboard_id
    ))
    conn.commit()
    updated=cur.rowcount>0
    conn.close()
    return updated

def delete_dashboard(dashboard_id):
    conn=get_connection()
    cur=conn.execute(
        "DELETE FROM dashboards WHERE id=?",
        (dashboard_id,)
    )
    conn.commit()
    deleted=cur.rowcount>0
    conn.close()
    return deleted