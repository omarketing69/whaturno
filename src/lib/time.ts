/** Utilidades de fecha en la zona horaria del negocio (sin dependencias externas). */

function partsInTz(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

/** Diferencia (ms) entre la hora local de la zona y UTC en ese instante. */
function tzOffset(date: Date, timeZone: string): number {
  const p = partsInTz(date, timeZone);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instante UTC correspondiente a la medianoche local de y-m-d en la zona. */
function zonedMidnight(y: number, m: number, d: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d);
  let result = guess - tzOffset(new Date(guess), timeZone);
  result = guess - tzOffset(new Date(result), timeZone); // corrige cambios de horario
  return new Date(result);
}

export function localDateKey(date: Date, timeZone: string): string {
  const p = partsInTz(date, timeZone);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function startOfDay(date: Date, timeZone: string): Date {
  const p = partsInTz(date, timeZone);
  return zonedMidnight(p.y, p.m, p.d, timeZone);
}

export type RangeKey = "today" | "yesterday" | "week" | "month";

export function dateRange(range: RangeKey, timeZone: string, now = new Date()): { from: Date; to: Date } {
  const p = partsInTz(now, timeZone);
  const today = zonedMidnight(p.y, p.m, p.d, timeZone);
  switch (range) {
    case "today":
      return { from: today, to: now };
    case "yesterday": {
      const noonYesterday = new Date(Date.UTC(p.y, p.m - 1, p.d - 1, 12));
      return { from: zonedMidnight(noonYesterday.getUTCFullYear(), noonYesterday.getUTCMonth() + 1, noonYesterday.getUTCDate(), timeZone), to: today };
    }
    case "week": {
      // Semana iniciando el lunes
      const weekday = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay(); // 0 = domingo
      const back = (weekday + 6) % 7;
      const monday = new Date(Date.UTC(p.y, p.m - 1, p.d - back));
      return { from: zonedMidnight(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate(), timeZone), to: now };
    }
    case "month":
      return { from: zonedMidnight(p.y, p.m, 1, timeZone), to: now };
  }
}

export function formatTime(date: Date | null | undefined, timeZone: string): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-CO", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

export function formatDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-CO", { timeZone, day: "2-digit", month: "short" }).format(date);
}

export function minutesBetween(a: Date | null | undefined, b: Date | null | undefined): number | null {
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 60000);
}
