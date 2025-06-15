import { Container, Image, Form, Spinner } from 'react-bootstrap';
import logoWebProPlan from '/images/PlanPro-removebg-preview.png';
import { useCommon } from '../../contexts/CommonContext';
import { useEffect, useState } from 'react';
import googleImage from '/images/google-icon-removebg-preview.png';

function Login() {
  const { navigate, login, userDataLocal, toast, googleLogin } = useCommon();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    // Validate email
    if (!formData.email) {
      toast.error('Email is required');
      return false;
    }
    if (!validateEmail(formData.email)) {
      toast.error('Please enter a valid email address');
      return false;
    }

    // Validate password
    if (!formData.password) {
      toast.error('Password is required');
      return false;
    }

    return true;
  };

  // const handleSubmit = async (e) => {
  //   e.preventDefault();
  //   if (validateForm()) {
  //     setIsLoading(true);
  //     setLoadingMessage('Đang đăng nhập...');
  //     try {
  //       const success = await login(formData.email, formData.password);
  //       if (success) {
  //         setLoadingMessage('Đang kết nối socket...');
  //         // Redirect to home after successful login
  //         setTimeout(() => {
  //           navigate('/');
  //         }, 1000);
  //       }
  //     } finally {
  //       setIsLoading(false);
  //       setLoadingMessage('');
  //     }
  //   }
  // };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsLoading(true);
      setLoadingMessage('Đang đăng nhập...');
      try {
        const success = await login(formData.email, formData.password);
        if (!success) {
          toast.error('Login failed');
        }
      } finally {
        setIsLoading(false);
        setLoadingMessage('');
      }
    }
  };

  const handleGoogleLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setLoadingMessage('Đang chuyển hướng đến Google...');
    try {
      await googleLogin();
    } catch (error) {
      setIsLoading(false);
      setLoadingMessage('');
      toast.error('Failed to initiate Google login');
    }
  };

  return (
    <Container
      className='login-background'
      fluid
      style={{
        width: '100%',
        height: '100vh',
        padding: 0,
        margin: 0,
      }}
    >
      <div
        className='login-wrapper d-flex justify-content-center align-items-center'
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        <div
          className='border p-5'
          style={{
            backgroundColor: 'white',
            width: 370,
            borderRadius: 15,
          }}
        >
          <div className='login-top-title d-flex gap-2 justify-content-center align-items-center mb-3'>
            <Image src={logoWebProPlan} width={45} height={45} />
            <div className='text-center' style={{ fontSize: 28 }}>
              WebPlanPro
            </div>
          </div>
          <h5 className='text-center'>Welcome Back!</h5>
          <div className='text-center mb-4'>Please login to your account</div>
          <Form onSubmit={handleSubmit}>
            <Form.Group className='mb-3'>
              <Form.Label>
                <i style={{ color: '#00B894' }} className='fas fa-envelope'></i>
                <span className='ms-2'>Email</span>
              </Form.Label>
              <Form.Control
                type='email'
                name='email'
                value={formData.email}
                onChange={handleChange}
                placeholder='Enter your email'
                disabled={isLoading}
              />
            </Form.Group>

            <Form.Group className='mb-3'>
              <Form.Label>
                <i style={{ color: '#00B894' }} className='fas fa-lock'></i>
                <span className='ms-2'>Password</span>
              </Form.Label>
              <Form.Control
                type='password'
                name='password'
                value={formData.password}
                onChange={handleChange}
                placeholder='Enter your password'
                disabled={isLoading}
              />
            </Form.Group>

            <p
              style={{
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: 12,
                color: '#00B894',
                opacity: isLoading ? 0.7 : 1,
              }}
              className='text-center'
              onClick={() => !isLoading && navigate('/forgot-password')}
            >
              Forgot Password?
            </p>

            <button
              type='submit'
              className='w-100 button-login border-0 mb-2 d-flex align-items-center justify-content-center'
              style={{
                backgroundColor: '#00B894',
                color: 'white',
                borderRadius: 5,
                padding: '6px 0',
                opacity: isLoading ? 0.7 : 1,
                height: '38px',
              }}
              disabled={isLoading}
            >
              {/* {isLoading ? (
                <div className='d-flex align-items-center'>
                  <Spinner
                    as='span'
                    animation='border'
                    size='sm'
                    role='status'
                    aria-hidden='true'
                    className='me-2'
                  />
                  {loadingMessage || 'Đang xử lý...'}
                </div>
              ) : ( */}
              Login
              {/* )} */}
            </button>
          </Form>
          <div className='d-flex justify-content-between align-items-center'>
            <hr className='' style={{ width: '100%' }} />{' '}
            <div
              className='text-center mb-2'
              style={{ fontSize: 12, margin: '0 5px' }}
            >
              or
            </div>{' '}
            <hr className='' style={{ width: '100%' }} />
          </div>
          <div
            onClick={() => handleGoogleLogin()}
            className='button-google-login d-flex justify-content-center align-items-center border rounded-2 mb-3'
          >
            <Image
              className='image-button-google-login'
              src={googleImage}
              width={20}
              height={20}
              style={{ cursor: isLoading ? 'not-allowed' : 'pointer' }}
              alt='Login with Google'
              title='Login with Google'
            />
          </div>
          <div style={{ fontSize: 12 }} className='text-center'>
            Don't have an account?{' '}
            <span
              onClick={() => !isLoading && navigate('/register')}
              style={{
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: 12,
                color: '#00B894',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              Sign up
            </span>
          </div>
        </div>
      </div>
    </Container>
  );
}

export default Login;
