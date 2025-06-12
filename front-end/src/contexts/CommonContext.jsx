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

const CommonContext = createContext();

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

  // const { from } = location.state || { from: '/' }; // Nếu không có thông tin from thì mặc định về trang chủ

  // Đổi sang biến env tương ứng (VITE_API_BASE_URL_DEVELOPMENT hoặc VITE_API_BASE_URL_PRODUCTION)
  // và build lại để chạy server frontend trên môi trường dev hoặc production
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL_DEVELOPMENT;
  // const apiBaseUrl = import.meta.env.VITE_API_BASE_URL_PRODUCTION;

  const [calendarUser, setCalendarUser] = useState(null);
  const [showGoogleAuthModal, setShowGoogleAuthModal] = useState(false);
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState(false);

  //workspace
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);
  // state workspace
  const [workspaces, setWorkspaces] = useState([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [workspacesError, setWorkspacesError] = useState(null);

  // state boards
  const [boards, setBoards] = useState([]);
  const [loadingBoards, setLoading] = useState(false);
  const [boardsError, setError] = useState(null);
  const [isCheckingGoogleAuth, setIsCheckingGoogleAuth] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem('accessToken') && !!localStorage.getItem('userData')
  );

  //Kiểm tra xem người dùng đã xác thực Google chưa
  const checkGoogleAuth = async () => {
    if (!accessToken || isCheckingGoogleAuth) return;

    setIsCheckingGoogleAuth(true);
    try {
      const response = await axios.get(
        `${apiBaseUrl}/files/check-google-auth`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );
      console.log('checkgoogleAuth response:', response);

      if (response.data.status === 'success') {
        setIsGoogleAuthenticated(true);
        setShowGoogleAuthModal(false); // Đảm bảo modal không hiển thị
      } else {
        setIsGoogleAuthenticated(false);
        setShowGoogleAuthModal(true); // Hiển thị modal nếu chưa xác thực
      }
    } catch (error) {
      console.error('Error checking Google auth:', error);
      setIsGoogleAuthenticated(false);
      setShowGoogleAuthModal(true); // Hiển thị modal nếu có lỗi hoặc chưa xác thực
    } finally {
      setIsCheckingGoogleAuth(false);
    }
  };

  // Authentication functions
  const login = async (email, password) => {
    try {
      const response = await axios.post(
        `${apiBaseUrl}/login`,
        {
          email,
          password,
        },
        { timeout: 15000 }
      );

      if (response.data.success) {
        const { accessToken, user } = response.data;

        // Save to localStorage
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('userData', JSON.stringify(user));

        // Update state
        setAccessToken(accessToken);
        setUserDataLocal(user);
        setIsAuthenticated(true);

        // Initialize socket connection
        if (user._id) {
          console.log('🔌 Initializing socket for user:', user._id);
          try {
            await initSocketClient(user._id, apiBaseUrl, () => {
              console.log('🎯 Socket connected callback triggered');
              socketInitialized.current = true;
              setupSocketListeners();
            });
            console.log('✅ Socket initialization completed');
          } catch (error) {
            console.error('❌ Socket initialization failed:', error);
            // Continue anyway, socket is not critical for basic functionality
          }
        }

        //Check auth - Fetch data
        await checkGoogleAuth();
        await fetchNotifications();
        await getCalendarUser();

        toast.success('Login successful!');
        navigate('/'); // or wherever your home page is
        return true;
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.message || 'Login failed');
      return false;
    }
  };

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
        { timeout: 15000 }
      );

      if (response.data.status === 'success') {
        const { token, data } = response.data;

        // Save to localStorage
        localStorage.setItem('accessToken', token);
        localStorage.setItem('userData', JSON.stringify(data.user));

        // Update state
        setAccessToken(token);
        setUserDataLocal(data.user);
        setIsAuthenticated(true);

        // Initialize socket connection
        if (data.user._id) {
          console.log('🔌 Initializing socket for user:', data.user._id);
          try {
            await initSocketClient(data.user._id, apiBaseUrl, () => {
              console.log('🎯 Socket connected callback triggered');
              socketInitialized.current = true;
              setupSocketListeners();
            });
            console.log('✅ Socket initialization completed');
          } catch (error) {
            console.error('❌ Socket initialization failed:', error);
            // Continue anyway, socket is not critical for basic functionality
          }
        }

        // Check auth - Fetch data
        await checkGoogleAuth();
        await fetchNotifications();
        await getCalendarUser();

        toast.success('Registration successful!');
        navigate('/');
        return true;
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.response?.data?.message || 'Registration failed');
      return false;
    }
  };

  const logout = () => {
    // Clear localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('notifications');

    // Clear state
    setAccessToken(null);
    setUserDataLocal(null);
    setIsAuthenticated(false);
    setNotifications([]);
    setCalendarUser(null);
    setIsGoogleAuthenticated(false);
    setShowGoogleAuthModal(false);
    setIsCheckingGoogleAuth(false);

    // Disconnect socket if initialized
    disconnectSocket();
    socketInitialized.current = false;
    setSocketConnected(false);

    // Navigate to login
    navigate('/login');
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!accessToken || !userDataLocal?._id) return;

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
        setNotifications((prev) =>
          prev.map((n) =>
            n.notificationId === notificationId
              ? { ...n, isRead: true, readAt: formatDateAMPMForVN(new Date()) }
              : n
          )
        );
        localStorage.setItem('notifications', JSON.stringify(notifications));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // toast.error(
      //   error.response?.data?.message ||
      //     'Không thể đánh dấu thông báo là đã đọc'
      // );
    }
  };

  // Respond to event invitation
  const respondToEventInvitation = async (eventId, status, notificationId) => {
    if (!accessToken || !eventId || !userDataLocal?._id) return false;

    try {
      const response = await axios.patch(
        `${apiBaseUrl}/event/${eventId}/participants/${userDataLocal._id}/update-status`,
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
      console.error('Error responding to event invitation:', error);
      toast.error(
        error.response?.data?.message ||
          'Không thể phản hồi lời mời tham gia sự kiện'
      );
      return false;
    }
  };

  // Setup socket listeners
  const setupSocketListeners = () => {
    if (!userDataLocal?._id) {
      console.log('⚠️ No user ID available for socket listeners');
      return;
    }

    try {
      const socket = getSocket();
      console.log(
        '🔧 Setting up socket listeners for user:',
        userDataLocal._id
      );

      // Remove existing listeners first to avoid duplicates
      socket.off('new_notification');
      socket.off('notification_updated');

      // Xử lý thông báo mới
      const handleNewNotification = (notification) => {
        console.log('🔔 Received new notification:', notification);

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

        console.log(
          '✅ Toast shown for:',
          notification.title,
          notification.content
        );

        // Nếu là thông báo cập nhật sự kiện, trigger refresh calendar
        if (notification.type === 'event_update') {
          console.log(
            '📅 Received event update notification, triggering refresh...'
          );
          window.dispatchEvent(
            new CustomEvent('eventUpdated', {
              detail: { eventId: notification.eventId },
            })
          );
        }
      };

      // Xử lý cập nhật thông báo
      const handleNotificationUpdate = ({ notificationId, isRead }) => {
        console.log(
          '🔄 Updating notification:',
          notificationId,
          'isRead:',
          isRead
        );

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

      // Test listener để verify socket hoạt động
      socket.on('connect', () => {
        console.log('🔗 Socket connected in listeners setup');
      });

      socket.on('disconnect', () => {
        console.log('❌ Socket disconnected');
        setSocketConnected(false);
      });

      // Test pong listener để verify connection
      socket.on('test_pong', (data) => {
        console.log('🏓 Received test pong from backend:', data);
      });

      // Đăng ký listeners
      socket.on('new_notification', handleNewNotification);
      socket.on('notification_updated', handleNotificationUpdate);

      // Test ping để verify connection
      socket.emit('test_ping', {
        message: 'Hello from frontend',
        userId: userDataLocal._id,
      });

      console.log('✅ Socket listeners registered successfully');
      setSocketConnected(true);
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
      console.log('Lấy lịch user:', response.data);
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
      console.log('get google auth url response:', response);

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

  // 1. Effect để fetch workspaces
  useEffect(() => {
    const fetchWorkspaces = async () => {
      if (!accessToken) {
        setLoadingWorkspaces(false);
        return;
      }
      try {
        const res = await axios.get(`${apiBaseUrl}/workspace`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        // Giả sử API trả { workspaces: [...] }
        setWorkspaces(res.data.data || []);
      } catch (err) {
        setWorkspacesError(err.response?.data?.message || err.message);
      } finally {
        setLoadingWorkspaces(false);
      }
    };

    fetchWorkspaces();
  }, [apiBaseUrl, accessToken]);

  // 2. Hàm hỗ trợ navigate tới form tạo workspace
  const navigateToCreateWorkspace = () => {
    navigate('/workspace/create');
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
    if (
      isAuthenticated &&
      userDataLocal?._id &&
      socketInitialized.current &&
      !socketConnected
    ) {
      console.log('🔄 Setting up socket listeners for existing connection');
      setupSocketListeners();
    }
  }, [isAuthenticated, userDataLocal?._id, socketConnected]);

  // Lưu thông báo vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem('notifications', JSON.stringify(notifications));
    } catch (error) {
      console.error('Error saving notifications to localStorage:', error);
    }
  }, [notifications]);

  // Initialize socket khi user đã login (for page reload)
  useEffect(() => {
    if (accessToken && userDataLocal?._id && !socketInitialized.current) {
      console.log('🔄 Reinitializing socket after page reload');
      const initSocket = async () => {
        try {
          await initSocketClient(userDataLocal._id, apiBaseUrl, () => {
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
  }, [accessToken, userDataLocal]);

  // Tải dữ liệu ban đầu sau khi có userDataLocal
  useEffect(() => {
    if (accessToken && userDataLocal?._id && !isCheckingGoogleAuth) {
      fetchNotifications();
      checkGoogleAuth();
      getCalendarUser();
    }
  }, [accessToken, userDataLocal]);

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
        createInitialCalendar,
        getCalendarUser,
        calendarUser,
        setCalendarUser,
        showGoogleAuthModal,
        setShowGoogleAuthModal,
        handleGoogleAuth,
        isGoogleAuthenticated,
        isCheckingGoogleAuth,
        isAuthenticated,
        notifications,
        fetchNotifications,
        markNotificationAsRead,
        respondToEventInvitation,
        formatDateAMPMForVN,
        workspaces,
        loadingWorkspaces,
        workspacesError,
        currentWorkspaceId,
        setCurrentWorkspaceId,
        navigateToCreateWorkspace,
        boards,
        fetchBoards,
        loadingBoards,
        boardsError,
        socketConnected,
        setupSocketListeners,
      }}
    >
      <Toaster
        richColors
        position='top-center'
        expand={true}
        visibleToasts={5}
        toastOptions={{
          duration: 2000,
        }}
      />

      {children}
    </CommonContext.Provider>
  );
};
