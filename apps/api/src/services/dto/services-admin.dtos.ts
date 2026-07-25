import { LedgerTag, Seniority, ServiceKind } from '@ta-spiru/database';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase kebab-case' })
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEnum(ServiceKind)
  kind!: ServiceKind;

  @IsInt()
  @Min(0)
  durationMin!: number;

  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsEnum(LedgerTag)
  ledgerTag!: LedgerTag;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  photoUrl?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isComboEligible?: boolean;

  @IsOptional()
  @IsBoolean()
  isQuoteOnly?: boolean;

  /** Locations that offer this service. Defaults to all branches for barber services. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locationIds?: string[];
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsEnum(LedgerTag)
  ledgerTag?: LedgerTag;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  photoUrl?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isComboEligible?: boolean;

  @IsOptional()
  @IsBoolean()
  isQuoteOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locationIds?: string[];
}

export class ServiceTierInput {
  @IsEnum(Seniority)
  seniority!: Seniority;

  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsInt()
  @Min(0)
  durationMin!: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  serviceNo?: string;
}

export class SetTiersDto {
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => ServiceTierInput)
  tiers!: ServiceTierInput[];
}

export class UpsertBarberServiceDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDaily?: number;
}

/** New display order for the service list shown in the apps. */
export class ReorderServicesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  serviceIds!: string[];
}
