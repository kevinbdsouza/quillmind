// src/components/EditorArea.jsx
import React, { /* useRef, useEffect */ } from 'react'; // Keep refs for later if needed
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Editor, { loader } from '@monaco-editor/react'; // Import Editor component

// Import the Zustand store hook
import useStore from '../store';

// Configure Monaco Loader (Optional: if you encounter path issues)
// loader.config({ paths: { vs: '/path/to/monaco-editor/min/vs' } });

function EditorArea() {
  const currentFile = useStore((state) => state.currentFile);
  // const updateFileContent = useStore((state) => state.updateFileContent); // Get action for later
  // const editorRef = useRef(null); // Ref to access editor instance if needed

  // Function to handle content changes in the editor
  function handleEditorChange(value, event) {
    // 'value' contains the current content of the editor
    console.log('Editor content changed:', value); // Log changes for now

    // --- Debounced saving would go here later ---
    // For now, DO NOT call updateFileContent on every change - it's too slow.
    // if (currentFile) {
    //   updateFileContent(currentFile.id, value); // Example of calling update (inefficient)
    // }
    // --------------------------------------------
  }

  // Optional: Function to run when editor mounts
  // function handleEditorDidMount(editor, monaco) {
  //   console.log('Editor did mount');
  //   editorRef.current = editor;
  //   // You can now access the editor instance via editorRef.current
  //   // e.g., editorRef.current.focus();
  // }

  // Determine language based on file extension (basic example)
  const getLanguage = (filename = '') => {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (extension === 'md' || extension === 'markdown') return 'markdown';
    if (extension === 'fountain') return 'plaintext'; // No specific fountain highlighter by default
    if (extension === 'js' || extension === 'jsx') return 'javascript';
    if (extension === 'ts' || extension === 'tsx') return 'typescript';
    if (extension === 'css') return 'css';
    if (extension === 'html') return 'html';
    if (extension === 'json') return 'json';
    return 'plaintext'; // Default
  };

  const language = currentFile ? getLanguage(currentFile.name) : 'plaintext';

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header/Toolbar Area (can be added later) */}
      <Box sx={{ p: 1, borderBottom: '1px solid rgba(0, 0, 0, 0.12)', flexShrink: 0 }}>
        <Typography variant="subtitle2" noWrap>
          {currentFile ? currentFile.name : 'No file selected'}
        </Typography>
      </Box>

      {/* Editor Area */}
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        {currentFile ? (
          <Editor
            // Use file ID as key to force full remount on file change
            key={currentFile.id}
            height="100%" // Fill the available space
            // width="100%" // Defaults to 100% width usually
            language={language}
            theme="vs-dark" // Or "light"
            // Use content from the store as the initial value
            value={currentFile.content}
            onChange={handleEditorChange}
            // onMount={handleEditorDidMount} // Optional: If you need editor instance
            loading={<Typography sx={{ p: 2 }}>Loading Editor...</Typography>} // Placeholder while editor loads
            options={{ // Various Monaco options
              minimap: { enabled: true },
              wordWrap: 'on', // Enable word wrapping
              // Add other options as needed
            }}
          />
        ) : (
          // Display message if no file is selected
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="h6" color="text.secondary">
              Select a file to start editing
            </Typography>
          </Box>
        )}
      </Box>

      {/* Status Bar Area (can be added later) */}
      {/* <Box sx={{ p: 1, borderTop: '1px solid rgba(0, 0, 0, 0.12)', flexShrink: 0 }}>
        <Typography variant="caption">Status Bar</Typography>
      </Box> */}
    </Box>
  );
}

export default EditorArea;