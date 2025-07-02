import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCommon } from '../../contexts/CommonContext';
import { getSocket } from '../../utils/socketClient';
import { formatDateForNotification } from '../../utils/dateUtils';
import '../../styles/boardactivitylog.css';

function BoardActivityLog() {
  const { boardId, workspaceId } = useParams();
  const navigate = useNavigate();
  const {
    fetchActivityLogs,
    userDataLocal,
    toast,
    socketConnected,
    apiBaseUrl,
    accessToken,
  } = useCommon();

  // States
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [boardDetails, setBoardDetails] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [skip, setSkip] = useState(0);
  const [filter, setFilter] = useState('all'); // all, task, list, message

  const LIMIT = 20;

  // Check user role in board
  const checkUserRole = useCallback(async () => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/workspace/${workspaceId}/board/${boardId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch board details');
      }

      const data = await response.json();
      setBoardDetails(data.board);

      // Find user's role in this board
      const currentUser = data.board.members?.find(
        (member) => member._id === userDataLocal?._id
      );

      setUserRole(currentUser?.role || 'member');
    } catch (error) {
      console.error('Error checking user role:', error);
      setError('Failed to load board information');
    }
  }, [boardId, workspaceId, userDataLocal]);

  // Fetch activity logs
  const fetchLogs = useCallback(
    async (resetData = false) => {
      try {
        if (resetData) {
          setLoading(true);
          setSkip(0);
        } else {
          setLoadingMore(true);
        }

        const isAdmin = userRole === 'admin';
        const currentSkip = resetData ? 0 : skip;

        const result = await fetchActivityLogs(
          boardId,
          isAdmin,
          currentSkip,
          LIMIT
        );

        if (result.success) {
          const newLogs = result.logs;

          if (resetData) {
            setLogs(newLogs);
            setSkip(LIMIT);
          } else {
            setLogs((prev) => [...prev, ...newLogs]);
            setSkip((prev) => prev + LIMIT);
          }

          setHasMore(newLogs.length === LIMIT);
          setError(null);
        } else {
          setError(result.error || 'Failed to load activity logs');
          toast.error('Failed to load activity logs');
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
        setError('Failed to load activity logs');
        toast.error('Failed to load activity logs');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [boardId, userRole, skip, fetchActivityLogs, toast]
  );

  // Load more logs
  const loadMoreLogs = () => {
    if (!loadingMore && hasMore) {
      fetchLogs(false);
    }
  };

  // Filter logs by action type
  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    if (filter === 'task') return log.action.includes('task');
    if (filter === 'list') return log.action.includes('list');
    // if (filter === 'message') return log.action.includes('message');
    return true;
  });

  // Setup real-time updates via custom events
  useEffect(() => {
    const handleNewActivity = (event) => {
      const newLog = event.detail;
      console.log('📊 BoardActivityLog received new_activity_log:', newLog);

      // Only add if it's for current board
      if (newLog.boardId === boardId) {
        console.log('✅ Adding new activity log to UI:', newLog.action);
        setLogs((prev) => [newLog, ...prev]);
        // Add animation class for new items
        setTimeout(() => {
          const element = document.querySelector('.activity-item');
          if (element) {
            element.classList.add('new-activity');
          }
        }, 100);
      } else {
        console.log(
          '❌ Activity log not for current board:',
          newLog.boardId,
          'vs',
          boardId
        );
      }
    };

    const handleAdminActivity = (event) => {
      const newLog = event.detail;
      console.log('👑 BoardActivityLog received admin_activity_log:', newLog);

      // Only add if user is admin and it's for current board
      if (userRole === 'admin' && newLog.boardId === boardId) {
        console.log('✅ Adding admin activity log to UI:', newLog.action);
        setLogs((prev) => [newLog, ...prev]);
        // Add animation class for new items
        setTimeout(() => {
          const element = document.querySelector('.activity-item');
          if (element) {
            element.classList.add('new-activity');
          }
        }, 100);
      } else {
        console.log('❌ Admin activity log not applicable:', {
          userRole,
          boardMatch: newLog.boardId === boardId,
        });
      }
    };

    console.log(
      '🎧 Setting up activity log listeners for board:',
      boardId,
      'userRole:',
      userRole
    );

    // Listen to custom events from CommonContext
    window.addEventListener('new_activity_log', handleNewActivity);
    window.addEventListener('admin_activity_log', handleAdminActivity);

    return () => {
      console.log('🔇 Cleaning up activity log listeners');
      window.removeEventListener('new_activity_log', handleNewActivity);
      window.removeEventListener('admin_activity_log', handleAdminActivity);
    };
  }, [userRole, boardId]);

  // Initial load
  useEffect(() => {
    if (userDataLocal && boardId) {
      checkUserRole();
    }
  }, [userDataLocal, boardId]);

  useEffect(() => {
    if (userRole !== null) {
      fetchLogs(true);
    }
  }, [userRole]);

  // Refresh logs when filter changes
  useEffect(() => {
    if (userRole !== null) {
      fetchLogs(true);
    }
  }, [filter]);

  // Get action icon
  const getActionIcon = (action) => {
    if (action.includes('list')) return '📝';
    if (action.includes('task')) return '📋';
    if (action.includes('message')) return '💬';
    return '📊';
  };

  // Get action color
  const getActionColor = (action) => {
    if (action.includes('created')) return 'success';
    if (action.includes('updated')) return 'info';
    if (action.includes('deleted')) return 'danger';
    if (action.includes('moved')) return 'warning';
    return 'default';
  };

  // Format action text
  const formatActionText = (action) => {
    const actionMap = {
      task_created: 'created a task',
      task_updated: 'updated a task',
      task_deleted: 'deleted a task',
      task_assigned: 'assigned a task',
      task_unassigned: 'unassigned a task',
      list_created: 'created a list',
      list_updated: 'updated a list',
      list_deleted: 'deleted a list',
      list_task_moved: 'moved a task between lists',
      message_sent: 'sent a message',
      message_updated: 'updated a message',
      message_deleted: 'deleted a message',
    };
    return actionMap[action] || action.replace(/_/g, ' ');
  };

  if (loading) {
    return (
      <div className='activity-log-container'>
        <div className='activity-log-header'>
          <button
            style={{
              backgroundColor: '#f8f9fa',
              border: '0.8px solid #dee2e6',
              cursor: 'pointer',
              borderRadius: '8px',
              padding: '8px 16px',
              color: '#495057',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s ease',
              marginBottom: '10px',
            }}
            onClick={() =>
              navigate(`/workspace/${workspaceId}/boards/${boardId}`)
            }
          >
            ← Back to Board
          </button>
          <h1>Activity Log</h1>
        </div>
        <div className='loading-container'>
          <div className='loading-spinner'></div>
          <p>Loading activity logs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='activity-log-container'>
        <div className='activity-log-header'>
          <button
            style={{
              backgroundColor: '#f8f9fa',
              border: '0.8px solid #dee2e6',
              cursor: 'pointer',
              borderRadius: '8px',
              padding: '8px 16px',
              color: '#495057',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s ease',
              marginBottom: '10px',
            }}
            onClick={() =>
              navigate(`/workspace/${workspaceId}/boards/${boardId}`)
            }
          >
            ← Back to Board
          </button>
          <h1>Activity Log</h1>
        </div>
        <div className='error-container'>
          <div className='error-message'>
            <h3>⚠️ Error</h3>
            <p>{error}</p>
            <button className='retry-button' onClick={() => fetchLogs(true)}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='activity-log-container'>
      <div className='activity-log-header'>
        <button
          style={{
            backgroundColor: '#f8f9fa',
            border: '0.8px solid #dee2e6',
            cursor: 'pointer',
            borderRadius: '8px',
            padding: '8px 16px',
            color: '#495057',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'all 0.2s ease',
            marginBottom: '10px',
          }}
          onClick={() =>
            navigate(`/workspace/${workspaceId}/boards/${boardId}`)
          }
        >
          ← Back to Board
        </button>
        <div className='header-content'>
          <h1>Activity Log</h1>
          <div className='board-info'>
            <h2 className='mb-3'>{boardDetails?.name}</h2>
            <span className={`user-role-badge role-${userRole}`}>
              {userRole === 'admin'
                ? `👑 Admin's board View`
                : `👤 Member's board View`}
            </span>
          </div>
        </div>
      </div>

      <div className='activity-log-filters'>
        <div className='filter-buttons'>
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Activities
          </button>
          <button
            className={`filter-btn ${filter === 'list' ? 'active' : ''}`}
            onClick={() => setFilter('list')}
          >
            📝 Lists
          </button>
          <button
            className={`filter-btn ${filter === 'task' ? 'active' : ''}`}
            onClick={() => setFilter('task')}
          >
            📋 Tasks
          </button>

          {/* <button
            className={`filter-btn ${filter === 'message' ? 'active' : ''}`}
            onClick={() => setFilter('message')}
          >
            💬 Messages
          </button> */}
        </div>
        <div className='stats'>
          <span className='total-logs me-2'>
            {filteredLogs.length} activities
          </span>
          {socketConnected && (
            <div className='real-time-indicator'>
              <div className='real-time-dot'></div>
              Live Updates
            </div>
          )}
        </div>
      </div>

      <div className='activity-log-content'>
        {filteredLogs.length === 0 ? (
          <div className='empty-state'>
            <div className='empty-icon'>📊</div>
            <h3>No Activities Found</h3>
            <p>There are no activities to display for the selected filter.</p>
          </div>
        ) : (
          <div className='activity-list'>
            {filteredLogs.map((log, index) => (
              <div key={`${log.logId}-${index}`} className='activity-item'>
                <div className='activity-icon'>{getActionIcon(log.action)}</div>
                <div className='activity-content'>
                  <div className='activity-header'>
                    <span className='user-name'>{log.userName}</span>
                    <span
                      className={`action-badge ${getActionColor(log.action)}`}
                    >
                      {formatActionText(log.action)}
                    </span>
                    {!log.isVisible && userRole === 'admin' && (
                      <span className='admin-only-badge'>👑 Admin Only</span>
                    )}
                  </div>
                  <div className='activity-details'>{log.details}</div>
                  <div className='activity-time'>{log.createdAt}</div>
                </div>
              </div>
            ))}

            {hasMore && (
              <div className='load-more-container'>
                <button
                  className='load-more-button'
                  onClick={loadMoreLogs}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <div className='loading-spinner small'></div>
                      Loading...
                    </>
                  ) : (
                    'Load More Activities'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default BoardActivityLog;
