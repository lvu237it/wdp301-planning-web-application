import { FaBell, FaSearch } from 'react-icons/fa';
import defaultAvatar from '../../../public/images/user-avatar-default.png';
import { useState } from 'react';
import { useCommon } from '../../contexts/CommonContext';

const Header = () => {
  const [showPopover, setShowPopover] = useState(false);
  const { navigate, logout } = useCommon();

  const handleAvatarClick = () => {
    setShowPopover(!showPopover);
  };

  const handleProfileClick = () => {
    navigate('/profile');
    setShowPopover(false);
  };

  const handleLogoutClick = () => {
    logout();
    setShowPopover(false);
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
        <button className='notification-btn'>
          <FaBell />
          <span className='notification-badge'>3</span>
        </button>
        <div className='avatar-container'>
          <div className='avatar' onClick={handleAvatarClick}>
            <img src={defaultAvatar} alt='User Avatar' />
          </div>
          {showPopover && (
            <div className='avatar-popover'>
              <div className='popover-item' onClick={handleProfileClick}>
                Profile
              </div>
              <div className='popover-item' onClick={handleLogoutClick}>
                Logout
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
