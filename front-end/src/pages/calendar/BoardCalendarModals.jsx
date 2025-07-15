import React from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import {
  FaEdit,
  FaTrash,
  FaTimes,
  FaComments,
  FaPaperPlane,
  FaMapMarkerAlt,
  FaGlobe,
  FaCheck,
  FaUser,
} from 'react-icons/fa';
import { motion } from 'framer-motion';

// Event Modal Component
export const EventModal = ({
  show,
  onHide,
  eventForm,
  setEventForm,
  onSubmit,
  isCreating,
  selectedEvent,
  eventTypes,
  statusOptions,
  boardMembers,
}) => {
  return (
    <Modal
      show={show}
      onHide={onHide}
      size='lg'
      className='board-calendar-modal'
      backdrop='static'
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title>
          📅 {selectedEvent ? 'Chỉnh sửa Sự kiện' : 'Tạo Sự kiện mới'}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={onSubmit}>
        <Modal.Body>
          <Form.Group className='mb-3'>
            <Form.Label>Tiêu đề *</Form.Label>
            <Form.Control
              type='text'
              value={eventForm.title}
              onChange={(e) =>
                setEventForm({ ...eventForm, title: e.target.value })
              }
              required
            />
          </Form.Group>

          <Form.Group className='mb-3'>
            <Form.Label>Mô tả</Form.Label>
            <Form.Control
              as='textarea'
              rows={3}
              value={eventForm.description}
              onChange={(e) =>
                setEventForm({ ...eventForm, description: e.target.value })
              }
            />
          </Form.Group>

          <div className='row'>
            <div className='col-md-6'>
              <Form.Group className='mb-3'>
                <Form.Label>Thời gian bắt đầu *</Form.Label>
                <Form.Control
                  type='datetime-local'
                  value={eventForm.startDate}
                  onChange={(e) =>
                    setEventForm({
                      ...eventForm,
                      startDate: e.target.value,
                    })
                  }
                  required
                />
              </Form.Group>
            </div>
            <div className='col-md-6'>
              <Form.Group className='mb-3'>
                <Form.Label>Thời gian kết thúc *</Form.Label>
                <Form.Control
                  type='datetime-local'
                  value={eventForm.endDate}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, endDate: e.target.value })
                  }
                  required
                />
              </Form.Group>
            </div>
          </div>

          <Form.Group className='mb-3'>
            <Form.Label>Loại sự kiện</Form.Label>
            <Form.Select
              value={eventForm.type}
              onChange={(e) =>
                setEventForm({ ...eventForm, type: e.target.value })
              }
            >
              <option value='offline'>📍 Trực tiếp</option>
              <option value='online'>🌐 Trực tuyến</option>
            </Form.Select>
          </Form.Group>

          {eventForm.type === 'offline' && (
            <Form.Group className='mb-3'>
              <Form.Label>Địa điểm</Form.Label>
              <Form.Control
                type='text'
                placeholder='Nhập địa điểm...'
                value={eventForm.locationName}
                onChange={(e) =>
                  setEventForm({
                    ...eventForm,
                    locationName: e.target.value,
                  })
                }
              />
            </Form.Group>
          )}

          {eventForm.type === 'online' && (
            <Form.Group className='mb-3'>
              <Form.Label>Link online</Form.Label>
              <Form.Control
                type='url'
                placeholder='https://...'
                value={eventForm.onlineUrl}
                onChange={(e) =>
                  setEventForm({ ...eventForm, onlineUrl: e.target.value })
                }
              />
            </Form.Group>
          )}

          <Form.Group className='mb-3'>
            <Form.Label>Trạng thái</Form.Label>
            <Form.Select
              value={eventForm.status}
              onChange={(e) =>
                setEventForm({ ...eventForm, status: e.target.value })
              }
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className='mb-3'>
            <Form.Label>
              Email người tham gia (phân cách bằng dấu phẩy)
            </Form.Label>
            <Form.Control
              type='text'
              placeholder='email1@example.com, email2@example.com'
              value={eventForm.participantEmails}
              onChange={(e) =>
                setEventForm({
                  ...eventForm,
                  participantEmails: e.target.value,
                })
              }
            />
            <Form.Text className='text-muted'>
              Hoặc chọn từ thành viên board:
            </Form.Text>
            <div
              className='mt-2'
              style={{ maxHeight: '120px', overflowY: 'auto' }}
            >
              {boardMembers.map((member) => (
                <Button
                  key={member._id}
                  variant='outline-secondary'
                  size='sm'
                  className='me-2 mb-2'
                  onClick={() => {
                    const emails = eventForm.participantEmails
                      ? eventForm.participantEmails
                          .split(',')
                          .map((e) => e.trim())
                      : [];

                    if (!emails.includes(member.email)) {
                      emails.push(member.email);
                      setEventForm({
                        ...eventForm,
                        participantEmails: emails.join(', '),
                      });
                    }
                  }}
                  disabled={eventForm.participantEmails?.includes(member.email)}
                >
                  <FaUser className='me-1' />
                  {member.username}
                  {eventForm.participantEmails?.includes(member.email) && (
                    <FaCheck className='ms-1 text-success' />
                  )}
                </Button>
              ))}
            </div>
          </Form.Group>

          <Form.Check
            type='checkbox'
            label='Cả ngày'
            checked={eventForm.allDay}
            onChange={(e) =>
              setEventForm({ ...eventForm, allDay: e.target.checked })
            }
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant='secondary' onClick={onHide}>
            Hủy
          </Button>
          <Button variant='primary' type='submit' disabled={isCreating}>
            {isCreating ? (
              <>
                <Spinner
                  as='span'
                  animation='border'
                  size='sm'
                  role='status'
                  aria-hidden='true'
                  className='me-2'
                />
                {selectedEvent ? 'Đang cập nhật...' : 'Đang tạo...'}
              </>
            ) : selectedEvent ? (
              'Cập nhật'
            ) : (
              'Tạo mới'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

// Event Detail Modal Component
export const EventDetailModal = ({
  show,
  onHide,
  selectedEvent,
  formatEventDate,
  getAddressDisplay,
  generateMapsUrl,
  eventTypes,
  showChat,
  setShowChat,
  loadEventMessages,
  messages,
  isLoadingMessages,
  newMessage,
  setNewMessage,
  handleSendMessage,
  canSendMessage,
  messagesEndRef,
  editingMessageId,
  editingContent,
  setEditingContent,
  submitMessageEdit,
  cancelEditing,
  startEditing,
  handleDeleteMessage,
  contextMenu,
  setContextMenu,
  currentUserId,
  canEditEvent,
  onEdit,
  onDelete,
}) => {
  if (!selectedEvent) return null;

  const shouldShowChatFeature = (event) => {
    const allowedStatuses = ['scheduled', 'in-progress', 'draft'];
    return allowedStatuses.includes(event.status) || !event.status;
  };

  return (
    <motion.div
      className='event-modal-overlay'
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onHide}
    >
      <motion.div
        className='event-modal'
        style={{ marginTop: 50 }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='event-modal-header'>
          <h2 className='event-modal-title'>{selectedEvent.title}</h2>
          <button className='event-modal-close' onClick={onHide}>
            <FaTimes />
          </button>
        </div>
        <div className='event-modal-content'>
          <div className='mb-3'>
            <div className='event-badges-container'>
              <div
                className={`event-type-badge event-type-${selectedEvent.type} d-inline-block mb-2 me-2`}
              >
                {eventTypes[selectedEvent.type]?.icon}{' '}
                {eventTypes[selectedEvent.type]?.label}
              </div>
              {selectedEvent.status && selectedEvent.status !== 'scheduled' && (
                <div
                  className={`event-status-badge status-${selectedEvent.status}`}
                >
                  {selectedEvent.status === 'in-progress' && '🔄 Đang diễn ra'}
                  {selectedEvent.status === 'completed' && '✅ Đã xong'}
                  {selectedEvent.status === 'cancelled' && '❌ Đã hủy'}
                  {selectedEvent.status === 'draft' && '📝 Nháp'}
                </div>
              )}
            </div>
          </div>
          <div className='event-info'>
            <p>
              <strong>📅 Thời gian:</strong>{' '}
              {formatEventDate(new Date(selectedEvent.start))}
              {selectedEvent.end && (
                <> - {formatEventDate(new Date(selectedEvent.end))}</>
              )}
            </p>
            {selectedEvent.description && (
              <p>
                <strong>📝 Mô tả:</strong> {selectedEvent.description}
              </p>
            )}
            {selectedEvent.type === 'offline' && selectedEvent.address && (
              <p>
                <strong>📍 Địa điểm:</strong>{' '}
                {getAddressDisplay(selectedEvent.address)}
                <Button
                  variant='outline-light'
                  size='sm'
                  onClick={(e) => {
                    e.stopPropagation();
                    const mapsUrl = generateMapsUrl(selectedEvent.address);
                    window.open(mapsUrl, '_blank');
                  }}
                  className='ms-2'
                  title='Mở bản đồ'
                >
                  <FaMapMarkerAlt />
                </Button>
              </p>
            )}
            {selectedEvent.type === 'online' && selectedEvent.onlineUrl && (
              <p>
                <strong>🌐 Link:</strong>{' '}
                <a
                  href={selectedEvent.onlineUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  Tham gia sự kiện
                </a>
              </p>
            )}
            {selectedEvent.organizer && (
              <p>
                <strong>👤 Người tổ chức:</strong>{' '}
                {selectedEvent.organizer.username ||
                  selectedEvent.organizer.email}
              </p>
            )}
          </div>

          {/* Chat Section */}
          {shouldShowChatFeature(selectedEvent) && (
            <div className='chat-container mt-4'>
              <div className='d-flex justify-content-between align-items-center mb-3'>
                <h5>💬 Thảo luận</h5>
                {!showChat && (
                  <Button
                    variant='outline-primary'
                    size='sm'
                    onClick={() => {
                      setShowChat(true);
                      loadEventMessages(selectedEvent.id);
                    }}
                  >
                    <FaComments className='me-1' />
                    Mở chat
                  </Button>
                )}
                {showChat && (
                  <Button
                    variant='outline-secondary'
                    size='sm'
                    onClick={() => setShowChat(false)}
                  >
                    <FaTimes className='me-1' />
                    Đóng
                  </Button>
                )}
              </div>

              {showChat && (
                <div className='messages-area' style={{ height: '300px' }}>
                  {isLoadingMessages ? (
                    <div className='d-flex justify-content-center align-items-center h-100'>
                      <div className='spinner-border spinner-border-sm' />
                    </div>
                  ) : (
                    <>
                      <div
                        className='messages-container'
                        style={{
                          height: canSendMessage ? '250px' : '300px',
                          overflowY: 'auto',
                          padding: '10px',
                          backgroundColor: 'rgba(0,0,0,0.05)',
                          borderRadius: '8px',
                        }}
                      >
                        {messages.length > 0 ? (
                          messages.map((message) => {
                            const isSystemMessage = message.isSystemMessage;

                            // System messages - special rendering
                            if (isSystemMessage) {
                              return (
                                <div
                                  key={message._id}
                                  className='messenger-message messenger-system'
                                  style={{
                                    justifyContent: 'center',
                                    marginBottom: '16px',
                                  }}
                                >
                                  <div
                                    className='messenger-system-bubble'
                                    style={{
                                      backgroundColor: '#fff3cd',
                                      border: '1px solid #ffeaa7',
                                      borderRadius: '16px',
                                      padding: '12px 16px',
                                      maxWidth: '80%',
                                      textAlign: 'center',
                                      color: '#856404',
                                      fontSize: '0.9rem',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '8px',
                                    }}
                                  >
                                    <span style={{ fontSize: '1.1rem' }}>
                                      🔔
                                    </span>
                                    <span>{message.content}</span>
                                  </div>
                                  <div
                                    className='messenger-time'
                                    style={{
                                      textAlign: 'center',
                                      marginTop: '4px',
                                      fontSize: '0.8rem',
                                      color: '#6c757d',
                                    }}
                                  >
                                    {new Date(message.createdAt).toLocaleString(
                                      'vi-VN',
                                      {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        day: '2-digit',
                                        month: '2-digit',
                                      }
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            // Regular messages
                            return (
                              <div
                                key={message._id}
                                className={`messenger-message ${
                                  message.sender._id === currentUserId
                                    ? 'messenger-own'
                                    : ''
                                }`}
                              >
                                {message.sender._id !== currentUserId && (
                                  <div className='messenger-avatar'>
                                    <img
                                      src={
                                        message.sender.avatar ||
                                        '/images/user-avatar-default.png'
                                      }
                                      alt={message.sender.username}
                                    />
                                  </div>
                                )}
                                <div className='messenger-content'>
                                  {message.sender._id !== currentUserId && (
                                    <div className='messenger-sender'>
                                      {message.sender.username}
                                    </div>
                                  )}
                                  {editingMessageId === message._id ? (
                                    <div className='messenger-edit-form'>
                                      <Form.Control
                                        type='text'
                                        value={editingContent}
                                        onChange={(e) =>
                                          setEditingContent(e.target.value)
                                        }
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter') {
                                            submitMessageEdit(message._id);
                                          }
                                        }}
                                        className='messenger-edit-input'
                                      />
                                      <div className='messenger-edit-actions'>
                                        <Button
                                          size='sm'
                                          variant='success'
                                          onClick={() =>
                                            submitMessageEdit(message._id)
                                          }
                                          className='messenger-edit-save'
                                        >
                                          <FaCheck />
                                        </Button>
                                        <Button
                                          size='sm'
                                          variant='secondary'
                                          onClick={cancelEditing}
                                          className='messenger-edit-cancel'
                                        >
                                          <FaTimes />
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      className={`messenger-bubble ${
                                        message.sender._id === currentUserId
                                          ? 'messenger-bubble-own'
                                          : 'messenger-bubble-other'
                                      }`}
                                      onContextMenu={(e) => {
                                        if (
                                          message.sender._id === currentUserId
                                        ) {
                                          e.preventDefault();
                                          setContextMenu({
                                            x: e.clientX,
                                            y: e.clientY,
                                            message,
                                          });
                                        }
                                      }}
                                    >
                                      {message.content}
                                      <div className='messenger-time'>
                                        {new Date(
                                          message.createdAt
                                        ).toLocaleTimeString('vi-VN', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                        {message.isEdited && (
                                          <span className='messenger-edited'>
                                            (đã chỉnh sửa)
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className='text-center text-muted'>
                            Chưa có tin nhắn nào
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      {canSendMessage && (
                        <div className='message-input mt-2'>
                          <div className='input-group'>
                            <Form.Control
                              type='text'
                              placeholder='Nhập tin nhắn...'
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleSendMessage();
                                }
                              }}
                            />
                            <Button
                              variant='primary'
                              onClick={handleSendMessage}
                              disabled={!newMessage.trim()}
                            >
                              <FaPaperPlane />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className='event-modal-actions mt-4'>
            {canEditEvent(selectedEvent) && (
              <>
                <Button variant='primary' className='me-2' onClick={onEdit}>
                  <FaEdit className='me-1' />
                  Chỉnh sửa
                </Button>
                <Button
                  variant='danger'
                  onClick={() => {
                    if (window.confirm('Bạn có chắc muốn xóa sự kiện này?')) {
                      onDelete(selectedEvent.id);
                    }
                  }}
                >
                  <FaTrash className='me-1' />
                  Xóa
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Conflict Modal Component
export const ConflictModal = ({
  show,
  onHide,
  conflictEvents,
  formatEventDate,
  onCreateWithConflict,
  isCreating,
}) => {
  return (
    <Modal
      show={show}
      onHide={onHide}
      size='lg'
      className='conflict-modal'
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title>⚠️ Phát hiện xung đột lịch trình</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant='warning'>
          <strong>
            ⚠️ Lưu ý: Sự kiện này có thể trùng thời gian với các sự kiện khác
          </strong>
        </Alert>

        <div className='conflict-events-list'>
          {conflictEvents.map((event) => (
            <div key={event._id} className='bg-danger-subtle p-3 mb-2 rounded'>
              <h6 className='mb-1'>{event.title}</h6>
              <p className='mb-1 text-muted'>
                📅 {formatEventDate(new Date(event.startDate))} -{' '}
                {formatEventDate(new Date(event.endDate))}
              </p>
              {event.description && (
                <p className='mb-0 small'>{event.description}</p>
              )}
            </div>
          ))}
        </div>

        <Alert variant='info' className='mt-3'>
          <strong>Bạn vẫn có thể tạo sự kiện này.</strong> Hãy đảm bảo bạn có
          thể sắp xếp thời gian phù hợp.
        </Alert>
      </Modal.Body>
      <Modal.Footer>
        <Button variant='secondary' onClick={onHide} className='me-2'>
          Quay lại chỉnh sửa
        </Button>
        <Button
          variant='success'
          onClick={onCreateWithConflict}
          disabled={isCreating}
        >
          {isCreating ? (
            <>
              <Spinner
                as='span'
                animation='border'
                size='sm'
                role='status'
                aria-hidden='true'
                className='me-2'
              />
              Đang tạo...
            </>
          ) : (
            <>Tiếp tục tạo sự kiện</>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Context Menu Component
export const ContextMenu = ({
  contextMenu,
  setContextMenu,
  startEditing,
  handleDeleteMessage,
}) => {
  if (!contextMenu) return null;

  return (
    <div
      className='messenger-context-menu'
      style={{
        position: 'fixed',
        top: contextMenu.y,
        left: contextMenu.x,
        zIndex: 9999,
      }}
      onMouseLeave={() => setContextMenu(null)}
    >
      <div
        className='messenger-action-item'
        onClick={() => {
          startEditing(contextMenu.message);
          setContextMenu(null);
        }}
      >
        <FaEdit className='me-2' />
        Chỉnh sửa
      </div>
      <div
        className='messenger-action-item messenger-delete'
        onClick={() => {
          handleDeleteMessage(contextMenu.message._id);
          setContextMenu(null);
        }}
      >
        <FaTrash className='me-2' />
        Xóa
      </div>
    </div>
  );
};
