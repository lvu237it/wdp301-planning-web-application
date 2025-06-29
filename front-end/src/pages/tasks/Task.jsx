import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "../../styles/task.css";
import { useCommon } from "../../contexts/CommonContext";
import { Modal, Button, Form, Toast } from "react-bootstrap";
import ChecklistModal from "./ChecklistModal";
import SuggestMembersBySkills from "./SuggestMemberBySkills";
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
const parseLocalToUTC = (s) => new Date(s + ":00Z");

const TaskModal = ({ isOpen, task, onClose, onUpdate }) => {
  const { accessToken, apiBaseUrl } = useCommon();
  const fileInputRef = useRef(null);
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
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  useEffect(() => {
    if (isOpen && task) {
      setEditedTitle(task.title);
      setEditedDesc(task.description || "");
      if (task.startDate) {
        const s = new Date(task.startDate);
        setDateInput(toDateLocal(s));
        setStartInput(toDateTimeLocal(s));
      }
      if (task.endDate) {
        setEndInput(toDateTimeLocal(new Date(task.endDate)));
      }
      setAllDay(!!task.allDay);
    }
  }, [isOpen, task]);

  useEffect(() => {
    if (showDateInputs && task) {
      const s = task.startDate ? new Date(task.startDate) : null;
      const e = task.endDate ? new Date(task.endDate) : null;
      setAllDay(!!task.allDay);
      setStartInput(toDateTimeLocal(s));
      setEndInput(toDateTimeLocal(e));
      setDateInput(toDateLocal(s));
    }
  }, [showDateInputs, task]);
  if (!isOpen || !task) return null;

  const mergeTask = (updatedFields) => ({
    ...task,
    ...updatedFields,
    // assignedTo: task.assignedTo,
    assignedBy: task.assignedBy,
  });

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
      onUpdate(mergeTask(res.data.data));
      setToastMessage("Cập nhật tiêu đề thành công");
      setShowToast(true);
      setIsEditingTitle(false);
    } catch (err) {
      console.error(err);
      alert(
        "Cập nhật tiêu đề thất bại: " +
          (err.response?.data?.message || err.message)
      );
    }
  };
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));

    try {
      const res = await axios.post(`${apiBaseUrl}/file/upload`, formData, {
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "multipart/form-data",
        },
      });
      onUpdate(mergeTask(res.data.data));
    } catch (err) {
      console.error("Upload file error:", err);
      alert(
        "Upload file thất bại: " + (err.response?.data?.message || err.message)
      );
    } finally {
      e.target.value = null;
    }
  };

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
      onUpdate(mergeTask(res.data.data));
      setIsEditingDesc(false);
      setToastMessage("Cập nhật mô tả thành công");
      setShowToast(true);
    } catch (err) {
      console.error(err);
      alert(
        "Cập nhật mô tả thất bại: " +
          (err.response?.data?.message || err.message)
      );
    }
  };

  // Hàm lưu ngày với thông báo thành công
  const handleSaveDates = async () => {
    try {
      const payload = {};
      payload.allDay = allDay;

      if (allDay && dateInput) {
        const [Y, M, D] = dateInput.split("-").map(Number);
        payload.startDate = new Date(Y, M - 1, D, 0, 0).toISOString();
        payload.endDate = new Date(Y, M - 1, D, 23, 59).toISOString();
      } else {
        if (startInput) payload.startDate = new Date(startInput).toISOString();
        if (endInput) payload.endDate = new Date(endInput).toISOString();
      }

      const res = await axios.put(
        `${apiBaseUrl}/task/updateTask/${task._id}`,
        payload,
        {
          withCredentials: true,
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      onUpdate(mergeTask(res.data.data));
      setToastMessage("Cập nhật ngày thành công");
      setShowToast(true);
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
    onUpdate(mergeTask(res.data.data));
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

  const handleAssign = async (user) => {
    try {
      const res = await axios.post(
        `${apiBaseUrl}/task/${task._id}/assign`,
        { email: user.email },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const updatedFields = res.data.data;
      onUpdate({
        ...task,
        ...updatedFields,
        assignedTo: user,
      });
      setToastMessage(`Đã giao task cho ${user.username || user.email}`);
      setShowToast(true);
      setShowInviteModal(false);
    } catch (err) {
      console.error("Giao task thất bại:", err);
      alert(
        "Giao task thất bại: " + (err.response?.data?.message || err.message)
      );
    }
  };

  return (
    <>
      <Modal
        show={showInviteModal}
        onHide={() => setShowInviteModal(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Gợi ý & Mời thành viên theo kỹ năng</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <SuggestMembersBySkills
            workspaceId={task.workspaceId}
            boardId={task.boardId}
            onAssignSuccess={handleAssign}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowInviteModal(false)}>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>

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
          {toastMessage}
        </Toast.Body>
      </Toast>
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
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: "16px",
              }}
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
                      setEditedTitle(task.title); // ← reset về giá trị gốc
                    }}
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
                      setEditedTitle(task.title); // ← khởi tạo giá trị
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
              <Button
                variant="warning"
                className="btn-action"
                onClick={() => setShowInviteModal(true)}
              >
                <i className="fas fa-person" /> Thêm Member
              </Button>
              <Button
                variant="secondary"
                className="btn-action"
                onClick={() => fileInputRef.current?.click()}
              >
                <i className="fas fa-file" /> Tệp đính kèm
              </Button>

              {/* input ẩn để trigger file picker */}
              <input
                type="file"
                ref={fileInputRef}
                multiple
                style={{ display: "none" }}
                onChange={handleFileChange}
              />

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
                      onClick={() => {
                        setIsEditingDesc(false);
                        setEditedDesc(task.description || "");
                      }}
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
                    onClick={() => {
                      setEditedDesc(task.description || ""); // ← khởi tạo giá trị
                      setIsEditingDesc(true);
                    }}
                  >
                    Chỉnh sửa
                  </Button>
                </div>
              )}
            </div>
            {task.assignedTo && (
              <div className="assigned-info mb-3">
                <strong>Người được giao:</strong>
                <div className="d-flex align-items-center mt-1">
                  {task.assignedTo.avatar && (
                    <img
                      src={task.assignedTo.avatar}
                      alt="avatar"
                      className="rounded-circle"
                      width={32}
                      height={32}
                    />
                  )}
                  <span className="ms-2">
                    {task.assignedTo.username || task.assignedTo.email}
                  </span>
                </div>
              </div>
            )}
            {/* ATTACHMENTS */}
            <div className="task-modal-section">
              <label className="section-label">Các tệp đính kèm</label>

              {task.documents?.length ? (
                <ul className="list-unstyled mt-2">
                  {task.documents.map((doc) => (
                    <li
                      key={doc._id}
                      className="d-flex align-items-center mb-1"
                    >
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="me-auto"
                      >
                        <i className={`fas fa-file-${doc.type}`} /> {doc.name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">Chưa có tệp đính kèm.</p>
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
