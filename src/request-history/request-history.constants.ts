import { Prisma } from '../../generated/prisma/client';

export const historyUserSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  email: true,
} satisfies Prisma.UserSelect;
