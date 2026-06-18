import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSectorserviceDto } from './dto/create-sector-service.dto';
import { UpdateSectorserviceDto } from './dto/update-sector-service.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { SectorServiceResponseDto } from './dto/sector-service-response.dto';
import { SectorsService } from 'src/sectors/sectors.service';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { FindAllQueryDto } from 'src/common/dto/find-all-query.dto';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from 'src/common/dto/pagination-query.dto';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class SectorservicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sectorsService: SectorsService,
  ) {}

  async create(
    sectorId: string,
    createSectorserviceDto: CreateSectorserviceDto,
  ): Promise<SectorServiceResponseDto> {
    await this.sectorsService.findOne(sectorId);

    const created = await this.prisma.sectorService.create({
      data: {
        ...createSectorserviceDto,
        sectorId,
      },
    });

    return created;
  }

  async findAll(
    sectorId: string,
    query: FindAllQueryDto,
  ): Promise<PaginatedResponseDto<SectorServiceResponseDto>> {
    await this.sectorsService.findOne(sectorId);

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.SectorServiceWhereInput = {
      sectorId,
      isActive: query.isActive ?? undefined,
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.sectorService.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sectorService.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    id: string,
    sectorId: string,
  ): Promise<SectorServiceResponseDto> {
    await this.sectorsService.findOne(sectorId);

    const service = await this.prisma.sectorService.findFirst({
      where: { id, sectorId },
    });

    if (!service) {
      throw new NotFoundException('Serviço do Setor não encontrado');
    }

    return service;
  }

  async update(
    id: string,
    sectorId: string,
    updateSectorserviceDto: UpdateSectorserviceDto,
  ): Promise<SectorServiceResponseDto> {
    await this.findOne(id, sectorId);

    const updatedSectorService = await this.prisma.sectorService.update({
      where: { id },
      data: updateSectorserviceDto,
    });

    return updatedSectorService;
  }

  async toggleActive(
    id: string,
    sectorId: string,
  ): Promise<SectorServiceResponseDto> {
    const service = await this.findOne(id, sectorId);

    const updated = await this.prisma.sectorService.update({
      where: { id },
      data: { isActive: !service.isActive },
    });

    return updated;
  }
}
