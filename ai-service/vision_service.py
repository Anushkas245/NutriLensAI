import base64
import io
import json
import re
import requests
from PIL import Image


OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "qwen3.5:4b"
REQUEST_TIMEOUT = 240
MAX_VISION_DIM = 1600

PACKAGED_FOOD_CATEGORIES = [
    "Packaged Snacks",
    "Biscuits & Cookies",
    "Chocolates & Confectionery",
    "Beverages & Juices",
    "Instant Foods & Noodles",
    "Cereals & Breakfast",
    "Dairy Products",
    "Packaged Indian Foods",
    "Protein Bars & Nutrition",
    "Other Packaged Foods",
]

NUTRIENTS = {
    "calories": "kcal",
    "total_fat": "g",
    "saturated_fat": "g",
    "trans_fat": "g",
    "cholesterol": "mg",
    "sodium": "mg",
    "total_carbohydrate": "g",
    "dietary_fiber": "g",
    "total_sugars": "g",
    "added_sugars": "g",
    "protein": "g",
    "potassium": "mg",
}


def _prepare_image_base64(image_bytes):
    """Resize oversized images to keep vision inference fast and reliable."""
    with Image.open(io.BytesIO(image_bytes)) as img:
        img = img.convert("RGB")
        w, h = img.size
        if max(w, h) > MAX_VISION_DIM:
            scale = MAX_VISION_DIM / float(max(w, h))
            img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        return base64.b64encode(buf.getvalue()).decode("utf-8")


def _build_prompt():
    nutrient_template = ",\n".join(
        f'      "{name}": null' for name in NUTRIENTS
    )
    categories_str = ", ".join(f'"{c}"' for c in PACKAGED_FOOD_CATEGORIES)

    return f"""
You are reading a product image for NutriLens AI, a scanner EXCLUSIVELY for packaged human food products.
Read only what is visibly printed on the package. Do NOT use outside knowledge to fill missing values.

First determine if the image is a packaged human food product (e.g., packaged snacks, biscuits, chocolates, beverages, instant noodles, cereals, dairy, packaged Indian foods, protein bars, condiments).
If the image shows cosmetics/skincare, pet food, a restaurant/home-cooked plated meal, medicine, or a non-food item, set "is_packaged_human_food": false and explain why in "rejection_reason".

Return ONLY one valid JSON object with this exact structure:

{{
  "is_packaged_human_food": true,
  "detected_item_type": "packaged_food",
  "rejection_reason": null,
  "product_name": null,
  "brand": null,
  "category": null,
  "barcode": null,
  "net_weight": null,
  "serving_size": null,
  "serving_unit": "g",
  "pieces_per_serving": null,
  "serving_description": null,
  "servings_per_pack": null,
  "ingredients_text": null,
  "ingredients": [],
  "allergens": {{
    "contains": [],
    "may_contain": [],
    "label_text": null
  }},
  "nutrition_basis": null,
  "nutrition_per_serving": {{
{nutrient_template}
  }},
  "nutrition_per_100g": {{
{nutrient_template}
  }},
  "label_text": null,
  "uncertain_fields": []
}}

Extraction rules:
1. "category" must be one of [{categories_str}] if identifiable from the package, otherwise null.
2. Read the exact ingredient paragraph. Preserve wording and order in ingredients_text and split into ingredients array. Do not invent ingredients.
3. Read allergen statements separately ("CONTAINS" -> allergens.contains, "MAY CONTAIN" -> allergens.may_contain). Keep exact text in allergens.label_text.
4. Distinguish net package weight (net_weight) from serving size (serving_size). Never substitute one for the other.
5. Indian FSSAI labels often print "Energy (kcal)" for calories, "Carbohydrate" for total_carbohydrate, "Total Sugars", "Added Sugars", "Dietary Fibre", "Saturated Fatty Acids" / "Saturated Fat", "Trans Fatty Acids" / "Trans Fat", and "Sodium (mg)". Map them accurately.
6. Extract nutrition values into the exact column printed ("per_serving", "per_100g", or "both"). Never copy per-100g into per-serving or vice versa.
7. Nutrient values must be JSON numbers or null. If printed "<1", "trace", or unreadable, use null and add a note to uncertain_fields.
8. Do not calculate, convert, or derive missing values. Return JSON only without Markdown fences.
"""


def _extract_json(content):
    """Parse the model response, tolerating accidental Markdown fences."""
    content = (content or "").strip()
    content = re.sub(
        r"^```(?:json)?\s*|\s*```$",
        "",
        content,
        flags=re.IGNORECASE,
    ).strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start >= 0 and end > start:
            return json.loads(content[start:end + 1])
        raise


def _clean_nutrition(values):
    cleaned = {}
    values = values if isinstance(values, dict) else {}

    for nutrient in NUTRIENTS:
        value = values.get(nutrient)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            cleaned[nutrient] = None
        elif value < 0:
            cleaned[nutrient] = None
        else:
            cleaned[nutrient] = round(float(value), 2)

    return cleaned


def _clean_string(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return None


def _clean_list(value):
    if not isinstance(value, list):
        return []
    return [
        item.strip()
        for item in value
        if isinstance(item, str) and item.strip()
    ]


def _has_explicit_per_serving_heading(label_text):
    text = (label_text or "").lower()
    return bool(re.search(r"\b(?:amount\s+)?per\s+serv(?:e|ing)?\b", text))


def _has_explicit_per_100g_heading(label_text):
    text = (label_text or "").lower()
    return bool(re.search(r"\b(?:amount\s+)?per\s*100\s*(?:g|ml)\b", text))


def _flag_transcription_conflicts(nutrition_values, label_text, uncertain_fields):
    text = (label_text or "").lower()
    patterns = {
        "calories": r"\b(?:energy|calories)\s*(?:\(kcal\))?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*kcal\b",
        "saturated_fat": r"\bsat(?:urated)?\.?\s*(?:fat|fatty\s*acids)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g\b",
        "total_fat": r"\btotal\s*fat\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g\b",
        "trans_fat": r"\btrans[\s-]*(?:fat|fatty\s*acids)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g\b",
        "sodium": r"\bsodium\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*mg\b",
        "protein": r"\bprotein\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g\b",
    }
    for nutrient, pattern in patterns.items():
        match = re.search(pattern, text)
        value = nutrition_values.get(nutrient)
        if match and isinstance(value, (int, float)) and not isinstance(value, bool):
            printed_value = float(match.group(1))
            if abs(float(value) - printed_value) > 0.05:
                nutrition_values[nutrient] = None
                uncertain_fields.append(
                    f"{nutrient}: extracted value conflicts with label text ({printed_value:g}); verify the original image."
                )


def analyze_label_image(image_bytes):
    """Send a food-label image to local Qwen vision model and return structured data."""
    if not image_bytes:
        raise ValueError("The uploaded image is empty.")

    image_base64 = _prepare_image_base64(image_bytes)

    payload = {
        "model": MODEL_NAME,
        "stream": False,
        "think": False,
        "format": "json",
        "options": {
            "temperature": 0,
            "num_predict": 1600,
        },
        "messages": [
            {
                "role": "user",
                "content": _build_prompt(),
                "images": [image_base64],
            }
        ],
    }

    response = requests.post(
        OLLAMA_URL,
        json=payload,
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()

    result = response.json()
    content = result.get("message", {}).get("content", "")
    extracted = _extract_json(content)

    if not isinstance(extracted, dict):
        raise ValueError("AI response was not a JSON object.")

    is_food = extracted.get("is_packaged_human_food")
    if is_food is None:
        is_food = True

    allergens = extracted.get("allergens")
    if not isinstance(allergens, dict):
        allergens = {}

    uncertain_fields = extracted.get("uncertain_fields")
    if not isinstance(uncertain_fields, list):
        uncertain_fields = []
    uncertain_fields = [str(item) for item in uncertain_fields if item is not None]

    label_text = _clean_string(extracted.get("label_text")) or ""
    per_serving = _clean_nutrition(extracted.get("nutrition_per_serving"))
    per_100g = _clean_nutrition(extracted.get("nutrition_per_100g"))

    has_per_serving_heading = _has_explicit_per_serving_heading(label_text)
    has_per_100g_heading = _has_explicit_per_100g_heading(label_text)

    if has_per_100g_heading and not has_per_serving_heading:
        if not any(value is not None for value in per_100g.values()):
            per_100g = per_serving.copy()
        per_serving = {name: None for name in NUTRIENTS}
        nutrition_basis = "per_100g"
    elif has_per_100g_heading and has_per_serving_heading:
        nutrition_basis = "both"
    elif has_per_serving_heading:
        nutrition_basis = "per_serving"
    elif has_per_100g_heading:
        nutrition_basis = "per_100g"
    else:
        nutrition_basis = _clean_string(extracted.get("nutrition_basis"))

    if nutrition_basis != "both":
        _flag_transcription_conflicts(per_100g, label_text, uncertain_fields)
        _flag_transcription_conflicts(per_serving, label_text, uncertain_fields)

    category = _clean_string(extracted.get("category"))
    if category not in PACKAGED_FOOD_CATEGORIES:
        category = None

    return {
        "is_packaged_human_food": bool(is_food),
        "detected_item_type": _clean_string(extracted.get("detected_item_type")) or "packaged_food",
        "rejection_reason": _clean_string(extracted.get("rejection_reason")),
        "product_name": _clean_string(extracted.get("product_name")),
        "brand": _clean_string(extracted.get("brand")),
        "category": category,
        "barcode": _clean_string(extracted.get("barcode")),
        "net_weight": _clean_string(extracted.get("net_weight")),
        "serving_size": _clean_string(extracted.get("serving_size")),
        "serving_unit": _clean_string(extracted.get("serving_unit")) or "g",
        "pieces_per_serving": extracted.get("pieces_per_serving")
        if isinstance(extracted.get("pieces_per_serving"), (int, float))
        and not isinstance(extracted.get("pieces_per_serving"), bool)
        else None,
        "serving_description": _clean_string(extracted.get("serving_description")),
        "servings_per_pack": _clean_string(extracted.get("servings_per_pack")),
        "ingredients_text": _clean_string(extracted.get("ingredients_text")),
        "ingredients": _clean_list(extracted.get("ingredients")),
        "allergens": {
            "contains": _clean_list(allergens.get("contains")),
            "may_contain": _clean_list(allergens.get("may_contain")),
            "label_text": _clean_string(allergens.get("label_text")),
        },
        "nutrition_basis": nutrition_basis,
        "nutrition_per_serving": per_serving,
        "nutrition_per_100g": per_100g,
        "label_text": label_text or None,
        "uncertain_fields": uncertain_fields,
    }


def generate_plain_explanation(product_name, category, ingredients_text, verdict, nova_label, high_alerts):
    """Generate a concise, grounded AI narrative explanation separate from deterministic calculations."""
    prompt = f"""
You are a clear, objective packaged-food label educator for NutriLens AI.
Write a brief, consumer-friendly plain-language explanation based ONLY on the facts below.
Do NOT invent nutrition numbers, do NOT compute scores, and do NOT give medical diagnoses.

Product: {product_name or 'Packaged Food'}
Category: {category or 'Packaged Food'}
Deterministic Verdict: {verdict}
NOVA Classification: {nova_label}
High-Nutrient Alerts: {', '.join(high_alerts) if high_alerts else 'None'}
Ingredients: {ingredients_text or 'Not provided'}

Return ONLY valid JSON:
{{
  "summary": "2-3 sentence objective takeaway on what this packaged food is made of and how often it fits a balanced diet.",
  "ingredient_notes": "1-2 sentence explanation of the key base ingredients and notable additives/sweeteners/oils."
}}
"""
    payload = {
        "model": MODEL_NAME,
        "stream": False,
        "think": False,
        "format": "json",
        "options": {"temperature": 0.2, "num_predict": 320},
        "messages": [{"role": "user", "content": prompt}],
    }
    response = requests.post(OLLAMA_URL, json=payload, timeout=60)
    response.raise_for_status()
    content = response.json().get("message", {}).get("content", "")
    parsed = _extract_json(content)
    if not isinstance(parsed, dict):
        raise ValueError("Invalid explanation format")
    return {
        "summary": _clean_string(parsed.get("summary")),
        "ingredient_notes": _clean_string(parsed.get("ingredient_notes")),
        "model": MODEL_NAME,
        "is_ai_generated": True,
    }
