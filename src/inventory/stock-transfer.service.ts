import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { RealtimeStockService } from './realtime-stock.service';
import {
  CreateStockTransferInput,
  StockTransferOutput,
  StockTransferItemOutput,
} from './dto/stock-transfer.types';

interface TransferRow {
  id: string;
  from_branch_id: string;
  from_branch_name: string;
  to_branch_id: string;
  to_branch_name: string;
  status: string;
  notes: string | null;
  created_by: string;
  created_by_name: string;
  approved_by: string | null;
  approved_by_name: string | null;
  received_by: string | null;
  received_by_name: string | null;
  created_at: Date;
  approved_at: Date | null;
  received_at: Date | null;
}

interface TransferItemRow {
  product_id: string;
  product_name: string;
  quantity: number;
  received_quantity: number | null;
}

@Injectable()
export class StockTransferService {
  private readonly logger = new Logger(StockTransferService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly realtimeStock: RealtimeStockService,
  ) {}

  /**
   * Create a stock transfer request from current branch to another.
   * Validates stock availability. Status starts as PENDING.
   */
  async createTransfer(input: CreateStockTransferInput, actor: JwtUser): Promise<StockTransferOutput> {
    const fromBranchId = actor.branchId;

    if (fromBranchId === input.toBranchId) {
      throw new BadRequestException('Cannot transfer stock to the same branch');
    }

    // Verify destination branch exists and is in same org
    const [destBranch] = await this.dataSource.query(
      `SELECT b2.id FROM branches b1
       JOIN branches b2 ON b2.organization_id = b1.organization_id
       WHERE b1.id = $1 AND b2.id = $2`,
      [fromBranchId, input.toBranchId],
    ) as Array<{ id: string }>;

    if (!destBranch) {
      throw new BadRequestException('Destination branch not found or not in your organization');
    }

    // Validate products and stock
    for (const item of input.items) {
      const [inv] = await this.dataSource.query(
        `SELECT i.quantity_on_hand, p.name FROM inventory i
         JOIN products p ON p.id = i.product_id
         WHERE i.product_id = $1 AND i.branch_id = $2`,
        [item.productId, fromBranchId],
      ) as Array<{ quantity_on_hand: number; name: string }>;

      if (!inv) {
        throw new BadRequestException('Product ' + item.productId + ' not found in your branch inventory');
      }
      if (inv.quantity_on_hand < item.quantity) {
        throw new BadRequestException(
          'Insufficient stock for ' + inv.name + ': ' + inv.quantity_on_hand + ' available, ' + item.quantity + ' requested',
        );
      }
    }

    // Create transfer + items in transaction
    const transferId = await this.dataSource.transaction(async (em) => {
      // Create transfer header
      const [transfer] = await em.query(
        `INSERT INTO stock_transfers (id, from_branch_id, to_branch_id, status, notes, created_by)
         VALUES (gen_random_uuid(), $1, $2, 'PENDING', $3, $4)
         RETURNING id`,
        [fromBranchId, input.toBranchId, input.notes || null, actor.sub],
      ) as Array<{ id: string }>;

      // Create transfer items
      for (const item of input.items) {
        await em.query(
          `INSERT INTO stock_transfer_items (id, transfer_id, product_id, quantity)
           VALUES (gen_random_uuid(), $1, $2, $3)`,
          [transfer.id, item.productId, item.quantity],
        );
      }

      // Audit log
      await em.query(
        `INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
         VALUES (gen_random_uuid(), $1, $2, 'STOCK_TRANSFER_CREATED', 'stock_transfer', $3, $4)`,
        [fromBranchId, actor.sub, transfer.id, JSON.stringify({
          toBranchId: input.toBranchId,
          itemCount: input.items.length,
          totalQuantity: input.items.reduce((s, i) => s + i.quantity, 0),
        })],
      );

      return transfer.id;
    });

    this.logger.log('Stock transfer created: ' + transferId + ' from=' + fromBranchId + ' to=' + input.toBranchId);
    return this.getTransfer(transferId);
  }

  /**
   * Approve a pending transfer. Deducts stock from source branch.
   * Only managers/owners can approve.
   */
  async approveTransfer(transferId: string, actor: JwtUser): Promise<StockTransferOutput> {
    if (!['owner', 'se_admin', 'manager'].includes(actor.role)) {
      throw new ForbiddenException('Only managers and owners can approve transfers');
    }

    const transfer = await this.getTransferRow(transferId);
    if (transfer.status !== 'PENDING') {
      throw new BadRequestException('Transfer is ' + transfer.status + ', cannot approve');
    }

    const items = await this.getTransferItems(transferId);

    // Deduct stock from source branch in transaction
    await this.dataSource.transaction(async (em) => {
      for (const item of items) {
        // Verify stock still available
        const [inv] = await em.query(
          `SELECT quantity_on_hand FROM inventory WHERE product_id = $1 AND branch_id = $2`,
          [item.product_id, transfer.from_branch_id],
        ) as Array<{ quantity_on_hand: number }>;

        if (!inv || inv.quantity_on_hand < item.quantity) {
          throw new BadRequestException('Insufficient stock for ' + item.product_name + ' — stock may have changed');
        }

        // Deduct from source
        await em.query(
          `UPDATE inventory SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW()
           WHERE product_id = $2 AND branch_id = $3`,
          [item.quantity, item.product_id, transfer.from_branch_id],
        );

        // Stock movement — TRANSFER_OUT
        await em.query(
          `INSERT INTO stock_movements (id, product_id, branch_id, quantity, movement_type, reference_id, performed_by)
           VALUES (gen_random_uuid(), $1, $2, $3, 'TRANSFER_OUT', $4, $5)`,
          [item.product_id, transfer.from_branch_id, -item.quantity, transferId, actor.sub],
        );
      }

      // Update transfer status
      await em.query(
        `UPDATE stock_transfers SET status = 'IN_TRANSIT', approved_by = $2, approved_at = NOW()
         WHERE id = $1`,
        [transferId, actor.sub],
      );

      await em.query(
        `INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
         VALUES (gen_random_uuid(), $1, $2, 'STOCK_TRANSFER_APPROVED', 'stock_transfer', $3, $4)`,
        [transfer.from_branch_id, actor.sub, transferId, JSON.stringify({ status: 'IN_TRANSIT' })],
      );
    });

    // Publish stock changes for source branch
    for (const item of items) {
      const [inv] = await this.dataSource.query(
        `SELECT quantity_on_hand, reorder_level FROM inventory WHERE product_id = $1 AND branch_id = $2`,
        [item.product_id, transfer.from_branch_id],
      ) as Array<{ quantity_on_hand: number; reorder_level: number }>;
      if (inv) {
        this.realtimeStock.publishStockChanged({
          branchId: transfer.from_branch_id,
          productId: item.product_id,
          quantityOnHand: inv.quantity_on_hand,
          reorderLevel: inv.reorder_level,
        });
      }
    }

    this.logger.log('Stock transfer approved: ' + transferId + ' by=' + actor.sub);
    return this.getTransfer(transferId);
  }

  /**
   * Receive a transfer at the destination branch. Adds stock.
   */
  async receiveTransfer(transferId: string, actor: JwtUser): Promise<StockTransferOutput> {
    const transfer = await this.getTransferRow(transferId);

    if (transfer.status !== 'IN_TRANSIT') {
      throw new BadRequestException('Transfer is ' + transfer.status + ', cannot receive');
    }
    if (transfer.to_branch_id !== actor.branchId) {
      throw new ForbiddenException('You can only receive transfers at your branch');
    }

    const items = await this.getTransferItems(transferId);

    await this.dataSource.transaction(async (em) => {
      for (const item of items) {
        // Ensure inventory row exists at destination
        await em.query(
          `INSERT INTO inventory (id, product_id, branch_id, quantity_on_hand, reorder_level)
           VALUES (gen_random_uuid(), $1, $2, 0, 10)
           ON CONFLICT (product_id, branch_id) DO NOTHING`,
          [item.product_id, transfer.to_branch_id],
        );

        // Add stock at destination
        await em.query(
          `UPDATE inventory SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
           WHERE product_id = $2 AND branch_id = $3`,
          [item.quantity, item.product_id, transfer.to_branch_id],
        );

        // Stock movement — TRANSFER_IN
        await em.query(
          `INSERT INTO stock_movements (id, product_id, branch_id, quantity, movement_type, reference_id, performed_by)
           VALUES (gen_random_uuid(), $1, $2, $3, 'TRANSFER_IN', $4, $5)`,
          [item.product_id, transfer.to_branch_id, item.quantity, transferId, actor.sub],
        );

        // Update received quantity
        await em.query(
          `UPDATE stock_transfer_items SET received_quantity = $1 WHERE transfer_id = $2 AND product_id = $3`,
          [item.quantity, transferId, item.product_id],
        );
      }

      await em.query(
        `UPDATE stock_transfers SET status = 'RECEIVED', received_by = $2, received_at = NOW()
         WHERE id = $1`,
        [transferId, actor.sub],
      );

      await em.query(
        `INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
         VALUES (gen_random_uuid(), $1, $2, 'STOCK_TRANSFER_RECEIVED', 'stock_transfer', $3, $4)`,
        [transfer.to_branch_id, actor.sub, transferId, JSON.stringify({ status: 'RECEIVED' })],
      );
    });

    // Publish stock changes for destination branch
    for (const item of items) {
      const [inv] = await this.dataSource.query(
        `SELECT quantity_on_hand, reorder_level FROM inventory WHERE product_id = $1 AND branch_id = $2`,
        [item.product_id, transfer.to_branch_id],
      ) as Array<{ quantity_on_hand: number; reorder_level: number }>;
      if (inv) {
        this.realtimeStock.publishStockChanged({
          branchId: transfer.to_branch_id,
          productId: item.product_id,
          quantityOnHand: inv.quantity_on_hand,
          reorderLevel: inv.reorder_level,
        });
      }
    }

    this.logger.log('Stock transfer received: ' + transferId + ' by=' + actor.sub);
    return this.getTransfer(transferId);
  }

  /**
   * Cancel a pending transfer.
   */
  async cancelTransfer(transferId: string, reason: string, actor: JwtUser): Promise<StockTransferOutput> {
    const transfer = await this.getTransferRow(transferId);

    if (transfer.status !== 'PENDING') {
      throw new BadRequestException('Only pending transfers can be cancelled. Current status: ' + transfer.status);
    }

    await this.dataSource.query(
      `UPDATE stock_transfers SET status = 'CANCELLED', notes = COALESCE(notes, '') || ' [Cancelled: ' || $2 || ']'
       WHERE id = $1`,
      [transferId, reason],
    );

    this.logger.log('Stock transfer cancelled: ' + transferId + ' reason=' + reason);
    return this.getTransfer(transferId);
  }

  /**
   * List transfers visible to the current branch (sent or received).
   */
  async listTransfers(branchId: string, status?: string): Promise<StockTransferOutput[]> {
    let query = `SELECT
      t.*, fb.name as from_branch_name, tb.name as to_branch_name,
      cu.name as created_by_name, au.name as approved_by_name, ru.name as received_by_name
    FROM stock_transfers t
    JOIN branches fb ON fb.id = t.from_branch_id
    JOIN branches tb ON tb.id = t.to_branch_id
    JOIN users cu ON cu.id = t.created_by
    LEFT JOIN users au ON au.id = t.approved_by
    LEFT JOIN users ru ON ru.id = t.received_by
    WHERE (t.from_branch_id = $1 OR t.to_branch_id = $1)`;

    const params: any[] = [branchId];
    if (status) {
      query += ' AND t.status = $2';
      params.push(status);
    }
    query += ' ORDER BY t.created_at DESC LIMIT 50';

    const rows = await this.dataSource.query(query, params) as TransferRow[];
    const transfers: StockTransferOutput[] = [];

    for (const row of rows) {
      const items = await this.getTransferItems(row.id);
      transfers.push(this.mapTransfer(row, items));
    }

    return transfers;
  }

  /**
   * Get a single transfer by ID.
   */
  async getTransfer(transferId: string): Promise<StockTransferOutput> {
    const row = await this.getTransferRow(transferId);
    const items = await this.getTransferItems(transferId);
    return this.mapTransfer(row, items);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async getTransferRow(transferId: string): Promise<TransferRow> {
    const [row] = await this.dataSource.query(
      `SELECT t.*, fb.name as from_branch_name, tb.name as to_branch_name,
              cu.name as created_by_name, au.name as approved_by_name, ru.name as received_by_name
       FROM stock_transfers t
       JOIN branches fb ON fb.id = t.from_branch_id
       JOIN branches tb ON tb.id = t.to_branch_id
       JOIN users cu ON cu.id = t.created_by
       LEFT JOIN users au ON au.id = t.approved_by
       LEFT JOIN users ru ON ru.id = t.received_by
       WHERE t.id = $1`,
      [transferId],
    ) as TransferRow[];

    if (!row) throw new NotFoundException('Transfer ' + transferId + ' not found');
    return row;
  }

  private async getTransferItems(transferId: string): Promise<TransferItemRow[]> {
    return this.dataSource.query(
      `SELECT ti.product_id, p.name as product_name, ti.quantity, ti.received_quantity
       FROM stock_transfer_items ti
       JOIN products p ON p.id = ti.product_id
       WHERE ti.transfer_id = $1
       ORDER BY p.name`,
      [transferId],
    );
  }

  private mapTransfer(row: TransferRow, items: TransferItemRow[]): StockTransferOutput {
    return {
      id: row.id,
      fromBranchId: row.from_branch_id,
      fromBranchName: row.from_branch_name,
      toBranchId: row.to_branch_id,
      toBranchName: row.to_branch_name,
      status: row.status,
      items: items.map(i => ({
        productId: i.product_id,
        productName: i.product_name,
        quantity: i.quantity,
        receivedQuantity: i.received_quantity ?? undefined,
      })),
      notes: row.notes ?? undefined,
      createdByName: row.created_by_name,
      approvedByName: row.approved_by_name ?? undefined,
      receivedByName: row.received_by_name ?? undefined,
      createdAt: row.created_at,
      approvedAt: row.approved_at ?? undefined,
      receivedAt: row.received_at ?? undefined,
      totalItems: items.length,
      totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
    };
  }
}
