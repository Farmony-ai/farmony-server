import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { KycDocument, KycDocumentDocument } from './kyc.schema';
import { CreateKycDocumentDto } from './dto/create-kyc-document.dto';
import { UpdateKycStatusDto } from './dto/update-kyc-status.dto';
import { S3Service } from '../aws/s3.service';

@Injectable()
export class KycService {
  constructor(
    @InjectModel(KycDocument.name) private kycModel: Model<KycDocumentDocument>,
    private readonly s3Service: S3Service,
  ) {}

  async create(dto: CreateKycDocumentDto, file: Express.Multer.File): Promise<KycDocument> {
    const docURL = await this.s3Service.uploadFile(file, 'kyc-documents');

    const doc = new this.kycModel({
      ...dto,
      docURL,
    });
    return doc.save();
  }

  async findByUser(userId: string): Promise<KycDocument[]> {
    return this.kycModel.find({ userId }).exec();
  }

  async updateStatus(id: string, dto: UpdateKycStatusDto): Promise<KycDocument> {
    const doc = await this.kycModel.findById(id).exec();
    if (!doc) throw new NotFoundException('KYC document not found');
    doc.status = dto.status;
    if (dto.status === 'approved') {
      doc.verifiedAt = new Date();
    }
    return doc.save();
  }
}
