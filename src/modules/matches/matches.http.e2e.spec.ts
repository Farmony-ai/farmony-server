import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MatchesController } from './matches.controller';
import { MatchesService, MatchResponse } from './matches.service';
import { AuthGuard } from '@nestjs/passport';
import * as request from 'supertest';

describe('MatchesController (HTTP e2e)', () => {
  let app: INestApplication;
  const mockService = {
    createMatch: jest.fn<Promise<MatchResponse>, any[]>(),
    getMatchRequest: jest.fn(),
  } as unknown as MatchesService;

  beforeAll(async () => {
    const JwtAuthGuard = AuthGuard('jwt');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [{ provide: MatchesService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard as any)
      .useValue({
        canActivate: (ctx) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { userId: 'user-1' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('POST /api/matches -> 201 CREATED with providers', async () => {
    (mockService.createMatch as any).mockResolvedValue({
      request_id: 'req-1',
      status: 'CREATED',
      providers: [{ _id: 'p1', name: 'Provider 1', distance_m: 420 }],
    } satisfies MatchResponse);

    const http = (app.getHttpAdapter() as any).getInstance();
    const res = await request(http)
      .post('/api/matches')
      .send({ lat: 10, lon: 20, categoryId: '507f1f77bcf86cd799439011', limit: 5 })
      .expect(201);

    expect(res.body.request_id).toBe('req-1');
    expect(res.body.providers).toHaveLength(1);
  });

  it('POST /api/matches -> 400 on bad payload', async () => {
    // invalid lat/lon and missing categoryId
    const http = (app.getHttpAdapter() as any).getInstance();
    const res = await request(http)
      .post('/api/matches')
      .send({ lat: 200, lon: 'west' })
      .expect(400);

    expect(res.body.message).toBeDefined();
  });

  it('GET /api/matches/request/:id -> 200 with mocked auth guard', async () => {
    (mockService.getMatchRequest as any).mockResolvedValue({
      _id: 'req-xyz',
      status: 'CREATED',
      candidates: [],
    });

    const http = (app.getHttpAdapter() as any).getInstance();
    const res = await request(http)
      .get('/api/matches/request/req-xyz')
      .set('Authorization', 'Bearer test')
      .expect(200);

    expect(res.body._id).toBe('req-xyz');
  });
});
