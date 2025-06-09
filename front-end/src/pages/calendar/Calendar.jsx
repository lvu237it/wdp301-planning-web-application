import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Row,
  Col,
  Modal,
  Button,
  Badge,
  Form,
  ButtonGroup,
} from 'react-bootstrap';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaUser,
  FaUsers,
  FaCalendarCheck,
  FaTimes,
  FaPlus,
  FaEdit,
  FaTrash,
  FaClock,
  FaFilter,
  FaSearch,
  FaBell,
  FaList,
  FaCalendarWeek,
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useCommon } from '../../contexts/CommonContext';
import axios from 'axios';
import debounce from 'lodash/debounce';
// import { toZonedTime } from 'date-fns-tz';

const Calendar = () => {
  const {
    accessToken,
    apiBaseUrl,
    toast,
    // subscriptionStatus,
    // showFeatures,
    // user,
    // userGroups: contextUserGroups,
    // fetchUserGroups,
    isMobile,
    isTablet,
    isDesktop,
    navigate,
    userDataLocal,
  } = useCommon();

  // Enhanced state management
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [calendarView, setCalendarView] = useState('timeGridDay');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    type: 'other',
    groupId: null,
    isLunar: false,
  });
  const [editFormData, setEditFormData] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Enhanced event types configuration
  const eventTypes = useMemo(
    () => ({
      birthday: {
        label: 'Sinh nhật',
        color: '#FF6B9D',
        gradientColor: 'linear-gradient(135deg, #FF6B9D, #C44569)',
        icon: '🎂',
        description: 'Ngày sinh nhật của thành viên gia đình',
      },
      death_anniversary: {
        label: 'Ngày giỗ',
        color: '#4ECDC4',
        gradientColor: 'linear-gradient(135deg, #4ECDC4, #26A69A)',
        icon: '🕯️',
        description: 'Ngày tưởng niệm người thân',
      },
      meeting: {
        label: 'Họp mặt',
        color: '#45B7D1',
        gradientColor: 'linear-gradient(135deg, #45B7D1, #2980B9)',
        icon: '👥',
        description: 'Cuộc họp gia đình hoặc gặp gỡ',
      },
      celebration: {
        label: 'Lễ kỷ niệm',
        color: '#F39C12',
        gradientColor: 'linear-gradient(135deg, #F39C12, #E67E22)',
        icon: '🎉',
        description: 'Các dịp lễ và kỷ niệm đặc biệt',
      },
      other: {
        label: 'Khác',
        color: '#95A5A6',
        gradientColor: 'linear-gradient(135deg, #95A5A6, #7F8C8D)',
        icon: '📋',
        description: 'Các sự kiện khác',
      },
    }),
    []
  );

  // Check premium access
  // const hasPremiumAccess = useMemo(
  //   () =>
  //     subscriptionStatus?.role === 'admin' ||
  //     subscriptionStatus?.type === 'premium' ||
  //     subscriptionStatus?.type === 'standard' ||
  //     (subscriptionStatus?.type !== 'free trial' &&
  //       subscriptionStatus?.role !== 'user' &&
  //       !subscriptionStatus?.isExpired),
  //   [subscriptionStatus]
  // );

  // Enhanced date formatting utilities
  const convertVNDateToISO = useCallback((vnDate) => {
    try {
      const [day, month, year] = vnDate.split('-');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } catch (error) {
      // console.error('Error converting date:', vnDate, error);
      return new Date().toISOString().split('T')[0];
    }
  }, []);

  const isValidDate = (d) => d instanceof Date && !isNaN(d);

  const formatEventDate = useCallback((date) => {
    if (!isValidDate(date)) return '';
    return new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }, []);

  // Format dạng Việt Nam có AM/PM
  const formatEventDateAMPM = useCallback((date) => {
    if (!isValidDate(date)) return '';
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(date);
  }, []);

  // Thêm hàm chuyển UTC ISO sang Date ở múi giờ VN
  const toVietnamDate = useCallback((isoString) => {
    if (!isoString) return null;
    // Chỉ parse ISO string
    return new Date(isoString);
  }, []);

  // Get event color based on type
  const getEventColor = useCallback(
    (type) => {
      const baseColor = eventTypes[type]?.color || eventTypes.other.color;
    },
    [eventTypes]
  );

  // Enhanced debounced fetchEvents with filtering
  const debouncedFetchEvents = useCallback(
    debounce(async (searchQuery = '', filterParams = {}) => {
      if (!accessToken) return;

      try {
        setIsLoading(true);
        const params = new URLSearchParams();

        if (searchQuery) params.append('search', searchQuery);
        if (filterParams.type) params.append('type', filterParams.type);
        if (filterParams.groupId)
          params.append('groupId', filterParams.groupId);

        const response = await axios.get(
          `${apiBaseUrl}/calendar/683e53ec9249b6bc0dbc3d32/events?startDate=2025-05-25T00:00:00Z&endDate=2025-07-01T23:59:59Z`
          // {
          //   headers: { Authorization: `Bearer ${accessToken}` },
          // }
        );

        if (response.data.status === 'success') {
          const formattedEvents = response.data.data.map((event) => ({
            id: event.eventId,
            title: event.title,
            start: convertVNDateToISO(event.date),
            description: event.description,
            backgroundColor: getEventColor(event.type),
            borderColor: getEventColor(event.type),
            textColor: '#ffffff',
            classNames: [`event-type-${event.type}`],
            extendedProps: {
              description: event.description,
              userId: event.userId,
              groupId: event.groupId,
              isLunar: event.isLunar,
              createdAt: event.createdAt,
              updatedAt: event.updatedAt,
              createdByName: event.createdByName,
              groupName: event.groupName,
              type: event.type,
              date: event.date,
              lunarDate: event.lunarDate,
            },
          }));
          setEvents(formattedEvents);
          setFilteredEvents(formattedEvents);
        } else {
          setEvents([]);
          setFilteredEvents([]);
        }
      } catch (error) {
        // console.error('Error fetching events:', error);
        toast.error('Không thể tải danh sách sự kiện');
        setEvents([]);
        setFilteredEvents([]);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    [accessToken, apiBaseUrl, toast]
  );

  // Fetch statistics
  // const fetchStatistics = useCallback(async () => {
  //   if (!accessToken) return;

  //   try {
  //     const response = await axios.get(
  //       `${apiBaseUrl}/calendar-event/statistics`,
  //       {
  //         headers: { Authorization: `Bearer ${accessToken}` },
  //       }
  //     );

  //     if (response.data.status === 'success') {
  //       setStatistics(response.data.data);
  //     }
  //   } catch (error) {
  //     // console.error('Error fetching statistics:', error);
  //   }
  // }, [accessToken, apiBaseUrl]);

  // Fetch user groups
  // const fetchGroupsData = useCallback(async () => {
  //   if (!accessToken) return;

  //   try {
  //     await fetchUserGroups();
  //     setUserGroups(contextUserGroups);
  //   } catch (error) {
  //     // console.error('Error fetching user groups:', error);
  //   }
  // }, [accessToken, fetchUserGroups, contextUserGroups]);

  // Initialize data
  // useEffect(() => {
  //   if (accessToken && hasPremiumAccess) {
  //     debouncedFetchEvents(searchTerm, {});
  //     fetchGroupsData();
  //     fetchStatistics();
  //   }
  //   return () => debouncedFetchEvents.cancel();
  // }, [accessToken, hasPremiumAccess, debouncedFetchEvents]);

  // Update user groups when context changes
  // useEffect(() => {
  //   setUserGroups(contextUserGroups);
  // }, [contextUserGroups]);

  // Handle search and filter changes
  // useEffect(() => {
  //   if (accessToken && hasPremiumAccess) {
  //     debouncedFetchEvents(searchTerm, {});
  //   }
  //   return () => debouncedFetchEvents.cancel();
  // }, [accessToken, hasPremiumAccess]);

  // useEffect fetch group chỉ khi accessToken thay đổi
  // useEffect(() => {
  //   if (accessToken) {
  //     fetchGroupsData();
  //   }
  // }, [accessToken]);

  // useEffect fetch statistics chỉ khi accessToken hoặc hasPremiumAccess thay đổi
  // useEffect(() => {
  //   if (accessToken || hasPremiumAccess) {
  //     fetchStatistics();
  //   }
  // }, [accessToken, hasPremiumAccess]);

  // Enhanced event handlers
  const handleDateClick = useCallback((arg) => {
    setSelectedDate(new Date(arg.dateStr));
    setFormData((prev) => ({ ...prev, date: arg.dateStr }));
  }, []);

  const handleEventClick = useCallback(
    (eventInfo) => {
      // Lấy toàn bộ extendedProps và merge các trường cần thiết
      const event = {
        ...eventInfo.event.extendedProps,
        id: eventInfo.event.id,
        title: eventInfo.event.title,
        color: eventInfo.event.backgroundColor,
        // Đảm bảo các trường gốc vẫn có
        date: new Date(convertVNDateToISO(eventInfo.event.extendedProps.date)),
        lunarDate: eventInfo.event.extendedProps.lunarDate || null,
      };
      setSelectedEvent(event);
      setShowEventModal(true);
    },
    [convertVNDateToISO]
  );

  const handleEventDrop = useCallback(
    async (dropInfo) => {
      const { event } = dropInfo;
      // Lấy ngày đúng định dạng YYYY-MM-DD
      const newDate =
        event.start.getFullYear() +
        '-' +
        String(event.start.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(event.start.getDate()).padStart(2, '0');
      try {
        const response = await axios.patch(
          `${apiBaseUrl}/calendar-event/${event.id}`,
          { date: newDate },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (response.data.status === 'success') {
          toast.success('Cập nhật ngày sự kiện thành công');
          debouncedFetchEvents(searchTerm, {});
        }
      } catch (error) {
        // console.error('Error updating event date:', error);
        dropInfo.revert();
        const errorMessage =
          error.response?.data?.message || 'Không thể cập nhật sự kiện';
        toast.error(errorMessage);
      }
    },
    [apiBaseUrl, accessToken, toast, searchTerm]
  );

  const handleCreateClick = useCallback(() => {
    setFormData({
      title: '',
      description: '',
      date: selectedDate.toISOString().split('T')[0],
      type: 'other',
      groupId: null,
      isLunar: false,
    });
    setShowCreateModal(true);
  }, [selectedDate]);

  // const handleEditClick = useCallback(() => {
  //   if (!selectedEvent) return;

  //   setEditFormData({
  //     title: selectedEvent.title,
  //     description: selectedEvent.description || '',
  //     date: selectedEvent.date.toISOString().split('T')[0],
  //     type: selectedEvent.type,
  //     groupId: selectedEvent.groupId || null,
  //     isLunar: selectedEvent.isLunar || false,
  //   });
  //   setShowEventModal(false);
  //   setShowEditModal(true);
  // }, [selectedEvent]);

  // const handleCreateSubmit = useCallback(
  //   async (e) => {
  //     e.preventDefault();
  //     if (!formData.title.trim()) {
  //       toast.error('Vui lòng nhập tiêu đề sự kiện');
  //       return;
  //     }

  //     try {
  //       const response = await axios.post(
  //         `${apiBaseUrl}/calendar-event`,
  //         formData,
  //         {
  //           headers: { Authorization: `Bearer ${accessToken}` },
  //         }
  //       );

  //       if (response.data.status === 'success') {
  //         // toast.success('Thêm sự kiện thành công');
  //         setShowCreateModal(false);
  //         debouncedFetchEvents(searchTerm, {});
  //         fetchStatistics();
  //         setFormData({
  //           title: '',
  //           description: '',
  //           date: new Date().toISOString().split('T')[0],
  //           type: 'other',
  //           groupId: null,
  //           isLunar: false,
  //         });
  //       }
  //     } catch (error) {
  //       // console.error('Error creating event:', error);
  //       const errorMessage =
  //         error.response?.data?.message || 'Không thể thêm sự kiện';
  //       toast.error(errorMessage);
  //     }
  //   },
  //   [
  //     formData,
  //     apiBaseUrl,
  //     accessToken,
  //     toast,
  //     debouncedFetchEvents,
  //     searchTerm,
  //     fetchStatistics,
  //   ]
  // );

  // const handleEditSubmit = useCallback(
  //   async (e) => {
  //     e.preventDefault();
  //     if (!editFormData.title?.trim()) {
  //       toast.error('Vui lòng nhập tiêu đề sự kiện');
  //       return;
  //     }

  //     try {
  //       const response = await axios.patch(
  //         `${apiBaseUrl}/calendar-event/${selectedEvent.id}`,
  //         editFormData,
  //         {
  //           headers: { Authorization: `Bearer ${accessToken}` },
  //         }
  //       );

  //       if (response.data.status === 'success') {
  //         toast.success('Cập nhật sự kiện thành công');
  //         setShowEditModal(false);
  //         debouncedFetchEvents(searchTerm, {});
  //         fetchStatistics();
  //       }
  //     } catch (error) {
  //       // console.error('Error updating event:', error);
  //       const errorMessage =
  //         error.response?.data?.message || 'Không thể cập nhật sự kiện';
  //       toast.error(errorMessage);
  //     }
  //   },
  //   [
  //     editFormData,
  //     selectedEvent,
  //     apiBaseUrl,
  //     accessToken,
  //     toast,
  //     debouncedFetchEvents,
  //     searchTerm,
  //     fetchStatistics,
  //   ]
  // );

  const handleDeleteEvent = useCallback(async () => {
    if (!selectedEvent?.id) return;
    try {
      const response = await axios.delete(
        `${apiBaseUrl}/calendar-event/${selectedEvent.id}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (response.data.status === 'success') {
        toast.success('Xóa sự kiện thành công');
        setShowEventModal(false);
        setShowDeleteConfirm(false);
        debouncedFetchEvents(searchTerm, {});
        fetchStatistics();
      }
    } catch (error) {
      // console.error('Error deleting event:', error);
      const errorMessage =
        error.response?.data?.message || 'Không thể xóa sự kiện';
      toast.error(errorMessage);
    }
  }, [
    selectedEvent,
    apiBaseUrl,
    accessToken,
    // toast,
    // debouncedFetchEvents,
    // searchTerm,
    // fetchStatistics,
  ]);

  // Get filtered events for selected date
  const selectedDateEvents = useMemo(() => {
    return filteredEvents.filter((event) => {
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === selectedDate.toDateString();
    });
  }, [filteredEvents, selectedDate]);

  // Enhanced event content renderer
  const renderEventContent = useCallback(
    (eventInfo) => {
      const eventType =
        eventTypes[eventInfo.event.extendedProps.type] || eventTypes.other;
      // Lấy ngày âm lịch nếu có
      let lunarDateStr = '';
      if (
        eventInfo.event.extendedProps.isLunar &&
        eventInfo.event.extendedProps.lunarDate
      ) {
        try {
          const lunarDate = new Date(eventInfo.event.extendedProps.lunarDate);
          lunarDateStr =
            '🌙 ' +
            lunarDate.getDate().toString().padStart(2, '0') +
            '/' +
            (lunarDate.getMonth() + 1).toString().padStart(2, '0');
        } catch {}
      }
      return (
        <div className='fc-event-content'>
          <span className='fc-event-icon'>{eventType.icon}</span>
          <span className='fc-event-title'>{eventInfo.event.title}</span>
          {lunarDateStr && (
            <span
              className='fc-event-lunar ms-2'
              style={{ fontSize: '0.85em', color: '#ffd700' }}
            >
              {lunarDateStr}
            </span>
          )}
        </div>
      );
    },
    [eventTypes]
  );

  // Utility functions
  // const getGroupName = useCallback(
  //   (groupId) => {
  //     const group = userGroups.find((g) => g.groupId === groupId);
  //     return group?.groupName || 'Nhóm không xác định';
  //   },
  //   [userGroups]
  // );

  // const getUserDisplayName = useCallback(
  //   (userId) => (userId === user?.userId ? 'Bạn' : `Thành viên ${userId}`),
  //   [user]
  // );

  const canModifyEvent = useCallback(
    (event) => event?.organizer === userDataLocal?._id, //lấy userDataLocal để sửa
    [userDataLocal]
  );

  // // Hàm format ngày âm lịch chuẩn Việt Nam
  // const formatLunarDateVN = (lunarDate) => {
  //   if (!lunarDate) return '';
  //   try {
  //     let dateObj = null;
  //     if (
  //       typeof lunarDate === 'string' &&
  //       /^\d{4}-\d{2}-\d{2}/.test(lunarDate)
  //     ) {
  //       dateObj = new Date(lunarDate);
  //     } else if (lunarDate instanceof Date) {
  //       dateObj = lunarDate;
  //     }
  //     if (!dateObj || isNaN(dateObj.getTime())) return '';
  //     const vnDate = toZonedTime(dateObj, 'Asia/Ho_Chi_Minh');
  //     return new Intl.DateTimeFormat('vi-VN', {
  //       weekday: 'long',
  //       year: 'numeric',
  //       month: 'long',
  //       day: 'numeric',
  //     }).format(vnDate);
  //   } catch {
  //     return '';
  //   }
  // };

  // Thêm hàm handleDatesSet để đồng bộ ngày khi chuyển view hoặc bấm prev/next/today
  const handleDatesSet = useCallback((arg) => {
    // arg.start là ngày đầu tiên của view hiện tại
    setSelectedDate(new Date(arg.start));
  }, []);

  // Calendar configuration
  const calendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: calendarView,
    events: filteredEvents,
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
        slotMinTime: '06:00:00',
        slotMaxTime: '22:00:00',
      },
      timeGridDay: {
        dayHeaderFormat: { weekday: 'long', day: 'numeric', month: 'long' },
        slotMinTime: '06:00:00',
        slotMaxTime: '22:00:00',
      },
    },
    buttonText: {
      today: 'Hôm nay',
      month: 'Tháng',
      week: 'Tuần',
      day: 'Ngày',
    },
    locale: 'vi',
    firstDay: 1,
    weekNumbers: !isMobile,
    weekNumberTitle: 'Tuần',
    weekNumberCalculation: 'ISO',
    nowIndicator: true,
    selectMirror: true,
    dayMaxEventRows: isMobile ? 2 : 4,
    eventDisplay: 'block',
    displayEventTime: false,
    eventDidMount: (info) => {
      const tooltip = document.createElement('div');
      tooltip.className = 'event-tooltip';
      const eventType =
        eventTypes[info.event.extendedProps.type] || eventTypes.other;
      let lunarDateTooltip = '';
      if (
        info.event.extendedProps.isLunar &&
        info.event.extendedProps.lunarDate
      ) {
        try {
          const lunarDate = new Date(info.event.extendedProps.lunarDate);
          lunarDateTooltip =
            `<div class="tooltip-lunar" style="color:#ffd700;">🌙 Âm lịch: ` +
            lunarDate.getDate().toString().padStart(2, '0') +
            '/' +
            (lunarDate.getMonth() + 1).toString().padStart(2, '0') +
            `</div>`;
        } catch {}
      }
      tooltip.innerHTML = `
        <div class="tooltip-header">
          <span class="tooltip-icon">${eventType.icon}</span>
          <span class="tooltip-title">${info.event.title}</span>
        </div>
        <div class="tooltip-meta">
          <div class="tooltip-type">${eventType.label}</div>
          ${lunarDateTooltip}
        </div>
        ${
          info.event.extendedProps.description
            ? `<div class="tooltip-desc">${info.event.extendedProps.description}</div>`
            : ''
        }
      `;
      let timeoutId;
      info.el.addEventListener('mouseenter', () => {
        clearTimeout(timeoutId);
        document.body.appendChild(tooltip);
        const rect = info.el.getBoundingClientRect();
        tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
        tooltip.style.left = `${rect.left + window.scrollX}px`;
        tooltip.style.display = 'block';
        tooltip.style.opacity = '1';
      });
      info.el.addEventListener('mouseleave', () => {
        timeoutId = setTimeout(() => {
          if (tooltip.parentNode) {
            tooltip.style.opacity = '0';
            setTimeout(() => {
              if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
            }, 200);
          }
        }, 100);
      });
    },
    datesSet: handleDatesSet,
  };

  return (
    <div className='calendar-page'>
      <div className='calendar-overlay' />
      <div className='calendar-content'>
        <Container fluid>
          {/* Enhanced Header */}
          <motion.div
            className='calendar-header'
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className='d-flex align-items-center justify-content-between my-4 position-relative'>
              <button className='back-button' onClick={() => navigate(-1)}>
                <FaArrowLeft />
              </button>
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                }}
                className='text-center'
              >
                <div className='calendar-title'>Personal Working Calendar</div>
              </div>
              {/* View switcher (tháng, tuần, ngày) */}
            </div>
          </motion.div>

          {/* Main Content */}
          <Row className='calendar-main-container'>
            {/* Calendar left, schedule right on desktop; stacked on mobile */}
            <Col lg={7} className='order-1 order-lg-1'>
              <motion.div
                className='calendar-section calendar-container h-100'
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                {isLoading ? (
                  <div className='loading-container'>
                    <div className='loading-spinner'></div>
                    <p>Đang tải lịch...</p>
                  </div>
                ) : (
                  <FullCalendar {...calendarOptions} />
                )}
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
                    {/* {formatEventDate(selectedDate)} */}
                  </h3>
                  <Badge bg='light' text='dark' className='h-100 px-3 py-2'>
                    {selectedDateEvents.length} sự kiện
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
                            </div>
                          </div>

                          {event.description && (
                            <p className='event-description'>
                              {event.description}
                            </p>
                          )}

                          <div className='event-meta'>
                            {/* Ngày Dương lịch */}
                            <div className='event-meta-item'>
                              <FaCalendarAlt size={18} className='ms-1' />
                              <span>
                                Dương lịch:{' '}
                                {formatEventDate(new Date(event.start))}
                              </span>
                            </div>
                            {/* Ngày Âm lịch nếu có */}
                            {event.extendedProps.isLunar &&
                              event.extendedProps.lunarDate &&
                              isValidDate(
                                toVietnamDate(event.extendedProps.lunarDate)
                              ) && (
                                <div className='event-meta-item'>
                                  <span
                                    className='fs-6'
                                    style={{ marginRight: '0px' }}
                                  >
                                    🌙
                                  </span>
                                  <span>
                                    Âm lịch:{' '}
                                    {/* {formatLunarDateVN(
                                      event.extendedProps.lunarDate
                                    )} */}
                                  </span>
                                </div>
                              )}
                            {/* Group */}
                            {event.extendedProps.groupId && (
                              <div className='event-meta-item'>
                                <FaUsers />
                                <span>
                                  {/* {getGroupName(event.extendedProps.groupId)} */}
                                </span>
                              </div>
                            )}
                            {/* Người tạo */}
                            <div className='event-meta-item'>
                              <FaUser />
                              <span>
                                {/* {getUserDisplayName(event.extendedProps.userId)} */}
                              </span>
                            </div>
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
                        <FaCalendarAlt size={48} className='mb-3' />
                        <p>Không có sự kiện nào trong ngày này</p>
                        <Button
                          variant='outline-light'
                          onClick={handleCreateClick}
                          className='mt-2'
                        >
                          <FaPlus className='me-2' />
                          Tạo sự kiện mới
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

        {/* Enhanced Event Detail Modal */}
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
                className='event-modal'
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
                    {/* Ngày Dương lịch */}
                    <p>
                      <FaCalendarAlt className='ms-1 me-2' />
                      Dương lịch: {formatEventDate(selectedEvent.date)}
                    </p>
                    {/* Ngày Âm lịch nếu có */}
                    {/* {selectedEvent.lunarDate &&
                      formatLunarDateVN(selectedEvent.lunarDate) && (
                        <p>
                          <span className='me-2'>🌙</span>
                          Âm lịch: {formatLunarDateVN(selectedEvent.lunarDate)}
                        </p>
                      )} */}

                    {/* Mô tả */}
                    {selectedEvent.description && (
                      <div className='mb-3'>
                        <span>📝</span>
                        <span className='ms-2'>
                          {selectedEvent.description}
                        </span>
                      </div>
                    )}
                    {/* Người tạo */}
                    <p>
                      <FaUser className='ms-1 me-2' />
                      Người tạo:
                      {/* {getUserDisplayName(selectedEvent.userId)} */}
                    </p>
                    {/* Group */}
                    {selectedEvent.groupId && (
                      <p>
                        <FaUsers className='ms-1 me-2' />
                        Nhóm:
                        {/* {getGroupName(selectedEvent.groupId)} */}
                      </p>
                    )}
                    {/* Ngày tạo (createdAt) */}
                    <p>
                      <FaClock className='ms-1 me-2' />
                      Ngày tạo: {selectedEvent.createdAt}
                    </p>
                  </div>
                </div>

                {canModifyEvent(selectedEvent) && (
                  <div className='event-modal-actions'>
                    <Button
                      variant='outline-light'
                      //  onClick={handleEditClick}
                    >
                      <FaEdit className='me-2' />
                      Chỉnh sửa
                    </Button>
                    <Button
                      variant='outline-danger'
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <FaTrash className='me-2' />
                      Xóa
                    </Button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Enhanced Create Modal */}
        <Modal
          show={showCreateModal}
          onHide={() => setShowCreateModal(false)}
          centered
          className='custom-modal'
          backdrop='static'
          size='lg'
        >
          <Modal.Header className='mx-3' closeButton>
            <Modal.Title>Tạo sự kiện mới</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form
            // onSubmit={handleCreateSubmit}
            >
              <Row>
                <Col md={8}>
                  <Form.Group className='mb-3'>
                    <Form.Label>Tiêu đề *</Form.Label>
                    <Form.Control
                      type='text'
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      placeholder='Nhập tiêu đề sự kiện...'
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className='mb-3'>
                    <Form.Label>Ngày *</Form.Label>
                    <Form.Control
                      type='date'
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className='mb-3'>
                <Form.Label>Mô tả</Form.Label>
                <Form.Control
                  as='textarea'
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder='Mô tả chi tiết về sự kiện...'
                />
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Group className='mb-3'>
                    <Form.Label>Loại sự kiện</Form.Label>
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
                </Col>

                {/* <Col md={6}>
                  <Form.Group className='mb-3'>
                    <Form.Label>Nhóm</Form.Label>
                    <Form.Select
                      value={formData.groupId || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          groupId: e.target.value || null,
                        })
                      }
                    >
                      <option value=''>👤 Sự kiện cá nhân</option>
                      {userGroups.map((group) => (
                        <option key={group.groupId} value={group.groupId}>
                          👥 {group.groupName}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col> */}
              </Row>

              <Row>
                <Col>
                  <Form.Group className='mb-4'>
                    <Form.Check
                      type='checkbox'
                      id='isLunar'
                      label='🌙 Sử dụng lịch âm'
                      checked={formData.isLunar}
                      onChange={(e) =>
                        setFormData({ ...formData, isLunar: e.target.checked })
                      }
                    />
                  </Form.Group>
                </Col>
              </Row>

              <div className='d-flex justify-content-end gap-2'>
                <Button
                  variant='outline-light'
                  onClick={() => setShowCreateModal(false)}
                  type='button'
                >
                  Hủy
                </Button>
                <Button variant='primary' type='submit'>
                  <FaPlus className='me-2' />
                  Tạo sự kiện
                </Button>
              </div>
            </Form>
          </Modal.Body>
        </Modal>

        {/* Enhanced Edit Modal */}
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
              Chỉnh sửa sự kiện
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form

            // onSubmit={handleEditSubmit}
            >
              <Row>
                <Col md={8}>
                  <Form.Group className='mb-3'>
                    <Form.Label>Tiêu đề *</Form.Label>
                    <Form.Control
                      type='text'
                      value={editFormData.title || ''}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          title: e.target.value,
                        })
                      }
                      placeholder='Nhập tiêu đề sự kiện...'
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className='mb-3'>
                    <Form.Label>Ngày *</Form.Label>
                    <Form.Control
                      type='date'
                      value={editFormData.date || ''}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          date: e.target.value,
                        })
                      }
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className='mb-3'>
                <Form.Label>Mô tả</Form.Label>
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
                  placeholder='Mô tả chi tiết về sự kiện...'
                />
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Group className='mb-3'>
                    <Form.Label>Loại sự kiện</Form.Label>
                    <Form.Select
                      value={editFormData.type || 'other'}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          type: e.target.value,
                        })
                      }
                    >
                      {Object.entries(eventTypes).map(([key, type]) => (
                        <option key={key} value={key}>
                          {type.icon} {type.label}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className='mb-3'>
                    <Form.Label>Nhóm</Form.Label>
                    <Form.Select
                      value={editFormData.groupId || ''}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          groupId: e.target.value || null,
                        })
                      }
                    >
                      <option value=''>👤 Sự kiện cá nhân</option>
                      {/* {userGroups.map((group) => (
                        <option key={group.groupId} value={group.groupId}>
                          👥 {group.groupName}
                        </option>
                      ))} */}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col>
                  <Form.Group className='mb-4'>
                    <Form.Check
                      type='checkbox'
                      id='editIsLunar'
                      label='🌙 Sử dụng lịch âm'
                      checked={editFormData.isLunar || false}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          isLunar: e.target.checked,
                        })
                      }
                    />
                  </Form.Group>
                </Col>
              </Row>

              <div className='d-flex justify-content-end gap-2'>
                <Button
                  variant='outline-light'
                  onClick={() => setShowEditModal(false)}
                  type='button'
                >
                  Hủy
                </Button>
                <Button variant='success' type='submit'>
                  <FaEdit className='me-2' />
                  Cập nhật
                </Button>
              </div>
            </Form>
          </Modal.Body>
        </Modal>

        {/* Modal xác nhận xoá */}
        <Modal
          show={showDeleteConfirm}
          onHide={() => setShowDeleteConfirm(false)}
          centered
          backdrop='static'
        >
          <Modal.Header closeButton>
            <Modal.Title>Xác nhận xoá sự kiện</Modal.Title>
          </Modal.Header>
          <Modal.Body>Bạn có chắc chắn muốn xoá sự kiện này không?</Modal.Body>
          <Modal.Footer>
            <Button
              variant='secondary'
              onClick={() => setShowDeleteConfirm(false)}
            >
              Huỷ
            </Button>
            <Button variant='danger' onClick={handleDeleteEvent}>
              Xoá
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </div>
  );
};

export default Calendar;
