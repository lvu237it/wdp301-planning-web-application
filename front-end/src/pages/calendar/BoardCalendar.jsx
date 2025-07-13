import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import viLocale from '@fullcalendar/core/locales/vi';
import {
  Modal,
  Button,
  Form,
  Alert,
  Badge,
  Spinner,
  Container,
  Row,
  Col,
} from 'react-bootstrap';
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
  FaMapMarkerAlt,
  FaGlobe,
  FaCheck,
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useCommon } from '../../contexts/CommonContext';
import axios from 'axios';
import '../../styles/boardcalendar.css';

// Utility functions
const formatDateTimeForInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const generateMapsUrl = (address) => {
  let query = '';
  if (typeof address === 'string') {
    query = encodeURIComponent(address);
  } else if (address?.coordinates && address.coordinates.length === 2) {
    query = `${address.coordinates[1]},${address.coordinates[0]}`;
  } else if (address?.formattedAddress) {
    query = encodeURIComponent(address.formattedAddress);
  } else if (address?.locationName) {
    query = encodeURIComponent(address.locationName);
  }
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
};

const getAddressDisplay = (address) => {
  if (typeof address === 'string') return address;
  if (address?.formattedAddress) return address.formattedAddress;
  if (address?.locationName) return address.locationName;
  return 'Địa chỉ không xác định';
};

function BoardCalendar() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const {
    userDataLocal,
    apiBaseUrl,
    accessToken,
    getBoardCalendar,
    sendEventMessage,
    getEventMessages,
    editEventMessage,
    deleteEventMessage,
    toast,
    currentWorkspaceId,
  } = useCommon();

  // Core states
  const [events, setEvents] = useState([]);
  const [board, setBoard] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [boardMembers, setBoardMembers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Modal states
  const [showEventModal, setShowEventModal] = useState(false);
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);
  const [showCreateConflictModal, setShowCreateConflictModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Conflict checking
  const [conflictEvents, setConflictEvents] = useState([]);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);

  // Chat functionality
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [canSendMessage, setCanSendMessage] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const messagesEndRef = useRef(null);

  // Loading states
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  // Form states
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    startDate: formatDateTimeForInput(new Date()),
    endDate: formatDateTimeForInput(new Date()),
    type: 'offline',
    locationName: '',
    onlineUrl: '',
    allDay: false,
    participantEmails: '',
    status: 'scheduled',
  });

  const calendarRef = useRef(null);
  const currentUserId = userDataLocal?._id || userDataLocal?.id;

  const location = useLocation();
  // const { workspaceId } = location.state || {};

  // Event types definition
  const eventTypes = useMemo(
    () => ({
      online: {
        label: 'Trực tuyến',
        color: '#2196F3',
        icon: '🌐',
        description: 'Sự kiện diễn ra trực tuyến',
      },
      offline: {
        label: 'Trực tiếp',
        color: '#4CAF50',
        icon: '📍',
        description: 'Sự kiện tại địa điểm cụ thể',
      },
    }),
    []
  );

  // Status options
  const statusOptions = useMemo(
    () => [
      { value: 'draft', label: 'Nháp' },
      { value: 'scheduled', label: 'Chưa diễn ra' },
      { value: 'in-progress', label: 'Đang diễn ra' },
      { value: 'completed', label: 'Đã xong' },
      { value: 'cancelled', label: 'Đã hủy' },
    ],
    []
  );

  // Format event date
  const formatEventDate = useCallback((date) => {
    if (!(date instanceof Date) || isNaN(date)) {
      const dateObj = new Date(date);
      if (isNaN(dateObj)) return '';
      date = dateObj;
    }
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

  // Calculate events for selected date
  const selectedDateEvents = useMemo(() => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    return events.filter((event) => {
      if (!event.start) return false;
      const eventStart = new Date(event.start);
      const eventDateStr = eventStart.toISOString().split('T')[0];
      return eventDateStr === dateStr;
    });
  }, [selectedDate, events]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        await Promise.all([
          fetchBoard(),
          fetchBoardCalendar(),
          fetchBoardMembers(),
        ]);

        // Test backend connection
        await testBackendConnection();
      } catch (error) {
        console.error('Error loading initial data:', error);
        toast.error('Có lỗi khi tải dữ liệu');
      } finally {
        setLoading(false);
      }
    };

    if (boardId && userDataLocal && accessToken) {
      console.log('Đang load dữ liệu cho BoardCalendar');
      loadInitialData();
    }
  }, [boardId, userDataLocal, accessToken]);

  useEffect(() => {
    console.log('board', board);
  }, [board]);

  // Setup real-time chat listeners
  useEffect(() => {
    const handleNewMessage = (e) => {
      const { message, eventId } = e.detail;
      if (selectedEvent?.id === eventId) {
        setMessages((prev) => [...prev, message]);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    };

    const handleEditMessage = (e) => {
      const { message, eventId } = e.detail;
      if (selectedEvent?.id === eventId) {
        setMessages((prev) =>
          prev.map((msg) => (msg._id === message._id ? message : msg))
        );
      }
    };

    const handleDeleteMessage = (e) => {
      const { messageId, eventId } = e.detail;
      if (selectedEvent?.id === eventId) {
        setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
      }
    };

    window.addEventListener('new_event_message', handleNewMessage);
    window.addEventListener('edit_event_message', handleEditMessage);
    window.addEventListener('delete_event_message', handleDeleteMessage);

    return () => {
      window.removeEventListener('new_event_message', handleNewMessage);
      window.removeEventListener('edit_event_message', handleEditMessage);
      window.removeEventListener('delete_event_message', handleDeleteMessage);
    };
  }, [selectedEvent?.id]);

  // Load events when calendar is available
  useEffect(() => {
    if (calendar && accessToken) {
      fetchEvents();
    }
  }, [calendar, accessToken]);

  // Setup real-time event listeners
  useEffect(() => {
    const handleEventUpdate = () => {
      if (calendar) {
        fetchEvents();
      }
    };

    window.addEventListener('event_updated', handleEventUpdate);
    window.addEventListener('event_created', handleEventUpdate);
    window.addEventListener('event_deleted', handleEventUpdate);

    return () => {
      window.removeEventListener('event_updated', handleEventUpdate);
      window.removeEventListener('event_created', handleEventUpdate);
      window.removeEventListener('event_deleted', handleEventUpdate);
    };
  }, [calendar]);

  // API functions
  const fetchBoard = async () => {
    try {
      const response = await axios.get(
        `${apiBaseUrl}/workspace/${currentWorkspaceId}/board/${boardId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          withCredentials: true,
        }
      );

      console.log('Tải thông tin board', response);

      if (response.status === 200) {
        const boardData = response.data.data || response.data.board;
        setBoard(boardData);
      }
    } catch (error) {
      console.error('Error fetching board:', error);
      toast.error('Không thể tải thông tin board');
    }
  };

  const fetchBoardCalendar = async () => {
    try {
      const result = await getBoardCalendar(boardId);
      console.log('fetch boarch calendar result', result);

      if (result.data.length > 0) {
        setCalendar(result.data[0]);
      } else {
        setCalendar(null);
      }
    } catch (error) {
      console.error('Error fetching board calendar:', error);
    }
  };

  const fetchBoardMembers = async () => {
    try {
      const response = await axios.get(
        `${apiBaseUrl}/workspace/${currentWorkspaceId}/board/${boardId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          withCredentials: true,
        }
      );

      console.log('fetch boarch member result', response);

      if (response.data.success && response.data.board?.members) {
        setBoardMembers(response.data.board.members);
      }
    } catch (error) {
      console.error('Error fetching board members:', error);
      setBoardMembers([]);
    }
  };

  const fetchEvents = async () => {
    try {
      if (!calendar || !accessToken) {
        setEvents([]);
        return;
      }

      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 2);

      const response = await axios.get(
        `${apiBaseUrl}/calendar/${calendar._id}/events`,
        {
          params: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
          headers: { Authorization: `Bearer ${accessToken}` },
          withCredentials: true,
        }
      );

      console.log('fetch event', response);

      if (response.status === 200) {
        setEvents(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      setEvents([]);
    }
  };

  // Event handlers
  const handleDateSelect = (selectInfo) => {
    selectInfo.jsEvent.preventDefault();
    selectInfo.jsEvent.stopPropagation();

    setSelectedDate(selectInfo.start);
    setEventForm({
      ...eventForm,
      startDate: formatDateTimeForInput(selectInfo.start),
      endDate: formatDateTimeForInput(
        new Date(selectInfo.start.getTime() + 60 * 60 * 1000)
      ),
    });
    setSelectedEvent(null);
    setShowEventModal(true);
  };

  const handleEventClick = (clickInfo) => {
    clickInfo.jsEvent.preventDefault();
    clickInfo.jsEvent.stopPropagation();

    const eventData = clickInfo.event;
    setSelectedEvent({
      id: eventData.id,
      title: eventData.title,
      description: eventData.extendedProps.description,
      start: eventData.start,
      end: eventData.end,
      type: eventData.extendedProps.type,
      locationName: eventData.extendedProps.locationName,
      onlineUrl: eventData.extendedProps.onlineUrl,
      organizer: eventData.extendedProps.organizer,
      participants: eventData.extendedProps.participants,
      allDay: eventData.allDay,
      status: eventData.extendedProps.status,
      address: eventData.extendedProps.address,
      isOwn: eventData.extendedProps.isOwn,
      canEdit: eventData.extendedProps.canEdit,
    });
    setShowEventDetailModal(true);
  };

  // Check for event conflicts
  const checkEventConflicts = async (eventData) => {
    if (!accessToken || !eventData.startDate || !eventData.endDate) {
      return { hasConflict: false, conflicts: [] };
    }

    try {
      setIsCheckingConflicts(true);
      const response = await axios.post(
        `${apiBaseUrl}/event/check-conflicts`,
        {
          startDate: eventData.startDate,
          endDate: eventData.endDate,
          boardId: boardId,
          excludeEventId: selectedEvent?.id || null,
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          withCredentials: true,
        }
      );

      if (response.data.success) {
        return {
          hasConflict: response.data.data?.hasConflict || false,
          conflicts: response.data.data?.conflicts || [],
        };
      }
    } catch (error) {
      console.error('Error checking conflicts:', error);
    } finally {
      setIsCheckingConflicts(false);
    }

    return { hasConflict: false, conflicts: [] };
  };

  // Handle creating event with conflicts
  const handleCreateWithConflict = async () => {
    try {
      setIsCreatingEvent(true);
      console.log('calendar._id', calendar._id);
      console.log('apiBaseUrl', apiBaseUrl);
      console.log(
        'Full URL:',
        `${apiBaseUrl}/event/create-event-for-calendar/${calendar._id}`
      );
      console.log('Board data:', board);
      console.log('currentWorkspaceId:', currentWorkspaceId);

      // Validate calendar exists
      if (!calendar || !calendar._id) {
        toast.error('Không tìm thấy lịch board. Vui lòng thử lại.');
        setIsCreatingEvent(false);
        return;
      }

      const response = await axios.post(
        `${apiBaseUrl}/event/create-event-for-calendar/${calendar._id}`,
        {
          ...eventForm,
          boardId,
          workspaceId: currentWorkspaceId,
          participantEmails: eventForm.participantEmails
            ? eventForm.participantEmails
                .split(',')
                .map((email) => email.trim())
                .filter((email) => email)
            : [],
          timeZone: 'Asia/Ho_Chi_Minh',
          address: eventForm.type === 'offline' ? eventForm.locationName : null,
          onlineUrl: eventForm.type === 'online' ? eventForm.onlineUrl : null,
          forceCreate: true,
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          withCredentials: true,
        }
      );

      console.log(
        'response when headnle conflic create event calendar._id',
        calendar._id
      );
      console.log('response when headnle conflic create event', response);

      if (response.data.status === 201) {
        await fetchEvents();
        handleCloseEventModal();
        setShowCreateConflictModal(false);
        toast.success('Tạo sự kiện thành công!');
      } else {
        toast.error(`Lỗi: ${response.data.message || 'Không thể tạo sự kiện'}`);
      }
    } catch (error) {
      console.error('Error creating event with conflict:', error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      toast.error('Lỗi kết nối khi tạo sự kiện');
    } finally {
      setIsCreatingEvent(false);
    }
  };

  // Chat functions
  const loadEventMessages = async (eventId, limit = 30) => {
    try {
      setIsLoadingMessages(true);
      const result = await getEventMessages(eventId, limit, 0);
      if (result.success) {
        setMessages(result.data || []);
        setCanSendMessage(shouldShowChatFeature(selectedEvent));
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedEvent?.id) return;

    try {
      const result = await sendEventMessage(
        selectedEvent.id,
        newMessage.trim()
      );
      if (result.success) {
        setNewMessage('');
        // Messages will be updated via socket
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Không thể gửi tin nhắn');
    }
  };

  const handleEditMessage = async (messageId, content) => {
    try {
      const result = await editEventMessage(messageId, content);
      if (result.success) {
        setEditingMessageId(null);
        setEditingContent('');
      }
    } catch (error) {
      console.error('Error editing message:', error);
      toast.error('Không thể chỉnh sửa tin nhắn');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const result = await deleteEventMessage(messageId);
      if (result.success) {
        // Messages will be updated via socket
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Không thể xóa tin nhắn');
    }
  };

  const startEditing = (message) => {
    setEditingMessageId(message._id);
    setEditingContent(message.content);
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

    // Owner can always chat
    if (
      event.organizer?._id === currentUserId ||
      event.organizer?.userId === currentUserId
    ) {
      return true;
    }

    // Check if user is a participant
    const isParticipant = event.participants?.some(
      (p) => p.userId?._id === currentUserId || p.userId === currentUserId
    );

    return isParticipant;
  };

  const shouldShowChatFeature = (event) => {
    if (!event) return false;
    const allowedStatuses = ['scheduled', 'in-progress', 'draft'];
    return allowedStatuses.includes(event.status) || !event.status;
  };

  // Handle event form submission
  const handleEventSubmit = async (e) => {
    e.preventDefault();

    if (!calendar || !accessToken) {
      toast.error('Vui lòng đăng nhập lại');
      return;
    }

    // Additional validation for calendar._id
    if (!calendar._id) {
      toast.error('Không tìm thấy lịch board. Vui lòng thử lại.');
      return;
    }

    try {
      setIsCreatingEvent(true);

      let response;

      if (selectedEvent && selectedEvent.id !== 'new') {
        // Update existing event
        response = await axios.patch(
          `${apiBaseUrl}/event/${selectedEvent.id}`,
          {
            ...eventForm,
            boardId,
            timeZone: 'Asia/Ho_Chi_Minh',
          },
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            withCredentials: true,
          }
        );
      } else {
        // Check for conflicts before creating
        const conflictCheck = await checkEventConflicts(eventForm);
        if (conflictCheck.hasConflict) {
          setConflictEvents(conflictCheck.conflicts);
          setShowCreateConflictModal(true);
          setShowEventModal(false);
          setIsCreatingEvent(false);
          return;
        }

        console.log('calendar._id', calendar._id);
        console.log('handleEventSubmit - apiBaseUrl', apiBaseUrl);
        console.log(
          'handleEventSubmit - Full URL:',
          `${apiBaseUrl}/event/create-event-for-calendar/${calendar._id}`
        );

        // Create new event
        response = await axios.post(
          `${apiBaseUrl}/event/create-event-for-calendar/${calendar._id}`,
          {
            ...eventForm,
            boardId,
            workspaceId: currentWorkspaceId,
            participantEmails: eventForm.participantEmails
              ? eventForm.participantEmails
                  .split(',')
                  .map((email) => email.trim())
                  .filter((email) => email)
              : [],
            timeZone: 'Asia/Ho_Chi_Minh',
            address:
              eventForm.type === 'offline' ? eventForm.locationName : null,
            onlineUrl: eventForm.type === 'online' ? eventForm.onlineUrl : null,
          },
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            withCredentials: true,
          }
        );
      }

      console.log('response while create new event for board', response);

      if (response.data.status === 201) {
        await fetchEvents();
        handleCloseEventModal();
        toast.success(
          selectedEvent
            ? 'Cập nhật sự kiện thành công!'
            : 'Tạo sự kiện thành công!'
        );
      } else {
        toast.error(`Lỗi: ${response.data.message || 'Không thể lưu sự kiện'}`);
      }
    } catch (error) {
      console.error('Error saving event:', error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      toast.error('Lỗi kết nối: ' + error.message);
    } finally {
      setIsCreatingEvent(false);
    }
  };

  // Handle event deletion
  const handleDeleteEvent = async (eventId) => {
    if (!eventId || !accessToken) {
      toast.error('Không thể xóa sự kiện');
      return;
    }

    try {
      const response = await axios.delete(`${apiBaseUrl}/event/${eventId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        withCredentials: true,
      });

      if (response.data.success) {
        await fetchEvents();
        setShowEventDetailModal(false);
        toast.success('Xóa sự kiện thành công');
      } else {
        toast.error(response.data.message || 'Không thể xóa sự kiện');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Lỗi kết nối khi xóa sự kiện');
    }
  };

  // Check if user can edit/delete event
  const canEditEvent = (event) => {
    if (!event || !currentUserId) return false;

    // Owner can always edit
    if (
      event.organizer?._id === currentUserId ||
      event.organizer?.userId === currentUserId
    ) {
      return true;
    }

    // Board admins can edit events in their board
    const isAdmin = boardMembers.find(
      (member) => member._id === currentUserId && member.role === 'admin'
    );

    return !!isAdmin;
  };

  const handleCloseEventModal = () => {
    setShowEventModal(false);
    setSelectedEvent(null);
    setEventForm({
      title: '',
      description: '',
      startDate: formatDateTimeForInput(new Date()),
      endDate: formatDateTimeForInput(new Date()),
      type: 'offline',
      locationName: '',
      onlineUrl: '',
      allDay: false,
      participantEmails: '',
      status: 'scheduled',
    });
  };

  // Test function để kiểm tra kết nối backend
  const testBackendConnection = async () => {
    try {
      console.log('Testing backend connection...');
      console.log('API Base URL:', apiBaseUrl);

      // Test với một endpoint đơn giản
      const response = await axios.get(`${apiBaseUrl}/event`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        withCredentials: true,
      });

      console.log('Backend connection test successful:', response.status);
    } catch (error) {
      console.error('Backend connection test failed:', error);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
    }
  };

  if (loading) {
    return (
      <div
        className='d-flex justify-content-center align-items-center'
        style={{ height: '400px' }}
      >
        <Spinner animation='border' />
      </div>
    );
  }

  return (
    <div className='board-calendar-page'>
      <div className='board-calendar-overlay' />
      <div className='board-calendar-content'>
        {/* Page Header */}
        <div className='board-calendar-page-header'>
          <button
            className='board-calendar-back-button'
            onClick={() => navigate(`/boards/${boardId}`)}
          >
            <FaArrowLeft className='me-2' />
            Back to Board
          </button>
          <h1 className='board-calendar-page-header-title'>
            📅 {board?.name || 'Loading...'} Calendar
          </h1>
          <p className='board-calendar-subtitle'>
            Manage board events • Total amount: {events.length}
          </p>
        </div>

        {/* Main Content */}
        <Container fluid>
          <Row className='board-calendar-main-container'>
            {/* Calendar Section */}
            <Col lg={7} className='order-1 order-lg-1'>
              <motion.div
                className='board-calendar-section board-calendar-container h-100'
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay',
                  }}
                  initialView='dayGridMonth'
                  locale={viLocale}
                  selectable={true}
                  selectMirror={true}
                  dayMaxEvents={3}
                  weekends={true}
                  events={events.map((event) => ({
                    ...event,
                    className: 'board-calendar-event',
                    backgroundColor: '#4CAF50',
                    borderColor: '#388E3C',
                  }))}
                  select={handleDateSelect}
                  eventClick={handleEventClick}
                  height='auto'
                  contentHeight='auto'
                  eventDisplay='block'
                  displayEventTime={true}
                  eventTimeFormat={{
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  }}
                  className='board-calendar'
                  aspectRatio={1.6}
                  expandRows={true}
                  stickyHeaderDates={true}
                />
              </motion.div>
            </Col>

            {/* Schedule Section */}
            <Col lg={5} className='order-2 order-lg-2'>
              <motion.div
                className='board-calendar-section board-schedule-section'
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <div className='d-flex justify-content-between mb-4'>
                  <h3 className='board-schedule-header'>
                    <FaCalendarCheck className='me-2' />
                    {formatEventDate(selectedDate)}
                  </h3>
                  <Badge bg='light' text='dark' className='h-100 px-3 py-2'>
                    {selectedDateEvents.length} sự kiện
                  </Badge>
                </div>
                <div className='board-event-list'>
                  <AnimatePresence>
                    {selectedDateEvents.length > 0 ? (
                      selectedDateEvents.map((event) => (
                        <motion.div
                          key={event.id}
                          className='board-event-card'
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.3 }}
                          onClick={() => handleEventClick({ event })}
                        >
                          <div className='board-event-card-header'>
                            <h4 className='board-event-title'>{event.title}</h4>
                            <div className='board-event-badges'>
                              <div
                                className={`board-event-type-badge event-type-${
                                  event.type || 'offline'
                                }`}
                              >
                                {eventTypes[event.type || 'offline']?.icon}{' '}
                                {eventTypes[event.type || 'offline']?.label}
                              </div>
                            </div>
                          </div>
                          {event.description && (
                            <p className='board-event-description'>
                              {event.description}
                            </p>
                          )}
                          <div className='board-event-meta'>
                            <div className='board-event-meta-item'>
                              <FaCalendarAlt size={16} className='me-1' />
                              <span>
                                {formatEventDate(new Date(event.start))}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <motion.div
                        className='board-no-events'
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                      >
                        <FaCalendarAlt size={48} className='mb-3' />
                        <p>Không có sự kiện nào trong ngày này</p>
                        <Button
                          variant='outline-light'
                          onClick={() => setShowEventModal(true)}
                          className='mt-2'
                        >
                          <FaPlus className='me-2' />
                          Tạo Sự kiện
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
        <motion.div
          className='board-fab-create-group'
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1, type: 'spring', stiffness: 200 }}
        >
          <motion.button
            className='board-calendar-fab'
            onClick={() => setShowEventModal(true)}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <FaPlus className='me-2' />
            Tạo Sự kiện
          </motion.button>
        </motion.div>
      </div>

      {/* Event Modal */}
      <Modal
        show={showEventModal}
        onHide={handleCloseEventModal}
        size='lg'
        className='board-calendar-modal'
        backdrop='static'
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            📅 {selectedEvent ? 'Chỉnh sửa Sự kiện' : 'Tạo Sự kiện mới'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleEventSubmit}>
          <Modal.Body>
            <Form.Group className='mb-3'>
              <Form.Label>Tiêu đề *</Form.Label>
              <Form.Control
                type='text'
                value={eventForm.title}
                onChange={(e) =>
                  setEventForm({ ...eventForm, title: e.target.value })
                }
                required
              />
            </Form.Group>

            <Form.Group className='mb-3'>
              <Form.Label>Mô tả</Form.Label>
              <Form.Control
                as='textarea'
                rows={3}
                value={eventForm.description}
                onChange={(e) =>
                  setEventForm({ ...eventForm, description: e.target.value })
                }
              />
            </Form.Group>

            <div className='row'>
              <div className='col-md-6'>
                <Form.Group className='mb-3'>
                  <Form.Label>Thời gian bắt đầu *</Form.Label>
                  <Form.Control
                    type='datetime-local'
                    value={eventForm.startDate}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        startDate: e.target.value,
                      })
                    }
                    required
                  />
                </Form.Group>
              </div>
              <div className='col-md-6'>
                <Form.Group className='mb-3'>
                  <Form.Label>Thời gian kết thúc *</Form.Label>
                  <Form.Control
                    type='datetime-local'
                    value={eventForm.endDate}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, endDate: e.target.value })
                    }
                    required
                  />
                </Form.Group>
              </div>
            </div>

            <Form.Group className='mb-3'>
              <Form.Label>Loại sự kiện</Form.Label>
              <Form.Select
                value={eventForm.type}
                onChange={(e) =>
                  setEventForm({ ...eventForm, type: e.target.value })
                }
              >
                <option value='offline'>📍 Trực tiếp</option>
                <option value='online'>🌐 Trực tuyến</option>
              </Form.Select>
            </Form.Group>

            {eventForm.type === 'offline' && (
              <Form.Group className='mb-3'>
                <Form.Label>Địa điểm</Form.Label>
                <Form.Control
                  type='text'
                  placeholder='Nhập địa điểm...'
                  value={eventForm.locationName}
                  onChange={(e) =>
                    setEventForm({
                      ...eventForm,
                      locationName: e.target.value,
                    })
                  }
                />
              </Form.Group>
            )}

            {eventForm.type === 'online' && (
              <Form.Group className='mb-3'>
                <Form.Label>Link online</Form.Label>
                <Form.Control
                  type='url'
                  placeholder='https://...'
                  value={eventForm.onlineUrl}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, onlineUrl: e.target.value })
                  }
                />
              </Form.Group>
            )}

            <Form.Group className='mb-3'>
              <Form.Label>Trạng thái</Form.Label>
              <Form.Select
                value={eventForm.status}
                onChange={(e) =>
                  setEventForm({ ...eventForm, status: e.target.value })
                }
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className='mb-3'>
              <Form.Label>
                Email người tham gia (phân cách bằng dấu phẩy)
              </Form.Label>
              <Form.Control
                type='text'
                placeholder='email1@example.com, email2@example.com'
                value={eventForm.participantEmails}
                onChange={(e) =>
                  setEventForm({
                    ...eventForm,
                    participantEmails: e.target.value,
                  })
                }
              />
              <Form.Text className='text-muted'>
                Hoặc chọn từ thành viên board:
              </Form.Text>
              <div
                className='mt-2'
                style={{ maxHeight: '120px', overflowY: 'auto' }}
              >
                {boardMembers.map((member) => (
                  <Button
                    key={member._id}
                    variant='outline-secondary'
                    size='sm'
                    className='me-2 mb-2'
                    onClick={() => {
                      const emails = eventForm.participantEmails
                        ? eventForm.participantEmails
                            .split(',')
                            .map((e) => e.trim())
                        : [];

                      if (!emails.includes(member.email)) {
                        emails.push(member.email);
                        setEventForm({
                          ...eventForm,
                          participantEmails: emails.join(', '),
                        });
                      }
                    }}
                    disabled={eventForm.participantEmails?.includes(
                      member.email
                    )}
                  >
                    <FaUser className='me-1' />
                    {member.username}
                    {eventForm.participantEmails?.includes(member.email) && (
                      <FaCheck className='ms-1 text-success' />
                    )}
                  </Button>
                ))}
              </div>
            </Form.Group>

            <Form.Check
              type='checkbox'
              label='Cả ngày'
              checked={eventForm.allDay}
              onChange={(e) =>
                setEventForm({ ...eventForm, allDay: e.target.checked })
              }
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant='secondary' onClick={handleCloseEventModal}>
              Hủy
            </Button>
            <Button variant='primary' type='submit' disabled={isCreatingEvent}>
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
                  {selectedEvent ? 'Đang cập nhật...' : 'Đang tạo...'}
                </>
              ) : selectedEvent ? (
                'Cập nhật'
              ) : (
                'Tạo mới'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Event Detail Modal */}
      <AnimatePresence>
        {showEventDetailModal && selectedEvent && (
          <motion.div
            className='event-modal-overlay'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowEventDetailModal(false)}
          >
            <motion.div
              className='event-modal'
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
                  onClick={() => setShowEventDetailModal(false)}
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
                    {selectedEvent.status &&
                      selectedEvent.status !== 'scheduled' && (
                        <div
                          className={`event-status-badge status-${selectedEvent.status}`}
                        >
                          {selectedEvent.status === 'in-progress' &&
                            '🔄 Đang diễn ra'}
                          {selectedEvent.status === 'completed' && '✅ Đã xong'}
                          {selectedEvent.status === 'cancelled' && '❌ Đã hủy'}
                          {selectedEvent.status === 'draft' && '📝 Nháp'}
                        </div>
                      )}
                  </div>
                </div>
                <div className='event-info'>
                  <p>
                    <strong>📅 Thời gian:</strong>{' '}
                    {formatEventDate(new Date(selectedEvent.start))}
                    {selectedEvent.end && (
                      <> - {formatEventDate(new Date(selectedEvent.end))}</>
                    )}
                  </p>
                  {selectedEvent.description && (
                    <p>
                      <strong>📝 Mô tả:</strong> {selectedEvent.description}
                    </p>
                  )}
                  {selectedEvent.type === 'offline' &&
                    selectedEvent.address && (
                      <p>
                        <strong>📍 Địa điểm:</strong>{' '}
                        {getAddressDisplay(selectedEvent.address)}
                        <Button
                          variant='outline-light'
                          size='sm'
                          onClick={(e) => {
                            e.stopPropagation();
                            const mapsUrl = generateMapsUrl(
                              selectedEvent.address
                            );
                            window.open(mapsUrl, '_blank');
                          }}
                          className='ms-2'
                          title='Mở bản đồ'
                        >
                          <FaMapMarkerAlt />
                        </Button>
                      </p>
                    )}
                  {selectedEvent.type === 'online' &&
                    selectedEvent.onlineUrl && (
                      <p>
                        <strong>🌐 Link:</strong>{' '}
                        <a
                          href={selectedEvent.onlineUrl}
                          target='_blank'
                          rel='noopener noreferrer'
                        >
                          Tham gia sự kiện
                        </a>
                      </p>
                    )}
                  {selectedEvent.organizer && (
                    <p>
                      <strong>👤 Người tổ chức:</strong>{' '}
                      {selectedEvent.organizer.username ||
                        selectedEvent.organizer.email}
                    </p>
                  )}
                </div>

                {/* Chat Section */}
                {shouldShowChatFeature(selectedEvent) && (
                  <div className='chat-container mt-4'>
                    <div className='d-flex justify-content-between align-items-center mb-3'>
                      <h5>💬 Thảo luận</h5>
                      {!showChat && (
                        <Button
                          variant='outline-primary'
                          size='sm'
                          onClick={() => {
                            setShowChat(true);
                            loadEventMessages(selectedEvent.id);
                          }}
                        >
                          <FaComments className='me-1' />
                          Mở chat
                        </Button>
                      )}
                      {showChat && (
                        <Button
                          variant='outline-secondary'
                          size='sm'
                          onClick={() => setShowChat(false)}
                        >
                          <FaTimes className='me-1' />
                          Đóng
                        </Button>
                      )}
                    </div>

                    {showChat && (
                      <div
                        className='messages-area'
                        style={{ height: '300px' }}
                      >
                        {isLoadingMessages ? (
                          <div className='d-flex justify-content-center align-items-center h-100'>
                            <div className='spinner-border spinner-border-sm' />
                          </div>
                        ) : (
                          <>
                            <div
                              className='messages-container'
                              style={{
                                height: canSendMessage ? '250px' : '300px',
                                overflowY: 'auto',
                                padding: '10px',
                                backgroundColor: 'rgba(0,0,0,0.05)',
                                borderRadius: '8px',
                              }}
                            >
                              {messages.length > 0 ? (
                                messages.map((message) => {
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
                                          <span style={{ fontSize: '1.1rem' }}>
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
                                        message.sender._id === currentUserId
                                          ? 'messenger-own'
                                          : ''
                                      }`}
                                    >
                                      {message.sender._id !== currentUserId && (
                                        <div className='messenger-avatar'>
                                          <img
                                            src={
                                              message.sender.avatar ||
                                              '/images/user-avatar-default.png'
                                            }
                                            alt={message.sender.username}
                                          />
                                        </div>
                                      )}
                                      <div className='messenger-content'>
                                        {message.sender._id !==
                                          currentUserId && (
                                          <div className='messenger-sender'>
                                            {message.sender.username}
                                          </div>
                                        )}
                                        {editingMessageId === message._id ? (
                                          <div className='messenger-edit-form'>
                                            <Form.Control
                                              type='text'
                                              value={editingContent}
                                              onChange={(e) =>
                                                setEditingContent(
                                                  e.target.value
                                                )
                                              }
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  submitMessageEdit(
                                                    message._id
                                                  );
                                                }
                                              }}
                                              className='messenger-edit-input'
                                            />
                                            <div className='messenger-edit-actions'>
                                              <Button
                                                size='sm'
                                                variant='success'
                                                onClick={() =>
                                                  submitMessageEdit(message._id)
                                                }
                                                className='messenger-edit-save'
                                              >
                                                <FaCheck />
                                              </Button>
                                              <Button
                                                size='sm'
                                                variant='secondary'
                                                onClick={cancelEditing}
                                                className='messenger-edit-cancel'
                                              >
                                                <FaTimes />
                                              </Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div
                                            className={`messenger-bubble ${
                                              message.sender._id ===
                                              currentUserId
                                                ? 'messenger-bubble-own'
                                                : 'messenger-bubble-other'
                                            }`}
                                            onContextMenu={(e) => {
                                              if (
                                                message.sender._id ===
                                                currentUserId
                                              ) {
                                                e.preventDefault();
                                                setContextMenu({
                                                  x: e.clientX,
                                                  y: e.clientY,
                                                  message,
                                                });
                                              }
                                            }}
                                          >
                                            {message.content}
                                            <div className='messenger-time'>
                                              {new Date(
                                                message.createdAt
                                              ).toLocaleTimeString('vi-VN', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })}
                                              {message.isEdited && (
                                                <span className='messenger-edited'>
                                                  (đã chỉnh sửa)
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className='text-center text-muted'>
                                  Chưa có tin nhắn nào
                                </div>
                              )}
                              <div ref={messagesEndRef} />
                            </div>

                            {canSendMessage && (
                              <div className='message-input mt-2'>
                                <div className='input-group'>
                                  <Form.Control
                                    type='text'
                                    placeholder='Nhập tin nhắn...'
                                    value={newMessage}
                                    onChange={(e) =>
                                      setNewMessage(e.target.value)
                                    }
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
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
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className='event-modal-actions mt-4'>
                  {canEditEvent(selectedEvent) && (
                    <>
                      <Button
                        variant='primary'
                        className='me-2'
                        onClick={() => {
                          setEventForm({
                            title: selectedEvent.title,
                            description: selectedEvent.description || '',
                            startDate: formatDateTimeForInput(
                              new Date(selectedEvent.start)
                            ),
                            endDate: formatDateTimeForInput(
                              new Date(selectedEvent.end || selectedEvent.start)
                            ),
                            type: selectedEvent.type || 'offline',
                            locationName: selectedEvent.locationName || '',
                            onlineUrl: selectedEvent.onlineUrl || '',
                            allDay: selectedEvent.allDay || false,
                            status: selectedEvent.status || 'scheduled',
                            participantEmails:
                              selectedEvent.participants
                                ?.map((p) => p.email)
                                .join(', ') || '',
                          });
                          setShowEventModal(true);
                          setShowEventDetailModal(false);
                        }}
                      >
                        <FaEdit className='me-1' />
                        Chỉnh sửa
                      </Button>
                      <Button
                        variant='danger'
                        onClick={() => {
                          if (
                            window.confirm('Bạn có chắc muốn xóa sự kiện này?')
                          ) {
                            handleDeleteEvent(selectedEvent.id);
                          }
                        }}
                      >
                        <FaTrash className='me-1' />
                        Xóa
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context Menu for Messages */}
      {contextMenu && (
        <div
          className='messenger-context-menu'
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
          }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <div
            className='messenger-action-item'
            onClick={() => {
              startEditing(contextMenu.message);
              setContextMenu(null);
            }}
          >
            <FaEdit className='me-2' />
            Chỉnh sửa
          </div>
          <div
            className='messenger-action-item messenger-delete'
            onClick={() => {
              handleDeleteMessage(contextMenu.message._id);
              setContextMenu(null);
            }}
          >
            <FaTrash className='me-2' />
            Xóa
          </div>
        </div>
      )}

      {/* Event Conflict Modal */}
      <Modal
        show={showCreateConflictModal}
        onHide={() => setShowCreateConflictModal(false)}
        size='lg'
        className='conflict-modal'
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>⚠️ Phát hiện xung đột lịch trình</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant='warning'>
            <strong>
              ⚠️ Lưu ý: Sự kiện này có thể trùng thời gian với các sự kiện khác
            </strong>
          </Alert>

          <div className='conflict-events-list'>
            {conflictEvents.map((event) => (
              <div
                key={event._id}
                className='bg-danger-subtle p-3 mb-2 rounded'
              >
                <h6 className='mb-1'>{event.title}</h6>
                <p className='mb-1 text-muted'>
                  📅 {formatEventDate(new Date(event.startDate))} -{' '}
                  {formatEventDate(new Date(event.endDate))}
                </p>
                {event.description && (
                  <p className='mb-0 small'>{event.description}</p>
                )}
              </div>
            ))}
          </div>

          <Alert variant='info' className='mt-3'>
            <strong>Bạn vẫn có thể tạo sự kiện này.</strong> Hãy đảm bảo bạn có
            thể sắp xếp thời gian phù hợp.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant='secondary'
            onClick={() => setShowCreateConflictModal(false)}
            className='me-2'
          >
            Huỷ
          </Button>
          <Button
            variant='success'
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
              <>Tiếp tục tạo sự kiện</>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default BoardCalendar;
