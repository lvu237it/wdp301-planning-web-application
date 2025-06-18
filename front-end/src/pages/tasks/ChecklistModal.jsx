import React, { useState, useEffect } from "react";
import axios from "axios";
import { Modal, Button, Form } from "react-bootstrap";
import { useCommon } from "../../contexts/CommonContext";

const ChecklistModal = ({ isOpen, onClose, task, onAdd }) => {
  const { accessToken, apiBaseUrl } = useCommon();
  const [text, setText] = useState("");
  const [copyFromId, setCopyFromId] = useState("");
  const [tasksList, setTasksList] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    axios
      .get(`${apiBaseUrl}/task/get-by-board/${task.boardId}`, {
        withCredentials: true,
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((res) => {
        if (res.data.status === "success") {
          setTasksList(
            res.data.data.filter(
              (t) =>
                t._id !== task._id &&
                Array.isArray(t.checklist) &&
                t.checklist.length
            )
          );
        }
      })
      .catch(console.error);
  }, [isOpen, apiBaseUrl, accessToken, task.boardId, task._id]);

  const handleAdd = async () => {
    try {
      const newChecklist = (task.checklist || []).slice();

      if (copyFromId) {
        const from = tasksList.find((t) => t._id === copyFromId);
        newChecklist.push(...from.checklist);
      }
      if (text.trim()) {
        newChecklist.push({ title: text.trim(), completed: false });
      }

      const res = await axios.put(
        `${apiBaseUrl}/task/updateTask/${task._id}`,
        { checklist: newChecklist },
        {
          withCredentials: true,
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      onAdd(res.data.data);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Lỗi khi thêm checklist: " + err.response?.data?.message || err.message);
    }
  };

  return (
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
        <Form.Group controlId="copyFrom" className="mt-3">
          <Form.Label>Sao chép nhiệm vụ</Form.Label>
          <Form.Select
            value={copyFromId}
            onChange={(e) => setCopyFromId(e.target.value)}
          >
            <option value="">(Chọn nhiệm vụ)</option>
            {tasksList.map((t) => (
              <option key={t._id} value={t._id}>
                {t.title}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={handleAdd}>
          Thêm
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ChecklistModal;
