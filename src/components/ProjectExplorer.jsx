// src/components/ProjectExplorer.jsx
import React from 'react';
import Box from '@mui/material/Box';
import { SimpleTreeView } from '@mui/x-tree-view';
import { TreeItem } from '@mui/x-tree-view/TreeItem';

// Icons
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderIcon from '@mui/icons-material/Folder';
import ArticleIcon from '@mui/icons-material/Article';

// Import the Zustand store hook
import useStore from '../store';

function ProjectExplorer() {
  const projectFiles = useStore((state) => state.projectFiles);
  const setCurrentFile = useStore((state) => state.setCurrentFile);
  const currentFile = useStore((state) => state.currentFile);

  // --- New Handler specifically for file clicks ---
  const handleFileClick = (event, fileNode) => {
    console.log('File clicked (handleFileClick):', fileNode);
    setCurrentFile(fileNode);
    // Prevent this click from interfering with TreeView's folder expand/collapse
    event.stopPropagation();
  };

  // Recursive function to render tree items
  const renderTreeItems = (nodes) =>
    nodes.map((node) => (
      <TreeItem
        key={node.id}
        itemId={node.id} // Keep using itemId
        label={node.name}
        icon={node.type === 'folder' ? <FolderIcon /> : <ArticleIcon />}
        // --- Add onClick handler directly to the TreeItem ---
        // --- Only add it if the node is a file ---
        onClick={node.type === 'file' ? (event) => handleFileClick(event, node) : undefined}
      >
        {/* Render children recursively */}
        {Array.isArray(node.children) ? renderTreeItems(node.children) : null}
      </TreeItem>
    ));

  return (
    <Box sx={{ padding: 1, height: '100%', overflowY: 'auto' }}>
      {/* --- SimpleTreeView --- */}
      <SimpleTreeView
        aria-label="project explorer"
        slots={{
          collapseIcon: ExpandMoreIcon,
          expandIcon: ChevronRightIcon,
        }}
        // --- REMOVED event handlers like onItemSelected/onNodeSelect ---

        // Keep 'selected' prop for highlighting based on state
        // Note: This might not highlight correctly anymore without a top-level handler,
        // but let's first ensure selection *works*. We can refine highlighting later.
         selected={currentFile ? currentFile.id : []} // Pass array for multiSelect=false (or empty)

        sx={{ flexGrow: 1, overflowY: 'auto' }}
      >
        {/* Render the tree */}
        {renderTreeItems(projectFiles)}
      </SimpleTreeView>
    </Box>
  );
}

export default ProjectExplorer;