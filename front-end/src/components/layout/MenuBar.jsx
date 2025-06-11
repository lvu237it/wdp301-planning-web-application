import { Link, useLocation } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaLayerGroup,
  FaClipboardList,
  FaCalendarAlt,
  FaUser,
} from 'react-icons/fa';
import logo from '/images/PlanPro-removebg-preview.png';

const MenuBar = () => {
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', icon: <FaTachometerAlt />, label: 'Dashboard' },
    { path: '/workspaces', icon: <FaLayerGroup />, label: 'Workspaces' },
    { path: '/boards', icon: <FaClipboardList />, label: 'Boards' },
    { path: '/calendar', icon: <FaCalendarAlt />, label: 'Calendar' },
    { path: '/profile', icon: <FaUser />, label: 'Profile' },
  ];

  return (
    <div className='menu-bar'>
      <div className='logo-container'>
        <img src={logo} alt='PlanPro Logo' className='logo' />
      </div>
      <nav className='menu-items'>
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`menu-item ${
              location.pathname === item.path ? 'active' : ''
            }`}
          >
            <span className='icon'>{item.icon}</span>
            <span className='label'>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default MenuBar;
