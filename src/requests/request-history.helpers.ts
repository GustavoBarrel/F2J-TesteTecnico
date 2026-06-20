import {
  Prisma,
  RequestHistoryAction,
  RequestPriority,
  RequestStatus,
} from '../../generated/prisma/client';

export type HistoryUserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type RequestHistoryMetadata = {
  description: string;
  [key: string]: unknown;
};

const STATUS_LABELS: Record<RequestStatus, string> = {
  [RequestStatus.NEW]: 'Novo',
  [RequestStatus.PENDING]: 'Pendente',
  [RequestStatus.IN_PROGRESS]: 'Em andamento',
  [RequestStatus.SOLVED]: 'Solucionado',
  [RequestStatus.COMPLETED]: 'Concluído',
  [RequestStatus.CANCELLED]: 'Cancelado',
  [RequestStatus.ARCHIVED]: 'Arquivado',
};

const PRIORITY_LABELS: Record<RequestPriority, string> = {
  [RequestPriority.LOW]: 'Baixa',
  [RequestPriority.MEDIUM]: 'Média',
  [RequestPriority.HIGH]: 'Alta',
  [RequestPriority.URGENT]: 'Urgente',
};

export function formatStatus(status: RequestStatus): string {
  return STATUS_LABELS[status];
}

export function formatPriority(priority: RequestPriority): string {
  return PRIORITY_LABELS[priority];
}

export function formatUserLabel(user: HistoryUserSummary): string {
  return `${user.firstName} ${user.lastName} (${user.email})`;
}

export function formatUserList(users: HistoryUserSummary[]): string {
  if (users.length === 0) {
    return 'nenhum';
  }

  return users.map(formatUserLabel).join('; ');
}

export function usersByIds(
  users: HistoryUserSummary[],
  ids: string[],
): HistoryUserSummary[] {
  const map = new Map(users.map((user) => [user.id, user]));
  return ids.flatMap((id) => {
    const user = map.get(id);
    return user ? [user] : [];
  });
}

export function diffUserIds(
  previousIds: string[],
  nextIds: string[],
): { added: string[]; removed: string[] } {
  const previous = new Set(previousIds);
  const next = new Set(nextIds);

  return {
    added: nextIds.filter((id) => !previous.has(id)),
    removed: previousIds.filter((id) => !next.has(id)),
  };
}

export function buildAssigneesChangeDescription(
  previousUsers: HistoryUserSummary[],
  nextUsers: HistoryUserSummary[],
): string {
  const previousIds = previousUsers.map((user) => user.id);
  const nextIds = nextUsers.map((user) => user.id);
  const { added, removed } = diffUserIds(previousIds, nextIds);

  if (previousUsers.length === 0 && nextUsers.length > 0) {
    return `Responsáveis atribuídos: ${formatUserList(nextUsers)}.`;
  }

  if (previousUsers.length > 0 && nextUsers.length === 0) {
    return `Responsáveis removidos. Anteriormente: ${formatUserList(previousUsers)}.`;
  }

  const parts: string[] = ['Responsáveis atualizados.'];

  if (removed.length > 0) {
    parts.push(
      `Removidos: ${formatUserList(usersByIds(previousUsers, removed))}.`,
    );
  }

  if (added.length > 0) {
    parts.push(`Adicionados: ${formatUserList(usersByIds(nextUsers, added))}.`);
  }

  parts.push(`Atual: ${formatUserList(nextUsers)}.`);

  return parts.join(' ');
}

export function buildObserversChangeDescription(
  previousUsers: HistoryUserSummary[],
  nextUsers: HistoryUserSummary[],
): string {
  const previousIds = previousUsers.map((user) => user.id);
  const nextIds = nextUsers.map((user) => user.id);
  const { added, removed } = diffUserIds(previousIds, nextIds);

  if (previousUsers.length === 0 && nextUsers.length > 0) {
    return `Observadores definidos: ${formatUserList(nextUsers)}.`;
  }

  if (previousUsers.length > 0 && nextUsers.length === 0) {
    return `Observadores removidos. Anteriormente: ${formatUserList(previousUsers)}.`;
  }

  const parts: string[] = ['Observadores atualizados.'];

  if (removed.length > 0) {
    parts.push(
      `Removidos: ${formatUserList(usersByIds(previousUsers, removed))}.`,
    );
  }

  if (added.length > 0) {
    parts.push(`Adicionados: ${formatUserList(usersByIds(nextUsers, added))}.`);
  }

  parts.push(`Atual: ${formatUserList(nextUsers)}.`);

  return parts.join(' ');
}

export function truncateText(value: string, maxLength = 120): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

export function historyMetadata(
  description: string,
  details: Record<string, unknown> = {},
): Prisma.InputJsonValue {
  return { description, ...details };
}

export function extractHistoryDescription(metadata: unknown): string | null {
  if (
    metadata &&
    typeof metadata === 'object' &&
    'description' in metadata &&
    typeof (metadata as { description: unknown }).description === 'string'
  ) {
    return (metadata as { description: string }).description;
  }

  return null;
}

export function buildCreatedHistory(
  title: string,
  sectorServiceName: string,
  observers: HistoryUserSummary[],
): {
  action: typeof RequestHistoryAction.CREATED;
  toStatus: RequestStatus;
  metadata: Prisma.InputJsonValue;
} {
  const observerPart =
    observers.length > 0
      ? ` Observadores iniciais: ${formatUserList(observers)}.`
      : '';

  return {
    action: RequestHistoryAction.CREATED,
    toStatus: RequestStatus.NEW,
    metadata: historyMetadata(
      `Solicitação "${title}" criada no serviço "${sectorServiceName}" com status ${formatStatus(RequestStatus.NEW)}.${observerPart}`,
      {
        title,
        sectorServiceName,
        observers: observers.map((user) => ({
          id: user.id,
          label: formatUserLabel(user),
        })),
      },
    ),
  };
}

export function buildMessageSentHistory(
  messageId: string,
  content: string,
): {
  action: typeof RequestHistoryAction.MESSAGE_SENT;
  metadata: Prisma.InputJsonValue;
} {
  return {
    action: RequestHistoryAction.MESSAGE_SENT,
    metadata: historyMetadata(
      `Mensagem enviada: "${truncateText(content)}".`,
      { messageId, contentPreview: truncateText(content) },
    ),
  };
}

export function buildStatusChangedHistory(
  fromStatus: RequestStatus,
  toStatus: RequestStatus,
): {
  action: typeof RequestHistoryAction.STATUS_CHANGED;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
  metadata: Prisma.InputJsonValue;
} {
  return {
    action: RequestHistoryAction.STATUS_CHANGED,
    fromStatus,
    toStatus,
    metadata: historyMetadata(
      `Status alterado de ${formatStatus(fromStatus)} para ${formatStatus(toStatus)}.`,
      {
        fromStatus,
        toStatus,
        fromStatusLabel: formatStatus(fromStatus),
        toStatusLabel: formatStatus(toStatus),
      },
    ),
  };
}

export function buildAutoCompletedHistory(
  value: number,
  unit: 'minutes' | 'days',
): {
  action: typeof RequestHistoryAction.STATUS_CHANGED;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
  metadata: Prisma.InputJsonValue;
} {
  const label = unit === 'minutes' ? 'minuto(s)' : 'dia(s)';

  return {
    action: RequestHistoryAction.STATUS_CHANGED,
    fromStatus: RequestStatus.SOLVED,
    toStatus: RequestStatus.COMPLETED,
    metadata: historyMetadata(
      `Solicitação concluída automaticamente após ${value} ${label} sem resposta do solicitante.`,
      {
        fromStatus: RequestStatus.SOLVED,
        toStatus: RequestStatus.COMPLETED,
        kind: 'AUTO_COMPLETED',
        autoCompleteUnit: unit,
        autoCompleteValue: value,
        ...(unit === 'minutes'
          ? { autoCompleteMinutes: value }
          : { autoCompleteDays: value }),
      },
    ),
  };
}

export function buildPriorityChangedHistory(
  fromPriority: RequestPriority,
  toPriority: RequestPriority,
): {
  action: typeof RequestHistoryAction.PRIORITY_CHANGED;
  metadata: Prisma.InputJsonValue;
} {
  return {
    action: RequestHistoryAction.PRIORITY_CHANGED,
    metadata: historyMetadata(
      `Prioridade alterada de ${formatPriority(fromPriority)} para ${formatPriority(toPriority)}.`,
      {
        fromPriority,
        toPriority,
        fromPriorityLabel: formatPriority(fromPriority),
        toPriorityLabel: formatPriority(toPriority),
      },
    ),
  };
}

export function buildFieldUpdatedHistory(
  field: 'title' | 'description',
  fromValue: string,
  toValue: string,
): {
  action: typeof RequestHistoryAction.UPDATED;
  metadata: Prisma.InputJsonValue;
} {
  const fieldLabel = field === 'title' ? 'Título' : 'Descrição';

  return {
    action: RequestHistoryAction.UPDATED,
    metadata: historyMetadata(
      `${fieldLabel} alterado de "${truncateText(fromValue)}" para "${truncateText(toValue)}".`,
      {
        field,
        fromValue,
        toValue,
      },
    ),
  };
}

export function buildAssignHistory(
  previousUsers: HistoryUserSummary[],
  nextUsers: HistoryUserSummary[],
  reassigned: boolean,
): {
  action: RequestHistoryAction;
  metadata: Prisma.InputJsonValue;
} {
  return {
    action: reassigned
      ? RequestHistoryAction.REASSIGNED
      : RequestHistoryAction.ASSIGNED,
    metadata: historyMetadata(
      buildAssigneesChangeDescription(previousUsers, nextUsers),
      {
        previousAssignees: previousUsers.map((user) => ({
          id: user.id,
          label: formatUserLabel(user),
        })),
        assignees: nextUsers.map((user) => ({
          id: user.id,
          label: formatUserLabel(user),
        })),
      },
    ),
  };
}

export function buildObserversHistory(
  previousUsers: HistoryUserSummary[],
  nextUsers: HistoryUserSummary[],
): {
  action: typeof RequestHistoryAction.UPDATED;
  metadata: Prisma.InputJsonValue;
} {
  return {
    action: RequestHistoryAction.UPDATED,
    metadata: historyMetadata(
      buildObserversChangeDescription(previousUsers, nextUsers),
      {
        kind: 'OBSERVERS_UPDATED',
        previousObservers: previousUsers.map((user) => ({
          id: user.id,
          label: formatUserLabel(user),
        })),
        observers: nextUsers.map((user) => ({
          id: user.id,
          label: formatUserLabel(user),
        })),
      },
    ),
  };
}

export function buildCancelledHistory(
  fromStatus: RequestStatus,
): {
  action: typeof RequestHistoryAction.CANCELLED;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
  metadata: Prisma.InputJsonValue;
} {
  return {
    action: RequestHistoryAction.CANCELLED,
    fromStatus,
    toStatus: RequestStatus.CANCELLED,
    metadata: historyMetadata(
      `Solicitação cancelada. Status anterior: ${formatStatus(fromStatus)}.`,
      {
        fromStatus,
        toStatus: RequestStatus.CANCELLED,
        fromStatusLabel: formatStatus(fromStatus),
        toStatusLabel: formatStatus(RequestStatus.CANCELLED),
      },
    ),
  };
}

export function buildArchivedHistory(
  fromStatus: RequestStatus,
): {
  action: typeof RequestHistoryAction.ARCHIVED;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
  metadata: Prisma.InputJsonValue;
} {
  return {
    action: RequestHistoryAction.ARCHIVED,
    fromStatus,
    toStatus: RequestStatus.ARCHIVED,
    metadata: historyMetadata(
      `Solicitação arquivada. Status anterior: ${formatStatus(fromStatus)}.`,
      {
        fromStatus,
        toStatus: RequestStatus.ARCHIVED,
        fromStatusLabel: formatStatus(fromStatus),
        toStatusLabel: formatStatus(RequestStatus.ARCHIVED),
      },
    ),
  };
}
