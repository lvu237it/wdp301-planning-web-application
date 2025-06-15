import { isValid, format as formatDateFNS, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export const formatDateAMPMForVN = (date) => {
  if (!date || !isValid(new Date(date))) return null;
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  const zoned = toZonedTime(parsedDate, 'Asia/Ho_Chi_Minh');
  return formatDateFNS(zoned, 'dd/MM/yyyy hh:mm:ss a');
};
