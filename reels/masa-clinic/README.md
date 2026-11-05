# Masa Clinic – Soprano Titanium Reel

- `Masa_Clinic_Reel.mp4` — final reel (1080×1920, 30fps, 35s, H.264 + AAC).
- `source/reel.html` — animated scene timeline (HTML/CSS + Web Animations, seekable via `render(t)`).
- `source/render.js` — renders frames with Playwright and pipes them to ffmpeg (serve `source/` over http on port 8765 first, CSS masks need http).
- `source/music.py` — generates the original soundtrack (numpy).

```bash
cd source && python3 -m http.server 8765 --bind 127.0.0.1 &
mkdir -p out && node render.js video && python3 music.py out/music.wav
ffmpeg -i out/video_noaudio.mp4 -i out/music.wav -map 0:v -map 1:a -c:v copy -af loudnorm=I=-14:TP=-1.5 -c:a aac -b:a 256k -shortest -movflags +faststart Masa_Clinic_Reel.mp4
```
