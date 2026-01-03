
const axios = require('axios');

async function checkProduct() {
    try {
        const response = await axios.get('http://localhost:3005/api/products');
        const products = response.data.products || [];
        const product = products.find(p => p.title.includes('CHAIN BRACELET 18K'));

        if (product) {
            console.log('Found product:', JSON.stringify(product, null, 2));
        } else {
            console.log('Product not found. First 3 products:', JSON.stringify(products.slice(0, 3), null, 2));
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkProduct();
