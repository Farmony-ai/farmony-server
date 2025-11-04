import { IsEnum } from 'class-validator';
import { OrderStatus } from './create-order.dto';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}