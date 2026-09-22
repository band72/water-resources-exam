#!/usr/bin/env python3
import os
import sys
import json
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
TRANSCRIPTS_DIR = os.path.join(DATA_DIR, "transcripts")
VIDEOS_DIR = os.path.join(DATA_DIR, "videos")
RAW_META_FILE = os.path.join(DATA_DIR, "raw_metadata.json")

os.makedirs(TRANSCRIPTS_DIR, exist_ok=True)
os.makedirs(VIDEOS_DIR, exist_ok=True)

BREADTH_VIDEOS = [
    ("sKoRjPbc-gw", 51, "PE Exam Practice Problem #51: Transportation | Horizontal Curve"),
    ("CHlSXBiVz_I", 52, "PE Exam Practice Problem #52: Transportation | Vertical Curve"),
    ("LApacNuhEJA", 53, "PE Exam Practice Problem #53: Transportation | Traffic Counts - Average Daily Volume"),
    ("skXYGd9SYvg", 54, "PE Exam Practice Problem #54: Materials | Geotechnical - Vertical Stress"),
    ("7b7HSUyyY6c", 55, "PE Exam Practice Problem #55: Materials | Geotechnical - USCS and AASHTO - Concept"),
    ("u8h7aqXLScE", 56, "PE Exam Practice Problem #56: Materials | Geotechnical - Standard Penetration Test - Concept"),
    ("CaZsO5IaLEo", 57, "PE Exam Practice Problem #57: Materials | Concrete Design - Concept"),
    ("C1BKZSgYSqk", 58, "PE Exam Practice Problem #58: Materials | Concrete - Compressive Strength"),
    ("BuXXiVRKBZ8", 59, "PE Exam Practice Problem #59: Materials | Geotechnical - Soil Properties - Dry Unit Weight"),
    ("31Up97hsMJ0", 60, "PE Exam Practice Problem #60: Means and Methods | Construction Loads"),
    ("wb0zYwEgjpI", 61, "PE Exam Practice Problem #61: Means and Methods | Construction Geometry"),
    ("-N0vfkBfZpw", 62, "PE Exam Practice Problem #62: Means and Methods | Geotechnical - Safety Factors - Concept"),
    ("7Hve5SNvLP0", 63, "PE Exam Practice Problem #63: Means and Methods | Structural Loads - Concept"),
    ("UVPSJ0dHzPU", 64, "PE Exam Practice Problem #64: Project Planning | Cost Estimating - Depreciation"),
    ("GGe45vL5n68", 65, "PE Exam Practice Problem #65: Project Planning | Cost Estimating - Budgeting"),
    ("-6PNObya0YU", 66, "PE Exam Practice Problem #66: Project Planning | Critical Path Method - PE application and studying"),
    ("pCTBfwc5yPI", 67, "PE Exam Practice Problem #67: Site Development | Cut and Fill - Geometry"),
    ("GYxHsG3sBw4", 68, "PE Exam Practice Problem #68: Site Development | Cut and Fill - Earthwork Volumes"),
    ("fLTYRFHkcIU", 69, "PE Exam Practice Problem #69: Site Development | Safety (OSHA) - Slope Stability"),
    ("qpv5ul8x3jY", 70, "PE Exam Practice Problem #70: Soil Mechanics | Pore Pressure - Concept"),
    ("nHiUB6PUvGc", 71, "PE Exam Practice Problem #71: Soil Mechanics | Soil Selection Using USCS Method - Concept"),
    ("y5CYFxTmRHU", 72, "PE Exam Practice Problem #72: Soil Mechanics | Settlement - Concept"),
    ("y0XpTREcq5g", 73, "PE Exam Practice Problem #73: Soil Mechanics | AASHTO Slope Stability"),
    ("n08QfNjc2FY", 74, "PE Exam Practice Problem #74: Structural Mechanics | Retaining Wall - Horizontal Pressure"),
    ("qOHQagblwtA", 75, "PE Exam Practice Problem #75: Structural Mechanics | Truss System - Force Analysis - 0 Force Members"),
    ("FmdDO9JIlNY", 76, "PE Exam Practice Problem #76: Structural Mechanics | Simply Supported Beam - Bending Moment"),
    ("O-VX0VNnpqA", 77, "PE Exam Practice Problem #77: Structural Mechanics | Beams - Point Load vs Distributed Load"),
    ("YSy6tPP1XgI", 78, "PE Exam Practice Problem #78: Soil Mechanics | Retaining Wall - Rakine Active Earth Pressure"),
    ("mFiNzMXw4FY", 79, "PE Exam Practice Problem #79: Structural Mechanics | Steel Failure - Concept"),
    ("04QX0_qt8oA", 80, "PE Exam Practice Problem #80: Structural Mechanics | Beams - Shear and Moment Diagrams - Concept")
]

def clean_vtt(vtt_content):
    lines = vtt_content.splitlines()
    segments = []
    current_time = None
    time_re = re.compile(r"(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})")
    
    last_text = ""
    for line in lines:
        line = line.strip()
        if not line or line.startswith("WEBVTT") or line.startswith("Kind:") or line.startswith("Language:"):
            continue
        m = time_re.search(line)
        if m:
            current_time = m.groups()
            continue
        if current_time:
            clean = re.sub(r"<[^>]+>", "", line).strip()
            if not clean:
                continue
            if clean == last_text or last_text.endswith(clean):
                continue
            h, m_val, s = current_time[0].split(":")
            sec = int(h) * 3600 + int(m_val) * 60 + float(s)
            mm_ss = f"{int(sec // 60):02d}:{int(sec % 60):02d}"
            
            segments.append({
                "start": current_time[0],
                "end": current_time[1],
                "start_seconds": round(sec, 1),
                "timestamp": mm_ss,
                "text": clean
            })
            last_text = clean

    plain_text = " ".join([s["text"] for s in segments])
    plain_text = re.sub(r"\b(\w+)( \1\b)+", r"\1", plain_text, flags=re.IGNORECASE)
    return segments, plain_text

def fetch_single_breadth(item):
    vid, prob_num, expected_title = item
    vtt_path = os.path.join(TRANSCRIPTS_DIR, f"{vid}.en.vtt")
    txt_path = os.path.join(TRANSCRIPTS_DIR, f"{vid}.txt")
    
    # 1. Fetch metadata
    cmd_meta = [
        "yt-dlp", "-j",
        "--extractor-args", "youtube:player_client=android,web",
        f"https://www.youtube.com/watch?v={vid}"
    ]
    res_meta = subprocess.run(cmd_meta, capture_output=True, text=True)
    if res_meta.returncode != 0:
        print(f"Failed metadata for {vid} (#{prob_num}): {res_meta.stderr[:200]}")
        return None
    
    meta = json.loads(res_meta.stdout)
    
    # 2. Subtitles
    if not os.path.exists(vtt_path):
        cmd_sub = [
            "yt-dlp", "--skip-download",
            "--write-auto-subs", "--sub-lang", "en",
            "--sub-format", "vtt",
            "--extractor-args", "youtube:player_client=android,web",
            "-o", os.path.join(TRANSCRIPTS_DIR, f"{vid}.%(ext)s"),
            f"https://www.youtube.com/watch?v={vid}"
        ]
        subprocess.run(cmd_sub, capture_output=True, text=True)
        
    segments = []
    plain_text = ""
    if os.path.exists(vtt_path):
        with open(vtt_path, "r", encoding="utf-8") as f:
            vtt_content = f.read()
        segments, plain_text = clean_vtt(vtt_content)
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(plain_text)
            
    title = meta.get("title") or expected_title
    
    entry = {
        "id": vid,
        "title": title,
        "problem_number": prob_num,
        "description": meta.get("description", ""),
        "duration": meta.get("duration", 0),
        "duration_string": meta.get("duration_string", ""),
        "upload_date": meta.get("upload_date", ""),
        "view_count": meta.get("view_count", 0),
        "thumbnail": meta.get("thumbnail", f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"),
        "youtube_url": f"https://www.youtube.com/watch?v={vid}",
        "embed_url": f"https://www.youtube-nocookie.com/embed/{vid}",
        "playlists": ["Civil Breadth"],
        "segments": segments,
        "plain_transcript": plain_text
    }
    print(f"✓ Metadata & Subtitles [{vid}] Prob #{prob_num}: {title[:45]} (Chars: {len(plain_text)})")
    return entry

def main():
    print(f"Fetching metadata and subtitles for {len(BREADTH_VIDEOS)} Civil Breadth videos...")
    new_entries = []
    
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fetch_single_breadth, item): item[0] for item in BREADTH_VIDEOS}
        for future in as_completed(futures):
            res = future.result()
            if res:
                new_entries.append(res)
                
    print(f"\nFetched {len(new_entries)} / {len(BREADTH_VIDEOS)} entries.")
    
    # Load existing raw metadata
    existing = []
    if os.path.exists(RAW_META_FILE):
        with open(RAW_META_FILE, "r", encoding="utf-8") as f:
            existing = json.load(f)
            
    existing_dict = {e["id"]: e for e in existing}
    for e in new_entries:
        existing_dict[e["id"]] = e
        
    merged = list(existing_dict.values())
    merged.sort(key=lambda x: (x["problem_number"] if x.get("problem_number") is not None else 9999, x.get("title", "")))
    
    with open(RAW_META_FILE, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
        
    print(f"✓ Saved total {len(merged)} entries to {RAW_META_FILE}!")

if __name__ == "__main__":
    main()
