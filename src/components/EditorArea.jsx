// src/components/EditorArea.jsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Box, Paper, IconButton, Divider, Tooltip, CircularProgress, Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, Typography, Tabs, Tab } from '@mui/material';
import { 
  FormatBold, FormatItalic, FormatUnderlined, 
  FormatListBulleted, FormatListNumbered, Code, 
  FormatQuote, Redo, Undo, AddComment,
  Close as CloseIcon, MenuBook,
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
    z-index: 10001 !important;
    position: fixed !important;
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
    { label: 'Create Book Structure', icon: <MenuBook />, action: 'create_book_structure' },
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
                disabled={item.action === 'create_book_structure' ? isAiLoading : (!isTextSelected || isAiLoading)}
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
const createInlineControls = (suggestionId, onAccept, onReject, onPreview, suggestionType = 'edit-agent') => {
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
    z-index: 10001 !important;
    position: fixed !important;
  `;
  
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
  
  // Only add preview button for edit-agent suggestions (not for custom AI or full content)
  if (suggestionType === 'edit-agent') {
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
    controlsContainer.appendChild(previewButton);
  }
  
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
  
  // For suggestions without an ID, generate a deterministic one
  const str = JSON.stringify(s);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  const suggestionId = `sugg-${Math.abs(hash)}`;
  
  // Set the ID on the suggestion object if it doesn't exist
  if (!s.id) {
    s.id = suggestionId;
  }
  
  return suggestionId;
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
  const previewFileRef = useRef(null);
  
  // Book structure dialog state
  const [isBookStructureOpen, setIsBookStructureOpen] = useState(false);
  const [bookTitle, setBookTitle] = useState('');
  const [storyGoal, setStoryGoal] = useState('');
  const [numberOfChapters, setNumberOfChapters] = useState(10);
  const bookStructureInputRef = useRef(null);
  
  // Track previous file ID so we can reset processed suggestions when switching away
  const prevFileIdRef = useRef(null);
  
  // Add effect to handle file switching - preserve suggestion state
  useEffect(() => {
    if (activeFileId && activeFileId !== prevFileIdRef.current) {
      console.log(`Switching from file ${prevFileIdRef.current} to ${activeFileId}`);
      
      // Store current suggestion state before switching
      const previousFileId = prevFileIdRef.current;
      if (previousFileId && Object.keys(decorationsRef.current).length > 0) {
        console.log(`Preserving suggestion state for file ${previousFileId}`);
        // The suggestions are already in the store, so we don't need to do anything special
        // The decorationsRef and contentWidgets will be cleared by editor re-mount
        // But they'll be recreated when suggestions are reprocessed
      }
      
      // Don't clear the refs immediately when switching files - let the editor restoration handle this
      // This preserves suggestion highlights when switching between files
      // Only clear processed suggestions ref to allow reprocessing if needed
      processedSuggestionIdsRef.current.clear();
      
      // Close preview if it was open and reset scroll position
      if (isPreviewOpen) {
        setIsPreviewOpen(false);
        setPreviewContent('');
        setPreviewTitle('');
        previewFileRef.current = null;
      }
      
      // Reset scroll position immediately when switching files
      setTimeout(() => {
        const previewContainer = document.querySelector('.preview-scroll-container');
        if (previewContainer) {
          previewContainer.scrollTop = 0;
        }
      }, 50);
      
      prevFileIdRef.current = activeFileId;
    }
  }, [activeFileId, isPreviewOpen]);
  
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

    const handleBookStructureSuggestions = (event) => {
      console.log('Book structure suggestions event received:', event);
      const { detail } = event;
      const suggestionsArr = detail.suggestions;

      if (!Array.isArray(suggestionsArr)) {
        console.error('Book structure suggestions is not an array:', suggestionsArr);
        return;
      }

      // Handle full content suggestions for newly created files
      suggestionsArr.forEach(suggestion => {
        if (suggestion.type === 'full_content') {
          // Create a special suggestion for full file content
          const fullContentSuggestion = {
            id: suggestion.id,
            fileName: suggestion.fileName,
            fileId: suggestion.fileId,
            content: suggestion.content,
            type: 'full_content_suggestion',
            // For empty files, these ranges don't matter as they'll be recalculated
            originalRange: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
            suggestionRange: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
            deleteRange: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
            text: suggestion.content
          };
          
          const { setSuggestionsForFile } = useStore.getState();
          setSuggestionsForFile(suggestion.fileId, [fullContentSuggestion]);
        }
      });
    };

    window.addEventListener('editAgentSuggestions', handleEditAgentSuggestions);
    window.addEventListener('bookStructureSuggestions', handleBookStructureSuggestions);
    return () => {
      window.removeEventListener('editAgentSuggestions', handleEditAgentSuggestions);
      window.removeEventListener('bookStructureSuggestions', handleBookStructureSuggestions);
    };
  }, [monaco]);

  // Once the editor is ready, process any buffered suggestions
  useEffect(() => {
    if (editorReady && pendingEditSuggestions.length > 0) {
      pendingEditSuggestions.forEach(processSuggestion);
      setPendingEditSuggestions([]);
    }
  }, [editorReady, pendingEditSuggestions]);

  // Add comprehensive cleanup function
  const cleanupSuggestion = (suggestionId, force = false) => {
    if (!editorRef.current && !force) return;
    
    const editor = editorRef.current;
    const decorationData = decorationsRef.current[suggestionId];
    
    if (decorationData) {
      // Remove all decorations - try multiple approaches to ensure they're removed
      const idsToRemove = [decorationData.oldDecorationId, decorationData.newDecorationId].filter(Boolean);
      if (idsToRemove.length > 0 && editor) {
        try {
          // Method 1: Direct removal
          editor.deltaDecorations(idsToRemove, []);
          
          // Method 2: Force removal by setting empty decorations
          setTimeout(() => {
            if (editor && editor.getModel()) {
              try {
                editor.deltaDecorations(idsToRemove, []);
              } catch (e) {
                console.warn('Secondary decoration removal failed:', e);
              }
            }
          }, 10);
        } catch (e) {
          console.warn('Error removing decorations:', e);
        }
      }
      
      // Remove widget
      const widget = contentWidgets.current[suggestionId];
      if (widget && editor) {
        try {
          editor.removeContentWidget(widget);
        } catch (e) {
          console.warn('Error removing widget:', e);
        }
      }
      
      // Clean up references immediately
      delete contentWidgets.current[suggestionId];
      delete decorationsRef.current[suggestionId];
    }
    
    // Remove from processed set
    processedSuggestionIdsRef.current.delete(suggestionId);
    
    // Remove from store
    const fileId = useStore.getState().activeFileId;
    if (fileId) {
      useStore.getState().removeSuggestion(fileId, suggestionId);
    }
  };

  // Add function to clean up all suggestions for current file
  const cleanupAllSuggestions = () => {
    if (!editorRef.current) return;
    
    const editor = editorRef.current;
    
    console.log(`Cleaning up ${Object.keys(decorationsRef.current).length} decorations and ${Object.keys(contentWidgets.current).length} widgets`);
    
    // Get all decoration IDs to remove
    const allDecorationIds = Object.values(decorationsRef.current).flatMap(d =>
      [d.oldDecorationId, d.newDecorationId].filter(Boolean)
    );
    
    // Remove all decorations at once
    if (allDecorationIds.length > 0) {
      try {
        editor.deltaDecorations(allDecorationIds, []);
        
        // Force removal with a secondary attempt
        setTimeout(() => {
          if (editor && editor.getModel()) {
            try {
              editor.deltaDecorations(allDecorationIds, []);
            } catch (e) {
              console.warn('Secondary decoration cleanup failed:', e);
            }
          }
        }, 50);
      } catch (e) {
        console.warn('Error removing all decorations:', e);
      }
    }
    
    // Fallback: Try to remove all decorations by getting current decorations
    try {
      const model = editor.getModel();
      if (model) {
        const allCurrentDecorations = model.getAllDecorations();
        const suggestionDecorations = allCurrentDecorations.filter(decoration => 
          decoration.options.className && 
          (decoration.options.className.includes('suggestion-highlight') || 
           decoration.options.className.includes('suggestion-'))
        );
        
        if (suggestionDecorations.length > 0) {
          const decorationIds = suggestionDecorations.map(d => d.id);
          editor.deltaDecorations(decorationIds, []);
        }
      }
    } catch (e) {
      console.warn('Fallback decoration cleanup failed:', e);
    }
    
    // Remove all widgets - be more aggressive
    Object.entries(contentWidgets.current).forEach(([suggestionId, widget]) => {
      if (widget) {
        try {
          console.log(`Removing widget for suggestion: ${suggestionId}`);
          editor.removeContentWidget(widget);
        } catch (e) {
          console.warn(`Error removing widget ${suggestionId}:`, e);
        }
      }
    });
    
    // Additional cleanup: Try to remove any orphaned suggestion widgets by ID pattern
    try {
      // Get all current content widgets and remove any that look like suggestion widgets
      const allWidgets = editor.getContentWidgets();
      allWidgets.forEach(widget => {
        const widgetId = widget.getId();
        if (widgetId && widgetId.includes('suggestion.inline.')) {
          try {
            console.log(`Removing orphaned widget: ${widgetId}`);
            editor.removeContentWidget(widget);
          } catch (e) {
            console.warn(`Error removing orphaned widget ${widgetId}:`, e);
          }
        }
      });
    } catch (e) {
      console.warn('Error in orphaned widget cleanup:', e);
    }
    
    // Clear all references
    decorationsRef.current = {};
    contentWidgets.current = {};
    processedSuggestionIdsRef.current.clear();
    
    console.log('Cleanup completed');
  };

  const processSuggestion = (suggestion) => {
    const suggestionId = getSuggestionId(suggestion);

    // If currently displayed, skip processing
    if (decorationsRef.current[suggestionId]) {
      console.log(`Suggestion ${suggestionId} already displayed, skipping`);
      return;
    }

    if (!editorRef.current || !monaco || !monaco.editor) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) {
      setPendingEditSuggestions((prev) => [...prev, suggestion]);
      return;
    }

    const isEditAgentSuggestion = suggestion.oldContentFull && suggestion.newContentFull;
    const isCustomAISuggestion = suggestion.originalRange && suggestion.suggestionRange && suggestion.text;
    const isFullContentSuggestion = suggestion.type === 'full_content_suggestion' && suggestion.text;

    console.log(`Processing suggestion ${suggestionId} for file ${activeFileId}`);
    
    if (isEditAgentSuggestion) {
      processEditAgentSuggestion(suggestion, suggestionId);
    } else if (isCustomAISuggestion || isFullContentSuggestion) {
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

    // Check if this suggestion is already being displayed
    if (decorationsRef.current[suggestionId]) {
      console.warn(`Suggestion ${suggestionId} already displayed, skipping`);
      return;
    }

    // Check for existing orphaned widgets and remove them
    const expectedWidgetId = `suggestion.inline.${suggestionId}`;
    try {
      const existingWidgets = editor.getContentWidgets();
      const orphanedWidget = existingWidgets.find(w => w.getId() === expectedWidgetId);
      if (orphanedWidget) {
        console.log(`Found orphaned widget ${expectedWidgetId}, removing before creating new one`);
        editor.removeContentWidget(orphanedWidget);
      }
    } catch (e) {
      console.warn('Error checking for orphaned widgets:', e);
    }

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

    // Create inline controls after the old text - edit-agent type shows preview
    const controlsContainer = createInlineControls(
      suggestionId,
      () => handleAcceptEditSuggestion(suggestionId),
      () => handleRejectEditSuggestion(suggestionId),
      () => handlePreviewEditSuggestion(suggestionId),
      'edit-agent'
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

    // Check if this suggestion is already being displayed
    if (decorationsRef.current[suggestionId]) {
      console.warn(`Suggestion ${suggestionId} already displayed, skipping`);
      return;
    }

    // Check for existing orphaned widgets and remove them
    const expectedWidgetId = `suggestion.inline.${suggestionId}`;
    try {
      const existingWidgets = editor.getContentWidgets();
      const orphanedWidget = existingWidgets.find(w => w.getId() === expectedWidgetId);
      if (orphanedWidget) {
        console.log(`Found orphaned widget ${expectedWidgetId}, removing before creating new one`);
        editor.removeContentWidget(orphanedWidget);
      }
    } catch (e) {
      console.warn('Error checking for orphaned widgets:', e);
    }

    const { originalRange, suggestionRange, deleteRange, text } = suggestion;
    const isFullContentSuggestion = suggestion.type === 'full_content_suggestion';

    let actualOriginalRange, actualSuggestionRange, actualDeleteRange;

    if (isFullContentSuggestion) {
      // For full content suggestions (new files), insert the text first
      const currentContent = model.getValue();
      const isEmptyFile = !currentContent || currentContent.trim() === '';
      
      if (isEmptyFile) {
        // Insert the text at the beginning of the empty file
        const insertPosition = new monaco.Range(1, 1, 1, 1);
        editor.executeEdits('insert-suggestion', [{
          range: insertPosition,
          text: text,
          forceMoveMarkers: true,
        }]);
        
        // Calculate the ranges after insertion
        const lines = text.split('\n');
        const endLine = lines.length;
        const endColumn = lines[lines.length - 1].length + 1;
        
        actualOriginalRange = new monaco.Range(1, 1, 1, 1); // Empty range at start
        actualSuggestionRange = new monaco.Range(1, 1, endLine, endColumn); // The inserted text
        actualDeleteRange = new monaco.Range(1, 1, endLine, endColumn); // Range to delete if rejected
      } else {
        // File already has the generated content (e.g., after switching away and back).
        // Highlight the entire file so the user can still accept/reject it.
        const endLine = model.getLineCount();
        const endColumn = model.getLineContent(endLine).length + 1;
        actualOriginalRange = new monaco.Range(1, 1, 1, 1);
        actualSuggestionRange = new monaco.Range(1, 1, endLine, endColumn);
        actualDeleteRange = new monaco.Range(1, 1, endLine, endColumn);
      }
    } else {
      // Regular custom AI suggestion
      actualOriginalRange = plainToRange(originalRange, monaco);
      actualSuggestionRange = plainToRange(suggestionRange, monaco);
      actualDeleteRange = deleteRange ? plainToRange(deleteRange, monaco) : null;
    }
    
    // Create decorations for both old and new text
    const oldDecoration = {
      range: actualOriginalRange,
      options: {
        className: 'suggestion-highlight-old',
        stickiness: monaco.editor.TrackedRangeStickiness?.NeverGrowsWhenTypingAtEdges || 1,
      },
    };
    
    const newDecoration = {
      range: actualSuggestionRange,
      options: {
        className: 'suggestion-highlight-new',
        stickiness: monaco.editor.TrackedRangeStickiness?.NeverGrowsWhenTypingAtEdges || 1,
      },
    };
    
    const [oldDecorationId, newDecorationId] = editor.deltaDecorations([], [oldDecoration, newDecoration]);

    // Create inline controls after the new text - custom-ai type doesn't show preview
    const suggestionType = isFullContentSuggestion ? 'full-content' : 'custom-ai';
    const controlsContainer = createInlineControls(
      suggestionId,
      () => handleAcceptCustomSuggestion(suggestionId),
      () => handleRejectCustomSuggestion(suggestionId),
      () => handlePreviewCustomSuggestion(suggestionId),
      suggestionType
    );

    // Add inline widget positioned after the new text
    const widget = {
      getId: () => `suggestion.inline.${suggestionId}`,
      getDomNode: () => controlsContainer,
      getPosition: () => {
        const model = editor.getModel();
        const lineContent = model.getLineContent(actualSuggestionRange.endLineNumber);
        const maxColumn = lineContent.length;
        
        // Calculate if we're likely to be on the left side vs right side
        const isLeftSide = actualSuggestionRange.endColumn < maxColumn * 0.6;
        
        // Use different positioning strategy based on side
        let safeColumn;
        if (isLeftSide) {
          // For left side, position at the end of the suggestion plus small buffer
          safeColumn = Math.min(actualSuggestionRange.endColumn + 2, maxColumn);
        } else {
          // For right side, position well before the minimap area
          safeColumn = Math.min(actualSuggestionRange.endColumn, Math.max(1, maxColumn - 30));
        }
        
        return {
          position: { lineNumber: actualSuggestionRange.endLineNumber, column: safeColumn },
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
      originalRange: actualOriginalRange,
      suggestionRange: actualSuggestionRange,
      deleteRange: actualDeleteRange,
      text,
      fileId: activeFileId,
      type: suggestionType
    };
    contentWidgets.current[suggestionId] = widget;
  };

  // This effect will process suggestions when they change for the active file
  useEffect(() => {
    if (suggestions.length > 0 && editorRef.current && monaco && activeFile && editorReady) {
      console.log(`Processing ${suggestions.length} suggestions for ${activeFile.name}`);
      
      // Only clean up orphaned widgets, but preserve decorations for file switches
      if (editorRef.current) {
        const editor = editorRef.current;
        try {
          const allWidgets = editor.getContentWidgets();
          const orphanedWidgets = allWidgets.filter(w => 
            w.getId() && w.getId().includes('suggestion.inline.') && 
            !decorationsRef.current[w.getId().replace('suggestion.inline.', '')]
          );
          
          orphanedWidgets.forEach(widget => {
            try {
              console.log(`Removing orphaned widget: ${widget.getId()}`);
              editor.removeContentWidget(widget);
            } catch (e) {
              console.warn('Error removing orphaned widget:', e);
            }
          });
        } catch (e) {
          console.warn('Error checking for orphaned widgets:', e);
        }
      }
      
      // Process suggestions to ensure both decorations and widgets are present
      setTimeout(() => {
        if (editorRef.current && monaco && activeFile) {
          const model = editorRef.current.getModel();
          if (model) {
            console.log('Editor model ready, processing suggestions');
            
            // Check each suggestion and ensure it has both decoration and widget
            suggestions.forEach(suggestion => {
              const suggestionId = getSuggestionId(suggestion);
              const hasDecoration = decorationsRef.current[suggestionId];
              const hasWidget = contentWidgets.current[suggestionId];
              
              console.log(`Suggestion ${suggestionId}: decoration=${!!hasDecoration}, widget=${!!hasWidget}`);
              
              // If missing either decoration or widget, reprocess the suggestion
              if (!hasDecoration || !hasWidget) {
                console.log(`Reprocessing suggestion ${suggestionId} (missing decoration or widget)`);
                processSuggestion(suggestion);
              }
            });
          }
        }
      }, 300);
    } else if (suggestions.length === 0) {
      // If no suggestions, clean up any remaining decorations
      cleanupAllSuggestions();
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
  
  // Process suggestions when they change for the active file
  useEffect(() => {
    if (editorRef.current && monaco && activeFileId && suggestions.length > 0) {
      console.log(`Processing ${suggestions.length} suggestions for file ${activeFileId}`);
      
      // Only process suggestions that haven't been processed yet
      const unprocessedSuggestions = suggestions.filter(suggestion => {
        const suggestionId = getSuggestionId(suggestion);
        return !processedSuggestionIdsRef.current.has(suggestionId);
      });
      
      if (unprocessedSuggestions.length > 0) {
        console.log(`Found ${unprocessedSuggestions.length} unprocessed suggestions`);
        unprocessedSuggestions.forEach(processSuggestion);
      }
    }
  }, [suggestions, activeFileId, monaco]);

  const handleDialogEntered = () => {
    // Focus the input field when the dialog animation completes
    if (customPromptInputRef.current) {
      customPromptInputRef.current.focus();
    }
  };
  // --- End of Auto-saving ---

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    
    // Clear any existing editor-specific references since we have a new editor instance
    // But preserve suggestions in the store - they will be recreated for the new editor
    decorationsRef.current = {};
    contentWidgets.current = {};
    
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

    // When editor is remounted (due to file switch), ensure suggestions are processed
    setTimeout(() => {
      if (suggestions.length > 0 && editorRef.current && monaco && activeFile) {
        console.log(`Processing ${suggestions.length} suggestions after editor mount for ${activeFile.name}`);
        
        // Process suggestions with a delay to ensure editor is fully ready
        setTimeout(() => {
          suggestions.forEach(suggestion => {
            const suggestionId = getSuggestionId(suggestion);
            // Always process since we cleared the refs above for the new editor instance
            console.log(`Recreating suggestion ${suggestionId} after editor mount`);
            processSuggestion(suggestion);
          });
        }, 100);
      }
    }, 200);
  };

  const handleAiAction = async (action) => {
    if (action === 'custom') {
      if (isTextSelected) {
        setIsCustomPromptOpen(true);
      }
      return;
    }

    if (action === 'create_book_structure') {
      setIsBookStructureOpen(true);
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

  const handleBookStructureClose = () => {
    setIsBookStructureOpen(false);
    setBookTitle('');
    setStoryGoal('');
    setNumberOfChapters(10);
    // Restore focus to the editor after the dialog closes
    setTimeout(() => editorRef.current?.focus(), 0);
  };

  const handleBookStructureSubmit = async () => {
    if (!bookTitle.trim() || !storyGoal.trim() || !numberOfChapters) {
      alert('Please fill in all fields');
      return;
    }

    // Guard: Don't send requests if there's no current project
    if (!currentProject || !currentProject.project_id) {
      console.warn('Cannot create book structure: No current project selected');
      return;
    }

    setIsAiLoading(true);
    setIsBookStructureOpen(false);

    try {
      const response = await apiService.post('/ai/gemini-action', {
        action: 'create_book_structure',
        numberOfChapters: parseInt(numberOfChapters),
        bookTitle: bookTitle.trim(),
        storyGoal: storyGoal.trim(),
        projectId: currentProject.project_id
      });

      console.log('Book structure response:', response.data);

      // Handle the response
      if (response.data.createdFiles && response.data.createdFiles.length > 0) {
        // Refresh the project files to show the new files
        const { refreshProjectFiles } = useStore.getState();
        const refreshResult = await refreshProjectFiles();
        
        if (refreshResult.success) {
          // Open the created files
          const { openFile } = useStore.getState();
          
          // Open the first few files
          response.data.createdFiles.slice(0, 5).forEach(file => {
            openFile(file);
          });
        } else {
          console.error('Failed to refresh project files:', refreshResult.error);
        }
      }

      // Handle suggestions from the response
      if (response.data.suggestions) {
        console.log('Processing book structure suggestions:', response.data.suggestions);
        
        // Process different types of suggestions
        const bookStructureSuggestions = response.data.suggestions.filter(s => s.type === 'full_content');
        const fullContentSuggestions = response.data.suggestions.filter(s => s.type === 'full_content_suggestion');
        const editAgentSuggestions = response.data.suggestions.filter(s => s.type === 'edit_agent_suggestion');
        const improvementSuggestions = response.data.suggestions.filter(s => s.type === 'improvement_suggestions');

        // For full content suggestions, directly add them to the editor
        if (bookStructureSuggestions.length > 0) {
          window.dispatchEvent(new CustomEvent('bookStructureSuggestions', {
            detail: { suggestions: bookStructureSuggestions }
          }));
        }

        // For new file content suggestions, dispatch as edit agent suggestions to show inline
        if (fullContentSuggestions.length > 0) {
          console.log('Dispatching inline content suggestions for new files:', fullContentSuggestions.length);
          window.dispatchEvent(new CustomEvent('editAgentSuggestions', {
            detail: { suggestions: fullContentSuggestions }
          }));
        }

        // For edit agent suggestions (existing file improvements), dispatch as edit agent suggestions
        if (editAgentSuggestions.length > 0) {
          console.log('Dispatching edit agent suggestions for existing files:', editAgentSuggestions.length);
          window.dispatchEvent(new CustomEvent('editAgentSuggestions', {
            detail: { suggestions: editAgentSuggestions }
          }));
        }

        // For improvement suggestions, show them as notifications or in a separate panel
        if (improvementSuggestions.length > 0) {
          console.log('Improvement suggestions:', improvementSuggestions);
          // You could add a notification system here
        }
      }

      // Clear the form
      setBookTitle('');
      setStoryGoal('');
      setNumberOfChapters(10);

    } catch (error) {
      console.error('Book Structure Error:', error);
      alert('Failed to create book structure. Please try again.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleBookStructureDialogEntered = () => {
    // Focus the first input field when the dialog animation completes
    if (bookStructureInputRef.current) {
      bookStructureInputRef.current.focus();
    }
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

    // Use comprehensive cleanup with force to ensure decorations are removed
    cleanupSuggestion(suggestionId, true);
    
    // Force a layout refresh to ensure decorations are visually removed
    setTimeout(() => {
      if (editor) {
        editor.layout();
      }
    }, 10);
    
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

    // Use comprehensive cleanup with force to ensure decorations are removed
    cleanupSuggestion(suggestionId, true);
    
    // Force a layout refresh to ensure decorations are visually removed
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    }, 10);
    
    // Auto-save after rejection
    const file = useStore.getState().openFiles.find(f => f.file_id === activeFileId);
    if (file) {
      const newFileContent = editorRef.current.getModel().getValue();
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

    // For full content suggestions, we just need to remove decorations
    // The text is already in the editor and should remain
    if (decorationData.type === 'full-content') {
      // Just clean up decorations and widgets - keep the text as is
    } else {
      // Regular custom AI suggestion - remove the old text, keep the new text
      const currentOldRange = model.getDecorationRange(decorationData.oldDecorationId) || decorationData.originalRange;
      if (currentOldRange) {
        editor.executeEdits('suggestion-accept', [{
          range: currentOldRange,
          text: '',
          forceMoveMarkers: true,
        }]);
      }
    }

    // Use comprehensive cleanup with force
    cleanupSuggestion(suggestionId, true);
    
    // Force a layout refresh to ensure decorations are visually removed
    setTimeout(() => {
      if (editor) {
        editor.layout();
      }
    }, 10);
    
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

    // For full content suggestions, remove all content (leave file empty)
    if (decorationData.type === 'full-content') {
      // Remove all content from the file
      const fullRange = model.getFullModelRange();
      editor.executeEdits('suggestion-reject', [{
        range: fullRange,
        text: '',
        forceMoveMarkers: true,
      }]);
    } else {
      // Regular custom AI suggestion - remove the new text, keep the old text
      if (decorationData.deleteRange) {
        const currentDeleteRange = decorationData.deleteRange;
        editor.executeEdits('suggestion-reject', [{
          range: currentDeleteRange,
          text: '',
          forceMoveMarkers: true,
        }]);
      }
    }

    // Use comprehensive cleanup with force
    cleanupSuggestion(suggestionId, true);
    
    // Force a layout refresh to ensure decorations are visually removed
    setTimeout(() => {
      if (editor) {
        editor.layout();
      }
    }, 10);
    
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
    
    // Reset scroll position for new preview if it's from a different file
    const currentFileId = activeFileId;
    const shouldResetScroll = previewFileRef.current !== currentFileId;
    previewFileRef.current = currentFileId;
    
    // Always reset scroll position when opening a new preview
    setTimeout(() => {
      const previewContainer = document.querySelector('.preview-scroll-container');
      if (previewContainer) {
        previewContainer.scrollTop = 0;
      }
    }, 100);
    
    // Special handling for different positioning scenarios
    if (isTopOfFile || isLeftSide) {
      // More aggressive layout updates for problematic cases
      setTimeout(() => {
        if (editorRef.current) {
          // Preserve editor focus and scrolling state
          const currentScrollTop = editorRef.current.getScrollTop();
          const currentScrollLeft = editorRef.current.getScrollLeft();
          
          editorRef.current.layout();
          
          // Restore scroll position
          editorRef.current.setScrollTop(currentScrollTop);
          editorRef.current.setScrollLeft(currentScrollLeft);
          
          if (isTopOfFile) {
            editorRef.current.revealLine(1); // Ensure top is visible
          }
          
          // Ensure content widgets are still visible
          Object.values(contentWidgets.current).forEach(widget => {
            if (widget && editorRef.current) {
              try {
                editorRef.current.removeContentWidget(widget);
                editorRef.current.addContentWidget(widget);
              } catch (e) {
                // Widget might not exist anymore, ignore
              }
            }
          });
        }
      }, 100);
      
      // Additional layout updates to ensure stability
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
    
    // Reset scroll position for new preview if it's from a different file
    const currentFileId = activeFileId;
    const shouldResetScroll = previewFileRef.current !== currentFileId;
    previewFileRef.current = currentFileId;
    
    // Always reset scroll position when opening a new preview
    setTimeout(() => {
      const previewContainer = document.querySelector('.preview-scroll-container');
      if (previewContainer) {
        previewContainer.scrollTop = 0;
      }
    }, 100);
    
    // Special handling for different positioning scenarios
    if (isTopOfFile || isLeftSide) {
      // More aggressive layout updates for problematic cases
      setTimeout(() => {
        if (editorRef.current) {
          // Preserve editor focus and scrolling state
          const currentScrollTop = editorRef.current.getScrollTop();
          const currentScrollLeft = editorRef.current.getScrollLeft();
          
          editorRef.current.layout();
          
          // Restore scroll position
          editorRef.current.setScrollTop(currentScrollTop);
          editorRef.current.setScrollLeft(currentScrollLeft);
          
          if (isTopOfFile) {
            editorRef.current.revealLine(1); // Ensure top is visible
          }
          
          // Ensure content widgets are still visible
          Object.values(contentWidgets.current).forEach(widget => {
            if (widget && editorRef.current) {
              try {
                editorRef.current.removeContentWidget(widget);
                editorRef.current.addContentWidget(widget);
              } catch (e) {
                // Widget might not exist anymore, ignore
              }
            }
          });
        }
      }, 100);
      
      // Additional layout updates to ensure stability
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
    previewFileRef.current = null; // Reset file ref
    
    // Reset scroll position when closing preview (immediate and delayed)
    const previewContainer = document.querySelector('.preview-scroll-container');
    if (previewContainer) {
      previewContainer.scrollTop = 0;
    }
    
    setTimeout(() => {
      const previewContainer = document.querySelector('.preview-scroll-container');
      if (previewContainer) {
        previewContainer.scrollTop = 0;
      }
    }, 100);
    
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
    
    // Get ALL suggestions that exist in decorationsRef, not just filtered ones
    const activeSuggestionIds = Object.keys(decorationsRef.current);
    console.log(`Found ${activeSuggestionIds.length} active suggestions to accept`);
    console.log('Active suggestion IDs:', activeSuggestionIds);
    
    if (activeSuggestionIds.length === 0) return;
    
    // Process all suggestions immediately without delays to avoid race conditions
    activeSuggestionIds.forEach(suggestionId => {
      const decorationData = decorationsRef.current[suggestionId];
      if (decorationData) {
        // Find the suggestion object to determine type
        const suggestion = fileSuggestions.find(s => getSuggestionId(s) === suggestionId);
        
        if (suggestion) {
          if (suggestion.oldContentFull && suggestion.newContentFull) {
            handleAcceptEditSuggestion(suggestionId);
          } else if (suggestion.originalRange && suggestion.suggestionRange && suggestion.text) {
            handleAcceptCustomSuggestion(suggestionId);
          } else if (suggestion.type === 'full_content_suggestion' && suggestion.text) {
            handleAcceptCustomSuggestion(suggestionId);
          }
        } else {
          // Fallback: just clean up the decoration/widget
          cleanupSuggestion(suggestionId, true);
        }
      }
    });
    
    // Final comprehensive cleanup to ensure everything is removed
    setTimeout(() => {
      cleanupAllSuggestions();
      
      // Auto-save after acceptance
      const file = useStore.getState().openFiles.find(f => f.file_id === activeFileId);
      if (file && editorRef.current) {
        const newFileContent = editorRef.current.getModel().getValue();
        updateFileContent(file.file_id, newFileContent);
        debouncedSave({ ...file, content: newFileContent });
      }
    }, 50);
  };

  const handleRejectAll = () => {
    if (!activeFileId) return;
    
    const fileSuggestions = suggestionsByFile[activeFileId] || [];
    
    // Get ALL suggestions that exist in decorationsRef, not just filtered ones
    const activeSuggestionIds = Object.keys(decorationsRef.current);
    console.log(`Found ${activeSuggestionIds.length} active suggestions to reject`);
    console.log('Active suggestion IDs:', activeSuggestionIds);
    
    if (activeSuggestionIds.length === 0) return;
    
    // Process all suggestions immediately without delays to avoid race conditions
    activeSuggestionIds.forEach(suggestionId => {
      const decorationData = decorationsRef.current[suggestionId];
      if (decorationData) {
        // Find the suggestion object to determine type
        const suggestion = fileSuggestions.find(s => getSuggestionId(s) === suggestionId);
        
        if (suggestion) {
          if (suggestion.oldContentFull && suggestion.newContentFull) {
            // Edit agent suggestion - just clean up, don't modify content
            cleanupSuggestion(suggestionId, true);
          } else if (suggestion.originalRange && suggestion.suggestionRange && suggestion.text) {
            // Custom AI suggestion - remove the added text
            handleRejectCustomSuggestion(suggestionId);
          } else if (suggestion.type === 'full_content_suggestion' && suggestion.text) {
            // Full content suggestion - remove all content
            handleRejectCustomSuggestion(suggestionId);
          }
        } else {
          // Fallback: just clean up the decoration/widget
          cleanupSuggestion(suggestionId, true);
        }
      }
    });
    
    // Final comprehensive cleanup to ensure everything is removed
    setTimeout(() => {
      cleanupAllSuggestions();
      
      // Auto-save after rejection
      const file = useStore.getState().openFiles.find(f => f.file_id === activeFileId);
      if (file && editorRef.current) {
        const newFileContent = editorRef.current.getModel().getValue();
        updateFileContent(file.file_id, newFileContent);
        debouncedSave({ ...file, content: newFileContent });
      }
    }, 50);
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

          {/* Bottom Action Buttons - Only show for edit-agent suggestions with multiple items */}
          {suggestions.length > 1 && suggestions.some(suggestion => suggestion.oldContentFull && suggestion.newContentFull) && (
            <Box sx={{
              position: 'absolute',
              bottom: 20,
              right: isPreviewOpen ? 30 : 20, // Adjust for preview panel
              display: 'flex',
              gap: 1,
              zIndex: 1001, // Higher z-index to appear above widgets
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
                ✓ Accept All ({suggestions.filter(s => s.oldContentFull && s.newContentFull).length})
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
                ✗ Reject All ({suggestions.filter(s => s.oldContentFull && s.newContentFull).length})
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
            <Box 
              className="preview-scroll-container"
              sx={{ 
                flexGrow: 1, 
                p: 2, 
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '12px',
                lineHeight: 1.4,
                color: '#d4d4d4',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 'calc(100vh - 200px)', // Ensure scrolling works
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: '#2d2d2d',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: '#555',
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: '#777',
                },
              }}
            >
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
            label="Enter your instruction (e.g., 'make this paragraph clearer')"
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

      <Dialog open={isBookStructureOpen} onClose={handleBookStructureClose} fullWidth maxWidth="md" TransitionProps={{ onEntered: handleBookStructureDialogEntered }}>
        <DialogTitle>Create Book Structure</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            This will create a complete book structure with prologue, chapters, epilogue, and author bio files. AI will generate starter content for each section.
          </Typography>
          
          <TextField
            inputRef={bookStructureInputRef}
            autoFocus
            margin="dense"
            id="book-title"
            label="Book Title"
            type="text"
            fullWidth
            variant="outlined"
            value={bookTitle}
            onChange={(e) => setBookTitle(e.target.value)}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            id="story-goal"
            label="Story Goal / High-level Description"
            type="text"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={storyGoal}
            onChange={(e) => setStoryGoal(e.target.value)}
            placeholder="e.g., A thrilling adventure about a young wizard discovering their magical powers and saving the world from an ancient evil..."
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            id="number-of-chapters"
            label="Number of Chapters"
            type="number"
            variant="outlined"
            value={numberOfChapters}
            onChange={(e) => setNumberOfChapters(Math.max(1, parseInt(e.target.value) || 1))}
            inputProps={{ min: 1, max: 50 }}
            sx={{ width: '200px' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleBookStructureClose}>Cancel</Button>
          <Button 
            onClick={handleBookStructureSubmit} 
            variant="contained"
            disabled={!bookTitle.trim() || !storyGoal.trim() || isAiLoading}
          >
            {isAiLoading ? 'Creating...' : 'Create Book Structure'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default EditorArea;