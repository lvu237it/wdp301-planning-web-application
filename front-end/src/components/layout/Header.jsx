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
    isAuthenticated,
    userDataLocal,
    formatDateAMPMForVN,
  } = useCommon();
  const [showPopover, setShowPopover] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);

  const unreadCount = notifications?.filter((n) => !n.isRead)?.length || 0;

  useEffect(() => {
    console.log('notifications', notifications);
  }, []);

  const handleAvatarClick = () => {
    setShowPopover(!showPopover);
    setShowNotifDropdown(false);
    setShowNotifModal(false);
  };

  const handleNotificationClick = async (notificationId) => {
    await markNotificationAsRead(notificationId);
  };

  const handleProfileClick = () => {
    navigate('/profile');
    setShowPopover(false);
  };

  const handleLogoutClick = () => {
    logout();
    setShowPopover(false);
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
                  className='notification-btn'
                  onClick={toggleNotifDropdown}
                >
                  <FaBell />
                  {unreadCount > 0 && (
                    <span className='notification-badge'>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                <Dropdown.Menu className='p-0 notification-dropdown-menu'>
                  {renderNotifications()}
                </Dropdown.Menu>
              </Dropdown>
            </div>
            <div className='notification-container d-md-none'>
              <button className='notification-btn' onClick={toggleNotifModal}>
                <FaBell />
                {unreadCount > 0 && (
                  <span className='notification-badge'>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
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
