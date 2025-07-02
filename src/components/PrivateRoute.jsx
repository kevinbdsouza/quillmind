import React from 'react';
import { Navigate } from 'react-router-dom';
import useStore from '../store';

const PrivateRoute = ({ children }) => {
  const isAuthenticated = useStore((state) => state.isAuthenticated);

  // If the user is authenticated, render the children components (e.g., the main app layout).
  // Otherwise, redirect them to the login page.
  return isAuthenticated ? children : <Navigate to="/login" />;
};

export default PrivateRoute; 