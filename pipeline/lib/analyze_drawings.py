#!/usr/bin/env python3
"""
pipeline/lib/analyze_drawings.py

Analyzes construction drawing PDFs using PyMuPDF (rasterization + annotation)
and Claude vision. Produces:
  - project-profile.json  aggregated building data
  - [filename]_annotated.pdf  PDF with color-coded annotation rectangles

Usage:
  python3 analyze_drawings.py \
    --project-id  <uuid> \
    --customer-id <uuid> \
    --output-dir  <path> \
    <pdf_path> [<pdf_path> ...]

Exit codes: 0 = success, 1 = error (message on stderr)
"""

import sys
import os
import json
import base64
import time
import argparse
from datetime import datetime, timezone
from pathlib import Path

import fitz          # PyMuPDF
import anthropic

# ─── Constants ────────────────────────────────────────────────────────────────

MODEL          = "claude-sonnet-4-6"
MAX_TOKENS     = 4096
DPI_STANDARD   = 200
DPI_LARGE      = 250          # ARCH D (24×36) and larger
ARCH_D_PTS     = 24 * 72      # 1728 pt — one side threshold for large-format

# LEED certification category colours (r, g, b) in 0–1 range
CATEGORY_COLORS = {
    "Water Efficiency":            (0,    0.5,  1   ),
    "Water Concept":               (0,    0.5,  1   ),
    "Sustainable Sites":           (0.2,  0.7,  0.2 ),
    "Indoor Environmental Quality":(1,    0.6,  0   ),
    "Mind":                        (1,    0.6,  0   ),
    "Energy and Atmosphere":       (0.9,  0.9,  0   ),
    "Materials and Resources":     (0.6,  0.3,  0.8 ),
    "Location and Transportation": (0.1,  0.7,  0.7 ),
    "WELL Air":                    (0,    0.7,  0.9 ),
    "WELL Nourishment":            (0.9,  0.5,  0.1 ),
}

DEFAULT_COLOR = (0.5, 0.5, 0.5)

# ─── Sheet-type element lists ─────────────────────────────────────────────────

SHEET_ELEMENTS = {
    "architectural": [
        "rooms and room labels", "bathrooms and toilet rooms", "showers",
        "changing rooms", "lockers", "windows", "doors", "stairs",
        "floor area labels", "occupancy labels", "bicycle storage rooms",
        "break rooms and kitchens", "accessible routes",
    ],
    "civil_site": [
        "bicycle racks and bicycle parking", "vehicle parking spaces",
        "accessible parking spaces", "EV charging spaces", "preferred parking spaces",
        "landscaping areas", "impervious surfaces", "building footprint",
        "site entrance and access points", "pedestrian paths",
        "stormwater features", "site area boundaries",
    ],
    "plumbing": [
        "toilets and water closets", "urinals", "lavatories and sinks",
        "showers", "kitchen sinks", "janitor sinks", "mop sinks",
        "drinking fountains", "hose bibbs", "water heaters",
        "low-flow fixture labels", "dual-flush labels",
    ],
    "mep": [
        "EV charging stations", "electrical panels", "mechanical equipment",
        "renewable energy systems", "solar panels", "battery storage",
        "electrical rooms", "transformer vaults",
    ],
    "roof": [
        "green roof areas", "solar panel arrays", "skylights",
        "rooftop mechanical equipment", "roof area labels",
    ],
    "index": [
        "sheet numbers", "sheet titles", "drawing index table",
        "project name", "project address",
    ],
}

SHEET_TYPE_KEYWORDS = {
    "index":        ["index", "drawing list", "sheet list", "g0", "g-0", "g1.", "g-1"],
    "civil_site":   ["civil", "site plan", "c0", "c1", "c2", "c3", "l1", "l2", "landscape"],
    "plumbing":     ["plumbing", "p0", "p1", "p2", "p3", "sanitary", "domestic water"],
    "mep":          ["electrical", "mechanical", "e1", "e2", "m1", "m2", "hvac"],
    "roof":         ["roof plan", "roof", "r0", "r1"],
    "architectural":["floor plan", "a0", "a1", "a2", "a3", "a4", "a5", "architectural"],
}

# ─── Prompt builder ───────────────────────────────────────────────────────────

def build_prompt(sheet_type: str) -> str:
    elements = SHEET_ELEMENTS.get(sheet_type, SHEET_ELEMENTS["architectural"])
    element_list = "\n".join(f"  - {e}" for e in elements)
    return f"""You are analyzing a construction drawing for building certification documentation.
Sheet type: {sheet_type.replace("_", " ").title()}

Identify and locate EVERY element listed below that appears on this drawing.
For each element return its pixel bounding box, label as shown on drawing, count, and notes.
Respond ONLY in valid JSON — no explanation, no preamble.

Elements to find:
{element_list}

JSON format:
{{
  "elements": [
    {{
      "type": "element type",
      "certification_category": "LEED or WELL category this supports",
      "count": 0,
      "instances": [
        {{"bbox": [x1, y1, x2, y2], "label": "visible label on drawing", "notes": "any detail"}}
      ]
    }}
  ],
  "sheet_info": {{
    "drawing_type": "detected sheet type",
    "scale": "detected drawing scale e.g. 1/8 = 1-0",
    "level": "floor level or site",
    "project_name": "from title block if visible",
    "project_address": "from title block if visible"
  }},
  "confidence_notes": "any ambiguities or uncertain detections"
}}

IMPORTANT: For each element where count matters (fixtures, parking, racks) verify by
counting each instance in your instances array — array length MUST equal the count field."""


VERIFICATION_PROMPT = """You previously found {count} {element_type} on this drawing sheet.
Review the image again carefully and confirm this count.
If you find a different number return:
{{"confirmed": false, "corrected_count": <number>, "explanation": "<what changed>"}}
If the count is correct return:
{{"confirmed": true, "corrected_count": {count}}}
Respond only in valid JSON."""

# ─── Helpers ──────────────────────────────────────────────────────────────────

def detect_sheet_type(text: str) -> str:
    lower = text.lower()
    for sheet_type, keywords in SHEET_TYPE_KEYWORDS.items():
        if any(k in lower for k in keywords):
            return sheet_type
    return "architectural"


def color_for_category(category: str) -> tuple:
    for key, color in CATEGORY_COLORS.items():
        if key.lower() in category.lower():
            return color
    return DEFAULT_COLOR


def parse_json_response(text: str) -> dict:
    # Strip markdown fences if present
    import re
    text = re.sub(r"^```json\s*", "", text.strip(), flags=re.IGNORECASE)
    text = re.sub(r"```\s*$", "", text.strip())
    # Extract first JSON object/array
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        return json.loads(match.group(0))
    return json.loads(text)


# ─── Core per-sheet analysis ──────────────────────────────────────────────────

def analyze_sheet(client: anthropic.Anthropic, page: fitz.Page, sheet_type: str,
                  sheet_name: str) -> dict:
    t0 = time.time()

    # Determine DPI based on page size
    rect = page.rect
    dpi  = DPI_LARGE if max(rect.width, rect.height) >= ARCH_D_PTS else DPI_STANDARD
    scale = dpi / 72.0

    # Rasterize
    import io
    from PIL import Image as PILImage

    mat      = fitz.Matrix(scale, scale)
    pix      = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB, alpha=False)
    img_w    = pix.width
    img_h    = pix.height

    # Resize to max 2500px on longest side, encode as JPEG to stay under 5 MB API limit
    MAX_SIDE = 2500
    if max(img_w, img_h) > MAX_SIDE:
        factor = MAX_SIDE / max(img_w, img_h)
        img    = PILImage.open(io.BytesIO(pix.tobytes("png")))
        img    = img.resize((round(img_w * factor), round(img_h * factor)), PILImage.LANCZOS)
        buf    = io.BytesIO()
        img.save(buf, format="JPEG", quality=92)
        jpeg_bytes = buf.getvalue()
        img_w  = img.width
        img_h  = img.height
    else:
        jpeg_bytes = pix.tobytes("jpeg", jpg_quality=92)

    b64        = base64.standard_b64encode(jpeg_bytes).decode()
    media_type = "image/jpeg"

    prompt = build_prompt(sheet_type)

    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64",
                                              "media_type": media_type,
                                              "data": b64}},
                {"type": "text", "text": prompt},
            ],
        }],
    )

    raw = response.content[0].text
    try:
        result = parse_json_response(raw)
    except Exception as e:
        print(f"  [WARN] JSON parse failed for {sheet_name}: {e}", file=sys.stderr)
        result = {"elements": [], "sheet_info": {}, "confidence_notes": f"parse error: {e}"}

    # Cross-validate counts for critical elements
    critical_types = {"bicycle", "rack", "toilet", "urinal", "lavatory", "shower",
                      "sink", "parking", "ev charging", "fountain"}
    for element in result.get("elements", []):
        el_type  = element.get("type", "").lower()
        el_count = element.get("count", 0)
        if el_count > 0 and any(k in el_type for k in critical_types):
            vp = VERIFICATION_PROMPT.format(count=el_count, element_type=el_type)
            vr = client.messages.create(
                model=MODEL,
                max_tokens=256,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64",
                                                      "media_type": media_type,
                                                      "data": b64}},
                        {"type": "text", "text": vp},
                    ],
                }],
            )
            try:
                vresult = parse_json_response(vr.content[0].text)
                if not vresult.get("confirmed", True):
                    corrected = vresult.get("corrected_count", el_count)
                    print(f"  [VERIFY] {el_type}: {el_count} → {corrected} "
                          f"({vresult.get('explanation','')})")
                    element["count"] = corrected
            except Exception:
                pass

    elapsed = round(time.time() - t0, 1)
    el_count = sum(e.get("count", 0) for e in result.get("elements", []))
    print(f"  [{sheet_name}] type={sheet_type} elements={el_count} {elapsed}s")

    result["_meta"] = {
        "sheet_name": sheet_name,
        "sheet_type": sheet_type,
        "dpi": dpi,
        "scale_factor": scale,
        "page_width_pt": rect.width,
        "page_height_pt": rect.height,
        "img_width_px": img_w,
        "img_height_px": img_h,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
    }
    return result


# ─── PDF annotation ───────────────────────────────────────────────────────────

def annotate_pdf(src_path: str, out_path: str, sheet_results: list[dict]) -> bool:
    doc = fitz.open(src_path)

    for page_idx, result in enumerate(sheet_results):
        if page_idx >= len(doc):
            break
        page = doc[page_idx]
        meta = result.get("_meta", {})

        # Use actual image dimensions vs page dimensions for back-conversion.
        # Claude bbox coords are in the resized image pixel space; divide by the
        # effective scale (img_px / page_pt) to get PDF point coordinates.
        page_w = meta.get("page_width_pt",  page.rect.width)
        page_h = meta.get("page_height_pt", page.rect.height)
        img_w  = meta.get("img_width_px",   page_w * DPI_STANDARD / 72.0)
        img_h  = meta.get("img_height_px",  page_h * DPI_STANDARD / 72.0)
        sx     = img_w / page_w   # pixels per PDF point  (x axis)
        sy     = img_h / page_h   # pixels per PDF point  (y axis)

        for element in result.get("elements", []):
            category = element.get("certification_category", "")
            color    = color_for_category(category)
            el_type  = element.get("type", "unknown")
            el_count = element.get("count", 0)

            for inst in element.get("instances", []):
                bbox = inst.get("bbox")
                if not bbox or len(bbox) != 4:
                    continue
                x1, y1, x2, y2 = bbox

                # Convert pixel coords → PDF points using per-axis scale
                rx1 = x1 / sx
                ry1 = y1 / sy
                rx2 = x2 / sx
                ry2 = y2 / sy
                rect = fitz.Rect(rx1, ry1, rx2, ry2)

                # Rectangle annotation
                annot = page.add_rect_annot(rect)
                annot.set_colors(stroke=color, fill=None)
                annot.set_border(width=1.5)
                popup_text = (f"{el_type}\n"
                              f"Category: {category}\n"
                              f"Count on sheet: {el_count}\n"
                              f"Label: {inst.get('label','')}\n"
                              f"Notes: {inst.get('notes','')}")
                annot.set_info(content=popup_text, title="CertifyAI")
                annot.update()

                # Visible callout text above the box
                label_pt = fitz.Point(rx1, max(ry1 - 2, 4))
                short_label = el_type[:30]
                page.insert_text(label_pt, short_label,
                                 fontsize=6, color=color)

    doc.save(out_path, garbage=4, deflate=True)
    doc.close()
    return True


# ─── Aggregation ─────────────────────────────────────────────────────────────

def aggregate(sheet_results: list[dict], project_id: str, customer_id: str,
              pdf_paths: list[str]) -> dict:

    def first(*keys):
        for r in sheet_results:
            si = r.get("sheet_info", {})
            for k in keys:
                if si.get(k):
                    return si[k]
        return None

    def sum_type(*keywords):
        total = 0
        for r in sheet_results:
            for el in r.get("elements", []):
                if any(k in el.get("type", "").lower() for k in keywords):
                    total += el.get("count", 0)
        return total or None

    def find_bool(*keywords):
        for r in sheet_results:
            for el in r.get("elements", []):
                if any(k in el.get("type", "").lower() for k in keywords):
                    if el.get("count", 0) > 0:
                        return True
        return None

    sheets_analyzed = [r.get("_meta", {}).get("sheet_name", f"sheet_{i}")
                       for i, r in enumerate(sheet_results)]

    total_input  = sum(r.get("_meta", {}).get("input_tokens",  0) for r in sheet_results)
    total_output = sum(r.get("_meta", {}).get("output_tokens", 0) for r in sheet_results)

    profile = {
        "project_id":           project_id,
        "customer_id":          customer_id,
        "project_name":         first("project_name"),
        "project_address":      first("project_address"),
        "building_type":        None,
        "gross_square_footage": None,
        "net_square_footage":   None,
        "stories_above_grade":  None,
        "stories_below_grade":  None,
        "primary_occupancy":    None,
        "plumbing_fixtures": {
            "toilets":            sum_type("toilet", "water closet"),
            "urinals":            sum_type("urinal"),
            "lavatories":         sum_type("lavatory", "sink"),
            "showers":            sum_type("shower"),
            "kitchen_sinks":      sum_type("kitchen sink"),
            "janitor_sinks":      sum_type("janitor sink", "mop sink"),
            "drinking_fountains": sum_type("drinking fountain"),
            "hose_bibbs":         sum_type("hose bibb"),
        },
        "parking": {
            "total_spaces":      sum_type("vehicle parking", "parking space"),
            "accessible_spaces": sum_type("accessible parking"),
            "ev_ready_spaces":   sum_type("ev charging", "ev ready"),
            "preferred_spaces":  sum_type("preferred parking"),
            "bicycle_spaces":    sum_type("bicycle", "bike rack"),
        },
        "site": {
            "site_area_sqft":           None,
            "landscaping_area_sqft":    None,
            "impervious_surface_sqft":  None,
            "building_footprint_sqft":  None,
        },
        "windows": {
            "total_count":       sum_type("window"),
            "window_wall_ratio": None,
        },
        "amenities": {
            "shower_facilities":      sum_type("shower"),
            "changing_rooms":         sum_type("changing room", "locker"),
            "bicycle_storage_rooms":  sum_type("bicycle storage room"),
            "green_roof_area_sqft":   None,
            "solar_panels":           find_bool("solar panel"),
            "ev_charging_stations":   sum_type("ev charging station"),
        },
        "functional_entry":      None,
        "building_orientation":  None,
        "flagged_fields":        [],
        "drawing_sheets_analyzed": sheets_analyzed,
        "analysis_date":         datetime.now(timezone.utc).isoformat(),
        "_token_usage": {
            "input_tokens":  total_input,
            "output_tokens": total_output,
        },
    }

    # Flag fields that are still None
    def flag_nulls(obj, prefix=""):
        for k, v in obj.items():
            if k.startswith("_"):
                continue
            path = f"{prefix}{k}" if not prefix else f"{prefix}.{k}"
            if isinstance(v, dict):
                flag_nulls(v, path)
            elif v is None:
                profile["flagged_fields"].append(path)

    flag_nulls(profile)
    return profile


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-id",  required=True)
    parser.add_argument("--customer-id", required=True)
    parser.add_argument("--output-dir",  required=True)
    parser.add_argument("pdfs", nargs="+")
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ANTHROPIC_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    client     = anthropic.Anthropic(api_key=api_key, timeout=180)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    t_total     = time.time()
    all_results = []   # [{sheet_result, pdf_path, page_idx}]

    # Group results by PDF so we can annotate each file separately
    pdf_sheet_map: dict[str, list[dict]] = {}

    # Process index sheet first if present
    def sort_key(p: str) -> int:
        name = Path(p).stem.lower()
        return 0 if any(k in name for k in ["index", "g0", "g-0", "g1", "g001"]) else 1

    sorted_pdfs = sorted(args.pdfs, key=sort_key)

    for pdf_path in sorted_pdfs:
        pdf_name = Path(pdf_path).stem
        print(f"\n[{pdf_name}]")
        doc = fitz.open(pdf_path)

        sheet_results_for_pdf = []
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            # Extract title block text to determine sheet type
            title_text = page.get_text("text", clip=fitz.Rect(0,
                                        page.rect.height * 0.85,
                                        page.rect.width,
                                        page.rect.height))
            sheet_type  = detect_sheet_type(title_text or pdf_name)
            sheet_name  = f"{pdf_name}_p{page_idx+1}"
            result      = analyze_sheet(client, page, sheet_type, sheet_name)
            sheet_results_for_pdf.append(result)
            all_results.append(result)

        doc.close()
        pdf_sheet_map[pdf_path] = sheet_results_for_pdf

    # Annotate each PDF
    annotated_paths = []
    for pdf_path, sheet_results in pdf_sheet_map.items():
        out_name = Path(pdf_path).stem + "_annotated.pdf"
        out_path = str(output_dir / out_name)
        try:
            annotate_pdf(pdf_path, out_path, sheet_results)
            annotated_paths.append(out_path)
            print(f"\n[annotated] {out_name}")
        except Exception as e:
            print(f"[WARN] annotation failed for {pdf_path}: {e}", file=sys.stderr)

    # Aggregate into project profile
    profile = aggregate(all_results, args.project_id, args.customer_id, args.pdfs)
    profile_path = output_dir / "project-profile.json"
    profile_path.write_text(json.dumps(profile, indent=2))

    # Summary output (consumed by TypeScript orchestrator)
    elapsed = round(time.time() - t_total, 1)
    summary = {
        "success":         True,
        "sheets_analyzed": len(all_results),
        "annotated_pdfs":  annotated_paths,
        "profile_path":    str(profile_path),
        "flagged_fields":  profile["flagged_fields"],
        "token_usage":     profile["_token_usage"],
        "elapsed_seconds": elapsed,
    }
    print("\n__RESULT__")
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
