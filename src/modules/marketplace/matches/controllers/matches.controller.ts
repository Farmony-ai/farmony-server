import { Body, Controller, Headers, Post, UseGuards, Request, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiBearerAuth } from '@nestjs/swagger';
import { CreateMatchDto } from '../dto/create-match.dto';
import { MatchesService } from '../services/matches.service';
import { FirebaseAuthGuard } from '@identity/guards/firebase-auth.guard';
import { OptionalAuthGuard } from '@identity/guards/optional-auth.guard';

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
    constructor(private readonly matchesService: MatchesService) {}

    @Post()
    @UseGuards(OptionalAuthGuard)
    @ApiOperation({ summary: 'Find matching providers for a location' })
    @ApiHeader({ name: 'Idempotency-Key', required: false })
    async create(@Body() dto: CreateMatchDto, @Headers('Idempotency-Key') idempKey?: string, @Request() req?: any) {
        const seekerId = req?.user?.uid || req?.user?.userId || null;
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
