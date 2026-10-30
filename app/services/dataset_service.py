from pathlib import Path
from datetime import date,datetime
import math
import uuid
import pandas as pd
from werkzeug.utils import secure_filename
from flask import current_app
from app.repositories import dataset_repository as repo

class DatasetError(Exception):
    pass

def public_dataset(dataset):
    if not dataset:
        return None
    return {k:v for k,v in dataset.items() if k!="file_path"}

def normalize_dataframe(df):
    df=df.copy()
    names=[]

    for index,column in enumerate(df.columns,1):
        name=str(column).strip() or f"Columna {index}"
        base=name
        suffix=2
        while name in names:
            name=f"{base} ({suffix})"
            suffix+=1
        names.append(name)

    df.columns=names
    return df

def read_dataframe(path):
    extension=Path(path).suffix.lower()

    if extension==".csv":
        try:
            return pd.read_csv(path,encoding="utf-8-sig")
        except UnicodeDecodeError:
            return pd.read_csv(path,encoding="latin-1")

    if extension==".xlsx":
        return pd.read_excel(path)

    raise DatasetError("Formato de archivo no permitido.")

def detect_columns(df):
    columns=[]

    for name in df.columns:
        series=df[name]

        if pd.api.types.is_numeric_dtype(series):
            kind="number"
        elif pd.api.types.is_datetime64_any_dtype(series):
            kind="date"
        else:
            values=series.dropna().astype(str).str.strip()

            if values.empty:
                kind="text"
            else:
                numeric=pd.to_numeric(
                    values.str.replace(",","",regex=False),
                    errors="coerce"
                )

                if numeric.notna().mean()>=0.85:
                    kind="number"
                else:
                    has_date=values.str.contains(
                        r"\d{1,4}[-/]\d{1,2}[-/]\d{1,4}",
                        regex=True
                    ).mean()>=0.6

                    if has_date:
                        parsed=pd.to_datetime(values,errors="coerce")
                        kind="date" if parsed.notna().mean()>=0.8 else "text"
                    else:
                        kind="text"

        columns.append({"name":str(name),"type":kind})

    return columns

def json_value(value):
    if pd.isna(value):
        return None
    if isinstance(value,(pd.Timestamp,datetime,date)):
        return value.isoformat()
    if hasattr(value,"item"):
        value=value.item()
    if isinstance(value,(pd.Timestamp,datetime,date)):
        return value.isoformat()
    if isinstance(value,float) and not math.isfinite(value):
        return None
    if isinstance(value,(str,int,float,bool)) or value is None:
        return value
    return str(value)

def make_preview(df,limit=15):
    records=[]

    for _,row in df.head(limit).iterrows():
        records.append({
            str(column):json_value(value)
            for column,value in row.items()
        })

    return records

def list_datasets():
    return [public_dataset(d) for d in repo.list_datasets()]

def get_dataset_details(dataset_id):
    dataset=repo.get_dataset(dataset_id)

    if not dataset:
        raise DatasetError("Dataset no encontrado.")

    path=Path(dataset["file_path"])

    if not path.exists():
        raise DatasetError("No se encontró el archivo del dataset.")

    try:
        df=normalize_dataframe(read_dataframe(path))
    except Exception as error:
        raise DatasetError(f"No se pudo leer el archivo: {error}") from error

    result=public_dataset(dataset)
    result["preview"]=make_preview(df)
    return result

def upload_dataset(file):
    if not file or not file.filename:
        raise DatasetError("No se seleccionó ningún archivo.")

    original=secure_filename(file.filename)
    extension=Path(original).suffix.lower().lstrip(".")

    if extension not in current_app.config["ALLOWED_EXTENSIONS"]:
        raise DatasetError("Solo se permiten archivos CSV o XLSX.")

    if not original:
        raise DatasetError("Nombre de archivo inválido.")

    folder=Path(current_app.config["UPLOAD_FOLDER"])
    folder.mkdir(parents=True,exist_ok=True)
    path=folder/f"{uuid.uuid4().hex}_{original}"

    try:
        file.save(path)
        df=normalize_dataframe(read_dataframe(path))

        if df.empty or len(df.columns)==0:
            raise DatasetError("El archivo no contiene registros.")

        columns=detect_columns(df)
        dataset_id=repo.create_dataset(
            name=original,
            file_name=original,
            file_path=path,
            row_count=len(df),
            column_count=len(df.columns),
            columns=columns
        )
        return public_dataset(repo.get_dataset(dataset_id))

    except Exception as error:
        path.unlink(missing_ok=True)
        if isinstance(error,DatasetError):
            raise
        raise DatasetError(f"No se pudo procesar el archivo: {error}") from error

def rename_dataset(dataset_id,name):
    dataset=repo.get_dataset(dataset_id)
    if not dataset:
        raise DatasetError("Dataset no encontrado.")

    name=str(name or "").strip()
    if not name:
        raise DatasetError("El nombre es obligatorio.")
    if len(name)>120:
        raise DatasetError("El nombre no puede superar 120 caracteres.")

    repo.update_dataset_name(dataset_id,name)
    return public_dataset(repo.get_dataset(dataset_id))

def delete_dataset(dataset_id):
    dataset=repo.delete_dataset(dataset_id)

    if not dataset:
        raise DatasetError("Dataset no encontrado.")

    Path(dataset["file_path"]).unlink(missing_ok=True)
    return {"message":"Dataset eliminado correctamente."}