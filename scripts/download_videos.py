#!/usr/bin/env python3
import os
import sys
import json
import time
import subprocess

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
VIDEOS_DIR = os.path.join(DATA_DIR, "videos")
PROBLEMS_FILE = os.path.join(DATA_DIR, "problems.json")

def download_video(vid, title):
    out_file = os.path.join(VIDEOS_DIR, f"{vid}.mp4")
    temp_file = os.path.join(VIDEOS_DIR, f"{vid}.temp.mp4")
    
    if os.path.exists(out_file) and os.path.getsize(out_file) > 100000:
        print(f"✓ Already downloaded: [{vid}] {title[:40]}")
        return True
        
    cmd = [
        "yt-dlp",
        "--extractor-args", "youtube:player_client=android,web",
        "-f", "b[height<=480]/b",
        "--no-playlist",
        "-o", out_file,
        f"https://www.youtube.com/watch?v={vid}"
    ]
    
    print(f"Downloading [{vid}] {title[:50]}...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0 and os.path.exists(out_file) and os.path.getsize(out_file) > 100000:
        size_mb = os.path.getsize(out_file) / (1024 * 1024)
        print(f"✓ Completed [{vid}] ({size_mb:.1f} MB)")
        return True
    else:
        print(f"✗ Failed [{vid}]: {res.stderr[:200]}")
        return False

def main():
    os.makedirs(VIDEOS_DIR, exist_ok=True)
    
    if not os.path.exists(PROBLEMS_FILE):
        print(f"Error: {PROBLEMS_FILE} not found!")
        sys.exit(1)
        
    with open(PROBLEMS_FILE, "r", encoding="utf-8") as f:
        problems = json.load(f)
        
    print(f"Starting video downloads for {len(problems)} practice problems...")
    
    success = 0
    failed = 0
    
    for i, p in enumerate(problems):
        vid = p["id"]
        title = p["title"]
        print(f"[{i+1}/{len(problems)}] Processing problem #{p.get('problem_number')}...")
        if download_video(vid, title):
            success += 1
        else:
            failed += 1
        # Brief pause between downloads to stay well within YouTube limits
        time.sleep(1.0)
        
    print(f"\nDownload finished! Success: {success}, Failed: {failed}")

if __name__ == "__main__":
    main()
