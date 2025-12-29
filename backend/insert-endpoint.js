const fs = require('fs');

// Read both files
const serverContent = fs.readFileSync('src/server-simple.ts', 'utf8');
const endpointContent = fs.readFileSync('apply-settings-endpoint.ts', 'utf8');

// Find the location to insert (after app.put('/api/settings'...))
const insertMarker = /app\.put\('\/api\/settings',[\s\S]*?\}\);/;
const match = serverContent.match(insertMarker);

if (match) {
    const insertPosition = serverContent.indexOf(match[0]) + match[0].length;
    const newContent =
        serverContent.slice(0, insertPosition) +
        '\n\n' + endpointContent + '\n' +
        serverContent.slice(insertPosition);

    fs.writeFileSync('src/server-simple.ts', newContent, 'utf8');
    console.log('✅ Successfully added apply-to-all endpoint');
} else {
    console.log('❌ Could not find insertion point');
}
