const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const username = 'admin';
  const plainPassword = 'gemini_dashboard_secret';
  
  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  
  const existingUser = await prisma.adminUser.findUnique({
    where: { username }
  });
  
  if (existingUser) {
    console.log(`User ${username} already exists. Updating password...`);
    await prisma.adminUser.update({
      where: { username },
      data: { password: hashedPassword }
    });
  } else {
    console.log(`Creating user ${username}...`);
    await prisma.adminUser.create({
      data: {
        username,
        password: hashedPassword
      }
    });
  }
  
  console.log(`Successfully configured user: ${username}`);
  console.log(`Password: ${plainPassword}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
