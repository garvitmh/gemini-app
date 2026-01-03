// Test the CZ display logic
const gemType = 'Cz';
const gemWeight = 4; // carats
const gemCost = 80000; // in paise (₹800)

const isCZ = gemType && (gemType.toLowerCase() === 'cz' || gemType.toLowerCase() === 'cubic zirconia' || gemType.toLowerCase() === 'cz cubic zirconia');

console.log('Is CZ?', isCZ);
console.log('Gem Type:', gemType);
console.log('Weight (carats):', gemWeight);
console.log('Cost (paise):', gemCost);

if (gemWeight) {
    const rate = Math.round((gemCost / 100 / gemWeight) || 0);
    console.log('Rate per carat:', rate);

    if (isCZ) {
        // CZ: Convert carat weight to grams (1 carat = 0.2 grams) and show rate per gram
        const weightGrams = (gemWeight * 0.2).toFixed(2);
        const ratePerGram = Math.round(rate / 0.2); // Convert rate from per-carat to per-gram
        const gemSubtext = `${weightGrams}gm × ₹${ratePerGram.toLocaleString()}/gm`;
        console.log('CZ Display:', gemSubtext);
    } else {
        const gemSubtext = `${gemWeight}ct × ₹${rate.toLocaleString()}/ct`;
        console.log('Regular Display:', gemSubtext);
    }
}
