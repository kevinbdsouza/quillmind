// src/components/EditorArea.jsx
import React, { useRef, useEffect, useState } from 'react'; // Add useEffect, useState
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Editor, { loader } from '@monaco-editor/react';
import Button from '@mui/material/Button'; // For Save Button
import CircularProgress from '@mui/material/CircularProgress'; // For loading content
import Alert from '@mui/material/Alert'; // For errors

// Import the Zustand store hook and actions
import useStore from '../store';

// Import API functions
import { fetchFileContent, saveFileContent, performGeminiAction } from '../apiService';

// Configure Monaco Loader (Optional: if you encounter path issues)
// loader.config({ paths: { vs: '/path/to/monaco-editor/min/vs' } });

function EditorArea() {
  const currentFile = useStore((state) => state.currentFile);
  const updateFileContentInStore = useStore((state) => state.updateFileContent); // Action to update store
  const editorRef = useRef(null); // Keep ref for accessing editor value on save

  // --- Local state for editor content and status ---
  const [editorContent, setEditorContent] = useState('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  // --- State for AI Actions ---
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  // -------------------------------------------------

  // --- Effect to Load Content when currentFile changes ---
  useEffect(() => {
    setError(null);
    setAiError(null); // Clear AI errors when file changes
    if (currentFile && currentFile.id) {
      // Check if content already exists in the store object (maybe fetched by explorer? unlikely now)
      if (currentFile.content) {
        console.log(`Content for ${currentFile.name} found in initial object.`);
        setEditorContent(currentFile.content);
      } else {
        // Content not present, fetch it
        console.log(`Fetching content for ${currentFile.name} (ID: ${currentFile.id})...`);
        setIsLoadingContent(true);
        fetchFileContent(currentFile.id)
          .then(data => {
            console.log('Fetched content:', data);
            if (data && typeof data.content === 'string') {
              setEditorContent(data.content);
              // Optional: Update the store so content is available if user clicks away/back
              updateFileContentInStore(currentFile.id, data.content);
            } else {
              // Handle case where content is missing or not a string
              console.warn('Fetched data does not contain valid content string.', data);
              setEditorContent(''); // Default to empty
              setError('Failed to load valid content for the file.');
            }
          })
          .catch(err => {
            console.error('Failed to fetch file content:', err);
            setError(err.message || 'Failed to load file content.');
            setEditorContent(''); // Clear content on error
          })
          .finally(() => {
            setIsLoadingContent(false);
          });
      }
    } else {
      // No file selected, clear content
      setEditorContent('');
    }
    // Dependency: currentFile object itself might change, but ID is the key trigger
  }, [currentFile?.id, currentFile?.content, updateFileContentInStore]); // Re-run if file ID changes
  // -------------------------------------------------------

  // Function to handle content changes in the editor
  function handleEditorChange(value, event) {
    // Update local state directly
    setEditorContent(value);
    // console.log('Editor content changed locally'); // Can be noisy
  }

  // Function to handle saving the content
  const handleSave = async () => {
    if (!currentFile || !currentFile.id) return; // No file to save

    setIsSaving(true);
    setError(null);
    setAiError(null); // Clear AI errors on save
    try {
      const contentToSave = editorRef.current?.getValue(); // Get current value directly from editor instance
      if (typeof contentToSave !== 'string') {
        throw new Error("Could not get editor content.");
      }

      console.log(`Saving content for ${currentFile.name} (ID: ${currentFile.id})...`);
      const result = await saveFileContent(currentFile.id, contentToSave);
      console.log('Save result:', result);

      // Update content in Zustand store as well after successful save
      updateFileContentInStore(currentFile.id, contentToSave);
      alert('File saved successfully!'); // Simple feedback for now
    } catch (err) {
      console.error('Failed to save file:', err);
      setError(err.message || 'Failed to save file.');
    } finally {
      setIsSaving(false);
    }
  };

  // Function to run when editor mounts - Modified to add actions
  function handleEditorDidMount(editor, monaco) {
    console.log('Editor did mount');
    editorRef.current = editor;

    // --- Helper Function to Trigger AI Action --- 
    const triggerAiAction = async (action) => {
      if (!editorRef.current) return;
      const editorInstance = editorRef.current;
      const model = editorInstance.getModel();
      const selection = editorInstance.getSelection();

      if (!model || !selection || selection.isEmpty()) {
        setAiError('Please select text in the editor to perform this action.');
        setTimeout(() => setAiError(null), 3000); // Clear error after 3s
        return;
      }

      const selectedText = model.getValueInRange(selection);
      setIsAiLoading(true);
      setAiError(null);

      try {
        console.log(`Requesting AI action: ${action} for text: "${selectedText.substring(0, 50)}..."`);
        const response = await performGeminiAction(action, selectedText);

        if (response && response.result) {
          console.log('AI Result:', response.result);
          // Replace selection with the result
          editorInstance.executeEdits('ai-replace', [{
            range: selection,
            text: response.result,
            forceMoveMarkers: true,
          }]);
        } else {
          throw new Error('Invalid response received from AI service.');
        }
      } catch (err) {
        console.error(`AI Action (${action}) failed:`, err);
        setAiError(err.message || `Failed to ${action} text.`);
      } finally {
        setIsAiLoading(false);
      }
    };
    // ----------------------------------------

    // --- Define AI Actions for Context Menu --- 
    const actions = [
      {
        id: 'ai-summarize',
        label: 'AI: Summarize Selection',
        contextMenuGroupId: 'navigation', // Group with other navigation/edit items
        contextMenuOrder: 1.5, // Order within the group
        run: () => triggerAiAction('summarize'),
      },
      {
        id: 'ai-rewrite',
        label: 'AI: Rewrite Selection',
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.6,
        run: () => triggerAiAction('rewrite'),
      },
      {
        id: 'ai-make-shorter',
        label: 'AI: Make Shorter',
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.7,
        run: () => triggerAiAction('make shorter'),
      },
      {
        id: 'ai-make-longer',
        label: 'AI: Make Longer',
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.8,
        run: () => triggerAiAction('make longer'),
      },
      // Add more actions here...
    ];

    // Add actions to the editor
    actions.forEach(action => editor.addAction(action));
    console.log('AI context menu actions added to editor.');
    // --------------------------------------
  }

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
      {/* Header/Toolbar Area */}
      <Box sx={{ p: 1, borderBottom: '1px solid rgba(0, 0, 0, 0.12)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2" noWrap sx={{ mr: 2 }}>
          {currentFile ? currentFile.name : 'No file selected'}
        </Typography>
        {/* Display AI Loading Indicator near save button */}
        {isAiLoading && <CircularProgress size={20} sx={{ mr: 1 }} />}
        {currentFile && (
          <Button variant="contained" size="small" onClick={handleSave} disabled={isSaving || isLoadingContent || isAiLoading}>
            {isSaving ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        )}
      </Box>

      {/* Display Error Alert if any error occurred (Fetch, Save, or AI) */}
       {(error || aiError) && (
          <Alert severity="error" sx={{ m: 1 }} onClose={() => { setError(null); setAiError(null); }}>
            {error || aiError} {/* Display whichever error is present */}
          </Alert>
        )}

      {/* Editor Area */}
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        {isLoadingContent ? (
          // Show loading indicator while content is fetching
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress />
            <Typography sx={{ ml: 1 }}>Loading content...</Typography>
          </Box>
        ) : currentFile ? (
          <Editor
            key={currentFile.id} // Keep key for remount
            height="100%"
            language={language}
            theme="vs-dark"
            // Use LOCAL state for value, fetched/updated dynamically
            value={editorContent}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount} // Get editor instance and add actions
            loading={<Typography sx={{ p: 2 }}>Loading Editor...</Typography>}
            options={{ minimap: { enabled: true }, wordWrap: 'on' }}
          />
        ) : (
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