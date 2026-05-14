const { ipcRenderer } = require('electron');
const { pathToFileURL } = require('url');

// ── DOM ───────────────────────────────────────────────────────────────────────
const setupDiv     = document.getElementById('setup');
const playerDiv    = document.getElementById('player');
const titleEl      = document.getElementById('title');
const artistEl     = document.getElementById('artist');
const albumNameEl  = document.getElementById('album-name');
const albumArtEl   = document.getElementById('album-art');
const progressEl   = document.getElementById('progress');
const songCountEl  = document.getElementById('song-count');
const formatBadge  = document.getElementById('format-badge');
const timeCurEl    = document.getElementById('time-current');
const timeTotEl    = document.getElementById('time-total');
const bgCanvas     = document.getElementById('bg-canvas');
const waveCanvas   = document.getElementById('waveform');
const setupCanvas  = document.getElementById('setup-canvas');
const bgCtx        = bgCanvas.getContext('2d');
const wCtx         = waveCanvas.getContext('2d');
const sCtx         = setupCanvas.getContext('2d');

// ── State ─────────────────────────────────────────────────────────────────────
let playlist = [], currentIndex = 0, currentFolder = null;
let audio = new Audio();
let isPlaying = false;
let volume = 80;
audio.volume = 0.8;
let audioCtx, analyser, sourceNode, timeData;

// ── Recent folders (max 6) ────────────────────────────────────────────────────
function getRecents() {
  try { return JSON.parse(localStorage.getItem('recent-folders') || '[]'); }
  catch { return []; }
}
function addRecent(folder) {
  let r = getRecents().filter(f => f !== folder);
  r.unshift(folder);
  if (r.length > 6) r = r.slice(0, 6);
  localStorage.setItem('recent-folders', JSON.stringify(r));
}
function removeRecent(folder) {
  const r = getRecents().filter(f => f !== folder);
  localStorage.setItem('recent-folders', JSON.stringify(r));
}

// ── Render recent folders list ────────────────────────────────────────────────
function renderSetupRecents() {
  const container = document.getElementById('setup-recents');
  const recents = getRecents();
  if (!recents.length) {
    container.innerHTML = '<div style="font-size:10px;color:rgba(255,255,255,0.2);padding:6px 16px;font-style:italic;">Nessuna cartella recente</div>';
    return;
  }
  container.innerHTML = recents.map(f => `
    <div class="setup-recent-item" data-path="${f.replace(/"/g, '&quot;')}">
      <span style="font-size:12px;opacity:.5">📁</span>
      <span class="item-path">${f}</span>
    </div>
  `).join('');
  container.querySelectorAll('.setup-recent-item').forEach(el => {
    el.addEventListener('click', () => loadMusic(el.dataset.path));
  });
}

function renderMenuRecents() {
  const container = document.getElementById('menu-recents');
  const recents = getRecents();
  if (!recents.length) {
    container.innerHTML = '<div class="menu-empty">Nessuna cartella recente</div>';
    return;
  }
  container.innerHTML = recents.map(f => `
    <div class="menu-recent ${f === currentFolder ? 'current' : ''}" data-path="${f.replace(/"/g, '&quot;')}">
      <span style="font-size:11px;opacity:.5;flex-shrink:0">📁</span>
      <span class="mr-path">${f}</span>
      <span class="mr-del" data-del="${f.replace(/"/g, '&quot;')}" title="Rimuovi">✕</span>
    </div>
  `).join('');
  container.querySelectorAll('.menu-recent').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.classList.contains('mr-del')) return;
      closeMenu();
      loadMusic(el.dataset.path);
    });
  });
  container.querySelectorAll('.mr-del').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      removeRecent(el.dataset.del);
      renderMenuRecents();
    });
  });
}

// ── Menu overlay ──────────────────────────────────────────────────────────────
const menuOverlay = document.getElementById('menu-overlay');

function openMenu() {
  renderMenuRecents();
  menuOverlay.classList.add('open');
}
function closeMenu() {
  menuOverlay.classList.remove('open');
}

document.getElementById('menu-close').addEventListener('click', closeMenu);
document.getElementById('menu-backdrop').addEventListener('click', closeMenu);

document.getElementById('menu-browse').addEventListener('click', async () => {
  closeMenu();
  const f = await ipcRenderer.invoke('select-folder');
  if (f) loadMusic(f);
});

// ── Setup screen buttons ──────────────────────────────────────────────────────
document.getElementById('setup-browse').addEventListener('click', async () => {
  const f = await ipcRenderer.invoke('select-folder');
  if (f) loadMusic(f);
});

// ── Player buttons ────────────────────────────────────────────────────────────
document.getElementById('btn-circ') .addEventListener('click', togglePlay);
document.getElementById('btn-sq')   .addEventListener('click', prevSong);
document.getElementById('btn-tri')  .addEventListener('click', nextSong);
document.getElementById('btn-cross').addEventListener('click', openMenu);

// ── Keyboard ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.code === 'Escape') { closeMenu(); return; }
  if (!playlist.length) return;
  if (e.code === 'Space')      { e.preventDefault(); togglePlay(); }
  if (e.code === 'ArrowRight') nextSong();
  if (e.code === 'ArrowLeft')  prevSong();
  if (e.code === 'ArrowUp')    { volume = Math.min(100, volume + 5); audio.volume = volume / 100; }
  if (e.code === 'ArrowDown')  { volume = Math.max(0, volume - 5);   audio.volume = volume / 100; }
  if (e.key === 'm' || e.key === 'M') openMenu();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(sec) {
  if (!sec || isNaN(sec)) return '--:--';
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

function initAudio() {
  if (audioCtx) return;
  audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
  sourceNode = audioCtx.createMediaElementSource(audio);
  analyser   = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.82;
  timeData = new Uint8Array(analyser.fftSize);
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);
}

// ── Playback ──────────────────────────────────────────────────────────────────
async function togglePlay() {
  initAudio();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  isPlaying ? audio.pause() : audio.play();
  isPlaying = !isPlaying;
}

function prevSong() { currentIndex = (currentIndex - 1 + playlist.length) % playlist.length; playSong(currentIndex); }
function nextSong() { currentIndex = (currentIndex + 1) % playlist.length; playSong(currentIndex); }

audio.onended = nextSong;
audio.ontimeupdate = () => {
  if (!audio.duration) return;
  progressEl.style.width = (audio.currentTime / audio.duration * 100) + '%';
  timeCurEl.textContent = fmt(audio.currentTime);
};

// ── Load track ────────────────────────────────────────────────────────────────
async function playSong(index) {
  const song = playlist[index];
  songCountEl.textContent  = `${index + 1}/${playlist.length}`;
  titleEl.textContent      = song.name.replace(/\.[^/.]+$/, '');
  artistEl.textContent     = '';
  albumNameEl.textContent  = currentFolder ? currentFolder.split(/[\\/]/).pop() : '';
  albumArtEl.innerHTML     = '♪';
  timeTotEl.textContent    = '--:--';
  progressEl.style.width   = '0%';
  formatBadge.textContent  = song.name.split('.').pop().toUpperCase();

  initAudio();
  audio.src = pathToFileURL(song.path).href;
  audio.play();
  isPlaying = true;

  ipcRenderer.invoke('get-track-info', song.path).then(info => {
    if (!info) return;
    if (info.title)    titleEl.textContent     = info.title;
    if (info.artist)   artistEl.textContent    = info.artist;
    if (info.album)    albumNameEl.textContent = info.album;
    if (info.duration) timeTotEl.textContent   = fmt(info.duration);

    if (info.hasArt) {
      const img = new Image();
      img.onload = () => {
        albumArtEl.innerHTML = '';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
        albumArtEl.appendChild(img);
      };
      img.onerror = () => console.warn('[art] errore caricamento immagine');
      img.src = `psp-art://cover?t=${Date.now()}`;
    }
  });
}

// ── Load folder ───────────────────────────────────────────────────────────────
async function loadMusic(folderPath) {
  playlist = await ipcRenderer.invoke('get-songs', folderPath);
  if (!playlist.length) { alert('Nessun file audio trovato nella cartella.'); return; }
  currentFolder = folderPath;
  addRecent(folderPath);
  setupDiv.classList.add('hidden');
  playerDiv.classList.remove('hidden');
  resizeAll();
  currentIndex = 0;
  playSong(0);
}

// ── Startup ───────────────────────────────────────────────────────────────────
renderSetupRecents();
const lastFolder = getRecents()[0];
if (lastFolder) {
  // Auto-load last used folder
  loadMusic(lastFolder);
}

// ── Canvas resize ─────────────────────────────────────────────────────────────
const dpr = window.devicePixelRatio || 1;
let bgW = 0, bgH = 0, wW = 0, wH = 0, sW = 0, sH = 0;

function resizeAll() {
  const fit = (canvas, ctx) => {
    const r = canvas.parentElement.getBoundingClientRect();
    canvas.width  = r.width  * dpr;
    canvas.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: r.width, h: r.height };
  };
  if (!bgCanvas.parentElement) return;
  ({ w: bgW, h: bgH } = fit(bgCanvas, bgCtx));
  ({ w: wW,  h: wH  } = (() => {
    const r = waveCanvas.getBoundingClientRect();
    waveCanvas.width  = r.width  * dpr;
    waveCanvas.height = r.height * dpr;
    wCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: r.width, h: r.height };
  })());
  const sr = setupCanvas.getBoundingClientRect();
  setupCanvas.width  = sr.width  * dpr;
  setupCanvas.height = sr.height * dpr;
  sCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sW = sr.width; sH = sr.height;
}
window.addEventListener('resize', resizeAll);
setTimeout(resizeAll, 80);

// ── Animation ─────────────────────────────────────────────────────────────────
let t = 0;

function drawWaves(ctx, w, h, time, waves) {
  waves.forEach(wave => {
    ctx.beginPath();
    const baseY = h * wave.y;
    for (let x = 0; x <= w; x += 2) {
      const y = baseY + Math.sin(x * wave.freq + time * wave.sp) * wave.amp;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = wave.color;
    ctx.fill();
  });
}

const BG_WAVES = [
  { y: 0.72, amp: 14, freq: 0.014, sp: 0.30, color: 'rgba(40,100,220,0.07)' },
  { y: 0.78, amp: 10, freq: 0.020, sp: 0.50, color: 'rgba(40,100,220,0.05)' },
  { y: 0.65, amp: 18, freq: 0.010, sp: 0.20, color: 'rgba(40,100,220,0.05)' },
];

function drawBg() {
  bgCtx.fillStyle = '#080c14';
  bgCtx.fillRect(0, 0, bgW, bgH);
  drawWaves(bgCtx, bgW, bgH, t, BG_WAVES);
}

function drawSetupBg() {
  sCtx.fillStyle = '#080c14';
  sCtx.fillRect(0, 0, sW, sH);
  drawWaves(sCtx, sW, sH, t, BG_WAVES);
}

function drawWaveform() {
  wCtx.clearRect(0, 0, wW, wH);
  if (!wW || !wH) return;
  const midY = wH / 2;

  if (analyser && isPlaying) {
    analyser.getByteTimeDomainData(timeData);
    const slice = wW / timeData.length;

    // Upper filled shape
    wCtx.beginPath();
    wCtx.moveTo(0, midY);
    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] / 128) - 1;
      wCtx.lineTo(i * slice, midY - v * wH * 0.44);
    }
    wCtx.lineTo(wW, midY); wCtx.closePath();
    const gU = wCtx.createLinearGradient(0, 0, 0, midY);
    gU.addColorStop(0, 'rgba(255,255,255,0.5)');
    gU.addColorStop(1, 'rgba(255,255,255,0.12)');
    wCtx.fillStyle = gU; wCtx.fill();

    // Lower mirror
    wCtx.beginPath();
    wCtx.moveTo(0, midY);
    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] / 128) - 1;
      wCtx.lineTo(i * slice, midY + v * wH * 0.44);
    }
    wCtx.lineTo(wW, midY); wCtx.closePath();
    const gD = wCtx.createLinearGradient(0, midY, 0, wH);
    gD.addColorStop(0, 'rgba(255,255,255,0.12)');
    gD.addColorStop(1, 'rgba(255,255,255,0.03)');
    wCtx.fillStyle = gD; wCtx.fill();

    // Bright top line
    wCtx.beginPath();
    wCtx.strokeStyle = 'rgba(255,255,255,0.88)';
    wCtx.lineWidth = 1.5;
    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] / 128) - 1;
      const y = midY - v * wH * 0.44;
      i === 0 ? wCtx.moveTo(0, y) : wCtx.lineTo(i * slice, y);
    }
    wCtx.stroke();

  } else {
    // Idle gentle wave
    wCtx.beginPath();
    for (let x = 0; x <= wW; x += 2) {
      const y = midY + Math.sin((x / wW) * Math.PI * 6 + t * 1.2) * (wH * 0.05);
      x === 0 ? wCtx.moveTo(x, y) : wCtx.lineTo(x, y);
    }
    wCtx.lineTo(wW, midY); wCtx.closePath();
    const gi = wCtx.createLinearGradient(0, midY - wH * 0.07, 0, midY);
    gi.addColorStop(0, 'rgba(255,255,255,0.18)');
    gi.addColorStop(1, 'rgba(255,255,255,0.02)');
    wCtx.fillStyle = gi; wCtx.fill();

    wCtx.beginPath();
    wCtx.strokeStyle = 'rgba(255,255,255,0.3)';
    wCtx.lineWidth = 1.2;
    for (let x = 0; x <= wW; x += 2) {
      const y = midY + Math.sin((x / wW) * Math.PI * 6 + t * 1.2) * (wH * 0.05);
      x === 0 ? wCtx.moveTo(x, y) : wCtx.lineTo(x, y);
    }
    wCtx.stroke();
  }
}

function loop() {
  t += 0.016;
  if (!setupDiv.classList.contains('hidden')) drawSetupBg();
  if (!playerDiv.classList.contains('hidden')) { drawBg(); drawWaveform(); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
