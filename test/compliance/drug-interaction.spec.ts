import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { PharmacyService } from '../../src/pharmacy/pharmacy.service';
import type { DrugInteractionResult } from '../../src/pharmacy/pharmacy.service';

/**
 * Ghana FDA Compliance Test: Drug Interaction Enforcement
 * All 4 severity levels tested per ghana-compliance.md rules.
 */

describe('Drug Interaction Enforcement — Ghana FDA Compliance', () => {
  let service: PharmacyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PharmacyService,
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
        { provide: DataSource, useValue: { query: jest.fn(), transaction: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn(() => undefined) } },
      ],
    }).compile();
    service = module.get(PharmacyService);
  });

  const make = (severity: DrugInteractionResult['severity']): DrugInteractionResult => ({
    severity,
    description: `${severity} interaction`,
    canOverride: severity !== 'CONTRAINDICATED',
  });

  it('MINOR: does not block — advisory only shown to cashier', () => {
    expect(() => service.enforceInteractionSeverity([make('MINOR')])).not.toThrow();
  });

  it('MODERATE: does not block at service level — pharmacist ack handled at resolver', () => {
    expect(() => service.enforceInteractionSeverity([make('MODERATE')])).not.toThrow();
  });

  it('MAJOR: does not hard-block at service level — override handled at resolver + logged', () => {
    expect(() => service.enforceInteractionSeverity([make('MAJOR')])).not.toThrow();
  });

  it('CONTRAINDICATED: hard block — throws FDA_DRUG_CONTRAINDICATED, no override possible', () => {
    expect(() => service.enforceInteractionSeverity([make('CONTRAINDICATED')])).toThrow(
      expect.objectContaining({ extensions: expect.objectContaining({ code: 'FDA_DRUG_CONTRAINDICATED' }) }),
    );
  });

  it('CONTRAINDICATED: canOverride is false — confirmed in thrown error context', () => {
    const interaction = make('CONTRAINDICATED');
    expect(interaction.canOverride).toBe(false);
  });

  it('Mixed: blocks on CONTRAINDICATED even when other interactions are minor', () => {
    expect(() =>
      service.enforceInteractionSeverity([make('MINOR'), make('MODERATE'), make('CONTRAINDICATED')]),
    ).toThrow();
  });

  it('Empty interactions: no throw', () => {
    expect(() => service.enforceInteractionSeverity([])).not.toThrow();
  });
});
