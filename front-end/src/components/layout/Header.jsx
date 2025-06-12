import { FaBell, FaSearch } from 'react-icons/fa';
import { Dropdown, Modal, Badge } from 'react-bootstrap';
import defaultAvatar from '/images/user-avatar-default.png';
import { useEffect, useState } from 'react';
import { useCommon } from '../../contexts/CommonContext';

const Header = () => {
  const {
    navigate,
    logout,
    notifications,
    markNotificationAsRead,
    respondToEventInvitation,
    fetchNotifications,
    isAuthenticated,
    userDataLocal,
    formatDateAMPMForVN,
  } = useCommon();
  const [showPopover, setShowPopover] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(new Map());

  const unreadCount = notifications?.filter((n) => !n.isRead)?.length || 0;

  useEffect(() => {
    // console.log('notifications', notifications);
  }, []);

  const handleAvatarClick = () => {
    setShowPopover(!showPopover);
    setShowNotifDropdown(false);
    setShowNotifModal(false);
  };

  const handleNotificationClick = async (notificationId) => {
    await markNotificationAsRead(notificationId);
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
      const success = await respondToEventInvitation(
        eventId,
        status,
        notificationId
      );

      if (success) {
        // Fetch lại notifications mới nhất sau khi respond thành công
        await fetchNotifications();
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

  const renderNotifications = () => {
    if (!notifications || notifications.length === 0) {
      return (
        <Dropdown.Item disabled className='text-center text-muted py-3'>
          Bạn không có thông báo nào
        </Dropdown.Item>
      );
    }

    return (
      <div style={{ maxHeight: '300px', overflowY: 'auto', width: '300px' }}>
        {notifications.map((notif) => (
          <Dropdown.Item
            key={notif.notificationId}
            onClick={() => handleNotificationClick(notif.notificationId)}
            className={`notification-item py-2 ${
              notif.isRead ? 'text-muted' : 'fw-bold'
            }`}
            style={{
              whiteSpace: 'normal',
              borderBottom: '1px solid #eee',
            }}
          >
            <div className='d-flex flex-column'>
              <span className='notification-title mb-1'>{notif.title}</span>
              <small className='notification-content text-wrap'>
                {notif.content}
              </small>
              <small className='text-muted mt-1'>
                {formatDateAMPMForVN(notif.createdAt)}
              </small>

              {/* Hiển thị buttons cho event invitation nếu chưa respond */}
              {notif.type === 'event_invitation' &&
                (!notif.responseStatus || notif.responseStatus === 'pending') &&
                !notif.isRead && (
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
      </div>
    );
  };

  return (
    <header className='header'>
      <div className='header-left'>
        <div className='search-bar'>
          <FaSearch className='search-icon' />
          <input type='text' placeholder='Search...' />
        </div>
      </div>
      <div className='header-right'>
        {isAuthenticated && userDataLocal && (
          <>
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
                  <div className='popover-item' onClick={handleProfileClick}>
                    Profile
                  </div>
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
          style={{ maxHeight: '70vh', overflowY: 'auto', padding: '1rem' }}
        >
          {notifications && notifications.length > 0 ? (
            notifications.map((notif) => (
              <div
                key={notif.notificationId}
                onClick={() => handleNotificationClick(notif.notificationId)}
                className={`notification-item py-2 ${
                  notif.isRead ? 'text-muted' : 'fw-bold'
                }`}
                style={{
                  whiteSpace: 'normal',
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                }}
              >
                <div className='d-flex flex-column'>
                  <span className='notification-title mb-1'>{notif.title}</span>
                  <small className='notification-content text-wrap'>
                    {notif.content}
                  </small>
                  <small className='text-muted mt-1'>
                    {formatDateAMPMForVN(notif.createdAt)}
                  </small>

                  {/* Hiển thị buttons cho event invitation nếu chưa respond */}
                  {notif.type === 'event_invitation' &&
                    (!notif.responseStatus ||
                      notif.responseStatus === 'pending') &&
                    !notif.isRead && (
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
        </Modal.Body>
      </Modal>
    </header>
  );
};

export default Header;
