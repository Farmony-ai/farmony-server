import { Injectable } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { ListingsService } from '../listings/listings.service';
import { RatingsService } from '../ratings/ratings.service';
import { UsersService } from '../users/users.service';
import { OrderStatus } from '../orders/dto/create-order.dto';
import { UpdatePreferencesDto } from '../users/dto/update-preferences.dto';

@Injectable()
export class ProvidersService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly listingsService: ListingsService,
    private readonly ratingsService: RatingsService,
    private readonly usersService: UsersService,
  ) {}

  // Helper function to calculate distance between coordinates
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10; // Round to 1 decimal place
  }

  async getProviderDashboard(providerId: string) {
    try {
      // Get provider details for location
      const provider = await this.usersService.findById(providerId);
      const providerCoordinates = provider?.coordinates || provider?.address?.coordinates || null;
      
      // Get summary statistics
      const summary = await this.ordersService.getProviderSummary(providerId);
      
      // Get active listings count
      const listings = await this.listingsService.findByProvider(providerId);
      const activeListings = listings.filter(l => l.isActive).length;
      
      // Get average rating
      const ratings = await this.ratingsService.findByUser(providerId);
      const avgRating = ratings.length > 0 
        ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length 
        : 0;

      // Get all bookings without population
      const allBookings = await this.ordersService.findByProvider(providerId);
      
      // Manually fetch and enhance booking data
      const enhancedBookings = await Promise.all(
        allBookings.map(async (booking) => {
          let seekerDetails = null;
          let listingDetails = null;
          
          try {
            // Fetch seeker details
            seekerDetails = await this.usersService.findById(booking.seekerId.toString());
          } catch (error) {
            console.error(`Failed to fetch seeker ${booking.seekerId}:`, error);
          }
          
          try {
            // Use the listings service findById which already handles transformation
            listingDetails = await this.listingsService.findById(booking.listingId.toString());
          } catch (error) {
            console.error(`Failed to fetch listing ${booking.listingId}:`, error);
          }
          
          return {
            ...booking.toObject ? booking.toObject() : booking,
            seekerDetails,
            listingDetails
          };
        })
      );

      // Process and enhance bookings with distance calculation
      const enhanceBooking = (booking: any) => {
        // Debug logging
        console.log('Processing booking:', {
          id: booking._id,
          hasListingDetails: !!booking.listingDetails,
          listingPhotos: booking.listingDetails?.photos?.length || 0,
          listingPhotoUrls: booking.listingDetails?.photoUrls?.length || 0
        });

        const enhanced = {
          _id: booking._id,
          status: booking.status,
          orderType: booking.orderType,
          createdAt: booking.createdAt,
          requestExpiresAt: booking.requestExpiresAt,
          serviceStartDate: booking.serviceStartDate,
          serviceEndDate: booking.serviceEndDate,
          quantity: booking.quantity,
          unitOfMeasure: booking.unitOfMeasure,
          totalAmount: booking.totalAmount,
          isAutoRejected: booking.isAutoRejected,
          coordinates: booking.coordinates,
          
          // Seeker details
          seeker: {
            _id: booking.seekerDetails?._id || booking.seekerId,
            name: booking.seekerDetails?.name || 'Unknown',
            phone: booking.seekerDetails?.phone || '',
            email: booking.seekerDetails?.email || '',
            location: booking.seekerDetails?.address?.village || 
                     booking.seekerDetails?.address?.city || 
                     booking.seekerDetails?.address?.district ||
                     'Location not available',
            coordinates: booking.seekerDetails?.coordinates || 
                        booking.seekerDetails?.address?.coordinates || null
          },
          
          // Listing details with correct field names
          listing: {
            _id: booking.listingDetails?._id || booking.listingId,
            title: booking.listingDetails?.title || 'Service',
            description: booking.listingDetails?.description || '',
            price: booking.listingDetails?.price || booking.totalAmount,
            unitOfMeasure: booking.listingDetails?.unitOfMeasure || booking.unitOfMeasure,
            category: booking.listingDetails?.category || '',
            // Use photoUrls which is what the listing service provides
            images: booking.listingDetails?.photoUrls || [],
            thumbnailUrl: booking.listingDetails?.photoUrls?.[0] || null
          },
          
          // Distance calculation
          distance: null as number | null
        };
        
        // Calculate distance if coordinates available
        if (providerCoordinates && booking.coordinates && booking.coordinates.length === 2) {
          try {
            enhanced.distance = this.calculateDistance(
              providerCoordinates[1], // lat
              providerCoordinates[0], // lon
              booking.coordinates[1],
              booking.coordinates[0]
            );
          } catch (error) {
            console.error('Distance calculation error:', error);
          }
        }
        
        return enhanced;
      };
      
      // Separate and enhance bookings by status
      const pendingBookings = enhancedBookings
        .filter(b => b.status === 'pending')
        .map(enhanceBooking)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
      
      const upcomingBookings = enhancedBookings
        .filter(b => ['accepted', 'paid'].includes(b.status))
        .map(enhanceBooking)
        .sort((a, b) => {
          const dateA = a.serviceStartDate || a.createdAt;
          const dateB = b.serviceStartDate || b.createdAt;
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        })
        .slice(0, 10);

      return {
        summary: {
          totalBookings: summary.totalOrders,
          completedBookings: summary.fulfilledOrders,
          revenue: summary.revenue,
          activeListings,
          averageRating: Number(avgRating.toFixed(1)),
          totalRatings: ratings.length
        },
        pendingBookings,
        upcomingBookings,
        recentBookings: [...pendingBookings, ...upcomingBookings].slice(0, 5)
      };
    } catch (error) {
      console.error('Error in getProviderDashboard:', error);
      throw error;
    }
  }

  async getProviderBookings(providerId: string) {
    const bookings = await this.ordersService.findByProvider(providerId);
    
    return {
      active: bookings.filter(b => 
        ['pending', 'accepted', 'paid'].includes(b.status)
      ),
      completed: bookings.filter(b => b.status === 'completed'),
      canceled: bookings.filter(b => b.status === 'canceled'),
      toReview: await this.getBookingsNeedingReview(providerId, bookings)
    };
  }

  async getActiveBookings(providerId: string) {
    const bookings = await this.ordersService.findByProvider(providerId);
    return bookings.filter(b => 
      ['pending', 'accepted', 'paid'].includes(b.status)
    );
  }

  async getCompletedBookings(providerId: string) {
    const bookings = await this.ordersService.findByProvider(providerId);
    return bookings.filter(b => b.status === 'completed');
  }

  async getBookingsToReview(providerId: string) {
    const completedBookings = await this.getCompletedBookings(providerId);
    return this.getBookingsNeedingReview(providerId, completedBookings);
  }

  private async getBookingsNeedingReview(providerId: string, bookings: any[]) {
    const toReview = [];
    
    for (const booking of bookings) {
      if (booking.status === 'completed') {
        const ratings = await this.ratingsService.findByOrder(booking._id.toString());
        const hasProviderRated = ratings.some(r => 
          r.raterId.toString() === providerId
        );
        
        if (!hasProviderRated) {
          toReview.push(booking);
        }
      }
    }
    
    return toReview;
  }

  async updateUserPreferences(userId: string, dto: UpdatePreferencesDto) {
    return this.usersService.updatePreferences(userId, dto);
  }
}