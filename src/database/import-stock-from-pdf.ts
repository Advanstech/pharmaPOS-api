/* eslint-disable no-console */
import { AppDataSource } from './data-source';
import { spawnSync } from 'child_process';

const PDF_PATH = process.argv[2] ?? process.env['STOCK_PDF_PATH'] ?? '/Users/nana/Downloads/azzay_pharm_stock - azzay_pharm_stock.pdf';
const APPLY = process.argv.includes('--apply') || process.env['APPLY_STOCK_IMPORT'] === '1';

/* ──────────────────────────────────────────────────────────────────────────
   Month table
   ────────────────────────────────────────────────────────────────────────── */
const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────────────────── */
type ParsedRow = {
  name: string;
  normalizedName: string;
  quantityRaw?: string;
  quantity?: number;
  expiryRaw?: string;
  expiryDate?: string;
};

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */
function normalizeName(value: string): string {
  return value
    .toUpperCase()
    .replace(/\([^)]*\)/g, ' ')   // strip parenthetical suffixes
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lines that are PDF headers, column titles, or annotation noise */
function isNoise(line: string): boolean {
  const l = line.trim().toLowerCase();
  if (l.length === 0) return true;
  if (['item_name', 'qty', 'quantity', 'phy', 'expiry'].includes(l)) return true;
  // Handwritten annotations embedded in the PDF text
  if (l.includes("it's been cancelled")) return true;
  if (l.includes('name on print out')) return true;
  if (l.includes('qty on print out')) return true;
  if (l.includes('cancelled on the print')) return true;
  return false;
}

/**
 * Try to parse an expiry date from a line.
 * Handles: "Mar-27", "March-27", "07/27", "15/2028", "28-Jun" (reversed)
 * Returns ISO date string (last day of that month) or undefined.
 */
function parseExpiry(raw: string): string | undefined {
  const l = raw.trim().toLowerCase().replace(/\s+/g, '-');

  // "month-YY" or "month-YYYY"  e.g. "mar-27", "march-2027"
  const m1 = l.match(/^([a-z]+)-?(\d{2,4})$/);
  if (m1) {
    const month = MONTHS[m1[1]!];
    if (month !== undefined) {
      const yr = Number(m1[2]);
      const year = yr < 100 ? yr + 2000 : yr;
      return endOfMonth(year, month);
    }
  }

  // "DD-month" reversed  e.g. "28-jun"
  const m2 = l.match(/^(\d{1,2})-([a-z]+)$/);
  if (m2) {
    const month = MONTHS[m2[2]!];
    if (month !== undefined) {
      // no year info — skip (ambiguous), but treat as current year
      const year = new Date().getFullYear();
      return endOfMonth(year, month);
    }
  }

  // "MM/YY" e.g. "07/27"
  const m3 = l.match(/^(\d{1,2})\/(\d{2})$/);
  if (m3) {
    const month = Number(m3[1]) - 1;
    if (month >= 0 && month <= 11) {
      const year = Number(m3[2]) + 2000;
      return endOfMonth(year, month);
    }
  }

  // "DD/MM/YYYY" or "MM/YYYY" e.g. "15/2028"
  const m4 = l.match(/^(\d{1,2})\/(\d{4})$/);
  if (m4) {
    const month = Number(m4[1]) - 1;
    if (month >= 0 && month <= 11) {
      return endOfMonth(Number(m4[2]), month);
    }
  }

  // "MM/DD/YYYY" style month guard — reject if first token > 12
  return undefined;
}

function endOfMonth(year: number, month: number): string {
  // Last day of month: day 0 of next month
  const d = new Date(Date.UTC(year, month + 1, 0));
  return d.toISOString().slice(0, 10);
}

/**
 * Extract the first integer from a quantity line, ignoring unit words.
 * "103 tabs" → 103,  "6 boxes / 13 blisters" → 6,  "3 packs 3 blisters" → 3
 * Returns undefined if the line doesn't look like a quantity.
 */
function parseQuantity(line: string): number | undefined {
  const trimmed = line.trim();
  // Must start with a digit (possibly preceded by whitespace)
  if (!/^\d/.test(trimmed)) return undefined;
  const m = trimmed.match(/^(\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  return Math.round(Number(m[1]));
}

/**
 * A line looks like a product name if:
 *  - It is not noise
 *  - It does not parse as an expiry date
 *  - It does not parse as a standalone quantity (starts with digit)
 *  - It contains at least one letter
 *  - Normalised form is at least 3 chars
 */
function looksLikeName(line: string): boolean {
  if (isNoise(line)) return false;
  if (parseExpiry(line)) return false;
  if (/^\d/.test(line.trim())) return false;   // starts with digit → qty
  if (!/[A-Za-z]/.test(line)) return false;
  const norm = normalizeName(line);
  return norm.length >= 3;
}

/* ──────────────────────────────────────────────────────────────────────────
   Core parser
   Reads the flat PDF text and emits one ParsedRow per product name.
   Every named product is kept, even if no qty/expiry follows it.
   ────────────────────────────────────────────────────────────────────────── */
function parseRowsFromPdfText(text: string): ParsedRow[] {
  const lines = text
    .replace(/\f/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isNoise(l));

  const rows: ParsedRow[] = [];
  let name: string | undefined;
  let qtyRaw: string | undefined;
  let qty: number | undefined;

  const commit = (expiryRaw?: string, expiryDate?: string) => {
    if (!name) return;
    const norm = normalizeName(name);
    if (norm.length < 3) { name = undefined; qtyRaw = undefined; qty = undefined; return; }
    rows.push({ name, normalizedName: norm, quantityRaw: qtyRaw, quantity: qty, expiryRaw, expiryDate });
    name = undefined; qtyRaw = undefined; qty = undefined;
  };

  for (const line of lines) {
    const expiry = parseExpiry(line);
    const parsedQty = parseQuantity(line);
    const isName = looksLikeName(line);

    // ── No current product being built ──
    if (!name) {
      if (isName) name = line;
      // skip qty/expiry lines that appear before any name
      continue;
    }

    // ── We have a name; classify this line ──
    if (expiry && !isName) {
      // Expiry → commit current product
      commit(line, expiry);
      continue;
    }

    if (parsedQty !== undefined && !isName) {
      // Quantity line (starts with digit)
      qtyRaw = line;
      qty = parsedQty;
      continue;
    }

    if (isName) {
      // New product name encountered → flush previous
      commit();
      name = line;
    }
    // anything else (unit descriptors, notes already filtered) → ignore
  }

  commit(); // flush last

  /* ── De-duplicate by normalised name ── */
  const dedup = new Map<string, ParsedRow>();
  for (const row of rows) {
    const prev = dedup.get(row.normalizedName);
    if (!prev) { dedup.set(row.normalizedName, row); continue; }
    // Prefer the entry with more data (qty + expiry wins)
    const prevScore = Number(prev.quantity !== undefined) + Number(Boolean(prev.expiryDate));
    const rowScore  = Number(row.quantity  !== undefined) + Number(Boolean(row.expiryDate));
    if (rowScore > prevScore) dedup.set(row.normalizedName, row);
  }

  // Keep ALL products — no filter on qty/expiry
  return [...dedup.values()].filter((r) => r.normalizedName.length >= 3);
}

/* ──────────────────────────────────────────────────────────────────────────
   Classification helper
   ────────────────────────────────────────────────────────────────────────── */
function classify(name: string): 'OTC' | 'POM' | 'CONTROLLED' {
  const n = name.toUpperCase();
  if (/\bMORPHINE\b|\bPETHIDINE\b|\bDIHYDROCODEINE\b|\bDIAZEPAM\b|\bMIDAZOLAM\b|\bBROMAZEPAM\b|\bLIBRIUM\b/.test(n)) return 'CONTROLLED';
  if (/INJ\b|INJECTION|INFUSION|NEBUL|AMOX|AMOKSICLAV|AZITHRO|CIPRO\b|CIPROFLOX|\bCEF\b|CEFTRI|CEFUROX|CEFIXIM|PENICILL|CARBAMAZEPINE|AMITRIPTYLIN|INSULIN|CLINDAMYCIN|METRONIDAZOLE|CLARITHROMYCIN|LEVOFLOXACIN|MEROPENEM|CLEXANE|MIDAZOLAM|TRAMADOL|DAPAGLIFLOZ|RIVAROXABAN|WARFARIN/.test(n)) return 'POM';
  return 'OTC';
}

/* ──────────────────────────────────────────────────────────────────────────
   Main
   ────────────────────────────────────────────────────────────────────────── */
async function main() {
  const out = spawnSync('pdftotext', [PDF_PATH, '-'], { encoding: 'utf8' });
  if (out.status !== 0) throw new Error(`pdftotext failed: ${out.stderr || out.stdout}`);

  const parsedRows = parseRowsFromPdfText(out.stdout);
  console.log(`\nParsed ${parsedRows.length} product rows from PDF.`);

  if (!APPLY) {
    // Dry-run: just print a sample and counts
    const withQty    = parsedRows.filter((r) => r.quantity !== undefined).length;
    const withExpiry = parsedRows.filter((r) => r.expiryDate).length;
    const neither    = parsedRows.filter((r) => r.quantity === undefined && !r.expiryDate).length;
    console.log(`  With quantity : ${withQty}`);
    console.log(`  With expiry   : ${withExpiry}`);
    console.log(`  Name-only     : ${neither}`);
    console.log('\nFirst 20 rows:');
    for (const row of parsedRows.slice(0, 20)) {
      console.log(`  ${row.name.padEnd(50)} qty=${String(row.quantity ?? '—').padEnd(6)} exp=${row.expiryDate ?? '—'}`);
    }
    console.log('\nLast 10 rows:');
    for (const row of parsedRows.slice(-10)) {
      console.log(`  ${row.name.padEnd(50)} qty=${String(row.quantity ?? '—').padEnd(6)} exp=${row.expiryDate ?? '—'}`);
    }
    console.log('\nRun with --apply to write to database.');
    return;
  }

  /* ── Database work ── */
  await AppDataSource.initialize();
  try {
    const [branch] = await AppDataSource.query(
      `SELECT id FROM branches WHERE is_active = true ORDER BY created_at ASC LIMIT 1`,
    ) as Array<{ id: string }>;
    if (!branch) throw new Error('No active branch found');

    const [actor] = await AppDataSource.query(
      `SELECT id FROM users ORDER BY created_at ASC LIMIT 1`,
    ) as Array<{ id: string }>;
    if (!actor) throw new Error('No user found for performed_by');

    const suppliers = await AppDataSource.query(
      `SELECT id FROM suppliers WHERE is_active = true ORDER BY name ASC`,
    ) as Array<{ id: string }>;
    if (suppliers.length === 0) throw new Error('No active suppliers found');

    const [miscCategory] = await AppDataSource.query(
      `INSERT INTO product_categories(id, name)
       VALUES (gen_random_uuid(), 'Miscellaneous')
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
    ) as Array<{ id: string }>;

    // Load ALL existing products (active + inactive so we can reactivate)
    const products = await AppDataSource.query(
      `SELECT id, name, supplier_id, unit_price, is_active FROM products`,
    ) as Array<{ id: string; name: string; supplier_id: string | null; unit_price: number; is_active: boolean }>;

    const inventory = await AppDataSource.query(
      `SELECT product_id, quantity_on_hand FROM inventory WHERE branch_id = $1`,
      [branch.id],
    ) as Array<{ product_id: string; quantity_on_hand: number }>;

    const productMap = new Map<string, { id: string; name: string; supplierId: string | null; unitPrice: number; isActive: boolean }>();
    for (const p of products) {
      productMap.set(normalizeName(p.name), {
        id: p.id, name: p.name, supplierId: p.supplier_id,
        unitPrice: p.unit_price, isActive: p.is_active,
      });
    }

    const invMap = new Map<string, number>();
    for (const i of inventory) invMap.set(i.product_id, Number(i.quantity_on_hand));

    let created = 0;
    let reactivated = 0;
    let updated = 0;
    let qtyUpdated = 0;
    let expiryUpdated = 0;
    let supplierPatched = 0;
    let supplierIndex = 0;

    for (const row of parsedRows) {
      const existing = productMap.get(row.normalizedName);

      /* ── New product ── */
      if (!existing) {
        const supplierId = suppliers[supplierIndex % suppliers.length]!.id;
        supplierIndex++;

        const classification = classify(row.name);
        const requiresRx = classification !== 'OTC';

        const inserted = await AppDataSource.query(
          `INSERT INTO products (
             id, name, generic_name, barcode, unit_price, classification,
             branch_type, vat_exempt, requires_rx, category_id, supplier_id, is_active
           ) VALUES (
             gen_random_uuid(), $1, NULL, NULL, $2, $3,
             'both', $4, $5, $6, $7, true
           ) RETURNING id`,
          [row.name, 2500, classification, requiresRx, requiresRx, miscCategory.id, supplierId],
        ) as Array<{ id: string }>;

        const newId = inserted[0]!.id;

        await AppDataSource.query(
          `INSERT INTO inventory (id, product_id, branch_id, quantity_on_hand, reorder_level)
           VALUES (gen_random_uuid(), $1, $2, $3, 10)
           ON CONFLICT (product_id, branch_id)
           DO UPDATE SET quantity_on_hand = EXCLUDED.quantity_on_hand, updated_at = NOW()`,
          [newId, branch.id, row.quantity ?? 0],
        );

        if ((row.quantity ?? 0) > 0) {
          await AppDataSource.query(
            `INSERT INTO stock_movements
               (id, product_id, branch_id, batch_number, expiry_date, quantity, movement_type, performed_by)
             VALUES (gen_random_uuid(), $1, $2, 'PDF-IMPORT', $3, $4, 'PURCHASE', $5)`,
            [newId, branch.id, row.expiryDate ?? null, row.quantity, actor.id],
          );
        } else if (row.expiryDate) {
          await AppDataSource.query(
            `INSERT INTO stock_movements
               (id, product_id, branch_id, batch_number, expiry_date, quantity, movement_type, performed_by)
             VALUES (gen_random_uuid(), $1, $2, 'PDF-IMPORT', $3, 0, 'ADJUSTMENT', $4)`,
            [newId, branch.id, row.expiryDate, actor.id],
          );
        }

        created++;
        continue;
      }

      /* ── Existing product ── */
      updated++;

      // Re-activate if it was deactivated
      if (!existing.isActive) {
        await AppDataSource.query(
          `UPDATE products SET is_active = true, updated_at = NOW() WHERE id = $1`,
          [existing.id],
        );
        reactivated++;
      }

      // Patch missing supplier
      if (!existing.supplierId) {
        const supplierId = suppliers[supplierIndex % suppliers.length]!.id;
        supplierIndex++;
        await AppDataSource.query(
          `UPDATE products SET supplier_id = $1, updated_at = NOW() WHERE id = $2`,
          [supplierId, existing.id],
        );
        supplierPatched++;
      }

      // Update quantity
      if (row.quantity !== undefined) {
        const currentQty = invMap.get(existing.id) ?? 0;
        const delta = row.quantity - currentQty;

        await AppDataSource.query(
          `INSERT INTO inventory (id, product_id, branch_id, quantity_on_hand, reorder_level)
           VALUES (gen_random_uuid(), $1, $2, $3, 10)
           ON CONFLICT (product_id, branch_id)
           DO UPDATE SET quantity_on_hand = EXCLUDED.quantity_on_hand, updated_at = NOW()`,
          [existing.id, branch.id, row.quantity],
        );

        if (delta !== 0) {
          await AppDataSource.query(
            `INSERT INTO stock_movements
               (id, product_id, branch_id, batch_number, expiry_date, quantity, movement_type, performed_by)
             VALUES (gen_random_uuid(), $1, $2, 'PDF-IMPORT', $3, $4, 'ADJUSTMENT', $5)`,
            [existing.id, branch.id, row.expiryDate ?? null, delta, actor.id],
          );
        }
        qtyUpdated++;
      }

      // Record expiry (separate stock movement)
      if (row.expiryDate) {
        await AppDataSource.query(
          `INSERT INTO stock_movements
             (id, product_id, branch_id, batch_number, expiry_date, quantity, movement_type, performed_by)
           VALUES (gen_random_uuid(), $1, $2, 'PDF-IMPORT', $3, 0, 'ADJUSTMENT', $4)`,
          [existing.id, branch.id, row.expiryDate, actor.id],
        );
        expiryUpdated++;
      }
    }

    console.log(`\nMode: APPLY`);
    console.log(`Total rows parsed         : ${parsedRows.length}`);
    console.log(`New products created      : ${created}`);
    console.log(`Existing products updated : ${updated}`);
    console.log(`  — reactivated           : ${reactivated}`);
    console.log(`  — qty updated           : ${qtyUpdated}`);
    console.log(`  — expiry recorded       : ${expiryUpdated}`);
    console.log(`  — supplier patched      : ${supplierPatched}`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
