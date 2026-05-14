const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');

// Buffer immagine corrente in memoria
let artBuffer = null;
let artMime   = 'image/jpeg';

// Registra il protocollo personalizzato PRIMA di app.whenReady
protocol.registerSchemesAsPrivileged([
  { scheme: 'psp-art', privileges: { standard: true, secure: true, bypassCSP: true, supportFetchAPI: true } }
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 820,
    height: 560,
    autoHideMenuBar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  // Gestore protocollo psp-art://
  protocol.handle('psp-art', () => {
    if (artBuffer) {
      return new Response(artBuffer, {
        headers: { 'Content-Type': artMime }
      });
    }
    return new Response(null, { status: 404 });
  });

  createWindow();
});

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.filePaths[0] || null;
  } catch { return null; }
});

ipcMain.handle('get-songs', async (event, folderPath) => {
  try {
    const files = fs.readdirSync(folderPath);
    return files
      .filter(f => /\.(mp3|wav|ogg|flac|m4a)$/i.test(f))
      .map(f => ({ name: f, path: path.join(folderPath, f) }));
  } catch { return []; }
});

function normalizeMime(fmt) {
  if (!fmt) return 'image/jpeg';
  if (fmt.startsWith('image/')) return fmt;
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' };
  return map[fmt.toLowerCase()] || 'image/jpeg';
}

ipcMain.handle('get-track-info', async (event, songPath) => {
  try {
    const { parseFile } = await import('music-metadata');
    const meta = await parseFile(songPath, { skipCovers: false });

    // Resetta art
    artBuffer = null;
    artMime   = 'image/jpeg';

    const pic = meta.common.picture?.[0];
    if (pic) {
      artBuffer = Buffer.from(pic.data);
      artMime   = normalizeMime(pic.format);
      console.log(`[art] embedded OK — ${artMime} — ${artBuffer.length} bytes`);
    } else {
      // Fallback: immagine nella stessa cartella
      const dir   = path.dirname(songPath);
      const files = fs.readdirSync(dir);
      const img   = files.find(f => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f));
      if (img) {
        artBuffer = fs.readFileSync(path.join(dir, img));
        artMime   = normalizeMime(path.extname(img).slice(1));
        console.log(`[art] folder fallback — ${img} — ${artBuffer.length} bytes`);
      } else {
        console.log('[art] nessuna copertina trovata');
      }
    }

    return {
      title:    meta.common.title  || null,
      artist:   meta.common.artist || null,
      album:    meta.common.album  || null,
      duration: meta.format.duration || null,
      hasArt:   artBuffer !== null
    };
  } catch (err) {
    console.error('[get-track-info] errore:', err.message);
    return null;
  }
});
