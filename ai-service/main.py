import io
import requests

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image, UnidentifiedImageError

from vision_service import (
    analyze_label_image,
    generate_plain_explanation,
    NUTRIENTS,
    OLLAMA_URL,
    MODEL_NAME,
)


app = FastAPI(title="NutriLens AI Service")

MAX_IMAGE_SIZE = 10 * 1024 * 1024

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5080",
        "https://localhost:7095",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExplainRequest(BaseModel):
    product_name: str | None = None
    category: str | None = None
    ingredients_text: str | None = None
    verdict: str | None = None
    nova_label: str | None = None
    high_alerts: list[str] = []


def _format_nutrition(values):
    values = values if isinstance(values, dict) else {}
    formatted = {}

    for nutrient, unit in NUTRIENTS.items():
        value = values.get(nutrient)
        valid_number = (
            isinstance(value, (int, float))
            and not isinstance(value, bool)
            and value >= 0
        )

        formatted[nutrient] = {
            "value": value if valid_number else None,
            "unit": unit,
            "needs_review": not valid_number,
            "reason": (
                None
                if valid_number
                else "Value not clearly extracted for this nutrition basis. Verify the original label."
            ),
        }

    return formatted


@app.get("/")
def home():
    return {
        "message": "NutriLens AI service is running",
        "status": "success",
        "model": MODEL_NAME,
    }


@app.get("/health")
def health():
    ollama_ready = False
    try:
        tags_url = OLLAMA_URL.replace("/api/chat", "/api/tags")
        res = requests.get(tags_url, timeout=2)
        ollama_ready = res.ok
    except requests.RequestException:
        ollama_ready = False

    return {
        "status": "healthy",
        "ollama_connected": ollama_ready,
        "model": MODEL_NAME,
    }


@app.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        return {
            "success": False,
            "message": "Please upload an image file.",
        }

    image_bytes = await file.read()

    if not image_bytes:
        return {
            "success": False,
            "message": "The uploaded image is empty.",
        }

    if len(image_bytes) > MAX_IMAGE_SIZE:
        return {
            "success": False,
            "message": "Image must be 10 MB or smaller.",
        }

    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            image.verify()

        ai_result = analyze_label_image(image_bytes)

        if not ai_result.get("is_packaged_human_food", True):
            return {
                "success": False,
                "rejected_non_food": True,
                "detected_item_type": ai_result.get("detected_item_type"),
                "message": ai_result.get("rejection_reason")
                or "NutriLens AI only analyzes packaged human food products. Cosmetics, pet food, restaurant meals, and non-food items are not supported.",
            }

        nutrition_basis = ai_result.get("nutrition_basis")
        per_serving = ai_result.get("nutrition_per_serving") or {}
        per_100g = ai_result.get("nutrition_per_100g") or {}

        has_serving_values = any(value is not None for value in per_serving.values())
        has_100g_values = any(value is not None for value in per_100g.values())

        if nutrition_basis == "per_100g" and has_100g_values:
            nutrition = _format_nutrition(per_100g)
            displayed_basis = "per_100g"
            basis_label = "Per 100 g"
        elif nutrition_basis == "per_serving" and has_serving_values:
            nutrition = _format_nutrition(per_serving)
            displayed_basis = "per_serving"
            basis_label = "Per serving"
        elif nutrition_basis == "both":
            if has_100g_values:
                nutrition = _format_nutrition(per_100g)
                displayed_basis = "both"
                basis_label = "Both columns (Per 100 g & Per serving)"
            elif has_serving_values:
                nutrition = _format_nutrition(per_serving)
                displayed_basis = "per_serving"
                basis_label = "Per serving"
            else:
                nutrition = _format_nutrition({})
                displayed_basis = nutrition_basis
                basis_label = "Both columns"
        elif has_100g_values:
            nutrition = _format_nutrition(per_100g)
            displayed_basis = "per_100g"
            basis_label = "Per 100 g"
        elif has_serving_values:
            nutrition = _format_nutrition(per_serving)
            displayed_basis = "per_serving"
            basis_label = "Per serving"
        else:
            nutrition = _format_nutrition({})
            displayed_basis = nutrition_basis
            basis_label = None

        return {
            "success": True,
            "is_packaged_human_food": True,
            "filename": file.filename,
            "product_name": ai_result.get("product_name"),
            "brand": ai_result.get("brand"),
            "category": ai_result.get("category"),
            "barcode": ai_result.get("barcode"),
            "net_weight": ai_result.get("net_weight"),
            "serving_size": ai_result.get("serving_size"),
            "serving_unit": ai_result.get("serving_unit"),
            "pieces_per_serving": ai_result.get("pieces_per_serving"),
            "serving_description": ai_result.get("serving_description"),
            "servings_per_pack": ai_result.get("servings_per_pack"),
            "nutrition_basis": displayed_basis,
            "nutrition_basis_label": basis_label,
            "nutrition": nutrition,
            "nutrition_per_serving": _format_nutrition(per_serving),
            "nutrition_per_100g": _format_nutrition(per_100g),
            "ingredients_text": ai_result.get("ingredients_text"),
            "ingredients": ai_result.get("ingredients", []),
            "allergens": ai_result.get(
                "allergens",
                {"contains": [], "may_contain": [], "label_text": None},
            ),
            "label_text": ai_result.get("label_text"),
            "uncertain_fields": ai_result.get("uncertain_fields", []),
            "message": (
                "Food label extracted using local Qwen AI. "
                "Please review and correct extracted values before generating final analysis."
            ),
        }

    except (UnidentifiedImageError, OSError):
        return {
            "success": False,
            "message": "Could not read this image. Please try another image.",
        }

    except requests.RequestException as error:
        return {
            "success": False,
            "message": f"Could not connect to local Ollama AI: {str(error)}",
        }

    except (ValueError, KeyError, TypeError) as error:
        return {
            "success": False,
            "message": f"AI returned an invalid label response. Please try again. Details: {str(error)}",
        }


@app.post("/explain")
def explain(req: ExplainRequest):
    try:
        explanation = generate_plain_explanation(
            req.product_name,
            req.category,
            req.ingredients_text,
            req.verdict,
            req.nova_label,
            req.high_alerts,
        )
        return {"success": True, **explanation}
    except requests.RequestException as error:
        return {
            "success": False,
            "message": f"AI explanation unavailable: {str(error)}",
        }
    except (ValueError, KeyError, TypeError) as error:
        return {
            "success": False,
            "message": f"Could not format AI explanation: {str(error)}",
        }
