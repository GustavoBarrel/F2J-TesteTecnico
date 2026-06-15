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
├── docs/           # CONTEXTO.md (visão) e MVP-GUIA.md (implementação)
├── prisma/         # schema, migrations e seeds
├── src/            # código NestJS
└── test/           # testes e2e
```

## Documentação

- [Guia de implementação do MVP](docs/MVP-GUIA.md)
- [Contexto do sistema](docs/CONTEXTO.md)

## Scripts úteis

| Comando | Descrição |
|---------|-----------|
| `npm run start:dev` | API em modo watch |
| `npm run db:seed` | Seed das roles |
| `npx prisma studio` | UI do banco |
| `npm run lint` | ESLint |

## Licença

UNLICENSED — uso privado.
