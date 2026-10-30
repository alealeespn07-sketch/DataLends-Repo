from pathlib import Path
from flask import Flask,jsonify
from app.config import Config
from app.db import init_db
from app.routes.main_routes import main_bp
from app.routes.dataset_routes import datasets_bp

def create_app():
    app=Flask(__name__)
    app.config.from_object(Config)

    Path(app.config["INSTANCE_DIR"]).mkdir(parents=True,exist_ok=True)
    Path(app.config["UPLOAD_FOLDER"]).mkdir(parents=True,exist_ok=True)

    init_db(app.config["DATABASE_PATH"])

    app.register_blueprint(main_bp)
    app.register_blueprint(datasets_bp,url_prefix="/api")

    @app.errorhandler(413)
    def file_too_large(error):
        return jsonify({
            "error":"El archivo supera el límite permitido de 50 MB."
        }),413

    return app