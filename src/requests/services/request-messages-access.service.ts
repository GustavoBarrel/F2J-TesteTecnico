import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  PaginationQueryDto,
} from 'src/common/dto/pagination-query.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { RequestHistoryService } from 'src/request-history/request-history.service';
import {
  RequestMessageDto,
  RequestMessagesService,
} from 'src/request-messages/request-messages.service';
import { RequestPermissionsService } from './request-permissions.service';

@Injectable()
export class RequestMessagesAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: RequestPermissionsService,
    private readonly messagesService: RequestMessagesService,
    private readonly historyService: RequestHistoryService,
  ) {}

  async findMessages(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<RequestMessageDto>> {
    const memberships = isGlobalAdmin
      ? []
      : await this.permissionsService.getMemberships(userId);
    const request = await this.fetchRequestForAction(requestId);

    const permissions = this.permissionsService.resolvePermissions(
      request,
      userId,
      isGlobalAdmin,
      memberships,
    );
    if (!permissions.canView) {
      throw new ForbiddenException('Sem permissão para visualizar mensagens');
    }

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    return this.messagesService.findPaginated(requestId, page, limit);
  }

  async sendMessage(
    requestId: string,
    userId: string,
    isGlobalAdmin: boolean,
    content: string,
  ): Promise<RequestMessageDto> {
    const memberships = isGlobalAdmin
      ? []
      : await this.permissionsService.getMemberships(userId);

    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: {
        assignees: { select: { userId: true } },
        observers: { select: { userId: true } },
      },
    });

    if (!request) {
      throw new NotFoundException('Solicitação não encontrada');
    }

    this.permissionsService.assertRequestActionsAllowed(request);

    const permissions = this.permissionsService.resolvePermissions(
      request,
      userId,
      isGlobalAdmin,
      memberships,
    );

    if (!permissions.canMessage) {
      throw new ForbiddenException('Sem permissão para enviar mensagem');
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const createdMessage = await this.messagesService.createInTransaction(
        tx,
        requestId,
        userId,
        content,
      );

      await this.historyService.recordMessageSent(
        tx,
        requestId,
        userId,
        createdMessage.id,
        content,
      );

      return createdMessage;
    });

    return this.messagesService.mapMessage(message);
  }

  private async fetchRequestForAction(requestId: string) {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: {
        assignees: { select: { userId: true } },
        observers: { select: { userId: true } },
      },
    });
    if (!request) {
      throw new NotFoundException('Solicitação não encontrada');
    }
    return request;
  }
}
