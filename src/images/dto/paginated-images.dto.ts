import { ApiProperty } from '@nestjs/swagger';
import { ImageResponseDto } from './image-response.dto';

/** Paginated wrapper for `GET /images`. */
export class PaginatedImagesDto {
  @ApiProperty({ type: [ImageResponseDto], description: 'Images on this page.' })
  data: ImageResponseDto[];

  @ApiProperty({ description: 'Total number of matching images.', example: 42 })
  total: number;

  @ApiProperty({ description: 'Current page (1-based).', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page.', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total number of pages.', example: 3 })
  totalPages: number;
}
