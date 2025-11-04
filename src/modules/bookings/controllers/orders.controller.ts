import { Controller, Post, Get, Patch, Param, Body } from '@nestjs/common';
import { OrdersService } from '../services/orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
    constructor(private readonly svc: OrdersService) {}

    @Post()
    create(@Body() dto: CreateOrderDto) {
        return this.svc.create(dto);
    }

    @Get()
    findAll() {
        return this.svc.findAll();
    }

    @Get('seeker/:seekerId')
    findBySeeker(@Param('seekerId') seekerId: string) {
        return this.svc.findBySeekerPopulated(seekerId);
    }

    @Get('provider/:providerId')
    findByProvider(@Param('providerId') providerId: string) {
        return this.svc.findByProvider(providerId);
    }

    @Get('provider/:providerId/summary')
    getProviderSummary(@Param('providerId') providerId: string) {
        return this.svc.getProviderSummary(providerId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.svc.findById(id);
    }

    @Patch(':id/status')
    updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
        return this.svc.updateStatus(id, dto);
    }
}
