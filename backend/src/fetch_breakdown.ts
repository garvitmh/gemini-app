
import axios from 'axios';

async function main() {
    try {
        const id = 'cmjwtn3640012tubhbq2dmkr4';
        const url = `http://localhost:3005/api/products/${id}/price-breakdown`;
        const res = await axios.get(url);
        console.log(JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error(e.message);
    }
}
main();
