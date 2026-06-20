import { Prisma } from '../../generated/prisma/client';

export const messageAuthorSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  email: true,
} satisfies Prisma.UserSelect;

export const requestMessagesInclude = {
  orderBy: { createdAt: 'asc' as const },
  include: {
    user: { select: messageAuthorSelect },
  },
};
