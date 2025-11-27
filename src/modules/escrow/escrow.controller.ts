import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EscrowService } from './escrow.service';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('Escrow') 
@Controller('escrow')
@UseGuards(AuthGuard('jwt'))
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  create(@Body() dto: CreateEscrowDto) {
    return this.escrowService.create(dto);
  }

  @Get()
  findAll() {
    return this.escrowService.findAll();
  }

  @Get('order/:orderId')
  findByOrder(@Param('orderId') orderId: string) {
    return this.escrowService.findByOrder(orderId);
  }

  @Get('summary')
  getSummary(@Request() req) {
    return this.escrowService.getEscrowSummary(req.user.userId);
  }

  @Patch(':orderId/release')
  release(
    @Param('orderId') orderId: string,
    @Request() req
  ) {
    // TODO: Add admin guard
    return this.escrowService.release(orderId, req.user.userId);
  }

  @Patch(':orderId/refund')
  refund(
    @Param('orderId') orderId: string,
    @Body('reason') reason: string,
    @Request() req
  ) {
    // TODO: Add admin guard
    return this.escrowService.refund(orderId, reason, req.user.userId);
  }

  @Patch(':orderId/partial-refund')
  partialRefund(
    @Param('orderId') orderId: string,
    @Body() body: { amount: number; reason: string },
    @Request() req
  ) {
    // TODO: Add admin guard
    return this.escrowService.partialRefund(orderId, body.amount, body.reason, req.user.userId);
  }

  @Patch(':orderId/dispute')
  dispute(
    @Param('orderId') orderId: string,
    @Body('reason') reason: string
  ) {
    return this.escrowService.dispute(orderId, reason);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string
  ) {
    // Legacy endpoint for backward compatibility
    return this.escrowService.update(id, status);
  }
}