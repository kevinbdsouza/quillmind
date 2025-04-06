// quillmind/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process (React)
// to communicate with the main process securely.
contextBridge.exposeInMainWorld('electronAPI', {
  // Example: Function to send data to main process
  // sendData: (channel, data) => ipcRenderer.invoke(channel, data),

  // Example: Function to receive data from main process
  // handleData: (channel, listener) => {
  //   ipcRenderer.on(channel, (event, ...args) => listener(...args));
  //   // Return a function to remove the listener
  //   return () => ipcRenderer.removeAllListeners(channel);
  // }

  // We will add more specific functions here later as needed
  // e.g., file system access, AI calls proxied through main process.
  getAppName: () => 'QuillMind', // Simple example
});

console.log('Preload script loaded.');