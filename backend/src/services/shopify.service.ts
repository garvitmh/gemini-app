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
  async syncProducts(shopId: string): Promise<number> {
    const query = gql`
      query($after: String) {
        products(first: 250, after: $after) {
          edges {
            node {
              id
              title
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
    let syncedCount = 0;
    let iteration = 0;
    const MAX_PAGES = 100; // Safety guard

    while (hasNextPage && iteration < MAX_PAGES) {
      iteration++;
      try {
        const result: any = await this.client.request(query, { after: cursor });
        const products = result.products.edges;

        for (const productEdge of products) {
          const product = productEdge.node;

          for (const variantEdge of product.variants.edges) {
            const variant = variantEdge.node;

            try {
              const price = parseFloat(variant.price);
              if (isNaN(price)) {
                console.warn(`[SYNC] Invalid price for ${variant.sku || 'Unknown'}: ${variant.price}`);
              }

              await prisma.product.upsert({
                where: { shopifyVariantId: variant.id },
                create: {
                  shopId,
                  shopifyProductId: product.id,
                  shopifyVariantId: variant.id,
                  sku: variant.sku || null,
                  title: product.title,
                  variantTitle: variant.title,
                  currentPrice: isNaN(price) ? 0 : price,
                },
                update: {
                  title: product.title,
                  variantTitle: variant.title,
                  currentPrice: isNaN(price) ? 0 : price,
                  sku: variant.sku || null,
                },
              });
              syncedCount++;
            } catch (upsertError: any) {
              console.error(`[SYNC] Failed to upsert variant ${variant.id}:`, (upsertError as Error).message);
            }
          }
        }

        hasNextPage = result.products.pageInfo.hasNextPage;
        cursor = result.products.pageInfo.endCursor;
      } catch (queryError: any) {
        console.error(`[SYNC]   GraphQL Query Failed:`, queryError.message);
        throw queryError;
      }
    }

    if (iteration >= MAX_PAGES) {
      console.warn(`[SYNC] Reached MAX_PAGES guard (${MAX_PAGES}). Aborting.`);
    }

    return syncedCount;
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
