import { 
  Controller, 
  Post, 
  Get, 
  Patch, 
  Param, 
  Body, 
  UseGuards, 
  Request,
  Query 
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { AddMessageDto } from './dto/add-message.dto';
import { DisputeStatus } from './disputes.schema';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('Disputes') 
@Controller('disputes')
@UseGuards(AuthGuard('jwt'))
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateDisputeDto) {
    return this.disputesService.create(req.user.userId, dto);
  }

  @Get()
  findAll(
    @Request() req,
    @Query('status') status?: DisputeStatus
  ) {
    return this.disputesService.findAll({ status, userId: req.user.userId });
  }

  @Get('stats')
  getStats() {
    // TODO: Add admin guard
    return this.disputesService.getDisputeStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.disputesService.findById(id);
  }

  @Post(':id/messages')
  addMessage(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: AddMessageDto
  ) {
    return this.disputesService.addMessage(id, req.user.userId, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: DisputeStatus
  ) {
    // TODO: Add admin guard
    return this.disputesService.updateStatus(id, status);
  }

  @Post(':id/resolve')
  resolve(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto
  ) {
    // TODO: Add admin guard
    return this.disputesService.resolve(id, req.user.userId, dto);
  }
}
