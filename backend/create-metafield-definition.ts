import 'dotenv/config';
import axios from 'axios';

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

/**
 * This script creates the metafield definition for gemini.price_breakdown
 * in your Shopify store. This ensures Shopify recognizes the metafield
 * and allows it to be used in Liquid templates.
 */

async function createMetafieldDefinition() {
    if (!SHOPIFY_STORE || !SHOPIFY_ACCESS_TOKEN) {
        console.error('❌ Missing SHOPIFY_STORE or SHOPIFY_ACCESS_TOKEN in .env file');
        process.exit(1);
    }

    console.log(`\n🔧 Creating metafield definition for ${SHOPIFY_STORE}...\n`);

    try {
        // Create metafield definition using GraphQL Admin API
        const mutation = `
            mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
                metafieldDefinitionCreate(definition: $definition) {
                    createdDefinition {
                        id
                        name
                        namespace
                        key
                        type {
                            name
                        }
                        ownerType
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        `;

        const variables = {
            definition: {
                name: "Price Breakdown",
                namespace: "gemini",
                key: "price_breakdown",
                description: "Detailed price breakdown for jewelry products including metal, gemstones, making charges, and GST",
                type: "json",
                ownerType: "PRODUCTVARIANT",
                access: {
                    storefront: "PUBLIC_READ_WRITE"
                }
            }
        };

        const response = await axios.post(
            `https://${SHOPIFY_STORE}/admin/api/2024-01/graphql.json`,
            {
                query: mutation,
                variables: variables
            },
            {
                headers: {
                    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                    'Content-Type': 'application/json',
                }
            }
        );

        const result = response.data.data.metafieldDefinitionCreate;

        if (result.userErrors && result.userErrors.length > 0) {
            console.error('❌ Errors creating metafield definition:');
            result.userErrors.forEach((error: any) => {
                console.error(`   - ${error.field}: ${error.message}`);
            });

            // Check if error is because it already exists
            if (result.userErrors.some((e: any) => e.message.includes('already exists') || e.message.includes('taken'))) {
                console.log('\n✅ Metafield definition already exists - this is OK!');
                console.log('   You can proceed with using the metafield.\n');
                return;
            }

            process.exit(1);
        }

        console.log('✅ Metafield definition created successfully!');
        console.log('\nDetails:');
        console.log(`   ID: ${result.createdDefinition.id}`);
        console.log(`   Name: ${result.createdDefinition.name}`);
        console.log(`   Namespace: ${result.createdDefinition.namespace}`);
        console.log(`   Key: ${result.createdDefinition.key}`);
        console.log(`   Type: ${result.createdDefinition.type.name}`);
        console.log(`   Owner: ${result.createdDefinition.ownerType}`);
        console.log('\n✅ You can now use this metafield in your Liquid templates!\n');

    } catch (error: any) {
        console.error('\n❌ Failed to create metafield definition');
        console.error(`   Error: ${error.message}`);

        if (error.response) {
            console.error(`   HTTP Status: ${error.response.status}`);
            console.error(`   Response:`, JSON.stringify(error.response.data, null, 2));
        }

        process.exit(1);
    }
}

createMetafieldDefinition();
