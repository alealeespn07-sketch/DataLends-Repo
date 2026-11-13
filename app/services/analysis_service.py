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