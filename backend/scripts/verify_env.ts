
import 'dotenv/config';

console.log('--- Environment Check ---');
console.log(`CWD: ${process.cwd()}`);
console.log(`SHOPIFY_STORE: ${process.env.SHOPIFY_STORE}`);
const token = process.env.SHOPIFY_ACCESS_TOKEN;
if (token) {
    console.log(`SHOPIFY_ACCESS_TOKEN: Present (Length: ${token.length})`);
    console.log(`Token Prefix: ${token.substring(0, 10)}...`);
} else {
    console.log('SHOPIFY_ACCESS_TOKEN: NOT FOUND');
}
