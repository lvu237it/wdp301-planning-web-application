import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Typography, message, Layout } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import axios from 'axios';
import '../CSS/Log.css';
import { useCommon } from '../contexts/CommonContext';
import { useParams, Link, useLocation } from 'react-router-dom';
import { RiArrowGoBackLine } from 'react-icons/ri';

const { Title } = Typography;
const { Content } = Layout;

const SlidingAuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const { userDataLocal, navigate } = useCommon();

  const toggleForm = () => {
    setIsLogin(!isLogin);
    loginForm.resetFields();
    registerForm.resetFields();
  };

  const handleRegister = async (values) => {
    try {
      const response = await axios.post(
        'http://localhost:3000/authentication/register',
        values
      );
      message.success('Đăng ký thành công');
      setIsLogin(true);
    } catch (error) {
      message.error(error.response?.data?.message || 'Đăng ký thất bại');
    }
  };

  const handleLogin = async (values) => {
    try {
      const response = await axios.post(
        'http://localhost:3000/authentication/login',
        values
      );

      // Kiểm tra xem response có chứa dữ liệu không
      if (
        !response.data ||
        !response.data.accessToken ||
        !response.data.userData
      ) {
        throw new Error('Dữ liệu phản hồi không hợp lệ');
      }

      message.success('Đăng nhập thành công');

      // Lưu accessToken vào localStorage
      localStorage.setItem('accessToken', response.data.accessToken);

      // Trích xuất dữ liệu cần thiết từ userData
      const { _id, username, email } = response.data.userData;
      const role = response.data.role;
      const createdAt = response.data.createdAt;
      const description = response.data.description;

      const filteredUserData = {
        _id,
        username,
        email,
        role,
        createdAt,
        description,
      };

      // Lưu userData vào localStorage
      localStorage.setItem('userData', JSON.stringify(filteredUserData));

      // Điều hướng người dùng
      window.location.href = '/';
    } catch (error) {
      console.error('Lỗi đăng nhập:', error);
      message.error(error.response?.data?.message || 'Đăng nhập thất bại');
    }
  };

  useEffect(() => {
    if (userDataLocal) {
      navigate('/');
    }
  }, [userDataLocal]);

  return (
    <Layout>
      <Content>
        <button onClick={() => navigate('/')}>
          <RiArrowGoBackLine
            title='Quay lại trang chủ'
            className='ri-arrow-go-back-line-recipe-detail m-3'
            style={{
              fontSize: 32,
              padding: 5,
              borderRadius: '99%',
            }}
          />
        </button>

        <div className='auth-wrapper'>
          <div className={`container ${isLogin ? '' : 'right-panel-active'}`}>
            <div className='form-container sign-up-container'>
              <div>
                <Title level={2}>Đăng ký</Title>
                <Form
                  form={registerForm}
                  name='register-form'
                  onFinish={handleRegister}
                  layout='vertical'
                >
                  <Form.Item
                    name='username'
                    rules={[{ required: true, message: 'Nhập tên đăng nhập!' }]}
                  >
                    <Input
                      prefix={<UserOutlined />}
                      placeholder='Tên đăng nhập'
                    />
                  </Form.Item>
                  <Form.Item
                    name='email'
                    rules={[
                      { required: true, message: 'Nhập email!' },
                      { type: 'email', message: 'Email không hợp lệ!' },
                    ]}
                  >
                    <Input prefix={<UserOutlined />} placeholder='Email' />
                  </Form.Item>
                  <Form.Item
                    name='password'
                    rules={[{ required: true, message: 'Hãy nhập mật khẩu!' }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder='Mật khẩu'
                    />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type='primary'
                      htmlType='submit'
                      className='form-button'
                    >
                      Đăng ký
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            </div>
            <div className='form-container sign-in-container'>
              <div>
                <Title level={2}>Đăng nhập</Title>
                <Form
                  form={loginForm}
                  name='login-form'
                  onFinish={handleLogin}
                  layout='vertical'
                >
                  <Form.Item
                    name='email'
                    rules={[
                      { required: true, message: 'Nhập email!' },
                      { type: 'email', message: 'Email không hợp lệ!' },
                    ]}
                  >
                    <Input prefix={<UserOutlined />} placeholder='Email' />
                  </Form.Item>
                  <Form.Item
                    name='password'
                    rules={[{ required: true, message: 'Hãy nhập mật khẩu!' }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder='Mật khẩu'
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type='primary'
                      htmlType='submit'
                      className='form-button'
                    >
                      Đăng nhập
                    </Button>
                    <Button
                      style={{ marginTop: 10 }}
                      type='primary'
                      className='form-button'
                      onClick={() => navigate('/forgot')}
                    >
                      Quên mật khẩu?
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            </div>

            <div className='overlay-container'>
              <div className='overlay'>
                <div className='overlay-panel overlay-left'>
                  <Title level={2}>Chào mừng trở lại!</Title>
                  <p>Để giữ kết nối với chúng tôi, vui lòng đăng nhập.</p>
                  <Button ghost onClick={toggleForm}>
                    Đăng nhập
                  </Button>
                </div>
                <div className='overlay-panel overlay-right'>
                  <Title level={2}>Chào mừng bạn!</Title>
                  <p>Để kết nối với chúng tôi, vui lòng đăng ký tài khoản.</p>
                  <Button ghost onClick={toggleForm}>
                    Đăng ký
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Content>
    </Layout>
  );
};

export default SlidingAuthForm;
