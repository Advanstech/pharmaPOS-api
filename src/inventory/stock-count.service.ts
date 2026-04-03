import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { RealtimeStockService } from './realtime-stock.service';

export interface StockCountItem {
  productId: string;
  productName: string;
  expectedQuantity: number;
  countedQuantity: number;
  variance: number;
  unitCostPesewas?: number;
}

export interface StockCountSession {
  id: string;
  branchId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  countedBy: string;
  reviewedBy?: string;
  totalItems: number;
  totalVariance: number;
  totalValueVariance: number;
  notes?: string;
}

export interface CreateStockCountInput {
  productIds?: string[]; // If empty, count all products
  notes?: string;
}

export interface UpdateStockCountInput {
  sessionId: string;
  counts: Array<{
    productId: string;
    countedQuantity: number;
  }>;
}

export interface CompleteStockCountInput {
  sessionId: string;
  notes?: string;
}

@Injectable()
export class StockCountService {
  private readonly logger = new Logger(StockCountService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly realtimeStock: RealtimeStockService,
  ) {}

  async createStockCount(input: CreateStockCountInput, actor: JwtUser): Promise<StockCountSession> {
    const [session] = await this.dataSource.query(
      `
      INSERT INTO stock_count_sessions (id, branch_id, status, started_at, counted_by, notes)
      VALUES (gen_random_uuid(), $1, 'pending', NOW(), $2, $3)
      RETURNING id, branch_id, status, started_at, counted_by, notes
    `,
      [actor.branchId, actor.sub, input.notes ?? null],
    ) as Array<StockCountSession>;

    // If specific products selected, add them. Otherwise add all active products with inventory
    if (input.productIds && input.productIds.length > 0) {
      await this.dataSource.query(
        `
        INSERT INTO stock_count_items (id, session_id, product_id, expected_quantity)
        SELECT gen_random_uuid(), $1, p.id, COALESCE(inv.quantity_on_hand, 0)
        FROM products p
        LEFT JOIN inventory inv ON inv.product_id = p.id AND inv.branch_id = $2
        WHERE p.id = ANY($3) AND p.is_active = true
      `,
        [session.id, actor.branchId, input.productIds],
      );
    } else {
      await this.dataSource.query(
        `
        INSERT INTO stock_count_items (id, session_id, product_id, expected_quantity)
        SELECT gen_random_uuid(), $1, p.id, COALESCE(inv.quantity_on_hand, 0)
        FROM products p
        LEFT JOIN inventory inv ON inv.product_id = p.id AND inv.branch_id = $2
        WHERE p.is_active = true
      `,
        [session.id, actor.branchId],
      );
    }

    const [counts] = await this.dataSource.query(
      `SELECT COUNT(*) as total FROM stock_count_items WHERE session_id = $1`,
      [session.id],
    ) as Array<{ total: number }>;

    session.totalItems = parseInt(counts.total as unknown as string, 10);
    session.status = 'in_progress';

    await this.dataSource.query(
      `UPDATE stock_count_sessions SET status = 'in_progress' WHERE id = $1`,
      [session.id],
    );

    this.logger.log(`Stock count session created: ${session.id} for branch ${actor.branchId}`);
    return session;
  }

  async updateStockCounts(input: UpdateStockCountInput, actor: JwtUser): Promise<StockCountItem[]> {
    const [session] = await this.dataSource.query(
      `SELECT * FROM stock_count_sessions WHERE id = $1 AND branch_id = $2`,
      [input.sessionId, actor.branchId],
    ) as Array<StockCountSession>;

    if (!session) {
      throw new NotFoundException(`Stock count session ${input.sessionId} not found`);
    }

    if (session.status !== 'in_progress') {
      throw new BadRequestException(`Cannot update counts for session with status: ${session.status}`);
    }

    for (const count of input.counts) {
      await this.dataSource.query(
        `
        UPDATE stock_count_items 
        SET counted_quantity = $1, variance = $1 - expected_quantity, updated_at = NOW()
        WHERE session_id = $2 AND product_id = $3
      `,
        [count.countedQuantity, input.sessionId, count.productId],
      );
    }

    return this.getStockCountItems(input.sessionId);
  }

  async completeStockCount(input: CompleteStockCountInput, actor: JwtUser): Promise<StockCountSession> {
    const [session] = await this.dataSource.query(
      `SELECT * FROM stock_count_sessions WHERE id = $1 AND branch_id = $2`,
      [input.sessionId, actor.branchId],
    ) as Array<StockCountSession>;

    if (!session) {
      throw new NotFoundException(`Stock count session ${input.sessionId} not found`);
    }

    if (session.status !== 'in_progress') {
      throw new BadRequestException(`Cannot complete session with status: ${session.status}`);
    }

    // Calculate variances and value impact
    const variances = await this.dataSource.query(
      `
      SELECT 
        sci.product_id,
        sci.variance,
        COALESCE(pch.unit_cost_pesewas, 0) as unit_cost
      FROM stock_count_items sci
      LEFT JOIN LATERAL (
        SELECT unit_cost_pesewas
        FROM product_cost_history
        WHERE product_id = sci.product_id
        ORDER BY observed_at DESC
        LIMIT 1
      ) pch ON true
      WHERE sci.session_id = $1 AND sci.variance != 0
    `,
      [input.sessionId],
    ) as Array<{ product_id: string; variance: number; unit_cost: number }>;

    const totalVariance = variances.reduce((sum, v) => sum + v.variance, 0);
    const totalValueVariance = variances.reduce((sum, v) => sum + v.variance * v.unit_cost, 0);

    await this.dataSource.transaction(async (em) => {
      // Adjust inventory for variances
      for (const v of variances) {
        if (v.variance !== 0) {
          await em.query(
            `
            UPDATE inventory 
            SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
            WHERE product_id = $2 AND branch_id = $3
          `,
            [v.variance, v.product_id, actor.branchId],
          );

          // Record stock movement for adjustment
          await em.query(
            `
            INSERT INTO stock_movements (
              id, product_id, branch_id, quantity, movement_type, 
              reference_id, performed_by, notes
            )
            VALUES (gen_random_uuid(), $1, $2, $3, 'STOCK_COUNT_ADJUSTMENT', $4, $5, $6)
          `,
            [
              v.product_id,
              actor.branchId,
              v.variance,
              input.sessionId,
              actor.sub,
              `Stock count variance adjustment: ${v.variance}`,
            ],
          );

          // Publish real-time update
          this.realtimeStock.publishStockChanged({
            branchId: actor.branchId,
            productId: v.product_id,
            quantityOnHand: 0, // Will be fetched by subscriber
            reorderLevel: 10,
          });
        }
      }

      // Complete session
      await em.query(
        `
        UPDATE stock_count_sessions 
        SET status = 'completed', 
            completed_at = NOW(), 
            reviewed_by = $1,
            total_variance = $2,
            total_value_variance = $3,
            notes = COALESCE($4, notes)
        WHERE id = $5
      `,
        [actor.sub, totalVariance, totalValueVariance, input.notes ?? null, input.sessionId],
      );

      // Audit log
      await em.query(
        `
        INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
        VALUES (gen_random_uuid(), $1, $2, 'STOCK_COUNT_COMPLETED', 'stock_count', $3, $4)
      `,
        [
          actor.branchId,
          actor.sub,
          input.sessionId,
          JSON.stringify({
            total_variance: totalVariance,
            total_value_variance: totalValueVariance,
            items_adjusted: variances.length,
          }),
        ],
      );
    });

    const [completed] = await this.dataSource.query(
      `SELECT * FROM stock_count_sessions WHERE id = $1`,
      [input.sessionId],
    ) as Array<StockCountSession>;

    this.logger.log(`Stock count completed: ${input.sessionId} with variance ${totalVariance}`);
    return completed;
  }

  async getStockCountSession(sessionId: string): Promise<StockCountSession | null> {
    const [session] = await this.dataSource.query(
      `SELECT * FROM stock_count_sessions WHERE id = $1`,
      [sessionId],
    ) as Array<StockCountSession>;
    return session || null;
  }

  async getStockCountItems(sessionId: string): Promise<StockCountItem[]> {
    const rows = await this.dataSource.query(
      `
      SELECT 
        sci.product_id,
        p.name as product_name,
        sci.expected_quantity,
        sci.counted_quantity,
        sci.variance,
        COALESCE(pch.unit_cost_pesewas, 0) as unit_cost_pesewas
      FROM stock_count_items sci
      JOIN products p ON p.id = sci.product_id
      LEFT JOIN LATERAL (
        SELECT unit_cost_pesewas
        FROM product_cost_history
        WHERE product_id = sci.product_id
        ORDER BY observed_at DESC
        LIMIT 1
      ) pch ON true
      WHERE sci.session_id = $1
      ORDER BY sci.created_at
    `,
      [sessionId],
    ) as Array<{
      product_id: string;
      product_name: string;
      expected_quantity: number;
      counted_quantity: number | null;
      variance: number | null;
      unit_cost_pesewas: number;
    }>;

    return rows.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      expectedQuantity: r.expected_quantity,
      countedQuantity: r.counted_quantity ?? 0,
      variance: r.variance ?? 0,
      unitCostPesewas: r.unit_cost_pesewas,
    }));
  }

  async listStockCounts(branchId: string, limit = 20): Promise<StockCountSession[]> {
    return this.dataSource.query(
      `
      SELECT * FROM stock_count_sessions 
      WHERE branch_id = $1 
      ORDER BY started_at DESC 
      LIMIT $2
    `,
      [branchId, limit],
    ) as Promise<StockCountSession[]>;
  }

  async cancelStockCount(sessionId: string, actor: JwtUser): Promise<boolean> {
    const [session] = await this.dataSource.query(
      `SELECT * FROM stock_count_sessions WHERE id = $1 AND branch_id = $2`,
      [sessionId, actor.branchId],
    ) as Array<StockCountSession>;

    if (!session) {
      throw new NotFoundException(`Stock count session ${sessionId} not found`);
    }

    if (!['pending', 'in_progress'].includes(session.status)) {
      throw new BadRequestException(`Cannot cancel session with status: ${session.status}`);
    }

    await this.dataSource.query(
      `UPDATE stock_count_sessions SET status = 'cancelled' WHERE id = $1`,
      [sessionId],
    );

    this.logger.log(`Stock count cancelled: ${sessionId} by ${actor.sub}`);
    return true;
  }
}
