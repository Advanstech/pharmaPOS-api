import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSaleTenders1711000000022 implements MigrationInterface {
  name = 'AddSaleTenders1711000000022';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Create sale_tenders table to persist payment method per sale
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sale_tenders (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sale_id       UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        method        VARCHAR(50) NOT NULL,
        amount_pesewas INT NOT NULL CHECK (amount_pesewas > 0),
        momo_reference VARCHAR(200),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sale_tenders_sale_id ON sale_tenders(sale_id)
    `);

    // Back-fill existing sales: infer payment method from audit_logs metadata
    // where possible, otherwise default to CASH (most common in Ghana community pharmacy)
    await queryRunner.query(`
      INSERT INTO sale_tenders (id, sale_id, method, amount_pesewas)
      SELECT
        gen_random_uuid(),
        s.id,
        COALESCE(
          (
            SELECT al.metadata->>'payment_method'
            FROM audit_logs al
            WHERE al.entity_id = s.id
              AND al.type = 'SALE_COMPLETED'
              AND al.metadata->>'payment_method' IS NOT NULL
            LIMIT 1
          ),
          'CASH'
        ) AS method,
        s.total_amount
      FROM sales s
      WHERE s.status IN ('COMPLETED', 'REFUNDED')
        AND NOT EXISTS (
          SELECT 1 FROM sale_tenders st WHERE st.sale_id = s.id
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS sale_tenders`);
  }
}
