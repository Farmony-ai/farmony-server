import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import {
  ServiceRequest,
  ServiceRequestDocument,
  ServiceRequestStatus,
  NotificationWave,
} from './entities/service-request.entity';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceRequestDto } from './dto/update-service-request.dto';
import { AcceptServiceRequestDto } from './dto/accept-service-request.dto';
import { ListingsService } from '../listings/listings.service';
import { OrdersService } from '../orders/orders.service';
import { ChatGateway } from '../chat/chat.gateway';
import { AddressesService } from '../addresses/addresses.service';
import { AddressType } from '../../common/interfaces/address.interface';

// Configuration for wave-based notifications
const WAVE_CONFIG = {
  radiusIncrements: [5000, 10000, 15000, 25000, 40000], // meters: 5km, 10km, 15km, 25km, 40km
  waveDelayMinutes: 10, // Wait 10 minutes between waves
  maxWaves: 5,
  minProvidersPerWave: 1, // Minimum providers to notify in a wave
  expiryHours: 24, // Request expires after 24 hours
};

@Injectable()
export class ServiceRequestsService {
  private readonly logger = new Logger(ServiceRequestsService.name);

  constructor(
    @InjectModel(ServiceRequest.name)
    private readonly serviceRequestModel: Model<ServiceRequestDocument>,
    private readonly listingsService: ListingsService,
    private readonly ordersService: OrdersService,
    private readonly addressesService: AddressesService,
    private readonly chatGateway: ChatGateway,
    private readonly addressesService: AddressesService,
  ) {}

  async create(
  createDto: CreateServiceRequestDto,
  seekerId: string,
): Promise<ServiceRequest> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + WAVE_CONFIG.expiryHours);

  const requestId = uuidv4();

  // Handle address resolution
  let serviceAddressId: string;
  let coordinates: [number, number];

  if (createDto.addressId) {
    const address = await this.addressesService.getValidatedAddress(createDto.addressId);
    serviceAddressId = address._id.toString();
    coordinates = this.getCoordinatesFromAddress(address);
  } else if (createDto.location) {
    const { lat, lon } = createDto.location;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      throw new BadRequestException('location.lat and location.lon must be numbers');
    }

    const requestCoordinates: [number, number] = [lon, lat];
    const address = await this.addressesService.findOrCreateByCoordinates(
      seekerId,
      requestCoordinates,
      {
        addressType: AddressType.SERVICE_AREA,
        addressLine1: createDto.addressLine1 || 'Service Location',
        village: createDto.village || 'Not Specified',
        district: createDto.district || 'Not Specified',
        state: createDto.state || 'Not Specified',
        pincode: createDto.pincode || '000000',
        customLabel: createDto.addressLine1,
        isDefault: false,
      },
    );
    serviceAddressId = address._id.toString();
    coordinates = this.getCoordinatesFromAddress(address);
  } else {
    const address = await this.addressesService.getDefaultServiceAddress(seekerId);
    serviceAddressId = address._id.toString();
    coordinates = this.getCoordinatesFromAddress(address);
  }

  await this.addressesService.updateUsage(serviceAddressId).catch(() => undefined);

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
      coordinates: coordinates,
    },
    serviceAddressId: new Types.ObjectId(serviceAddressId), // Link to address
    serviceStartDate: createDto.serviceStartDate,
    serviceEndDate: createDto.serviceEndDate,
    status: ServiceRequestStatus.OPEN,
    expiresAt,
    metadata: createDto.metadata,
    attachments: createDto.attachments || [],
    currentWave: 0,
    notificationWaves: [],
    allNotifiedProviders: [],
  });

  const savedRequest = await serviceRequest.save();

  // Start the first wave of notifications
  await this.processNextWave(savedRequest._id);

  return savedRequest;
}

  async update(
    id: string,
    updateDto: UpdateServiceRequestDto,
    userId: string,
  ): Promise<ServiceRequest> {
    const request = await this.serviceRequestModel.findById(id);

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (request.seekerId.toString() !== userId) {
      throw new ForbiddenException('You can only update your own service requests');
    }

    if (
      request.status !== ServiceRequestStatus.OPEN &&
      request.status !== ServiceRequestStatus.MATCHED
    ) {
      throw new BadRequestException('Only open or matched requests can be updated');
    }

    const updatePayload: any = {};

    if (updateDto.addressId) {
      const address = await this.addressesService.getValidatedAddress(updateDto.addressId);
      updatePayload.serviceAddressId = address._id;
      updatePayload.location = {
        type: 'Point',
        coordinates: this.getCoordinatesFromAddress(address),
      };

      await this.addressesService.updateUsage(address._id.toString()).catch(() => undefined);
    }

    const mutableFields: Array<keyof UpdateServiceRequestDto> = [
      'title',
      'description',
      'serviceStartDate',
      'serviceEndDate',
      'metadata',
      'attachments',
      'cancellationReason',
    ];

    for (const field of mutableFields) {
      if (updateDto[field] !== undefined) {
        updatePayload[field] = updateDto[field];
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return this.findById(id);
    }

    const updated = await this.serviceRequestModel.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Service request not found');
    }

    return this.findById(id);
  }


  async processNextWave(requestId: string): Promise<void> {
    const request = await this.serviceRequestModel.findById(requestId);
    
    if (!request) {
      this.logger.warn(`Request ${requestId} not found for wave processing`);
      return;
    }

    // Check if request is still eligible for notifications
    if (request.status !== ServiceRequestStatus.OPEN && 
        request.status !== ServiceRequestStatus.MATCHED) {
      this.logger.log(`Request ${requestId} status is ${request.status}, skipping wave`);
      return;
    }

    // Check if we've reached max waves
    if (request.currentWave >= WAVE_CONFIG.maxWaves) {
      await this.handleNoProvidersAvailable(request);
      return;
    }

    const waveNumber = request.currentWave + 1;
    const radius = WAVE_CONFIG.radiusIncrements[request.currentWave];

    this.logger.log(`Processing wave ${waveNumber} for request ${requestId} with radius ${radius}m`);

    // Find providers in this radius who haven't been notified yet
    const providers = await this.findProvidersInRadius(
      request.location.coordinates,
      radius,
      request.categoryId.toString(),
      request.subCategoryId?.toString(),
      request.allNotifiedProviders,
    );

    if (providers.length < WAVE_CONFIG.minProvidersPerWave) {
      // Not enough new providers in this wave, try next wave immediately
      if (request.currentWave < WAVE_CONFIG.maxWaves - 1) {
        request.currentWave++;
        await request.save();
        return this.processNextWave(requestId);
      } else {
        await this.handleNoProvidersAvailable(request);
        return;
      }
    }

    // Create wave record
    const wave: NotificationWave = {
      waveNumber,
      radius,
      notifiedProviders: providers.map(p => p._id),
      notifiedAt: new Date(),
      providersCount: providers.length,
    };

    // Update request with wave info
    request.notificationWaves.push(wave as any);
    request.currentWave = waveNumber;
    request.allNotifiedProviders.push(...providers.map(p => p._id));
    request.status = ServiceRequestStatus.MATCHED;

    // Set next wave time if not the last wave
    if (waveNumber < WAVE_CONFIG.maxWaves) {
      const nextWaveTime = new Date();
      nextWaveTime.setMinutes(nextWaveTime.getMinutes() + WAVE_CONFIG.waveDelayMinutes);
      request.nextWaveAt = nextWaveTime;
    }

    await request.save();

    // Notify providers in this wave
    await this.notifyProviders(request, providers);

    this.logger.log(`Notified ${providers.length} providers in wave ${waveNumber} for request ${requestId}`);
  }

  private async findProvidersInRadius(
    coordinates: number[],
    radius: number,
    categoryId: string,
    subCategoryId?: string,
    excludeProviders: Types.ObjectId[] = [],
  ): Promise<any[]> {
    // Build the search filters
    const filters: any = {
      isActive: true,
      categoryId: categoryId,
      coordinates: coordinates,
      distance: radius / 1000, // Convert meters to km
    };

    // IMPORTANT: Match subcategory if specified
    if (subCategoryId) {
      filters.subCategoryId = subCategoryId;
    }

    // Get listings that match category/subcategory within radius
    const listings = await this.listingsService.findAll(filters);

    // Filter out already notified providers and match exact category/subcategory
    const relevantListings = listings.filter(listing => {
      // Check if provider was already notified
      const providerId = listing.providerId?._id?.toString() || listing.providerId?.toString();
      const isNotExcluded = !excludeProviders.some(
        pid => pid.toString() === providerId
      );
      
      // Verify category match
      const categoryMatch = (listing.categoryId?._id?.toString() || listing.categoryId?.toString()) === categoryId;
      
      // Verify subcategory match if specified
      let subCategoryMatch = true;
      if (subCategoryId) {
        subCategoryMatch = (listing.subCategoryId?._id?.toString() || listing.subCategoryId?.toString()) === subCategoryId;
      }
      
      return isNotExcluded && categoryMatch && subCategoryMatch && listing.isActive;
    });

    // Get unique providers with their best matching listing
    const providerMap = new Map();
    for (const listing of relevantListings) {
      const providerId = listing.providerId?._id?.toString() || listing.providerId?.toString();
      
      if (!providerId) continue; // Skip if no provider ID
      
      if (!providerMap.has(providerId)) {
        // Calculate actual distance if available
        const distance = listing.distance || this.calculateDistance(
          coordinates[1], // lat
          coordinates[0], // lon  
          listing.location?.coordinates?.[1] || 0,
          listing.location?.coordinates?.[0] || 0
        );
        
        providerMap.set(providerId, {
          _id: new Types.ObjectId(providerId),
          listing,
          distance: distance * 1000, // Convert km back to meters
          providerName: listing.providerId?.name || 'Provider',
        });
      }
    }

    // Sort by distance (nearest first) and return
    return Array.from(providerMap.values()).sort((a, b) => a.distance - b.distance);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  }

  private async notifyProviders(request: ServiceRequest, providers: any[]): Promise<void> {
    for (const provider of providers) {
      try {
        // Prepare notification data with category and subcategory details
        const notificationData: any = {
          requestId: request._id,
          title: request.title,
          categoryId: request.categoryId,
          location: request.address || 'View details for location',
          serviceDate: request.serviceStartDate,
          expiresAt: request.expiresAt,
          waveNumber: request.currentWave,
          distance: Math.round(provider.distance / 1000), // Convert to km
        };

        // Include subcategory if present
        if (request.subCategoryId) {
          notificationData.subCategoryId = request.subCategoryId;
        }

        // Add listing info for context
        if (provider.listing) {
          notificationData.matchedListingId = provider.listing._id;
          notificationData.listingPrice = provider.listing.price;
          notificationData.unitOfMeasure = provider.listing.unitOfMeasure;
        }

        // Send real-time notification
        this.chatGateway.server.to(`user-${provider._id}`).emit('new-service-request', notificationData);
        
        this.logger.log(
          `Notified provider ${provider._id} (${provider.providerName}) for request ${request._id} ` +
          `in wave ${request.currentWave} at distance ${Math.round(provider.distance)}m`
        );
      } catch (error) {
        this.logger.error(`Failed to notify provider ${provider._id}:`, error);
      }
    }
  }

  private async handleNoProvidersAvailable(request: ServiceRequestDocument): Promise<void> {
    request.status = ServiceRequestStatus.NO_PROVIDERS_AVAILABLE;
    request.cancellationReason = 'No service providers available in your area';
    await request.save();

    // Notify seeker
    this.chatGateway.server.to(`user-${request.seekerId}`).emit('service-request-no-providers', {
      requestId: request._id,
      message: 'Unfortunately, no service providers are available in your area for this request.',
    });

    this.logger.log(`Request ${request._id} marked as NO_PROVIDERS_AVAILABLE`);
  }

  async accept(
    id: string,
    providerId: string,
    acceptDto?: AcceptServiceRequestDto,
  ): Promise<{ request: ServiceRequest; order: any }> {
    const request = await this.serviceRequestModel.findById(id);

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    // Check if provider was notified
    if (!request.allNotifiedProviders.some(pid => pid.toString() === providerId)) {
      throw new ForbiddenException('You were not notified about this request');
    }

    // Check request status
    if (request.status !== ServiceRequestStatus.MATCHED) {
      throw new BadRequestException('Request is no longer available');
    }

    if (new Date() > request.expiresAt) {
      throw new BadRequestException('Request has expired');
    }

    // Get provider's listing for this category AND subcategory
    const providerListings = await this.listingsService.findByProvider(providerId);
    const matchingListing = providerListings.find(listing => {
      // Check category match
      const categoryMatch = listing.categoryId?._id?.toString() === request.categoryId.toString() ||
                           listing.categoryId?.toString() === request.categoryId.toString();
      
      // Check subcategory match if request has subcategory
      let subCategoryMatch = true;
      if (request.subCategoryId) {
        subCategoryMatch = listing.subCategoryId?._id?.toString() === request.subCategoryId.toString() ||
                          listing.subCategoryId?.toString() === request.subCategoryId.toString();
      }
      
      return categoryMatch && subCategoryMatch && listing.isActive;
    });

    if (!matchingListing) {
      const errorMsg = request.subCategoryId 
        ? 'You don\'t have an active listing for this category and subcategory'
        : 'You don\'t have an active listing for this category';
      throw new BadRequestException(errorMsg);
    }

    // Atomic update to prevent race conditions
    const result = await this.serviceRequestModel.findOneAndUpdate(
      {
        _id: id,
        status: ServiceRequestStatus.MATCHED,
        allNotifiedProviders: new Types.ObjectId(providerId),
      },
      {
        $set: {
          status: ServiceRequestStatus.ACCEPTED,
          acceptedProviderId: new Types.ObjectId(providerId),
          acceptedListingId: new Types.ObjectId(matchingListing._id),
          acceptedAt: new Date(),
          acceptedPrice: matchingListing.price,
        },
      },
      { new: true },
    );

    if (!result) {
      throw new BadRequestException('Request has already been accepted by another provider');
    }

    // Calculate total amount based on listing price and request metadata
    let totalAmount = matchingListing.price;
    if (request.metadata?.quantity) {
      totalAmount *= request.metadata.quantity;
    }
    if (request.metadata?.duration) {
      // If price is per hour and duration is specified
      if (matchingListing.unitOfMeasure === 'per_hour') {
        totalAmount = matchingListing.price * request.metadata.duration;
      }
    }

    // Create order
    const orderData = {
      seekerId: request.seekerId.toString(),
      providerId: providerId,
      listingId: matchingListing._id,
      serviceRequestId: id,
      categoryId: request.categoryId.toString(),
      subCategoryId: request.subCategoryId?.toString(),
      totalAmount,
      coordinates: request.location.coordinates,
      serviceStartDate: request.serviceStartDate,
      serviceEndDate: request.serviceEndDate,
      description: request.description,
      quantity: request.metadata?.quantity,
      unitOfMeasure: matchingListing.unitOfMeasure,
      metadata: {
        ...request.metadata,
        requestTitle: request.title,
        listingTitle: matchingListing.title,
        listingPrice: matchingListing.price,
      },
    };

    const order = await this.ordersService.createFromServiceRequest(orderData);

    result.orderId = (order as any)._id;
    await result.save();

    // Notify seeker about acceptance
    this.chatGateway.server.to(`user-${request.seekerId}`).emit('service-request-accepted', {
      requestId: id,
      providerId,
      providerName: matchingListing.providerId?.name || 'Service Provider',
      orderId: (order as any)._id,
      price: totalAmount,
    });

    // Notify all other notified providers that request is no longer available
    for (const notifiedProviderId of request.allNotifiedProviders) {
      if (notifiedProviderId.toString() !== providerId) {
        this.chatGateway.server.to(`user-${notifiedProviderId}`).emit('service-request-closed', {
          requestId: id,
          reason: 'accepted_by_another',
        });
      }
    }

    this.logger.log(`Request ${id} accepted by provider ${providerId}, order ${(order as any)._id} created`);

    return {
      request: result.toObject(),
      order,
    };
  }

  // Cron job to process pending waves
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledWaves() {
    const now = new Date();
    const requestsNeedingWave = await this.serviceRequestModel.find({
      status: { $in: [ServiceRequestStatus.OPEN, ServiceRequestStatus.MATCHED] },
      nextWaveAt: { $lte: now },
      currentWave: { $lt: WAVE_CONFIG.maxWaves },
    }).limit(10); // Process 10 at a time

    for (const request of requestsNeedingWave) {
      try {
        await this.processNextWave(request._id);
      } catch (error) {
        this.logger.error(`Error processing wave for request ${request._id}:`, error);
      }
    }
  }

  // Cron job to expire old requests
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireOldRequests() {
    const now = new Date();
    const expiredRequests = await this.serviceRequestModel.find({
      status: { $in: [ServiceRequestStatus.OPEN, ServiceRequestStatus.MATCHED] },
      expiresAt: { $lt: now },
      isAutoExpired: false,
    }).limit(20);

    for (const request of expiredRequests) {
      try {
        await this.expire(request._id);
      } catch (error) {
        this.logger.error(`Error expiring request ${request._id}:`, error);
      }
    }
  }

  async expire(id: string): Promise<ServiceRequest> {
    const updatedRequest = await this.serviceRequestModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: ServiceRequestStatus.EXPIRED,
          isAutoExpired: true,
          cancellationReason: 'Request expired - no provider accepted in time',
        },
      },
      { new: true },
    ).lean();

    if (!updatedRequest) {
      throw new NotFoundException('Service request not found');
    }

    // Notify seeker
    this.chatGateway.server.to(`user-${updatedRequest.seekerId}`).emit('service-request-expired', {
      requestId: id,
      message: 'Your service request has expired. Please create a new request if you still need the service.',
    });

    // Notify all notified providers
    for (const providerId of updatedRequest.allNotifiedProviders) {
      this.chatGateway.server.to(`user-${providerId}`).emit('service-request-closed', {
        requestId: id,
        reason: 'expired',
      });
    }

    return updatedRequest;
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

    // Only allow updates if request is still OPEN or MATCHED
    if (request.status !== ServiceRequestStatus.OPEN &&
        request.status !== ServiceRequestStatus.MATCHED) {
      throw new BadRequestException('Cannot update request in current status');
    }

    const updatedRequest = await this.serviceRequestModel.findByIdAndUpdate(
      id,
      { $set: updateDto },
      { new: true },
    )
      .populate('seekerId', 'name phone email')
      .populate('categoryId', 'name icon')
      .populate('subCategoryId', 'name')
      .lean();

    if (!updatedRequest) {
      throw new NotFoundException('Service request not found');
    }

    return updatedRequest;
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

    const updatedRequest = await this.serviceRequestModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: ServiceRequestStatus.CANCELLED,
          cancellationReason: reason || 'Cancelled by user',
        },
      },
      { new: true },
    ).lean();

    // Notify all notified providers
    for (const providerId of request.allNotifiedProviders) {
      this.chatGateway.server.to(`user-${providerId}`).emit('service-request-closed', {
        requestId: id,
        reason: 'cancelled_by_seeker',
      });
    }

    return updatedRequest;
  }

  async findById(id: string): Promise<ServiceRequest> {
    const request = await this.serviceRequestModel
      .findById(id)
      .populate('seekerId', 'name phone email profilePicture')
      .populate('categoryId', 'name icon')
      .populate('subCategoryId', 'name')
      .populate('acceptedProviderId', 'name phone profilePicture')
      .populate('acceptedListingId', 'title price unitOfMeasure')
      .lean();

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    return request;
  }

  async findAll(filters: {
    status?: ServiceRequestStatus;
    categoryId?: string;
    seekerId?: string;
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

    const [requests, total] = await Promise.all([
      this.serviceRequestModel
        .find(query)
        .populate('seekerId', 'name phone email')
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

  async decline(requestId: string, providerId: string, reason?: string): Promise<void> {
    const request = await this.serviceRequestModel.findById(requestId);
    
    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (!request.allNotifiedProviders.some(pid => pid.toString() === providerId)) {
      throw new ForbiddenException('You were not notified about this request');
    }

    // Add to declined providers list
    if (!request.declinedProviders.some(pid => pid.toString() === providerId)) {
      request.declinedProviders.push(new Types.ObjectId(providerId));
      await request.save();
    }

    this.logger.log(`Provider ${providerId} declined request ${requestId}`);
  }

  private getCoordinatesFromAddress(address: any): [number, number] {
    if (address?.location?.coordinates && address.location.coordinates.length === 2) {
      return address.location.coordinates as [number, number];
    }

    if (Array.isArray(address?.coordinates) && address.coordinates.length === 2) {
      return address.coordinates as [number, number];
    }

    throw new BadRequestException('Address is missing valid coordinates');
  }
}
