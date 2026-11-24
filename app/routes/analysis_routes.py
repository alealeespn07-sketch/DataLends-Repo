from flask import Blueprint,request,jsonify
from app.services.analysis_service import run_analysis,run_pivot_analysis,AnalysisError

analysis_bp=Blueprint("analysis",__name__)

@analysis_bp.post("/analysis")
def analysis():
    body=request.get_json(silent=True) or {}

    try:
        dataset_id=int(body.get("dataset_id"))
        if body.get("chart_type")=="pivot":
            result=run_pivot_analysis(
                dataset_id,
                body.get("rows"),
                body.get("columns"),
                body.get("values")
            )
        else:
            result=run_analysis(
                dataset_id,
                body.get("x"),
                body.get("y"),
                body.get("aggregation","sum"),
                body.get("chart_type","bar")
            )
        return jsonify(result)
    except AnalysisError as error:
        return jsonify({"error":str(error)}),error.status_code
    except (TypeError,ValueError):
        return jsonify({"error":"La solicitud de análisis no es válida."}),400