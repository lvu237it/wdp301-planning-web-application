import { Container, Image, Form, Spinner } from 'react-bootstrap';
import logoWebProPlan from '/images/PlanPro-removebg-preview.png';
import { useCommon } from '../../contexts/CommonContext';
import { useEffect, useState } from 'react';

function Register() {
  const { navigate, register, userDataLocal, toast } = useCommon();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in, redirect to home
  useEffect(() => {
    if (userDataLocal) {
      navigate('/');
    }
  }, []);

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
    // Validate username
    if (!formData.username.trim()) {
      toast.error('Username is required');
      return false;
    }

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

    // Validate password confirmation
    if (!formData.passwordConfirm) {
      toast.error('Please confirm your password');
      return false;
    }
    if (formData.password !== formData.passwordConfirm) {
      toast.error('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsLoading(true);
      try {
        const success = await register(
          formData.username,
          formData.email,
          formData.password,
          formData.passwordConfirm
        );

        if (!success) {
          // Error message will be shown by the register function in CommonContext
          return;
        }
      } finally {
        setIsLoading(false);
      }
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
          <h5 className='text-center'>Create Account</h5>
          <div className='text-center mb-4'>
            Join us to manage your projects better
          </div>

          <Form onSubmit={handleSubmit}>
            <Form.Group className='mb-3'>
              <Form.Label>
                <i style={{ color: '#00B894' }} className='fas fa-user'></i>
                <span className='ms-2'>Username</span>
              </Form.Label>
              <Form.Control
                type='text'
                name='username'
                value={formData.username}
                onChange={handleChange}
                placeholder='Choose an username'
                disabled={isLoading}
              />
            </Form.Group>

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

            <Form.Group className='mb-4'>
              <Form.Label>
                <i style={{ color: '#00B894' }} className='fas fa-lock'></i>
                <span className='ms-2'>Password</span>
              </Form.Label>
              <Form.Control
                type='password'
                name='password'
                value={formData.password}
                onChange={handleChange}
                placeholder='Create a password'
                disabled={isLoading}
              />
            </Form.Group>

            <Form.Group className='mb-4'>
              <Form.Label>
                <i style={{ color: '#00B894' }} className='fas fa-lock'></i>
                <span className='ms-2'>Confirm Password</span>
              </Form.Label>
              <Form.Control
                type='password'
                name='passwordConfirm'
                value={formData.passwordConfirm}
                onChange={handleChange}
                placeholder='Confirm your password'
                disabled={isLoading}
              />
            </Form.Group>

            <button
              type='submit'
              className='w-100 button-login border-0 mb-3 d-flex align-items-center justify-content-center'
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
              {isLoading ? (
                <Spinner
                  as='span'
                  animation='border'
                  size='sm'
                  role='status'
                  aria-hidden='true'
                />
              ) : (
                'Create Account'
              )}
            </button>
          </Form>

          <div style={{ fontSize: 12 }} className='text-center'>
            Already have an account?{' '}
            <span
              onClick={() => !isLoading && navigate('/login')}
              style={{
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: 12,
                color: '#00B894',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              Login
            </span>
          </div>
        </div>
      </div>
    </Container>
  );
}

export default Register;
