export type DateParts = {
  day: string;
  month: string;
  year: string;
};

export type DatePartKey = keyof DateParts;

const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function numericDatePart(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

export function normalizeDateParts(parts: DateParts): DateParts {
  return {
    day: numericDatePart(parts.day, 2),
    month: numericDatePart(parts.month, 2),
    year: numericDatePart(parts.year, 4),
  };
}

export function splitDate(value?: string): DateParts {
  const cleaned = value?.replace(/^~/, "") ?? "";
  const [year = "", month = "", day = ""] = cleaned.split("-");
  return normalizeDateParts({ day, month, year });
}

export function datePartsError(parts: DateParts) {
  const normalized = normalizeDateParts(parts);
  const year = Number(normalized.year);
  const month = Number(normalized.month);
  const day = Number(normalized.day);

  if (!normalized.year && (normalized.month || normalized.day)) return "Укажите год.";
  if (!normalized.year) return "";
  if (year < 1 || year > 9999) return "Проверьте год.";
  if (!normalized.month && normalized.day) return "Укажите месяц.";
  if (!normalized.month) return "";
  if (month < 1 || month > 12) return "Проверьте месяц.";
  if (!normalized.day) return "";
  if (day < 1 || day > daysInMonth[month - 1]) return "Проверьте день.";
  return "";
}

export function joinDate(parts: DateParts) {
  const normalized = normalizeDateParts(parts);
  if (datePartsError(normalized)) return undefined;

  const year = normalized.year;
  const month = normalized.month.padStart(2, "0");
  const day = normalized.day.padStart(2, "0");

  if (!year) return undefined;
  if (!normalized.month) return year;
  if (!normalized.day) return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}
