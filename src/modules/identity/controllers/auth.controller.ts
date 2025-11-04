import { Controller, Post, Body, Get, Request, UseGuards, Patch, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { VerifyFirebaseTokenDto } from '../dto/verify-firebase-token.dto';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('firebase-login')
    @ApiOperation({
        summary: 'Login with Firebase ID token (after OTP verification)',
        description: 'Client verifies OTP via Firebase, sends ID token to backend. Backend verifies token, creates/updates user, returns custom token with RBAC claims.',
    })
    @ApiResponse({ status: 200, description: 'Authentication successful' })
    @ApiResponse({ status: 401, description: 'Invalid token' })
    async firebaseLogin(@Body() dto: VerifyFirebaseTokenDto) {
        return this.authService.firebaseLogin(dto);
    }

    @Post('verify-token')
    @ApiOperation({ summary: 'Verify Firebase token and get user claims' })
    async verifyToken(@Body() dto: { idToken: string }) {
        return this.authService.verifyToken(dto.idToken);
    }

    @UseGuards(FirebaseAuthGuard)
    @Get('profile')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    getProfile(@Request() req) {
        return {
            user: req.user,
            message: 'Profile retrieved successfully',
        };
    }

    @UseGuards(FirebaseAuthGuard, RolesGuard)
    @Roles('admin')
    @Patch('users/:userId/role')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update user role (Admin only)' })
    async updateUserRole(@Param('userId') userId: string, @Body() body: { role: string }) {
        return this.authService.updateUserRole(userId, body.role);
    }

    @UseGuards(FirebaseAuthGuard)
    @Post('logout')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Logout user (revoke refresh tokens)' })
    async logout(@Request() req) {
        return this.authService.logout(req.user.uid);
    }

    // Example protected routes with different role requirements

    @UseGuards(FirebaseAuthGuard, RolesGuard)
    @Roles('provider')
    @Get('provider-only')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Provider-only endpoint example' })
    getProviderData(@Request() req) {
        return {
            message: 'This is provider-only data',
            user: req.user,
        };
    }

    @UseGuards(FirebaseAuthGuard, RolesGuard)
    @Roles('seeker')
    @Get('seeker-only')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Seeker-only endpoint example' })
    getSeekerData(@Request() req) {
        return {
            message: 'This is seeker-only data',
            user: req.user,
        };
    }

    @UseGuards(FirebaseAuthGuard, RolesGuard)
    @Roles('admin')
    @Get('admin-only')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Admin-only endpoint example' })
    getAdminData(@Request() req) {
        return {
            message: 'This is admin-only data',
            user: req.user,
        };
    }

    @UseGuards(FirebaseAuthGuard, RolesGuard)
    @Roles('seeker', 'provider') // Allow multiple roles
    @Get('seeker-or-provider')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Endpoint accessible by seekers or providers' })
    getData(@Request() req) {
        return {
            message: 'This is for seekers and providers',
            user: req.user,
        };
    }
}
