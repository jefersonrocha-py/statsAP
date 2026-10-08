<p align="center">
  <img src="./public/logo_etherium.png" alt="Etheriumtech" width="170" />
</p>

<h1 align="center">Stats A.P</h1>

<p align="center">
  Monitoramento operacional dos APs Grandstream da Etheriumtech: mapa georreferenciado com posição vinda do GWN,
  dashboard, clientes conectados por rede, ocorrências de queda com trilha de auditoria, alertas por e-mail
  e atualização em tempo real via SSE.
</p>

<p align="center">
  <img alt="Versão" src="https://img.shields.io/badge/vers%C3%A3o-1.2.0-0F766E" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white" />
  <img alt="MySQL" src="https://img.shields.io/badge/MySQL-8.4-4479A1?logo=mysql&logoColor=white" />
  <img alt="Docker" src="https://img.shields.io/badge/Docker_Compose-Deploy-2496ED?logo=docker&logoColor=white" />
  <img alt="Vitest" src="https://img.shields.io/badge/Vitest-testes-6E9F18?logo=vitest&logoColor=white" />
  <img alt="SSE" src="https://img.shields.io/badge/SSE-Tempo_Real-FF6A00" />
</p>

## Sumário

- [Visão geral](#visão-geral)
- [Novidades da v1.2](#novidades-da-v12)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Integração GWN/GDMS](#integração-gwngdms)
- [Ocorrências e alertas](#ocorrências-e-alertas)
- [Convite de usuários](#convite-de-usuários)
- [Autenticação, sessão e papéis](#autenticação-sessão-e-papéis)
- [Tempo real (SSE)](#tempo-real-sse)
- [Telas](#telas)
- [Interface](#interface)
- [Modelo de dados](#modelo-de-dados)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Execução local](#execução-local)
- [Deploy com Docker Compose](#deploy-com-docker-compose)
- [Testes e verificação](#testes-e-verificação)
- [Operação e observabilidade](#operação-e-observabilidade)
- [Endpoints](#endpoints)
- [Scripts](#scripts)
- [Versionamento](#versionamento)
- [Solução de problemas](#solução-de-problemas)
- [Licença](#licença)

## Visão geral

O Stats A.P reúne em um só lugar o inventário, o status e o histórico dos access points Grandstream gerenciados pelo GWN (GDMS):

- **Mapa** com os APs posicionados pela localização cadastrada no GWN, filtros, busca, satélite/OpenStreetMap e controle de rotação.
- **Dashboard** com totais, disponibilidade e clientes conectados por rede.
- **Clientes** ativos agora, por rede, segundo a lista de clientes conectados do GWN.
- **Ocorrências**: cada queda de AP abre uma ocorrência com linha do tempo de auditoria; operadores registram a tratativa e a resolução.
- **Alertas por e-mail** para ADMIN e SUPERADMIN quando um AP fica offline além do tempo mínimo e quando ele volta.
- **Central de notificações** (sino na barra superior) e toasts em tempo real de AP offline/online.
- **Configurações**: fila de APs que ainda não têm posição no GWN e botão "Sincronizar GDMS".
- **Administração**: convite de usuários por e-mail, papéis `USER`/`ADMIN`/`SUPERADMIN`, bloqueio, suspensão e exclusão.
- **Worker** que sincroniza status e posição com o GWN a cada 5 minutos.

## Novidades da v1.2

Resumo; o detalhe está no [CHANGELOG](./CHANGELOG.md).

- A latitude e a longitude dos APs passam a vir do GWN no sync (manual e automático). O GWN sempre vence quando informa posição; a digitação manual fica só para APs sem localização no GWN.
- `/clients` e o Dashboard contam os clientes pela lista de clientes conectados do GWN (`client/list`), em vez de somar o contador de cada AP, que inflava o total.
- Ocorrências de AP offline com estados, ações, auditoria só de inserção, e-mail-resumo e central de notificações.
- Convite de usuário por e-mail com link de uso único, no lugar do cadastro direto pelo administrador.
- Sessão revalidada no banco a cada requisição: usuário excluído, bloqueado ou suspenso perde o acesso na hora.
- Controle de rotação do mapa reescrito (bússola alinhada ao norte, arraste relativo, botões e teclado).
- Sidebar retrátil com botão de seta na borda e preferência salva; gaveta própria no celular.
- Identidade visual com símbolo e nome, versão exibida na sidebar e no rodapé.
- Revisão de acentuação e pontuação em toda a interface.
- Testes automatizados com Vitest.

## Stack

| Camada | Implementação | Papel no sistema |
| --- | --- | --- |
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS 3, Zustand | Shell autenticado, mapa, dashboard, ocorrências, formulários |
| Mapa | `maplibre-gl` 5 com tiles ArcGIS e alternativa OpenStreetMap | Visualização geográfica e controle de rotação |
| Backend | Route Handlers em `app/api/*` | API interna, autenticação, papéis, integrações e healthcheck |
| Segurança | `jose`, `bcryptjs`, `zod`, middleware próprio | JWT em cookie, CSRF, validação de origem, limite de requisições |
| E-mail | `nodemailer` com SMTP autenticado | Redefinição de senha, convites e alertas de ocorrência |
| Banco | MySQL 8.4 com `mysql2/promise` e SQL direto | Persistência sem ORM; schema em [`db/schema.sql`](./db/schema.sql) |
| Integração | GWN/GDMS OpenAPI (OAuth client credentials + requisições assinadas) | Redes, APs, status, posição e clientes |
| Tempo real | Server-Sent Events em `/api/events` | Atualização da interface, toasts e notificações |
| Testes | Vitest 2 | Testes unitários em `tests/unit/` |
| Infra | Docker multi-stage + Docker Compose | Serviços `mysql`, `web` e `worker` com healthchecks |

## Arquitetura

```mermaid
flowchart LR
  subgraph Browser["Navegador"]
    UI["Páginas App Router<br/>Mapa, Dashboard, Clientes, Ocorrências,<br/>Filtros, Configurações, Administração"]
    FE["services/api.ts + services/sseClient.ts<br/>(uma EventSource por aba)"]
  end

  subgraph Web["Container web"]
    MW["middleware.ts<br/>proteção de páginas + headers + papéis"]
    API["Route Handlers em app/api/*"]
    CORE["lib/*<br/>auth, gdmsSync, incidents, invites, sse, rateLimit"]
  end

  subgraph Data["Persistência"]
    DB[("MySQL 8.4<br/>Antenna, StatusHistory, Incident, IncidentEvent,<br/>User, UserInvite, PasswordResetToken, gdms_token")]
  end

  subgraph External["Serviços externos"]
    GDMS["GWN/GDMS Cloud<br/>OAuth + /oapi"]
    SMTP["SMTP"]
  end

  Worker["Container worker<br/>scripts/gdms-cron.mjs"]

  UI --> FE
  FE --> MW
  FE --> API
  API --> CORE
  CORE --> DB
  CORE --> GDMS
  CORE --> SMTP
  Worker -->|"POST interno (x-internal-api-key)"| API
  API -->|SSE| FE
```

Princípios:

- O navegador nunca chama o GWN; toda comunicação externa sai do container `web`.
- O `worker` não tem cliente GDMS próprio: ele chama a rota interna de sync, que aplica a mesma regra de negócio do botão da interface.
- `middleware.ts` protege as páginas privadas e bloqueia por papel; as rotas `/api/*` se protegem com `requireRequestAuth(...)` ou `requireRequestAuthOrInternal(...)`.
- O container `web` aplica o schema e as migrações no startup ([`scripts/docker-entrypoint.sh`](./scripts/docker-entrypoint.sh) → [`scripts/init-db.mjs`](./scripts/init-db.mjs)).
- Horários são gravados em UTC (`UTC_TIMESTAMP()`, pool com `timezone: "Z"`) e exibidos no fuso `America/Sao_Paulo` ([`lib/dateFormat.ts`](./lib/dateFormat.ts)).

## Integração GWN/GDMS

### Componentes

| Camada | Arquivo | Responsabilidade |
| --- | --- | --- |
| Token OAuth | [`lib/gdmsToken.ts`](./lib/gdmsToken.ts) | Resolve o token na ordem memória → tabela `gdms_token` → OAuth |
| Cliente GDMS | [`services/gdms.ts`](./services/gdms.ts) | Assina e envia as requisições, pagina redes/APs, conta clientes; em `401` renova o token e repete uma vez |
| Normalização | [`lib/gdmsNormalize.ts`](./lib/gdmsNormalize.ts) | Converte o retorno do `ap/list` (status, identificador, coordenadas) |
| Planejamento | [`lib/gdmsSyncPlan.ts`](./lib/gdmsSyncPlan.ts) | Função pura que decide criar, atualizar ou ignorar cada AP |
| Motor de sync | [`lib/gdmsSync.ts`](./lib/gdmsSync.ts) | Trava de execução única, transação por AP, ocorrências, SSE e alertas |
| Rota de sync | [`app/api/integrations/gdms/sync/route.ts`](./app/api/integrations/gdms/sync/route.ts) | Autenticação, limite de requisições e resposta |
| Clientes por rede | [`app/api/stats/network-clients/route.ts`](./app/api/stats/network-clients/route.ts) | Contagem via `client/list` com cache de 60 s |
| Diagnóstico | [`ping`](./app/api/integrations/gdms/ping/route.ts) e [`token`](./app/api/integrations/gdms/token/route.ts) | Testam acesso e mostram/renovam o token sem alterar o banco |
| Agendamento | [`scripts/gdms-cron.mjs`](./scripts/gdms-cron.mjs) | Dispara o sync periódico contra `APP_BASE_URL` |

### Como a chamada é feita

1. `services/gdms.ts` valida `GDMS_BASE`, `GDMS_CLIENT_ID` e `GDMS_CLIENT_SECRET` (em produção, `GDMS_BASE` e `GDMS_OAUTH_URL` precisam ser HTTPS).
2. `lib/gdmsToken.ts` entrega um token válido.
3. O corpo JSON é serializado, recebe hash SHA-256 e gera a `signature`.
4. A requisição vai por `POST` com `access_token`, `appID`, `timestamp` e `signature`.
5. HTTP não-2xx ou `retCode != 0` vira erro de integração. Em `401`, o token é renovado e a chamada é repetida uma única vez.
6. O retorno é normalizado antes de ser gravado, devolvido pela API ou emitido por SSE.

### Sincronização

```mermaid
sequenceDiagram
  participant T as Worker ou botão "Sincronizar GDMS"
  participant S as POST /api/integrations/gdms/sync
  participant G as GWN/GDMS
  participant DB as MySQL
  participant E as SSE
  participant M as SMTP

  T->>S: Inicia o sync (full ou status)
  S->>S: Trava única (409 SYNC_IN_PROGRESS se já houver sync)
  S->>G: Lista redes e APs
  S->>DB: Carrega os APs locais uma vez
  loop Para cada AP (transação própria)
    S->>DB: Cria/atualiza Antenna (status, posição, nome, rede)
    alt Status mudou
      S->>DB: StatusHistory + abre/atualiza Incident e IncidentEvent
    end
  end
  S->>E: status.changed por AP + um antenna.updated agrupado
  S->>DB: Seleciona ocorrências que pedem alerta
  S->>M: E-mail-resumo de quedas e de normalizações
  S-->>T: Resumo (criados, atualizados, coordenadas aplicadas, sem posição, erros)
```

| Modo | Endpoint | Cria APs novos | Status | Coordenadas | Nome/rede | Uso |
| --- | --- | --- | --- | --- | --- | --- |
| `full` | `POST /api/integrations/gdms/sync` | sim | sim | sim | sim | Botão em Configurações e carga inicial |
| `status` | `POST /api/integrations/gdms/sync?mode=status` | não | sim | sim | não | Padrão do worker, a cada 5 minutos |

Regras:

- **Coordenadas: o GWN sempre vence.** Se o GWN informa uma posição válida e ela difere da local, a posição local é substituída (inclusive uma posição digitada à mão). Se o GWN não informa posição, a local é mantida.
- **Posição válida:** número ou texto (`"-22.441292"`, vírgula decimal aceita), latitude entre -90 e 90, longitude entre -180 e 180, e diferente de `0,0`. Campos lidos, nesta ordem de preferência: `latitude`/`longitude`, `ap_latitude`/`ap_longitude` e variações (`lat`, `lng`, `gps.*`, `location.*`, `position.*`).
- **Status:** `status = 1` no GWN vira `UP`; qualquer outro valor vira `DOWN`.
- **Uma execução por vez:** um segundo pedido durante um sync em andamento recebe `409 SYNC_IN_PROGRESS`.
- **Limite de requisições:** 4 syncs a cada 15 minutos por usuário. Chamadas internas do worker (`x-internal-api-key` válida) não entram no limite.
- **Falha do GWN não bloqueia alertas:** se a leitura do GWN falhar, o processamento de alertas de ocorrência roda mesmo assim.
- **Eventos agrupados:** cada sync emite um único `antenna.updated` (`kind: "sync"`, com `created` e `changed`), para o mapa não recarregar uma vez por AP.

### Clientes conectados (`/clients` e Dashboard)

- A contagem por rede vem de `POST /oapi/v1.0.0/client/list` com `pageSize: 1`, usando `data.total` (uma linha por MAC conectado).
- As contagens de APs online/offline por rede continuam vindo do `ap/list`.
- O resultado fica em cache por 60 s, compartilhado entre usuários, com deduplicação da requisição em andamento; as redes são consultadas com concorrência 4.
- A resposta inclui `source: "client/list"` e `generatedAt`, exibido como "Atualizado em".

## Ocorrências e alertas

### Ciclo de vida

```mermaid
stateDiagram-v2
  [*] --> OPEN: AP UP → DOWN
  OPEN --> IN_PROGRESS: Assumir tratativa
  OPEN --> RESOLVED: AP volta (resolução automática)
  OPEN --> RESOLVED: Resolver (manual)
  IN_PROGRESS --> RESOLVED: Resolver (manual)
  IN_PROGRESS --> IN_PROGRESS: AP volta (fica aberta até um operador resolver)
  RESOLVED --> [*]
```

| Evento do AP | Sem ocorrência aberta | Com ocorrência `OPEN` ou `IN_PROGRESS` |
| --- | --- | --- |
| UP → DOWN | Abre ocorrência `OPEN` e registra `OPENED` | Registra `WENT_DOWN_AGAIN`, soma `downCount`, atualiza `lastDownAt` e zera os marcadores de alerta |
| DOWN → UP | Nada | Registra `RECOVERED` com a duração. Se `OPEN`, resolve sozinha (`AUTO_RESOLVED`, `resolution = AUTO_RECOVERED`); se `IN_PROGRESS`, continua aberta |

Ações manuais (ADMIN e SUPERADMIN; USER só visualiza):

| Ação | Transição | Requisito |
| --- | --- | --- |
| Assumir tratativa (`START`) | `OPEN` → `IN_PROGRESS` | — |
| Comentar (`COMMENT`) | qualquer status | texto de 3 a 2000 caracteres |
| Resolver (`RESOLVE`) | `OPEN`/`IN_PROGRESS` → `RESOLVED` | descrição do que foi feito, de 5 a 2000 caracteres; `resolution = MANUAL` |

- **Auditoria:** `IncidentEvent` só recebe `INSERT`; não há rota de edição nem de exclusão. Cada evento guarda o autor (`actorName`; vazio significa "Sistema"). Tipos: `OPENED`, `WENT_DOWN_AGAIN`, `RECOVERED`, `STATUS_CHANGED`, `COMMENT`, `RESOLVED`, `AUTO_RESOLVED`, `ALERT_SENT`, `RECOVERY_ALERT_SENT`.
- **Origem das transições:** sync do GWN e alteração manual de status (`PATCH /api/antennas/[id]`), na mesma transação que grava `StatusHistory`. Criar um AP não abre ocorrência.
- **Histórico preservado:** o nome do AP e da rede são copiados para a ocorrência, que continua existindo se o AP for excluído.
- **Precisão:** o horário da queda é o momento em que o sync a detectou (até 5 minutos depois, no intervalo do worker).

### Alerta por e-mail

Ao fim de cada sync:

1. **Queda:** ocorrências não resolvidas, ainda offline, sem alerta enviado, sem supressão e offline há pelo menos `INCIDENT_ALERT_MIN_MINUTES` geram **um único e-mail-resumo** por ciclo (AP, rede, desde quando e duração). Cada uma recebe `alertSentAt` e o evento `ALERT_SENT`.
2. **Normalização:** ocorrências que tiveram alerta de queda e cujo AP voltou geram o e-mail "APs normalizados" e o evento `RECOVERY_ALERT_SENT`.

- Destinatários: usuários ADMIN e SUPERADMIN ativos (não bloqueados nem suspensos).
- Se o SMTP falhar, nada é marcado como enviado e o próximo ciclo tenta de novo.
- Cada e-mail lista no máximo 100 APs e informa "e mais N".
- `INCIDENT_ALERTS_ENABLED=false` desliga os e-mails (as ocorrências continuam sendo registradas).

### Carga inicial

Na primeira subida da v1.2, a migração `incident_backfill_v1` cria uma ocorrência `OPEN` para cada AP que já estava `DOWN`, com `alertsSuppressed = 1`: nenhum e-mail é disparado para essas quedas antigas e a tela não indica "alerta enviado". Se um desses APs cair de novo depois de voltar, a supressão é desfeita e os alertas passam a valer normalmente.

### Central de notificações

- O sino da barra superior mostra quantas ocorrências foram abertas desde a última leitura (`User.notificationsSeenAt`) e as 8 mais recentes, com "Ver todas" e "Marcar como lidas".
- O toast "AP offline" traz o link "Ver ocorrência".
- Tudo se atualiza pelos eventos SSE `incident.opened` e `incident.updated`.

## Convite de usuários

O SUPERADMIN convida pelo e-mail e escolhe o papel; a pessoa convidada recebe um link, define nome e senha e já entra autenticada.

```mermaid
sequenceDiagram
  actor A as SUPERADMIN
  participant API as /api/users/invites
  participant DB as MySQL
  participant SMTP as SMTP
  actor C as Convidado
  participant P as /accept-invite

  A->>API: POST { email, role }
  API->>DB: Revoga convite pendente do mesmo e-mail e grava UserInvite (hash do token)
  API->>SMTP: "Você foi convidado para o Stats A.P"
  SMTP-->>C: Link /accept-invite?token=...
  C->>P: Abre o link (GET /api/auth/invite valida o token)
  C->>P: Nome + senha
  P->>DB: POST /api/auth/accept-invite (SELECT … FOR UPDATE, cria User, marca acceptedAt)
  P-->>C: Cookies de sessão e acesso liberado
```

- Token aleatório de 32 bytes; o banco guarda só o SHA-256. Uso único, validade de `INVITE_TOKEN_HOURS` (padrão 72 h).
- `409 EMAIL_TAKEN` se já existir usuário com o e-mail; convidar de novo o mesmo e-mail revoga o convite anterior.
- Na Administração, a tabela "Convites pendentes" mostra e-mail, papel, quem convidou e a validade, com as ações **Reenviar** (gera token novo e renova a validade) e **Revogar**.
- Limites: 20 convites/reenvios por hora; validação e aceite do link têm limite por IP.
- A senha segue a política forte: no mínimo 12 caracteres, com letra minúscula, maiúscula, número e símbolo.
- O link usa a URL pública da aplicação (`APP_URL` → `NEXT_PUBLIC_APP_URL` → host da requisição), definida em [`lib/publicUrl.ts`](./lib/publicUrl.ts).

## Autenticação, sessão e papéis

### Login e cookies

- `POST /api/auth/login` valida origem, limite de requisições e payload, confere a senha com bcrypt e devolve os cookies `auth` (JWT, `HttpOnly`) e `csrf`.
- Mutações com cookie (`POST`, `PATCH`, `DELETE`) exigem o header `x-csrf-token`; o helper [`services/api.ts`](./services/api.ts) já envia.
- Recuperação de senha: `/forgot-password` envia um link temporário (`PASSWORD_RESET_TOKEN_MINUTES`) e `/reset-password` grava a nova senha e consome o token.

### Sessão revalidada no banco

- O middleware (edge) só confere a assinatura do JWT ([`lib/jwt.ts`](./lib/jwt.ts)). As rotas de API ([`lib/auth.ts`](./lib/auth.ts)) consultam o usuário no banco a cada requisição.
- Usuário excluído, bloqueado ou suspenso recebe `401 SESSION_REVOKED`, e essa resposta apaga os cookies para o navegador não ficar em laço entre `/login` e `/`.
- O papel usado na autorização vem do banco, não do token: uma mudança de papel vale na próxima requisição.
- No cliente, qualquer `401` leva o usuário para `/login`.

### Papéis

| Papel | Acesso |
| --- | --- |
| `USER` | Mapa, Dashboard, Clientes, Ocorrências (leitura) e Filtros (leitura) |
| `ADMIN` | Tudo do USER + ações em ocorrências, Configurações, sync GDMS, criação/edição de APs, alertas por e-mail |
| `SUPERADMIN` | Tudo do ADMIN + Administração (usuários e convites) |

## Tempo real (SSE)

`GET /api/events` abre um stream autenticado. Cada aba mantém **uma única** `EventSource`, compartilhada por todos os componentes ([`services/sseClient.ts`](./services/sseClient.ts)); no servidor, o registro de conexões fica em `globalThis` ([`lib/sse.ts`](./lib/sse.ts)).

| Evento | Quando | Quem reage |
| --- | --- | --- |
| `connected`, `ping` | Abertura e keep-alive | — |
| `status.changed` | AP muda entre `UP` e `DOWN` (sync ou manual) | Toasts, Dashboard, filtros |
| `antenna.created` / `antenna.deleted` | AP criado ou excluído | Mapa, listas |
| `antenna.updated` | Edição manual, coordenadas, ou um evento agrupado por sync (`kind: "sync"`) | Mapa, Configurações |
| `incident.opened` / `incident.updated` | Ocorrência aberta, ação registrada, recuperação, alerta | Ocorrências, sino de notificações |

## Telas

| Tela | Rota | O que faz | Papel mínimo |
| --- | --- | --- | --- |
| Login | `/login` | Entrada e emissão dos cookies | Público |
| Esqueci a senha | `/forgot-password` | Envia o link de redefinição | Público |
| Redefinir senha | `/reset-password` | Grava a nova senha a partir do link | Público |
| Aceitar convite | `/accept-invite` | Cria o acesso a partir do convite | Público (com token) |
| Mapa | `/` | APs posicionados, filtros, busca, rotação, criação manual de AP | Autenticado (criação: ADMIN) |
| Dashboard | `/dashboard` | Totais, disponibilidade e clientes por rede | Autenticado |
| Clientes | `/clients` | Clientes conectados por rede, direto do GWN | Autenticado |
| Ocorrências | `/incidents` | Lista com filtros e painel com linha do tempo e ações | Autenticado (ações: ADMIN) |
| Filtros Cluster | `/filter-cluster` | Busca, paginação, CSV, troca de status e exclusão | Autenticado (mutações: ADMIN) |
| Configurações | `/settings` | APs sem posição no GWN e "Sincronizar GDMS" com resumo | ADMIN |
| Administração | `/admin` | Usuários, convites, bloqueio, suspensão e exclusão | SUPERADMIN |

## Interface

### Sidebar retrátil

- No desktop, o botão de seta na borda da sidebar recolhe para uma faixa de ícones (`w-20`) e expande de volta (`w-72`). A escolha fica salva no navegador (`localStorage`, chave `sidebarCollapsed`) e é restaurada na próxima visita ([`lib/sidebarPreference.ts`](./lib/sidebarPreference.ts), [`store/ui.ts`](./store/ui.ts)).
- No celular, a sidebar vira uma gaveta sobreposta: abre pelo botão ☰ da barra superior e fecha pelo X, pelo fundo escurecido, pela tecla Esc ou ao trocar de página.
- Os botões têm `aria-label`, `aria-expanded` e `aria-controls`.

### Identidade e versão

- [`components/BrandMark.tsx`](./components/BrandMark.tsx) mostra o símbolo da Etheriumtech com o nome "Stats A.P"; com a sidebar recolhida, só o símbolo.
- A versão exibida na sidebar e no rodapé vem do `package.json` (ver [Versionamento](#versionamento)).
- O rodapé traz contato, canais e o bloco "Powered by":

| Nome | Papel | LinkedIn |
| --- | --- | --- |
| Jeferson Oliveira | Network Engineer | `https://www.linkedin.com/in/jeferson-rocha-1b494b1b5` |
| Marcos Ribeiro | Software Engineer | `https://linkedin.com/in/marcos-ribeiro-de-sousa-782b7782` |
| Mickael Lelis | DevOps/SRE | `https://linkedin.com/in/mickael-l-079743133` |

### Tema

- O botão da barra superior alterna entre claro e escuro. A preferência fica em [`store/theme.ts`](./store/theme.ts) e é aplicada globalmente por [`components/ThemeSync.tsx`](./components/ThemeSync.tsx), sem piscar na carga ([`components/ThemeScript.tsx`](./components/ThemeScript.tsx)).

### Rotação do mapa

[`components/map/RotationControl.tsx`](./components/map/RotationControl.tsx), com as contas em [`lib/mapRotation.ts`](./lib/mapRotation.ts):

- o "N" do anel aponta sempre para o norte real do mapa;
- arraste relativo, sem salto ao tocar: o mapa gira no mesmo sentido do dedo ou do mouse;
- botões "Norte", "Girar 45° à esquerda" e "Girar 45° à direita";
- teclado: setas giram 15° e `Home` volta ao norte;
- "Cidade" e "Pinos" preservam a rotação ao enquadrar o mapa.

## Modelo de dados

```mermaid
erDiagram
  Antenna {
    int id PK
    string name
    double lat
    double lon
    string status
    string gdmsApId UK
    string networkId
    string networkName
    datetime lastSyncAt
    datetime lastStatusChange
  }
  StatusHistory {
    int id PK
    int antennaId FK
    string status
    datetime changedAt
  }
  Incident {
    bigint id PK
    int antennaId FK
    string antennaName
    string networkName
    string status
    string resolution
    datetime wentDownAt
    datetime lastDownAt
    datetime recoveredAt
    int downCount
    datetime alertSentAt
    datetime recoveryAlertSentAt
    boolean alertsSuppressed
    int resolvedById FK
  }
  IncidentEvent {
    bigint id PK
    bigint incidentId FK
    string type
    text message
    string fromStatus
    string toStatus
    int actorUserId FK
    string actorName
    datetime createdAt
  }
  User {
    int id PK
    string name
    string email UK
    string passwordHash
    string role
    boolean isBlocked
    datetime suspendedUntil
    datetime notificationsSeenAt
  }
  UserInvite {
    bigint id PK
    string email
    string role
    string tokenHash UK
    int invitedById FK
    datetime expiresAt
    datetime acceptedAt
    datetime revokedAt
  }
  PasswordResetToken {
    bigint id PK
    int userId FK
    string tokenHash UK
    datetime expiresAt
    datetime usedAt
  }
  gdms_token {
    int id PK
    text accessToken
    datetime expiresAt
  }
  SchemaMigration {
    string name PK
    datetime appliedAt
  }

  Antenna ||--o{ StatusHistory : registra
  Antenna |o--o{ Incident : origina
  Incident ||--o{ IncidentEvent : audita
  User |o--o{ IncidentEvent : "é autor de"
  User |o--o{ UserInvite : convida
  User ||--o{ PasswordResetToken : possui
```

- `Incident.antennaId`, `resolvedById`, `IncidentEvent.actorUserId` e `UserInvite.invitedById` usam `ON DELETE SET NULL`: excluir um AP ou um usuário não apaga o histórico.
- `SchemaMigration` registra as migrações de execução única (por exemplo, `incident_backfill_v1`).
- Todas as mudanças da v1.2 são aditivas (`CREATE TABLE IF NOT EXISTS` e colunas novas verificadas antes do `ALTER`) e aplicadas por `scripts/init-db.mjs`.

## Estrutura do repositório

Omitidos: `.git/`, `.next/` e `node_modules/`.

<details>
<summary><strong>Árvore de arquivos</strong></summary>

```text
.
|-- CHANGELOG.md
|-- Dockerfile
|-- README.md
|-- docker-compose.yml
|-- env.example
|-- middleware.ts
|-- next.config.js
|-- package.json
|-- tailwind.config.ts
|-- vitest.config.ts
|-- app
|   |-- layout.tsx
|   |-- loading.tsx
|   |-- (app)
|   |   |-- layout.tsx
|   |   |-- page.tsx                      # Mapa
|   |   |-- admin/page.tsx
|   |   |-- clients/page.tsx
|   |   |-- dashboard/{loading,page}.tsx
|   |   |-- filter-cluster/page.tsx
|   |   |-- incidents/page.tsx
|   |   `-- settings/page.tsx
|   |-- (auth)
|   |   |-- layout.tsx
|   |   |-- accept-invite/page.tsx
|   |   |-- forgot-password/page.tsx
|   |   |-- login/page.tsx
|   |   `-- reset-password/page.tsx
|   `-- api
|       |-- antennas/{route.ts, networks/, [id]/route.ts, [id]/coords/}
|       |-- auth/{login, logout, register, forgot-password, reset-password, invite, accept-invite}/
|       |-- events/route.ts
|       |-- health/route.ts
|       |-- history/[id]/route.ts
|       |-- incidents/{route.ts, [id]/route.ts, [id]/actions/route.ts}
|       |-- integrations/gdms/{ping, sync, token}/
|       |-- me/route.ts
|       |-- notifications/{route.ts, seen/route.ts}
|       |-- register/route.ts
|       |-- stats/{route.ts, network-clients/route.ts}
|       `-- users/{route.ts, [id]/route.ts, invites/route.ts, invites/[id]/route.ts, invites/[id]/resend/route.ts}
|-- components
|   |-- AntennaStatusNotifications.tsx
|   |-- AntennaToolbar.tsx
|   |-- AuthInput.tsx / AuthParticles.tsx / PasswordInput.tsx
|   |-- BrandMark.tsx
|   |-- Client/index.tsx
|   |-- DashboardCards.tsx / DonutChart.tsx
|   |-- Footer.tsx / LayoutShell.tsx / Sidebar.tsx / TopBar.tsx
|   |-- MapClient.tsx
|   |-- NotificationBell.tsx
|   |-- PaginationControls.tsx
|   |-- ThemeScript.tsx / ThemeSync.tsx / ThemeToggle.tsx
|   |-- incidents/IncidentDetailPanel.tsx
|   `-- map/RotationControl.tsx
|-- db/schema.sql
|-- docs/superpowers/{specs,plans}/      # Desenho e plano da v1.2
|-- lib
|   |-- auth.ts / jwt.ts / roles.ts / requestSecurity.ts / rateLimit.ts
|   |-- gdmsToken.ts / gdmsNormalize.ts / gdmsSyncPlan.ts / gdmsSync.ts
|   |-- statusChanges.ts / incidentRules.ts / incidents.ts / incidentAlerts.ts / incidentFormat.ts
|   |-- invites.ts / inviteToken.ts / passwordReset.ts / publicUrl.ts
|   |-- email.ts / emailTemplates.ts
|   |-- mysql.ts / dbErrors.ts / dbMappers.ts
|   |-- sse.ts / ttlCache.ts / dateFormat.ts / csv.ts
|   |-- mapRotation.ts / sidebarPreference.ts / version.ts
|   `-- userStatus.ts / validators.ts / validatorsAuth.ts
|-- public/{icons.svg, logo_etherium.png}
|-- scripts
|   |-- docker-entrypoint.sh
|   |-- gdms-cron.mjs
|   |-- init-db.mjs / mysql-utils.mjs
|   `-- seed-local.mjs / seed-superadmin.mjs
|-- services/{api.ts, gdms.ts, sseClient.ts}
|-- store/{theme.ts, ui.ts}
|-- styles/globals.css
`-- tests
    |-- stubs/server-only.ts
    `-- unit/*.test.ts
```

</details>

| Diretório | Responsabilidade |
| --- | --- |
| `app/` | Páginas, layouts e Route Handlers do App Router |
| `components/` | Componentes de interface |
| `lib/` | Regras de negócio, segurança, banco, e-mail, SSE e funções puras testáveis |
| `services/` | Cliente HTTP do navegador, cliente SSE e cliente GDMS |
| `scripts/` | Bootstrap do banco, seed, worker e entrypoint do container |
| `db/` | Schema SQL versionado |
| `store/` | Estado global de interface e tema (Zustand) |
| `tests/` | Testes unitários (Vitest) |
| `docs/` | Especificação e plano de implementação |

## Variáveis de ambiente

Use [`env.example`](./env.example) como base. As tabelas abaixo listam o que muda o comportamento da aplicação.

### Aplicação e segurança

| Variável | Obrigatória | Exemplo | Observação |
| --- | --- | --- | --- |
| `NODE_ENV` | Sim | `production` | Ativa as políticas de segurança e os cookies seguros |
| `HOST` / `PORT` | Sim | `0.0.0.0` / `3000` | Bind do Next.js dentro do container |
| `HOST_PORT` | Sim no Compose | `3200` | Porta publicada no host |
| `APP_URL` | Recomendada | `https://stats.seu-dominio.com` | URL pública: validação de origem e base dos links de e-mail (redefinição e convite) |
| `NEXT_PUBLIC_APP_URL` | Não | igual a `APP_URL` | Alternativa a `APP_URL`; também vai para o build da imagem |
| `NEXT_PUBLIC_APP_NAME` | Não | `Etherium Antennas` | Argumento de build da imagem |
| `TRUST_PROXY_HEADERS` | Não | `false` | `true` só atrás de proxy confiável que sanitize `X-Forwarded-*` (ver [solução de problemas](#limite-de-requisições-bloqueia-todo-mundo-atrás-do-proxy)) |
| `JWT_SECRET` | Sim | 32+ caracteres | Assina e verifica o JWT |
| `JWT_EXPIRES_DAYS` | Não | `7` | Validade do cookie de sessão |
| `COOKIE_SECURE` | Sim em produção | `true` | `false` apenas em HTTP local |
| `ALLOW_SELF_REGISTER` | Não | `false` | Habilita `/api/register` e `/api/auth/register` |
| `INTERNAL_API_KEY` | Sim para o worker | 24+ caracteres | Protege as chamadas internas do worker |

### Banco

| Variável | Obrigatória | Exemplo | Observação |
| --- | --- | --- | --- |
| `MYSQL_IMAGE` | Não | `mysql:8.4` | Imagem do banco no Compose |
| `MYSQL_DATABASE` / `MYSQL_USER` / `MYSQL_PASSWORD` | Sim | `monitoring_grandstream` / `monitoring_app` / … | Banco e usuário da aplicação |
| `MYSQL_ROOT_PASSWORD` | Sim | … | Senha de administração do MySQL |
| `DATABASE_URL` | Sim | `mysql://monitoring_app:...@mysql:3306/monitoring_grandstream` | No Compose o host é `mysql`, não `localhost` |
| `MYSQL_POOL_SIZE` | Não | `10` | Tamanho do pool em [`lib/mysql.ts`](./lib/mysql.ts) |

### GWN/GDMS e worker

| Variável | Obrigatória | Exemplo | Observação |
| --- | --- | --- | --- |
| `GDMS_BASE` | Sim para integrar | `https://www.gwn.cloud` | Base das APIs |
| `GDMS_OAUTH_URL` | Sim para integrar | `https://www.gwn.cloud/oauth/token` | Endpoint OAuth |
| `GDMS_CLIENT_ID` / `GDMS_CLIENT_SECRET` | Sim para integrar | … | Credenciais da OpenAPI do GWN |
| `GDMS_PAGE_SIZE` | Não | `500` | Itens por página nas listagens |
| `GDMS_SHOW` | Não | `all` | Filtro de APs enviado ao GWN |
| `APP_BASE_URL` | Sim no worker | `http://web:3000` | URL **interna** do `web`, usada só pelo worker |
| `SYNC_PATH` | Sim no worker | `/api/integrations/gdms/sync?mode=status` | Rota chamada a cada ciclo |
| `SYNC_INTERVAL_MS` | Sim no worker | `300000` | Intervalo do worker (5 minutos) |

### E-mail, convites e alertas

| Variável | Obrigatória | Exemplo | Observação |
| --- | --- | --- | --- |
| `EMAIL_DEFAULT_FROM` | Sim para e-mail | `noreply@example.com` | Remetente |
| `EMAIL_TRANSPORT_DEFAULT_HOST` / `_PORT` | Sim para e-mail | `smtp.gmail.com` / `587` | Servidor SMTP |
| `EMAIL_TRANSPORT_DEFAULT_USERNAME` / `_PASSWORD` | Sim para e-mail | … | Credenciais SMTP (senha de app, no caso do Gmail) |
| `EMAIL_TRANSPORT_DEFAULT_TLS` | Não | `true` | Exige TLS |
| `PASSBOLT_KEY_EMAIL` | Não | `noreply@example.com` | Remetente alternativo quando `EMAIL_DEFAULT_FROM` está vazio |
| `PASSWORD_RESET_BASE_URL` | Não | `https://auth.exemplo.com` | Sobrescreve a base do link **apenas** de redefinição de senha |
| `PASSWORD_RESET_TOKEN_MINUTES` | Não | `60` | Validade do link de redefinição |
| `INVITE_TOKEN_HOURS` | Não | `72` | Validade do convite (1 a 336 h) |
| `INCIDENT_ALERTS_ENABLED` | Não | `true` | Liga o e-mail-resumo de APs offline/normalizados |
| `INCIDENT_ALERT_MIN_MINUTES` | Não | `10` | Tempo offline mínimo antes do alerta (1 a 1440 min); evita alarme por queda rápida |

### Superadmin inicial

| Variável | Obrigatória | Exemplo | Observação |
| --- | --- | --- | --- |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` / `SUPERADMIN_NAME` | Para o primeiro acesso | `admin@example.com` / … / `Root` | Usadas pelo seed idempotente |
| `SEED_SUPERADMIN_ON_STARTUP` | Não | `false` | Em produção, `false` depois do primeiro bootstrap |
| `SUPERADMIN_PROMOTE_IF_EXISTS` | Não | `false` | Promove um usuário existente a SUPERADMIN só quando intencional |
| `SUPERADMIN_SYNC_PASSWORD_IF_EXISTS` | Não | `false` | Com `true`, a senha do superadmin volta à do `.env` a cada restart (desfaz redefinições). Mantenha `false` em produção |

### Observações

- `FORCE_HTTP` e `GDMS_SYNC_INTERVAL_MS` aparecem no `env.example`, mas o código não as lê; o intervalo do worker é `SYNC_INTERVAL_MS`.
- `APP_BASE_URL` e `APP_URL` não são intercambiáveis: a primeira é interna ao Compose; a segunda precisa abrir no navegador do usuário. Links de e-mail nunca usam `APP_BASE_URL`.
- `JWT_SECRET` com menos de 32 caracteres impede a autenticação; `INTERNAL_API_KEY` com menos de 24 é recusada.

## Execução local

### Com Node (desenvolvimento)

```bash
cp env.example .env          # PowerShell: Copy-Item env.example .env
docker compose up -d mysql   # ou um MySQL 8 próprio
npm install
npm run db:init              # schema + migrações
npm run db:seed              # superadmin a partir de SUPERADMIN_*
npm run dev                  # http://localhost:3000
```

No `.env`, ajuste pelo menos `NODE_ENV=development`, `COOKIE_SECURE=false`, `DATABASE_URL` (com host acessível da sua máquina), `JWT_SECRET`, `APP_URL`, `SUPERADMIN_*`, as credenciais `GDMS_*` para integrar e `EMAIL_*` para testar convites, redefinição e alertas.

> **Atenção:** com SMTP real configurado, convites e alertas de ocorrência são enviados de verdade. Em teste, use `INCIDENT_ALERTS_ENABLED=false` ou um SMTP de testes.

### Com Docker (stack completo)

```bash
docker network create web    # rede externa usada pelo proxy; uma vez por máquina
docker compose up -d --build
```

Abra `http://localhost:3200` (ou o `HOST_PORT` definido). Para testar localmente com o `.env` de produção sem alterá-lo, use um arquivo de override do Compose (`docker compose -f docker-compose.yml -f override.yml up -d`) que defina `APP_URL: http://localhost:3200` no serviço `web`, para os links de e-mail e a validação de origem apontarem para a máquina local.

## Deploy com Docker Compose

### Serviços

| Serviço | Função | Healthcheck | Porta |
| --- | --- | --- | --- |
| `mysql` | MySQL 8.4 com volume `mysql_data` | `mysqladmin ping` | Só interna (`mysql:3306`) |
| `web` | Interface, APIs, SSE, schema e seed no startup | `GET /api/health` em `web` | `${HOST_PORT}:${PORT}` |
| `worker` | Sync periódico com o GWN | Aguarda o `web` saudável | — |

- `web` e `worker` leem `./.env` via `env_file` e rodam com `no-new-privileges` e `cap_drop: [ALL]`.
- O `web` usa o `server.js` de `.next/standalone` (`output: "standalone"`).
- O `web` participa da rede externa `web` (proxy reverso); `mysql` e `worker` ficam só na rede interna `app_net`.
- Os healthchecks usam os nomes de serviço (`mysql`, `web`), nunca `localhost`.

### Antes do primeiro `up` em produção

- [ ] `JWT_SECRET` com 32+ caracteres e `INTERNAL_API_KEY` com 24+.
- [ ] `COOKIE_SECURE=true` com HTTPS.
- [ ] `APP_URL` com a URL pública real (base dos links de convite e redefinição).
- [ ] `TRUST_PROXY_HEADERS=true` somente atrás de proxy confiável.
- [ ] `APP_BASE_URL=http://web:3000` para o worker.
- [ ] `SEED_SUPERADMIN_ON_STARTUP=false` e `SUPERADMIN_SYNC_PASSWORD_IF_EXISTS=false` depois do primeiro bootstrap.
- [ ] SMTP preenchido (convites, redefinição e alertas) e destinatários ADMIN/SUPERADMIN com e-mail válido.
- [ ] Credenciais GDMS preenchidas.
- [ ] Backup do volume `mysql_data`.

### Startup do `web`

1. [`scripts/init-db.mjs`](./scripts/init-db.mjs) aplica o schema, as colunas novas e as migrações únicas (`SchemaMigration`).
2. Com `SEED_SUPERADMIN_ON_STARTUP=true` e `SUPERADMIN_*` preenchidos, roda [`scripts/seed-superadmin.mjs`](./scripts/seed-superadmin.mjs).
3. Sobe o Next.js em modo produção.
4. O `worker` espera o `web` ficar saudável e passa a chamar o sync em modo `status` a cada `SYNC_INTERVAL_MS`.

### Atualizar para a v1.2

```bash
git pull
docker compose up -d --build web worker
```

- O schema é atualizado sozinho no startup. Na primeira subida, as ocorrências dos APs que já estavam offline são criadas sem disparar e-mail.
- O primeiro sync aplica a posição do GWN a todos os APs que têm localização configurada lá; a fila de Configurações passa a listar só os que não têm.
- Variáveis novas, todas com padrão: `INVITE_TOKEN_HOURS`, `INCIDENT_ALERTS_ENABLED`, `INCIDENT_ALERT_MIN_MINUTES`.

### Primeira carga do inventário

O worker roda em `mode=status` e **não cria APs novos**. Em ambiente novo, faça um sync completo:

- pela interface: `/settings` → **Sincronizar GDMS** (ADMIN ou SUPERADMIN);
- pelo terminal:

```bash
curl -X POST http://localhost:3200/api/integrations/gdms/sync \
  -H "x-internal-api-key: SUA_CHAVE_INTERNA"
```

### Manutenção

```bash
docker compose ps
docker compose logs -f web worker
docker compose restart worker
docker compose exec web npm run db:init
docker compose exec mysql sh -lc 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > backup.sql
```

## Testes e verificação

```bash
npm test             # Vitest, uma execução
npm run test:watch   # Vitest em modo observação
npx tsc --noEmit     # checagem de tipos
npm run lint         # ESLint
npm run build        # build de produção
```

- Os testes ficam em `tests/unit/` e cobrem as regras puras e os módulos com dependências injetadas: normalização de coordenadas, planejamento do sync, motor de sync, máquina de estados e alertas de ocorrências, convites e tokens, templates de e-mail (escape de HTML, corte em 100 itens), cliente GDMS (renovação em `401`), cliente HTTP e SSE, rotação do mapa, formatação de datas e preferência da sidebar.
- [`vitest.config.ts`](./vitest.config.ts) usa os mesmos aliases do `tsconfig` (`@lib`, `@services`, …) e troca `server-only` por um módulo vazio.
- `npm run test:e2e` (Playwright) ainda não tem suíte versionada.

## Operação e observabilidade

| Recurso | Endpoint ou comando | Objetivo |
| --- | --- | --- |
| Saúde do backend | `GET /api/health` | Confere a conexão do `web` com o MySQL |
| Teste do GWN | `GET /api/integrations/gdms/ping` | Confirma token e acesso ao inventário remoto |
| Token do GWN | `GET` / `POST /api/integrations/gdms/token` | Mostra a validade / força a renovação |
| Sync completo | `POST /api/integrations/gdms/sync` | Inventário, status, posição e ocorrências; devolve o resumo |
| Sync de status | `POST /api/integrations/gdms/sync?mode=status` | O que o worker roda a cada 5 minutos |
| Ocorrências | `/incidents` ou `GET /api/incidents` | Quedas abertas, tratativas e histórico |
| Logs | `docker compose logs -f web worker` | Autenticação, banco, SSE, sync e envio de e-mail |

## Endpoints

### Autenticação e convites

| Método e rota | Acesso | Função |
| --- | --- | --- |
| `POST /api/auth/login` | Público | Login |
| `POST /api/auth/logout` | Público | Logout (apaga os cookies) |
| `GET /api/me` | Autenticado | Dados do usuário, lidos do banco |
| `POST /api/auth/forgot-password` | Público | Envia o link de redefinição |
| `POST /api/auth/reset-password` | Público (token) | Grava a nova senha |
| `GET /api/auth/invite?token=` | Público (token) | Valida o convite e devolve e-mail, papel e validade |
| `POST /api/auth/accept-invite` | Público (token) | Cria o usuário a partir do convite e autentica |
| `POST /api/register`, `POST /api/auth/register` | Público, se `ALLOW_SELF_REGISTER=true` | Autocadastro |

### APs, histórico e estatísticas

| Método e rota | Acesso | Função |
| --- | --- | --- |
| `GET /api/antennas` | Autenticado | Lista com filtros e paginação (`placed=1` só APs posicionados) |
| `POST /api/antennas` | ADMIN | Cria AP manualmente |
| `GET` / `PATCH` / `DELETE /api/antennas/[id]` | Leitura: autenticado; mutação: ADMIN | Detalhe, edição (inclusive status) e exclusão |
| `PATCH /api/antennas/[id]/coords` | ADMIN | Posição manual (para APs sem posição no GWN) |
| `GET /api/antennas/networks` | Autenticado | Redes conhecidas |
| `GET /api/history/[id]` | Autenticado | Histórico de status do AP |
| `GET /api/stats` | Autenticado | Totais locais |
| `GET /api/stats/network-clients` | Autenticado | Clientes conectados por rede (GWN, cache de 60 s) |
| `GET /api/events` | Autenticado | Stream SSE |

### Ocorrências e notificações

| Método e rota | Acesso | Função |
| --- | --- | --- |
| `GET /api/incidents?status=&network=&q=&page=&pageSize=` | Autenticado | Lista paginada, mais recentes primeiro (`status`: `ACTIVE`, `OPEN`, `IN_PROGRESS`, `RESOLVED`, `ALL`) |
| `GET /api/incidents/[id]` | Autenticado | Ocorrência com a linha do tempo |
| `POST /api/incidents/[id]/actions` | ADMIN | `{ action: "START" \| "COMMENT" \| "RESOLVE", message? }`; `409 INVALID_TRANSITION` quando não permitido |
| `GET /api/notifications` | Autenticado | `{ unread, openCount, items }` (até 8 itens) |
| `POST /api/notifications/seen` | Autenticado | Marca as notificações como lidas |

### Integração GDMS

| Método e rota | Acesso | Função |
| --- | --- | --- |
| `POST /api/integrations/gdms/sync` | ADMIN ou chave interna | Sync completo ou `?mode=status`; `409 SYNC_IN_PROGRESS` se já houver um em andamento |
| `GET /api/integrations/gdms/ping` | ADMIN ou chave interna | Diagnóstico de acesso |
| `GET` / `POST /api/integrations/gdms/token` | ADMIN ou chave interna | Validade / renovação do token |

### Administração

| Método e rota | Acesso | Função |
| --- | --- | --- |
| `GET /api/users` | SUPERADMIN | Lista usuários |
| `PATCH /api/users/[id]` | SUPERADMIN | Papel, bloqueio, suspensão, reativação |
| `DELETE /api/users/[id]` | SUPERADMIN | Exclui usuário |
| `GET /api/users/invites` | SUPERADMIN | Convites pendentes |
| `POST /api/users/invites` | SUPERADMIN | `{ email, role }`: cria e envia o convite |
| `POST /api/users/invites/[id]/resend` | SUPERADMIN | Novo token, nova validade e reenvio |
| `DELETE /api/users/invites/[id]` | SUPERADMIN | Revoga o convite |

A criação direta de usuário (`POST /api/users`) foi substituída pelo convite.

## Scripts

| Script | Efeito |
| --- | --- |
| `npm run dev` | Desenvolvimento em `http://localhost:3000` |
| `npm run build` / `npm run start` | Build e servidor de produção |
| `npm run lint` | ESLint |
| `npm test` / `npm run test:watch` | Testes unitários (Vitest) |
| `npm run db:init` | Schema, colunas novas e migrações únicas |
| `npm run db:seed` | Cria ou atualiza o superadmin |
| `node scripts/seed-local.mjs` | Seed auxiliar de desenvolvimento |
| `node scripts/gdms-cron.mjs` | Worker de sync fora do Compose |

## Versionamento

- A versão oficial é a do `package.json` (atual: **1.2.0**). O [`next.config.js`](./next.config.js) a expõe no build como `NEXT_PUBLIC_APP_VERSION`, e [`lib/version.ts`](./lib/version.ts) a entrega à interface (sidebar e rodapé).
- Para lançar uma versão: atualize `version` no `package.json` (e no `package-lock.json` com `npm version <x.y.z> --no-git-tag-version`), registre as mudanças no [CHANGELOG](./CHANGELOG.md) e rebuild a imagem.
- O projeto segue [versionamento semântico](https://semver.org/lang/pt-BR/).

## Solução de problemas

### `web` não fica saudável

- `/api/health` retorna `503` ou o container reinicia: confira `DATABASE_URL` (host `mysql`, porta `3306` no Compose) e a coerência com `MYSQL_*`.
- Acompanhe `docker compose logs -f mysql web` e, se necessário, rode `docker compose exec web npm run db:init`.

### `exec ./scripts/docker-entrypoint.sh: no such file or directory` (Windows)

O script foi para a imagem com quebra de linha CRLF. O `.gitattributes` força `*.sh` com LF; se o checkout é anterior a essa regra, recrie o arquivo a partir do Git (sem alterações locais nele) e rebuild:

```bash
rm scripts/docker-entrypoint.sh
git checkout -- scripts/docker-entrypoint.sh
docker compose up -d --build web
```

### `network web declared as external, but could not be found`

A rede externa do proxy ainda não existe na máquina: `docker network create web`.

### AP não aparece no mapa / continua em Configurações

- O mapa mostra só APs posicionados (`lat`/`lon` diferentes de `0,0`).
- Configure a localização do AP no GWN e aguarde o próximo sync (até 5 minutos) ou clique em **Sincronizar GDMS**.
- Posição `0,0`, vazia ou fora da faixa no GWN é tratada como "sem posição".
- A posição digitada em Configurações é substituída assim que o GWN passar a informar uma.

### Sync responde `409 SYNC_IN_PROGRESS`

Já existe um sync rodando (normalmente o ciclo do worker). Aguarde o término e tente de novo.

### Alertas de ocorrência não chegam

- `INCIDENT_ALERTS_ENABLED` precisa estar `true` e o SMTP (`EMAIL_*`) configurado.
- O alerta só sai depois de `INCIDENT_ALERT_MIN_MINUTES` offline e no fim de um sync.
- Os destinatários são ADMIN e SUPERADMIN ativos; confira se há algum e se o e-mail deles é válido.
- Ocorrências criadas na implantação (AP que já estava offline) não geram e-mail, por desenho.
- Falha de SMTP aparece no log do `web`; o envio é tentado de novo no próximo ciclo.

### Convite inválido ou expirado

O link vale `INVITE_TOKEN_HOURS` e uma única vez; reenviar ou convidar de novo invalida o link anterior. Peça ao SUPERADMIN para usar **Reenviar** na Administração. Se o link aponta para um host interno, ajuste `APP_URL`.

### E-mail com link para `0.0.0.0`, `web` ou host interno

Configure `APP_URL` com o endereço que abre no navegador (por exemplo `https://stats.seu-dominio.com`). `PASSWORD_RESET_BASE_URL` só serve para sobrescrever o link de redefinição.

### Limite de requisições bloqueia todo mundo atrás do proxy

Sem `TRUST_PROXY_HEADERS=true`, todos os acessos que chegam pelo proxy compartilham o mesmo IP ("unknown") nos limites por IP (login, recuperação de senha, convite). Atrás de um proxy confiável que sanitize `X-Forwarded-For`/`X-Real-IP`, habilite a variável. Com a aplicação exposta diretamente, mantenha `false`.

### `ORIGIN_REQUIRED`, `ORIGIN_MISMATCH` ou `CSRF_INVALID`

- Acesse pelo mesmo host configurado em `APP_URL`.
- Atrás de proxy, encaminhe `X-Forwarded-Host` e `X-Forwarded-Proto`.
- Mutações com cookie precisam de `x-csrf-token`; a interface já envia.

### Usuário é mandado para `/login` de repente

É a revalidação de sessão: o usuário foi excluído, bloqueado ou suspenso (`401 SESSION_REVOKED`). Reative-o na Administração.

### Worker responde `401`/`403` ou não alcança o `web`

- Mantenha `APP_BASE_URL=http://web:3000` (nunca `localhost` dentro do container).
- `INTERNAL_API_KEY` deve ser idêntica no `web` e no `worker`.
- Confira se o `web` está saudável antes de olhar o worker.

### Worker não cria APs novos

É o esperado em `mode=status`. Faça um sync completo em `/settings` ou chame o endpoint sem `mode=status`.

### `GDMS /oapi/... failed` ou `retCode != 0`

- Confira `GDMS_CLIENT_ID`, `GDMS_CLIENT_SECRET`, `GDMS_BASE` e `GDMS_OAUTH_URL` (HTTPS em produção).
- Confira o relógio do host: a assinatura usa `timestamp`.
- Use `GET /api/integrations/gdms/token` e `GET /api/integrations/gdms/ping` para separar falha de token de falha de sync.

### Dashboard funciona, mas "clientes por rede" falha

`/api/stats` lê o banco local; `/api/stats/network-clients` consulta o GWN. Verifique as credenciais e o `ping` do GWN.

### Toasts ou notificações não aparecem

- Dependem do stream `GET /api/events`; confira no navegador se ele conecta.
- Atrás de proxy, desligue o buffering e use timeout longo para a rota SSE.
- Em `mode=status`, o AP precisa já existir no banco para haver transição.

### Sessão não persiste em HTTPS ou atrás de proxy

Use `COOKIE_SECURE=true` com HTTPS, encaminhe host e protocolo corretamente e alinhe `APP_URL`. Não teste cookie seguro em `http://localhost`.

## Licença

Projeto sob a licença MIT. Consulte [`LICENSE`](./LICENSE).
