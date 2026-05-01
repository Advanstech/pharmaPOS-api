import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ObjectType, Field, InputType } from '@nestjs/graphql';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser, JwtUser } from './decorators/current-user.decorator';

type BranchRow = {
  id: string;
  organization_id: string;
  name: string;
  type: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

@ObjectType({ description: 'A branch of the organization' })
export class BranchOutput {
  @Field(() => ID) id!: string;
  @Field(() => ID) organizationId!: string;
  @Field() name!: string;
  @Field() type!: string;
  @Field({ nullable: true }) address?: string;
  @Field({ nullable: true }) phone?: string;
  @Field() isActive!: boolean;
  @Field() createdAt!: Date;
  @Field() updatedAt!: Date;
}

@InputType()
class CreateBranchInput {
  @Field() name!: string;
  @Field() type!: string;
  @Field({ nullable: true }) address?: string;
  @Field({ nullable: true }) phone?: string;
}

@InputType()
class UpdateBranchInput {
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) type?: string;
  @Field({ nullable: true }) address?: string;
  @Field({ nullable: true }) phone?: string;
}

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchesResolver {
  constructor(private readonly dataSource: DataSource) {}

  private toOutput(r: BranchRow): BranchOutput {
    return {
      id: r.id,
      organizationId: r.organization_id,
      name: r.name,
      type: r.type,
      address: r.address ?? undefined,
      phone: r.phone ?? undefined,
      isActive: r.is_active,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    };
  }

  private async getActorOrgId(actor: JwtUser): Promise<string> {
    const [branch] = (await this.dataSource.query(
      `SELECT organization_id FROM branches WHERE id = $1`,
      [actor.branchId],
    )) as Array<{ organization_id: string }>;
    if (!branch?.organization_id) {
      throw new ForbiddenException('Could not resolve organization for current branch context');
    }
    return branch.organization_id;
  }

  private normalizeBranchType(type: string): 'pharmaceutical' | 'chemical' {
    const t = type.trim().toLowerCase();
    if (t !== 'pharmaceutical' && t !== 'chemical') {
      throw new BadRequestException("Branch type must be either 'pharmaceutical' or 'chemical'");
    }
    return t;
  }

  @Query(() => [BranchOutput], { name: 'branches', description: 'List all active branches in the organization' })
  @Roles('owner', 'se_admin', 'manager')
  async listBranches(@CurrentUser() actor: JwtUser): Promise<BranchOutput[]> {
    const organizationId = await this.getActorOrgId(actor);

    const rows = (await this.dataSource.query(
      `SELECT DISTINCT ON (LOWER(TRIM(name)), type)
          id, organization_id, name, type, address, phone, is_active, created_at, updated_at
       FROM branches
       WHERE organization_id = $1 AND is_active = true
       ORDER BY LOWER(TRIM(name)), type, updated_at DESC`,
      [organizationId],
    )) as BranchRow[];

    return rows.map((r) => this.toOutput(r));
  }

  @Query(() => [BranchOutput], {
    name: 'branchesAdmin',
    description: 'List organization branches for branch management (optionally include inactive)',
  })
  @Roles('owner', 'se_admin', 'manager')
  async listBranchesAdmin(
    @CurrentUser() actor: JwtUser,
    @Args('includeInactive', { nullable: true, defaultValue: true }) includeInactive?: boolean,
  ): Promise<BranchOutput[]> {
    const organizationId = await this.getActorOrgId(actor);
    const rows = (await this.dataSource.query(
      `SELECT id, organization_id, name, type, address, phone, is_active, created_at, updated_at
       FROM branches
       WHERE organization_id = $1
         AND ($2::boolean = true OR is_active = true)
       ORDER BY is_active DESC, name ASC, created_at DESC`,
      [organizationId, includeInactive ?? true],
    )) as BranchRow[];

    return rows.map((r) => this.toOutput(r));
  }

  @Mutation(() => BranchOutput, { name: 'createBranch' })
  @Roles('owner', 'se_admin', 'manager')
  async createBranch(
    @CurrentUser() actor: JwtUser,
    @Args('input') input: CreateBranchInput,
  ): Promise<BranchOutput> {
    const organizationId = await this.getActorOrgId(actor);
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('Branch name is required');

    const type = this.normalizeBranchType(input.type);
    const [row] = (await this.dataSource.query(
      `INSERT INTO branches (
         id, organization_id, name, type, address, phone, is_active, created_at, updated_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW()
       )
       RETURNING id, organization_id, name, type, address, phone, is_active, created_at, updated_at`,
      [organizationId, name, type, input.address?.trim() || null, input.phone?.trim() || null],
    )) as BranchRow[];

    return this.toOutput(row);
  }

  @Mutation(() => BranchOutput, { name: 'updateBranch' })
  @Roles('owner', 'se_admin', 'manager')
  async updateBranch(
    @CurrentUser() actor: JwtUser,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateBranchInput,
  ): Promise<BranchOutput> {
    const organizationId = await this.getActorOrgId(actor);
    const [existing] = (await this.dataSource.query(
      `SELECT id, organization_id, name, type, address, phone, is_active, created_at, updated_at
       FROM branches
       WHERE id = $1 AND organization_id = $2`,
      [id, organizationId],
    )) as BranchRow[];

    if (!existing) throw new BadRequestException('Branch not found');

    const nextName = input.name?.trim() || existing.name;
    const nextType = input.type ? this.normalizeBranchType(input.type) : existing.type;
    const nextAddress = input.address !== undefined ? (input.address?.trim() || null) : existing.address;
    const nextPhone = input.phone !== undefined ? (input.phone?.trim() || null) : existing.phone;

    const [updated] = (await this.dataSource.query(
      `UPDATE branches
       SET name = $1, type = $2, address = $3, phone = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, organization_id, name, type, address, phone, is_active, created_at, updated_at`,
      [nextName, nextType, nextAddress, nextPhone, id],
    )) as BranchRow[];

    return this.toOutput(updated);
  }

  @Mutation(() => Boolean, { name: 'deactivateBranch' })
  @Roles('owner', 'se_admin', 'manager')
  async deactivateBranch(
    @CurrentUser() actor: JwtUser,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    const organizationId = await this.getActorOrgId(actor);

    if (id === actor.branchId) {
      throw new BadRequestException('You cannot deactivate your currently active branch context');
    }

    const [target] = (await this.dataSource.query(
      `SELECT id, is_active FROM branches WHERE id = $1 AND organization_id = $2`,
      [id, organizationId],
    )) as Array<{ id: string; is_active: boolean }>;

    if (!target) throw new BadRequestException('Branch not found');
    if (!target.is_active) return true;

    const [activeCount] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM branches WHERE organization_id = $1 AND is_active = true`,
      [organizationId],
    )) as Array<{ count: number }>;

    if (Number(activeCount?.count ?? 0) <= 1) {
      throw new BadRequestException('Cannot deactivate the last active branch');
    }

    await this.dataSource.query(
      `UPDATE branches SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id],
    );

    return true;
  }

  @Mutation(() => Boolean, { name: 'reactivateBranch' })
  @Roles('owner', 'se_admin', 'manager')
  async reactivateBranch(
    @CurrentUser() actor: JwtUser,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    const organizationId = await this.getActorOrgId(actor);

    const [target] = (await this.dataSource.query(
      `SELECT id FROM branches WHERE id = $1 AND organization_id = $2`,
      [id, organizationId],
    )) as Array<{ id: string }>;

    if (!target) throw new BadRequestException('Branch not found');

    await this.dataSource.query(
      `UPDATE branches SET is_active = true, updated_at = NOW() WHERE id = $1`,
      [id],
    );

    return true;
  }
}
