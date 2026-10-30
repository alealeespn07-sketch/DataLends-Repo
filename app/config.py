from pathlib import Path

BASE_DIR=Path(__file__).resolve().parent.parent
INSTANCE_DIR=BASE_DIR/"instance"
UPLOAD_FOLDER=INSTANCE_DIR/"uploads"
DATABASE_PATH=INSTANCE_DIR/"datalends.db"

class Config:
    INSTANCE_DIR=str(INSTANCE_DIR)
    UPLOAD_FOLDER=str(UPLOAD_FOLDER)
    DATABASE_PATH=str(DATABASE_PATH)
    MAX_CONTENT_LENGTH=50*1024*1024
    ALLOWED_EXTENSIONS={"csv","xlsx"}