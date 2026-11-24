from pathlib import Path
import pandas as pd
from app.repositories import dataset_repository as repo
from app.services.dataset_service import read_dataframe,normalize_dataframe

class AnalysisError(Exception):
    def __init__(self,message,status_code=400):
        super().__init__(message)
        self.status_code=status_code

def run_analysis(dataset_id,x,y,aggregation,chart_type):
    dataset=repo.get_dataset(dataset_id)
    if not dataset:
        raise AnalysisError("Dataset no encontrado.",404)

    path=Path(dataset["file_path"])
    if not path.exists():
        raise AnalysisError("No se encontró el archivo del dataset.",404)

    try:
        df=normalize_dataframe(read_dataframe(path))
    except Exception as error:
        raise AnalysisError(f"No se pudo leer el dataset: {error}") from error

    if x not in df.columns:
        raise AnalysisError("La columna de agrupación no existe.")

    if aggregation not in {"sum","average","count"}:
        raise AnalysisError("Operación no válida.")

    if chart_type not in {"bar","line","pie"}:
        raise AnalysisError("Tipo de gráfico no válido.")

    if aggregation in {"sum","average"}:
        if not y or y not in df.columns:
            raise AnalysisError("Selecciona una columna numérica.")

        numbers=pd.to_numeric(df[y],errors="coerce")
        if not numbers.notna().any():
            raise AnalysisError("La columna no contiene números válidos.")

        temp=pd.DataFrame({"group":df[x],"value":numbers})
        grouped=temp.groupby("group",dropna=False,sort=False)["value"]

        if aggregation=="sum":
            result=grouped.sum(min_count=1)
        else:
            result=grouped.mean()

        result=result.dropna()
        y_label=y
    else:
        result=df.groupby(x,dropna=False,sort=False).size()
        y_label="Registros"

    if chart_type!="line":
        result=result.sort_values(ascending=False)

    result=result.head(30)

    labels=[
        "(Vacío)" if pd.isna(value) else str(value)
        for value in result.index
    ]
    values=[
        float(value) if pd.notna(value) else 0
        for value in result.values
    ]

    return {
        "kind":"chart",
        "labels":labels,
        "values":values,
        "x_label":str(x),
        "y_label":str(y_label),
        "aggregation":aggregation,
        "chart_type":chart_type
    }


def run_pivot_analysis(dataset_id, rows, columns, values):
    dataset = repo.get_dataset(dataset_id)
    if not dataset:
        raise AnalysisError("Dataset no encontrado.", 404)

    path = Path(dataset["file_path"])
    if not path.exists():
        raise AnalysisError("No se encontró el archivo del dataset.", 404)

    try:
        df = normalize_dataframe(read_dataframe(path))
    except Exception as error:
        raise AnalysisError(f"No se pudo leer el dataset: {error}") from error

    if isinstance(rows, str):
        rows = [rows]
    if isinstance(columns, str):
        columns = [columns]
    rows = list(dict.fromkeys(rows or []))
    columns = list(dict.fromkeys(columns or []))

    if not rows or any(field not in df.columns for field in rows):
        raise AnalysisError("Selecciona al menos una fila válida.")
    if set(rows) & set(columns):
        raise AnalysisError("Una columna no puede estar seleccionada como fila y columna a la vez.")
    if any(field not in df.columns for field in columns):
        raise AnalysisError("Una columna seleccionada no existe.")

    normalized_values = []
    for item in values or []:
        if isinstance(item, str):
            normalized_values.append({"field": item, "aggregation": "sum"})
        elif isinstance(item, dict) and item.get("field"):
            normalized_values.append({
                "field": item["field"],
                "aggregation": item.get("aggregation", "sum")
            })

    if not normalized_values:
        raise AnalysisError("Selecciona al menos un valor para la tabla dinámica.")

    function_map = {"sum": "sum", "average": "mean", "count": "count"}
    pieces = []

    for item in normalized_values:
        field = item["field"]
        aggregation = item["aggregation"]
        if field not in df.columns:
            raise AnalysisError(f"La columna {field} no existe.")
        if aggregation not in function_map:
            raise AnalysisError("Operación no válida.")
        if aggregation in {"sum", "average"}:
            numbers = pd.to_numeric(df[field], errors="coerce")
            if not numbers.notna().any():
                raise AnalysisError(f"La columna {field} no contiene números válidos.")
            df[field] = numbers

        part = pd.pivot_table(
            df,
            index=rows,
            columns=columns or None,
            values=field,
            aggfunc=function_map[aggregation],
            fill_value=0,
            dropna=False
        ).reset_index()

        renamed = []
        for position, column in enumerate(part.columns):
            if position < len(rows):
                renamed.append(rows[position])
                continue

            if isinstance(column, tuple):
                parts = [str(value) for value in column if str(value) not in {"", "nan", "None"}]
            else:
                parts = [str(column)]

            category = " · ".join(parts)
            renamed.append(f"{field} · {aggregation}" if not columns else f"{field} · {aggregation} · {category}")

        part.columns = renamed
        pieces.append(part)

    pivot = pieces[0]
    for part in pieces[1:]:
        pivot = pivot.merge(part, on=rows, how="outer")

    pivot = pivot.fillna(0)
    flattened = list(pivot.columns)

    records = pivot.head(500).to_json(
        orient="records", date_format="iso"
    )
    import json
    return {
        "kind": "pivot",
        "columns": flattened,
        "rows": json.loads(records),
        "total_rows": int(len(pivot))
    }