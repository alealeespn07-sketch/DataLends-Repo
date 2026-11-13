from flask import Blueprint,request,jsonify
from app.services import dashboard_service as service
from app.services.dashboard_service import DashboardError

dashboards_bp=Blueprint("dashboards",__name__)

@dashboards_bp.get("/dashboards")
def list_dashboards():
    return jsonify(service.list_dashboards())

@dashboards_bp.get("/dashboards/<int:dashboard_id>")
def get_dashboard(dashboard_id):
    try:
        return jsonify(service.get_dashboard(dashboard_id))
    except DashboardError as error:
        return jsonify({"error":str(error)}),error.status_code

@dashboards_bp.post("/dashboards")
def create_dashboard():
    body=request.get_json(silent=True) or {}
    try:
        dashboard=service.create_dashboard(
            body.get("name"),
            int(body.get("dataset_id")),
            body.get("config",{})
        )
        return jsonify(dashboard),201
    except (DashboardError,ValueError,TypeError) as error:
        code=error.status_code if isinstance(error,DashboardError) else 400
        return jsonify({"error":str(error) or "Dataset no válido."}),code

@dashboards_bp.put("/dashboards/<int:dashboard_id>")
def update_dashboard(dashboard_id):
    body=request.get_json(silent=True) or {}
    try:
        current=service.get_dashboard(dashboard_id)
        dashboard=service.update_dashboard(
            dashboard_id,
            body.get("name",current["name"]),
            body.get("config",current["config"])
        )
        return jsonify(dashboard)
    except DashboardError as error:
        return jsonify({"error":str(error)}),error.status_code

@dashboards_bp.delete("/dashboards/<int:dashboard_id>")
def delete_dashboard(dashboard_id):
    try:
        return jsonify(service.delete_dashboard(dashboard_id))
    except DashboardError as error:
        return jsonify({"error":str(error)}),error.status_code