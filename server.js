const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const VIDEOS_DIR = path.join(DATA_DIR, 'videos');
const PROBLEMS_FILE = path.join(DATA_DIR, 'problems.json');

// Serve static frontend files
app.use(express.static(PUBLIC_DIR));
app.use('/data', express.static(DATA_DIR));

// Video streaming endpoint with HTTP 206 Range support
app.get('/videos/:filename', (req, res) => {
  const filename = req.params.filename;
  // Sanitize filename to avoid path traversal
  const safeFilename = path.basename(filename);
  const videoPath = path.join(VIDEOS_DIR, safeFilename);

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Video file not found' });
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
      return;
    }

    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

// API: Get all problems
app.get('/api/problems', (req, res) => {
  if (fs.existsSync(PROBLEMS_FILE)) {
    const data = JSON.parse(fs.readFileSync(PROBLEMS_FILE, 'utf-8'));
    res.json(data);
  } else {
    const rawFile = path.join(DATA_DIR, 'raw_metadata.json');
    if (fs.existsSync(rawFile)) {
      const data = JSON.parse(fs.readFileSync(rawFile, 'utf-8'));
      res.json(data);
    } else {
      res.json([]);
    }
  }
});

// API: Get problem by ID or problem number
app.get('/api/problems/:idOrNum', (req, res) => {
  const param = req.params.idOrNum;
  if (!fs.existsSync(PROBLEMS_FILE)) {
    return res.status(404).json({ error: 'Database not initialized yet' });
  }
  const data = JSON.parse(fs.readFileSync(PROBLEMS_FILE, 'utf-8'));
  const found = data.find(p => p.id === param || String(p.problem_number) === param);
  if (found) {
    res.json(found);
  } else {
    res.status(404).json({ error: 'Problem not found' });
  }
});

// API: Video status (which are downloaded locally)
app.get('/api/videos/status', (req, res) => {
  if (!fs.existsSync(VIDEOS_DIR)) {
    return res.json({ local_videos: [] });
  }
  const files = fs.readdirSync(VIDEOS_DIR).filter(f => f.endsWith('.mp4'));
  res.json({
    count: files.length,
    local_videos: files
  });
});

// API: Stats
app.get('/api/stats', (req, res) => {
  if (!fs.existsSync(PROBLEMS_FILE)) {
    return res.json({ total: 0 });
  }
  const data = JSON.parse(fs.readFileSync(PROBLEMS_FILE, 'utf-8'));
  const categories = {};
  let totalDuration = 0;
  data.forEach(p => {
    const cat = p.category || 'General';
    categories[cat] = (categories[cat] || 0) + 1;
    totalDuration += (p.duration || 0);
  });
  
  const localCount = fs.existsSync(VIDEOS_DIR) 
    ? fs.readdirSync(VIDEOS_DIR).filter(f => f.endsWith('.mp4')).length 
    : 0;

  res.json({
    total_problems: data.length,
    total_duration_seconds: totalDuration,
    total_duration_hours: +(totalDuration / 3600).toFixed(1),
    categories,
    local_videos_downloaded: localCount
  });
});

app.listen(PORT, () => {
  console.log(`SolvedIn6 PE Exam Web Portal running at http://localhost:${PORT}`);
});
