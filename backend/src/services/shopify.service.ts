import axios from 'axios';
import NodeCache from 'node-cache';

const collectionCache = new NodeCache({ stdTTL: 300 }); // Cache for 5 minutes

export class ShopifyService {
  private static shopDomainEnv = process.env.SHOPIFY_STORE || 'daginawala11.myshopify.com';

  // Instance properties for legacy support (BulkPriceUpdateService)
  private domain: string;
  private accessToken: string;

  constructor(domain: string, accessToken: string) {
    this.domain = domain;
    this.accessToken = accessToken;
  }

  // Restore forShop method for BulkPriceUpdateService
  static async forShop(domain: string): Promise<ShopifyService> {
    // In a real app, we'd fetch the token for the shop from DB.
    // Here we rely on env as per current simplified setup.
    return new ShopifyService(domain, process.env.SHOPIFY_ACCESS_TOKEN || '');
  }

  // Restore updateVariantPricesBatch for BulkPriceUpdateService
  async updateVariantPricesBatch(updates: { variantId: string; price: number }[]): Promise<void> {
    console.log(`Pushing ${updates.length} price updates to Shopify...`);
    for (const update of updates) {
      try {
        // update.variantId is likely a GID: gid://shopify/ProductVariant/12345
        // We need numeric ID for REST API
        const idMatch = update.variantId.match(/ProductVariant\/(\d+)/);
        const id = idMatch ? idMatch[1] : update.variantId;

        await axios.put(
          `https://${this.domain}/admin/api/2024-01/variants/${id}.json`,
          {
            variant: {
              id: id,
              price: update.price
            }
          },
          { headers: ShopifyService.getHeaders(this.accessToken) }
        );
      } catch (error) {
        console.error(`Failed to update variant ${update.variantId} on Shopify:`, error);
        // We continue with other updates even if one fails
      }
    }
  }


  // Helper to get headers
  private static getHeaders(accessToken: string) {
    return {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    };
  }

  // Fetch all collections (id, title) - cached
  static async getAllCollections(accessToken: string): Promise<any[]> {
    const cacheKey = `collections_${accessToken}`;
    // Explicit cast to fix TS error
    const cached = collectionCache.get(cacheKey) as any[] | undefined;
    if (cached) return cached;

    try {
      console.log('Fetching collections from Shopify...');
      const query = `
                {
                    collections(first: 250) {
                        edges {
                            node {
                                id
                                title
                            }
                        }
                    }
                }
            `;

      const response: any = await axios.post(
        `https://${this.shopDomainEnv}/admin/api/2024-01/graphql.json`,
        { query },
        { headers: this.getHeaders(accessToken) }
      );

      if (response.data.errors) {
        console.error('Shopify GraphQL Error:', response.data.errors);
        return [];
      }

      const collections = response.data.data.collections.edges.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
      }));

      let hasNextPage = response.data.data.collections.pageInfo?.hasNextPage;
      let endCursor = response.data.data.collections.pageInfo?.endCursor;

      while (hasNextPage) {
        const nextQuery = `
                    {
                        collections(first: 250, after: "${endCursor}") {
                            edges {
                                node {
                                    id
                                    title
                                }
                            }
                            pageInfo {
                                hasNextPage
                                endCursor
                            }
                        }
                    }
                `;
        const nextRes: any = await axios.post(
          `https://${this.shopDomainEnv}/admin/api/2024-01/graphql.json`,
          { query: nextQuery },
          { headers: this.getHeaders(accessToken) }
        );

        const nextEdges = nextRes.data.data.collections.edges || [];
        collections.push(...nextEdges.map((edge: any) => ({
          id: edge.node.id,
          title: edge.node.title,
        })));

        hasNextPage = nextRes.data.data.collections.pageInfo?.hasNextPage;
        endCursor = nextRes.data.data.collections.pageInfo?.endCursor;
      }

      collectionCache.set(cacheKey, collections);
      return collections;

    } catch (error) {
      console.error('Error fetching collections:', error);
      return [];
    }
  }

  // Get Product IDs for a collection
  static async getCollectionProductIds(accessToken: string, collectionId: string): Promise<string[]> {
    const cacheKey = `col_products_${collectionId}`;
    // Explicit cast to fix TS error
    const cached = collectionCache.get(cacheKey) as string[] | undefined;
    if (cached) return cached;

    try {
      console.log(`Fetching products for collection ${collectionId}...`);

      let allProductIds: string[] = [];
      let hasNextPage = true;
      let cursor = null;

      while (hasNextPage) {
        const query = `
                    query($id: ID!, $cursor: String) {
                        collection(id: $id) {
                            products(first: 250, after: $cursor) {
                                edges {
                                    node {
                                        id
                                    }
                                }
                                pageInfo {
                                    hasNextPage
                                    endCursor
                                }
                            }
                        }
                    }
                `;

        const variables: any = { id: collectionId, cursor };
        const response: any = await axios.post(
          `https://${this.shopDomainEnv}/admin/api/2024-01/graphql.json`,
          { query, variables },
          { headers: this.getHeaders(accessToken) }
        );

        if (response.data.errors) {
          console.error('Shopify GraphQL Error (Collection Products):', response.data.errors);
          break;
        }

        const data = response.data.data.collection?.products;
        if (!data) break;

        allProductIds.push(...data.edges.map((e: any) => e.node.id)); // These are GIDs e.g. gid://shopify/Product/123

        hasNextPage = data.pageInfo.hasNextPage;
        cursor = data.pageInfo.endCursor;
      }

      collectionCache.set(cacheKey, allProductIds, 60); // Cache for 1 min
      return allProductIds;

    } catch (error) {
      console.error(`Error fetching products for collection ${collectionId}:`, error);
      return [];
    }
  }
}
