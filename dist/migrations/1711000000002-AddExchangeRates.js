"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddExchangeRates1711000000002 = void 0;
class AddExchangeRates1711000000002 {
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        currency_from VARCHAR(3) NOT NULL DEFAULT 'USD',
        currency_to   VARCHAR(3) NOT NULL DEFAULT 'GHS',
        rate          DECIMAL(12, 4) NOT NULL CHECK (rate > 0),
        updated_by    UUID REFERENCES users(id),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair
        ON exchange_rates(currency_from, currency_to, created_at DESC)
    `);
        await queryRunner.query(`
      ALTER TABLE product_price_history
        ADD COLUMN IF NOT EXISTS reason TEXT
    `);
        await queryRunner.query(`
      INSERT INTO exchange_rates (id, currency_from, currency_to, rate)
      VALUES (gen_random_uuid(), 'USD', 'GHS', 15.50)
      ON CONFLICT DO NOTHING
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS exchange_rates`);
        await queryRunner.query(`ALTER TABLE product_price_history DROP COLUMN IF EXISTS reason`);
    }
}
exports.AddExchangeRates1711000000002 = AddExchangeRates1711000000002;
//# sourceMappingURL=1711000000002-AddExchangeRates.js.map