import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import sharp from 'sharp';
import { AppConfig } from '../../config/app-config.service.js';
import { randomToken } from '../../common/helpers/crypto.helper.js';

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_INPUT_FORMATS = new Set(['jpeg', 'png', 'webp']);

export interface StoredAvatar {
  key: string;
  url: string;
}

/** Profile pictures: validated, re-encoded (strips EXIF/GPS and any embedded payload) and stored in Cloudflare R2. */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;

  constructor(private readonly config: AppConfig) {
    const r2 = config.storage;
    this.client = r2
      ? new S3Client({
          region: 'auto',
          endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
        })
      : null;
    if (!r2) this.logger.warn('Cloudflare R2 is not configured - avatar uploads are disabled');
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async uploadAvatar(userId: string, input: Buffer): Promise<StoredAvatar> {
    const r2 = this.config.storage;
    if (!this.client || !r2) throw new ServiceUnavailableException('Profile picture storage is not configured');

    let compressed: Buffer;
    try {
      const image = sharp(input, { limitInputPixels: 40_000_000, failOn: 'error' });
      const { format } = await image.metadata();
      if (!format || !ALLOWED_INPUT_FORMATS.has(format)) throw new Error(`unsupported format ${format}`);
      compressed = await image
        .rotate() // honour EXIF orientation, then metadata is dropped on output
        .resize(512, 512, { fit: 'cover', position: 'attention' })
        .webp({ quality: 80, effort: 4 })
        .toBuffer();
    } catch {
      throw new BadRequestException('The file is not a valid JPEG, PNG or WebP image');
    }

    const key = `avatars/${userId}/${randomToken(12)}.webp`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: key,
        Body: compressed,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return { key, url: `${r2.publicBaseUrl}/${key}` };
  }

  /** Best effort: an orphaned object is preferable to failing the user's request. */
  async deleteObject(key: string): Promise<void> {
    const r2 = this.config.storage;
    if (!this.client || !r2) return;
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));
    } catch (error) {
      this.logger.warn({ msg: 'Failed to delete avatar object', key, err: (error as Error).message });
    }
  }
}
