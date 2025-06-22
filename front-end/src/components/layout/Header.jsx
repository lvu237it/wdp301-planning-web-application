import { FaBell, FaSearch } from 'react-icons/fa';
import { Dropdown, Modal, Badge, Spinner } from 'react-bootstrap';
import defaultAvatar from '/images/user-avatar-default.png';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useCommon } from '../../contexts/CommonContext';

const Header = () => {
  const {
    navigate,
    logout,
    notifications,
    markNotificationAsRead,
    respondToEventInvitation,
    fetchNotifications,
    loadMoreNotifications,
    notificationPagination,
    isAuthenticated,
    userDataLocal,
    formatDateAMPMForVN,
    socketConnected,
    toast,
  } = useCommon();
  const [showPopover, setShowPopover] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(new Map());
  const [respondedNotifications, setRespondedNotifications] = useState(
    new Set()
  );

  // Refs for infinite scroll
  const dropdownScrollRef = useRef(null);
  const modalScrollRef = useRef(null);

  const unreadCount = notifications?.filter((n) => !n.isRead)?.length || 0;

  const handleAvatarClick = () => {
    setShowPopover(!showPopover);
    setShowNotifDropdown(false);
    setShowNotifModal(false);
  };

  const handleNotificationClick = async (
    notificationId,
    eventId = null,
    notificationType = null,
    responseStatus = null,
    isRead = false
  ) => {
    // Chỉ mark as read nếu chưa được đọc
    if (!isRead) {
      await markNotificationAsRead(notificationId);
    }

    // Nếu thông báo có eventId và user đã chấp nhận tham gia event, navigate tới calendar
    if (
      eventId &&
      notificationType === 'event_invitation' &&
      responseStatus === 'accepted'
    ) {
      navigate('/calendar');
      // Đóng dropdown/modal sau khi navigate
      setShowNotifDropdown(false);
      setShowNotifModal(false);
    } else if (eventId && notificationType !== 'event_invitation') {
      // Đối với các loại notification khác về event (event_update, event_reminder, etc.)
      navigate('/calendar');
      setShowNotifDropdown(false);
      setShowNotifModal(false);
    }
  };

  const handleEventInvitationResponse = async (
    eventId,
    status,
    notificationId,
    event
  ) => {
    event.stopPropagation(); // Ngăn việc click vào notification

    // Thêm notification vào loading map với status
    setLoadingNotifications((prev) =>
      new Map(prev).set(notificationId, status)
    );

    try {
      const result = await respondToEventInvitation(
        eventId,
        status,
        notificationId
      );

      if (result.success) {
        // Mark notification as responded immediately for UI
        setRespondedNotifications((prev) => new Set([...prev, notificationId]));

        // Fetch lại notifications mới nhất sau khi respond thành công
        await fetchNotifications(true);

        // Force re-render để đảm bảo UI cập nhật ngay lập tức
        setTimeout(() => {
          if (result.success) {
            toast.success(
              status === 'accepted'
                ? 'Đã chấp nhận lời mời sự kiện'
                : 'Đã từ chối lời mời sự kiện'
            );
          }
        }, 100);
      } else if (result.hasConflict && status === 'accepted') {
        // Show conflict modal for acceptance
        setLoadingNotifications((prev) => {
          const newMap = new Map(prev);
          newMap.delete(notificationId);
          return newMap;
        });

        // Dispatch event for Calendar to handle conflict modal
        window.dispatchEvent(
          new CustomEvent('eventConflict', {
            detail: {
              eventId,
              notificationId,
              conflictData: result.conflictData,
            },
          })
        );
        return; // Exit early to prevent removal from loading map again
      }
    } finally {
      // Remove notification khỏi loading map
      setLoadingNotifications((prev) => {
        const newMap = new Map(prev);
        newMap.delete(notificationId);
        return newMap;
      });
    }
  };

  const handleProfileClick = () => {
    navigate('/profile');
    setShowPopover(false);
  };

  const handleLogoutClick = () => {
    logout();
    setShowPopover(false);
  };

  const renderButtonContent = (status, isLoading) => {
    if (isLoading) {
      return (
        <span className='d-flex align-items-center justify-content-center'>
          <span
            className='spinner-border spinner-border-sm me-1'
            role='status'
            aria-hidden='true'
            style={{ width: '12px', height: '12px' }}
          ></span>
          Đang xử lý...
        </span>
      );
    }
    return status === 'accepted' ? 'Chấp nhận' : 'Từ chối';
  };

  const toggleNotifDropdown = () => {
    setShowNotifDropdown(!showNotifDropdown);
    setShowPopover(false);
    setShowNotifModal(false);
  };

  const toggleNotifModal = () => {
    setShowNotifModal(!showNotifModal);
    setShowPopover(false);
    setShowNotifDropdown(false);
  };

  // Infinite scroll handler
  const handleScroll = useCallback(
    (e) => {
      const { scrollTop, scrollHeight, clientHeight } = e.target;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

      // Trigger load more when scrolled 80% down
      if (
        scrollPercentage > 0.8 &&
        notificationPagination.hasMore &&
        !notificationPagination.loading
      ) {
        loadMoreNotifications();
      }
    },
    [
      notificationPagination.hasMore,
      notificationPagination.loading,
      loadMoreNotifications,
    ]
  );

  const renderNotifications = () => {
    if (!notifications || notifications.length === 0) {
      return (
        <Dropdown.Item disabled className='text-center text-muted py-3'>
          Bạn không có thông báo nào
        </Dropdown.Item>
      );
    }

    return (
      <div
        ref={dropdownScrollRef}
        style={{ maxHeight: '400px', overflowY: 'auto', width: '320px' }}
        onScroll={handleScroll}
      >
        {notifications.map((notif) => (
          <Dropdown.Item
            key={notif.notificationId}
            onClick={() =>
              handleNotificationClick(
                notif.notificationId,
                notif.eventId,
                notif.type,
                notif.responseStatus,
                notif.isRead
              )
            }
            className={`notification-item py-2 ${
              notif.isRead ? 'text-muted' : 'fw-bold'
            }`}
            style={{
              whiteSpace: 'normal',
              borderBottom: '1px solid #eee',
              cursor: canNavigateToCalendar(
                notif.eventId,
                notif.type,
                notif.responseStatus
              )
                ? 'pointer'
                : 'default',
            }}
            title={
              canNavigateToCalendar(
                notif.eventId,
                notif.type,
                notif.responseStatus
              )
                ? 'Click to view in calendar'
                : ''
            }
          >
            <div className='d-flex flex-column'>
              <span className='notification-title mb-1'>
                {notif.title}
                {notif.eventId && (
                  <small
                    className='ms-2'
                    style={{
                      color: canNavigateToCalendar(
                        notif.eventId,
                        notif.type,
                        notif.responseStatus
                      )
                        ? '#007bff'
                        : '#6c757d',
                    }}
                  >
                    📅
                  </small>
                )}
              </span>
              <small className='notification-content text-wrap'>
                {notif.content}
              </small>
              <small className='text-muted mt-1'>{notif.createdAt}</small>

              {/* Hiển thị buttons cho event invitation nếu chưa respond */}
              {notif.type === 'event_invitation' &&
                (!notif.responseStatus || notif.responseStatus === 'pending') &&
                !respondedNotifications.has(notif.notificationId) && (
                  <div className='d-flex gap-2 mt-2' style={{ gap: '8px' }}>
                    <button
                      className='btn btn-success btn-sm'
                      onClick={(e) =>
                        handleEventInvitationResponse(
                          notif.eventId,
                          'accepted',
                          notif.notificationId,
                          e
                        )
                      }
                      disabled={loadingNotifications.has(notif.notificationId)}
                      style={{
                        fontSize: '12px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        minWidth: '85px',
                        opacity: loadingNotifications.has(notif.notificationId)
                          ? 0.7
                          : 1,
                        cursor: loadingNotifications.has(notif.notificationId)
                          ? 'not-allowed'
                          : 'pointer',
                      }}
                    >
                      {renderButtonContent(
                        'accepted',
                        loadingNotifications.get(notif.notificationId) ===
                          'accepted'
                      )}
                    </button>
                    <button
                      className='btn btn-outline-danger btn-sm'
                      onClick={(e) =>
                        handleEventInvitationResponse(
                          notif.eventId,
                          'declined',
                          notif.notificationId,
                          e
                        )
                      }
                      disabled={loadingNotifications.has(notif.notificationId)}
                      style={{
                        fontSize: '12px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        minWidth: '80px',
                        opacity: loadingNotifications.has(notif.notificationId)
                          ? 0.7
                          : 1,
                        cursor: loadingNotifications.has(notif.notificationId)
                          ? 'not-allowed'
                          : 'pointer',
                      }}
                    >
                      {renderButtonContent(
                        'declined',
                        loadingNotifications.get(notif.notificationId) ===
                          'declined'
                      )}
                    </button>
                  </div>
                )}

              {/* Hiển thị trạng thái sau khi đã respond */}
              {notif.type === 'event_invitation' &&
                notif.responseStatus &&
                notif.responseStatus !== 'pending' && (
                  <div className='mt-2'>
                    <small
                      className={`badge ${
                        notif.responseStatus === 'accepted'
                          ? 'bg-success'
                          : notif.responseStatus === 'declined'
                          ? 'bg-danger'
                          : 'bg-secondary'
                      }`}
                      style={{ fontSize: '10px' }}
                    >
                      {notif.responseStatus === 'accepted'
                        ? '✓ Đã chấp nhận'
                        : notif.responseStatus === 'declined'
                        ? '✗ Đã từ chối'
                        : ''}
                    </small>
                  </div>
                )}
            </div>
          </Dropdown.Item>
        ))}

        {/* Loading indicator */}
        {notificationPagination.loading && (
          <div className='text-center py-3'>
            <Spinner animation='border' size='sm' variant='primary' />
            <div className='text-muted mt-2' style={{ fontSize: '0.85rem' }}>
              Đang tải thêm thông báo...
            </div>
          </div>
        )}

        {/* End indicator */}
        {!notificationPagination.hasMore && notifications.length > 0 && (
          <div className='text-center py-2'>
            <small className='text-muted'>
              Đã hiển thị tất cả thông báo ({notificationPagination.totalCount})
            </small>
          </div>
        )}
      </div>
    );
  };

  // Helper function để kiểm tra có thể navigate tới calendar không
  const canNavigateToCalendar = (eventId, type, responseStatus) => {
    if (!eventId) return false;

    // Event invitation: chỉ navigate khi đã accept
    if (type === 'event_invitation') {
      return responseStatus === 'accepted';
    }

    // Các loại notification khác về event: luôn có thể navigate
    return true;
  };

  return (
    <header className='header'>
      <div className='header-left'>
        {/* <div className='search-bar'>
          <FaSearch className='search-icon' />
          <input type='text' placeholder='Search...' />
        </div> */}
      </div>
      <div className='header-right'>
        {isAuthenticated && userDataLocal && (
          <>
            {/* Socket status indicator */}
            <div className='d-flex align-items-center me-2'>
              <div
                className={`socket-status ${
                  socketConnected ? 'connected' : 'disconnected'
                }`}
                title={
                  socketConnected ? 'Socket connected' : 'Socket disconnected'
                }
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: socketConnected ? '#28a745' : '#dc3545',
                  marginRight: '4px',
                  animation: socketConnected ? 'none' : 'blink 1s infinite',
                }}
              ></div>
              <small
                style={{
                  color: socketConnected ? '#28a745' : '#dc3545',
                  fontSize: '10px',
                }}
              >
                {socketConnected ? 'Online' : 'Offline'}
              </small>
            </div>
            <div className='notification-container d-none d-md-block'>
              <Dropdown show={showNotifDropdown} onToggle={toggleNotifDropdown}>
                <button
                  className='notification-btn d-flex align-items-center justify-content-center'
                  onClick={toggleNotifDropdown}
                  style={{ position: 'relative' }}
                >
                  <FaBell />
                  {unreadCount > 0 && (
                    <Badge
                      bg='danger'
                      className='notification-badge'
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '1px',
                        fontSize: '10px',
                        minWidth: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0',
                        transform: 'none',
                      }}
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  )}
                </button>
                <Dropdown.Menu className='p-0 notification-dropdown-menu'>
                  {renderNotifications()}
                </Dropdown.Menu>
              </Dropdown>
            </div>
            <div className='notification-container d-md-none'>
              <button
                className='notification-btn d-flex align-items-center justify-content-center'
                onClick={toggleNotifModal}
                style={{ position: 'relative' }}
              >
                <FaBell />
                {unreadCount > 0 && (
                  <Badge
                    bg='danger'
                    className='notification-badge'
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '1px',
                      fontSize: '10px',
                      minWidth: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0',
                      transform: 'none',
                    }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </button>
            </div>
            <div className='user-info d-none d-sm-flex align-items-center'>
              <span className='user-name'>{userDataLocal.username}</span>
            </div>
          </>
        )}
        <div className='avatar-container'>
          <div className='avatar' onClick={handleAvatarClick}>
            <img src={defaultAvatar} alt='User Avatar' />
          </div>
          {showPopover && (
            <div className='avatar-popover'>
              {isAuthenticated && userDataLocal ? (
                <>
                  {/* <div className='popover-item' onClick={handleProfileClick}>
                    Profile
                  </div> */}
                  <div className='popover-item' onClick={handleLogoutClick}>
                    Logout
                  </div>
                </>
              ) : (
                <>
                  <div
                    className='popover-item'
                    onClick={() => navigate('/register')}
                  >
                    Register
                  </div>
                  <div
                    className='popover-item'
                    onClick={() => navigate('/login')}
                  >
                    Login
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal show={showNotifModal} onHide={toggleNotifModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Thông báo</Modal.Title>
        </Modal.Header>
        <Modal.Body
          ref={modalScrollRef}
          style={{ maxHeight: '70vh', overflowY: 'auto', padding: '1rem' }}
          onScroll={handleScroll}
        >
          {notifications && notifications.length > 0 ? (
            notifications.map((notif) => (
              <div
                key={notif.notificationId}
                onClick={() =>
                  handleNotificationClick(
                    notif.notificationId,
                    notif.eventId,
                    notif.type,
                    notif.responseStatus,
                    notif.isRead
                  )
                }
                className={`notification-item py-2 ${
                  notif.isRead ? 'text-muted' : 'fw-bold'
                }`}
                style={{
                  whiteSpace: 'normal',
                  borderBottom: '1px solid #eee',
                  cursor: canNavigateToCalendar(
                    notif.eventId,
                    notif.type,
                    notif.responseStatus
                  )
                    ? 'pointer'
                    : 'default',
                }}
                title={
                  canNavigateToCalendar(
                    notif.eventId,
                    notif.type,
                    notif.responseStatus
                  )
                    ? 'Click to view in calendar'
                    : ''
                }
              >
                <div className='d-flex flex-column'>
                  <span className='notification-title mb-1'>
                    {notif.title}
                    {notif.eventId && (
                      <small
                        className='ms-2'
                        style={{
                          color: canNavigateToCalendar(
                            notif.eventId,
                            notif.type,
                            notif.responseStatus
                          )
                            ? '#007bff'
                            : '#6c757d',
                        }}
                      >
                        📅
                        {notif.type === 'event_invitation' &&
                          notif.responseStatus !== 'accepted' && (
                            <span
                              style={{ fontSize: '8px', marginLeft: '2px' }}
                            >
                              🔒
                            </span>
                          )}
                      </small>
                    )}
                  </span>
                  <small className='notification-content text-wrap'>
                    {notif.content}
                  </small>
                  <small className='text-muted mt-1'>{notif.createdAt}</small>

                  {/* Hiển thị buttons cho event invitation nếu chưa respond */}
                  {notif.type === 'event_invitation' &&
                    (!notif.responseStatus ||
                      notif.responseStatus === 'pending') &&
                    !respondedNotifications.has(notif.notificationId) && (
                      <div className='d-flex gap-2 mt-2' style={{ gap: '8px' }}>
                        <button
                          className='btn btn-success btn-sm'
                          onClick={(e) =>
                            handleEventInvitationResponse(
                              notif.eventId,
                              'accepted',
                              notif.notificationId,
                              e
                            )
                          }
                          disabled={loadingNotifications.has(
                            notif.notificationId
                          )}
                          style={{
                            fontSize: '12px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            minWidth: '85px',
                            opacity: loadingNotifications.has(
                              notif.notificationId
                            )
                              ? 0.7
                              : 1,
                            cursor: loadingNotifications.has(
                              notif.notificationId
                            )
                              ? 'not-allowed'
                              : 'pointer',
                          }}
                        >
                          {renderButtonContent(
                            'accepted',
                            loadingNotifications.get(notif.notificationId) ===
                              'accepted'
                          )}
                        </button>
                        <button
                          className='btn btn-outline-danger btn-sm'
                          onClick={(e) =>
                            handleEventInvitationResponse(
                              notif.eventId,
                              'declined',
                              notif.notificationId,
                              e
                            )
                          }
                          disabled={loadingNotifications.has(
                            notif.notificationId
                          )}
                          style={{
                            fontSize: '12px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            minWidth: '80px',
                            opacity: loadingNotifications.has(
                              notif.notificationId
                            )
                              ? 0.7
                              : 1,
                            cursor: loadingNotifications.has(
                              notif.notificationId
                            )
                              ? 'not-allowed'
                              : 'pointer',
                          }}
                        >
                          {renderButtonContent(
                            'declined',
                            loadingNotifications.get(notif.notificationId) ===
                              'declined'
                          )}
                        </button>
                      </div>
                    )}

                  {/* Hiển thị trạng thái sau khi đã respond */}
                  {notif.type === 'event_invitation' &&
                    notif.responseStatus &&
                    notif.responseStatus !== 'pending' && (
                      <div className='mt-2'>
                        <small
                          className={`badge ${
                            notif.responseStatus === 'accepted'
                              ? 'bg-success'
                              : notif.responseStatus === 'declined'
                              ? 'bg-danger'
                              : 'bg-secondary'
                          }`}
                          style={{ fontSize: '10px' }}
                        >
                          {notif.responseStatus === 'accepted'
                            ? '✓ Đã chấp nhận'
                            : notif.responseStatus === 'declined'
                            ? '✗ Đã từ chối'
                            : ''}
                        </small>
                      </div>
                    )}
                </div>
              </div>
            ))
          ) : (
            <div className='text-center text-muted'>
              Bạn không có thông báo nào
            </div>
          )}

          {/* Loading indicator for modal */}
          {notificationPagination.loading && (
            <div className='text-center py-3'>
              <Spinner animation='border' size='sm' variant='primary' />
              <div className='text-muted mt-2' style={{ fontSize: '0.9rem' }}>
                Đang tải thêm thông báo...
              </div>
            </div>
          )}

          {/* End indicator for modal */}
          {!notificationPagination.hasMore && notifications.length > 0 && (
            <div className='text-center py-3'>
              <small className='text-muted'>
                Đã hiển thị tất cả thông báo (
                {notificationPagination.totalCount})
              </small>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </header>
  );
};

export default Header;
