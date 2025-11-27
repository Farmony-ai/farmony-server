// src/modules/aws/s3.service.ts
import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly cloudfrontDomain: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION');
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');
    this.cloudfrontDomain = this.configService.get<string>('CLOUDFRONT_DOMAIN', '');
    
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });

    console.log(`S3Service initialized with bucket: ${this.bucketName} in region: ${this.region}`);
    if (this.cloudfrontDomain) {
      console.log(`Using CloudFront domain: ${this.cloudfrontDomain}`);
    } else {
      console.warn('⚠️  CloudFront domain not configured. Using S3 direct URLs.');
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    const key = `${folder}/${uuid()}-${file.originalname.replace(/\s+/g, '-')}`;
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      // Important: Set cache headers for CloudFront
      CacheControl: 'public, max-age=31536000', // Cache for 1 year
      ContentDisposition: 'inline', // Display in browser instead of download
      Metadata: {
        originalName: file.originalname,
        uploadedAt: new Date().toISOString(),
      }
    });
    
    console.log("Uploading to S3:", key);

    try {
      await this.s3Client.send(command);
      console.log(`Successfully uploaded file: ${key}`);
      return key;
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /**
   * Get public URL for a file (no expiration!)
   * Uses CloudFront if available, otherwise falls back to S3 direct URL
   */
  getPublicUrl(key: string): string {
    if (!key) return '';
    
    // Use CloudFront domain if configured
    if (this.cloudfrontDomain) {
      return `https://${this.cloudfrontDomain}/${key}`;
    }
    
    // Fallback to S3 direct URL (will only work if bucket is public)
    console.warn('Using S3 direct URL. Configure CloudFront for better performance.');
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Get multiple public URLs at once
   */
  getPublicUrls(keys: string[]): string[] {
    return keys.filter(key => key).map(key => this.getPublicUrl(key));
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
      console.log(`Successfully deleted file: ${key}`);
    } catch (error) {
      console.error(`Error deleting file ${key}:`, error);
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /**
   * Delete multiple files from S3
   */
  async deleteFiles(keys: string[]): Promise<void> {
    if (!keys || keys.length === 0) return;
    
    // Delete files in parallel for better performance
    await Promise.all(
      keys.map(key => this.deleteFile(key))
    );
    console.log(`Successfully deleted ${keys.length} files from S3`);
  }

  async fileExists(key: string): Promise<boolean> {
    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async getFileMetadata(key: string): Promise<any> {
    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      const response = await this.s3Client.send(command);
      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch (error) {
      console.error(`Error getting metadata for ${key}:`, error);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  // DEPRECATED - Remove these methods after migration
  async getPresignedUrl(key: string, expiresIn?: number): Promise<string> {
    console.warn('⚠️  DEPRECATED: getPresignedUrl() is deprecated. Use getPublicUrl() instead.');
    // Just return the public URL instead
    return this.getPublicUrl(key);
  }

  async getPresignedUrls(keys: string[]): Promise<Record<string, string>> {
    console.warn('⚠️  DEPRECATED: getPresignedUrls() is deprecated. Use getPublicUrls() instead.');
    const urls: Record<string, string> = {};
    keys.forEach(key => {
      if (key) urls[key] = this.getPublicUrl(key);
    });
    return urls;
  }

  // Cache-related methods can be removed since we don't need them anymore
  private urlCache = null; // No cache needed for permanent URLs
  private cleanupCache() {} // No-op
  clearCache() {} // No-op
  getCacheStats() { return { size: 0, entries: [] }; } // No-op
}