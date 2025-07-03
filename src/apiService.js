// src/apiService.js
import axios from 'axios';
import useStore from './store'; // Import store to access token

// Create an Axios instance
const apiService = axios.create({
  baseURL: '/api', // Use relative path for API calls
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Axios Request Interceptor ---
// Automatically attach JWT token to Authorization header for requests
apiService.interceptors.request.use(
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

// --- Axios Response Interceptor ---
// Handle token expiration and other global errors
apiService.interceptors.response.use(
  (response) => {
    // Return successful responses as-is
    return response;
  },
  (error) => {
    // Check if error is due to authentication issues
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Token is invalid or expired
      console.warn('Authentication failed - logging out user');
      
      // Get the logout function from store and call it
      const { logout } = useStore.getState();
      logout();
      
      // Optionally redirect to login page or show a message
      // You might want to use your router here instead
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    
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
    const response = await apiService.post('/auth/register', userData);
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
    const response = await apiService.post('/auth/login', credentials);
    return response.data; // Contains { message, accessToken, user }
  } catch (error) {
    throw error.response?.data || { message: error.message || 'Login failed' };
  }
};


// --- Project and File API Functions ---

/**
 * Fetches all projects for the logged-in user.
 * @returns {Promise<Array>} - An array of project objects.
 */
export const getProjects = async () => {
  try {
    const response = await apiService.get('/projects');
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: error.message || 'Failed to fetch projects' };
  }
};

/**
 * Creates a new project.
 * @param {string} name - The name of the new project.
 * @returns {Promise<object>} - The newly created project object.
 */
export const createProject = async (name) => {
  try {
    const response = await apiService.post('/projects', { name });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: error.message || 'Failed to create project' };
  }
};

/**
 * Fetches the complete file tree for a specific project.
 * @param {number} projectId - The ID of the project.
 * @returns {Promise<Array>} - The root of the file tree.
 */
export const getProjectFiles = async (projectId) => {
  try {
    const response = await apiService.get(`/projects/${projectId}/files`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: error.message || 'Failed to fetch project files' };
  }
};

/**
 * Updates the content of a file.
 * @param {number} fileId - The ID of the file to update.
 * @param {string} content - The new content of the file.
 * @param {string} [name] - The optional new name of the file.
 * @returns {Promise<object>} - Confirmation message.
 */
export const updateFile = async (fileId, content, name) => {
  try {
    const payload = { content };
    if (name) payload.name = name;
    const response = await apiService.put(`/files/${fileId}`, payload);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: error.message || 'Failed to save file' };
  }
};

/**
 * Creates a new file or folder in a project.
 * @param {object} fileData - { projectId, name, type, parent_id }
 * @returns {Promise<object>} - The newly created file/folder object.
 */
export const createFile = async ({ projectId, name, type, parent_id }) => {
    try {
        const response = await apiService.post(`/projects/${projectId}/files`, { name, type, parent_id });
        return response.data;
    } catch (error) {
        throw error.response?.data || { message: error.message || 'Failed to create file' };
    }
};

/**
 * Moves a file to a new parent folder.
 * @param {number} fileId - The ID of the file to move.
 * @param {number | null} parentId - The ID of the new parent folder (or null for root).
 * @returns {Promise<object>} - Confirmation message.
 */
export const moveFile = async (fileId, parentId) => {
    try {
        const response = await apiService.patch(`/files/${fileId}`, { parent_id: parentId });
        return response.data;
    } catch (error) {
        throw error.response?.data || { message: error.message || 'Failed to move file' };
    }
};

/**
 * Deletes a file or folder.
 * @param {number} fileId - The ID of the file or folder to delete.
 * @returns {Promise<object>} - Confirmation message.
 */
export const deleteFile = async (fileId) => {
    try {
        const response = await apiService.delete(`/files/${fileId}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || { message: 'Failed to delete file' };
    }
};

/**
 * Renames a file or folder.
 * @param {number} fileId - The ID of the file or folder to rename.
 * @param {string} name - The new name.
 * @returns {Promise<object>} - Confirmation message.
 */
export const renameFile = async (fileId, name) => {
    try {
        const response = await apiService.patch(`/files/${fileId}`, { name });
        return response.data;
    } catch (error) {
        throw error.response?.data || { message: 'Failed to rename file' };
    }
};

/**
 * Triggers the indexing of a project's files.
 * @param {number} projectId - The ID of the project to index.
 * @returns {Promise<object>} - Confirmation message.
 */
export const indexProject = async (projectId) => {
    try {
        const response = await apiService.post(`/projects/${projectId}/index`);
        return response.data;
    } catch (error) {
        throw error.response?.data || { message: 'Failed to start project indexing' };
    }
};

export default apiService; // Export configured instance