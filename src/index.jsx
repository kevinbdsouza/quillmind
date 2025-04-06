// quillmind/src/index.js
// src/index.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // Import BrowserRouter
import App from './App.jsx'; // Use .jsx

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    {/* Wrap App with BrowserRouter */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Example: Accessing something exposed via preload.js
// This assumes 'getAppName' was exposed in preload.js
if (window.electronAPI && typeof window.electronAPI.getAppName === 'function') {
  console.log('App Name from Main Process via Preload:', window.electronAPI.getAppName());
} else {
  console.warn('electronAPI or getAppName not found. Preload script might not be configured correctly.');
}