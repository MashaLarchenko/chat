import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL

if (!connectionString) throw new Error('DATABASE_URL is not defined')

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME ?? 'Administrator'

  if (!email) throw new Error('ADMIN_EMAIL is not defined')
  if (!password) throw new Error('ADMIN_PASSWORD is not defined')

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.upsert({
    where: { email },
    update: { name, password: passwordHash, role: 'ADMIN' },
    create: { email, name, password: passwordHash, role: 'ADMIN' },
  })

  console.log(`✅ Admin user ready: ${email}`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })