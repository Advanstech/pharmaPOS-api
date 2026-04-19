import { Resolver, Query, Mutation, Args, Float, ObjectType, Field, InputType } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { TaxConfigService } from './tax-config.service';

@ObjectType()
export class TaxConfigOutput {
  @Field() branchId!: string;
  @Field(() => Float) vatRate!: number;
  @Field(() => Float) nhilRate!: number;
  @Field(() => Float) getfundRate!: number;
  @Field(() => Float) covidLevyRate!: number;
  @Field(() => Float) totalRate!: number;
  @Field() applyVatOnOtc!: boolean;
  @Field() applyVatOnPom!: boolean;
  @Field() applyVatOnControlled!: boolean;
  @Field() updatedAt!: Date;
  // Formatted for display
  @Field() vatRatePct!: string;
  @Field() nhilRatePct!: string;
  @Field() getfundRatePct!: string;
  @Field() covidLevyRatePct!: string;
  @Field() totalRatePct!: string;
}

@InputType()
export class UpdateTaxConfigInput {
  @Field(() => Float, { nullable: true }) vatRate?: number;
  @Field(() => Float, { nullable: true }) nhilRate?: number;
  @Field(() => Float, { nullable: true }) getfundRate?: number;
  @Field(() => Float, { nullable: true }) covidLevyRate?: number;
  @Field({ nullable: true }) applyVatOnOtc?: boolean;
  @Field({ nullable: true }) applyVatOnPom?: boolean;
  @Field({ nullable: true }) applyVatOnControlled?: boolean;
}

function toOutput(c: any): TaxConfigOutput {
  const pct = (r: number) => (r * 100).toFixed(2) + '%';
  return {
    ...c,
    vatRatePct: pct(c.vatRate),
    nhilRatePct: pct(c.nhilRate),
    getfundRatePct: pct(c.getfundRate),
    covidLevyRatePct: pct(c.covidLevyRate),
    totalRatePct: pct(c.totalRate),
  };
}

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaxConfigResolver {
  constructor(private readonly taxConfigService: TaxConfigService) {}

  @Query(() => TaxConfigOutput, { name: 'taxConfig' })
  @Roles('owner', 'se_admin', 'manager', 'head_pharmacist')
  async getTaxConfig(@CurrentUser() actor: JwtUser): Promise<TaxConfigOutput> {
    const config = await this.taxConfigService.getTaxConfig(actor.branchId);
    return toOutput(config);
  }

  @Mutation(() => TaxConfigOutput, { name: 'updateTaxConfig' })
  @Roles('owner', 'se_admin', 'manager')
  async updateTaxConfig(
    @Args('input') input: UpdateTaxConfigInput,
    @CurrentUser() actor: JwtUser,
  ): Promise<TaxConfigOutput> {
    const config = await this.taxConfigService.updateTaxConfig(actor.branchId, input, actor.sub);
    return toOutput(config);
  }
}
