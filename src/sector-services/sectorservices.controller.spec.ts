import { Test, TestingModule } from '@nestjs/testing';
import { SectorservicesController } from './sectorservices.controller';
import { SectorservicesService } from './sectorservices.service';

describe('SectorservicesController', () => {
  let controller: SectorservicesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SectorservicesController],
      providers: [SectorservicesService],
    }).compile();

    controller = module.get<SectorservicesController>(SectorservicesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
