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
      setError('Token không hợp lệ');
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
      <Container className="py-5 text-center">
        <Spinner animation="border"/>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  if (result) {
    return (
      <Container className="py-5">
        <Alert variant="success">{result}</Alert>
      </Container>
    );
  }

  return (
    <Container className="py-5 d-flex justify-content-center">
      <Card style={{ width: 400 }}>
        <Card.Body className="text-center">
          <Card.Title>Xác nhận lời mời</Card.Title>
          <Card.Text>Bạn có muốn tham gia workspace này?</Card.Text>
          <div className="d-flex justify-content-around mt-4">
            <Button
              variant="success"
              onClick={() => handleAction('accept')}
            >
              Accept
            </Button>
            <Button
              variant="outline-secondary"
              onClick={() => handleAction('decline')}
            >
              Decline
            </Button>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default InviteResponse;
