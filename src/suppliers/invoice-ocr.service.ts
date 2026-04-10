import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import axios from 'axios';
import { DataSource } from 'typeorm';

interface OcrExtractedData {
  invoiceNumber: string;
  invoiceDate: string;
  supplierName: string;
  supplierAddress?: string;
  supplierPhone?: string;
  items: OcrInvoiceItem[];
  subtotal?: number;
  vat?: number;
  totalAmount: number;
  confidence: number;
  rawText?: string;
}

interface OcrInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  confidence: number;
}

interface ProductMatch {
  productId: string;
  productName: string;
  matchScore: number;
  matchReason: string;
}

@Injectable()
export class InvoiceOcrService {
  private readonly logger = new Logger(InvoiceOcrService.name);
  private readonly openai?: OpenAI;

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }
  }

  /**
   * Extract invoice data from image or PDF using GPT-4 Vision
   */
  async extractInvoiceData(
    fileUrl: string,
    fileType: string,
    supplierId?: string,
  ): Promise<OcrExtractedData> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    this.logger.log(`Extracting invoice data from ${fileType}: ${fileUrl}`);

    try {
      // For PDF, we need to convert to images first (or use text extraction)
      // For now, we'll handle images directly
      if (fileType === 'application/pdf') {
        return await this.extractFromPdf(fileUrl, supplierId);
      }

      // Use GPT-4 Vision for image-based invoices
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting structured data from pharmaceutical supplier invoices.
Extract the following information in JSON format:
- invoiceNumber: string
- invoiceDate: string (YYYY-MM-DD format)
- supplierName: string
- supplierAddress: string (optional)
- supplierPhone: string (optional)
- items: array of {description, quantity, unitPrice, totalPrice}
- subtotal: number (optional)
- vat: number (optional)
- totalAmount: number

Important:
- All prices should be in GHS (Ghana Cedis)
- Convert prices to pesewas (multiply by 100)
- Be precise with product descriptions
- Include batch numbers if visible
- Extract expiry dates if present

Return ONLY valid JSON, no markdown or explanations.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all invoice data from this pharmaceutical supplier invoice:',
              },
              {
                type: 'image_url',
                image_url: {
                  url: fileUrl,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1, // Low temperature for accuracy
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from GPT-4 Vision');
      }

      // Parse JSON response
      const extractedData = this.parseGptResponse(content);

      // Calculate confidence based on completeness
      const confidence = this.calculateConfidence(extractedData);

      this.logger.log(`Invoice extraction completed with ${confidence}% confidence`);

      return {
        ...extractedData,
        confidence,
      };
    } catch (error) {
      this.logger.error(`Invoice OCR failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Extract data from PDF invoice
   */
  private async extractFromPdf(fileUrl: string, supplierId?: string): Promise<OcrExtractedData> {
    // For PDF, we can use GPT-4 with text extraction
    // Or convert PDF to images and use Vision API
    // For now, we'll use a simplified approach

    this.logger.log('PDF extraction not yet implemented, using fallback');

    // TODO: Implement PDF text extraction or conversion to images
    throw new Error('PDF extraction not yet implemented. Please upload as image (PNG/JPG).');
  }

  /**
   * Parse GPT-4 response and validate structure
   */
  private parseGptResponse(content: string): Omit<OcrExtractedData, 'confidence'> {
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const data = JSON.parse(cleanContent);

      // Validate required fields
      if (!data.invoiceNumber || !data.totalAmount) {
        throw new Error('Missing required fields: invoiceNumber or totalAmount');
      }

      // Ensure items is an array
      if (!Array.isArray(data.items)) {
        data.items = [];
      }

      // Convert prices to pesewas if they're in cedis
      if (data.totalAmount < 1000) {
        // Likely in cedis, convert to pesewas
        data.totalAmount = Math.round(data.totalAmount * 100);
        data.subtotal = data.subtotal ? Math.round(data.subtotal * 100) : undefined;
        data.vat = data.vat ? Math.round(data.vat * 100) : undefined;

        data.items = data.items.map((item: any) => ({
          ...item,
          unitPrice: Math.round(item.unitPrice * 100),
          totalPrice: Math.round(item.totalPrice * 100),
          confidence: 90, // Default confidence for items
        }));
      }

      return data;
    } catch (error) {
      this.logger.error(`Failed to parse GPT response: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to parse invoice data from OCR response');
    }
  }

  /**
   * Calculate confidence score based on data completeness
   */
  private calculateConfidence(data: Omit<OcrExtractedData, 'confidence'>): number {
    let score = 0;
    let maxScore = 0;

    // Invoice number (required)
    maxScore += 20;
    if (data.invoiceNumber) score += 20;

    // Invoice date
    maxScore += 15;
    if (data.invoiceDate) score += 15;

    // Supplier name
    maxScore += 15;
    if (data.supplierName) score += 15;

    // Items
    maxScore += 30;
    if (data.items && data.items.length > 0) {
      score += 30;
    }

    // Total amount
    maxScore += 20;
    if (data.totalAmount && data.totalAmount > 0) score += 20;

    return Math.round((score / maxScore) * 100);
  }

  /**
   * Smart product matching algorithm
   * Matches OCR descriptions to existing products in the database
   */
  async matchProducts(
    items: OcrInvoiceItem[],
    supplierId: string,
    branchId: string,
  ): Promise<Array<{ ocrItem: OcrInvoiceItem; matches: ProductMatch[] }>> {
    const results: Array<{ ocrItem: OcrInvoiceItem; matches: ProductMatch[] }> = [];

    for (const item of items) {
      const matches = await this.findProductMatches(item.description, supplierId, branchId);
      results.push({
        ocrItem: item,
        matches,
      });
    }

    return results;
  }

  /**
   * Find product matches using fuzzy search and supplier history
   */
  private async findProductMatches(
    description: string,
    supplierId: string,
    branchId: string,
  ): Promise<ProductMatch[]> {
    // Clean description
    const cleanDesc = description.toLowerCase().trim();

    // Strategy 1: Exact match by name
    const exactMatches = await this.dataSource.query(
      `
      SELECT id, name, generic_name, supplier_id,
             100 as match_score,
             'exact_match' as match_reason
      FROM products
      WHERE LOWER(name) = $1
        AND is_active = true
        AND (supplier_id = $2 OR supplier_id IS NULL)
      LIMIT 3
    `,
      [cleanDesc, supplierId],
    );

    if (exactMatches.length > 0) {
      return exactMatches.map((m: any) => ({
        productId: m.id,
        productName: m.name,
        matchScore: m.match_score,
        matchReason: m.match_reason,
      }));
    }

    // Strategy 2: Fuzzy match using trigram similarity
    const fuzzyMatches = await this.dataSource.query(
      `
      SELECT id, name, generic_name, supplier_id,
             GREATEST(
               similarity(LOWER(name), $1),
               similarity(LOWER(generic_name), $1)
             ) * 100 as match_score,
             'fuzzy_match' as match_reason
      FROM products
      WHERE is_active = true
        AND (
          LOWER(name) % $1
          OR LOWER(generic_name) % $1
        )
        AND (supplier_id = $2 OR supplier_id IS NULL)
      ORDER BY match_score DESC
      LIMIT 5
    `,
      [cleanDesc, supplierId],
    );

    if (fuzzyMatches.length > 0) {
      return fuzzyMatches
        .filter((m: any) => m.match_score >= 50) // Minimum 50% similarity
        .map((m: any) => ({
          productId: m.id,
          productName: m.name,
          matchScore: Math.round(m.match_score),
          matchReason: m.match_reason,
        }));
    }

    // Strategy 3: Keyword match (extract key terms)
    const keywords = this.extractKeywords(cleanDesc);
    if (keywords.length > 0) {
      const keywordMatches = await this.dataSource.query(
        `
        SELECT id, name, generic_name, supplier_id,
               70 as match_score,
               'keyword_match' as match_reason
        FROM products
        WHERE is_active = true
          AND (
            ${keywords.map((_, i) => `LOWER(name) LIKE $${i + 3}`).join(' OR ')}
            OR ${keywords.map((_, i) => `LOWER(generic_name) LIKE $${i + 3}`).join(' OR ')}
          )
          AND (supplier_id = $1 OR supplier_id IS NULL)
        ORDER BY 
          CASE WHEN supplier_id = $1 THEN 1 ELSE 2 END,
          name
        LIMIT 5
      `,
        [supplierId, branchId, ...keywords.map((k) => `%${k}%`)],
      );

      if (keywordMatches.length > 0) {
        return keywordMatches.map((m: any) => ({
          productId: m.id,
          productName: m.name,
          matchScore: m.match_score,
          matchReason: m.match_reason,
        }));
      }
    }

    // No matches found
    return [];
  }

  /**
   * Extract keywords from product description
   */
  private extractKeywords(description: string): string[] {
    // Remove common words and extract meaningful terms
    const stopWords = ['tablet', 'capsule', 'syrup', 'suspension', 'injection', 'mg', 'ml', 'x', 'pack'];
    const words = description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.includes(w));

    // Return unique keywords
    return [...new Set(words)].slice(0, 3); // Top 3 keywords
  }

  /**
   * Match supplier by name or phone from OCR data
   */
  async matchSupplier(supplierName: string, supplierPhone?: string): Promise<string | null> {
    // Try exact match first
    const exactMatch = await this.dataSource.query(
      `
      SELECT id FROM suppliers
      WHERE LOWER(name) = LOWER($1)
        AND is_active = true
      LIMIT 1
    `,
      [supplierName],
    );

    if (exactMatch.length > 0) {
      return exactMatch[0].id;
    }

    // Try phone match if available
    if (supplierPhone) {
      const phoneMatch = await this.dataSource.query(
        `
        SELECT id FROM suppliers
        WHERE phone = $1
          AND is_active = true
        LIMIT 1
      `,
        [supplierPhone],
      );

      if (phoneMatch.length > 0) {
        return phoneMatch[0].id;
      }
    }

    // Try fuzzy match
    const fuzzyMatch = await this.dataSource.query(
      `
      SELECT id, name,
             similarity(LOWER(name), LOWER($1)) * 100 as match_score
      FROM suppliers
      WHERE LOWER(name) % LOWER($1)
        AND is_active = true
      ORDER BY match_score DESC
      LIMIT 1
    `,
      [supplierName],
    );

    if (fuzzyMatch.length > 0 && fuzzyMatch[0].match_score >= 70) {
      return fuzzyMatch[0].id;
    }

    return null;
  }

  /**
   * Create OCR job record in database
   */
  async createOcrJob(
    branchId: string,
    supplierId: string | null,
    fileS3Key: string,
    fileType: string,
    fileSizeBytes: number,
    createdBy: string,
  ): Promise<string> {
    const [job] = await this.dataSource.query(
      `
      INSERT INTO invoice_ocr_jobs (
        id, branch_id, supplier_id, file_s3_key, file_type, file_size_bytes,
        status, progress, created_by
      )
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'pending', 0, $6)
      RETURNING id
    `,
      [branchId, supplierId, fileS3Key, fileType, fileSizeBytes, createdBy],
    );

    return job.id;
  }

  /**
   * Update OCR job status and progress
   */
  async updateOcrJob(
    jobId: string,
    status: string,
    progress: number,
    extractedData?: OcrExtractedData,
    errorMessage?: string,
  ): Promise<void> {
    await this.dataSource.query(
      `
      UPDATE invoice_ocr_jobs
      SET 
        status = $2,
        progress = $3,
        extracted_data = $4,
        confidence_score = $5,
        requires_review = $6,
        error_message = $7,
        processing_completed_at = CASE WHEN $2 IN ('completed', 'failed') THEN NOW() ELSE processing_completed_at END,
        updated_at = NOW()
      WHERE id = $1
    `,
      [
        jobId,
        status,
        progress,
        extractedData ? JSON.stringify(extractedData) : null,
        extractedData?.confidence || null,
        extractedData ? extractedData.confidence < 90 : false,
        errorMessage || null,
      ],
    );
  }

  /**
   * Get OCR job by ID
   */
  async getOcrJob(jobId: string): Promise<any> {
    const [job] = await this.dataSource.query(
      `
      SELECT 
        ij.*,
        s.name as supplier_name,
        u.name as created_by_name
      FROM invoice_ocr_jobs ij
      LEFT JOIN suppliers s ON s.id = ij.supplier_id
      LEFT JOIN users u ON u.id = ij.created_by
      WHERE ij.id = $1
    `,
      [jobId],
    );

    return job;
  }
}
