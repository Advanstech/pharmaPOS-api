import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from './entities/product.entity';

interface ProductRow {
  p_id: string;
  p_name: string;
  p_generic_name: string | null;
  p_barcode: string | null;
  p_unit_price: number;
  p_classification: string;
  p_branch_type: string;
  p_vat_exempt: boolean;
  p_requires_rx: boolean;
  p_category_id: string | null;
  p_supplier_id: string | null;
  // image
  pi_id: string | null;
  pi_cdn_url: string | null;
  pi_url_thumb: string | null;
  pi_source: string | null;
  pi_is_approved: boolean | null;
  // category
  cat_id: string | null;
  cat_name: string | null;
  // supplier
  sup_id: string | null;
  sup_name: string | null;
  sup_ai_score: number | null;
  // inventory
  inv_quantity_on_hand: number | null;
  inv_reorder_level: number | null;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Full-text + ILIKE product search with inventory and related data.
   * Uses a native SQL query to avoid TypeORM entity/column mapping issues
   * with tables that have column name mismatches (e.g. suppliers.contact_name).
   *
   * Ghana FDA: branchType from JWT ensures chemical branches never see POM products.
   */
  async search(
    query: string,
    branchId: string,
    branchType: 'pharmaceutical' | 'chemical',
    limit = 20,
    retries = 2,
  ): Promise<Product[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    this.logger.debug(`Searching products: query="${q}" branchId=${branchId} branchType=${branchType}`);

    // Ghana FDA: chemical branches can only see 'chemical' or 'both' products
    const allowedTypes = ['both', branchType];
    const likeParam = `%${q}%`;

    let rows: ProductRow[] = [];
    let attempt = 0;

    while (attempt <= retries) {
      try {
        rows = await this.dataSource.query<ProductRow[]>(`
          SELECT
            p.id              AS p_id,
            p.name            AS p_name,
            p.generic_name    AS p_generic_name,
            p.barcode         AS p_barcode,
            p.unit_price      AS p_unit_price,
            p.classification  AS p_classification,
            p.branch_type     AS p_branch_type,
            p.vat_exempt      AS p_vat_exempt,
            p.requires_rx     AS p_requires_rx,
            p.category_id     AS p_category_id,
            p.supplier_id     AS p_supplier_id,
            -- image (first approved image only)
            pi.id             AS pi_id,
            pi.cdn_url        AS pi_cdn_url,
            pi.url_thumb      AS pi_url_thumb,
            pi.source         AS pi_source,
            pi.is_approved    AS pi_is_approved,
            -- category
            cat.id            AS cat_id,
            cat.name          AS cat_name,
            -- supplier (only safe columns — avoids contact_person vs contact_name mismatch)
            sup.id            AS sup_id,
            sup.name          AS sup_name,
            sup.ai_score      AS sup_ai_score,
            -- inventory for this branch
            inv.quantity_on_hand  AS inv_quantity_on_hand,
            inv.reorder_level     AS inv_reorder_level
          FROM products p
          LEFT JOIN LATERAL (
            SELECT id, cdn_url, url_thumb, source, is_approved
            FROM product_images
            WHERE product_id = p.id AND is_approved = true
            LIMIT 1
          ) pi ON true
          LEFT JOIN product_categories cat ON cat.id = p.category_id
          LEFT JOIN suppliers sup ON sup.id = p.supplier_id
          LEFT JOIN inventory inv ON inv.product_id = p.id AND inv.branch_id = $1
          WHERE p.is_active = true
            AND p.branch_type = ANY($2)
            AND (
              p.name ILIKE $3
              OR p.generic_name ILIKE $3
              OR p.barcode = $4
            )
          ORDER BY
            CASE WHEN p.barcode = $4 THEN 0 ELSE 1 END,
            COALESCE(inv.quantity_on_hand, 0) DESC,
            p.name ASC,
            p.id ASC
          LIMIT $5
        `, [branchId, allowedTypes, likeParam, q, limit]);
        break; // Success, exit retry loop
      } catch (error) {
        attempt++;
        if (attempt > retries) {
          this.logger.error(`Product search failed after ${retries} retries: ${error instanceof Error ? error.message : String(error)}`);
          throw error;
        }
        this.logger.warn(`Product search failed (attempt ${attempt}/${retries}). Retrying...`);
        // Wait a short bit before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }

    // Map flat rows → Product entity shape with nested objects
    return rows.map((row) => {
      const product = new Product();
      product.id = row.p_id;
      product.name = row.p_name;
      product.genericName = row.p_generic_name ?? undefined;
      product.barcode = row.p_barcode ?? undefined;
      product.unitPrice = Number(row.p_unit_price);
      product.classification = row.p_classification as Product['classification'];
      product.branchType = row.p_branch_type as Product['branchType'];
      product.vatExempt = row.p_vat_exempt;
      product.requiresRx = row.p_requires_rx;
      product.isActive = true;

      // Attach nested objects — picked up by @ResolveField in resolver
      if (row.pi_id) {
        (product as Product & { image: unknown }).image = {
          id: row.pi_id,
          cdn_url: row.pi_cdn_url,
          url_thumb: row.pi_url_thumb,
          source: row.pi_source,
          is_approved: row.pi_is_approved,
        };
      }

      if (row.cat_id) {
        (product as Product & { category: unknown }).category = {
          id: row.cat_id,
          name: row.cat_name,
        };
      }

      if (row.sup_id) {
        (product as Product & { supplier: unknown }).supplier = {
          id: row.sup_id,
          name: row.sup_name,
          ai_score: row.sup_ai_score,
        };
      }

      if (row.inv_quantity_on_hand !== null) {
        (product as Product & { inventory: unknown }).inventory = {
          quantity_on_hand: Number(row.inv_quantity_on_hand),
          reorder_level: Number(row.inv_reorder_level ?? 10),
        };
      }

      return product;
    });
  }

  async findById(id: string): Promise<Product | null> {
    return this.productRepo.findOne({ where: { id, isActive: true } });
  }
}
