# ServiceHub — Guia de Implementação do MVP

> **Use este arquivo durante o desenvolvimento.**  
> Visão de produto futuro → `CONTEXTO.md` (Parte B).

**Stack:** NestJS · TypeScript · PostgreSQL · Prisma · JWT · bcrypt

---

## Checklist geral

```
[ ] Fase 0 — Setup do projeto
[ ] Fase 1 — Banco de dados + seed
[ ] Fase 2 — Auth (login JWT)
[ ] Fase 3 — Users (admin)
[ ] Fase 4 — Sectors + memberships (admin)
[ ] Fase 5 — Permissions (RBAC fixo)
[ ] Fase 6 — Requests (criar, listar, detalhe)
[ ] Fase 7 — Assign + status + cancel
[ ] Fase 8 — Messages + history
[ ] Fase 9 — Testes
[ ] Fase 10 — README final
```

---

## Fluxo do sistema

### Fluxo principal (demo)

```mermaid
sequenceDiagram
    participant Maria as Maria (comum)
    participant API as API
    participant Joao as João (gerente TI)
    participant Pedro as Pedro (técnico TI)

    Maria->>API: POST /requests (setor TI)
    API-->>Maria: 201 NEW

    Joao->>API: GET /requests (fila TI)
    API-->>Joao: lista com solicitação

    Joao->>API: PATCH /requests/:id/assign (Pedro)
    API-->>Joao: IN_PROGRESS

    Maria->>API: POST /requests/:id/messages
    Pedro->>API: POST /requests/:id/messages

    Pedro->>API: PATCH /requests/:id/status (COMPLETED)
    API-->>Pedro: 200
```

### Status da solicitação — o que o usuário vê

| Status | Label sugerida na UI | O que significa para quem usa |
|--------|----------------------|-------------------------------|
| `NEW` | Nova | Chamado **recém-criado**. Está na fila do setor, **sem responsável** ainda. O solicitante abriu e aguarda o setor pegar o chamado. |
| `PENDING` | Pendente | Chamado **aguardando o solicitante**. O responsável (ou setor) precisa de **mais informação** — ex: "mande print", "qual equipamento?". Fica visível para o solicitante responder via mensagens. |
| `IN_PROGRESS` | Em andamento | Chamado **em atendimento**. Já tem responsável designado e o setor está trabalhando na resolução. |
| `COMPLETED` | Concluída | Chamado **resolvido**. O responsável ou gerente marcou como finalizado. Solicitante ainda pode ver e ler mensagens, mas não há ação pendente. |
| `CANCELLED` | Cancelada | Chamado **encerrado sem conclusão** (gerente/admin ou regra de cancelamento). Não será mais atendido. |
| `ARCHIVED` | Arquivada | Chamado **arquivado** por gerente ou admin. Sai das listas operacionais (fila/ativos), permanece no **histórico** para consulta. |

**Diferença `NEW` vs `PENDING`:**
- `NEW` = acabou de nascer, setor ainda não pediu nada ao solicitante.
- `PENDING` = setor/responsável **pediu retorno** ao solicitante; aguardando resposta dele.

### Ciclo de vida da solicitação

```
                         ┌─────────────┐
                         │     NEW     │  recém-criado, na fila
                         └──────┬──────┘
                cancelar        │ atribuir
                   ┌────────────┼────────────┐
                   ▼            ▼            │
             ┌──────────┐  ┌─────────────┐   │
             │CANCELLED │  │ IN_PROGRESS │◄──┘
             └────┬─────┘  └──────┬──────┘
                  │               │
                  │    ┌──────────┼──────────┐
                  │    ▼          ▼          ▼
                  │ ┌─────────┐ ┌─────────┐  │
                  │ │ PENDING │ │COMPLETED│  │ (pediu info ao solicitante)
                  │ └────┬────┘ └────┬────┘  │
                  │      │           │       │
                  │      └──────────►│       │
                  │                  ▼       ▼
                  │             ┌──────────┐ │
                  └────────────►│ ARCHIVED │◄┘ (só gerente/admin)
                                └──────────┘
```

### Quem vê o quê

| Usuário | Condição SQL (simplificado) |
|---------|----------------------------|
| Admin | sem filtro |
| Criador | `created_by_id = meuId` |
| Manager do setor | `sector_id IN meusSetores` |
| Technician | `(sector_id IN meusSetores AND assigned_to_id IS NULL) OR assigned_to_id = meuId` |

União de todos os filtros que se aplicam ao usuário.

---

## Banco de dados

### 6 tabelas

| Tabela | Função |
|--------|--------|
| `users` | Login e identidade |
| `sectors` | Setores destino (TI, RH…) |
| `user_sector_memberships` | Quem trabalha em qual setor e com qual papel |
| `requests` | Solicitações |
| `request_messages` | Mensagens na solicitação |
| `request_history` | Log de tudo que aconteceu |

### Diagrama

```
users ─────┬── created_by ──► requests ◄── sector_id ── sectors
           │                      │
           └── assigned_to        ├── request_messages
                                  └── request_history

user_sector_memberships ──► users + sectors
```

### Schema Prisma (copiar para `prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SectorRole {
  MANAGER
  TECHNICIAN
}

enum RequestStatus {
  NOVA
  EM_ANDAMENTO
  AGUARDANDO
  CONCLUIDA
  CANCELADA
}

model User {
  id            String   @id @default(uuid())
  name          String
  email         String   @unique
  passwordHash  String   @map("password_hash")
  isGlobalAdmin Boolean  @default(false) @map("is_global_admin")
  active        Boolean  @default(true)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  memberships      UserSectorMembership[]
  createdRequests  Request[] @relation("CreatedBy")
  assignedRequests Request[] @relation("AssignedTo")
  messages         RequestMessage[]
  history          RequestHistory[]

  @@map("users")
}

model Sector {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  memberships UserSectorMembership[]
  requests    Request[]

  @@map("sectors")
}

model UserSectorMembership {
  id        String     @id @default(uuid())
  userId    String     @map("user_id")
  sectorId  String     @map("sector_id")
  role      SectorRole
  active    Boolean    @default(true)
  createdAt DateTime   @default(now()) @map("created_at")
  updatedAt DateTime   @updatedAt @map("updated_at")

  user   User   @relation(fields: [userId], references: [id])
  sector Sector @relation(fields: [sectorId], references: [id])

  @@unique([userId, sectorId])
  @@map("user_sector_memberships")
}

model Request {
  id           String        @id @default(uuid())
  title        String
  description  String
  sectorId     String        @map("sector_id")
  status       RequestStatus @default(NOVA)
  createdById  String        @map("created_by_id")
  assignedToId String?       @map("assigned_to_id")
  createdAt    DateTime      @default(now()) @map("created_at")
  updatedAt    DateTime      @updatedAt @map("updated_at")
  closedAt     DateTime?     @map("closed_at")

  sector     Sector @relation(fields: [sectorId], references: [id])
  createdBy  User   @relation("CreatedBy", fields: [createdById], references: [id])
  assignedTo User?  @relation("AssignedTo", fields: [assignedToId], references: [id])

  messages RequestMessage[]
  history  RequestHistory[]

  @@index([sectorId, status])
  @@index([createdById])
  @@index([assignedToId])
  @@map("requests")
}

model RequestMessage {
  id        String   @id @default(uuid())
  requestId String   @map("request_id")
  authorId  String   @map("author_id")
  content   String
  createdAt DateTime @default(now()) @map("created_at")

  request Request @relation(fields: [requestId], references: [id], onDelete: Cascade)
  author  User    @relation(fields: [authorId], references: [id])

  @@index([requestId, createdAt])
  @@map("request_messages")
}

model RequestHistory {
  id         String         @id @default(uuid())
  requestId  String         @map("request_id")
  userId     String         @map("user_id")
  action     String
  fromStatus RequestStatus? @map("from_status")
  toStatus   RequestStatus? @map("to_status")
  metadata   Json?
  createdAt  DateTime       @default(now()) @map("created_at")

  request Request @relation(fields: [requestId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id])

  @@index([requestId, createdAt])
  @@map("request_history")
}
```

---

## Regras de negócio (memorizar)

| Regra | Onde validar |
|-------|--------------|
| Criador ≠ responsável | `RequestsService.assign()` |
| Responsável deve ser membro ativo do setor | `RequestsService.assign()` |
| Atribuir com status `NEW` → vira `IN_PROGRESS` | `RequestsService.assign()` |
| Transições de status fixas | `RequestsService.changeStatus()` |
| `PENDING` = aguardando resposta do solicitante | Responsável/gerente muda para `PENDING`; solicitante responde via mensagem |
| Concluir: responsável ou manager | `PermissionService` |
| Cancelar: manager ou admin | `PermissionService` + `cancel()` |
| Solicitante após criar | Só ver + mensagens (não muda status) |
| Criador sempre vê suas solicitações | `PermissionService.buildListFilter()` |
| Mensagens não apagáveis | não criar endpoint DELETE |
| Usuário desativado com solicitações atribuídas | `assigned_to_id = null` (job ou no deactivate) |
| **Arquivar (`ARCHIVED`)** | Somente **MANAGER** do setor ou **admin global** |

### Transições de status permitidas

```typescript
const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  NEW: ['IN_PROGRESS', 'CANCELLED'],
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PENDING', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: [], // terminal
};
```

**Quem move para `PENDING`:** responsável ou gerente do setor (precisa de mais info do solicitante).

**Quem sai de `PENDING`:** responsável ou gerente volta para `IN_PROGRESS` após solicitante responder.

**Arquivar:** transição para `ARCHIVED` só se usuário for `isGlobalAdmin` **ou** `RoleSlug.MANAGER` no `sectorId` da solicitação. Técnico e solicitante **não** arquivam.

---

## Papéis e permissões

### Papéis

| Papel | Onde |
|-------|------|
| `ADMIN` | `users.is_global_admin = true` |
| `MANAGER` | `memberships.role = MANAGER` |
| `TECHNICIAN` | `memberships.role = TECHNICIAN` |
| Comum | autenticado, sem membership no setor |

### Enum de permissões

```typescript
// src/modules/permissions/permission.types.ts
export enum Permission {
  REQUEST_CREATE = 'request:create',
  REQUEST_VIEW = 'request:view',
  REQUEST_EDIT = 'request:edit',
  REQUEST_ASSIGN = 'request:assign',
  REQUEST_REASSIGN = 'request:reassign',
  REQUEST_CHANGE_STATUS = 'request:change_status',
  REQUEST_CANCEL = 'request:cancel',
  REQUEST_MESSAGE = 'request:message',
}
```

### Matriz rápida

| Permissão | Admin | Criador | Manager | Technician (responsável) |
|-----------|-------|---------|---------|--------------------------|
| create | ✅ | ✅ | ✅ | ✅ |
| view | ✅ | ✅ suas | ✅ setor | ✅ fila + suas |
| edit | ✅ | ❌ | ✅ | ✅ se `IN_PROGRESS` |
| assign | ✅ | ❌ | ✅ | ❌ |
| reassign | ✅ | ❌ | ✅ | ❌ |
| change_status | ✅ | ❌ | ✅ | ✅ se responsável |
| cancel | ✅ | ❌ | ✅ | ❌ |
| message | ✅ | ✅ | ✅ | ✅ |

---

## API

### Auth
| Método | Rota | Quem | Body |
|--------|------|------|------|
| POST | `/auth/login` | público | `{ email, password }` |

### Users (admin)
| Método | Rota | Body |
|--------|------|------|
| POST | `/users` | `{ name, email, password, isGlobalAdmin? }` |
| GET | `/users` | — |
| GET | `/users/:id` | — |
| PATCH | `/users/:id` | `{ name?, email?, password? }` |
| PATCH | `/users/:id/deactivate` | — |

### Sectors (admin)
| Método | Rota | Body |
|--------|------|------|
| POST | `/sectors` | `{ name, slug }` |
| GET | `/sectors` | — |
| GET | `/sectors/:id` | — |
| PATCH | `/sectors/:id` | `{ name?, active? }` |
| POST | `/sectors/:id/members` | `{ userId, role }` |
| GET | `/sectors/:id/members` | — |
| DELETE | `/sectors/:id/members/:userId` | — |

### Requests
| Método | Rota | Body |
|--------|------|------|
| POST | `/requests` | `{ title, description, sectorId }` |
| GET | `/requests` | query: `?sectorId=&status=` |
| GET | `/requests/:id` | — |
| PATCH | `/requests/:id` | `{ title?, description? }` |
| PATCH | `/requests/:id/assign` | `{ assigneeId }` |
| PATCH | `/requests/:id/status` | `{ status }` |
| PATCH | `/requests/:id/cancel` | — |
| GET | `/requests/:id/permissions/me` | — |

### Messages & History
| Método | Rota | Body |
|--------|------|------|
| POST | `/requests/:id/messages` | `{ content }` |
| GET | `/requests/:id/messages` | — |
| GET | `/requests/:id/history` | — |

### Respostas de erro comuns

| Código | Quando |
|--------|--------|
| 401 | Sem token / token inválido |
| 403 | Sem permissão |
| 404 | Recurso não encontrado |
| 400 | `CREATOR_CANNOT_BE_ASSIGNEE` |
| 400 | `ASSIGNEE_MUST_BE_SECTOR_MEMBER` |
| 400 | `INVALID_STATUS_TRANSITION` |
| 400 | `REQUEST_NOT_EDITABLE` |

---

## Estrutura de pastas final

```
src/
├── main.ts
├── app.module.ts
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── require-permission.decorator.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── permission.guard.ts
│   └── filters/
│       └── http-exception.filter.ts
└── modules/
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── jwt.strategy.ts
    │   └── dto/login.dto.ts
    ├── users/
    │   ├── users.module.ts
    │   ├── users.controller.ts
    │   ├── users.service.ts
    │   └── dto/
    ├── sectors/
    │   ├── sectors.module.ts
    │   ├── sectors.controller.ts
    │   ├── sectors.service.ts
    │   └── dto/
    ├── requests/
    │   ├── requests.module.ts
    │   ├── requests.controller.ts
    │   ├── requests.service.ts
    │   └── dto/
    ├── messages/
    │   ├── messages.module.ts
    │   ├── messages.controller.ts
    │   └── messages.service.ts
    ├── history/
    │   ├── history.module.ts
    │   └── history.service.ts
    └── permissions/
        ├── permissions.module.ts
        ├── permission.service.ts
        ├── permission.types.ts
        └── permission.service.spec.ts
```

---

## Passo a passo — Fase por fase

---

### Fase 0 — Setup

**Objetivo:** projeto rodando com dependências.

```bash
npm install @prisma/client prisma @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt class-validator class-transformer
npm install -D @types/passport-jwt @types/bcrypt
npx prisma init
```

**Criar:**
- `.env` → `DATABASE_URL=postgresql://user:pass@localhost:5432/servicehub`
- `.env` → `JWT_SECRET=seu-secret-aqui`

**Validar:** `npm run start:dev` sobe sem erro.

---

### Fase 1 — Banco + seed

**Objetivo:** 6 tabelas criadas com dados de demo.

**Fazer:**
1. Colar schema Prisma (seção acima) em `prisma/schema.prisma`
2. Criar `prisma/seed.ts` com usuários da demo
3. Configurar seed no `package.json`

**Seed obrigatório:**

| Email | Senha | Papel |
|-------|-------|-------|
| admin@servicehub.com | admin123 | Admin |
| joao@servicehub.com | demo123 | Manager TI |
| pedro@servicehub.com | demo123 | Technician TI |
| ana@servicehub.com | demo123 | Manager RH |
| maria@servicehub.com | demo123 | Comum (sem setor) |

Setores: `ti`, `rh`

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

**Validar:**
- [ ] 6 tabelas no banco
- [ ] 5 usuários, 2 setores, 3 memberships
- [ ] `npx prisma studio` mostra os dados

---

### Fase 2 — Auth

**Objetivo:** login retorna JWT; rotas protegidas.

**Criar:**
- `prisma/prisma.service.ts` + `prisma.module.ts` (global)
- `auth/auth.service.ts` — valida email/senha com bcrypt
- `auth/jwt.strategy.ts` — extrai user do token
- `common/guards/jwt-auth.guard.ts`
- `common/decorators/current-user.decorator.ts`
- `POST /auth/login`

**Payload JWT:**
```typescript
{ sub: user.id, email: user.email, isGlobalAdmin: user.isGlobalAdmin }
```

**Validar:**
- [ ] Login com admin retorna token
- [ ] Login com senha errada → 401
- [ ] Rota protegida sem token → 401

---

### Fase 3 — Users

**Objetivo:** admin gerencia usuários.

**Criar:**
- `users/users.service.ts`
- `users/users.controller.ts`
- Guard: só `isGlobalAdmin` acessa
- DTOs com `class-validator`

**Validar:**
- [ ] Admin cria usuário
- [ ] Usuário comum → 403 em POST /users
- [ ] Deactivate impede login

---

### Fase 4 — Sectors + memberships

**Objetivo:** admin configura setores e vínculos.

**Criar:**
- `sectors/sectors.service.ts`
- `sectors/sectors.controller.ts`
- Endpoints de members dentro do controller de sectors

**Validar:**
- [ ] Admin cria setor
- [ ] Admin vincula Pedro como TECHNICIAN no TI
- [ ] UNIQUE impede duplo vínculo no mesmo setor

---

### Fase 5 — Permissions

**Objetivo:** centralizar toda autorização antes de implementar requests.

**Criar `permission.service.ts` com:**

```typescript
class PermissionService {
  can(user, permission, request?, membership?): boolean
  getAllowedPermissions(user, request, memberships): Permission[]
  buildListWhere(user, memberships): Prisma.RequestWhereInput
}
```

**Implementar nesta ordem:**
1. `can()` para admin (sempre true)
2. `can()` para criador
3. `can()` para manager
4. `can()` para technician
5. `buildListWhere()` — união dos filtros
6. Testes unitários (`permission.service.spec.ts`)

**Validar:**
- [ ] 5+ testes passando
- [ ] Manager vê todas do setor
- [ ] Technician não vê atribuídas a outros
- [ ] Criador sempre passa em VIEW das suas

---

### Fase 6 — Requests (CRUD básico)

**Objetivo:** criar, listar e ver solicitação.

**Criar:**
- `requests/requests.service.ts`
- `requests/requests.controller.ts`
- `history/history.service.ts` — só método `log()` por enquanto
- DTOs: `CreateRequestDto`, `UpdateRequestDto`

**POST /requests:**
1. Validar setor existe e ativo
2. Criar com `status: NOVA`, `createdById: user.id`
3. `historyService.log({ action: 'CREATED' })`

**GET /requests:**
1. `permissionService.buildListWhere(user)`
2. Aplicar filtros opcionais (sectorId, status)

**GET /requests/:id:**
1. Buscar request
2. `permissionService.can(user, REQUEST_VIEW, request)` → senão 403

**Validar:**
- [ ] Maria cria solicitação para TI
- [ ] Maria vê na listagem
- [ ] Maria não vê solicitações de outros
- [ ] João (manager TI) vê a solicitação da Maria

---

### Fase 7 — Assign, status, cancel

**Objetivo:** fluxo operacional completo.

**PATCH /requests/:id/assign:**
```typescript
async assign(requestId, assigneeId, user) {
  const request = await this.findOrFail(requestId);
  this.permissionService.can(user, REQUEST_ASSIGN, request);
  if (assigneeId === request.createdById) throw BadRequest('CREATOR_CANNOT_BE_ASSIGNEE');
  await this.validateSectorMember(assigneeId, request.sectorId);

  const isReassign = !!request.assignedToId;
  const newStatus = request.status === 'NOVA' ? 'EM_ANDAMENTO' : request.status;

  const updated = await prisma.request.update({ ... });
  await historyService.log({
    action: isReassign ? 'REASSIGNED' : 'ASSIGNED',
    metadata: { assigneeId, previousAssigneeId: request.assignedToId },
    toStatus: newStatus,
  });
  return updated;
}
```

**PATCH /requests/:id/status:**
1. Validar permissão `CHANGE_STATUS`
2. Validar transição em `ALLOWED_TRANSITIONS`
3. Se `CONCLUIDA` ou `CANCELADA` → `closedAt = now()`
4. Log `STATUS_CHANGED`

**PATCH /requests/:id/cancel:**
1. Validar permissão `CANCEL`
2. Status → `CANCELADA`, `closedAt = now()`
3. Log `CANCELLED`

**Validar:**
- [ ] João atribui a Pedro → EM_ANDAMENTO
- [ ] João tenta se atribuir → 400
- [ ] Pedro conclui → CONCLUIDA
- [ ] Transição inválida (NOVA → CONCLUIDA) → 400

---

### Fase 8 — Messages + history

**Objetivo:** comunicação e rastreio.

**POST /requests/:id/messages:**
1. Validar `REQUEST_MESSAGE`
2. Criar mensagem
3. Log `MESSAGE_SENT`

**GET /requests/:id/messages** — paginado (`page`, `limit`) e ordenado por `createdAt ASC`

**GET /requests/:id/history** — ordenar por `createdAt ASC`

**GET /requests/:id/permissions/me:**
```json
{
  "permissions": ["request:view", "request:message", "request:change_status"]
}
```

**Validar:**
- [ ] Maria e Pedro trocam mensagens
- [ ] Histórico mostra: CREATED → ASSIGNED → STATUS_CHANGED → MESSAGE_SENT
- [ ] Usuário sem acesso não envia mensagem

---

### Fase 9 — Testes

**Unitários** — `permission.service.spec.ts`:
- [ ] Admin pode tudo
- [ ] Criador cancela se NOVA
- [ ] Criador não cancela se EM_ANDAMENTO
- [ ] Manager atribui
- [ ] Technician não atribui
- [ ] Technician edita só se responsável

**E2E** — `test/requests.e2e-spec.ts`:
- [ ] Login Maria → criar request → login João → assign Pedro → login Pedro → concluir
- [ ] Auto-atribuição → 400
- [ ] GET /requests como Maria não retorna requests de outros

```bash
npm run test
npm run test:e2e
```

---

### Fase 10 — README

**Incluir:**
1. O que é o projeto (2 parágrafos)
2. Como rodar (docker/postgres, migrate, seed, start)
3. Credenciais da demo
4. Fluxo de teste manual (curl ou Insomnia)
5. Decisões técnicas (RBAC fixo, por que não políticas configuráveis)
6. O que melhoraria com mais tempo (link mental para Parte B do CONTEXTO.md)

---

## Ordem de dependências

```
Prisma/Seed
    └── Auth
         └── Users (admin)
              └── Sectors/Memberships
                   └── Permissions
                        └── Requests
                             ├── Assign/Status/Cancel
                             ├── Messages
                             └── History
                                  └── Testes → README
```

**Não pule fases.** Permissions antes de Requests evita refatorar depois.

---

## Teste manual rápido (curl)

```bash
# 1. Login Maria
TOKEN_MARIA=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"maria@servicehub.com","password":"demo123"}' | jq -r .accessToken)

# 2. Criar solicitação (substituir SECTOR_ID)
curl -X POST http://localhost:3000/requests \
  -H "Authorization: Bearer $TOKEN_MARIA" \
  -H "Content-Type: application/json" \
  -d '{"title":"Computador lento","description":"Preciso de ajuda","sectorId":"SECTOR_ID"}'

# 3. Login João → listar → atribuir → etc.
```

---

## O que NÃO fazer neste MVP

- ❌ Tabelas de políticas configuráveis
- ❌ Código de convite
- ❌ Endpoint de registro público
- ❌ DELETE em mensagens
- ❌ Auditoria de usuários/setores
- ❌ Papéis customizáveis por setor no banco
- ❌ Frontend (opcional; API primeiro)

---

## Definição de pronto

O MVP está pronto quando:

1. Seed roda e popula demo
2. Fluxo Maria → João → Pedro → COMPLETED funciona via API
3. Regra criador ≠ responsável bloqueia com 400
4. Histórico registra todas as ações
5. Testes unitários + 1 e2e passam
6. README explica como reproduzir

---

## Anotações

### Validações no service (obrigatório)

1. **`sectorServiceId` deve pertencer ao `sectorId` da solicitação** — ao criar ou editar, buscar o `SectorService` e garantir `sectorService.sectorId === request.sectorId`. Caso contrário → `400 Bad Request`.

2. **Criador ≠ responsável** — bloquear em `assign` / `reassign`.

3. **Responsável deve ser membro ativo do setor destino.**

4. **Sem `onDelete: Cascade`** — solicitações, mensagens e histórico **não são apagados** em cascata. Preservar rastreabilidade. Se precisar "remover", usar soft delete ou status `ARCHIVED` — não DELETE físico no MVP.

### Status — decisões registradas

| Status | Decisão |
|--------|---------|
| `NEW` | Chamado recém-criado, na fila |
| `PENDING` | Pendente de resposta/informação do **solicitante** |
| `IN_PROGRESS` | Em atendimento com responsável |
| `COMPLETED` | Resolvido |
| `CANCELLED` | Encerrado sem resolução |
| `ARCHIVED` | Arquivado por gerente/admin — fora das listas ativas |

### Histórico

- `RequestHistory` é **append-only** — sem editar/apagar registros.
- `RequestHistoryAction` deve ser usado no campo `action` (não `String` livre).

---

## Fase 6+ — Requests (rotas)

Permissões e filtros no **service** via `req.user` + membership + flags do setor (`onlyManagerCanView/Edit/Archive`). `isGlobalAdmin` bypassa tudo.

**Listagem (`GET .../requests`):** MANAGER vê todos; TECHNICIAN com `onlyManagerCanView: true` vê só atribuídos/criados por ele; com `false` vê todos do setor.

**Validações no service:** `sectorServiceId` pertence ao `sectorId`; criador ≠ responsável no `assign`; responsável deve ser membro do setor; criar sem `assignedToId` (fila do setor).

| Método | Rota | Módulo | Para quê | Retorna |
|--------|------|--------|----------|---------|
| `GET` | `/auth/profile` | `auth` | Header / sessão | `{ sub, email, username, isGlobalAdmin }` |
| `GET` | `/me/sectors` | `me` | Home — setores do usuário | Paginado: `{ id, name, role, permissions, counts por status }`. Query: `?status=` |
| `GET` | `/sectors/:sectorId/services/options` | `sector-services` | Select ao criar chamado | `[{ id, name }]` — só ativos. Valida membro do setor |
| `GET` | `/sectors/:sectorId/requests` | `requests` | Fila do setor | `{ sector, data[], meta }` — filtra por permissão do usuário. Query: `?status=&priority=&search=` |
| `POST` | `/sectors/:sectorId/requests` | `requests` | Criar chamado | Body: `{ title, description, sectorServiceId, priority? }`. `assignedTo: null`. History: `CREATED` |
| `GET` | `/requests/:id` | `requests` | Detalhe (1 request) | Chamado + sector + service + pessoas + `permissions` + `messages` + `history` (se permitido) |
| `PATCH` | `/requests/:id` | `requests` | Editar campos | Valida `canEdit`. History: `UPDATED` |
| `PATCH` | `/requests/:id/status` | `requests` | Mudar status | Valida `canChangeStatus`. History: `STATUS_CHANGED` |
| `PATCH` | `/requests/:id/assign` | `requests` | Atribuir técnico | Só MANAGER. Body: `{ assignedToId }`. Valida membro + criador ≠ responsável. History: `ASSIGNED` |
| `PATCH` | `/requests/:id/cancel` | `requests` | Cancelar | Valida permissão. History: `CANCELLED` |
| `PATCH` | `/requests/:id/archive` | `requests` | Arquivar | Respeita `onlyManagerCanArchive`. History: `ARCHIVED` |
| `POST` | `/requests/:id/messages` | `requests` | Enviar mensagem | Valida `canSendMessage`. History: `MESSAGE_SENT` |

*Guia de implementação — junho/2026*
