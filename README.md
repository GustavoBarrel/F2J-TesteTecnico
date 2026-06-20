# ServiceHub

Central de serviços interna. Usuários abrem solicitações para setores; gerentes atribuem responsáveis; acompanhamento por mensagens e histórico.

## Stack

- [NestJS](https://nestjs.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [PostgreSQL](https://www.postgresql.org/)
- [Prisma](https://www.prisma.io/)

## Funcionalidades (MVP)

- Autenticação e usuários (admin)
- Setores com categorias de serviço (`SectorService`)
- Papéis por setor: Gerente e Técnico
- Solicitações com status, prioridade, atribuição e mensagens
- Histórico de alterações por solicitação

## Pré-requisitos

- Node.js 20+
- PostgreSQL
- npm

## Instalação

```bash
git clone <url-do-repositorio>
cd servicehub
npm install
```

## Configuração

```bash
cp .env.example .env
```

Edite `.env` com sua connection string:

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/central_servicos"
```

## Banco de dados

```bash
npx prisma generate
npx prisma migrate dev
npm run db:seed
```

O seed cria as roles padrão (`MANAGER`, `TECHNICIAN`).

## Executar

```bash
# desenvolvimento
npm run start:dev

# produção
npm run build
npm run start:prod
```

## Testes

```bash
npm run test
npm run test:e2e
```

## Estrutura do projeto

```
servicehub/
├── docs/                    # Documentação (CONTEXTO, MVP-GUIA, front-end)
├── prisma/                  # schema, migrations e seeds
├── src/
│   ├── auth/                # login JWT, guards
│   ├── common/              # DTOs, filters, decorators compartilhados
│   ├── me/                  # perfil operacional do usuário autenticado
│   ├── prisma/              # PrismaModule global
│   ├── request-history/     # persistência e builders de histórico
│   ├── request-messages/    # persistência de mensagens
│   ├── requests/            # solicitações (ver estrutura abaixo)
│   ├── roles/               # cargos (admin)
│   ├── sector-services/     # serviços por setor (admin)
│   ├── sectors/             # setores (operacional + admin)
│   ├── user-sector-membership/
│   └── users/               # usuários (admin)
└── test/                    # testes e2e
```

### Módulo `requests/` (organização atual)

```
requests/
├── controllers/             # rotas HTTP (operacional, setor, admin)
├── services/                # orquestração, permissões, ações, acesso a mensagens
├── schedules/
│   └── auto-complete/       # cron SOLVED→COMPLETED, settings admin, DTOs
├── helpers/                 # helpers de status (ex.: solvedAt)
├── dto/
├── constants/
├── types/
└── requests.module.ts
```

Módulos relacionados (importados por `requests/`):

```
request-history/               # append/leitura de histórico (RequestHistoryService)
request-messages/              # create/list de mensagens (RequestMessagesService)
```

### Convenção de rotas

| Prefixo | Quem acessa | Exemplos |
|---------|-------------|----------|
| `/api/auth/*`, `/api/me/*` | Autenticado | login, perfil, meus setores/chamados |
| `/api/requests/*`, `/api/sectors/*` | Autenticado (com RBAC) | CRUD operacional de solicitações |
| `/api/admin/*` | `isGlobalAdmin` | usuários, setores, memberships, serviços, histórico admin |

Swagger: `http://localhost:3000/docs`

## Documentação

- [Guia de implementação do MVP](docs/MVP-GUIA.md)
- [Contexto do sistema](docs/CONTEXTO.md)
- [Rotas de solicitações para o front-end](docs/REQUESTS-FRONTEND-PASSO-A-PASSO.md)

## Scripts úteis

| Comando | Descrição |
|---------|-----------|
| `npm run start:dev` | API em modo watch |
| `npm run db:seed` | Seed das roles |
| `npx prisma studio` | UI do banco |
| `npm run lint` | ESLint |

## Licença

UNLICENSED — uso privado.
