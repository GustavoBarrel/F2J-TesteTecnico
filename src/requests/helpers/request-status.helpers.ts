import { Prisma, RequestStatus } from '../../../generated/prisma/client';

export function buildSolvedAtUpdate(
  fromStatus: RequestStatus,
  toStatus: RequestStatus,
): Pick<Prisma.RequestUpdateInput, 'solvedAt'> {
  if (
    toStatus === RequestStatus.SOLVED &&
    fromStatus !== RequestStatus.SOLVED
  ) {
    return { solvedAt: new Date() };
  }

  if (
    fromStatus === RequestStatus.SOLVED &&
    toStatus !== RequestStatus.SOLVED
  ) {
    return { solvedAt: null };
  }

  return {};
}
