from app.repositories import dashboard_repository as repo
from app.repositories import dataset_repository as dataset_repo

class DashboardError(Exception):
    def __init__(self,message,status_code=400):
        super().__init__(message)
        self.status_code=status_code

CHART_TYPES={"bar","line","pie"}
AGGREGATIONS={"sum","average","count"}

def validate_config(dataset_id,config):
    if not isinstance(config,dict):
        raise DashboardError("La configuración no es válida.")

    dataset=dataset_repo.get_dataset(dataset_id)
    if not dataset:
        raise DashboardError("Dataset no encontrado.",404)

    chart_type=config.get("chart_type","bar")
    aggregation=config.get("aggregation","sum")
    x=str(config.get("x") or "").strip()
    y=str(config.get("y") or "").strip() or None

    if chart_type not in CHART_TYPES:
        raise DashboardError("Tipo de gráfico no válido.")
    if aggregation not in AGGREGATIONS:
        raise DashboardError("Operación no válida.")

    column_types={c["name"]:c["type"] for c in dataset["columns"]}

    if x not in column_types:
        raise DashboardError("Selecciona una columna válida para agrupar.")

    if aggregation in {"sum","average"}:
        if not y or y not in column_types:
            raise DashboardError("Selecciona una columna numérica.")
        if column_types[y]!="number":
            raise DashboardError("La columna seleccionada debe ser numérica.")
    else:
        y=None

    return {
        "x":x,
        "y":y,
        "aggregation":aggregation,
        "chart_type":chart_type
    }

def list_dashboards():
    return repo.list_dashboards()

def get_dashboard(dashboard_id):
    dashboard=repo.get_dashboard(dashboard_id)
    if not dashboard:
        raise DashboardError("Dashboard no encontrado.",404)
    return dashboard

def create_dashboard(name,dataset_id,config):
    name=str(name or "").strip()
    if not name:
        raise DashboardError("El nombre es obligatorio.")
    if len(name)>120:
        raise DashboardError("El nombre no puede superar 120 caracteres.")

    clean=validate_config(dataset_id,config)
    dashboard_id=repo.create_dashboard(name,dataset_id,clean)
    return repo.get_dashboard(dashboard_id)

def update_dashboard(dashboard_id,name,config):
    current=repo.get_dashboard(dashboard_id)
    if not current:
        raise DashboardError("Dashboard no encontrado.",404)

    name=str(name or "").strip()
    if not name:
        raise DashboardError("El nombre es obligatorio.")
    if len(name)>120:
        raise DashboardError("El nombre no puede superar 120 caracteres.")

    clean=validate_config(current["dataset_id"],config)
    repo.update_dashboard(dashboard_id,name,clean)
    return repo.get_dashboard(dashboard_id)

def delete_dashboard(dashboard_id):
    if not repo.delete_dashboard(dashboard_id):
        raise DashboardError("Dashboard no encontrado.",404)
    return {"message":"Dashboard eliminado correctamente."}