# ServiceHub — Contexto do Sistema

> Documento de referência para desenvolvimento.
>
> - **Parte A (seções 2–10):** Escopo do **teste técnico** — implementar agora.
> - **Parte B (seções 11+):** Visão de **produto futuro** — não implementar no teste.

**Stack:** NestJS + TypeScript + PostgreSQL + Prisma.

---

## 1. Visão geral

**ServiceHub** é uma central de serviços interna. Usuários abrem **solicitações** para um **setor**; membros do setor atribuem um responsável e resolvem o chamado.

**Para o teste técnico:** entregar um MVP funcional com RBAC fixo (código), fluxo completo de solicitação, mensagens e histórico — sem motor de políticas configurável.

> **Guia passo a passo de implementação:** [`MVP-GUIA.md`](./MVP-GUIA.md)

---

## 2. Escopo do teste técnico

### 2.1 Objetivo

Demonstrar em código:

- Modelagem de domínio (setores, usuários, solicitações)
- Autenticação JWT
- Autorização por papel (RBAC fixo)
- Fluxo ponta a ponta com regras de negócio
- Histórico rastreável
- Código organizado em módulos NestJS
- Testes nos caminhos críticos

### 2.2 O que ENTRA no MVP

| Feature | Descrição |
|---------|-----------|
| Login JWT | Email + senha |
| Admin cria usuários | Sem código de convite, sem registro público |
| CRUD setores | Admin gerencia setores |
| Vínculo usuário ↔ setor | Com papel fixo: `MANAGER` ou `TECHNICIAN` |
| Criar solicitação | Qualquer usuário autenticado, para qualquer setor |
| Listar solicitações | Filtros por visibilidade (hardcoded por papel) |
| Atribuir responsável | Gerente do setor; criador ≠ responsável |
| Mudar status | Máquina de estados fixa |
| Mensagens | Criador e responsável (e gerente) na solicitação |
| Histórico da solicitação | Log de criação, edição, atribuição, status, mensagens |
| Seed | Dados de exemplo para demo |

### 2.3 O que FICA DE FORA (produto futuro — Parte B)

| Feature | Motivo do corte |
|---------|-----------------|
| Políticas configuráveis por setor | Complexidade alta, não essencial para provar competência |
| ViewPolicy / CreatorPolicy em banco | Substituído por regras fixas em `PermissionService` |
| Código de convite | Um fluxo de cadastro (admin) basta |
| Auditoria de usuários/setores | Só histórico de solicitação no MVP |
| Papéis customizáveis por setor | Enum fixo `MANAGER` / `TECHNICIAN` |
| Notificações, anexos, SLA, categorias | Escopo extra |

### 2.4 Decisões fechadas para o MVP

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Cadastro | Somente admin cria usuários |
| 2 | Senha | Admin define na criação; sem "esqueci senha" |
| 3 | Atribuir muda status? | Sim — `NOVA` → `EM_ANDAMENTO` automaticamente |
| 4 | Criador = responsável | **Proibido** (validação em assign) |
| 5 | Quem cancela | Somente **manager** do setor |
| 6 | Quem conclui | **Responsável** ou **manager** do setor |
| 7 | O que o solicitante faz após criar | Apenas **ver** e **enviar mensagens** |
| 7 | Responsável desativado | `assigned_to_id = null`, volta para fila, status permanece |
| 8 | Mensagens | Não apagáveis |
| 9 | Criador vê sua solicitação | Sempre, independente do setor |

### 2.5 História principal (demo)

```
1. Maria (usuária comum) cria solicitação para o setor TI
2. João (gerente TI) vê na fila do setor
3. João atribui a Pedro (técnico TI) → status vira EM_ANDAMENTO
4. Maria e Pedro trocam mensagens
5. Pedro conclui → status CONCLUIDA
6. Histórico registra cada passo
```

Caso extra para validar regra: João (gerente TI) cria solicitação para TI → pode atribuir a Pedro, **não pode** se atribuir.

---

## 3. Papéis e permissões (MVP — fixo no código)

### 3.1 Papéis existentes

| Papel | Onde vive | Para que serve |
|-------|-----------|----------------|
| **ADMIN** | `users.is_global_admin = true` | Gerencia usuários, setores e vínculos. Bypass total. |
| **MANAGER** | `user_sector_memberships.role` | Gerencia fila do setor: vê tudo, atribui, reatribui, muda status, cancela. |
| **TECHNICIAN** | `user_sector_memberships.role` | Vê fila (sem responsável) + suas atribuídas. Edita e resolve as suas. |
| **Usuário comum (solicitante)** | Autenticado | Cria solicitações; depois só **acompanha e envia mensagens** |

### 3.2 Divisão solicitante vs setor

| Atua como | Permissões |
|-----------|------------|
| **Solicitante (criador)** | Ver + mensagens. Nada operacional. |
| **Manager do setor** | Atribuir, reatribuir, status, cancelar, editar, ver todas |
| **Responsável (assignee)** | Status, editar (quando atribuído), mensagens |

Criador que também é manager do setor opera pelo **papel de setor**, não como solicitante.

### 3.3 Visibilidade (quem vê o quê)

| Papel | Vê na listagem |
|-------|----------------|
| Admin | Tudo |
| Criador | Sempre suas solicitações (`created_by_id = eu`) |
| Manager do setor | Todas do setor |
| Technician do setor | Fila (`assigned_to_id IS NULL`) + atribuídas a ele |
| Usuário comum | Apenas as que criou |

### 3.4 Matriz de ações (hardcoded)

Legenda: ✅ permitido · ❌ negado

| Ação | Admin | Solicitante | Manager (setor) | Responsável |
|------|-------|-------------|-----------------|-------------|
| Criar solicitação | ✅ | ✅ | ✅ | ✅ |
| Ver detalhe | ✅ | ✅ (suas) | ✅ (setor) | ✅ (fila + suas) |
| Editar título/descrição | ✅ | ❌ | ✅ | ✅ se atribuído |
| Atribuir | ✅ | ❌ | ✅ | ❌ |
| Reatribuir | ✅ | ❌ | ✅ | ❌ |
| Mudar status | ✅ | ❌ | ✅ | ✅ se atribuído |
| Cancelar | ✅ | ❌ | ✅ | ❌ |
| Enviar mensagem | ✅ | ✅ | ✅ | ✅ |

### 3.5 Onde fica no código

```
src/modules/permissions/
├── permission.service.ts    # can(), getVisibleRequestsFilter(), getAllowedActions()
├── permission.guard.ts      # lê decorator @RequirePermission()
└── decorators/
    └── require-permission.decorator.ts
```

**Por que assim:** mostra que você entende o problema de permissões configuráveis (documentado na Parte B) sem construir o motor inteiro.

---

## 4. Máquina de estados (MVP — fixa)

```typescript
enum RequestStatus {
  NOVA = 'NOVA',
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  AGUARDANDO = 'AGUARDANDO',
  CONCLUIDA = 'CONCLUIDA',
  CANCELADA = 'CANCELADA',
}
```

**Transições permitidas:**

```
NOVA           → EM_ANDAMENTO   (ao atribuir OU manualmente)
NOVA           → CANCELADA
EM_ANDAMENTO   → AGUARDANDO
EM_ANDAMENTO   → CONCLUIDA
EM_ANDAMENTO   → CANCELADA
AGUARDANDO     → EM_ANDAMENTO
AGUARDANDO     → CANCELADA
CONCLUIDA      → (terminal)
CANCELADA      → (terminal)
```

**Regra:** ao `PATCH /requests/:id/assign`, se status = `NOVA`, mudar automaticamente para `EM_ANDAMENTO`.

---

## 5. Banco de dados (MVP)

**6 tabelas.** ORM: Prisma.

### 5.1 Diagrama de relações

```
users ─────────────┬──────────────────────────────────┐
                   │                                  │
                   │ created_by                       │ assigned_to
                   ▼                                  ▼
              requests ◄──── sector_id ──── sectors   │
                   │                                  │
                   ├── request_messages               │
                   └── request_history                │
                                                       │
user_sector_memberships ── user_id / sector_id ───────┘
```

### 5.2 `users`

**Para que serve:** autenticação e identidade de todos os participantes.

| Coluna | Tipo | Restrições | Descrição |
|--------|------|------------|-----------|
| `id` | UUID | PK | Identificador |
| `name` | VARCHAR(150) | NOT NULL | Nome exibido |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Login |
| `password_hash` | VARCHAR(255) | NOT NULL | Senha bcrypt |
| `is_global_admin` | BOOLEAN | DEFAULT false | Admin do sistema |
| `active` | BOOLEAN | DEFAULT true | Conta ativa |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | | |

### 5.3 `sectors`

**Para que serve:** destino da solicitação (TI, RH, etc.).

| Coluna | Tipo | Restrições | Descrição |
|--------|------|------------|-----------|
| `id` | UUID | PK | |
| `name` | VARCHAR(100) | NOT NULL | Nome do setor |
| `slug` | VARCHAR(100) | UNIQUE, NOT NULL | Identificador URL (`ti`, `rh`) |
| `active` | BOOLEAN | DEFAULT true | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | | |

### 5.4 `user_sector_memberships`

**Para que serve:** define quem pertence a qual setor e com qual papel operacional.

| Coluna | Tipo | Restrições | Descrição |
|--------|------|------------|-----------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users, NOT NULL | |
| `sector_id` | UUID | FK → sectors, NOT NULL | |
| `role` | ENUM | `MANAGER`, `TECHNICIAN` | Papel no setor |
| `active` | BOOLEAN | DEFAULT true | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | | |

**Índices:** UNIQUE (`user_id`, `sector_id`) — um papel por setor por usuário.

### 5.5 `requests`

**Para que serve:** núcleo do sistema — o chamado/solicitação.

| Coluna | Tipo | Restrições | Descrição |
|--------|------|------------|-----------|
| `id` | UUID | PK | |
| `title` | VARCHAR(200) | NOT NULL | Título |
| `description` | TEXT | NOT NULL | Detalhes |
| `sector_id` | UUID | FK → sectors, NOT NULL | Setor destino |
| `status` | ENUM | NOT NULL, DEFAULT `NOVA` | Estado atual |
| `created_by_id` | UUID | FK → users, NOT NULL | Quem abriu |
| `assigned_to_id` | UUID | FK → users, NULLABLE | Responsável |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | | |
| `closed_at` | TIMESTAMPTZ | NULLABLE | Preenchido em CONCLUIDA/CANCELADA |

**Índices:**
- (`sector_id`, `status`)
- (`created_by_id`)
- (`assigned_to_id`)
- (`sector_id`, `assigned_to_id`) — fila do setor

**Constraints de negócio (aplicação):**
- `assigned_to_id !== created_by_id`
- `assigned_to_id` deve ter membership ativo no `sector_id`

### 5.6 `request_messages`

**Para que serve:** conversa entre criador, responsável e gerente dentro da solicitação.

| Coluna | Tipo | Restrições | Descrição |
|--------|------|------------|-----------|
| `id` | UUID | PK | |
| `request_id` | UUID | FK → requests, NOT NULL | |
| `author_id` | UUID | FK → users, NOT NULL | Quem enviou |
| `content` | TEXT | NOT NULL | Conteúdo |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

**Índice:** (`request_id`, `created_at`)

### 5.7 `request_history`

**Para que serve:** rastreabilidade — quem fez o quê e quando em cada solicitação.

| Coluna | Tipo | Restrições | Descrição |
|--------|------|------------|-----------|
| `id` | UUID | PK | |
| `request_id` | UUID | FK → requests, NOT NULL | |
| `user_id` | UUID | FK → users, NOT NULL | Quem executou |
| `action` | VARCHAR(50) | NOT NULL | Tipo do evento (ver abaixo) |
| `from_status` | ENUM | NULLABLE | Status anterior |
| `to_status` | ENUM | NULLABLE | Status novo |
| `metadata` | JSONB | NULLABLE | Dados extras (campos alterados, assignee anterior, etc.) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

**Valores de `action`:**

```
CREATED | UPDATED | ASSIGNED | REASSIGNED | STATUS_CHANGED | CANCELLED | MESSAGE_SENT
```

**Índice:** (`request_id`, `created_at`)

### 5.8 Schema Prisma (referência)

```prisma
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
  id              String   @id @default(uuid())
  name            String
  email           String   @unique
  passwordHash    String   @map("password_hash")
  isGlobalAdmin   Boolean  @default(false) @map("is_global_admin")
  active          Boolean  @default(true)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  memberships       UserSectorMembership[]
  createdRequests   Request[] @relation("CreatedBy")
  assignedRequests  Request[] @relation("AssignedTo")
  messages          RequestMessage[]
  history           RequestHistory[]

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

  request Request @relation(fields: [requestId], references: [id])
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

  request Request @relation(fields: [requestId], references: [id])
  user    User    @relation(fields: [userId], references: [id])

  @@index([requestId, createdAt])
  @@map("request_history")
}
```

---

## 6. Módulos e implementação (MVP)

### 6.1 Estrutura de pastas

```
src/
├── main.ts
├── app.module.ts
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── common/
│   ├── decorators/       # @CurrentUser(), @RequirePermission()
│   ├── guards/           # JwtAuthGuard
│   └── filters/          # HttpExceptionFilter
└── modules/
    ├── auth/             # login, JWT
    ├── users/            # CRUD admin
    ├── sectors/          # CRUD setores + memberships
    ├── requests/         # solicitações, assign, status
    ├── messages/         # mensagens da solicitação
    ├── history/          # grava e lista request_history
    └── permissions/      # PermissionService (RBAC fixo)
```

### 6.2 Para que serve cada módulo

| Módulo | Responsabilidade |
|--------|------------------|
| **auth** | `POST /auth/login` → JWT. Guard de autenticação. |
| **users** | Admin cria/edita/desativa usuários. |
| **sectors** | Admin CRUD setores. Admin vincula usuário a setor com papel. |
| **requests** | CRUD solicitações, assign, status, cancel. Aplica regras de negócio. |
| **messages** | Envia e lista mensagens. Valida permissão COMMENT. |
| **history** | Serviço interno: toda mudança em request chama `HistoryService.log()`. |
| **permissions** | Centraliza `can(user, action, request?)`. Guards usam isso. |

### 6.3 API do MVP

```
# Auth
POST   /auth/login

# Users (admin)
POST   /users
GET    /users
GET    /users/:id
PATCH  /users/:id
PATCH  /users/:id/deactivate

# Sectors (admin)
POST   /sectors
GET    /sectors
GET    /sectors/:id
PATCH  /sectors/:id

# Memberships (admin)
POST   /sectors/:sectorId/members        # { userId, role }
DELETE /sectors/:sectorId/members/:userId
GET    /sectors/:sectorId/members

# Requests
POST   /requests                         # qualquer autenticado
GET    /requests                         # filtrado por visibilidade
GET    /requests/:id
PATCH  /requests/:id                     # editar
PATCH  /requests/:id/assign              # { assigneeId }
PATCH  /requests/:id/status              # { status }
PATCH  /requests/:id/cancel
GET    /requests/:id/permissions/me      # ações permitidas (para UI)

# Messages
POST   /requests/:id/messages            # { content }
GET    /requests/:id/messages

# History
GET    /requests/:id/history
```

### 6.4 Ordem de implementação

| Fase | O que fazer | Entrega |
|------|-------------|---------|
| **1** | Prisma + migrations + seed | 6 tabelas, dados de demo |
| **2** | Auth (login, JWT, guard) | Consegue autenticar |
| **3** | Users + Sectors + Memberships | Admin configura ambiente |
| **4** | PermissionService | `can()` funcionando com testes unitários |
| **5** | Requests (criar, listar, detalhe) | Fluxo de criação |
| **6** | Assign + validações | Regra criador ≠ responsável |
| **7** | Status + máquina de estados | Fluxo até conclusão |
| **8** | Messages + History | Comunicação e rastreio |
| **9** | Testes e2e do fluxo principal | História da Maria → Pedro |
| **10** | README | Como rodar, decisões, demo |

### 6.5 Testes mínimos exigidos

**Unitários (`permission.service.spec.ts`):**
- Solicitante vê e envia mensagem
- Solicitante não edita, cancela nem muda status
- Manager atribui e cancela
- Responsável muda status
- Criador não pode ser assignee

**E2E (`requests.e2e-spec.ts`):**
- Fluxo completo: criar → atribuir → mensagem → concluir
- Tentativa de auto-atribuição retorna 400
- Usuário comum não vê solicitações de outros

### 6.6 Seed de demonstração

```
Admin:     admin@servicehub.com / admin123
Setores:   TI, RH

TI:
  João  → MANAGER   (joao@... / demo123)
  Pedro → TECHNICIAN (pedro@... / demo123)

RH:
  Ana → MANAGER (ana@... / demo123)

Usuários comuns:
  Maria → sem vínculo (maria@... / demo123)
```

---

## 7. Regras de negócio no código (referência)

### Assign

```typescript
function validateAssignment(request: Request, assigneeId: string): void {
  if (assigneeId === request.createdById) {
    throw new BadRequestException('CREATOR_CANNOT_BE_ASSIGNEE');
  }
  const membership = await findActiveMembership(assigneeId, request.sectorId);
  if (!membership) {
    throw new BadRequestException('ASSIGNEE_MUST_BE_SECTOR_MEMBER');
  }
}
```

### Ao atribuir

```typescript
await prisma.request.update({
  where: { id },
  data: {
    assignedToId: assigneeId,
    status: request.status === 'NOVA' ? 'EM_ANDAMENTO' : request.status,
  },
});
await historyService.log({ action: 'ASSIGNED', ... });
```

---

# Parte B — Visão de Produto (FUTURO)

> Seções abaixo documentam a evolução pós-teste. **Não implementar agora.**

---

## 11. Glossário (produto futuro)

| Termo | Definição |
|-------|-----------|
| **Setor** | Área que recebe e trata solicitações (ex: TI, RH, Financeiro) |
| **Solicitação** | Pedido aberto por um usuário, direcionado a um setor |
| **Criador** | Usuário que abriu a solicitação (`createdById`) |
| **Membro do setor** | Usuário vinculado ao setor destino com um papel (role) |
| **Responsável** | Membro do setor atribuído para tratar a solicitação (`assignedToId`) |
| **Papel (SectorRole)** | Função dentro de um setor (ex: Gerente, Supervisor, Técnico) — configurável por setor |
| **Política** | Regra que define quem pode fazer o quê, em qual status |
| **Código de convite** | Token gerado por admin para auto-cadastro na tela de login |
| **Mensagem** | Comunicação dentro da solicitação entre criador e responsável |

## 12. Princípio central de permissões (produto futuro)

**Não existem dois tipos de usuário (solicitante vs atendente).**

Em cada solicitação, o sistema avalia **relações**:

```
┌─────────────────────────────────────────────────────────┐
│  Solicitação #42 — Setor: TI — Status: NOVA             │
│                                                         │
│  João:  ✓ Criador   ✓ Membro (Gerente)   ✗ Responsável │
│  Maria: ✗ Criador   ✗ Membro              ✗ Responsável │
│  Pedro: ✗ Criador   ✓ Membro (Técnico)    ✓ Responsável│
└─────────────────────────────────────────────────────────┘
```

Permissão = união das regras cuja relação o usuário satisfaz **nessa solicitação**.

Quando o usuário é criador **e** membro do setor (pediu para o próprio setor), ações operacionais vêm do **papel de setor** (manager/responsável). Como solicitante, só vê e envia mensagens.

### Regras de negócio fixas (não configuráveis)

Estas regras são **hardcoded** — não passam pela matriz de políticas:

| Regra | Motivo |
|-------|--------|
| **Criador ≠ Responsável** | `createdById` nunca pode ser igual a `assignedToId`. Bloquear em ASSIGN e REASSIGN. |
| **Responsável é membro do setor destino** | Só usuários com `UserSectorMembership` ativo no `sectorId` da solicitação podem ser atribuídos |
| **Sem registro público** | Conta só via admin ou código de convite válido |
| **Criador sempre vê sua solicitação** | Independente de ViewPolicy do setor (mínimo: VIEW_DETAIL) |

> **Nota:** Criador + membro do setor **é permitido** (ex: gerente abre chamado para o próprio TI e atribui a um técnico). O que é proibido é ser criador **e** responsável.

## 13. Entidades do domínio (produto futuro)

### 4.1 User

```
User
├── id
├── name
├── email
├── passwordHash
├── isGlobalAdmin: boolean   // bypass de permissões (configuração do sistema)
├── active: boolean
├── createdVia: 'ADMIN' | 'INVITE_CODE'
├── createdAt, updatedAt
```

### 4.1.1 InviteCode (cadastro interno)

Dois fluxos de criação de conta — **sem registro avulso**:

```
InviteCode
├── id
├── code                  // token único (ex: UUID ou código alfanumérico)
├── createdById           // admin que gerou
├── expiresAt             // data de expiração
├── maxUses: number       // geralmente 1
├── usedCount: number
├── usedById?             // quem usou (quando maxUses = 1)
├── sectorId?             // opcional: já vincula ao setor no cadastro
├── sectorRoleId?         // opcional: já define papel inicial
├── active: boolean
├── createdAt
```

**Fluxo A — Admin cria diretamente:**
1. Admin preenche nome, email, senha (ou senha temporária)
2. Opcionalmente já vincula a setor(es) e papel(is)
3. `createdVia = ADMIN`

**Fluxo B — Código de convite:**
1. Admin gera código (com expiração e usos limitados)
2. Pode pré-configurar setor/papel que o usuário entrará
3. Na tela de login, opção "Primeiro acesso" → informa código → cria conta
4. `createdVia = INVITE_CODE`, código marcado como usado

**Pendente definir:** fluxo de redefinição de senha e convite expirado (ver seção 18).

### 4.2 Sector

```
Sector
├── id
├── name
├── slug
├── active: boolean
├── createdAt, updatedAt
```

### 4.3 SectorRole

Papel **dentro de um setor**. Cada setor define seus próprios papéis.

```
SectorRole
├── id
├── sectorId
├── name          // ex: "Gerente", "Supervisor", "Técnico"
├── slug
├── sortOrder
├── active: boolean
```

### 4.4 UserSectorMembership

```
UserSectorMembership
├── id
├── userId
├── sectorId
├── sectorRoleId
├── active: boolean
```

Um usuário pode pertencer a vários setores, com papéis diferentes em cada um.

### 4.5 Request (Solicitação)

```
Request
├── id
├── title
├── description
├── sectorId              // setor destino (quem vai atender)
├── status: RequestStatus
├── createdById           // quem abriu (qualquer usuário do sistema)
├── assignedToId          // responsável (nullable, membro do setor destino)
├── priority?: Priority
├── createdAt, updatedAt
├── closedAt?
```

### 4.6 RequestStatus

```typescript
enum RequestStatus {
  NOVA = 'NOVA',
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  AGUARDANDO = 'AGUARDANDO',
  CONCLUIDA = 'CONCLUIDA',
  CANCELADA = 'CANCELADA',
}
```

### 4.7 RequestMessage (mensagens da solicitação)

Conversa entre **criador** e **responsável** (e eventualmente outros com permissão de COMMENT).

```
RequestMessage
├── id
├── requestId
├── authorId
├── content
├── createdAt
├── updatedAt?            // se permitir edição (pendente — ver seção 18)
```

**Regras:**
- Quem pode enviar: usuários com permissão `COMMENT` na solicitação
- Criador e responsável são os participantes principais
- Gerente/supervisor com política de COMMENT também podem participar
- Mensagens **não podem ser apagadas** na v1 (só adicionadas) — preserva histórico
- Toda mensagem gera entrada no `RequestAuditLog`

### 4.8 Histórico e auditoria

Grande parte das entidades deve ter rastreabilidade. Usar tabela de audit log genérica ou por domínio.

```
AuditLog
├── id
├── entityType            // 'USER' | 'MEMBERSHIP' | 'REQUEST' | 'POLICY' | 'SECTOR' | 'MESSAGE'
├── entityId
├── action                // 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED' | 'ASSIGNED' | ...
├── performedById         // quem fez
├── changes: JSON         // { field: { from, to } } — snapshot do que mudou
├── metadata?: JSON       // contexto extra (IP, motivo, etc.)
├── createdAt
```

**O que deve gerar histórico obrigatoriamente:**

| Entidade | Eventos auditados |
|----------|-------------------|
| **User** | Criação, alteração de nome/email, ativação/desativação, troca de senha |
| **UserSectorMembership** | Entrada no setor, saída, troca de papel, ativação/desativação |
| **Sector / SectorRole** | CRUD, ativação/desativação |
| **Políticas do setor** | Qualquer alteração (quem mudou, o que mudou) |
| **Request** | Criação, edição, atribuição, reatribuição, mudança de status, cancelamento |
| **RequestMessage** | Nova mensagem enviada |
| **InviteCode** | Criação, uso, revogação |

**RequestAuditLog** (atalho específico para solicitações — pode ser view/filtro do AuditLog):

```
RequestAuditLog
├── id
├── requestId
├── userId
├── action: RequestAction | 'MESSAGE_SENT' | 'FIELD_UPDATED'
├── fromStatus?, toStatus?
├── changes?: JSON
├── createdAt
```

## 14. Ações — enum fixo (produto futuro)

Lista fechada — a UI configura **quem** pode executar, não cria ações novas.

```typescript
enum RequestAction {
  VIEW_LIST = 'VIEW_LIST',       // listar solicitações (filtro por visibilidade)
  VIEW_DETAIL = 'VIEW_DETAIL',   // ver detalhe
  CREATE = 'CREATE',             // criar solicitação para um setor
  EDIT = 'EDIT',                 // editar campos da solicitação
  ASSIGN = 'ASSIGN',             // atribuir responsável
  REASSIGN = 'REASSIGN',         // trocar responsável
  CHANGE_STATUS = 'CHANGE_STATUS',
  COMMENT = 'COMMENT',
  CANCEL = 'CANCEL',
}
```

## 15. Modelo de permissões configuráveis (produto futuro)

### 6.1 Dois blocos de configuração (por setor)

#### Bloco A — Regras do criador

Aplicam-se quando `user.id === request.createdById`.

Independente do setor do criador. **Globais por setor destino** (cada setor pode configurar o que criadores podem fazer nas solicitações dirigidas a ele).

```
CreatorPolicy
├── id
├── sectorId              // setor destino da solicitação
├── status: RequestStatus | '*'
├── allowedActions: RequestAction[]
├── enabled: boolean
```

**Defaults sugeridos:**

| Status | Ações permitidas ao criador |
|--------|----------------------------|
| * (todos) | VIEW_DETAIL, COMMENT |

#### Bloco B — Regras dos membros do setor

Aplicam-se quando o usuário tem `UserSectorMembership` no `request.sectorId`.

```
SectorMemberPolicy
├── id
├── sectorId
├── sectorRoleId | null     // null = qualquer papel do setor
├── appliesTo: PolicyAppliesTo
├── status: RequestStatus | '*'
├── allowedActions: RequestAction[]
├── conditions?: PolicyConditions
├── enabled: boolean
```

```typescript
enum PolicyAppliesTo {
  ALL_MEMBERS = 'ALL_MEMBERS',           // qualquer membro do setor
  SPECIFIC_ROLE = 'SPECIFIC_ROLE',       // sectorRoleId definido
  ASSIGNEE_ONLY = 'ASSIGNEE_ONLY',       // só assignedToId
  ASSIGNEE_OR_ROLE = 'ASSIGNEE_OR_ROLE', // responsável OU papel específico
}

interface PolicyConditions {
  onlyUnassigned?: boolean;   // ex: ASSIGN só se assignedToId é null
  onlyOwn?: boolean;          // ex: EDIT só se sou o responsável
}
```

**Exemplo — setor TI:**

| Papel | Status | Aplica a | Condição | Ações |
|-------|--------|----------|----------|-------|
| Gerente | NOVA | SPECIFIC_ROLE | onlyUnassigned | VIEW_DETAIL, ASSIGN |
| Supervisor | NOVA | SPECIFIC_ROLE | onlyUnassigned | VIEW_DETAIL, ASSIGN |
| Técnico | NOVA | ALL_MEMBERS | — | VIEW_DETAIL |
| Técnico | EM_ANDAMENTO | ASSIGNEE_ONLY | onlyOwn | VIEW_DETAIL, EDIT, CHANGE_STATUS, COMMENT |
| Gerente | * | SPECIFIC_ROLE | — | VIEW_DETAIL, REASSIGN, CHANGE_STATUS, COMMENT |

### 6.2 Avaliação de permissão

```typescript
function can(user: User, action: RequestAction, request: Request): boolean {
  if (user.isGlobalAdmin) return true;

  const policies: Policy[] = [];

  // Bloco A: criador
  if (user.id === request.createdById) {
    policies.push(...getCreatorPolicies(request.sectorId, request.status));
  }

  // Bloco B: membro do setor
  const membership = getMembership(user.id, request.sectorId);
  if (membership) {
    policies.push(
      ...getMemberPolicies(request.sectorId, membership.sectorRoleId, request),
    );
  }

  return policies
    .filter((p) => p.enabled)
    .some((p) => p.allowedActions.includes(action) && matchConditions(p, user, request));
}
```

**Regra:** união (OR) — se qualquer política autorizar, a ação é permitida.

### 6.3 CREATE (criar solicitação)

Ação especial: não depende de uma solicitação existente.

```
CreatePolicy
├── sectorId              // setor que receberá
├── allowedFor: 'ANY_USER' | 'SECTOR_MEMBERS_ONLY'
```

**Default:** `ANY_USER` — qualquer usuário autenticado pode abrir solicitação para qualquer setor.

## 16. Máquina de estados configurável (produto futuro)

Permissão define **quem** pode mudar status; a máquina define **para onde** pode ir.

```typescript
interface StatusTransition {
  from: RequestStatus;
  to: RequestStatus;
  action: string; // ex: 'START', 'WAIT', 'COMPLETE', 'CANCEL'
}
```

**Transições padrão:**

```
NOVA           → EM_ANDAMENTO  (START)
NOVA           → CANCELADA     (CANCEL)
EM_ANDAMENTO   → AGUARDANDO     (WAIT)
EM_ANDAMENTO   → CONCLUIDA     (COMPLETE)
EM_ANDAMENTO   → CANCELADA     (CANCEL)
AGUARDANDO     → EM_ANDAMENTO  (RESUME)
AGUARDANDO     → CANCELADA     (CANCEL)
```

Transições podem ser **globais** ou **customizáveis por setor** (v2). Na v1, usar conjunto fixo.

Ao executar `CHANGE_STATUS`, validar:

1. `can(user, CHANGE_STATUS, request)` — política
2. Transição `from → to` é válida — máquina de estados

## 17. Visibilidade configurável (produto futuro)

Separado de permissão de ação. Controla **quais solicitações aparecem** para cada membro do setor.

> O criador **sempre** vê suas próprias solicitações (regra fixa). Esta seção trata da visibilidade **dentro do setor**.

### 8.1 Escopos de listagem

```typescript
enum ListScope {
  CREATED_BY_ME = 'CREATED_BY_ME',         // solicitações que eu abri (qualquer setor)
  SECTOR_QUEUE = 'SECTOR_QUEUE',           // fila: sem responsável, do meu setor
  ASSIGNED_TO_ME = 'ASSIGNED_TO_ME',       // atribuídas a mim
  ALL_IN_SECTOR = 'ALL_IN_SECTOR',         // todas do setor (independente de atribuição)
  ASSIGNED_TO_OTHERS = 'ASSIGNED_TO_OTHERS', // do setor atribuídas a outros (supervisão)
}
```

### 8.2 ViewPolicy (configurável por setor + papel + status)

Define o que cada papel enxerga **dentro do setor**:

```
ViewPolicy
├── id
├── sectorId
├── sectorRoleId | null     // null = qualquer papel
├── status: RequestStatus | '*'
├── scopes: ListScope[]
├── enabled: boolean
```

**Exemplo — setor TI:**

| Papel | Status | Vê |
|-------|--------|-----|
| Gerente | * | ALL_IN_SECTOR |
| Supervisor | * | ALL_IN_SECTOR, ASSIGNED_TO_ME |
| Técnico | NOVA | SECTOR_QUEUE |
| Técnico | EM_ANDAMENTO+ | ASSIGNED_TO_ME |

Assim, técnico **não vê** chamados já atribuídos a outros colegas — só a fila e os seus.

### 8.3 Telas sugeridas

| Tela | Filtro |
|------|--------|
| **Minhas solicitações** | `createdById = me` (sempre visível) |
| **Fila do setor** | `sectorId IN meusSetores AND assignedToId IS NULL` + ViewPolicy |
| **Atribuídas a mim** | `assignedToId = me` |
| **Todas do setor** | `sectorId = X` — só se ViewPolicy permitir |

Usuário vê a **união** dos escopos permitidos. VIEW_DETAIL segue a mesma lógica: se está na lista, pode abrir (salvo política explícita de negação).

## 18. Casos de uso (produto futuro)

### 9.1 Usuário solicita para outro setor

Maria (RH) → solicitação para TI.

- Maria: relação **criador** → regras do Bloco A
- João (Gerente TI): relação **membro** → regras do Bloco B

### 9.2 Usuário solicita para o próprio setor

João (Gerente TI) → solicitação para TI.

- **Criador** → Bloco A (apenas ver e mensagens)
- **Membro Gerente** → Bloco B (atribuir a **outro**, status, cancelar)
- João opera como gerente para ações operacionais; como solicitante só vê e manda mensagem
- João **não pode** se atribuir como responsável → deve atribuir a Pedro (Técnico)

### 9.5 Mensagens entre criador e responsável

Maria (RH) abre chamado → João (TI) atribui a Pedro (Técnico).

- Maria (criador) e Pedro (responsável) trocam mensagens na solicitação
- João (gerente) pode ver e comentar se política permitir COMMENT
- Cada mensagem registrada no audit log

### 9.3 Técnico só age quando é responsável

Pedro (Técnico TI) vê solicitações NOVA (VIEW_DETAIL), mas só edita/muda status quando `assignedToId === pedro.id` e status = EM_ANDAMENTO (política `ASSIGNEE_ONLY` + `onlyOwn`).

### 9.4 Admin global

`isGlobalAdmin = true` → bypass total. Usado para configuração do sistema, não para operação do dia a dia.

## 19. Validações de configuração (produto futuro)

Ao salvar políticas de um setor, o sistema deve validar:

| Validação | Tipo |
|-----------|------|
| Status NOVA sem nenhuma política com ASSIGN | ❌ Erro |
| Status sem nenhuma política com VIEW_DETAIL | ⚠️ Aviso |
| Transição definida sem política que permita CHANGE_STATUS | ❌ Erro |
| Setor sem CreatorPolicy | ⚠️ Aviso (criador fica sem permissões) |
| Nenhum membro com VIEW_LIST no setor | ❌ Erro |

## 20. Templates de setor (produto futuro)

Novos setores herdam um template para acelerar configuração.

```
SectorTemplate
├── id
├── name                  // ex: "Atendimento padrão"
├── creatorPolicies: CreatorPolicy[]
├── memberPolicies: SectorMemberPolicy[]
├── viewPolicies: ViewPolicy[]
```

Templates disponíveis na v1:

- **Atendimento padrão** — fila + atribuição + técnico responsável
- **Aprovação simples** — gerente aprova/rejeita
- **Somente leitura** — membros veem, só gerente age

## 21. Estrutura de módulos completa (produto futuro)

```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── decorators/
│   ├── guards/
│   └── filters/
├── modules/
│   ├── auth/
│   │   └── invite-codes/
│   ├── users/
│   │   └── user-audit/
│   ├── sectors/
│   │   ├── sector-roles/
│   │   ├── sector-memberships/
│   │   └── sector-policies/      # CreatorPolicy, SectorMemberPolicy, ViewPolicy
│   ├── requests/
│   │   ├── request-messages/
│   │   └── request-audit/
│   ├── audit/                    # AuditLog genérico
│   └── permissions/
│       ├── permission.service.ts  # can(), getListScopes(), getAllowedActions()
│       ├── permission.guard.ts
│       └── decorators/
│           └── require-action.decorator.ts
```

## 22. API completa (produto futuro)

### Endpoints principais

```
POST   /requests                    # criar (CREATE)
GET    /requests                    # listar (filtro por escopos do usuário)
GET    /requests/:id                # detalhe (VIEW_DETAIL)
PATCH  /requests/:id                # editar (EDIT)
PATCH  /requests/:id/assign         # atribuir (ASSIGN / REASSIGN)
PATCH  /requests/:id/status         # mudar status (CHANGE_STATUS)
POST   /requests/:id/messages       # enviar mensagem (COMMENT)
GET    /requests/:id/messages       # listar mensagens
GET    /requests/:id/history        # histórico completo da solicitação
PATCH  /requests/:id/cancel         # cancelar (CANCEL)

POST   /auth/register-with-code     # cadastro via código de convite
POST   /invite-codes                # admin gera código
GET    /invite-codes                # admin lista códigos
DELETE /invite-codes/:id            # admin revoga código

GET    /users/:id/history           # histórico de alterações do usuário
GET    /sectors/:id/policies        # listar políticas do setor
PUT    /sectors/:id/policies        # salvar políticas (com validação)

GET    /sectors/:id/roles           # papéis do setor
POST   /sectors/:id/roles
```

### Resposta de permissões (para UI)

```
GET /requests/:id/permissions/me

{
  "allowedActions": ["VIEW_DETAIL", "ASSIGN", "COMMENT"],
  "listScopes": ["CREATED_BY_ME", "SECTOR_QUEUE", "ALL_IN_MY_SECTORS"]
}
```

A UI usa isso para mostrar/ocultar botões — **nunca confiar só no frontend**.

## 23. Decisões do produto futuro

| Decisão | Escolha |
|---------|---------|
| Quem cria solicitação | Qualquer usuário autenticado, para qualquer setor |
| Criador vê sua solicitação | Sim, sempre (regra fixa) |
| Solicitante após criar | Só ver + mensagens |
| Criador = Responsável | **Proibido** |
| Cancelar | Somente manager do setor |
| Concluir / mudar status | Responsável ou manager do setor |
| Visibilidade no setor | Configurável por papel + status (ViewPolicy) |
| Mensagens | Sim, entre participantes com permissão COMMENT |
| Cadastro de usuários | Admin direto ou código de convite — sem registro público |
| Permissões por status | Sim, obrigatório no modelo |
| Transições de status | Conjunto fixo na v1 |
| Herança de papéis | Não — cada política é explícita por papel |
| Auditoria | Sim — usuários, vínculos, solicitações, políticas, mensagens |
| Mensagens apagáveis | Não na v1 (preservar histórico) |

## 24. Fora do escopo do produto futuro

- Notificações (email/push) — **recomendado na v2**
- Anexos em solicitações
- SLA / prazos
- Sub-tarefas
- Permissões customizáveis por transição de status
- Multi-tenant
- Edição/exclusão de mensagens

## 25. Ordem de implementação do produto futuro

1. **Entidades + migrations** — User, InviteCode, Sector, SectorRole, Membership, Request
2. **Auth** — login, JWT, registro via código, guard básico
3. **CRUD usuários** — admin cria, gera convites
4. **CRUD setores e membros**
5. **AuditLog** — serviço genérico de auditoria (usado desde o início)
6. **PermissionService** — `can()`, `getAllowedActions()`, `getListScopes()`
7. **CRUD solicitações** — com guards + validação criador ≠ responsável
8. **RequestMessages** — envio e listagem
9. **Políticas configuráveis** — CRUD + validação + seed com template padrão
10. **Endpoint `/permissions/me`** e `/requests/:id/history` para UI

## 26. Validações em ASSIGN (produto futuro)

```typescript
function validateAssignment(request: Request, assigneeId: string): void {
  if (assigneeId === request.createdById) {
    throw new BusinessError('CREATOR_CANNOT_BE_ASSIGNEE');
  }

  const membership = getMembership(assigneeId, request.sectorId);
  if (!membership?.active) {
    throw new BusinessError('ASSIGNEE_MUST_BE_SECTOR_MEMBER');
  }

  const assignee = getUser(assigneeId);
  if (!assignee?.active) {
    throw new BusinessError('ASSIGNEE_INACTIVE');
  }
}
```

## 27. Pendências do produto futuro

Itens que impactam desenvolvimento e ainda precisam de decisão:

### Alta prioridade

| # | Pergunta | Opções / notas |
|---|----------|----------------|
| 1 | **Responsável sai do setor ou é desativado** — o que acontece com solicitações abertas? | (a) Reatribuição obrigatória por gerente (b) Volta para fila automaticamente (c) Bloqueia até admin resolver |
| 2 | **Atribuição muda status?** | Ao atribuir, status vai de NOVA → EM_ANDAMENTO automaticamente? |
| 3 | **Quem pode concluir vs cancelar?** | Cancelar = criador ou gerente? Concluir = só responsável? |
| 4 | **Redefinição de senha** | Admin redefine? Link por email? Ou só admin na v1? |
| 5 | **Código de convite pré-vincula setor?** | Código já coloca o usuário no setor ou só cria conta vazia? |

### Média prioridade

| # | Pergunta | Opções / notas |
|---|----------|----------------|
| 6 | **Categorias/tipos de solicitação** | Setor tem tipos (ex: "Hardware", "Software") com formulários diferentes? |
| 7 | **Prioridade** | Baixa/Média/Alta? Afeta ordenação da fila? |
| 8 | **Prazo/SLA** | Data limite por solicitação? Alerta de atraso? |
| 9 | **Anexos** | Upload de arquivos na solicitação ou nas mensagens? |
| 10 | **Notificações** | Avisar responsável ao atribuir? Avisar criador ao mudar status? (v2, mas define arquitetura) |

### Baixa prioridade (v2+)

| # | Pergunta |
|---|----------|
| 11 | Escalonamento automático se ficar X dias sem atribuição |
| 12 | Templates de solicitação por setor (campos pré-definidos) |
| 13 | Dashboard/relatórios (tempo médio, volume por setor) |
| 14 | Busca full-text em solicitações e mensagens |

---

*Última atualização: junho/2026 — Parte A: escopo MVP teste técnico | Parte B: visão produto*
