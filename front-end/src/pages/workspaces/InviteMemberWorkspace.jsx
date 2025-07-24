// src/pages/workspaces/InviteMemberModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { useCommon } from '../../contexts/CommonContext';
import axios from 'axios';

const InviteMemberModal = ({ show, onHide, workspaceId }) => {
  const { apiBaseUrl, accessToken, toast } = useCommon();
  const [email, setEmail] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Debounce + fetch gợi ý user theo prefix email
  // useEffect(() => {
  //   if (email.length < 2) {
  //     setSuggestions([]);
  //     return;
  //   }
  //   const timer = setTimeout(async () => {
  //     setLoadingSuggest(true);
  //     try {
  //       const res = await axios.get(
  //         `${apiBaseUrl}/users/search`,
  //         {
  //           params: { query: email },
  //           headers: { Authorization: `Bearer ${accessToken}` }
  //         }
  //       );
  //       setSuggestions(res.data.users || []);
  //     } catch (err) {
  //       console.error(err);
  //     } finally {
  //       setLoadingSuggest(false);
  //     }
  //   }, 300);
  //   return () => clearTimeout(timer);
  // }, [email, apiBaseUrl, accessToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(
        `${apiBaseUrl}/workspace/${workspaceId}/invite`,
        { email }, // nếu bạn muốn cho chọn role: thêm role field
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast.success('Invitation sent successfully');
      onHide();
      setEmail('');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered className='modern-modal'>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Invite Member</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group controlId='inviteEmail'>
            <Form.Label>Email</Form.Label>
            <Form.Control
              type='email'
              placeholder='Enter email...'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              list='invite-suggestions'
              required
            />
            <datalist id='invite-suggestions'>
              {loadingSuggest && <option>Finding…</option>}
              {suggestions.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.username}
                </option>
              ))}
            </datalist>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant='secondary' onClick={onHide} disabled={submitting}>
            Cancel
          </Button>
          <Button type='submit' variant='primary' disabled={submitting}>
            {submitting ? (
              <Spinner animation='border' size='sm' />
            ) : (
              'Send Invite'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default InviteMemberModal;
