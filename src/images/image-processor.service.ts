import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

export interface ProcessOptions {
  width?: number;
  height?: number;
}

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
}

/**
 * Image processing via sharp.
 *
 * Security/quality notes:
 *  - The image is fully re-encoded to WebP. Re-encoding from scratch strips
 *    any embedded EXIF/ICC payloads and neutralises malformed-metadata
 *    tricks (OWASP A08 — integrity).
 *  - `failOn: 'error'` makes sharp reject corrupt/booby-trapped inputs.
 *  - Resizing uses `fit: inside` so the image is scaled (never upscaled,
 *    aspect ratio preserved) to fit the requested box — as the task prefers.
 */
@Injectable()
export class ImageProcessorService {
  async process(input: Buffer, opts: ProcessOptions): Promise<ProcessedImage> {
    let pipeline = sharp(input, { failOn: 'error' }).rotate(); // honour EXIF orientation, then drop it

    if (opts.width || opts.height) {
      pipeline = pipeline.resize({
        width: opts.width,
        height: opts.height,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const { data, info } = await pipeline
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      width: info.width,
      height: info.height,
      format: info.format,
    };
  }
}
