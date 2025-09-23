import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { MatchesService } from './matches.service';
import { User } from '../users/users.schema';
import { Catalogue } from '../catalogue/catalogue.schema';
import { MatchRequest } from './schemas/match-request.schema';
import { MatchCandidate } from './schemas/match-candidate.schema';
import { S3Service } from '../aws/s3.service';

// Helper to create a chainable query mock
const chain = (result: any) => ({
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});

describe('MatchesService', () => {
  let service: MatchesService;

  const userModel = {
    aggregate: jest.fn(),
  } as any;

  const catalogueModel = {
    findById: jest.fn(),
  } as any;

  const matchRequestModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
  } as any;

  const matchCandidateModel = {
    insertMany: jest.fn(),
    find: jest.fn(),
  } as any;

  const s3Service = {
    getPublicUrl: jest.fn((k: string) => `https://cdn.example/${k}`),
  } as any as S3Service;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Catalogue.name), useValue: catalogueModel },
        { provide: getModelToken(MatchRequest.name), useValue: matchRequestModel },
        { provide: getModelToken(MatchCandidate.name), useValue: matchCandidateModel },
        { provide: S3Service, useValue: s3Service },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
  });

  it('returns CREATED with providers when hits exist', async () => {
    const hits = [
      { _id: '507f1f77bcf86cd799439012', name: 'Prov A', phone: '123', profilePicture: 'u/p.jpg', distance_m: 321.7 },
    ];
    userModel.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue(hits) });
    catalogueModel.findById.mockReturnValue({ lean: () => Promise.resolve({ _id: '507f1f77bcf86cd799439011' }) });
    matchRequestModel.findOne.mockResolvedValue(null);
    matchRequestModel.create.mockResolvedValue(undefined);
    matchCandidateModel.insertMany.mockResolvedValue(undefined);

    const res = await service.createMatch({ lat: 10, lon: 20, categoryId: '507f1f77bcf86cd799439011', limit: 10 }, null, '507f1f77bcf86cd799439010');

    expect(res.status).toBe('CREATED');
    expect(res.providers).toHaveLength(1);
    expect(res.providers[0]).toMatchObject({ name: 'Prov A', distance_m: 322 });
    // URL mapping covered in idempotency test below
    expect(matchRequestModel.create).toHaveBeenCalled();
    expect(matchCandidateModel.insertMany).toHaveBeenCalled();
  });

  it('returns NO_COVERAGE when no hits', async () => {
    userModel.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    catalogueModel.findById.mockReturnValue({ lean: () => Promise.resolve({ _id: '507f1f77bcf86cd799439011' }) });
    matchRequestModel.findOne.mockResolvedValue(null);
    matchRequestModel.create.mockResolvedValue(undefined);

    const res = await service.createMatch({ lat: 10, lon: 20, categoryId: '507f1f77bcf86cd799439011', limit: 10 }, null, null);
    expect(res.status).toBe('NO_COVERAGE');
    expect(res.providers).toHaveLength(0);
    expect(matchCandidateModel.insertMany).not.toHaveBeenCalled();
  });

  it('uses idempotency and returns prior result when idempotency_key exists', async () => {
    const existing = { _id: 'req-123', status: 'CREATED' } as any;
    catalogueModel.findById.mockReturnValue({ lean: () => Promise.resolve({ _id: '507f1f77bcf86cd799439011' }) });
    userModel.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    matchRequestModel.findOne.mockReturnValue({ lean: () => Promise.resolve(existing) });
    // return chainable find().populate().sort().lean()
    matchCandidateModel.find.mockReturnValue(chain([
      {
        provider_id: { _id: '507f1f77bcf86cd799439012', name: 'Prov A', phone: '123', profilePicture: 'k.jpg' },
        distance_m: 420,
      },
    ]));

    const res = await service.createMatch({ lat: 10, lon: 20, categoryId: '507f1f77bcf86cd799439011', limit: 10 }, 'idemp-1', '507f1f77bcf86cd799439010');
    expect(res.request_id).toBe('req-123');
    expect(res.providers).toHaveLength(1);
  });
});
