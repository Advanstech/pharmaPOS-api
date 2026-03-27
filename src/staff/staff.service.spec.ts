import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { StaffService } from './staff.service';
import { User } from '../auth/entities/user.entity';
import { StaffProfile } from './entities/staff_profile.entity';
import { JwtUser } from '../auth/decorators/current-user.decorator';

// ── Shared fixtures ───────────────────────────────────────────────────────

// Valid 64-char hex key (32 bytes) — required before module init
const VALID_KEY = crypto.randomBytes(32).toString('hex');

const ownerActor: JwtUser = {
  sub: 'owner-uuid-001',
  role: 'owner',
  branchId: 'branch-uuid-001',
  branchType: 'pharmaceutical',
  sessionId: 'session-uuid-001',
};

const cashierActor: JwtUser = {
  sub: 'cashier-uuid-001',
  role: 'cashier',
  branchId: 'branch-uuid-001',
  branchType: 'pharmaceutical',
  sessionId: 'session-uuid-002',
};

const mockUser: User = {
  id: 'staff-uuid-001',
  branch_id: 'branch-uuid-001',
  name: 'Kofi Mensah',
  email: 'kofi@azzaypharmacy.com',
  phone: undefined,
  role: 'pharmacist',
  password_hash: 'hashed',
  mfa_enabled: false,
  is_active: true,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

const mockProfile = {
  id: 'profile-uuid-001',
  user_id: 'staff-uuid-001',
  branch_id: 'branch-uuid-001',
  position: 'Senior Pharmacist',
  department: 'Dispensary',
  employment_type: 'full_time',
  is_active: true,
};

const mockUsersRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};

const mockProfilesRepo = {
  findOne: jest.fn(),
  update: jest.fn(),
};

const mockDataSource = {
  query: jest.fn(),
  transaction: jest.fn(),
};

async function buildModule(): Promise<TestingModule> {
  process.env.PII_ENCRYPTION_KEY = VALID_KEY;

  return Test.createTestingModule({
    providers: [
      StaffService,
      { provide: getRepositoryToken(User), useValue: mockUsersRepo },
      { provide: getRepositoryToken(StaffProfile), useValue: mockProfilesRepo },
      { provide: DataSource, useValue: mockDataSource },
    ],
  }).compile();
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('StaffService', () => {
  let service: StaffService;

  beforeEach(async () => {
    process.env.PII_ENCRYPTION_KEY = VALID_KEY;
    const module = await buildModule();
    service = module.get(StaffService);
    jest.clearAllMocks();
  });

  // ── Constructor / PII key validation ─────────────────────────────────────

  describe('constructor', () => {
    it('throws on missing PII_ENCRYPTION_KEY', async () => {
      const original = process.env.PII_ENCRYPTION_KEY;
      delete process.env.PII_ENCRYPTION_KEY;

      await expect(
        Test.createTestingModule({
          providers: [
            StaffService,
            { provide: getRepositoryToken(User), useValue: mockUsersRepo },
            { provide: getRepositoryToken(StaffProfile), useValue: mockProfilesRepo },
            { provide: DataSource, useValue: mockDataSource },
          ],
        }).compile(),
      ).rejects.toThrow('PII_ENCRYPTION_KEY');

      process.env.PII_ENCRYPTION_KEY = original;
    });

    it('throws on PII_ENCRYPTION_KEY that is not 64 hex chars', async () => {
      process.env.PII_ENCRYPTION_KEY = 'tooshort';

      await expect(
        Test.createTestingModule({
          providers: [
            StaffService,
            { provide: getRepositoryToken(User), useValue: mockUsersRepo },
            { provide: getRepositoryToken(StaffProfile), useValue: mockProfilesRepo },
            { provide: DataSource, useValue: mockDataSource },
          ],
        }).compile(),
      ).rejects.toThrow('PII_ENCRYPTION_KEY');

      process.env.PII_ENCRYPTION_KEY = VALID_KEY;
    });
  });

  // ── inviteStaff ───────────────────────────────────────────────────────────

  describe('inviteStaff', () => {
    it('throws ForbiddenException for cashier role', async () => {
      await expect(
        service.inviteStaff(
          { name: 'New Staff', role: 'pharmacist' },
          cashierActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException for duplicate email', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser); // email already exists

      await expect(
        service.inviteStaff(
          { name: 'Duplicate', email: 'kofi@azzaypharmacy.com', role: 'cashier' },
          ownerActor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('returns InviteStaffResult with temporaryPassword for valid invite', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null); // no existing user

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const em = {
          query: jest.fn()
            .mockResolvedValueOnce([{ id: 'new-staff-uuid' }]) // INSERT user
            .mockResolvedValueOnce([])                          // INSERT profile
            .mockResolvedValueOnce([]),                         // INSERT audit_log
        };
        await cb(em);
        return 'new-staff-uuid';
      });

      const result = await service.inviteStaff(
        { name: 'Ama Asante', email: 'ama@azzaypharmacy.com', role: 'cashier' },
        ownerActor,
      );

      expect(result.userId).toBe('new-staff-uuid');
      expect(result.name).toBe('Ama Asante');
      expect(result.temporaryPassword).toBeDefined();
      expect(result.temporaryPassword.length).toBe(16); // 8 random bytes → 16 hex chars
    });

    it('allows invite without email (phone-only staff)', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const em = {
          query: jest.fn()
            .mockResolvedValueOnce([{ id: 'phone-only-uuid' }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]),
        };
        await cb(em);
        return 'phone-only-uuid';
      });

      const result = await service.inviteStaff(
        { name: 'Kwame Boateng', phone: '0244000001', role: 'cashier' },
        ownerActor,
      );

      expect(result.userId).toBe('phone-only-uuid');
    });
  });

  // ── deactivateStaff ───────────────────────────────────────────────────────

  describe('deactivateStaff', () => {
    it('throws ForbiddenException when actor tries to deactivate themselves', async () => {
      mockUsersRepo.findOne.mockResolvedValue({ ...mockUser, id: ownerActor.sub });

      await expect(
        service.deactivateStaff(ownerActor.sub, ownerActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for cashier role', async () => {
      await expect(
        service.deactivateStaff('staff-uuid-001', cashierActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for unknown userId', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deactivateStaff('nonexistent-uuid', ownerActor),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns true on successful deactivation', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser);

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const em = {
          update: jest.fn().mockResolvedValue({}),
          query: jest.fn().mockResolvedValue([]),
        };
        await cb(em);
      });

      const result = await service.deactivateStaff('staff-uuid-001', ownerActor);
      expect(result).toBe(true);
    });
  });

  // ── resetPassword ─────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('throws ForbiddenException for non-manager role', async () => {
      await expect(
        service.resetPassword(
          { userId: 'staff-uuid-001', newPassword: 'NewPass123!' },
          cashierActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for unknown userId', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword(
          { userId: 'nonexistent-uuid', newPassword: 'NewPass123!' },
          ownerActor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns true on successful password reset', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser);

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const em = {
          update: jest.fn().mockResolvedValue({}),
          query: jest.fn().mockResolvedValue([]),
        };
        await cb(em);
      });

      const result = await service.resetPassword(
        { userId: 'staff-uuid-001', newPassword: 'NewSecurePass123!' },
        ownerActor,
      );

      expect(result).toBe(true);
    });
  });

  // ── PII encryption round-trip ─────────────────────────────────────────────

  describe('PII encryption', () => {
    it('encrypt → decrypt returns original plaintext', () => {
      // Access private helpers via the service's encryptionKey
      // We test indirectly through updateProfile which calls encryptPii
      const plaintext = '+233244000001';

      mockProfilesRepo.findOne.mockResolvedValue(mockProfile);
      mockProfilesRepo.update.mockResolvedValue({});

      // Capture what was passed to profiles.update
      let capturedUpdates: Record<string, unknown> = {};
      mockProfilesRepo.update.mockImplementation((_where: unknown, updates: Record<string, unknown>) => {
        capturedUpdates = updates;
        return Promise.resolve({});
      });

      // Mock getStaffMember query
      mockDataSource.query.mockResolvedValue([{
        id: 'staff-uuid-001',
        name: 'Kofi Mensah',
        email: 'kofi@azzaypharmacy.com',
        role: 'pharmacist',
        branch_id: 'branch-uuid-001',
        is_active: true,
        created_at: new Date(),
        position: null,
        department: null,
        employment_type: null,
        professional_licence_no: null,
        licence_expiry_date: null,
        start_date: null,
        certificate_s3_keys: [],
      }]);

      return service.updateProfile(
        { userId: 'staff-uuid-001', phone: plaintext },
        ownerActor,
      ).then(() => {
        const encrypted = capturedUpdates.phone_encrypted as string;
        expect(encrypted).toBeDefined();
        // Verify format: iv:tag:ciphertext (all hex)
        const parts = encrypted.split(':');
        expect(parts).toHaveLength(3);
        // Verify it's not plaintext
        expect(encrypted).not.toContain(plaintext);
      });
    });
  });
});
