import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Paper,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { createProject, getProjectFiles } from '../apiService';
import useStore from '../store';

function CreateProjectPage() {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { setCurrentProject, setProjectFiles } = useStore((state) => ({
    setCurrentProject: state.setCurrentProject,
    setProjectFiles: state.setProjectFiles
  }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!projectName.trim()) {
      setError('Project name cannot be empty.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const newProject = await createProject(projectName);
      // After creating, set it as the current project
      setCurrentProject(newProject);
      // A new project will have no files, so we can set an empty array
      setProjectFiles([]);
      // Navigate to the main app view
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to create project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ mt: 4, p: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <AddCircleOutlineIcon color="primary" sx={{ fontSize: 40, mb: 2 }} />
          <Typography variant="h4" component="h1" gutterBottom>
            Create a New Project
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
            Give your new project a name to get started.
          </Typography>

          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
            {error && <Alert severity="error" sx={{ mb: 2, width: '100%' }}>{error}</Alert>}
            
            <TextField
              margin="normal"
              required
              fullWidth
              id="projectName"
              label="Project Name"
              name="projectName"
              autoFocus
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={loading}
              variant="outlined"
            />
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Project'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}

export default CreateProjectPage; 