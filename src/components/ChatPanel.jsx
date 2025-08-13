// src/components/ChatPanel.js
import React, { useState, useRef, useEffect } from 'react';
import { Box, Paper, Avatar, IconButton, Snackbar, Alert, Divider, Tooltip, Select, MenuItem, Chip, OutlinedInput } from '@mui/material';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AddIcon from '@mui/icons-material/Add';
import ChatIcon from '@mui/icons-material/Chat';
import ReactMarkdown from 'react-markdown';
import useStore from '../store'; // Import the main store
import apiService from '../apiService'; // Assuming a centralized apiService
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';

// Helper to flatten the file tree for the select dropdown
const flattenFiles = (tree) => {
  let files = [];
  const recurse = (nodes, path) => {
    nodes.forEach(node => {
      const newPath = path ? `${path}/${node.name}` : node.name;
      if (node.type === 'file') {
        files.push({ ...node, path: newPath });
      }
      if (node.children) {
        recurse(node.children, newPath);
      }
    });
  };
  recurse(tree, '');
  return files;
};

function ChatPanel() {
  const [message, setMessage] = useState('');
  const [chats, setChats] = useState([
    {
      id: 1,
      title: 'Chat',
      history: [{ author: 'AI', text: 'How can I help you today?' }],
      createdAt: new Date()
    }
  ]);
  const [activeChatId, setActiveChatId] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [contextFileIds, setContextFileIds] = useState([]);
  const activeChat = chats.find(chat => chat.id === activeChatId);
  const [displayTitle, setDisplayTitle] = useState(activeChat ? activeChat.title : 'Chat');
  const chatBoxRef = useRef(null);
  const { accessToken, activeFile, projectFiles, currentProject } = useStore((state) => ({
    accessToken: state.token,
    activeFile: state.openFiles.find(file => file.file_id === state.activeFileId),
    projectFiles: state.projectFiles,
    currentProject: state.currentProject,
  }));

  const flatFiles = React.useMemo(() => flattenFiles(projectFiles), [projectFiles]);
  const contextFiles = React.useMemo(() => flatFiles.filter(f => contextFileIds.includes(f.file_id)), [flatFiles, contextFileIds]);

  // When the active file changes, automatically set it as the context
  useEffect(() => {
    if (activeFile) {
      setContextFileIds([activeFile.file_id]);
    } else {
      setContextFileIds([]); // Clear context if no file is active
    }
  }, [activeFile]);

  const recentChats = chats.slice(-3).reverse(); // Last 3 chats, most recent first

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [activeChat?.history]);

  const handleCopyMessage = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setSnackbarMessage('Message copied to clipboard!');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Failed to copy message:', error);
      setSnackbarMessage('Failed to copy message');
      setSnackbarOpen(true);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const createNewChat = () => {
    const newChatId = Math.max(...chats.map(c => c.id)) + 1;
    const newChat = {
      id: newChatId,
      title: `Chat`, // Set a generic title initially
      history: [{ author: 'AI', text: 'How can I help you today?' }],
      createdAt: new Date()
    };
    
    setChats(prevChats => [...prevChats, newChat]);
    setActiveChatId(newChatId);
    setDisplayTitle('Chat');
  };

  const switchToChat = (chatId) => {
    setActiveChatId(chatId);
    const newTitle = chats.find(c => c.id === chatId)?.title || 'Chat';
    setDisplayTitle(newTitle);
  };

  const updateChatTitle = (chatId, newTitle) => {
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === chatId ? { ...chat, title: newTitle } : chat
      )
    );
  };

  const handleSend = async () => {
    if (!message.trim() || isLoading || !activeChat) return;

    // Guard: Don't send requests if there's no current project
    if (!currentProject || !currentProject.project_id) {
      console.warn('Cannot send chat message: No current project selected');
      return;
    }

    const newHistory = [...activeChat.history, { author: 'User', text: message }];
    const isFirstUserMessage = activeChat.history.length === 1 && activeChat.history[0].author === 'AI';

    // Update the chat history immediately for a responsive UI
    setChats(prevChats =>
      prevChats.map(chat =>
        chat.id === activeChatId ? { ...chat, history: newHistory } : chat
      )
    );

    const userMessage = message; // Capture message before clearing it
    setMessage('');
    setIsLoading(true);

    try {
      // If this is the first user message, generate and update the chat title
      if (isFirstUserMessage) {
        try {
          const titleResponse = await apiService.post('/ai/gemini-action', {
            action: 'summarize_for_title',
            text: userMessage,
            projectId: currentProject ? currentProject.project_id : null,
          });
          const newTitle = titleResponse.data.result.replace(/["']/g, ''); // Clean quotes
          updateChatTitle(activeChatId, newTitle);
        } catch (titleError) {
          console.error('Failed to generate chat title:', titleError);
          // Fallback to a simple title if generation fails
          updateChatTitle(activeChatId, 'Chat');
        }
      }
      
      // Prepare payload for the main chat response
      const payload = {
        action: 'chat',
        text: userMessage,
        history: activeChat.history,
        projectId: currentProject ? currentProject.project_id : null,
      };

      // If there's a file open, add it to the context
      if (activeFile && activeFile.content) {
        payload.context = {
          fileName: activeFile.name,
          fileContent: activeFile.content,
        };
      }

      // If there are context files, add them to the payload
      if (contextFiles.length > 0) {
        payload.context = {
          files: contextFiles.map(file => ({
            fileName: file.path,
            fileContent: file.content,
          })),
        };
      }

      // Use the 'chat' action for general conversation
      const response = await apiService.post('/ai/gemini-action', payload);
      
      console.log('Full AI response:', response.data);

      // Handle edit agent responses
      if (response.data.filesToOpen && response.data.suggestions) {
        console.log('Edit agent response detected, opening files and adding suggestions');
        console.log('Files to open:', response.data.filesToOpen);
        console.log('Suggestions:', response.data.suggestions);
        
        // Close all currently open files and open only files with edits
        const { openFiles, closeFile, openFile, addSuggestion } = useStore.getState();
        
        // Close all currently open files
        openFiles.forEach(file => {
          closeFile(file.file_id);
        });
        
        // Open only files with edits
        response.data.filesToOpen.forEach(file => {
          openFile(file);
        });
        
        // Send edit agent suggestions to be processed by the editor
        // We'll use a custom message to trigger the editor to handle these
        window.dispatchEvent(new CustomEvent('editAgentSuggestions', {
          detail: { suggestions: response.data.suggestions }
        }));
      }

      // Update chat with AI response
      setChats(prevChats =>
        prevChats.map(chat =>
          chat.id === activeChatId 
            ? { ...chat, history: [...newHistory, { author: 'AI', text: response.data.result }] }
            : chat
        )
      );
    } catch (error) {
      console.error('Error sending message to AI:', error);
      const errorMessage = error.response?.data?.message || 'Failed to get a response.';
      
      // Update chat with error message
      setChats(prevChats =>
        prevChats.map(chat =>
          chat.id === activeChatId 
            ? { ...chat, history: [...newHistory, { author: 'AI', text: `Error: ${errorMessage}` }] }
            : chat
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeChat) return null;

  return (
    <Box sx={{ 
      p: 2,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.paper',
      borderLeft: '1px solid',
      borderColor: 'divider'
    }}>
      {/* Header with title and new chat button */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid', 
        borderColor: 'divider', 
        pb: 1, 
        mb: 2 
      }}>
        <Typography variant="h6">
          {displayTitle}
        </Typography>
        <Tooltip title="New Chat">
          <IconButton onClick={createNewChat} size="small" sx={{ color: 'primary.main' }}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Context file multi-selector */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
          📄 Context Files
        </Typography>
        <Select
          multiple
          value={contextFileIds}
          onChange={(e) => setContextFileIds(e.target.value)}
          input={<OutlinedInput sx={{
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255, 255, 255, 0.23)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255, 255, 255, 0.23)',
              borderWidth: '1px'
            },
          }}/>}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selected.map((id) => {
                const file = flatFiles.find(f => f.file_id === id);
                return <Chip key={id} label={file?.name || id} size="small" />;
              })}
            </Box>
          )}
          fullWidth
          size="small"
          MenuProps={{
            PaperProps: {
              style: {
                maxHeight: 250,
              },
            },
          }}
        >
          {flatFiles.map((file) => (
            <MenuItem key={file.file_id} value={file.file_id}>
              {file.path}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* Chat messages area */}
      <Box
        ref={chatBoxRef}
        sx={{ 
          flexGrow: 1, 
          mb: 2, 
          pr: 1, // For scrollbar spacing
          overflowY: 'auto',
          minHeight: 0, // Ensures flex child can shrink below content size
        }}
      >
        {activeChat.history.map((msg, index) => (
          <Box 
            key={index} 
            sx={{ 
              mb: 2, 
              display: 'flex', 
              flexDirection: msg.author === 'AI' ? 'row' : 'row-reverse',
              alignItems: 'flex-start',
              '&:hover .copy-button': {
                opacity: 1
              }
            }}
          >
            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, m: 1 }}>
              {msg.author === 'AI' ? <SmartToyIcon fontSize="small" /> : <PersonIcon fontSize="small" />}
            </Avatar>
            <Paper 
                elevation={1}
                sx={{
                    p: '10px 14px',
                    borderRadius: '16px',
                    bgcolor: msg.author === 'AI' ? 'background.default' : 'rgba(124,92,252,0.16)',
                    color: 'text.primary',
                    border: '1px solid',
                    borderColor: msg.author === 'AI' ? 'divider' : 'rgba(124,92,252,0.35)',
                    maxWidth: '80%'
                }}
            >
                {msg.author === 'AI' ? (
                  <ReactMarkdown
                    components={{
                      // Style headings
                      h1: ({...props}) => <Typography variant="h4" component="h1" sx={{ mt: 1, mb: 1, fontWeight: 'bold' }} {...props} />,
                      h2: ({...props}) => <Typography variant="h5" component="h2" sx={{ mt: 1, mb: 1, fontWeight: 'bold' }} {...props} />,
                      h3: ({...props}) => <Typography variant="h6" component="h3" sx={{ mt: 1, mb: 1, fontWeight: 'bold' }} {...props} />,
                      h4: ({...props}) => <Typography variant="subtitle1" component="h4" sx={{ mt: 1, mb: 1, fontWeight: 'bold' }} {...props} />,
                      h5: ({...props}) => <Typography variant="subtitle2" component="h5" sx={{ mt: 1, mb: 1, fontWeight: 'bold' }} {...props} />,
                      h6: ({...props}) => <Typography variant="subtitle2" component="h6" sx={{ mt: 1, mb: 1, fontWeight: 'bold' }} {...props} />,
                      // Style paragraphs
                      p: ({...props}) => <Typography variant="body1" component="p" sx={{ mb: 1 }} {...props} />,
                      // Style code blocks
                      pre: ({...props}) => (
                        <Box 
                          component="pre" 
                          sx={{ 
                            bgcolor: 'grey.900', 
                            p: 2, 
                            borderRadius: 1, 
                            overflow: 'auto',
                            my: 1,
                            '& code': {
                              bgcolor: 'transparent',
                              p: 0,
                              fontSize: '0.875rem',
                              fontFamily: 'monospace'
                            }
                          }} 
                          {...props} 
                        />
                      ),
                      // Style inline code
                      code: ({...props}) => (
                        <Box 
                          component="code" 
                          sx={{ 
                            bgcolor: 'grey.800', 
                            px: 0.5, 
                            py: 0.25, 
                            borderRadius: 0.5, 
                            fontSize: '0.875rem',
                            fontFamily: 'monospace'
                          }} 
                          {...props} 
                        />
                      ),
                      // Style lists
                      ul: ({...props}) => <Box component="ul" sx={{ pl: 2, my: 1 }} {...props} />,
                      ol: ({...props}) => <Box component="ol" sx={{ pl: 2, my: 1 }} {...props} />,
                      li: ({...props}) => <Typography component="li" variant="body1" sx={{ mb: 0.5 }} {...props} />,
                      // Style blockquotes
                      blockquote: ({...props}) => (
                        <Box 
                          component="blockquote" 
                          sx={{ 
                            borderLeft: '4px solid', 
                            borderColor: 'primary.main', 
                            pl: 2, 
                            py: 0.5, 
                            bgcolor: 'action.hover',
                            borderRadius: '0 4px 4px 0',
                            my: 1
                          }} 
                          {...props} 
                        />
                      ),
                      // Style emphasis
                      strong: ({...props}) => <Typography component="strong" sx={{ fontWeight: 'bold' }} {...props} />,
                      em: ({...props}) => <Typography component="em" sx={{ fontStyle: 'italic' }} {...props} />,
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                ) : (
                  <Typography variant="body1">
                    {msg.text}
                  </Typography>
                )}
            </Paper>
            <IconButton
              className="copy-button"
              size="small"
              onClick={() => handleCopyMessage(msg.text)}
              sx={{
                width: 24,
                height: 24,
                ml: msg.author === 'AI' ? 0.5 : 0,
                mr: msg.author === 'User' ? 0.5 : 0,
                opacity: 0,
                transition: 'opacity 0.2s',
                color: 'text.secondary',
                '&:hover': {
                  color: 'text.primary',
                  bgcolor: 'action.hover',
                }
              }}
            >
              <ContentCopyIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        ))}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>

      {/* Message input area */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <TextField
          label="Ask AI..."
          variant="outlined"
          size="small"
          fullWidth
          multiline
          maxRows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
        />
        <Button 
          variant="contained" 
          size="medium" 
          onClick={handleSend}
          disabled={isLoading || !message.trim()}
          sx={{ ml: 1 }}
        >
          Send
        </Button>
      </Box>

      {/* Recent chats section */}
      {chats.length > 1 && (
        <>
          <Divider sx={{ mb: 1 }} />
          <Box sx={{ 
            maxHeight: '120px', 
            minHeight: '60px',
            overflowY: 'auto',
            flexShrink: 0 // Prevents this section from shrinking
          }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
              Recent Chats
            </Typography>
            {recentChats.map((chat) => (
              <Paper
                key={chat.id}
                elevation={chat.id === activeChatId ? 2 : 0}
                onClick={() => switchToChat(chat.id)}
                sx={{
                  p: 1,
                  mb: 0.5,
                  cursor: 'pointer',
                  bgcolor: chat.id === activeChatId ? 'rgba(255, 255, 255, 0.12)' : 'background.paper',
                  color: chat.id === activeChatId ? 'text.primary' : 'text.primary',
                  border: chat.id === activeChatId ? 'none' : '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: chat.id === activeChatId ? 'rgba(255, 255, 255, 0.16)' : 'action.hover',
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 }}>
                    <ChatIcon sx={{ fontSize: 16, mr: 1, flexShrink: 0 }} />
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: chat.id === activeChatId ? 'medium' : 'normal',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {chat.title}
                    </Typography>
                  </Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: chat.id === activeChatId ? 'text.secondary' : 'text.secondary',
                      flexShrink: 0,
                      ml: 1
                    }}
                  >
                    {chat.history.length - 1} msgs
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Box>
        </>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity="success">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ChatPanel;