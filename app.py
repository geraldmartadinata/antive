from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from antive.demo import profiles
from antive.engine import advance, compare, report
from antive.guidance import explanation
from antive.models import Budget, CompareRequest, PreviewRequest
from antive.parser import preview

app = FastAPI(title="Antive", version="0.1.0")
DIST = Path(__file__).resolve().parent / "dist"


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/demo")
def demo():
    return profiles()


@app.post("/api/preview")
def preview_entry(request: PreviewRequest):
    return preview(request.text, request.today)


@app.post("/api/report")
def budget_report(budget: Budget):
    return report(budget)


@app.post("/api/compare")
def compare_purchase(request: CompareRequest):
    result = compare(request.budget, request.offer)
    return {**result, "explanation": explanation(request.offer, result)}


@app.post("/api/advance")
def simulate_payday(budget: Budget):
    return advance(budget)


@app.get("/", include_in_schema=False)
def index():
    if (DIST / "index.html").exists():
        return FileResponse(DIST / "index.html")
    return JSONResponse({"message": "Build the React demo with npm run build."}, status_code=503)


app.mount("/assets", StaticFiles(directory=DIST / "assets", check_dir=False), name="assets")
