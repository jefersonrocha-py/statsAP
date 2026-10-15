# Revisão v1.2 — Coordenadas GDMS, /clients, convites, ocorrências, rotação do mapa e PT-BR

> **Registro histórico.** Este documento descreve o planejamento feito em 2026-10-08. A v1.2 foi além dele (Minha Conta com MinIO, nomes de serviço + projeto, portas não padrão, revisão de segurança) e foi integrada à `main` em 2026-10-15. A referência atual é o [README](../../../README.md); o que mudou está no [CHANGELOG](../../../CHANGELOG.md).

- **Data:** 2026-10-08
- **Status:** implementado e integrado à `main` (v1.2.0)
- **Branch:** desenvolvido em `feat/gdms-coords-convites-ocorrencias`, já integrado à `main` e removido

## 1. Contexto e objetivo

A aplicação monitora ~604 APs Grandstream sincronizados do GWN/GDMS. Hoje a equipe digita latitude/longitude à mão na tela Configurações, o /clients mostra números inflados, não existe registro do que foi feito quando um AP cai e novos usuários precisam receber senha do administrador.

Objetivo desta entrega:

1. Eliminar a digitação manual de coordenadas: o sync passa a aplicar a posição configurada no GWN.
2. Corrigir a contagem de clientes conectados.
3. Corrigir falhas de segurança e confiabilidade encontradas na revisão.
4. Permitir convidar usuários por e-mail.
5. Registrar ocorrências de AP offline com tratativa, notificação e trilha de auditoria.
6. Corrigir o controle de rotação do mapa.
7. Revisar acentuação e pontuação em PT-BR.

### 1.1 Evidências coletadas (API real, somente leitura, 2026-10-08)

| Verificação | Resultado |
| --- | --- |
| Campos de `POST /oapi/v1.0.0/ap/list` | Inclui `latitude` e `longitude` **como string** (ex.: `"-22.441292"`), além de `lastSeen`, `firstSeen`, `siteId` |
| APs com coordenadas no GWN | 589 de 604; os 15 restantes vêm com `""` |
| Por que o sync não grava hoje | `pickLat/pickLng` devolvem a string; a rota exige `typeof ap.lat === "number"`, então nunca grava. Além disso só preenche quando o local está em 0/0, e o worker (`mode=status`) não toca em coordenadas |
| Contagem de clientes (rede Mogi-Vila-Santa-Cruz-ADD) | soma de `ap.clients` = 138; `client/list` = 30 linhas (30 MACs únicos, todos `online=1`); `statistics/client` (último ponto) = 63. Por AP, `ap.clients` não bate com os clientes listados |
| Token OAuth | Pedir token novo devolve o **mesmo** token (não invalida o anterior); token inválido → HTTP 401 |

## 2. Decisões tomadas com o usuário

| Tema | Decisão |
| --- | --- |
| Regra de coordenadas | **GWN sempre vence**: todo sync aplica a posição do GWN; edição manual só para APs sem posição no GWN |
| Fonte de "clientes conectados" | Total da lista de clientes ativos (`client/list`) por rede |
| Ocorrências | Ocorrência + tratativa, central de notificações (sino) e alerta por e-mail. **Sem** métricas agregadas/export nesta entrega |
| Bug do mapa | "Joystick não acompanha" (salto ao tocar, sentido contrário ao arraste, atraso) |
| Convite | SUPERADMIN convida informando e-mail e papel; substitui a criação de usuário com senha digitada pelo admin |
| Detecção de queda | Módulo de domínio chamado na mesma transação que grava `StatusHistory` (descartados: trigger MySQL e derivação na leitura) |

## 3. Bloco 1 — Sync GDMS e coordenadas (urgente)

### 3.1 Normalização (`lib/gdmsNormalize.ts`, puro e testável)

- `parseCoordinatePair(rawLat, rawLng): { lat: number; lng: number } | null`
  - aceita `number` ou `string` (com `trim` e vírgula decimal convertida para ponto);
  - retorna `null` se algum valor for vazio, não finito, fora de `[-90, 90]` / `[-180, 180]`, ou se o par for `0,0`.
- `pickRawLat/pickRawLng` mantêm a lista atual de candidatos, com `latitude`/`longitude` primeiro.
- `NormalizedAp` troca `lat?/lng?` por `coords: { lat; lng } | null`.
- `services/gdms.ts` passa a importar essas funções; a lógica de rede/assinatura continua lá.

### 3.2 Cliente GDMS (`services/gdms.ts`)

- Em resposta HTTP 401, renova o token (`refreshToken()`) e repete a chamada **uma** vez.
- Nova função `countActiveClients(networkId)` (ver bloco 2).

### 3.3 Motor de sync (`lib/gdmsSync.ts`)

A rota `app/api/integrations/gdms/sync/route.ts` fica só com autenticação, limite de requisições e resposta; a regra vai para `lib/gdmsSync.ts`.

- `planApUpdate(existing | null, ap, mode)` — função pura que decide `create | update | skip` e devolve as mudanças (`statusChanged`, `coordsChanged`, `nameChanged`, `networkChanged`).
- `runGdmsSync({ mode, actor })`:
  1. adquire uma trava em `globalThis`; se já houver sync em andamento, a rota responde `409 SYNC_IN_PROGRESS`;
  2. lista redes e APs (como hoje);
  3. carrega **uma vez** todos os `Antenna` com `gdmsApId` em um `Map` (elimina um SELECT por AP);
  4. aplica cada AP em transação própria; mudanças de status chamam o módulo de ocorrências (bloco 5) na mesma transação;
  5. emite os eventos SSE após o commit;
  6. ao final, chama `processIncidentAlerts()` (bloco 5);
  7. devolve o resumo `{ mode, networks, totalFetched, created, updated, statusChanged, coordsUpdated, withoutCoords, errors[], at }`.

| Modo | Cria APs novos | Status | Coordenadas | Nome/rede |
| --- | --- | --- | --- | --- |
| `full` (botão em Configurações) | sim | sim | sim | sim |
| `status` (worker a cada 5 min) | não | sim | **sim** (novo) | não |

**Regra de coordenadas:** se `ap.coords` existe e difere da posição local (tolerância de `1e-7`), grava `lat/lon` e emite `antenna.updated`. Se `ap.coords` é `null`, mantém a posição local (manual ou 0/0).

### 3.4 Limite de requisições

- Chamadas internas (`x-internal-api-key` válida) deixam de passar pelo limite: hoje o limite de 2 por 15 minutos derruba 1 em cada 3 ciclos do worker (que roda a cada 5 minutos).
- Usuários: 4 syncs por 15 minutos por usuário (era 2). A trava do item 3.3 impede execuções simultâneas.

### 3.5 Tela Configurações

- Continua listando APs com `lat = 0 AND lon = 0`, que após a correção são apenas os que não têm posição no GWN.
- Texto explica: "Configure a localização no GWN; o próximo sync aplica automaticamente. Use os campos abaixo só se o AP não tiver posição no GWN."
- O botão "Sincronizar GDMS" mostra o resumo do sync em um painel (criados, atualizados, coordenadas aplicadas, sem posição no GWN, erros) em vez de `alert()`.
- Os mapas de erro passam a usar mensagens em PT-BR (`SYNC_IN_PROGRESS`, `RATE_LIMITED`, `GDMS_SYNC_FAILED`).

## 4. Bloco 2 — /clients

- `countActiveClients(networkId)`: `POST /oapi/v1.0.0/client/list` com `{ pageNum: 1, pageSize: 1, networkId: Number(id), filter: { ssidId: "all_ssid" } }` e uso de `data.total`. A verificação mostrou uma linha por MAC, todas online.
- `listConnectedClientsByNetwork()` passa a usar essa contagem (as contagens de APs online/offline continuam vindo de `ap/list`), com concorrência 4.
- **Cache de 60 s** em `globalThis`, compartilhado entre usuários, com deduplicação da requisição em andamento. Hoje cada aba aberta dispara ~46 chamadas por minuto ao GWN.
- A resposta inclui `source: "client/list"` e `generatedAt`. O texto da tela diz: "Clientes ativos agora, segundo a lista de clientes conectados do GWN."
- O Dashboard usa a mesma rota e é corrigido junto.

## 5. Bloco 3 — Segurança e confiabilidade

### 5.1 Sessão revalidada no banco

- `lib/jwt.ts` (seguro para edge): constantes de cookie, `signAuthToken`, `verifyAuthToken`. O `middleware.ts` passa a importar daqui.
- `lib/auth.ts` (Node): `requireRequestAuth` verifica o JWT e consulta `User` por `id`. Usuário inexistente, bloqueado ou suspenso → `401 SESSION_REVOKED`, e essa resposta **apaga os cookies** `auth` e `csrf`. Sem isso, o middleware (que só valida a assinatura) mandaria o usuário de `/login` de volta para `/` em laço. O papel (`role`) usado na autorização vem do banco, não do token.
- `/api/me` devolve os dados do banco.
- `services/api.ts`: resposta 401 redireciona para `/login`. As páginas que usam `fetch` direto (admin, settings) passam a usar o helper.

### 5.2 Outros ajustes

- `mapDbError` deixa de devolver `details` com a mensagem SQL; o detalhe fica só no log do servidor.
- E-mails: `lib/emailTemplates.ts` com `escapeHtml` e um layout único usado por redefinição de senha, convite e alertas.
- SSE no cliente: uma única `EventSource` por aba, compartilhada por todos os componentes (hoje são até 3). No servidor, o registro de clientes fica em `globalThis`.
- `env.example` e README: recomendar `SUPERADMIN_SYNC_PASSWORD_IF_EXISTS=false` e `SEED_SUPERADMIN_ON_STARTUP=false` em produção. Com os valores atuais, a senha do superadmin volta à do `.env` a cada restart, desfazendo qualquer redefinição. **O `.env` de produção não é alterado por esta entrega.**

### 5.3 Migrações

- Nova tabela `SchemaMigration (name VARCHAR(100) PK, appliedAt DATETIME)` para migrações executadas uma única vez (`scripts/init-db.mjs`).
- Tabelas novas usam `CREATE TABLE IF NOT EXISTS` em `db/schema.sql`; colunas novas usam a verificação `columnExists` já existente.

## 6. Bloco 4 — Convite de usuário por e-mail

### 6.1 Dados

```sql
CREATE TABLE IF NOT EXISTS `UserInvite` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(200) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'USER',
  `tokenHash` CHAR(64) NOT NULL,
  `invitedById` INT NULL,
  `expiresAt` DATETIME NOT NULL,
  `acceptedAt` DATETIME NULL,
  `revokedAt` DATETIME NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UserInvite_tokenHash_key` (`tokenHash`),
  KEY `UserInvite_email_idx` (`email`),
  CONSTRAINT `UserInvite_invitedById_fkey`
    FOREIGN KEY (`invitedById`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Token: 32 bytes aleatórios; só o SHA-256 é guardado. Validade `INVITE_TOKEN_HOURS` (padrão 72, entre 1 e 336). Uso único.

### 6.2 API

| Método e rota | Papel | Efeito |
| --- | --- | --- |
| `GET /api/users/invites` | SUPERADMIN | Lista convites pendentes (não aceitos, não revogados, não expirados) |
| `POST /api/users/invites` `{ email, role }` | SUPERADMIN | `409 EMAIL_TAKEN` se já existe usuário; revoga convite pendente do mesmo e-mail; cria e envia. Limite 20/h |
| `POST /api/users/invites/[id]/resend` | SUPERADMIN | Gera token novo, renova validade e reenvia |
| `DELETE /api/users/invites/[id]` | SUPERADMIN | Revoga (`revokedAt`) |
| `GET /api/auth/invite?token=` | Público | Valida e devolve `{ email, role, expiresAt }`. Limite por IP |
| `POST /api/auth/accept-invite` `{ token, name, password }` | Público | Transação com `SELECT … FOR UPDATE` no convite; valida; confere que o e-mail ainda está livre; cria `User`; marca `acceptedAt`; já autentica (cookies) |
| `POST /api/users` | — | **Removido** (substituído pelo convite) |

Senha segue `strongPasswordSchema`. Origem confiável e limite de requisições como nas rotas públicas atuais.

### 6.3 URL pública e e-mail

- `lib/publicUrl.ts` concentra a lógica que hoje está em `lib/passwordReset.ts`: `APP_URL → NEXT_PUBLIC_APP_URL → requisição`, com o override `PASSWORD_RESET_BASE_URL` valendo só para redefinição de senha.
- E-mail "Você foi convidado para o Stats A.P", com o papel, a validade e o botão "Criar meu acesso".

### 6.4 Telas

- `middleware.ts`: `/accept-invite` entra em `PUBLIC_PATHS`.
- `app/(auth)/accept-invite/page.tsx`: mostra o e-mail (somente leitura), pede nome, senha e confirmação, e exibe a política de senha. Convite inválido ou expirado mostra mensagem orientando a pedir novo convite.
- Admin: o formulário "Criar usuário" vira "Convidar usuário" (e-mail + papel), e a tabela "Convites pendentes" mostra e-mail, papel, convidado por e expira em, com as ações Reenviar e Revogar.

## 7. Bloco 5 — Ocorrências de AP offline

### 7.1 Dados

```sql
CREATE TABLE IF NOT EXISTS `Incident` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `antennaId` INT NULL,
  `antennaName` VARCHAR(80) NOT NULL,
  `networkName` VARCHAR(255) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN',      -- OPEN | IN_PROGRESS | RESOLVED
  `resolution` VARCHAR(20) NULL,                      -- MANUAL | AUTO_RECOVERED
  `wentDownAt` DATETIME NOT NULL,                    -- primeira queda (abertura)
  `lastDownAt` DATETIME NOT NULL,                    -- queda mais recente (base do alerta e da duração)
  `recoveredAt` DATETIME NULL,
  `downCount` INT NOT NULL DEFAULT 1,
  `alertSentAt` DATETIME NULL,
  `recoveryAlertSentAt` DATETIME NULL,
  `alertsSuppressed` TINYINT(1) NOT NULL DEFAULT 0,  -- 1 = sem e-mails (carga inicial)
  `resolvedAt` DATETIME NULL,
  `resolvedById` INT NULL,
  `resolvedByName` VARCHAR(100) NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `Incident_status_lastDownAt_idx` (`status`, `lastDownAt`),
  KEY `Incident_antennaId_status_idx` (`antennaId`, `status`),
  KEY `Incident_createdAt_idx` (`createdAt`),
  CONSTRAINT `Incident_antennaId_fkey`
    FOREIGN KEY (`antennaId`) REFERENCES `Antenna` (`id`) ON DELETE SET NULL,
  CONSTRAINT `Incident_resolvedById_fkey`
    FOREIGN KEY (`resolvedById`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `IncidentEvent` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `incidentId` BIGINT NOT NULL,
  `type` VARCHAR(30) NOT NULL,
  `message` TEXT NULL,
  `fromStatus` VARCHAR(20) NULL,
  `toStatus` VARCHAR(20) NULL,
  `actorUserId` INT NULL,
  `actorName` VARCHAR(100) NULL,                      -- cópia do nome; NULL = Sistema
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IncidentEvent_incidentId_createdAt_idx` (`incidentId`, `createdAt`),
  CONSTRAINT `IncidentEvent_incidentId_fkey`
    FOREIGN KEY (`incidentId`) REFERENCES `Incident` (`id`) ON DELETE CASCADE,
  CONSTRAINT `IncidentEvent_actorUserId_fkey`
    FOREIGN KEY (`actorUserId`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- coluna nova
ALTER TABLE `User` ADD COLUMN `notificationsSeenAt` DATETIME NULL;
```

- O nome do AP e da rede são copiados para a ocorrência, que sobrevive à exclusão do AP.
- `IncidentEvent` é a trilha de auditoria: a aplicação só faz `INSERT` (não há rota de edição ou exclusão). Tipos: `OPENED`, `WENT_DOWN_AGAIN`, `RECOVERED`, `STATUS_CHANGED`, `COMMENT`, `RESOLVED`, `AUTO_RESOLVED`, `ALERT_SENT`, `RECOVERY_ALERT_SENT`.

### 7.2 Regras (`lib/incidentRules.ts`, puro; `lib/incidents.ts`, persistência)

Disparo: toda transição de status de um AP, vinda do sync ou do PATCH manual (`/api/antennas/[id]`), na mesma transação que grava `StatusHistory`. Criar um AP não é transição.

| Evento | Sem ocorrência não resolvida do AP | Com ocorrência `OPEN` ou `IN_PROGRESS` |
| --- | --- | --- |
| UP → DOWN | Cria ocorrência `OPEN` (`wentDownAt = lastDownAt = agora`) + evento `OPENED` | Evento `WENT_DOWN_AGAIN`; `downCount + 1`; `lastDownAt = agora`; limpa `recoveredAt`, `alertSentAt`, `recoveryAlertSentAt` e `alertsSuppressed` |
| DOWN → UP | Nada | Grava `recoveredAt` + evento `RECOVERED` (duração desde `lastDownAt`). Se `OPEN`: passa a `RESOLVED`, `resolution = AUTO_RECOVERED`, evento `AUTO_RESOLVED`. Se `IN_PROGRESS`: continua aberta até um operador resolver |

Ações manuais (ADMIN e SUPERADMIN; USER apenas visualiza):

| Ação | Origem → destino | Requisito |
| --- | --- | --- |
| Assumir tratativa | `OPEN` → `IN_PROGRESS` | — |
| Comentar | qualquer status | texto de 3 a 2000 caracteres |
| Resolver | `OPEN` ou `IN_PROGRESS` → `RESOLVED` | descrição do que foi feito (5 a 2000 caracteres); `resolution = MANUAL` |

`wentDownAt` é o momento em que o sync detectou a queda (precisão de até 5 minutos, o intervalo do worker).

**Carga inicial (migração única `incident_backfill_v1`):** para cada AP com `gdmsApId` e `status = 'DOWN'`, cria ocorrência `OPEN` com `wentDownAt = lastDownAt = COALESCE(lastStatusChange, UTC_TIMESTAMP())` e `alertsSuppressed = 1` (sem e-mail de queda nem de normalização; `alertSentAt` fica vazio para a tela não indicar um alerta que não houve) e evento `OPENED` "Ocorrência criada na implantação (o AP já estava offline)".

### 7.3 Alerta por e-mail

`processIncidentAlerts(now)` roda no fim de cada sync (a cada 5 minutos pelo worker):

1. **Queda:** ocorrências não resolvidas, com `recoveredAt IS NULL`, `alertSentAt IS NULL`, `alertsSuppressed = 0` e `lastDownAt <= now - INCIDENT_ALERT_MIN_MINUTES` → **um único e-mail-resumo** por ciclo, com AP, rede, desde quando e duração; marca `alertSentAt` e registra `ALERT_SENT`.
2. **Normalização:** ocorrências com `alertSentAt` preenchido, `recoveredAt` preenchido e `recoveryAlertSentAt IS NULL` → um e-mail-resumo "APs normalizados"; marca `recoveryAlertSentAt` e registra `RECOVERY_ALERT_SENT`.

- Destinatários: usuários ADMIN e SUPERADMIN ativos (não bloqueados nem suspensos).
- Se o SMTP falhar, nada é marcado como enviado; a próxima execução tenta de novo.
- O e-mail lista no máximo 100 APs e indica "e mais N".
- Variáveis: `INCIDENT_ALERTS_ENABLED` (padrão `true`) e `INCIDENT_ALERT_MIN_MINUTES` (padrão 10, entre 1 e 1440).

### 7.4 API

| Método e rota | Papel | Efeito |
| --- | --- | --- |
| `GET /api/incidents?status=&network=&q=&page=&pageSize=` | autenticado | Lista paginada, mais recentes primeiro |
| `GET /api/incidents/[id]` | autenticado | Ocorrência + eventos em ordem cronológica |
| `POST /api/incidents/[id]/actions` `{ action: "START" \| "COMMENT" \| "RESOLVE", message? }` | ADMIN, SUPERADMIN | Aplica a ação; `409 INVALID_TRANSITION` se não for permitida |
| `GET /api/notifications` | autenticado | `{ unread, openCount, items[≤8] }`; `unread` conta ocorrências criadas depois de `notificationsSeenAt` |
| `POST /api/notifications/seen` | autenticado | Grava `notificationsSeenAt = NOW()` |

Eventos SSE novos: `incident.opened` e `incident.updated`.

### 7.5 Telas

- Sidebar: item "Ocorrências", visível para todos.
- `app/(app)/incidents/page.tsx`:
  - filtros: status (Abertas, Em tratativa, Resolvidas, Todas), rede e busca;
  - tabela: AP, rede, status, caiu em, voltou em, duração e "alerta enviado";
  - ao clicar numa linha, abre um painel lateral com a linha do tempo da auditoria e as ações permitidas ao papel do usuário.
- TopBar: sino com contador de não lidas e lista das últimas ocorrências, com "Ver todas" e "Marcar como lidas". Atualiza em tempo real.
- O toast atual "AP offline" ganha o link "Ver ocorrência".

## 8. Bloco 6 — Rotação do mapa

- Extrair o controle para `components/map/RotationControl.tsx`, que recebe a instância do mapa. Só ele re-renderiza a cada quadro de rotação; hoje o `MapClient` inteiro, com cerca de 1060 linhas, re-renderiza.
- Funções puras em `lib/mapRotation.ts`: `normalizeBearing`, `pointerAngle(dx, dy)`, `shortestDelta(a, b)` e `bearingFromDrag(startBearing, startAngle, currentAngle)`.
- Comportamento:
  - anel de bússola rotacionado em `-bearing`: o "N" aponta sempre para o norte real do mapa;
  - arraste relativo: ao tocar, guarda o ângulo inicial (sem salto); o novo bearing é `startBearing - delta`, de modo que o mapa gira no mesmo sentido do dedo ou mouse;
  - `setBearing` agrupado por `requestAnimationFrame` e sem transição CSS durante o arraste;
  - botões: "Norte" (volta a 0° com animação), "Girar 45° à esquerda" e "Girar 45° à direita";
  - teclado: o anel tem `role="slider"`; setas giram 15°, `Home` volta ao norte;
  - o ícone de abrir/fechar passa a ser uma agulha SVG própria (o `faCompass` já vem desenhado a 45°).
- "Cidade" e "Pinos" passam `bearing: map.getBearing()` ao `fitBounds` para preservar a rotação.

## 9. Bloco 7 — Revisão PT-BR

- Escopo: todos os textos visíveis em `app/`, `components/`, mensagens de validação em `lib/validators*.ts`, mensagens de erro exibidas pela UI, `title` e `aria-label`, e os e-mails.
- Correções típicas: "Configurações", "Ações", "Não foi possível", "Usuário", "Satélite", "Rotação", "Observações", "Pendências", "Política de senha", "mínimo", "Descrição", "Posição", "inválidas", "Olá", "você", "solicitação", "redefinição".
- Mantidos como estão: "Dashboard", "AP", "GDMS", "GWN", "SSID", "UP/DOWN" e nomes de papéis (`USER`, `ADMIN`, `SUPERADMIN`).
- Fora do escopo: README (pode virar uma tarefa separada).

## 10. Testes e verificação

- Configurar vitest (`vitest.config.ts` com os aliases do `tsconfig` e `server-only` mapeado para um módulo vazio). Testes em `tests/unit/`.
- Testes unitários (escritos antes da implementação):
  - `parseCoordinatePair`: string, número, vazio, vírgula, fora da faixa, 0/0;
  - `planApUpdate`: modos `full` e `status`, coordenadas iguais, diferentes e ausentes;
  - `incidentRules`: todas as linhas das tabelas do item 7.2;
  - convite: geração, validação e expiração do token;
  - `escapeHtml` e montagem do e-mail-resumo (incluindo o corte em 100 itens);
  - `mapRotation`: delta com virada em ±180°, sentido do arraste.
- Verificação final: `npx tsc --noEmit`, `npm run lint`, `npm test` e `npm run build`.
- Conferência real da regra de coordenadas: script somente leitura que roda `parseCoordinatePair` sobre o `ap/list` real e confirma ~589 APs com posição válida.
- Se houver Docker disponível: subir o MySQL local e testar, em ponta a ponta, sync, ocorrência, convite (com SMTP real apenas para um e-mail indicado pelo usuário) e o controle de rotação.

## 11. Implantação

- As mudanças de schema são aditivas e aplicadas pelo `scripts/init-db.mjs` no startup do container `web`.
- O primeiro sync após o deploy aplica a posição de ~589 APs; a fila de Configurações deve cair para ~15.
- Variáveis novas (com padrão): `INVITE_TOKEN_HOURS=72`, `INCIDENT_ALERTS_ENABLED=true`, `INCIDENT_ALERT_MIN_MINUTES=10`. Documentadas no `env.example` e no README.
- Recomendação manual ao operador: `SUPERADMIN_SYNC_PASSWORD_IF_EXISTS=false` e `SEED_SUPERADMIN_ON_STARTUP=false` no `.env` de produção.

## 12. Fora do escopo

- Métricas agregadas de ocorrências (MTTR, ranking) e exportação CSV.
- Usar `lastSeen` do GWN como horário exato da queda.
- Notificação push ou integrações externas (Slack, Teams, WhatsApp).
- Reescrita do README além das variáveis novas e das recomendações de produção.
- Qualquer alteração no `.env` de produção.
