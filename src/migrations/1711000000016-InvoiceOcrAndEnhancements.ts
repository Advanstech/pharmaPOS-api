import { MigrationInterface, QueryRunner } from 'typeorm';

export class InvoiceOcrAndEnhancements1711000000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop partially created tables from failed migrations
    await queryRunner.query(`DROP TABLE IF EXISTS supplier_payments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS invoice_ocr_jobs CASCADE`);
    
    // ── Invoice OCR Jobs ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE invoice_ocr_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID NOT NULL REFERENCES branches(id),
        supplier_id UUID REFERENCES suppliers(id),
        
        -- File upload
        file_s3_key VARCHAR(500) NOT NULL,
        file_type VARCHAR(50) NOT NULL,  -- pdf | image/png | image/jpeg
        file_size_bytes INT NOT NULL,
        
        -- OCR processing
        status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending | processing | completed | failed
        progress INT NOT NULL DEFAULT 0,  -- 0-100
        ocr_provider VARCHAR(50),  -- openai | google_vision | tesseract
        
        -- Extracted data (JSONB for flexibility)
        extracted_data JSONB,
        confidence_score INT,  -- 0-100
        requires_review BOOLEAN DEFAULT false,
        
        -- Processing metadata
        processing_started_at TIMESTAMPTZ,
        processing_completed_at TIMESTAMPTZ,
        error_message TEXT,
        
        -- Audit
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        CONSTRAINT valid_progress CHECK (progress >= 0 AND progress <= 100),
        CONSTRAINT valid_confidence CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100))
      );
      
      CREATE INDEX idx_invoice_ocr_jobs_branch ON invoice_ocr_jobs(branch_id);
      CREATE INDEX idx_invoice_ocr_jobs_supplier ON invoice_ocr_jobs(supplier_id);
      CREATE INDEX idx_invoice_ocr_jobs_status ON invoice_ocr_jobs(status);
      CREATE INDEX idx_invoice_ocr_jobs_created_at ON invoice_ocr_jobs(created_at DESC);
    `);

    // ── Enhanced Supplier Invoices ────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE supplier_invoices
      ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50) DEFAULT 'NET_30',
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'UNPAID',
      ADD COLUMN IF NOT EXISTS ocr_job_id UUID REFERENCES invoice_ocr_jobs(id);
      
      CREATE INDEX idx_supplier_invoices_payment_status ON supplier_invoices(payment_status);
      CREATE INDEX idx_supplier_invoices_due_date ON supplier_invoices(due_date) WHERE status != 'PAID';
    `);

    // ── Supplier Payments ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS supplier_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES supplier_invoices(id),
        branch_id UUID NOT NULL REFERENCES branches(id),
        
        -- Payment details
        amount_pesewas INT NOT NULL CHECK (amount_pesewas > 0),
        payment_method VARCHAR(50) NOT NULL,  -- CASH | MTN_MOMO | VODAFONE_CASH | BANK_TRANSFER | CHEQUE
        reference VARCHAR(200),  -- MoMo ref, bank ref, cheque no
        
        -- Metadata
        notes TEXT,
        receipt_s3_key VARCHAR(500),
        
        -- Audit
        paid_by UUID NOT NULL REFERENCES users(id),
        paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        CONSTRAINT valid_payment_method CHECK (payment_method IN ('CASH', 'MTN_MOMO', 'VODAFONE_CASH', 'AIRTELTIGO_MONEY', 'BANK_TRANSFER', 'CHEQUE'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_supplier_payments_invoice ON supplier_payments(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_supplier_payments_branch ON supplier_payments(branch_id);
      CREATE INDEX IF NOT EXISTS idx_supplier_payments_paid_at ON supplier_payments(paid_at DESC);
    `);

    // ── Staff Expenses ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS staff_expenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID NOT NULL REFERENCES branches(id),
        
        -- Expense details
        category VARCHAR(50) NOT NULL,  -- FUEL | UTILITIES | SUPPLIES | TRANSPORT | MEALS | OTHER
        amount_pesewas INT NOT NULL CHECK (amount_pesewas > 0),
        description TEXT NOT NULL,
        merchant_name VARCHAR(200),
        expense_date DATE NOT NULL,
        
        -- Receipt
        receipt_s3_key VARCHAR(500),
        ocr_extracted_amount INT,  -- Auto-extracted from receipt
        
        -- Payment
        payment_method VARCHAR(50) NOT NULL,  -- CASH | MOMO | PERSONAL_CARD
        
        -- Approval workflow
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED | REIMBURSED
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMPTZ,
        approval_notes TEXT,
        
        -- Reimbursement
        reimbursement_method VARCHAR(50),  -- CASH | MOMO | BANK_TRANSFER
        reimbursed_by UUID REFERENCES users(id),
        reimbursed_at TIMESTAMPTZ,
        reimbursement_reference VARCHAR(200),
        
        -- Audit
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        CONSTRAINT valid_category CHECK (category IN ('FUEL', 'UTILITIES', 'SUPPLIES', 'TRANSPORT', 'MEALS', 'OTHER')),
        CONSTRAINT valid_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED')),
        CONSTRAINT valid_payment_method CHECK (payment_method IN ('CASH', 'MOMO', 'PERSONAL_CARD'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_staff_expenses_branch ON staff_expenses(branch_id);
      CREATE INDEX IF NOT EXISTS idx_staff_expenses_created_by ON staff_expenses(created_by);
      CREATE INDEX IF NOT EXISTS idx_staff_expenses_status ON staff_expenses(status);
      CREATE INDEX IF NOT EXISTS idx_staff_expenses_expense_date ON staff_expenses(expense_date DESC);
      CREATE INDEX IF NOT EXISTS idx_staff_expenses_category ON staff_expenses(category);
    `);

    // ── Mobile Money Transactions ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS momo_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID NOT NULL REFERENCES branches(id),
        sale_id UUID REFERENCES sales(id),
        
        -- Transaction details
        transaction_id VARCHAR(200) UNIQUE NOT NULL,  -- Our internal ID
        provider VARCHAR(50) NOT NULL,  -- MTN_MOMO | VODAFONE_CASH | AIRTELTIGO_MONEY
        provider_reference VARCHAR(200),  -- Provider's transaction ID
        
        -- Customer
        customer_phone VARCHAR(20) NOT NULL,
        customer_name VARCHAR(200),
        
        -- Amount
        amount_pesewas INT NOT NULL CHECK (amount_pesewas > 0),
        
        -- Status
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',  -- PENDING | PROCESSING | SUCCESS | FAILED | EXPIRED
        failure_reason TEXT,
        
        -- Metadata
        description TEXT,
        metadata JSONB,  -- Provider-specific data
        
        -- Timestamps
        initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        
        -- Audit
        initiated_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        CONSTRAINT valid_provider CHECK (provider IN ('MTN_MOMO', 'VODAFONE_CASH', 'AIRTELTIGO_MONEY')),
        CONSTRAINT valid_status CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'EXPIRED'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_momo_transactions_branch ON momo_transactions(branch_id);
      CREATE INDEX IF NOT EXISTS idx_momo_transactions_sale ON momo_transactions(sale_id);
      CREATE INDEX IF NOT EXISTS idx_momo_transactions_status ON momo_transactions(status);
      CREATE INDEX IF NOT EXISTS idx_momo_transactions_provider ON momo_transactions(provider);
      CREATE INDEX IF NOT EXISTS idx_momo_transactions_initiated_at ON momo_transactions(initiated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_momo_transactions_customer_phone ON momo_transactions(customer_phone);
    `);

    // ── Enhanced Sale Tenders (Phase 3 - Mobile Money) ──────────────────
    // Commented out for now - will be added in Phase 3
    // await queryRunner.query(`
    //   ALTER TABLE sale_tenders
    //   ADD COLUMN IF NOT EXISTS momo_provider VARCHAR(50),
    //   ADD COLUMN IF NOT EXISTS momo_reference VARCHAR(200),
    //   ADD COLUMN IF NOT EXISTS momo_phone VARCHAR(20),
    //   ADD COLUMN IF NOT EXISTS momo_transaction_id UUID REFERENCES momo_transactions(id),
    //   ADD COLUMN IF NOT EXISTS card_last4 VARCHAR(4),
    //   ADD COLUMN IF NOT EXISTS card_type VARCHAR(50),
    //   ADD COLUMN IF NOT EXISTS cash_received_pesewas INT,
    //   ADD COLUMN IF NOT EXISTS change_pesewas INT;
    //   
    //   CREATE INDEX idx_sale_tenders_momo_transaction ON sale_tenders(momo_transaction_id);
    // `);

    // ── API Keys (Phase 4 - SaaS) ────────────────────────────────────────
    // Commented out for now - will be added in Phase 4
    // await queryRunner.query(`
    //   CREATE TABLE IF NOT EXISTS api_keys (
    //     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    //     organization_id UUID NOT NULL REFERENCES organizations(id),
    //     
    //     -- Key details
    //     name VARCHAR(200) NOT NULL,
    //     key_hash VARCHAR(200) NOT NULL UNIQUE,  -- bcrypt hash of the key
    //     key_prefix VARCHAR(20) NOT NULL,  -- "pk_live_..." for display
    //     environment VARCHAR(50) NOT NULL,  -- PRODUCTION | SANDBOX
    //     
    //     -- Permissions (JSONB array)
    //     permissions JSONB NOT NULL DEFAULT '[]',
    //     
    //     -- Rate limiting
    //     rate_limit INT NOT NULL DEFAULT 1000,  -- Requests per minute
    //     
    //     -- Status
    //     is_active BOOLEAN NOT NULL DEFAULT true,
    //     last_used_at TIMESTAMPTZ,
    //     expires_at TIMESTAMPTZ,
    //     
    //     -- Audit
    //     created_by UUID NOT NULL REFERENCES users(id),
    //     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    //     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    //     
    //     CONSTRAINT valid_environment CHECK (environment IN ('PRODUCTION', 'SANDBOX'))
    //   );
    //   
    //   CREATE INDEX IF NOT EXISTS idx_api_keys_organization ON api_keys(organization_id);
    //   CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
    //   CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active) WHERE is_active = true;
    // `);

    // ── Update payment_terms enum on suppliers ────────────────────────────
    await queryRunner.query(`
      ALTER TABLE suppliers
      DROP CONSTRAINT IF EXISTS suppliers_payment_terms_check;
      
      ALTER TABLE suppliers
      ADD CONSTRAINT suppliers_payment_terms_check 
      CHECK (payment_terms IN ('IMMEDIATE', 'ON_DELIVERY', 'NET_7', 'NET_30', 'NET_60', 'CUSTOM'));
    `);

    // ── Trigger to update supplier_invoices.updated_at ───────────────────
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_supplier_invoice_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      CREATE TRIGGER trigger_supplier_invoices_updated_at
      BEFORE UPDATE ON supplier_invoices
      FOR EACH ROW
      EXECUTE FUNCTION update_supplier_invoice_updated_at();
    `);

    // ── Trigger to update payment_status on supplier_invoices ────────────
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_supplier_invoice_payment_status()
      RETURNS TRIGGER AS $$
      DECLARE
        total_paid INT;
        invoice_total INT;
      BEGIN
        -- Get total paid amount for this invoice
        SELECT COALESCE(SUM(amount_pesewas), 0) INTO total_paid
        FROM supplier_payments
        WHERE invoice_id = NEW.invoice_id;
        
        -- Get invoice total
        SELECT total_amount INTO invoice_total
        FROM supplier_invoices
        WHERE id = NEW.invoice_id;
        
        -- Update payment status
        UPDATE supplier_invoices
        SET 
          paid_amount = total_paid,
          payment_status = CASE
            WHEN total_paid = 0 THEN 'UNPAID'
            WHEN total_paid >= invoice_total THEN 'PAID'
            ELSE 'PARTIAL'
          END,
          status = CASE
            WHEN total_paid >= invoice_total THEN 'PAID'
            ELSE status
          END
        WHERE id = NEW.invoice_id;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      CREATE TRIGGER trigger_update_payment_status
      AFTER INSERT ON supplier_payments
      FOR EACH ROW
      EXECUTE FUNCTION update_supplier_invoice_payment_status();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trigger_update_payment_status ON supplier_payments`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_supplier_invoice_payment_status()`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trigger_supplier_invoices_updated_at ON supplier_invoices`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_supplier_invoice_updated_at()`);
    
    await queryRunner.query(`DROP TABLE IF EXISTS api_keys CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS momo_transactions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS staff_expenses CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS supplier_payments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS invoice_ocr_jobs CASCADE`);
    
    await queryRunner.query(`
      ALTER TABLE sale_tenders
      DROP COLUMN IF EXISTS momo_provider,
      DROP COLUMN IF EXISTS momo_reference,
      DROP COLUMN IF EXISTS momo_phone,
      DROP COLUMN IF EXISTS momo_transaction_id,
      DROP COLUMN IF EXISTS card_last4,
      DROP COLUMN IF EXISTS card_type,
      DROP COLUMN IF EXISTS cash_received_pesewas,
      DROP COLUMN IF EXISTS change_pesewas
    `);
    
    await queryRunner.query(`
      ALTER TABLE supplier_invoices
      DROP COLUMN IF EXISTS payment_terms,
      DROP COLUMN IF EXISTS payment_status,
      DROP COLUMN IF EXISTS ocr_job_id
    `);
  }
}
