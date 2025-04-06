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

// Fetch projects for the logged-in user
export const fetchProjects = async () => {
  try {
    const response = await api.get('/projects');
    return response.data; // Should be an array of project objects
  } catch (error) {
    console.error("Error fetching projects:", error);
    throw error.response?.data || { message: error.message || 'Failed to fetch projects' };
  }
};

// Fetch files for a specific project
export const fetchFilesForProject = async (projectId) => {
  try {
    const response = await api.get(`/projects/${projectId}/files`);
    return response.data; // Should be an array of file objects
  } catch (error) {
    console.error(`Error fetching files for project ${projectId}:`, error);
    throw error.response?.data || { message: error.message || 'Failed to fetch files' };
  }
};

// Fetch specific file content
export const fetchFileContent = async (fileId) => {
  try {
    const response = await api.get(`/files/${fileId}`);
    return response.data; // Should be the file object including content
  } catch (error) {
    console.error(`Error fetching content for file ${fileId}:`, error);
    throw error.response?.data || { message: error.message || 'Failed to fetch file content' };
  }
};

// Save file content
export const saveFileContent = async (fileId, content) => {
  try {
    // Assuming you want to update the content primarily
    const response = await api.put(`/files/${fileId}`, { content });
    return response.data; // Should be a success message
  } catch (error) {
    console.error(`Error saving content for file ${fileId}:`, error);
    throw error.response?.data || { message: error.message || 'Failed to save file content' };
  }
};

// Create a new project
export const createProject = async (projectName) => {
  try {
    const response = await api.post('/projects', { name: projectName });
    return response.data; // Should be the newly created project object
  } catch (error) {
    console.error("Error creating project:", error);
    throw error.response?.data || { message: error.message || 'Failed to create project' };
  }
};

// Create a new file within a project
export const createFile = async (projectId, fileName, fileType = 'markdown', path = '/') => {
  try {
    const response = await api.post(`/projects/${projectId}/files`, {
      name: fileName,
      file_type: fileType,
      path: path
    });
    return response.data; // Should be the newly created file object
  } catch (error) {
    console.error(`Error creating file in project ${projectId}:`, error);
    throw error.response?.data || { message: error.message || 'Failed to create file' };
  }
};

// Call the backend AI action endpoint
export const performGeminiAction = async (action, text) => {
  try {
    const response = await api.post('/ai/gemini-action', { action, text });
    return response.data; // Should contain { result: "...generated text..." }
  } catch (error) {
    console.error(`Error performing AI action '${action}':`, error);
    throw error.response?.data || { message: error.message || 'Failed to perform AI action' };
  }
};

// --- Add other API functions here later ---
// e.g., fetchProjects, saveFile, etc.
// export const fetchProjects = async () => { ... }

export default api; // Export configured instance if needed elsewhere