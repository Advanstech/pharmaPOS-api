import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { PharmacyService } from '../../src/pharmacy/pharmacy.service';

/**
 * Ghana FDA Compliance Test: GMDC Licence Validation
 * Tests all three scenarios: valid, expired/not-found, API down.
 */

const mockCache = { get: jest.fn(), set: jest.fn() };
const mockDataSource = { query: jest.fn(), transaction: jest.fn() };
const mockConfig = {
  get: jest.fn(() => undefined),
};

describe('GMDC Licence Validation — Ghana FDA Compliance', () => {
  let service: PharmacyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PharmacyService,
        { provide: CACHE_MANAGER, useValue: mockCache },
        { provide: DataSource, useValue: mockDataSource },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(PharmacyService);
    jest.clearAllMocks();
  });

  it('VALID: returns valid=true and caches result', async () => {
    mockCache.get.mockResolvedValue(null);
    jest.spyOn(service as unknown as { callGmdcApi: (l: string) => Promise<{ valid: boolean }> }, 'callGmdcApi')
      .mockResolvedValue({ valid: true });

    const result = await service.validateGmdcLicence('GMDC-VALID-001');
    expect(result.valid).toBe(true);
    expect(mockCache.set).toHaveBeenCalledWith('gmdc:GMDC-VALID-001', { valid: true }, 86400);
  });

  it('EXPIRED: throws GMDC_INVALID_LICENCE for expired licence', async () => {
    mockCache.get.mockResolvedValue(null);
    jest.spyOn(service as unknown as { callGmdcApi: (l: string) => Promise<{ valid: boolean }> }, 'callGmdcApi')
      .mockResolvedValue({ valid: false });

    await expect(service.validateGmdcLicence('GMDC-EXPIRED-999')).rejects.toMatchObject({
      extensions: { code: 'GMDC_INVALID_LICENCE' },
    });
  });

  it('NOT FOUND: throws GMDC_INVALID_LICENCE for unknown licence', async () => {
    mockCache.get.mockResolvedValue(null);
    jest.spyOn(service as unknown as { callGmdcApi: (l: string) => Promise<{ valid: boolean }> }, 'callGmdcApi')
      .mockResolvedValue({ valid: false });

    await expect(service.validateGmdcLicence('GMDC-NOTFOUND')).rejects.toMatchObject({
      extensions: { code: 'GMDC_INVALID_LICENCE' },
    });
  });

  it('API DOWN: allows with warning — never blocks due to outage', async () => {
    mockCache.get.mockResolvedValue(null);
    jest.spyOn(service as unknown as { callGmdcApi: (l: string) => Promise<{ valid: boolean }> }, 'callGmdcApi')
      .mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await service.validateGmdcLicence('GMDC-12345');
    expect(result.valid).toBe(true);
  });

  it('CACHED: uses Redis cache without hitting API', async () => {
    mockCache.get.mockResolvedValue({ valid: true });
    const apiSpy = jest.spyOn(service as unknown as { callGmdcApi: (l: string) => Promise<{ valid: boolean }> }, 'callGmdcApi');

    await service.validateGmdcLicence('GMDC-CACHED');
    expect(apiSpy).not.toHaveBeenCalled();
  });
});
