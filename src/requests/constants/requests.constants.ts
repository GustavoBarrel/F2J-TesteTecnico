import { Prisma, RequestStatus } from '../../../generated/prisma/client';

export const requestUserSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  email: true,
} satisfies Prisma.UserSelect;

export const LOCKED_REQUEST_STATUSES: RequestStatus[] = [
  RequestStatus.SOLVED,
  RequestStatus.COMPLETED,
  RequestStatus.CANCELLED,
  RequestStatus.ARCHIVED,
];
