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
        (member) =>
          member._id === userDataLocal?._id || member._id === userDataLocal?.id
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
    // Existing socket listeners
    const handleNewActivity = (event) => {
      const activityLog = event.detail;
      console.log('🎯 New activity received in component:', activityLog);

      if (activityLog.boardId === boardId) {
        // Add to logs with animation
        setLogs((prevLogs) => {
          const newLogs = [{ ...activityLog, isNew: true }, ...prevLogs];

          // Remove animation class after 3 seconds
          setTimeout(() => {
            setLogs((currentLogs) =>
              currentLogs.map((log) =>
                log.logId === activityLog.logId ? { ...log, isNew: false } : log
              )
            );
          }, 3000);

          return newLogs;
        });
      }
    };

    const handleTaskActivity = (event) => {
      const activityLog = event.detail;
      console.log('📋 New task activity received in component:', activityLog);

      if (activityLog.boardId === boardId) {
        // Add to logs with animation
        setLogs((prevLogs) => {
          const newLogs = [
            { ...activityLog, isNew: true, isTaskActivity: true },
            ...prevLogs,
          ];

          // Remove animation class after 3 seconds
          setTimeout(() => {
            setLogs((currentLogs) =>
              currentLogs.map((log) =>
                log.logId === activityLog.logId ? { ...log, isNew: false } : log
              )
            );
          }, 3000);

          return newLogs;
        });
      }
    };

    const handleAdminActivity = (event) => {
      const activityLog = event.detail;
      console.log('👑 New admin activity received in component:', activityLog);

      if (activityLog.boardId === boardId && userRole === 'admin') {
        // Add to logs with animation
        setLogs((prevLogs) => {
          const newLogs = [
            { ...activityLog, isNew: true, isAdminOnly: true },
            ...prevLogs,
          ];

          // Remove animation class after 3 seconds
          setTimeout(() => {
            setLogs((currentLogs) =>
              currentLogs.map((log) =>
                log.logId === activityLog.logId ? { ...log, isNew: false } : log
              )
            );
          }, 3000);

          return newLogs;
        });
      }
    };

    // Listen for activity log events
    window.addEventListener('new_board_activity', handleNewActivity);
    window.addEventListener('new_task_activity', handleTaskActivity);
    window.addEventListener('new_admin_activity', handleAdminActivity);

    // Cleanup listeners
    return () => {
      window.removeEventListener('new_board_activity', handleNewActivity);
      window.removeEventListener('new_task_activity', handleTaskActivity);
      window.removeEventListener('new_admin_activity', handleAdminActivity);
    };
  }, [boardId, userRole]);

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

  const getActionIcon = (action) => {
    const iconMap = {
      // Task actions
      task_created: 'fa-plus-circle',
      task_updated: 'fa-edit',
      task_deleted: 'fa-trash',
      task_assigned: 'fa-user-plus',
      task_unassigned: 'fa-user-minus',
      task_checklist_updated: 'fa-check-square',
      task_checklist_item_completed: 'fa-check',
      task_checklist_item_uncompleted: 'fa-times',
      task_document_added: 'fa-file-plus',
      task_document_removed: 'fa-file-minus',
      task_document_renamed: 'fa-file-signature',
      task_document_shared: 'fa-share',
      // List actions
      list_created: 'fa-list',
      list_updated: 'fa-list-alt',
      list_deleted: 'fa-list-ol',
      list_task_moved: 'fa-arrows-alt',
      // Message actions
      message_sent: 'fa-comment',
      message_updated: 'fa-comment-dots',
      message_deleted: 'fa-comment-slash',
      message_pinned: 'fa-thumbtack',
      message_unpinned: 'fa-thumbtack',
    };
    return iconMap[action] || 'fa-circle';
  };

  const getActionColor = (action) => {
    const colorMap = {
      // Task actions - various colors
      task_created: 'success',
      task_updated: 'info',
      task_deleted: 'danger',
      task_assigned: 'primary',
      task_unassigned: 'warning',
      task_checklist_updated: 'secondary',
      task_checklist_item_completed: 'success',
      task_checklist_item_uncompleted: 'warning',
      task_document_added: 'info',
      task_document_removed: 'danger',
      task_document_renamed: 'secondary',
      task_document_shared: 'primary',
      // List actions - blue shades
      list_created: 'success',
      list_updated: 'info',
      list_deleted: 'danger',
      list_task_moved: 'secondary',
      // Message actions - purple shades
      message_sent: 'primary',
      message_updated: 'info',
      message_deleted: 'danger',
      message_pinned: 'warning',
      message_unpinned: 'secondary',
    };
    return colorMap[action] || 'default';
  };

  const formatActionText = (action) => {
    const actionTextMap = {
      // Task actions
      task_created: 'Create task',
      task_updated: 'Update task',
      task_deleted: 'Delete task',
      task_assigned: 'Assign task',
      task_unassigned: 'Unassign task',
      task_checklist_updated: 'Update checklist',
      task_checklist_item_completed: 'Complete checklist item',
      task_checklist_item_uncompleted: 'Uncomplete checklist item',
      task_document_added: 'Add document',
      task_document_removed: 'Remove document',
      task_document_renamed: 'Rename document',
      task_document_shared: 'Sharing document',
      // List actions
      list_created: 'Create list',
      list_updated: 'Update list',
      list_deleted: 'Delete list',
      list_task_moved: 'Move task',
      // Message actions
      message_sent: 'Send message',
      message_updated: 'Update message',
      message_deleted: 'Delete message',
      message_pinned: 'Pin message',
      message_unpinned: 'Unpin message',
    };
    return actionTextMap[action] || action;
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
            ← Back to List
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
            ← Back to List
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
          ← Back to List
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
          {/* {socketConnected && (
            <div className='real-time-indicator'>
              <div className='real-time-dot'></div>
              Live Updates
            </div>
          )} */}
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
                <div className='activity-icon'>
                  <i className={`fas ${getActionIcon(log.action)}`}></i>
                </div>
                <div className='activity-content'>
                  <div className='activity-header'>
                    <span className='user-name'>{log.userName}</span>
                    <span
                      className={`action-badge ${getActionColor(log.action)}`}
                    >
                      {formatActionText(log.action)}
                    </span>
                    {log.action && log.action.startsWith('task_') && (
                      <span className='badge badge-task'>Task</span>
                    )}
                    {log.action && log.action.startsWith('list_') && (
                      <span className='badge badge-list'>List</span>
                    )}
                    {!log.isVisible && userRole === 'admin' && (
                      <span className='badge badge-sensitive'>Sensitive</span>
                    )}
                  </div>
                  <div className='activity-details'>
                    {log.details}
                    {/* Show assignee info for task logs in admin view */}
                    {userRole === 'admin' && log.taskAssignedTo && (
                      <div className='assignee-info'>
                        <small className='text-muted'>
                          → Assigned to:{' '}
                          <strong>{log.taskAssignedTo.name}</strong>
                        </small>
                      </div>
                    )}
                    {userRole === 'admin' &&
                      log.taskAssignedBy &&
                      !log.taskAssignedTo && (
                        <div className='assigner-info'>
                          <small className='text-muted'>
                            → Assigned by:{' '}
                            <strong>{log.taskAssignedBy.name}</strong>
                          </small>
                        </div>
                      )}
                  </div>
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
