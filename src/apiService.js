// src/apiService.js
import axios from 'axios';
import useStore from './store'; // Import store to access token

// Create an Axios instance
const api = axios.create({
  baseURL: 'http://localhost:5001/api', // Your backend API base URL
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Axios Request Interceptor ---
// Automatically attach JWT token to Authorization header for requests
api.interceptors.request.use(
  (config) => {
    // Get token from Zustand store
    const token = useStore.getState().token;
    if (token) {
      // Add Authorization header
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    // Handle request error
    return Promise.reject(error);
  }
);

// --- API Functions ---

/**
 * Register a new user.
 * @param {object} userData - { username, email, password }
 * @returns {Promise<object>} - Response data from backend
 */
export const registerUser = async (userData) => {
  try {
    const response = await api.post('/auth/register', userData);
    return response.data; // Contains { message, user }
  } catch (error) {
    // Re-throw error to be caught by the component
    // Axios wraps response errors in error.response
    throw error.response?.data || { message: error.message || 'Registration failed' };
  }
};

/**
 * Log in a user.
 * @param {object} credentials - { email, password }
 * @returns {Promise<object>} - Response data from backend
 */
export const loginUser = async (credentials) => {
  try {
    const response = await api.post('/auth/login', credentials);
    return response.data; // Contains { message, accessToken, user }
  } catch (error) {
    throw error.response?.data || { message: error.message || 'Login failed' };
  }
};


// --- Add other API functions here later ---
// e.g., fetchProjects, saveFile, etc.
// export const fetchProjects = async () => { ... }


export default api; // Export configured instance if needed elsewhere