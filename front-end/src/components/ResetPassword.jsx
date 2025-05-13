import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const ResetPassword = () => {
  const { token } = useParams(); // Lấy token từ URL
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage('Passwords do not match!');
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:3000/authentication/resetpass`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, token }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setMessage('Password reset successful! Redirecting to login...');
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setMessage(data.message || 'Failed to reset password.');
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.');
    }
  };

  useEffect(() => {
    console.log('token', token);
  }, []);

  return (
    <div className='container mx-auto p-6 max-w-md text-center'>
      <h2 className='text-2xl font-bold mb-4'>Reset Password</h2>
      <form onSubmit={handleSubmit} className='space-y-4'>
        <input
          type='password'
          placeholder='New Password'
          className='w-full p-2 border rounded'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          style={{ marginTop: 10 }}
          type='password'
          placeholder='Confirm Password'
          className='w-full p-2 border rounded'
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <button
          style={{ marginTop: 10, backgroundColor: 'green', color: 'white' }}
          type='submit'
          className='w-full bg-blue-500 text-white p-2 rounded'
        >
          Reset Password
        </button>
      </form>
      {message && <p className='text-red-500 mt-4'>{message}</p>}
    </div>
  );
};

export default ResetPassword;
