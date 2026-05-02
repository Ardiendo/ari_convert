import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

const router: IRouter = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
const OUTPUT_DIR = path.resolve(process.cwd(), "outputs");

for (const dir of [UPLOADS_DIR, OUTPUT_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (IMAGE_EXTS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

let jobStatus: {
  status: "idle" | "running" | "done" | "error";
  progress: string;
  startedAt: string | null;
  finishedAt: string | null;
  outputFile: string | null;
  error: string | null;
} = {
  status: "idle",
  progress: "No job started",
  startedAt: null,
  finishedAt: null,
  outputFile: null,
  error: null,
};

router.get("/images", (req, res) => {
  const files = fs.existsSync(UPLOADS_DIR)
    ? fs.readdirSync(UPLOADS_DIR).filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
    : [];

  const images = files.map((f) => {
    const stat = fs.statSync(path.join(UPLOADS_DIR, f));
    return {
      filename: f,
      size: stat.size,
      url: `/api/video/images/${encodeURIComponent(f)}`,
      modifiedAt: stat.mtime.toISOString(),
    };
  });

  res.json({ images, count: images.length });
});

router.get("/images/:filename", (req, res) => {
  const filename = req.params["filename"];
  if (!filename) {
    res.status(400).json({ error: "Missing filename" });
    return;
  }
  const safe = path.basename(filename);
  const filePath = path.join(UPLOADS_DIR, safe);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  res.sendFile(filePath);
});

router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  res.json({
    filename: req.file.filename,
    size: req.file.size,
    url: `/api/video/images/${encodeURIComponent(req.file.filename)}`,
  });
});

router.delete("/images/:filename", (req, res) => {
  const filename = req.params["filename"];
  if (!filename) {
    res.status(400).json({ error: "Missing filename" });
    return;
  }
  const safe = path.basename(filename);
  const filePath = path.join(UPLOADS_DIR, safe);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  fs.unlinkSync(filePath);
  res.json({ success: true, message: `Deleted ${safe}` });
});

router.post("/generate", (req, res) => {
  if (jobStatus.status === "running") {
    res.status(400).json({ error: "A job is already running" });
    return;
  }

  const {
    fps = 30,
    duration = 2,
    transition = "none",
    transitionTime = 0.5,
    resize = null,
    sort = "name",
    outputFilename = "video_final.mp4",
  } = req.body;

  const outputPath = path.join(OUTPUT_DIR, path.basename(outputFilename));

  jobStatus = {
    status: "running",
    progress: "Starting video generation...",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    outputFile: null,
    error: null,
  };

  const script = `
import sys, os, re
sys.path.insert(0, '${process.cwd()}')
from moviepy import ImageClip, concatenate_videoclips
from moviepy import vfx
from PIL import Image

uploads_dir = '${UPLOADS_DIR}'
output_path = '${outputPath}'
fps = ${fps}
duration = ${duration}
transition = '${transition}'
transition_time = ${transitionTime}
resize_to = ${resize ? `'${resize}'` : "None"}
sort_method = '${sort}'

IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff')

def natural_sort_key(text):
    return [int(c) if c.isdigit() else c.lower() for c in re.split(r'(\\d+)', text)]

files = [f for f in os.listdir(uploads_dir) if f.lower().endswith(IMAGE_EXTENSIONS)]
if sort_method == 'name':
    files = sorted(files, key=lambda x: natural_sort_key(x))
elif sort_method == 'date':
    files = sorted(files, key=lambda x: os.path.getmtime(os.path.join(uploads_dir, x)))
elif sort_method == 'date_desc':
    files = sorted(files, key=lambda x: os.path.getmtime(os.path.join(uploads_dir, x)), reverse=True)

frames = [os.path.join(uploads_dir, f) for f in files]

if not frames:
    print('ERROR: No images found', flush=True)
    sys.exit(1)

print(f'Found {len(frames)} images', flush=True)

def get_size(frames, resize_to):
    if resize_to:
        w, h = map(int, resize_to.split('x'))
        return (w, h)
    img = Image.open(frames[0])
    return img.size

common_size = get_size(frames, resize_to)
temp_files = []
clips = []

for i, fpath in enumerate(frames):
    img = Image.open(fpath)
    if img.size != common_size:
        tmp = fpath + '_resized.jpg'
        img.convert('RGB').resize(common_size, Image.LANCZOS).save(tmp, quality=95)
        temp_files.append(tmp)
        fpath = tmp
    clip = ImageClip(fpath).with_duration(duration)
    if transition == 'fade':
        clip = clip.with_effects([vfx.FadeIn(transition_time), vfx.FadeOut(transition_time)])
    elif transition == 'crossfade' and i > 0:
        clip = clip.with_effects([vfx.CrossFadeIn(transition_time)])
    clips.append(clip)
    print(f'Processed frame {i+1}/{len(frames)}', flush=True)

if transition == 'crossfade':
    video = concatenate_videoclips(clips, padding=-transition_time, method='compose')
else:
    video = concatenate_videoclips(clips, method='compose')

video.write_videofile(output_path, fps=fps, codec='libx264', audio_codec='aac', logger=None)

for t in temp_files:
    if os.path.exists(t):
        os.remove(t)

print(f'DONE:{output_path}', flush=True)
`;

  const proc = spawn("python3", ["-c", script]);
  let stdout = "";

  proc.stdout.on("data", (data: Buffer) => {
    const line = data.toString().trim();
    stdout += line + "\n";
    if (line.startsWith("Processed frame") || line.startsWith("Found")) {
      jobStatus.progress = line;
    }
  });

  proc.stderr.on("data", (data: Buffer) => {
    jobStatus.progress = data.toString().trim();
  });

  proc.on("close", (code: number) => {
    if (code === 0 && stdout.includes("DONE:")) {
      jobStatus.status = "done";
      jobStatus.progress = "Video ready";
      jobStatus.finishedAt = new Date().toISOString();
      jobStatus.outputFile = path.basename(outputPath);
    } else {
      jobStatus.status = "error";
      jobStatus.error = stdout || "Unknown error";
      jobStatus.finishedAt = new Date().toISOString();
    }
  });

  res.json({ ...jobStatus });
});

router.get("/status", (_req, res) => {
  res.json({ ...jobStatus });
});

router.get("/download", (req, res) => {
  const filename = jobStatus.outputFile;
  if (!filename) {
    res.status(404).json({ error: "No video available" });
    return;
  }
  const filePath = path.join(OUTPUT_DIR, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Video file not found" });
    return;
  }
  const stat = fs.statSync(filePath);
  res.json({
    filename,
    size: stat.size,
    url: `/api/video/file/${encodeURIComponent(filename)}`,
  });
});

router.get("/file/:filename", (req, res) => {
  const filename = req.params["filename"];
  if (!filename) {
    res.status(400).json({ error: "Missing filename" });
    return;
  }
  const safe = path.basename(filename);
  const filePath = path.join(OUTPUT_DIR, safe);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Video file not found" });
    return;
  }
  res.download(filePath);
});

export default router;
