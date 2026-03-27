import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Current usage counters for the active subscription period' })
export class SubscriptionUsageSnapshot {
  @Field(() => Int) branches!: number;
  @Field(() => Int) users!: number;
  @Field(() => Int) products!: number;
  @Field(() => Int) sales!: number;
}

@ObjectType({ description: 'Tier limits applied to the organization' })
export class SubscriptionLimitSnapshot {
  @Field(() => Int) branches!: number;
  @Field(() => Int) users!: number;
  @Field(() => Int) products!: number;
  @Field(() => Int) sales!: number;
}

@ObjectType({ description: 'Organization subscription overview for billing and plan UI' })
export class SubscriptionOverview {
  @Field() tier!: string;
  @Field() status!: string;
  @Field() currentPeriodStart!: Date;
  @Field() currentPeriodEnd!: Date;
  @Field() cancelAtPeriodEnd!: boolean;
  @Field(() => SubscriptionUsageSnapshot) usage!: SubscriptionUsageSnapshot;
  @Field(() => SubscriptionLimitSnapshot) limits!: SubscriptionLimitSnapshot;
}
