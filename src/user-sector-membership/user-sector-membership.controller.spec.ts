import { Test, TestingModule } from '@nestjs/testing';
import { UserSectorMembershipController } from './user-sector-membership.controller';
import { UserSectorMembershipService } from './user-sector-membership.service';

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('UserSectorMembershipController', () => {
  let controller: UserSectorMembershipController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserSectorMembershipController],
      providers: [
        { provide: UserSectorMembershipService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<UserSectorMembershipController>(
      UserSectorMembershipController,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
