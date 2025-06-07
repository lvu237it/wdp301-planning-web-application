import { Container, Image, Form } from 'react-bootstrap';
import logoWebProPlan from '/images/PlanPro-removebg-preview.png';
import { useCommon } from '../../contexts/CommonContext';

function Register() {
  const { navigate } = useCommon();
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

          <Form.Group className='mb-3'>
            <Form.Label>
              <i style={{ color: '#00B894' }} class='fas fa-user'></i>
              <span className='ms-2'>Username</span>
            </Form.Label>
            <Form.Control type='text' placeholder='Choose an username' />
          </Form.Group>

          <Form.Group className='mb-3'>
            <Form.Label>
              <i style={{ color: '#00B894' }} class='fas fa-envelope'></i>
              <span className='ms-2'>Email</span>
            </Form.Label>
            <Form.Control type='text' placeholder='Enter your email' />
          </Form.Group>

          <Form.Group className='mb-4'>
            <Form.Label>
              <i style={{ color: '#00B894' }} class='fas fa-lock'></i>
              <span className='ms-2'>Password</span>
            </Form.Label>
            <Form.Control type='text' placeholder='Create a password' />
          </Form.Group>

          <Form.Group className='mb-4'>
            <Form.Label>
              <i style={{ color: '#00B894' }} class='fas fa-lock'></i>
              <span className='ms-2'>Confirm Password</span>
            </Form.Label>
            <Form.Control type='text' placeholder='Confirm your password' />
          </Form.Group>

          <button
            className='w-100 button-login border-0 mb-3'
            style={{
              backgroundColor: '#00B894',
              color: 'white',
              borderRadius: 5,
              padding: '6px 0',
            }}
          >
            Create Account
          </button>

          <div style={{ fontSize: 12 }} className='text-center'>
            Already have an account?{' '}
            <span
              onClick={() => navigate('/login')}
              style={{ cursor: 'pointer', fontSize: 12, color: '#00B894' }}
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
