/**
 * Joins a person's name parts, tolerating an empty last name (barbers are
 * on a first-name basis) without leaving a trailing space.
 */
export const fullName = (firstName: string, lastName: string | null | undefined): string =>
  `${firstName} ${lastName ?? ''}`.trim();
