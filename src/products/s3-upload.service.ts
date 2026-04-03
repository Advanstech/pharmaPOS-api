import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

export interface UploadResult {
  key: string;
  url: string;
  thumbnailUrl?: string;
}

@Injectable()
export class S3UploadService {
  private readonly logger = new Logger(S3UploadService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly cdnBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET') || 'pharmapos-images';
    this.cdnBaseUrl = this.configService.get<string>('CDN_BASE_URL') || `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
    
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
  }

  async uploadProductImage(
    buffer: Buffer,
    filename: string,
    mimetype: string,
    productId: string,
  ): Promise<UploadResult> {
    if (!this.isValidImageType(mimetype)) {
      throw new BadRequestException('Invalid image type. Allowed: jpeg, png, webp, gif');
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (buffer.length > maxSize) {
      throw new BadRequestException('Image too large. Max size: 5MB');
    }

    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const key = `products/${productId}/${uuidv4()}.${ext}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
          Metadata: {
            productId,
            originalName: filename,
            uploadedAt: new Date().toISOString(),
          },
        }),
      );

      const url = `${this.cdnBaseUrl}/${key}`;
      
      this.logger.log(`Uploaded image for product ${productId}: ${key}`);

      return {
        key,
        url,
        thumbnailUrl: `${url}?thumbnail=200`,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to upload image: ${message}`);
      throw new BadRequestException('Failed to upload image to storage');
    }
  }

  async deleteImage(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      this.logger.log(`Deleted image: ${key}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete image ${key}: ${message}`);
      throw new BadRequestException('Failed to delete image from storage');
    }
  }

  async getSignedUploadUrl(productId: string, filename: string, mimetype: string): Promise<string> {
    if (!this.isValidImageType(mimetype)) {
      throw new BadRequestException('Invalid image type');
    }

    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const key = `products/${productId}/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimetype,
    });

    return getSignedUrl(this.s3Client as any, command, { expiresIn: 300 }); // 5 minutes
  }

  private isValidImageType(mimetype: string): boolean {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    return allowed.includes(mimetype);
  }
}
