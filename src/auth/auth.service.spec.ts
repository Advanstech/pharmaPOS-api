import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { SalesEffectiveAtService } from '../sales/sales-effective-at.service';

// ── Shared mocks ──────────────────────────────────────────────────────────

const mockUser: User = {
  id: 'user-uuid-001',
  branch_id: 'branch-uuid-001',
  name: 'Ama Owusu',
  email: 'ama@azzaypharmacy.com',
  phone: undefined,
  role: 'cashier',
  password_hash: '',
  mfa_enabled: false,
  is_active: true,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

const mockBranch = [{ id: 'branch-uuid-001', type: 'pharmaceutical' as const }];
const mockSession = [{ id: 'session-uuid-001' }];

const mockUsersRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockDataSource = {
  query: jest.fn(),
  transaction: jest.fn(),
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn(),
};

const mockConfig = {
  getOrThrow: jest.fn().mockReturnValue('test-secret-32-chars-minimum-len'),
};

const mockEffectiveSaleAt = {
  sql: jest.fn().mockReturnValue('COALESCE(s.sold_at, s.created_at)'),
};

async function buildModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      AuthService,
      { provide: getRepositoryToken(User), useValue: mockUsersRepo },
      { provide: JwtService, useValue: mockJwt },
      { provide: ConfigService, useValue: mockConfig },
      { provide: DataSource, useValue: mockDataSource },
      { provide: SalesEffectiveAtService, useValue: mockEffectiveSaleAt },
    ],
  }).compile();
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await buildModule();
    service = module.get(AuthService);
    jest.clearAllMocks();
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns AuthPayload with tokens on valid credentials', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockUsersRepo.findOne.mockResolvedValue({ ...mockUser, password_hash: hash });
      mockDataSource.query
        .mockResolvedValueOnce(mockBranch)   // branch lookup
        .mockResolvedValueOnce(mockSession) // createSession
        .mockResolvedValueOnce([]); // staff_sessions insert

      const result = await service.login({ email: 'ama@azzaypharmacy.com', password: 'password123' });

      expect(result.access_token).toBe('mock.jwt.token');
      expect(result.refresh_token).toBe('mock.jwt.token');
      expect(result.expires_in).toBe(900);
      expect(result.user.id).toBe('user-uuid-001');
    });

    it('throws UnauthorizedException for unknown email', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nobody@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('correct-password', 10);
      mockUsersRepo.findOne.mockResolvedValue({ ...mockUser, password_hash: hash });
      await expect(
        service.login({ email: 'ama@azzaypharmacy.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws NotFoundException when branch not found', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockUsersRepo.findOne.mockResolvedValue({ ...mockUser, password_hash: hash });
      mockDataSource.query.mockResolvedValueOnce([]); // empty branch result
      await expect(
        service.login({ email: 'ama@azzaypharmacy.com', password: 'password123' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('error message does not reveal whether email exists (user enumeration prevention)', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);
      try {
        await service.login({ email: 'nobody@test.com', password: 'pass' });
      } catch (err) {
        expect((err as Error).message).toBe('Invalid credentials');
      }
    });
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates user and returns AuthPayload', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null); // no existing user
      mockUsersRepo.create.mockReturnValue(mockUser);
      mockUsersRepo.save.mockResolvedValue(mockUser);
      mockDataSource.query
        .mockResolvedValueOnce(mockBranch)
        .mockResolvedValueOnce(mockSession)
        .mockResolvedValueOnce([]);

      const result = await service.register({
        branch_id: 'branch-uuid-001',
        name: 'Ama Owusu',
        email: 'ama@azzaypharmacy.com',
        password: 'securepass123',
        role: 'cashier',
      });

      expect(result.user.id).toBe('user-uuid-001');
      expect(mockUsersRepo.save).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException when email already registered', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser);
      await expect(
        service.register({
          branch_id: 'branch-uuid-001',
          name: 'Duplicate',
          email: 'ama@azzaypharmacy.com',
          password: 'pass12345',
          role: 'cashier',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── refreshToken ──────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('returns new AuthPayload for valid refresh token', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'user-uuid-001', sessionId: 'session-uuid-001', type: 'refresh' });
      mockDataSource.query
        .mockResolvedValueOnce(mockSession)  // session check
        .mockResolvedValueOnce([]) // touch staff_sessions
        .mockResolvedValueOnce(mockBranch); // branch lookup
      mockUsersRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.refreshToken('valid.refresh.token');
      expect(result.access_token).toBe('mock.jwt.token');
    });

    it('throws UnauthorizedException for invalid token', async () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('jwt expired'); });
      await expect(service.refreshToken('bad.token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when token type is not refresh', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'user-uuid-001', sessionId: 'session-uuid-001', type: 'access' });
      await expect(service.refreshToken('access.token.used.as.refresh')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when session has expired', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'user-uuid-001', sessionId: 'session-uuid-001', type: 'refresh' });
      mockDataSource.query.mockResolvedValueOnce([]); // no active session
      await expect(service.refreshToken('valid.refresh.token')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('ends staff session row, deletes session, and returns true', async () => {
      mockDataSource.query.mockResolvedValue([]);
      const result = await service.logout({
        sub: 'user-uuid-001',
        role: 'cashier',
        branchId: 'branch-uuid-001',
        branchType: 'pharmaceutical',
        sessionId: 'session-uuid-001',
      });
      expect(result).toBe(true);
      expect(mockDataSource.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('UPDATE staff_sessions'),
        ['session-uuid-001'],
      );
      expect(mockDataSource.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('DELETE FROM sessions'),
        ['session-uuid-001'],
      );
    });
  });

  // ── me ────────────────────────────────────────────────────────────────────

  describe('me', () => {
    it('returns user for valid userId', async () => {
      mockUsersRepo.findOne.mockResolvedValue(mockUser);
      const result = await service.me('user-uuid-001');
      expect(result.id).toBe('user-uuid-001');
    });

    it('throws NotFoundException for unknown userId', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);
      await expect(service.me('unknown-uuid')).rejects.toThrow(NotFoundException);
    });
  });
});
