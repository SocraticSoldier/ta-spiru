/** YYYY-MM-DD for `daysAhead` from today (device local, Malta for local users). */
export const dateAhead = (daysAhead: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
};

export const nextDates = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => dateAhead(index + 1));

export const shortDate = (iso: string): string => iso.slice(5); // MM-DD
