import React, { useState, useEffect } from "react";
import axios from "axios";
import { useCommon } from "../../contexts/CommonContext";
import { Button } from "react-bootstrap";

const ProgressTask = ({ task, mergeTask, onUpdate, isAssignee }) => {
  const { accessToken, apiBaseUrl } = useCommon();
  const [checklist, setChecklist] = useState(task.checklist || []);

  // đồng bộ checklist khi task thay đổi
  useEffect(() => {
    setChecklist(task.checklist || []);
  }, [task.checklist]);

  const totalItems = checklist.length;
  const doneCount = checklist.filter((i) => i.completed).length;
  const percentDone = totalItems ? Math.round((doneCount / totalItems) * 100) : 0;

  // gọi API cập nhật checklist
  const updateChecklist = async (newList) => {
    try {
      const res = await axios.put(
        `${apiBaseUrl}/task/updateTask/${task._id}`,
        { checklist: newList },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      onUpdate(mergeTask(res.data.data));
    } catch (err) {
      console.error("Cập nhật tiến độ thất bại:", err);
      alert(
        "Cập nhật tiến độ thất bại: " +
          (err.response?.data?.message || err.message)
      );
    }
  };

  const handleToggle = (item) => {
    const updated = checklist.map((i) =>
      i._id === item._id ? { ...i, completed: !i.completed } : i
    );
    updateChecklist(updated);
  };

  const handleDelete = (item) => {
    if (window.confirm("Xác nhận xóa mục checklist này?")) {
      const updated = checklist.filter((i) => i._id !== item._id);
      updateChecklist(updated);
    }
  };

  return (
    <div className="task-modal-section">
      <label className="section-label">Tiến độ công việc : </label>
      {totalItems ? (
        <>
          <div className="checklist-progress d-flex align-items-center mb-2">
            <div className="progress flex-grow-1">
              <div
                className="progress-bar"
                role="progressbar"
                style={{ width: `${percentDone}%` }}
              />
            </div>
            <span className="ms-2">{percentDone}%</span>
          </div>
          <div style={{ maxHeight: "200px", overflowY: "auto" }}>
            <ul className="checklist-list">
              {checklist.map((item) => (
                <li
                  key={item._id}
                  className="d-flex align-items-center mb-1"
                >
                  <input
                    type="checkbox"
                    className="form-check-input me-2"
                    checked={item.completed}
                    onChange={() => handleToggle(item)}
                  />
                  <span
                    style={{
                      flexGrow: 1,
                      textDecoration: item.completed ? "line-through" : "none",
                    }}
                  >
                    {item.title}
                  </span>
                  {!isAssignee && (
                    <Button
                      variant="link"
                      size="sm"
                      className="text-danger ms-2"
                      onClick={() => handleDelete(item)}
                    >
                      Xóa
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <p className="text-muted-progressTask">
          Chưa có công việc nào.
        </p>
      )}
    </div>
  );
};

export default ProgressTask;
