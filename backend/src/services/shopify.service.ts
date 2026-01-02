import { GraphQLClient, gql } from 'graphql-request';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ProductVariantUpdate {
  variantId: string;
  price: number;
}

export class ShopifyService {
  private client: GraphQLClient;
  private shopDomain: string;

  constructor(shopDomain: string, accessToken: string) {
    this.shopDomain = shopDomain;
    this.client = new GraphQLClient(
      `https://${shopDomain}/admin/api/2024-01/graphql.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      }
    );
  }

  /**
   * Update a single product variant price
   */
  async updateVariantPrice(variantId: string, price: number): Promise<boolean> {
    const mutation = gql`
      mutation productVariantUpdate($input: ProductVariantInput!) {
        productVariantUpdate(input: $input) {
          productVariant {
            id
            price
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    try {
      const result: any = await this.client.request(mutation, {
        input: {
          id: variantId,
          price: price.toString(),
        },
      });

      if (result.productVariantUpdate.userErrors.length > 0) {
        throw new Error(result.productVariantUpdate.userErrors[0].message);
      }

      return true;
    } catch (error) {
      console.error(`Error updating variant ${variantId}:`, error);
      throw error;
    }
  }

  /**
   * Update multiple variant prices in batch
   * Uses rate limiting to avoid hitting Shopify API limits
   */
  async updateVariantPricesBatch(
    updates: ProductVariantUpdate[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<{ success: string[]; failed: Array<{ variantId: string; error: string }> }> {
    const success: string[] = [];
    const failed: Array<{ variantId: string; error: string }> = [];

    // Process in batches of 10 with delay to respect rate limits
    const batchSize = 10;
    const delayMs = 1000; // 1 second delay between batches

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (update) => {
          try {
            await this.updateVariantPrice(update.variantId, update.price);
            success.push(update.variantId);
          } catch (error) {
            failed.push({
              variantId: update.variantId,
              error: (error as Error).message,
            });
          }
        })
      );

      if (onProgress) {
        onProgress(Math.min(i + batchSize, updates.length), updates.length);
      }

      // Delay between batches (except for the last batch)
      if (i + batchSize < updates.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return { success, failed };
  }

  /**
   * Use Shopify Bulk Operations for large updates (10k+ products)
   * This is more efficient and doesn't hit rate limits
   */
  async updateVariantPricesBulk(updates: ProductVariantUpdate[]): Promise<string> {
    // Create JSONL data for bulk operation
    const jsonlData = updates
      .map((update) => {
        return JSON.stringify({
          input: {
            id: update.variantId,
            price: update.price.toString(),
          },
        });
      })
      .join('\n');

    // Upload to Shopify's staged uploads
    const stagedUploadMutation = gql`
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const uploadResult: any = await this.client.request(stagedUploadMutation, {
      input: [
        {
          resource: 'BULK_MUTATION_VARIABLES',
          filename: 'bulk-update.jsonl',
          mimeType: 'text/jsonl',
          httpMethod: 'POST',
        },
      ],
    });

    const stagedTarget = uploadResult.stagedUploadsCreate.stagedTargets[0];

    // Upload JSONL data to staged URL
    const formData = new FormData();
    stagedTarget.parameters.forEach((param: any) => {
      formData.append(param.name, param.value);
    });
    formData.append('file', new Blob([jsonlData], { type: 'text/jsonl' }));

    await fetch(stagedTarget.url, {
      method: 'POST',
      body: formData,
    });

    // Start bulk operation
    const bulkMutation = gql`
      mutation bulkOperationRunMutation($mutation: String!, $stagedUploadPath: String!) {
        bulkOperationRunMutation(mutation: $mutation, stagedUploadPath: $stagedUploadPath) {
          bulkOperation {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const bulkResult: any = await this.client.request(bulkMutation, {
      mutation: `
        mutation productVariantUpdate($input: ProductVariantInput!) {
          productVariantUpdate(input: $input) {
            productVariant {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      stagedUploadPath: stagedTarget.resourceUrl,
    });

    return bulkResult.bulkOperationRunMutation.bulkOperation.id;
  }

  /**
   * Check bulk operation status
   */
  async getBulkOperationStatus(operationId: string): Promise<{
    status: string;
    objectCount?: number;
    errorCode?: string;
  }> {
    const query = gql`
      query {
        node(id: "${operationId}") {
          ... on BulkOperation {
            id
            status
            errorCode
            objectCount
            fileSize
            url
          }
        }
      }
    `;

    const result: any = await this.client.request(query);
    return result.node;
  }

  /**
   * Sync products from Shopify to local database
   */
  /**
   * Sync products from Shopify to local database
   */
  async syncProducts(shopId: string): Promise<{
    success: boolean;
    jobId: string;
    counts: {
      fetched: number;
      created: number;
      updated: number;
      deleted: number;
      unchanged: number;
    }
  }> {
    // 1. Create Job Record
    const job = await prisma.job.create({
      data: {
        shopId,
        jobType: 'product_sync',
        status: 'processing',
        startedAt: new Date(),
        totalItems: 0,
        processedItems: 0,
        result: JSON.stringify({
          counts: { fetched: 0, created: 0, updated: 0, deleted: 0, unchanged: 0 }
        })
      }
    });

    const counts = {
      fetched: 0,
      created: 0,
      updated: 0,
      deleted: 0,
      unchanged: 0
    };

    const query = gql`
      query($after: String) {
        products(first: 250, after: $after) {
          edges {
            node {
              id
              title
              status
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
                    inventoryQuantity
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    let hasNextPage = true;
    let cursor: string | null = null;
    let iteration = 0;
    const MAX_PAGES = 100; // Safety guard
    const allSeenVariantIds = new Set<string>();

    try {
      while (hasNextPage && iteration < MAX_PAGES) {
        iteration++;
        const result: any = await this.client.request(query, { after: cursor });
        const products = result.products.edges;

        for (const productEdge of products) {
          const product = productEdge.node;

          for (const variantEdge of product.variants.edges) {
            const variant = variantEdge.node;
            counts.fetched++;
            allSeenVariantIds.add(variant.id);

            try {
              const price = parseFloat(variant.price);
              const safePrice = isNaN(price) ? 0 : price;

              // OPTIMIZATION: Check if exists and needs update
              const existing = await prisma.product.findUnique({
                where: { shopifyVariantId: variant.id }
              });

              if (existing) {
                // Check for changes
                const hasChanges =
                  existing.title !== product.title ||
                  existing.variantTitle !== variant.title ||
                  existing.sku !== (variant.sku || null) ||
                  Math.abs((existing.currentPrice || 0) - safePrice) > 0.01 || // Float comparison
                  existing.status !== product.status; // Sync Shopify status too

                if (hasChanges) {
                  await prisma.product.update({
                    where: { id: existing.id },
                    data: {
                      title: product.title,
                      variantTitle: variant.title,
                      sku: variant.sku || null,
                      currentPrice: safePrice,
                      status: product.status, // ACTIVE/ARCHIVED/DRAFT
                      updatedAt: new Date()
                    }
                  });
                  counts.updated++;
                } else {
                  counts.unchanged++;
                }
              } else {
                // New Product
                await prisma.product.create({
                  data: {
                    shopId,
                    shopifyProductId: product.id,
                    shopifyVariantId: variant.id,
                    sku: variant.sku || null,
                    title: product.title,
                    variantTitle: variant.title,
                    currentPrice: safePrice,
                    status: product.status,
                  }
                });
                counts.created++;
              }
            } catch (upsertError: any) {
              console.error(`[SYNC] Failed to process variant ${variant.id}:`, (upsertError as Error).message);
            }
          }
        }

        // Update Job Progress
        await prisma.job.update({
          where: { id: job.id },
          data: {
            processedItems: counts.fetched,
            result: JSON.stringify({ counts })
          }
        });

        hasNextPage = result.products.pageInfo.hasNextPage;
        cursor = result.products.pageInfo.endCursor;
      }

      if (iteration >= MAX_PAGES) {
        console.warn(`[SYNC] Reached MAX_PAGES guard (${MAX_PAGES}).`);
      }

      // DELETION DETECTION (Feature 2)
      // Find products in DB that were NOT seen in this sync
      const deletedInShopify = await prisma.product.findMany({
        where: {
          shopId,
          shopifyVariantId: { notIn: Array.from(allSeenVariantIds) }
        },
        select: { id: true }
      });

      if (deletedInShopify.length > 0) {
        const idsToDelete = deletedInShopify.map(p => p.id);
        // SAFETY: Instead of hard delete, we mark as 'deleted' status
        // Assuming 'deleted' is not a standard Shopify status so it distinguishes them
        await prisma.product.updateMany({
          where: { id: { in: idsToDelete } },
          data: { status: 'deleted' }
        });
        counts.deleted = idsToDelete.length;
      }

      // Final Job Update
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          totalItems: counts.fetched,
          processedItems: counts.fetched,
          result: JSON.stringify({ counts })
        }
      });

      return {
        success: true,
        jobId: job.id,
        counts
      };

    } catch (queryError: any) {
      console.error(`[SYNC] Sync Failed:`, queryError.message);

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: queryError.message,
          result: JSON.stringify({ counts })
        }
      });

      throw queryError;
    }
  }

  /**
   * Create Shopify service instance for a shop
   */
  static async forShop(shopDomain: string): Promise<ShopifyService> {
    const shop = await prisma.shop.findUnique({
      where: { domain: shopDomain },
    });

    if (!shop || !shop.accessToken) {
      throw new Error(`Shop ${shopDomain} not found or not authenticated`);
    }

    return new ShopifyService(shopDomain, shop.accessToken);
  }
}
