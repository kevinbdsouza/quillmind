// src/components/EditorArea.jsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Box, Paper, IconButton, Divider, Tooltip, CircularProgress, Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, Typography, Tabs, Tab } from '@mui/material';
import { 
  FormatBold, FormatItalic, FormatUnderlined, 
  FormatListBulleted, FormatListNumbered, Code, 
  FormatQuote, Redo, Undo, AddComment,
  Close as CloseIcon,
} from '@mui/icons-material';
import Editor, { loader, useMonaco } from '@monaco-editor/react';
import apiService from '../apiService';
import useStore from '../store';
import { updateFile } from '../apiService'; // Import updateFile

const suggestionHighlightStyle = `
  .suggestion-highlight-old {
    background-color: rgba(255, 99, 71, 0.3);
    border-radius: 3px;
    text-decoration: line-through;
    position: relative;
    cursor: pointer;
  }
  .suggestion-highlight-new {
    background-color: rgba(144, 238, 144, 0.3);
    border-radius: 3px;
    position: relative;
    cursor: pointer;
  }
  .suggestion-inline-controls {
    display: flex !important;
    flex-direction: row !important;
    gap: 4px !important;
    margin-left: 4px !important;
    vertical-align: middle !important;
    align-items: center !important;
    background-color: rgba(60, 60, 60, 0.95) !important;
    border-radius: 4px !important;
    padding: 2px 4px !important;
    border: 1px solid #555 !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
    z-index: 10000 !important;
    position: relative !important;
  }
  .suggestion-inline-button {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 20px !important;
    height: 20px !important;
    border-radius: 3px !important;
    border: 1px solid #555 !important;
    cursor: pointer !important;
    font-size: 12px !important;
    font-weight: bold !important;
    transition: all 0.2s ease !important;
    flex-shrink: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .suggestion-accept-button {
    background-color: #4caf50 !important;
    color: white !important;
  }
  .suggestion-accept-button:hover {
    background-color: #45a049 !important;
  }
  .suggestion-reject-button {
    background-color: #f44336 !important;
    color: white !important;
  }
  .suggestion-reject-button:hover {
    background-color: #da190b !important;
  }
  .suggestion-preview-button {
    background-color: #2196f3 !important;
    color: white !important;
  }
  .suggestion-preview-button:hover {
    background-color: #1976d2 !important;
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

// Remove the old SuggestionWidget component and create inline controls
const createInlineControls = (suggestionId, onAccept, onReject, onPreview) => {
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'suggestion-inline-controls';
  
  // Apply styles directly to ensure they take effect
  controlsContainer.style.cssText = `
    display: flex !important;
    flex-direction: row !important;
    gap: 4px !important;
    margin-left: 4px !important;
    vertical-align: middle !important;
    align-items: center !important;
    background-color: rgba(60, 60, 60, 0.95) !important;
    border-radius: 4px !important;
    padding: 2px 4px !important;
    border: 1px solid #555 !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
    z-index: 10000 !important;
    position: fixed !important;
  `;
  
  const previewButton = document.createElement('button');
  previewButton.className = 'suggestion-inline-button suggestion-preview-button';
  previewButton.innerHTML = '👁';
  previewButton.title = 'Preview';
  previewButton.style.cssText = `
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 20px !important;
    height: 20px !important;
    border-radius: 3px !important;
    border: 1px solid #555 !important;
    cursor: pointer !important;
    font-size: 12px !important;
    font-weight: bold !important;
    margin: 0 !important;
    padding: 0 !important;
    background-color: #2196f3 !important;
    color: white !important;
  `;
  previewButton.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onPreview();
  };
  
  const acceptButton = document.createElement('button');
  acceptButton.className = 'suggestion-inline-button suggestion-accept-button';
  acceptButton.innerHTML = '✓';
  acceptButton.title = 'Accept';
  acceptButton.style.cssText = `
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 20px !important;
    height: 20px !important;
    border-radius: 3px !important;
    border: 1px solid #555 !important;
    cursor: pointer !important;
    font-size: 12px !important;
    font-weight: bold !important;
    margin: 0 !important;
    padding: 0 !important;
    background-color: #4caf50 !important;
    color: white !important;
  `;
  acceptButton.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onAccept();
  };
  
  const rejectButton = document.createElement('button');
  rejectButton.className = 'suggestion-inline-button suggestion-reject-button';
  rejectButton.innerHTML = '✗';
  rejectButton.title = 'Reject';
  rejectButton.style.cssText = `
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 20px !important;
    height: 20px !important;
    border-radius: 3px !important;
    border: 1px solid #555 !important;
    cursor: pointer !important;
    font-size: 12px !important;
    font-weight: bold !important;
    margin: 0 !important;
    padding: 0 !important;
    background-color: #f44336 !important;
    color: white !important;
  `;
  rejectButton.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onReject();
  };
  
  controlsContainer.appendChild(previewButton);
  controlsContainer.appendChild(acceptButton);
  controlsContainer.appendChild(rejectButton);
  
  return controlsContainer;
};

// add helper function after imports
const rangeToPlain = (r) => ({
  startLineNumber: r.startLineNumber,
  startColumn: r.startColumn,
  endLineNumber: r.endLineNumber,
  endColumn: r.endColumn,
});
const plainToRange = (pl, monaco)=> new monaco.Range(pl.startLineNumber, pl.startColumn, pl.endLineNumber, pl.endColumn);

// Add deterministic suggestion ID helper after plainToRange
const getSuggestionId = (s) => {
  if (s.id) return String(s.id);
  const str = JSON.stringify(s);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return `sugg-${hash}`;
};

function EditorArea() {
  const editorRef = useRef(null);
  const monaco = useMonaco();
  const { 
    openFiles, 
    activeFileId, 
    closeFile, 
    setActiveFileId, 
    updateFileContent,
    suggestionsByFile,
    currentProject,
  } = useStore((state) => ({
    openFiles: state.openFiles,
    activeFileId: state.activeFileId,
    closeFile: state.closeFile,
    setActiveFileId: state.setActiveFileId,
    updateFileContent: state.updateFileContent,
    suggestionsByFile: state.suggestionsByFile,
    currentProject: state.currentProject,
  }));

  const activeFile = useMemo(() => {
    return openFiles.find(file => file.file_id === activeFileId);
  }, [openFiles, activeFileId]);
  
  const suggestions = useMemo(() => {
    return suggestionsByFile[activeFileId] || [];
  }, [suggestionsByFile, activeFileId]);

  const selectionRef = useRef(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [isCustomPromptOpen, setIsCustomPromptOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const customPromptInputRef = useRef(null);
  const decorationsRef = useRef({});
  const contentWidgets = useRef({});
  const [editorReady, setEditorReady] = useState(false);
  const [pendingEditSuggestions, setPendingEditSuggestions] = useState([]);
  const processedSuggestionIdsRef = useRef(new Set());
  
  // Split preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  
  // Track previous file ID so we can reset processed suggestions when switching away
  const prevFileIdRef = useRef(null);
  
  // Inject CSS styles for suggestions
  useEffect(() => {
    const styleId = 'suggestion-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = suggestionHighlightStyle;
      document.head.appendChild(style);
    }
  }, []);
  
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

  // Listen for edit agent suggestions from ChatPanel
  useEffect(() => {
    const handleEditAgentSuggestions = (event) => {
      console.log('Edit agent suggestions event received:', event);
      const { detail } = event;
      const suggestionsArr = detail.suggestions;
      console.log('Suggestions array:', suggestionsArr);

      if (!Array.isArray(suggestionsArr)) {
        console.error('Suggestions is not an array:', suggestionsArr);
        return;
      }

      // Persist suggestions to the global store grouped by fileId so any editor instance can use them later
      const { setSuggestionsForFile } = useStore.getState();
      const grouped = {};
      suggestionsArr.forEach((s) => {
        const fid = s.fileId ?? s.file_id;
        if (!fid) return;
        if (!grouped[fid]) grouped[fid] = [];
        grouped[fid].push(s);
      });
      Object.entries(grouped).forEach(([fid, suggs]) => {
        setSuggestionsForFile(parseInt(fid, 10), suggs);
      });

      // If the editor for the currently active file is ready, handle those suggestions immediately; otherwise buffer them
      const currentFileId = useStore.getState().activeFileId;
      const immediate = suggestionsArr.filter((s) => (s.fileId ?? s.file_id) === currentFileId);

      if (!editorRef.current || !monaco) {
        // Buffer for later processing
        setPendingEditSuggestions((prev) => [...prev, ...immediate]);
        return;
      }

      immediate.forEach(processSuggestion);
    };

    window.addEventListener('editAgentSuggestions', handleEditAgentSuggestions);
    return () => window.removeEventListener('editAgentSuggestions', handleEditAgentSuggestions);
  }, [monaco]);

  // Once the editor is ready, process any buffered suggestions
  useEffect(() => {
    if (editorReady && pendingEditSuggestions.length > 0) {
      pendingEditSuggestions.forEach(processSuggestion);
      setPendingEditSuggestions([]);
    }
  }, [editorReady, pendingEditSuggestions]);

  const processSuggestion = (suggestion) => {
    const suggestionId = getSuggestionId(suggestion);

    // If currently displayed or already processed, skip
    if (decorationsRef.current[suggestionId] || processedSuggestionIdsRef.current.has(suggestionId)) return;

    if (!editorRef.current || !monaco || !monaco.editor) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) {
      setPendingEditSuggestions((prev) => [...prev, suggestion]);
      return;
    }

    const isEditAgentSuggestion = suggestion.oldContentFull && suggestion.newContentFull;
    const isCustomAISuggestion = suggestion.originalRange && suggestion.suggestionRange && suggestion.text;

    if (isEditAgentSuggestion) {
      processEditAgentSuggestion(suggestion, suggestionId);
    } else if (isCustomAISuggestion) {
      processCustomAISuggestion(suggestion, suggestionId);
    }
    
    // Mark as processed
    processedSuggestionIdsRef.current.add(suggestionId);
  };

  const processEditAgentSuggestion = (suggestion, suggestionId) => {
    if (!editorRef.current || !monaco || !monaco.editor) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const { oldContentFull, newContentFull, occurrenceIndex = 0, fileName } = suggestion;

    const matches = model.findMatches(oldContentFull, false, false, false, null, false);
    if (!matches.length || !matches[occurrenceIndex]) {
      console.warn(`Match not found for suggestion in ${fileName}`);
      return;
    }

    const oldRange = matches[occurrenceIndex].range;
    
    // Don't insert text immediately - only show decorations
    // The new text will be inserted only when the user accepts the suggestion
    
    // Create decorations for old (strikethrough) text only
    const oldDecoration = { 
      range: oldRange, 
      options: { 
        className: 'suggestion-highlight-old', 
        stickiness: monaco.editor.TrackedRangeStickiness?.NeverGrowsWhenTypingAtEdges || 1 
      } 
    };

    const [oldDecorationId] = editor.deltaDecorations([], [oldDecoration]);

    // Create inline controls after the old text
    const controlsContainer = createInlineControls(
      suggestionId,
      () => handleAcceptEditSuggestion(suggestionId),
      () => handleRejectEditSuggestion(suggestionId),
      () => handlePreviewEditSuggestion(suggestionId)
    );

    // Add inline widget positioned after the old text
    const widget = {
      getId: () => `suggestion.inline.${suggestionId}`,
      getDomNode: () => controlsContainer,
      getPosition: () => {
        const model = editor.getModel();
        const lineContent = model.getLineContent(oldRange.endLineNumber);
        const maxColumn = lineContent.length;
        
        // Calculate if we're likely to be on the left side vs right side
        const isLeftSide = oldRange.endColumn < maxColumn * 0.6;
        
        // Use different positioning strategy based on side
        let safeColumn;
        if (isLeftSide) {
          // For left side, position at the end of the suggestion plus small buffer
          safeColumn = Math.min(oldRange.endColumn + 2, maxColumn);
        } else {
          // For right side, position well before the minimap area
          safeColumn = Math.min(oldRange.endColumn, Math.max(1, maxColumn - 30));
        }
        
        return {
          position: { lineNumber: oldRange.endLineNumber, column: safeColumn },
          preference: [
            monaco.editor.ContentWidgetPositioningPreference?.BELOW ?? 2,
            monaco.editor.ContentWidgetPositioningPreference?.ABOVE ?? 1
          ],
        };
      },
    };
    
    editor.addContentWidget(widget);
    
    // Store references for cleanup
    decorationsRef.current[suggestionId] = {
      oldDecorationId,
      oldRange,
      newContent: newContentFull,
      fileId: activeFileId,
      type: 'edit-agent'
    };
    contentWidgets.current[suggestionId] = widget;
  };

  const processCustomAISuggestion = (suggestion, suggestionId) => {
    if (!editorRef.current || !monaco || !monaco.editor) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const { originalRange, suggestionRange, deleteRange, text } = suggestion;

    // Convert plain range objects to Monaco Range objects
    const originalMonacoRange = plainToRange(originalRange, monaco);
    const suggestionMonacoRange = plainToRange(suggestionRange, monaco);
    
    // Create decorations for both old and new text
    const oldDecoration = {
      range: originalMonacoRange,
      options: {
        className: 'suggestion-highlight-old',
        stickiness: monaco.editor.TrackedRangeStickiness?.NeverGrowsWhenTypingAtEdges || 1,
      },
    };
    
    const newDecoration = {
      range: suggestionMonacoRange,
      options: {
        className: 'suggestion-highlight-new',
        stickiness: monaco.editor.TrackedRangeStickiness?.NeverGrowsWhenTypingAtEdges || 1,
      },
    };
    
    const [oldDecorationId, newDecorationId] = editor.deltaDecorations([], [oldDecoration, newDecoration]);

    // Create inline controls after the new text
    const controlsContainer = createInlineControls(
      suggestionId,
      () => handleAcceptCustomSuggestion(suggestionId),
      () => handleRejectCustomSuggestion(suggestionId),
      () => handlePreviewCustomSuggestion(suggestionId)
    );

    // Add inline widget positioned after the new text
    const widget = {
      getId: () => `suggestion.inline.${suggestionId}`,
      getDomNode: () => controlsContainer,
      getPosition: () => {
        const model = editor.getModel();
        const lineContent = model.getLineContent(suggestionMonacoRange.endLineNumber);
        const maxColumn = lineContent.length;
        
        // Calculate if we're likely to be on the left side vs right side
        const isLeftSide = suggestionMonacoRange.endColumn < maxColumn * 0.6;
        
        // Use different positioning strategy based on side
        let safeColumn;
        if (isLeftSide) {
          // For left side, position at the end of the suggestion plus small buffer
          safeColumn = Math.min(suggestionMonacoRange.endColumn + 2, maxColumn);
        } else {
          // For right side, position well before the minimap area
          safeColumn = Math.min(suggestionMonacoRange.endColumn, Math.max(1, maxColumn - 30));
        }
        
        return {
          position: { lineNumber: suggestionMonacoRange.endLineNumber, column: safeColumn },
          preference: [
            monaco.editor.ContentWidgetPositioningPreference?.BELOW ?? 2,
            monaco.editor.ContentWidgetPositioningPreference?.ABOVE ?? 1
          ],
        };
      },
    };
    
    editor.addContentWidget(widget);
    
    // Store references for cleanup
    decorationsRef.current[suggestionId] = {
      oldDecorationId,
      newDecorationId,
      originalRange,
      suggestionRange,
      deleteRange,
      text,
      fileId: activeFileId,
      type: 'custom-ai'
    };
    contentWidgets.current[suggestionId] = widget;
  };

  useEffect(() => {
    const previousFileId = prevFileIdRef.current;

    // When active file changes, only clear decorations and widgets for the current editor
    // Don't remove suggestions from store - they should persist
    if (editorRef.current && previousFileId !== activeFileId) {
      // Clear existing decorations and widgets from the previous file
      const allDecs = Object.values(decorationsRef.current).flatMap(d =>
        [d.oldDecorationId, d.newDecorationId].filter(Boolean)
      );
      if (allDecs.length > 0) {
        editorRef.current.deltaDecorations(allDecs, []);
      }
      Object.values(contentWidgets.current).forEach(w => {
        if (w && editorRef.current) {
          editorRef.current.removeContentWidget(w);
        }
      });
    }

    // Reset in-editor references for the new file
    decorationsRef.current = {};
    contentWidgets.current = {};
    processedSuggestionIdsRef.current.clear();

    // Update previous file tracker
    prevFileIdRef.current = activeFileId;
  }, [activeFileId]);

  // This effect will process suggestions when they change for the active file
  useEffect(() => {
    if (suggestions.length > 0 && editorRef.current && monaco && activeFile) {
      console.log(`Processing ${suggestions.length} suggestions for ${activeFile.name}`);
      // Small delay to ensure the editor is fully ready after file switch
      setTimeout(() => {
        suggestions.forEach(processSuggestion);
      }, 100);
    }
  }, [suggestions, monaco, activeFile?.file_id, editorReady]);

  // Handle preview panel layout updates
  useEffect(() => {
    if (editorRef.current) {
      // Small delay to allow CSS transition to start
      const timeoutId = setTimeout(() => {
        editorRef.current.layout();
      }, 50);
      
      // Additional layout update after transition completes
      const layoutTimeoutId = setTimeout(() => {
        editorRef.current.layout();
      }, 350);
      
      return () => {
        clearTimeout(timeoutId);
        clearTimeout(layoutTimeoutId);
      };
    }
  }, [isPreviewOpen]);

  // Handle window resize and ensure editor layout stays correct
  useEffect(() => {
    const handleResize = () => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && editorRef.current) {
        editorRef.current.layout();
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Force layout refresh when suggestions change (in case layout gets stuck)
  useEffect(() => {
    if (editorRef.current && suggestions.length >= 0) {
      const refreshTimeout = setTimeout(() => {
        editorRef.current.layout();
      }, 100);
      
      return () => clearTimeout(refreshTimeout);
    }
  }, [suggestions.length]);

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

    // Add a listener for selection changes
    editor.onDidChangeCursorSelection(e => {
      const selection = e.selection;
      const model = editor.getModel();
      if (model) {
        const selectedText = model.getValueInRange(selection);
        setIsTextSelected(selectedText.length > 0);
        selectionRef.current = selection;
      }
    });

    // Restore focus to the editor after custom prompt is closed
    editor.onDidFocusEditorWidget(() => {
        if(isCustomPromptOpen) {
            // Do not steal focus if dialog is open
          }
    });

    // Note: Suggestions are processed in the useEffect when they change, not here
    // This prevents duplicate processing
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
    
    // Guard: Don't send requests if there's no current project
    if (!currentProject || !currentProject.project_id) {
      console.warn('Cannot perform AI action: No current project selected');
      return;
    }
    
    const selectedText = editorRef.current.getModel().getValueInRange(selection);
    setIsAiLoading(true);

    try {
        const response = await apiService.post('/ai/gemini-action', { 
          action, 
          text: selectedText,
          projectId: currentProject.project_id 
        });
        const newText = response.data.result;

        // Check if context is still valid before adding suggestion
        if (useStore.getState().activeFileId === fileIdAtActionStart) {
            const origRangeObj = rangeToPlain(selection);
            const origEnd = selection.getEndPosition();
            // Insert new text directly at the end position without extra spacing
            editorRef.current.executeEdits('insert-suggestion', [
              { range: new monaco.Range(origEnd.lineNumber, origEnd.column, origEnd.lineNumber, origEnd.column), text: newText }
            ]);
            const lines = newText.split('\n');
            const suggStartLine = origEnd.lineNumber;
            const suggStartCol = origEnd.column;
            const suggEndLine = origEnd.lineNumber + lines.length - 1;
            const suggEndCol = lines.length === 1 
              ? origEnd.column + newText.length 
              : lines[lines.length - 1].length + 1;
            const suggRangeObj = { startLineNumber: suggStartLine, startColumn: suggStartCol, endLineNumber: suggEndLine, endColumn: suggEndCol };
            const delRangeObj = { startLineNumber: origEnd.lineNumber, startColumn: origEnd.column, endLineNumber: suggEndLine, endColumn: suggEndCol };
            useStore.getState().addSuggestion(fileIdAtActionStart, { originalRange: origRangeObj, suggestionRange: suggRangeObj, deleteRange: delRangeObj, text: newText });
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

    // Guard: Don't send requests if there's no current project
    if (!currentProject || !currentProject.project_id) {
      console.warn('Cannot perform custom AI action: No current project selected');
      return;
    }

    const selectedText = editorRef.current.getModel().getValueInRange(selection);
    setIsAiLoading(true);
    setIsCustomPromptOpen(false);

    try {
        const response = await apiService.post('/ai/gemini-action', { 
            action: 'custom', 
            prompt: customPrompt,
            text: selectedText,
            projectId: currentProject.project_id
        });
        const newText = response.data.result;
        
        // Check if context is still valid before adding suggestion
        if (useStore.getState().activeFileId === fileIdAtActionStart) {
            const origRangeObj = rangeToPlain(selection);
            const origEnd = selection.getEndPosition();
            // Insert new text directly at the end position without extra spacing
            editorRef.current.executeEdits('insert-suggestion', [
              { range: new monaco.Range(origEnd.lineNumber, origEnd.column, origEnd.lineNumber, origEnd.column), text: newText }
            ]);
            const lines = newText.split('\n');
            const suggStartLine = origEnd.lineNumber;
            const suggStartCol = origEnd.column;
            const suggEndLine = origEnd.lineNumber + lines.length - 1;
            const suggEndCol = lines.length === 1 
              ? origEnd.column + newText.length 
              : lines[lines.length - 1].length + 1;
            const suggRangeObj = { startLineNumber: suggStartLine, startColumn: suggStartCol, endLineNumber: suggEndLine, endColumn: suggEndCol };
            const delRangeObj = { startLineNumber: origEnd.lineNumber, startColumn: origEnd.column, endLineNumber: suggEndLine, endColumn: suggEndCol };
            useStore.getState().addSuggestion(fileIdAtActionStart, { originalRange: origRangeObj, suggestionRange: suggRangeObj, deleteRange: delRangeObj, text: newText });
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
    // Immediately update the store's version of the file content
    if (activeFile) {
      updateFileContent(activeFile.file_id, value);

        // Debounce the save operation to the backend
        debouncedSave({ file_id: activeFile.file_id, content: value });
      
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
        let formatPatterns = {
          'bold': { start: '**', end: '**' },
          'italic': { start: '*', end: '*' },
          'underline': { start: '<u>', end: '</u>' },
          'code': { start: '`', end: '`' }
        };

        const pattern = formatPatterns[action];
        const startPattern = pattern.start;
        const endPattern = pattern.end;

        // Check if text is already formatted
        if (selectedText.startsWith(startPattern) && selectedText.endsWith(endPattern)) {
          // Remove formatting (toggle off)
          newText = selectedText.slice(startPattern.length, -endPattern.length);
        } else {
          // Apply formatting (toggle on)
          newText = `${startPattern}${selectedText}${endPattern}`;
        }
        
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
    const extension = filename.split('.').pop();
    switch (extension) {
      case 'js':
        return 'javascript';
      case 'jsx':
        return 'javascript'; // Or 'typescript' if you use TSX with TS checking
      case 'ts':
        return 'typescript';
      case 'tsx':
        return 'typescript';
      case 'css':
        return 'css';
      case 'html':
        return 'html';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      case 'py':
          return 'python';
      case 'sql':
        return 'sql';
      case 'sh':
        return 'shell';
      case 'yml':
      case 'yaml':
        return 'yaml';
      default:
        return 'plaintext';
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveFileId(newValue);
  };

  const handleCloseTab = (event, fileId) => {
    event.stopPropagation(); // Prevent tab selection change
    closeFile(fileId);
  };

  const getFileIcon = (filename) => {
    // simple icon logic based on extension
    const extension = filename.split('.').pop();
    if (['js', 'jsx'].includes(extension)) return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg';
    if (['ts', 'tsx'].includes(extension)) return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg';
    if (extension === 'css') return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg';
    if (extension === 'html') return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg';
    if (extension === 'json') return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/devicon/devicon-original.svg';
    if (extension === 'md') return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/markdown/markdown-original.svg';
    return 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/file/file-original.svg';
  };
  
  if (!activeFile) {
      return (
      <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography>Select a file to start editing or create a new one.</Typography>
          </Box>
    );
  }

  // Handler functions for edit agent suggestions
  const handleAcceptEditSuggestion = async (suggestionId) => {
    if (!editorRef.current || !monaco) return;
    
    const editor = editorRef.current;
    const decorationData = decorationsRef.current[suggestionId];
    if (!decorationData) return;

    // Replace the old text with the new text
    const currentOldRange = editor.getModel().getDecorationRange(decorationData.oldDecorationId) || decorationData.oldRange;
    if (currentOldRange) {
      editor.executeEdits('suggestion-accept', [{
        range: currentOldRange,
        text: decorationData.newContent,
        forceMoveMarkers: true,
      }]);
    }

    // Clean up decorations and widget
    const idsToRemove = [decorationData.oldDecorationId].filter(Boolean);
    if (idsToRemove.length) {
      editor.deltaDecorations(idsToRemove, []);
    }
    
    // Clean up widget
    const widget = contentWidgets.current[suggestionId];
    if (widget && editor) {
      editor.removeContentWidget(widget);
      delete contentWidgets.current[suggestionId];
    }
    
    delete decorationsRef.current[suggestionId];

    // Remove from store
    const fileId = decorationData.fileId || useStore.getState().activeFileId;
    if (fileId) {
      useStore.getState().removeSuggestion(fileId, suggestionId);
    }
    
    // Auto-save after acceptance
    const file = useStore.getState().openFiles.find(f => f.file_id === activeFileId);
    if (file) {
      const newFileContent = editor.getModel().getValue();
      updateFileContent(file.file_id, newFileContent);
      debouncedSave({ ...file, content: newFileContent });
    }
  };

  const handleRejectEditSuggestion = (suggestionId) => {
    if (!editorRef.current) return;
    
    const editor = editorRef.current;
    const decorationData = decorationsRef.current[suggestionId];
    if (!decorationData) return;

    // Just remove the decoration and widget - keep the original text as is
    const idsToRemove = [decorationData.oldDecorationId].filter(Boolean);
    if (idsToRemove.length) {
      editor.deltaDecorations(idsToRemove, []);
    }
    
    // Clean up widget
    const widget = contentWidgets.current[suggestionId];
    if (widget && editor) {
      editor.removeContentWidget(widget);
      delete contentWidgets.current[suggestionId];
    }
    
    delete decorationsRef.current[suggestionId];

    // Remove from store
    const fileId = decorationData.fileId || useStore.getState().activeFileId;
    if (fileId) {
      useStore.getState().removeSuggestion(fileId, suggestionId);
    }
    
    // Auto-save after rejection
    const file = useStore.getState().openFiles.find(f => f.file_id === activeFileId);
    if (file) {
      const newFileContent = editor.getModel().getValue();
      updateFileContent(file.file_id, newFileContent);
      debouncedSave({ ...file, content: newFileContent });
    }
  };

  // Handler functions for custom AI suggestions
  const handleAcceptCustomSuggestion = async (suggestionId) => {
    if (!editorRef.current || !monaco) return;
    
    const editor = editorRef.current;
    const model = editor.getModel();
    const decorationData = decorationsRef.current[suggestionId];
    if (!decorationData) return;

    // Remove the old text, keep the new text
    const currentOldRange = model.getDecorationRange(decorationData.oldDecorationId) || plainToRange(decorationData.originalRange, monaco);
    if (currentOldRange) {
      editor.executeEdits('suggestion-accept', [{
        range: currentOldRange,
        text: '',
        forceMoveMarkers: true,
      }]);
    }

    // Clean up decorations and widget
    const idsToRemove = [decorationData.oldDecorationId, decorationData.newDecorationId].filter(Boolean);
    if (idsToRemove.length) {
      editor.deltaDecorations(idsToRemove, []);
    }
    
    // Clean up widget
    const widget = contentWidgets.current[suggestionId];
    if (widget && editor) {
      editor.removeContentWidget(widget);
      delete contentWidgets.current[suggestionId];
    }
    
    delete decorationsRef.current[suggestionId];

    // Remove from store
    const fileId = decorationData.fileId || useStore.getState().activeFileId;
    if (fileId) {
      useStore.getState().removeSuggestion(fileId, suggestionId);
    }
    
    // Auto-save after acceptance
    const file = useStore.getState().openFiles.find(f => f.file_id === activeFileId);
    if (file) {
      const newFileContent = model.getValue();
      updateFileContent(file.file_id, newFileContent);
      debouncedSave({ ...file, content: newFileContent });
    }
  };

  const handleRejectCustomSuggestion = (suggestionId) => {
    if (!editorRef.current) return;
    
    const editor = editorRef.current;
    const model = editor.getModel();
    const decorationData = decorationsRef.current[suggestionId];
    if (!decorationData) return;

    // Remove the new text, keep the old text
    if (decorationData.deleteRange) {
      const currentDeleteRange = plainToRange(decorationData.deleteRange, monaco);
      editor.executeEdits('suggestion-reject', [{
        range: currentDeleteRange,
        text: '',
        forceMoveMarkers: true,
      }]);
    }

    // Clean up decorations and widget
    const idsToRemove = [decorationData.oldDecorationId, decorationData.newDecorationId].filter(Boolean);
    if (idsToRemove.length) {
      editor.deltaDecorations(idsToRemove, []);
    }
    
    // Clean up widget
    const widget = contentWidgets.current[suggestionId];
    if (widget && editor) {
      editor.removeContentWidget(widget);
      delete contentWidgets.current[suggestionId];
    }
    
    delete decorationsRef.current[suggestionId];

    // Remove from store
    const fileId = decorationData.fileId || useStore.getState().activeFileId;
    if (fileId) {
      useStore.getState().removeSuggestion(fileId, suggestionId);
    }
    
    // Auto-save after rejection
    const file = useStore.getState().openFiles.find(f => f.file_id === activeFileId);
    if (file) {
      const newFileContent = model.getValue();
      updateFileContent(file.file_id, newFileContent);
      debouncedSave({ ...file, content: newFileContent });
    }
  };

  const handlePreviewEditSuggestion = (suggestionId) => {
    const decorationData = decorationsRef.current[suggestionId];
    if (!decorationData) return;
    
    const isTopOfFile = decorationData.oldRange.startLineNumber <= 3; // Top 3 lines
    
    // Check if widget is on the left side of the editor
    const model = editorRef.current?.getModel();
    const lineContent = model?.getLineContent(decorationData.oldRange.endLineNumber) || '';
    const maxColumn = lineContent.length;
    const isLeftSide = decorationData.oldRange.endColumn < maxColumn * 0.6;
    
    setPreviewContent(decorationData.newContent);
    setPreviewTitle('Edit Agent Suggestion');
    setIsPreviewOpen(true);
    
    // Special handling for different positioning scenarios
    if (isTopOfFile || isLeftSide) {
      // More aggressive layout updates for problematic cases
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.layout();
          if (isTopOfFile) {
            editorRef.current.revealLine(1); // Ensure top is visible
          }
          // Force a re-render of content widgets
          editorRef.current.updateOptions({});
        }
      }, 100);
      
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.layout();
        }
      }, 400);
      
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.layout();
        }
      }, 700);
    } else {
      // Normal layout update for other cases
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.layout();
        }
      }, 350);
    }
  };

  const handlePreviewCustomSuggestion = (suggestionId) => {
    const decorationData = decorationsRef.current[suggestionId];
    if (!decorationData) return;
    
    const isTopOfFile = decorationData.originalRange.startLineNumber <= 3; // Top 3 lines
    
    // Check if widget is on the left side of the editor
    const model = editorRef.current?.getModel();
    const lineContent = model?.getLineContent(decorationData.originalRange.endLineNumber) || '';
    const maxColumn = lineContent.length;
    const isLeftSide = decorationData.originalRange.endColumn < maxColumn * 0.6;
    
    setPreviewContent(decorationData.text);
    setPreviewTitle('Custom AI Suggestion');
    setIsPreviewOpen(true);
    
    // Special handling for different positioning scenarios
    if (isTopOfFile || isLeftSide) {
      // More aggressive layout updates for problematic cases
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.layout();
          if (isTopOfFile) {
            editorRef.current.revealLine(1); // Ensure top is visible
          }
          // Force a re-render of content widgets
          editorRef.current.updateOptions({});
        }
      }, 100);
      
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.layout();
        }
      }, 400);
      
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.layout();
        }
      }, 700);
    } else {
      // Normal layout update for other cases
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.layout();
        }
      }, 350);
    }
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    setPreviewContent('');
    setPreviewTitle('');
    
    // Trigger Monaco editor layout update after preview closes
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    }, 350); // Wait for transition to complete
  };

  const handleAcceptAll = () => {
    if (!activeFileId) return;
    
    const fileSuggestions = suggestionsByFile[activeFileId] || [];
    const activeSuggestions = fileSuggestions.filter(suggestion => {
      const suggestionId = getSuggestionId(suggestion);
      return decorationsRef.current[suggestionId];
    });
    
    // Process suggestions one by one with a small delay to avoid conflicts
    activeSuggestions.forEach((suggestion, index) => {
      setTimeout(() => {
        const suggestionId = getSuggestionId(suggestion);
        if (decorationsRef.current[suggestionId]) {
          if (suggestion.oldContentFull && suggestion.newContentFull) {
            handleAcceptEditSuggestion(suggestionId);
          } else if (suggestion.originalRange && suggestion.suggestionRange && suggestion.text) {
            handleAcceptCustomSuggestion(suggestionId);
          }
        }
      }, index * 50); // 50ms delay between each
    });
  };

  const handleRejectAll = () => {
    if (!activeFileId) return;
    
    const fileSuggestions = suggestionsByFile[activeFileId] || [];
    const activeSuggestions = fileSuggestions.filter(suggestion => {
      const suggestionId = getSuggestionId(suggestion);
      return decorationsRef.current[suggestionId];
    });
    
    // Process suggestions one by one with a small delay to avoid conflicts
    activeSuggestions.forEach((suggestion, index) => {
      setTimeout(() => {
        const suggestionId = getSuggestionId(suggestion);
        if (decorationsRef.current[suggestionId]) {
          if (suggestion.oldContentFull && suggestion.newContentFull) {
            handleRejectEditSuggestion(suggestionId);
          } else if (suggestion.originalRange && suggestion.suggestionRange && suggestion.text) {
            handleRejectCustomSuggestion(suggestionId);
          }
        }
      }, index * 50); // 50ms delay between each
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 1, bgcolor: 'background.default' }}>
      <EditorToolbar
        onAction={handleToolbarAction}
        onAiAction={handleAiAction}
        isTextSelected={isTextSelected}
        isAiLoading={isAiLoading}
      />
        <Tabs
          value={activeFileId}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
        aria-label="open files tabs"
        sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
        >
          {openFiles.map((file) => (
            <Tab
              key={file.file_id}
              value={file.file_id}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <img src={getFileIcon(file.name)} alt="" style={{ width: 16, height: 16, marginRight: 8 }}/>
                <Typography variant="body2" sx={{ textTransform: 'none' }}>{file.name}</Typography>
                 <Box
                  component="span"
                    onClick={(e) => handleCloseTab(e, file.file_id)}
                  sx={{ 
                    ml: 1.5, 
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)'
                    }
                  }}
                  >
                    <CloseIcon fontSize="small" />
                </Box>
                </Box>
              }
            />
          ))}
        </Tabs>
      <Box sx={{ flexGrow: 1, position: 'relative', display: 'flex' }}>
        {/* Main Editor */}
        <Box sx={{ 
          flexGrow: 1, 
          width: isPreviewOpen ? '70%' : '100%', 
          position: 'relative',
          transition: 'width 0.3s ease'
        }}>
          <Editor
            key={activeFileId} // Force re-mount when file changes
            theme="vs-dark"
            onMount={handleEditorDidMount}
            language={getLanguage(activeFile.name)}
            defaultValue={activeFile.content}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: true },
              wordWrap: 'on',
              fontSize: 14,
              lineNumbers: 'on',
              roundedSelection: false,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              scrollbar: {
                vertical: 'visible',
                horizontal: 'visible',
                alwaysConsumeMouseWheel: false,
              },
              overviewRulerLanes: 3,
              hideCursorInOverviewRuler: false,
              renderLineHighlight: 'line',
              smoothScrolling: true,
            }}
          />
          {isSaving && (
            <CircularProgress 
              size={20}
              sx={{
                position: 'absolute',
                top: 10,
                right: 30,
                color: 'text.secondary'
              }} 
            />
          )}

          {/* Bottom Action Buttons */}
          {suggestions.length > 0 && (
            <Box sx={{
              position: 'absolute',
              bottom: 20,
              right: isPreviewOpen ? 30 : 20, // Adjust for preview panel
              display: 'flex',
              gap: 1,
              zIndex: 1000,
              background: 'rgba(30, 30, 30, 0.9)',
              borderRadius: 1,
              p: 1,
              border: '1px solid #444',
              transition: 'right 0.3s ease', // Smooth transition when preview opens/closes
            }}>
              <Button
                variant="contained"
                size="small"
                onClick={handleAcceptAll}
                sx={{
                  bgcolor: '#4caf50',
                  color: 'white',
                  fontSize: '11px',
                  minWidth: 'auto',
                  px: 2,
                  py: 0.5,
                  '&:hover': {
                    bgcolor: '#45a049'
                  }
                }}
              >
                ✓ Accept All ({suggestions.length})
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleRejectAll}
                sx={{
                  bgcolor: '#f44336',
                  color: 'white',
                  fontSize: '11px',
                  minWidth: 'auto',
                  px: 2,
                  py: 0.5,
                  '&:hover': {
                    bgcolor: '#da190b'
                  }
                }}
              >
                ✗ Reject All ({suggestions.length})
              </Button>
            </Box>
          )}
        </Box>

        {/* Preview Split */}
        {isPreviewOpen && (
          <Box sx={{ 
            width: '30%', 
            borderLeft: '1px solid #444',
            bgcolor: '#1e1e1e',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 0.3s ease'
          }}>
            {/* Preview Header */}
            <Box sx={{ 
              p: 1, 
              borderBottom: '1px solid #444',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              bgcolor: '#2d2d2d'
            }}>
              <Typography variant="subtitle2" sx={{ color: '#fff', fontSize: '12px' }}>
                {previewTitle}
              </Typography>
              <IconButton 
                size="small" 
                onClick={handleClosePreview}
                sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            
            {/* Preview Content */}
            <Box sx={{ 
              flexGrow: 1, 
              p: 2, 
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: '12px',
              lineHeight: 1.4,
              color: '#d4d4d4',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {previewContent}
            </Box>
          </Box>
        )}
      </Box>
      <Dialog open={isCustomPromptOpen} onClose={handleCustomPromptClose} fullWidth maxWidth="sm" TransitionProps={{ onEntered: handleDialogEntered }}>
        <DialogTitle>Custom AI Action</DialogTitle>
        <DialogContent>
          <TextField
            inputRef={customPromptInputRef}
            autoFocus
            margin="dense"
            id="custom-prompt"
            label="Enter your instruction (e.g., 'refactor this function to be more efficient')"
            type="text"
            fullWidth
            variant="outlined"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleCustomPromptSubmit();
              }
            }}
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