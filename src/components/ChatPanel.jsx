// src/components/ChatPanel.js
import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

function ChatPanel() {
  return (
    <Box sx={{ padding: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>
        AI Assistant
      </Typography>
      <Box sx={{ flexGrow: 1, border: '1px solid #eee', marginBottom: 2, padding: 1, overflowY: 'auto' }}>
        {/* Chat messages will go here */}
        <Typography variant="body2" sx={{ mb: 1 }}>AI: How can I help you today?</Typography>
      </Box>
      <TextField
        label="Ask AI..."
        variant="outlined"
        size="small"
        fullWidth
        sx={{ mb: 1 }}
      />
      <Button variant="contained" size="small">Send</Button>
    </Box>
  );
}

export default ChatPanel;