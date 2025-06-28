import React, { useState, useEffect, useRef } from "react";
import "../../styles/board.css";
import { useCommon } from "../../contexts/CommonContext";
import TaskModal from "../tasks/Task";
import { useParams } from 'react-router-dom';
const List = ({ boardId }) => {
  const {
    accessToken,
    apiBaseUrl,
    userDataLocal: currentUser,
    calendarUser,
    currentWorkspaceId,
  } = useCommon();

  const [lists, setLists] = useState([]);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [addingListAt, setAddingListAt] = useState(null);
  const [newListTitle, setNewListTitle] = useState("");
  const [addingTaskTo, setAddingTaskTo] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const menuRefs = useRef({});

const { workspaceId } = useParams();

  // Fetch lists and tasks
  useEffect(() => {
    if (!boardId) return;
    (async () => {
      try {
        // Get lists
        const r1 = await fetch(`${apiBaseUrl}/list?boardId=${boardId}`, {
          credentials: "include",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const j1 = await r1.json();
        if (!r1.ok) throw new Error(j1.message || "Không lấy được lists");
        const rawLists = j1.data || [];

        // Get tasks
        const r2 = await fetch(`${apiBaseUrl}/task/get-by-board/${boardId}`, {
          credentials: "include",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const j2 = await r2.json();
        if (!r2.ok) throw new Error(j2.message || "Không lấy được tasks");
        const rawTasks = j2.data || [];

        // Group tasks by listId
        const tasksByList = rawTasks.reduce((acc, t) => {
          const lid = t.listId.toString();
          if (!acc[lid]) acc[lid] = [];
          acc[lid].push(t);
          return acc;
        }, {});

        // Merge
        setLists(
          rawLists.map((l) => ({
            ...l,
            tasks: tasksByList[l._id.toString()] || [],
          }))
        );
      } catch (err) {
        console.error(err);
      }
    })();
  }, [boardId, apiBaseUrl, accessToken]);

  // Create a new list
  const createList = async (position) => {
    const title = newListTitle.trim();
    if (!title) return;
    try {
      const res = await fetch(`${apiBaseUrl}/list/createList`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ title, boardId, position }),
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js.message);
      const arr = [...lists];
      arr.splice(position, 0, { ...js.data, tasks: [] });
      setLists(arr);
      setAddingListAt(null);
      setNewListTitle("");
    } catch (err) {
      alert(err.message);
    }
  };

  // Save edited list title
   const saveListTitle = async (id) => {
    const title = editTitle.trim();
    if (!title) return;
    try {
      const res = await fetch(`${apiBaseUrl}/list/updateList/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ title }),
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js.message);

      // chỉ merge lại title, không đụng tasks
      setLists((prev) =>
        prev.map((l) =>
          l._id === id ? { ...l, title: js.data.title } : l
        )
      );
      // nếu TaskModal đang mở của list này, cập nhật luôn
      setSelectedTask((prev) =>
        prev && prev.listId === id
          ? { ...prev, listTitle: js.data.title }
          : prev
      );
      setEditingId(null);
      setMenuOpenId(null);
    } catch (err) {
      alert(err.message);
    }
  };

  // Delete a list
  const deleteList = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xóa list này?")) return;
    try {
      const res = await fetch(`${apiBaseUrl}/list/deleteList/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js.message);
      setLists(lists.filter((l) => l._id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  // Create a new task
  const createTask = async (listId) => {
    const title = newTaskTitle.trim();
    if (!title) return;
    const payload = {
      title,
      description: "",
      calendarId: calendarUser?._id,
      workspaceId: workspaceId || null,
      boardId,
      listId,
      eventId: null,
      assignedTo: null,
      assignedBy: currentUser._id,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      allDay: false,
      recurrence: null,
      reminderSettings: [],
      checklist: [],
      documents: [],
    };
    try {
      const res = await fetch(`${apiBaseUrl}/task/createTask`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js.message);
      setLists(
        lists.map((l) =>
          l._id === listId
            ? { ...l, tasks: [...(l.tasks || []), js.data] }
            : l
        )
      );
      setAddingTaskTo(null);
      setNewTaskTitle("");
      setMenuOpenId(null);
    } catch (err) {
      alert(err.message);
    }
  };

  // Update task after editing in modal
  const handleTaskUpdated = (updatedTask) => {
    setLists(
      lists.map((l) =>
        l._id === updatedTask.listId
          ? {
              ...l,
              tasks: l.tasks.map((t) =>
                t._id === updatedTask._id ? updatedTask : t
              ),
            }
          : l
      )
    );
    setSelectedTask(updatedTask);
  };

  // Delete a task
  const deleteTask = async (taskId, listId) => {
    if (!window.confirm("Bạn có chắc muốn xóa task này không?")) return;
    try {
      const res = await fetch(`${apiBaseUrl}/task/deleteTask/${taskId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js.message);
      setLists(
        lists.map((l) =>
          l._id === listId
            ? { ...l, tasks: l.tasks.filter((t) => t._id !== taskId) }
            : l
        )
      );
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="list-container">
      {lists.map((list, idx) => (
        <div key={list._id} className="list-card">
          <div className="list-card-header">
            {editingId === list._id ? (
              <input
                className="add-list-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveListTitle(list._id)}
                autoFocus
              />
            ) : (
              <>
                <span className="list-title">{list.title}</span>
                <span className="task-count">{(list.tasks || []).length}</span>
                <div className="list-menu-container" ref={(el) => (menuRefs.current[list._id] = el)}>
                  <i
                    className="fas fa-ellipsis-h list-menu-btn"
                    onClick={() => setMenuOpenId((o) => (o === list._id ? null : list._id))}
                  />
                  {menuOpenId === list._id && (
                    <ul className="list-menu-dropdown">
                      <li onClick={() => { setEditingId(list._id); setEditTitle(list.title); setMenuOpenId(null); }}>Sửa List</li>
                      <li className="delete" onClick={() => deleteList(list._id)}>Xóa List</li>
                      <li onClick={() => { setAddingTaskTo(list._id); setNewTaskTitle(""); setMenuOpenId(null); }}>Tạo Task</li>
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="list-tasks">
            {list.tasks.map((task) => {
              const total = task.checklist?.length || 0;
              const done = task.checklist?.filter((i) => i.completed).length || 0;
              const percent = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div key={task._id} className="task-row">
                  <div className="task-card" onClick={() => setSelectedTask({ ...task, listTitle: list.title })}>
                    <span className="task-title">{task.title}</span>
                    <div className="task-progress mt-1">
                      <div className="progress">
                        <div className="progress-bar" role="progressbar" style={{ width: `${percent}%` }} />
                      </div>
                      <small className="ms-2">{percent}%</small>
                    </div>
                  </div>
                  <i className="fas fa-times delete-task-btn" onClick={() => deleteTask(task._id, list._id)} />
                </div>
              );
            })}

            {addingTaskTo === list._id && (
              <div className="add-card-form">
                <input
                  className="add-card-input"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createTask(list._id)}
                  placeholder="Nhập tên task..."
                  autoFocus
                />
                <div className="add-card-actions">
                  <button className="btn-add" onClick={() => createTask(list._id)}>Thêm</button>
                  <button className="btn-cancel" onClick={() => setAddingTaskTo(null)}>✕</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="list-card add-new-list">
        {addingListAt !== null ? (
          <div className="add-list-form">
            <input
              className="add-list-input"
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createList(addingListAt)}
              placeholder="Nhập tên danh sách..."
              autoFocus
            />
            <div className="add-list-actions">
              <button className="btn-add" onClick={() => createList(addingListAt)}>Thêm danh sách</button>
              <button className="btn-cancel" onClick={() => setAddingListAt(null)}>✕</button>
            </div>
          </div>
        ) : (
          <div className="add-card-button" onClick={() => { setAddingListAt(lists.length); setNewListTitle(""); }}>
            <i className="fas fa-plus"></i> Thêm danh sách khác
          </div>
        )}
      </div>

      <TaskModal
        isOpen={!!selectedTask}
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleTaskUpdated}
      />
    </div>
  );
};

export default List;
