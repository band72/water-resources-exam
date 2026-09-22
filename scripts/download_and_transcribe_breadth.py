#!/usr/bin/env python3
import os
import sys
import json
import time
import subprocess

# Bypass coverage issue with numba
sys.modules['coverage'] = None
sys.modules['coverage.types'] = None
import whisper

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
TRANSCRIPTS_DIR = os.path.join(DATA_DIR, "transcripts")
VIDEOS_DIR = os.path.join(DATA_DIR, "videos")
RAW_META_FILE = os.path.join(DATA_DIR, "raw_metadata.json")
COOKIES_FILE = os.path.join(BASE_DIR, "firefox_cookies.txt")

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

def format_timestamp(seconds):
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m:02d}:{s:02d}"

def format_vtt_time(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"

def main():
    print("Loading Whisper model (tiny.en on CUDA)...")
    model = whisper.load_model("tiny.en", device="cuda")
    print("✓ Whisper model loaded.")
    
    env = dict(os.environ)
    env["PATH"] = "/home/artwalk/.deno/bin:" + env.get("PATH", "")
    
    entries = []
    
    for i, (vid, prob_num, fallback_title) in enumerate(BREADTH_VIDEOS):
        print(f"\n[{i+1}/{len(BREADTH_VIDEOS)}] Processing Problem #{prob_num}: {vid}...")
        video_path = os.path.join(VIDEOS_DIR, f"{vid}.mp4")
        vtt_path = os.path.join(TRANSCRIPTS_DIR, f"{vid}.en.vtt")
        txt_path = os.path.join(TRANSCRIPTS_DIR, f"{vid}.txt")
        info_json_path = os.path.join(VIDEOS_DIR, f"{vid}.info.json")
        
        # 1. Download video & metadata if missing
        if not os.path.exists(video_path) or os.path.getsize(video_path) < 100000:
            print(f"  Downloading video {vid}...")
            cmd = [
                "yt-dlp",
                "--remote-components", "ejs:github",
                "--cookies", COOKIES_FILE,
                "-f", "18/b[height<=480]/b",
                "--write-info-json",
                "-o", os.path.join(VIDEOS_DIR, f"{vid}.%(ext)s"),
                f"https://www.youtube.com/watch?v={vid}"
            ]
            res = subprocess.run(cmd, env=env, capture_output=True, text=True)
            if res.returncode != 0:
                print(f"  Warning: yt-dlp failed for {vid}: {res.stderr[:150]}")
        else:
            print(f"  Video already exists ({os.path.getsize(video_path) / (1024*1024):.1f} MB).")
            
        # Ensure info json exists
        meta = {}
        if os.path.exists(info_json_path):
            with open(info_json_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
        else:
            # quick fetch info json
            cmd_info = [
                "yt-dlp",
                "--remote-components", "ejs:github",
                "--cookies", COOKIES_FILE,
                "--skip-download",
                "--write-info-json",
                "-o", os.path.join(VIDEOS_DIR, f"{vid}.%(ext)s"),
                f"https://www.youtube.com/watch?v={vid}"
            ]
            subprocess.run(cmd_info, env=env, capture_output=True, text=True)
            if os.path.exists(info_json_path):
                with open(info_json_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                    
        title = meta.get("title") or fallback_title
        duration = meta.get("duration", 0)
        dur_min = int(duration // 60)
        dur_sec = int(duration % 60)
        dur_str = f"{dur_min:02d}:{dur_sec:02d}"
        
        # 2. Transcribe with Whisper if video exists
        segments = []
        plain_transcript = ""
        
        if os.path.exists(video_path) and os.path.getsize(video_path) > 100000:
            if not os.path.exists(txt_path) or not os.path.exists(vtt_path):
                print(f"  Transcribing with Whisper on GPU...")
                t0 = time.time()
                trans_res = model.transcribe(video_path)
                t1 = time.time()
                print(f"  ✓ Transcribed in {t1 - t0:.2f}s ({len(trans_res['segments'])} segments)")
                
                vtt_lines = ["WEBVTT\n"]
                for seg in trans_res["segments"]:
                    s_sec = seg["start"]
                    e_sec = seg["end"]
                    text = seg["text"].strip()
                    if not text:
                        continue
                    ts = format_timestamp(s_sec)
                    segments.append({
                        "start": format_vtt_time(s_sec),
                        "end": format_vtt_time(e_sec),
                        "start_seconds": round(s_sec, 1),
                        "timestamp": ts,
                        "text": text
                    })
                    vtt_lines.append(f"{format_vtt_time(s_sec)} --> {format_vtt_time(e_sec)}\n{text}\n")
                    
                plain_transcript = " ".join([s["text"] for s in segments])
                
                with open(vtt_path, "w", encoding="utf-8") as f:
                    f.write("\n".join(vtt_lines))
                with open(txt_path, "w", encoding="utf-8") as f:
                    f.write(plain_transcript)
            else:
                print("  Transcript files already exist, reading...")
                with open(txt_path, "r", encoding="utf-8") as f:
                    plain_transcript = f.read()
                    
                # generate segments if needed
                if os.path.exists(vtt_path):
                    from fetch_metadata_transcripts import clean_vtt
                    with open(vtt_path, "r", encoding="utf-8") as f:
                        segments, _ = clean_vtt(f.read())
        
        entry = {
            "id": vid,
            "title": title,
            "problem_number": prob_num,
            "description": meta.get("description", ""),
            "duration": duration,
            "duration_string": dur_str,
            "upload_date": meta.get("upload_date", ""),
            "view_count": meta.get("view_count", 0),
            "thumbnail": meta.get("thumbnail", f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"),
            "youtube_url": f"https://www.youtube.com/watch?v={vid}",
            "embed_url": f"https://www.youtube-nocookie.com/embed/{vid}",
            "playlists": ["Civil Breadth"],
            "segments": segments,
            "plain_transcript": plain_transcript
        }
        entries.append(entry)
        
    print(f"\nFinished processing {len(entries)} Breadth problems.")
    
    # Merge into raw_metadata.json
    existing = []
    if os.path.exists(RAW_META_FILE):
        with open(RAW_META_FILE, "r", encoding="utf-8") as f:
            existing = json.load(f)
            
    existing_map = {e["id"]: e for e in existing}
    for e in entries:
        existing_map[e["id"]] = e
        
    merged = list(existing_map.values())
    merged.sort(key=lambda x: (x.get("problem_number") if x.get("problem_number") is not None else 9999, x.get("title", "")))
    
    with open(RAW_META_FILE, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
        
    print(f"✓ Total problems in {RAW_META_FILE}: {len(merged)}")

if __name__ == "__main__":
    main()
