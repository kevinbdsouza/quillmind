// src/App.jsx
import React, { useCallback, useRef } from 'react';
import { Box, createTheme, ThemeProvider } from '@mui/material';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ProjectExplorer from './components/ProjectExplorer.jsx';
import EditorArea from './components/EditorArea.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import PrivateRoute from './components/PrivateRoute.jsx';
import SelectProjectPage from './pages/SelectProjectPage.jsx';
import CreateProjectPage from './pages/CreateProjectPage.jsx';
import useStore from './store';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#E88352',
    },
    secondary: {
      main: '#90caf9',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
  },
});

// Resize handle component
function ResizeHandle({ onResize, orientation = 'vertical' }) {
  const isDragging = useRef(false);
  const lastPos = useRef(0);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    lastPos.current = orientation === 'vertical' ? e.clientX : e.clientY;
    
    document.body.style.cursor = orientation === 'vertical' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    document.body.style.pointerEvents = 'none';

    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      
      const currentPos = orientation === 'vertical' ? e.clientX : e.clientY;
      const delta = currentPos - lastPos.current;
      
      if (Math.abs(delta) > 0) { // Only update if there's actual movement
        onResize(delta);
        lastPos.current = currentPos;
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResize, orientation]);

  return (
    <Box
      onMouseDown={handleMouseDown}
      sx={{
        width: orientation === 'vertical' ? '6px' : '100%',
        height: orientation === 'vertical' ? '100%' : '6px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        cursor: orientation === 'vertical' ? 'col-resize' : 'row-resize',
        position: 'relative',
        flexShrink: 0,
        transition: 'background-color 0.2s ease',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
        },
        '&:active': {
          backgroundColor: 'rgba(255, 255, 255, 0.25)',
        },
        // Larger hit area for easier grabbing
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: orientation === 'vertical' ? '-4px' : 0,
          right: orientation === 'vertical' ? '-4px' : 0,
          bottom: 0,
          backgroundColor: 'transparent',
          cursor: orientation === 'vertical' ? 'col-resize' : 'row-resize',
        }
      }}
    />
  );
}

// Layout for auth pages (Login, Register)
function AuthLayout({ children }) {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  if (isAuthenticated) {
    return <Navigate to="/" />;
  }
  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #2E3B55 0%, #1A202C 100%)',
      }}
    >
      {children}
    </Box>
  );
}

// Header component with logout logic
function AppHeader() {
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);
  const currentProject = useStore((state) => state.currentProject);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleChangeProject = () => {
    navigate('/select-project');
  };

  const showChangeProjectButton = location.pathname !== '/select-project';

  return (
    <Box 
      component="header"
      sx={{ 
        p: 2,
        backgroundColor: '#FDF6E3',
        color: '#1A202C',
        borderBottom: '1px solid #EAE0CC',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 4px -1px rgba(0,0,0,0.1)',
      }}
    >
      <Box display="flex" alignItems="center">
        <img 
          src="/logo.png" 
          alt="QuillMind Logo" 
          style={{ 
            height: '32px', 
            width: 'auto', 
            marginRight: '12px' 
          }} 
        />
        <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
          QuillMind
        </Typography>
        {currentProject && (
          <>
            <Box sx={{ width: '1px', height: '24px', bgcolor: 'divider', mx: 2 }} />
            <Typography variant="body1" component="span" sx={{ color: 'text.secondary' }}>
              {currentProject.name}
            </Typography>
          </>
        )}
      </Box>
      <Box>
        {showChangeProjectButton &&
          <Button variant="outlined" size="small" onClick={handleChangeProject} sx={{ mr: 1, color: '#1A202C', borderColor: '#1A202C' }}>
            Change Project
          </Button>
        }
        <Button variant="contained" color="primary" size="small" onClick={handleLogout}>
          Sign Out
        </Button>
      </Box>
    </Box>
  );
}

// Layout for pages that need authentication but don't need the 3-panel layout
function AuthenticatedPageLayout({ children }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppHeader />
      <Box component="main" sx={{ flexGrow: 1, p: 3, overflowY: 'auto' }}>
        {children}
      </Box>
    </Box>
  );
}

// Main application layout (the three panels with resize handles)
function MainAppLayout() {
  const { sidebarWidth, chatPanelWidth, adjustSidebarWidth, adjustChatPanelWidth } = useStore((state) => ({
    sidebarWidth: state.sidebarWidth,
    chatPanelWidth: state.chatPanelWidth,
    adjustSidebarWidth: state.adjustSidebarWidth,
    adjustChatPanelWidth: state.adjustChatPanelWidth,
  }));

  // The resize handlers now only depend on the stable actions from the store,
  // preventing re-creations on every render and eliminating stale state issues.
  const handleSidebarResize = useCallback((delta) => {
    adjustSidebarWidth(delta);
  }, [adjustSidebarWidth]);

  const handleChatResize = useCallback((delta) => {
    adjustChatPanelWidth(delta);
  }, [adjustChatPanelWidth]);

  return (
    <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
      <Box component="nav" sx={{ width: sidebarWidth, flexShrink: 0, height: '100%' }}>
        <ProjectExplorer />
      </Box>
      
      <ResizeHandle onResize={handleSidebarResize} />
      
      <Box component="main" sx={{ flexGrow: 1, height: '100%', minWidth: 0 }}>
        <EditorArea />
      </Box>
      
      <ResizeHandle onResize={handleChatResize} />
      
      <Box component="aside" sx={{ width: chatPanelWidth, flexShrink: 0, height: '100%' }}>
        <ChatPanel />
      </Box>
    </Box>
  );
}

// Wrapper for the main authenticated view
function AppContainer() {
  const currentProject = useStore((state) => state.currentProject);

  if (!currentProject) {
    return <Navigate to="/select-project" />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppHeader />
      <MainAppLayout />
    </Box>
  );
}

// The main App component that defines the routes
function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Routes>
        <Route
          path="/"
          element={
            <PrivateRoute>
              <AppContainer />
            </PrivateRoute>
          }
        />
        <Route
          path="/select-project"
          element={
            <PrivateRoute>
              <AuthenticatedPageLayout>
                <SelectProjectPage />
              </AuthenticatedPageLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/create-project"
          element={
            <PrivateRoute>
              <AuthenticatedPageLayout>
                <CreateProjectPage />
              </AuthenticatedPageLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/login"
          element={
            <AuthLayout>
              <LoginPage />
            </AuthLayout>
          }
        />
        <Route
          path="/register"
          element={
            <AuthLayout>
              <RegisterPage />
            </AuthLayout>
          }
        />
      </Routes>
    </ThemeProvider>
  );
}

export default App;