/**
 * Azzay Pharmacy — Batch Product Import
 * Reads azzay-products.tsv (tab-separated) and inserts into DB.
 * 
 * TSV format: NAME\tGENERIC\tDOSAGE_FORM\tCATEGORY
 * 
 * Run: pnpm db:import-products
 */
import { AppDataSource } from './data-source';
import * as fs from 'fs';
import * as path from 'path';

function classify(cat: string, name: string): 'OTC' | 'POM' | 'CONTROLLED' {
  const n = name.toUpperCase();
  if (/MORPHINE|PETHIDINE|DIHYDROCODEINE|CODEINE|DIAZEPAM|MIDAZOLAM|BROMAZEPAM|LIBRIUM/.test(n)) return 'CONTROLLED';
  if (['Antibiotics','Antimalarials','Antifungals','Antiparasitics','Antivirals',
    'Cardiovascular','Diabetes','Neurology & CNS','Hormones & Endocrine','Women\'s Health'].includes(cat)) return 'POM';
  if (/INJECTION|INFUSION|NEBUL/.test(n)) return 'POM';
  if (/TRAMADOL|PREGABALIN|WARFARIN|SILDENAFIL|TADALAFIL|MISOPROSTOL|CLOMID|FINASTERIDE|OLANZAPINE|FLUOXETINE|AMITRIPTYLINE|CARBAMAZEPINE/.test(n)) return 'POM';
  return 'OTC';
}

const PRICES: Record<string, number> = {
  'Vitamins & Supplements':3500,'Antimalarials':2500,'Antibiotics':4000,'Antifungals':2000,
  'Antiparasitics':1500,'Antivirals':5000,'Analgesics & NSAIDs':1500,'Cardiovascular':6000,
  'Gastrointestinal':2000,'Respiratory & Cough':2500,'Diabetes':5000,'Eye / ENT':3000,
  'Dermatology & Topical':2500,'Women\'s Health':3000,'Neurology & CNS':5000,
  'Rheumatology & MSK':4000,'Urology':4000,'Hormones & Endocrine':5000,
  'Antihistamines & Allergy':1500,'Oral & Dental':2000,'Paediatrics & Infant Care':2000,
  'Devices & Monitoring':8000,'Infusions & Injections':3000,'Wound Care & Dressings':1500,
  'Consumables & Sundries':1000,'Sexual Health':1500,'Personal Care & Cosmetics':2000,
  'Herbal & Traditional':3000,'Miscellaneous':2500,
};

async function run() {
  // Read TSV
  const tsvPath = path.join(__dirname, 'azzay-products.tsv');
  if (!fs.existsSync(tsvPath)) {
    console.error(`Missing ${tsvPath}. Create it with tab-separated: NAME\\tGENERIC\\tFORM\\tCATEGORY`);
    process.exit(1);
  }
  const lines = fs.readFileSync(tsvPath, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const products = lines.map(l => {
    const [name, generic, form, category] = l.split('\t').map(s => s.trim());
    return { name, generic, form, category };
  }).filter(p => p.name && p.category);

  console.log(`Parsed ${products.length} products from TSV`);

  await AppDataSource.initialize();
  try {
    const br = await AppDataSource.query(`SELECT id FROM branches WHERE type='pharmaceutical' LIMIT 1`);
    if (!br[0]) { console.error('Run pnpm db:seed first'); process.exit(1); }
    const branchId = br[0].id;

    const sups = await AppDataSource.query(`SELECT id FROM suppliers WHERE is_active=true ORDER BY name`);
    const supIds = sups.map((r: { id: string }) => r.id);

    // Ensure categories
    const catMap = new Map<string, string>();
    for (const cat of new Set(products.map(p => p.category))) {
      const r = await AppDataSource.query(
        `INSERT INTO product_categories(id,name) VALUES(gen_random_uuid(),$1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [cat]);
      catMap.set(cat, r[0].id);
    }

    // Get existing
    const existing = await AppDataSource.query(`SELECT LOWER(name) AS n FROM products WHERE is_active=true`);
    const existingNames = new Set(existing.map((r: { n: string }) => r.n));

    const toInsert = products.filter(p => !existingNames.has(p.name.toLowerCase()));
    console.log(`Skipping ${products.length - toInsert.length} existing. Inserting ${toInsert.length} new.`);

    // Batch insert in chunks of 40
    let done = 0;
    for (let i = 0; i < toInsert.length; i += 40) {
      const chunk = toInsert.slice(i, i + 40);
      const vals: string[] = [];
      const params: unknown[] = [];
      let pi = 1;
      for (let j = 0; j < chunk.length; j++) {
        const p = chunk[j];
        const cls = classify(p.category, p.name);
        const rx = cls !== 'OTC';
        const price = (PRICES[p.category] ?? 2500) + ((i + j) % 7) * 150;
        const catId = catMap.get(p.category) ?? catMap.get('Miscellaneous')!;
        const supId = supIds[(i + j) % supIds.length];
        vals.push(`(gen_random_uuid(),$${pi},$${pi+1},$${pi+2},$${pi+3},'both',$${pi+4},$${pi+5},$${pi+6},$${pi+7},true)`);
        params.push(p.name, p.generic, price, cls, rx, rx, catId, supId);
        pi += 8;
      }
      await AppDataSource.query(
        `INSERT INTO products(id,name,generic_name,unit_price,classification,branch_type,requires_rx,vat_exempt,category_id,supplier_id,is_active) VALUES ${vals.join(',')}`, params);
      done += chunk.length;
      process.stdout.write(`  ${done}/${toInsert.length}\r`);
    }

    // Seed inventory rows
    await AppDataSource.query(`
      INSERT INTO inventory(id,product_id,branch_id,quantity_on_hand,reorder_level)
      SELECT gen_random_uuid(),p.id,$1,0,10 FROM products p
      LEFT JOIN inventory inv ON inv.product_id=p.id AND inv.branch_id=$1
      WHERE p.is_active=true AND inv.id IS NULL
    `, [branchId]);

    const total = await AppDataSource.query(`SELECT COUNT(*)::int AS c FROM products WHERE is_active=true`);
    console.log(`\n✅ Done. ${done} inserted. Total active products: ${total[0].c}`);
  } finally {
    await AppDataSource.destroy();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
