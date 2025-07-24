import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Container,
  Row,
  Col,
  Modal,
  Button,
  Badge,
  Form,
  Spinner,
} from 'react-bootstrap';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaUser,
  FaEdit,
  FaTrash,
  FaTimes,
  FaPlus,
  FaCalendarCheck,
  FaPaperPlane,
  FaComments,
  FaChevronUp,
  FaSun,
  FaCloudSun,
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useCommon } from '../../contexts/CommonContext';
import axios from 'axios';
import debounce from 'lodash/debounce';
import '../../styles/calendar.css';
import moment from 'moment';

// Hàm chuyển đổi ngày giờ sang định dạng ISO cho backend
const toISODateTime = (dateTime) => {
  if (!dateTime) return new Date().toISOString();
  return new Date(dateTime).toISOString();
};

// Hàm chuyển đổi từ UTC sang local datetime cho input
const toLocalDateTime = (dateTime) => {
  if (!dateTime) return '';
  const date = new Date(dateTime);
  // Chuyển sang múi giờ địa phương và format cho datetime-local input
  const offset = date.getTimezoneOffset() * 60000; // offset tính bằng milliseconds
  const localTime = new Date(date.getTime() - offset);
  return localTime.toISOString().slice(0, 16); // Cắt để lấy format YYYY-MM-DDTHH:mm
};

// Hàm chuyển đổi từ local datetime input sang UTC
const fromLocalDateTime = (localDateTime) => {
  if (!localDateTime) return new Date().toISOString();
  // Input datetime-local đã ở múi giờ địa phương, chỉ cần convert sang ISO
  return new Date(localDateTime).toISOString();
};

// Helper function để tạo Google Maps URL
const generateMapsUrl = (address) => {
  if (!address) return null;

  // Nếu address là object với coordinates (từ geocoding)
  if (
    typeof address === 'object' &&
    address?.coordinates &&
    Array.isArray(address.coordinates)
  ) {
    const [lng, lat] = address.coordinates;
    if (lat && lng) {
      // Sử dụng place ID nếu có (chính xác nhất)
      if (address.placeId) {
        return `https://www.google.com/maps/place/?q=place_id:${address.placeId}`;
      }
      // Fallback về coordinates
      return `https://www.google.com/maps?q=${lat},${lng}`;
    }
  }

  // Fallback: search bằng địa chỉ text
  const searchQuery =
    typeof address === 'string' ? address : address?.formattedAddress;

  if (searchQuery) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      searchQuery
    )}`;
  }

  return null;
};

// Helper function để safely extract address data
const getAddressDisplay = (address) => {
  if (!address) return '';

  if (typeof address === 'string') {
    return address;
  }

  if (typeof address === 'object') {
    return address.formattedAddress || address.address || '';
  }

  return '';
};

// Helper function để lấy thời gian hiện tại theo múi giờ Việt Nam
const getCurrentVietnamTime = () => {
  const now = new Date();
  // Múi giờ Việt Nam là UTC+7
  const vietnamOffset = 7 * 60; // 7 hours in minutes
  const currentOffset = now.getTimezoneOffset(); // Current timezone offset in minutes from UTC
  const vietnamTime = new Date(
    now.getTime() + (vietnamOffset + currentOffset) * 60 * 1000
  );
  return vietnamTime;
};

// Helper function để format thời gian Việt Nam cho datetime-local input
const formatVietnamTimeForInput = (forDateOnly = false) => {
  const vietnamTime = getCurrentVietnamTime();
  if (forDateOnly) {
    return vietnamTime.toISOString().split('T')[0];
  }
  return vietnamTime.toISOString().slice(0, 16);
};

const Calendar = () => {
  const {
    accessToken,
    apiBaseUrl,
    toast,
    isMobile,
    isTablet,
    isDesktop,
    navigate,
    userDataLocal,
    calendarUser,
    getCalendarUser,
    updateAllUserEventsStatusByTime,
    updateEventStatusByTime,
    cancelEventParticipation,
    respondToEventInvitation,
    sendEventMessage,
    getEventMessages,
    loadMoreEventMessages,
    editEventMessage,
    deleteEventMessage,
    findAvailableTimeSlots,
  } = useCommon();

  // Thêm ref cho FullCalendar
  const calendarRef = useRef(null);

  // State quản lý
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [calendarView, setCalendarView] = useState('dayGridMonth');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: toLocalDateTime(new Date()), // Use local datetime
    endDate: toLocalDateTime(new Date()),
    type: 'offline',
    address: '',
    status: 'scheduled',
    participantEmails: '', // Email string separated by commas
    allDay: false,
    recurrence: '',
  });
  const [editFormData, setEditFormData] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [isUpdatingEvent, setIsUpdatingEvent] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedEventForCancel, setSelectedEventForCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictEventData, setConflictEventData] = useState(null);
  const [showCreateConflictModal, setShowCreateConflictModal] = useState(false);
  const [createConflictData, setCreateConflictData] = useState(null);

  // Enhanced conflict handling states
  const [showMainConflictModal, setShowMainConflictModal] = useState(false);
  const [mainConflictData, setMainConflictData] = useState(null);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Chat states
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [hasMessagesInEvent, setHasMessagesInEvent] = useState(false);
  const [isCheckingMessages, setIsCheckingMessages] = useState(false);
  const messagesEndRef = useRef(null);

  // Infinite scroll states
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [messagePagination, setMessagePagination] = useState({});
  const messagesContainerRef = useRef(null);

  // Get current user ID
  const currentUserId = userDataLocal?._id || userDataLocal?.id;

  // Định nghĩa eventTypes
  const eventTypes = useMemo(
    () => ({
      online: {
        label: 'Online',
        color: '#2196F3',
        icon: '🌐',
        description: 'Online event',
      },
      offline: {
        label: 'Offline',
        color: '#4CAF50',
        icon: '📍',
        description: 'Event at a specific location',
      },
    }),
    []
  );

  // Định nghĩa statusOptions
  const statusOptions = useMemo(
    () => [
      { value: 'draft', label: 'Draft' },
      { value: 'scheduled', label: 'Not started' },
      { value: 'in-progress', label: 'In progress' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
    []
  );

  // Định nghĩa recurrenceOptions
  const recurrenceOptions = useMemo(
    () => [
      { value: 'custom', label: 'No repeat' },
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'yearly', label: 'Yearly' },
    ],
    []
  );

  // Hàm định dạng ngày giờ
  const formatEventDate = useCallback((date) => {
    if (!(date instanceof Date) || isNaN(date)) return '';
    return new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(date);
  }, []);

  // Hàm định dạng ngày cho allDay events
  const formatAllDayEventDate = useCallback((date) => {
    if (!(date instanceof Date) || isNaN(date)) return '';
    return new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(date);
  }, []);

  // Hàm định dạng thời gian cho conflict display
  const formatConflictEventTime = useCallback(
    (event) => {
      if (event.allDay) {
        return `All day ${formatAllDayEventDate(new Date(event.startDate))}`;
      } else {
        return `${formatEventDate(
          new Date(event.startDate)
        )} - ${formatEventDate(new Date(event.endDate))}`;
      }
    },
    [formatEventDate, formatAllDayEventDate]
  );

  // Lấy danh sách sự kiện
  const debouncedFetchEvents = useCallback(
    debounce(async (start, end) => {
      if (!accessToken || !calendarUser?._id || !start || !end) {
        console.warn('Thiếu tham số để lấy sự kiện:', {
          accessToken: !!accessToken,
          calendarId: calendarUser?._id,
          start,
          end,
        });
        return;
      }

      try {
        setIsLoading(true);

        // Fetch events từ lịch của mình
        const ownEventsResponse = await axios.get(
          `${apiBaseUrl}/calendar/${
            calendarUser._id
          }/events?startDate=${start.toISOString()}&endDate=${end.toISOString()}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        // Fetch events mà mình đã tham gia từ lịch của người khác
        const participatedEventsResponse = await axios.get(
          `${apiBaseUrl}/event/participated?startDate=${start.toISOString()}&endDate=${end.toISOString()}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        const ownEvents =
          ownEventsResponse.data.status === 200
            ? ownEventsResponse.data.data
            : [];
        const participatedEvents =
          participatedEventsResponse.data.status === 200
            ? participatedEventsResponse.data.data
            : [];

        // Format own events
        const formattedOwnEvents = ownEvents.map((event) => {
          const status = event.extendedProps?.status;
          const canEdit = status === 'draft' || status === 'scheduled';

          return {
            id: event.id,
            title: event.title,
            start: new Date(event.start),
            end: event.end ? new Date(event.end) : null,
            allDay: event.allDay || false,
            backgroundColor:
              eventTypes[event.extendedProps.type]?.color || '#4CAF50',
            borderColor:
              eventTypes[event.extendedProps.type]?.color || '#4CAF50',
            textColor: '#ffffff',
            // Disable drag/edit for events that can't be edited
            startEditable: canEdit,
            durationEditable: canEdit,
            resourceEditable: canEdit,
            extendedProps: {
              ...event.extendedProps,
              isOwn: true, // Đánh dấu là sự kiện của mình
              canEdit: canEdit,
            },
          };
        });

        // Format participated events
        const formattedParticipatedEvents = participatedEvents.map((event) => ({
          id: event.id,
          title: event.title,
          start: new Date(event.start),
          end: event.end ? new Date(event.end) : null,
          allDay: event.allDay || false,
          backgroundColor: event.backgroundColor || '#6c757d',
          borderColor: event.borderColor || '#6c757d',
          textColor: '#ffffff',
          extendedProps: {
            ...event.extendedProps,
            isOwn: false, // Đánh dấu là sự kiện tham gia
          },
        }));

        // Merge cả 2 loại events
        const allEvents = [
          ...formattedOwnEvents,
          ...formattedParticipatedEvents,
        ];

        setEvents(allEvents);
      } catch (error) {
        console.error(
          'Lỗi lấy sự kiện:',
          error.response?.data || error.message
        );
        toast.error(error.response?.data?.message || 'Failed to load event');
        setEvents([]);
        setFilteredEvents([]);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    [accessToken, apiBaseUrl, toast, calendarUser, eventTypes]
  );

  // Lắng nghe event update từ notifications
  useEffect(() => {
    const handleEventUpdated = (e) => {
      // Refresh events khi có sự kiện được cập nhật
      if (dateRange.start && dateRange.end) {
        debouncedFetchEvents(dateRange.start, dateRange.end, searchTerm);
      }
    };

    const handleEventConflict = (e) => {
      const { eventId, notificationId, conflictData } = e.detail;
      setConflictEventData({
        eventId,
        notificationId,
        ...conflictData,
      });
      setShowConflictModal(true);
    };

    // Listen for real-time event status updates from scheduled jobs
    const handleEventsStatusUpdated = (data) => {
      console.log(
        `📅 Received event status updates: ${data.updatedCount} events updated`
      );
      // Refresh calendar if there are updates
      if (data.updatedCount > 0 && dateRange.start && dateRange.end) {
        debouncedFetchEvents(dateRange.start, dateRange.end, searchTerm);
      }
    };

    const handleEventStatusUpdated = (data) => {
      // Refresh calendar
      if (dateRange.start && dateRange.end) {
        debouncedFetchEvents(dateRange.start, dateRange.end, searchTerm);
      }
    };

    const handleEventsStatusUpdatedScheduled = (data) => {
      // Refresh calendar if there are updates
      if (data.updatedCount > 0 && dateRange.start && dateRange.end) {
        debouncedFetchEvents(dateRange.start, dateRange.end, searchTerm);
      }
    };

    window.addEventListener('eventUpdated', handleEventUpdated);
    window.addEventListener('eventConflict', handleEventConflict);

    // Add socket event listeners
    const socket = window.socket;
    if (socket) {
      socket.on('events_status_updated', handleEventsStatusUpdated);
      socket.on('event_status_updated', handleEventStatusUpdated);
      socket.on(
        'events_status_updated_scheduled',
        handleEventsStatusUpdatedScheduled
      );
    }

    return () => {
      window.removeEventListener('eventUpdated', handleEventUpdated);
      window.removeEventListener('eventConflict', handleEventConflict);

      // Remove socket event listeners
      if (socket) {
        socket.off('events_status_updated', handleEventsStatusUpdated);
        socket.off('event_status_updated', handleEventStatusUpdated);
        socket.off(
          'events_status_updated_scheduled',
          handleEventsStatusUpdatedScheduled
        );
      }
    };
  }, [debouncedFetchEvents, dateRange, searchTerm]);

  // Đồng bộ filteredEvents với events
  useEffect(() => {
    setFilteredEvents(events);
  }, [events]);

  // Handle real-time message events
  useEffect(() => {
    const handleNewMessage = (e) => {
      const { eventId, message } = e.detail;

      if (selectedEvent?.id === eventId) {
        setMessages((prev) => {
          // Check if message already exists to prevent duplicates
          const messageExists = prev.some((msg) => msg._id === message._id);
          if (messageExists) {
            return prev;
          }

          // Add new message at the end (newest messages at bottom)
          const newState = [...prev, message];

          return newState;
        });

        // Update hasMessagesInEvent since we received a new message
        setHasMessagesInEvent(true);

        // Update pagination count
        setMessagePagination((prev) => ({
          ...prev,
          total: (prev.total || 0) + 1,
        }));

        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    };

    const handleDeleteMessage = (e) => {
      const { eventId, messageId } = e.detail;
      if (selectedEvent?.id === eventId) {
        setMessages((prev) => {
          const filteredMessages = prev.filter((msg) => msg._id !== messageId);

          // Update hasMessagesInEvent based on remaining messages
          setHasMessagesInEvent(filteredMessages.length > 0);

          return filteredMessages;
        });

        // Update pagination count
        setMessagePagination((prev) => ({
          ...prev,
          total: Math.max((prev.total || 0) - 1, 0),
        }));
      }
    };

    const handleEditMessage = (e) => {
      const { eventId, message } = e.detail;
      if (selectedEvent?.id === eventId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === message._id ? { ...msg, ...message } : msg
          )
        );
      }
    };

    window.addEventListener('new_event_message', handleNewMessage);
    window.addEventListener('delete_event_message', handleDeleteMessage);
    window.addEventListener('edit_event_message', handleEditMessage);

    return () => {
      window.removeEventListener('new_event_message', handleNewMessage);
      window.removeEventListener('delete_event_message', handleDeleteMessage);
      window.removeEventListener('edit_event_message', handleEditMessage);
    };
  }, [selectedEvent?.id]);

  // Check if event has messages when selectedEvent changes
  useEffect(() => {
    if (selectedEvent?.id && shouldShowChatFeature(selectedEvent)) {
      checkEventMessages(selectedEvent.id);
    } else {
      setHasMessagesInEvent(false);
      setIsCheckingMessages(false);
    }
  }, [selectedEvent?.id]);

  // Load messages when showing chat
  useEffect(() => {
    if (showChat && selectedEvent?.id) {
      loadEventMessages(selectedEvent.id);
    }
  }, [showChat, selectedEvent?.id]);

  // Infinite scroll handler
  useEffect(() => {
    const handleScroll = () => {
      const container = messagesContainerRef.current;
      if (!container || isLoadingMoreMessages || !hasMoreMessages) return;

      // Load more when user scrolls near the top (within 50px)
      if (container.scrollTop <= 50) {
        loadMoreMessages();
      }
    };

    const container = messagesContainerRef.current;
    if (container && showChat) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [showChat, isLoadingMoreMessages, hasMoreMessages]);

  // Reset chat when modal closes and manage body scroll
  useEffect(() => {
    if (showEventModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      setShowChat(false);
      setMessages([]);
      setNewMessage('');
      setEditingMessageId(null);
      setEditingContent('');
      setContextMenu(null);
      setHasMessagesInEvent(false);
      setIsCheckingMessages(false);
      // Reset infinite scroll states
      setIsLoadingMoreMessages(false);
      setHasMoreMessages(true);
      setMessagePagination({});
    }

    // Cleanup function để đảm bảo body được reset khi component unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showEventModal]);

  // Close message actions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside context menu
      const isClickInsideMenu = event.target.closest('.messenger-context-menu');

      if (!isClickInsideMenu && contextMenu) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      // Add a small delay to prevent immediate closing when opening the menu
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside, true);
      }, 10);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside, true);
      };
    }
  }, [contextMenu]);

  // Khởi tạo lấy sự kiện và cập nhật trạng thái
  useEffect(() => {
    let userId = userDataLocal?.id || userDataLocal?._id;
    if (!accessToken || !userId) {
      navigate('/login');
      return;
    }

    if (!calendarUser?._id) {
      getCalendarUser();
    } else {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setDateRange({ start, end });

      // Cập nhật trạng thái tất cả sự kiện trước khi fetch
      const initializeCalendar = async () => {
        try {
          const statusUpdate = await updateAllUserEventsStatusByTime();
          if (statusUpdate && statusUpdate.updatedEvents > 0) {
            console.log(
              `✅ Updated ${statusUpdate.updatedEvents} events status on calendar load`
            );
          }
        } catch (error) {
          console.warn(
            'Failed to update events status on calendar load:',
            error
          );
        } finally {
          // Luôn fetch events dù cập nhật status có thành công hay không
          debouncedFetchEvents(start, end, searchTerm);
        }
      };

      initializeCalendar();
    }

    return () => debouncedFetchEvents.cancel();
  }, [
    accessToken,
    userDataLocal,
    calendarUser,
    getCalendarUser,
    debouncedFetchEvents,
    updateAllUserEventsStatusByTime,
  ]);

  // Periodic status update - cập nhật trạng thái định kỳ mỗi 5 phút
  useEffect(() => {
    if (!accessToken || !calendarUser?._id) return;

    const intervalId = setInterval(async () => {
      try {
        const statusUpdate = await updateAllUserEventsStatusByTime();
        if (statusUpdate && statusUpdate.updatedEvents > 0) {
          console.log(
            `✅ Periodic update: Updated ${statusUpdate.updatedEvents} events status`
          );
          // Refresh events nếu có cập nhật
          if (dateRange.start && dateRange.end) {
            debouncedFetchEvents(dateRange.start, dateRange.end, searchTerm);
          }
        }
      } catch (error) {
        console.warn('Failed to periodic update events status:', error);
      }
    }, 5 * 60 * 1000); // 5 phút

    return () => clearInterval(intervalId);
  }, [
    accessToken,
    calendarUser,
    dateRange,
    debouncedFetchEvents,
    updateAllUserEventsStatusByTime,
  ]);

  // Xử lý thay đổi khoảng ngày
  const handleDatesSet = useCallback(
    (arg) => {
      setDateRange({ start: arg.start, end: arg.end });

      // Chỉ cập nhật selectedDate nếu nó nằm ngoài view hiện tại
      if (selectedDate < arg.start || selectedDate >= arg.end) {
        setSelectedDate(new Date(arg.start));
      }

      debouncedFetchEvents(arg.start, arg.end, searchTerm);
    },
    [debouncedFetchEvents, searchTerm, selectedDate]
  );

  // Xử lý tìm kiếm
  const handleSearchChange = useCallback(
    (e) => {
      const query = e.target.value;
      setSearchTerm(query);
      if (dateRange.start && dateRange.end) {
        debouncedFetchEvents(dateRange.start, dateRange.end, query);
      }
    },
    [debouncedFetchEvents, dateRange]
  );

  // Xử lý click ngày
  const handleDateClick = useCallback(
    (arg) => {
      const clickedDate = new Date(arg.dateStr);
      const localDateStr = toLocalDateTime(clickedDate);

      // Cập nhật ngày được chọn
      setSelectedDate(clickedDate);

      // Cập nhật form data cho việc tạo sự kiện mới
      setFormData((prev) => ({
        ...prev,
        startDate: localDateStr,
        endDate: localDateStr,
      }));
    },
    [events]
  );

  // Xử lý click sự kiện
  const handleEventClick = useCallback(
    async (eventInfo) => {
      const event = {
        id: eventInfo.event.id,
        title: eventInfo.event.title,
        start: new Date(eventInfo.event.start),
        end: eventInfo.event.end ? new Date(eventInfo.event.end) : null,
        allDay: eventInfo.event.allDay,
        type: eventInfo.event.extendedProps.type,
        description: eventInfo.event.extendedProps.description,
        address: eventInfo.event.extendedProps.address,
        onlineUrl: eventInfo.event.extendedProps.onlineUrl,
        meetingCode: eventInfo.event.extendedProps.meetingCode,
        organizer: eventInfo.event.extendedProps.organizer,
        participants: eventInfo.event.extendedProps.participants,
        status: eventInfo.event.extendedProps.status,
        recurrence: eventInfo.event.extendedProps.rrule,
      };

      // Cập nhật trạng thái dựa trên thời gian trước khi hiển thị modal
      try {
        const statusUpdate = await updateEventStatusByTime(event.id);
        if (statusUpdate && statusUpdate.updated) {
          // Cập nhật status trong event object
          event.status = statusUpdate.newStatus;

          // Refresh events để cập nhật UI
          if (dateRange.start && dateRange.end) {
            debouncedFetchEvents(dateRange.start, dateRange.end, searchTerm);
          }
        }
      } catch (error) {
        console.warn('Failed to update event status by time:', error);
        // Tiếp tục hiển thị modal ngay cả khi cập nhật status thất bại
      }

      setSelectedEvent(event);
      setShowEventModal(true);
    },
    [updateEventStatusByTime, dateRange, debouncedFetchEvents, searchTerm]
  );

  // Xử lý kéo thả sự kiện
  const handleEventDrop = useCallback(
    async (dropInfo) => {
      let userId = userDataLocal?.id || userDataLocal?._id;
      const { event } = dropInfo;

      // Kiểm tra quyền chỉnh sửa dựa trên status
      const eventStatus = event.extendedProps?.status;
      const isOrganizer = event.extendedProps?.organizer?.userId === userId;

      if (
        !isOrganizer ||
        (eventStatus !== 'draft' && eventStatus !== 'scheduled')
      ) {
        dropInfo.revert();
        toast.error('Cannot move this event due to its current status');
        return;
      }

      const newStart = toISODateTime(event.start);
      const newEnd = event.end ? toISODateTime(event.end) : null;

      try {
        const response = await axios.patch(
          `${apiBaseUrl}/event/${event.id}`,
          { startDate: newStart, endDate: newEnd },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (response.data.status === 200) {
          toast.success('Event time updated successfully');
          debouncedFetchEvents(dateRange.start, dateRange.end, searchTerm);
        }
      } catch (error) {
        dropInfo.revert();
        toast.error(error.response?.data?.message || 'Failed to update event');
      }
    },
    [
      apiBaseUrl,
      accessToken,
      toast,
      debouncedFetchEvents,
      dateRange,
      searchTerm,
      userDataLocal,
    ]
  );

  // Xử lý click nút "Today"
  const handleTodayClick = useCallback(() => {
    const calendarApi = calendarRef.current.getApi();
    const now = new Date();
    calendarApi.gotoDate(now); // Chuyển đến ngày hiện tại
    if (calendarView === 'timeGridDay') {
      const currentHour = now.getHours().toString().padStart(2, '0') + ':00';
      calendarApi.scrollToTime(currentHour); // Focus vào giờ hiện tại
    }

    // Cập nhật ngày được chọn là hôm nay
    setSelectedDate(now);

    // Fetch events nếu cần
    debouncedFetchEvents(
      now,
      new Date(now.getFullYear(), now.getMonth() + 1, 0),
      searchTerm
    );
  }, [calendarView, debouncedFetchEvents, searchTerm]);

  // Cập nhật view khi thay đổi
  const handleViewChange = useCallback((view) => {
    setCalendarView(view);
  }, []);

  // Xử lý mở form tạo sự kiện
  const handleCreateClick = useCallback(() => {
    const localDateStr = toLocalDateTime(selectedDate);
    setFormData({
      title: '',
      description: '',
      startDate: localDateStr,
      endDate: localDateStr,
      type: 'offline',
      address: '',
      status: 'scheduled',
      participantEmails: '',
      allDay: false,
      recurrence: '',
    });
    setShowCreateModal(true);
  }, [selectedDate]);

  // Xử lý mở form chỉnh sửa
  const handleEditClick = useCallback(() => {
    if (!selectedEvent) return;
    setEditFormData({
      title: selectedEvent.title,
      description: selectedEvent.description || '',
      startDate: toLocalDateTime(selectedEvent.start),
      endDate: selectedEvent.end
        ? toLocalDateTime(selectedEvent.end)
        : toLocalDateTime(selectedEvent.start),
      type: selectedEvent.type || 'offline',
      address:
        typeof selectedEvent.address === 'string'
          ? selectedEvent.address
          : selectedEvent.address?.formattedAddress || '',
      status: selectedEvent.status || 'scheduled',
      participantEmails: '', // Luôn để trống để chỉ thêm participants mới
      allDay: selectedEvent.allDay || false,
      recurrence: selectedEvent.recurrence || '',
    });
    setShowEventModal(false);
    setShowEditModal(true);
  }, [selectedEvent]);

  // Xử lý tạo sự kiện
  const handleCreateSubmit = useCallback(
    async (e, forceCreate = false) => {
      e.preventDefault();
      if (!formData.title.trim()) {
        toast.error('Please enter event title');
        return;
      }

      const vietnamNow = getCurrentVietnamTime();
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);

      // Kiểm tra startDate không được trong quá khứ (theo múi giờ Việt Nam)
      if (!formData.allDay && startDate < vietnamNow) {
        toast.error('Start time cannot be in the past');
        return;
      }

      // Kiểm tra endDate không được trong quá khứ (theo múi giờ Việt Nam)
      if (!formData.allDay && endDate < vietnamNow) {
        toast.error('End time cannot be in the past');
        return;
      }

      // Chỉ validate date khi không phải sự kiện cả ngày
      if (!formData.allDay && startDate > endDate) {
        toast.error('End time must be after start time');
        return;
      }

      try {
        setIsCreatingEvent(true);
        let userId = userDataLocal?.id || userDataLocal?._id;

        const payload = {
          calendarId: calendarUser._id,
          title: formData.title,
          description: formData.description || undefined,
          startDate: fromLocalDateTime(formData.startDate),
          endDate: fromLocalDateTime(formData.endDate),
          type: formData.type,
          organizer: userId,
          address: formData.address || undefined,
          status: 'scheduled',
          participantEmails: formData.participantEmails
            ? formData.participantEmails
                .split(',')
                .map((email) => email.trim())
                .filter((email) => email.length > 0)
            : undefined,
          allDay: formData.allDay,
          recurrence: formData.recurrence
            ? { type: formData.recurrence, interval: 1 }
            : undefined,
          forceCreate: forceCreate, // Thêm flag để bypass conflict check
        };

        const response = await axios.post(
          `${apiBaseUrl}/event/create-event-for-calendar/${calendarUser._id}`,
          payload,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (response.data.status === 201) {
          toast.success('Event added successfully');
          setShowCreateModal(false);
          setShowCreateConflictModal(false); // Đóng conflict modal nếu đang mở
          setCreateConflictData(null); // Clear conflict data
          debouncedFetchEvents(dateRange.start, dateRange.end, searchTerm);
          setFormData({
            title: '',
            description: '',
            startDate: toLocalDateTime(new Date()),
            endDate: toLocalDateTime(new Date()),
            type: 'offline',
            address: '',
            status: 'scheduled',
            participantEmails: '',
            allDay: false,
            recurrence: '',
          });
        }
      } catch (error) {
        console.error(
          'Lỗi tạo sự kiện:',
          error.response?.data || error.message
        );

        // Handle conflict case - use new enhanced modal
        if (
          error.response?.status === 409 &&
          error.response?.data?.hasConflict
        ) {
          setMainConflictData({
            ...error.response.data,
            formData: formData, // Store form data to reuse
          });
          setShowMainConflictModal(true);
          return; // Don't show error toast, show conflict modal instead
        }

        toast.error(error.response?.data?.message || 'Failed to add event');
      } finally {
        setIsCreatingEvent(false);
      }
    },
    [
      formData,
      apiBaseUrl,
      accessToken,
      toast,
      debouncedFetchEvents,
      dateRange,
      searchTerm,
      calendarUser,
      userDataLocal,
    ]
  );

  // Xử lý chỉnh sửa sự kiện
  const handleEditSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!editFormData.title?.trim()) {
        toast.error('Please enter event title');
        return;
      }

      const vietnamNow = getCurrentVietnamTime();
      const startDate = new Date(editFormData.startDate);
      const endDate = new Date(editFormData.endDate);

      // Kiểm tra startDate không được trong quá khứ (theo múi giờ Việt Nam)
      if (startDate < vietnamNow) {
        toast.error('Start time cannot be in the past');
        return;
      }

      // Kiểm tra endDate không được trong quá khứ (theo múi giờ Việt Nam)
      if (endDate < vietnamNow) {
        toast.error('End time cannot be in the past');
        return;
      }

      // Chỉ validate date khi không phải sự kiện cả ngày
      if (!editFormData.allDay && startDate > endDate) {
        toast.error('End time must be after start time');
        return;
      }

      try {
        setIsUpdatingEvent(true);
        // Chỉ gửi những field đã được thay đổi
        const payload = {
          title: editFormData.title,
          description: editFormData.description || undefined,
          type: editFormData.type,
          address: editFormData.address || undefined,
          status: 'scheduled',
          participantEmails: editFormData.participantEmails
            ? editFormData.participantEmails
                .split(',')
                .map((email) => email.trim())
                .filter((email) => email.length > 0)
            : undefined,
          allDay: editFormData.allDay,
          recurrence: editFormData.recurrence
            ? { type: editFormData.recurrence, interval: 1 }
            : undefined,
        };

        // Chỉ thêm startDate và endDate nếu chúng đã được thay đổi
        const originalStartDate = toLocalDateTime(selectedEvent.start);
        const originalEndDate = selectedEvent.end
          ? toLocalDateTime(selectedEvent.end)
          : toLocalDateTime(selectedEvent.start);

        if (editFormData.startDate !== originalStartDate) {
          payload.startDate = fromLocalDateTime(editFormData.startDate);
        }

        if (editFormData.endDate !== originalEndDate) {
          payload.endDate = fromLocalDateTime(editFormData.endDate);
        }

        const response = await axios.patch(
          `${apiBaseUrl}/event/${selectedEvent.id}`,
          payload,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (response.data.status === 200) {
          toast.success('Event updated successfully');
          setShowEditModal(false);
          debouncedFetchEvents(dateRange.start, dateRange.end, searchTerm);
        }
      } catch (error) {
        console.error(
          'Lỗi cập nhật sự kiện:',
          error.response?.data || error.message
        );
        toast.error(error.response?.data?.message || 'Failed to update event');
      } finally {
        setIsUpdatingEvent(false);
      }
    },
    [
      editFormData,
      selectedEvent,
      apiBaseUrl,
      accessToken,
      toast,
      debouncedFetchEvents,
      dateRange,
      searchTerm,
    ]
  );

  // Xử lý xóa sự kiện
  const handleDeleteEvent = useCallback(async () => {
    if (!selectedEvent?.id) return;
    try {
      const response = await axios.delete(
        `${apiBaseUrl}/event/${selectedEvent.id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (response.data.status === 200) {
        toast.success('Event deleted successfully');
        setShowEventModal(false);
        setShowDeleteModal(false);
        debouncedFetchEvents(dateRange.start, dateRange.end, searchTerm);
      }
    } catch (error) {
      console.error('Lỗi xóa sự kiện:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Failed to delete event');
    }
  }, [
    selectedEvent,
    apiBaseUrl,
    accessToken,
    toast,
    debouncedFetchEvents,
    dateRange,
    searchTerm,
  ]);

  // Check if event has any messages (for determining whether to show chat section)
  const checkEventMessages = async (eventId) => {
    if (!eventId) return;

    setIsCheckingMessages(true);
    try {
      const result = await getEventMessages(eventId, 1, 0); // Only get 1 message to check if any exist
      if (result.success) {
        const hasMessages = result.messages && result.messages.length > 0;
        setHasMessagesInEvent(hasMessages);

        console.log(`📧 Event ${eventId} has messages:`, hasMessages);
        console.log(
          `📊 Total messages in event:`,
          result.pagination?.total || 0
        );
      } else {
        setHasMessagesInEvent(false);
      }
    } catch (error) {
      console.error('Error checking event messages:', error);
      setHasMessagesInEvent(false);
    } finally {
      setIsCheckingMessages(false);
    }
  };

  // Chat functions
  const loadEventMessages = async (eventId, limit = 30) => {
    if (!eventId) return;

    setIsLoadingMessages(true);
    try {
      const result = await getEventMessages(eventId, limit, 0);
      if (result.success) {
        setMessages(result.messages || []);
        // Không cần set canSendMessage từ API nữa vì chúng ta sử dụng logic local
        setMessagePagination(result.pagination || {});
        setHasMoreMessages(result.pagination?.hasMore || false);

        // Update hasMessagesInEvent based on actual messages loaded
        const hasMessages = result.messages && result.messages.length > 0;
        setHasMessagesInEvent(hasMessages);

        // Scroll to bottom after loading messages
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Load more messages function for infinite scroll
  const loadMoreMessages = async () => {
    if (!selectedEvent?.id || isLoadingMoreMessages || !hasMoreMessages) return;

    setIsLoadingMoreMessages(true);
    try {
      const result = await loadMoreEventMessages(
        selectedEvent.id,
        messages,
        20
      );
      if (result.success) {
        // Always update pagination and hasMore status
        setMessagePagination(result.pagination || {});
        setHasMoreMessages(result.pagination?.hasMore || false);

        if (result.messages.length > 0) {
          // Remember current scroll position
          const container = messagesContainerRef.current;
          const scrollHeightBefore = container?.scrollHeight || 0;

          // Merge new messages at the beginning (older messages)
          setMessages((prev) => {
            // Remove duplicates before merging
            const existingIds = new Set(prev.map((msg) => msg._id));
            const newMessages = result.messages.filter(
              (msg) => !existingIds.has(msg._id)
            );

            const mergedMessages = [...newMessages, ...prev];

            return mergedMessages;
          });

          // Maintain scroll position after adding messages at the top
          setTimeout(() => {
            if (container) {
              const scrollHeightAfter = container.scrollHeight;
              const heightDifference = scrollHeightAfter - scrollHeightBefore;
              container.scrollTop = container.scrollTop + heightDifference;
            }
          }, 100);
        } else {
          console.log('📭 No more messages to load');
        }
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMoreMessages(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedEvent?.id) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      const result = await sendEventMessage(selectedEvent.id, messageContent);
      if (result.success) {
        // Add message to local state with all required fields
        const messageWithFullData = {
          ...result.message,
          isEdited: false,
          editedAt: null,
        };

        setMessages((prev) => {
          // Check if message already exists to prevent duplicates
          const messageExists = prev.some(
            (msg) => msg._id === messageWithFullData._id
          );
          if (messageExists) {
            return prev;
          }

          // Add new sent message at the end (newest messages at bottom)
          const newState = [...prev, messageWithFullData];

          return newState;
        });

        // Update hasMessagesInEvent since we just added a message
        setHasMessagesInEvent(true);

        // Scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore message on error
      setNewMessage(messageContent);
    }
  };

  const handleEditMessage = async (messageId, content) => {
    try {
      const result = await editEventMessage(messageId, content);
      if (result.success) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId ? { ...msg, ...result.message } : msg
          )
        );
        setEditingMessageId(null);
        setEditingContent('');
        setContextMenu(null);
      }
    } catch (error) {
      console.error('Error editing message:', error);
      // Close modal on error as well
      setEditingMessageId(null);
      setEditingContent('');
      setContextMenu(null);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const result = await deleteEventMessage(messageId);
      if (result.success) {
        setMessages((prev) => {
          const filteredMessages = prev.filter((msg) => msg._id !== messageId);

          // Update hasMessagesInEvent based on remaining messages
          setHasMessagesInEvent(filteredMessages.length > 0);

          return filteredMessages;
        });
        setContextMenu(null);

        // Update pagination count
        setMessagePagination((prev) => ({
          ...prev,
          total: Math.max((prev.total || 0) - 1, 0),
        }));
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      // Still close the actions menu on error
      setContextMenu(null);
    }
  };

  const startEditing = (message) => {
    setEditingMessageId(message._id);
    setEditingContent(message.content);
    setContextMenu(null);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const submitMessageEdit = (messageId) => {
    if (editingContent.trim()) {
      handleEditMessage(messageId, editingContent.trim());
    }
  };

  const canUserChat = (event) => {
    if (!event || !currentUserId) return false;

    // Check if user is organizer
    if (
      event.organizer?.userId === currentUserId ||
      event.organizer?._id === currentUserId
    ) {
      return true;
    }

    // Check if user is accepted participant
    return event.participants?.some(
      (p) =>
        (p.userId === currentUserId || p.userId?._id === currentUserId) &&
        p.status === 'accepted'
    );
  };

  const shouldShowChatFeature = (event) => {
    if (!event) return false;
    // Luôn hiển thị chat nếu user có quyền chat (để có thể xem lại tin nhắn)
    return canUserChat(event);
  };

  // Hàm kiểm tra có thể gửi tin nhắn mới hay không
  const canSendNewMessage = (event) => {
    if (!event || !canUserChat(event)) return false;
    // Chỉ có thể gửi tin nhắn mới khi sự kiện chưa hoàn thành hoặc bị hủy
    return event.status && !['completed', 'cancelled'].includes(event.status);
  };

  // Lọc sự kiện theo ngày được chọn
  const selectedDateEvents = useMemo(() => {
    return events.filter((event) => {
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === selectedDate.toDateString();
    });
  }, [events, selectedDate]);

  // Render nội dung sự kiện
  const renderEventContent = useCallback(
    (eventInfo) => {
      const eventType =
        eventTypes[eventInfo.event.extendedProps.type] || eventTypes.offline;
      const canEdit = eventInfo.event.extendedProps?.canEdit;
      const status = eventInfo.event.extendedProps?.status;

      return (
        <div className={`fc-event-content`}>
          <span className='fc-event-icon'>{eventType.icon}</span>
          <span className='fc-event-title'>{eventInfo.event.title}</span>
          {/* {!canEdit && (
            <span className='fc-event-lock-icon' title='Không thể chỉnh sửa'>
              🔒
            </span>
          )} */}
        </div>
      );
    },
    [eventTypes]
  );

  // Kiểm tra quyền chỉnh sửa sự kiện
  const canModifyEvent = useCallback(
    (event) => {
      let userId = userDataLocal?.id || userDataLocal?._id;
      // Chỉ có thể chỉnh sửa nếu là organizer của sự kiện
      return event?.organizer?.userId === userId;
    },
    [userDataLocal]
  );

  // Kiểm tra quyền chỉnh sửa dựa trên status
  const canEditEvent = useCallback(
    (event) => {
      if (!canModifyEvent(event)) return false;
      const status = event?.status;
      // Chỉ có thể chỉnh sửa khi status là draft hoặc scheduled
      return status === 'draft' || status === 'scheduled';
    },
    [canModifyEvent]
  );

  // Kiểm tra quyền xóa dựa trên status
  const canDeleteEvent = useCallback(
    (event) => {
      if (!canModifyEvent(event)) return false;

      const status = event?.status;
      // Có thể xóa khi status là draft, scheduled, hoặc cancelled
      // KHÔNG thể xóa khi in-progress hoặc completed
      return (
        status === 'draft' || status === 'scheduled' || status === 'cancelled'
      );
    },
    [canModifyEvent]
  );

  // Cấu hình FullCalendar
  const calendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: calendarView,
    events: events,
    dateClick: handleDateClick,
    eventClick: handleEventClick,
    eventDrop: handleEventDrop,
    eventContent: renderEventContent,
    editable: true,
    droppable: true,
    height: 'auto',
    aspectRatio: isMobile ? 0.8 : isTablet ? 1.0 : 1.2,
    dayMaxEvents: isMobile ? 2 : isTablet ? 3 : 4,
    moreLinkClick: 'popover',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    },
    views: {
      dayGridMonth: {
        dayHeaderFormat: { weekday: 'short' },
        titleFormat: { year: 'numeric', month: 'long' },
      },
      timeGridWeek: {
        dayHeaderFormat: { weekday: 'long', day: 'numeric', month: 'numeric' },
        slotMinTime: '00:00:00',
        slotMaxTime: '23:59:59',
      },
      timeGridDay: {
        dayHeaderFormat: { weekday: 'long', day: 'numeric', month: 'long' },
        slotMinTime: '00:00:00',
        slotMaxTime: '23:59:59',
      },
    },
    buttonText: {
      today: 'Today',
      month: 'Month',
      week: 'Week',
      day: 'Day',
    },
    locale: 'vi',
    firstDay: 1,
    weekNumbers: !isMobile,
    weekNumberTitle: 'Week',
    weekNumberCalculation: 'ISO',
    // timeZone: 'Asia/Ho_Chi_Minh', // Đảm bảo múi giờ
    nowIndicator: true,
    selectMirror: true,
    dayMaxEventRows: isMobile ? 2 : 4,
    eventDisplay: 'block',
    displayEventTime: true,
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    },
    datesSet: handleDatesSet,
    customButtons: {
      today: {
        text: 'Today',
        click: handleTodayClick,
      },
    },
  };

  // Component nút xem vị trí trên bản đồ
  const MapLocationButton = ({ address, className = '', size = 'sm' }) => {
    const mapsUrl = generateMapsUrl(address);

    if (!mapsUrl) return null;

    const handleOpenMaps = (e) => {
      e.stopPropagation(); // Ngăn click event bubble lên parent (event card)
      window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    };

    // Cho event card, sử dụng style nhỏ gọn hơn
    if (size === 'xs') {
      return (
        <button
          onClick={handleOpenMaps}
          className={`map-location-btn-xs ${className}`}
          title='View on Google Maps'
        >
          🗺️
        </button>
      );
    }

    return (
      <Button
        variant='outline-primary'
        size={size}
        onClick={handleOpenMaps}
        className={`d-inline-flex align-items-center ${className}`}
        style={{ marginLeft: '8px' }}
      >
        <span style={{ marginRight: '4px' }}>🗺️</span>
        View on Google Maps
      </Button>
    );
  };

  // Handler for opening cancel modal
  const handleOpenCancelModal = (event) => {
    setSelectedEventForCancel(event);
    setShowCancelModal(true);
  };

  // Handler for closing cancel modal
  const handleCloseCancelModal = () => {
    setSelectedEventForCancel(null);
    setShowCancelModal(false);
    setCancelReason('');
    setIsSubmitting(false);
  };

  // Handler for submitting cancellation
  const handleSubmitCancellation = async () => {
    if (!selectedEventForCancel || !cancelReason.trim()) {
      toast.error('Please enter a reason for cancellation');
      return;
    }

    setIsSubmitting(true);
    const success = await cancelEventParticipation(
      selectedEventForCancel.id,
      cancelReason.trim()
    );

    if (success) {
      handleCloseCancelModal();
      // Calendar will auto-refresh due to eventUpdated event
    }
    setIsSubmitting(false);
    setShowEventModal(false);
    setSelectedEventForCancel(null);
    setCancelReason('');
  };

  // Handler for accepting event with conflict
  const handleAcceptWithConflict = async () => {
    if (!conflictEventData) return;

    setIsSubmitting(true);
    try {
      const result = await respondToEventInvitation(
        conflictEventData.eventId,
        'accepted',
        conflictEventData.notificationId,
        true // forceAccept
      );

      if (result.success) {
        setShowConflictModal(false);
        setConflictEventData(null);
        // Refresh events
        if (dateRange.start && dateRange.end) {
          debouncedFetchEvents(dateRange.start, dateRange.end, searchTerm);
        }
      }
    } catch (error) {
      console.error('Error accepting event with conflict:', error);
      toast.error('Cannot accept invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler for closing conflict modal
  const handleCloseConflictModal = () => {
    setShowConflictModal(false);
    setConflictEventData(null);
  };

  // Handler for creating event with conflict
  const handleCreateWithConflict = async () => {
    if (!createConflictData?.formData) return;

    // Create a synthetic event to pass to handleCreateSubmit
    const syntheticEvent = { preventDefault: () => {} };

    // Validate dates before forcing create
    const vietnamNow = getCurrentVietnamTime();
    const startDate = new Date(createConflictData.formData.startDate);
    const endDate = new Date(createConflictData.formData.endDate);

    if (startDate < vietnamNow) {
      toast.error('Start time cannot be in the past');
      return;
    }

    if (endDate < vietnamNow) {
      toast.error('End time cannot be in the past');
      return;
    }

    try {
      setIsCreatingEvent(true);
      let userId = userDataLocal?.id || userDataLocal?._id;

      const payload = {
        calendarId: calendarUser._id,
        title: createConflictData.formData.title,
        description: createConflictData.formData.description || undefined,
        startDate: fromLocalDateTime(createConflictData.formData.startDate),
        endDate: fromLocalDateTime(createConflictData.formData.endDate),
        type: createConflictData.formData.type,
        organizer: userId,
        address: createConflictData.formData.address || undefined,
        status: 'scheduled',
        participantEmails: createConflictData.formData.participantEmails
          ? createConflictData.formData.participantEmails
              .split(',')
              .map((email) => email.trim())
              .filter((email) => email.length > 0)
          : undefined,
        allDay: createConflictData.formData.allDay,
        recurrence: createConflictData.formData.recurrence
          ? { type: createConflictData.formData.recurrence, interval: 1 }
          : undefined,
        forceCreate: true, // Force create despite conflict
      };

      const response = await axios.post(
        `${apiBaseUrl}/event/create-event-for-calendar/${calendarUser._id}`,
        payload,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (response.data.status === 201) {
        toast.success('Event added successfully');
        setShowCreateModal(false);
        setShowCreateConflictModal(false);
        setCreateConflictData(null);
        debouncedFetchEvents(dateRange.start, dateRange.end, searchTerm);
        setFormData({
          title: '',
          description: '',
          startDate: toLocalDateTime(new Date()),
          endDate: toLocalDateTime(new Date()),
          type: 'offline',
          address: '',
          status: 'scheduled',
          participantEmails: '',
          allDay: false,
          recurrence: '',
        });
      }
    } catch (error) {
      console.error('Lỗi tạo sự kiện với xung đột:', error);
      toast.error('Failed to create event');
    } finally {
      setIsCreatingEvent(false);
    }
  };

  // Handler for closing create conflict modal
  const handleCloseCreateConflictModal = () => {
    setShowCreateConflictModal(false);
    setCreateConflictData(null);
  };

  // ========== ENHANCED CONFLICT HANDLING FUNCTIONS ==========

  // 1. Cancel - Close modal and do nothing
  const handleConflictCancel = () => {
    setShowMainConflictModal(false);
    // setShowCreateModal(false);
    setMainConflictData(null);
    setAvailableTimeSlots([]);
  };

  // 2. Edit Manually - Reopen create modal with existing data
  const handleConflictEditManually = () => {
    if (!mainConflictData?.formData) return;

    // Fill form with existing data
    setFormData(mainConflictData.formData);

    // Clear previous suggestions
    setAvailableTimeSlots([]);
    setLoadingSuggestions(false);

    // Close conflict modal and open create modal
    setShowMainConflictModal(false);
    setMainConflictData(null);

    setShowCreateModal(true);
  };

  // 3. System Suggestions - Fetch and show suggested time slots
  const handleConflictShowSuggestions = async () => {
    if (!mainConflictData?.formData) return;

    setLoadingSuggestions(true);
    try {
      const formData = mainConflictData.formData;

      // Calculate event duration in minutes
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const duration = Math.round((end - start) / (1000 * 60));

      // Prepare payload for finding available slots
      const payload = {
        startDate: fromLocalDateTime(formData.startDate),
        endDate: fromLocalDateTime(formData.endDate),
        duration: duration,
        participantEmails: formData.participantEmails
          ? formData.participantEmails
              .split(',')
              .map((email) => email.trim())
              .filter((email) => email.length > 0)
          : [],
        timeZone: 'Asia/Ho_Chi_Minh',
      };

      const result = await findAvailableTimeSlots(payload);

      if (result.success) {
        setAvailableTimeSlots(result.data || []);
        if (result.data.length === 0) {
          toast.info('No suitable free time slot found');
        }
      } else {
        throw new Error(result.error || 'Failed to get time suggestions');
      }
    } catch (error) {
      console.error('Error fetching time suggestions:', error);
      toast.error('Failed to get time suggestions');
      setAvailableTimeSlots([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // 4. Create Anyway - Force create event despite conflicts
  const handleConflictCreateAnyway = async () => {
    if (!mainConflictData?.formData) return;

    const formData = mainConflictData.formData;

    // Create synthetic event for handleCreateSubmit
    const syntheticEvent = { preventDefault: () => {} };

    // Close conflict modal first
    setShowMainConflictModal(false);

    // Call create with forceCreate = true
    await handleCreateSubmit(syntheticEvent, true);
  };

  // Select suggested time slot and reopen create modal
  const handleSelectSuggestedSlot = (slot) => {
    if (!mainConflictData?.formData) return;

    const updatedFormData = {
      ...mainConflictData.formData,
      startDate: toLocalDateTime(new Date(slot.startDate)),
      endDate: toLocalDateTime(new Date(slot.endDate)),
    };

    setFormData(updatedFormData);
    setShowMainConflictModal(false);
    setShowCreateModal(true);
    setAvailableTimeSlots([]);
  };

  // ========== MAIN CONFLICT MODAL COMPONENT ==========
  const renderMainConflictModal = () => {
    if (!mainConflictData) return null;

    const { conflictingEvents, newEvent } = mainConflictData;

    return (
      <Modal
        show={showMainConflictModal}
        onHide={handleConflictCancel}
        centered
        size='lg'
        className='conflict-modal'
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className='fas fa-exclamation-triangle text-warning me-2'></i>
            There is conflict while you are creating this event
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className='alert alert-warning d-flex align-items-center'>
            <i className='fas fa-clock me-2'></i>
            <div>
              <strong>
                Event "{newEvent.title}" conflicts with the following events:
              </strong>
            </div>
          </div>

          {/* Sự kiện hiện tại muốn tạo */}
          <div className='mb-4'>
            <h6 className='fw-bold'>Event you want to create:</h6>
            <div className='alert mb-2 rounded-2 p-3 border-1 border-info bg-info-subtle'>
              <div className='d-flex justify-content-between align-items-start'>
                <div>
                  <strong>{newEvent.title}</strong>
                  <div className='small text-muted'>
                    <i className='fas fa-clock me-1'></i>
                    {formatConflictEventTime(newEvent)}
                  </div>
                </div>
                <div className='d-flex gap-1'>
                  {newEvent.allDay && (
                    <span className='badge bg-info'>
                      <i className='fas fa-calendar-day me-1'></i>
                      All day
                    </span>
                  )}
                  <span className='badge bg-primary'>New</span>
                </div>
              </div>
            </div>
          </div>

          {/* Show conflicting events */}
          <div className='mb-4'>
            <h6 className='fw-bold'>
              <i className='fas fa-exclamation-triangle text-warning me-2'></i>
              Conflict events ({conflictingEvents.length}):
            </h6>
            {conflictingEvents.map((conflict, index) => (
              <div
                key={index}
                className='alert alert-danger-subtle mb-2 rounded-2 p-3 border-1 bg-danger-subtle border-danger'
              >
                <div className='d-flex justify-content-between align-items-start'>
                  <div className='flex-grow-1'>
                    <strong>{conflict.title}</strong>
                    <div className='small text-muted mt-1'>
                      <i className='fas fa-clock me-1'></i>
                      {formatConflictEventTime(conflict)}
                    </div>
                  </div>
                  <div className='d-flex gap-1 ms-2'>
                    {conflict.allDay && (
                      <span className='badge bg-info'>
                        <i className='fas fa-calendar-day me-1'></i>
                        All day
                      </span>
                    )}
                    {/* <span className='badge bg-danger'>Xung đột</span> */}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Show suggested time slots if available */}
          {availableTimeSlots.length > 0 && (
            <div className='mb-4'>
              <h6 className='fw-bold mb-3'>Suggested time slots:</h6>

              {/* Morning slots */}
              <div className='mb-3'>
                <div className='d-flex align-items-center mb-2'>
                  <i className='fas fa-sun text-warning me-2'></i>
                  <h6 className='mb-0'>Morning</h6>
                </div>
                {availableTimeSlots
                  .filter((slot) => slot.period === 'morning')
                  .map((slot, index) => (
                    <div
                      key={index}
                      className='alert alert-success-subtle mb-2 cursor-pointer'
                      onClick={() => handleSelectSuggestedSlot(slot)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className='d-flex justify-content-between align-items-center'>
                        <div>
                          <i className='fas fa-clock me-2'></i>
                          {formatEventDate(new Date(slot.startDate))} -{' '}
                          {formatEventDate(new Date(slot.endDate))}
                        </div>
                        <Button size='sm' variant='success'>
                          <i className='fas fa-check me-1'></i>
                          Choose
                        </Button>
                      </div>
                    </div>
                  ))}
                {availableTimeSlots.filter((slot) => slot.period === 'morning')
                  .length === 0 && (
                  <div className='text-muted small fst-italic'>
                    <i className='fas fa-info-circle me-1'></i>
                    No available time slots in the morning
                  </div>
                )}
              </div>

              {/* Afternoon slots */}
              <div>
                <div className='d-flex align-items-center mb-2'>
                  <i className='fas fa-cloud-sun text-info me-2'></i>
                  <h6 className='mb-0'>Afternoon</h6>
                </div>
                {availableTimeSlots
                  .filter((slot) => slot.period === 'afternoon')
                  .map((slot, index) => (
                    <div
                      key={index}
                      className='alert alert-success-subtle mb-2 cursor-pointer'
                      onClick={() => handleSelectSuggestedSlot(slot)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className='d-flex justify-content-between align-items-center'>
                        <div>
                          <i className='fas fa-clock me-2'></i>
                          {formatEventDate(new Date(slot.startDate))} -{' '}
                          {formatEventDate(new Date(slot.endDate))}
                        </div>
                        <Button size='sm' variant='success'>
                          <i className='fas fa-check me-1'></i>
                          Choose
                        </Button>
                      </div>
                    </div>
                  ))}
                {availableTimeSlots.filter(
                  (slot) => slot.period === 'afternoon'
                ).length === 0 && (
                  <div className='text-muted small fst-italic'>
                    <i className='fas fa-info-circle me-1'></i>
                    No available time slots in the afternoon
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action explanation */}
          <div className='alert alert-info'>
            <h6 className='fw-bold mb-2'>You can:</h6>
            <ul className='mb-0'>
              <li>
                <strong>Cancel:</strong> Close this modal and do nothing
              </li>
              <li>
                <strong>Resetting time:</strong> Manually change the time
              </li>
              {!newEvent.allDay && (
                <li>
                  <strong>View suggestions:</strong> System will suggest free
                  time slots
                </li>
              )}
              <li>
                <strong>Create anyway:</strong> Skipping conflict and create
              </li>
            </ul>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant='secondary' onClick={handleConflictCancel}>
            <i className='fas fa-times me-1'></i>
            Cancel
          </Button>
          <Button variant='primary' onClick={handleConflictEditManually}>
            <i className='fas fa-edit me-1'></i>
            Resetting time
          </Button>
          {!newEvent.allDay && (
            <Button
              variant='info'
              onClick={handleConflictShowSuggestions}
              disabled={loadingSuggestions}
            >
              {loadingSuggestions ? (
                <>
                  <Spinner size='sm' animation='border' className='me-1' />
                  Loading...
                </>
              ) : (
                <>
                  <i className='fas fa-lightbulb me-1'></i>
                  View suggestions
                </>
              )}
            </Button>
          )}
          <Button variant='warning' onClick={handleConflictCreateAnyway}>
            <i className='fas fa-exclamation-circle me-1'></i>
            Create anyway
          </Button>
        </Modal.Footer>
      </Modal>
    );
  };

  // Add Cancel Participation Modal
  const renderCancelModal = () => {
    return (
      <Modal
        show={showCancelModal}
        onHide={handleCloseCancelModal}
        centered
        className='cancel-participation-modal'
      >
        <Modal.Header closeButton>
          <Modal.Title>Cancel join event</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Control
                as='textarea'
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder='Please explain the reason...'
                disabled={isSubmitting}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant='secondary'
            onClick={handleCloseCancelModal}
            disabled={isSubmitting}
          >
            Đóng
          </Button>
          <Button
            variant='danger'
            onClick={handleSubmitCancellation}
            disabled={isSubmitting || !cancelReason.trim()}
          >
            {isSubmitting ? (
              <>
                <Spinner
                  as='span'
                  animation='border'
                  size='sm'
                  role='status'
                  aria-hidden='true'
                  className='me-2'
                />
                Processing...
              </>
            ) : (
              'Confirm'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  };

  const handleMessageClick = (message, event) => {
    const isOwnMessage = message.userId._id === currentUserId;
    // Không cho phép edit nếu không phải tin nhắn của mình, đang edit tin nhắn khác, hoặc sự kiện đã kết thúc
    if (!isOwnMessage || editingMessageId || !canSendNewMessage(selectedEvent))
      return;

    event.preventDefault();
    event.stopPropagation();
    startEditing(message);
  };

  const handleMessageRightClick = (message, event) => {
    const isOwnMessage = message.userId._id === currentUserId;
    // Không cho phép hiện context menu nếu không phải tin nhắn của mình, đang edit, hoặc sự kiện đã kết thúc
    if (!isOwnMessage || editingMessageId || !canSendNewMessage(selectedEvent))
      return;

    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      messageId: message._id,
      x: event.clientX,
      y: event.clientY,
      message: message,
    });
  };

  return (
    <>
      <style jsx>{`
        .event-status-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
          margin-left: 4px;
        }

        .status-in-progress {
          background-color: #ffeaa7;
          color: #d63031;
          border: 1px solid #fdcb6e;
        }

        .status-completed {
          background-color: #55a3ff;
          color: white;
          border: 1px solid #4a90e2;
        }

        .status-cancelled {
          background-color: #fab1a0;
          color: #d63031;
          border: 1px solid #e17055;
        }

        .status-draft {
          background-color: #ddd;
          color: #636e72;
          border: 1px solid #b2bec3;
        }

        .status-scheduled {
          background-color: #74b9ff;
          color: white;
          border: 1px solid #0984e3;
        }

        .event-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          align-items: center;
        }

        .fc-event-locked {
          opacity: 0.8;
          cursor: not-allowed !important;
        }

        .fc-event-locked:hover {
          opacity: 0.9;
        }

        .fc-event-lock-icon {
          margin-left: 4px;
          font-size: 0.8em;
          opacity: 0.8;
        }

        .event-modal-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .messenger-readonly {
          cursor: default !important;
        }

        .messenger-message.messenger-own:not(.messenger-readonly) {
          cursor: pointer;
        }

        .messenger-message.messenger-own:not(.messenger-readonly):hover
          .messenger-bubble {
          opacity: 0.9;
        }
      `}</style>
      <div className='calendar-page'>
        <div className='calendar-overlay' />
        <div className='calendar-content'>
          <Container fluid>
            {/* Main Content */}
            <Row className='calendar-main-container'>
              <Col lg={7} className='order-1 order-lg-1'>
                <motion.div
                  className='calendar-section calendar-container h-100'
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <FullCalendar
                    ref={calendarRef}
                    {...calendarOptions}
                    viewDidMount={(info) => handleViewChange(info.view.type)}
                  />
                </motion.div>
              </Col>
              <Col lg={5} className='order-2 order-lg-2'>
                <motion.div
                  className='calendar-section schedule-section'
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <div className='d-flex justify-content-between mb-4 gap-5'>
                    <h3 className='schedule-header'>
                      <FaCalendarCheck className='me-2' />
                      {formatEventDate(selectedDate)}
                    </h3>
                    <Badge bg='light' text='dark' className='h-100 px-3 py-2'>
                      {selectedDateEvents.length} events
                    </Badge>
                  </div>
                  <div className='event-list'>
                    <AnimatePresence>
                      {selectedDateEvents.length > 0 ? (
                        selectedDateEvents.map((event) => (
                          <motion.div
                            key={event.id}
                            className='event-card'
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            onClick={() => handleEventClick({ event })}
                          >
                            <div className='event-card-header'>
                              <h4 className='event-title'>{event.title}</h4>
                              <div className='event-badges'>
                                <div
                                  className={`event-type-badge event-type-${event.extendedProps.type}`}
                                >
                                  {eventTypes[event.extendedProps.type]?.icon}{' '}
                                  {eventTypes[event.extendedProps.type]?.label}
                                </div>
                                {!event.extendedProps.isOwn && (
                                  <div className='event-participated-badge'>
                                    👥 Join
                                  </div>
                                )}
                                {/* Status indicator */}
                                {event.extendedProps.status &&
                                  event.extendedProps.status !==
                                    'scheduled' && (
                                    <div
                                      className={`event-status-badge status-${event.extendedProps.status}`}
                                    >
                                      {event.extendedProps.status ===
                                        'in-progress' && '🔄 Ongoing'}
                                      {event.extendedProps.status ===
                                        'completed' && '✅ Completed'}
                                      {event.extendedProps.status ===
                                        'cancelled' && '❌ Cancelled'}
                                      {event.extendedProps.status === 'draft' &&
                                        '📝 Draft'}
                                    </div>
                                  )}
                              </div>
                            </div>
                            {event.extendedProps.description && (
                              <p className='event-description'>
                                {event.extendedProps.description}
                              </p>
                            )}
                            <div className='event-meta'>
                              <div className='event-meta-item'>
                                <FaCalendarAlt size={18} className='ms-1' />
                                <span>
                                  {formatEventDate(new Date(event.start))}
                                </span>
                              </div>
                              {event.extendedProps.type === 'offline' &&
                                event.extendedProps.address && (
                                  <div className='event-meta-item'>
                                    <span>📍</span>
                                    <span>
                                      {getAddressDisplay(
                                        event.extendedProps.address
                                      )}
                                    </span>
                                    <MapLocationButton
                                      address={event.extendedProps.address}
                                      size='xs'
                                      className='ms-1'
                                    />
                                  </div>
                                )}
                              {event.extendedProps.type === 'online' && (
                                <div className='event-meta-item'>
                                  <span>🌐</span>
                                  <span>
                                    {event.extendedProps?.onlineUrl ? (
                                      <a
                                        href={event.extendedProps?.onlineUrl}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='text-success'
                                      >
                                        Meet Link
                                      </a>
                                    ) : (
                                      <span className='text-muted small'>
                                        Link is not available
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                              {/* <div className='event-meta-item'>
                                <FaUser />
                                <span>
                                  {event.extendedProps.organizer?.username ||
                                    'Không xác định'}
                                </span>
                              </div> */}
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <motion.div
                          className='no-events'
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.5 }}
                        >
                          <span className='d-flex justify-content-center'>
                            <FaCalendarAlt size={48} className='mb-3' />
                          </span>
                          <p>There is no event on this day</p>
                          <Button
                            variant='outline-light'
                            onClick={handleCreateClick}
                            className='mt-2 d-flex w-100 justify-content-center align-items-center'
                          >
                            <FaPlus className='me-2' />
                            Create new event
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </Col>
            </Row>
          </Container>

          {/* Floating Action Button */}
          <motion.button
            className='fab-create'
            onClick={handleCreateClick}
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1, type: 'spring', stiffness: 200 }}
          >
            <FaPlus />
          </motion.button>

          {/* Event Detail Modal */}
          <AnimatePresence>
            {showEventModal && selectedEvent && (
              <motion.div
                className='event-modal-overlay'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowEventModal(false)}
              >
                <motion.div
                  className='event-modal '
                  style={{ marginTop: 50 }}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className='event-modal-header'>
                    <h2 className='event-modal-title'>{selectedEvent.title}</h2>
                    <button
                      className='event-modal-close'
                      onClick={() => setShowEventModal(false)}
                    >
                      <FaTimes />
                    </button>
                  </div>
                  <div className='event-modal-content'>
                    <div className='mb-3'>
                      <div className='event-badges-container'>
                        <div
                          className={`event-type-badge event-type-${selectedEvent.type} d-inline-block mb-2 me-2`}
                        >
                          {eventTypes[selectedEvent.type]?.icon}{' '}
                          {eventTypes[selectedEvent.type]?.label}
                        </div>
                      </div>
                    </div>
                    <div className='event-info'>
                      <p>
                        <FaCalendarAlt className='ms-1 me-3' />
                        Thời gian:{' '}
                        {selectedEvent.allDay ? (
                          <>
                            {new Intl.DateTimeFormat('vi-VN', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              timeZone: 'Asia/Ho_Chi_Minh',
                            }).format(selectedEvent.start)}{' '}
                            <span className=''>(all day)</span>
                          </>
                        ) : (
                          <>
                            {formatEventDate(selectedEvent.start)}
                            {selectedEvent.end &&
                              ` đến ${formatEventDate(selectedEvent.end)}`}
                          </>
                        )}
                      </p>
                      {selectedEvent.type === 'offline' &&
                        selectedEvent.address && (
                          <div>
                            <p className='mb-1'>
                              <span className='me-2'>📍</span>
                              Address:{' '}
                              {getAddressDisplay(selectedEvent.address)}
                            </p>
                            <MapLocationButton
                              address={selectedEvent.address}
                              className='mb-2'
                            />
                          </div>
                        )}
                      {selectedEvent.type === 'online' && (
                        <p>
                          <span className='me-2'>🌐</span>
                          Meet Link:{' '}
                          {selectedEvent?.onlineUrl ? (
                            <a
                              href={selectedEvent?.onlineUrl}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='event-open-meeting-button'
                              title='Mở link sự kiện'
                            >
                              Join
                            </a>
                          ) : (
                            <span className='text-muted'>
                              Link is not available
                              {selectedEvent.extendedProps?.isOwn && (
                                <small className='d-block text-info'>
                                  You can try to update this event to add a
                                  link. Otherwise, please login with your Google
                                  account again.
                                </small>
                              )}
                            </span>
                          )}
                        </p>
                      )}
                      {selectedEvent.meetingCode && (
                        <p>
                          <span className='ms-1 me-2'>🔑</span>
                          Meeting Code: {selectedEvent.meetingCode}
                        </p>
                      )}
                      {selectedEvent.description && (
                        <p>
                          <span className='me-2'>📝</span>
                          Description: {selectedEvent.description}
                        </p>
                      )}
                      <p>
                        <FaUser className='ms-1 me-2' />
                        Organizer: {selectedEvent?.organizer.username}
                      </p>
                      {selectedEvent.participants?.filter(
                        (p) => p.status === 'accepted'
                      ).length > 0 && (
                        <p>
                          <span className='me-2'>👥</span>
                          Participants:{' '}
                          {selectedEvent.participants
                            .filter((p) => p.status === 'accepted')
                            .map((p) => p.email || p.name || 'User')
                            .join(', ')}
                        </p>
                      )}

                      <p>
                        <span className='me-2'>📊</span>
                        Status:{' '}
                        <span
                          className={`event-status-badge status-${selectedEvent.status} ms-1`}
                        >
                          {selectedEvent.status === 'in-progress' &&
                            '🔄 Ongoing'}
                          {selectedEvent.status === 'completed' &&
                            '✅ Completed'}
                          {selectedEvent.status === 'cancelled' &&
                            '❌ Cancelled'}
                          {selectedEvent.status === 'draft' && '📝 Draft'}
                          {selectedEvent.status === 'scheduled' &&
                            '📅 Not yet started'}
                          {![
                            'in-progress',
                            'completed',
                            'cancelled',
                            'draft',
                            'scheduled',
                          ].includes(selectedEvent.status) &&
                            (statusOptions.find(
                              (s) => s.value === selectedEvent.status
                            )?.label ||
                              selectedEvent.status)}
                        </span>
                      </p>
                    </div>

                    {/* Chat Section - Only show if event has messages OR user can send new messages */}
                    {shouldShowChatFeature(selectedEvent) &&
                      (hasMessagesInEvent ||
                        canSendNewMessage(selectedEvent)) && (
                        <div className='border-top mt-3 pt-3'>
                          <div className='d-flex justify-content-between align-items-center mb-3'>
                            <h5 className='mb-0 d-flex align-items-center'>
                              <FaComments className='me-2' />
                              Discussion
                              {!canSendNewMessage(selectedEvent) &&
                                hasMessagesInEvent && (
                                  <span className='badge bg-secondary ms-2 small'>
                                    Only view
                                  </span>
                                )}
                              {isCheckingMessages && (
                                <span
                                  className='spinner-border spinner-border-sm ms-2'
                                  role='status'
                                >
                                  <span className='visually-hidden'>
                                    Loading...
                                  </span>
                                </span>
                              )}
                            </h5>
                            <Button
                              variant={showChat ? 'outline-primary' : 'primary'}
                              size='sm'
                              onClick={() => setShowChat(!showChat)}
                              disabled={isCheckingMessages}
                            >
                              {showChat ? 'Hide' : 'Show'}
                            </Button>
                          </div>

                          {showChat && (
                            <div className='chat-container'>
                              {/* Messages Area */}
                              <div
                                ref={messagesContainerRef}
                                className='messages-area border rounded p-3 mb-3'
                                style={{
                                  height: '300px',
                                  overflowY: 'auto',
                                  backgroundColor: '#f8f9fa',
                                }}
                              >
                                {isLoadingMessages ? (
                                  <div className='text-center p-3'>
                                    <span className='d-flex justify-content-center'>
                                      <Spinner animation='border' size='sm' />
                                    </span>
                                    <div className='mt-2 text-muted'>
                                      Loading...
                                    </div>
                                  </div>
                                ) : messages.length === 0 ? (
                                  <div className='text-center p-3'>
                                    <span className='d-flex justify-content-center'>
                                      <FaComments size={24} className='mb-2' />
                                    </span>
                                    <div>
                                      No available messages. Be the first to
                                      start a conversation!
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {/* Loading more messages at top */}
                                    {isLoadingMoreMessages && (
                                      <motion.div
                                        className='text-center p-2 mb-3'
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.3 }}
                                      >
                                        <div
                                          style={{
                                            background:
                                              'rgba(13, 110, 253, 0.1)',
                                            borderRadius: '15px',
                                            padding: '12px 16px',
                                            display: 'inline-block',
                                            border:
                                              '1px solid rgba(13, 110, 253, 0.2)',
                                          }}
                                        >
                                          <Spinner
                                            animation='border'
                                            size='sm'
                                            style={{ color: '#0d6efd' }}
                                          />
                                          <div
                                            className='small mt-1'
                                            style={{ color: '#0d6efd' }}
                                          >
                                            Loading more messages...
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}

                                    {/* Show load more button if there are more messages and not loading */}

                                    {hasMoreMessages &&
                                      !isLoadingMoreMessages && (
                                        <motion.div
                                          className='text-center p-2 mb-3'
                                          initial={{ opacity: 0, scale: 0.9 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          transition={{
                                            duration: 0.3,
                                            ease: 'easeOut',
                                          }}
                                        >
                                          <motion.button
                                            onClick={loadMoreMessages}
                                            className='btn btn-sm btn-outline-primary load-more-btn'
                                            style={{
                                              background:
                                                'linear-gradient(135deg, #f8f9fa, #e9ecef)',
                                              border: '1px solid #dee2e6',
                                              borderRadius: '20px',
                                              transition: 'all 0.3s ease',
                                              boxShadow:
                                                '0 2px 4px rgba(0,0,0,0.1)',
                                            }}
                                            whileHover={{
                                              scale: 1.05,
                                              y: -2,
                                              boxShadow:
                                                '0 4px 8px rgba(0,0,0,0.15)',
                                            }}
                                            whileTap={{ scale: 0.95 }}
                                          >
                                            <FaChevronUp className='me-1' />
                                            Load more messages
                                          </motion.button>
                                        </motion.div>
                                      )}

                                    {messages.map((message, index) => {
                                      const isOwnMessage =
                                        message.userId._id === currentUserId;
                                      const canEditOrDelete =
                                        message.userId._id === currentUserId &&
                                        canSendNewMessage(selectedEvent); // Chỉ người gửi mới có thể edit/delete và sự kiện chưa kết thúc
                                      const isSystemMessage =
                                        message.isSystemMessage;

                                      // System messages - special rendering
                                      if (isSystemMessage) {
                                        return (
                                          <div
                                            key={message._id}
                                            className='messenger-message messenger-system'
                                            style={{
                                              justifyContent: 'center',
                                              marginBottom: '16px',
                                            }}
                                          >
                                            <div
                                              className='messenger-system-bubble'
                                              style={{
                                                backgroundColor: '#fff3cd',
                                                border: '1px solid #ffeaa7',
                                                borderRadius: '16px',
                                                padding: '12px 16px',
                                                maxWidth: '80%',
                                                textAlign: 'center',
                                                color: '#856404',
                                                fontSize: '0.9rem',
                                                boxShadow:
                                                  '0 2px 4px rgba(0,0,0,0.1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                              }}
                                            >
                                              <span
                                                style={{ fontSize: '1.1rem' }}
                                              >
                                                🔔
                                              </span>
                                              <span>{message.content}</span>
                                            </div>
                                            <div
                                              className='messenger-time'
                                              style={{
                                                textAlign: 'center',
                                                marginTop: '4px',
                                                fontSize: '0.8rem',
                                                color: '#6c757d',
                                              }}
                                            >
                                              {new Date(
                                                message.createdAt
                                              ).toLocaleString('vi-VN', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                day: '2-digit',
                                                month: '2-digit',
                                              })}
                                            </div>
                                          </div>
                                        );
                                      }

                                      // Regular messages
                                      return (
                                        <div
                                          key={message._id}
                                          className={`messenger-message ${
                                            isOwnMessage
                                              ? 'messenger-own'
                                              : 'messenger-other'
                                          } ${
                                            !canEditOrDelete && isOwnMessage
                                              ? 'messenger-readonly'
                                              : ''
                                          }`}
                                          title={
                                            !canEditOrDelete && isOwnMessage
                                              ? 'Cannot edit/delete this message'
                                              : ''
                                          }
                                          onClick={(e) =>
                                            handleMessageClick(message, e)
                                          }
                                          onContextMenu={(e) =>
                                            handleMessageRightClick(message, e)
                                          }
                                        >
                                          {/* Avatar luôn ở đầu */}
                                          <img
                                            src={
                                              message.userId.avatar ||
                                              '/images/user-avatar-default.png'
                                            }
                                            alt={
                                              message.userId.fullname ||
                                              message.userId.username
                                            }
                                            className='messenger-avatar'
                                          />

                                          <div className='messenger-content'>
                                            {/* Tên người gửi (chỉ hiện cho tin nhắn của người khác) */}
                                            {!isOwnMessage && (
                                              <div className='messenger-sender'>
                                                {message.userId.fullname ||
                                                  message.userId.username}
                                              </div>
                                            )}

                                            {/* Nội dung tin nhắn */}
                                            <div className='messenger-bubble-wrapper'>
                                              {editingMessageId ===
                                              message._id ? (
                                                <div className='messenger-edit-form'>
                                                  <input
                                                    type='text'
                                                    value={editingContent}
                                                    onChange={(e) =>
                                                      setEditingContent(
                                                        e.target.value
                                                      )
                                                    }
                                                    onKeyPress={(e) => {
                                                      if (
                                                        e.key === 'Enter' &&
                                                        !e.shiftKey
                                                      ) {
                                                        e.preventDefault();
                                                        submitMessageEdit(
                                                          message._id
                                                        );
                                                      } else if (
                                                        e.key === 'Escape'
                                                      ) {
                                                        cancelEditing();
                                                      }
                                                    }}
                                                    className='messenger-edit-input'
                                                    autoFocus
                                                  />
                                                  <div className='messenger-edit-actions'>
                                                    <button
                                                      className='messenger-edit-save'
                                                      onClick={() =>
                                                        submitMessageEdit(
                                                          message._id
                                                        )
                                                      }
                                                    >
                                                      ✓
                                                    </button>
                                                    <button
                                                      className='messenger-edit-cancel'
                                                      onClick={cancelEditing}
                                                    >
                                                      ✕
                                                    </button>
                                                  </div>
                                                </div>
                                              ) : (
                                                <div
                                                  className={`messenger-bubble ${
                                                    isOwnMessage
                                                      ? 'messenger-bubble-own'
                                                      : 'messenger-bubble-other'
                                                  }`}
                                                  onDoubleClick={() =>
                                                    canEditOrDelete &&
                                                    canSendNewMessage(
                                                      selectedEvent
                                                    ) &&
                                                    startEditing(message)
                                                  }
                                                >
                                                  <div className='messenger-text'>
                                                    {message.content}
                                                    {message.isEdited && (
                                                      <span className='messenger-edited'>
                                                        {' '}
                                                        • edited
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                            </div>

                                            {/* Thời gian */}
                                            <div className='messenger-time'>
                                              {new Date(
                                                message.createdAt
                                              ).toLocaleString('vi-VN', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })}
                                              {message.isEdited &&
                                                message.editedAt && (
                                                  <span className='messenger-time-edited'>
                                                    {' • Sửa '}
                                                    {new Date(
                                                      message.editedAt
                                                    ).toLocaleString('vi-VN', {
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                    })}
                                                  </span>
                                                )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    <div ref={messagesEndRef} />
                                  </>
                                )}
                              </div>

                              {/* Context Menu */}
                              {contextMenu &&
                                canSendNewMessage(selectedEvent) && (
                                  <div
                                    className='messenger-context-menu'
                                    style={{
                                      left: contextMenu.x,
                                      top: contextMenu.y,
                                    }}
                                  >
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        startEditing(contextMenu.message);
                                      }}
                                      className='messenger-action-item'
                                    >
                                      <FaEdit />
                                      Edit
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteMessage(
                                          contextMenu.messageId
                                        );
                                      }}
                                      className='messenger-action-item messenger-delete'
                                    >
                                      <FaTrash />
                                      Delete
                                    </button>
                                  </div>
                                )}

                              {/* Message Input */}
                              {canSendNewMessage(selectedEvent) && (
                                <div className='message-input d-flex gap-2'>
                                  <Form.Control
                                    type='text'
                                    placeholder='Type a message...'
                                    value={newMessage}
                                    onChange={(e) =>
                                      setNewMessage(e.target.value)
                                    }
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                      }
                                    }}
                                  />
                                  <Button
                                    variant='primary'
                                    onClick={handleSendMessage}
                                    disabled={!newMessage.trim()}
                                  >
                                    <FaPaperPlane />
                                  </Button>
                                </div>
                              )}

                              {!canSendNewMessage(selectedEvent) &&
                                canUserChat(selectedEvent) && (
                                  <div
                                    className='text-center text-muted p-2 border rounded'
                                    style={{ backgroundColor: '#f8f9fa' }}
                                  >
                                    <i className='fas fa-info-circle me-2'></i>
                                    {selectedEvent.status === 'completed' &&
                                      'Event has ended. You can only view messages.'}
                                    {selectedEvent.status === 'cancelled' &&
                                      'Event has been cancelled. You can only view messages.'}
                                    {!['completed', 'cancelled'].includes(
                                      selectedEvent.status
                                    ) && 'Cannot send messages.'}
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                  {(canModifyEvent(selectedEvent) ||
                    selectedEvent.participants?.some(
                      (p) =>
                        p.userId === currentUserId &&
                        p.status === 'accepted' &&
                        selectedEvent.organizer?.userId !== currentUserId
                    )) && (
                    <div className='event-modal-actions'>
                      {canEditEvent(selectedEvent) && !showChat && (
                        <Button
                          variant='outline-light'
                          onClick={handleEditClick}
                          disabled={isUpdatingEvent}
                          className='d-flex justify-content-center align-items-center'
                        >
                          <FaEdit className='me-2' />
                          Edit
                        </Button>
                      )}
                      {canDeleteEvent(selectedEvent) && !showChat && (
                        <Button
                          variant='outline-danger'
                          onClick={() => setShowDeleteModal(true)}
                          disabled={isUpdatingEvent}
                          className='d-flex justify-content-center align-items-center'
                        >
                          <FaTrash className='me-2' />
                          Delete
                        </Button>
                      )}
                      {/* Cancel participation button for accepted participants who are not organizers */}
                      {selectedEvent.participants?.some(
                        (p) =>
                          p.userId === currentUserId &&
                          p.status === 'accepted' &&
                          selectedEvent.organizer?.userId !== currentUserId &&
                          selectedEvent.status === 'scheduled'
                      ) &&
                        !showChat && (
                          <Button
                            variant='outline-warning'
                            onClick={() => handleOpenCancelModal(selectedEvent)}
                            disabled={isUpdatingEvent}
                            className='cancel-participation-btn'
                          >
                            <i className='bi bi-x-circle'></i>
                            Cancel join
                          </Button>
                        )}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Create Modal */}
          <Modal
            show={showCreateModal}
            onHide={() => setShowCreateModal(false)}
            centered
            className='custom-modal'
            backdrop='static'
            size='lg'
          >
            <Modal.Header className='mx-3' closeButton>
              <Modal.Title>Create new event</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form onSubmit={handleCreateSubmit}>
                <Row>
                  <Col>
                    <Form.Group className='mb-3'>
                      <Form.Label>Title *</Form.Label>
                      <Form.Control
                        type='text'
                        value={formData.title}
                        onChange={(e) =>
                          setFormData({ ...formData, title: e.target.value })
                        }
                        placeholder='Input title...'
                        required
                      />
                    </Form.Group>
                  </Col>
                  {/* <Col md={4}>
                  <Form.Group className='mb-3'>
                    <Form.Label>Trạng thái</Form.Label>
                    <Form.Select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col> */}
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className='mb-3'>
                      <Form.Label>Start date *</Form.Label>
                      <Form.Control
                        type={formData.allDay ? 'date' : 'datetime-local'}
                        value={
                          formData.allDay
                            ? formData.startDate.split('T')[0]
                            : formData.startDate
                        }
                        min={
                          formData.allDay
                            ? formatVietnamTimeForInput(true)
                            : formatVietnamTimeForInput(false)
                        }
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            startDate: formData.allDay
                              ? e.target.value + 'T00:00'
                              : e.target.value,
                          })
                        }
                        required={!formData.allDay}
                        disabled={formData.allDay}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className='mb-3'>
                      <Form.Label>End date *</Form.Label>
                      <Form.Control
                        type={formData.allDay ? 'date' : 'datetime-local'}
                        value={
                          formData.allDay
                            ? formData.endDate.split('T')[0]
                            : formData.endDate
                        }
                        min={
                          formData.allDay
                            ? formatVietnamTimeForInput(true)
                            : formatVietnamTimeForInput(false)
                        }
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            endDate: formData.allDay
                              ? e.target.value + 'T23:59'
                              : e.target.value,
                          })
                        }
                        required={!formData.allDay}
                        disabled={formData.allDay}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group className='mb-3'>
                  <Form.Check
                    type='checkbox'
                    label='All day'
                    checked={formData.allDay}
                    onChange={(e) =>
                      setFormData({ ...formData, allDay: e.target.checked })
                    }
                  />
                </Form.Group>
                <Form.Group className='mb-3'>
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as='textarea'
                    rows={3}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder='Describe details of event...'
                  />
                </Form.Group>
                <Form.Group className='mb-3'>
                  <Form.Label>Type of event</Form.Label>
                  <Form.Select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                  >
                    {Object.entries(eventTypes).map(([key, type]) => (
                      <option key={key} value={key}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                {formData.type === 'offline' && (
                  <Form.Group className='mb-3'>
                    <Form.Label>Address *</Form.Label>
                    <Form.Control
                      type='text'
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      placeholder='Example: Trường Đại học FPT Hà Nội'
                      required
                    />
                    <Form.Text className='text-muted'>
                      {/* Nhập địa chỉ chi tiết để hệ thống tự động xác định tọa độ
                      trên bản đồ */}
                      Enter a detailed address
                    </Form.Text>
                  </Form.Group>
                )}
                {/* <Form.Group className='mb-3'>
                <Form.Label>Lặp lại</Form.Label>
                <Form.Select
                  value={formData.recurrence}
                  onChange={(e) =>
                    setFormData({ ...formData, recurrence: e.target.value })
                  }
                >
                  {recurrenceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group> */}
                <Form.Group className='mb-3'>
                  <Form.Label>
                    Invite other people (emails separated by commas)
                  </Form.Label>
                  <Form.Control
                    type='text'
                    value={formData.participantEmails}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        participantEmails: e.target.value,
                      })
                    }
                    placeholder='Input email(s) to invite, separated by commas'
                  />
                  <Form.Text className='text-muted'>
                    Enter emails of users you want to invite to this event.
                    Example: user1@gmail.com, user2@fpt.edu.vn
                  </Form.Text>
                </Form.Group>
                <div className='d-flex justify-content-end gap-2'>
                  <Button
                    variant='outline-light'
                    onClick={() => setShowCreateModal(false)}
                    type='button'
                    disabled={isCreatingEvent}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant='primary'
                    type='submit'
                    disabled={isCreatingEvent}
                  >
                    {isCreatingEvent ? (
                      <>
                        <Spinner
                          as='span'
                          animation='border'
                          size='sm'
                          role='status'
                          aria-hidden='true'
                          className='me-2'
                        />
                        Creating...
                      </>
                    ) : (
                      <>Create</>
                    )}
                  </Button>
                </div>
              </Form>
            </Modal.Body>
          </Modal>

          {/* Edit Modal */}
          <Modal
            show={showEditModal}
            onHide={() => setShowEditModal(false)}
            centered
            className='custom-modal'
            backdrop='static'
            size='lg'
          >
            <Modal.Header closeButton>
              <Modal.Title>
                <FaEdit className='me-2' />
                Edit event
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form onSubmit={handleEditSubmit}>
                <Row>
                  <Col>
                    <Form.Group className='mb-3'>
                      <Form.Label>Title *</Form.Label>
                      <Form.Control
                        type='text'
                        value={editFormData.title || ''}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            title: e.target.value,
                          })
                        }
                        placeholder='Input title...'
                        required
                      />
                    </Form.Group>
                  </Col>
                  {/* <Col md={4}>
                  <Form.Group className='mb-3'>
                    <Form.Label>Trạng thái</Form.Label>
                    <Form.Select
                      value={editFormData.status || 'scheduled'}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          status: e.target.value,
                        })
                      }
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col> */}
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className='mb-3'>
                      <Form.Label>Start date *</Form.Label>
                      <Form.Control
                        type={editFormData.allDay ? 'date' : 'datetime-local'}
                        value={
                          editFormData.allDay
                            ? (editFormData.startDate || '').split('T')[0]
                            : editFormData.startDate || ''
                        }
                        min={
                          editFormData.allDay
                            ? formatVietnamTimeForInput(true)
                            : formatVietnamTimeForInput(false)
                        }
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            startDate: editFormData.allDay
                              ? e.target.value + 'T00:00'
                              : e.target.value,
                          })
                        }
                        required={!editFormData.allDay}
                        disabled={editFormData.allDay}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className='mb-3'>
                      <Form.Label>End date *</Form.Label>
                      <Form.Control
                        type={editFormData.allDay ? 'date' : 'datetime-local'}
                        value={
                          editFormData.allDay
                            ? (editFormData.endDate || '').split('T')[0]
                            : editFormData.endDate || ''
                        }
                        min={
                          editFormData.allDay
                            ? formatVietnamTimeForInput(true)
                            : formatVietnamTimeForInput(false)
                        }
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            endDate: editFormData.allDay
                              ? e.target.value + 'T23:59'
                              : e.target.value,
                          })
                        }
                        required={!editFormData.allDay}
                        disabled={editFormData.allDay}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group className='mb-3'>
                  <Form.Check
                    type='checkbox'
                    label='All day'
                    checked={editFormData.allDay || false}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        allDay: e.target.checked,
                      })
                    }
                  />
                </Form.Group>
                <Form.Group className='mb-3'>
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as='textarea'
                    rows={3}
                    value={editFormData.description || ''}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        description: e.target.value,
                      })
                    }
                    placeholder='Describe details of event...'
                  />
                </Form.Group>
                <Form.Group className='mb-3'>
                  <Form.Label>Type of event</Form.Label>
                  <Form.Select
                    value={editFormData.type || 'offline'}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, type: e.target.value })
                    }
                  >
                    {Object.entries(eventTypes).map(([key, type]) => (
                      <option key={key} value={key}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                {editFormData.type === 'offline' && (
                  <Form.Group className='mb-3'>
                    <Form.Label>Address *</Form.Label>
                    <Form.Control
                      type='text'
                      value={editFormData.address || ''}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          address: e.target.value,
                        })
                      }
                      placeholder='Example: Trường Đại học FPT Hà Nội'
                      required
                    />
                    <Form.Text className='text-muted'>
                      Nhập địa chỉ chi tiết để hệ thống tự động xác định tọa độ
                      trên bản đồ
                    </Form.Text>
                  </Form.Group>
                )}
                {/* <Form.Group className='mb-3'>
                <Form.Label>Lặp lại</Form.Label>
                <Form.Select
                  value={editFormData.recurrence || ''}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      recurrence: e.target.value,
                    })
                  }
                >
                  {recurrenceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group> */}
                <Form.Group className='mb-3'>
                  <Form.Label>
                    Invite other people (emails separated by commas)
                  </Form.Label>
                  <Form.Control
                    type='text'
                    value={editFormData.participantEmails || ''}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        participantEmails: e.target.value,
                      })
                    }
                    placeholder='Input email(s) to invite, separated by commas'
                  />
                </Form.Group>
                <div className='d-flex justify-content-end gap-2'>
                  <Button
                    variant='outline-light'
                    onClick={() => setShowEditModal(false)}
                    type='button'
                    disabled={isUpdatingEvent}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant='success'
                    type='submit'
                    disabled={isUpdatingEvent}
                  >
                    {isUpdatingEvent ? (
                      <>
                        <Spinner
                          as='span'
                          animation='border'
                          size='sm'
                          role='status'
                          aria-hidden='true'
                          className='me-2'
                        />
                        Updating...
                      </>
                    ) : (
                      <>Update</>
                    )}
                  </Button>
                </div>
              </Form>
            </Modal.Body>
          </Modal>

          {/* Delete Confirmation Modal */}
          <Modal
            show={showDeleteModal}
            onHide={() => setShowDeleteModal(false)}
            centered
            backdrop='static'
          >
            <Modal.Header closeButton>
              <Modal.Title>Confirm to delete event</Modal.Title>
            </Modal.Header>
            <Modal.Body>Are you sure to delete this event?</Modal.Body>
            <Modal.Footer>
              <Button
                variant='secondary'
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </Button>
              <Button variant='danger' onClick={handleDeleteEvent}>
                Delete
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Cancel Participation Modal */}
          {renderCancelModal()}

          {/* Main Conflict Modal */}
          {renderMainConflictModal()}

          {/* Conflict Modal */}
          <Modal
            show={showConflictModal}
            onHide={handleCloseConflictModal}
            centered
            className='conflict-modal'
            backdrop='static'
          >
            <Modal.Header closeButton>
              <Modal.Title className='text-black'>
                ⚠️ Conflict with available event(s)
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {conflictEventData && (
                <div>
                  <div className='alert alert-warning'>
                    <strong>{conflictEventData.message}</strong>
                  </div>

                  <div className='mb-3'>
                    <h6>Event you want to join:</h6>
                    <div className='border rounded p-2 bg-light'>
                      <strong>{conflictEventData.currentEvent?.title}</strong>
                      <br />
                      <small className='text-muted'>
                        {conflictEventData.currentEvent?.allDay ? (
                          <>
                            {new Intl.DateTimeFormat('vi-VN', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              timeZone: 'Asia/Ho_Chi_Minh',
                            }).format(
                              new Date(
                                conflictEventData.currentEvent?.startDate
                              )
                            )}{' '}
                            <span className='text-info'>(all day)</span>
                          </>
                        ) : (
                          <>
                            {formatEventDate(
                              new Date(
                                conflictEventData.currentEvent?.startDate
                              )
                            )}{' '}
                            -{' '}
                            {formatEventDate(
                              new Date(conflictEventData.currentEvent?.endDate)
                            )}
                          </>
                        )}
                      </small>
                    </div>
                  </div>

                  <div className='mb-3'>
                    <h6>Available event(s):</h6>
                    {conflictEventData.conflictingEvents?.map(
                      (event, index) => (
                        <div
                          key={event.id}
                          className='border rounded p-2 mb-2 bg-danger-subtle'
                        >
                          <strong>{event.title}</strong>
                          <br />
                          <small className='text-muted'>
                            {event.allDay ? (
                              <>
                                {new Intl.DateTimeFormat('vi-VN', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  timeZone: 'Asia/Ho_Chi_Minh',
                                }).format(new Date(event.startDate))}{' '}
                                <span className='text-info'>(all day)</span>
                              </>
                            ) : (
                              <>
                                {formatEventDate(new Date(event.startDate))} -{' '}
                                {formatEventDate(new Date(event.endDate))}
                              </>
                            )}
                          </small>
                          {/* <br />
                          <small className='text-info'>
                            📅 {event.calendarName}
                          </small> */}
                        </div>
                      )
                    )}
                  </div>

                  <div className='alert alert-info'>
                    <small>
                      <i className='bi bi-info-circle'></i> You can still accept
                      to attend this event, but make sure you can arrange the
                      time accordingly.
                    </small>
                  </div>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant='secondary'
                onClick={handleCloseConflictModal}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant='warning'
                onClick={handleAcceptWithConflict}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Spinner
                      as='span'
                      animation='border'
                      size='sm'
                      role='status'
                      aria-hidden='true'
                      className='me-2'
                    />
                    Processing...
                  </>
                ) : (
                  'Still join'
                )}
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Create Event Conflict Modal */}
          <Modal
            show={showCreateConflictModal}
            onHide={handleCloseCreateConflictModal}
            centered
            className='conflict-modal'
            backdrop='static'
          >
            <Modal.Header closeButton>
              <Modal.Title className='text-black'>
                ⚠️ Conflict with available event(s)
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {createConflictData && (
                <div>
                  <div className='alert alert-warning'>
                    <strong>{createConflictData.message}</strong>
                  </div>

                  <div className='mb-3'>
                    <h6>Event you want to create:</h6>
                    <div className='border rounded p-2 bg-light'>
                      <strong>{createConflictData.newEvent?.title}</strong>
                      <br />
                      <small className='text-muted'>
                        {createConflictData.newEvent?.allDay ? (
                          <>
                            {new Intl.DateTimeFormat('vi-VN', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              timeZone: 'Asia/Ho_Chi_Minh',
                            }).format(
                              new Date(createConflictData.newEvent?.startDate)
                            )}{' '}
                            <span className='text-info'>(all day)</span>
                          </>
                        ) : (
                          <>
                            {formatEventDate(
                              new Date(createConflictData.newEvent?.startDate)
                            )}{' '}
                            -{' '}
                            {formatEventDate(
                              new Date(createConflictData.newEvent?.endDate)
                            )}
                          </>
                        )}
                      </small>
                    </div>
                  </div>

                  <div className='mb-3'>
                    <h6>Available event(s):</h6>
                    {createConflictData.conflictingEvents?.map(
                      (event, index) => (
                        <div
                          key={event.id}
                          className='border rounded p-2 mb-2 bg-danger-subtle'
                        >
                          <strong>{event.title}</strong>
                          <br />
                          <small className='text-muted'>
                            {event.allDay ? (
                              <>
                                {new Intl.DateTimeFormat('vi-VN', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  timeZone: 'Asia/Ho_Chi_Minh',
                                }).format(new Date(event.startDate))}{' '}
                                <span className='text-info'>(all day)</span>
                              </>
                            ) : (
                              <>
                                {formatEventDate(new Date(event.startDate))} -{' '}
                                {formatEventDate(new Date(event.endDate))}
                              </>
                            )}
                          </small>
                          {/* <br />
                          <small className='text-info'>
                            📅 {event.calendarName}
                          </small> */}
                        </div>
                      )
                    )}
                  </div>

                  <div className='alert alert-info'>
                    <small>
                      <i className='bi bi-info-circle'></i> You can still create
                      this event, but make sure you can schedule it accordingly.
                    </small>
                  </div>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant='secondary'
                onClick={handleCloseCreateConflictModal}
                disabled={isCreatingEvent}
              >
                Cancel
              </Button>
              <Button
                variant='warning'
                onClick={handleCreateWithConflict}
                disabled={isCreatingEvent}
              >
                {isCreatingEvent ? (
                  <>
                    <Spinner
                      as='span'
                      animation='border'
                      size='sm'
                      role='status'
                      aria-hidden='true'
                      className='me-2'
                    />
                    Đang tạo...
                  </>
                ) : (
                  'Still creating'
                )}
              </Button>
            </Modal.Footer>
          </Modal>
        </div>
      </div>
    </>
  );
};

export default Calendar;
