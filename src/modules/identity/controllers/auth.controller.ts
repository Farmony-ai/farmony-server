import { Controller, Post, Body, Get, Request, UseGuards, Patch, Param } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { FirebaseLoginDto } from '../dto/firebase-login.dto';
import { FirebaseAuthGuard } from '../guards/firebase-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    @ApiOperation({
        summary: 'Register new user',
        description: 'Register a new user after Firebase OTP verification. Requires name and optional email.',
    })
    @ApiResponse({ status: 201, description: 'Registration successful' })
    @ApiResponse({ status: 400, description: 'User already registered / Email already in use' })
    @ApiResponse({ status: 401, description: 'Invalid token' })
    async register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post('login')
    @ApiOperation({
        summary: 'Login existing user',
        description: 'Login with Firebase ID token. User must be registered first.',
    })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 404, description: 'User not registered' })
    @ApiResponse({ status: 401, description: 'Invalid token' })
    async login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Post('firebase-login')
    @ApiOperation({
        summary: 'Firebase OTP login (unified register/login)',
        description: 'Authenticate with Firebase ID token. Automatically registers new users or logs in existing users.',
    })
    @ApiResponse({ status: 200, description: 'Login/Registration successful' })
    @ApiResponse({ status: 400, description: 'Name required for first-time registration' })
    @ApiResponse({ status: 401, description: 'Invalid token' })
    async firebaseLogin(@Body() dto: FirebaseLoginDto) {
        return this.authService.firebaseLogin(dto);
    }

    @Post('verify-token')
    @ApiOperation({ summary: 'Verify Firebase token and get user claims' })
    async verifyToken(@Body() dto: LoginDto) {
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
    async updateUserRole(
        @Param('userId', ParseMongoIdPipe) userId: string,
        @Body() body: { role: string },
    ) {
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
