from flask import Flask,render_template,jsonify
from database import init_db,database_status

app=Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.get("/api/health")
def health():
    return jsonify({
        "status":"ok",
        "message":"Backend funcionando correctamente"
    })

@app.get("/api/info")
def info():
    db=database_status()

    return jsonify({
        "application":"DataLends",
        "version":db["version"],
        "backend":"Flask",
        "database":"SQLite",
        "database_connected":db["connected"],
        "status":"running"
    })

if __name__=="__main__":
    init_db()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )