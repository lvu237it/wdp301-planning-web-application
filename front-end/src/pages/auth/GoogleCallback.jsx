import { useEffect, useRef } from 'react';
import { useCommon } from '../../contexts/CommonContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import axios from 'axios';

function GoogleCallback() {
  const { navigate, handleLoginSuccess, toast, apiBaseUrl } = useCommon();
  const location = useLocation();
  const hasProcessed = useRef(false); // Tránh xử lý nhiều lần
  const hasShownToast = useRef(false); // Tránh toast duplicate

  useEffect(() => {
    // Tránh xử lý callback nhiều lần
    if (hasProcessed.current) return;

    const handleCallback = async () => {
      hasProcessed.current = true; // Đánh dấu đã xử lý

      try {
        console.log('Handling Google callback...');
        console.log('location.search', location.search);

        const query = new URLSearchParams(location.search);
        const success = query.get('success');
        const error = query.get('error');
        const message = query.get('message');
        const token = query.get('token'); // Get token from URL

        if (error) {
          throw new Error(message || 'Google login failed');
        }

        if (success !== 'true') {
          throw new Error('Invalid callback response');
        }

        // If we have token in URL, use it directly
        if (token) {
          console.log('Found token in URL, fetching user data...');

          // Decode token to get user ID
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('Token payload:', payload);

          // Call API to get full user data
          const response = await axios.get(
            `${apiBaseUrl}/users/${payload._id}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              timeout: 10000,
            }
          );

          if (response.data.success) {
            const user = response.data.data.user;
            console.log('User data fetched:', user);

            // Gọi handleLoginSuccess với isGoogleLogin = true để tránh duplicate toast
            await handleLoginSuccess(token, user, true);

            // Chỉ hiển thị toast nếu chưa hiển thị
            if (!hasShownToast.current) {
              hasShownToast.current = true;
              toast.success('Google login successful!');
            }
            navigate('/', { replace: true });
          } else {
            throw new Error('Failed to fetch user data');
          }
        } else {
          // Fallback: try the userdata endpoint with cookies
          console.log('No token in URL, trying userdata endpoint...');
          const response = await axios.get(
            `${apiBaseUrl}/auth/google/callback/userdata`,
            {
              withCredentials: true,
              timeout: 10000,
            }
          );

          if (response.data.success) {
            const { token, user } = response.data;

            // Gọi handleLoginSuccess với isGoogleLogin = true để tránh duplicate toast
            await handleLoginSuccess(token, user, true);

            // Chỉ hiển thị toast nếu chưa hiển thị
            if (!hasShownToast.current) {
              hasShownToast.current = true;
              toast.success('Google login successful!');
            }
            navigate('/', { replace: true });
          } else {
            throw new Error(
              response.data.message || 'Failed to fetch user data'
            );
          }
        }
      } catch (error) {
        console.error('Google callback error:', error);
        toast.error(
          error.response?.data?.message ||
            error.message ||
            'Google login failed'
        );
        navigate('/login', { replace: true });
      }
    };

    handleCallback();
  }, []); // Chỉ chạy 1 lần khi mount, không depend vào location hay các props khác

  return (
    <div
      className='d-flex justify-content-center align-items-center'
      style={{ height: '100vh' }}
    >
      <Spinner animation='border' role='status'>
        <span className='visually-hidden'>Loading...</span>
      </Spinner>
    </div>
  );
}

export default GoogleCallback;
