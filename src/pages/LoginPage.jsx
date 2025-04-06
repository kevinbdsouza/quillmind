// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate for redirect later
import { Container, Box, Typography, TextField, Button, Alert, CircularProgress } from '@mui/material';
import { loginUser } from '../apiService'; // Import API function
import useStore from '../store'; // Import Zustand store hook

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null); // Local error state
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate(); // Hook for navigation

  // Get the login action from the Zustand store
  const zustandLogin = useStore((state) => state.login);

  const handleSubmit = async (event) => {
    event.preventDefault(); // Prevent default form submission
    setLoading(true);
    setError(null); // Clear previous errors

    try {
      const responseData = await loginUser({ email, password });
      // Call the login action in Zustand store on success
      zustandLogin(responseData.user, responseData.accessToken);
      console.log('Login successful:', responseData);
      // --- Redirect on success (We'll properly implement this in 5C) ---
      // navigate('/'); // Example: Redirect to main app page
      alert('Login Successful! (Redirect pending)'); // Placeholder alert
      // ------------------------------------------------------------------
    } catch (err) {
      console.error('Login failed:', err);
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography component="h1" variant="h5">
          Sign in to QuillMind
        </Typography>
        {error && (
          <Alert severity="error" sx={{ width: '100%', mt: 2 }}>
            {error}
          </Alert>
        )}
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
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
          />
          {/* Add Remember Me checkbox later if needed */}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Sign In'}
          </Button>
          <Box textAlign="center">
            <Link to="/register" variant="body2">
              {"Don't have an account? Sign Up"}
            </Link>
            {/* Add Forgot Password link later if needed */}
          </Box>
        </Box>
      </Box>
    </Container>
  );
}

export default LoginPage;