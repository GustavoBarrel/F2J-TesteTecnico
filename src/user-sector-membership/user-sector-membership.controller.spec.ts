import { Test, TestingModule } from '@nestjs/testing';
import { UserSectorMembershipController } from './user-sector-membership.controller';
import { UserSectorMembershipService } from './user-sector-membership.service';

describe('UserSectorMembershipController', () => {
  let controller: UserSectorMembershipController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserSectorMembershipController],
      providers: [UserSectorMembershipService],
    }).compile();

    controller = module.get<UserSectorMembershipController>(
      UserSectorMembershipController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
