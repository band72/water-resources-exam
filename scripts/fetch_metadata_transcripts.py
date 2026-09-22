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

PLAYLISTS = [
    {"name": "Water Resources", "id": "PLSmaynU2YGjG4Negovw1AzlF6vCvkKby0"},
    {"name": "Environmental", "id": "PLSmaynU2YGjEcG01aUuQZxChBDycVfIdT"}
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

def get_playlist_videos(playlist_id):
    cmd = ["yt-dlp", "--flat-playlist", "-J", f"https://www.youtube.com/playlist?list={playlist_id}"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error fetching playlist {playlist_id}: {res.stderr}")
        return []
    data = json.loads(res.stdout)
    return data.get("entries", [])

def fetch_single_video(video_info, playlists_map):
    video_id = video_info["id"]
    vtt_path = os.path.join(TRANSCRIPTS_DIR, f"{video_id}.en.vtt")
    txt_path = os.path.join(TRANSCRIPTS_DIR, f"{video_id}.txt")
    
    cmd_meta = ["yt-dlp", "-j", f"https://www.youtube.com/watch?v={video_id}"]
    res_meta = subprocess.run(cmd_meta, capture_output=True, text=True)
    if res_meta.returncode != 0:
        print(f"Failed metadata for {video_id}: {res_meta.stderr[:200]}")
        return None
    
    meta = json.loads(res_meta.stdout)
    
    if not os.path.exists(vtt_path):
        cmd_sub = [
            "yt-dlp", "--skip-download",
            "--write-auto-subs", "--sub-lang", "en",
            "--sub-format", "vtt",
            "-o", os.path.join(TRANSCRIPTS_DIR, f"{video_id}.%(ext)s"),
            f"https://www.youtube.com/watch?v={video_id}"
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
    
    title = meta.get("title", "")
    prob_num_match = re.search(r"Practice Problem #(\d+)", title, re.IGNORECASE)
    prob_num = int(prob_num_match.group(1)) if prob_num_match else None
    
    entry = {
        "id": video_id,
        "title": title,
        "problem_number": prob_num,
        "description": meta.get("description", ""),
        "duration": meta.get("duration", 0),
        "duration_string": meta.get("duration_string", ""),
        "upload_date": meta.get("upload_date", ""),
        "view_count": meta.get("view_count", 0),
        "thumbnail": meta.get("thumbnail", ""),
        "youtube_url": f"https://www.youtube.com/watch?v={video_id}",
        "embed_url": f"https://www.youtube-nocookie.com/embed/{video_id}",
        "playlists": list(playlists_map.get(video_id, [])),
        "segments": segments,
        "plain_transcript": plain_text
    }
    print(f"✓ Fetched [{video_id}] Prob #{prob_num}: {title[:50]} (Transcript chars: {len(plain_text)})")
    return entry

def main():
    os.makedirs(TRANSCRIPTS_DIR, exist_ok=True)
    print("Collecting videos from playlists...")
    
    video_map = {}
    playlists_map = {}
    
    for p in PLAYLISTS:
        entries = get_playlist_videos(p["id"])
        print(f"Playlist \x27{p['name']}\x27: found {len(entries)} entries")
        for e in entries:
            vid = e.get("id")
            title = e.get("title")
            if not vid or not title or title.strip() in ["None", "[Private video]", "[Deleted video]"]:
                continue
            video_map[vid] = e
            playlists_map.setdefault(vid, set()).add(p["name"])
            
    all_videos = list(video_map.values())
    print(f"Total unique available practice problem videos: {len(all_videos)}")
    
    results = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(fetch_single_video, v, playlists_map): v["id"] for v in all_videos}
        for future in as_completed(futures):
            vid = futures[future]
            try:
                res = future.result()
                if res:
                    results.append(res)
            except Exception as e:
                print(f"Exception processing {vid}: {e}")
                
    results.sort(key=lambda x: (x["problem_number"] if x["problem_number"] is not None else 9999, x["title"]))
    
    raw_meta_file = os.path.join(DATA_DIR, "raw_metadata.json")
    with open(raw_meta_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
        
    print(f"\nSuccessfully processed and saved {len(results)} videos and transcripts to {raw_meta_file}!")

if __name__ == "__main__":
    main()
