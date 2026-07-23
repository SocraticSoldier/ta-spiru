import { IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateComboBookingDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsISO8601()
  startsAt!: string;

  @IsString()
  @IsNotEmpty()
  barberServiceId!: string;

  @IsString()
  @IsNotEmpty()
  washServiceId!: string;

  @IsString()
  @IsNotEmpty()
  barberId!: string;

  @IsString()
  @IsNotEmpty()
  washBayId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  vehicleReg?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
