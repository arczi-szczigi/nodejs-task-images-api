import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { StorageService } from '../storage/storage.service';
import { ValidatedImage } from '../common/pipes/image-file.pipe';
import { CreateImageDto } from './dto/create-image.dto';
import { ImageResponseDto } from './dto/image-response.dto';
import { PaginatedImagesDto } from './dto/paginated-images.dto';
import { QueryImagesDto } from './dto/query-images.dto';
import { Image } from './entities/image.entity';
import { ImageProcessorService } from './image-processor.service';

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);
  private readonly baseUrl: string;

  constructor(
    @InjectRepository(Image) private readonly images: Repository<Image>,
    private readonly storage: StorageService,
    private readonly processor: ImageProcessorService,
    config: ConfigService,
  ) {
    this.baseUrl = config.get<string>('publicBaseUrl', 'http://localhost:3000');
  }

  /** Process + store an uploaded image and persist its metadata. */
  async create(dto: CreateImageDto, file: ValidatedImage): Promise<ImageResponseDto> {
    const processed = await this.processor.process(file.buffer, {
      width: dto.width,
      height: dto.height,
    });

    const storageKey = `${uuidv4()}.${processed.format}`;
    await this.storage.save(storageKey, processed.buffer);

    try {
      const entity = this.images.create({
        title: dto.title,
        storageKey,
        width: processed.width,
        height: processed.height,
        format: processed.format,
        sizeBytes: processed.buffer.length,
      });
      const saved = await this.images.save(entity);
      this.logger.log(`Stored image ${saved.id} (${storageKey})`);
      return ImageResponseDto.fromEntity(saved, this.baseUrl);
    } catch (err) {
      // Roll back the orphaned file if the DB write fails.
      await this.storage.delete(storageKey);
      throw err;
    }
  }

  /** List images with optional title filter and pagination. */
  async findAll(query: QueryImagesDto): Promise<PaginatedImagesDto> {
    const { title, page, limit } = query;

    const [rows, total] = await this.images.findAndCount({
      where: title ? { title: ILike(`%${title}%`) } : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: rows.map((img) => ImageResponseDto.fromEntity(img, this.baseUrl)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  /** Single image metadata by id. */
  async findOne(id: string): Promise<ImageResponseDto> {
    return ImageResponseDto.fromEntity(await this.getEntityOrFail(id), this.baseUrl);
  }

  /** Raw binary + content type for serving the image file. */
  async getRaw(id: string): Promise<{ buffer: Buffer; contentType: string }> {
    const image = await this.getEntityOrFail(id);
    if (!(await this.storage.exists(image.storageKey))) {
      throw new NotFoundException(`File for image "${id}" is missing from storage.`);
    }
    return {
      buffer: await this.storage.read(image.storageKey),
      contentType: `image/${image.format}`,
    };
  }

  private async getEntityOrFail(id: string): Promise<Image> {
    const image = await this.images.findOne({ where: { id } });
    if (!image) {
      throw new NotFoundException(`Image with id "${id}" not found.`);
    }
    return image;
  }
}
