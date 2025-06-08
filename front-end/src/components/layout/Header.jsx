import { FaBell, FaSearch } from 'react-icons/fa';
import defaultAvatar from '../../../public/images/user-avatar-default.png';

const Header = () => {
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
        <div className='avatar'>
          <img src={defaultAvatar} alt='User Avatar' />
        </div>
      </div>
    </header>
  );
};

export default Header;
