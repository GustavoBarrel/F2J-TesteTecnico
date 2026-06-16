import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, RoleSlug } from '../generated/prisma/client.js';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_ROLES = [
  {
    slug: RoleSlug.MANAGER,
    name: 'Gerente',
    description: 'Gerencia fila do setor: atribui, cancela e muda status',
  },
  {
    slug: RoleSlug.TECHNICIAN,
    name: 'Técnico',
    description: 'Atua nas solicitações atribuídas a ele',
  },
] as const;

const DEFAULT_ADMIN = {
  email: 'admin@servicehub.com',
  password: 'admin123',
  username: 'admin',
  firstName: 'Admin',
  lastName: 'Sistema',
} as const;

async function main() {
  for (const role of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: { slug: role.slug },
      update: {
        name: role.name,
        description: role.description,
      },
      create: role,
    });
  }

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, SALT_ROUNDS);

  await prisma.user.upsert({
    where: { email: DEFAULT_ADMIN.email },
    update: {
      username: DEFAULT_ADMIN.username,
      firstName: DEFAULT_ADMIN.firstName,
      lastName: DEFAULT_ADMIN.lastName,
      isGlobalAdmin: true,
      isActive: true,
    },
    create: {
      email: DEFAULT_ADMIN.email,
      password: passwordHash,
      username: DEFAULT_ADMIN.username,
      firstName: DEFAULT_ADMIN.firstName,
      lastName: DEFAULT_ADMIN.lastName,
      isGlobalAdmin: true,
      isActive: true,
    },
  });

  console.log(
    'Seed concluído:',
    `roles (${DEFAULT_ROLES.map((r) => r.slug).join(', ')})`,
    `admin (${DEFAULT_ADMIN.email} / ${DEFAULT_ADMIN.password})`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
