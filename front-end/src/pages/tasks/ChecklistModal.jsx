import React, { useState, useEffect } from "react";
import axios from "axios";
import { Modal, Button, Form, Toast } from "react-bootstrap";
import { useCommon } from "../../contexts/CommonContext";

const ChecklistModal = ({ isOpen, onClose, task, onAdd }) => {
  const { accessToken, apiBaseUrl } = useCommon();
  const [text, setText] = useState("");
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (isOpen) setText("");
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
      setText("");
      setShowToast(true);
      onClose();
    } catch (err) {
      console.error(err);
      alert(
        "Lỗi khi thêm checklist: " +
          (err.response?.data?.message || err.message)
      );
    }
  };

  return (
    <>
      <Toast
        show={showToast}
        bg="success"
        autohide
        delay={3000}
        onClose={() => setShowToast(false)}
        style={{
          position: "fixed",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 2000,
          minWidth: "200px",
        }}
      >
        <Toast.Body className="text-white text-center">
          Thêm công việc thành công
        </Toast.Body>
      </Toast>

      <Modal show={isOpen} onHide={onClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>Thêm danh sách công việc</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group controlId="checklistTitle">
            <Form.Label>Tiêu đề</Form.Label>
            <Form.Control
              type="text"
              placeholder="Việc cần làm"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={handleAdd}>
            Thêm
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};
export default ChecklistModal;
