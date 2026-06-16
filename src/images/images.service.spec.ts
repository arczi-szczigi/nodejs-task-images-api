import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { StorageService } from '../storage/storage.service';
import { ValidatedImage } from '../common/pipes/image-file.pipe';
import { Image } from './entities/image.entity';
import { ImageProcessorService } from './image-processor.service';
import { ImagesService } from './images.service';

describe('ImagesService', () => {
  let service: ImagesService;
  let repo: jest.Mocked<Repository<Image>>;
  let storage: jest.Mocked<StorageService>;
  let processor: jest.Mocked<ImageProcessorService>;

  const baseUrl = 'http://localhost:3000';

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ImagesService,
        {
          provide: getRepositoryToken(Image),
          useValue: {
            create: jest.fn((x) => x),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
        {
          provide: StorageService,
          useValue: {
            save: jest.fn(),
            read: jest.fn(),
            exists: jest.fn(),
            delete: jest.fn(),
          },
        },
        { provide: ImageProcessorService, useValue: { process: jest.fn() } },
        { provide: ConfigService, useValue: { get: () => baseUrl } },
      ],
    }).compile();

    service = moduleRef.get(ImagesService);
    repo = moduleRef.get(getRepositoryToken(Image));
    storage = moduleRef.get(StorageService);
    processor = moduleRef.get(ImageProcessorService);
  });

  describe('create', () => {
    const file: ValidatedImage = {
      buffer: Buffer.from('img'),
      mime: 'image/png',
      ext: 'png',
    };

    it('processes, stores the file and persists metadata, returning a DTO with url', async () => {
      processor.process.mockResolvedValue({
        buffer: Buffer.from('webp'),
        width: 800,
        height: 600,
        format: 'webp',
      });
      repo.save.mockImplementation(async (e: any) => ({ ...e, id: 'generated-id' }));

      const result = await service.create(
        { title: 'My pic', width: 800, height: 600 },
        file,
      );

      expect(processor.process).toHaveBeenCalledWith(file.buffer, {
        width: 800,
        height: 600,
      });
      expect(storage.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        id: 'generated-id',
        title: 'My pic',
        width: 800,
        height: 600,
        url: `${baseUrl}/images/generated-id/raw`,
      });
    });

    it('rolls back the stored file if the DB write fails', async () => {
      processor.process.mockResolvedValue({
        buffer: Buffer.from('webp'),
        width: 10,
        height: 10,
        format: 'webp',
      });
      storage.save.mockResolvedValue('key.webp');
      repo.save.mockRejectedValue(new Error('db down'));

      await expect(service.create({ title: 'x' }, file)).rejects.toThrow('db down');
      expect(storage.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('applies a case-insensitive title filter and pagination metadata', async () => {
      repo.findAndCount.mockResolvedValue([
        [
          {
            id: 'a',
            title: 'sunset',
            storageKey: 'a.webp',
            width: 100,
            height: 100,
            format: 'webp',
            sizeBytes: 1,
            createdAt: new Date(),
          },
        ],
        1,
      ]);

      const result = await service.findAll({ title: 'sun', page: 2, limit: 5 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { title: ILike('%sun%') },
          skip: 5,
          take: 5,
        }),
      );
      expect(result.total).toBe(1);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(1);
      expect(result.data[0].url).toContain('/images/a/raw');
    });

    it('omits the where clause when no title filter is given', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 1, limit: 20 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFound for a missing id', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
