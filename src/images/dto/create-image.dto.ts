import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Body of `POST /images` (multipart/form-data, alongside the `file` field).
 * Numeric fields arrive as strings in multipart, so they are coerced via
 * `@Type(() => Number)` before validation.
 */
export class CreateImageDto {
  @ApiProperty({
    description: 'Human-readable image title.',
    example: 'Sunset over the mountains',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    description:
      'Target width in pixels. If provided, the image is resized to fit ' +
      'within width/height (aspect ratio preserved). Omit to keep original size.',
    example: 800,
    minimum: 1,
    maximum: 4000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4000)
  width?: number;

  @ApiPropertyOptional({
    description:
      'Target height in pixels. If provided, the image is resized to fit ' +
      'within width/height (aspect ratio preserved). Omit to keep original size.',
    example: 600,
    minimum: 1,
    maximum: 4000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4000)
  height?: number;
}
