import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus, RoleSlug } from '../../../generated/prisma/client';

export class MeSectorStatusCountDto {
  @ApiProperty({ enum: RequestStatus })
  status: RequestStatus;

  @ApiProperty()
  count: number;
}

export class MeSectorResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ enum: RoleSlug, nullable: true })
  role: RoleSlug | null;

  @ApiProperty()
  onlyManagerCanView: boolean;

  @ApiProperty()
  onlyManagerCanEdit: boolean;

  @ApiProperty()
  onlyManagerCanArchive: boolean;

  @ApiProperty({ type: [MeSectorStatusCountDto] })
  statusCounts: MeSectorStatusCountDto[];
}
