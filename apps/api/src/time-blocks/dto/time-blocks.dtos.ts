import { IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateTimeBlockDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  /** Omit to block the whole location (chairs and wash bays). */
  @IsOptional()
  @IsString()
  barberId?: string;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  reason?: string;
}

export class TimeBlocksQueryDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be formatted as YYYY-MM-DD' })
  date!: string;
}
