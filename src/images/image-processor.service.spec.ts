import sharp from 'sharp';
import { ImageProcessorService } from './image-processor.service';

/** Helper: build a real raw image buffer of a given size and format. */
const makeImage = (
  width: number,
  height: number,
  format: 'png' | 'jpeg' = 'png',
): Promise<Buffer> =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 10, g: 120, b: 200 },
    },
  })
    [format]()
    .toBuffer();

describe('ImageProcessorService', () => {
  const service = new ImageProcessorService();

  it('re-encodes to webp and reports real dimensions', async () => {
    const input = await makeImage(300, 200, 'png');

    const result = await service.process(input, {});

    expect(result.format).toBe('webp');
    expect(result.width).toBe(300);
    expect(result.height).toBe(200);
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it('scales down to fit within width/height, preserving aspect ratio', async () => {
    const input = await makeImage(1000, 500, 'jpeg');

    const result = await service.process(input, { width: 200, height: 200 });

    // fit: inside → longest side becomes 200, ratio preserved
    expect(result.width).toBe(200);
    expect(result.height).toBe(100);
  });

  it('does not upscale images smaller than the requested size', async () => {
    const input = await makeImage(100, 100, 'png');

    const result = await service.process(input, { width: 800, height: 800 });

    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
  });

  it('rejects data that is not a valid image', async () => {
    await expect(
      service.process(Buffer.from('this is definitely not an image'), {}),
    ).rejects.toBeDefined();
  });
});
