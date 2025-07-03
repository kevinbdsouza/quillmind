// src/components/EditorArea.jsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Box, Paper, IconButton, Divider, Tooltip, CircularProgress, Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, Typography, Tabs, Tab } from '@mui/material';
import { 
  FormatBold, FormatItalic, FormatUnderlined, 
  FormatListBulleted, FormatListNumbered, Code, 
  FormatQuote, Redo, Undo, AddComment,
  Close as CloseIcon, Check as CheckIcon,
} from '@mui/icons-material';
import Editor, { loader, useMonaco } from '@monaco-editor/react';
import apiService from '../apiService';
import useStore from '../store';
import { updateFile } from '../apiService'; // Import updateFile

const suggestionHighlightStyle = `
  .suggestion-original {
    background-color: rgba(205, 92, 92, 0.25); /* dull red for original */
    border-radius: 2px;
  }
  .suggestion-new {
    background-color: rgba(210, 105, 30, 0.3); /* dull orange for suggestion text */
    border-radius: 2px;
  }
`;

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

const SuggestionWidget = ({ onAccept, onReject }) => (
  <Box
    className="suggestion-widget"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.25,
      p: 0.25,
      bgcolor: 'background.paper',
      borderRadius: 1,
      boxShadow: 2,
      pointerEvents: 'auto',
    }}
  >
    <Tooltip title="Accept">
      <IconButton size="small" onClick={onAccept} color="success">
        <CheckIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
    <Tooltip title="Reject">
      <IconButton size="small" onClick={onReject} color="error">
        <CloseIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
  </Box>
);

// add helper function after imports
const rangeToPlain = (r) => ({
  startLineNumber: r.startLineNumber,
  startColumn: r.startColumn,
  endLineNumber: r.endLineNumber,
  endColumn: r.endColumn,
});
const plainToRange = (pl, monaco)=> new monaco.Range(pl.startLineNumber, pl.startColumn, pl.endLineNumber, pl.endColumn);

function EditorArea() {
  const editorRef = useRef(null);
  const monaco = useMonaco();
  const { 
    openFiles, 
    activeFileId, 
    closeFile, 
    setActiveFileId, 
    updateFileContent,
    suggestions,
  } = useStore((state) => ({
    openFiles: state.openFiles,
    activeFileId: state.activeFileId,
    closeFile: state.closeFile,
    setActiveFileId: state.setActiveFileId,
    updateFileContent: state.updateFileContent,
    suggestions: state.suggestions,
  }));

  const activeFile = useMemo(() => {
    return openFiles.find(file => file.file_id === activeFileId);
  }, [openFiles, activeFileId]);

  const selectionRef = useRef(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [isCustomPromptOpen, setIsCustomPromptOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const customPromptInputRef = useRef(null);
  const [decorations, setDecorations] = useState([]);
  const contentWidgets = useRef({});
  const rootNodes = useRef({});
  
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

  // Define handlers before they're used in useEffect dependencies
  const handleAcceptSuggestion = useCallback((suggestion) => {
    console.log('Accept suggestion called:', suggestion);
    if (!editorRef.current || !monaco) {
      console.log('Missing editor or monaco:', { editor: !!editorRef.current, monaco: !!monaco });
      return;
    }
    
    try {
      const currentSuggestions = useStore.getState().suggestions;
      const stillExists = currentSuggestions.find(s => s.id === suggestion.id);
      if (!stillExists) return;

      // Create a single range that covers both the original text and the temporary suggestion
      const totalRange = new monaco.Range(
        suggestion.originalRange.startLineNumber,
        suggestion.originalRange.startColumn,
        suggestion.deleteRange.endLineNumber,
        suggestion.deleteRange.endColumn
      );

      // Replace the entire area with the final suggested text
      editorRef.current.executeEdits('accept-suggestion', [
        { range: totalRange, text: suggestion.text, forceMoveMarkers: true }
      ]);
      
      useStore.getState().removeSuggestion(suggestion.id);
      console.log('Suggestion accepted and removed');
      
    } catch (error) {
      console.warn('Error accepting suggestion:', error);
      useStore.getState().removeSuggestion(suggestion.id);
    }
  }, [monaco]);

  const handleRejectSuggestion = useCallback((suggestionId) => {
    console.log('Reject suggestion called:', suggestionId);
    try {
      const s = useStore.getState().suggestions.find(x=>x.id===suggestionId);
      if(s){
        const delRange = plainToRange(s.deleteRange, monaco);
        editorRef.current.executeEdits('reject-suggestion', [{range: delRange, text:'', forceMoveMarkers:true}]);
      }
      useStore.getState().removeSuggestion(suggestionId);
      console.log('Suggestion rejected and removed');
    } catch (error) {
      console.warn('Error rejecting suggestion:', error);
    }
  }, [monaco]);

  const [editorReady, setEditorReady] = useState(false);

  useEffect(() => {
    console.log('useEffect triggered: suggestions', suggestions.length, 'monaco ready', !!monaco);
    // When suggestions change, update the editor decorations
    if (editorRef.current && monaco && monaco.editor) {
      console.log('Rendering suggestions effect. Count:', suggestions.length);
      const newDecorations = suggestions.flatMap(suggestion => ([
        {
          range: new monaco.Range(
            suggestion.originalRange.startLineNumber,
            suggestion.originalRange.startColumn,
            suggestion.originalRange.endLineNumber,
            suggestion.originalRange.endColumn
          ),
          options: {
            className: 'suggestion-original',
            inlineClassName: 'suggestion-original',
          }
        },
        {
          range: new monaco.Range(
            suggestion.suggestionRange.startLineNumber,
            suggestion.suggestionRange.startColumn,
            suggestion.suggestionRange.endLineNumber,
            suggestion.suggestionRange.endColumn
          ),
          options: {
            className: 'suggestion-new',
            inlineClassName: 'suggestion-new',
          }
        }
      ]));
      const resultingDecorations = editorRef.current.deltaDecorations(decorations, newDecorations);
      console.log('Applied decorations', resultingDecorations);
      setDecorations(resultingDecorations);

      // --- Manage Content Widgets ---
      const newWidgetIds = new Set(suggestions.map(s => s.id));
      const oldWidgetIds = new Set(Object.keys(contentWidgets.current));

      // Remove old widgets that are no longer needed
      oldWidgetIds.forEach(id => {
        if (!newWidgetIds.has(id)) {
          try {
            editorRef.current.removeContentWidget(contentWidgets.current[id]);
            delete contentWidgets.current[id];
            if (rootNodes.current[id]) {
              const root = rootNodes.current[id];
              // defer unmount to avoid React warning during render
              Promise.resolve().then(() => root.unmount());
              delete rootNodes.current[id];
            }
          } catch (error) {
            console.warn('Error removing content widget:', error);
          }
        }
      });
      
      // Add new widgets
      suggestions.forEach(suggestion => {
        console.log('Processing widget for', suggestion.id);
        if (!contentWidgets.current[suggestion.id]) {
          try {
            const widgetNode = document.createElement('span');
            widgetNode.style.pointerEvents = 'auto'; // make entire widget clickable
            widgetNode.className = 'suggestion-widget-root';
            const root = createRoot(widgetNode);
            
            root.render(
              <SuggestionWidget 
                onAccept={() => handleAcceptSuggestion(suggestion)} 
                onReject={() => handleRejectSuggestion(suggestion.id)} 
              />
            );
            
            const widget = {
              getId: () => `suggestion.widget.${suggestion.id}`,
              getDomNode: () => widgetNode,
              getPosition: () => ({
                position: {
                  lineNumber: suggestion.suggestionRange.endLineNumber,
                  column: suggestion.suggestionRange.endColumn
                },
                preference: [monaco.editor.ContentWidgetPositionPreference.EXACT]
              })
            };

            editorRef.current.addContentWidget(widget);
            contentWidgets.current[suggestion.id] = widget;
            rootNodes.current[suggestion.id] = root;
          } catch (error) {
            console.warn('Error adding content widget:', error);
          }
        }
      });
    }
  }, [suggestions, monaco, editorReady, handleAcceptSuggestion, handleRejectSuggestion]);

  // Cleanup effect to remove all widgets when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup all content widgets
      Object.keys(contentWidgets.current).forEach(id => {
        try {
          if (editorRef.current) {
            editorRef.current.removeContentWidget(contentWidgets.current[id]);
          }
          if (rootNodes.current[id]) {
            const root = rootNodes.current[id];
            // defer unmount to avoid React warning during render
            Promise.resolve().then(() => root.unmount());
          }
        } catch (error) {
          console.warn('Error during cleanup:', error);
        }
      });
      contentWidgets.current = {};
      rootNodes.current = {};
    };
  }, []);

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

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    setEditorReady(true);

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
    const fileIdAtActionStart = activeFileId; // Capture file ID
    if (!selection || !editorRef.current || !fileIdAtActionStart) return;
    
    const selectedText = editorRef.current.getModel().getValueInRange(selection);
    setIsAiLoading(true);

    try {
        const response = await apiService.post('/ai/gemini-action', { action, text: selectedText });
        const newText = response.data.result;

        // Check if context is still valid before adding suggestion
        if (useStore.getState().activeFileId === fileIdAtActionStart) {
            const origRangeObj = rangeToPlain(selection);
            const origEnd = selection.getEndPosition();
            const insertText = '\n' + newText;
            editorRef.current.executeEdits('insert-suggestion', [
              { range: new monaco.Range(origEnd.lineNumber, origEnd.column, origEnd.lineNumber, origEnd.column), text: insertText }
            ]);
            const lines = newText.split('\n');
            const suggStartLine = origEnd.lineNumber + 1;
            const suggStartCol = 1;
            const suggEndLine = origEnd.lineNumber + lines.length;
            const suggEndCol = lines[lines.length -1].length +1;
            const suggRangeObj = { startLineNumber: suggStartLine, startColumn: suggStartCol, endLineNumber: suggEndLine, endColumn: suggEndCol };
            const delRangeObj = { startLineNumber: origEnd.lineNumber, startColumn: origEnd.column, endLineNumber: suggEndLine, endColumn: suggEndCol };
            useStore.getState().addSuggestion({ originalRange: origRangeObj, suggestionRange: suggRangeObj, deleteRange: delRangeObj, text: newText });
        }

        selectionRef.current = null;
        setIsTextSelected(false);
        setCustomPrompt(''); // Clear the prompt

    } catch (error) {
        console.error("AI Action Error:", error);
        // Don't rethrow - let the error be handled here
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
    const fileIdAtActionStart = activeFileId; // Capture file ID
    if (!selection || !editorRef.current || !customPrompt.trim() || !fileIdAtActionStart) return;

    const selectedText = editorRef.current.getModel().getValueInRange(selection);
    setIsAiLoading(true);
    setIsCustomPromptOpen(false);

    try {
        const response = await apiService.post('/ai/gemini-action', {
            action: 'custom',
            text: selectedText,
            customPrompt: customPrompt,
            context: {
                fileName: activeFile.name,
                fileContent: activeFile.content
            }
        });
        const newText = response.data.result;

        // Check if context is still valid before adding suggestion
        if (useStore.getState().activeFileId === fileIdAtActionStart) {
            const origRangeObj = rangeToPlain(selection);
            const origEnd = selection.getEndPosition();
            const insertText = '\n' + newText;
            editorRef.current.executeEdits('insert-suggestion', [
              { range: new monaco.Range(origEnd.lineNumber, origEnd.column, origEnd.lineNumber, origEnd.column), text: insertText }
            ]);
            const lines = newText.split('\n');
            const suggStartLine = origEnd.lineNumber + 1;
            const suggStartCol = 1;
            const suggEndLine = origEnd.lineNumber + lines.length;
            const suggEndCol = lines[lines.length -1].length +1;
            const suggRangeObj = { startLineNumber: suggStartLine, startColumn: suggStartCol, endLineNumber: suggEndLine, endColumn: suggEndCol };
            const delRangeObj = { startLineNumber: origEnd.lineNumber, startColumn: origEnd.column, endLineNumber: suggEndLine, endColumn: suggEndCol };
            useStore.getState().addSuggestion({ originalRange: origRangeObj, suggestionRange: suggRangeObj, deleteRange: delRangeObj, text: newText });
        }

        selectionRef.current = null;
        setIsTextSelected(false);
        setCustomPrompt(''); // Clear the prompt

    } catch (error) {
        console.error("AI Action Error:", error);
        // Don't rethrow - let the error be handled here
    } finally {
        setIsAiLoading(false);
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
    if (!editorRef.current || !monaco) return;

    const editor = editorRef.current;
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
      <style>{suggestionHighlightStyle}</style>
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