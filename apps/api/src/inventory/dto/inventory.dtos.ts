import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, NotEquals } from 'class-validator';

export class StockIntakeDto {
  @IsOptional()
  @IsString()
  productId?: string;

  /** EAN/UPC scanned with the device camera; alternative to productId. */
  @IsOptional()
  @IsString()
  barcode?: string;

  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;
}

export class StockTransferDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  fromLocationId!: string;

  @IsString()
  @IsNotEmpty()
  toLocationId!: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity!: number;
}

export class StockAdjustDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsInt()
  @NotEquals(0)
  quantityDelta!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  reason!: string;
}

export class BackBarUseDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

export class LevelsQueryDto {
  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsString()
  lowStockOnly?: string;
}

/** A customer returns a product at the desk; stock goes back on the shelf. */
export class ProductReturnDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
