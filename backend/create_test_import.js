const fs = require('fs');
const path = require('path');

// Create a simple test Excel file with one product
const testData = `SKU,Title,Status,Metal Type,Metal Purity,Metal Weight (g),Gross Weight (g),Wastage %,Stone 1: Used,Stone 1: Type,Stone 1: Shape,Stone 1: Quality,Stone 1: Color,Stone 1: Clarity,Stone 1: Cut,Stone 1: Weight (ct),Stone 1: Pieces,Stone 1: Rate Type,Stone 1: Rate Value,Stone 1: Custom,Stone 2: Used,Stone 3: Used,Enamel Color,Enamel Weight (g),Enamel Discount Type,Enamel Discount Value,Discount Type,Discount Value,GST %
SRJ-LR-3500,Test Ring,active,gold,22,15,16,2,FALSE,,,,,,,,,,,,FALSE,FALSE,,,none,0,flat,0,3`;

const outputPath = path.join(__dirname, 'test_import_single.csv');
fs.writeFileSync(outputPath, testData);

console.log(`Created test import file: ${outputPath}`);
console.log('\nFile contents:');
console.log(testData);
console.log('\n\nTo test:');
console.log('1. Go to http://localhost:5173/products');
console.log('2. Click "Import CSV/Excel"');
console.log('3. Upload this file: test_import_single.csv');
console.log('4. Check the backend logs for [IMPORT] messages');
