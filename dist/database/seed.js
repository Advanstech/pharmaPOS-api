"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const data_source_1 = require("./data-source");
async function seed() {
    var _a, _b, _c, _d, _e, _f;
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
        console.log('Seeding 10 real Azzay suppliers...');
        const suppliers = [
            ['ADD Pharma Limited', 'Mr Joe', 'Joe', 'Mensah', '0501309353', 'joe@addpharma.com', 'East Legon, Accra, Ghana', 'ADD Pharma Limited', 'Pharmaceutical Distributor'],
            ['Bedither Pharmaceuticals', 'Mr Mike', 'Mike', 'Owusu', '0541692789', 'mike@bedither.com', 'Achimota, Accra, Ghana', 'Bedither Pharmaceuticals Ltd', 'Medical Supplies'],
            ['Danny Pharma', 'Daniel Appiah', 'Daniel', 'Appiah', '', '', 'Osu, Accra, Ghana', 'Danny Pharma Ltd', 'Pharmaceutical Wholesaler'],
            ['East Cantonments Pharmacy Ltd', 'Sarah Adjei', 'Sarah', 'Adjei', '0501501864', '', 'Cantonments, Accra, Ghana', 'East Cantonments Pharmacy Limited', 'Retail Pharmacy Supplier'],
            ['Greenlight Pharmacy', 'Emmanuel Darko', 'Emmanuel', 'Darko', '0543273839', '', 'Dansoman, Accra, Ghana', 'Greenlight Pharmacy Ltd', 'Pharmaceutical Distributor'],
            ['Jojo Pharmacy', 'Joseph Amoah', 'Joseph', 'Amoah', '0209221210', '', 'Madina, Accra, Ghana', 'Jojo Pharmacy Ltd', 'Medical Supplies'],
            ['Manno Pharma', 'Emmanuel Manno', 'Emmanuel', 'Manno', '0209462027', '', 'Kasoa, Central Region, Ghana', 'Manno Pharma Ltd', 'Pharmaceutical Wholesaler'],
            ['OA&J Pharmaceuticals', 'Olivia Agyeman', 'Olivia', 'Agyeman', '0555012520', '', 'Lapaz, Accra, Ghana', 'OA&J Pharmaceuticals Ltd', 'Pharmaceutical Importer'],
            ['Sixx Star Pharmacy', 'Stephen Siaw', 'Stephen', 'Siaw', '0545100230', '', 'Teshie, Accra, Ghana', 'Sixx Star Pharmacy Ltd', 'Retail Pharmacy Supplier'],
            ['Tobinco Pharmaceuticals', 'Ama Serwaa', 'Ama', 'Serwaa', '0240467925', '', 'Adum, Kumasi, Ashanti Region, Ghana', 'Tobinco Pharmaceuticals Ltd', 'Pharmaceutical Wholesaler'],
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
            'Vitamins & Supplements', 'Antimalarials', 'Antibiotics', 'Antifungals',
            'Antiparasitics', 'Antivirals', 'Analgesics & NSAIDs', 'Cardiovascular',
            'Gastrointestinal', 'Respiratory & Cough', 'Diabetes', 'Eye / ENT',
            'Dermatology & Topical', 'Women\'s Health', 'Neurology & CNS',
            'Rheumatology & MSK', 'Urology', 'Hormones & Endocrine',
            'Antihistamines & Allergy', 'Oral & Dental', 'Paediatrics & Infant Care',
            'Devices & Monitoring', 'Infusions & Injections', 'Wound Care & Dressings',
            'Consumables & Sundries', 'Sexual Health', 'Personal Care & Cosmetics',
            'Herbal & Traditional', 'Miscellaneous',
        ];
        for (const name of categories) {
            await q.query(`INSERT INTO product_categories (id, name) VALUES (gen_random_uuid(), $1) ON CONFLICT (name) DO NOTHING`, [name]);
        }
        console.log('Seeding core products (run pnpm db:import-products for full catalog)...');
        const supplierRows = await q.query(`SELECT id, name FROM suppliers WHERE is_active = true ORDER BY name`);
        const supplierIds = supplierRows.map(r => r.id);
        const supplierNameToId = new Map(supplierRows.map(r => [r.name, r.id]));
        const sampleProducts = [
            ['Paracetamol 500mg Tablet', 'Paracetamol 500mg', 'Analgesics & NSAIDs', 'OTC', 200, 500, 996, 'ADD Pharma Limited'],
            ['Amoxicillin 500mg Capsule', 'Amoxicillin 500mg', 'Antibiotics', 'POM', 500, 1200, 500, 'Bedither Pharmaceuticals'],
            ['Vitamin C 1000mg Tablet', 'Vitamin C 1000mg', 'Vitamins & Supplements', 'OTC', 300, 700, 399, 'Tobinco Pharmaceuticals'],
            ['Coartem 20/120mg', 'Artemether 20mg + Lumefantrine 120mg', 'Antimalarials', 'POM', 1200, 2500, 300, 'Danny Pharma'],
            ['Amoxicillin 250mg Suspension', 'Amoxicillin 250mg/5ml', 'Antibiotics', 'POM', 400, 400, 300, 'Greenlight Pharmacy'],
            ['Omeprazole 20mg Capsule', 'Omeprazole 20mg', 'Gastrointestinal', 'OTC', 150, 1200, 400, 'Jojo Pharmacy'],
            ['Metformin 500mg Tablet', 'Metformin HCl 500mg', 'Diabetes', 'POM', 100, 300, 500, 'Manno Pharma'],
            ['Amlodipine 10mg Tablet', 'Amlodipine Besilate 10mg', 'Cardiovascular', 'POM', 150, 400, 350, 'OA&J Pharmaceuticals'],
            ['Ibuprofen 400mg Tablet', 'Ibuprofen 400mg', 'Analgesics & NSAIDs', 'OTC', 350, 800, 600, 'Sixx Star Pharmacy'],
            ['Folic Acid 5mg Tablet', 'Folic Acid 5mg', 'Vitamins & Supplements', 'OTC', 50, 150, 800, 'East Cantonments Pharmacy Ltd'],
            ['Ciprofloxacin 500mg Tablet', 'Ciprofloxacin 500mg', 'Antibiotics', 'POM', 800, 1800, 250, 'ADD Pharma Limited'],
            ['Azithromycin 500mg Tablet', 'Azithromycin 500mg', 'Antibiotics', 'POM', 600, 2000, 200, 'Tobinco Pharmaceuticals'],
            ['Cefuroxime 500mg Tablet', 'Cefuroxime 500mg', 'Antibiotics', 'POM', 400, 1500, 180, 'Bedither Pharmaceuticals'],
            ['Diclofenac 50mg Tablet', 'Diclofenac Sodium 50mg', 'Analgesics & NSAIDs', 'OTC', 200, 600, 700, 'Greenlight Pharmacy'],
            ['Ventolin Inhaler', 'Salbutamol 100mcg/dose', 'Respiratory & Cough', 'POM', 100, 3500, 120, 'Danny Pharma'],
            ['Fluconazole 150mg Capsule', 'Fluconazole 150mg', 'Antifungals', 'POM', 200, 800, 300, 'Manno Pharma'],
            ['Losartan 50mg Tablet', 'Losartan Potassium 50mg', 'Cardiovascular', 'POM', 150, 1200, 250, 'OA&J Pharmaceuticals'],
            ['Pregnacare Original', 'Prenatal Multivitamin', 'Vitamins & Supplements', 'OTC', 100, 5000, 150, 'Sixx Star Pharmacy'],
            ['Tramadol 50mg Capsule', 'Tramadol 50mg', 'Analgesics & NSAIDs', 'CONTROLLED', 50, 800, 100, 'Jojo Pharmacy'],
            ['Morphine Injection 40mg', 'Morphine Sulphate 40mg/2ml', 'Analgesics & NSAIDs', 'CONTROLLED', 20, 5000, 30, 'East Cantonments Pharmacy Ltd'],
        ];
        for (let i = 0; i < sampleProducts.length; i++) {
            const [name, genericName, cat, classification, reorderLevel, price, stock, preferredSupplier] = sampleProducts[i];
            const supplierId = preferredSupplier ? ((_c = supplierNameToId.get(preferredSupplier)) !== null && _c !== void 0 ? _c : supplierIds[i % supplierIds.length]) : supplierIds[i % supplierIds.length];
            const catRow = await q.query(`SELECT id FROM product_categories WHERE name = $1`, [cat]);
            const catId = (_d = catRow[0]) === null || _d === void 0 ? void 0 : _d.id;
            const requiresRx = classification === 'POM' || classification === 'CONTROLLED';
            const vatExempt = requiresRx;
            const existing = (await q.query(`SELECT id FROM products WHERE LOWER(name) = LOWER($1) LIMIT 1`, [name]));
            let productId = (_e = existing[0]) === null || _e === void 0 ? void 0 : _e.id;
            if (!productId) {
                const inserted = (await q.query(`
          INSERT INTO products (id, name, generic_name, unit_price, classification, requires_rx, vat_exempt, category_id, supplier_id, is_active)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, true)
          RETURNING id
        `, [name, genericName, price, classification, requiresRx, vatExempt, catId, supplierId]));
                productId = (_f = inserted[0]) === null || _f === void 0 ? void 0 : _f.id;
            }
            else {
                await q.query(`
          UPDATE products
          SET generic_name = $1, unit_price = $2, classification = $3, requires_rx = $4, vat_exempt = $5,
              category_id = $6, supplier_id = $7, is_active = true
          WHERE id = $8
        `, [genericName, price, classification, requiresRx, vatExempt, catId, supplierId, productId]);
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