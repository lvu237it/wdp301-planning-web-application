const { format, toZonedTime } = require('date-fns-tz');

const { enUS } = require('date-fns/locale');
// const dateFormat = 'dd-MM-yyyy HH:mm:ss a';
// const timeZone = 'Asia/Ho_Chi_Minh';

function formatDateToTimeZone(
  date,
  timeZone = 'Asia/Ho_Chi_Minh',
  dateFormat = 'dd-MM-yyyy HH:mm:ss a'
) {
  // Kiểm tra xem date có phải là một đối tượng Date hợp lệ không
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided');
  }
  // Kiểm tra xem timeZone có phải là một chuỗi không
  if (typeof timeZone !== 'string' || !timeZone) {
    throw new Error('Invalid time zone provided');
  }
  // Kiểm tra xem dateFormat có phải là một chuỗi không
  if (typeof dateFormat !== 'string' || !dateFormat) {
    throw new Error('Invalid date format provided');
  }

  // Chuyển đổi ngày giờ UTC sang múi giờ cụ thể
  const zonedDate = toZonedTime(date, timeZone);

  // Định dạng ngày giờ theo định dạng mong muốn
  return format(zonedDate, dateFormat, { locale: enUS });
}

module.exports = {
  formatDateToTimeZone,
};
