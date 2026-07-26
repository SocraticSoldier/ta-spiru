import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class FindAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be formatted as YYYY-MM-DD' })
  date!: string;

  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  /**
   * Extra services booked back-to-back in the same visit (comma-separated ids).
   * The customer flow adds a beard service and add-ons on top of the haircut,
   * so slots have to be wide enough for the whole visit, not just the first
   * service.
   */
  @IsOptional()
  @IsString()
  extraServiceIds?: string;

  /** Only return slots this barber can take. Omit for "any barber". */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  barberId?: string;
}

export class DayScheduleQueryDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be formatted as YYYY-MM-DD' })
  date!: string;
}
