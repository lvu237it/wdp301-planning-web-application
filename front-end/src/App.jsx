import { Routes, Route } from 'react-router-dom';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ProtectedRoute from './components/common/ProtectedRoute';
import Home from './components/Home';
import Dashboard from './pages/dashboard/Dashboard';
import Workspaces from './pages/workspaces/Workspaces';
import Boards from './pages/boards/Boards';
import Calendar from './pages/calendar/Calendar';
import Profile from './pages/profile/Profile';

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path='/login' element={<Login />} />
      <Route path='/register' element={<Register />} />

      {/* Protected routes */}
      <Route
        path='/'
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path='dashboard' element={<Dashboard />} />
        <Route path='workspaces' element={<Workspaces />} />
        <Route path='/workspace/:workspaceId/boards' element={<Boards />} />
        <Route path='calendar' element={<Calendar />} />
        <Route path='profile' element={<Profile />} />
      </Route>

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
  );
}

export default App;
