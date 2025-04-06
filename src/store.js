// src/store.js
import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode'; 

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


const useStore = create((set) => ({
  currentFile: null,
  setCurrentFile: (file) => set({ currentFile: file }),

  projectFiles: [
    { id: 'proj1', name: 'Novel Project', type: 'folder', children: [
      // Add dummy content to file objects
      { id: 'chap1', name: 'Chapter 1.md', type: 'file', parent: 'proj1', content: '# Chapter 1\n\nIt was a dark and stormy night...' },
      { id: 'chars', name: 'Characters', type: 'folder', parent: 'proj1', children: [
        { id: 'hero', name: 'Hero.md', type: 'file', parent: 'chars', content: '## Hero\n\n- Brave\n- Resourceful' }
      ]}
    ]},
    { id: 'proj2', name: 'Script Project', type: 'folder', children: [
        { id: 'scene1', name: 'Scene1.fountain', type: 'file', parent: 'proj2', content: 'INT. COFFEE SHOP - DAY\n\nBOB sits drinking coffee.\n\nBOB\n(To himself)\nI need more coffee.' }
    ] }
  ],
  setProjectFiles: (files) => set({ projectFiles: files }),

  // --- Action to update content (we'll use this later) ---
  updateFileContent: (fileId, newContent) => set((state) => ({
    projectFiles: state.projectFiles.map(p => {
      if (p.children) {
        // Basic recursive update - needs improvement for deep nesting & efficiency
        const updateChildren = (nodes) => nodes.map(node => {
          if (node.id === fileId) {
            return { ...node, content: newContent };
          }
          if (node.children) {
            return { ...node, children: updateChildren(node.children) };
          }
          return node;
        });
        return { ...p, children: updateChildren(p.children) };
      }
      return p;
    })
  })),
  // ----------------------------------------------------------

  sidebarWidth: 240,
  chatPanelWidth: 300,

  // --- NEW Authentication Actions ---
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
    set({ isAuthenticated: false, token: null, user: null, error: null });
  },

  // Action to re-check auth, useful if needed elsewhere, but initial state handles load
  checkAuth: () => {
      const { isAuthenticated } = getInitialAuthState();
      if(!isAuthenticated && get().isAuthenticated) {
          // If localStorage says logged out but state says logged in, sync state
          get().logout();
      } else if (isAuthenticated && !get().isAuthenticated) {
          // If localStorage says logged in but state says logged out, sync state
          const newState = getInitialAuthState();
          set(newState);
      }
  },

  // --- Error State (Optional) ---
  error: null, // Store potential auth errors
  setError: (errorMsg) => set({ error: errorMsg }),
}));

export default useStore;