import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MatchesService, MatchResponse } from './matches.service';
import { MatchesController } from './matches.controller';


describe('MatchesController (e2e-like)', () => {
  let app: INestApplication;
  let controller: MatchesController;
  const mockService = {
    createMatch: jest.fn<Promise<MatchResponse>, any[]>(),
    getMatchRequest: jest.fn(),
  } as unknown as MatchesService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        { provide: MatchesService, useValue: mockService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    controller = moduleFixture.get(MatchesController);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('create() returns providers', async () => {
    mockService.createMatch = jest.fn().mockResolvedValue({
      request_id: 'req-1',
      status: 'CREATED',
      providers: [
        { _id: 'p1', name: 'Provider 1', distance_m: 420, phone: '123' },
      ],
    } as MatchResponse);

    const res = await controller.create(
      { lat: 32.77, lon: -96.8, categoryId: '507f1f77bcf86cd799439011', limit: 5 } as any,
      undefined,
      { user: null } as any,
    );
    expect(res.request_id).toBe('req-1');
    expect(res.providers).toHaveLength(1);
  });

  it('passes Idempotency-Key and seekerId=null to service', async () => {
    const spy = (mockService.createMatch = jest.fn().mockResolvedValue({
      request_id: 'req-2',
      status: 'NO_COVERAGE',
      providers: [],
    } as MatchResponse));

    const json = await controller.create(
      { lat: 32.77, lon: -96.8, categoryId: '507f1f77bcf86cd799439011' } as any,
      'idem-123',
      { user: null } as any,
    );

    expect(json.status).toBe('NO_COVERAGE');
    expect(spy).toHaveBeenCalledTimes(1);
    const [dto, idemp, seeker] = spy.mock.calls[0];
    expect(idemp).toBe('idem-123');
    expect(seeker).toBeNull();
  });
});
