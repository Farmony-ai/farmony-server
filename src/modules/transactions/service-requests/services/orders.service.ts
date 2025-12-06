import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../schemas/orders.schema';
import { CreateOrderDto, OrderStatus } from '../dto/create-order.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { NotificationService } from '../../../engagement/notifications/services/notification.service';
import { FirebaseStorageService } from '../../../common/firebase/firebase-storage.service';

@Injectable()
export class OrdersService {
    constructor(
        @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
        private readonly notificationService: NotificationService,
        private readonly storageService: FirebaseStorageService,
    ) {}

    async create(dto: CreateOrderDto): Promise<Order> {
        const now = new Date();
        const requestExpiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

        const order = new this.orderModel({
            ...dto,
            createdAt: now,
            requestExpiresAt,
            status: OrderStatus.PENDING,
        });

        return order.save();
    }

    async createFromServiceRequest(data: {
        seekerId: string;
        providerId: string;
        listingId?: string;
        serviceRequestId?: string;
        categoryId: string;
        subCategoryId?: string;
        totalAmount: number;
        coordinates: number[];
        serviceStartDate: Date;
        serviceEndDate: Date;
        description: string;
        quantity?: number;
        unitOfMeasure?: string;
        metadata?: any;
    }): Promise<Order> {
        const now = new Date();
        const requestExpiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours

        const order = new this.orderModel({
            seekerId: new Types.ObjectId(data.seekerId),
            providerId: new Types.ObjectId(data.providerId),
            listingId: data.listingId ? new Types.ObjectId(data.listingId) : undefined,
            serviceRequestId: data.serviceRequestId,
            categoryId: data.categoryId ? new Types.ObjectId(data.categoryId) : undefined,
            subCategoryId: data.subCategoryId ? new Types.ObjectId(data.subCategoryId) : undefined,
            totalAmount: data.totalAmount,
            coordinates: data.coordinates,
            serviceStartDate: data.serviceStartDate,
            serviceEndDate: data.serviceEndDate,
            description: data.description,
            quantity: data.quantity,
            unitOfMeasure: data.unitOfMeasure,
            metadata: data.metadata,
            createdAt: now,
            requestExpiresAt,
            status: OrderStatus.ACCEPTED,
            orderType: 'service',
        });

        return order.save();
    }

    async findAll(): Promise<Order[]> {
        return this.orderModel.find().exec();
    }

    async findById(id: string): Promise<Order> {
        const order = await this.orderModel.findById(id)
            .populate('seekerId', 'name phone email')
            .populate('providerId', 'name phone email')
            .populate({
                path: 'listingId',
                select: 'title description price unitOfMeasure photos categoryId subCategoryId',
                populate: [
                    { path: 'categoryId', select: 'name' },
                    { path: 'subCategoryId', select: 'name' },
                ],
            })
            .exec();
        if (!order) throw new NotFoundException('Order not found');

        const orderObj = order.toObject();

        if (orderObj.listingId && (orderObj.listingId as any).photos) {
            const listing = orderObj.listingId as any;
            listing.photoUrls = this.storageService.getPublicUrls(listing.photos);
        }

        return orderObj as Order;
    }

    async findBySeeker(seekerId: string): Promise<Order[]> {
        return this.orderModel.find({ seekerId: new Types.ObjectId(seekerId) }).sort({ createdAt: -1 }).exec();
    }

    async findByProvider(providerId: string): Promise<Order[]> {
        return this.orderModel.find({ providerId: new Types.ObjectId(providerId) }).sort({ createdAt: -1 }).exec();
    }

    async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<Order> {
        // Fetch order with populated data for notifications
        const order = await this.orderModel
            .findById(id)
            .populate('seekerId', 'name')
            .populate('providerId', 'name')
            .populate('listingId', 'title')
            .exec();

        if (!order) throw new NotFoundException('Order not found');

        // Validate status transitions
        if (!this.isValidStatusTransition(order.status, dto.status)) {
            throw new BadRequestException(`Cannot transition from ${order.status} to ${dto.status}`);
        }

        const updateData: any = { status: dto.status };

        // Extract names for notifications
        const seekerId = order.seekerId?._id?.toString() || (order.seekerId as any)?.toString();
        const providerId = order.providerId?._id?.toString() || (order.providerId as any)?.toString();
        const seekerName = (order.seekerId as any)?.name || 'Customer';
        const providerName = (order.providerId as any)?.name || 'Provider';
        const serviceName = (order.listingId as any)?.title || order.description || 'Service';

        // Add timestamps based on status
        switch (dto.status) {
            case OrderStatus.ACCEPTED:
                updateData.acceptedAt = new Date();
                break;
            case OrderStatus.PAID:
                updateData.paidAt = new Date();
                // Notify provider about payment
                if (providerId && seekerId) {
                    this.notificationService.notifyProviderPaymentReceived(providerId, {
                        orderId: id,
                        amount: order.totalAmount,
                        seekerName,
                    });
                }
                break;
            case OrderStatus.IN_PROGRESS:
                // Notify seeker that service has started
                if (seekerId && providerId) {
                    this.notificationService.notifySeekerOrderInProgress(seekerId, {
                        orderId: id,
                        requestId: order.serviceRequestId,
                        providerName,
                        serviceName,
                    });
                }
                break;
            case OrderStatus.COMPLETED:
                updateData.completedAt = new Date();
                // Notify both parties
                if (seekerId && providerId) {
                    this.notificationService.notifySeekerOrderCompleted(seekerId, {
                        orderId: id,
                        providerName,
                        serviceName,
                    });
                    this.notificationService.notifyProviderOrderCompleted(providerId, {
                        orderId: id,
                        seekerName,
                        serviceName,
                    });
                }
                break;
            case OrderStatus.CANCELED:
                updateData.canceledAt = new Date();
                break;
        }

        const updated = await this.orderModel.findByIdAndUpdate(id, updateData, { new: true }).exec();

        if (!updated) throw new NotFoundException('Order not found');
        return updated;
    }

    async getProviderSummary(providerId: string): Promise<{
        totalOrders: number;
        fulfilledOrders: number;
        revenue: number;
    }> {
        const providerObjectId = new Types.ObjectId(providerId);
        // Only count orders that are accepted or beyond (exclude pending)
        const totalOrders = await this.orderModel.countDocuments({
            providerId: providerObjectId,
            status: { $ne: OrderStatus.PENDING },
        }).exec();
        const fulfilledOrders = await this.orderModel
            .countDocuments({
                providerId: providerObjectId,
                status: OrderStatus.COMPLETED,
            })
            .exec();

        const agg = await this.orderModel
            .aggregate([{ $match: { providerId: providerObjectId, status: OrderStatus.COMPLETED } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }])
            .exec();

        const revenue = agg[0]?.total || 0;
        return { totalOrders, fulfilledOrders, revenue };
    }

    // // Cron job to auto-reject expired orders - runs every 5 minutes
    // @Cron('*/5 * * * *')
    // async checkAndAutoRejectExpiredOrders() {
    //   const now = new Date();

    //   const result = await this.orderModel.updateMany(
    //     {
    //       status: OrderStatus.PENDING,
    //       requestExpiresAt: { $lt: now },
    //       isAutoRejected: false
    //     },
    //     {
    //       status: OrderStatus.CANCELED,
    //       isAutoRejected: true,
    //       canceledAt: now,
    //       cancellationReason: 'Auto-rejected: Provider did not respond within 2 hours'
    //     }
    //   );

    //   if (result.modifiedCount > 0) {
    //     console.log(`Auto-rejected ${result.modifiedCount} expired orders`);
    //   }
    // }

    private isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
        const validTransitions: Record<string, string[]> = {
            [OrderStatus.PENDING]: [OrderStatus.ACCEPTED, OrderStatus.CANCELED],
            [OrderStatus.ACCEPTED]: [OrderStatus.PAID, OrderStatus.CANCELED],
            [OrderStatus.PAID]: [OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED, OrderStatus.CANCELED],
            [OrderStatus.IN_PROGRESS]: [OrderStatus.COMPLETED, OrderStatus.CANCELED],
            [OrderStatus.COMPLETED]: [], // No transitions from completed
            [OrderStatus.CANCELED]: [], // No transitions from canceled
        };

        return validTransitions[currentStatus]?.includes(newStatus) || false;
    }

    async findByProviderPopulated(providerId: string): Promise<any[]> {
        return this.orderModel
            .find({ providerId: new Types.ObjectId(providerId) })
            .populate('seekerId', 'name email phone address coordinates')
            .populate('listingId', 'title description price unitOfMeasure images category')
            .sort({ createdAt: -1 })
            .lean()
            .exec();
    }

    async findBySeekerPopulated(seekerId: string): Promise<any[]> {
        return this.orderModel
            .find({ seekerId: new Types.ObjectId(seekerId) })
            .populate('providerId', 'name email phone address coordinates')
            .populate({
                path: 'listingId',
                select: 'title categoryId subCategoryId price unitOfMeasure images',
                populate: [
                    {
                        path: 'categoryId',
                        select: 'name description',
                    },
                    {
                        path: 'subCategoryId',
                        select: 'name description',
                    },
                ],
            })
            .sort({ createdAt: -1 })
            .lean()
            .exec();
    }
}
