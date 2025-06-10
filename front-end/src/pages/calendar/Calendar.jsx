import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Container,
  Row,
  Col,
  Modal,
  Button,
  Badge,
  Form,
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
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useCommon } from '../../contexts/CommonContext';
import axios from 'axios';
import debounce from 'lodash/debounce';

// Hàm chuyển đổi ngày giờ sang định dạng ISO cho backend
const toISODateTime = (dateTime) => {
  if (!dateTime) return new Date().toISOString();
  return new Date(dateTime).toISOString();
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
    startDate: new Date().toISOString().slice(0, 16), // datetime-local
    endDate: new Date().toISOString().slice(0, 16),
    type: 'offline',
    locationName: '',
    address: '',
    onlineUrl: '',
    meetingCode: '',
    status: 'scheduled',
    participants: [], // [{ userId, status }]
    allDay: false,
    recurrence: '',
  });
  const [editFormData, setEditFormData] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  // Định nghĩa eventTypes
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

  // Định nghĩa statusOptions
  const statusOptions = useMemo(
    () => [
      { value: 'draft', label: 'Nháp' },
      { value: 'scheduled', label: 'Đã lên lịch' },
      { value: 'completed', label: 'Hoàn thành' },
      { value: 'cancelled', label: 'Đã hủy' },
    ],
    []
  );

  // Định nghĩa recurrenceOptions
  const recurrenceOptions = useMemo(
    () => [
      { value: 'custom', label: 'Không lặp lại' },
      { value: 'daily', label: 'Hàng ngày' },
      { value: 'weekly', label: 'Hàng tuần' },
      { value: 'monthly', label: 'Hàng tháng' },
      { value: 'yearly', label: 'Hàng năm' },
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
        const response = await axios.get(
          `${apiBaseUrl}/calendar/${
            calendarUser._id
          }/events?startDate=${start.toISOString()}&endDate=${end.toISOString()}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (response.data.status === 200 && response.data.data) {
          const formattedEvents = response.data.data.map((event) => ({
            id: event.id,
            title: event.title,
            start: new Date(event.start).toLocaleString('en-US', {
              timeZone: 'Asia/Ho_Chi_Minh',
            }),
            end: event.end
              ? new Date(event.end).toLocaleString('en-US', {
                  timeZone: 'Asia/Ho_Chi_Minh',
                })
              : null,
            allDay: event.allDay || false,
            backgroundColor:
              eventTypes[event.extendedProps.type]?.color || '#4CAF50',
            borderColor:
              eventTypes[event.extendedProps.type]?.color || '#4CAF50',
            textColor: '#ffffff',
            extendedProps: {
              description: event.extendedProps.description,
              locationName: event.extendedProps.locationName,
              address: event.extendedProps.address,
              type: event.extendedProps.type,
              onlineUrl: event.extendedProps.onlineUrl,
              meetingCode: event.extendedProps.meetingCode,
              organizer: event.extendedProps.organizer,
              participants: event.extendedProps.participants,
              status: event.extendedProps.status,
              rrule: event.extendedProps.rrule,
            },
          }));
          console.log('formattedEvents', formattedEvents);
          setEvents(formattedEvents);
        } else {
          setEvents([]);
          setFilteredEvents([]);
          toast.error('Không thể tải danh sách sự kiện');
        }
      } catch (error) {
        console.error(
          'Lỗi lấy sự kiện:',
          error.response?.data || error.message
        );
        toast.error(error.response?.data?.message || 'Không thể tải sự kiện');
        setEvents([]);
        setFilteredEvents([]);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    [accessToken, apiBaseUrl, toast, calendarUser, eventTypes]
  );

  useEffect(() => {
    console.log('Events fetched:', events);
  }, [events]);

  // Khởi tạo lấy sự kiện
  useEffect(() => {
    if (!accessToken || !userDataLocal?._id) {
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
      debouncedFetchEvents(start, end, searchTerm);
    }

    return () => debouncedFetchEvents.cancel();
  }, [
    accessToken,
    userDataLocal,
    calendarUser,
    getCalendarUser,
    navigate,
    debouncedFetchEvents,
    searchTerm,
  ]);

  // Xử lý thay đổi khoảng ngày
  const handleDatesSet = useCallback(
    (arg) => {
      setDateRange({ start: arg.start, end: arg.end });
      setSelectedDate(new Date(arg.start));
      debouncedFetchEvents(arg.start, arg.end, searchTerm);
    },
    [debouncedFetchEvents, searchTerm]
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
  const handleDateClick = useCallback((arg) => {
    const dateStr = new Date(arg.dateStr).toISOString().slice(0, 16);
    setSelectedDate(new Date(arg.dateStr));
    setFormData((prev) => ({ ...prev, startDate: dateStr, endDate: dateStr }));
  }, []);

  // Xử lý click sự kiện
  const handleEventClick = useCallback((eventInfo) => {
    const event = {
      id: eventInfo.event.id,
      title: eventInfo.event.title,
      start: new Date(eventInfo.event.start),
      end: eventInfo.event.end ? new Date(eventInfo.event.end) : null,
      allDay: eventInfo.event.allDay,
      type: eventInfo.event.extendedProps.type,
      description: eventInfo.event.extendedProps.description,
      locationName: eventInfo.event.extendedProps.locationName,
      address: eventInfo.event.extendedProps.address,
      onlineUrl: eventInfo.event.extendedProps.onlineUrl,
      meetingCode: eventInfo.event.extendedProps.meetingCode,
      organizer: eventInfo.event.extendedProps.organizer,
      participants: eventInfo.event.extendedProps.participants,
      status: eventInfo.event.extendedProps.status,
      recurrence: eventInfo.event.extendedProps.rrule,
    };
    setSelectedEvent(event);
    setShowEventModal(true);
  }, []);

  // Xử lý kéo thả sự kiện
  const handleEventDrop = useCallback(
    async (dropInfo) => {
      const { event } = dropInfo;
      const newStart = toISODateTime(event.start);
      const newEnd = event.end ? toISODateTime(event.end) : null;
      try {
        const response = await axios.patch(
          `${apiBaseUrl}/event/${event.id}`,
          { startDate: newStart, endDate: newEnd },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (response.data.status === 200) {
          toast.success('Cập nhật thời gian sự kiện thành công');
          debouncedFetchEvents(dateRange.start, dateRange.end, searchTerm);
        }
      } catch (error) {
        dropInfo.revert();
        toast.error(
          error.response?.data?.message || 'Không thể cập nhật sự kiện'
        );
      }
    },
    [
      apiBaseUrl,
      accessToken,
      toast,
      debouncedFetchEvents,
      dateRange,
      searchTerm,
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
    setSelectedDate(now);
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
    const dateStr = selectedDate.toISOString().slice(0, 16);
    setFormData({
      title: '',
      description: '',
      startDate: dateStr,
      endDate: dateStr,
      type: 'offline',
      locationName: '',
      address: '',
      onlineUrl: '',
      meetingCode: '',
      status: 'scheduled',
      participants: [],
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
      startDate: selectedEvent.start.toISOString().slice(0, 16),
      endDate: selectedEvent.end
        ? selectedEvent.end.toISOString().slice(0, 16)
        : selectedEvent.start.toISOString().slice(0, 16),
      type: selectedEvent.type || 'offline',
      locationName: selectedEvent.locationName || '',
      address: selectedEvent.address || '',
      onlineUrl: selectedEvent.onlineUrl || '',
      meetingCode: selectedEvent.meetingCode || '',
      status: selectedEvent.status || 'scheduled',
      participants: selectedEvent.participants || [],
      allDay: selectedEvent.allDay || false,
      recurrence: selectedEvent.recurrence || '',
    });
    setShowEventModal(false);
    setShowEditModal(true);
  }, [selectedEvent]);

  // Xử lý tạo sự kiện
  const handleCreateSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!formData.title.trim()) {
        toast.error('Vui lòng nhập tiêu đề sự kiện');
        return;
      }
      if (new Date(formData.startDate) > new Date(formData.endDate)) {
        toast.error('Thời gian kết thúc phải sau thời gian bắt đầu');
        return;
      }

      try {
        const payload = {
          calendarId: calendarUser._id,
          title: formData.title,
          description: formData.description || undefined,
          startDate: toISODateTime(formData.startDate),
          endDate: toISODateTime(formData.endDate),
          type: formData.type,
          organizer: userDataLocal._id,
          locationName: formData.locationName || undefined,
          address: formData.address || undefined,
          onlineUrl: formData.onlineUrl || undefined,
          meetingCode: formData.meetingCode || undefined,
          status: formData.status,
          participants: formData.participants.length
            ? formData.participants
            : undefined,
          allDay: formData.allDay,
          recurrence: formData.recurrence
            ? { type: formData.recurrence, interval: 1 }
            : undefined,
        };

        const response = await axios.post(
          `${apiBaseUrl}/event/create-event-for-calendar/${calendarUser._id}`,
          payload,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (response.data.status === 201) {
          toast.success('Thêm sự kiện thành công');
          setShowCreateModal(false);
          debouncedFetchEvents(dateRange.start, dateRange.end, searchTerm);
          setFormData({
            title: '',
            description: '',
            startDate: new Date().toISOString().slice(0, 16),
            endDate: new Date().toISOString().slice(0, 16),
            type: 'offline',
            locationName: '',
            address: '',
            onlineUrl: '',
            meetingCode: '',
            status: 'scheduled',
            participants: [],
            allDay: false,
            recurrence: '',
          });
        }
      } catch (error) {
        console.error(
          'Lỗi tạo sự kiện:',
          error.response?.data || error.message
        );
        toast.error(error.response?.data?.message || 'Không thể thêm sự kiện');
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
        toast.error('Vui lòng nhập tiêu đề sự kiện');
        return;
      }
      if (new Date(editFormData.startDate) > new Date(editFormData.endDate)) {
        toast.error('Thời gian kết thúc phải sau thời gian bắt đầu');
        return;
      }

      try {
        const payload = {
          title: editFormData.title,
          description: editFormData.description || undefined,
          startDate: toISODateTime(editFormData.startDate),
          endDate: toISODateTime(editFormData.endDate),
          type: editFormData.type,
          locationName: editFormData.locationName || undefined,
          address: editFormData.address || undefined,
          onlineUrl: editFormData.onlineUrl || undefined,
          meetingCode: editFormData.meetingCode || undefined,
          status: editFormData.status,
          participants: editFormData.participants.length
            ? editFormData.participants
            : undefined,
          allDay: editFormData.allDay,
          recurrence: editFormData.recurrence
            ? { type: editFormData.recurrence, interval: 1 }
            : undefined,
        };

        const response = await axios.patch(
          `${apiBaseUrl}/event/${selectedEvent.id}`,
          payload,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (response.data.status === 'success') {
          toast.success('Cập nhật sự kiện thành công');
          setShowEditModal(false);
          debouncedFetchEvents(dateRange.start, dateRange.end, searchTerm);
        }
      } catch (error) {
        console.error(
          'Lỗi cập nhật sự kiện:',
          error.response?.data || error.message
        );
        toast.error(
          error.response?.data?.message || 'Không thể cập nhật sự kiện'
        );
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
        toast.success('Xóa sự kiện thành công');
        setShowEventModal(false);
        setShowDeleteModal(false);
        debouncedFetchEvents(dateRange.start, dateRange.end, searchTerm);
      }
    } catch (error) {
      console.error('Lỗi xóa sự kiện:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Không thể xóa sự kiện');
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

  // Lọc sự kiện theo ngày được chọn
  const selectedDateEvents = useMemo(() => {
    return filteredEvents.filter((event) => {
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === selectedDate.toDateString();
    });
  }, [filteredEvents, selectedDate]);

  // Render nội dung sự kiện
  const renderEventContent = useCallback(
    (eventInfo) => {
      const eventType =
        eventTypes[eventInfo.event.extendedProps.type] || eventTypes.offline;
      return (
        <div className='fc-event-content'>
          <span className='fc-event-icon'>{eventType.icon}</span>
          <span className='fc-event-title'>{eventInfo.event.title}</span>
        </div>
      );
    },
    [eventTypes]
  );

  // Kiểm tra quyền chỉnh sửa sự kiện
  const canModifyEvent = useCallback(
    (event) => event?.organizer?.userId === userDataLocal?._id,
    [userDataLocal]
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
        text: 'Hôm nay',
        click: handleTodayClick,
      },
    },
  };

  return (
    <div className='calendar-page'>
      <div className='calendar-overlay' />
      <div className='calendar-content'>
        <Container fluid>
          {/* Header with Search */}
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
              <Form.Control
                type='text'
                placeholder='Tìm kiếm sự kiện...'
                value={searchTerm}
                onChange={handleSearchChange}
                style={{ maxWidth: '200px' }}
              />
            </div>
          </motion.div>

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
                            {event.extendedProps.locationName && (
                              <div className='event-meta-item'>
                                <span>📍</span>
                                <span>{event.extendedProps.locationName}</span>
                              </div>
                            )}
                            {event.extendedProps.type === 'online' &&
                              event.extendedProps.onlineUrl && (
                                <div className='event-meta-item'>
                                  <span>🌐</span>
                                  <span>
                                    <a
                                      href={event.extendedProps.onlineUrl}
                                      target='_blank'
                                      rel='noopener noreferrer'
                                    >
                                      Link sự kiện
                                    </a>
                                  </span>
                                </div>
                              )}
                            <div className='event-meta-item'>
                              <FaUser />
                              <span>
                                {event.extendedProps.organizer?.name ||
                                  'Không xác định'}
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
                    <p>
                      <FaCalendarAlt className='ms-1 me-2' />
                      Thời gian: {formatEventDate(selectedEvent.start)}
                      {selectedEvent.end &&
                        ` đến ${formatEventDate(selectedEvent.end)}`}
                    </p>
                    {selectedEvent.locationName && (
                      <p>
                        <span className='ms-1 me-2'>📍</span>
                        Địa điểm: {selectedEvent.locationName}
                      </p>
                    )}
                    {selectedEvent.address && (
                      <p>
                        <span className='ms-1 me-2'>🏠</span>
                        Địa chỉ: {selectedEvent.address}
                      </p>
                    )}
                    {selectedEvent.type === 'online' &&
                      selectedEvent.onlineUrl && (
                        <p>
                          <span className='ms-1 me-2'>🌐</span>
                          Link sự kiện:{' '}
                          <a
                            href={selectedEvent.onlineUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                          >
                            Tham gia
                          </a>
                        </p>
                      )}
                    {selectedEvent.meetingCode && (
                      <p>
                        <span className='ms-1 me-2'>🔑</span>
                        Mã cuộc họp: {selectedEvent.meetingCode}
                      </p>
                    )}
                    {selectedEvent.description && (
                      <p>
                        <span className='ms-1 me-2'>📝</span>
                        Mô tả: {selectedEvent.description}
                      </p>
                    )}
                    <p>
                      <FaUser className='ms-1 me-2' />
                      Người tạo:{' '}
                      {selectedEvent.organizer?.name || 'Không xác định'}
                    </p>
                    {selectedEvent.participants?.length > 0 && (
                      <p>
                        <span className='ms-1 me-2'>👥</span>
                        Người tham gia:{' '}
                        {selectedEvent.participants
                          .map((p) => p.name || p.userId)
                          .join(', ')}
                      </p>
                    )}
                    <p>
                      <span className='ms-1 me-2'>📊</span>
                      Trạng thái:{' '}
                      {statusOptions.find(
                        (s) => s.value === selectedEvent.status
                      )?.label || selectedEvent.status}
                    </p>
                  </div>
                </div>
                {canModifyEvent(selectedEvent) && (
                  <div className='event-modal-actions'>
                    <Button variant='outline-light' onClick={handleEditClick}>
                      <FaEdit className='me-2' />
                      Chỉnh sửa
                    </Button>
                    <Button
                      variant='outline-danger'
                      onClick={() => setShowDeleteModal(true)}
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
            <Modal.Title>Tạo sự kiện mới</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form onSubmit={handleCreateSubmit}>
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
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className='mb-3'>
                    <Form.Label>Thời gian bắt đầu *</Form.Label>
                    <Form.Control
                      type='datetime-local'
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData({ ...formData, startDate: e.target.value })
                      }
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className='mb-3'>
                    <Form.Label>Thời gian kết thúc *</Form.Label>
                    <Form.Control
                      type='datetime-local'
                      value={formData.endDate}
                      onChange={(e) =>
                        setFormData({ ...formData, endDate: e.target.value })
                      }
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className='mb-3'>
                <Form.Check
                  type='checkbox'
                  label='Sự kiện cả ngày'
                  checked={formData.allDay}
                  onChange={(e) =>
                    setFormData({ ...formData, allDay: e.target.checked })
                  }
                />
              </Form.Group>
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
              {formData.type === 'online' && (
                <>
                  <Form.Group className='mb-3'>
                    <Form.Label>Mã cuộc họp</Form.Label>
                    <Form.Control
                      type='text'
                      value={formData.meetingCode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          meetingCode: e.target.value,
                        })
                      }
                      placeholder='Nhập mã cuộc họp (nếu có)...'
                    />
                  </Form.Group>
                </>
              )}
              {formData.type === 'offline' && (
                <>
                  <Form.Group className='mb-3'>
                    <Form.Label>Địa điểm</Form.Label>
                    <Form.Control
                      type='text'
                      value={formData.locationName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          locationName: e.target.value,
                        })
                      }
                      placeholder='Nhập tên địa điểm...'
                    />
                  </Form.Group>
                  <Form.Group className='mb-3'>
                    <Form.Label>Địa chỉ chi tiết</Form.Label>
                    <Form.Control
                      type='text'
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      placeholder='Nhập địa chỉ chi tiết...'
                    />
                  </Form.Group>
                </>
              )}
              <Form.Group className='mb-3'>
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
              </Form.Group>
              <Form.Group className='mb-3'>
                <Form.Label>Người tham gia (email người dùng)</Form.Label>
                <Form.Control
                  type='text'
                  value={formData.participants.map((p) => p.userId).join(',')}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      participants: e.target.value
                        .split(',')
                        .map((id) => ({ userId: id.trim(), status: 'invited' }))
                        .filter((p) => p.userId),
                    })
                  }
                  placeholder='Nhập email người tham gia để mời, cách nhau bằng dấu phẩy...'
                />
                <Form.Text className='text-muted'>
                  Tạm thời nhập ID người dùng, sẽ thay bằng tìm kiếm người dùng
                  sau.
                </Form.Text>
              </Form.Group>
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
              Chỉnh sửa sự kiện
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form onSubmit={handleEditSubmit}>
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
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className='mb-3'>
                    <Form.Label>Thời gian bắt đầu *</Form.Label>
                    <Form.Control
                      type='datetime-local'
                      value={editFormData.startDate || ''}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          startDate: e.target.value,
                        })
                      }
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className='mb-3'>
                    <Form.Label>Thời gian kết thúc *</Form.Label>
                    <Form.Control
                      type='datetime-local'
                      value={editFormData.endDate || ''}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          endDate: e.target.value,
                        })
                      }
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className='mb-3'>
                <Form.Check
                  type='checkbox'
                  label='Sự kiện cả ngày'
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
              <Form.Group className='mb-3'>
                <Form.Label>Loại sự kiện</Form.Label>
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
              {editFormData.type === 'online' && (
                <>
                  <Form.Group className='mb-3'>
                    <Form.Label>Link sự kiện</Form.Label>
                    <Form.Control
                      type='url'
                      value={editFormData.onlineUrl || ''}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          onlineUrl: e.target.value,
                        })
                      }
                      placeholder='Nhập URL sự kiện trực tuyến...'
                    />
                  </Form.Group>
                  <Form.Group className='mb-3'>
                    <Form.Label>Mã cuộc họp</Form.Label>
                    <Form.Control
                      type='text'
                      value={editFormData.meetingCode || ''}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          meetingCode: e.target.value,
                        })
                      }
                      placeholder='Nhập mã cuộc họp (nếu có)...'
                    />
                  </Form.Group>
                </>
              )}
              {editFormData.type === 'offline' && (
                <>
                  <Form.Group className='mb-3'>
                    <Form.Label>Địa điểm</Form.Label>
                    <Form.Control
                      type='text'
                      value={editFormData.locationName || ''}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          locationName: e.target.value,
                        })
                      }
                      placeholder='Nhập tên địa điểm...'
                    />
                  </Form.Group>
                  <Form.Group className='mb-3'>
                    <Form.Label>Địa chỉ chi tiết</Form.Label>
                    <Form.Control
                      type='text'
                      value={editFormData.address || ''}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          address: e.target.value,
                        })
                      }
                      placeholder='Nhập địa chỉ chi tiết...'
                    />
                  </Form.Group>
                </>
              )}
              <Form.Group className='mb-3'>
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
              </Form.Group>
              <Form.Group className='mb-3'>
                <Form.Label>Người tham gia (ID người dùng)</Form.Label>
                <Form.Control
                  type='text'
                  value={
                    editFormData.participants?.map((p) => p.userId).join(',') ||
                    ''
                  }
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      participants: e.target.value
                        .split(',')
                        .map((id) => ({ userId: id.trim(), status: 'invited' }))
                        .filter((p) => p.userId),
                    })
                  }
                  placeholder='Nhập ID người tham gia, cách nhau bằng dấu phẩy...'
                />
                <Form.Text className='text-muted'>
                  Tạm thời nhập ID người dùng, sẽ thay bằng tìm kiếm người dùng
                  sau.
                </Form.Text>
              </Form.Group>
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

        {/* Delete Confirmation Modal */}
        <Modal
          show={showDeleteModal}
          onHide={() => setShowDeleteModal(false)}
          centered
          backdrop='static'
        >
          <Modal.Header closeButton>
            <Modal.Title>Xác nhận xóa sự kiện</Modal.Title>
          </Modal.Header>
          <Modal.Body>Bạn có chắc chắn muốn xóa sự kiện này không?</Modal.Body>
          <Modal.Footer>
            <Button
              variant='secondary'
              onClick={() => setShowDeleteModal(false)}
            >
              Hủy
            </Button>
            <Button variant='danger' onClick={handleDeleteEvent}>
              Xóa
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </div>
  );
};

export default Calendar;
