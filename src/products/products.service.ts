import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { CreateProductInput } from './dto/product.types';
import { UpdateProductInput } from './dto/update-product.input';
import { S3UploadService } from './s3-upload.service';

export interface ProductImage {
  id: string;
  productId: string;
  cdnUrl: string;
  urlThumb: string;
  source: string;
  isApproved: boolean;
  createdAt: Date;
}

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
    private readonly s3Upload: S3UploadService,
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

  async createProduct(input: CreateProductInput, actor: JwtUser): Promise<Product> {
    this.assertProductCreator(actor);

    const normalizedName = input.name.trim();
    if (!normalizedName) {
      throw new BadRequestException('Product name is required');
    }

    const normalizedGenericName = input.genericName?.trim() || null;
    const normalizedBarcode = input.barcode?.trim() || null;
    const reorderLevel = Math.max(1, input.reorderLevel ?? 10);
    const vatExempt = input.vatExempt ?? input.classification !== 'CONTROLLED';
    const requiresRx = input.requiresRx ?? input.classification !== 'OTC';

    if (actor.branchType === 'chemical' && input.classification !== 'OTC') {
      throw new ForbiddenException('Chemical branches can only create OTC products');
    }
    if (actor.branchType === 'chemical' && input.branchType === 'pharmaceutical') {
      throw new ForbiddenException('Chemical branches cannot create pharmaceutical-only products');
    }

    try {
      const productId = await this.dataSource.transaction(async (em) => {
        const inserted = await em.query(
          `
          INSERT INTO products (
            id, name, generic_name, barcode, unit_price, classification,
            branch_type, vat_exempt, requires_rx, category_id, supplier_id, is_active
          )
          VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10, true
          )
          RETURNING id
        `,
          [
            normalizedName,
            normalizedGenericName,
            normalizedBarcode,
            input.unitPrice,
            input.classification,
            input.branchType,
            vatExempt,
            requiresRx,
            input.categoryId ?? null,
            input.supplierId ?? null,
          ],
        ) as Array<{ id: string }>;

        const createdId = inserted[0]?.id;
        if (!createdId) {
          throw new BadRequestException('Product creation failed');
        }

        await em.query(
          `
          INSERT INTO inventory (id, product_id, branch_id, quantity_on_hand, reorder_level)
          VALUES (gen_random_uuid(), $1, $2, 0, $3)
          ON CONFLICT (product_id, branch_id) DO NOTHING
        `,
          [createdId, actor.branchId, reorderLevel],
        );

        await em.query(
          `
          INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
          VALUES (gen_random_uuid(), $1, $2, 'PRODUCT_CREATED', 'product', $3, $4)
        `,
          [
            actor.branchId,
            actor.sub,
            createdId,
            JSON.stringify({
              name: normalizedName,
              classification: input.classification,
              branch_type: input.branchType,
              reorder_level: reorderLevel,
            }),
          ],
        );

        return createdId;
      });

      const created = await this.findById(productId);
      if (!created) {
        throw new BadRequestException('Created product could not be loaded');
      }

      this.logger.log(`Product created: id=${created.id} by user=${actor.sub}`);
      return created;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }

      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('idx_products_barcode_unique') || msg.includes('products_barcode_unique')) {
        throw new BadRequestException('Barcode already exists for another active product');
      }
      throw error;
    }
  }

  private assertProductCreator(actor: JwtUser): void {
    if (!['owner', 'se_admin', 'manager', 'head_pharmacist'].includes(actor.role)) {
      throw new ForbiddenException(
        `Role '${actor.role}' cannot create products. Required: owner, se_admin, manager, head_pharmacist`,
      );
    }
  }

  // ── Update product ────────────────────────────────────────────────────────

  async updateProduct(id: string, input: UpdateProductInput, actor: JwtUser): Promise<Product> {
    this.assertProductCreator(actor);

    const [existing] = await this.dataSource.query(
      `SELECT id, name, unit_price, classification, branch_type FROM products WHERE id = $1 AND is_active = true`,
      [id],
    ) as Array<{ id: string; name: string; unit_price: number; classification: string; branch_type: string }>;

    if (!existing) throw new NotFoundException(`Product ${id} not found`);

    // Build SET clause dynamically from provided fields
    const sets: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    const addField = (column: string, value: unknown) => {
      if (value !== undefined && value !== null) {
        sets.push(`${column} = $${paramIdx}`);
        params.push(value);
        paramIdx++;
      }
    };

    addField('name', input.name?.trim());
    addField('generic_name', input.genericName?.trim());
    addField('barcode', input.barcode?.trim());
    addField('unit_price', input.unitPrice);
    addField('classification', input.classification);
    addField('branch_type', input.branchType);
    addField('vat_exempt', input.vatExempt);
    addField('requires_rx', input.requiresRx);
    addField('supplier_id', input.supplierId);
    addField('category_id', input.categoryId);

    if (sets.length === 0 && input.reorderLevel === undefined) {
      throw new BadRequestException('No fields to update');
    }

    await this.dataSource.transaction(async (em) => {
      // Update product fields
      if (sets.length > 0) {
        sets.push(`updated_at = NOW()`);
        await em.query(
          `UPDATE products SET ${sets.join(', ')} WHERE id = $${paramIdx}`,
          [...params, id],
        );
      }

      // Update reorder level in inventory if provided
      if (input.reorderLevel !== undefined) {
        await em.query(
          `UPDATE inventory SET reorder_level = $1, updated_at = NOW() WHERE product_id = $2 AND branch_id = $3`,
          [Math.max(1, input.reorderLevel), id, actor.branchId],
        );
      }

      // Track price change in cost history + audit log
      if (input.unitPrice !== undefined && input.unitPrice !== existing.unit_price) {
        await em.query(
          `INSERT INTO product_cost_history (id, product_id, old_price, new_price, changed_by, reason)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
          [id, existing.unit_price, input.unitPrice, actor.sub, input.reason ?? 'Price update'],
        );

        await em.query(
          `INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
           VALUES (gen_random_uuid(), $1, $2, 'PRODUCT_PRICE_CHANGED', 'product', $3, $4)`,
          [
            actor.branchId,
            actor.sub,
            id,
            JSON.stringify({
              old_price: existing.unit_price,
              new_price: input.unitPrice,
              reason: input.reason ?? 'Price update',
            }),
          ],
        );
      }

      // General update audit log
      await em.query(
        `INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
         VALUES (gen_random_uuid(), $1, $2, 'PRODUCT_UPDATED', 'product', $3, $4)`,
        [
          actor.branchId,
          actor.sub,
          id,
          JSON.stringify({ fields: Object.keys(input).filter((k) => (input as Record<string, unknown>)[k] !== undefined) }),
        ],
      );
    });

    this.logger.log(`Product updated: id=${id} by user=${actor.sub}`);
    const updated = await this.findById(id);
    if (!updated) throw new NotFoundException(`Product ${id} not found after update`);
    return updated;
  }

  // ── Deactivate product (soft delete) ──────────────────────────────────────

  // RBAC: owner only — cannot be undone from UI
  async deactivateProduct(id: string, actor: JwtUser): Promise<boolean> {
    if (actor.role !== 'owner') {
      throw new ForbiddenException('Only the owner can deactivate products');
    }

    const [existing] = await this.dataSource.query(
      `SELECT id, name FROM products WHERE id = $1 AND is_active = true`,
      [id],
    ) as Array<{ id: string; name: string }>;

    if (!existing) throw new NotFoundException(`Product ${id} not found`);

    await this.dataSource.transaction(async (em) => {
      await em.query(`UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);

      await em.query(
        `INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
         VALUES (gen_random_uuid(), $1, $2, 'PRODUCT_DEACTIVATED', 'product', $3, $4)`,
        [actor.branchId, actor.sub, id, JSON.stringify({ name: existing.name })],
      );
    });

    this.logger.log(`Product deactivated: id=${id} name=${existing.name} by user=${actor.sub}`);
    return true;
  }

  // ── Product Image Management ─────────────────────────────────────────────

  async uploadProductImage(
    productId: string,
    buffer: Buffer,
    filename: string,
    mimetype: string,
    actor: JwtUser,
  ): Promise<ProductImage> {
    this.assertImageManager(actor);

    const product = await this.findById(productId);
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    const uploadResult = await this.s3Upload.uploadProductImage(buffer, filename, mimetype, productId);

    const [image] = await this.dataSource.query(
      `
      INSERT INTO product_images (id, product_id, cdn_url, url_thumb, source, is_approved)
      VALUES (gen_random_uuid(), $1, $2, $3, 'MANUAL_UPLOAD', true)
      RETURNING id, product_id, cdn_url, url_thumb, source, is_approved, created_at
    `,
      [productId, uploadResult.url, uploadResult.thumbnailUrl || uploadResult.url],
    ) as Array<ProductImage>;

    await this.dataSource.query(
      `UPDATE products SET image_id = $1 WHERE id = $2`,
      [image.id, productId],
    );

    await this.dataSource.query(
      `
      INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
      VALUES (gen_random_uuid(), $1, $2, 'PRODUCT_IMAGE_UPLOADED', 'product_image', $3, $4)
    `,
      [
        actor.branchId,
        actor.sub,
        image.id,
        JSON.stringify({ product_id: productId, filename, s3_key: uploadResult.key }),
      ],
    );

    this.logger.log(`Product image uploaded: ${image.id} for product ${productId} by ${actor.sub}`);
    return image;
  }

  async getProductImages(productId: string): Promise<ProductImage[]> {
    return this.dataSource.query(
      `
      SELECT id, product_id, cdn_url, url_thumb, source, is_approved, created_at
      FROM product_images
      WHERE product_id = $1
      ORDER BY created_at DESC
    `,
      [productId],
    ) as Promise<ProductImage[]>;
  }

  async deleteProductImage(imageId: string, actor: JwtUser): Promise<boolean> {
    this.assertImageManager(actor);

    const [image] = await this.dataSource.query(
      `
      SELECT pi.*, p.id as product_id
      FROM product_images pi
      JOIN products p ON p.id = pi.product_id
      WHERE pi.id = $1
    `,
      [imageId],
    ) as Array<{ id: string; product_id: string; cdn_url: string }>;

    if (!image) {
      throw new NotFoundException(`Image ${imageId} not found`);
    }

    const key = image.cdn_url.split('/').slice(3).join('/');
    await this.s3Upload.deleteImage(key);

    await this.dataSource.query(`DELETE FROM product_images WHERE id = $1`, [imageId]);

    const [remaining] = await this.dataSource.query(
      `
      SELECT id FROM product_images 
      WHERE product_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `,
      [image.product_id],
    ) as Array<{ id: string }>;

    if (remaining) {
      await this.dataSource.query(
        `UPDATE products SET image_id = $1 WHERE id = $2`,
        [remaining.id, image.product_id],
      );
    } else {
      await this.dataSource.query(
        `UPDATE products SET image_id = NULL WHERE id = $1`,
        [image.product_id],
      );
    }

    await this.dataSource.query(
      `
      INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
      VALUES (gen_random_uuid(), $1, $2, 'PRODUCT_IMAGE_DELETED', 'product_image', $3, $4)
    `,
      [
        actor.branchId,
        actor.sub,
        imageId,
        JSON.stringify({ product_id: image.product_id }),
      ],
    );

    this.logger.log(`Product image deleted: ${imageId} by ${actor.sub}`);
    return true;
  }

  async setPrimaryImage(productId: string, imageId: string, actor: JwtUser): Promise<boolean> {
    this.assertImageManager(actor);

    const [image] = await this.dataSource.query(
      `SELECT id FROM product_images WHERE id = $1 AND product_id = $2`,
      [imageId, productId],
    ) as Array<{ id: string }>;

    if (!image) {
      throw new NotFoundException(`Image ${imageId} not found for product ${productId}`);
    }

    await this.dataSource.query(
      `UPDATE products SET image_id = $1 WHERE id = $2`,
      [imageId, productId],
    );

    this.logger.log(`Primary image set: ${imageId} for product ${productId} by ${actor.sub}`);
    return true;
  }

  private assertImageManager(actor: JwtUser): void {
    if (!['owner', 'se_admin', 'manager', 'head_pharmacist', 'technician'].includes(actor.role)) {
      throw new ForbiddenException(
        `Role '${actor.role}' cannot manage product images. Required: owner, se_admin, manager, head_pharmacist, technician`,
      );
    }
  }
}
