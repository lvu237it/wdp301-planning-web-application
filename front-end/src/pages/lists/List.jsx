// src/components/lists/List.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import { FaTrash } from 'react-icons/fa';
import '../../styles/board.css';
import { useCommon } from '../../contexts/CommonContext';
import TaskModal from '../tasks/Task';
const List = ({ boardId }) => {
  const {
    accessToken,
    apiBaseUrl,
    userDataLocal: currentUser,
    calendarUser,
    currentWorkspaceId,
    createTaskFromCalendar,
    updateTask,
    deleteTask: deleteTaskFromCommon,
  } = useCommon();

  const [lists, setLists] = useState([]);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [addingListAt, setAddingListAt] = useState(null);
  const [newListTitle, setNewListTitle] = useState('');
  const [addingTaskTo, setAddingTaskTo] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);

  // Modal states for detailed task creation
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    listId: '',
    deadline: '',
    assignedTo: '',
    priority: 'medium',
  });
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [boardMembers, setBoardMembers] = useState([]);

  const menuRefs = useRef({});

  // Format datetime for input
  const formatDateTimeForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const offset = d.getTimezoneOffset();
    d.setMinutes(d.getMinutes() - offset);
    return d.toISOString().slice(0, 16);
  };

  const priorityOptions = [
    { value: 'low', label: '🟢 Thấp' },
    { value: 'medium', label: '🟡 Vừa' },
    { value: 'high', label: '🔴 Cao' },
    { value: 'urgent', label: '🚨 Khẩn cấp' },
  ];
  // console.log('currentWorkspaceId', currentWorkspaceId);

  useEffect(() => {
    console.log('selectedTask changed:', selectedTask);
  }, [selectedTask]);

  useEffect(() => {
    if (!boardId) return;
    (async () => {
      try {
        const r1 = await fetch(`${apiBaseUrl}/list?boardId=${boardId}`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const j1 = await r1.json();
        if (!r1.ok) throw new Error(j1.message || 'Không lấy được lists');
        const rawLists = j1.data || [];

        const r2 = await fetch(`${apiBaseUrl}/task/get-by-board/${boardId}`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const j2 = await r2.json();
        if (!r2.ok) throw new Error(j2.message || 'Không lấy được tasks');
        const rawTasks = j2.data || [];

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

        // Fetch board members
        const r3 = await fetch(
          `${apiBaseUrl}/workspace/${currentWorkspaceId}/board/${boardId}`,
          {
            credentials: 'include',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        const j3 = await r3.json();
        if (r3.ok && j3.board && j3.board.members) {
          setBoardMembers(j3.board.members);
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, [boardId, apiBaseUrl, accessToken, currentWorkspaceId]);

  // Tạo list mới
  const createList = async (position) => {
    const title = newListTitle.trim();
    if (!title) return;
    try {
      const res = await fetch(`${apiBaseUrl}/list/createList`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ title, boardId, position }),
      });
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
  const saveListTitle = async (id) => {
    const title = editTitle.trim();
    if (!title) return;
    try {
      const res = await fetch(`${apiBaseUrl}/list/updateList/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ title }),
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js.message);

      setLists(lists.map((l) => (l._id === id ? js.data : l)));
      setEditingId(null);
      setMenuOpenId(null);
    } catch (err) {
      alert(err.message);
    }
  };

  // Xóa list
  const deleteList = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa list này?')) return;
    try {
      const res = await fetch(`${apiBaseUrl}/list/deleteList/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js.message);
      setLists(lists.filter((l) => l._id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  // Quick create task (simple version)
  const createTask = async (listId) => {
    const title = newTaskTitle.trim();
    if (!title) return;
    console.log(currentWorkspaceId);

    const taskData = {
      title,
      description: '',
      boardId,
      listId,
      deadline: null,
      assignedTo: currentUser._id,
    };

    try {
      // Sử dụng createTaskFromCalendar để thống nhất logic với BoardCalendar
      const result = await createTaskFromCalendar(taskData);

      if (result.success) {
        // Send notification if task is assigned to someone other than creator
        if (taskData.assignedTo && taskData.assignedTo !== currentUser._id) {
          try {
            await fetch(`${apiBaseUrl}/notification/personal`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              credentials: 'include',
              body: JSON.stringify({
                title: `Task mới được gán: ${taskData.title}`,
                content: `Bạn đã được gán task "${
                  taskData.title
                }" trong board. Hạn: ${
                  taskData.deadline
                    ? new Date(taskData.deadline).toLocaleDateString('vi-VN')
                    : 'Không xác định'
                }`,
                type: 'task_assigned',
                targetUserId: taskData.assignedTo,
                relatedUserId: currentUser._id,
                taskId: result.data._id || result.data.id,
              }),
            });
          } catch (notifError) {
            console.warn('Could not send notification:', notifError);
          }
        }

        // Update local state
        setLists(
          lists.map((l) => {
            if (l._id === listId) {
              return {
                ...l,
                tasks: [...(l.tasks || []), result.data],
              };
            }
            return l;
          })
        );
        setAddingTaskTo(null);
        setNewTaskTitle('');
        setMenuOpenId(null);

        // Show success message using toast if available
        if (window.toast && window.toast.success) {
          window.toast.success('Task đã được tạo!');
        }
      }
    } catch (err) {
      console.error('Error creating task:', err);
      alert(err.message || 'Không thể tạo task');
    }
  };

  // Open detailed task creation modal
  const openTaskModal = (listId = '') => {
    setTaskForm({
      title: '',
      description: '',
      listId: listId,
      deadline: formatDateTimeForInput(new Date()),
      assignedTo: currentUser._id,
      priority: 'medium',
    });
    setShowTaskModal(true);
  };

  // Handle detailed task form submission
  const handleTaskSubmit = async (e) => {
    e.preventDefault();

    if (!accessToken) {
      if (window.toast && window.toast.error) {
        window.toast.error('Vui lòng đăng nhập lại');
      } else {
        alert('Vui lòng đăng nhập lại');
      }
      return;
    }

    setIsCreatingTask(true);

    try {
      const taskData = {
        ...taskForm,
        boardId,
        deadline: taskForm.deadline || null,
      };

      const result = await createTaskFromCalendar(taskData);

      if (result.success) {
        // Send notification if task is assigned to someone
        if (taskForm.assignedTo && taskForm.assignedTo !== currentUser._id) {
          try {
            await fetch(`${apiBaseUrl}/notification/personal`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              credentials: 'include',
              body: JSON.stringify({
                title: `Task mới được gán: ${taskForm.title}`,
                content: `Bạn đã được gán task "${
                  taskForm.title
                }" trong board. Hạn: ${
                  taskForm.deadline
                    ? new Date(taskForm.deadline).toLocaleDateString('vi-VN')
                    : 'Không xác định'
                }`,
                type: 'task_assigned',
                targetUserId: taskForm.assignedTo,
                relatedUserId: currentUser._id,
                taskId: result.data._id || result.data.id,
              }),
            });
          } catch (notifError) {
            console.warn('Could not send notification:', notifError);
          }
        }

        // Update local state
        setLists(
          lists.map((l) => {
            if (l._id === taskForm.listId) {
              return {
                ...l,
                tasks: [...(l.tasks || []), result.data],
              };
            }
            return l;
          })
        );

        handleCloseTaskModal();

        if (window.toast && window.toast.success) {
          window.toast.success('Task đã được tạo!');
        } else {
          alert('Task đã được tạo!');
        }
      }
    } catch (error) {
      console.error('Error saving task:', error);
      if (window.toast && window.toast.error) {
        window.toast.error('Không thể tạo task');
      } else {
        alert('Không thể tạo task');
      }
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleCloseTaskModal = () => {
    setShowTaskModal(false);
    setTaskForm({
      title: '',
      description: '',
      listId: '',
      deadline: formatDateTimeForInput(new Date()),
      assignedTo: currentUser._id,
      priority: 'medium',
    });
  };

  // hàm update task
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

  // hàm xóa task
  const deleteTask = async (taskId, listId) => {
    if (!window.confirm('Bạn có chắc muốn xóa task này không?')) return;
    try {
      const res = await fetch(`${apiBaseUrl}/task/deleteTask/${taskId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const js = await res.json();
      if (!res.ok) throw new Error(js.message);

      // Cập nhật state: loại bỏ task đã xóa
      setLists(
        lists.map((l) => {
          if (l._id === listId) {
            return {
              ...l,
              tasks: l.tasks.filter((t) => t._id !== taskId),
            };
          }
          return l;
        })
      );
    } catch (err) {
      alert(err.message);
    }
  };
  return (
    <div className='list-container'>
      {lists.map((list, idx) => (
        <div key={list._id} className='list-card'>
          <div className='list-card-header'>
            {editingId === list._id ? (
              <input
                className='add-list-input'
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveListTitle(list._id)}
                autoFocus
              />
            ) : (
              <>
                <span className='list-title'>{list.title}</span>
                <span className='task-count'>{(list.tasks || []).length}</span>
                <div
                  className='list-menu-container'
                  ref={(el) => (menuRefs.current[list._id] = el)}
                >
                  <i
                    className='fas fa-ellipsis-h list-menu-btn'
                    onClick={() =>
                      setMenuOpenId((o) => (o === list._id ? null : list._id))
                    }
                  />
                  {menuOpenId === list._id && (
                    <ul className='list-menu-dropdown'>
                      <li
                        onClick={() => {
                          setEditingId(list._id);
                          setEditTitle(list.title);
                          setMenuOpenId(null);
                        }}
                      >
                        Edit list
                      </li>
                      <li
                        onClick={() => deleteList(list._id)}
                        className='delete'
                      >
                        Delete list
                      </li>
                      <li
                        onClick={() => {
                          setAddingTaskTo(list._id);
                          setNewTaskTitle('');
                          setMenuOpenId(null);
                        }}
                      >
                        Create task (quick)
                      </li>
                      <li
                        onClick={() => {
                          openTaskModal(list._id);
                          setMenuOpenId(null);
                        }}
                      >
                        Create task (detailed)
                      </li>
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          <div className='list-tasks'>
            {(list.tasks || []).map((task) => (
              <div key={task._id} className='task-row'>
                <div
                  className='task-card'
                  onClick={() =>
                    setSelectedTask({ ...task, listTitle: list.title })
                  }
                >
                  <span className='task-title'>{task.title}</span>
                </div>
                <i
                  className='fas fa-times delete-task-btn'
                  onClick={() => deleteTask(task._id, list._id)}
                />
              </div>
            ))}

            {addingTaskTo === list._id && (
              <div className='add-card-form'>
                <input
                  className='add-card-input'
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createTask(list._id)}
                  placeholder='Nhập tên task...'
                  autoFocus
                />
                <div className='add-card-actions'>
                  <button
                    className='btn-add'
                    onClick={() => createTask(list._id)}
                  >
                    Thêm
                  </button>
                  <button
                    className='btn-cancel'
                    onClick={() => setAddingTaskTo(null)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* nút thêm list cuối */}
      <div className='list-card add-new-list'>
        {addingListAt !== null ? (
          <div className='add-list-form'>
            <input
              className='add-list-input'
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createList(addingListAt)}
              placeholder='Nhập tên danh sách...'
              autoFocus
            />
            <div className='add-list-actions'>
              <button
                className='btn-add'
                onClick={() => createList(addingListAt)}
              >
                Thêm danh sách
              </button>
              <button
                className='btn-cancel'
                onClick={() => setAddingListAt(null)}
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <div
            className='add-card-button'
            onClick={() => {
              setAddingListAt(lists.length);
              setNewListTitle('');
            }}
          >
            <i className='fas fa-plus'></i> Thêm danh sách khác
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      <TaskModal
        isOpen={!!selectedTask}
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleTaskUpdated}
      />

      {/* Detailed Task Creation Modal */}
      <Modal
        show={showTaskModal}
        onHide={handleCloseTaskModal}
        size='lg'
        className='board-calendar-modal'
        backdrop='static'
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>📋 Tạo Task mới</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleTaskSubmit}>
          <Modal.Body>
            <Form.Group className='mb-3'>
              <Form.Label>Tiêu đề *</Form.Label>
              <Form.Control
                type='text'
                value={taskForm.title}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, title: e.target.value })
                }
                required
                placeholder='Nhập tiêu đề task...'
              />
            </Form.Group>

            <Form.Group className='mb-3'>
              <Form.Label>Mô tả</Form.Label>
              <Form.Control
                as='textarea'
                rows={3}
                value={taskForm.description}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, description: e.target.value })
                }
                placeholder='Mô tả chi tiết về task...'
              />
            </Form.Group>

            <Form.Group className='mb-3'>
              <Form.Label>List *</Form.Label>
              <Form.Select
                value={taskForm.listId}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, listId: e.target.value })
                }
                className='list-selector'
                required
              >
                <option value=''>Chọn list...</option>
                {lists.map((list) => (
                  <option key={list._id} value={list._id}>
                    📝 {list.title}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className='mb-3'>
              <Form.Label>Deadline</Form.Label>
              <Form.Control
                type='datetime-local'
                value={taskForm.deadline}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, deadline: e.target.value })
                }
              />
              <Form.Text className='text-muted'>
                Để trống nếu không có deadline cụ thể
              </Form.Text>
            </Form.Group>

            <Form.Group className='mb-3'>
              <Form.Label>Độ ưu tiên</Form.Label>
              <Form.Select
                value={taskForm.priority}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, priority: e.target.value })
                }
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className='mb-3'>
              <Form.Label>Gán cho</Form.Label>
              <Form.Select
                value={taskForm.assignedTo}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, assignedTo: e.target.value })
                }
              >
                <option value=''>Chưa gán</option>
                <option value={currentUser._id}>
                  👤 {currentUser.username || currentUser.email} (Tôi)
                </option>
                {boardMembers
                  .filter((member) => member._id !== currentUser._id)
                  .map((member) => (
                    <option key={member._id} value={member._id}>
                      👤 {member.username || member.email}
                    </option>
                  ))}
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant='secondary'
              onClick={handleCloseTaskModal}
              disabled={isCreatingTask}
            >
              Hủy
            </Button>
            <Button
              variant='primary'
              type='submit'
              disabled={isCreatingTask || !taskForm.title || !taskForm.listId}
            >
              {isCreatingTask ? (
                <>
                  <span
                    className='spinner-border spinner-border-sm me-2'
                    role='status'
                    aria-hidden='true'
                  ></span>
                  Đang tạo...
                </>
              ) : (
                <>
                  <i className='bi bi-plus-circle me-1'></i>
                  Tạo Task
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default List;
