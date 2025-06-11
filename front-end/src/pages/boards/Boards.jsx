import React, { useState } from 'react';
import '../../styles/board.css';
import List from '../lists/List';

const Board = () => {
  const [activeTab, setActiveTab] = useState('tasks');
  const boardId = '683c7d46b5cb1174075fc16c'; // Thay thế bằng boardId thực tế hoặc lấy từ params

  const tabs = [
    { id: 'tasks',    icon: 'fas fa-tasks',      label: 'Tasks' },
    { id: 'calendar', icon: 'fas fa-calendar',   label: 'Calendar' },
    { id: 'criteria', icon: 'fas fa-user-check', label: 'Member Criteria' },
  ];

  return (
    <div className="container">
      <main className="main-content">
        {/* Top Bar */}
        <header className="top-bar">
          <div className="board-title">
            <h1>Website Redesign</h1>
            <div className="board-actions">
              <button className="btn-secondary"><i className="fas fa-users"></i> Members</button>
              <button className="btn-secondary"><i className="fas fa-cog"></i> Settings</button>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="board-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}>
              <i className={tab.icon}></i> {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        {/* 1. Tasks Tab */}
        <div className={`tab-content ${activeTab === 'tasks' ? 'active' : ''}`} id="tasks">
          {/* Sử dụng component List để hiển thị danh sách và form thêm mới */}
          <List boardId={boardId} />
        </div>

        {/* 2. Calendar Tab */}
        <div className={`tab-content ${activeTab === 'calendar' ? 'active' : ''}`} id="calendar">
          <div id="board-calendar"></div>
        </div>

        {/* 3. Member Criteria Tab */}
        <div className={`tab-content ${activeTab === 'criteria' ? 'active' : ''}`} id="criteria">
          <div className="criteria-section">
            <h2>Member Requirements</h2>
            <form className="criteria-form">
              {/* Required Skills etc. */}
            </form>
            <div className="applicants-section">
              {/* Applicant cards... */}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Board;
