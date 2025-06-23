// src/pages/workspaces/BoardInviteResponse.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Container, Card, Button, Spinner, Alert } from 'react-bootstrap';
import axios from 'axios';
import { useCommon } from '../../contexts/CommonContext';

const BoardInviteResponse = () => {
  const { apiBaseUrl, accessToken, toast } = useCommon();
  const { workspaceId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'accepted' | 'declined'
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Thiếu token xác nhận.');
    }
  }, [token]);

  const handleAction = async (action) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(
        `${apiBaseUrl}/workspace/${workspaceId}/board/invite-response`,
        { token, action },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setStatus(res.data.status); // 'accepted' hoặc 'declined'
      toast.success(res.data.message);
      // Sau 2s quay về list boards
      setTimeout(() => navigate(`/workspace/${workspaceId}/boards`), 2000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Lỗi server');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  if (status) {
    return (
      <Container className="py-5">
        <Card className="text-center p-4">
          <Card.Body>
            <Card.Title>
              Lời mời đã {status === 'accepted' ? 'được chấp nhận' : 'bị từ chối'}!
            </Card.Title>
            <Card.Text>
              Bạn sẽ được chuyển về trang Boards trong giây lát…
            </Card.Text>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="py-5 d-flex justify-content-center">
      <Card style={{ width: '100%', maxWidth: 500 }}>
        <Card.Body className="text-center">
          <Card.Title>Bạn có muốn tham gia Board này?</Card.Title>
          <Card.Text>
            Nhấn “Accept” để tham gia với quyền read-only, hoặc “Decline” để từ chối.
          </Card.Text>
          {loading ? (
            <Spinner animation="border" />
          ) : (
            <>
              <Button
                variant="success"
                className="me-2"
                onClick={() => handleAction('accept')}
              >
                Accept
              </Button>
              <Button
                variant="danger"
                onClick={() => handleAction('decline')}
              >
                Decline
              </Button>
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default BoardInviteResponse;
