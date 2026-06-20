import {
  Request,
  Role,
  Sector,
  UserSectorMembership,
} from '../../../generated/prisma/client';

export type MembershipWithSector = UserSectorMembership & {
  role: Role;
  sector: Sector;
};

export type RequestUserSummary = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type RequestWithAccess = Request & {
  assignees?: Array<{ userId: string; user?: RequestUserSummary }>;
  observers?: Array<{ userId: string; user?: RequestUserSummary }>;
};
