// src/App.js
import React from 'react';
import Box from '@mui/material/Box';
import { Routes, Route, Link, Navigate, Outlet } from 'react-router-dom'; // Import Navigate and Outlet
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

// --- Protected Route Component ---
function ProtectedRoute() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    // If not authenticated, redirect to the login page
    return <Navigate to="/login" replace />;
  }

  // If authenticated, render the child routes (in this case, the MainAppLayout)
  // Outlet is used by parent routes to render their child route elements.
  return <Outlet />;
}

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
  // Get auth state to potentially adjust logic if needed, though ProtectedRoute handles the main check
  const isAuthenticated = useStore((state) => state.isAuthenticated);

  return (
    <>
      <CssBaseline /> {/* Apply baseline styles */}
      {/* Define application routes */}
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />} />
        <Route path="/register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/" replace />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          {/* All routes nested here require authentication */}
          <Route path="/" element={<MainAppLayout />} />
          {/* Add other protected routes here later (e.g., /settings) */}
        </Route>

        {/* Optional: Catch-all route for 404 Not Found */}
        {/* <Route path="*" element={<div>Page Not Found</div>} /> */}
      </Routes>
    </>
  );
}

export default App;