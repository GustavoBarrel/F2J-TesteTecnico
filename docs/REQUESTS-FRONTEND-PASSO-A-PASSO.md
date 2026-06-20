# Requests — Rotas Para o Front-end

> Prefixo global: `/api`. Rotas **admin** exigem `isGlobalAdmin`.

## Status Geral

| Status | Rota | Observação |
|---|---|---|
| OK | `GET /api/me/sectors` | Home — setores do usuário |
| OK | `GET /api/me/requests` | Chamados criados ou observados |
| OK | `GET /api/me/requests/assigned` | Chamados atribuídos ao usuário |
| OK | `GET /api/sectors/services/options` | Select setor+serviço ao criar chamado |
| OK | `GET /api/sectors/:sectorId/requests` | Lista principal por setor |
| OK | `GET /api/sectors/:sectorId/assignee-options` | Membros do setor para assign |
| OK | `POST /api/requests` | Cria chamado + histórico CREATED |
| OK | `GET /api/requests` | Lista geral (fallback) |
| OK | `GET /api/requests/observer-options` | Select de observadores na criação |
| OK | `GET /api/requests/:id` | Detalhe + permissions (sem messages/history) |
| OK | `PATCH /api/requests/:id` | Editar título/descrição/prioridade (não status) |
| OK | `PATCH /api/requests/:id/assign` | `{ userIds: string[] }` |
| OK | `PATCH /api/requests/:id/observers` | `{ userIds: string[] }` |
| OK | `PATCH /api/requests/:id/status` | `PENDING` \| `IN_PROGRESS` \| `SOLVED`; admin reabre `COMPLETED` |
| OK | `PATCH /api/requests/:id/solution-review` | `{ approved: boolean }` — SOLVED → COMPLETED/IN_PROGRESS |
| OK | `PATCH /api/requests/:id/cancel` | Cancelamento |
| OK | `PATCH /api/requests/:id/archive` | Arquivamento (COMPLETED → ARCHIVED) |
| OK | `GET /api/requests/:id/messages` | Paginado |
| OK | `POST /api/requests/:id/messages` | Envio de mensagem |
| OK | `GET /api/admin/requests/:id/history` | Histórico — **somente admin global** |

### Rotas admin (painel de configuração)

| Rota | Uso |
|---|---|
| `GET/POST/PATCH /api/admin/users` | CRUD usuários |
| `GET /api/admin/roles` | Cargos |
| `GET/POST/PATCH /api/admin/sectors` | CRUD setores |
| `/api/admin/sectors/:sectorId/members` | Memberships |
| `/api/admin/sectors/:sectorId/services` | Serviços do setor |
| `/api/admin/settings/request-auto-complete` | Auto-conclusão de SOLVED |

## Regras Globais

- `permissions` vem em todo `RequestResponseDto` — use para habilitar/desabilitar botões na UI.
- `isGlobalAdmin = true`: vê e faz tudo.
- Histórico admin: `GET /api/admin/requests/:id/history` (não usar `/api/requests/:id/history`).
- Assign: `GET /api/sectors/:sectorId/assignee-options` (não `/members/options`).

## Próximas Rotas Em Ordem

> **Implementado.** Seções abaixo descrevem contratos para referência do front-end.

### 1. `GET /api/sectors/:sectorId/requests`

Status: **OK**

Lista os chamados de um setor. É a tela principal ao clicar em um card de setor.

Query:

```txt
?status=&priority=&search=&scope=queue&page=&limit=
```

Regras:

- Admin: todos do setor.
- Manager: todos do setor.
- Technician + `onlyManagerCanView = false`: todos do setor.
- Technician + `onlyManagerCanView = true`: só `assignedToId = userId`.
- `scope=queue`: acrescenta `assignedToId = null`.

Retorno:

```json
{
  "sector": {
    "id": "sector-id",
    "name": "TI",
    "onlyManagerCanView": true,
    "onlyManagerCanEdit": true,
    "onlyManagerCanArchive": true
  },
  "data": [
    {
      "id": "request-id",
      "title": "Problema no notebook",
      "description": "...",
      "status": "NEW",
      "priority": "MEDIUM",
      "sectorId": "sector-id",
      "sectorServiceId": "service-id",
      "createdById": "user-id",
      "assignedToId": null,
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z",
      "permissions": {
        "canView": true,
        "canEdit": false,
        "canArchive": false
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 20,
    "totalPages": 2
  }
}
```

Front-end:

- Card do setor chama essa rota.
- `permissions.canEdit` mostra botão de editar/atribuir.
- `permissions.canArchive` mostra botão de arquivar.

---

### 2. `GET /api/requests/:id`

Status: **OK**

Detalhe do chamado (dados principais + `permissions`). **Não inclui** mensagens nem histórico.

Regras:

- Validar `canView`.
- Se não puder ver: `403`.
- Mensagens: `GET /api/requests/:id/messages`.
- Histórico: `GET /api/admin/requests/:id/history` (**somente admin global**).

Retorno:

```json
{
  "id": "request-id",
  "title": "Problema no notebook",
  "description": "...",
  "status": "IN_PROGRESS",
  "priority": "MEDIUM",
  "sector": {
    "id": "sector-id",
    "name": "TI"
  },
  "sectorService": {
    "id": "service-id",
    "name": "Suporte técnico"
  },
  "createdBy": {
    "id": "user-id",
    "firstName": "Maria",
    "lastName": "Silva",
    "email": "maria@email.com"
  },
  "assignees": [],
  "observers": [],
  "permissions": {
    "canView": true,
    "canEdit": true,
    "canArchive": false
  }
}
```

Front-end:

- Tela de detalhe usa `permissions` para renderizar ações.
- Carregar mensagens e histórico em rotas separadas (lazy load).

---

### 3. `PATCH /api/requests/:id`

Status: **OK**

Editar chamado.

Body:

```json
{
  "title": "Novo título",
  "description": "Nova descrição",
  "priority": "HIGH"
}
```

Regras:

- Exige `permissions.canEdit = true`.
- `canEdit` também será usado para atribuir.
- **Status:** usar `PATCH /api/requests/:id/status` (não enviar `status` neste endpoint).
- Registrar histórico `UPDATED`.

Retorno:

```json
{
  "id": "request-id",
  "title": "Novo título",
  "description": "Nova descrição",
  "priority": "HIGH",
  "permissions": {
    "canView": true,
    "canEdit": true,
    "canArchive": false
  }
}
```

---

### 4. `PATCH /api/requests/:id/assign`

Status: **OK**

Atribuir responsável.

Body:

```json
{
  "assignedToId": "tech-id"
}
```

Regras:

- Exige `permissions.canEdit = true`.
- Responsável deve ser membro do setor.
- Responsável não pode ser o criador.
- Se status for `NEW`, mudar para `IN_PROGRESS`.
- Registrar `ASSIGNED` ou `REASSIGNED`.

Retorno:

```json
{
  "id": "request-id",
  "status": "IN_PROGRESS",
  "assignedToId": "tech-id",
  "permissions": {
    "canView": true,
    "canEdit": true,
    "canArchive": false
  }
}
```

Front-end:

- Botão "Atribuir" aparece quando `canEdit = true`.
- Select de responsáveis deve listar membros do setor.

---

### 5. `PATCH /api/requests/:id/status`

Status: **OK**

Alterar status operacional.

Body (valores aceitos):

```json
{
  "status": "SOLVED"
}
```

Somente `PENDING`, `IN_PROGRESS` ou `SOLVED`. **`COMPLETED` não é aceito** neste endpoint — use `PATCH /api/requests/:id/solution-review` (`approved: true`).

Regras:

- **Admin global:** `canChangeStatus: true` mesmo em status bloqueados (`SOLVED`, `COMPLETED`, `CANCELLED`, `ARCHIVED`). Pode reabrir chamado concluído (ex.: `COMPLETED` → `PENDING`).
- **Demais papéis:** `canChangeStatus` só enquanto o chamado **não** estiver bloqueado — admin global, `canEdit`, ou responsável atribuído em setor com `onlyManagerCanEdit`.
- `SOLVED` → aguarda revisão do criador (`solution-review`) ou auto-conclusão.
- Cancelar: `PATCH /api/requests/:id/cancel` (não usar este endpoint).
- Concluir (`COMPLETED`): `PATCH /api/requests/:id/solution-review` quando status = `SOLVED`.

Retorno:

```json
{
  "id": "request-id",
  "status": "SOLVED",
  "permissions": {
    "canView": true,
    "canEdit": false,
    "canChangeStatus": true,
    "canReviewSolution": false
  }
}
```

---

### 6. `PATCH /api/requests/:id/cancel`

Status: **OK**

Cancelar chamado.

Regras:

- Admin pode.
- Manager pode.
- Technician pode se tiver `canEdit`.
- Criador pode cancelar se ainda estiver `NEW` (se essa regra for mantida).
- Status vira `CANCELLED`.
- Registrar `CANCELLED`.

Retorno:

```json
{
  "id": "request-id",
  "status": "CANCELLED",
  "permissions": {
    "canView": true,
    "canEdit": false,
    "canArchive": true
  }
}
```

---

### 7. `PATCH /api/requests/:id/archive`

Status: **OK**

Arquivar chamado.

Regras:

- Exige `permissions.canArchive = true`.
- Normalmente só permitido para `COMPLETED` ou `CANCELLED`.
- Status vira `ARCHIVED`.
- Registrar `ARCHIVED`.

Retorno:

```json
{
  "id": "request-id",
  "status": "ARCHIVED",
  "permissions": {
    "canView": true,
    "canEdit": false,
    "canArchive": false
  }
}
```

---

### 8. `GET /api/requests/:id/messages`

Status: Implementada.

Lista mensagens do chamado de forma paginada.

Query:

- `page` (opcional, default `1`)
- `limit` (opcional, default `10`, max `50`)

Regras:

- Exige `canView`.
- Ordenar `createdAt ASC`.

Retorno:

```json
{
  "data": [
    {
      "id": "message-id",
      "content": "Mensagem",
      "createdAt": "2026-06-18T00:00:00.000Z",
      "author": {
        "id": "user-id",
        "firstName": "Maria",
        "lastName": "Silva",
        "email": "maria@email.com"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 9. `POST /api/requests/:id/messages`

Status: **OK**

Enviar mensagem.

Body:

```json
{
  "content": "Nova mensagem"
}
```

Regras:

- Exige `canView`.
- Criar mensagem com `authorId = userId`.
- Registrar `MESSAGE_SENT`.

Retorno:

```json
{
  "id": "message-id",
  "content": "Nova mensagem",
  "createdAt": "2026-06-18T00:00:00.000Z",
  "author": {
    "id": "user-id",
    "firstName": "Maria",
    "lastName": "Silva",
    "email": "maria@email.com"
  }
}
```

---

### 10. `GET /api/admin/requests/:id/history`

Status: **OK** — somente admin global.

Timeline do chamado.

Regras:

- Exige `canView`.
- Ordenar `createdAt ASC`.

Retorno:

```json
[
  {
    "id": "history-id",
    "action": "ASSIGNED",
    "fromStatus": "NEW",
    "toStatus": "IN_PROGRESS",
    "metadata": {
      "assignedToId": "tech-id"
    },
    "createdAt": "2026-06-18T00:00:00.000Z",
    "user": {
      "id": "manager-id",
      "firstName": "João",
      "lastName": "Souza",
      "email": "joao@email.com"
    }
  }
]
```

---

### 11. `GET /api/sectors/:sectorId/assignee-options`

Status: **OK** (substitui o antigo `members/options`).

Regras:

- Admin: pode.
- Manager: pode.
- Technician: só se membro do setor.
- Retorna usuários membros ativos do setor.

Retorno:

```json
[
  {
    "id": "user-id",
    "firstName": "Pedro",
    "lastName": "Souza",
    "email": "pedro@email.com",
    "role": "TECHNICIAN"
  }
]
```

Front-end:

- Usado no modal de atribuir chamado.

## Ordem Recomendada (front-end)

1. Home: `GET /api/me/sectors`
2. Lista setor: `GET /api/sectors/:sectorId/requests`
3. Detalhe: `GET /api/requests/:id`
4. Ações via `permissions.*` (assign, status, cancel, archive, messages)
5. Histórico admin: `GET /api/admin/requests/:id/history`

## Observações

- Remover ou ignorar `DELETE /api/requests/:id`; usar `cancel` e `archive`.
- `permissions.canEdit` controla editar e atribuir.
- `permissions.canArchive` controla arquivar.
- `permissions.canChangeStatus` — admin global também em status bloqueados (ex.: reabrir `COMPLETED`); demais papéis só enquanto não bloqueado. PATCH aceita `PENDING`, `IN_PROGRESS`, `SOLVED` (não `COMPLETED`).
- `permissions.canReviewSolution` — quando status = `SOLVED`.
- Listagens principais:
  - `/api/me/requests`
  - `/api/me/requests/assigned`
  - `/api/sectors/:sectorId/requests`
- Painel admin usa prefixo `/api/admin/*`.
