import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** URL-notification payload posted by Trust Payments after an authorisation attempt. */
export class TrustPaymentsWebhookDto {
  @IsString()
  @IsNotEmpty()
  transactionreference!: string;

  @IsString()
  @IsNotEmpty()
  orderreference!: string;

  @IsString()
  @IsNotEmpty()
  sitereference!: string;

  @IsString()
  errorcode!: string;

  @IsOptional()
  @IsString()
  settlestatus?: string;

  @IsOptional()
  @IsString()
  baseamount?: string;

  @IsOptional()
  @IsString()
  currencyiso3a?: string;

  @IsOptional()
  @IsString()
  paymenttypedescription?: string;

  @IsOptional()
  @IsString()
  requestreference?: string;

  @IsOptional()
  @IsString()
  responsesitesecurity?: string;
}
