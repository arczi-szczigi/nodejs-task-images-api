import {
  Injectable,
  PipeTransform,
  UnprocessableEntityException,
} from '@nestjs/common';
import { fromBuffer } from 'file-type';

/** MIME types we accept. The check is by file content, not by extension/header. */
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  'image/avif',
]);

export interface ValidatedImage {
  buffer: Buffer;
  mime: string;
  ext: string;
}

/**
 * Validates that an uploaded file is really an image by inspecting its
 * magic bytes (via `file-type`) — NOT the client-supplied filename or
 * Content-Type, both of which are trivially spoofable. (OWASP A05)
 *
 * Size is enforced separately by Multer's `limits.fileSize`; here we only
 * assert presence and true content type.
 */
@Injectable()
export class ImageFilePipe
  implements PipeTransform<Express.Multer.File | undefined, Promise<ValidatedImage>>
{
  async transform(file: Express.Multer.File | undefined): Promise<ValidatedImage> {
    if (!file) {
      throw new UnprocessableEntityException(
        'No file uploaded. Send the image in the "file" multipart field.',
      );
    }

    const detected = await fromBuffer(file.buffer);
    if (!detected || !ALLOWED_MIME.has(detected.mime)) {
      throw new UnprocessableEntityException(
        `Unsupported or invalid image. Detected content type: ` +
          `${detected?.mime ?? 'unknown'}. Allowed: ${[...ALLOWED_MIME].join(', ')}.`,
      );
    }

    return { buffer: file.buffer, mime: detected.mime, ext: detected.ext };
  }
}
