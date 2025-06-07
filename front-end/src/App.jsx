import { useEffect, useState } from 'react';
import './App.css';
import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <>
      <Routes>
        <Route path='/' element={<RecipesList />} />
      </Routes>
    </>
  );
}

export default App;
