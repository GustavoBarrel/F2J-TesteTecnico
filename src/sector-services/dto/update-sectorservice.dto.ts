import { PartialType } from '@nestjs/swagger';
import { CreateSectorserviceDto } from './create-sectorservice.dto';

export class UpdateSectorserviceDto extends PartialType(CreateSectorserviceDto) {}
