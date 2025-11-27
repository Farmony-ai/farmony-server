import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from './create-order.dto';

export class UpdateOrderStatusDto {
  @ApiProperty({ description: 'New order status', enum: OrderStatus, example: OrderStatus.COMPLETED })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}