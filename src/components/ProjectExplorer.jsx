// src/components/ProjectExplorer.jsx
import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { Box, Typography, IconButton, TextField, Menu, MenuItem, Tooltip } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem, treeItemClasses } from '@mui/x-tree-view/TreeItem';
import { styled } from '@mui/material/styles';
import { SiJavascript, SiReact, SiPython, SiMarkdown } from 'react-icons/si';

// Icons
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderIcon from '@mui/icons-material/Folder';
import ArticleIcon from '@mui/icons-material/Article';
import AddIcon from '@mui/icons-material/Add';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import SyncIcon from '@mui/icons-material/Sync';

// Import the Zustand store hook and API services
import useStore from '../store';
import { createFile, getProjectFiles, moveFile, deleteFile, renameFile, indexProject } from '../apiService';

// Helper function to find a node by its ID in the tree.
const findNodeById = (nodes, id) => {
  for (const node of nodes) {
    if (node.file_id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

const getFileIcon = (fileName) => {
  if (fileName.endsWith('.js')) return <SiJavascript color="#F7DF1E" size={16} />;
  if (fileName.endsWith('.jsx')) return <SiReact color="#61DAFB" size={16} />;
  if (fileName.endsWith('.py')) return <SiPython color="#3776AB" size={16} />;
  if (fileName.endsWith('.md')) return <SiMarkdown color="#000000" size={16} />;
  return <ArticleIcon sx={{ fontSize: '1rem', color: '#E0E0E0' }} />;
};

// Create stable icon instances
const FOLDER_ICON = <FolderIcon sx={{ color: '#E0E0E0', fontSize: '1rem' }} />;
const FILE_ICON = <ArticleIcon sx={{ fontSize: '1rem', color: '#E0E0E0' }} />;

const StyledTreeItem = styled(TreeItem)(({ theme }) => ({
  [`& .${treeItemClasses.content}`]: {
    padding: theme.spacing(0.5, 0.75),
    margin: theme.spacing(0.25, 0),
    borderRadius: theme.shape.borderRadius,
    '&:hover': {
      backgroundColor: 'rgba(148,163,184,0.08)'
    },
    '&.Mui-selected, &.Mui-selected:hover, &.Mui-selected.Mui-focused': {
      backgroundColor: 'rgba(124,92,252,0.12)',
      color: 'inherit'
    }
  },
  [`& .${treeItemClasses.label}`]: {
    fontWeight: 'inherit',
    color: 'inherit',
    paddingLeft: theme.spacing(0.75),
    fontSize: '0.9rem'
  }
}));

// Simplified input component for creation
function CreationInput({ type, onSubmit, onCancel }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.scrollIntoView({ block: 'nearest' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      onSubmit(trimmedValue);
    } else {
      onCancel();
    }
  }, [value, onSubmit, onCancel]);

  const handleKeyDown = useCallback((event) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  }, [handleSubmit, onCancel]);

  const handleBlur = useCallback(() => {
    onCancel();
  }, [onCancel]);

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        p: 0.5,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 1,
        border: '1px solid #1976d2',
        m: 0.25
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {type === 'folder' ? FOLDER_ICON : FILE_ICON}
      <TextField
        inputRef={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        size="small"
        variant="standard"
        placeholder={`Enter ${type} name...`}
        sx={{ 
          ml: 0.5,
          minWidth: '120px',
          '& .MuiInputBase-input': {
            fontSize: '0.875rem',
            color: '#1A202C',
            padding: '2px 4px',
          },
          '& .MuiInput-underline:before': {
            borderBottom: 'none',
          },
          '& .MuiInput-underline:after': {
            borderBottom: '1px solid #1976d2',
          },
        }}
      />
    </Box>
  );
}

// Simplified rename input
function RenameInput({ node, onSubmit, onCancel }) {
  const [value, setValue] = useState(node.name);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmedValue = value.trim();
    if (trimmedValue && trimmedValue !== node.name) {
      onSubmit(node.file_id, trimmedValue);
    } else {
      onCancel();
    }
  }, [value, node.file_id, node.name, onSubmit, onCancel]);

  const handleKeyDown = useCallback((event) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  }, [handleSubmit, onCancel]);

  return (
    <TextField
      inputRef={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleSubmit}
      size="small"
      variant="standard"
      sx={{
        '& .MuiInputBase-input': {
          fontSize: '0.875rem',
          color: '#1A202C',
          padding: '0px 2px',
        },
      }}
    />
  );
}

// Recursive tree renderer
const renderTree = (nodes, handlers) => {
  const { 
    isCreating, 
    renamingNodeId, 
    onCreateSubmit, 
    onCreateCancel, 
    onRenameSubmit, 
    onRenameCancel,
    onDragStart,
    onDragOver,
    onDrop,
    onContextMenu
  } = handlers;

  return nodes.map((node) => {
    const isRenaming = renamingNodeId === node.file_id;
    const hasCreationInput = isCreating && isCreating.parentId === node.file_id;

    return (
      <StyledTreeItem
        key={node.file_id}
        itemId={node.file_id.toString()}
        label={
          isRenaming ? (
            <RenameInput
              node={node}
              onSubmit={onRenameSubmit}
              onCancel={onRenameCancel}
            />
          ) : (
            node.name
          )
        }
        icon={node.type === 'folder' ? FOLDER_ICON : getFileIcon(node.name)}
        draggable={!isRenaming}
        onDragStart={(e) => onDragStart(e, node.file_id)}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, node.file_id)}
        onContextMenu={(e) => onContextMenu(e, node.file_id)}
        onClick={(e) => e.stopPropagation()}
      >
        {node.children && renderTree(node.children, handlers)}
        {hasCreationInput && (
          <CreationInput
            type={isCreating.type}
            onSubmit={onCreateSubmit}
            onCancel={onCreateCancel}
          />
        )}
      </StyledTreeItem>
    );
  });
};

function ProjectExplorer() {
  const { 
    currentProject, 
    projectFiles, 
    setProjectFiles, 
    openFile,
    activeFileId,
    isAuthenticated,
    user,
    handleFileDeleted,
    handleFileRenamed
  } = useStore(state => ({
    currentProject: state.currentProject,
    projectFiles: state.projectFiles,
    setProjectFiles: state.setProjectFiles,
    openFile: state.openFile,
    activeFileId: state.activeFileId,
    isAuthenticated: state.isAuthenticated,
    user: state.user,
    handleFileDeleted: state.handleFileDeleted,
    handleFileRenamed: state.handleFileRenamed,
  }));
  
  const [expanded, setExpanded] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isCreating, setIsCreating] = useState(null);
  const [renamingNodeId, setRenamingNodeId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [error, setError] = useState(null);
  const [pendingExpansion, setPendingExpansion] = useState(null);

  // Clear error after a few seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Handle pending folder expansion after file refresh
  useEffect(() => {
    if (pendingExpansion && projectFiles.length > 0) {
      setExpanded(prev => {
        const newExpanded = prev.includes(pendingExpansion) ? prev : [...prev, pendingExpansion];
        return newExpanded;
      });
      setPendingExpansion(null);
    }
  }, [pendingExpansion, projectFiles]);

  useEffect(() => {
    setSelectedNodeId(activeFileId);
  }, [activeFileId]);

  // Refresh files from server
  const refreshFiles = useCallback(async () => {
    if (currentProject && isAuthenticated) {
      try {
        const updatedFiles = await getProjectFiles(currentProject.project_id);
        setProjectFiles(updatedFiles);
        setError(null); // Clear any previous errors
      } catch (error) {
        console.error('Failed to refresh files:', error);
        const errorMessage = error.message || 'Failed to refresh files';
        setError(errorMessage);
        
        // If it's an auth error, the interceptor will handle logout
        if (error.message?.includes('token') || error.message?.includes('auth')) {
          console.warn('Authentication error detected');
        }
      }
    }
  }, [currentProject, setProjectFiles, isAuthenticated]);

  // Helper function to generate unique file name
  const generateUniqueFileName = useCallback((proposedName, parentId, fileType) => {
    // Get children of the target directory
    const getChildrenOfParent = (parentId) => {
      if (parentId === null) {
        // Root level files
        return projectFiles.filter(node => node.parent_id === null);
      } else {
        // Find the parent folder and return its children
        const parentNode = findNodeById(projectFiles, parentId);
        return parentNode ? (parentNode.children || []) : [];
      }
    };

    const siblings = getChildrenOfParent(parentId);
    const existingNames = siblings
      .filter(node => node.type === fileType)
      .map(node => node.name.toLowerCase());

    let uniqueName = proposedName;
    let counter = 0;

    // Check if the proposed name already exists
    while (existingNames.includes(uniqueName.toLowerCase())) {
      counter++;
      if (counter === 1) {
        // First duplicate gets "_copy"
        const extension = proposedName.includes('.') ? 
          '.' + proposedName.split('.').pop() : '';
        const baseName = proposedName.includes('.') ? 
          proposedName.substring(0, proposedName.lastIndexOf('.')) : proposedName;
        uniqueName = `${baseName}_copy${extension}`;
      } else {
        // Subsequent duplicates get "_copy2", "_copy3", etc.
        const extension = proposedName.includes('.') ? 
          '.' + proposedName.split('.').pop() : '';
        const baseName = proposedName.includes('.') ? 
          proposedName.substring(0, proposedName.lastIndexOf('.')) : proposedName;
        uniqueName = `${baseName}_copy${counter}${extension}`;
      }
    }

    return uniqueName;
  }, [projectFiles]);

  // Handle file/folder creation
  const handleCreateSubmit = useCallback(async (name) => {
    if (!currentProject || !isCreating || !isAuthenticated) {
      setError('Please log in to create files');
      return;
    }

    // Store the parent ID before clearing isCreating state
    const parentId = isCreating.parentId;
    
    // Generate unique name to avoid duplicates
    const uniqueName = generateUniqueFileName(name, parentId, isCreating.type);

    try {
      await createFile({
        projectId: currentProject.project_id,
        name: uniqueName,
        type: isCreating.type,
        parent_id: parentId,
      });

      // Ensure parent folder stays expanded after creation
      if (parentId) {
        const parentIdStr = parentId.toString();
        setPendingExpansion(parentIdStr);
        
        // Immediately expand the parent folder
        setExpanded(prev => {
          if (!prev.includes(parentIdStr)) {
            return [...prev, parentIdStr];
          }
          return prev;
        });
      }
      
      await refreshFiles();
      
      setError(null); // Clear any previous errors
    } catch (error) {
      console.error(`Failed to create ${isCreating.type}:`, error);
      const errorMessage = error.message || `Could not create the ${isCreating.type}`;
      setError(errorMessage);
      
      // Don't show alert if it's an auth error (interceptor handles it)
      if (!error.message?.includes('token') && !error.message?.includes('auth')) {
        alert(`Error: ${errorMessage}`);
      }
    } finally {
      setIsCreating(null);
    }
  }, [currentProject, isCreating, refreshFiles, isAuthenticated, generateUniqueFileName]);

  const handleCreateCancel = useCallback(() => {
    setIsCreating(null);
    setError(null);
  }, []);

  // Handle file/folder renaming
  const handleRenameSubmit = useCallback(async (nodeId, newName) => {
    if (!isAuthenticated) {
      setError('Please log in to rename files');
      return;
    }

    try {
      await renameFile(nodeId, newName);
      
      // Update the file name in editor if it's open
      handleFileRenamed(nodeId, newName);
      
      await refreshFiles();
      setError(null);
    } catch (error) {
      console.error('Failed to rename:', error);
      const errorMessage = error.message || 'Failed to rename item';
      setError(errorMessage);
      
      if (!error.message?.includes('token') && !error.message?.includes('auth')) {
        alert(errorMessage);
      }
    } finally {
      setRenamingNodeId(null);
    }
  }, [refreshFiles, isAuthenticated, handleFileRenamed]);

  const handleRenameCancel = useCallback(() => {
    setRenamingNodeId(null);
    setError(null);
  }, []);

  // Handle drag and drop
  const handleDragStart = useCallback((event, nodeId) => {
    if (!isAuthenticated) {
      event.preventDefault();
      setError('Please log in to move files');
      return;
    }
    
    // Prevent event bubbling to parent elements
    event.stopPropagation();
    
    event.dataTransfer.setData("text/plain", nodeId.toString());
    event.dataTransfer.effectAllowed = 'move';
  }, [isAuthenticated]);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(async (event, targetNodeId) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthenticated) {
      setError('Please log in to move files');
      return;
    }

    const draggedNodeId = parseInt(event.dataTransfer.getData("text/plain"), 10);
    if (!draggedNodeId) return;

    const draggedNode = findNodeById(projectFiles, draggedNodeId);
    if (!draggedNode) return;

    let newParentId = null;
    if (targetNodeId) {
      const targetNode = findNodeById(projectFiles, targetNodeId);
      if (targetNode) {
        // Only move into folders, not into files
        if (targetNode.type === 'folder') {
          newParentId = targetNode.file_id;
        } else {
          // If dropping on a file, don't move
          return;
        }
      }
    }
    // If targetNodeId is null, it means dropping on empty space (root)

    // Prevent moving to same location or moving folder into itself
    if (draggedNode.parent_id === newParentId) {
      return;
    }
    if (draggedNode.type === 'folder' && targetNodeId && 
        (targetNodeId === draggedNodeId || findNodeById([draggedNode], targetNodeId))) {
      return;
    }

    try {
      await moveFile(draggedNodeId, newParentId);
      await refreshFiles();

      // Expand target folder if moved into one
      if (newParentId) {
        const parentIdStr = newParentId.toString();
        setExpanded(prev => prev.includes(parentIdStr) ? prev : [...prev, parentIdStr]);
      }
      
      setError(null);
    } catch (error) {
      console.error('Failed to move file:', error);
      const errorMessage = error.message || 'Could not move the item';
      setError(errorMessage);
      
      if (!error.message?.includes('token') && !error.message?.includes('auth')) {
        alert(`Error: ${errorMessage}`);
      }
    }
  }, [projectFiles, refreshFiles, isAuthenticated]);

  // Handle context menu
  const handleContextMenu = useCallback((event, nodeId) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (!isAuthenticated) {
      setError('Please log in to access file options');
      return;
    }
    
    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      nodeId,
    });
  }, [isAuthenticated]);

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!contextMenu || !isAuthenticated) return;
    
    const confirmed = window.confirm('Are you sure you want to delete this item and all its contents?');
    if (!confirmed) {
      setContextMenu(null);
      return;
    }

    try {
      await deleteFile(contextMenu.nodeId);
      
      // Close the file in editor if it's open
      handleFileDeleted(contextMenu.nodeId);
      
      await refreshFiles();
      setError(null);
    } catch (error) {
      console.error('Failed to delete:', error);
      const errorMessage = error.message || 'Failed to delete item';
      setError(errorMessage);
      
      if (!error.message?.includes('token') && !error.message?.includes('auth')) {
        alert(errorMessage);
      }
    } finally {
      setContextMenu(null);
    }
  }, [contextMenu, refreshFiles, isAuthenticated, handleFileDeleted]);

  const handleRename = useCallback(() => {
    if (!contextMenu || !isAuthenticated) return;
    setRenamingNodeId(contextMenu.nodeId);
    setContextMenu(null);
  }, [contextMenu, isAuthenticated]);

  // Handle item selection and file opening
  const handleNodeSelect = useCallback((event, nodeId) => {
    // onSelectedItemsChange gives a string nodeId. It can be an empty string if deselected.
    if (typeof nodeId !== 'string' || nodeId === '') {
      setSelectedNodeId(null);
      return;
    }
    
    const numericNodeId = parseInt(nodeId, 10);
    if (isNaN(numericNodeId)) {
      return;
    }
    
    setSelectedNodeId(numericNodeId);
    const clickedNode = findNodeById(projectFiles, numericNodeId);
  
    if (clickedNode && clickedNode.type === 'file') {
      openFile(clickedNode);
    }
  }, [projectFiles, openFile]);

  // Handle folder expand/collapse
  const handleToggle = useCallback((event, nodeIds) => {
    setExpanded(nodeIds);
  }, []);

  // Handle container click (deselect to enable root creation)
  const handleContainerClick = useCallback((event) => {
    // Only deselect if clicking directly on the container, not on tree items
    if (event.target === event.currentTarget) {
      setSelectedNodeId(null);
    }
  }, []);

  // Handle create button clicks
  const handleCreate = useCallback((type) => {
    if (!isAuthenticated) {
      setError('Please log in to create files');
      return;
    }

    let parentId = null;
    if (selectedNodeId) {
      const selectedNode = findNodeById(projectFiles, selectedNodeId);
      if (selectedNode) {
        parentId = selectedNode.type === 'folder' ? selectedNode.file_id : selectedNode.parent_id;
      }
    }

    const parentIdStr = parentId ? parentId.toString() : null;

    // Expand the parent folder if it's not already expanded.
    if (parentIdStr && !expanded.includes(parentIdStr)) {
      setExpanded([...expanded, parentIdStr]);
    }
    
    // Set the creation state.
    setIsCreating({ type, parentId });

  }, [selectedNodeId, projectFiles, isAuthenticated, expanded]);

  const handleIndexProject = async () => {
    if (!currentProject) return;
    try {
      console.log(`Starting indexing for project ${currentProject.name}...`);
      const result = await indexProject(currentProject.project_id);
      console.log('Indexing result:', result.message);
      // Here you would ideally show a snackbar
      alert(`Project indexing started: ${result.message}`);
    } catch (error) {
      console.error('Failed to start indexing:', error);
      alert(`Error: ${error.message}`);
    }
  };

  // Memoized tree items
  const treeItems = useMemo(() => {
    const handlers = {
      isCreating,
      renamingNodeId,
      onCreateSubmit: handleCreateSubmit,
      onCreateCancel: handleCreateCancel,
      onRenameSubmit: handleRenameSubmit,
      onRenameCancel: handleRenameCancel,
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
      onContextMenu: handleContextMenu,
    };

    const items = renderTree(projectFiles, handlers);
    
    // Add root creation input if needed
    if (isCreating && isCreating.parentId === null) {
      items.push(
        <CreationInput
          key="root-creation"
          type={isCreating.type}
          onSubmit={handleCreateSubmit}
          onCancel={handleCreateCancel}
        />
      );
    }
    
    return items;
  }, [
    projectFiles,
    isCreating,
    renamingNodeId,
    handleCreateSubmit,
    handleCreateCancel,
    handleRenameSubmit,
    handleRenameCancel,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleContextMenu,
  ]);

  // Show login message if not authenticated
  if (!isAuthenticated) {
    return (
      <Box sx={{ 
        height: '100%', 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#252526', 
        color: '#E0E0E0', 
        border: '1px solid #333333', 
        borderRadius: 1,
        p: 2,
      }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Please log in to access your files
        </Typography>
        <Typography variant="body2" color="text.secondary">
          You need to be authenticated to view and manage your project files.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex',
      flexDirection: 'column',
      bgcolor: '#252526', 
      color: '#E0E0E0', 
      border: '1px solid #333333', 
    }}>
      {/* Error Banner */}
      {error && (
        <Box sx={{
          bgcolor: '#ffebee',
          color: '#c62828',
          p: 1,
          borderBottom: '1px solid #333333',
          fontSize: '0.875rem',
        }}>
          {error}
        </Box>
      )}

      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        p: 1,
        borderBottom: '1px solid #333333'
      }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
          Explorer
        </Typography>
        <Box>
          <Tooltip title="Index Project for AI Search">
            <IconButton onClick={handleIndexProject} size="small">
              <SyncIcon sx={{ color: 'white' }} />
            </IconButton>
          </Tooltip>
          <IconButton 
            size="small" 
            onClick={() => handleCreate('file')} 
            title="New File"
            sx={{ mr: 0.5 }}
            disabled={!isAuthenticated}
          >
            <AddIcon sx={{ color: isAuthenticated ? '#E0E0E0' : '#999', fontSize: '1.2rem' }} />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={() => handleCreate('folder')} 
            title="New Folder"
            disabled={!isAuthenticated}
          >
            <CreateNewFolderIcon sx={{ color: isAuthenticated ? '#E0E0E0' : '#999', fontSize: '1.2rem' }} />
          </IconButton>
        </Box>
      </Box>

      {/* Tree View */}
      <Box 
        sx={{ 
          flexGrow: 1, 
          overflowY: 'auto', 
          p: 0.5,
        }}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, null)}
        onClick={handleContainerClick}
      >
        <SimpleTreeView
          aria-label="project-explorer"
          expandedItems={expanded}
          onExpandedItemsChange={handleToggle}
          selectedItems={selectedNodeId ? [String(selectedNodeId)] : []}
          onSelectedItemsChange={handleNodeSelect}
          slots={{
            collapseIcon: ExpandMoreIcon,
            expandIcon: ChevronRightIcon,
          }}
        >
          {treeItems}
        </SimpleTreeView>
      </Box>

      {/* Context Menu */}
      <Menu
        open={Boolean(contextMenu)}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleRename}>Rename</MenuItem>
        <MenuItem onClick={handleDelete}>Delete</MenuItem>
      </Menu>
    </Box>
  );
}

export default ProjectExplorer;
