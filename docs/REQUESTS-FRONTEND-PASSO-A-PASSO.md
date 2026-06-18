# Requests — Rotas Para o Front-end

## Status Geral

| Status | Rota | Observação |
|---|---|---|
| OK | `GET /api/me/sectors` | Implementada e testada. |
| OK | `GET /api/me/requests` | Implementada e testada. |
| OK | `GET /api/me/requests/assigned` | Implementada e testada. |
| OK | `GET /api/sectors/services/options` | Já existe. Usada para criar chamado/breadcrumb. |
| Parcial | `POST /api/requests` | Cria chamado, mas falta retornar DTO com `permissions` e gravar histórico `CREATED`. |
| Parcial | `GET /api/requests` | Lista geral existe e tem testes de visibilidade; pode ficar como fallback. |
| Falta | `GET /api/sectors/:sectorId/requests` | Lista principal por setor. |
| Falta | `GET /api/requests/:id` | Hoje é stub simples; falta detalhe completo e permissão. |
| Falta | `PATCH /api/requests/:id` | Hoje é stub; falta edição real. |
| Falta | `PATCH /api/requests/:id/assign` | Falta atribuição. |
| Falta | `PATCH /api/requests/:id/status` | Falta transição de status. |
| Falta | `PATCH /api/requests/:id/cancel` | Falta cancelamento. |
| Falta | `PATCH /api/requests/:id/archive` | Falta arquivamento. |
| Falta | `GET /api/requests/:id/messages` | Falta listagem de mensagens. |
| Falta | `POST /api/requests/:id/messages` | Falta envio de mensagem. |
| Falta | `GET /api/requests/:id/history` | Falta histórico. |
| Falta | `GET /api/sectors/:sectorId/members/options` | Falta opções de responsáveis para assign. |

## Regras Globais

- `isGlobalAdmin = true`: vê e faz tudo.
- `MANAGER`: vê todos os chamados do setor; pode editar/atribuir; pode arquivar.
- `TECHNICIAN`:
  - `onlyManagerCanView = false`: vê todos os chamados do setor.
  - `onlyManagerCanView = true`: vê só chamados atribuídos a ele.
  - `onlyManagerCanEdit = false`: pode editar e atribuir.
  - `onlyManagerCanEdit = true`: não edita nem atribui.
  - `onlyManagerCanArchive = false`: pode arquivar.
  - `onlyManagerCanArchive = true`: não arquiva.
- Criador sempre vê os chamados que criou, mas não necessariamente edita/opera.

## Próximas Rotas Em Ordem

### 1. `GET /api/sectors/:sectorId/requests`

Status: Falta implementar.

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

Status: Falta implementar. Existe um stub simples, mas ainda não atende o front.

Detalhe completo do chamado.

Regras:

- Validar `canView`.
- Se não puder ver: `403`.

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
  "assignedTo": {
    "id": "tech-id",
    "firstName": "Pedro",
    "lastName": "Souza",
    "email": "pedro@email.com"
  },
  "permissions": {
    "canView": true,
    "canEdit": true,
    "canArchive": false
  },
  "messages": [],
  "history": []
}
```

Front-end:

- Tela de detalhe usa `permissions` para renderizar ações.
- Pode trazer mensagens/histórico junto ou carregar em rotas separadas.

---

### 3. `PATCH /api/requests/:id`

Status: Falta implementar. Existe um stub simples, mas ainda não edita.

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

Status: Falta implementar.

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

Status: Falta implementar.

Alterar status.

Body:

```json
{
  "status": "COMPLETED"
}
```

Transições permitidas:

```txt
NEW -> IN_PROGRESS | CANCELLED
PENDING -> IN_PROGRESS | CANCELLED
IN_PROGRESS -> PENDING | COMPLETED | CANCELLED
COMPLETED -> ARCHIVED
CANCELLED -> ARCHIVED
ARCHIVED -> nenhuma
```

Regras:

- Admin sempre pode.
- Manager pode.
- Technician só deve mudar status quando tiver permissão operacional no setor.
- Validar transição.
- Registrar `STATUS_CHANGED`.

Retorno:

```json
{
  "id": "request-id",
  "status": "COMPLETED",
  "permissions": {
    "canView": true,
    "canEdit": true,
    "canArchive": false
  }
}
```

---

### 6. `PATCH /api/requests/:id/cancel`

Status: Falta implementar.

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

Status: Falta implementar.

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

Status: Falta implementar.

Lista mensagens do chamado.

Regras:

- Exige `canView`.
- Ordenar `createdAt ASC`.

Retorno:

```json
[
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
]
```

---

### 9. `POST /api/requests/:id/messages`

Status: Falta implementar.

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

### 10. `GET /api/requests/:id/history`

Status: Falta implementar.

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

### 11. `GET /api/sectors/:sectorId/members/options`

Status: Falta implementar.

Opções de responsáveis para atribuição.

Regras:

- Admin: pode.
- Manager: pode.
- Technician: só se `onlyManagerCanEdit = false`.
- Retornar usuários membros ativos do setor.

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

## Ordem Recomendada

1. `GET /api/sectors/:sectorId/requests`
2. `GET /api/requests/:id`
3. `PATCH /api/requests/:id`
4. `PATCH /api/requests/:id/assign`
5. `PATCH /api/requests/:id/status`
6. `PATCH /api/requests/:id/cancel`
7. `PATCH /api/requests/:id/archive`
8. Messages: `GET` + `POST`
9. History
10. Members options para assign

## Observações

- Remover ou ignorar `DELETE /api/requests/:id`; usar `cancel` e `archive`.
- `permissions.canEdit` controla editar e atribuir.
- `permissions.canArchive` controla arquivar.
- `GET /api/requests` pode permanecer como lista geral, mas o front principal deve usar:
  - `/me/requests`
  - `/me/requests/assigned`
  - `/sectors/:sectorId/requests`
