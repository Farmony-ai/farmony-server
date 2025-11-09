import { Controller, Get, Param, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { SeekerService } from './seeker.service';
import { FirebaseAuthGuard } from '@identity/guards/firebase-auth.guard';

@Controller('seeker')
@UseGuards(FirebaseAuthGuard)
export class SeekerController {
    constructor(private readonly seekerService: SeekerService) {}

    @Get(':seekerId/bookings')
    async getUnifiedBookings(@Param('seekerId') seekerId: string, @Request() req) {
        // Verify the user is accessing their own bookings
        if ((req.user.uid || req.user.userId) !== seekerId && req.user.role !== 'admin') {
            throw new UnauthorizedException('Unauthorized access to bookings');
        }

        return this.seekerService.getUnifiedBookings(seekerId);
    }
}
