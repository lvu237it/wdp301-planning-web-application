import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useMediaQuery } from 'react-responsive';
import { Toaster, toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';

const CommonContext = createContext();

export const useCommon = () => useContext(CommonContext);

export const Common = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem('accessToken') || null
  );
  const [userDataLocal, setUserDataLocal] = useState(() => {
    return JSON.parse(localStorage.getItem('userData')) || null;
  });

  const [loading, setLoading] = useState(true);

  // const { from } = location.state || { from: '/' }; // Nếu không có thông tin from thì mặc định về trang chủ

  // Đổi sang biến env tương ứng (VITE_API_BASE_URL_DEVELOPMENT hoặc VITE_API_BASE_URL_PRODUCTION)
  // và build lại để chạy server frontend trên môi trường dev hoặc production
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL_DEVELOPMENT;

  // Authentication functions
  const login = async (email, password) => {
    try {
      const response = await axios.post(`${apiBaseUrl}/login`, {
        email,
        password,
      });

      if (response.data.success) {
        const { accessToken, user } = response.data;

        // Save to localStorage
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('userData', JSON.stringify(user));

        // Update state
        setAccessToken(accessToken);
        setUserDataLocal(user);

        // Configure axios defaults for future requests
        axios.defaults.headers.common[
          'Authorization'
        ] = `Bearer ${accessToken}`;

        toast.success('Login successful!');
        navigate('/'); // or wherever your home page is
        return true;
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.message || 'Login failed');
      return false;
    }
  };

  const register = async (username, email, password, passwordConfirm) => {
    try {
      const response = await axios.post(`${apiBaseUrl}/signup`, {
        username,
        email,
        password,
        passwordConfirm,
      });

      if (response.data.status === 'success') {
        const { token, data } = response.data;

        // Save to localStorage
        localStorage.setItem('accessToken', token);
        localStorage.setItem('userData', JSON.stringify(data.user));

        // Update state
        setAccessToken(token);
        setUserDataLocal(data.user);

        // Configure axios defaults
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        toast.success('Registration successful!');
        navigate('/');
        return true;
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.response?.data?.message || 'Registration failed');
      return false;
    }
  };

  const logout = () => {
    // Clear localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userData');

    // Clear state
    setAccessToken(null);
    setUserDataLocal(null);

    // Remove axios default header
    delete axios.defaults.headers.common['Authorization'];

    // Navigate to login
    navigate('/login');
  };

  // Set up axios interceptor for handling 401 responses
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  // Set up initial axios authorization header
  useEffect(() => {
    if (accessToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    }
  }, [accessToken]);

  const uploadImageToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append(
      'upload_preset',
      'sdn302-recipes-sharing-web-single-image-for-recipe'
    );

    try {
      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${
          import.meta.env.VITE_CLOUDINARY_NAME
        }/image/upload`,
        formData
      );
      console.log('VITE_CLOUDINARY_NAME', import.meta.env.VITE_CLOUDINARY_NAME);
      console.log('response', response);
      console.log('response.data', response.data);
      console.log('response.data.secureurl', response.data.secure_url);
      if (response.status === 200) {
        console.log('oke upload thành công');
        return response.data.secure_url; // Trả về URL ảnh đã upload
      }
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      throw new Error('Upload to Cloudinary failed');
    }
  };

  return (
    <CommonContext.Provider
      value={{
        Toaster,
        toast,
        navigate,
        userDataLocal,
        setUserDataLocal,
        accessToken,
        uploadImageToCloudinary,
        apiBaseUrl,
        login,
        register,
        logout,
      }}
    >
      <Toaster
        richColors
        position='top-center'
        expand={true}
        visibleToasts={5}
        toastOptions={{
          duration: 2000,
        }}
      />

      {children}
    </CommonContext.Provider>
  );
};
