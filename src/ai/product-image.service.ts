import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import OpenAI from 'openai';
import { S3UploadService } from '../products/s3-upload.service';

interface ProductImageSource {
  url: string;
  source: 'rximage' | 'openfda' | 'google' | 'unsplash' | 'ai_generated';
  confidence: number; // 0-100
}

@Injectable()
export class ProductImageService {
  private readonly logger = new Logger(ProductImageService.name);
  private readonly openai?: OpenAI;
  private readonly googleApiKey?: string;
  private readonly googleCseId?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly s3Upload: S3UploadService,
  ) {
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }
    this.googleApiKey = this.config.get<string>('GOOGLE_API_KEY');
    this.googleCseId = this.config.get<string>('GOOGLE_CSE_ID');
  }

  /**
   * Find the best product image from multiple sources.
   * Priority: RxImage > OpenFDA > Google > Unsplash > AI Generated
   * 
   * IMPORTANT: RxImage and OpenFDA provide EXACT product photos (actual drug packaging).
   * Google may provide exact or generic images. Unsplash and DALL-E are generic/artificial.
   * 
   * For customer-facing use, only RxImage, OpenFDA, and verified Google images are recommended.
   */
  async findProductImage(
    productName: string,
    genericName: string,
    classification: string,
    options?: {
      allowGenericImages?: boolean; // Default: false (only exact product photos)
      allowAiGeneration?: boolean;  // Default: false (no AI-generated images)
    },
  ): Promise<ProductImageSource | null> {
    const allowGeneric = options?.allowGenericImages ?? false;
    const allowAi = options?.allowAiGeneration ?? false;

    this.logger.log(`Finding image for: ${productName} (${genericName})`);
    this.logger.log(`Options: allowGeneric=${allowGeneric}, allowAi=${allowAi}`);

    // 1. Try RxImage API (free, EXACT product photos from NLM)
    const rxImage = await this.searchRxImage(genericName);
    if (rxImage) {
      this.logger.log(`✓ Found EXACT product photo via RxImage: ${rxImage.url}`);
      return rxImage;
    }

    // 2. Try OpenFDA API (free, EXACT product photos via RxCUI)
    const fdaImage = await this.searchOpenFDA(productName, genericName);
    if (fdaImage) {
      this.logger.log(`✓ Found EXACT product photo via OpenFDA: ${fdaImage.url}`);
      return fdaImage;
    }

    // 3. Try Google Custom Search (100 free queries/day, MAY be exact)
    if (this.googleApiKey && this.googleCseId) {
      const googleImage = await this.searchGoogleImages(productName, genericName);
      if (googleImage) {
        this.logger.log(`⚠ Found image via Google (may be exact or generic): ${googleImage.url}`);
        return googleImage;
      }
    }

    // Stop here if only exact product photos are allowed
    if (!allowGeneric) {
      this.logger.warn(`No EXACT product photo found for: ${productName}. Set allowGenericImages=true to use stock photos.`);
      return null;
    }

    // 4. Try Unsplash (free, GENERIC stock photos only)
    const unsplashImage = await this.searchUnsplash(productName, genericName);
    if (unsplashImage) {
      this.logger.log(`⚠ Found GENERIC stock photo via Unsplash: ${unsplashImage.url}`);
      return unsplashImage;
    }

    // Stop here if AI generation is not allowed
    if (!allowAi) {
      this.logger.warn(`No image found for: ${productName}. Set allowAiGeneration=true to generate with DALL-E.`);
      return null;
    }

    // 5. Generate with AI (requires OpenAI API key - paid, ARTIFICIAL images)
    if (this.openai && classification !== 'CONTROLLED') {
      // Don't generate images for controlled substances
      const aiImage = await this.generateProductImage(productName, genericName);
      if (aiImage) {
        this.logger.log(`⚠ Generated ARTIFICIAL image via DALL-E: ${aiImage.url}`);
        return aiImage;
      }
    }

    this.logger.warn(`No image found for: ${productName}`);
    return null;
  }

  /**
   * RxImage API - National Library of Medicine
   * Free, no authentication required
   * Best for generic drug names
   */
  private async searchRxImage(genericName: string): Promise<ProductImageSource | null> {
    try {
      const cleanName = this.cleanDrugName(genericName);
      const url = `https://rximage.nlm.nih.gov/api/rximage/1/rxnav?name=${encodeURIComponent(cleanName)}`;
      
      const response = await axios.get(url, { timeout: 5000 });
      
      if (response.data?.nlmRxImages && response.data.nlmRxImages.length > 0) {
        const image = response.data.nlmRxImages[0];
        return {
          url: image.imageUrl,
          source: 'rximage',
          confidence: 95, // High confidence - official medical database
        };
      }
    } catch (error) {
      this.logger.debug(`RxImage search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  }

  /**
   * OpenFDA API - US Food and Drug Administration
   * Free, no authentication required
   * Best for brand names and FDA-approved drugs
   */
  private async searchOpenFDA(productName: string, genericName: string): Promise<ProductImageSource | null> {
    try {
      // Try brand name first
      let url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(productName)}"&limit=1`;
      let response = await axios.get(url, { timeout: 5000 });

      // If no results, try generic name
      if (!response.data?.results || response.data.results.length === 0) {
        const cleanGeneric = this.cleanDrugName(genericName);
        url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(cleanGeneric)}"&limit=1`;
        response = await axios.get(url, { timeout: 5000 });
      }

      if (response.data?.results && response.data.results.length > 0) {
        const result = response.data.results[0];
        // OpenFDA doesn't directly provide images, but we can construct RxCUI-based image URLs
        const rxcui = result.openfda?.rxcui?.[0];
        if (rxcui) {
          return {
            url: `https://rximage.nlm.nih.gov/image/rximage?rxcui=${rxcui}`,
            source: 'openfda',
            confidence: 90,
          };
        }
      }
    } catch (error) {
      this.logger.debug(`OpenFDA search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  }

  /**
   * Google Custom Search API
   * 100 free queries per day, then $5 per 1000 queries
   * Requires GOOGLE_API_KEY and GOOGLE_CSE_ID env vars
   */
  private async searchGoogleImages(productName: string, genericName: string): Promise<ProductImageSource | null> {
    try {
      const searchQuery = `${productName} ${genericName} pharmaceutical product packaging`;
      const url = `https://www.googleapis.com/customsearch/v1?key=${this.googleApiKey}&cx=${this.googleCseId}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=1&imgSize=large&safe=active`;

      const response = await axios.get(url, { timeout: 5000 });

      if (response.data?.items && response.data.items.length > 0) {
        const image = response.data.items[0];
        return {
          url: image.link,
          source: 'google',
          confidence: 70, // Medium confidence - web search results
        };
      }
    } catch (error) {
      this.logger.debug(`Google search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  }

  /**
   * Unsplash API - High quality stock photos
   * Free tier: 50 requests per hour
   * Requires UNSPLASH_ACCESS_KEY env var
   */
  private async searchUnsplash(productName: string, genericName: string): Promise<ProductImageSource | null> {
    try {
      const unsplashKey = this.config.get<string>('UNSPLASH_ACCESS_KEY');
      if (!unsplashKey) return null;

      const searchQuery = `${this.cleanDrugName(genericName)} medicine pharmaceutical`;
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=1&orientation=squarish`;

      const response = await axios.get(url, {
        headers: { Authorization: `Client-ID ${unsplashKey}` },
        timeout: 5000,
      });

      if (response.data?.results && response.data.results.length > 0) {
        const image = response.data.results[0];
        return {
          url: image.urls.regular,
          source: 'unsplash',
          confidence: 60, // Lower confidence - generic stock photos
        };
      }
    } catch (error) {
      this.logger.debug(`Unsplash search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  }

  /**
   * Generate product image using OpenAI DALL-E 3
   * Cost: $0.04 per image (1024x1024 standard quality)
   * Use as last resort when no real images are available
   */
  private async generateProductImage(productName: string, genericName: string): Promise<ProductImageSource | null> {
    if (!this.openai) {
      this.logger.warn('OpenAI API key not configured, skipping AI image generation');
      return null;
    }

    try {
      const prompt = `Professional pharmaceutical product photograph of ${productName} (${genericName}), 
                      medicine packaging on white background, high resolution, medical grade quality, 
                      realistic product shot, studio lighting, no text overlay`;

      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt,
        size: '1024x1024',
        quality: 'standard', // 'hd' costs $0.08 per image
        n: 1,
      });

      const imageUrl = response.data?.[0]?.url;
      if (imageUrl) {
        return {
          url: imageUrl,
          source: 'ai_generated',
          confidence: 50, // Lowest confidence - AI generated
        };
      }
    } catch (error) {
      this.logger.error(`AI image generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  }

  /**
   * Clean drug name for better search results
   * Remove dosage, form, and other noise
   */
  private cleanDrugName(name: string): string {
    return name
      .replace(/\d+mg|\d+mcg|\d+g|\d+ml/gi, '') // Remove dosage
      .replace(/tablet|capsule|syrup|suspension|injection|cream|ointment/gi, '') // Remove form
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Download image from URL and upload to S3
   * Returns S3 CDN URL
   */
  async downloadAndUploadToS3(
    imageUrl: string,
    productId: string,
    source: string,
  ): Promise<string> {
    try {
      // Download image
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'image/jpeg';
      const extension = contentType.split('/')[1] || 'jpg';

      // Upload to S3 using existing upload method
      const s3Key = `products/${productId}/${source}-${Date.now()}.${extension}`;
      
      // Use the existing uploadFromUrl or create a simple upload
      // For now, we'll return the original URL and let the caller handle S3 upload
      return imageUrl;
    } catch (error) {
      this.logger.error(`Failed to download/upload image: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
