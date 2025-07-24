import { FaBell, FaSearch } from 'react-icons/fa';
import { Dropdown, Modal, Badge, Spinner } from 'react-bootstrap';
import defaultAvatar from '/images/user-avatar-default.png';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useCommon } from '../../contexts/CommonContext';
import { formatDateForNotification } from '../../utils/dateUtils';

const Header = () => {
  const {
    navigate,
    logout,
    notifications,
    setNotifications,
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
    apiBaseUrl,
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
    isRead = false,
    taskId = null
  ) => {
    // Chỉ mark as read nếu chưa được đọc
    if (!isRead) {
      await markNotificationAsRead(notificationId);
    }

    // Handle navigation based on notification type
    if (
      eventId &&
      notificationType === 'event_invitation' &&
      responseStatus === 'accepted'
    ) {
      // Navigate to calendar for accepted event invitations
      navigate('/calendar');
      setShowNotifDropdown(false);
      setShowNotifModal(false);
    } else if (eventId && notificationType !== 'event_invitation') {
      // Navigate to calendar for other event notifications
      navigate('/calendar');
      setShowNotifDropdown(false);
      setShowNotifModal(false);
    } else if (taskId && notificationType?.startsWith('task_')) {
      // Navigate to boards for task-related notifications
      // You can enhance this to navigate to specific board/task if needed
      navigate('/dashboard');
      setShowNotifDropdown(false);
      setShowNotifModal(false);
    } else if (notificationType?.startsWith('list_')) {
      // Navigate to dashboard for list-related notifications
      navigate('/dashboard');
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

  // Handler cho workspace invitation
  const handleWorkspaceInvitationResponse = async (
    invitationToken,
    action,
    notificationId,
    event
  ) => {
    event.stopPropagation();
    // Set loading state for this notificationId and action
    setLoadingNotifications((prev) => {
      const newMap = new Map(prev);
      newMap.set(notificationId, action);
      return newMap;
    });
    try {
      // Gọi API accept/decline workspace invite
      const res = await fetch(`${apiBaseUrl}/workspace/invite-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ token: invitationToken, action }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          data.message ||
            (action === 'accept'
              ? 'Đã tham gia workspace'
              : 'Đã từ chối lời mời')
        );
        setNotifications((prev) =>
          prev.map((n) =>
            n.notificationId === notificationId
              ? {
                  ...n,
                  invitationResponse:
                    action === 'accept' ? 'accepted' : 'declined',
                }
              : n
          )
        );
        await markNotificationAsRead(notificationId);
        await fetchNotifications(true);
      } else {
        toast.error(data.message || 'Có lỗi xảy ra');
      }
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi xử lý lời mời workspace');
    } finally {
      // Only clear loading state for this notificationId if it matches the current action
      setLoadingNotifications((prev) => {
        const newMap = new Map(prev);
        if (newMap.get(notificationId) === action) {
          newMap.delete(notificationId);
        }
        return newMap;
      });
    }
  };

  // Thêm handler cho board invitation
  // const handleBoardInvitationResponse = async (
  //   invitationToken,
  //   action,
  //   notificationId,
  //   event
  // ) => {
  //   event.stopPropagation();
  //   setLoadingNotifications((prev) => {
  //     const newMap = new Map(prev);
  //     newMap.set(notificationId, action);
  //     return newMap;
  //   });
  //   try {
  //     const notif = notifications.find(
  //       (n) => n.notificationId === notificationId
  //     );
  //     const workspaceId = notif?.targetWorkspaceId;
  //     if (!workspaceId) {
  //       toast.error('Cannot find workspaceId for this invitation');
  //       return;
  //     }
  //     const res = await fetch(
  //       `${apiBaseUrl}/workspace/${workspaceId}/board/invite-response`,
  //       {
  //         method: 'POST',
  //         headers: {
  //           'Content-Type': 'application/json',
  //           Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
  //         },
  //         body: JSON.stringify({ token: invitationToken, action }),
  //       }
  //     );
  //     const data = await res.json();
  //     if (res.ok) {
  //       toast.success(
  //         data.message ||
  //           (action === 'accept'
  //             ? 'You have joined the board'
  //             : 'You have declined the invitation')
  //       );
  //       setNotifications((prev) =>
  //         prev.map((n) =>
  //           n.notificationId === notificationId
  //             ? {
  //                 ...n,
  //                 invitationResponse:
  //                   action === 'accept' ? 'accepted' : 'declined',
  //               }
  //             : n
  //         )
  //       );
  //       await markNotificationAsRead(notificationId);
  //       await fetchNotifications(true);
  //     } else {
  //       toast.error(data.message || 'An error occurred');
  //     }
  //   } catch (err) {
  //     toast.error('An error occurred while processing the board invitation');
  //   } finally {
  //     setLoadingNotifications((prev) => {
  //       const newMap = new Map(prev);
  //       if (newMap.get(notificationId) === action) {
  //         newMap.delete(notificationId);
  //       }
  //       return newMap;
  //     });
  //   }
  // };
  // const handleBoardInvitationResponse = async (
  //   invitationToken,
  //   action,
  //   notificationId,
  //   event
  // ) => {
  //   event.stopPropagation();
  //   setLoadingNotifications((prev) => {
  //     const newMap = new Map(prev);
  //     newMap.set(notificationId, action);
  //     return newMap;
  //   });
  //   try {
  //     const notif = notifications.find(
  //       (n) => n.notificationId === notificationId
  //     );
  //     const workspaceId = notif?.targetWorkspaceId;
  //     if (!workspaceId) {
  //       toast.error('Cannot find workspaceId for this invitation');
  //       return;
  //     }
  //     const res = await fetch(
  //       `${apiBaseUrl}/workspace/${workspaceId}/board/invite-response`,
  //       {
  //         method: 'POST',
  //         headers: {
  //           'Content-Type': 'application/json',
  //           Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
  //         },
  //         body: JSON.stringify({ token: invitationToken, action }),
  //       }
  //     );
  //     const data = await res.json();
  //     if (res.ok) {
  //       toast.success(
  //         data.message ||
  //           (action === 'accept'
  //             ? 'You have joined the board'
  //             : 'You have declined the invitation')
  //       );
  //       // Cập nhật state với dữ liệu notification từ API
  //       if (data.notification) {
  //         setNotifications((prev) =>
  //           prev.map((n) =>
  //             n.notificationId === notificationId ? data.notification : n
  //           )
  //         );
  //       } else {
  //         setNotifications((prev) =>
  //           prev.map((n) =>
  //             n.notificationId === notificationId
  //               ? {
  //                   ...n,
  //                   invitationResponse:
  //                     action === 'accept' ? 'accepted' : 'declined',
  //                 }
  //               : n
  //           )
  //         );
  //       }
  //       await markNotificationAsRead(notificationId);
  //       // Làm mới sau 5 giây để đồng bộ với backend
  //       setTimeout(() => fetchNotifications(true), 5000);
  //     } else {
  //       toast.error(data.message || 'An error occurred');
  //     }
  //   } catch (err) {
  //     console.error(err);
  //     toast.error('An error occurred while processing the board invitation');
  //   } finally {
  //     setLoadingNotifications((prev) => {
  //       const newMap = new Map(prev);
  //       if (newMap.get(notificationId) === action) {
  //         newMap.delete(notificationId);
  //       }
  //       return newMap;
  //     });
  //   }
  // };
  const handleBoardInvitationResponse = async (
    invitationToken,
    action,
    notificationId,
    event
  ) => {
    event.stopPropagation();
    setLoadingNotifications((prev) => {
      const newMap = new Map(prev);
      newMap.set(notificationId, action);
      return newMap;
    });
    try {
      const notif = notifications.find(
        (n) => n.notificationId === notificationId
      );
      const workspaceId = notif?.targetWorkspaceId;
      if (!workspaceId) {
        toast.error('Cannot find workspaceId for this invitation');
        return;
      }
      const res = await fetch(
        `${apiBaseUrl}/workspace/${workspaceId}/board/invite-response`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: JSON.stringify({ token: invitationToken, action }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(
          data.message ||
            (action === 'accept'
              ? 'You have joined the board'
              : 'You have declined the invitation')
        );
        // Cập nhật state với dữ liệu membership từ API
        if (data.membership) {
          setNotifications((prev) =>
            prev.map((n) =>
              n.notificationId === notificationId
                ? {
                    ...n,
                    invitationResponse: data.membership.invitationResponse,
                  }
                : n
            )
          );
        } else {
          setNotifications((prev) =>
            prev.map((n) =>
              n.notificationId === notificationId
                ? {
                    ...n,
                    invitationResponse:
                      action === 'accept' ? 'accepted' : 'declined',
                  }
                : n
            )
          );
        }
        await markNotificationAsRead(notificationId);
        // Làm mới sau 5 giây để đồng bộ với backend
        setTimeout(() => fetchNotifications(true), 5000);
      } else {
        toast.error(data.message || 'An error occurred');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while processing the board invitation');
    } finally {
      setLoadingNotifications((prev) => {
        const newMap = new Map(prev);
        if (newMap.get(notificationId) === action) {
          newMap.delete(notificationId);
        }
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

  const renderButtonContent = (actionType, isLoading) => {
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

    // actionType có thể là 'accepted' hoặc 'declined'
    return actionType === 'accepted' ? 'Chấp nhận' : 'Từ chối';
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
          You have no notifications
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
                notif.isRead,
                notif.taskId
              )
            }
            className={`notification-item py-2 ${
              notif.isRead ? 'text-muted' : 'fw-bold'
            }`}
            style={{
              whiteSpace: 'normal',
              borderBottom: '1px solid #eee',
              cursor:
                canNavigateToCalendar(
                  notif.eventId,
                  notif.type,
                  notif.responseStatus
                ) ||
                (notif.taskId && notif.type?.startsWith('task_')) ||
                notif.type?.startsWith('list_')
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
                : notif.taskId && notif.type?.startsWith('task_')
                ? 'Click to view tasks'
                : notif.type?.startsWith('list_')
                ? 'Click to view lists'
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
                {notif.taskId && notif.type?.startsWith('task_') && (
                  <small className='ms-2' style={{ color: '#28a745' }}>
                    {notif.type === 'task_created' && '✅'}
                    {notif.type === 'task_assigned' && '📋'}
                    {notif.type === 'task_assignment_confirmed' && '✅'}
                    {notif.type === 'task_unassigned' && '❌'}
                    {notif.type === 'task_unassignment_confirmed' && '✅'}
                    {notif.type === 'task_updated' && '📝'}
                    {notif.type === 'task_deleted' && '🗑️'}
                    {notif.type === 'task_progress_updated' && '📊'}
                    {notif.type === 'task_document_added' && '📎'}
                    {notif.type === 'task_document_removed' && '🗑️'}
                    {!notif.type?.includes('task_') && '📋'}
                  </small>
                )}
                {notif.type?.startsWith('list_') && (
                  <small className='ms-2' style={{ color: '#17a2b8' }}>
                    {notif.type === 'list_created' && '✅'}
                    {notif.type === 'list_updated' && '📝'}
                    {notif.type === 'list_deleted' && '🗑️'}
                  </small>
                )}
              </span>
              <small className='notification-content text-wrap'>
                {notif.content}
              </small>
              <small className='text-muted mt-1'>
                {formatDateAMPMForVN(notif.createdAt)}
              </small>

              {/* Nút Accept/Decline cho workspace_invite */}
              {notif.type === 'workspace_invite' && notif.invitationToken && (
                <>
                  {/* Hiển thị nút nếu trạng thái là pending */}
                  {(notif.invitationResponse === 'pending' ||
                    notif.invitationResponse == null) && (
                    <div className='d-flex gap-2 mt-2' style={{ gap: '8px' }}>
                      <button
                        className='btn btn-success btn-sm'
                        onClick={(e) =>
                          handleWorkspaceInvitationResponse(
                            notif.invitationToken,
                            'accept',
                            notif.notificationId,
                            e
                          )
                        }
                        disabled={
                          loadingNotifications.get(notif.notificationId) ===
                          'accept'
                        }
                        style={{
                          fontSize: '12px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          minWidth: '85px',
                          opacity:
                            loadingNotifications.get(notif.notificationId) ===
                            'accept'
                              ? 0.7
                              : 1,
                          cursor:
                            loadingNotifications.get(notif.notificationId) ===
                            'accept'
                              ? 'not-allowed'
                              : 'pointer',
                        }}
                      >
                        {loadingNotifications.get(notif.notificationId) ===
                        'accept'
                          ? 'Đang xử lý...'
                          : 'Chấp nhận'}
                      </button>
                      <button
                        className='btn btn-outline-danger btn-sm'
                        onClick={(e) =>
                          handleWorkspaceInvitationResponse(
                            notif.invitationToken,
                            'decline',
                            notif.notificationId,
                            e
                          )
                        }
                        disabled={
                          loadingNotifications.get(notif.notificationId) ===
                          'decline'
                        }
                        style={{
                          fontSize: '12px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          minWidth: '80px',
                          opacity:
                            loadingNotifications.get(notif.notificationId) ===
                            'decline'
                              ? 0.7
                              : 1,
                          cursor:
                            loadingNotifications.get(notif.notificationId) ===
                            'decline'
                              ? 'not-allowed'
                              : 'pointer',
                        }}
                      >
                        {loadingNotifications.get(notif.notificationId) ===
                        'decline'
                          ? 'Đang xử lý...'
                          : 'Từ chối'}
                      </button>
                    </div>
                  )}
                  {/* Hiển thị badge trạng thái nếu đã xử lý */}
                  {notif.invitationResponse &&
                    notif.invitationResponse !== 'pending' && (
                      <div className='mt-2'>
                        <small
                          className={`badge ${
                            notif.invitationResponse === 'accepted'
                              ? 'bg-success'
                              : notif.invitationResponse === 'declined'
                              ? 'bg-danger'
                              : 'bg-secondary'
                          }`}
                          style={{ fontSize: '10px' }}
                        >
                          {notif.invitationResponse === 'accepted'
                            ? '✓ Accepted'
                            : notif.invitationResponse === 'declined'
                            ? '✗ Declined'
                            : ''}
                        </small>
                      </div>
                    )}
                </>
              )}

              {/* Nút Accept/Decline cho board_invite */}
              {notif.type === 'board_invite' &&
                notif.invitationToken &&
                !notif.isDeleted &&
                !notif._shouldHide && (
                  <>
                    {(notif.invitationResponse === 'pending' ||
                      notif.invitationResponse == null) && (
                      <div className='d-flex gap-2 mt-2' style={{ gap: '8px' }}>
                        <button
                          className='btn btn-success btn-sm'
                          onClick={(e) =>
                            handleBoardInvitationResponse(
                              notif.invitationToken,
                              'accept',
                              notif.notificationId,
                              e
                            )
                          }
                          disabled={
                            loadingNotifications.get(notif.notificationId) ===
                            'accept'
                          }
                          style={{
                            fontSize: '12px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            minWidth: '85px',
                            opacity:
                              loadingNotifications.get(notif.notificationId) ===
                              'accept'
                                ? 0.7
                                : 1,
                            cursor:
                              loadingNotifications.get(notif.notificationId) ===
                              'accept'
                                ? 'not-allowed'
                                : 'pointer',
                          }}
                        >
                          {loadingNotifications.get(notif.notificationId) ===
                          'accept'
                            ? 'Processing...'
                            : 'Accept'}
                        </button>
                        <button
                          className='btn btn-outline-danger btn-sm'
                          onClick={(e) =>
                            handleBoardInvitationResponse(
                              notif.invitationToken,
                              'decline',
                              notif.notificationId,
                              e
                            )
                          }
                          disabled={
                            loadingNotifications.get(notif.notificationId) ===
                            'decline'
                          }
                          style={{
                            fontSize: '12px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            minWidth: '80px',
                            opacity:
                              loadingNotifications.get(notif.notificationId) ===
                              'decline'
                                ? 0.7
                                : 1,
                            cursor:
                              loadingNotifications.get(notif.notificationId) ===
                              'decline'
                                ? 'not-allowed'
                                : 'pointer',
                          }}
                        >
                          {loadingNotifications.get(notif.notificationId) ===
                          'decline'
                            ? 'Processing...'
                            : 'Decline'}
                        </button>
                      </div>
                    )}
                    {notif.invitationResponse &&
                      notif.invitationResponse !== 'pending' && (
                        <div className='mt-2'>
                          <small
                            className={`badge ${
                              notif.invitationResponse === 'accepted'
                                ? 'bg-success'
                                : notif.invitationResponse === 'declined'
                                ? 'bg-danger'
                                : 'bg-secondary'
                            }`}
                            style={{ fontSize: '10px' }}
                          >
                            {notif.invitationResponse === 'accepted'
                              ? '✓ Accepted'
                              : notif.invitationResponse === 'declined'
                              ? '✗ Declined'
                              : ''}
                          </small>
                        </div>
                      )}
                  </>
                )}

              {/* Hiển thị buttons cho event invitation nếu chưa respond hoặc đang pending */}
              {(() => {
                const shouldShowButtons =
                  notif.type === 'event_invitation' &&
                  (notif.responseStatus === 'pending' ||
                    !notif.responseStatus ||
                    notif.responseStatus === null) &&
                  !notif.responded &&
                  !respondedNotifications.has(notif.notificationId);

                return shouldShowButtons;
              })() && (
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
                (notif.responded ||
                  (notif.responseStatus &&
                    notif.responseStatus !== 'pending')) && (
                  <div className='mt-2'>
                    <small
                      className={`badge ${
                        notif.responseStatus === 'accepted'
                          ? 'bg-success'
                          : notif.responseStatus === 'declined'
                          ? 'bg-danger'
                          : notif.responseStatus === 'removed'
                          ? 'bg-warning'
                          : notif.responseStatus === 'event_deleted'
                          ? 'bg-secondary'
                          : 'bg-secondary'
                      }`}
                      style={{ fontSize: '10px' }}
                    >
                      {notif.responseStatus === 'accepted'
                        ? '✓ Accepted'
                        : notif.responseStatus === 'declined'
                        ? '✗ Declined'
                        : notif.responseStatus === 'removed'
                        ? '⚠ Removed from event'
                        : notif.responseStatus === 'event_deleted'
                        ? '❌ Event deleted'
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
          <Modal.Title>Notifications</Modal.Title>
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
                    notif.isRead,
                    notif.taskId
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
                  <small className='text-muted mt-1'>
                    {formatDateAMPMForVN(notif.createdAt)}
                  </small>

                  {/* Nút Accept/Decline cho workspace_invite */}
                  {notif.type === 'workspace_invite' &&
                    notif.invitationToken && (
                      <div className='d-flex gap-2 mt-2' style={{ gap: '8px' }}>
                        <button
                          className='btn btn-success btn-sm'
                          onClick={(e) =>
                            handleWorkspaceInvitationResponse(
                              notif.invitationToken,
                              'accept',
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
                          {loadingNotifications.get(notif.notificationId) ===
                          'accept'
                            ? 'Đang xử lý...'
                            : 'Chấp nhận'}
                        </button>
                        <button
                          className='btn btn-outline-danger btn-sm'
                          onClick={(e) =>
                            handleWorkspaceInvitationResponse(
                              notif.invitationToken,
                              'decline',
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
                          {loadingNotifications.get(notif.notificationId) ===
                          'decline'
                            ? 'Đang xử lý...'
                            : 'Từ chối'}
                        </button>
                      </div>
                    )}

                  {/* Nút Accept/Decline cho board_invite */}
                  {notif.type === 'board_invite' && notif.invitationToken && (
                    <>
                      {/* Hiển thị nút nếu trạng thái là pending */}
                      {(notif.invitationResponse === 'pending' ||
                        notif.invitationResponse == null) && (
                        <div
                          className='d-flex gap-2 mt-2'
                          style={{ gap: '8px' }}
                        >
                          <button
                            className='btn btn-success btn-sm'
                            onClick={(e) =>
                              handleBoardInvitationResponse(
                                notif.invitationToken,
                                'accept',
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
                            {loadingNotifications.get(notif.notificationId) ===
                            'accept'
                              ? 'Processing...'
                              : 'Accept'}
                          </button>
                          <button
                            className='btn btn-outline-danger btn-sm'
                            onClick={(e) =>
                              handleBoardInvitationResponse(
                                notif.invitationToken,
                                'decline',
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
                            {loadingNotifications.get(notif.notificationId) ===
                            'decline'
                              ? 'Processing...'
                              : 'Decline'}
                          </button>
                        </div>
                      )}
                      {/* Hiển thị badge trạng thái nếu đã xử lý */}
                      {notif.invitationResponse &&
                        notif.invitationResponse !== 'pending' && (
                          <div className='mt-2'>
                            <small
                              className={`badge ${
                                notif.invitationResponse === 'accepted'
                                  ? 'bg-success'
                                  : notif.invitationResponse === 'declined'
                                  ? 'bg-danger'
                                  : 'bg-secondary'
                              }`}
                              style={{ fontSize: '10px' }}
                            >
                              {notif.invitationResponse === 'accepted'
                                ? '✓ Accepted'
                                : notif.invitationResponse === 'declined'
                                ? '✗ Declined'
                                : ''}
                            </small>
                          </div>
                        )}
                    </>
                  )}

                  {/* Hiển thị buttons cho event invitation nếu chưa respond hoặc đang pending */}
                  {(() => {
                    const shouldShowButtons =
                      notif.type === 'event_invitation' &&
                      (notif.responseStatus === 'pending' ||
                        !notif.responseStatus ||
                        notif.responseStatus === null) &&
                      !notif.responded &&
                      !respondedNotifications.has(notif.notificationId);

                    return shouldShowButtons;
                  })() && (
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
                    (notif.responded ||
                      (notif.responseStatus &&
                        notif.responseStatus !== 'pending')) && (
                      <div className='mt-2'>
                        <small
                          className={`badge ${
                            notif.responseStatus === 'accepted'
                              ? 'bg-success'
                              : notif.responseStatus === 'declined'
                              ? 'bg-danger'
                              : notif.responseStatus === 'removed'
                              ? 'bg-warning'
                              : notif.responseStatus === 'event_deleted'
                              ? 'bg-secondary'
                              : 'bg-secondary'
                          }`}
                          style={{ fontSize: '10px' }}
                        >
                          {notif.responseStatus === 'accepted'
                            ? '✓ Accepted'
                            : notif.responseStatus === 'declined'
                            ? '✗ Declined'
                            : notif.responseStatus === 'removed'
                            ? '⚠ Removed from event'
                            : notif.responseStatus === 'event_deleted'
                            ? '❌ Event deleted'
                            : ''}
                        </small>
                      </div>
                    )}
                </div>
              </div>
            ))
          ) : (
            <div className='text-center text-muted'>
              You have no notifications
            </div>
          )}

          {/* Loading indicator for modal */}
          {notificationPagination.loading && (
            <div className='text-center py-3'>
              <Spinner animation='border' size='sm' variant='primary' />
              <div className='text-muted mt-2' style={{ fontSize: '0.9rem' }}>
                Loading more notifications...
              </div>
            </div>
          )}

          {/* End indicator for modal */}
          {!notificationPagination.hasMore && notifications.length > 0 && (
            <div className='text-center py-3'>
              <small className='text-muted'>
                All notifications displayed ({notificationPagination.totalCount}
                )
              </small>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </header>
  );
};

export default Header;
