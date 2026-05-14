# 🎵 PSP Vibe Player

A nostalgic **Electron-based music player** styled after the iconic PSP XMB (Cross Media Bar) interface. Experience your favorite tracks with retro CRT aesthetics and cyan-green neon vibes.

## ✨ Features

- 🎮 **PSP XMB-inspired UI** - Authentic retro interface with neon cyan/green color scheme
- 🎵 **Multi-format Support** - Play MP3, WAV, OGG, FLAC, and M4A files
- 📁 **Folder Browser** - Select any folder to load your music collection
- 🎚️ **Volume Control** - Adjustable volume with visual feedback
- 🎵 **Waveform Visualization** - Real-time audio visualization
- 📊 **Track Information** - Display current track details and playlist position
- 💻 **Cross-platform** - Built with Electron (Windows, macOS, Linux)

## 🚀 Quick Start

### Prerequisites
- Node.js (v14+)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/psp-vibe-player.git
cd psp-vibe-player

# Install dependencies
npm install
```

### Running the App

```bash
npm start
```

This will launch the application. Click **"SELEZIONA CARTELLA MUSICA"** (Select Music Folder) to choose a directory containing your music files.

## 🎮 How to Use

1. **Select Music Folder** - Click the button on startup to choose a folder containing your music
2. **Play/Pause** - Use the **PLAY** button to control playback
3. **Navigate** - Use **PREV** and **NEXT** buttons to browse your playlist
4. **Adjust Volume** - Use the **−** and **+** buttons to control volume
5. **Watch the Waveform** - Visual representation updates with playback

## 📁 Project Structure

```
psp-vibe-player/
├── main.js              # Electron main process (folder selection, file I/O)
├── renderer.js          # Frontend logic and player controls
├── index.html           # UI layout and styling
├── package.json         # Project metadata and dependencies
└── README.md            # This file
```

## 🔧 Technology Stack

- **Electron** - Desktop application framework
- **HTML5 Audio API** - Audio playback
- **Canvas API** - Waveform visualization
- **CSS3** - Retro styling with scanline effects

## 🎨 Design Highlights

- **Scanline Effect** - CRT monitor simulation
- **Neon Glow** - Cyan and magenta accent colors
- **Thick Bezel** - PSP-style screen frame with shadow effects
- **OCR-A Font** - Authentic retro aesthetic
- **Responsive Design** - Works on different screen sizes

## 🐛 Known Limitations

- Waveform visualization is simulated (not derived from actual audio analysis)
- Album art is not displayed (placeholder icon used)
- No shuffle or repeat functionality

## 💾 Configuration

Edit `main.js` to customize window size:
```javascript
const win = new BrowserWindow({
  width: 1200,
  height: 700,
  // ... other options
});
```

## 📝 License

This project is open source and available under the MIT License.

## 🙏 Credits

Inspired by the Sony PSP and its iconic XMB interface. Built with ❤️ for retro enthusiasts.

---

**Enjoy your music with a touch of nostalgia!** 🎮🎵
