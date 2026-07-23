import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class FindComboAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be formatted as YYYY-MM-DD' })
  date!: string;

  @IsString()
  @IsNotEmpty()
  barberServiceId!: string;

  @IsString()
  @IsNotEmpty()
  washServiceId!: string;
}
