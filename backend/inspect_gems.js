
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const productId = 'cmjwtn3640012tubhbq2dmkr4';
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { gemstones: true }
        });

        if (!product) {
            console.log('Product not found');
            return;
        }

        console.log('Product Gemstones:');
        product.gemstones.forEach(g => {
            console.log(`Type: '${g.gemstoneType}', Weight: ${g.gemstoneWeight}`);
            console.log(`Debug Char Codes: ${g.gemstoneType.split('').map(c => c.charCodeAt(0)).join(',')}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
