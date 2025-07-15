import React, { useState, useEffect, useRef } from "react";
import "../../styles/board.css";
import { useCommon } from "../../contexts/CommonContext";
import TaskModal from "../tasks/Task";
import { useParams } from "react-router-dom";
import ReactDOM from "react-dom";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
const List = ({ boardId }) => {
  const {
    accessToken,
    apiBaseUrl,
    userDataLocal: currentUser,
    calendarUser,
  } = useCommon();

  const [isBoardAdmin, setIsBoardAdmin] = useState(false);
  const [lists, setLists] = useState([]);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [addingListAt, setAddingListAt] = useState(null);
  const [newListTitle, setNewListTitle] = useState("");
  const [addingTaskTo, setAddingTaskTo] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterHasMember, setFilterHasMember] = useState(false);
  const [filterNoMember, setFilterNoMember] = useState(false);
  const [filterCompleted, setFilterCompleted] = useState(false);
  const [filterNotCompleted, setFilterNotCompleted] = useState(false);
  const [boardMembers, setBoardMembers] = useState([]);
  const [selectedMemberFilter, setSelectedMemberFilter] = useState("");
  const [filterDueTomorrow, setFilterDueTomorrow] = useState(false);
  const [filterDueIn3Days, setFilterDueIn3Days] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const menuRefs = useRef({});

  const { workspaceId } = useParams();

  // Fetch board members to determine permissions
  useEffect(() => {
    if (!boardId) return;
    setIsBoardAdmin(false); // reset on board change
    (async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl}/workspace/${workspaceId}/board/${boardId}`,
          {
            credentials: "include",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        const js = await res.json();
        if (!res.ok) throw new Error(js.message || "Không lấy thông tin board");

        const board = js.board || {};
        const rawMembers = board.members || [];
        // members array may include membership objects: { user, role }
        const members = rawMembers.map((m) => m.user || m);
        setBoardMembers(members);
        // const members = board.members || [];
        const currentUserId =
          currentUser?._id?.toString() || currentUser?.id?.toString();

        console.log("board.creator", board.creator);
        // 1) Check if current user is creator
        const creatorId = board.creator?._id?.toString();
        console.log("creatorId", creatorId);
        if (currentUserId && creatorId && currentUserId === creatorId) {
          setIsBoardAdmin(true);
          return;
        }

        // 2) Check membership role
        const membership = members.find(
          (m) => (m._id || m.id)?.toString() === currentUserId
        );
        if (membership && ["admin", "creator"].includes(membership.role)) {
          setIsBoardAdmin(true);
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, [boardId, apiBaseUrl, accessToken, currentUser]);

  // Fetch lists + tasks
  useEffect(() => {
    if (!boardId) return;
    (async () => {
      try {
        const resLists = await fetch(`${apiBaseUrl}/list?boardId=${boardId}`, {
          credentials: "include",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const jsLists = await resLists.json();
        if (!resLists.ok) throw new Error(jsLists.message);
        const rawLists = jsLists.data || [];

        const resTasks = await fetch(
          `${apiBaseUrl}/task/get-by-board/${boardId}`,
          {
            credentials: "include",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        const jsTasks = await resTasks.json();
        if (!resTasks.ok) throw new Error(jsTasks.message);
        const rawTasks = jsTasks.data || [];

        const tasksByList = rawTasks.reduce((acc, t) => {
          const lid = t.listId.toString();
          if (!acc[lid]) acc[lid] = [];
          acc[lid].push(t);
          return acc;
        }, {});

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

  useEffect(() => {
    console.log("current", currentUser);
    console.log("currentuserId", currentUser._id);
  }, []);

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
      setLists((prev) =>
        prev.map((l) => (l._id === id ? { ...l, title: js.data.title } : l))
      );
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
      assignedBy: currentUser?._id || null,
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

      const newTask = {
        ...js.data,
        assignedBy: currentUser,
        assignedTo: null,
      };

      // Cập nhật ngay UI để không cần F5
      setLists((prevLists) =>
        prevLists.map((l) =>
          l._id === listId ? { ...l, tasks: [newTask, ...(l.tasks || [])] } : l
        )
      );
      // Reset form
      setAddingTaskTo(null);
      setNewTaskTitle("");
      setMenuOpenId(null);
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle task updates from modal
  const handleTaskUpdated = (updatedTask) => {
    setLists((prev) =>
      prev.map((l) =>
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
      setLists((prev) =>
        prev.map((l) =>
          l._id === listId
            ? {
                ...l,
                tasks: l.tasks.filter((t) => t._id !== taskId),
              }
            : l
        )
      );
    } catch (err) {
      alert(err.message);
    }
  };

  // 3) Drag & Drop
  const handleDragEnd = async (res) => {
    const { source, destination } = res;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    // 3.a) Update UI immediately
    const nl = [...lists];
    const srcList = nl.find((l) => l._id === source.droppableId);
    const dstList = nl.find((l) => l._id === destination.droppableId);

    const [moved] = srcList.tasks.splice(source.index, 1);
    dstList.tasks.splice(destination.index, 0, moved);

    // 3.b) Reassign positions
    [srcList, dstList].forEach((l) =>
      l.tasks.forEach((t, i) => (t.position = i))
    );
    setLists(nl);

    // 3.c) Batch update
    const updates = [];
    [srcList, dstList].forEach((l) =>
      l.tasks.forEach((t) =>
        updates.push({
          _id: t._id,
          listId: l._id,
          position: t.position,
        })
      )
    );
    try {
      const r = await fetch(`${apiBaseUrl}/task/reorder`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(updates),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message);
    } catch (e) {
      console.error("Reorder failed", e);
    }
  };

  return (
    <>
      {/* Filter Panel */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          margin: "0 0 16px",
        }}
      >
        <button
          onClick={() => setFilterOpen(!filterOpen)}
          style={{
            background: "#fff",
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "8px",
            cursor: "pointer",
          }}
        >
          <i className="fas fa-filter" style={{ fontSize: "16px" }} />
        </button>
      </div>

      {/* Filter Panel Dropdown */}
      {filterOpen && (
        <div
          className="filter-panel"
          style={{
            position: "absolute",
            top: "60px",
            right: "16px",
            width: "320px",
            zIndex: 1000,
            background: "#fff",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            padding: "16px",
          }}
        >
          <strong
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                color: "#555",
              }}
            >
              Search by name task:
            </strong>
          <input
            type="text"
            placeholder="Search name task..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              marginBottom: "16px",
            }}
          />

          {/* Thành viên */}
          <div style={{ marginBottom: "16px" }}>
            <strong
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                color: "#555",
              }}
            >
             Filter by Members:
            </strong>
           
              <select
                value={selectedMemberFilter}
                onChange={(e) => setSelectedMemberFilter(e.target.value)}
                style={{
                  padding: "6px 8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              >
                <option value="">All Members</option>
                {boardMembers.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.username || m.email}
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", alignItems: "center", marginTop:"5px" }}>
                <input
                  type="checkbox"
                  checked={filterHasMember}
                  onChange={(e) => setFilterHasMember(e.target.checked)}
                  style={{ marginRight: "6px" }}
                />
                Members
              </div>
              <div style={{ display: "flex", alignItems: "center", marginTop:"5px" }}>
                <input
                  type="checkbox"
                  checked={filterNoMember}
                  onChange={(e) => setFilterNoMember(e.target.checked)}
                  style={{ marginRight: "6px" }}
                />
                No Members
              </div>
          </div>

          {/* Card status */}
          <div style={{ marginBottom: "16px" }}>
            <strong
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                color: "#555",
              }}
            >
              Task progress:
            </strong>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "5px",
              }}
            >
              <input
                type="checkbox"
                checked={filterCompleted}
                onChange={(e) => setFilterCompleted(e.target.checked)}
                style={{ marginRight: "6px" }}
              />
              Completed
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={filterNotCompleted}
                onChange={(e) => setFilterNotCompleted(e.target.checked)}
                style={{ marginRight: "6px" }}
              />
              Uncompleted
            </div>
          </div>

          {/* Ngày hết hạn */}
          <div>
            <strong
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                color: "#555",
              }}
            >
              Deadline for the task:
            </strong>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "5px",
              }}
            >
              <input
                type="checkbox"
                checked={filterOverdue}
                onChange={(e) => setFilterOverdue(e.target.checked)}
                style={{ marginRight: "6px" }}
              />
              Overdue
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "5px",
              }}
            >
              <input
                type="checkbox"
                checked={filterDueTomorrow}
                onChange={(e) => setFilterDueTomorrow(e.target.checked)}
                style={{ marginRight: "6px" }}
              />
              Deadline tomorrow
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={filterDueIn3Days}
                onChange={(e) => setFilterDueIn3Days(e.target.checked)}
                style={{ marginRight: "6px" }}
              />
              Deadline in 3 days
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <button
              onClick={() => setFilterOpen(false)}
              style={{
                background: "#007bff",
                color: "#fff",
                border: "none",
                padding: "8px 12px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="list-container">
          {lists.map((list) => (
            <div key={list._id} className="list-card">
              <div className="list-card-header">
                {editingId === list._id ? (
                  <input
                    className="add-list-input"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && saveListTitle(list._id)
                    }
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="list-title">{list.title}</span>
                    <span className="task-count">
                      {(list.tasks || []).length}
                    </span>
                    <div
                      className="list-menu-container"
                      ref={(el) => (menuRefs.current[list._id] = el)}
                    >
                      {isBoardAdmin && (
                        <i
                          className="fas fa-ellipsis-h list-menu-btn"
                          onClick={() =>
                            setMenuOpenId((prev) =>
                              prev === list._id ? null : list._id
                            )
                          }
                        />
                      )}
                      {menuOpenId === list._id && isBoardAdmin && (
                        <ul className="list-menu-dropdown">
                          <li
                            onClick={() => {
                              setEditingId(list._id);
                              setEditTitle(list.title);
                              setMenuOpenId(null);
                            }}
                          >
                            Edit List Title
                          </li>
                          <li
                            className="delete"
                            onClick={() => deleteList(list._id)}
                          >
                            Delete List
                          </li>
                          <li
                            onClick={() => {
                              setAddingTaskTo(list._id);
                              setNewTaskTitle("");
                              setMenuOpenId(null);
                            }}
                          >
                            Create Task
                          </li>
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>

              <Droppable droppableId={list._id}>
                {(dropProvided) => (
                  <div
                    className="list-tasks"
                    ref={dropProvided.innerRef}
                    {...dropProvided.droppableProps}
                  >
                    {/* Hiển thị Các task */}
                    {list.tasks
                      .filter((task) => {
                        const titleMatch = task.title
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase());
                        const now = new Date();
                        const end = task.endDate
                          ? new Date(task.endDate)
                          : null;
                        const isOverdue = end && end < now;
                        const dueTomorrow =
                          end &&
                          (() => {
                            const d = new Date(now);
                            d.setHours(0, 0, 0, 0);
                            const t = new Date(d);
                            t.setDate(t.getDate() + 1);
                            return (
                              end >= t &&
                              end < new Date(t.getTime() + 24 * 60 * 60 * 1000)
                            );
                          })();
                        const dueIn3 =
                          end &&
                          (() => {
                            const d = new Date(now);
                            d.setHours(0, 0, 0, 0);
                            return (
                              end > d &&
                              end <=
                                new Date(d.getTime() + 3 * 24 * 60 * 60 * 1000)
                            );
                          })();
                        const condOverdue = filterOverdue ? isOverdue : true;
                        const condTomorrow = filterDueTomorrow
                          ? dueTomorrow
                          : true;
                        const cond3Days = filterDueIn3Days ? dueIn3 : true;
                        let condMember = true;
                        if (filterHasMember && !filterNoMember)
                          condMember = Boolean(task.assignedTo);
                        else if (!filterHasMember && filterNoMember)
                          condMember = !task.assignedTo;
                        if (selectedMemberFilter)
                          condMember =
                            task.assignedTo?._id === selectedMemberFilter;
                        const total = task.checklist?.length || 0;
                        const done = (task.checklist || []).filter(
                          (c) => c.completed
                        ).length;
                        const pct =
                          total > 0 ? Math.round((done / total) * 100) : 0;
                        let condCompleted = true;
                        if (filterCompleted && !filterNotCompleted)
                          condCompleted = pct === 100;
                        else if (!filterCompleted && filterNotCompleted)
                          condCompleted = pct < 100;
                        return (
                          titleMatch &&
                          condOverdue &&
                          condTomorrow &&
                          cond3Days &&
                          condMember &&
                          condCompleted
                        );
                      })
                      .sort((a, b) => (a.position || 0) - (b.position || 0))
                      .map((task, index) => {
                        // Tính ID để kiểm tra quyền drag
                        const assigneeId =
                          task.assignedTo?._id || task.assignedTo?.id;
                        const assignerId =
                          task.assignedBy?._id || task.assignedBy?.id;
                        const currentId = currentUser?._id || currentUser?.id;
                        const canDrag =
                          currentId === assigneeId || currentId === assignerId;

                        // Tính % checklist
                        const total = task.checklist?.length || 0;
                        const done = (task.checklist || []).filter(
                          (c) => c.completed
                        ).length;
                        const percent =
                          total > 0 ? Math.round((done / total) * 100) : 0;

                        return (
                          <Draggable
                            key={task._id}
                            draggableId={task._id.toString()}
                            index={index}
                            isDragDisabled={!canDrag}
                          >
                            {(provided, snapshot) => {
                              const node = (
                                <div
                                  className="task-row"
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={{
                                    ...provided.draggableProps.style,
                                    // Vẫn giữ fixed ghost khi dragging
                                    position: snapshot.isDragging
                                      ? "fixed"
                                      : provided.draggableProps.style.position,
                                    top: snapshot.isDragging
                                      ? provided.draggableProps.style.top
                                      : undefined,
                                    left: snapshot.isDragging
                                      ? provided.draggableProps.style.left
                                      : undefined,
                                    marginBottom: 8,
                                    zIndex: snapshot.isDragging
                                      ? 999
                                      : undefined,
                                    cursor: canDrag ? "grab" : "not-allowed", // con trỏ
                                  }}
                                >
                                  <div
                                    className="task-card"
                                    onClick={() =>
                                      setSelectedTask({
                                        ...task,
                                        listTitle: list.title,
                                      })
                                    }
                                    style={{ opacity: 1 }}
                                  >
                                    <span className="task-title">
                                      {task.title}
                                    </span>
                                    <div className="task-progress mt-1">
                                      <div className="progress">
                                        <div
                                          className="progress-bar"
                                          role="progressbar"
                                          style={{ width: `${percent}%` }}
                                        />
                                      </div>
                                      <small className="ms-2">{percent}%</small>
                                    </div>
                                    <div className="mt-2">
                                      <strong>Member :</strong>{" "}
                                      {task.assignedTo ? (
                                        <div className="assigned-info d-flex align-items-center">
                                          {task.assignedTo.avatar && (
                                            <img
                                              src={task.assignedTo.avatar}
                                              alt="avatar"
                                              className="rounded-circle"
                                              width={24}
                                              height={24}
                                            />
                                          )}
                                          <span className="ms-2">
                                            {task.assignedTo.username ||
                                              task.assignedTo.email}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-danger">
                                          No result
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {isBoardAdmin && (
                                    <i
                                      className="fas fa-times delete-task-btn"
                                      onClick={() =>
                                        deleteTask(task._id, list._id)
                                      }
                                    />
                                  )}
                                </div>
                              );

                              // Portal ghost item khi drag
                              if (snapshot.isDragging) {
                                return ReactDOM.createPortal(
                                  node,
                                  document.body
                                );
                              }
                              return node;
                            }}
                          </Draggable>
                        );
                      })}
                    {dropProvided.placeholder}

                    {/* Form thêm task */}
                    {addingTaskTo === list._id && (
                      <div className="add-card-form">
                        <input
                          className="add-card-input"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && createTask(list._id)
                          }
                          placeholder="Nhập tên task..."
                          autoFocus
                        />
                        <div className="add-card-actions">
                          <button
                            className="btn-add"
                            onClick={() => createTask(list._id)}
                          >
                            Create new Task
                          </button>
                          <button
                            className="btn-cancel"
                            onClick={() => setAddingTaskTo(null)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}

          {/* Thêm list mới chỉ admin */}
          {isBoardAdmin && (
            <div className="list-card add-new-list">
              {addingListAt !== null ? (
                <div className="add-list-form">
                  <input
                    className="add-list-input"
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && createList(addingListAt)
                    }
                    placeholder="Nhập tên danh sách..."
                    autoFocus
                  />
                  <div className="add-list-actions">
                    <button
                      className="btn-add"
                      onClick={() => createList(addingListAt)}
                    >
                      Create new List
                    </button>
                    <button
                      className="btn-cancel"
                      onClick={() => setAddingListAt(null)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="add-card-button"
                  onClick={() => {
                    setAddingListAt(lists.length);
                    setNewListTitle("");
                  }}
                >
                  <i className="fas fa-plus" /> Create list
                </div>
              )}
            </div>
          )}
          {/* Task modal */}
          <TaskModal
            isOpen={!!selectedTask}
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={handleTaskUpdated}
          />
        </div>
      </DragDropContext>
    </>
  );
};

export default List;
