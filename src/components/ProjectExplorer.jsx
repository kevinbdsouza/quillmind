// src/components/ProjectExplorer.jsx
import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { SimpleTreeView } from '@mui/x-tree-view';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
// --- Import MUI Dialog components ---
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
// ------------------------------------

// Icons
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderIcon from '@mui/icons-material/Folder';
import ArticleIcon from '@mui/icons-material/Article';
import AddIcon from '@mui/icons-material/Add';
import NoteAddIcon from '@mui/icons-material/NoteAdd';

// Import the Zustand store hook and actions
import useStore from '../store';

// Import API functions
import { fetchProjects, fetchFilesForProject, createProject, createFile } from '../apiService';

function ProjectExplorer() {
  const projectFiles = useStore((state) => state.projectFiles);
  const setProjectFiles = useStore((state) => state.setProjectFiles);
  const addProject = useStore((state) => state.addProject);
  const addFileToProject = useStore((state) => state.addFileToProject);
  const setCurrentFile = useStore((state) => state.setCurrentFile);
  const currentFile = useStore((state) => state.currentFile);

  // --- State for loading and errors ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  // -------------------------------------

  // --- State for Create Project Dialog ---
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  // -------------------------------------

  // --- State for Create File Dialog ---
  const [isCreateFileDialogOpen, setIsCreateFileDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [targetProjectId, setTargetProjectId] = useState(null);
  // ---------------------------------

  // --- Fetch Data on Mount ---
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch Projects
        const projects = await fetchProjects();
        console.log("Fetched projects:", projects);

        // 2. Fetch Files for each project and structure data
        const structuredData = await Promise.all(
          projects.map(async (project) => {
            try {
                const projectId = project.id || project.project_id;
                if (!projectId) {
                    console.warn("Project missing ID:", project);
                    // Still add itemId for consistency
                    return { ...project, id: `unknown-project-${Date.now()}`, itemId: `project-unknown-${Date.now()}`, type: 'folder', children: [] };
                }
                const files = await fetchFilesForProject(projectId);
                console.log(`Fetched files for project ${projectId}:`, files);

                // Create children array with original numeric `id` and prefixed string `itemId`
                const children = files.map(file => {
                    const fileId = file.id || file.file_id;
                    return {
                        id: fileId, // Keep original numeric ID
                        itemId: `file-${projectId}-${fileId}`, // Unique ID for TreeView
                        name: file.name,
                        type: 'file',
                        path: file.path,
                        project_id: projectId, // Ensure this is the numeric project ID
                        // Add content placeholder if needed later, or expect EditorArea to fetch
                        // content: file.content // Assuming API doesn't return content here
                    };
                });

                // Return project node with original numeric `id` and prefixed string `itemId`
                return {
                    id: projectId, // Keep original numeric ID
                    itemId: `project-${projectId}`, // Prefixed string ID for TreeView
                    name: project.name,
                    type: 'folder',
                    children: children
                };
            } catch (fileError) {
                 const projectId = project.id || project.project_id;
                 console.error(`Failed to fetch files for project ${projectId}:`, fileError);
                 // Return project structure even if files fail, include itemId
                 return { id: projectId, itemId: `project-${projectId}`, name: project.name, type: 'folder', children: [] };
            }
          })
        );

        console.log("Structured data for store:", structuredData);
        // 3. Update Zustand store
        setProjectFiles(structuredData);
      } catch (err) {
        console.error("Failed to load project data:", err);
        setError(err.message || 'Failed to load projects');
        setProjectFiles([]); // Clear existing/dummy data on error
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [setProjectFiles]); // Dependency array ensures this runs once on mount
  // -------------------------

  // --- Handlers for Create Project Dialog ---
  const handleClickOpenCreateProjectDialog = () => {
    setNewProjectName(''); // Reset name field
    setError(null); // Clear previous errors
    setIsCreateProjectDialogOpen(true);
  };

  const handleCloseCreateProjectDialog = () => {
    setIsCreateProjectDialogOpen(false);
  };

  const handleConfirmCreateProject = async () => {
    const projectName = newProjectName.trim();
    if (!projectName) {
      setError('Project name cannot be empty.'); // Show error in dialog maybe?
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const newProjectData = await createProject(projectName);
      console.log('Project created:', newProjectData);

      // Format the project data for the store/TreeView
      const formattedProject = {
        id: newProjectData.project_id,
        itemId: `project-${newProjectData.project_id}`,
        name: newProjectData.name,
        type: 'folder',
        children: [],
      };

      addProject(formattedProject);
      handleCloseCreateProjectDialog(); // Close dialog on success

    } catch (err) {
      console.error("Failed to create project:", err);
      // Display error to the user (e.g., inside the dialog or main area)
      setError(err.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };
  // -----------------------------------------

  // --- Handlers for Create File Dialog ---
  const handleClickOpenCreateFileDialog = (projectId) => {
    setNewFileName('');
    setTargetProjectId(projectId);
    setError(null);
    setIsCreateFileDialogOpen(true);
  };

  const handleCloseCreateFileDialog = () => {
    setIsCreateFileDialogOpen(false);
    setTargetProjectId(null);
  };

  const handleConfirmCreateFile = async () => {
    let fileName = newFileName.trim();
    if (!fileName) {
      setError('File name cannot be empty.');
      return;
    }
    // Basic check: Add .md if no extension provided (optional)
    if (!fileName.includes('.')) {
        fileName += '.md';
    }

    if (!targetProjectId) {
      console.error("Target project ID is missing for file creation.");
      setError("Cannot create file: project context lost.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      // Assume default type ('markdown') and path ('/') for now
      const newFileData = await createFile(targetProjectId, fileName);
      console.log('File created:', newFileData);

      // Format file data for the store/TreeView
      const formattedFile = {
        id: newFileData.file_id,
        itemId: `file-${targetProjectId}-${newFileData.file_id}`,
        name: newFileData.name,
        type: 'file',
        path: newFileData.path,
        project_id: targetProjectId,
      };

      addFileToProject(targetProjectId, formattedFile);
      handleCloseCreateFileDialog();

    } catch (err) {
      console.error("Failed to create file:", err);
      setError(err.message || 'Failed to create file');
    } finally {
      setCreating(false);
    }
  };
  // -------------------------------------

  // --- New Handler specifically for file clicks ---
  const handleFileClick = (event, fileNode) => {
    console.log('File clicked (handleFileClick):', fileNode); // fileNode now contains id and itemId
    setCurrentFile(fileNode);
    // Prevent this click from interfering with TreeView's folder expand/collapse
    event.stopPropagation();
  };

  // Modified renderTreeItems to include Add File button
  const renderTreeItems = (nodes) =>
    nodes.map((node) => (
      <TreeItem
        key={node.itemId}
        itemId={node.itemId}
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', p: 0.5, pr: 0 }}>
            {node.type === 'folder' ? <FolderIcon sx={{ mr: 1 }} /> : <ArticleIcon sx={{ mr: 1 }} />}
            <Box component="span" sx={{ flexGrow: 1 }}>{node.name}</Box>
            {node.type === 'folder' && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClickOpenCreateFileDialog(node.id);
                }}
                aria-label={`Add file to ${node.name}`}
              >
                <NoteAddIcon fontSize="inherit" />
              </IconButton>
            )}
          </Box>
        }
        onClick={node.type === 'file' ? (event) => handleFileClick(event, node) : undefined}
      >
        {Array.isArray(node.children) ? renderTreeItems(node.children) : null}
      </TreeItem>
    ));

  return (
    <Box sx={{ padding: 1, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Add New Project Button */}
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={handleClickOpenCreateProjectDialog}
        disabled={creating || loading}
        sx={{ mb: 1 }}
      >
        New Project
      </Button>

      {/* --- Create Project Dialog --- */}
      <Dialog open={isCreateProjectDialogOpen} onClose={handleCloseCreateProjectDialog}>
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Please enter the name for your new project.
          </DialogContentText>
          <TextField
            autoFocus
            required
            margin="dense"
            id="project-name"
            label="Project Name"
            type="text"
            fullWidth
            variant="standard"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            disabled={creating}
            onKeyDown={(e) => e.key === 'Enter' && !creating && handleConfirmCreateProject()}
          />
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateProjectDialog} disabled={creating}>Cancel</Button>
          <Button onClick={handleConfirmCreateProject} disabled={creating || !newProjectName.trim()}>
            {creating ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* --- Create File Dialog --- */}
      <Dialog open={isCreateFileDialogOpen} onClose={handleCloseCreateFileDialog}>
        <DialogTitle>Create New File</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Please enter the name for the new file (e.g., chapter1.md).
          </DialogContentText>
          <TextField
            autoFocus
            required
            margin="dense"
            id="file-name"
            label="File Name"
            type="text"
            fullWidth
            variant="standard"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            disabled={creating}
            onKeyDown={(e) => e.key === 'Enter' && !creating && handleConfirmCreateFile()}
          />
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateFileDialog} disabled={creating}>Cancel</Button>
          <Button onClick={handleConfirmCreateFile} disabled={creating || !newFileName.trim()}>
            {creating ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Existing Loading/Error/TreeView Logic */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}><CircularProgress /></Box>
      ) :
      error && !isCreateProjectDialogOpen && !isCreateFileDialogOpen ? (
        <Box sx={{ padding: 2 }}><Alert severity="error">{error}</Alert></Box>
      ) :
      projectFiles.length === 0 ? (
        <Box sx={{ textAlign: 'center', color: 'text.secondary', mt: 2 }}>No projects found. Click "New Project" to start.</Box>
      ) : (
        <SimpleTreeView
          aria-label="project explorer"
          slots={{
            collapseIcon: ExpandMoreIcon,
            expandIcon: ChevronRightIcon,
          }}
          selected={currentFile ? [currentFile.itemId] : []}
          sx={{ flexGrow: 1, overflowY: 'auto' }}
        >
          {renderTreeItems(projectFiles)}
        </SimpleTreeView>
      )}
    </Box>
  );
}

export default ProjectExplorer;