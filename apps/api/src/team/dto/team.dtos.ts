import { LeaveKind, LeaveStatus, Role, Seniority } from '@ta-spiru/database';
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
