
from fastapi import FastAPI

app = FastAPI(title="NutriLens AI Service")


@app.get("/")
def home():
    return {
        "message": "NutriLens AI service is running",
        "status": "success"
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
