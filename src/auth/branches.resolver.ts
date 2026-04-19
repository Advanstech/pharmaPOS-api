import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ObjectType, Field } from '@nestjs/graphql';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser, JwtUser } from './decorators/current-user.decorator';

@ObjectType({ description: 'A branch of the organization' })
export class BranchOutput {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field() type!: string;
  @Field({ nullable: true }) address?: string;
  @Field({ nullable: true }) phone?: string;
  @Field() isActive!: boolean;
}

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchesResolver {
  constructor(private readonly dataSource: DataSource) {}

  @Query(() => [BranchOutput], { name: 'branches', description: 'List all active branches in the organization' })
  @Roles('owner', 'se_admin', 'manager')
  async listBranches(@CurrentUser() actor: JwtUser): Promise<BranchOutput[]> {
    const [branch] = await this.dataSource.query(
      `SELECT organization_id FROM branches WHERE id = $1`, [actor.branchId],
    ) as Array<{ organization_id: string }>;

    if (!branch) return [];

    const rows = await this.dataSource.query(
      `SELECT id, name, type, address, phone, is_active
       FROM branches WHERE organization_id = $1 AND is_active = true
       ORDER BY name`, [branch.organization_id],
    ) as Array<{ id: string; name: string; type: string; address: string; phone: string; is_active: boolean }>;

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      address: r.address || undefined,
      phone: r.phone || undefined,
      isActive: r.is_active,
    }));
  }
}
