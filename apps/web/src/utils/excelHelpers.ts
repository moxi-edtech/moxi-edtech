import { parse, isValid, format } from "date-fns";

/**
 * Converte data de Excel (serial ou string) para YYYY-MM-DD
 */
export const cleanExcelDate = (rawDate: any): string => {
  if (!rawDate) return "2000-01-01";

  if (rawDate instanceof Date) {
    return format(rawDate, "yyyy-MM-dd");
  }

  if (typeof rawDate === "number") {
    const date = new Date((rawDate - (25567 + 2)) * 86400 * 1000);
    return isValid(date) ? format(date, "yyyy-MM-dd") : "2000-01-01";
  }

  if (typeof rawDate === "string") {
    try {
      const parsed = parse(rawDate.trim(), "dd/MM/yyyy", new Date());
      if (isValid(parsed)) return format(parsed, "yyyy-MM-dd");
    } catch {
      return "2000-01-01";
    }
  }

  return "2000-01-01";
};

/**
 * Normaliza telefone (remove espaços, mantém +)
 */
export const cleanPhone = (phone: any): string | null => {
  if (!phone) return null;
  const str = phone.toString().replace(/[^\d+]/g, "");
  return str.length > 0 ? str : null;
};

