import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { Order, OrderDocument } from './orders.schema';
import { CreateOrderDto, OrderStatus } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrdersService {
  constructor(@InjectModel(Order.name) private orderModel: Model<OrderDocument>) {}

  async create(dto: CreateOrderDto): Promise<Order> {
    const now = new Date();
    const requestExpiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    
    const order = new this.orderModel({ 
      ...dto, 
      createdAt: now,
      requestExpiresAt,
      status: OrderStatus.PENDING
    });
    
    return order.save();
  }

  async findAll(): Promise<Order[]> {
    return this.orderModel.find().exec();
  }

  async findById(id: string): Promise<Order> {
    const order = await this.orderModel.findById(id).exec();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findBySeeker(seekerId: string): Promise<Order[]> {
    return this.orderModel.find({ seekerId }).sort({ createdAt: -1 }).exec();
  }

  async findByProvider(providerId: string): Promise<Order[]> {
    return this.orderModel.find({ providerId }).sort({ createdAt: -1 }).exec();
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.findById(id);
    
    // Validate status transitions
    if (!this.isValidStatusTransition(order.status, dto.status)) {
      throw new BadRequestException(`Cannot transition from ${order.status} to ${dto.status}`);
    }

    const updateData: any = { status: dto.status };
    
    // Add timestamps based on status
    switch (dto.status) {
      case OrderStatus.ACCEPTED:
        updateData.acceptedAt = new Date();
        break;
      case OrderStatus.PAID:
        updateData.paidAt = new Date();
        break;
      case OrderStatus.COMPLETED:
        updateData.completedAt = new Date();
        break;
      case OrderStatus.CANCELED:
        updateData.canceledAt = new Date();
        break;
    }

    const updated = await this.orderModel.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true }
    ).exec();
    
    if (!updated) throw new NotFoundException('Order not found');
    return updated;
  }

  async getProviderSummary(providerId: string): Promise<{ 
    totalOrders: number; 
    fulfilledOrders: number; 
    revenue: number 
  }> {
    const totalOrders = await this.orderModel.countDocuments({ providerId }).exec();
    const fulfilledOrders = await this.orderModel.countDocuments({ 
      providerId, 
      status: OrderStatus.COMPLETED 
    }).exec();
    
    const agg = await this.orderModel.aggregate([
      { $match: { providerId: new Types.ObjectId(providerId), status: OrderStatus.COMPLETED } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]).exec();
    
    const revenue = agg[0]?.total || 0;
    return { totalOrders, fulfilledOrders, revenue };
  }

  // Cron job to auto-reject expired orders - runs every 5 minutes
  // @Cron('*/5 * * * *')
  async checkAndAutoRejectExpiredOrders() {
    const now = new Date();
    
    const result = await this.orderModel.updateMany(
      {
        status: OrderStatus.PENDING,
        requestExpiresAt: { $lt: now },
        isAutoRejected: false
      },
      {
        status: OrderStatus.CANCELED,
        isAutoRejected: true,
        canceledAt: now,
        cancellationReason: 'Auto-rejected: Provider did not respond within 2 hours'
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`Auto-rejected ${result.modifiedCount} expired orders`);
    }
  }

  private isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
    const validTransitions: Record<string, string[]> = {
      [OrderStatus.PENDING]: [OrderStatus.ACCEPTED, OrderStatus.CANCELED],
      [OrderStatus.ACCEPTED]: [OrderStatus.PAID, OrderStatus.CANCELED],
      [OrderStatus.PAID]: [OrderStatus.COMPLETED, OrderStatus.CANCELED],
      [OrderStatus.COMPLETED]: [], // No transitions from completed
      [OrderStatus.CANCELED]: [] // No transitions from canceled
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  async findByProviderPopulated(providerId: string): Promise<any[]> {
    return this.orderModel
      .find({ providerId })
      .populate('seekerId', 'name email phone address coordinates')
      .populate('listingId', 'title description price unitOfMeasure images category')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }
}
