import { createContext, useContext, useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useMediaQuery } from 'react-responsive';
import { Toaster, toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  initSocketClient,
  getSocket,
  disconnectSocket,
} from '../utils/socketClient';
import { formatDateAMPMForVN } from '../utils/dateUtils';

// Configure axios defaults
axios.defaults.withCredentials = true; // Include cookies in all requests

export const CommonContext = createContext();

export const useCommon = () => useContext(CommonContext);

export const Common = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
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

  // Enhanced responsive breakpoints
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const isTablet = useMediaQuery({ minWidth: 769, maxWidth: 1024 });
  const isDesktop = useMediaQuery({ minWidth: 1025 });

  // Đổi sang biến env tương ứng (VITE_API_BASE_URL_DEVELOPMENT hoặc VITE_API_BASE_URL_PRODUCTION)
  // và build lại để chạy server frontend trên môi trường dev hoặc production
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL_DEVELOPMENT;
  // const apiBaseUrl = import.meta.env.VITE_API_BASE_URL_PRODUCTION;

  const [calendarUser, setCalendarUser] = useState(null);
  const [showGoogleAuthModal, setShowGoogleAuthModal] = useState(false);
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState(false);

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

  // Tạo ref để track đã thực hiện redirect hay chưa
  const hasRedirected = useRef(false);
  const isProcessingAuth = useRef(false); // Tránh xử lý auth nhiều lần

  // Sửa useEffect để tránh redirect tự động gây conflict với Google callback
  useEffect(() => {
    // Chỉ redirect tự động nếu không phải đang ở Google callback và chưa redirect
    if (
      isAuthenticated &&
      userDataLocal &&
      !location.pathname.includes('/google-callback') &&
      !hasRedirected.current &&
      !isProcessingAuth.current
    ) {
      hasRedirected.current = true;
      navigate('/');
    }
  }, [isAuthenticated, userDataLocal]);

  // Reset redirect flag khi user logout
  useEffect(() => {
    if (!isAuthenticated) {
      hasRedirected.current = false;
      isProcessingAuth.current = false;
    }
  }, [isAuthenticated]);

  //Kiểm tra xem người dùng đã xác thực Google chưa với logic cải thiện
  const checkGoogleAuth = async (force = false) => {
    if (!accessToken || (isCheckingGoogleAuth && !force)) return;

    // Kiểm tra nếu userDataLocal chưa được set và không phải force call
    if (!force && !userDataLocal) {
      console.log('⏳ userDataLocal not set yet, skipping checkGoogleAuth');
      return;
    }

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

      if (response.data.status === 'success') {
        if (response.data.hasValidTokens) {
          // User có tất cả token Google hợp lệ
          console.log('✅ User has all valid Google tokens');
          setIsGoogleAuthenticated(true);
          setShowGoogleAuthModal(false);
        } else if (
          response.data.needsRefresh &&
          response.data.existingTokens > 0
        ) {
          // User có token Google nhưng cần refresh hoặc thêm scopes
          // Đánh dấu là authenticated và không hiện modal vì user đã từng auth Google
          console.log(
            '🔄 User has Google tokens but needs refresh/additional scopes'
          );
          setIsGoogleAuthenticated(true);
          setShowGoogleAuthModal(false);
        } else {
          // Trường hợp có response success nhưng không có valid tokens
          console.log('⚠️ Success response but no valid tokens');
          setIsGoogleAuthenticated(false);

          // Chỉ hiển thị modal nếu user không đăng nhập bằng Google và không có token nào
          const hasExistingTokens = response.data.existingTokens > 0;
          if (!userDataLocal?.googleId && !hasExistingTokens) {
            console.log(
              '🔑 Showing Google auth modal - no tokens and not Google user'
            );
            setShowGoogleAuthModal(true);
          } else {
            console.log('🤝 Not showing auth modal - user has Google history');
            setShowGoogleAuthModal(false);
          }
        }
      } else {
        // Response status không phải success
        console.log('❌ Google auth check failed:', response.data.message);
        setIsGoogleAuthenticated(false);

        // Chỉ hiển thị modal nếu user không đăng nhập bằng Google và không có token nào
        const hasExistingTokens = response.data.existingTokens > 0;
        if (!userDataLocal?.googleId && !hasExistingTokens) {
          console.log(
            '🔑 Showing Google auth modal - check failed and no Google history'
          );
          setShowGoogleAuthModal(true);
        } else {
          console.log(
            '🤝 Not showing auth modal - user has Google account or tokens'
          );
          setShowGoogleAuthModal(false);
        }
      }
    } catch (error) {
      console.error('❌ Error checking Google auth:', error);
      setIsGoogleAuthenticated(false);

      // Xử lý các trường hợp lỗi
      if (error.response?.status === 401) {
        // 401 có thể có nghĩa là user chưa có token hoặc token hết hạn
        console.log('🔐 401 error - checking for existing tokens');
        const errorData = error.response?.data;
        const hasExistingTokens = errorData?.existingTokens > 0;

        if (!userDataLocal?.googleId && !hasExistingTokens) {
          console.log(
            '🔑 Showing Google auth modal - 401 and no Google history'
          );
          setShowGoogleAuthModal(true);
        } else {
          console.log('🤝 Not showing auth modal - user has Google account');
          setShowGoogleAuthModal(false);
        }
      } else {
        // Lỗi khác (network, server error)
        console.log('🚫 Other error, not showing auth modal');
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
      } else {
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.message || 'Login failed');
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

        try {
          const response = await axios.post(
            `https://api.cloudinary.com/v1_1/${
              import.meta.env.VITE_CLOUDINARY_NAME
            }/image/upload`,
            formData
          );
          console.log(
            'VITE_CLOUDINARY_NAME',
            import.meta.env.VITE_CLOUDINARY_NAME
          );
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

    // Gọi checkGoogleAuth ngay lập tức để modal hiển thị ngay
    console.log('🔍 Calling checkGoogleAuth immediately after login');
    try {
      await checkGoogleAuth(true); // Force check even if userDataLocal might not be fully updated in state yet
    } catch (error) {
      console.error('Error checking Google auth immediately:', error);
    }

    // Tải các dữ liệu khác trong background
    setTimeout(async () => {
      try {
        await Promise.all([fetchNotifications(), getCalendarUser()]);
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

    const fetchBoards = async (workspaceId) => {
      setLoading(true);
      setError(null);

      try {
        const res = await axios.get(
          `${apiBaseUrl}/workspace/${workspaceId}/board`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            withCredentials: true, // ← gửi cookie kèm request
          }
        );

        // lấy mảng boards từ payload
        const raw = res.data.boards || [];
        // chuẩn hóa các trường luôn luôn có mảng và có listsCount
        const norm = raw.map((board) => ({
          ...board,
          members: board.members || [],
          tasks: board.tasks || [],
          listsCount: board.listsCount || 0,
        }));

        setBoards(norm);
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    // Chỉ hiển thị toast và navigate nếu không phải Google login
    if (!isGoogleLogin) {
      toast.success('Login successful!');
      navigate('/');
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
    setCalendarUser(null);
    setIsGoogleAuthenticated(false);
    setShowGoogleAuthModal(false);
    setIsCheckingGoogleAuth(false);

    disconnectSocket();
    socketInitialized.current = false;
    setSocketConnected(false);

    navigate('/login');
  };

  // Fetch user profile
  const fetchUserProfile = async () => {
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
  };

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

  // Fetch notifications
  const fetchNotifications = async () => {
    let userId = userDataLocal?.id || userDataLocal?._id;
    if (!accessToken || !userId) return;

    try {
      const response = await axios.get(`${apiBaseUrl}/notification`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });

      if (response.data.status === 'success') {
        const notifs = response.data.data?.notifications || [];
        setNotifications(notifs);
        localStorage.setItem('notifications', JSON.stringify(notifs));
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
      localStorage.removeItem('notifications');
      // toast.error(error.response?.data?.message || 'Lỗi khi tải thông báo');
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
      console.log('📖 Notification already marked as read, skipping request');
      return;
    }

    console.log(`📝 Marking notification ${notificationId} as read...`);

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
        console.log('✅ Notification marked as read successfully');
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
  const respondToEventInvitation = async (eventId, status, notificationId) => {
    let userId = userDataLocal?.id || userDataLocal?._id;
    if (!accessToken || !eventId || !userId) return false;

    try {
      const response = await axios.patch(
        `${apiBaseUrl}/event/${eventId}/participants/${userId}/update-status`,
        { status },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (response.data.status === 200) {
        // Mark notification as read
        await markNotificationAsRead(notificationId);

        toast.success(
          status === 'accepted'
            ? 'Đã chấp nhận lời mời tham gia sự kiện'
            : 'Đã từ chối lời mời tham gia sự kiện'
        );
        return true;
      }
    } catch (error) {
      console.error('❌ Error responding to event invitation:', error);
      toast.error(
        error.response?.data?.message ||
          'Không thể phản hồi lời mời tham gia sự kiện'
      );
      return false;
    }
  };

  // Update event status based on time
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
    let userId = userDataLocal?.id || userDataLocal?._id;
    if (!userId) {
      console.log('⚠️ No user ID available for socket listeners');
      return;
    }

    try {
      const socket = getSocket();
      console.log('🔧 Setting up socket listeners for user:', userId);

      // Remove existing listeners first to avoid duplicates
      socket.off('new_notification');
      socket.off('notification_updated');
      socket.off('connect');
      socket.off('disconnect');
      socket.off('test_pong');

      // Xử lý thông báo mới
      const handleNewNotification = (notification) => {
        setNotifications((prev) => {
          const newNotifications = [
            { ...notification, isRead: false, readAt: null },
            ...prev,
          ];
          localStorage.setItem(
            'notifications',
            JSON.stringify(newNotifications)
          );
          return newNotifications;
        });

        if (
          notification.type === 'event_invitation' ||
          notification.type === 'event_update' ||
          notification.type === 'event_status_update'
        ) {
          {
            toast.info(notification.title, {
              description: notification.content,
              duration: 3000,
            });
          }
        } else {
          toast.success(notification.title, {
            description: notification.content,
            duration: 3000,
          });
        }

        // Nếu là thông báo cập nhật sự kiện, trigger refresh calendar
        if (notification.type === 'event_update') {
          window.dispatchEvent(
            new CustomEvent('eventUpdated', {
              detail: { eventId: notification.eventId },
            })
          );
        }
      };

      // Xử lý cập nhật thông báo
      const handleNotificationUpdate = ({ notificationId, isRead }) => {
        setNotifications((prev) => {
          const updated = prev.map((n) =>
            n.notificationId === notificationId
              ? {
                  ...n,
                  isRead,
                  readAt: isRead ? formatDateAMPMForVN(new Date()) : null,
                }
              : n
          );
          localStorage.setItem('notifications', JSON.stringify(updated));
          return updated;
        });
      };

      // Listen for actual socket connection events
      socket.on('connect', () => {
        console.log('🔗 Socket connected event received');
        setSocketConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('❌ Socket disconnected event received');
        setSocketConnected(false);
      });

      // Test pong listener để verify connection
      socket.on('test_pong', (data) => {
        console.log('🏓 Received test pong from backend:', data);
        // Đảm bảo connection status được update khi nhận được pong
        setSocketConnected(true);
      });

      // Đăng ký listeners
      socket.on('new_notification', handleNewNotification);
      socket.on('notification_updated', handleNotificationUpdate);

      // Check if socket is already connected
      if (socket.connected) {
        console.log('🔗 Socket already connected during setup');
        setSocketConnected(true);
      }

      // Test ping để verify connection
      socket.emit('test_ping', {
        message: 'Hello from frontend',
        userId: userId,
      });

      console.log('✅ Socket listeners registered successfully');
    } catch (error) {
      console.error('❌ Error setting up socket listeners:', error);
      setSocketConnected(false);
    }
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

  // Xử lý xác thực Google
  const handleGoogleAuth = async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/files/get-auth-url`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });

      if (response.data.status === 'success') {
        window.location.href = response.data.data.authUrl; // Redirect đến Google
      }
    } catch (error) {
      toast.error('Lỗi khi khởi tạo xác thực Google');
    }
  };

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
            fetchNotifications(),
            checkGoogleAuth(),
            getCalendarUser(),
          ]);
        } catch (error) {
          console.error('Error loading initial data:', error);
        }
      };

      loadInitialData();
    }
  }, [accessToken, userDataLocal]); // Simplified dependencies

  // Fallback effect to ensure Google auth modal shows for new users
  useEffect(() => {
    if (
      isAuthenticated &&
      userDataLocal &&
      accessToken &&
      !isCheckingGoogleAuth &&
      !isProcessingAuth.current &&
      !isGoogleAuthenticated &&
      !showGoogleAuthModal
    ) {
      console.log('🔄 Fallback: Checking Google auth for modal display');
      const timer = setTimeout(() => {
        checkGoogleAuth();
      }, 2000); // Delay for fallback check

      return () => clearTimeout(timer);
    }
  }, [
    isAuthenticated,
    userDataLocal,
    accessToken,
    isGoogleAuthenticated,
    showGoogleAuthModal,
    isCheckingGoogleAuth,
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
        getCalendarUser,
        calendarUser,
        setCalendarUser,
        showGoogleAuthModal,
        setShowGoogleAuthModal,
        handleGoogleAuth,
        checkGoogleAuth,
        isGoogleAuthenticated,
        isCheckingGoogleAuth,
        isAuthenticated,
        notifications,
        fetchNotifications,
        markNotificationAsRead,
        respondToEventInvitation,
        updateEventStatusByTime,
        formatDateAMPMForVN,
        workspaces,
        createWorkspace,
        updateWorkspace,
        loadingWorkspaces,
        workspacesError,
        currentWorkspaceId,
        setCurrentWorkspaceId,
        boards,
        fetchBoards,
        loadingBoards,
        boardsError,
        socketConnected,
        setupSocketListeners,
        fetchUserProfile,
        updateUserProfile,
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
