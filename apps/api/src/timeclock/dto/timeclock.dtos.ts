import { IsISO8601, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class PunchDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @Matches(/^\d{4,8}$/, { message: 'pin must be 4-8 digits' })
  pin!: string;
}

export class SetPinDto {
  @Matches(/^\d{4,8}$/, { message: 'pin must be 4-8 digits' })
  pin!: string;
}

export class EntriesQueryDto {
  @IsOptional()
  @IsString()
  locationId?: string;

  /** YYYY-MM-DD; defaults to today (UTC). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}

export class UpdateTimeEntryDto {
  @IsOptional()
  @IsISO8601()
  clockInAt?: string;

  @IsOptional()
  @IsISO8601()
  clockOutAt?: string;
}
