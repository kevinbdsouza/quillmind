// src/components/EditorArea.jsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Box, Paper, IconButton, Divider, Tooltip, CircularProgress, Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, Typography, Tabs, Tab } from '@mui/material';
import { 
  FormatBold, FormatItalic, FormatUnderlined, 
  FormatListBulleted, FormatListNumbered, Code, 
  FormatQuote, Redo, Undo, AddComment,
  Close as CloseIcon
} from '@mui/icons-material';
import Editor, { loader } from '@monaco-editor/react';
import apiService from '../apiService';
import useStore from '../store';
import { updateFile } from '../apiService'; // Import updateFile

// Simple debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Set up Monaco loader
loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.49.0/min/vs' } });

const EditorToolbar = ({ onAction, onAiAction, isTextSelected, isAiLoading }) => {
  const topActions = [
    { label: 'Undo', action: 'undo', icon: <Undo /> },
    { label: 'Redo', action: 'redo', icon: <Redo /> },
  ];
  const formatActions = [
    { label: 'Bold', action: 'bold', icon: <FormatBold /> },
    { label: 'Italic', action: 'italic', icon: <FormatItalic /> },
    { label: 'Underline', action: 'underline', icon: <FormatUnderlined /> },
    { label: 'Code', action: 'code', icon: <Code /> },
  ];
  const blockActions = [
    { label: 'Bulleted List', action: 'bulleted-list', icon: <FormatListBulleted /> },
    { label: 'Numbered List', action: 'numbered-list', icon: <FormatListNumbered /> },
    { label: 'Quote', action: 'quote', icon: <FormatQuote /> },
  ];
  const aiActions = [
    { label: 'Custom', icon: <AddComment />, action: 'custom' },
  ];
  
  return (
    <Paper 
      elevation={0}
      sx={{ 
        display: 'flex', 
        flexWrap: 'wrap',
        alignItems: 'center',
        p: 0.5,
        mb: 1,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper'
      }}
    >
        {topActions.map(item => (
            <Tooltip title={item.label} key={item.action}>
                <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); onAction(item.action); }}>
                    {item.icon}
                </IconButton>
            </Tooltip>
        ))}
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        {formatActions.map(item => (
            <Tooltip title={item.label} key={item.action}>
                 <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); onAction(item.action); }}>
                    {item.icon}
                </IconButton>
            </Tooltip>
        ))}
         <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        {blockActions.map(item => (
            <Tooltip title={item.label} key={item.action}>
                 <IconButton size="small" onMouseDown={(e) => { e.preventDefault(); onAction(item.action); }}>
                    {item.icon}
                </IconButton>
            </Tooltip>
        ))}
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        {aiActions.map((item) => (
         <Tooltip title={item.label} key={item.action}>
            <span>
              <IconButton 
                size="small" 
                onMouseDown={(e) => {
                    e.preventDefault();
                    onAiAction(item.action);
                }}
                disabled={!isTextSelected || isAiLoading}
              >
                {item.icon}
              </IconButton>
            </span>
        </Tooltip>
      ))}
      {isAiLoading && <CircularProgress size={20} sx={{ ml: 1 }} />}
    </Paper>
  );
};

function EditorArea() {
  const editorRef = useRef(null);
  const { 
    openFiles, 
    activeFileId, 
    closeFile, 
    setActiveFileId, 
    updateFileContent 
  } = useStore((state) => ({
    openFiles: state.openFiles,
    activeFileId: state.activeFileId,
    closeFile: state.closeFile,
    setActiveFileId: state.setActiveFileId,
    updateFileContent: state.updateFileContent,
  }));

  const activeFile = useMemo(() => {
    return openFiles.find(file => file.file_id === activeFileId);
  }, [openFiles, activeFileId]);

  const selectionRef = useRef(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [isCustomPromptOpen, setIsCustomPromptOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const monacoRef = useRef(null);
  const customPromptInputRef = useRef(null);
  
  // --- Auto-saving logic ---
  const [isSaving, setIsSaving] = useState(false);

  // Debounced function to call the API
  const debouncedSave = useCallback(
    debounce(async (fileToSave) => {
      setIsSaving(true);
      try {
        await updateFile(fileToSave.file_id, fileToSave.content);
      } catch (error) {
        console.error('Failed to save file:', error);
        // Optionally show an error to the user
      } finally {
        setIsSaving(false);
      }
    }, 1500), // 1.5-second delay
    []
  );

  useEffect(() => {
    // When the active file changes, update the editor's content
    if (editorRef.current && activeFile) {
      if (editorRef.current.getValue() !== activeFile.content) {
        editorRef.current.setValue(activeFile.content || '');
      }
    } else if (editorRef.current && !activeFile) {
        editorRef.current.setValue(''); // Clear editor if no file is selected
    }
  }, [activeFile]);

  const handleDialogEntered = () => {
    // Focus the input field when the dialog animation completes
    if (customPromptInputRef.current) {
      customPromptInputRef.current.focus();
    }
  };
  // --- End of Auto-saving ---

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.onMouseUp(() => {
      setTimeout(() => {
        const currentSelection = editor.getSelection();
        if (currentSelection && !currentSelection.isEmpty()) {
          const selectedText = editor.getModel().getValueInRange(currentSelection);
          if (selectedText) {
            selectionRef.current = currentSelection;
            setIsTextSelected(true);
          }
        } else {
          selectionRef.current = null;
          setIsTextSelected(false);
        }
      }, 0);
    });
  };

  const handleAiAction = async (action) => {
    if (action === 'custom') {
      if (isTextSelected) {
        setIsCustomPromptOpen(true);
      }
      return;
    }

    const selection = selectionRef.current;
    if (!selection || !editorRef.current) return;
    
    const selectedText = editorRef.current.getModel().getValueInRange(selection);
    setIsAiLoading(true);

    try {
        const response = await apiService.post('/ai/gemini-action', { action, text: selectedText });
        const newText = response.data.result;

        editorRef.current.executeEdits('ai-replace', [
            { range: selection, text: newText }
        ]);
        selectionRef.current = null;
        setIsTextSelected(false);

    } catch (error) {
        console.error("AI Action Error:", error);
    } finally {
        setIsAiLoading(false);
    }
  };

  const handleCustomPromptClose = () => {
    setIsCustomPromptOpen(false);
    // Restore focus to the editor after the dialog closes
    setTimeout(() => editorRef.current?.focus(), 0);
  };

  const handleCustomPromptSubmit = async () => {
    const selection = selectionRef.current;
    if (!selection || !editorRef.current || !customPrompt.trim()) return;

    const selectedText = editorRef.current.getModel().getValueInRange(selection);
    setIsAiLoading(true);
    setIsCustomPromptOpen(false);

    try {
        const response = await apiService.post('/ai/gemini-action', {
            action: 'custom',
            text: selectedText,
            customPrompt: customPrompt
        });
        const newText = response.data.result;

        editorRef.current.executeEdits('ai-replace', [
            { range: selection, text: newText }
        ]);
        selectionRef.current = null;
        setIsTextSelected(false);
    } catch (error) {
        console.error("Custom AI Action Error:", error);
    } finally {
        setIsAiLoading(false);
        setCustomPrompt('');
    }
  };

  const handleEditorChange = (value) => {
    if (activeFile) {
      // 1. Update the state in Zustand immediately for a responsive UI
      updateFileContent(activeFile.file_id, value);

      // 2. Create a snapshot of the file to pass to the debounced function
      const fileWithNewContent = { ...activeFile, content: value };
      
      // 3. Call the debounced function to save to the backend
      debouncedSave(fileWithNewContent);
    }
  };

  const handleToolbarAction = (action) => {
    if (!editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor.getModel();

    if (!model) return;

    if (action === 'undo') {
      model.undo();
      return;
    }
    if (action === 'redo') {
      model.redo();
      return;
    }

    const selection = editor.getSelection();
    if (!selection) return;

    const edits = [];
    
    switch (action) {
      case 'bold':
      case 'italic':
      case 'underline':
      case 'code': {
        const selectedText = model.getValueInRange(selection);
        let newText;
        if (action === 'bold') newText = `**${selectedText}**`;
        if (action === 'italic') newText = `*${selectedText}*`;
        if (action === 'underline') newText = `<u>${selectedText}</u>`; // Non-standard markdown
        if (action === 'code') newText = `\`${selectedText}\``;
        edits.push({ range: selection, text: newText });
        break;
      }
      case 'bulleted-list':
      case 'numbered-list':
      case 'quote': {
        const startLine = selection.startLineNumber;
        const endLine = selection.endLineNumber;
        let number = 1;
        for (let i = startLine; i <= endLine; i++) {
          const lineContent = model.getLineContent(i);
          if (lineContent.trim() !== '') {
            let prefix = '';
            if (action === 'bulleted-list') prefix = '* ';
            if (action === 'numbered-list') prefix = `${number++}. `;
            if (action === 'quote') prefix = '> ';
            edits.push({
              range: new monaco.Range(i, 1, i, 1),
              text: prefix,
            });
          }
        }
        break;
      }
      default:
        console.log(`Unknown editor action: ${action}`);
        return;
    }

    if (edits.length > 0) {
      editor.executeEdits('toolbar-action', edits, [selection]);
    }

    editor.focus();
  };

  const getLanguage = (filename = '') => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'md':
      case 'markdown':
        return 'markdown';
      case 'js':
        return 'javascript';
      case 'jsx':
        return 'javascript';
      case 'ts':
        return 'typescript';
      case 'tsx':
        return 'typescript';
      case 'json':
        return 'json';
      case 'css':
        return 'css';
      case 'html':
        return 'html';
      case 'py':
          return 'python';
      case 'fountain':
          return 'fountain'; // Assuming a custom language definition might be needed
      default:
        return 'plaintext';
    }
  };
  
  const handleTabChange = (event, newValue) => {
    setActiveFileId(newValue);
  };

  const handleCloseTab = (event, fileId) => {
    event.stopPropagation(); // prevent tab change
    closeFile(fileId);
  };

  if (openFiles.length === 0) {
      return (
          <Box sx={{ 
              p: 3, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%',
              bgcolor: 'background.default'
            }}>
            <Typography variant="h6" color="text.secondary">
              Select a file from the explorer to begin editing.
            </Typography>
          </Box>
      )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeFileId}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ 
            minHeight: '40px',
            '& .MuiTab-root': { 
              minHeight: '40px',
              textTransform: 'none',
              py: 0.5,
              px: 2,
            }
          }}
        >
          {openFiles.map((file) => (
            <Tab
              component="div"
              key={file.file_id}
              value={file.file_id}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ mr: 1 }}>{file.name}</Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => handleCloseTab(e, file.file_id)}
                    sx={{ p: 0.2 }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              }
            />
          ))}
        </Tabs>
      </Paper>

      {/* This Box now wraps the main editor area content below the tabs */}
      <Box sx={{ p: 1, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {activeFile?.name || 'No file selected'}
          </Typography>
          {isSaving && <CircularProgress size={20} />}
        </Box>
        <EditorToolbar onAction={handleToolbarAction} onAiAction={handleAiAction} isTextSelected={isTextSelected} isAiLoading={isAiLoading}/>
        <Box sx={{ flexGrow: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            <Editor
                height="100%"
                theme="vs-dark"
                language={getLanguage(activeFile?.name)}
                value={activeFile?.content || ''}
                onMount={handleEditorDidMount}
                onChange={handleEditorChange}
                options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    wordWrap: 'on',
                    automaticLayout: true,
                }}
            />
        </Box>
      </Box>

      <Dialog 
        open={isCustomPromptOpen} 
        onClose={handleCustomPromptClose} 
        TransitionProps={{
          onEntered: handleDialogEntered
        }}
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Custom AI Action</DialogTitle>
        <DialogContent>
            <TextField 
                inputProps={{
                  ref: customPromptInputRef
                }}
                margin="dense"
                id="custom-prompt"
                label="Enter your custom prompt"
                type="text"
                fullWidth
                variant="outlined"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCustomPromptSubmit()}
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={handleCustomPromptClose}>Cancel</Button>
            <Button onClick={handleCustomPromptSubmit} variant="contained">Submit</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default EditorArea;