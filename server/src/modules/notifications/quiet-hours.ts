export type QuietHours = { start: string; end: string }; // "HH:mm", 24ч

// AppUser.tz — IANA-зона ("Asia/Almaty"). Intl.DateTimeFormat с timeZone
// делает конвертацию без внешней tz-библиотеки (в проекте её нет, см.
// package.json) — этого достаточно, нам нужны только часы и минуты.
export function localTimeParts(
  now: Date,
  tz: string,
): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = Number(parts.find((p) => p.type === "minute")!.value);
  return { hour, minute };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// quietHours: null — без ограничения (не "всегда тихо", см. комментарий к
// модели AlertRule в schema.prisma). start/end поддерживают переход через
// полночь (напр. 22:00–08:00): если start > end, тихий интервал — это
// [start, 24:00) ∪ [00:00, end).
export function isWithinQuietHours(
  now: Date,
  tz: string,
  quietHours: QuietHours | null,
): boolean {
  if (!quietHours) return false;

  const { hour, minute } = localTimeParts(now, tz);
  const nowMinutes = hour * 60 + minute;
  const start = toMinutes(quietHours.start);
  const end = toMinutes(quietHours.end);

  if (start === end) return false; // вырожденный диапазон — не считаем "всегда тихо"
  if (start < end) return nowMinutes >= start && nowMinutes < end;
  return nowMinutes >= start || nowMinutes < end;
}
