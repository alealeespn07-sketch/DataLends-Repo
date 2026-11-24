from uuid import uuid4
from app.repositories import dashboard_repository as repo
from app.repositories import dataset_repository as dataset_repo


class DashboardError(Exception):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code


CHART_TYPES = {"bar", "line", "pie"}
AGGREGATIONS = {"sum", "average", "count"}


def normalize_config(config):
    """Convierte la configuración antigua de un solo gráfico al formato múltiple."""
    if not isinstance(config, dict):
        return {"charts": []}

    result = dict(config)
    charts = result.get("charts")

    if not isinstance(charts, list):
        if result.get("x") or result.get("chart_type"):
            charts = [{
                "id": "legacy-chart",
                "title": "Visualización 1",
                "chart_type": result.get("chart_type", "bar"),
                "x": result.get("x"),
                "y": result.get("y"),
                "aggregation": result.get("aggregation", "sum")
            }]
        else:
            charts = []

    result["charts"] = charts
    for key in ("x", "y", "chart_type", "aggregation"):
        result.pop(key, None)
    return result


def _normalize_values(values):
    normalized = []
    for value in values or []:
        if isinstance(value, str):
            normalized.append({"field": value, "aggregation": "sum"})
        elif isinstance(value, dict) and value.get("field"):
            normalized.append({
                "field": str(value["field"]),
                "aggregation": value.get("aggregation", "sum")
            })
    return normalized


def validate_config(dataset_id, config):
    if not isinstance(config, dict):
        raise DashboardError("La configuración no es válida.")

    dataset = dataset_repo.get_dataset(dataset_id)
    if not dataset:
        raise DashboardError("Dataset no encontrado.", 404)

    config = normalize_config(config)
    column_types = {c["name"]: c["type"] for c in dataset["columns"]}
    clean_charts = []
    used_ids = set()

    for index, item in enumerate(config["charts"], 1):
        if not isinstance(item, dict):
            raise DashboardError("Una visualización tiene una configuración no válida.")

        chart_id = str(item.get("id") or uuid4())
        if chart_id in used_ids:
            raise DashboardError("Hay visualizaciones con identificadores repetidos.")
        used_ids.add(chart_id)

        title = str(item.get("title") or f"Visualización {index}").strip()
        if not title:
            raise DashboardError("Cada visualización necesita un título.")

        chart_type = item.get("chart_type", "bar")
        if chart_type == "pivot":
            rows = item.get("rows") or []
            columns = item.get("columns") or []
            values = _normalize_values(item.get("values"))

            if isinstance(rows, str):
                rows = [rows]
            if isinstance(columns, str):
                columns = [columns]

            if not rows:
                raise DashboardError("La tabla dinámica necesita al menos una fila.")
            if not values:
                raise DashboardError("Selecciona al menos un valor para la tabla dinámica.")
            if set(rows) & set(columns):
                raise DashboardError("Una columna no puede estar seleccionada como fila y columna a la vez.")
            if any(field not in column_types for field in rows):
                raise DashboardError("Selecciona filas válidas para la tabla dinámica.")
            if any(field not in column_types for field in columns):
                raise DashboardError("Selecciona columnas válidas para la tabla dinámica.")

            for value in values:
                field = value["field"]
                aggregation = value["aggregation"]
                if field not in column_types:
                    raise DashboardError(f"La columna {field} no existe.")
                if aggregation not in AGGREGATIONS:
                    raise DashboardError("Operación no válida en la tabla dinámica.")
                if aggregation in {"sum", "average"} and column_types[field] != "number":
                    raise DashboardError(f"La columna {field} debe ser numérica.")

            clean_charts.append({
                "id": chart_id,
                "title": title,
                "chart_type": "pivot",
                "rows": list(dict.fromkeys(rows)),
                "columns": list(dict.fromkeys(columns)),
                "values": values
            })
            continue

        if chart_type not in CHART_TYPES:
            raise DashboardError("Tipo de gráfico no válido.")

        aggregation = item.get("aggregation", "sum")
        x = str(item.get("x") or "").strip()
        y = str(item.get("y") or "").strip() or None

        if aggregation not in AGGREGATIONS:
            raise DashboardError("Operación no válida.")
        if x not in column_types:
            raise DashboardError("Selecciona una columna válida para agrupar.")

        if aggregation in {"sum", "average"}:
            if not y or y not in column_types:
                raise DashboardError("Selecciona una columna numérica.")
            if column_types[y] != "number":
                raise DashboardError("La columna seleccionada debe ser numérica.")
        else:
            y = None

        clean_charts.append({
            "id": chart_id,
            "title": title,
            "chart_type": chart_type,
            "x": x,
            "y": y,
            "aggregation": aggregation
        })

    result = {key: value for key, value in config.items() if key != "charts"}
    result["charts"] = clean_charts
    return result


def list_dashboards():
    dashboards = repo.list_dashboards()
    for dashboard in dashboards:
        dashboard["config"] = normalize_config(dashboard.get("config"))
    return dashboards


def get_dashboard(dashboard_id):
    dashboard = repo.get_dashboard(dashboard_id)
    if not dashboard:
        raise DashboardError("Dashboard no encontrado.", 404)
    dashboard["config"] = normalize_config(dashboard.get("config"))
    return dashboard


def create_dashboard(name, dataset_id, config):
    name = str(name or "").strip()
    if not name:
        raise DashboardError("El nombre es obligatorio.")
    if len(name) > 120:
        raise DashboardError("El nombre no puede superar 120 caracteres.")

    clean = validate_config(dataset_id, config)
    dashboard_id = repo.create_dashboard(name, dataset_id, clean)
    return get_dashboard(dashboard_id)


def update_dashboard(dashboard_id, name, config):
    current = repo.get_dashboard(dashboard_id)
    if not current:
        raise DashboardError("Dashboard no encontrado.", 404)

    name = str(name or "").strip()
    if not name:
        raise DashboardError("El nombre es obligatorio.")
    if len(name) > 120:
        raise DashboardError("El nombre no puede superar 120 caracteres.")

    clean = validate_config(current["dataset_id"], config)
    repo.update_dashboard(dashboard_id, name, clean)
    return get_dashboard(dashboard_id)


def delete_dashboard(dashboard_id):
    if not repo.delete_dashboard(dashboard_id):
        raise DashboardError("Dashboard no encontrado.", 404)
    return {"message": "Dashboard eliminado correctamente."}