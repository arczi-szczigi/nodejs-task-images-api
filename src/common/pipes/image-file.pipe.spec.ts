import { UnprocessableEntityException } from '@nestjs/common';
import sharp from 'sharp';
import { ImageFilePipe } from './image-file.pipe';

const asMulterFile = (buffer: Buffer): Express.Multer.File =>
  ({ buffer, fieldname: 'file', originalname: 'x', size: buffer.length }) as Express.Multer.File;

describe('ImageFilePipe', () => {
  const pipe = new ImageFilePipe();

  const pngBuffer = () =>
    sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();

  it('accepts a genuine image and returns the detected mime/ext', async () => {
    const result = await pipe.transform(asMulterFile(await pngBuffer()));

    expect(result.mime).toBe('image/png');
    expect(result.ext).toBe('png');
  });

  it('throws 422 when no file is provided', async () => {
    await expect(pipe.transform(undefined)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('throws 422 when the bytes are not an image (spoofed upload)', async () => {
    const fakeImage = asMulterFile(Buffer.from('<?php system($_GET["c"]); ?>'));

    await expect(pipe.transform(fakeImage)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('rejects a disallowed file type even if it is a real file format', async () => {
    // PDF magic bytes — a real format, but not an allowed image
    const pdf = asMulterFile(Buffer.from('%PDF-1.4\n%fake pdf body'));

    await expect(pipe.transform(pdf)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
