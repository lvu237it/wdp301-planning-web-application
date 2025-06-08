import { Navigate } from 'react-router-dom';
import { useCommon } from '../../contexts/CommonContext';

const ProtectedRoute = ({ children }) => {
  const { userDataLocal, accessToken } = useCommon();

  if (!userDataLocal || !accessToken) {
    return <Navigate to='/login' replace />;
  }

  return children;
};

export default ProtectedRoute;
