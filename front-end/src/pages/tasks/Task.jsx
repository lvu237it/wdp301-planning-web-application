import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "../../styles/task.css";
import { useCommon } from "../../contexts/CommonContext";
import { Modal, Button, Form, Toast } from "react-bootstrap";
import Deadline from "./Deadline";
import ChecklistModal from "./ChecklistModal";
import SuggestMembersBySkills from "./SuggestMemberBySkills";

const TaskModal = ({ isOpen, task, onClose, onUpdate }) => {
  const { accessToken, apiBaseUrl, userDataLocal } = useCommon();
  const currentUser = userDataLocal;
  const fileInputRef = useRef(null);
  // States chung
  const [editedTitle, setEditedTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedDesc, setEditedDesc] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    if (isOpen && task) {
      setEditedTitle(task.title);
      setEditedDesc(task.description || "");
    }
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const isAssigner =
    currentUser &&
    ((task.assignedBy && task.assignedBy._id === currentUser._id) ||
      (!task.assignedBy && !task.assignedTo));
  const isAssignee =
    task.assignedTo && currentUser && task.assignedTo._id === currentUser._id;

  const mergeTask = (updatedFields) => {
    let assignedTo;
    if (updatedFields.hasOwnProperty("assignedTo")) {
      if (updatedFields.assignedTo === null) {
        assignedTo = null;
      } else if (typeof updatedFields.assignedTo === "object") {
        assignedTo = updatedFields.assignedTo;
      } else {
        assignedTo = task.assignedTo;
      }
    } else {
      assignedTo = task.assignedTo;
    }

    return {
      ...task,
      ...updatedFields,
      assignedTo,
      listTitle: task.listTitle,
      assignedBy: task.assignedBy,
    };
  };

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

  // hàm lưu mô tả
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

  // hàm mời thành viên
  const handleAssign = async (user) => {
    try {
      const res = await axios.post(
        `${apiBaseUrl}/task/${task._id}/assign`,
        { email: user.email },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const updatedFields = res.data.data;
      onUpdate(mergeTask({ ...updatedFields, assignedTo: user }));
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

  // hàm xóa thành viên 
  const handleUnassign = async () => {
    try {
      const res = await axios.delete(`${apiBaseUrl}/task/${task._id}/assign`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const updatedFields = res.data.data;
      onUpdate(mergeTask(updatedFields));
      setToastMessage("Đã xóa người được giao");
      setShowToast(true);
    } catch (err) {
      console.error("Unassign thất bại:", err);
      alert(
        "Không thể xóa người được giao: " +
          (err.response?.data?.message || err.message)
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
        <div
          className="task-modal"
          onClick={(e) => e.stopPropagation()}
          style={{ maxHeight: "80vh", overflowY: "auto" }}
        >
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
                      setEditedTitle(task.title);
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
                  {isAssigner && (
                    <button
                      onClick={() => {
                        setIsEditingTitle(true);
                      }}
                    >
                      <i className="fas fa-pen fa-lg text-secondary" />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* ACTION BUTTONS */}
            {isAssigner && (
              <div className="task-modal-actions">
                {!task.assignedTo && (
                  <Button
                    variant="warning"
                    className="btn-action"
                    onClick={() => setShowInviteModal(true)}
                  >
                    <i className="fas fa-person" /> Thêm Member
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="btn-action"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <i className="fas fa-file" /> Tệp đính kèm
                </Button>
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
                    onClick={() => setShowDeadlineModal(true)}
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
                    onClick={() => setShowDeadlineModal(true)}
                  >
                    <i className="fas fa-clock" /> Ngày
                  </Button>
                )}
                <Deadline
                  show={showDeadlineModal}
                  onClose={() => setShowDeadlineModal(false)}
                  task={task}
                  onUpdate={onUpdate}
                  mergeTask={mergeTask}
                />
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
                {/* Modal Thêm checklist */}
                <ChecklistModal
                  isOpen={showChecklistModal}
                  onClose={() => setShowChecklistModal(false)}
                  task={task}
                  onAdd={(updatedField) => {
                    onUpdate(mergeTask(updatedField));
                    setShowChecklistModal(false);
                  }}
                />
              </div>
            )}

            {/* DESCRIPTION */}
            <div className="task-modal-section">
              <label className="section-label">Mô tả</label>
              {isAssignee ? (
                <div className="desc-view">
                  <p>{task.description || "Chưa có mô tả."}</p>
                </div>
              ) : isEditingDesc ? (
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
                  {isAssigner && (
                    <Button
                      style={{ marginTop: "10px" }}
                      className="btn-edit-desc"
                      onClick={() => {
                        setEditedDesc(task.description || "");
                        setIsEditingDesc(true);
                      }}
                    >
                      Chỉnh sửa
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Người đc giao trong task */}
            <div className="task-modal-section assigned-info mb-3">
              <strong>Người được giao:</strong>
              {task.assignedTo ? (
                <div className="d-flex align-items-center mt-1">
                  {task.assignedTo.avatar && (
                    <img
                      src={
                        task.assignedTo.avatar.startsWith("http")
                          ? task.assignedTo.avatar
                          : `${apiBaseUrl}/uploads/avatars/${task.assignedTo.avatar}`
                      }
                      alt={task.assignedTo.username || task.assignedTo.email}
                      className="rounded-circle"
                      width={32}
                      height={32}
                    />
                  )}
                  <span className="ms-2">
                    {task.assignedTo.username || task.assignedTo.email}
                  </span>
                  {isAssigner && (
                    <Button
                      variant="outline-danger"
                      size="sm"
                      className="ms-3"
                      onClick={handleUnassign}
                    >
                      <i className="fas fa-user-times" /> Xóa
                    </Button>
                  )}
                </div>
              ) : (
                <div className="mt-1 text-muted">Chưa có</div>
              )}
            </div>

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
                        {!isAssignee && (
                          <button
                            className="btn btn-sm btn-link text-danger"
                            onClick={() => handleDeleteChecklist(item)}
                          >
                            Xóa
                          </button>
                        )}
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
    </>
  );
};

export default TaskModal;
