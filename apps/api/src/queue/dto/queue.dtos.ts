import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinQueueDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  vehicleReg?: string;
}

export class WalkInQueueDto extends JoinQueueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  displayName!: string;
}

export class QueueQueryDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;
}
