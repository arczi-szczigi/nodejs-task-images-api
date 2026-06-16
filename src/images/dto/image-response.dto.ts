import { ApiProperty } from '@nestjs/swagger';
import { Image } from '../entities/image.entity';

/** Public representation of an image, as required by the task spec. */
export class ImageResponseDto {
  @ApiProperty({
    description: 'Unique identifier.',
    example: '3f1c2b7e-9a4d-4c1e-8b2a-1d6e5f0a9c34',
  })
  id: string;

  @ApiProperty({
    description: 'Public URL to fetch the image binary.',
    example: 'http://localhost:3000/images/3f1c2b7e-9a4d-4c1e-8b2a-1d6e5f0a9c34/raw',
  })
  url: string;

  @ApiProperty({ description: 'Image title.', example: 'Sunset over the mountains' })
  title: string;

  @ApiProperty({ description: 'Width in pixels.', example: 800 })
  width: number;

  @ApiProperty({ description: 'Height in pixels.', example: 600 })
  height: number;

  static fromEntity(image: Image, baseUrl: string): ImageResponseDto {
    const dto = new ImageResponseDto();
    dto.id = image.id;
    dto.url = `${baseUrl}/images/${image.id}/raw`;
    dto.title = image.title;
    dto.width = image.width;
    dto.height = image.height;
    return dto;
  }
}
