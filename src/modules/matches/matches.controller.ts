import { Body, Controller, Headers, Post, UseGuards, Request, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiBearerAuth } from '@nestjs/swagger';
import { CreateMatchDto } from './dto/create-match.dto';
import { MatchesService } from './matches.service';
import { AuthGuard } from '@nestjs/passport';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Find matching providers for a location' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  async create(
    @Body() dto: CreateMatchDto,
    @Headers('Idempotency-Key') idempKey?: string,
    @Request() req?: any,
  ) {
    const seekerId = req?.user?.userId || null;
    return this.matchesService.createMatch(dto, idempKey ?? null, seekerId);
  }

  @Get('request/:requestId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get match request details' })
  async getMatchRequest(@Param('requestId') requestId: string) {
    return this.matchesService.getMatchRequest(requestId);
  }
}

