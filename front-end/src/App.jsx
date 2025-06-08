import { useEffect, useState } from 'react';
import './App.css';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ProtectedRoute from './components/common/ProtectedRoute';

function App() {
  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path='/login' element={<Login />} />
        <Route path='/register' element={<Register />} />

        {/* Protected routes */}
        <Route
          path='/'
          element={
            <ProtectedRoute>
              <div>Home Page (Protected)</div>
            </ProtectedRoute>
          }
        />

        {/* Add more protected routes as needed */}
        {/* Example:
        <Route
          path='/profile'
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        */}

        {/* Catch all route - 404 */}
        <Route
          path='*'
          element={
            <div className='text-center mt-5'>
              <h1>404 - Page Not Found</h1>
            </div>
          }
        />
      </Routes>
    </>
  );
}

export default App;
