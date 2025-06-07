import { useEffect, useState } from 'react';
import './App.css';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

function App() {
  return (
    <>
      <Routes>
        <Route path='/login' element={<Login />} />
        <Route path='/register' element={<Register />} />
      </Routes>
    </>
  );
}

export default App;
