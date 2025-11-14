import { Body, Controller, Headers, Post, UseGuards, Request, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiBearerAuth } from '@nestjs/swagger';
import { CreateMatchDto } from '../dto/create-match.dto';
import { MatchesService } from '../services/matches.service';
import { FirebaseAuthGuard } from '@identity/guards/firebase-auth.guard';

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
    constructor(private readonly matchesService: MatchesService) {}

    @Post()
    @UseGuards(FirebaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a match request for providers (requires authentication)' })
    @ApiHeader({ name: 'Idempotency-Key', required: false })
    async create(@Body() dto: CreateMatchDto, @Request() req: any, @Headers('Idempotency-Key') idempKey?: string) {
        const seekerId = req.user.uid || req.user.userId;
        return this.matchesService.createMatch(dto, idempKey ?? null, seekerId);
    }

    @Get('request/:requestId')
    @UseGuards(FirebaseAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get match request details' })
    async getMatchRequest(@Param('requestId') requestId: string) {
        return this.matchesService.getMatchRequest(requestId);
    }
}
