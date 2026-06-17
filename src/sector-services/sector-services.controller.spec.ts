import { Test, TestingModule } from '@nestjs/testing';
import { SectorservicesController } from './sector-services.controller';
import { SectorservicesService } from './sector-services.service';

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
