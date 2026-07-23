import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class FindAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be formatted as YYYY-MM-DD' })
  date!: string;

  @IsString()
  @IsNotEmpty()
  serviceId!: string;
}

export class DayScheduleQueryDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be formatted as YYYY-MM-DD' })
  date!: string;
}
