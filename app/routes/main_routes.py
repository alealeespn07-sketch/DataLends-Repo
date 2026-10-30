from flask import Blueprint,render_template,jsonify
from app.db import database_status

main_bp=Blueprint("main",__name__)

@main_bp.get("/")
def index():
    return render_template("index.html")

@main_bp.get("/api/health")
def health():
    return jsonify({
        "status":"ok",
        "message":"Backend funcionando correctamente"
    })

@main_bp.get("/api/info")
def info():
    db=database_status()
    return jsonify({
        "application":db["app_name"],
        "version":db["version"],
        "backend":"Flask",
        "database":"SQLite",
        "database_connected":db["connected"],
        "status":"running"
    })