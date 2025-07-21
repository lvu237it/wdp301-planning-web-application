// src/pages/invite/InviteResponse.jsx
import React, { useState } from 'react';
import { useCommon } from '../../contexts/CommonContext';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Container, Card, Spinner, Button, Alert } from 'react-bootstrap';

const InviteResponse = () => {
  const { apiBaseUrl, accessToken, toast } = useCommon();
  const location = useLocation();
  const navigate = useNavigate();

  // token lấy từ ?token=...
  const token = new URLSearchParams(location.search).get('token');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleAction = async (action) => {
    if (!token) {
      setError('Invalid token');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(
        `${apiBaseUrl}/workspace/invite-response`,
        { token, action },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setResult(res.data.message);
      toast.success(res.data.message);
      // quay về danh sách workspace sau 1s
      setTimeout(() => navigate('/workspaces'), 1000);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className='invite-response-page'>
        <div className='invite-response-loading'>
          <Spinner animation='border' />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='invite-response-page'>
        <Container className='py-5'>
          <Alert variant='danger' className='invite-response-alert error'>
            {error}
          </Alert>
        </Container>
      </div>
    );
  }

  if (result) {
    return (
      <div className='invite-response-page'>
        <Container className='py-5'>
          <Alert variant='success' className='invite-response-alert success'>
            {result}
          </Alert>
        </Container>
      </div>
    );
  }

  return (
    <div className='invite-response-page'>
      <Container className='py-5 d-flex justify-content-center'>
        <Card className='invite-response-card'>
          <Card.Body className='text-center'>
            <Card.Title className='invite-response-title'>
              Xác nhận lời mời
            </Card.Title>
            <Card.Text className='invite-response-text'>
              Bạn có muốn tham gia workspace này?
            </Card.Text>
            <div className='invite-response-actions'>
              <Button
                variant='success'
                className='invite-response-btn accept'
                onClick={() => handleAction('accept')}
              >
                Accept
              </Button>
              <Button
                variant='outline-secondary'
                className='invite-response-btn decline'
                onClick={() => handleAction('decline')}
              >
                Decline
              </Button>
            </div>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
};

export default InviteResponse;
