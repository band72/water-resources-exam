# SolvedIn6 PE Exam Practice Problem Study Portal

An interactive, searchable study portal and video walkthrough dashboard for the **Civil PE Exam**, indexed from the complete [SolvedIn6 YouTube series](https://www.youtube.com/@solvedin6).

Features all **129 problems** spanning **Water Resources**, **Environmental Engineering**, and the **Civil Breadth** specifications with detailed step-by-step KaTeX mathematical solutions, NCEES Reference Handbook search terms, synchronized video playback, and offline video streaming support.

---

## 🚀 Key Features

- **129 PE Exam Problems Cataloged & Classified**:
  - **Water Resources Playlist**: 76 problems (sequential WR #1–#76).
  - **Environmental Playlist**: 65 problems (sequential Env #1–#65).
  - **Civil Breadth Playlist**: 30 problems (sequential Breadth #1–#30, YT #51–#80) covering Transportation (Horizontal Curves #51, Vertical Curves #52), Structural Mechanics, Geotechnical & Soils, and Construction & Planning.
- **Synchronized Video Player**:
  - Dual-mode player: stream directly from YouTube or play local offline MP4 video walkthroughs with HTTP 206 partial-range video streaming.
  - Interactive transcript with timestamp-seek buttons that jump the video to specific calculation steps.
- **KaTeX Mathematical Derivations**:
  - Formulas and step-by-step algebraic substitutions formatted in LaTeX.
  - Step derivation breakdown with NCEES reference chapters, given variables, and clear final answers.
- **Full-Text Multi-Token Search**:
  - Fast search by problem number (`#52`, `WR #12`, `Breadth #2`), topic keywords (`vertical curve`, `manning`, `BOD`, `runoff`), and NCEES handbook terms.
- **Series & Topic Filtering**:
  - Quick filter pills for Hydraulics, Hydrology, Wastewater Treatment, Water Quality, Transportation, Structures, Geotechnical, and Construction.
  - LocalStorage persistence for user bookmarks (Favorites, Mastered, Needs Review).

---

## 🛠️ Tech Stack

- **Backend**: Node.js & Express (`server.js`) with static asset serving and HTTP 206 partial-content video streaming.
- **Frontend**: Vanilla ES6+ JavaScript, CSS3 with responsive dark/light styling, KaTeX for math rendering.
- **Data & Processing Pipeline**:
  - Python scripts using `yt-dlp` for playlist metadata extraction.
  - OpenAI Whisper (`tiny.en` on CUDA) for automated, timestamped audio transcript generation.
  - KaTeX mathematical solution enrichment engine (`scripts/process_solutions.py`).

---

## 📦 Getting Started

### 1. Installation

Clone the repository and install Node.js dependencies:

```bash
git clone https://github.com/band72/PE-Exam-Practice-Water-Resources.git
cd PE-Exam-Practice-Water-Resources
npm install
```

### 2. Run the Application

Start the local Express server:

```bash
npm start
```
or
```bash
node server.js
```

Open your browser and navigate to:
```
http://localhost:3000
```

### 3. Optional: Downloading Videos for Offline Study

To download videos locally for 100% offline study:

```bash
python3 scripts/download_videos.py
```
Or for the Civil Breadth series:
```bash
python3 scripts/download_and_transcribe_breadth.py
```

---

## 📂 Project Structure

```
├── data/
│   ├── problems.json          # 129 enriched problems with KaTeX solutions and tags
│   ├── raw_metadata.json      # Raw YouTube metadata from SolvedIn6 playlists
│   └── transcripts/           # 129 .txt and .vtt timestamped transcripts
├── public/
│   ├── index.html             # Main study portal UI
│   ├── app.js                 # Search, filtering, video player, KaTeX modal logic
│   └── style.css              # Custom styling, badges, and layout
├── scripts/
│   ├── download_and_transcribe_breadth.py  # Breadth video downloader & Whisper transcriber
│   ├── download_videos.py                  # Batch video downloader
│   ├── fetch_breadth_problems.py           # Breadth playlist metadata extractor
│   ├── fetch_metadata_transcripts.py       # Base playlist metadata extractor
│   └── process_solutions.py                # KaTeX formula and solution generator
├── package.json
└── server.js                  # Express web server with HTTP 206 streaming
```

---

## 📄 License

MIT License. Educational use for PE exam preparation.
