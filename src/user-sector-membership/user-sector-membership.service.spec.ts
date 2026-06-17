import { Test, TestingModule } from '@nestjs/testing';
import { UserSectorMembershipService } from './user-sector-membership.service';

describe('UserSectorMembershipService', () => {
  let service: UserSectorMembershipService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserSectorMembershipService],
    }).compile();

    service = module.get<UserSectorMembershipService>(
      UserSectorMembershipService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
