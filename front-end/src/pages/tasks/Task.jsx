import React, { useState, useEffect } from "react";
import "../../styles/task.css";
import { useCommon } from "../../contexts/CommonContext";
import { Button } from "react-bootstrap";

const TaskModal = ({ isOpen, task, onClose, onUpdate }) => {
  const { accessToken, apiBaseUrl } = useCommon();
  if (!isOpen || !task) return null;
  const [editedDesc, setEditedDesc]     = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [showDateInputs, setShowDateInputs] = useState(false);
  const [dateRange, setDateRange]           = useState([null, null]);
  const [startDate, endDate]                = dateRange;

  useEffect(() => {
    setEditedDesc(task.description || "");
    setIsEditingDesc(false);

    const s = task.startDate ? new Date(task.startDate) : null;
    const e = task.dueDate   ? new Date(task.dueDate)   : null;
    setDateRange([s, e]);
    setShowDateInputs(false);
  }, [task]);

  const formatBadge = (d) => {
    if (!d) return "";
    return d.toLocaleString("vi-VN", {
      day:   "numeric",
      month: "short",
      hour:  "2-digit",
      minute:"2-digit"
    });
  };

  const handleSaveDesc = async () => {
    try {
      const cleaned = editedDesc.trimEnd();
      const res = await fetch(
        `${apiBaseUrl}/task/updateTask/${task._id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ description: cleaned }),
        }
      );
      const js = await res.json();
      if (!res.ok) throw new Error(js.message || "Cập nhật thất bại");

      onUpdate && onUpdate(js.data);
      setIsEditingDesc(false);
    } catch (err) {
      console.error(err);
      alert("Cập nhật mô tả thất bại: " + err.message);
    }
  };

  const handleSaveDates = async () => {
    try {
      const payload = {
        startDate: startDate ? startDate.toISOString() : null,
        dueDate:   endDate   ? endDate.toISOString()   : null,
      };
      const res = await fetch(
        `${apiBaseUrl}/task/updateTask/${task._id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        }
      );
      const js = await res.json();
      if (!res.ok) throw new Error(js.message || "Cập nhật ngày thất bại");

      onUpdate && onUpdate(js.data);
      setShowDateInputs(false);
    } catch (err) {
      console.error(err);
      alert("Cập nhật ngày thất bại: " + err.message);
    }
  };

  const isOverdue = endDate && endDate < new Date();

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="task-modal-header">
          <select className="task-modal-list-dropdown">
            <option value={task.listId}>
              {task.listTitle || "Danh sách"}
            </option>
          </select>
          <div className="task-modal-header-actions">
            <button className="icon-btn"><i className="fas fa-bell"></i></button>
            <button className="icon-btn"><i className="fas fa-image"></i></button>
            <button className="icon-btn"><i className="fas fa-ellipsis-h"></i></button>
            <button className="icon-btn" onClick={onClose}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="task-modal-body">
          <h2 className="task-modal-title">{task.title}</h2>

          <div className="task-modal-actions">
            <button className="btn-action"><i className="fas fa-plus"></i> Thêm</button>
            <button className="btn-action"><i className="fas fa-tag"></i> Nhãn</button>

            {endDate ? (
              <div
                className={`due-badge ${isOverdue ? "overdue" : ""}`}
                onClick={() => setShowDateInputs(true)}
              >
                {formatBadge(endDate)}
                <i className="fas fa-chevron-down" style={{ marginLeft: 6 }} />
              </div>
            ) : (
              <button
                className="btn-action"
                onClick={() => setShowDateInputs((v) => !v)}
              >
                <i className="fas fa-clock"></i> Ngày
              </button>
            )}

            <button className="btn-action"><i className="fas fa-list"></i> Việc cần làm</button>
            <button className="btn-action"><i className="fas fa-paperclip"></i> Đính kèm</button>
          </div>

          {showDateInputs && (
            <div className="date-inputs-container">
              <label>
                Ngày bắt đầu
                <input
                  type="datetime-local"
                  value={startDate ? startDate.toISOString().slice(0,16) : ""}
                  onChange={(e) => {
                    const d = e.target.value ? new Date(e.target.value) : null;
                    setDateRange([d, endDate]);
                  }}
                />
              </label>
              <label style={{ marginLeft: 12 }}>
                Ngày hết hạn
                <input
                  type="datetime-local"
                  value={endDate ? endDate.toISOString().slice(0,16) : ""}
                  onChange={(e) => {
                    const d = e.target.value ? new Date(e.target.value) : null;
                    setDateRange([startDate, d]);
                  }}
                />
              </label>
              <div className="date-picker-actions">
                <Button variant="primary" onClick={handleSaveDates}>Lưu</Button>
                <Button variant="secondary" onClick={() => setShowDateInputs(false)} style={{ marginLeft: 8 }}>Hủy</Button>
              </div>
            </div>
          )}

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
                  <Button variant="success" onClick={handleSaveDesc}>Lưu</Button>
                  <Button variant="danger" onClick={() => setIsEditingDesc(false)} style={{ marginLeft: 8 }}>Hủy</Button>
                </div>
              </>
            ) : (
              <div className="desc-view1">
                <div className="desc-view"><p>{task.description || "Chưa có mô tả."}</p></div>
                <Button className="btn-edit-desc" onClick={() => setIsEditingDesc(true)}>Chỉnh sửa</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
