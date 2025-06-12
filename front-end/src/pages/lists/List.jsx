// import React, { useState, useEffect } from 'react';
// import {Button} from 'react-bootstrap';
// import '../../styles/board.css';

// const List = ({ boardId }) => {
//   const [lists, setLists] = useState([]);
//   const [menuOpenId, setMenuOpenId] = useState(null);
//   const [editingId, setEditingId] = useState(null);
//   const [editTitle, setEditTitle] = useState('');

//   const [addingList, setAddingList] = useState(false);
//   const [newListTitle, setNewListTitle] = useState('');

//   // Fetch lists
//   useEffect(() => {
//     (async () => {
//       try {
//         const res = await fetch(`http://localhost:3000/list?boardId=${boardId}`);
//         const js = await res.json();
//         if (res.ok) setLists(js.data.filter(l => l.boardId === boardId));
//       } catch (err) {
//         console.error(err);
//       }
//     })();
//   }, [boardId]);

//   // Create list
//   const createList = async () => {
//     const title = newListTitle.trim();
//     if (!title) return;
//     try {
//       const res = await fetch('http://localhost:3000/list/createList', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ title, boardId, position: lists.length })
//       });
//       const js = await res.json();
//       if (res.ok) {
//         setLists(prev => [...prev, js.data]);
//         setNewListTitle('');
//         setAddingList(false);
//       } else {
//         alert(js.message || 'Tạo danh sách thất bại');
//       }
//     } catch (err) {
//       console.error(err);
//       alert('Lỗi mạng');
//     }
//   };

//   // Delete list
//   const handleDelete = async (id) => {
//     if (!confirm('Bạn có chắc muốn xóa danh sách này?')) return;
//     try {
//       const res = await fetch(`http://localhost:3000/list/deleteList/${id}`, { method: 'DELETE' });
//       if (res.ok) setLists(prev => prev.filter(l => l._id !== id));
//       else alert((await res.json()).message || 'Xóa thất bại');
//     } catch (err) {
//       console.error(err);
//     }
//   };

//   // Save edit
//   const handleSave = async (id) => {
//     const title = editTitle.trim();
//     if (!title) return;
//     try {
//       const res = await fetch(`http://localhost:3000/list/updateList/${id}`, {
//         method: 'PUT',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ title })
//       });
//       const js = await res.json();
//       if (res.ok) {
//         setLists(prev => prev.map(l => l._id === id ? js.data : l));
//         setEditingId(null);
//         setMenuOpenId(null);
//       } else {
//         alert(js.message || 'Cập nhật thất bại');
//       }
//     } catch (err) {
//       console.error(err);
//     }
//   };

//   return (
//     <div className="list-container">
//       {lists.map(list => (
//         <div key={list._id} className="task-list">
//           <div className="list-header">
//             {editingId === list._id ? (
//               <div className="edit-inline">
//                 <input
//                   className="add-list-input"
//                   value={editTitle}
//                   onChange={e => setEditTitle(e.target.value)}
//                   onKeyDown={e => e.key === 'Enter' && handleSave(list._id)}
//                   autoFocus
//                 />
//                 <button className="btn-primary" onClick={() => handleSave(list._id)}>Lưu</button>
//                 <button className="btn-cancel" onClick={() => setEditingId(null)}>✕</button>
//               </div>
//             ) : (
//               <>
//                 <h3 className="list-title">{list.title}</h3>
//                 <span className="task-count">{list.tasks?.length || 0}</span>
//                 <div className="list-menu-container">
//                   <i
//                     className="fas fa-ellipsis-h list-menu-btn"
//                     onClick={() => setMenuOpenId(menuOpenId === list._id ? null : list._id)}
//                   />
//                   {menuOpenId === list._id && (
//                     <ul className="list-menu-dropdown">
//                       <li className="dropdown-item" onClick={() => {
//                         setEditingId(list._id);
//                         setEditTitle(list.title);
//                         setMenuOpenId(null);
//                       }}>Sửa List</li>
//                       <li className="dropdown-item delete" onClick={() => handleDelete(list._id)}>Xóa List</li>
//                     </ul>
//                   )}
//                 </div>
//               </>
//             )}
//           </div>
//           <div className="task-items">
//             {/* Render tasks if any */}
//           </div>
//         </div>
//       ))}

//       {/* Add-list block at end */}
//       <div className="task-list add-new-list">
//         {addingList ? (
//           <div className="add-list-form">
//             <input
//               className="add-list-input"
//               type="text"
//               placeholder="Nhập tên danh sách..."
//               value={newListTitle}
//               onChange={e => setNewListTitle(e.target.value)}
//               onKeyDown={e => e.key === 'Enter' && createList()}
//               autoFocus
//             />
//             <div className="add-list-actions">
//               <Button variant='primary' onClick={createList}>Thêm danh sách</Button>
//               <Button variant='danger'onClick={() => { setAddingList(false); setNewListTitle(''); }}>Hủy</Button>
//             </div>
//           </div>
//         ) : (
//           <button class="btn btn-success" onClick={() => { setAddingList(true); setNewListTitle(''); }}>
//             <i className="fas fa-plus"></i> Thêm danh sách khác
//           </button>
//         )}
//       </div>
//     </div>
//   );
// };

// export default List;
import React, { useState, useEffect, useRef } from 'react';
import '../../styles/board.css';

/**
 * List.jsx
 * Hiển thị các List dưới dạng card giống Trello
 * Props:
 *  - boardId: ID của Board để fetch các List thuộc Board đó
 */
const List = ({ boardId }) => {
  const [lists, setLists] = useState([]);
  const [addingAt, setAddingAt] = useState(null);
  const [newListTitle, setNewListTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const menuRefs = useRef({});

  // close menu khi click ra ngoài
  useEffect(() => {
    const handler = e => {
      Object.entries(menuRefs.current).forEach(([id, ref]) => {
        if (ref && !ref.contains(e.target)) {
          setMenuOpenId(open => open === id ? null : open);
        }
      });
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch lists
  useEffect(() => {
    if (!boardId) return;
    (async () => {
      try {
        const res = await fetch(
          `http://localhost:3000/list?boardId=${boardId}`,
          { credentials: 'include' }
        );
        const js = await res.json();
        if (res.ok) setLists(js.data || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [boardId]);

  // Create
  const createList = async position => {
    const title = newListTitle.trim();
    if (!title) return;
    try {
      const res = await fetch('http://localhost:3000/list/createList', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title, boardId, position })
      });
      const js = await res.json();
      if (res.ok) {
        const arr = [...lists];
        arr.splice(position, 0, js.data);
        setLists(arr);
        setAddingAt(null);
        setNewListTitle('');
      } else alert(js.message);
    } catch (e) {
      console.error(e);
    }
  };

  // Update
  const handleSave = async id => {
    const title = editTitle.trim();
    if (!title) return;
    try {
      const res = await fetch(
        `http://localhost:3000/list/updateList/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ title })
        }
      );
      const js = await res.json();
      if (res.ok) {
        setLists(lists.map(l => l._id === id ? js.data : l));
        setEditingId(null);
        setMenuOpenId(null);
      } else alert(js.message);
    } catch (e) {
      console.error(e);
    }
  };

  // Delete
  const handleDelete = async id => {
    if (!window.confirm('Xóa danh sách này?')) return;
    try {
      const res = await fetch(
        `http://localhost:3000/list/deleteList/${id}`, {
          method: 'DELETE',
          credentials: 'include'
        }
      );
      if (res.ok) {
        setLists(lists.filter(l => l._id !== id));
      } else {
        const js = await res.json();
        alert(js.message);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div
      className="list-container">
      {lists.map((list, idx) => (
        <div key={list._id} className="list-card">
          <div className="list-card-header">
            {editingId === list._id ? (
              <input
                className="add-list-input"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave(list._id)}
                autoFocus
              />
            ) : (
              <>
                <span className="list-title">{list.title}</span>
                <span className="task-count">{list.tasks?.length || 0}</span>

                {/* bao quanh menu bằng container */}
                <div
                  className="list-menu-container"
                  ref={el => menuRefs.current[list._id] = el}
                >
                  <i
                    className="fas fa-ellipsis-h list-menu-btn"
                    onClick={() =>
                      setMenuOpenId(open => open === list._id ? null : list._id)
                    }
                  />

                  {menuOpenId === list._id && (
                    <ul className="list-menu-dropdown">
                      <li
                        onClick={() => {
                          setEditingId(list._id);
                          setEditTitle(list.title);
                          setMenuOpenId(null);
                        }}
                      >
                        Sửa List
                      </li>
                      <li
                        className="delete"
                        onClick={() => handleDelete(list._id)}
                      >
                        Xóa List
                      </li>
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="list-tasks">
            {/* Nếu cần hiển thị card trong list, render ở đây */}
          </div>
        </div>
      ))}

      {/* nút thêm list */}
      <div className="list-card add-new-list">
        {addingAt !== null ? (
          <div className="add-list-form">
            <input
              className="add-list-input"
              type="text"
              placeholder="Nhập tên danh sách..."
              value={newListTitle}
              onChange={e => setNewListTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createList(addingAt)}
              autoFocus
            />
            <div className="add-list-actions">
              <button className="btn-primary" onClick={() => createList(addingAt)}>
                Thêm danh sách
              </button>
              <button
                className="btn-cancel"
                onClick={() => setAddingAt(null)}
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <div
            className="add-card-button"
            onClick={() => {
              setAddingAt(lists.length);
              setNewListTitle('');
            }}
          >
            <i className="fas fa-plus"></i> Thêm danh sách khác
          </div>
        )}
      </div>
    </div>
  );
};

export default List;
