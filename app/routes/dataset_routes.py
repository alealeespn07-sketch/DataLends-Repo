from flask import Blueprint,request,jsonify
from app.services.dataset_service import (
    DatasetError,list_datasets,get_dataset_details,
    upload_dataset,rename_dataset,delete_dataset
)

datasets_bp=Blueprint("datasets",__name__)

@datasets_bp.get("/datasets")
def datasets():
    return jsonify(list_datasets())

@datasets_bp.post("/upload")
def upload():
    try:
        dataset=upload_dataset(request.files.get("file"))
        return jsonify({
            "message":"Dataset cargado correctamente.",
            "dataset":dataset
        }),201
    except DatasetError as error:
        return jsonify({"error":str(error)}),400

@datasets_bp.get("/datasets/<int:dataset_id>")
def dataset_detail(dataset_id):
    try:
        return jsonify(get_dataset_details(dataset_id))
    except DatasetError as error:
        code=404 if "no encontrado" in str(error).lower() else 400
        return jsonify({"error":str(error)}),code

@datasets_bp.put("/datasets/<int:dataset_id>")
def update(dataset_id):
    body=request.get_json(silent=True) or {}
    try:
        return jsonify(rename_dataset(dataset_id,body.get("name")))
    except DatasetError as error:
        code=404 if "no encontrado" in str(error).lower() else 400
        return jsonify({"error":str(error)}),code

@datasets_bp.delete("/datasets/<int:dataset_id>")
def remove(dataset_id):
    try:
        return jsonify(delete_dataset(dataset_id))
    except DatasetError as error:
        code=404 if "no encontrado" in str(error).lower() else 400
        return jsonify({"error":str(error)}),code