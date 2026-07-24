import { WaitingListStatus } from '@ta-spiru/database';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class JoinWaitingListDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  /** Omit for "any barber". */
  @IsOptional()
  @IsString()
  barberId?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'forDate must be formatted as YYYY-MM-DD' })
  forDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}

export class WaitingListQueryDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be formatted as YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsEnum(WaitingListStatus)
  status?: WaitingListStatus;
}

export class UpdateWaitingListDto {
  @IsEnum(WaitingListStatus)
  status!: WaitingListStatus;
}
