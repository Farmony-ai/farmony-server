import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Request,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ServiceRequestsService } from './service-requests.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceRequestDto } from './dto/update-service-request.dto';
import { AcceptServiceRequestDto } from './dto/accept-service-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServiceRequestStatus, ServiceRequestUrgency } from './entities/service-request.entity';

@Controller('service-requests')
@UseGuards(JwtAuthGuard)
export class ServiceRequestsController {
  constructor(private readonly serviceRequestsService: ServiceRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateServiceRequestDto, @Request() req) {
    const seekerId = req.user.sub;
    return this.serviceRequestsService.create(createDto, seekerId);
  }

  @Get()
  async findAll(
    @Query('status') status?: ServiceRequestStatus,
    @Query('categoryId') categoryId?: string,
    @Query('seekerId') seekerId?: string,
    @Query('providerId') providerId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.serviceRequestsService.findAll({
      status,
      categoryId,
      seekerId,
      providerId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('my-requests')
  async findMyRequests(
    @Request() req,
    @Query('status') status?: ServiceRequestStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const seekerId = req.user.sub;
    return this.serviceRequestsService.findAll({
      seekerId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('available')
  async findAvailableForProvider(
    @Request() req,
    @Query('categoryId') categoryId?: string,
    @Query('urgency') urgency?: ServiceRequestUrgency,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const providerId = req.user.sub;
    return this.serviceRequestsService.findAvailableForProvider(providerId, {
      categoryId,
      urgency,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.serviceRequestsService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateServiceRequestDto,
    @Request() req,
  ) {
    const userId = req.user.sub;
    return this.serviceRequestsService.update(id, updateDto, userId);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  async accept(
    @Param('id') id: string,
    @Body() acceptDto: AcceptServiceRequestDto,
    @Request() req,
  ) {
    const providerId = req.user.sub;
    return this.serviceRequestsService.accept(id, providerId, acceptDto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req,
  ) {
    const userId = req.user.sub;
    return this.serviceRequestsService.cancel(id, userId, reason);
  }

  @Post('expire-old')
  @HttpCode(HttpStatus.NO_CONTENT)
  async expireOldRequests() {
    await this.serviceRequestsService.expireOldRequests();
  }
}