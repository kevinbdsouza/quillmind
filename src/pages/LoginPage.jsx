// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Paper,
  Avatar,
  Grid,
  Link,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { loginUser, getProjects } from '../apiService'; // Import API function and getProjects
import useStore from '../store'; // Import Zustand store hook

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null); // Local error state
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate(); // Hook for navigation

  // Get the login action from the Zustand store
  const zustandLogin = useStore((state) => state.login);
  const setProjects = useStore((state) => state.setProjects);

  const handleSubmit = async (event) => {
    event.preventDefault(); // Prevent default form submission
    setLoading(true);
    setError(null); // Clear previous errors

    try {
      const responseData = await loginUser({ email, password });
      // Call the login action in Zustand store on success
      zustandLogin(responseData.user, responseData.accessToken);
      console.log('Login successful:', responseData);
      
      // After login, fetch projects to decide where to go next
      const userProjects = await getProjects();
      setProjects(userProjects); // Save projects to store

      if (userProjects.length > 0) {
        navigate('/select-project'); // User has projects, let them choose
      } else {
        navigate('/create-project'); // New user, guide them to create one
      }
    } catch (err) {
      console.error('Login process failed:', err);
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const textFieldStyles = {
    // Target the input text and labels
    '& .MuiInputBase-input': {
      color: '#1A202C', // Ensure text is dark
    },
    '& .MuiInputLabel-root': {
      color: '#6f7680', // A pleasant grey for labels
    },
    // Focused state
    '& label.Mui-focused': {
      color: 'primary.main', // Orange color on focus
    },
    // Outlined input styles
    '& .MuiOutlinedInput-root': {
      '& fieldset': {
        borderColor: '#b0b8c4', // A neutral border
      },
      '&:hover fieldset': {
        borderColor: '#1A202C', // Darker border on hover
      },
      '&.Mui-focused fieldset': {
        borderColor: 'primary.main', // Orange border on focus
      },
    },
  };

  return (
    <Container component="main" maxWidth="xs">
      <Paper elevation={6} sx={{
        mt: 8,
        p: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component="h1" variant="h5">
          Sign in to QuillMind
        </Typography>
        {error && (
          <Alert severity="error" sx={{ width: '100%', mt: 2 }}>
            {error}
          </Alert>
        )}
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 3 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            sx={textFieldStyles}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            sx={textFieldStyles}
          />
          {/* Add Remember Me checkbox later if needed */}
          <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={loading}>
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
          </Button>
          <Grid container justifyContent="flex-end">
            <Grid item>
              <Link component={RouterLink} to="/register" variant="body2">
                {"Don't have an account? Sign Up"}
              </Link>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Container>
  );
}

export default LoginPage;