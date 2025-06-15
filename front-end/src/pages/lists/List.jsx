// src/components/lists/List.jsx
import React, { useState, useEffect, useRef } from 'react';
import '../../styles/board.css';
import { useCommon } from '../../contexts/CommonContext';

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
  const [editTitle, setEditTitle] = useState('');
  const [addingListAt, setAddingListAt] = useState(null);
  const [newListTitle, setNewListTitle] = useState('');
  const [addingTaskTo, setAddingTaskTo] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const menuRefs = useRef({});
console.log(currentWorkspaceId);

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    const handler = e => {
      Object.entries(menuRefs.current).forEach(([id, ref]) => {
        if (ref && !ref.contains(e.target) && menuOpenId === id) {
          setMenuOpenId(null);
        }
      });
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpenId]);

  // 1 lần: fetch Lists + Tasks của board
  useEffect(() => {
    if (!boardId) return;
    (async () => {
      try {
        // Fetch lists
        const r1 = await fetch(
          `${apiBaseUrl}/list?boardId=${boardId}`,
          {
            credentials: 'include',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        const j1 = await r1.json();
        if (!r1.ok) throw new Error(j1.message || 'Không lấy được lists');
        const rawLists = j1.data || [];

        // Fetch tasks của board
        const r2 = await fetch(
          `${apiBaseUrl}/task/get-by-board/${boardId}`,
          {
            credentials: 'include',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        const j2 = await r2.json();
        if (!r2.ok) throw new Error(j2.message || 'Không lấy được tasks');
        const rawTasks = j2.data || [];

        // Gom nhóm tasks theo listId
        const tasksByList = rawTasks.reduce((acc, t) => {
          const lid = t.listId.toString();
          if (!acc[lid]) acc[lid] = [];
          acc[lid].push(t);
          return acc;
        }, {});

        // Gán tasks vào từng list
        const withTasks = rawLists.map(l => ({
          ...l,
          tasks: tasksByList[l._id.toString()] || []
        }));

        setLists(withTasks);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [boardId, apiBaseUrl, accessToken]);

  // Tạo list mới
  const createList = async position => {
    const title = newListTitle.trim();
    if (!title) return;
    try {
      const res = await fetch(
        `${apiBaseUrl}/list/createList`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ title, boardId, position })
        }
      );
      const js = await res.json();
      if (!res.ok) throw new Error(js.message);

      // chèn list mới tại vị trí position, tasks mặc định rỗng
      const arr = [...lists];
      arr.splice(position, 0, { ...js.data, tasks: [] });
      setLists(arr);
      setAddingListAt(null);
      setNewListTitle('');
    } catch (err) {
      alert(err.message);
    }
  };

  // Lưu title list sau khi edit
  const saveListTitle = async id => {
    const title = editTitle.trim();
    if (!title) return;
    try {
      const res = await fetch(
        `${apiBaseUrl}/list/updateList/${id}`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ title })
        }
      );
      const js = await res.json();
      if (!res.ok) throw new Error(js.message);

      setLists(lists.map(l => l._id === id ? js.data : l));
      setEditingId(null);
      setMenuOpenId(null);
    } catch (err) {
      alert(err.message);
    }
  };

  // Xóa list
  const deleteList = async id => {
    if (!window.confirm('Bạn có chắc muốn xóa list này?')) return;
    try {
      const res = await fetch(
        `${apiBaseUrl}/list/deleteList/${id}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      const js = await res.json();
      if (!res.ok) throw new Error(js.message);
      setLists(lists.filter(l => l._id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  // Tạo task mới
  const createTask = async listId => {
    const title = newTaskTitle.trim();
    if (!title) return;
console.log(currentWorkspaceId);

    const payload = {
      title,
      description: '',
      calendarId: calendarUser?._id,
      workspaceId: currentWorkspaceId || null,
      boardId,
      listId,
      eventId: null,
      assignedTo: currentUser._id,
      assignedBy: currentUser._id,
      deadline: null,
      recurrence: null,
      reminderSettings: [],
      checklist: [],
      labels: [],
      documents: []
    };

    try {
      const res = await fetch(
        `${apiBaseUrl}/task/createTask`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify(payload)
        }
      );
      const js = await res.json();
      if (!res.ok) throw new Error(js.message);

      // push task mới vào đúng list trong state
      setLists(lists.map(l => {
        if (l._id === listId) {
          return { 
            ...l, 
            tasks: [...(l.tasks || []), js.data] 
          };
        }
        return l;
      }));
      setAddingTaskTo(null);
      setNewTaskTitle('');
      setMenuOpenId(null);
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
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => e.key==='Enter' && saveListTitle(list._id)}
                autoFocus
              />
            ) : (
              <>
                <span className="list-title">{list.title}</span>
                <span className="task-count">{(list.tasks||[]).length}</span>
                <div
                  className="list-menu-container"
                  ref={el=>menuRefs.current[list._id]=el}
                >
                  <i
                    className="fas fa-ellipsis-h list-menu-btn"
                    onClick={()=>setMenuOpenId(o=>o===list._id?null:list._id)}
                  />
                  {menuOpenId===list._id && (
                    <ul className="list-menu-dropdown">
                      <li onClick={()=>{
                        setEditingId(list._id);
                        setEditTitle(list.title);
                        setMenuOpenId(null);
                      }}>Sửa List</li>
                      <li onClick={()=>deleteList(list._id)} className="delete">
                        Xóa List
                      </li>
                      <li onClick={()=>{
                        setAddingTaskTo(list._id);
                        setNewTaskTitle('');
                        setMenuOpenId(null);
                      }}>Tạo Task</li>
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="list-tasks">
            {(list.tasks||[]).map(task=>(
              <div key={task._id} className="task-card">{task.title}</div>
            ))}

            {addingTaskTo===list._id && (
              <div className="add-card-form">
                <input
                  className="add-card-input"
                  value={newTaskTitle}
                  onChange={e=>setNewTaskTitle(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&createTask(list._id)}
                  placeholder="Nhập tên task..."
                  autoFocus
                />
                <div className="add-card-actions">
                  <button className="btn-add" onClick={()=>createTask(list._id)}>
                    Thêm
                  </button>
                  <button className="btn-cancel" onClick={()=>setAddingTaskTo(null)}>
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* nút thêm list cuối */}
      <div className="list-card add-new-list">
        {addingListAt!==null ? (
          <div className="add-list-form">
            <input
              className="add-list-input"
              value={newListTitle}
              onChange={e=>setNewListTitle(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&createList(addingListAt)}
              placeholder="Nhập tên danh sách..."
              autoFocus
            />
            <div className="add-list-actions">
              <button className="btn-add" onClick={()=>createList(addingListAt)}>
                Thêm danh sách
              </button>
              <button className="btn-cancel" onClick={()=>setAddingListAt(null)}>✕</button>
            </div>
          </div>
        ) : (
          <div
            className="add-card-button"
            onClick={()=>{ setAddingListAt(lists.length); setNewListTitle(''); }}
          >
            <i className="fas fa-plus"></i> Thêm danh sách khác
          </div>
        )}
      </div>
    </div>
  );
};

export default List;
