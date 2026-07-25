import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

/**
 * Barber-operated outlets (San Ġiljan, San Ġwann, Pama) run a shared in-store
 * screen. It shows the queue board until a barber types their station PIN,
 * which opens the reception dashboard as that barber.
 */
export class StationLoginDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsString()
  @Length(4, 8)
  @Matches(/^\d+$/, { message: 'pin must be digits' })
  pin!: string;
}
