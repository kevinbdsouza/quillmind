import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Alert,
  Paper,
  ListItemIcon,
  Divider,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { getProjects, getProjectFiles } from '../apiService';
import useStore from '../store';

function SelectProjectPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { projects, setProjects, setCurrentProject, setProjectFiles } = useStore((state) => ({
    projects: state.projects,
    setProjects: state.setProjects,
    setCurrentProject: state.setCurrentProject,
    setProjectFiles: state.setProjectFiles,
  }));

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const userProjects = await getProjects();
        setProjects(userProjects);
      } catch (err) {
        setError(err.message || 'Failed to load projects.');
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, [setProjects]);

  const handleSelectProject = async (project) => {
    try {
      setCurrentProject(project);
      const files = await getProjectFiles(project.project_id);
      setProjectFiles(files);
      navigate('/');
    } catch (err) {
      setError(err.message || `Failed to load files for project ${project.name}`);
      setCurrentProject(null); // Clear partial state on failure
    }
  };

  const handleCreateNew = () => {
    navigate('/create-project');
  };

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ mt: 4, p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Select a Project
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
          Choose one of your existing projects or start a new one.
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        ) : (
          <Box sx={{ my: 2 }}>
            <List>
              {projects.length > 0 ? (
                projects.map((project, index) => (
                  <React.Fragment key={project.project_id}>
                    <ListItem disablePadding>
                      <ListItemButton onClick={() => handleSelectProject(project)} sx={{ p: 2, borderRadius: 1 }}>
                        <ListItemIcon>
                          <FolderIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={project.name}
                          secondary={`Last updated: ${new Date(project.updated_at).toLocaleString()}`}
                        />
                      </ListItemButton>
                    </ListItem>
                    {index < projects.length - 1 && <Divider component="li" />}
                  </React.Fragment>
                ))
              ) : (
                <Typography align="center" color="text.secondary" sx={{ p: 3 }}>
                  No projects found. Get started by creating one!
                </Typography>
              )}
            </List>
          </Box>
        )}

        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<AddCircleOutlineIcon />}
            onClick={handleCreateNew}
          >
            Create New Project
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}

export default SelectProjectPage; 