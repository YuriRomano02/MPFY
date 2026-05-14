# MPFY — Music Player For You

Desktop music player with a **PSP / XMB-inspired** look: neon scanlines, animated background, and a compact “handheld screen” player UI. Built with [Electron](https://www.electronjs.org/).

The npm package name is `psp-vibe-player` (see `package.json`).

## Features

- **Folder-based library** — Choose a folder; all supported audio files in that folder become the playlist (not recursive: only the selected directory).
- **Remembered folder** — The last folder path is stored in the app’s `localStorage` and reloaded on the next launch.
- **Formats** — `.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a` (case-insensitive).
- **Playback** — Play / pause, previous / next track, volume up / down (5% steps).
- **Visuals** — Animated background canvas, optional real-time waveform when audio is playing (via Web Audio API).
- **Album art** — If any image file exists in the same folder as the track (`.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.webp`), the **first** matching file is shown as cover art.

## Requirements

- **Node.js** 18+ recommended (LTS is fine; Electron 42 needs a recent Node for tooling).
- **npm** (comes with Node).

No extra API keys or `.env` files are required.

## Quick start

Clone the repository, install dependencies, then start the app:

```bash
git clone https://github.com/<your-username>/MPFY.git
cd MPFY
npm install
npm start
```

That runs `electron .` and opens the desktop window.

## Project layout

| File | Role |
|------|------|
| `main.js` | Electron main process: window, folder picker, reads directory and returns song list. |
| `index.html` | UI shell and styles. |
| `renderer.js` | Renderer process: playlist, audio element, waveform, background animation, IPC to main. |
| `package.json` | App metadata, `npm start` script, Electron devDependency. |

`renderer_new.js` is present in the repo but is **not** wired into `index.html`; the active renderer is `renderer.js`.

## Using the app

1. Click **“SELEZIONA CARTELLA MUSICA”** and pick a folder that contains audio files.
2. The player view opens; the first track starts automatically.
3. Use **PREV / PLAY / PAUSE / NEXT** and **volume** controls as needed.

The UI copy is partly in **Italian**; behavior is language-agnostic aside from button labels and alerts.

## Development notes

- **Electron security** — The app uses `nodeIntegration: true` and `contextIsolation: false` in `main.js` for simplicity. For production hardening you would typically enable context isolation and avoid exposing Node to the renderer.
- **Building installers** — This repo only defines `npm start`. To ship `.dmg`, `.exe`, etc., add a packager such as [electron-builder](https://www.electron.build/) and configure it in `package.json`.

## License

Add a `LICENSE` file in the repository if you want to specify terms; none is included by default in this project.

---

**TL;DR:** `npm install` → `npm start` → pick a music folder → play.
