"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ProductsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const product_entity_1 = require("./entities/product.entity");
const s3_upload_service_1 = require("./s3-upload.service");
let ProductsService = ProductsService_1 = class ProductsService {
    constructor(productRepo, dataSource, s3Upload) {
        this.productRepo = productRepo;
        this.dataSource = dataSource;
        this.s3Upload = s3Upload;
        this.logger = new common_1.Logger(ProductsService_1.name);
    }
    async search(query, branchId, branchType, limit = 20, retries = 2) {
        const q = query.trim();
        if (q.length < 2)
            return [];
        this.logger.debug(`Searching products: query="${q}" branchId=${branchId} branchType=${branchType}`);
        const allowedTypes = ['both', branchType];
        const likeParam = `%${q}%`;
        let rows = [];
        let attempt = 0;
        while (attempt <= retries) {
            try {
                rows = await this.dataSource.query(`
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
                break;
            }
            catch (error) {
                attempt++;
                if (attempt > retries) {
                    this.logger.error(`Product search failed after ${retries} retries: ${error instanceof Error ? error.message : String(error)}`);
                    throw error;
                }
                this.logger.warn(`Product search failed (attempt ${attempt}/${retries}). Retrying...`);
                await new Promise(resolve => setTimeout(resolve, 500 * attempt));
            }
        }
        return rows.map((row) => {
            var _a, _b, _c;
            const product = new product_entity_1.Product();
            product.id = row.p_id;
            product.name = row.p_name;
            product.genericName = (_a = row.p_generic_name) !== null && _a !== void 0 ? _a : undefined;
            product.barcode = (_b = row.p_barcode) !== null && _b !== void 0 ? _b : undefined;
            product.unitPrice = Number(row.p_unit_price);
            product.classification = row.p_classification;
            product.branchType = row.p_branch_type;
            product.vatExempt = row.p_vat_exempt;
            product.requiresRx = row.p_requires_rx;
            product.isActive = true;
            if (row.pi_id) {
                product.image = {
                    id: row.pi_id,
                    cdn_url: row.pi_cdn_url,
                    url_thumb: row.pi_url_thumb,
                    source: row.pi_source,
                    is_approved: row.pi_is_approved,
                };
            }
            if (row.cat_id) {
                product.category = {
                    id: row.cat_id,
                    name: row.cat_name,
                };
            }
            if (row.sup_id) {
                product.supplier = {
                    id: row.sup_id,
                    name: row.sup_name,
                    ai_score: row.sup_ai_score,
                };
            }
            if (row.inv_quantity_on_hand !== null) {
                product.inventory = {
                    quantity_on_hand: Number(row.inv_quantity_on_hand),
                    reorder_level: Number((_c = row.inv_reorder_level) !== null && _c !== void 0 ? _c : 10),
                };
            }
            return product;
        });
    }
    async findById(id) {
        return this.productRepo.findOne({ where: { id, isActive: true } });
    }
    async createProduct(input, actor) {
        var _a, _b, _c, _d, _e;
        this.assertProductCreator(actor);
        const normalizedName = input.name.trim();
        if (!normalizedName) {
            throw new common_1.BadRequestException('Product name is required');
        }
        const normalizedGenericName = ((_a = input.genericName) === null || _a === void 0 ? void 0 : _a.trim()) || null;
        const normalizedBarcode = ((_b = input.barcode) === null || _b === void 0 ? void 0 : _b.trim()) || null;
        const reorderLevel = Math.max(1, (_c = input.reorderLevel) !== null && _c !== void 0 ? _c : 10);
        const vatExempt = (_d = input.vatExempt) !== null && _d !== void 0 ? _d : input.classification !== 'CONTROLLED';
        const requiresRx = (_e = input.requiresRx) !== null && _e !== void 0 ? _e : input.classification !== 'OTC';
        if (actor.branchType === 'chemical' && input.classification !== 'OTC') {
            throw new common_1.ForbiddenException('Chemical branches can only create OTC products');
        }
        if (actor.branchType === 'chemical' && input.branchType === 'pharmaceutical') {
            throw new common_1.ForbiddenException('Chemical branches cannot create pharmaceutical-only products');
        }
        try {
            const productId = await this.dataSource.transaction(async (em) => {
                var _a, _b, _c;
                const inserted = await em.query(`
          INSERT INTO products (
            id, name, generic_name, barcode, unit_price, classification,
            branch_type, vat_exempt, requires_rx, category_id, supplier_id, is_active
          )
          VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10, true
          )
          RETURNING id
        `, [
                    normalizedName,
                    normalizedGenericName,
                    normalizedBarcode,
                    input.unitPrice,
                    input.classification,
                    input.branchType,
                    vatExempt,
                    requiresRx,
                    (_a = input.categoryId) !== null && _a !== void 0 ? _a : null,
                    (_b = input.supplierId) !== null && _b !== void 0 ? _b : null,
                ]);
                const createdId = (_c = inserted[0]) === null || _c === void 0 ? void 0 : _c.id;
                if (!createdId) {
                    throw new common_1.BadRequestException('Product creation failed');
                }
                await em.query(`
          INSERT INTO inventory (id, product_id, branch_id, quantity_on_hand, reorder_level)
          VALUES (gen_random_uuid(), $1, $2, 0, $3)
          ON CONFLICT (product_id, branch_id) DO NOTHING
        `, [createdId, actor.branchId, reorderLevel]);
                await em.query(`
          INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
          VALUES (gen_random_uuid(), $1, $2, 'PRODUCT_CREATED', 'product', $3, $4)
        `, [
                    actor.branchId,
                    actor.sub,
                    createdId,
                    JSON.stringify({
                        name: normalizedName,
                        classification: input.classification,
                        branch_type: input.branchType,
                        reorder_level: reorderLevel,
                    }),
                ]);
                return createdId;
            });
            const created = await this.findById(productId);
            if (!created) {
                throw new common_1.BadRequestException('Created product could not be loaded');
            }
            this.logger.log(`Product created: id=${created.id} by user=${actor.sub}`);
            return created;
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException || error instanceof common_1.ForbiddenException) {
                throw error;
            }
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes('idx_products_barcode_unique') || msg.includes('products_barcode_unique')) {
                throw new common_1.BadRequestException('Barcode already exists for another active product');
            }
            throw error;
        }
    }
    assertProductCreator(actor) {
        if (!['owner', 'se_admin', 'manager', 'head_pharmacist'].includes(actor.role)) {
            throw new common_1.ForbiddenException(`Role '${actor.role}' cannot create products. Required: owner, se_admin, manager, head_pharmacist`);
        }
    }
    async uploadProductImage(productId, buffer, filename, mimetype, actor) {
        this.assertImageManager(actor);
        const product = await this.findById(productId);
        if (!product) {
            throw new common_1.NotFoundException(`Product ${productId} not found`);
        }
        const uploadResult = await this.s3Upload.uploadProductImage(buffer, filename, mimetype, productId);
        const [image] = await this.dataSource.query(`
      INSERT INTO product_images (id, product_id, cdn_url, url_thumb, source, is_approved)
      VALUES (gen_random_uuid(), $1, $2, $3, 'MANUAL_UPLOAD', true)
      RETURNING id, product_id, cdn_url, url_thumb, source, is_approved, created_at
    `, [productId, uploadResult.url, uploadResult.thumbnailUrl || uploadResult.url]);
        await this.dataSource.query(`UPDATE products SET image_id = $1 WHERE id = $2`, [image.id, productId]);
        await this.dataSource.query(`
      INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
      VALUES (gen_random_uuid(), $1, $2, 'PRODUCT_IMAGE_UPLOADED', 'product_image', $3, $4)
    `, [
            actor.branchId,
            actor.sub,
            image.id,
            JSON.stringify({ product_id: productId, filename, s3_key: uploadResult.key }),
        ]);
        this.logger.log(`Product image uploaded: ${image.id} for product ${productId} by ${actor.sub}`);
        return image;
    }
    async getProductImages(productId) {
        return this.dataSource.query(`
      SELECT id, product_id, cdn_url, url_thumb, source, is_approved, created_at
      FROM product_images
      WHERE product_id = $1
      ORDER BY created_at DESC
    `, [productId]);
    }
    async deleteProductImage(imageId, actor) {
        this.assertImageManager(actor);
        const [image] = await this.dataSource.query(`
      SELECT pi.*, p.id as product_id
      FROM product_images pi
      JOIN products p ON p.id = pi.product_id
      WHERE pi.id = $1
    `, [imageId]);
        if (!image) {
            throw new common_1.NotFoundException(`Image ${imageId} not found`);
        }
        const key = image.cdn_url.split('/').slice(3).join('/');
        await this.s3Upload.deleteImage(key);
        await this.dataSource.query(`DELETE FROM product_images WHERE id = $1`, [imageId]);
        const [remaining] = await this.dataSource.query(`
      SELECT id FROM product_images 
      WHERE product_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [image.product_id]);
        if (remaining) {
            await this.dataSource.query(`UPDATE products SET image_id = $1 WHERE id = $2`, [remaining.id, image.product_id]);
        }
        else {
            await this.dataSource.query(`UPDATE products SET image_id = NULL WHERE id = $1`, [image.product_id]);
        }
        await this.dataSource.query(`
      INSERT INTO audit_logs (id, branch_id, user_id, type, entity_type, entity_id, metadata)
      VALUES (gen_random_uuid(), $1, $2, 'PRODUCT_IMAGE_DELETED', 'product_image', $3, $4)
    `, [
            actor.branchId,
            actor.sub,
            imageId,
            JSON.stringify({ product_id: image.product_id }),
        ]);
        this.logger.log(`Product image deleted: ${imageId} by ${actor.sub}`);
        return true;
    }
    async setPrimaryImage(productId, imageId, actor) {
        this.assertImageManager(actor);
        const [image] = await this.dataSource.query(`SELECT id FROM product_images WHERE id = $1 AND product_id = $2`, [imageId, productId]);
        if (!image) {
            throw new common_1.NotFoundException(`Image ${imageId} not found for product ${productId}`);
        }
        await this.dataSource.query(`UPDATE products SET image_id = $1 WHERE id = $2`, [imageId, productId]);
        this.logger.log(`Primary image set: ${imageId} for product ${productId} by ${actor.sub}`);
        return true;
    }
    assertImageManager(actor) {
        if (!['owner', 'se_admin', 'manager', 'head_pharmacist', 'technician'].includes(actor.role)) {
            throw new common_1.ForbiddenException(`Role '${actor.role}' cannot manage product images. Required: owner, se_admin, manager, head_pharmacist, technician`);
        }
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = ProductsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(product_entity_1.Product)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource,
        s3_upload_service_1.S3UploadService])
], ProductsService);
//# sourceMappingURL=products.service.js.map