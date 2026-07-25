import { AppointmentStatus } from '@ta-spiru/database';
import { IsBoolean, IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Statuses staff may set from the kiosk / reception screens. */
export const SETTABLE_STATUSES = [
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.NO_SHOW,
  AppointmentStatus.LATE,
] as const;

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus)
  status!: AppointmentStatus;
}

export class AddServiceDto {
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  /**
   * The added time may run into the barber's next booking. The first attempt
   * returns 409 OVERLAP_CONFIRM_REQUIRED; retrying with acceptOverlap=true is
   * the barber taking responsibility for keeping the next client on time.
   */
  @IsOptional()
  @IsBoolean()
  acceptOverlap?: boolean;
}

/** Move a booking to a new time and, optionally, a new barber. */
export class RescheduleBookingDto {
  @IsISO8601()
  startsAt!: string;

  @IsOptional()
  @IsString()
  barberId?: string;
}
