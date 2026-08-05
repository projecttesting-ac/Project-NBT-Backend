import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  whatToExpect?: string;

  @IsOptional()
  @IsString()
  organizerNote?: string;

  @IsDateString()
  eventDate!: string;

  @IsString()
  @IsNotEmpty()
  venueName!: string;

  @IsString()
  @IsNotEmpty()
  venueAddress!: string;

  @IsOptional()
  @IsString()
  posterUrl?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}