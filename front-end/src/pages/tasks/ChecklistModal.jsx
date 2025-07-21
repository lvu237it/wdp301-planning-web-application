import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Modal, Button, Form, Toast } from 'react-bootstrap';
import { useCommon } from '../../contexts/CommonContext';

const ChecklistModal = ({ isOpen, onClose, task, onAdd }) => {
  const { accessToken, apiBaseUrl } = useCommon();
  const [text, setText] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (isOpen) setText('');
  }, [isOpen]);

  const handleAdd = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const newChecklist = Array.isArray(task.checklist)
        ? [...task.checklist]
        : [];
      newChecklist.push({ title: trimmed, completed: false });

      const res = await axios.put(
        `${apiBaseUrl}/task/updateTask/${task._id}`,
        { checklist: newChecklist },
        {
          withCredentials: true,
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      onAdd(res.data.data);
      setText('');
      setShowToast(true);
      onClose();
    } catch (err) {
      console.error(err);
      alert(
        'Error adding checklist: ' +
          (err.response?.data?.message || err.message)
      );
    }
  };

  return (
    <>
      <Toast
        show={showToast}
        bg='success'
        autohide
        delay={3000}
        onClose={() => setShowToast(false)}
        style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2000,
          minWidth: '200px',
        }}
      >
        <Toast.Body className='text-white text-center'>
          Add checklist successfully
        </Toast.Body>
      </Toast>

      <Modal show={isOpen} onHide={onClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>Create new Assignment</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group controlId='checklistTitle'>
            <Form.Control
              type='text'
              placeholder='Type your name assignment'
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant='primary' onClick={handleAdd}>
            Add
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};
export default ChecklistModal;
