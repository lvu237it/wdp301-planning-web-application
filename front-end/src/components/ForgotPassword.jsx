import React, { useState } from 'react';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [disabled, setDisabled] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (disabled) {
      setMessage('Vui lòng đợi 30 giây trước khi thử lại.');
      return;
    }

    setDisabled(true);
    setMessage('');

    try {
      const response = await fetch(
        `http://localhost:3000/authentication/forgotpass`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();
      console.log('API Response:', data); // Debug response
      setMessage(
        data.success
          ? 'A reset link has been sent to your email.'
          : 'Failed to send reset link.'
      );
    } catch (error) {
      setMessage('An error occurred. Please try again.');
    }

    setTimeout(() => {
      setDisabled(false);
      setMessage(''); // Xóa message sau khi hết timeout
    }, 30000); // 30 giây
  };

  return (
    <div className='container mx-auto p-6 max-w-md text-center'>
      <h2 className='text-2xl font-bold mb-4'>Forgot Password</h2>
      <p className='text-gray-600 mb-4'>
        Enter your email to receive a reset link.
      </p>
      <form onSubmit={handleSubmit} className='space-y-4'>
        <input
          type='email'
          placeholder='Email'
          className='w-full p-2 border rounded'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          style={{ marginTop: 10, backgroundColor: 'green', color: 'white' }}
          type='submit'
          className={`w-full p-2 rounded ${
            disabled
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 text-white'
          }`}
          disabled={disabled}
        >
          {disabled ? 'Vui lòng đợi...' : 'Send Reset Link'}
        </button>
      </form>
      {message && <p className='text-red-500 mt-4'>{message}</p>}
    </div>
  );
};

export default ForgotPassword;
