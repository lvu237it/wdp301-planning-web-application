import { isValid, format as formatDateFNS, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// Format ngày giờ theo định dạng tiếng Việt chuẩn: dd/MM/yyyy hh:mm:ss AM/PM
export const formatDateAMPMForVN = (date) => {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date(date));
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

// Format ngày giờ cho thông báo với logic thời gian tương đối
export const formatDateForNotification = (date) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // Nếu trong vòng 24 giờ, hiển thị thời gian tương đối
    if (diffHours < 24 && diffHours >= 0) {
      if (diffHours < 1) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes <= 0 ? 'Just now' : `${diffMinutes} minutes ago`;
      }
      return `${Math.floor(diffHours)} hours ago`;
    }

    // Nếu quá 24 giờ hoặc trong tương lai, hiển thị ngày-tháng-năm hh:mm:ss AM/PM
    return formatDateAMPMForVN(date);
  } catch (error) {
    console.error('Error formatting notification date:', error);
    return formatDateAMPMForVN(date);
  }
};

// Format ngày giờ ngắn gọn (không có giây)
export const formatDateShortForVN = (date) => {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date(date));
  } catch (error) {
    console.error('Error formatting date short:', error);
    return '';
  }
};

// Legacy function để backward compatibility (deprecated)
export const formatDateFNSForVN = (date) => {
  console.warn(
    'formatDateFNSForVN is deprecated, use formatDateAMPMForVN instead'
  );
  return formatDateAMPMForVN(date);
};
