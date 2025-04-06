// src/App.js
import React from 'react';
import Box from '@mui/material/Box';
import { Routes, Route, Link } from 'react-router-dom'; // Import routing components
import CssBaseline from '@mui/material/CssBaseline'; // Normalizes styles

// Import the components we created
import ProjectExplorer from './components/ProjectExplorer.jsx';
import EditorArea from './components/EditorArea.jsx';
import ChatPanel from './components/ChatPanel.jsx';

// --- Import the actual Page components ---
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';

// Import the store hook
import useStore from './store';

// Main application layout component
function MainAppLayout() {
  const sidebarWidth = useStore((state) => state.sidebarWidth);
  const chatPanelWidth = useStore((state) => state.chatPanelWidth);

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* Project Explorer (Sidebar) */}
      <Box component="nav" sx={{ width: sidebarWidth, /* ... other styles */ }}>
        <ProjectExplorer />
      </Box>
      {/* Main Content Area (Editor) */}
      <Box component="main" sx={{ flexGrow: 1, /* ... other styles */ }}>
        <EditorArea />
      </Box>
      {/* AI Chat Panel */}
      <Box component="aside" sx={{ width: chatPanelWidth, /* ... other styles */ }}>
        <ChatPanel />
      </Box>
    </Box>
  );
}


function App() {
  // We'll add auth state check here later

  return (
    <>
      <CssBaseline /> {/* Apply baseline styles */}
      {/* Define application routes */}
      <Routes>
        {/* Route for the main application layout */}
        <Route path="/" element={<MainAppLayout />} />

        {/* Route for the login page */}
        <Route path="/login" element={<LoginPage />} />

        {/* Route for the registration page */}
        <Route path="/register" element={<RegisterPage />} />

        {/* Add a catch-all or Not Found route later if needed */}
        {/* <Route path="*" element={<div>Page Not Found</div>} /> */}
      </Routes>
    </>
  );
}

export default App;