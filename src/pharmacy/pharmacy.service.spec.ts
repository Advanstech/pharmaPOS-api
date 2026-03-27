import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { GraphQLError } from 'graphql';
import { PharmacyService } from './pharmacy.service';

// Ghana FDA compliance tests — WRITE TESTS FIRST per testing.md
// These tests must pass at ≥ 90% coverage before any implementation ships

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockDataSource = {
  query: jest.fn(),
  transaction: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'OPENAI_API_KEY') return undefined;
    if (key === 'GMDC_API_URL') return 'https://example.com';
    return undefined;
  }),
};

describe('PharmacyService — Ghana FDA Compliance', () => {
  let service: PharmacyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PharmacyService,
        { provide: CACHE_MANAGER, useValue: mockCache },
        { provide: DataSource, useValue: mockDataSource },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<PharmacyService>(PharmacyService);
    jest.clearAllMocks();
  });

  // ── GMDC Licence Validation ──────────────────────────────────────────────

  describe('validateGmdcLicence', () => {
    it('returns cached result without API call when Redis hit', async () => {
      mockCache.get.mockResolvedValue({ valid: true });
      const result = await service.validateGmdcLicence('GMDC-12345');
      expect(result).toEqual({ valid: true, cached: true });
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('throws GMDC_INVALID_LICENCE when API returns invalid licence', async () => {
      mockCache.get.mockResolvedValue(null);
      // Spy on private method to simulate invalid licence
      jest.spyOn(service as unknown as { callGmdcApi: (l: string) => Promise<{ valid: boolean }> }, 'callGmdcApi')
        .mockResolvedValue({ valid: false });

      await expect(service.validateGmdcLicence('EXPIRED-999')).rejects.toThrow(
        expect.objectContaining({ extensions: expect.objectContaining({ code: 'GMDC_INVALID_LICENCE' }) }),
      );
    });

    it('allows with warning when GMDC API is down (never block due to outage)', async () => {
      mockCache.get.mockResolvedValue(null);
      jest.spyOn(service as unknown as { callGmdcApi: (l: string) => Promise<{ valid: boolean }> }, 'callGmdcApi')
        .mockRejectedValue(new Error('Network timeout'));

      const result = await service.validateGmdcLicence('GMDC-12345');
      expect(result.valid).toBe(true);
    });
  });

  // ── Rx Expiry Validation ─────────────────────────────────────────────────

  describe('validateRxExpiry', () => {
    it('passes for Rx prescribed today', () => {
      expect(() => service.validateRxExpiry(new Date())).not.toThrow();
    });

    it('passes for Rx prescribed 29 days ago', () => {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      expect(() => service.validateRxExpiry(d)).not.toThrow();
    });

    it('throws FDA_RX_EXPIRED for Rx prescribed 31 days ago', () => {
      const d = new Date();
      d.setDate(d.getDate() - 31);
      expect(() => service.validateRxExpiry(d)).toThrow(
        expect.objectContaining({ extensions: expect.objectContaining({ code: 'FDA_RX_EXPIRED' }) }),
      );
    });

    it('throws FDA_RX_EXPIRED for Rx prescribed exactly 30 days ago (boundary)', () => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      d.setMinutes(d.getMinutes() - 1); // 1 minute past 30 days
      expect(() => service.validateRxExpiry(d)).toThrow();
    });
  });

  // ── Drug Interaction Enforcement ─────────────────────────────────────────

  describe('enforceInteractionSeverity', () => {
    it('does not throw for MINOR interaction (advisory only)', () => {
      expect(() =>
        service.enforceInteractionSeverity([{ severity: 'MINOR', description: 'Minor interaction', canOverride: true }]),
      ).not.toThrow();
    });

    it('does not throw for MODERATE interaction (pharmacist ack required — not enforced here)', () => {
      expect(() =>
        service.enforceInteractionSeverity([{ severity: 'MODERATE', description: 'Moderate', canOverride: true }]),
      ).not.toThrow();
    });

    it('does not throw for MAJOR interaction (override handled at resolver level)', () => {
      expect(() =>
        service.enforceInteractionSeverity([{ severity: 'MAJOR', description: 'Major', canOverride: true }]),
      ).not.toThrow();
    });

    it('throws FDA_DRUG_CONTRAINDICATED for CONTRAINDICATED — hard block, no override', () => {
      expect(() =>
        service.enforceInteractionSeverity([{ severity: 'CONTRAINDICATED', description: 'Fatal combo', canOverride: false }]),
      ).toThrow(
        expect.objectContaining({ extensions: expect.objectContaining({ code: 'FDA_DRUG_CONTRAINDICATED' }) }),
      );
    });

    it('throws on first CONTRAINDICATED even if other interactions are minor', () => {
      expect(() =>
        service.enforceInteractionSeverity([
          { severity: 'MINOR', description: 'Minor', canOverride: true },
          { severity: 'CONTRAINDICATED', description: 'Fatal', canOverride: false },
        ]),
      ).toThrow();
    });
  });

  describe('checkDrugInteractions', () => {
    it('returns empty array when fewer than 2 product ids', async () => {
      await expect(service.checkDrugInteractions([])).resolves.toEqual([]);
      await expect(service.checkDrugInteractions(['a'])).resolves.toEqual([]);
    });

    it('returns empty array when OPENAI_API_KEY is not configured', async () => {
      const result = await service.checkDrugInteractions(['p1', 'p2']);
      expect(result).toEqual([]);
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });
  });
});
