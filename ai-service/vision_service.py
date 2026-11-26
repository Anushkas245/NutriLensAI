import base64
import json
import re
import requests


OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "qwen3.5:4b"
REQUEST_TIMEOUT = 240

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


def _build_prompt():
    nutrient_template = ",\n".join(
        f'      "{name}": null' for name in NUTRIENTS
    )

    return f"""
You are reading a real packaged-food label from an image.
Read the complete visible label carefully. Do not use outside knowledge
to fill in missing label information.

Return ONLY one valid JSON object with this exact structure:

{{
  "product_name": null,
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
1. Read the exact ingredient paragraph. Preserve its wording and order in
   ingredients_text. Also split it into an ingredients array when possible.
   Do not invent ingredients or complete cut-off words.
2. Read allergen statements separately. Put definite "CONTAINS" items in
   allergens.contains and precautionary "MAY CONTAIN" items in
   allergens.may_contain. Do not infer allergens merely because an ingredient
   might contain them. Keep the printed allergen statement in label_text or
   allergens.label_text.
3. Distinguish net package weight from serving size. For example, a 500 g pack
   may have a serving size of 28 g. Never substitute one for the other.
4. If the label says a serving is a number of pieces and a weight, capture both.
   Example: "3 pieces (28 g)" means serving_size=28, serving_unit="g",
   pieces_per_serving=3, serving_description="3 pieces".
5. Capture servings_per_pack only when printed. Preserve wording such as
   "about 18" as a string.
6. Extract nutrition values into the correct columns. If the label has both
   "per serving" and "per 100 g", keep them separate. Never put a per-100-g
   value into nutrition_per_serving or vice versa.
7. Set nutrition_basis to "per_serving" only when a separate per-serving
   nutrition column is visibly printed. Set "per_100g" when only a per-100-g
   column is printed. Set "both" only when both separate columns are visible.
8. If the heading says "Amount per 100g", put the values ONLY in
   nutrition_per_100g and leave nutrition_per_serving values null.
9. Nutrient values must be JSON numbers or null. If the label prints "<1",
   "less than 1", or an unreadable value, use null and add a note to
   uncertain_fields. Do not convert it to 0 or guess.
10. Use the units implied by the label. The expected units are kcal, g and mg.
11. If any field is absent, return null or an empty array. Do not guess.
12. label_text should contain other clearly readable label wording useful for
    checking the extraction, including nutrition headings and allergen text.
13. Do not calculate values, convert per-100-g values, or derive serving values.
14. Do not give health advice. This task is transcription and structuring only.
15. Return JSON only. No Markdown fences or explanatory text.
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
        # Recover the first JSON object if the model added surrounding text.
        start = content.find("{")
        end = content.rfind("}")
        if start >= 0 and end > start:
            return json.loads(content[start:end + 1])
        raise


def _clean_nutrition(values):
    """Keep only non-negative numeric values; leave uncertain values null."""
    cleaned = {}
    values = values if isinstance(values, dict) else {}

    for nutrient in NUTRIENTS:
        value = values.get(nutrient)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            cleaned[nutrient] = None
        elif value < 0:
            cleaned[nutrient] = None
        else:
            cleaned[nutrient] = value

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
    return bool(re.search(r"\b(?:amount\s+)?per\s+serv(?:ing)?\b", text))


def _has_explicit_per_100g_heading(label_text):
    text = (label_text or "").lower()
    return bool(re.search(r"\b(?:amount\s+)?per\s*100\s*g\b", text))


def _flag_transcription_conflicts(nutrition_values, label_text, uncertain_fields):
    """Null a structured value when it conflicts with the transcribed label."""
    text = (label_text or "").lower()
    patterns = {
        "saturated_fat": r"\bsat(?:urated)?\.?\s*fat\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g\b",
        "total_fat": r"\btotal\s*fat\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g\b",
        "trans_fat": r"\btrans[\s-]*fat\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g\b",
        "sodium": r"\bsodium\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*mg\b",
        "protein": r"\bprotein\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g\b",
    }
    for nutrient, pattern in patterns.items():
        match = re.search(pattern, text)
        value = nutrition_values.get(nutrient)
        if match and isinstance(value, (int, float)) and not isinstance(value, bool):
            printed_value = float(match.group(1))
            if abs(float(value) - printed_value) > 0.01:
                nutrition_values[nutrient] = None
                uncertain_fields.append(
                    f"{nutrient}: extracted value conflicts with label text ({printed_value:g} g/mg); verify the original image."
                )


def analyze_label_image(image_bytes):
    """
    Send a food-label image to the local Qwen vision model.
    Return structured product, ingredient, allergen and nutrition data.
    """
    if not image_bytes:
        raise ValueError("The uploaded image is empty.")

    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "model": MODEL_NAME,
        "stream": False,
        "think": False,
        "format": "json",
        "options": {
            "temperature": 0,
            "num_predict": 1400,
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

    # When the printed label explicitly has only an Amount per 100g column,
    # move any values Qwen misplaced into the per-serving object to per-100g.
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

    _flag_transcription_conflicts(per_100g, label_text, uncertain_fields)
    _flag_transcription_conflicts(per_serving, label_text, uncertain_fields)

    return {
        "product_name": _clean_string(extracted.get("product_name")),
        "net_weight": _clean_string(extracted.get("net_weight")),
        "serving_size": _clean_string(extracted.get("serving_size")),
        "serving_unit": _clean_string(extracted.get("serving_unit")) or "g",
        "pieces_per_serving": extracted.get("pieces_per_serving")
        if isinstance(extracted.get("pieces_per_serving"), (int, float))
        and not isinstance(extracted.get("pieces_per_serving"), bool)
        else None,
        "serving_description": _clean_string(
            extracted.get("serving_description")
        ),
        "servings_per_pack": _clean_string(
            extracted.get("servings_per_pack")
        ),
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
