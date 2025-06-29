import React, { useState, useEffect } from "react";
import axios from "axios";
import { useCommon } from "../../contexts/CommonContext";
import { Modal, Button, Form, Toast } from "react-bootstrap";

const pad = (n) => n.toString().padStart(2, "0");
const toDateTimeLocal = (date) => {
  if (!date) return "";
  const Y = date.getFullYear(),
    M = pad(date.getMonth() + 1),
    D = pad(date.getDate()),
    h = pad(date.getHours()),
    m = pad(date.getMinutes());
  return `${Y}-${M}-${D}T${h}:${m}`;
};
const toDateLocal = (date) => {
  if (!date) return "";
  const Y = date.getFullYear(),
    M = pad(date.getMonth() + 1),
    D = pad(date.getDate());
  return `${Y}-${M}-${D}`;
};

const Deadline = ({ show, onClose, task, mergeTask, onUpdate }) => {
  const { accessToken, apiBaseUrl } = useCommon();
  const [allDay, setAllDay] = useState(false);
  const [dateInput, setDateInput] = useState("");
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Khởi tạo khi modal bật
  useEffect(() => {
    if (!show || !task) return;
    setAllDay(!!task.allDay);
    if (task.startDate) setStartInput(toDateTimeLocal(new Date(task.startDate)));
    if (task.endDate) setEndInput(toDateTimeLocal(new Date(task.endDate)));
    if (task.allDay && task.startDate) setDateInput(toDateLocal(new Date(task.startDate)));
  }, [show, task]);

  const handleSaveDates = async () => {
    const payload = { allDay };
    if (allDay && dateInput) {
      const [Y, M, D] = dateInput.split("-").map(Number);
      payload.startDate = new Date(Y, M - 1, D, 0, 0).toISOString();
      payload.endDate = new Date(Y, M - 1, D, 23, 59).toISOString();
    } else {
      if (startInput) payload.startDate = new Date(startInput).toISOString();
      if (endInput) payload.endDate = new Date(endInput).toISOString();
    }
    try {
      const res = await axios.put(
        `${apiBaseUrl}/task/updateTask/${task._id}`,
        payload,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const updated = res.data.data;
      onUpdate(mergeTask(updated));
      setToastMsg("Cập nhật ngày thành công");
      setShowToast(true);
      onClose();
    } catch (err) {
      console.error(err);
      setToastMsg(
        "Cập nhật ngày thất bại: " + (err.response?.data?.message || err.message)
      );
      setShowToast(true);
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
                Cập nhật thời gian thành công
              </Toast.Body>
            </Toast>
      <Modal show={show} centered onHide={onClose}>
        <Modal.Header closeButton>
          <Modal.Title>Chọn ngày</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!allDay ? (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Ngày bắt đầu</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Ngày kết thúc</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                />
              </Form.Group>
            </>
          ) : (
            <Form.Group className="mb-3">
              <Form.Label>Chọn ngày</Form.Label>
              <Form.Control
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
            </Form.Group>
          )}
          <Form.Check
            className="mt-2"
            type="checkbox"
            label="Cả ngày"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={handleSaveDates}>
            Lưu
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Deadline;
