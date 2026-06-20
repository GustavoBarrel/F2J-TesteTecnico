import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SectorsService } from './sectors.service';
import { FindServiceOptionsResponseDto } from './dto/find-service-options-response.dto';

@ApiTags('Setores')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token inválido ou não informado' })
@Controller('sectors')
export class SectorsController {
  constructor(private readonly sectorsService: SectorsService) {}

  @Get('services/options')
  @ApiOperation({ summary: 'Listar opções de serviços para um setor' })
  @ApiOkResponse({ type: FindServiceOptionsResponseDto })
  findSectorServicesOptions(): Promise<FindServiceOptionsResponseDto[]> {
    return this.sectorsService.findSectorServicesOptions();
  }
}
