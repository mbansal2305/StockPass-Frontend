export const formatDateInputValue = (value: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
};

export const formatDateInputDraft = (input: string): string => {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  return digits.slice(0, 2)
    + (digits.length >= 2 ? '/' : '')
    + digits.slice(2, 4)
    + (digits.length >= 4 ? '/' : '')
    + digits.slice(4);
};

export const parseDateInputValue = (input: string): string | null => {
  const match = /^(\d{2})\s*[\/.\-\s]?\s*(\d{2})\s*[\/.\-\s]?\s*(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year === 0 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return null;
  return `${yearText}-${monthText}-${dayText}`;
};
