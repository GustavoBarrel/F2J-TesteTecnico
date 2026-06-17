import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RoleOptionResponseDto } from './dto/role-response.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findOptions(): Promise<RoleOptionResponseDto[]> {
    return this.prisma.role.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        slug: true,
      },
    });
  }

  async findOne(id: string): Promise<RoleOptionResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        slug: true,
      },
    });

    if (!role) {
      throw new NotFoundException('Cargo não encontrado');
    }

    return role;
  }
}
