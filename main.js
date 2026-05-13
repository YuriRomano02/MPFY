const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 700,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

ipcMain.handle('select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    return result.filePaths[0] || null;
  } catch (err) {
    console.error('Error in select-folder:', err);
    return null;
  }
});

ipcMain.handle('get-songs', async (event, folderPath) => {
  try {
    const files = fs.readdirSync(folderPath);
    const songs = files
      .filter(file => /\.(mp3|wav|ogg|flac|m4a)$/i.test(file))
      .map(file => ({
        name: file,
        path: path.join(folderPath, file)
      }));
    return songs;
  } catch (err) {
    console.error('Error reading folder:', err);
    return [];
  }
});
