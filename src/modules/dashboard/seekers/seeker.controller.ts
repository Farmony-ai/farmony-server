import { Controller, Get, Param, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { SeekerService } from './seeker.service';
import { FirebaseAuthGuard } from '../../identity/guards/firebase-auth.guard';

@Controller('seeker')
@UseGuards(FirebaseAuthGuard)
export class SeekerController {
    constructor(private readonly seekerService: SeekerService) { }

    @Get(':seekerId/bookings')
    async getUnifiedBookings(@Param('seekerId') seekerId: string, @Request() req) {
        // Verify the user is accessing their own bookings
        // Verify the user is accessing their own bookings
        // Check if either the Firebase UID or the MongoDB User ID matches the requested seekerId
        const isOwner = req.user.uid === seekerId || req.user.userId === seekerId;

        if (!isOwner && req.user.role !== 'admin') {
            throw new UnauthorizedException('Unauthorized access to bookings');
        }

        return this.seekerService.getUnifiedBookings(seekerId);
    }
}
