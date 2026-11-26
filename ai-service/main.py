import io
import requests

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

from vision_service import analyze_label_image, NUTRIENTS


app = FastAPI(title="NutriLens AI Service")

MAX_IMAGE_SIZE = 10 * 1024 * 1024

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _format_nutrition(values):
    """Format nutrient values in the structure already used by the React UI."""
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
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


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
        # Verify the upload is a readable image before sending it to Ollama.
        with Image.open(io.BytesIO(image_bytes)) as image:
            image.verify()

        ai_result = analyze_label_image(image_bytes)

        # Prefer per-serving values when the model clearly found them.
        # Never silently substitute per-100-g values for a serving.
        nutrition_basis = ai_result.get("nutrition_basis")
        per_serving = ai_result.get("nutrition_per_serving") or {}
        per_100g = ai_result.get("nutrition_per_100g") or {}

        has_serving_values = any(
            value is not None for value in per_serving.values()
        )
        has_100g_values = any(
            value is not None for value in per_100g.values()
        )

        if nutrition_basis == "per_100g" and has_100g_values:
            nutrition = _format_nutrition(per_100g)
            displayed_basis = "per_100g"
            basis_label = "Per 100 g"
        elif nutrition_basis == "per_serving" and has_serving_values:
            nutrition = _format_nutrition(per_serving)
            displayed_basis = "per_serving"
            basis_label = "Per serving"
        elif nutrition_basis == "both":
            # The top-level display defaults to per serving only when those
            # values were separately extracted; otherwise show per 100 g.
            if has_serving_values:
                nutrition = _format_nutrition(per_serving)
                displayed_basis = "per_serving"
                basis_label = "Per serving"
            elif has_100g_values:
                nutrition = _format_nutrition(per_100g)
                displayed_basis = "per_100g"
                basis_label = "Per 100 g"
            else:
                nutrition = _format_nutrition({})
                displayed_basis = nutrition_basis
                basis_label = "Both columns"
        elif has_serving_values:
            nutrition = _format_nutrition(per_serving)
            displayed_basis = "per_serving"
            basis_label = "Per serving"
        elif has_100g_values:
            nutrition = _format_nutrition(per_100g)
            displayed_basis = "per_100g"
            basis_label = "Per 100 g"
        else:
            nutrition = _format_nutrition({})
            displayed_basis = nutrition_basis
            basis_label = None

        return {
            "success": True,
            "filename": file.filename,
            "product_name": ai_result.get("product_name"),
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
                "Food label analyzed using local Qwen AI. "
                "Check extracted information against the original package."
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
            "message": (
                "Could not connect to local Ollama AI: "
                f"{str(error)}"
            ),
        }

    except (ValueError, KeyError, TypeError) as error:
        return {
            "success": False,
            "message": (
                "AI returned an invalid label response. "
                f"Please try again. Details: {str(error)}"
            ),
        }
