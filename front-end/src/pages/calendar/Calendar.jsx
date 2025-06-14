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
const generateMapsUrl = (address, locationName) => {
  if (!address && !locationName) return null;

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
  const searchQuery = [
    locationName,
    typeof address === 'string' ? address : address?.formattedAddress,
  ]
    .filter(Boolean)
    .join(', ');

  if (searchQuery) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      searchQuery
    )}`;
  }

  return null;
};

// Helper function để safely extract address data
const getAddressDisplay = (address, locationName) => {
  if (!address) return '';

  if (typeof address === 'string') {
    return address;
  }

  if (typeof address === 'object') {
    return address.formattedAddress || address.address || '';
  }

  return '';
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
    updateEventStatusByTime,
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
    locationName: '',
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
      { value: 'scheduled', label: 'Chưa diễn ra' },
      { value: 'in-progress', label: 'Đang diễn ra' },
      { value: 'completed', label: 'Đã xong' },
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
        toast.error(error.response?.data?.message || 'Không thể tải sự kiện');
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

    window.addEventListener('eventUpdated', handleEventUpdated);
    return () => {
      window.removeEventListener('eventUpdated', handleEventUpdated);
    };
  }, [debouncedFetchEvents, dateRange, searchTerm]);

  // Đồng bộ filteredEvents với events
  useEffect(() => {
    setFilteredEvents(events);
  }, [events]);

  // Khởi tạo lấy sự kiện
  useEffect(() => {
    let userId = userDataLocal?.id || userDataLocal?._id;
    if (!accessToken || !userId) {
      console.log('accesstoken', accessToken);
      console.log('userDataLocal', userDataLocal.id);
      console.log(' userDataLocal._id', userDataLocal._id);
      console.log(
        'Chưa đăng nhập hoặc không có userDataLocal, chuyển hướng đến login'
      );
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
        locationName: eventInfo.event.extendedProps.locationName,
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
        toast.error('Không thể di chuyển sự kiện này do trạng thái hiện tại');
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
      locationName: '',
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
      locationName: selectedEvent.locationName || '',
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
    async (e) => {
      e.preventDefault();
      if (!formData.title.trim()) {
        toast.error('Vui lòng nhập tiêu đề sự kiện');
        return;
      }

      // Chỉ validate date khi không phải sự kiện cả ngày
      if (
        !formData.allDay &&
        new Date(formData.startDate) > new Date(formData.endDate)
      ) {
        toast.error('Thời gian kết thúc phải sau thời gian bắt đầu');
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
          locationName: formData.locationName || undefined,
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
            startDate: toLocalDateTime(new Date()),
            endDate: toLocalDateTime(new Date()),
            type: 'offline',
            locationName: '',
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
        toast.error(error.response?.data?.message || 'Không thể thêm sự kiện');
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
        toast.error('Vui lòng nhập tiêu đề sự kiện');
        return;
      }

      // Chỉ validate date khi không phải sự kiện cả ngày
      if (
        !editFormData.allDay &&
        new Date(editFormData.startDate) > new Date(editFormData.endDate)
      ) {
        toast.error('Thời gian kết thúc phải sau thời gian bắt đầu');
        return;
      }

      try {
        setIsUpdatingEvent(true);
        // Chỉ gửi những field đã được thay đổi
        const payload = {
          title: editFormData.title,
          description: editFormData.description || undefined,
          type: editFormData.type,
          locationName: editFormData.locationName || undefined,
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
    return events.filter((event) => {
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === selectedDate.toDateString();
    });
  }, [events, selectedDate]);

  // Debug selectedDateEvents
  useEffect(() => {
    console.log('Selected date:', selectedDate.toDateString());
    console.log('Selected date events:', selectedDateEvents);
  }, [selectedDate, selectedDateEvents]);

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

  // Component nút xem vị trí trên bản đồ
  const MapLocationButton = ({
    address,
    locationName,
    className = '',
    size = 'sm',
  }) => {
    const mapsUrl = generateMapsUrl(address, locationName);

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
          title='Xem trên bản đồ'
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
        Xem trên bản đồ
      </Button>
    );
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
                                {!event.extendedProps.isOwn && (
                                  <div className='event-participated-badge'>
                                    👥 Tham gia
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
                                        'in-progress' && '🔄 Đang diễn ra'}
                                      {event.extendedProps.status ===
                                        'completed' && '✅ Đã xong'}
                                      {event.extendedProps.status ===
                                        'cancelled' && '❌ Đã hủy'}
                                      {event.extendedProps.status === 'draft' &&
                                        '📝 Nháp'}
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
                              {event.extendedProps.locationName && (
                                <div className='event-meta-item'>
                                  <span>📍</span>
                                  <span>
                                    {event.extendedProps.locationName}
                                  </span>
                                  {event.extendedProps.type === 'offline' && (
                                    <MapLocationButton
                                      address={event.extendedProps.address}
                                      locationName={
                                        event.extendedProps.locationName
                                      }
                                      size='xs'
                                      className='ms-1'
                                    />
                                  )}
                                </div>
                              )}
                              {event.extendedProps.type === 'online' &&
                                event.extendedProps?.onlineUrl && (
                                  <div className='event-meta-item'>
                                    <span>🌐</span>
                                    <span>
                                      <a
                                        href={event.extendedProps?.onlineUrl}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                      >
                                        Link sự kiện
                                      </a>
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
                            <span className=''>(cả ngày)</span>
                          </>
                        ) : (
                          <>
                            {formatEventDate(selectedEvent.start)}
                            {selectedEvent.end &&
                              ` đến ${formatEventDate(selectedEvent.end)}`}
                          </>
                        )}
                      </p>
                      {selectedEvent.locationName && (
                        <p>
                          <span className='me-2'>📍</span>
                          Địa điểm: {selectedEvent.locationName}
                        </p>
                      )}
                      {selectedEvent.address && (
                        <div>
                          <p className='mb-1'>
                            <span className='me-2'>🏠</span>
                            Địa chỉ chi tiết:{' '}
                            {getAddressDisplay(selectedEvent.address)}
                          </p>
                          {selectedEvent.type === 'offline' && (
                            <MapLocationButton
                              address={selectedEvent.address}
                              locationName={selectedEvent.locationName}
                              className='mb-2'
                            />
                          )}
                        </div>
                      )}
                      {selectedEvent.type === 'online' &&
                        selectedEvent?.onlineUrl && (
                          <p>
                            <span className='me-2'>🌐</span>
                            Link sự kiện:{' '}
                            <a
                              href={selectedEvent?.onlineUrl}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='event-open-meeting-button'
                              title='Mở link sự kiện'
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
                          <span className='me-2'>📝</span>
                          Mô tả: {selectedEvent.description}
                        </p>
                      )}
                      <p>
                        <FaUser className='ms-1 me-2' />
                        Người tạo: {selectedEvent?.organizer.username}
                      </p>
                      {selectedEvent.participants?.filter(
                        (p) => p.status === 'accepted'
                      ).length > 0 && (
                        <p>
                          <span className='me-2'>👥</span>
                          Người tham gia:{' '}
                          {selectedEvent.participants
                            .filter((p) => p.status === 'accepted')
                            .map((p) => p.email || p.name || 'Người dùng')
                            .join(', ')}
                        </p>
                      )}
                      <p>
                        <span className='me-2'>📊</span>
                        Trạng thái:{' '}
                        <span
                          className={`event-status-badge status-${selectedEvent.status} ms-1`}
                        >
                          {selectedEvent.status === 'in-progress' &&
                            '🔄 Đang diễn ra'}
                          {selectedEvent.status === 'completed' && '✅ Đã xong'}
                          {selectedEvent.status === 'cancelled' && '❌ Đã hủy'}
                          {selectedEvent.status === 'draft' && '📝 Nháp'}
                          {selectedEvent.status === 'scheduled' &&
                            '📅 Chưa diễn ra'}
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
                  </div>
                  {canModifyEvent(selectedEvent) && (
                    <div className='event-modal-actions'>
                      {canEditEvent(selectedEvent) && (
                        <Button
                          variant='outline-light'
                          onClick={handleEditClick}
                          disabled={isUpdatingEvent}
                        >
                          <FaEdit className='me-2' />
                          Chỉnh sửa
                        </Button>
                      )}
                      {canDeleteEvent(selectedEvent) && (
                        <Button
                          variant='outline-danger'
                          onClick={() => setShowDeleteModal(true)}
                          disabled={isUpdatingEvent}
                        >
                          <FaTrash className='me-2' />
                          Xóa
                        </Button>
                      )}
                      {/* {!canEditEvent(selectedEvent) &&
                        !canDeleteEvent(selectedEvent) && (
                          <div className='text-muted small'>
                            <span className='me-2'>ℹ️</span>
                            {selectedEvent.status === 'in-progress' &&
                              'Sự kiện đang diễn ra không thể chỉnh sửa hoặc xóa'}
                            {selectedEvent.status === 'completed' &&
                              'Sự kiện đã hoàn thành không thể chỉnh sửa hoặc xóa'}
                          </div>
                        )} */}
                      {/* {!canEditEvent(selectedEvent) &&
                        canDeleteEvent(selectedEvent) && (
                          <div className='text-muted small'>
                            <span className='me-2'>ℹ️</span>
                            {selectedEvent.status === 'cancelled' &&
                              'Sự kiện đã hủy chỉ có thể xóa, không thể chỉnh sửa'}
                          </div>
                        )} */}
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
                  <Col>
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
                      <Form.Label>Thời gian bắt đầu *</Form.Label>
                      <Form.Control
                        type={formData.allDay ? 'date' : 'datetime-local'}
                        value={
                          formData.allDay
                            ? formData.startDate.split('T')[0]
                            : formData.startDate
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
                      <Form.Label>Thời gian kết thúc *</Form.Label>
                      <Form.Control
                        type={formData.allDay ? 'date' : 'datetime-local'}
                        value={
                          formData.allDay
                            ? formData.endDate.split('T')[0]
                            : formData.endDate
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
                {/* {formData.type === 'online' && (
                <>
                  <Form.Group className='mb-3'>
                    <Form.Label>Mật khẩu cuộc họp</Form.Label>
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
              )} */}
                {formData.type === 'offline' && (
                  <>
                    <Form.Group className='mb-3'>
                      <Form.Label>Tên địa điểm</Form.Label>
                      <Form.Control
                        type='text'
                        value={formData.locationName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            locationName: e.target.value,
                          })
                        }
                        placeholder='Ví dụ: Phòng họp A, Trường FPT, Nhà văn hóa...'
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
                        placeholder='Ví dụ: 8 Tôn Thất Thuyết, Mỹ Đình, Nam Từ Liêm, Hà Nội'
                      />
                      <Form.Text className='text-muted'>
                        Nhập địa chỉ chi tiết để hệ thống tự động xác định tọa
                        độ trên bản đồ
                      </Form.Text>
                    </Form.Group>
                  </>
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
                    Mời người tham gia (email ngăn cách bởi dấu phẩy)
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
                    placeholder='Nhập email người tham gia để mời, cách nhau bằng dấu phẩy...'
                  />
                  <Form.Text className='text-muted'>
                    Ví dụ: user1@gmail.com, user2@fpt.edu.vn. Hệ thống sẽ tự
                    động tìm kiếm và gửi lời mời cho những người dùng có email
                    hợp lệ.
                  </Form.Text>
                </Form.Group>
                <div className='d-flex justify-content-end gap-2'>
                  <Button
                    variant='outline-light'
                    onClick={() => setShowCreateModal(false)}
                    type='button'
                    disabled={isCreatingEvent}
                  >
                    Hủy
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
                        Đang tạo...
                      </>
                    ) : (
                      <>
                        <FaPlus className='me-2' />
                        Tạo sự kiện
                      </>
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
                Chỉnh sửa sự kiện
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form onSubmit={handleEditSubmit}>
                <Row>
                  <Col>
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
                      <Form.Label>Thời gian bắt đầu *</Form.Label>
                      <Form.Control
                        type={editFormData.allDay ? 'date' : 'datetime-local'}
                        value={
                          editFormData.allDay
                            ? (editFormData.startDate || '').split('T')[0]
                            : editFormData.startDate || ''
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
                      <Form.Label>Thời gian kết thúc *</Form.Label>
                      <Form.Control
                        type={editFormData.allDay ? 'date' : 'datetime-local'}
                        value={
                          editFormData.allDay
                            ? (editFormData.endDate || '').split('T')[0]
                            : editFormData.endDate || ''
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
                {/* {editFormData.type === 'online' && (
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
              )} */}
                {editFormData.type === 'offline' && (
                  <>
                    <Form.Group className='mb-3'>
                      <Form.Label>Tên địa điểm</Form.Label>
                      <Form.Control
                        type='text'
                        value={editFormData.locationName || ''}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            locationName: e.target.value,
                          })
                        }
                        placeholder='Ví dụ: Phòng họp A, Trường FPT, Nhà văn hóa...'
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
                        placeholder='Ví dụ: 8 Tôn Thất Thuyết, Mỹ Đình, Nam Từ Liêm, Hà Nội'
                      />
                      <Form.Text className='text-muted'>
                        Nhập địa chỉ chi tiết để hệ thống tự động xác định tọa
                        độ trên bản đồ
                      </Form.Text>
                    </Form.Group>
                  </>
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
                    Thêm người tham gia mới (email ngăn cách bởi dấu phẩy)
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
                    placeholder='Nhập email người tham gia mới để mời thêm...'
                  />
                </Form.Group>
                <div className='d-flex justify-content-end gap-2'>
                  <Button
                    variant='outline-light'
                    onClick={() => setShowEditModal(false)}
                    type='button'
                    disabled={isUpdatingEvent}
                  >
                    Hủy
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
                        Đang cập nhật...
                      </>
                    ) : (
                      <>
                        <FaEdit className='me-2' />
                        Cập nhật
                      </>
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
              <Modal.Title>Xác nhận xóa sự kiện</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              Bạn có chắc chắn muốn xóa sự kiện này không?
            </Modal.Body>
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
    </>
  );
};

export default Calendar;
