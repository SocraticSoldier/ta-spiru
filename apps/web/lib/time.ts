const getTimeZoneOffsetMs = (date: Date, timeZone: string): number => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  );
  return asUtc - date.getTime();
};

/** Converts Malta wall-clock date + time to its UTC instant. */
export const maltaToUtc = (isoDate: string, time: string): Date => {
  const naiveUtc = new Date(`${isoDate}T${time}:00.000Z`);
  return new Date(naiveUtc.getTime() - getTimeZoneOffsetMs(naiveUtc, 'Europe/Malta'));
};

export const formatTimeMalta = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-MT', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Malta',
  });

export const maltaHour = (iso: string): number =>
  Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Malta',
      hourCycle: 'h23',
      hour: '2-digit',
    }).format(new Date(iso)),
  );

export const todayMalta = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Malta' }).format(new Date());

export const shiftDate = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
