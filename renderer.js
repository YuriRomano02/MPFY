const { ipcRenderer } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const setupDiv = document.getElementById('setup');
const playerDiv = document.getElementById('player');
const titleEl = document.getElementById('title');
const progressEl = document.getElementById('progress');
const bgCanvas = document.getElementById('bg-canvas');
const ctx = bgCanvas.getContext('2d');
const waveformCanvas = document.getElementById('waveform');
const waveformCtx = waveformCanvas.getContext('2d');
const albumArtEl = document.getElementById('album-art');
const songCountEl = document.getElementById('song-count');
const volDisplayEl = document.getElementById('vol-display');

let playlist = [];
let currentIndex = 0;
let audio = new Audio();
let isPlaying = false;
let audioContext;
let analyser;
let dataArray;
let sourceNode;
let waveTime = 0;

let volume = 50;
audio.volume = 0.5;
document.getElementById('vol-display').innerText = '50%';

document.getElementById('vol-up').addEventListener('click', () => {
    volume = Math.min(100, volume + 5);
    audio.volume = volume / 100;
    volDisplayEl.textContent = volume + '%';
});

document.getElementById('vol-down').addEventListener('click', () => {
    volume = Math.max(0, volume - 5);
    audio.volume = volume / 100;
    volDisplayEl.textContent = volume + '%';
});

document.getElementById('play-btn').addEventListener('click', async () => {
    if (!audioContext) {
        setupAudioAnalyzer();
    }
    if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    if (isPlaying) {
        audio.pause();
        isPlaying = false;
        document.getElementById('play-btn').innerText = '▶ PLAY';
    } else {
        audio.play();
        isPlaying = true;
        document.getElementById('play-btn').innerText = '❚❚ PAUSE';
    }
});

document.getElementById('prev-btn').addEventListener('click', () => {
    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(currentIndex);
});

document.getElementById('next-btn').addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % playlist.length;
    playSong(currentIndex);
});

document.getElementById('choose-folder').addEventListener('click', async () => {
    try {
        const folderPath = await ipcRenderer.invoke('select-folder');
        if (folderPath) {
            localStorage.setItem('music-folder', folderPath);
            await loadMusic(folderPath);
        }
    } catch (err) {
        console.error('Error selecting folder:', err);
        alert('Errore nella selezione della cartella');
    }
});

async function loadMusic(folderPath) {
    try {
        playlist = await ipcRenderer.invoke('get-songs', folderPath);
        if (playlist.length > 0) {
            setupDiv.classList.add('hidden');
            playerDiv.classList.remove('hidden');
            songCountEl.textContent = `${playlist.length} brani`;
            currentIndex = 0;
            playSong(0);
        } else {
            alert('Nessun file audio trovato nella cartella');
        }
    } catch (err) {
        console.error('Error loading music:', err);
        alert('Errore nel caricamento della musica: ' + err.message);
    }
}

function playSong(index) {
    const song = playlist[index];
    titleEl.innerText = song.name.replace(/\.[^/.]+$/, "");
    if (!audioContext) {
        setupAudioAnalyzer();
    }
    const fileUrl = pathToFileURL(song.path).href;
    audio.src = fileUrl;
    audio.play();
    isPlaying = true;
    
    loadAlbumArt(song.path);
}

function loadAlbumArt(songPath) {
    console.log('=== ALBUM ART LOAD START ===');
    console.log('Song path:', songPath);
    
    const fs = require('fs');
    const songDir = path.dirname(songPath);
    console.log('Song dir:', songDir);
    
    try {
        const allFiles = fs.readdirSync(songDir);
        console.log('All files:', allFiles);
        
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
        const imageFiles = allFiles.filter(file => {
            const ext = file.split('.').pop().toLowerCase();
            return imageExts.includes(ext);
        });

        console.log('Filtered images:', imageFiles);

        if (imageFiles.length > 0) {
            const imagePath = path.join(songDir, imageFiles[0]);
            console.log('Loading:', imagePath);
            
            try {
                const fileBuffer = fs.readFileSync(imagePath);
                console.log('File size:', fileBuffer.length);
                
                const base64 = fileBuffer.toString('base64');
                const ext = imageFiles[0].split('.').pop().toLowerCase();
                const mimeType = ext === 'jpg' ? 'jpeg' : ext;
                
                albumArtEl.innerHTML = `<img src="data:image/${mimeType};base64,${base64}" style="width:100%;height:100%;object-fit:cover;">`;
                console.log('✓ Album loaded from:', imageFiles[0]);
                console.log('=== ALBUM ART LOAD END ===');
                return;
            } catch (readErr) {
                console.error('Cannot read file:', readErr);
            }
        }

        console.log('No images found');
        albumArtEl.innerHTML = '♪';
    } catch (err) {
        console.error('Album error:', err);
        albumArtEl.innerHTML = '♪';
    }
    console.log('=== ALBUM ART LOAD END ===');
}

function setupAudioAnalyzer() {
    if (audioContext) return;

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = audioContext.createMediaElementSource(audio);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.fftSize);
    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);
    resizeWaveform();
}

function resizeWaveform() {
    const width = waveformCanvas.clientWidth;
    const height = waveformCanvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    waveformCanvas.width = width * dpr;
    waveformCanvas.height = height * dpr;
    waveformCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawWaveform() {
    const width = waveformCanvas.clientWidth;
    const height = waveformCanvas.clientHeight;
    waveformCtx.clearRect(0, 0, width, height);

    waveformCtx.fillStyle = 'rgba(255,255,255,0.04)';
    waveformCtx.fillRect(0, 0, width, height);

    waveformCtx.lineWidth = 2;
    waveformCtx.strokeStyle = 'rgba(130,217,255,0.95)';
    waveformCtx.beginPath();

    if (analyser && isPlaying) {
        analyser.getByteTimeDomainData(dataArray);
        const sliceWidth = width / dataArray.length;
        let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * height) / 2;
            if (i === 0) {
                waveformCtx.moveTo(x, y);
            } else {
                waveformCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }
    } else {
        const mid = height / 2;
        const amplitude = 16;
        waveformCtx.moveTo(0, mid);
        for (let x = 0; x <= width; x += 6) {
            const y = mid + Math.sin((x / width) * 10 + waveTime * 0.015) * amplitude;
            waveformCtx.lineTo(x, y);
        }
    }

    waveformCtx.stroke();
}

audio.ontimeupdate = () => {
    const pct = (audio.currentTime / audio.duration) * 100;
    progressEl.style.width = pct + '%';
};

audio.onended = () => {
    currentIndex = (currentIndex + 1) % playlist.length;
    playSong(currentIndex);
};

// Check for saved path on startup
const savedPath = localStorage.getItem('music-folder');
if (savedPath) {
    loadMusic(savedPath);
}

// Background Waves - PSP Style Radio Waves
let w, h;
function resize() { w = bgCanvas.width = window.innerWidth; h = bgCanvas.height = window.innerHeight; resizeWaveform(); }
window.onresize = resize;
resize();

let time = 0;
function animate(t) {
    time += 0.016;
    waveTime += 0.016;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0,0,w,h);
    
    // Emanating radio waves
    drawRadioWaves(time);
    
    // Sine waves
    drawSineWave(time * 0.0008, 0.004, 60, 'rgba(0, 255, 255, 0.12)');
    drawSineWave(time * 0.0005, 0.006, 40, 'rgba(255, 0, 255, 0.08)');
    drawSineWave(time * 0.0003, 0.008, 25, 'rgba(0, 255, 200, 0.06)');
    
    // Grid lines
    drawGrid(time);

    drawWaveform();
    
    requestAnimationFrame(animate);
}

function drawRadioWaves(time) {
    const centerX = w / 2;
    const centerY = h / 2;
    const maxRadius = Math.max(w, h);
    
    // Main circle waves
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    
    for(let i = 0; i < 6; i++) {
        const radius = ((time * 80 + i * 60) % maxRadius);
        if (radius > 20) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    // Fading circle waves
    for(let i = 0; i < 3; i++) {
        const radius = ((time * 80 + i * 60 + 200) % maxRadius);
        if (radius > 20) {
            const alpha = Math.max(0, 1 - (radius / maxRadius));
            ctx.strokeStyle = `rgba(0, 255, 255, ${0.1 * alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

function drawSineWave(timeVal, freq, amp, color) {
    ctx.beginPath();
    ctx.moveTo(0, h/2);
    for(let x=0; x<=w; x+=2) {
        let y = Math.sin(x * freq + timeVal) * amp;
        ctx.lineTo(x, h/2 + y);
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = color;
    ctx.stroke();
}

function drawGrid(time) {
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.04)';
    ctx.lineWidth = 0.5;
    const spacing = 40;
    
    // Vertical lines
    for(let x = 0; x < w; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    
    // Horizontal lines
    for(let y = 0; y < h; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
}

requestAnimationFrame(animate);
