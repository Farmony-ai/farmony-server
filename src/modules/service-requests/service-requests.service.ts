import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  ServiceRequest,
  ServiceRequestDocument,
  ServiceRequestStatus,
  ServiceRequestUrgency,
} from './entities/service-request.entity';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceRequestDto } from './dto/update-service-request.dto';
import { AcceptServiceRequestDto } from './dto/accept-service-request.dto';
import { MatchesService } from '../matches/matches.service';
import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class ServiceRequestsService {
  constructor(
    @InjectModel(ServiceRequest.name)
    private readonly serviceRequestModel: Model<ServiceRequestDocument>,
    private readonly matchesService: MatchesService,
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async create(
    createDto: CreateServiceRequestDto,
    seekerId: string,
  ): Promise<ServiceRequest> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (createDto.expiresInHours || 24));

    const requestId = uuidv4();

    const serviceRequest = new this.serviceRequestModel({
      _id: requestId,
      seekerId: new Types.ObjectId(seekerId),
      categoryId: new Types.ObjectId(createDto.categoryId),
      subCategoryId: createDto.subCategoryId
        ? new Types.ObjectId(createDto.subCategoryId)
        : undefined,
      title: createDto.title,
      description: createDto.description,
      location: {
        type: 'Point',
        coordinates: [createDto.location.lon, createDto.location.lat],
      },
      address: createDto.address,
      serviceStartDate: createDto.serviceStartDate,
      serviceEndDate: createDto.serviceEndDate,
      budget: createDto.budget,
      urgency: createDto.urgency || ServiceRequestUrgency.FLEXIBLE,
      status: ServiceRequestStatus.OPEN,
      expiresAt,
      metadata: createDto.metadata,
      attachments: createDto.attachments || [],
    });

    const savedRequest = await serviceRequest.save();

    const matchResult = await this.matchesService.createMatch(
      {
        lat: createDto.location.lat,
        lon: createDto.location.lon,
        categoryId: createDto.categoryId,
        limit: 50,
      },
      createDto.idempotencyKey || `sr-${requestId}`,
      seekerId,
    );

    if (matchResult.status === 'CREATED' && matchResult.providers.length > 0) {
      savedRequest.matchRequestId = matchResult.request_id;
      savedRequest.matchedProviderIds = matchResult.providers.map(
        (p) => new Types.ObjectId(p._id),
      );
      savedRequest.status = ServiceRequestStatus.MATCHED;
      await savedRequest.save();

      this.notifyMatchedProviders(savedRequest, matchResult.providers);
    }

    return savedRequest;
  }

  async findAll(filters: {
    status?: ServiceRequestStatus;
    categoryId?: string;
    seekerId?: string;
    providerId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ requests: ServiceRequest[]; total: number }> {
    const query: any = {};
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.categoryId) {
      query.categoryId = new Types.ObjectId(filters.categoryId);
    }

    if (filters.seekerId) {
      query.seekerId = new Types.ObjectId(filters.seekerId);
    }

    if (filters.providerId) {
      query.matchedProviderIds = new Types.ObjectId(filters.providerId);
    }

    const [requests, total] = await Promise.all([
      this.serviceRequestModel
        .find(query)
        .populate('seekerId', 'name phone email profilePicture')
        .populate('categoryId', 'name icon')
        .populate('subCategoryId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.serviceRequestModel.countDocuments(query),
    ]);

    return { requests, total };
  }

  async findById(id: string): Promise<ServiceRequest> {
    const request = await this.serviceRequestModel
      .findById(id)
      .populate('seekerId', 'name phone email profilePicture')
      .populate('categoryId', 'name icon')
      .populate('subCategoryId', 'name')
      .populate('matchedProviderIds', 'name phone profilePicture')
      .populate('acceptedProviderId', 'name phone profilePicture')
      .lean();

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    return request;
  }

  async findAvailableForProvider(
    providerId: string,
    filters: {
      categoryId?: string;
      urgency?: ServiceRequestUrgency;
      page?: number;
      limit?: number;
    },
  ): Promise<{ requests: ServiceRequest[]; total: number }> {
    const query: any = {
      matchedProviderIds: new Types.ObjectId(providerId),
      status: { $in: [ServiceRequestStatus.MATCHED, ServiceRequestStatus.OPEN] },
      expiresAt: { $gt: new Date() },
    };

    if (filters.categoryId) {
      query.categoryId = new Types.ObjectId(filters.categoryId);
    }

    if (filters.urgency) {
      query.urgency = filters.urgency;
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      this.serviceRequestModel
        .find(query)
        .populate('seekerId', 'name location profilePicture')
        .populate('categoryId', 'name icon')
        .sort({ urgency: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.serviceRequestModel.countDocuments(query),
    ]);

    await this.serviceRequestModel.updateMany(
      {
        _id: { $in: requests.map((r) => r._id) },
        viewedBy: { $ne: new Types.ObjectId(providerId) },
      },
      {
        $inc: { viewCount: 1 },
        $push: { viewedBy: new Types.ObjectId(providerId) },
      },
    );

    return { requests, total };
  }

  async update(
    id: string,
    updateDto: UpdateServiceRequestDto,
    userId: string,
  ): Promise<ServiceRequest> {
    const request = await this.findById(id);

    if (request.seekerId.toString() !== userId) {
      throw new ForbiddenException('You can only update your own requests');
    }

    if (request.status !== ServiceRequestStatus.OPEN &&
        request.status !== ServiceRequestStatus.MATCHED) {
      throw new BadRequestException('Cannot update request in current status');
    }

    const updatedRequest = await this.serviceRequestModel
      .findByIdAndUpdate(
        id,
        { $set: updateDto },
        { new: true, runValidators: true },
      )
      .populate('seekerId', 'name phone email')
      .populate('categoryId', 'name')
      .lean();

    return updatedRequest;
  }

  async accept(
    id: string,
    providerId: string,
    acceptDto: AcceptServiceRequestDto,
  ): Promise<{ request: ServiceRequest; orderId: string }> {
    const request = await this.serviceRequestModel.findById(id);

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (!request.matchedProviderIds.some(
      (pid) => pid.toString() === providerId,
    )) {
      throw new ForbiddenException('You are not authorized to accept this request');
    }

    if (request.status !== ServiceRequestStatus.MATCHED &&
        request.status !== ServiceRequestStatus.OPEN) {
      throw new BadRequestException('Request is no longer available');
    }

    if (new Date() > request.expiresAt) {
      throw new BadRequestException('Request has expired');
    }

    const result = await this.serviceRequestModel.findOneAndUpdate(
      {
        _id: id,
        status: { $in: [ServiceRequestStatus.MATCHED, ServiceRequestStatus.OPEN] },
        matchedProviderIds: new Types.ObjectId(providerId),
      },
      {
        $set: {
          status: ServiceRequestStatus.ACCEPTED,
          acceptedProviderId: new Types.ObjectId(providerId),
          acceptedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!result) {
      throw new ConflictException('Request has already been accepted by another provider');
    }

    const orderData = {
      seekerId: request.seekerId.toString(),
      providerId: providerId,
      serviceRequestId: id,
      categoryId: request.categoryId.toString(),
      subCategoryId: request.subCategoryId?.toString(),
      totalAmount: acceptDto.price,
      coordinates: request.location.coordinates,
      serviceStartDate: request.serviceStartDate,
      serviceEndDate: request.serviceEndDate,
      description: request.description,
      metadata: {
        ...request.metadata,
        providerMessage: acceptDto.message,
        estimatedCompletionTime: acceptDto.estimatedCompletionTime,
      },
    };

    const order = await this.ordersService.createFromServiceRequest(orderData);

    const orderId = (order as any)._id.toString();
    result.orderId = orderId;
    await result.save();

    this.chatGateway.server.to(`user-${request.seekerId}`).emit('service-request-accepted', {
      requestId: id,
      providerId,
      orderId: orderId,
    });

    this.notifyRejectedProviders(request, providerId);

    return {
      request: result.toObject(),
      orderId: orderId,
    };
  }

  async cancel(
    id: string,
    userId: string,
    reason?: string,
  ): Promise<ServiceRequest> {
    const request = await this.findById(id);

    if (request.seekerId.toString() !== userId) {
      throw new ForbiddenException('You can only cancel your own requests');
    }

    if (request.status === ServiceRequestStatus.COMPLETED ||
        request.status === ServiceRequestStatus.CANCELLED) {
      throw new BadRequestException('Cannot cancel request in current status');
    }

    if (request.status === ServiceRequestStatus.ACCEPTED && request.orderId) {
      throw new BadRequestException(
        'Cannot cancel accepted request. Please cancel the order instead.',
      );
    }

    const updatedRequest = await this.serviceRequestModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            status: ServiceRequestStatus.CANCELLED,
            cancellationReason: reason,
          },
        },
        { new: true },
      )
      .lean();

    if (request.matchedProviderIds.length > 0) {
      this.notifyProvidersOfCancellation(request);
    }

    return updatedRequest;
  }

  async expire(id: string): Promise<ServiceRequest> {
    const updatedRequest = await this.serviceRequestModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            status: ServiceRequestStatus.EXPIRED,
            isAutoExpired: true,
          },
        },
        { new: true },
      )
      .lean();

    if (!updatedRequest) {
      throw new NotFoundException('Service request not found');
    }

    this.chatGateway.server.to(`user-${updatedRequest.seekerId}`).emit('service-request-expired', {
      requestId: id,
    });

    return updatedRequest;
  }

  async expireOldRequests(): Promise<void> {
    const expiredRequests = await this.serviceRequestModel.find({
      status: { $in: [ServiceRequestStatus.OPEN, ServiceRequestStatus.MATCHED] },
      expiresAt: { $lt: new Date() },
      isAutoExpired: false,
    });

    for (const request of expiredRequests) {
      await this.expire(request._id);
    }
  }

  private async notifyMatchedProviders(
    request: ServiceRequest,
    providers: Array<{ _id: string; name: string }>,
  ): Promise<void> {
    for (const provider of providers) {
      this.chatGateway.server.to(`user-${provider._id}`).emit('new-service-request', {
        requestId: request._id,
        title: request.title,
        category: request.categoryId,
        urgency: request.urgency,
        location: request.address || 'View details for location',
        expiresAt: request.expiresAt,
      });
    }
  }

  private async notifyRejectedProviders(
    request: ServiceRequest,
    acceptedProviderId: string,
  ): Promise<void> {
    const rejectedProviderIds = request.matchedProviderIds.filter(
      (pid) => pid.toString() !== acceptedProviderId,
    );

    for (const providerId of rejectedProviderIds) {
      this.chatGateway.server.to(`user-${providerId}`).emit('service-request-no-longer-available', {
        requestId: request._id,
      });
    }
  }

  private async notifyProvidersOfCancellation(
    request: ServiceRequest,
  ): Promise<void> {
    for (const providerId of request.matchedProviderIds) {
      this.chatGateway.server.to(`user-${providerId}`).emit('service-request-cancelled', {
        requestId: request._id,
      });
    }
  }
}