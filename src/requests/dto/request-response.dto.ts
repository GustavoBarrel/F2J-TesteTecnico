import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  RequestPriority,
  RequestStatus,
} from '../../../generated/prisma/client';
import { RequestPermissionsDto } from './request-permissions.dto';
import { RequestHistoryAction } from '../../../generated/prisma/client';

export class RequestUserSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;
}

export class RequestSectorSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  onlyManagerCanView: boolean;

  @ApiProperty()
  onlyManagerCanEdit: boolean;

  @ApiProperty()
  onlyManagerCanArchive: boolean;
}

export class RequestServiceSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

export class RequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: RequestStatus })
  status: RequestStatus;

  @ApiProperty({ enum: RequestPriority })
  priority: RequestPriority;

  @ApiProperty()
  sectorId: string;

  @ApiProperty()
  sectorServiceId: string;

  @ApiProperty()
  createdById: string;

  @ApiProperty({ type: [RequestUserSummaryDto] })
  assignees: RequestUserSummaryDto[];

  @ApiProperty({ type: [RequestUserSummaryDto] })
  observers: RequestUserSummaryDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Preenchido quando o chamado entra em SOLVED',
  })
  solvedAt: Date | null;

  @ApiProperty({ type: RequestPermissionsDto })
  permissions: RequestPermissionsDto;
}

export class RequestMessageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: RequestUserSummaryDto })
  author: RequestUserSummaryDto;
}

export class RequestHistoryEntryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'ID da solicitação' })
  requestId: string;

  @ApiProperty({ description: 'ID do usuário que registrou a ação' })
  userId: string;

  @ApiProperty({ enum: RequestHistoryAction })
  action: RequestHistoryAction;

  @ApiPropertyOptional({ enum: RequestStatus, nullable: true })
  fromStatus: RequestStatus | null;

  @ApiPropertyOptional({ enum: RequestStatus, nullable: true })
  toStatus: RequestStatus | null;

  @ApiPropertyOptional({
    type: 'object',
    nullable: true,
    additionalProperties: true,
    description: 'Metadados brutos da ação',
  })
  metadata: unknown;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Texto legível descrevendo a ação registrada no histórico',
  })
  description: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: RequestUserSummaryDto })
  user: RequestUserSummaryDto;
}

export class RequestDetailResponseDto extends RequestResponseDto {
  @ApiProperty({ type: RequestSectorSummaryDto })
  sector: RequestSectorSummaryDto;

  @ApiProperty({ type: RequestServiceSummaryDto })
  sectorService: RequestServiceSummaryDto;

  @ApiProperty({ type: RequestUserSummaryDto })
  createdBy: RequestUserSummaryDto;
}
