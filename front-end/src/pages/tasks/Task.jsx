import React, { useState, useEffect } from "react";
import "../../styles/task.css";
import { useCommon } from "../../contexts/CommonContext";
import { Button } from "react-bootstrap";

const pad = (n) => n.toString().padStart(2, "0");
const toDateTimeLocal = (date) => {
  if (!date) return "";
  const Y = date.getFullYear();
  const M = pad(date.getMonth() + 1);
  const D = pad(date.getDate());
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  return `${Y}-${M}-${D}T${h}:${m}`;
};
const toDateLocal = (date) => {
  if (!date) return "";
  const Y = date.getFullYear();
  const M = pad(date.getMonth() + 1);
  const D = pad(date.getDate());
  return `${Y}-${M}-${D}`;
};
const parseLocalToUTC = (localString) => {
  const [date, time] = localString.split("T");
  const [Y, M, D] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  return new Date(Date.UTC(Y, M - 1, D, h, m));
};

const TaskModal = ({ isOpen, task, onClose, onUpdate }) => {
  const { accessToken, apiBaseUrl } = useCommon();
  if (!isOpen || !task) return null;

  const [editedDesc, setEditedDesc]       = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);

  const [showDateInputs, setShowDateInputs] = useState(false);
  const [allDay, setAllDay]                 = useState(false);
  const [startInput, setStartInput]         = useState("");
  const [endInput, setEndInput]             = useState("");
  const [dateInput, setDateInput]           = useState("");

  useEffect(() => {
    setEditedDesc(task.description || "");
    setIsEditingDesc(false);

    setAllDay(!!task.allDay);

    const s = task.startDate ? new Date(task.startDate) : null;
    const e = task.endDate   ? new Date(task.endDate)   : null;
    setStartInput(toDateTimeLocal(s));
    setEndInput(toDateTimeLocal(e));
    setDateInput(toDateLocal(s));

    setShowDateInputs(false);
  }, [task]);

  const formatBadge = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d
      .toLocaleString("vi-VN", {
        day:   "numeric",
        month: "short",
        hour:  "2-digit",
        minute:"2-digit",
      })
      .replace(",", "");
  };

  // Lưu mô tả
  const handleSaveDesc = async () => {
    try {
      const res = await fetch(
        `${apiBaseUrl}/task/updateTask/${task._id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ description: editedDesc.trimEnd() }),
        }
      );
      const js = await res.json();
      if (!res.ok) throw new Error(js.message);
      onUpdate && onUpdate(js.data);
      setIsEditingDesc(false);
    } catch (err) {
      console.error(err);
      alert("Cập nhật mô tả thất bại: " + err.message);
    }
  };

  // Lưu ngày giờ và allDay
  const handleSaveDates = async () => {
    try {
      const payload = {};
      if (allDay) {
        if (dateInput) {
          const localDate = dateInput; 
          const startUTC = parseLocalToUTC(localDate + "T00:00");
          const endUTC   = parseLocalToUTC(localDate + "T23:59");
          payload.startDate = startUTC.toISOString();
          payload.endDate   = endUTC.toISOString();
        }
      } else {
        if (startInput) payload.startDate = parseLocalToUTC(startInput).toISOString();
        if (endInput)   payload.endDate   = parseLocalToUTC(endInput).toISOString();
      }
      payload.allDay = allDay;

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
      if (!res.ok) throw new Error(js.message);
      onUpdate && onUpdate(js.data);
      setShowDateInputs(false);
    } catch (err) {
      console.error(err);
      alert("Cập nhật ngày thất bại: " + err.message);
    }
  };

  const isOverdue = task.endDate && new Date(task.endDate) < new Date();

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="task-modal-header">
          <div value={task.listId}>{task.listTitle}</div>
          <div className="task-modal-header-actions">
            <button className="icon-btn"><i className="fas fa-bell" /></button>
            <button className="icon-btn"><i className="fas fa-image" /></button>
            <button className="icon-btn"><i className="fas fa-ellipsis-h" /></button>
            <button className="icon-btn" onClick={onClose}><i className="fas fa-times" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="task-modal-body">
          <h2 className="task-modal-title">{task.title}</h2>

          {/* Actions */}
          <div className="task-modal-actions">
            <button className="btn-action"><i className="fas fa-plus" /> Thêm</button>
            <button className="btn-action"><i className="fas fa-tag" /> Nhãn</button>

            {task.endDate ? (
              <div
                className={`due-badge ${isOverdue ? "overdue" : ""}`}
                onClick={() => setShowDateInputs(true)}
              >
                {formatBadge(task.endDate)}
                <i className="fas fa-chevron-down" style={{ marginLeft: 6 }} />
              </div>
            ) : (
              <button
                className="btn-action"
                onClick={() => setShowDateInputs(v => !v)}
              >
                <i className="fas fa-clock" /> Ngày
              </button>
            )}

            <button className="btn-action"><i className="fas fa-list" /> Việc cần làm</button>
            <button className="btn-action"><i className="fas fa-paperclip" /> Đính kèm</button>
          </div>

          {/* Date / All-Day picker */}
          {showDateInputs && (
            <div className="date-inputs-container">
              {!allDay ? (
                <>
                  <label>
                    Ngày bắt đầu
                    <input
                      type="datetime-local"
                      value={startInput}
                      onChange={e => {
                        setStartInput(e.target.value);
                      }}
                    />
                  </label>
                  <label style={{ marginLeft: 12 }}>
                    Ngày kết thúc
                    <input
                      type="datetime-local"
                      value={endInput}
                      onChange={e => setEndInput(e.target.value)}
                    />
                  </label>
                </>
              ) : (
                <label>
                  Chọn ngày
                  <input
                    type="date"
                    value={dateInput}
                    onChange={e => setDateInput(e.target.value)}
                  />
                </label>
              )}

              <label style={{ marginLeft: 12, display: "flex", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={e => setAllDay(e.target.checked)}
                  style={{ marginRight: 4 }}
                />
                Cả ngày
              </label>

              <div className="date-picker-actions">
                <Button variant="primary" onClick={handleSaveDates}>Lưu</Button>
                <Button variant="secondary" onClick={() => setShowDateInputs(false)} style={{ marginLeft: 8 }}>Hủy</Button>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="task-modal-section">
            <label className="section-label">Mô tả</label>
            {isEditingDesc ? (
              <>
                <textarea
                  className="section-textarea"
                  value={editedDesc}
                  onChange={e => setEditedDesc(e.target.value)}
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
