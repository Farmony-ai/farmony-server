import { Controller, Post, Body, UseGuards, UploadedFile, UseInterceptors, Param, Get, Patch } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KycService } from './kyc.service';
import { CreateKycDocumentDto } from './dto/create-kyc-document.dto';
import { UpdateKycStatusDto } from './dto/update-kyc-status.dto';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('KYC') 
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('documents')
  @UseInterceptors(FileInterceptor('document'))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateKycDocumentDto,
  ) {
    return this.kycService.create(dto, file);
  }
  @Get('documents/user/:userId')
  async getUserDocuments(@Param('userId') userId: string) {
    return this.kycService.findByUser(userId);
  }

  @Patch('documents/:id/status')
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: UpdateKycStatusDto,
  ) {
    return this.kycService.updateStatus(id, dto);
  }
}
