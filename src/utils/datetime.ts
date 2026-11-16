const PARAGUAY_TZ = "America/Asuncion";
const LOCALE = "es-PY";

type DateInput = string | Date | null | undefined;

/** Parsea ISO/UTC. Si el string no trae zona horaria, se asume UTC (MySQL devuelve UTC sin sufijo). */
export function parseUtcDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();
  if (!raw) return null;

  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const date = new Date(hasTimeZone ? raw : `${raw}Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

const toDate = parseUtcDate;

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: PARAGUAY_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const dateTimeShortFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: PARAGUAY_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: PARAGUAY_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: PARAGUAY_TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Fecha + hora en horario de Paraguay (America/Asuncion). */
export function formatPyDateTime(value: DateInput): string {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : "—";
}

/** Fecha + hora (sin segundos) en horario de Paraguay. */
export function formatPyDateTimeShort(value: DateInput): string {
  const date = toDate(value);
  return date ? dateTimeShortFormatter.format(date) : "—";
}

/** Sólo fecha en horario de Paraguay. */
export function formatPyDate(value: DateInput): string {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : "—";
}

/** Sólo hora en horario de Paraguay. */
export function formatPyTime(value: DateInput): string {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : "—";
}

/** Marca de tiempo para nombres de archivo: yyyy-MM-dd_HH-mm-ss en horario de Paraguay. */
export function paraguayFileStamp(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARAGUAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}_${get("hour")}-${get("minute")}-${get("second")}`;
}

/**
 * Offset de Paraguay (en minutos) para un instante dado.
 * Positivo/negativo según la zona; se calcula con Intl para respetar DST si existiera.
 */
function paraguayOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PARAGUAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** Convierte un instante UTC al valor "YYYY-MM-DDTHH:mm" en hora Paraguay (para <input datetime-local>). */
export function utcToParaguayInputValue(value: DateInput): string {
  const date = toDate(value);
  if (!date) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARAGUAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Interpreta "YYYY-MM-DDTHH:mm" como hora Paraguay y devuelve ISO UTC. */
export function paraguayInputValueToUtcIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec((value || "").trim());
  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  let offset = paraguayOffsetMinutes(guess);
  let utc = new Date(guess.getTime() - offset * 60000);

  // Refinar por si el offset cambió (DST).
  const refined = paraguayOffsetMinutes(utc);
  if (refined !== offset) {
    utc = new Date(guess.getTime() - refined * 60000);
  }

  return utc.toISOString();
}
