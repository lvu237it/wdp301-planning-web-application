import { useEffect, useState } from 'react';
import './App.css';
import RecipesList from './components/RecipesList';
import { Routes, Route } from 'react-router-dom';
import RecipeDetail from './components/RecipeDetail';
import AdminRecipes from './components/AdminRecipes';
import AdminRecipeDetail from './components/AdminRecipeDetails';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import SavedRecipes from './components/SavedRecipes';
import ChefsCommunity from './components/ChefsCommunity';
import ChefDetail from './components/ChefDetail';
import UserProfile from './components/UserProfile';

function App() {
  return (
    <>
      <Routes>
        <Route path='/' element={<RecipesList />} />
        <Route path='/saved-recipes' element={<SavedRecipes />} />
        <Route path='/community-chef' element={<ChefsCommunity />} />
        <Route path='/chef/:id' element={<ChefDetail />} />
        <Route path='/login' element={<Login />} />
        <Route path='/forgot' element={<ForgotPassword />} />
        <Route path='/reset/:token' element={<ResetPassword />} />
        <Route
          path='/recipe-details/:recipeNameSlug'
          element={<RecipeDetail />}
        />
        <Route path='/admin/recipes' element={<AdminRecipes />} />
        <Route path='/user-profile' element={<UserProfile />} />
        <Route
          path='/admin/recipes/:recipeId'
          element={<AdminRecipeDetail />}
        />
      </Routes>
    </>
  );
}

export default App;
