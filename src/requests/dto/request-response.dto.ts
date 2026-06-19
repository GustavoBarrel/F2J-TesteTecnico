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

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

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

  @ApiProperty({ enum: RequestHistoryAction })
  action: RequestHistoryAction;

  @ApiPropertyOptional({ enum: RequestStatus, nullable: true })
  fromStatus: RequestStatus | null;

  @ApiPropertyOptional({ enum: RequestStatus, nullable: true })
  toStatus: RequestStatus | null;

  @ApiPropertyOptional({ nullable: true })
  metadata: unknown;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Texto legível descrevendo a ação registrada no histórico',
  })
  description: string | null;

  @ApiProperty()
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

  @ApiProperty({ type: [RequestMessageResponseDto] })
  messages: RequestMessageResponseDto[];

  @ApiProperty({ type: [RequestHistoryEntryDto] })
  history: RequestHistoryEntryDto[];
}