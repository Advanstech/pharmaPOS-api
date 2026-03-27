"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const data_source_1 = require("./data-source");
async function seed() {
    var _a, _b, _c, _d, _e;
    await data_source_1.AppDataSource.initialize();
    const q = data_source_1.AppDataSource.createQueryRunner();
    try {
        console.log('Seeding organization...');
        const orgResult = await q.query(`
      INSERT INTO organizations (id, name, slug, owner_email, owner_phone, country_code, timezone, is_active)
      VALUES (gen_random_uuid(), 'Azzay Pharmacy', 'azzay-pharmacy', 'owner@azzaypharmacy.com', '+233-XX-XXX-XXXX', 'GH', 'Africa/Accra', true)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
        const orgId = orgResult[0].id;
        console.log(`  org id: ${orgId}`);
        console.log('Seeding subscription...');
        await q.query(`
      INSERT INTO subscriptions (id, organization_id, tier, status, current_period_start, current_period_end)
      VALUES (gen_random_uuid(), $1, 'FREE', 'ACTIVE', NOW(), NOW() + INTERVAL '1 year')
      ON CONFLICT DO NOTHING
    `, [orgId]);
        console.log('Seeding branches...');
        const branchResult = await q.query(`
      INSERT INTO branches (id, organization_id, name, type, address, phone)
      VALUES
        (gen_random_uuid(), $1, 'Azzay Pharmacy — Main Branch', 'pharmaceutical', 'Accra Central, Ghana', '+233-XX-XXX-XXXX'),
        (gen_random_uuid(), $1, 'Azzay Chemical Shop', 'chemical', 'Accra North, Ghana', '+233-XX-XXX-XXXY')
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [orgId]);
        const branchId = (_b = (_a = branchResult[0]) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : (await q.query(`SELECT id FROM branches WHERE organization_id = $1 LIMIT 1`, [orgId]))[0].id;
        console.log(`  branch id: ${branchId}`);
        console.log('Seeding all role users...');
        const STAFF_HASH = '$2b$12$AzfUpdmBPAmGbeINEJ5W6OFFJ6/X1649sn4KlGN3EbtgJNYnbnG1m';
        const ROOT_HASH = '$2b$12$wjP58F6AGagm2wORO6VyEucDN3Aq71JHKZ1hhU1Pey2G5QopUBKeC';
        const testUsers = [
            ['Hanson Advansis (Root)', 'root@advansis.io', 'se_admin', ROOT_HASH],
            ['Azzay Owner', 'owner@azzaypharmacy.com', 'owner', STAFF_HASH],
            ['Branch Manager', 'manager@azzaypharmacy.com', 'manager', STAFF_HASH],
            ['Head Pharmacist Kofi', 'head.pharmacist@azzaypharmacy.com', 'head_pharmacist', STAFF_HASH],
            ['Pharmacist Ama', 'pharmacist@azzaypharmacy.com', 'pharmacist', STAFF_HASH],
            ['Pharmacy Technician', 'technician@azzaypharmacy.com', 'technician', STAFF_HASH],
            ['Cashier Kwame', 'cashier@azzaypharmacy.com', 'cashier', STAFF_HASH],
            ['Chemical Cashier Abena', 'chemical.cashier@azzaypharmacy.com', 'chemical_cashier', STAFF_HASH],
        ];
        for (const [name, email, role, hash] of testUsers) {
            await q.query(`
        INSERT INTO users (id, branch_id, name, email, password_hash, role, is_active)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          name = EXCLUDED.name
      `, [branchId, name, email, hash, role]);
        }
        console.log('Seeding 14 suppliers...');
        const suppliers = [
            ['Ernest Chemists Ltd', 'Kwame Mensah', 'Kofi', 'Mensah', '+233-24-123-4567', 'kwame.mensah@ernestchemists.com', 'Plot 5, Ring Road Central, Accra, Ghana', 'Ernest Chemists Ltd', 'Pharmaceutical Distributor'],
            ['Tobinco Pharmaceuticals', 'Ama Serwaa', 'Ama', 'Serwaa', '+233-20-987-6543', 'ama.serwaa@tobinco.com', 'Adum, Kumasi, Ashanti Region, Ghana', 'Tobinco Pharmaceuticals Ltd', 'Pharmaceutical Wholesaler'],
            ['Kinapharma Ltd', 'Kofi Asante', 'Kofi', 'Asante', '+233-55-555-1234', 'kofi.asante@kinapharma.com', 'Community 1, Tema, Greater Accra, Ghana', 'Kinapharma Limited', 'Medical Supplies'],
            ['Danadams Pharmaceuticals', 'Abena Osei', 'Abena', 'Osei', '+233-24-777-8888', 'abena.osei@danadams.com', 'Spintex Road, Accra, Ghana', 'Danadams Pharmaceutical Industry Ltd', 'Pharmaceutical Manufacturer'],
            ['Entrance Pharmaceuticals', 'Yaw Boateng', 'Yaw', 'Boateng', '+233-20-111-2222', 'yaw.boateng@entrance.com', 'Market Circle, Takoradi, Western Region, Ghana', 'Entrance Pharmaceuticals Ltd', 'Pharmaceutical Importer'],
            ['ADD Pharma Limited', 'Joe Mensah', 'Joe', 'Mensah', '+233-50-130-9353', 'joe.mensah@addpharma.com', 'East Legon, Accra, Ghana', 'ADD Pharma Limited', 'Pharmaceutical Distributor'],
            ['Bedither Pharmaceuticals', 'Mike Owusu', 'Mike', 'Owusu', '+233-54-169-2789', 'mike.owusu@bedither.com', 'Achimota, Accra, Ghana', 'Bedither Pharmaceuticals Ltd', 'Medical Supplies'],
            ['Danny Pharma', 'Daniel Appiah', 'Daniel', 'Appiah', '+233-24-555-7890', 'daniel.appiah@dannypharma.com', 'Osu, Accra, Ghana', 'Danny Pharma Ltd', 'Pharmaceutical Wholesaler'],
            ['East Cantonments Pharmacy Ltd', 'Sarah Adjei', 'Sarah', 'Adjei', '+233-50-150-1864', 'sarah.adjei@eastcantoments.com', 'Cantonments, Accra, Ghana', 'East Cantonments Pharmacy Limited', 'Retail Pharmacy Supplier'],
            ['Greenlight Pharmacy', 'Emmanuel Darko', 'Emmanuel', 'Darko', '+233-54-327-3839', 'emmanuel.darko@greenlight.com', 'Dansoman, Accra, Ghana', 'Greenlight Pharmacy Ltd', 'Pharmaceutical Distributor'],
            ['Jojo Pharmacy', 'Joseph Amoah', 'Joseph', 'Amoah', '+233-20-922-1210', 'joseph.amoah@jojopharmacy.com', 'Madina, Accra, Ghana', 'Jojo Pharmacy Ltd', 'Medical Supplies'],
            ['Manno Pharma', 'Emmanuel Manno', 'Emmanuel', 'Manno', '+233-20-946-2027', 'emmanuel.manno@mannopharma.com', 'Kasoa, Central Region, Ghana', 'Manno Pharma Ltd', 'Pharmaceutical Wholesaler'],
            ['OA&J Pharmaceuticals', 'Olivia Agyeman', 'Olivia', 'Agyeman', '+233-55-501-2520', 'olivia.agyeman@oajpharma.com', 'Lapaz, Accra, Ghana', 'OA&J Pharmaceuticals Ltd', 'Pharmaceutical Importer'],
            ['Sixx Star Pharmacy', 'Stephen Siaw', 'Stephen', 'Siaw', '+233-54-510-0230', 'stephen.siaw@sixxstar.com', 'Teshie, Accra, Ghana', 'Sixx Star Pharmacy Ltd', 'Retail Pharmacy Supplier'],
        ];
        for (const [name, contactName, firstName, lastName, phone, email, address, company, bizType] of suppliers) {
            await q.query(`
        INSERT INTO suppliers (id, name, contact_name, first_name, last_name, phone, email, address, company_name, business_type, payment_terms, credit_limit, ai_score, is_active)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'NET_30', 500000, 75, true)
        ON CONFLICT DO NOTHING
      `, [name, contactName, firstName, lastName, phone, email, address, company, bizType]);
        }
        console.log('Seeding product categories...');
        const categories = [
            'Antibiotic', 'Analgesic', 'Antihypertensive', 'Antidiabetic',
            'Antimalarial', 'Antiretroviral', 'Antifungal', 'Antiparasitic',
            'Vitamin & Supplement', 'Dermatology', 'Respiratory', 'Gastrointestinal',
            'Cardiovascular', 'Hormonal', 'Ophthalmic', 'Ear & Nose',
            'Contraceptive', 'Paediatric', 'Wound Care', 'General Health',
        ];
        for (const name of categories) {
            await q.query(`INSERT INTO product_categories (id, name) VALUES (gen_random_uuid(), $1) ON CONFLICT (name) DO NOTHING`, [name]);
        }
        console.log('Seeding sample products...');
        const supplierRows = await q.query(`SELECT id FROM suppliers ORDER BY name`);
        const supplierIds = supplierRows.map(r => r.id);
        const sampleProducts = [
            ['Paracetamol 500mg Tablet', 'PARA500', 'Analgesic', 'OTC', 200, 500, 1200],
            ['Ibuprofen 400mg Tablet', 'IBU400', 'Analgesic', 'OTC', 350, 800, 800],
            ['Amoxicillin 500mg Capsule', 'AMOX500', 'Antibiotic', 'POM', 500, 1200, 600],
            ['Ciprofloxacin 500mg Tablet', 'CIPRO500', 'Antibiotic', 'POM', 800, 1800, 400],
            ['Amlodipine 10mg Tablet', 'AMLO10', 'Cardiovascular', 'POM', 150, 400, 700],
            ['Metformin 500mg Tablet', 'METF500', 'Antidiabetic', 'POM', 100, 300, 900],
            ['Coartem 20/120mg Tablet', 'COAR20', 'Antimalarial', 'POM', 1200, 2500, 400],
            ['Vitamin C 1000mg Tablet', 'VITC1000', 'Vitamin & Supplement', 'OTC', 300, 700, 600],
            ['Folic Acid 5mg Tablet', 'FOLIC5', 'Vitamin & Supplement', 'OTC', 50, 150, 1100],
            ['Cough Syrup Adult 100ml', 'COUGH100', 'Respiratory', 'OTC', 800, 1500, 350],
        ];
        for (let i = 0; i < sampleProducts.length; i++) {
            const [name, barcode, cat, classification, reorderLevel, price, stock] = sampleProducts[i];
            const supplierId = supplierIds[i % supplierIds.length];
            const catRow = await q.query(`SELECT id FROM product_categories WHERE name = $1`, [cat]);
            const catId = (_c = catRow[0]) === null || _c === void 0 ? void 0 : _c.id;
            const requiresRx = classification === 'POM' || classification === 'CONTROLLED';
            const vatExempt = requiresRx;
            const existing = (await q.query(`SELECT id FROM products WHERE barcode = $1 LIMIT 1`, [barcode]));
            let productId = (_d = existing[0]) === null || _d === void 0 ? void 0 : _d.id;
            if (!productId) {
                const inserted = (await q.query(`
          INSERT INTO products (id, name, barcode, unit_price, classification, requires_rx, vat_exempt, category_id, supplier_id, is_active)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, true)
          RETURNING id
        `, [name, barcode, price, classification, requiresRx, vatExempt, catId, supplierId]));
                productId = (_e = inserted[0]) === null || _e === void 0 ? void 0 : _e.id;
            }
            else {
                await q.query(`
          UPDATE products
          SET name = $1, unit_price = $2, classification = $3, requires_rx = $4, vat_exempt = $5,
              category_id = $6, supplier_id = $7, is_active = true
          WHERE id = $8
        `, [name, price, classification, requiresRx, vatExempt, catId, supplierId, productId]);
            }
            if (productId) {
                await q.query(`
          INSERT INTO inventory (id, product_id, branch_id, quantity_on_hand, reorder_level)
          VALUES (gen_random_uuid(), $1, $2, $3, $4)
          ON CONFLICT (product_id, branch_id) DO UPDATE SET
            quantity_on_hand = EXCLUDED.quantity_on_hand,
            reorder_level = EXCLUDED.reorder_level
        `, [productId, branchId, stock, reorderLevel]);
                if (name.includes('Amoxicillin') || name.includes('Paracetamol')) {
                    const hasImg = (await q.query(`SELECT id FROM product_images WHERE product_id = $1 AND is_approved = true LIMIT 1`, [productId]));
                    if (!hasImg[0]) {
                        const imgResult = (await q.query(`
              INSERT INTO product_images (id, product_id, cdn_url, url_thumb, source, is_approved)
              VALUES (gen_random_uuid(), $1, '/placeholders/default_drug.png', '/placeholders/default_drug.png', 'PLACEHOLDER', true)
              RETURNING id
            `, [productId]));
                        await q.query(`UPDATE products SET image_id = $1 WHERE id = $2`, [imgResult[0].id, productId]);
                    }
                }
            }
        }
        console.log('Seeding Ghana chart of accounts...');
        const accounts = [
            ['1000', 'Cash on Hand'],
            ['1010', 'MTN MoMo Float'],
            ['1020', 'Vodafone Cash Float'],
            ['1030', 'AirtelTigo Money Float'],
            ['1100', 'Accounts Receivable'],
            ['1200', 'Inventory — Pharmaceuticals'],
            ['1210', 'Inventory — General Health'],
            ['1300', 'Prepaid Expenses'],
            ['2000', 'Accounts Payable — Suppliers'],
            ['2100', 'Accrued Expenses'],
            ['2200', 'VAT Payable (GRA)'],
            ['2210', 'NHIL Payable (GRA)'],
            ['2300', 'Salaries Payable'],
            ['3000', 'Owner Equity'],
            ['3100', 'Retained Earnings'],
            ['4000', 'Sales Revenue — OTC'],
            ['4010', 'Sales Revenue — POM'],
            ['4020', 'Sales Revenue — Controlled'],
            ['4100', 'Other Income'],
            ['5000', 'Cost of Goods Sold'],
            ['5100', 'Inventory Write-off (Expiry)'],
            ['6000', 'Salaries & Wages'],
            ['6100', 'Rent & Utilities'],
            ['6200', 'Marketing & Advertising'],
            ['6300', 'Bank Charges & MoMo Fees'],
            ['6900', 'Miscellaneous Expenses'],
        ];
        for (const [code, name] of accounts) {
            await q.query(`
        INSERT INTO general_ledger (id, branch_id, account_code, account_name, debit, credit, description)
        VALUES (gen_random_uuid(), $1, $2, $3, 0, 0, 'Seed account')
        ON CONFLICT DO NOTHING
      `, [branchId, code, name]);
        }
        console.log('\n✅ Seed complete!');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  PharmaPOS Pro — Test Credentials');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('  ROLE              EMAIL                                  PASSWORD');
        console.log('  ─────────────────────────────────────────────────────────────────────────────');
        console.log('  se_admin (ROOT)   root@advansis.io                       AdvansisMaster#1');
        console.log('  owner             owner@azzaypharmacy.com                PharmaPOS@2025!');
        console.log('  manager           manager@azzaypharmacy.com              PharmaPOS@2025!');
        console.log('  head_pharmacist   head.pharmacist@azzaypharmacy.com      PharmaPOS@2025!');
        console.log('  pharmacist        pharmacist@azzaypharmacy.com           PharmaPOS@2025!');
        console.log('  technician        technician@azzaypharmacy.com           PharmaPOS@2025!');
        console.log('  cashier           cashier@azzaypharmacy.com              PharmaPOS@2025!');
        console.log('  chemical_cashier  chemical.cashier@azzaypharmacy.com     PharmaPOS@2025!');
        console.log('');
        console.log('  se_admin has cross-org root access to ALL queries and mutations.');
        console.log('  All other accounts are scoped to Azzay Pharmacy — Main Branch.');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  GraphQL Playground : http://localhost:4000/graphql');
        console.log('  Swagger / REST docs: http://localhost:4000/api-docs');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    finally {
        await q.release();
        await data_source_1.AppDataSource.destroy();
    }
}
seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map