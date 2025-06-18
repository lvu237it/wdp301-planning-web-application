import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "../../styles/task.css";
import { useCommon } from "../../contexts/CommonContext";
import { Modal, Button, Form } from "react-bootstrap";
import ChecklistModal from "./ChecklistModal";

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
const parseLocalToUTC = (s) => {
  const [date, time] = s.split("T");
  const [Y, M, D] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  return new Date(Date.UTC(Y, M - 1, D, h, m));
};

const TaskModal = ({ isOpen, task, onClose, onUpdate }) => {
  const { accessToken, apiBaseUrl } = useCommon();

  // States chung
  const [editedTitle, setEditedTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedDesc, setEditedDesc] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [showDateInputs, setShowDateInputs] = useState(false);
  const [allDay, setAllDay] = useState(false);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [showChecklistModal, setShowChecklistModal] = useState(false);

  // Khởi động khi task thay đổi
  useEffect(() => {
    if (!task) return;
    setEditedTitle(task.title || "");
    setIsEditingTitle(false);
    setEditedDesc(task.description || "");
    setIsEditingDesc(false);
    setAllDay(!!task.allDay);

    const s = task.startDate ? new Date(task.startDate) : null;
    const e = task.endDate ? new Date(task.endDate) : null;
    setStartInput(toDateTimeLocal(s));
    setEndInput(toDateTimeLocal(e));
    setDateInput(toDateLocal(s));
    setShowDateInputs(false);
  }, [task]);

  if (!isOpen || !task) return null;

  const isOverdue = task.endDate && new Date(task.endDate) < new Date();
  const formatBadge = (iso) => {
    if (!iso) return "";
    return new Date(iso)
      .toLocaleString("vi-VN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      })
      .replace(",", "");
  };
  // ===== SAVE TITLE =====
  const handleSaveTitle = async () => {
    try {
      const res = await axios.put(
        `${apiBaseUrl}/task/updateTask/${task._id}`,
        { title: editedTitle.trim() },
        {
          withCredentials: true,
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      onUpdate({
        ...task,
        ...res.data.data,
      });
      setIsEditingTitle(false);
    } catch (err) {
      console.error(err);
      alert(
        "Cập nhật tiêu đề thất bại: " +
          (err.response?.data?.message || err.message)
      );
    }
  };

  // HANDLE DESCRIPTION
  const handleSaveDesc = async () => {
  try {
    const res = await axios.put(
      `${apiBaseUrl}/task/updateTask/${task._id}`,
      { description: editedDesc.trimEnd() },
      {
        withCredentials: true,
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    onUpdate({ ...task, ...res.data.data });
    setIsEditingDesc(false);
  } catch (err) {
    console.error(err);
    alert(
      "Cập nhật mô tả thất bại: " +
        (err.response?.data?.message || err.message)
    );
  }
};


  //HANDLE DATES
  const handleSaveDates = async () => {
    try {
      const payload = {};
      if (allDay && dateInput) {
        payload.startDate = parseLocalToUTC(dateInput + "T00:00").toISOString();
        payload.endDate = parseLocalToUTC(dateInput + "T23:59").toISOString();
      } else {
        if (startInput)
          payload.startDate = parseLocalToUTC(startInput).toISOString();
        if (endInput) payload.endDate = parseLocalToUTC(endInput).toISOString();
      }
      payload.allDay = allDay;

      const res = await axios.put(
        `${apiBaseUrl}/task/updateTask/${task._id}`,
        payload,
        {
          withCredentials: true,
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      onUpdate(res.data.data);
      setShowDateInputs(false);
    } catch (err) {
      console.error(err);
      alert(
        "Cập nhật ngày thất bại: " +
          (err.response?.data?.message || err.message)
      );
    }
  };

  //CHECKLIST PROGRESS
  const totalItems = task.checklist?.length || 0;
  const doneCount = task.checklist?.filter((i) => i.completed).length || 0;
  const percentDone = totalItems
    ? Math.round((doneCount / totalItems) * 100)
    : 0;

  //CHECKLIST TOGGLE / DELETE
  const updateChecklist = async (newChecklist) => {
    const res = await axios.put(
      `${apiBaseUrl}/task/updateTask/${task._id}`,
      { checklist: newChecklist },
      {
        withCredentials: true,
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    onUpdate(res.data.data);
  };
  const handleToggleChecklist = async (item) => {
    const updated = task.checklist.map((i) =>
      i._id === item._id ? { ...i, completed: !i.completed } : i
    );
    try {
      await updateChecklist(updated);
    } catch (e) {
      console.error(e);
      alert(
        "Không thể cập nhật checklist: " +
          (e.response?.data?.message || e.message)
      );
    }
  };
  const handleDeleteChecklist = async (item) => {
    const updated = task.checklist.filter((i) => i._id !== item._id);
    try {
      await updateChecklist(updated);
    } catch (e) {
      console.error(e);
      alert("Không thể xóa mục: " + (e.response?.data?.message || e.message));
    }
  };

  return (
    <>
      <div className="task-modal-overlay" onClick={onClose}>
        <div className="task-modal" onClick={(e) => e.stopPropagation()}>
          {/* HEADER */}
          <div className="task-modal-header">
            <div value={task.listId}>{task.listTitle}</div>
            <div className="task-modal-header-actions">
              <button className="icon-btn" onClick={onClose}>
                <i className="fas fa-times" />
              </button>
            </div>
          </div>

          {/* BODY */}
          <div className="task-modal-body">
            <div
              className="task-title-wrapper"
              style={{ display: "flex", alignItems: "center", gap: 8 , marginBottom:"16px"}}
            >
              {isEditingTitle ? (
                <>
                  <Form.Control
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    style={{ flexGrow: 1 }}
                  />
                  <Button variant="success" size="sm" onClick={handleSaveTitle}>
                    Lưu
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setIsEditingTitle(false);
                      setEditedTitle(task.title);
                    }}
                    style={{ marginLeft: 4 }}
                  >
                    Hủy
                  </Button>
                </>
              ) : (
                <>
                  <h2 className="task-modal-title" style={{ margin: 0 }}>
                    {task.title}
                  </h2>
                  <button
                    className="icon-btn-taskTitle"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingTitle(true);
                    }}
                  >
                   <i className="fas fa-pen fa-lg text-secondary" />
                  </button>
                </>
              )}
            </div>

            {/* ACTION BUTTONS */}
            <div className="task-modal-actions">
              <Button variant="warning" className="btn-action">
                <i className="fas fa-person" /> Thêm Member
              </Button>
              <Button variant="secondary" className="btn-action">
                <i className="fas fa-tag" /> Nhãn
              </Button>
              {task.endDate ? (
                <div
                  className={`due-badge ${isOverdue ? "overdue" : ""}`}
                  onClick={() => setShowDateInputs(true)}
                >
                  {formatBadge(task.endDate)}
                  <i
                    className="fas fa-chevron-down"
                    style={{ marginLeft: 6 }}
                  />
                </div>
              ) : (
                <Button
                  className="btn-action"
                  onClick={() => setShowDateInputs((v) => !v)}
                >
                  <i className="fas fa-clock" /> Ngày
                </Button>
              )}
              <Button
                variant="success"
                className="icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowChecklistModal(true);
                }}
              >
                <i className="fas fa-list" /> Việc cần làm
              </Button>
            </div>

            {/* modal chọn deadline */}
            <Modal
              show={showDateInputs}
              onHide={() => setShowDateInputs(false)}
              centered
            >
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
                <Button
                  variant="secondary"
                  onClick={() => setShowDateInputs(false)}
                >
                  Hủy
                </Button>
              </Modal.Footer>
            </Modal>

            {/* DESCRIPTION */}
            <div className="task-modal-section">
              <label className="section-label">Mô tả</label>
              {isEditingDesc ? (
                <>
                  <textarea
                    className="section-textarea"
                    value={editedDesc}
                    onChange={(e) => setEditedDesc(e.target.value)}
                  />
                  <div className="edit-actions">
                    <Button variant="success" onClick={handleSaveDesc}>
                      Lưu
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setIsEditingDesc(false)}
                      style={{ marginLeft: 8 }}
                    >
                      Hủy
                    </Button>
                  </div>
                </>
              ) : (
                <div className="desc-view1">
                  <div className="desc-view">
                    <p>{task.description || "Chưa có mô tả."}</p>
                  </div>
                  <Button
                    style={{ marginTop: "10px" }}
                    className="btn-edit-desc"
                    onClick={() => setIsEditingDesc(true)}
                  >
                    Chỉnh sửa
                  </Button>
                </div>
              )}
            </div>

            {/* CHECKLIST */}
            <div className="task-modal-section">
              <label className="section-label">Tiến độ công việc</label>
              {totalItems ? (
                <>
                  <div className="checklist-progress">
                    <div className="progress">
                      <div
                        className="progress-bar"
                        role="progressbar"
                        style={{ width: `${percentDone}%` }}
                      />
                    </div>
                    <span className="ms-2">{percentDone}%</span>
                  </div>
                  <ul className="checklist-list">
                    {task.checklist.map((item) => (
                      <li
                        key={item._id}
                        className="d-flex align-items-center mb-1"
                      >
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => handleToggleChecklist(item)}
                          className="form-check-input me-2"
                        />
                        <span
                          style={{
                            textDecoration: item.completed
                              ? "line-through"
                              : "none",
                            flexGrow: 1,
                          }}
                        >
                          {item.title}
                        </span>
                        <button
                          className="btn btn-sm btn-link text-danger"
                          onClick={() => handleDeleteChecklist(item)}
                        >
                          Xóa
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p
                  style={{ textAlign: "center", fontWeight: "bold" }}
                  className="text-muted"
                >
                  Chưa có công việc nào.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Thêm checklist */}
      <ChecklistModal
        isOpen={showChecklistModal}
        onClose={() => setShowChecklistModal(false)}
        task={task}
        onAdd={(updated) => {
          onUpdate(updated);
          setShowChecklistModal(false);
        }}
      />
    </>
  );
};

export default TaskModal;
