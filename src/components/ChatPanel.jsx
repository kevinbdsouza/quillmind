// src/components/ChatPanel.js
import React, { useState, useRef, useEffect } from 'react';
import { Box, Paper, Avatar, IconButton, Snackbar, Alert, Divider, Tooltip } from '@mui/material';
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

function ChatPanel() {
  const [message, setMessage] = useState('');
  const [chats, setChats] = useState([
    {
      id: 1,
      title: 'Chat 1',
      history: [{ author: 'AI', text: 'How can I help you today?' }],
      createdAt: new Date()
    }
  ]);
  const [activeChatId, setActiveChatId] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const chatBoxRef = useRef(null);
  const { accessToken, activeFile } = useStore((state) => ({
    accessToken: state.token,
    activeFile: state.openFiles.find(file => file.file_id === state.activeFileId)
  }));

  const activeChat = chats.find(chat => chat.id === activeChatId);
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
      title: `Chat ${newChatId}`,
      history: [{ author: 'AI', text: 'How can I help you today?' }],
      createdAt: new Date()
    };
    
    setChats(prevChats => [...prevChats, newChat]);
    setActiveChatId(newChatId);
  };

  const switchToChat = (chatId) => {
    setActiveChatId(chatId);
  };

  const updateChatTitle = (chatId, newTitle) => {
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === chatId ? { ...chat, title: newTitle } : chat
      )
    );
  };

  const generateChatTitle = (firstMessage) => {
    // Generate a title from the first user message, limited to 30 characters
    if (firstMessage.length > 30) {
      return firstMessage.substring(0, 27) + '...';
    }
    return firstMessage;
  };

  const handleSend = async () => {
    if (!message.trim() || isLoading || !activeChat) return;

    const newHistory = [...activeChat.history, { author: 'User', text: message }];
    
    // Update the chat history
    setChats(prevChats =>
      prevChats.map(chat =>
        chat.id === activeChatId ? { ...chat, history: newHistory } : chat
      )
    );

    // If this is the first user message, update the chat title
    if (activeChat.history.length === 1 && activeChat.history[0].author === 'AI') {
      updateChatTitle(activeChatId, generateChatTitle(message));
    }

    setMessage('');
    setIsLoading(true);

    try {
      // Prepare payload
      const payload = {
        action: 'chat',
        text: message,
        history: activeChat.history, // Pass the previous chat history
      };

      // If there's a file open, add it to the context
      if (activeFile && activeFile.content) {
        payload.context = {
          fileName: activeFile.name,
          fileContent: activeFile.content,
        };
      }

      // Use the 'chat' action for general conversation
      const response = await apiService.post('/ai/gemini-action', payload);

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
      bgcolor: '#2C2C2C'
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
          {activeChat.title}
        </Typography>
        <Tooltip title="New Chat">
          <IconButton onClick={createNewChat} size="small" sx={{ color: 'primary.main' }}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Active file context indicator */}
      {activeFile && (
        <Box sx={{ 
          mb: 2, 
          p: 1, 
          bgcolor: 'primary.main', 
          color: 'primary.contrastText', 
          borderRadius: 1,
          fontSize: '0.75rem'
        }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
            📄 Context: {activeFile.name}
          </Typography>
        </Box>
      )}

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
                    bgcolor: 'background.default',
                    color: 'text.primary',
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
                  bgcolor: chat.id === activeChatId ? 'primary.main' : 'background.paper',
                  color: chat.id === activeChatId ? 'primary.contrastText' : 'text.primary',
                  border: chat.id === activeChatId ? 'none' : '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: chat.id === activeChatId ? 'primary.dark' : 'action.hover',
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
                      color: chat.id === activeChatId ? 'primary.contrastText' : 'text.secondary',
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