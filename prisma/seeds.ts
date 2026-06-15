import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, RoleSlug } from '../generated/prisma/client.js';

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

  console.log(
    'Roles padrão criadas:',
    DEFAULT_ROLES.map((r) => r.slug).join(', '),
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
