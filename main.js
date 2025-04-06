// quillmind/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url'); // Import url module

// Detect development mode (commonly done by checking an env variable)
// You can set this variable via scripts in package.json later
const isDev = process.env.NODE_ENV !== 'production'; // Simple check, refine if needed

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  if (isDev) {
    // Load from Vite dev server
    console.log('Loading from Vite dev server: http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000'); // URL from vite.config.js
    // Open the DevTools automatically in dev mode
    mainWindow.webContents.openDevTools();
  } else {
    // Load the index.html file from the build output (e.g., 'dist' folder)
    // This path assumes 'dist' folder is in the root after running 'npm run build'
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
     // Alternatively using url.format for file paths:
     /*
     mainWindow.loadURL(url.format({
       pathname: path.join(__dirname, 'dist', 'index.html'),
       protocol: 'file:',
       slashes: true
     }));
     */
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers Remain Here ---