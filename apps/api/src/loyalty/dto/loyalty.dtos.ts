import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RedeemPointsDto {
  @IsInt()
  @Min(1)
  points!: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

export class ScanPassDto {
  /** Raw QR payload (`taspiru:loyalty:v1:<token>`) or the bare wallet pass token. */
  @IsString()
  @IsNotEmpty()
  qrPayload!: string;
}
