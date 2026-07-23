import { IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @IsISO8601()
  startsAt!: string;

  /** Required for barber services. */
  @IsOptional()
  @IsString()
  barberId?: string;

  /** Required for wash services. */
  @IsOptional()
  @IsString()
  washBayId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  vehicleReg?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
