import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';

@ObjectType({
  description:
    'Revenue report for a date range. All monetary values in GHS pesewas. ' +
    'Used for Ghana GRA monthly VAT returns (due 30th of following month).',
})
export class RevenueReport {
  @Field({ description: 'Report period start date. ISO 8601. Example: `"2026-03-01"`' })
  periodStart!: string;

  @Field({ description: 'Report period end date. ISO 8601. Example: `"2026-03-31"`' })
  periodEnd!: string;

  @Field(() => Int, { description: 'Total revenue in GHS pesewas (all completed sales, excl. refunds)' })
  totalRevenuePesewas!: number;

  @Field({ description: 'Formatted total revenue. Example: `"GH₵42,500.00"`' })
  totalRevenueFormatted!: string;

  @Field(() => Int, {
    description:
      'Total VAT collected in GHS pesewas. ' +
      'Ghana GRA: 15% on non-exempt items (12.5% VAT + 2.5% NHIL). ' +
      'Prescription medicines are VAT-exempt.',
  })
  vatCollectedPesewas!: number;

  @Field({ description: 'Formatted VAT collected. Example: `"GH₵5,625.00"`' })
  vatFormatted!: string;

  @Field(() => Int, { description: 'Total number of completed sales in the period' })
  salesCount!: number;

  @Field(() => Float, {
    description: 'Average sale value in GHS (not pesewas). Example: `42.50`',
  })
  averageSaleGhs!: number;

  @Field(() => Int, {
    description: 'Total refunds issued in GHS pesewas (negative impact on revenue)',
  })
  refundsPesewas!: number;
}

@ObjectType({ description: 'A product ranked by sales volume or revenue in a given period' })
export class TopProduct {
  @Field(() => ID, { description: 'UUID of the product' })
  productId!: string;

  @Field({ description: 'Product name' })
  productName!: string;

  @Field(() => Int, { description: 'Total units sold in the period' })
  unitsSold!: number;

  @Field(() => Int, { description: 'Total revenue from this product in GHS pesewas' })
  revenuePesewas!: number;

  @Field({ description: 'Formatted revenue. Example: `"GH₵8,750.00"`' })
  revenueFormatted!: string;
}

@ObjectType({
  description:
    'Real-time KPI snapshot for the dashboard. ' +
    'Scoped to the authenticated user\'s branch (managers see own branch; owners see all branches). ' +
    'All monetary values in GHS pesewas.',
})
export class DashboardKpis {
  @Field(() => Int, {
    description: 'Revenue earned today (midnight to now, Africa/Accra timezone) in GHS pesewas',
  })
  todayRevenuePesewas!: number;

  @Field({ description: 'Formatted today\'s revenue. Example: `"GH₵4,250.00"`' })
  todayRevenueFormatted!: string;

  @Field(() => Int, { description: 'Number of completed sales today' })
  todaySalesCount!: number;

  @Field(() => Int, {
    description: 'Revenue earned this calendar month in GHS pesewas',
  })
  monthRevenuePesewas!: number;

  @Field({ description: 'Formatted month-to-date revenue. Example: `"GH₵87,300.00"`' })
  monthRevenueFormatted!: string;

  @Field(() => Int, { description: 'Number of completed sales this month' })
  monthSalesCount!: number;

  @Field(() => Int, {
    description:
      'Number of products currently at or below their reorder level. ' +
      'Drives the low-stock badge on the dashboard.',
  })
  lowStockCount!: number;

  @Field(() => Int, { description: 'Number of active (non-deactivated) staff accounts at this branch' })
  activeStaffCount!: number;

  @Field(() => Float, {
    description:
      'Month-over-month revenue change as a percentage. ' +
      'Positive = growth, negative = decline. Example: `12.5` means +12.5% vs last month.',
  })
  revenueDeltaPct!: number;
}


// ── Enhanced Report Types ─────────────────────────────────────────────────────

@ObjectType({ description: 'Daily revenue data point for trend charts' })
export class DailyRevenuePoint {
  @Field() date!: string;
  @Field(() => Int) revenuePesewas!: number;
  @Field() revenueFormatted!: string;
  @Field(() => Int) salesCount!: number;
  @Field(() => Int) refundsPesewas!: number;
}

@ObjectType({ description: 'Hourly sales distribution for heatmap' })
export class HourlySalesPoint {
  @Field(() => Int) hour!: number;
  @Field(() => Int) salesCount!: number;
  @Field(() => Int) revenuePesewas!: number;
}

@ObjectType({ description: 'Sales breakdown by product classification' })
export class CategoryBreakdown {
  @Field() classification!: string;
  @Field(() => Int) revenuePesewas!: number;
  @Field() revenueFormatted!: string;
  @Field(() => Int) salesCount!: number;
  @Field(() => Int) unitsSold!: number;
}

@ObjectType({ description: 'Payment method breakdown' })
export class PaymentMethodBreakdown {
  @Field() method!: string;
  @Field(() => Int) count!: number;
  @Field(() => Int) totalPesewas!: number;
  @Field() totalFormatted!: string;
}

@ObjectType({ description: 'Staff performance ranking' })
export class StaffPerformance {
  @Field(() => ID) staffId!: string;
  @Field() staffName!: string;
  @Field(() => Int) salesCount!: number;
  @Field(() => Int) revenuePesewas!: number;
  @Field() revenueFormatted!: string;
  @Field(() => Float) averageSaleGhs!: number;
}
