import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import axios from 'axios';
import { useMediaQuery } from 'react-responsive';
import { Toaster, toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  initSocketClient,
  getSocket,
  disconnectSocket,
} from '../utils/socketClient';
import {
  formatDateAMPMForVN,
  formatDateForNotification,
  formatDateShortForVN,
} from '../utils/dateUtils';

// Configure axios defaults
axios.defaults.withCredentials = true; // Include cookies in all requests

export const CommonContext = createContext();

export const useCommon = () => useContext(CommonContext);

export const Common = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  // Get previous location from state, default to '/'
  const from = location.state?.from?.pathname || '/';

  const socketInitialized = useRef(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem('accessToken') || null
  );
  const [userDataLocal, setUserDataLocal] = useState(() => {
    return JSON.parse(localStorage.getItem('userData')) || null;
  });
  const [notifications, setNotifications] = useState(() => {
    try {
      const storedNotifications = localStorage.getItem('notifications');
      return storedNotifications ? JSON.parse(storedNotifications) : [];
    } catch (error) {
      console.error('Error parsing notifications from localStorage:', error);
      return [];
    }
  });

  // Notification count state
  const [notificationCount, setNotificationCount] = useState(0);

  // Sync notification count with unread notifications
  useEffect(() => {
    const unreadCount = notifications.filter((notif) => !notif.isRead).length;
    setNotificationCount(unreadCount);
  }, [notifications]);

  // Notification pagination states
  const [notificationPagination, setNotificationPagination] = useState({
    hasMore: true,
    currentPage: 1,
    totalCount: 0,
    loading: false,
  });

  // Enhanced responsive breakpoints
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const isTablet = useMediaQuery({ minWidth: 769, maxWidth: 1024 });
  const isDesktop = useMediaQuery({ minWidth: 1025 });

  // Đổi sang biến env tương ứng (VITE_API_BASE_URL_DEVELOPMENT hoặc VITE_API_BASE_URL_PRODUCTION)
  // và build lại để chạy server frontend trên môi trường dev hoặc production
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL_DEVELOPMENT;
  // const apiBaseUrl = import.meta.env.VITE_API_BASE_URL_PRODUCTION;

  const [calendarUser, setCalendarUser] = useState(null);
  const [calendarBoard, setCalendarBoard] = useState(null);
  const [showGoogleAuthModal, setShowGoogleAuthModal] = useState(false);
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState(false);
  const [googleLinkStatus, setGoogleLinkStatus] = useState({
    hasGoogleAccount: false,
    loading: true,
  });
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);

  // state workspace
  const [workspaces, setWorkspaces] = useState([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [workspacesError, setWorkspacesError] = useState(null);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);

  // state boards
  const [boards, setBoards] = useState([]);
  const [loadingBoards, setLoading] = useState(false);
  const [boardsError, setError] = useState(null);

  const [isCheckingGoogleAuth, setIsCheckingGoogleAuth] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem('accessToken') && !!localStorage.getItem('userData')
  );

  // Skills states for fetching and managing skills
  const [skillsList, setSkillsList] = useState([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [skillsError, setSkillsError] = useState(null);

  // Tạo ref để track đã thực hiện redirect hay chưa
  const hasRedirected = useRef(false);
  const isProcessingAuth = useRef(false); // Tránh xử lý auth nhiều lần
  const isInitialLoad = useRef(true); // Track if this is initial app load

  // Chỉ redirect khi thực sự cần thiết (sau login thành công), không redirect khi reload
  useEffect(() => {
    // Nếu là lần đầu load app và đã có token + userData, đây là reload
    if (isInitialLoad.current && isAuthenticated && userDataLocal) {
      isInitialLoad.current = false;
      // Không redirect khi reload - giữ nguyên trang hiện tại
      return;
    }

    // Chỉ redirect về / khi:
    // 1. Không phải initial load (đã login thành công)
    // 2. Đang ở auth pages (login/register)
    // 3. Không phải Google callback
    // 4. Chưa redirect trước đó
    if (
      !isInitialLoad.current &&
      isAuthenticated &&
      userDataLocal &&
      (location.pathname === '/login' ||
        location.pathname === '/register' ||
        location.pathname === '/') &&
      !location.pathname.includes('/google-callback') &&
      !hasRedirected.current &&
      !isProcessingAuth.current
    ) {
      hasRedirected.current = true;
      navigate('/dashboard'); // Redirect to dashboard instead of root
    }

    // Mark as not initial load after first effect run
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
    }
  }, [isAuthenticated, userDataLocal, location.pathname]);

  // Reset redirect flag khi user logout
  useEffect(() => {
    if (!isAuthenticated) {
      hasRedirected.current = false;
      isProcessingAuth.current = false;
      isInitialLoad.current = true; // Reset for next login
    }
  }, [isAuthenticated]);

  //Kiểm tra xem người dùng đã xác thực Google chưa với logic cải thiện
  const checkGoogleAuth = async (force = false) => {
    if (!accessToken || (isCheckingGoogleAuth && !force)) return;

    setIsCheckingGoogleAuth(true);
    try {
      const response = await axios.get(
        `${apiBaseUrl}/files/check-google-auth`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      console.log('🔍 Google auth check response:', response.data);

      // Log token expiry details from response
      if (response.data.tokens) {
        response.data.tokens.forEach((token) => {
          const now = new Date();
          const expiryDate = token.expiryDate
            ? new Date(token.expiryDate)
            : null;
          const timeUntilExpiry = expiryDate ? expiryDate - now : null;
          console.log('timeUntilExpiry', timeUntilExpiry);
          const hoursUntilExpiry = timeUntilExpiry
            ? Math.round(timeUntilExpiry / (1000 * 60 * 60))
            : null;

          console.log(`
📅 Frontend - Google Token Status:
   Service: ${token.service}
   Status: ${token.status}
   Expiry: ${expiryDate ? expiryDate.toLocaleString() : 'No expiry'}
   Time until expiry: ${hoursUntilExpiry ? `${hoursUntilExpiry} hours` : 'N/A'}
   Valid: ${token.isValid ? 'Yes' : 'No'}
          `);

          // Show toast notification if token is expiring soon (within 24 hours)
          // if (
          //   hoursUntilExpiry !== null &&
          //   hoursUntilExpiry < 24 &&
          //   hoursUntilExpiry > 0
          // ) {
          //   toast.warning(
          //     `Google ${token.service} token will expire in ${hoursUntilExpiry} hours`
          //   );
          // }
        });
      }

      if (response.data.status === 'success') {
        if (response.data.hasValidTokens) {
          // User has all valid Google tokens
          console.log('✅ User has all valid Google tokens');
          setIsGoogleAuthenticated(true);
          setShowGoogleAuthModal(false);
        } else {
          // User needs to authenticate or refresh tokens
          console.log('❌ User needs Google authentication');
          setIsGoogleAuthenticated(false);

          // Only show modal if user has linked Google account but tokens need refresh
          // Don't force modal for users who haven't linked Google account yet
          if (googleLinkStatus.hasGoogleAccount) {
            console.log(
              '📢 User has linked Google account, checking if modal needed'
            );
            if (
              response.data.needsRefresh ||
              response.data.missingScopes?.length > 0
            ) {
              console.log('🔑 Showing Google auth modal for token refresh');
              setShowGoogleAuthModal(true);
            }
          } else {
            console.log(
              '🚫 User has not linked Google account, not showing modal'
            );
            setShowGoogleAuthModal(false);
          }
        }
      } else {
        // Error response
        console.log('❌ Error checking Google auth');
        setIsGoogleAuthenticated(false);

        // Only show modal for users who have linked Google account
        if (googleLinkStatus.hasGoogleAccount) {
          console.log(
            '🔑 Showing Google auth modal due to error for linked user'
          );
          setShowGoogleAuthModal(true);
        } else {
          console.log(
            '🚫 User has not linked Google account, not showing modal on error'
          );
          setShowGoogleAuthModal(false);
        }
      }
    } catch (error) {
      console.error('Error checking Google auth:', error);
      setIsGoogleAuthenticated(false);

      // Only show modal for authentication-related errors if user has linked Google account
      if (googleLinkStatus.hasGoogleAccount && error.response?.status === 401) {
        console.log(
          '🔑 Showing Google auth modal due to 401 error for linked user'
        );
        setShowGoogleAuthModal(true);
      } else {
        console.log(
          '🚫 Not showing modal for error - user not linked or not auth error'
        );
        setShowGoogleAuthModal(false);
      }
    } finally {
      setIsCheckingGoogleAuth(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(
        `${apiBaseUrl}/login`,
        { email, password },
        {
          timeout: 15000,
          withCredentials: true, // Include cookies
        }
      );

      if (response.data.success) {
        const { accessToken, user } = response.data;
        return await handleLoginSuccess(accessToken, user);
      }
    } catch (error) {
      console.error('Login error:', error);
      // toast.error(error.response?.data?.message || 'Login failed');
      return false;
    }
  };

  // Đăng nhập Google OAuth
  const handleLoginSuccess = async (
    accessToken,
    user,
    isGoogleLogin = false
  ) => {
    // Đánh dấu đang xử lý auth để tránh conflicts
    isProcessingAuth.current = true;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('userData', JSON.stringify(user));

    setAccessToken(accessToken);
    setUserDataLocal(user);
    setIsAuthenticated(true);

    let userId = user?._id || user?.id;

    // Khởi tạo socket với callback cải thiện
    if (userId && !socketInitialized.current) {
      console.log('🔌 Initializing socket for user:', userId);
      try {
        await initSocketClient(userId, apiBaseUrl, () => {
          console.log('🎯 Socket connected callback triggered');
          socketInitialized.current = true;

          // Thiết lập socket listeners ngay khi callback được gọi
          setupSocketListeners();

          // Set connected state ngay lập tức
          setSocketConnected(true);
          console.log('✅ Socket connection status set to true');
        });
        console.log('✅ Socket initialization completed');

        // Kiểm tra bổ sung sau một khoảng thời gian ngắn
        setTimeout(() => {
          try {
            const socket = getSocket();
            if (socket && socket.connected) {
              console.log('🔗 Secondary socket verification: connected');
              setSocketConnected(true);
            } else {
              console.log('⚠️ Secondary socket verification: not connected');
              setSocketConnected(false);
            }
          } catch (error) {
            console.error('❌ Error in secondary socket check:', error);
          }
        }, 1000);
      } catch (error) {
        console.error('❌ Socket initialization failed:', error);
        setSocketConnected(false);
      }
    }

    // Gọi checkGoogleLinkStatus TRƯỚC để xác định user có linked Google account không
    console.log('🔍 Checking Google link status first');
    try {
      await checkGoogleLinkStatus(); // Check Google link status FIRST
      // Sau đó mới check Google auth với thông tin link status đã được cập nhật
      console.log('🔍 Now calling checkGoogleAuth after link status updated');
      await checkGoogleAuth(true); // Force check even if userDataLocal might not be fully updated in state yet
    } catch (error) {
      console.error('Error checking Google auth immediately:', error);
    }

    // Tải các dữ liệu khác trong background
    setTimeout(async () => {
      try {
        await Promise.all([fetchNotifications(true), getCalendarUser()]);
      } catch (error) {
        console.error('Error loading background data:', error);
      }
    }, 100);

    // Kiểm tra socket status cuối cùng sau khi tất cả đã hoàn thành
    setTimeout(() => {
      if (socketInitialized.current) {
        try {
          const socket = getSocket();
          const isConnected = socket && socket.connected;
          console.log('🔗 Final socket status verification:', isConnected);
          setSocketConnected(isConnected);
        } catch (error) {
          console.error('❌ Error in final socket verification:', error);
          setSocketConnected(false);
        }
      }
    }, 2000);

    // Chỉ hiển thị toast và navigate nếu không phải Google login
    if (!isGoogleLogin) {
      toast.success('Login successful!');
      // Chỉ navigate nếu đang ở auth pages
      if (location.pathname === '/login' || location.pathname === '/register') {
        navigate('/dashboard');
      }
    }

    // Reset processing flag sau khi hoàn thành
    setTimeout(() => {
      isProcessingAuth.current = false;
    }, 1500);

    return true;
  };

  const googleLogin = async () => {
    try {
      // Chuyển hướng đến backend để bắt đầu Google OAuth
      window.location.href = `${apiBaseUrl}/google/login`;
    } catch (error) {
      console.error('Google login error:', error);
      toast.error('Failed to initiate Google login');
      return false;
    }
  };

  // Đăng ký truyền thống
  const register = async (username, email, password, passwordConfirm) => {
    try {
      const response = await axios.post(
        `${apiBaseUrl}/signup`,
        {
          username,
          email,
          password,
          passwordConfirm,
        },
        {
          timeout: 15000,
          withCredentials: true, // Include cookies
        }
      );

      console.log('🔍 Registration response:', response.data);
      console.log('response.data.status', response.data.status);

      if (response.data.status === 'success') {
        const { token, data } = response.data;
        return await handleLoginSuccess(token, data.user);
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.response?.data?.message || 'Registration failed');
      return false;
    }
  };

  const logout = async () => {
    try {
      await axios.get(`${apiBaseUrl}/logout`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        withCredentials: true, // Include cookies
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('notifications');

    setAccessToken(null);
    setUserDataLocal(null);
    setIsAuthenticated(false);
    setNotifications([]);
    setNotificationCount(0);
    setCalendarUser(null);
    setCalendarBoard(null);
    setIsGoogleAuthenticated(false);
    setShowGoogleAuthModal(false);
    setIsCheckingGoogleAuth(false);
    setNotificationPagination({
      hasMore: true,
      currentPage: 1,
      totalCount: 0,
      loading: false,
    });
    setSkillsList([]); // Reset skills on logout
    setLoadingSkills(false);
    setSkillsError(null);

    disconnectSocket();
    socketInitialized.current = false;
    setSocketConnected(false);

    navigate('/login');
  };

  // Fetch user profile
  const fetchUserProfile = useCallback(async () => {
    if (!accessToken) {
      console.log('⚠️ No access token, skipping fetchUserProfile');
      return null;
    }
    try {
      const response = await axios.get(`${apiBaseUrl}/users/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });
      if (response.data.status === 'success') {
        const user = response.data.data.user;
        setUserDataLocal(user);
        localStorage.setItem('userData', JSON.stringify(user));
        return user;
      } else {
        throw new Error(response.data.message || 'Failed to fetch profile');
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch profile');
      return null;
    }
  }, [accessToken]);
  // Update user profile
  const updateUserProfile = async (profileData) => {
    if (!accessToken) {
      console.log('⚠️ No access token, skipping updateUserProfile');
      return false;
    }

    try {
      const response = await axios.put(
        `${apiBaseUrl}/users/update`,
        profileData,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.status === 'success') {
        const updatedUser = response.data.data.user;
        setUserDataLocal(updatedUser);
        localStorage.setItem('userData', JSON.stringify(updatedUser));
        toast.success('Profile updated successfully!');
        return true;
      } else {
        throw new Error(response.data.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating user profile:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
      return false;
    }
  };

  // Fetch all skills from backend
  const fetchAllSkills = async () => {
    if (!accessToken) {
      console.log('⚠️ No access token, skipping fetchAllSkills');
      return;
    }

    setLoadingSkills(true);
    setSkillsError(null);

    try {
      const response = await axios.get(`${apiBaseUrl}/skills`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });

      if (response.data.status === 'success') {
        // Extract skills array from response.data.data.skills
        const skillsData = response.data.data?.skills || [];
        setSkillsList(skillsData);
      } else {
        throw new Error(response.data.message || 'Failed to fetch skills list');
      }
    } catch (error) {
      console.error('Error fetching skills:', error);
      setSkillsError(
        error.response?.data?.message || 'Cannot fetch skills list'
      );
      toast.error(error.response?.data?.message || 'Cannot fetch skills list');
      setSkillsList([]); // Ensure skillsList is an empty array on error
    } finally {
      setLoadingSkills(false);
    }
  };

  // Fetch skills on mount if authenticated
  useEffect(() => {
    if (accessToken && isAuthenticated) {
      fetchAllSkills();
    }
  }, [accessToken, isAuthenticated]);

  // Fetch notifications (initial load)
  const fetchNotifications = async (reset = false) => {
    let userId = userDataLocal?.id || userDataLocal?._id;
    if (!accessToken || !userId) return;

    try {
      const skip = reset ? 0 : notifications.length;
      const response = await axios.get(`${apiBaseUrl}/notification`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { limit: 20, skip },
        timeout: 10000,
      });

      if (response.data.status === 'success') {
        const newNotifs = response.data.data?.notifications || [];
        const pagination = response.data.pagination || {};

        if (reset) {
          setNotifications(newNotifs);
          localStorage.setItem('notifications', JSON.stringify(newNotifs));
        } else {
          const updatedNotifs = [...notifications, ...newNotifs];
          setNotifications(updatedNotifs);
          localStorage.setItem('notifications', JSON.stringify(updatedNotifs));
        }

        setNotificationPagination({
          hasMore: pagination.hasMore || false,
          currentPage: pagination.currentPage || 1,
          totalCount: pagination.totalCount || 0,
          loading: false,
        });
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      if (reset) {
        setNotifications([]);
        localStorage.removeItem('notifications');
      }
      setNotificationPagination((prev) => ({ ...prev, loading: false }));
      toast.error(
        error.response?.data?.message || 'Failed to load notifications'
      );
    }
  };

  // Load more notifications for infinite scroll
  const loadMoreNotifications = async () => {
    let userId = userDataLocal?.id || userDataLocal?._id;
    if (
      !accessToken ||
      !userId ||
      notificationPagination.loading ||
      !notificationPagination.hasMore
    ) {
      return;
    }

    setNotificationPagination((prev) => ({ ...prev, loading: true }));

    try {
      const skip = notifications.length;
      const response = await axios.get(`${apiBaseUrl}/notification`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { limit: 20, skip },
        timeout: 10000,
      });

      if (response.data.status === 'success') {
        const newNotifs = response.data.data?.notifications || [];
        const pagination = response.data.pagination || {};

        const updatedNotifs = [...notifications, ...newNotifs];
        setNotifications(updatedNotifs);
        localStorage.setItem('notifications', JSON.stringify(updatedNotifs));

        setNotificationPagination({
          hasMore: pagination.hasMore || false,
          currentPage: pagination.currentPage || 1,
          totalCount: pagination.totalCount || 0,
          loading: false,
        });
      }
    } catch (error) {
      console.error('Error loading more notifications:', error);
      setNotificationPagination((prev) => ({ ...prev, loading: false }));
      toast.error('Failed to load more notifications');
    }
  };

  // Mark notification as read
  const markNotificationAsRead = async (notificationId) => {
    if (!accessToken || !notificationId) return;

    // Kiểm tra xem notification đã được đọc chưa
    const notification = notifications.find(
      (n) => n.notificationId === notificationId
    );
    if (notification && notification.isRead) {
      return;
    }

    try {
      const response = await axios.patch(
        `${apiBaseUrl}/notification/${notificationId}/read`,
        {},
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.status === 'success') {
        setNotifications((prev) => {
          const updated = prev.map((n) =>
            n.notificationId === notificationId
              ? { ...n, isRead: true, readAt: formatDateAMPMForVN(new Date()) }
              : n
          );
          localStorage.setItem('notifications', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      // toast.error(
      //   error.response?.data?.message ||
      //     'Không thể đánh dấu thông báo là đã đọc'
      // );
    }
  };

  // Respond to event invitation
  const respondToEventInvitation = async (
    eventId,
    status,
    notificationId,
    forceAccept = false
  ) => {
    let userId = userDataLocal?.id || userDataLocal?._id;
    if (!accessToken || !eventId || !userId) return { success: false };

    try {
      const response = await axios.patch(
        `${apiBaseUrl}/event/${eventId}/participants/${userId}/update-status`,
        { status, forceAccept },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.status === 200) {
        console.log('✅ Event invitation response successful:', {
          eventId,
          status,
          notificationId,
        });

        // Cập nhật local state ngay lập tức để UI phản hồi nhanh
        setNotifications((prevNotifications) =>
          prevNotifications.map((notif) => {
            if (
              notif.notificationId === notificationId &&
              notif.type === 'event_invitation'
            ) {
              console.log('🔄 Updating notification state locally:', {
                notificationId,
                oldStatus: notif.responseStatus,
                newStatus: status,
              });
              return {
                ...notif,
                responseStatus: status,
                responded: true,
              };
            }
            return notif;
          })
        );

        // Mark notification as read
        await markNotificationAsRead(notificationId);

        // Refresh notifications sau khi cập nhật local state để đảm bảo đồng bộ
        setTimeout(() => {
          console.log('🔄 Refreshing notifications after response');
          fetchNotifications(true);
        }, 1000);

        // Không hiển thị toast ở đây nữa, để Header.jsx handle
        return { success: true };
      }
    } catch (error) {
      console.error('❌ Error responding to event invitation:', error);

      // Handle conflict case
      if (error.response?.status === 409 && error.response?.data?.hasConflict) {
        return {
          success: false,
          hasConflict: true,
          conflictData: error.response.data,
        };
      }

      toast.error(
        error.response?.data?.message || 'Failed to respond to event invitation'
      );
      return { success: false };
    }
  };

  // Update event status based on time (improved - bulk update all user events)
  const updateAllUserEventsStatusByTime = async () => {
    if (!accessToken) return null;

    try {
      const response = await axios.patch(
        `${apiBaseUrl}/event/update-all-status-by-time`,
        {},
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000, // Tăng timeout cho bulk operation
        }
      );

      if (response.data.status === 200) {
        console.log(
          `✅ Updated ${response.data.data.updatedEvents}/${response.data.data.totalEvents} events status`
        );
        return response.data.data;
      }
    } catch (error) {
      console.error('❌ Error updating all user events status by time:', error);
      // Không hiển thị toast error vì đây là background process
      return null;
    }
  };

  // Update event status based on time (legacy - single event)
  const updateEventStatusByTime = async (eventId) => {
    if (!accessToken || !eventId) return null;

    try {
      const response = await axios.patch(
        `${apiBaseUrl}/event/${eventId}/update-status-by-time`,
        {},
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.status === 200) {
        return response.data.data;
      }
    } catch (error) {
      console.error('❌ Error updating event status by time:', error);
      // Không hiển thị toast error vì đây là background process
      return null;
    }
  };

  // Setup socket listeners với cải thiện
  const setupSocketListeners = () => {
    const socket = getSocket();
    if (!socket) {
      console.warn('⚠️ Socket not available in setupSocketListeners');
      return;
    }

    // Existing socket listeners...
    socket.on('connect', () => {
      setSocketConnected(true);
      console.log('🔗 Socket connected successfully:', socket.id);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
      console.log('🔌 Socket disconnected');
    });

    socket.on('connect_error', (error) => {
      setSocketConnected(false);
      console.error('❌ Socket connection error:', error);
    });

    // Handle notifications
    if (userDataLocal) {
      const handleNewNotification = (notification) => {
        console.log('📱 New notification received:', notification);

        // Add notification to local state
        setNotifications((prev) => {
          // Avoid duplicates
          const exists = prev.some(
            (n) => n.notificationId === notification.notificationId
          );
          if (exists) return prev;

          const newNotification = {
            notificationId: notification.notificationId,
            title: notification.title,
            content: notification.content,
            type: notification.type,
            isRead: false,
            createdAt: notification.createdAt,
            eventId: notification.eventId || null,
            taskId: notification.taskId || null,
            messageId: notification.messageId || null,
            responseStatus: notification.responseStatus || null,
            responded: notification.responded || false,
          };
          return [newNotification, ...prev];
        });

        // Show toast notifications for different types
        const toastMessages = {
          // Task notifications
          task_created: `✅ Task created successfully: "${notification.content}"`,
          task_assigned: `📋 You have been assigned a new task: "${notification.content}"`,
          task_assignment_confirmed: `✅ ${notification.content}`,
          task_unassigned: `❌ ${notification.content}`,
          task_unassignment_confirmed: `✅ ${notification.content}`,
          task_updated: `📝 ${notification.content}`,
          task_deleted: `🗑️ ${notification.content}`,
          task_progress_updated: `📊 ${notification.content}`,

          // List notifications
          list_created: `✅ ${notification.content}`,
          list_updated: `📝 ${notification.content}`,
          list_deleted: `🗑️ ${notification.content}`,

          // Event notifications
          event_invitation: `📅 Event invitation: ${notification.content}`,
          event_updated: `📝 Event updated: ${notification.content}`,
          event_cancelled: `❌ Event cancelled: ${notification.content}`,
          event_reminder: `⏰ Event reminder: ${notification.content}`,

          // Message notifications
          new_message: `💬 New message: ${notification.content}`,

          // File notifications
          file_shared: `📎 ${notification.content}`,
          task_document_added: `📎 ${notification.content}`,
          task_document_removed: `🗑️ ${notification.content}`,

          // Board/Workspace notifications
          board_invite: `📋 ${notification.content}`,
          workspace_invite: `🏢 ${notification.content}`,

          // Google integrations
          google_auth: `🔗 ${notification.content}`,
          google_link_success: `✅ ${notification.content}`,
          google_unlink_success: `❌ ${notification.content}`,

          // Default fallback
          default: notification.content,
        };

        const toastMessage =
          toastMessages[notification.type] || toastMessages.default;

        toast.success(toastMessage, {
          position: 'top-right',
          autoClose: 4000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      };

      socket.on('new_notification', handleNewNotification);

      const handleNotificationUpdate = ({ notificationId, isRead }) => {
        console.log('📨 Notification update received:', {
          notificationId,
          isRead,
        });
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.notificationId === notificationId
              ? { ...notif, isRead }
              : notif
          )
        );

        if (isRead) {
          setNotificationCount((prev) => Math.max(0, prev - 1));
        }
      };

      socket.on('notification_update', handleNotificationUpdate);
    }

    // Handle activity logs
    const handleNewActivity = (activityLog) => {
      console.log('📊 New activity log received:', activityLog);

      // Show toast notifications for different activity types
      if (activityLog.action.startsWith('task_')) {
        const actionMessages = {
          task_created: '✅ New task is created',
          task_updated: '📝 New task is updated',
          task_assigned: '👤 Task is assigned',
          task_unassigned: '👥 Unssigned a task',
          task_checklist_updated: '☑️ Checklist is updated',
          task_checklist_item_completed:
            '✅ Checklist item marked as "completed"',
          task_checklist_item_uncompleted:
            '❌ Checklist item marked as "incompleted"',
          task_document_added: '📎 Document is added to task',
          task_document_shared: '🔗 Document is shared in task',
          task_document_renamed: '✏️ Document is renamed',
          task_document_removed: '🗑️ Document is removed',
          task_deleted: '🗑️ Task is removed',
        };

        const message = actionMessages[activityLog.action] || '📄 New activity';
        // toast.info(`${message} bởi ${activityLog.userName}`, {
        //   position: 'top-right',
        //   autoClose: 3000,
        //   hideProgressBar: false,
        // });
      } else if (activityLog.action.startsWith('list_')) {
        const actionMessages = {
          list_created: '📋 New list created',
          list_updated: '✏️ List updated',
          list_deleted: '🗑️ List deleted',
          list_task_moved: '🔄 Task is moved',
        };

        const message = actionMessages[activityLog.action] || '📄 New activity';
        toast.info(`${message} by ${activityLog.userName}`, {
          position: 'top-right',
          autoClose: 3000,
          hideProgressBar: false,
        });
      }

      // This will be handled by BoardActivityLog component
      window.dispatchEvent(
        new CustomEvent('new_board_activity', {
          detail: activityLog,
        })
      );
    };

    const handleTaskActivity = (activityLog) => {
      console.log('📋 New task activity received:', activityLog);

      // Handle sensitive task activities with more discrete notifications
      if (
        activityLog.action === 'task_assigned' ||
        activityLog.action === 'task_unassigned'
      ) {
        const message =
          activityLog.action === 'task_assigned'
            ? '🔒 Updated about task assignment'
            : '🔒 Updated about cancelling task assignment';
        toast.info(message, {
          position: 'top-right',
          autoClose: 2000,
          hideProgressBar: false,
        });
      }

      // Handle sensitive task activity logs
      window.dispatchEvent(
        new CustomEvent('new_task_activity', {
          detail: activityLog,
        })
      );
    };

    const handleAdminActivity = (activityLog) => {
      console.log('👑 New admin activity received:', activityLog);
      // Handle admin-only activity logs
      window.dispatchEvent(
        new CustomEvent('new_admin_activity', {
          detail: activityLog,
        })
      );
    };

    // Handle real-time event message events
    const handleNewEventMessage = (data) => {
      console.log('💬 New event message received via socket:', data);

      const { eventId, message } = data;

      // Emit custom event với đầy đủ dữ liệu để Calendar.jsx có thể handle
      const customEvent = new CustomEvent('new_event_message', {
        detail: {
          eventId,
          message: {
            _id: message._id,
            content: message.content,
            userId: message.userId,
            createdAt: message.createdAt,
            isEdited: message.isEdited || false,
            editedAt: message.editedAt || null,
            isSystemMessage: message.isSystemMessage || false, // Thêm field isSystemMessage
          },
        },
      });

      window.dispatchEvent(customEvent);
    };

    const handleEditEventMessage = (data) => {
      console.log('✏️ Edit event message received via socket:', data);
      // Bridge socket event to window custom event
      window.dispatchEvent(
        new CustomEvent('edit_event_message', {
          detail: data,
        })
      );
    };

    const handleDeleteEventMessage = (data) => {
      console.log('🗑️ Delete event message received via socket:', data);
      // Bridge socket event to window custom event
      window.dispatchEvent(
        new CustomEvent('delete_event_message', {
          detail: data,
        })
      );
    };

    socket.on('new_activity', handleNewActivity);
    socket.on('task_activity', handleTaskActivity);
    socket.on('admin_activity', handleAdminActivity);

    // Add message event listeners
    socket.on('new_event_message', handleNewEventMessage);
    socket.on('edit_event_message', handleEditEventMessage);
    socket.on('delete_event_message', handleDeleteEventMessage);

    // Store listeners for cleanup
    return () => {
      if (socket) {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('new_notification');
        socket.off('notification_update');
        socket.off('new_activity', handleNewActivity);
        socket.off('task_activity', handleTaskActivity);
        socket.off('admin_activity', handleAdminActivity);
        socket.off('new_event_message', handleNewEventMessage);
        socket.off('edit_event_message', handleEditEventMessage);
        socket.off('delete_event_message', handleDeleteEventMessage);
      }
    };
  };

  //Create a personal calendar for user (if needed)
  const createInitialCalendar = async () => {
    try {
      const response = await axios.post(
        `${apiBaseUrl}/calendar`,
        {
          name: 'Personal Working Calendar',
          description: 'A calendar for each user in system',
          ownerType: 'user',
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            timeout: 10000,
          },
        }
      );
    } catch (error) {
      // console.error('Error creating calendar:', error.response?.data?.message);
    }
  };

  // Get user calendar
  const getCalendarUser = async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/calendar/get-by-user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          timeout: 10000,
        },
      });
      if (response.data.status === 200 && response.data.data?.length > 0) {
        setCalendarUser(response.data.data[0]); // Lấy lịch đầu tiên
      }
    } catch (error) {
      console.error(
        'Lỗi khi lấy lịch user:',
        error.response?.data?.message || error.message
      );
      if (error.response?.status === 404) {
        // Không tìm thấy lịch, thử tạo mới
        const created = await createInitialCalendar();
        if (!created) {
          // toast.error('Không thể tạo lịch cá nhân');
          console.error('Không thể tạo lịch cá nhân');
        }
      }
    }
  };

  // Get board calendar
  const getBoardCalendar = async (boardId) => {
    if (!accessToken || !boardId) return { success: false };

    try {
      const response = await axios.get(
        `${apiBaseUrl}/calendar/get-by-board/${boardId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 10000,
        }
      );

      if (response.data.status === 200 && response.data.data?.length > 0) {
        console.log('lich cua board', response.data.data[0]);
        setCalendarBoard(response.data.data[0]);
        return {
          success: true,
          data: response.data.data,
        };
      } else {
        return {
          success: true,
          data: [],
        };
      }
    } catch (error) {
      console.error(
        'Lỗi khi lấy lịch board:',
        error.response?.data?.message || error.message
      );
      if (error.response?.status === 404) {
        // Không tìm thấy lịch, thử tạo mới
        const created = await createInitialCalendarForBoard(boardId);
        if (created) {
          return { success: true, data: [created] };
        }
      }
      return { success: false, error: error.response?.data?.message };
    }
  };

  // Xử lý xác thực Google
  const handleGoogleAuth = async () => {
    try {
      console.log('Starting Google auth process...');
      const response = await axios.get(`${apiBaseUrl}/files/get-auth-url`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });

      console.log('Auth URL response:', response.data);

      if (response.data.status === 'success' && response.data.data?.authUrl) {
        // Store current URL to return after auth
        sessionStorage.setItem('returnToUrl', window.location.pathname);

        // Redirect to Google auth
        window.location.href = response.data.data.authUrl;
      } else if (
        response.data.status === 'success' &&
        !response.data.data?.authUrl
      ) {
        // If no authUrl is provided, it means all scopes are already authorized
        console.log('All required scopes are already authorized');
        setIsGoogleAuthenticated(true);
        setShowGoogleAuthModal(false);
        toast.success('Google authentication is already complete');
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Google auth error:', error);
      toast.error(
        error.response?.data?.message ||
          'Error initiating Google authentication. Please try again.'
      );

      // Force recheck auth status
      await checkGoogleAuth(true);
    }
  };

  // Check Google link status for current user
  const checkGoogleLinkStatus = async () => {
    if (!accessToken) return;

    setGoogleLinkStatus((prev) => ({ ...prev, loading: true }));

    try {
      const response = await axios.get(`${apiBaseUrl}/google-link-status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });

      if (response.data.success) {
        setGoogleLinkStatus({
          hasGoogleAccount: response.data.data.hasGoogleAccount,
          loading: false,
          email: response.data.data.email,
          googleId: response.data.data.googleId,
          hasPassword: response.data.data.hasPassword, // Add this
        });
      }
    } catch (error) {
      console.error('Error checking Google link status:', error);
      setGoogleLinkStatus((prev) => ({ ...prev, loading: false }));
    }
  };

  // Link Google account to current user
  const linkGoogleAccount = async () => {
    try {
      if (!userDataLocal || !accessToken) {
        toast.error('Bạn cần đăng nhập để liên kết tài khoản Google');
        return;
      }

      console.log('🔗 Starting Google account linking process');
      setIsLinkingGoogle(true);

      // Store current URL to return after linking
      sessionStorage.setItem('returnToUrl', window.location.pathname);

      // Redirect to Google linking auth
      // The backend will use state parameter to maintain user context
      window.location.href = `${apiBaseUrl}/link-google`;
    } catch (error) {
      console.error('Error initiating Google account linking:', error);
      setIsLinkingGoogle(false);
      toast.error('Không thể bắt đầu liên kết tài khoản Google');
    }
  };

  // Unlink Google account from current user
  const unlinkGoogleAccount = async () => {
    try {
      const response = await axios.delete(`${apiBaseUrl}/unlink-google`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });

      if (response.data.success) {
        toast.success('Hủy liên kết tài khoản Google thành công');
        // Update link status
        setGoogleLinkStatus({
          hasGoogleAccount: false,
          loading: false,
          email: userDataLocal?.email,
          googleId: null,
        });
        // Update Google auth status
        setIsGoogleAuthenticated(false);
        setShowGoogleAuthModal(false);
        return true;
      }
    } catch (error) {
      console.error('Error unlinking Google account:', error);
      toast.error(
        error.response?.data?.message ||
          'Không thể hủy liên kết tài khoản Google'
      );
      return false;
    }
  };

  // !!!----------------------------Hàm này chưa sửa chưa upload được----------------------------!!!
  const uploadImageToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append(
      'upload_preset',
      'sdn302-recipes-sharing-web-single-image-for-recipe'
    );

    try {
      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${
          import.meta.env.VITE_CLOUDINARY_NAME
        }/image/upload`,
        formData,
        { timeout: 10000 }
      );
      console.log('VITE_CLOUDINARY_NAME', import.meta.env.VITE_CLOUDINARY_NAME);
      console.log('response', response);
      console.log('response.data', response.data);
      console.log('response.data.secureurl', response.data.secure_url);
      if (response.status === 200) {
        console.log('oke upload thành công');
        return response.data.secure_url; // Trả về URL ảnh đã upload
      }
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      throw new Error('Upload to Cloudinary failed');
    }
  };

  /**
   * Fetch workspaces for current user
   */
  const fetchWorkspaces = async () => {
    setLoadingWorkspaces(true);
    setWorkspacesError(null);
    try {
      if (!accessToken) {
        setWorkspaces([]);
        return;
      }
      const res = await axios.get(`${apiBaseUrl}/workspace`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setWorkspaces(res.data.data || []);
    } catch (err) {
      setWorkspacesError(err.response?.data?.message || err.message);
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  // Initial fetch workspaces
  useEffect(() => {
    if (accessToken) fetchWorkspaces();
  }, [accessToken]);

  /**
   * Create a new workspace and update context
   */
  const createWorkspace = async ({ name, description }) => {
    const res = await axios.post(
      `${apiBaseUrl}/workspace/create`,
      { name, description },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.status !== 201) {
      throw new Error(res.data.message || 'Tạo workspace thất bại');
    }
    +(
      // refetch toàn bộ để đảm bảo members đã populate
      (await fetchWorkspaces())
    );
    return res.data.workspace;
  };

  // **Update workspace**:
  const updateWorkspace = async (workspaceId, updates) => {
    console.log('updateWorkspace', workspaceId, updates);

    const res = await axios.put(
      `${apiBaseUrl}/workspace/${workspaceId}`,
      updates,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.status !== 200) {
      throw new Error(res.data.message || 'Cập nhật workspace thất bại');
    }

    const updated = res.data.workspace;
    // cập nhật lại state workspaces: map qua array, thay đúng item
    setWorkspaces((prev) =>
      prev.map((ws) => (ws._id === workspaceId ? updated : ws))
    );
    // refetch toàn bộ để đảm bảo members đã populate
    await fetchWorkspaces();
    return res.data.workspace;
  };

  // **Close workspace**:
  const closeWorkspace = async (workspaceId) => {
    const res = await axios.patch(
      `${apiBaseUrl}/workspace/${workspaceId}/close`, // đường dẫn route BE bạn đã định nghĩa
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.status !== 200) {
      throw new Error(res.data.message || 'Đóng workspace thất bại');
    }
    // Loại bỏ workspace đã đóng khỏi state
    setWorkspaces((prev) => prev.filter((ws) => ws._id !== workspaceId));
    toast.success('Workspace đã được đóng thành công');
    return res.data.workspace;
  };

  //Delete workspace vĩnh viễn
  const deleteWorkspace = async (workspaceId) => {
    const res = await axios.delete(`${apiBaseUrl}/workspace/${workspaceId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status !== 200) {
      throw new Error(res.data.message || 'Xóa workspace thất bại');
    }
    // remove khỏi state
    setWorkspaces((prev) => prev.filter((ws) => ws._id !== workspaceId));
    toast.success('Workspace đã bị xóa vĩnh viễn');
    return true;
  };

  const fetchBoards = async (workspaceId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(
        `${apiBaseUrl}/workspace/${workspaceId}/board`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      // unwrap đúng field và ép mọi mảng về [] nếu missing
      const raw = res.data.boards || [];
      const norm = raw.map((board) => ({
        ...board,
        members: board.members || [], // luôn có mảng
        tasks: board.tasks || [], // luôn có mảng
      }));
      setBoards(norm);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  //Tạo calendar riêng cho từng board (nếu chưa có) sau khi fetch toàn bộ boards của user
  const createInitialCalendarForBoard = async (boardId) => {
    try {
      const response = await axios.post(
        `${apiBaseUrl}/calendar`,
        {
          name: 'Board Calendar',
          description: 'A calendar for board',
          ownerType: 'board',
          boardId,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            timeout: 10000,
          },
        }
      );
    } catch (error) {
      // console.error('Error creating calendar:', error.response?.data?.message);
    }
  };

  //close board
  const closeBoard = async (workspaceId, boardId) => {
    try {
      const res = await axios.patch(
        `${apiBaseUrl}/workspace/${workspaceId}/board/${boardId}/close`,
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.status !== 200) {
        throw new Error(res.data.message || 'Đóng board thất bại');
      }
      toast.success(res.data.message);
      return res.data.board;
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
      throw err;
    }
  };

  //xóa board
  const deleteBoard = async (workspaceId, boardId) => {
    try {
      const res = await axios.delete(
        `${apiBaseUrl}/workspace/${workspaceId}/board/${boardId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.status !== 200) {
        throw new Error(res.data.message || 'Xóa board thất bại');
      }
      toast.success(res.data.message);
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
      throw err;
    }
  };

  // Check if need to setup socket listeners when user changes
  useEffect(() => {
    let userId = userDataLocal?.id || userDataLocal?._id;
    if (
      isAuthenticated &&
      userId &&
      socketInitialized.current &&
      !socketConnected
    ) {
      console.log('🔄 Setting up socket listeners for existing connection');
      setupSocketListeners();
    }
  }, [isAuthenticated, userDataLocal, socketConnected]);

  // Lưu thông báo vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem('notifications', JSON.stringify(notifications));
    } catch (error) {
      console.error('Error saving notifications to localStorage:', error);
    }
  }, [notifications]);

  // Periodic socket status check với cải thiện
  useEffect(() => {
    if (!isAuthenticated || !socketInitialized.current) return;

    const checkSocketStatus = () => {
      try {
        const socket = getSocket();
        const isConnected = socket && socket.connected;
        const currentStatus = socketConnected;

        if (isConnected !== currentStatus) {
          console.log(
            `🔄 Socket status mismatch detected: ${currentStatus} -> ${isConnected}`
          );
          setSocketConnected(isConnected);

          // Log detailed status for debugging
          if (isConnected) {
            console.log('✅ Socket status updated to connected');
          } else {
            console.log('❌ Socket status updated to disconnected');
          }
        }
      } catch (error) {
        // Socket not initialized yet, set to false
        if (socketConnected) {
          console.log(
            '⚠️ Socket not accessible, setting status to disconnected'
          );
          setSocketConnected(false);
        }
      }
    };

    // Initial check
    checkSocketStatus();

    // Check every 2 seconds
    const interval = setInterval(checkSocketStatus, 2000);

    return () => clearInterval(interval);
  }, [isAuthenticated, socketInitialized.current, socketConnected]);

  // Initialize socket khi user đã login (for page reload)
  useEffect(() => {
    let userId = userDataLocal?.id || userDataLocal?._id;
    if (
      accessToken &&
      userId &&
      !socketInitialized.current &&
      !isProcessingAuth.current
    ) {
      console.log('🔄 Reinitializing socket after page reload');
      const initSocket = async () => {
        try {
          await initSocketClient(userId, apiBaseUrl, () => {
            console.log('🎯 Socket reconnected callback triggered');
            socketInitialized.current = true;
            setupSocketListeners();
          });
          console.log('✅ Socket reinitialization completed');
        } catch (error) {
          console.error('❌ Socket reinitialization failed:', error);
        }
      };
      initSocket();
    }
  }, [accessToken, userDataLocal]); // Simplified dependencies

  // Kiểm tra Google link status khi user authenticated
  useEffect(() => {
    if (accessToken && isAuthenticated && !googleLinkStatus.loading) {
      checkGoogleLinkStatus();
    }
  }, [accessToken, isAuthenticated]);

  // Gọi checkGoogleAuth sau khi checkGoogleLinkStatus hoàn thành - CHỈ KHI USER ĐÃ LINK GOOGLE ACCOUNT
  useEffect(() => {
    if (
      accessToken &&
      isAuthenticated &&
      !googleLinkStatus.loading &&
      !isCheckingGoogleAuth &&
      !isLinkingGoogle && // KHÔNG gọi khi đang linking
      googleLinkStatus.hasGoogleAccount // CHỈ gọi khi user đã có Google account linked
    ) {
      // Delay một chút để đảm bảo googleLinkStatus đã được cập nhật hoàn toàn
      const timer = setTimeout(() => {
        console.log('🔍 Auto-checking Google auth for linked user:', {
          hasGoogleAccount: googleLinkStatus.hasGoogleAccount,
          loading: googleLinkStatus.loading,
          isLinking: isLinkingGoogle,
        });
        checkGoogleAuth();
      }, 500);

      return () => clearTimeout(timer);
    } else if (
      !googleLinkStatus.loading &&
      !googleLinkStatus.hasGoogleAccount &&
      !isLinkingGoogle
    ) {
      console.log(
        '🚫 Skipping Google auth check - user has not linked Google account'
      );
    } else if (isLinkingGoogle) {
      console.log(
        '🔗 Skipping Google auth check - user is currently linking Google account'
      );
    }
  }, [
    accessToken,
    isAuthenticated,
    googleLinkStatus.loading,
    googleLinkStatus.hasGoogleAccount,
    isLinkingGoogle,
  ]);

  // Tải dữ liệu ban đầu sau khi có userDataLocal
  useEffect(() => {
    let userId = userDataLocal?.id || userDataLocal?._id;
    if (
      accessToken &&
      userId &&
      !isCheckingGoogleAuth &&
      !isProcessingAuth.current
    ) {
      const loadInitialData = async () => {
        try {
          await Promise.all([
            fetchNotifications(true),
            // checkGoogleAuth() sẽ được gọi sau khi checkGoogleLinkStatus hoàn thành
            getCalendarUser(),
          ]);
        } catch (error) {
          console.error('Error loading initial data:', error);
        }
      };

      loadInitialData();
    }
  }, [accessToken, userDataLocal]); // Simplified dependencies

  // Fallback effect to ensure Google auth modal shows for users who have linked Google accounts
  useEffect(() => {
    if (
      isAuthenticated &&
      userDataLocal &&
      accessToken &&
      !isGoogleAuthenticated &&
      googleLinkStatus.hasGoogleAccount && // CHỈ gọi cho user đã link Google account
      !googleLinkStatus.loading &&
      !isLinkingGoogle // KHÔNG gọi khi đang linking
    ) {
      console.log(
        '🔄 Fallback: Checking Google auth for linked user modal display'
      );
      const timer = setTimeout(() => {
        checkGoogleAuth();
      }, 2000); // Delay for fallback check

      return () => clearTimeout(timer);
    } else if (
      isAuthenticated &&
      userDataLocal &&
      !googleLinkStatus.hasGoogleAccount &&
      !googleLinkStatus.loading &&
      !isLinkingGoogle
    ) {
      console.log(
        '🚫 Skipping fallback Google auth check - user has not linked Google account'
      );
    } else if (isLinkingGoogle) {
      console.log(
        '🔗 Skipping fallback Google auth check - user is currently linking Google account'
      );
    }
  }, [
    isAuthenticated,
    userDataLocal,
    accessToken,
    isGoogleAuthenticated,
    googleLinkStatus.hasGoogleAccount,
    googleLinkStatus.loading,
    isLinkingGoogle,
  ]);

  // Xử lý query parameter khi quay lại từ Google OAuth
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const error = query.get('error');
    const message = query.get('message');

    if (error === 'google_auth_failed') {
      toast.error(
        message || 'Email tài khoản đã tồn tại.'
        // Vui lòng đăng nhập thủ công và kết nối với tài khoản Google của bạn.
      );
      navigate('/login', { replace: true });
    }
  }, [location, navigate]);

  // Cancel event participation with reason
  const cancelEventParticipation = async (eventId, reason) => {
    if (!accessToken || !eventId || !reason) return false;

    try {
      const response = await axios.patch(
        `${apiBaseUrl}/event/${eventId}/cancel-invitation-and-give-reason`,
        { reason },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.status === 200) {
        toast.success('Đã hủy tham gia sự kiện thành công');

        // Trigger calendar refresh
        window.dispatchEvent(
          new CustomEvent('eventUpdated', {
            detail: { eventId: eventId },
          })
        );

        return true;
      }
      return false;
    } catch (error) {
      console.error('Error canceling event participation:', error);
      toast.error(
        error.response?.data?.message || 'Không thể hủy tham gia sự kiện'
      );
      return false;
    }
  };

  // Event messaging functions
  const sendEventMessage = async (eventId, content) => {
    if (!accessToken || !eventId || !content?.trim()) return { success: false };

    try {
      const response = await axios.post(
        `${apiBaseUrl}/message/event/${eventId}`,
        { content: content.trim() },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.status === 'success') {
        return { success: true, message: response.data.data.message };
      }
    } catch (error) {
      console.error('Error sending event message:', error);
      toast.error(error.response?.data?.message || 'Failed to send message');
      return { success: false, error: error.response?.data?.message };
    }
  };

  const getEventMessages = async (eventId, limit = 50, skip = 0) => {
    if (!accessToken || !eventId) return { success: false };

    try {
      const response = await axios.get(
        `${apiBaseUrl}/message/event/${eventId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { limit, skip },
          timeout: 10000,
        }
      );

      if (response.data.status === 'success') {
        return {
          success: true,
          data: response.data.data,
          messages: response.data.data.messages,
          canSendMessage: response.data.data.canSendMessage,
          pagination: response.data.data.pagination,
        };
      }
    } catch (error) {
      console.error('Error getting event messages:', error);
      return { success: false, error: error.response?.data?.message };
    }
  };

  const loadMoreEventMessages = async (
    eventId,
    currentMessages,
    limit = 20
  ) => {
    if (!accessToken || !eventId) return { success: false };

    try {
      // Sử dụng cursor-based pagination với timestamp của message cũ nhất
      const oldestMessage = currentMessages[0];
      const params = { limit };
      if (oldestMessage) {
        params.before = oldestMessage.createdAt;
      }

      const response = await axios.get(
        `${apiBaseUrl}/message/event/${eventId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params,
          timeout: 10000,
        }
      );

      if (response.data.status === 'success') {
        return {
          success: true,
          messages: response.data.data.messages,
          pagination: response.data.data.pagination,
        };
      }
    } catch (error) {
      console.error('Error loading more event messages:', error);
      return { success: false, error: error.response?.data?.message };
    }
  };

  const editEventMessage = async (messageId, content) => {
    if (!accessToken || !messageId || !content?.trim())
      return { success: false };

    try {
      const response = await axios.patch(
        `${apiBaseUrl}/message/${messageId}`,
        { content: content.trim() },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.status === 'success') {
        return { success: true, message: response.data.data.message };
      }
    } catch (error) {
      console.error('Error editing event message:', error);
      toast.error(error.response?.data?.message || 'Failed to edit message');
      return { success: false, error: error.response?.data?.message };
    }
  };

  const deleteEventMessage = async (messageId) => {
    if (!accessToken || !messageId) return { success: false };

    try {
      const response = await axios.delete(
        `${apiBaseUrl}/message/${messageId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.status === 'success') {
        toast.success('Message deleted successfully');
        return { success: true };
      }
    } catch (error) {
      console.error('Error deleting event message:', error);
      toast.error(error.response?.data?.message || 'Failed to delete message');
      return { success: false, error: error.response?.data?.message };
    }
  };

  // ============= TASK FUNCTIONS FOR BOARD CALENDAR SYNC =============

  const getBoardTasks = async (boardId, startDate, endDate) => {
    if (!accessToken || !boardId) return { success: false };

    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await axios.get(
        `${apiBaseUrl}/task/calendar/board/${boardId}?${params}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.status === 200 || response.status === 200) {
        return {
          success: true,
          data: response.data.data || [],
        };
      } else {
        console.error('API response not successful:', response.data);
        return { success: false, error: 'API response not successful' };
      }
    } catch (error) {
      console.error('Error getting board tasks:', error);
      return { success: false, error: error.response?.data?.message };
    }
  };

  const createTaskFromCalendar = async (taskData) => {
    if (!accessToken) return { success: false };

    try {
      const response = await axios.post(
        `${apiBaseUrl}/task/calendar/create`,
        taskData,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.status === 'success') {
        toast.success('Tạo task thành công');
        return {
          success: true,
          data: response.data.data,
        };
      }
    } catch (error) {
      console.error('Error creating task from calendar:', error);
      toast.error(error.response?.data?.message || 'Failed to create task');
      return { success: false, error: error.response?.data?.message };
    }
  };

  const updateTask = async (taskId, taskData) => {
    if (!accessToken || !taskId) return { success: false };

    try {
      const response = await axios.put(
        `${apiBaseUrl}/task/updateTask/${taskId}`,
        taskData,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.status === 'success') {
        toast.success('Cập nhật task thành công');
        return {
          success: true,
          data: response.data.data,
        };
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error(error.response?.data?.message || 'Failed to update task');
      return { success: false, error: error.response?.data?.message };
    }
  };

  const deleteTask = async (taskId) => {
    if (!accessToken || !taskId) return { success: false };

    try {
      const response = await axios.delete(
        `${apiBaseUrl}/task/deleteTask/${taskId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.status === 'success') {
        toast.success('Xóa task thành công');
        return { success: true };
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error(error.response?.data?.message || 'Failed to delete task');
      return { success: false, error: error.response?.data?.message };
    }
  };

  const getBoardLists = async (boardId) => {
    if (!accessToken || !boardId) return { success: false };

    try {
      const response = await axios.get(`${apiBaseUrl}/list/board/${boardId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });

      if (response.data.status === 'success') {
        return {
          success: true,
          data: response.data.data,
        };
      }
    } catch (error) {
      console.error('Error getting board lists:', error);
      return { success: false, error: error.response?.data?.message };
    }
  };

  const getBoardDetails = async (boardId) => {
    if (!accessToken || !boardId) return { success: false };

    try {
      const response = await axios.get(
        `${apiBaseUrl}/workspace/board/${boardId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.success) {
        return {
          success: true,
          data: response.data.board || response.data.data,
        };
      }
    } catch (error) {
      console.error('Error getting board details:', error);
      return { success: false, error: error.response?.data?.message };
    }
  };

  // ============= ENHANCED CONFLICT RESOLUTION =============

  const findAvailableTimeSlots = async (data) => {
    if (!accessToken) return { success: false };

    try {
      const response = await axios.post(
        `${apiBaseUrl}/event/find-available-slots`,
        data,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.status === 200) {
        return {
          success: true,
          data: response.data.data || [],
        };
      } else {
        return { success: false, error: 'API response not successful' };
      }
    } catch (error) {
      console.error('Error finding available time slots:', error);
      return { success: false, error: error.response?.data?.message };
    }
  };

  // ============= FILE MANAGEMENT FUNCTIONS =============

  // Upload file to task
  const uploadFileToTask = async (taskId, file) => {
    if (!accessToken || !taskId || !file) return { success: false };

    try {
      // Đảm bảo tên file được normalize UTF-8
      const normalizedFile = new File([file], file.name.normalize('NFC'), {
        type: file.type,
        lastModified: file.lastModified,
      });

      const formData = new FormData();
      formData.append('file', normalizedFile);
      formData.append('taskId', taskId);

      const response = await axios.post(
        `${apiBaseUrl}/files/upload-to-task`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'multipart/form-data',
          },
          timeout: 30000, // Tăng timeout cho upload
        }
      );

      if (response.data.status === 'success') {
        toast.success('Upload file thành công');
        return {
          success: true,
          data: response.data.data,
        };
      }
    } catch (error) {
      console.error('Error uploading file to task:', error);

      // Kiểm tra nếu là lỗi token hết hạn
      if (
        error.response?.status === 401 &&
        error.response?.data?.message?.includes('Token đã hết hạn')
      ) {
        // Lấy URL xác thực từ thông báo lỗi
        const authUrl = error.response.data.message.split(': ')[1];
        if (authUrl) {
          toast.warning(
            'Token Google Drive đã hết hạn, đang chuyển hướng đến trang xác thực...'
          );
          // Chuyển hướng đến trang xác thực Google
          window.location.href = authUrl;
          return { success: false, needReauth: true };
        }
      }

      toast.error(error.response?.data?.message || 'Failed to upload file');
      return { success: false, error: error.response?.data?.message };
    }
  };

  // Get files of a task
  const getTaskFiles = async (taskId) => {
    if (!accessToken || !taskId) return { success: false };

    try {
      const response = await axios.get(
        `${apiBaseUrl}/files/list-file/${taskId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.status === 'success') {
        return {
          success: true,
          data: response.data.data || [],
        };
      }
    } catch (error) {
      console.error('Error getting task files:', error);
      return { success: false, error: error.response?.data?.message };
    }
  };

  // Get file info
  const getFileInfo = async (fileDocId) => {
    if (!accessToken || !fileDocId) return { success: false };

    try {
      const response = await axios.get(`${apiBaseUrl}/files/${fileDocId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });

      if (response.data.status === 'success') {
        return {
          success: true,
          data: response.data.data,
        };
      }
    } catch (error) {
      console.error('Error getting file info:', error);
      return { success: false, error: error.response?.data?.message };
    }
  };

  // Download file
  const downloadFile = async (fileDocId, fileName) => {
    if (!accessToken || !fileDocId) return { success: false };

    try {
      const response = await axios.get(
        `${apiBaseUrl}/files/download/${fileDocId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          responseType: 'blob',
          timeout: 30000,
        }
      );

      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || 'download');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Tải file thành công');
      return { success: true };
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error(error.response?.data?.message || 'Failed to download file');
      return { success: false, error: error.response?.data?.message };
    }
  };

  // Delete file
  const deleteFile = async (fileDocId) => {
    if (!accessToken || !fileDocId) return { success: false };

    try {
      const response = await axios.delete(`${apiBaseUrl}/files/${fileDocId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { fileDocId }, // Send fileDocId in request body as expected by backend
        timeout: 10000,
      });

      if (response.data.status === 'success') {
        toast.success('Xóa file thành công');
        return { success: true };
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error(error.response?.data?.message || 'Failed to delete file');
      return { success: false, error: error.response?.data?.message };
    }
  };

  // Update file name
  const updateFileName = async (fileDocId, newName) => {
    if (!accessToken || !fileDocId || !newName?.trim())
      return { success: false };

    try {
      const response = await axios.patch(
        `${apiBaseUrl}/files/update/${fileDocId}`,
        { fileDocId, newName: newName.trim() },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.status === 'success') {
        toast.success('Rename file successfully');
        return {
          success: true,
          data: response.data.data,
        };
      }
    } catch (error) {
      console.error('Error updating file name:', error);
      toast.error(
        error.response?.data?.message || 'Error while updating file name'
      );
      return { success: false, error: error.response?.data?.message };
    }
  };

  // Share file with task users
  const shareFileWithTaskUsers = async (fileDocId, taskId) => {
    if (!accessToken || !fileDocId || !taskId) return { success: false };

    try {
      const response = await axios.post(
        `${apiBaseUrl}/files/share/${fileDocId}`,
        { fileDocId, taskId },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.status === 'success') {
        toast.success('Share file successfully');
        return { success: true };
      }
    } catch (error) {
      console.error('Error sharing file:', error);
      toast.error(error.response?.data?.message || 'Error while sharing file');
      return { success: false, error: error.response?.data?.message };
    }
  };

  // Check if user can upload files (Google auth required)
  const canUploadFiles = () => {
    return (
      userDataLocal && userDataLocal.role && userDataLocal.role !== 'read-only'
    );
  };

  // Activity Log functions
  const fetchActivityLogs = async (
    boardId,
    isAdmin = false,
    skip = 0,
    limit = 50
  ) => {
    try {
      const endpoint = isAdmin
        ? `/activity/board/${boardId}/admin`
        : `/activity/board/${boardId}`;

      const response = await fetch(
        `${apiBaseUrl}${endpoint}?skip=${skip}&limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        logs: data.data || [],
        results: data.results || 0,
      };
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      return {
        success: false,
        error: error.message,
        logs: [],
        results: 0,
      };
    }
  };

  return (
    <CommonContext.Provider
      value={{
        isMobile,
        isTablet,
        isDesktop,
        toast,
        navigate,
        userDataLocal,
        setUserDataLocal,
        accessToken,
        uploadImageToCloudinary,
        apiBaseUrl,
        login,
        register,
        logout,
        googleLogin,
        handleLoginSuccess,
        createInitialCalendar,
        createInitialCalendarForBoard,
        getCalendarUser,
        getBoardCalendar,
        calendarUser,
        setCalendarUser,
        calendarBoard,
        setCalendarBoard,
        showGoogleAuthModal,
        setShowGoogleAuthModal,
        handleGoogleAuth,
        checkGoogleAuth,
        isGoogleAuthenticated,
        isCheckingGoogleAuth,
        // Google account linking
        googleLinkStatus,
        checkGoogleLinkStatus,
        linkGoogleAccount,
        unlinkGoogleAccount,
        isLinkingGoogle,
        setIsLinkingGoogle,
        isAuthenticated,
        notifications,
        notificationCount,
        setNotificationCount,
        fetchNotifications,
        markNotificationAsRead,
        respondToEventInvitation,
        updateAllUserEventsStatusByTime,
        updateEventStatusByTime,
        formatDateAMPMForVN,
        formatDateForNotification,
        formatDateShortForVN,
        workspaces,
        createWorkspace,
        closeWorkspace,
        deleteWorkspace,
        updateWorkspace,
        loadingWorkspaces,
        workspacesError,
        currentWorkspaceId,
        setCurrentWorkspaceId,
        boards,
        fetchBoards,
        closeBoard,
        deleteBoard,
        loadingBoards,
        boardsError,
        socketConnected,
        setupSocketListeners,
        fetchUserProfile,
        updateUserProfile,
        cancelEventParticipation,
        loadMoreNotifications,
        notificationPagination,
        sendEventMessage,
        getEventMessages,
        loadMoreEventMessages,
        editEventMessage,
        deleteEventMessage,
        // Task functions for board calendar sync
        getBoardTasks,
        createTaskFromCalendar,
        updateTask,
        deleteTask,
        getBoardLists,
        getBoardDetails,
        fetchAllSkills,
        skillsList,
        loadingSkills,
        skillsError,
        // Enhanced conflict resolution
        findAvailableTimeSlots,
        // File management functions
        uploadFileToTask,
        getTaskFiles,
        getFileInfo,
        downloadFile,
        deleteFile,
        updateFileName,
        shareFileWithTaskUsers,
        canUploadFiles,
        // Activity Log functions
        fetchActivityLogs,
      }}
    >
      <Toaster
        richColors
        position='top-center'
        expand={true}
        visibleToasts={3}
        toastOptions={{
          duration: 2000,
        }}
      />

      {children}
    </CommonContext.Provider>
  );
};
