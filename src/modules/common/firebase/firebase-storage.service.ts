import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { FirebaseAdminService } from './firebase-admin.service';

@Injectable()
export class FirebaseStorageService {
    private readonly logger = new Logger(FirebaseStorageService.name);

    constructor(private readonly firebaseAdmin: FirebaseAdminService) {}

    async uploadFile(file: Express.Multer.File, folder = 'uploads'): Promise<string> {
        if (!file) {
            throw new Error('No file provided for upload');
        }
        if (!file.buffer) {
            throw new Error('Uploaded file is empty');
        }

        const sanitizedName = file.originalname?.replace(/[^a-zA-Z0-9.\-_]/g, '_') || 'file';
        const key = `${folder}/${uuid()}-${Date.now()}-${sanitizedName}`;

        await this.firebaseAdmin.uploadFileToStorage({
            buffer: file.buffer,
            destination: key,
            contentType: file.mimetype,
        });

        return key;
    }

    async uploadFiles(files: Express.Multer.File[], folder = 'uploads'): Promise<string[]> {
        if (!files || files.length === 0) {
            return [];
        }
        return Promise.all(files.map((file) => this.uploadFile(file, folder)));
    }

    async deleteFile(key: string): Promise<void> {
        if (!key) {
            return;
        }
        try {
            await this.firebaseAdmin.deleteFileFromStorage(key);
        } catch (error) {
            this.logger.warn(`Failed to delete file ${key} from Firebase Storage: ${error instanceof Error ? error.message : error}`);
        }
    }

    async deleteFiles(keys: string[] = []): Promise<void> {
        if (!keys || keys.length === 0) {
            return;
        }
        await Promise.all(keys.map((key) => this.deleteFile(key)));
    }

    getPublicUrl(key?: string | null): string | null {
        return this.firebaseAdmin.getStoragePublicUrl(key);
    }

    getPublicUrls(keys: (string | null | undefined)[] = []): string[] {
        return keys.map((key) => this.getPublicUrl(key) || '').filter((url) => !!url);
    }
}
