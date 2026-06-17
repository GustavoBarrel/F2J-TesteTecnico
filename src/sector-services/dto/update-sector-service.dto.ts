import { PartialType } from '@nestjs/swagger';
import { CreateSectorserviceDto } from './create-sector-service.dto';

export class UpdateSectorserviceDto extends PartialType(
  CreateSectorserviceDto,
) {}
