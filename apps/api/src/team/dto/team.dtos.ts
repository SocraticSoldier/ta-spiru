import { LeaveKind, LeaveStatus, Role, Seniority } from '@ta-spiru/database';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** Roles that can be created as staff from the team tab. */
export const STAFF_ROLES = [
  Role.MANAGER,
  Role.RECEPTIONIST,
  Role.BARBER,
  Role.WASH_ATTENDANT,
  Role.ADMIN,
] as const;

export class CreateTeamMemberDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  phone?: string;

  @IsOptional()
  @IsEnum(Seniority)
  seniority?: Seniority;

  @IsOptional()
  @IsInt()
  @Min(1)
  stationNo?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  entrance?: string;
}

export class UpdateTeamMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  phone?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsEnum(Seniority)
  seniority?: Seniority;

  @IsOptional()
  @IsInt()
  @Min(1)
  stationNo?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  entrance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  photoUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  minQueueGapMin?: number;

  @IsOptional()
  @IsBoolean()
  acceptsBookings?: boolean;

  /** Weekdays off: 0 = Sunday … 6 = Saturday. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  offDays?: number[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  leaveAllowanceDays?: number;

  @IsOptional()
  @IsISO8601()
  employmentDate?: string;

  @IsOptional()
  @IsISO8601()
  terminationDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateLeaveDto {
  @IsEnum(LeaveKind)
  kind!: LeaveKind;

  /** One or more days, YYYY-MM-DD. */
  @IsArray()
  @ArrayMaxSize(60)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true, message: 'dates must be formatted as YYYY-MM-DD' })
  dates!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}

export class DecideLeaveDto {
  @IsEnum(LeaveStatus)
  status!: LeaveStatus;
}

/** One working window on a day, in the branch's local wall-clock time. */
export class ShiftWindowDto {
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startsAt must be HH:mm' })
  startsAt!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endsAt must be HH:mm' })
  endsAt!: string;
}

/**
 * Replace a member's roster for one day. Two windows give the classic split
 * shift (e.g. 08:30-13:15 and 13:45-19:00); an empty list clears the day.
 */
export class SetShiftsDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be formatted as YYYY-MM-DD' })
  date!: string;

  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => ShiftWindowDto)
  windows!: ShiftWindowDto[];
}

/** Register a staff document. The file itself lives in object storage. */
export class AddDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(600)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  folder?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;
}

/** A barber recording a tip for themselves. */
export class RecordTipDto {
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  appointmentId?: string;
}
