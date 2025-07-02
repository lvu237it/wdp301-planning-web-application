import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../../styles/task.css';
import { useCommon } from '../../contexts/CommonContext';
import { Modal, Button, Form, Toast } from 'react-bootstrap';
import Deadline from './Deadline';
import ChecklistModal from './ChecklistModal';
import ProgressTask from './ProgressTask';
import SuggestMembersBySkills from './SuggestMemberBySkills';
import FileManager from '../../components/FileManager';
import { useParams } from 'react-router-dom';

const TaskModal = ({ isOpen, task, onClose, onUpdate }) => {
  const { accessToken, apiBaseUrl, userDataLocal } = useCommon();
  const currentUser = userDataLocal;
  // States chung
  const [editedTitle, setEditedTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedDesc, setEditedDesc] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);
  const [isBoardAdmin, setIsBoardAdmin] = useState(false);
  const [boardWorkStart, setBoardWorkStart] = useState('');
  const [boardWorkEnd, setBoardWorkEnd] = useState('');

  const { workspaceId } = useParams();
  // 1) Check admin & fetch board criteria.workDuration
  useEffect(() => {
    if (!task) return;
    (async () => {
      try {
        const res = await axios.get(
          `${apiBaseUrl}/workspace/${workspaceId}/board/${task.boardId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const board = res.data.board || {};

        // admin check
        const me = currentUser?._id?.toString();
        if (board.creator?._id?.toString() === me) {
          setIsBoardAdmin(true);
        } else {
          const member = (board.members || []).find(
            (m) => (m._id || m.id)?.toString() === me
          );
          if (member && ['admin', 'creator'].includes(member.role)) {
            setIsBoardAdmin(true);
          }
        }

        // pull workDuration
        const wd = board.criteria?.workDuration;
        if (wd?.startDate && wd?.endDate) {
          setBoardWorkStart(wd.startDate);
          setBoardWorkEnd(wd.endDate);
        }
      } catch (err) {
        console.error('Load board info failed:', err);
      }
    })();
  }, [task, apiBaseUrl, accessToken, workspaceId, currentUser]);

  useEffect(() => {
    if (isOpen && task) {
      setEditedTitle(task.title);
      setEditedDesc(task.description || '');
    }
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const currentUserId =
    currentUser?._id?.toString() || currentUser?.id?.toString();
  const assignedById = task.assignedBy
    ? task.assignedBy._id?.toString() || task.assignedBy.id?.toString()
    : null;
  const assignedToId = task.assignedTo
    ? task.assignedTo._id?.toString() || task.assignedTo.id?.toString()
    : null;

  // Assigner: nếu có assignedBy, so sánh; nếu chưa được gán cả, cho phép creator/unassigned
  const isAssigner = Boolean(
    currentUser &&
      (assignedById
        ? assignedById === currentUserId
        : !task.assignedBy && !task.assignedTo)
  );
  // Assignee: so sánh assignedToId
  const isAssignee = Boolean(currentUser && assignedToId === currentUserId);
  const canEdit = isAssigner || isBoardAdmin;

  const mergeTask = (updatedFields) => {
    let assignedTo;
    if (updatedFields.hasOwnProperty('assignedTo')) {
      if (updatedFields.assignedTo === null) {
        assignedTo = null;
      } else if (typeof updatedFields.assignedTo === 'object') {
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
    if (!iso) return '';
    return new Date(iso)
      .toLocaleString('vi-VN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      .replace(',', '');
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
      setToastMessage('Cập nhật tiêu đề thành công');
      setShowToast(true);
      setIsEditingTitle(false);
    } catch (err) {
      console.error(err);
      alert(
        'Cập nhật tiêu đề thất bại: ' +
          (err.response?.data?.message || err.message)
      );
    }
  };
  // File management is now handled by FileManager component

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
      setToastMessage('Cập nhật mô tả thành công');
      setShowToast(true);
    } catch (err) {
      console.error(err);
      alert(
        'Cập nhật mô tả thất bại: ' +
          (err.response?.data?.message || err.message)
      );
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
      setToastMessage(`Đã giao nhiệm vụ cho ${user.username || user.email}`);
      setShowToast(true);
      setShowInviteModal(false);
    } catch (err) {
      console.error('Giao nhiệm vụ thất bại:', err);
      alert(
        'Giao nhiệm vụ thất bại: ' +
          (err.response?.data?.message || err.message)
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
      setToastMessage('Xóa thành công !');
      setShowToast(true);
    } catch (err) {
      console.error('Unassign thất bại:', err);
      alert(
        'Không thể xóa người được giao: ' +
          (err.response?.data?.message || err.message)
      );
    }
  };

  // Function to refresh task data
  const refreshTaskData = async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/task/${task._id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.data.status === 'success') {
        onUpdate(mergeTask(response.data.data));
      }
    } catch (err) {
      console.error('Error refreshing task data:', err);
    }
  };

  return (
    <>
      <Modal
        show={showInviteModal}
        onHide={() => setShowInviteModal(false)}
        centered
        size='lg'
      >
        <Modal.Header closeButton>
          <Modal.Title>Gợi ý & Mời thành viên</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <SuggestMembersBySkills
            workspaceId={task.workspaceId}
            boardId={task.boardId}
            startDate={task.startDate.substr(0, 10)}
            endDate={task.endDate.substr(0, 10)}
            onAssignSuccess={handleAssign}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant='secondary' onClick={() => setShowInviteModal(false)}>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>

      <Toast
        show={showToast}
        bg='success'
        autohide
        delay={3000}
        onClose={() => setShowToast(false)}
        style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2000,
          minWidth: '200px',
        }}
      >
        <Toast.Body className='text-white text-center'>
          {toastMessage}
        </Toast.Body>
      </Toast>
      <div className='task-modal-overlay' onClick={onClose}>
        <div
          className='task-modal'
          onClick={(e) => e.stopPropagation()}
          style={{ maxHeight: '80vh', overflowY: 'auto' }}
        >
          {/* HEADER */}
          <div className='task-modal-header'>
            <div value={task.listId}>{task.listTitle}</div>
            <div className='task-modal-header-actions'>
              <button className='icon-btn' onClick={onClose}>
                <i className='fas fa-times' />
              </button>
            </div>
          </div>

          {/* BODY */}
          <div className='task-modal-body'>
            <div
              className='task-title-wrapper'
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: '16px',
              }}
            >
              {isEditingTitle ? (
                <>
                  <Form.Control
                    type='text'
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    style={{ flexGrow: 1 }}
                  />
                  <Button variant='success' size='sm' onClick={handleSaveTitle}>
                    Lưu
                  </Button>
                  <Button
                    variant='secondary'
                    size='sm'
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
                  <h2 className='task-modal-title' style={{ margin: 0 }}>
                    {task.title}
                  </h2>
                  {isAssigner && (
                    <button
                      onClick={() => {
                        setIsEditingTitle(true);
                      }}
                    >
                      <i className='fas fa-pen fa-lg text-secondary' />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* ACTION BUTTONS */}
            <div style={{ display: 'flex' }}>
              {canEdit && (
                <div className='task-modal-actions'>
                  {!task.assignedTo && (
                    <Button
                      variant='warning'
                      className='btn-action'
                      onClick={() => setShowInviteModal(true)}
                    >
                      <i className='fas fa-person' /> Thêm Member
                    </Button>
                  )}
                  <Button
                    variant='secondary'
                    className='btn-action'
                    onClick={() => setShowFileManager(true)}
                  >
                    <i className='fas fa-file' /> Tệp đính kèm
                  </Button>
                </div>
              )}

              {canEdit ? (
                task.endDate ? (
                  <div
                    style={{ marginLeft: '10px' }}
                    className={`due-badge ${isOverdue ? 'overdue' : ''}`}
                    onClick={() => setShowDeadlineModal(true)}
                  >
                    {formatBadge(task.endDate)}
                    <i
                      className='fas fa-chevron-down'
                      style={{ marginLeft: 6 }}
                    />
                  </div>
                ) : (
                  <Button
                    className='btn-action'
                    onClick={() => setShowDeadlineModal(true)}
                  >
                    <i className='fas fa-clock' /> Ngày
                  </Button>
                )
              ) : task.endDate ? (
                <div className={`due-badge ${isOverdue ? 'overdue' : ''}`}>
                  {formatBadge(task.endDate)}
                </div>
              ) : null}
              {canEdit && (
                <Deadline
                  show={showDeadlineModal}
                  onClose={() => setShowDeadlineModal(false)}
                  task={task}
                  onUpdate={onUpdate}
                  mergeTask={mergeTask}
                  minDate={boardWorkStart}
                  maxDate={boardWorkEnd}
                />
              )}

              {(canEdit || isAssignee) && (
                <>
                  <Button
                    style={{ marginLeft: '10px' }}
                    variant='success'
                    className='icon-btn'
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowChecklistModal(true);
                    }}
                  >
                    <i className='fas fa-list' /> Nhiệm vụ
                  </Button>
                  <ChecklistModal
                    isOpen={showChecklistModal}
                    onClose={() => setShowChecklistModal(false)}
                    task={task}
                    onAdd={(updatedField) => {
                      onUpdate(mergeTask(updatedField));
                      setShowChecklistModal(false);
                    }}
                  />
                </>
              )}
            </div>
            {/* DESCRIPTION */}
            <div className='task-modal-section'>
              <label className='section-label'>Mô tả</label>
              {isAssignee ? (
                <div className='desc-view'>
                  <p>{task.description || 'Chưa có mô tả.'}</p>
                </div>
              ) : isEditingDesc ? (
                <>
                  <textarea
                    className='section-textarea'
                    value={editedDesc}
                    onChange={(e) => setEditedDesc(e.target.value)}
                  />
                  <div className='edit-actions'>
                    <Button variant='success' onClick={handleSaveDesc}>
                      Lưu
                    </Button>
                    <Button
                      variant='danger'
                      onClick={() => {
                        setIsEditingDesc(false);
                        setEditedDesc(task.description || '');
                      }}
                      style={{ marginLeft: 8 }}
                    >
                      Hủy
                    </Button>
                  </div>
                </>
              ) : (
                <div className='desc-view1'>
                  <div className='desc-view'>
                    <p>{task.description || 'Chưa có mô tả.'}</p>
                  </div>
                  {canEdit && (
                    <Button
                      style={{ marginTop: '10px' }}
                      className='btn-edit-desc'
                      onClick={() => {
                        setEditedDesc(task.description || '');
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
            <div className='task-modal-section assigned-info mb-3'>
              <strong>Người được giao:</strong>
              {task.assignedTo ? (
                <div className='d-flex align-items-center mt-1'>
                  {task.assignedTo.avatar && (
                    <img
                      src={
                        task.assignedTo.avatar.startsWith('http')
                          ? task.assignedTo.avatar
                          : `${apiBaseUrl}/uploads/avatars/${task.assignedTo.avatar}`
                      }
                      alt={task.assignedTo.username || task.assignedTo.email}
                      className='rounded-circle'
                      width={32}
                      height={32}
                    />
                  )}
                  <span className='ms-2'>
                    {task.assignedTo.username || task.assignedTo.email}
                  </span>
                  {canEdit && (
                    <Button
                      variant='outline-danger'
                      size='sm'
                      className='ms-3'
                      onClick={handleUnassign}
                    >
                      <i className='fas fa-user-times' /> Xóa
                    </Button>
                  )}
                </div>
              ) : (
                <div className='text-muted-nguoidcgiao'>Chưa có</div>
              )}
            </div>

            {/* ATTACHMENTS */}
            <div className='task-modal-section'>
              <div className='d-flex justify-content-between align-items-center mb-2'>
                <label className='section-label mb-0'>Các tệp đính kèm</label>

                {/* {task.assignedBy._id === currentUser._id && (
                  <Button
                    variant='outline-primary'
                    size='sm'
                    onClick={() => setShowFileManager(true)}
                  >
                    <i className='fas fa-cog'></i> Quản lý
                  </Button>
                )} */}
              </div>

              {task.documents?.length ? (
                <div className='attachments-grid'>
                  {console.log('task', task)}
                  {console.log('task.documents', task.documents)}
                  {task.documents.map((doc) => (
                    <div
                      key={doc._id}
                      className='attachment-item'
                      onClick={() => window.open(doc.url, '_blank')}
                    >
                      <div className='attachment-icon'>
                        {doc.type === 'image'
                          ? '🖼️'
                          : doc.type === 'pdf'
                          ? '📄'
                          : doc.type === 'doc'
                          ? '📝'
                          : '📁'}
                      </div>
                      <div className='attachment-info'>
                        <div className='attachment-name' title={doc.name}>
                          {doc.name}
                        </div>
                        <div className='attachment-meta'>
                          <small className='text-muted'>{doc.type}</small>
                        </div>
                      </div>
                      <div className='attachment-actions'>
                        <i className='fas fa-external-link-alt'></i>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-center py-4 text-muted'>
                  <i className='fas fa-file-plus fa-2x mb-2 d-block'></i>
                  <p className='mb-2'>Chưa có tệp đính kèm.</p>
                  {task.assignedBy._id === currentUser._id && (
                    <Button
                      variant='outline-primary'
                      size='sm'
                      onClick={() => setShowFileManager(true)}
                    >
                      <i className='fas fa-plus me-1'></i>
                      Thêm file đầu tiên
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* CHECKLIST */}
            <ProgressTask
              task={task}
              mergeTask={mergeTask}
              onUpdate={onUpdate}
              isAssignee={isAssignee}
              isAssigner={isAssigner}
            />
          </div>
        </div>
      </div>

      {/* File Manager Modal */}
      <FileManager
        taskId={task._id}
        isOpen={showFileManager}
        onClose={() => setShowFileManager(false)}
        onFileChange={refreshTaskData}
      />
    </>
  );
};

export default TaskModal;
