import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { LedgerTag, PaymentChannel } from '@ta-spiru/database';

export class SplitLedgerTagDto {
  @IsEnum(LedgerTag)
  tag!: LedgerTag;

  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  locationId?: string;
}

export class CreatePaymentIntentDto {
  @IsInt()
  @Min(50)
  amountCents!: number;

  @IsOptional()
  @IsIn(['EUR', 'GBP', 'USD'])
  currency?: string;

  @IsEnum(PaymentChannel)
  channel!: PaymentChannel;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SplitLedgerTagDto)
  splitLedgerTags!: SplitLedgerTagDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  appointmentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  orderIds?: string[];
}
