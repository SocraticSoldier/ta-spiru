import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * A visit: several barber services booked back-to-back with one barber in a
 * single sitting. The customer flow builds this from the Haircuts, Beards and
 * Add-ons cards.
 */
export class CreateVisitDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  /** In the order they will be performed — haircut first, then extras. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  serviceIds!: string[];

  @IsISO8601()
  startsAt!: string;

  @IsString()
  @IsNotEmpty()
  barberId!: string;

  /**
   * Optional car wash taken alongside the visit (Fgura only). The car is washed
   * on a bay while the customer is in the chair, so these run in parallel with
   * the barber segments rather than after them. Several may be stacked — an
   * exterior wash plus a wax, say — and the bay is held for all of them.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  washServiceIds?: string[];

  /** Required when washServiceIds is given. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  washBayId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  vehicleReg?: string;

  /**
   * Staff only: book on behalf of this customer. Ignored for customers booking
   * for themselves.
   */
  @IsOptional()
  @IsString()
  customerId?: string;

  /** Book for a family member on the account (points stay on the account). */
  @IsOptional()
  @IsString()
  memberId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
