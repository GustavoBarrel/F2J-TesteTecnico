import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from 'src/common/dto/pagination-query.dto';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { messageAuthorSelect } from './request-messages.constants';

export type MessageAuthorSummary = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type RequestMessageDto = {
  id: string;
  content: string;
  createdAt: Date;
  author: MessageAuthorSummary;
};

type MessageWithAuthor = {
  id: string;
  content: string;
  createdAt: Date;
  requestId: string;
  authorId: string;
  user: MessageAuthorSummary;
};

@Injectable()
export class RequestMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  mapMessage({ user, ...message }: MessageWithAuthor): RequestMessageDto {
    return {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      author: user,
    };
  }

  mapMessages(messages: MessageWithAuthor[]): RequestMessageDto[] {
    return messages.map((message) => this.mapMessage(message));
  }

  async findPaginated(
    requestId: string,
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ): Promise<PaginatedResponseDto<RequestMessageDto>> {
    const skip = (page - 1) * limit;
    const where = { requestId };

    const [messages, total] = await Promise.all([
      this.prisma.requestMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: { user: { select: messageAuthorSelect } },
      }),
      this.prisma.requestMessage.count({ where }),
    ]);

    return {
      data: this.mapMessages(messages),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createInTransaction(
    tx: Prisma.TransactionClient,
    requestId: string,
    authorId: string,
    content: string,
  ): Promise<MessageWithAuthor> {
    return tx.requestMessage.create({
      data: { requestId, authorId, content },
      include: { user: { select: messageAuthorSelect } },
    });
  }
}
