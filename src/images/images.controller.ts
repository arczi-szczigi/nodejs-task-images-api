import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ImageFilePipe, ValidatedImage } from '../common/pipes/image-file.pipe';
import { CreateImageDto } from './dto/create-image.dto';
import { ImageResponseDto } from './dto/image-response.dto';
import { PaginatedImagesDto } from './dto/paginated-images.dto';
import { QueryImagesDto } from './dto/query-images.dto';
import { ImagesService } from './images.service';

@ApiTags('images')
@Controller('images')
export class ImagesController {
  constructor(
    private readonly images: ImagesService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      // Hard cap upload size — protects against memory-exhaustion DoS (OWASP A04).
      limits: { fileSize: Number(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Upload an image',
    description:
      'Uploads an image (multipart/form-data). The file is validated by its ' +
      'magic bytes, optionally resized to fit within width/height, re-encoded ' +
      'to WebP, and stored. Metadata is persisted and returned.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Image file plus metadata.',
    schema: {
      type: 'object',
      required: ['file', 'title'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Image file.' },
        title: { type: 'string', example: 'Sunset over the mountains' },
        width: { type: 'integer', example: 800, minimum: 1, maximum: 4000 },
        height: { type: 'integer', example: 600, minimum: 1, maximum: 4000 },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Image stored.', type: ImageResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid metadata (e.g. missing title, bad dimensions).' })
  @ApiUnprocessableEntityResponse({ description: 'Missing file or file is not a supported image.' })
  @ApiPayloadTooLargeResponse({ description: 'File exceeds the maximum allowed size.' })
  create(
    @UploadedFile(ImageFilePipe) file: ValidatedImage,
    @Body() dto: CreateImageDto,
  ): Promise<ImageResponseDto> {
    return this.images.create(dto, file);
  }

  @Get()
  @ApiOperation({
    summary: 'List images',
    description: 'Returns a paginated list of images, optionally filtered by title.',
  })
  @ApiOkResponse({ description: 'Paginated images.', type: PaginatedImagesDto })
  findAll(@Query() query: QueryImagesDto): Promise<PaginatedImagesDto> {
    return this.images.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get image metadata by id' })
  @ApiParam({ name: 'id', format: 'uuid', example: '3f1c2b7e-9a4d-4c1e-8b2a-1d6e5f0a9c34' })
  @ApiOkResponse({ description: 'Image metadata.', type: ImageResponseDto })
  @ApiNotFoundResponse({ description: 'No image with the given id.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ImageResponseDto> {
    return this.images.findOne(id);
  }

  @Get(':id/raw')
  @ApiOperation({
    summary: 'Fetch the image binary',
    description: 'Serves the stored image bytes. This is the URL returned in `url`.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'The image file.', content: { 'image/*': {} } })
  @ApiNotFoundResponse({ description: 'No image (or file) with the given id.' })
  async getRaw(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, contentType } = await this.images.getRaw(id);
    res.set({
      'Content-Type': contentType,
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Never let a browser sniff/execute a stored file as something else.
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(buffer);
  }
}
