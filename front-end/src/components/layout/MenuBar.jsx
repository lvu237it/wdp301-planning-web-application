// src/components/MenuBar.jsx
import { Link, useLocation } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaLayerGroup,
  FaClipboardList,
  FaCalendarAlt,
  FaUser,
} from 'react-icons/fa';
import logo from '/images/PlanPro-removebg-preview.png';
import { useCommon } from '../../contexts/CommonContext';

const MenuBar = () => {
  const location = useLocation();
  const { currentWorkspaceId } = useCommon();

  // nếu đã chọn workspace, link đến /workspace/:id/boards
  // ngược lại fallback về /workspaces để người dùng chọn trước
  const boardsLink = currentWorkspaceId
    ? `/workspace/${currentWorkspaceId}/boards`
    : '/workspaces';

  // xây lại menuItems bên trong component để dùng biến boardsLink
  const menuItems = [
    { path: '/dashboard', icon: <FaTachometerAlt />, label: 'Dashboard' },
    { path: '/workspaces', icon: <FaLayerGroup />, label: 'Workspaces' },
    { path: boardsLink, icon: <FaClipboardList />, label: 'Boards' },
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
            key={item.id}
            to={item.path}
            className={`menu-item ${
              // active khi đúng path
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
