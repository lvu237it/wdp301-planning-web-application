import React, { useState, useEffect } from 'react';
import { Modal, Button, Spinner, Alert } from 'react-bootstrap';
import Select from 'react-select';
import axios from 'axios';
import { useCommon } from '../../contexts/CommonContext';

const InviteBoardModal = ({
  show,
  onHide,
  workspaceId,
  boardId,
  onInvited,
}) => {
  const { apiBaseUrl, accessToken } = useCommon();

  const [qualifiedOptions, setQualifiedOptions] = useState([]);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // NEW: state cho lỗi invite
  const [inviteError, setInviteError] = useState(null);

  useEffect(() => {
    if (!show) return;
    setLoadingUsers(true);
    setFetchError(null);
    setInviteError(null);               // reset lỗi khi mở lại modal

    axios
      .get(
        `${apiBaseUrl}/workspace/${workspaceId}/board/${boardId}/qualified-users`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      .then((res) => {
        const opts = (res.data.users || []).map((u) => ({
          label: `${u.username} (${u.email})`,
          value: u.email,
        }));
        setQualifiedOptions(opts);
      })
      .catch((err) => {
        setFetchError(err.response?.data?.message || 'Không lấy được danh sách users');
      })
      .finally(() => setLoadingUsers(false));
  }, [show, workspaceId, boardId]);

  const handleHide = () => {
    setSelectedOptions([]);
    onHide();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setInviteError(null);               // reset lỗi mới
    if (!selectedOptions.length) {
      setInviteError('Chọn ít nhất một user');
      return;
    }
    setInviting(true);
    try {
      const emails = selectedOptions.map((o) => o.value);
      await axios.post(
        `${apiBaseUrl}/workspace/${workspaceId}/board/${boardId}/invite`,
        { emails },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      onInvited?.();
      handleHide();
    } catch (err) {
      // ONLY show backend message
      const msg = err.response?.data?.message || 'Lỗi server';
      setInviteError(msg);
    } finally {
      setInviting(false);
    }
  };

  return (
    <Modal show={show} onHide={handleHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Invite Qualified Users to Board</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {loadingUsers ? (
          <div className="text-center py-4">
            <Spinner animation="border" />
          </div>
        ) : fetchError ? (
          <Alert variant="danger">{fetchError}</Alert>
        ) : qualifiedOptions.length === 0 ? (
          <Alert variant="info">
            Không có user nào thỏa mãn tiêu chí của board này.
          </Alert>
        ) : (
          <>
            <Select
              isMulti
              options={qualifiedOptions}
              value={selectedOptions}
              onChange={setSelectedOptions}
              placeholder="Chọn user để gửi lời mời…"
              isDisabled={inviting}
            />

            {/* NEW: hiển thị lỗi invite nếu có */}
            {inviteError && (
              <Alert className="mt-3" variant="danger">
                {inviteError}
              </Alert>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={handleHide} disabled={inviting}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={inviting || loadingUsers || qualifiedOptions.length === 0}
        >
          {inviting ? <Spinner animation="border" size="sm" /> : 'Send Invites'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default InviteBoardModal;