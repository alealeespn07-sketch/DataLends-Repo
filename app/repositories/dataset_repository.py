import json
from datetime import datetime
from app.db import get_connection

def row_to_dataset(row):
    if not row:
        return None
    return {
        "id":row["id"],
        "name":row["name"],
        "file_name":row["file_name"],
        "file_path":row["file_path"],
        "row_count":row["row_count"],
        "column_count":row["column_count"],
        "columns":json.loads(row["columns_json"]),
        "created_at":row["created_at"],
        "updated_at":row["updated_at"]
    }

def list_datasets():
    conn=get_connection()
    rows=conn.execute(
        "SELECT * FROM datasets ORDER BY id DESC"
    ).fetchall()
    conn.close()
    return [row_to_dataset(row) for row in rows]

def get_dataset(dataset_id):
    conn=get_connection()
    row=conn.execute(
        "SELECT * FROM datasets WHERE id=?",
        (dataset_id,)
    ).fetchone()
    conn.close()
    return row_to_dataset(row)

def create_dataset(name,file_name,file_path,row_count,column_count,columns):
    now=datetime.now().isoformat()
    conn=get_connection()

    cur=conn.execute("""
        INSERT INTO datasets(
            name,file_name,file_path,row_count,column_count,
            columns_json,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?)
    """,(
        name,file_name,str(file_path),row_count,column_count,
        json.dumps(columns,ensure_ascii=False),now,now
    ))

    conn.commit()
    dataset_id=cur.lastrowid
    conn.close()
    return dataset_id

def update_dataset_name(dataset_id,name):
    conn=get_connection()
    cur=conn.execute("""
        UPDATE datasets SET name=?,updated_at=?
        WHERE id=?
    """,(name,datetime.now().isoformat(),dataset_id))
    conn.commit()
    updated=cur.rowcount>0
    conn.close()
    return updated

def delete_dataset(dataset_id):
    conn=get_connection()
    row=conn.execute(
        "SELECT * FROM datasets WHERE id=?",
        (dataset_id,)
    ).fetchone()

    if not row:
        conn.close()
        return None

    dataset=row_to_dataset(row)
    conn.execute(
        "DELETE FROM datasets WHERE id=?",
        (dataset_id,)
    )
    conn.commit()
    conn.close()
    return dataset