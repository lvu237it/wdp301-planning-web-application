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

const Deadline = ({
  show,
  onClose,
  task,
  // mergeTask,
  // onUpdate,
  refreshTaskData, 
  minDate,
  maxDate,
}) => {
  const { accessToken, apiBaseUrl } = useCommon();
  const [allDay, setAllDay] = useState(false);
  const [dateInput, setDateInput] = useState("");
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  useEffect(() => {
    if (!show || !task) return;
    setAllDay(!!task.allDay);
    if (task.startDate) setStartInput(toDateTimeLocal(new Date(task.startDate)));
    if (task.endDate) setEndInput(toDateTimeLocal(new Date(task.endDate)));
    if (task.allDay && task.startDate)
      setDateInput(toDateLocal(new Date(task.startDate)));
  }, [show, task]);

  const handleSaveDates = async () => {
    const payload = { allDay };
    let startDate, endDate;

    if (allDay && dateInput) {
      const [Y, M, D] = dateInput.split("-").map(Number);
      startDate = new Date(Y, M - 1, D, 0, 0);
      endDate = new Date(Y, M - 1, D, 23, 59);
      payload.startDate = startDate.toISOString();
      payload.endDate = endDate.toISOString();
    } else {
      if (startInput) startDate = new Date(startInput);
      if (endInput) endDate = new Date(endInput);
      if (startDate) payload.startDate = startDate.toISOString();
      if (endDate) payload.endDate = endDate.toISOString();
    }

    if (startDate && endDate && startDate > endDate) {
      setToastMsg("Ngày bắt đầu không được sau ngày kết thúc");
      setShowToast(true);
      return;
    }

    try {
      const res = await axios.put(
        `${apiBaseUrl}/task/updateTask/${task._id}`,
        payload,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      // const updated = res.data.data;
      // onUpdate(mergeTask(updated));
      await refreshTaskData();

      setToastMsg("Cập nhật ngày thành công");
      setShowToast(true);
      onClose();
    } catch (err) {
      console.error(err);
      setToastMsg("Cập nhật ngày thất bại");
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
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 2000,
          minWidth: "240px"
        }}
      >
        <Toast.Body className="text-white text-center">
          {toastMsg}
        </Toast.Body>
      </Toast>

      <Modal show={show} centered onHide={onClose}>
        <Modal.Header closeButton>
          <Modal.Title>Select deadline</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!allDay ? (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Start Date</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={startInput}
                  min={toDateTimeLocal(new Date(minDate))}
                  max={toDateTimeLocal(new Date(maxDate))}
                  onChange={(e) => setStartInput(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>End Date</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={endInput}
                  min={toDateTimeLocal(new Date(minDate))}
                  max={toDateTimeLocal(new Date(maxDate))}
                  onChange={(e) => setEndInput(e.target.value)}
                />
              </Form.Group>
            </>
          ) : (
            <Form.Group className="mb-3">
              <Form.Label>All Day</Form.Label>
              <Form.Control
                type="date"
                value={dateInput}
                min={minDate.substr(0, 10)}
                max={maxDate.substr(0, 10)}
                onChange={(e) => setDateInput(e.target.value)}
              />
            </Form.Group>
          )}
          <Form.Check
            className="mt-2"
            type="checkbox"
            label="All Day"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={handleSaveDates}>
            Save
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Deadline;
