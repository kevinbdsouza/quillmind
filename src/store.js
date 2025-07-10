// src/store.js
import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import { shallow } from 'zustand/shallow';

const getInitialAuthState = () => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    try {
      // Decode token to check expiry and get user info
      const decoded = jwtDecode(token);
      // Check if token is expired (decode.exp is in seconds, Date.now() in ms)
      if (decoded.exp * 1000 > Date.now()) {
        return {
          isAuthenticated: true,
          token: token,
          // Extract user info from token payload (adjust based on your payload)
          user: { userId: decoded.userId, username: decoded.username },
        };
      }
    } catch (error) {
      console.error("Error decoding token on initial load:", error);
      // If token is invalid, clear it
      localStorage.removeItem('accessToken');
    }
  }
  // Default unauthenticated state
  return { isAuthenticated: false, token: null, user: null };
};

// --- Recursive helper to update a file in the tree ---
const updateFileInTree = (tree, fileId, newContent) => {
  return tree.map(node => {
    if (node.file_id === fileId) {
      return { ...node, content: newContent };
    }
    if (node.children && node.children.length > 0) {
      return { ...node, children: updateFileInTree(node.children, fileId, newContent) };
    }
    return node;
  });
};

const useStore = create((set, get) => ({
  ...getInitialAuthState(),

  // --- Project & File State ---
  projects: [], // List of user's projects
  currentProject: null, // The currently selected project object
  projectFiles: [], // The file tree for the current project
  openFiles: [], // Array of currently open file objects
  activeFileId: null, // ID of the currently active file in the editor
  suggestionsByFile: {}, // Object mapping fileId to an array of suggestions

  setProjects: (projects) => set({ projects }),
  setCurrentProject: (project) => {
    // Also clear project files and open files when project changes
    set({
      currentProject: project,
      projectFiles: [],
      openFiles: [],
      activeFileId: null,
      suggestionsByFile: {}, // Also clear suggestions on project change
    });
  },
  setProjectFiles: (files) => set({ projectFiles: files }),
  
  // Function to refresh project files from the API
  refreshProjectFiles: async () => {
    const { currentProject } = get();
    if (!currentProject) return;
    
    try {
      // Import at the point of use to avoid circular dependencies
      const { getProjectFiles } = await import('./apiService');
      const updatedFiles = await getProjectFiles(currentProject.project_id);
      set({ projectFiles: updatedFiles });
      return { success: true };
    } catch (error) {
      console.error('Failed to refresh project files:', error);
      return { success: false, error: error.message };
    }
  },

  openFile: (fileToOpen) => {
    const { openFiles } = get();
    // Check if the file is already open
    if (!openFiles.find(f => f.file_id === fileToOpen.file_id)) {
      set(state => ({
        openFiles: [...state.openFiles, fileToOpen],
      }));
    }
    // Set it as active regardless
    set({ activeFileId: fileToOpen.file_id });
  },

  closeFile: (fileIdToClose) => set(state => {
    const { openFiles, activeFileId, suggestionsByFile } = state;
    const fileIndex = openFiles.findIndex(f => f.file_id === fileIdToClose);

    if (fileIndex === -1) return {}; // File not found

    const newOpenFiles = openFiles.filter(f => f.file_id !== fileIdToClose);
    let newActiveFileId = activeFileId;

    // If the closed file was the active one, determine the next active file
    if (activeFileId === fileIdToClose) {
      if (newOpenFiles.length === 0) {
        newActiveFileId = null; // No files left
      } else {
        // Try to activate the file to the right, or the one to the left if it was the last one
        const nextIndex = Math.min(fileIndex, newOpenFiles.length - 1);
        newActiveFileId = newOpenFiles[nextIndex].file_id;
      }
    }
    
    // Remove suggestions for the closed file
    const { [fileIdToClose]: _, ...remainingSuggestions } = suggestionsByFile;

    return { 
      openFiles: newOpenFiles, 
      activeFileId: newActiveFileId, 
      suggestionsByFile: remainingSuggestions 
    };
  }),

  setActiveFileId: (fileId) => set({ activeFileId: fileId }),

  // --- Action to update content (now works on a tree and openFiles) ---
  updateFileContent: (fileId, newContent) => set((state) => ({
    projectFiles: updateFileInTree(state.projectFiles, fileId, newContent),
    // Also update the file in openFiles if it's there
    openFiles: state.openFiles.map(file =>
      file.file_id === fileId ? { ...file, content: newContent } : file
    ),
  })),

  // --- Handle file operations for editor synchronization ---
  handleFileDeleted: (deletedFileId) => set((state) => {
    const { openFiles, activeFileId, projectFiles } = state;
    
    // Helper function to find all file IDs within a folder (recursively)
    const getAllFileIdsInFolder = (folderId, fileTree) => {
      const fileIds = [];
      
      const findFilesRecursively = (nodes) => {
        for (const node of nodes) {
          if (node.file_id === folderId) {
            // Found the folder, now collect all file IDs within it
            const collectFileIds = (children) => {
              if (!children) return;
              for (const child of children) {
                if (child.type === 'file') {
                  fileIds.push(child.file_id);
                } else if (child.type === 'folder' && child.children) {
                  collectFileIds(child.children);
                }
              }
            };
            collectFileIds(node.children);
            return;
          }
          if (node.children) {
            findFilesRecursively(node.children);
          }
        }
      };
      
      findFilesRecursively(fileTree);
      return fileIds;
    };
    
    // Find the deleted item
    const findNodeById = (nodes, id) => {
      for (const node of nodes) {
        if (node.file_id === id) return node;
        if (node.children) {
          const found = findNodeById(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    
    const deletedNode = findNodeById(projectFiles, deletedFileId);
    if (!deletedNode) return {}; // Node not found
    
    let filesToClose = [];
    
    if (deletedNode.type === 'file') {
      // Single file deletion
      filesToClose = [deletedFileId];
    } else if (deletedNode.type === 'folder') {
      // Folder deletion - get all files within the folder
      filesToClose = getAllFileIdsInFolder(deletedFileId, projectFiles);
      // Also add the folder itself in case it was somehow in openFiles
      filesToClose.push(deletedFileId);
    }
    
    if (filesToClose.length === 0) return {}; // No files to close
    
    // Filter out the files to be closed
    const newOpenFiles = openFiles.filter(f => !filesToClose.includes(f.file_id));
    let newActiveFileId = activeFileId;
    
    // If the active file is being closed, determine the next active file
    if (filesToClose.includes(activeFileId)) {
      if (newOpenFiles.length === 0) {
        newActiveFileId = null; // No files left
      } else {
        // Find the index of the first file being closed to determine replacement
        const firstClosedFileIndex = openFiles.findIndex(f => filesToClose.includes(f.file_id));
        const nextIndex = Math.min(firstClosedFileIndex, newOpenFiles.length - 1);
        newActiveFileId = newOpenFiles[nextIndex].file_id;
      }
    }

    // Remove suggestions for all closed files
    const newSuggestionsByFile = { ...state.suggestionsByFile };
    filesToClose.forEach(id => delete newSuggestionsByFile[id]);

    return { 
      openFiles: newOpenFiles, 
      activeFileId: newActiveFileId,
      suggestionsByFile: newSuggestionsByFile
    };
  }),

  handleFileRenamed: (fileId, newName) => set((state) => ({
    // Update the file name in openFiles if it's there
    openFiles: state.openFiles.map(file =>
      file.file_id === fileId ? { ...file, name: newName } : file
    ),
  })),
  
  // --- UI State ---
  sidebarWidth: 240,
  chatPanelWidth: 300,

  // --- Resize Actions ---
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(150, Math.min(width, 600)) }),
  setChatPanelWidth: (width) => set({ chatPanelWidth: Math.max(150, Math.min(width, 600)) }),
  adjustSidebarWidth: (delta) => set((state) => ({
    sidebarWidth: Math.max(150, Math.min(state.sidebarWidth + delta, 600))
  })),
  adjustChatPanelWidth: (delta) => set((state) => ({
    chatPanelWidth: Math.max(150, Math.min(state.chatPanelWidth - delta, 600))
  })),

  // --- Suggestion Actions ---
  addSuggestion: (fileId, sug) => set(state => {
    const newSuggestion = { id: `sug-${Date.now()}`, ...sug };
    const fileSuggestions = state.suggestionsByFile[fileId] || [];
    return {
      suggestionsByFile: {
        ...state.suggestionsByFile,
        [fileId]: [...fileSuggestions, newSuggestion]
      }
    };
  }),
  
  removeSuggestion: (fileId, suggestionId) => set(state => {
    const fileSuggestions = state.suggestionsByFile[fileId] || [];
    const newFileSuggestions = fileSuggestions.filter(s => s.id !== suggestionId);
    
    if (newFileSuggestions.length > 0) {
      return {
        suggestionsByFile: {
          ...state.suggestionsByFile,
          [fileId]: newFileSuggestions
        }
      };
    } else {
      // Remove the fileId key if no suggestions are left
      const { [fileId]: _, ...rest } = state.suggestionsByFile;
      return { suggestionsByFile: rest };
    }
  }),

  // Add new action to directly set suggestions for a file (replaces existing ones)
  setSuggestionsForFile: (fileId, suggestionsArray) => set(state => ({
    suggestionsByFile: {
      ...state.suggestionsByFile,
      [fileId]: suggestionsArray,
    }
  })),

  // --- Authentication Actions ---
  login: (userData, token) => {
    try {
      localStorage.setItem('accessToken', token); // Store token
      const decoded = jwtDecode(token); // Decode to get user info for state
      set({
        isAuthenticated: true,
        token: token,
        user: { userId: decoded.userId, username: decoded.username, email: userData.email }, // Store user info from response/decode
        error: null, // Clear any previous errors
      });
    } catch (error) {
        console.error("Failed to process login:", error);
        // Handle potential decoding errors if needed
        get().logout(); // Log out if token processing fails
    }
  },

  logout: () => {
    localStorage.removeItem('accessToken'); // Remove token
    set({ 
      isAuthenticated: false, token: null, user: null, error: null, 
      projects: [], currentProject: null, projectFiles: [], 
      openFiles: [], activeFileId: null, suggestionsByFile: {} 
    });
  },

  // Action to re-check auth, useful if needed elsewhere, but initial state handles load
  checkAuth: () => {
      const { isAuthenticated } = getInitialAuthState();
      if(!isAuthenticated && get().isAuthenticated) {
          // If localStorage says logged out but state says logged in, sync state
          get().logout();
      } else if (isAuthenticated && !get().isAuthenticated) {
          // If localStorage says logged in but state says logged out, sync state
          const s = getInitialAuthState();
          set({ isAuthenticated: s.isAuthenticated, token: s.token, user: s.user });
      }
  },

  error: null, // Store potential auth errors
  setError: (errorMsg) => set({ error: errorMsg }),
}));

export const useAuth = () => useStore(state => ({
  isAuthenticated: state.isAuthenticated,
  user: state.user,
  login: state.login,
  logout: state.logout,
  checkAuth: state.checkAuth,
  error: state.error,
  setError: state.setError,
}), shallow);

export default useStore;