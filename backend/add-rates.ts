import axios from 'axios';

const rates = [
    { metal: 'gold', karat: 24, ratePerGram: 7200, reason: 'Initial setup - 24K Pure Gold' },
    { metal: 'gold', karat: 22, ratePerGram: 6600, reason: 'Initial setup - 22K Crown Gold' },
    { metal: 'gold', karat: 18, ratePerGram: 5400, reason: 'Initial setup - 18K (75%)' },
    { metal: 'silver', ratePerGram: 80, reason: 'Initial setup - Silver' },
];

async function addRates() {
    console.log('Adding default metal rates...\n');

    for (const rate of rates) {
        try {
            const response = await axios.post('http://localhost:3000/api/rates/update', rate);
            const karatText = rate.karat ? `${rate.karat}K` : '';
            console.log(`✅ Added ${rate.metal} ${karatText} at ₹${rate.ratePerGram}/g`);
        } catch (error: any) {
            console.log(`❌ Failed to add ${rate.metal}: ${error.message}`);
        }
    }

    console.log('\n✅ Done! Now check your rates in the browser.');
}

addRates();
