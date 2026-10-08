<p align="center">
  <img src="./public/logo_etherium.png" alt="Etherium" width="170" />
</p>

<h1 align="center">Monitoring Grandstream</h1>

<p align="center">
  Plataforma full-stack para monitoramento operacional de APs Grandstream/Etherium com mapa georreferenciado,
  dashboard executivo, integração GDMS, trilha histórica de status e atualização em tempo real via SSE.
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white" />
  <img alt="MySQL" src="https://img.shields.io/badge/MySQL-8.4-4479A1?logo=mysql&logoColor=white" />
  <img alt="Docker" src="https://img.shields.io/badge/Docker_Compose-Deploy-2496ED?logo=docker&logoColor=white" />
  <img alt="JWT" src="https://img.shields.io/badge/JWT-Cookie_Auth-000000?logo=jsonwebtokens&logoColor=white" />
  <img alt="SSE" src="https://img.shields.io/badge/SSE-Tempo_Real-FF6A00" />
</p>

## Sumario

- [Visao Executiva](#visao-executiva)
- [Stack e Capacidades](#stack-e-capacidades)
- [Arquitetura da Solucao](#arquitetura-da-solucao)
- [Padrao de Integracao GWN/GDMS](#padrao-de-integracao-gwngdms)
- [Fluxos Criticos](#fluxos-criticos)
- [Dominios Funcionais](#dominios-funcionais)
- [Ajustes de Interface e Tempo Real](#ajustes-de-interface-e-tempo-real)
- [Modelo de Dados](#modelo-de-dados)
- [Estrutura Completa do Repositorio](#estrutura-completa-do-repositorio)
- [Variaveis de Ambiente](#variaveis-de-ambiente)
- [Execucao Local](#execucao-local)
- [Deploy com Docker Compose](#deploy-com-docker-compose)
- [Operacao e Observabilidade](#operacao-e-observabilidade)
- [Endpoints Principais](#endpoints-principais)
- [Scripts Disponiveis](#scripts-disponiveis)
- [Troubleshooting](#troubleshooting)
- [Licenca](#licenca)

## Visao Executiva

O projeto entrega uma camada operacional completa para inventario, monitoramento e manutencao de access points Grandstream:

- autenticacao com JWT em cookie `HttpOnly`, protecao CSRF, validacao de origem e rate limit;
- recuperacao de senha por email com token temporario e paginas dedicadas de solicitacao/reset;
- mapa operacional com APs posicionados, filtros, busca e fallback automatico para OpenStreetMap;
- dashboard com totais locais e consolidacao de clientes por rede via GDMS;
- notificacoes flutuantes em tempo real quando um AP fica offline ou volta para online;
- fila de pendencias para APs sem coordenadas, com sincronizacao manual e tratamento em lotes;
- area administrativa para gestao de usuarios com separacao por papeis `USER`, `ADMIN` e `SUPERADMIN`, incluindo bloqueio, suspensao temporaria, reativacao, exclusao e politica de senha;
- worker dedicado para sincronizacao periodica com o GDMS usando `x-internal-api-key`;
- stream SSE para refletir alteracoes de APs e status em tempo real nas telas principais;
- shell autenticado com topbar operacional, toggle rapido de tema light/dark e footer institucional com contato operacional.

## Stack e Capacidades

| Camada | Implementacao | Papel no sistema |
| --- | --- | --- |
| Frontend | Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Framer Motion | Shell autenticado, mapa, dashboard, formularios, login e navegacao |
| Mapa | `maplibre-gl` com tiles ArcGIS e fallback para OSM | Visualizacao geografica dos APs e operacao em campo |
| Backend | Route Handlers em `app/api/*` | API interna, autenticacao, RBAC, integracoes e healthcheck |
| Seguranca | `jose`, `bcryptjs`, middleware customizado, `zod` | JWT, cookies, validacao de origem, CSRF e validacao de payload |
| Email | `nodemailer` + SMTP autenticado | Entrega de link de redefinicao de senha |
| Banco | MySQL 8 + `mysql2/promise` + SQL direto | Persistencia de `Antenna`, `StatusHistory`, `User`, `PasswordResetToken` e `gdms_token` |
| Integracao | GDMS OAuth Client Credentials + APIs de redes/APs | Importacao de inventario, status e clientes por rede |
| Tempo real | Server-Sent Events em `/api/events` | Atualizacao assincrona da UI, refresh seletivo e notificacoes flutuantes |
| Infra | Docker multi-stage + Docker Compose | Servicos `mysql`, `web` e `worker` com healthchecks |

## Arquitetura da Solucao

```mermaid
flowchart LR
  subgraph Browser["Cliente Web"]
    UI["Paginas App Router<br/>Mapa, Dashboard, Clients, Settings, Admin"]
    FE["components/ + services/api.ts + services/sseClient.ts"]
  end

  subgraph Web["Container web"]
    MW["middleware.ts<br/>Auth de pagina + headers + RBAC"]
    API["Route Handlers em app/api/*"]
    CORE["lib/*<br/>auth, mysql, gdmsToken, rateLimit, sse"]
  end

  subgraph Data["Persistencia"]
    DB[("MySQL 8<br/>Antenna, StatusHistory, User, PasswordResetToken, gdms_token")]
  end

  subgraph External["Integracoes externas"]
    GDMS["GDMS<br/>OAuth + inventory APIs"]
  end

  Worker["Container worker<br/>scripts/gdms-cron.mjs"]

  UI --> FE
  FE --> MW
  FE --> API
  MW --> API
  API --> CORE
  CORE --> DB
  API --> GDMS
  Worker -->|POST interno| API
  API -->|SSE events| FE
```

### Caracteristicas arquiteturais

- `middleware.ts` protege paginas privadas, aplica headers de seguranca e bloqueia acessos por papel.
- As rotas `/api/*` nao sao bloqueadas pelo middleware, mas endpoints sensiveis exigem `requireRequestAuth(...)` ou `requireRequestAuthOrInternal(...)`.
- O schema do banco esta em [`db/schema.sql`](./db/schema.sql), sem ORM ativo em producao.
- O container `web` inicializa o banco e garante o superadmin via [`scripts/docker-entrypoint.sh`](./scripts/docker-entrypoint.sh).
- O container `worker` nao fala direto com o GDMS em nome da UI; ele chama a API interna de sincronizacao, preservando a mesma regra de negocio do backend.
- Links enviados por email devem apontar para uma URL publica/acessivel pelo navegador; `APP_BASE_URL=http://web:3000` continua restrita ao trafego interno do worker.
- O tema e sincronizado globalmente por [`components/ThemeSync.tsx`](./components/ThemeSync.tsx), carregado em [`app/layout.tsx`](./app/layout.tsx), sem depender de cada pagina individualmente.

## Padrao de Integracao GWN/GDMS

### Escopo da integracao

- A UI nao chama a API da Grandstream diretamente; toda a comunicacao externa sai do backend `web`.
- Neste repositorio, "GWN/GDMS" representa a camada cloud da Grandstream consumida via OAuth + endpoints `/oapi/...`.
- O `worker` nao implementa um cliente GDMS proprio. Ele apenas agenda chamadas internas contra o `web`, reaproveitando a mesma regra de negocio das rotas.
- As rotas de integracao aceitam usuario autenticado `ADMIN`/`SUPERADMIN` ou chamada interna com `x-internal-api-key`, sempre com rate limit.

### Componentes e responsabilidades

| Camada | Arquivo | Responsabilidade |
| --- | --- | --- |
| Token OAuth | [`lib/gdmsToken.ts`](./lib/gdmsToken.ts) | Resolve token com ordem memoria -> tabela `gdms_token` -> refresh OAuth |
| Cliente GDMS | [`services/gdms.ts`](./services/gdms.ts) | Assina requests, pagina redes/APs, normaliza status, clientes e coordenadas |
| Sync persistente | [`app/api/integrations/gdms/sync/route.ts`](./app/api/integrations/gdms/sync/route.ts) | Persiste inventario e status, grava `StatusHistory` e emite SSE |
| Diagnostico | [`app/api/integrations/gdms/ping/route.ts`](./app/api/integrations/gdms/ping/route.ts) | Testa acesso remoto a redes e APs sem alterar o banco |
| Token ops | [`app/api/integrations/gdms/token/route.ts`](./app/api/integrations/gdms/token/route.ts) | Mostra expiracao e permite refresh manual do token |
| Consulta ao vivo | [`app/api/stats/network-clients/route.ts`](./app/api/stats/network-clients/route.ts) | Calcula clientes por rede diretamente do GDMS, sem depender apenas do snapshot local |
| Agendamento | [`scripts/gdms-cron.mjs`](./scripts/gdms-cron.mjs) | Dispara sincronizacao periodica contra `APP_BASE_URL` |

### Sequencia padronizada da conexao

```mermaid
sequenceDiagram
  participant W as Worker ou Admin
  participant API as app/api/integrations/gdms/*
  participant TOK as lib/gdmsToken.ts
  participant DB as MySQL
  participant GDMS as GWN/GDMS Cloud
  participant SSE as lib/sse.ts
  participant UI as Browser autenticado

  W->>API: Ping, token ou sync
  API->>TOK: getAccessToken()
  alt Token valido em memoria
    TOK-->>API: Reutiliza token
  else Token valido em gdms_token
    TOK->>DB: SELECT gdms_token
    DB-->>TOK: accessToken + expiresAt
    TOK-->>API: Reutiliza token persistido
  else Token ausente ou expirando
    TOK->>GDMS: POST OAuth client_credentials
    GDMS-->>TOK: access_token + expires_in
    TOK->>DB: UPSERT gdms_token
    TOK-->>API: Novo token
  end
  API->>GDMS: POST /oapi/... com access_token, appID, timestamp e signature
  GDMS-->>API: Redes, APs e clientes
  API->>DB: INSERT/UPDATE em Antenna e StatusHistory
  API->>SSE: emit(antenna.* / status.changed)
  SSE-->>UI: Atualiza mapa, cards, filtros e toasts
```

### Logica padronizada da chamada

1. `services/gdms.ts` valida `GDMS_BASE`, `GDMS_CLIENT_ID` e `GDMS_CLIENT_SECRET`.
2. `lib/gdmsToken.ts` resolve o token na ordem memoria -> banco -> OAuth.
3. O backend serializa o body JSON, gera hash SHA-256 e calcula a `signature`.
4. A chamada segue via `POST` para o GDMS com `access_token`, `appID`, `timestamp` e `signature`.
5. Respostas HTTP nao-2xx ou `retCode != 0` sao tratadas como erro de integracao.
6. O retorno bruto e normalizado antes de persistencia, resposta da API ou emissao de SSE.

### Regras atuais de normalizacao

| Campo local | Origem GDMS | Regra atual |
| --- | --- | --- |
| `gdmsApId` | `id`, `apId`, `deviceId`, `mac`, `serialNumber`, `uuid` | Primeiro identificador nao vazio encontrado |
| `status` | `status` numerico do AP | `1 => UP`; qualquer outro valor => `DOWN` |
| `lat` / `lon` | `ap_latitude`, `latitude`, `lat`, `gps.*`, `location.*`, `position.*` | Primeiro numero disponivel |
| `clients` | `clients`, `clientCount`, `stationCount`, `users` | Inteiro positivo; fallback `0` |
| `networkId` / `networkName` | Lista de redes + contexto do loop de APs | Sempre preenchidos no fluxo de sincronizacao |

### Modos operacionais de integracao

| Modo | Endpoint | Efeito |
| --- | --- | --- |
| Full sync | `POST /api/integrations/gdms/sync` | Cria APs novos, atualiza metadados, tenta preencher coordenadas faltantes, registra historico e emite `antenna.created`, `antenna.updated` e `status.changed` |
| Status-only | `POST /api/integrations/gdms/sync?mode=status` | Atualiza somente APs ja existentes, grava mudancas de status e funciona como modo padrao do worker |
| Ping | `GET /api/integrations/gdms/ping` | Valida token + acesso remoto sem persistir inventario |
| Token info/refresh | `GET`/`POST /api/integrations/gdms/token` | Observa expiracao e forca renovacao OAuth |

### Regras de padronizacao recomendadas

- Nunca chamar o GDMS a partir do browser; qualquer nova integracao deve entrar por `services/gdms.ts` ou modulo equivalente server-side.
- Nao duplicar a regra de negocio do sync no worker. O padrao correto continua sendo worker -> API interna -> servicos -> banco/SSE.
- Em producao, `GDMS_BASE` e `GDMS_OAUTH_URL` devem usar HTTPS; o proprio codigo rejeita HTTP.
- Para ambiente Docker, `APP_BASE_URL` deve apontar para o nome do servico (`http://web:3000` no stack atual), nao para `localhost`.
- Fluxos que so precisam de status devem preferir `mode=status`; carga inicial e reconciliacao estrutural devem usar full sync.

## Fluxos Criticos

### 1. Autenticacao e autorizacao

```mermaid
sequenceDiagram
  actor U as Usuario
  participant B as Browser
  participant L as POST /api/auth/login
  participant DB as MySQL
  participant M as Middleware

  U->>B: Preenche /login
  B->>L: POST credenciais
  L->>L: Valida Origin + rate limit + schema
  L->>DB: Busca User por email
  DB-->>L: passwordHash, role, isBlocked
  L->>L: bcrypt.compare + gera JWT + CSRF
  L-->>B: cookies auth(HttpOnly) + csrf
  B->>M: Navega para rota privada
  M->>M: Verifica cookie auth
  M-->>B: Libera, redireciona ou bloqueia por papel
```

### 1.1. Recuperacao de senha por email

```mermaid
sequenceDiagram
  actor U as Usuario
  participant B as Browser
  participant F as POST /api/auth/forgot-password
  participant R as POST /api/auth/reset-password
  participant DB as MySQL
  participant SMTP as SMTP

  U->>B: Clica em /forgot-password
  B->>F: POST email
  F->>DB: Invalida tokens anteriores e grava novo PasswordResetToken
  F->>SMTP: Envia link /reset-password?token=...
  SMTP-->>U: Email com link temporario
  U->>B: Abre link recebido
  B->>R: POST nova senha + token
  R->>DB: Atualiza passwordHash e consome token
  R-->>B: Reset confirmado
```

### 2. Sincronizacao GDMS

```mermaid
sequenceDiagram
  participant T as Worker ou Admin
  participant S as POST /api/integrations/gdms/sync
  participant G as GDMS
  participant DB as MySQL
  participant E as SSE

  T->>S: Chama sincronizacao
  S->>G: Lista redes
  loop Para cada rede
    S->>G: Lista APs da rede
    G-->>S: Inventario, status, clientes, lat/lng
    S->>DB: INSERT/UPDATE em Antenna
    alt Status mudou
      S->>DB: INSERT em StatusHistory
    end
  end
  S->>E: emit(antenna.* / status.changed)
  E-->>UI: Atualiza mapa, cards, filas e notificacoes
```

### 3. Tempo real na interface

- `/api/events` abre um stream SSE autenticado.
- Eventos nomeados usados hoje: `connected`, `ping`, `antenna.created`, `antenna.updated`, `antenna.deleted` e `status.changed`.
- O payload de `status.changed` pode incluir `id`, `name`, `networkName`, `previousStatus`, `status` e `at`.
- Dashboard, mapa, filtros e settings reagem a esses eventos para revalidar dados locais sem depender apenas de refresh manual.
- O componente [`components/AntennaStatusNotifications.tsx`](./components/AntennaStatusNotifications.tsx) exibe toast flutuante quando um AP muda de `UP` para `DOWN` ou de `DOWN` para `UP`.

## Dominios Funcionais

| Area | Rota | Funcao | Papel minimo |
| --- | --- | --- | --- |
| Login | `/login` | Entrada do usuario e emissao dos cookies `auth` + `csrf` | Publico |
| Recuperacao | `/forgot-password` | Solicita envio do link de redefinicao por email | Publico |
| Reset de senha | `/reset-password` | Define nova senha a partir do token recebido por email | Publico |
| Mapa | `/` | Visualiza APs com coordenadas, filtros e acao manual de criacao de AP | Autenticado; criacao manual para `ADMIN`/`SUPERADMIN` |
| Dashboard | `/dashboard` | Totais locais, disponibilidade e clientes por rede | Autenticado |
| Clientes | `/clients` | Visao de clientes conectados por rede consumindo GDMS em tempo real de consulta | Autenticado |
| Filter Cluster | `/filter-cluster` | Busca operacional, paginacao, exportacao CSV, alteracao de status e exclusao | Leitura para autenticado; mutacao para `ADMIN`/`SUPERADMIN` |
| Settings | `/settings` | Fila de APs sem coordenadas e sincronizacao manual GDMS | `ADMIN`/`SUPERADMIN` |
| Admin | `/admin` | Listagem, criacao, bloqueio, suspensao, reativacao e exclusao de usuarios | `SUPERADMIN` |

## Ajustes de Interface e Tempo Real

### Login e identidade visual

- A tela [`/login`](./app/(auth)/login/page.tsx) usa o rotulo visual `Stats A.P` com icone de antena (`faTowerBroadcast`).
- O campo de email reutiliza [`components/AuthInput.tsx`](./components/AuthInput.tsx) com icone de envelope.
- O campo de senha reutiliza [`components/PasswordInput.tsx`](./components/PasswordInput.tsx), incluindo toggle visual com `eye`/`eye-slash`.
- As telas de recuperacao e reset seguem a mesma linha visual e os mesmos componentes base.

### Topbar e tema

- A [`components/TopBar.tsx`](./components/TopBar.tsx) mantem o layout operacional original com busca, reload, fullscreen, toggle de tema e logout.
- O toggle exposto na topbar alterna rapidamente entre `light` e `dark`.
- A persistencia do tema continua centralizada em [`store/theme.ts`](./store/theme.ts), incluindo suporte interno a `system` para sincronizacao com preferencia do navegador.

### Footer institucional

- O footer usa uma unica logo da Etheriumtech.
- O CTA `Fale conosco por email` abre `mailto:infraestrutura@etheriumtech.com.br`.
- O bloco `Powered by` referencia os responsaveis com link direto para LinkedIn:

| Nome | Papel | Link |
| --- | --- | --- |
| Jeferson Oliveira | Network Engineer | `https://www.linkedin.com/in/jeferson-rocha-1b494b1b5` |
| Marcos Ribeiro | Software Engineer | `https://linkedin.com/in/marcos-ribeiro-de-sousa-782b7782` |
| Mickael Lelis | DevOps/SRE | `https://linkedin.com/in/mickael-l-079743133` |

### Notificacoes de status

- O componente [`components/AntennaStatusNotifications.tsx`](./components/AntennaStatusNotifications.tsx) fica carregado globalmente no shell autenticado via [`components/LayoutShell.tsx`](./components/LayoutShell.tsx).
- Quando um AP entra em `DOWN`, a interface mostra `AP offline`.
- Quando um AP retorna para `UP`, a interface mostra `AP online novamente`.
- As notificacoes dependem do evento SSE `status.changed`, emitido tanto por alteracao manual em [`app/api/antennas/[id]/route.ts`](./app/api/antennas/[id]/route.ts) quanto pela sincronizacao GDMS em [`app/api/integrations/gdms/sync/route.ts`](./app/api/integrations/gdms/sync/route.ts).

## Modelo de Dados

```mermaid
erDiagram
  Antenna {
    int id PK
    string name
    text description
    double lat
    double lon
    string status
    string gdmsApId UK
    string networkId
    string networkName
    datetime lastSyncAt
    datetime lastStatusChange
    datetime createdAt
    datetime updatedAt
  }

  StatusHistory {
    int id PK
    int antennaId FK
    string status
    datetime changedAt
  }

  User {
    int id PK
    string name
    string email UK
    string passwordHash
    string role
    boolean isBlocked
    datetime suspendedUntil
    datetime createdAt
  }

  PasswordResetToken {
    bigint id PK
    int userId FK
    string tokenHash UK
    datetime expiresAt
    datetime usedAt
    datetime createdAt
  }

  gdms_token {
    int id PK
    text accessToken
    datetime expiresAt
    datetime updatedAt
  }

  Antenna ||--o{ StatusHistory : tracks
  User ||--o{ PasswordResetToken : owns
```

## Estrutura Completa do Repositorio

Diretorios gerados ou externos omitidos propositalmente: `.git/`, `.next/` e `node_modules/`.

<details open>
<summary><strong>Arvore de codigo-fonte e infraestrutura</strong></summary>

```text
.
|-- .dockerignore
|-- .eslintrc.json
|-- .gitattributes
|-- .gitignore
|-- Dockerfile
|-- LICENSE
|-- README.md
|-- docker-compose.yml
|-- env.example
|-- middleware.ts
|-- next-env.d.ts
|-- next.config.js
|-- package-lock.json
|-- package.json
|-- postcss.config.js
|-- tailwind.config.ts
|-- tsconfig.json
|-- app
|   |-- (app)
|   |   |-- admin
|   |   |   `-- page.tsx
|   |   |-- clients
|   |   |   `-- page.tsx
|   |   |-- dashboard
|   |   |   |-- loading.tsx
|   |   |   `-- page.tsx
|   |   |-- filter-cluster
|   |   |   `-- page.tsx
|   |   |-- layout.tsx
|   |   |-- page.tsx
|   |   `-- settings
|   |       `-- page.tsx
|   |-- (auth)
|   |   |-- layout.tsx
|   |   |-- forgot-password
|   |   |   `-- page.tsx
|   |   |-- login
|   |   |   `-- page.tsx
|   |   `-- reset-password
|   |       `-- page.tsx
|   |-- api
|   |   |-- antennas
|   |   |   |-- [id]
|   |   |   |   |-- coords
|   |   |   |   |   `-- route.ts
|   |   |   |   `-- route.ts
|   |   |   |-- networks
|   |   |   |   `-- route.ts
|   |   |   `-- route.ts
|   |   |-- auth
|   |   |   |-- forgot-password
|   |   |   |   `-- route.ts
|   |   |   |-- login
|   |   |   |   `-- route.ts
|   |   |   |-- logout
|   |   |   |   `-- route.ts
|   |   |   |-- reset-password
|   |   |   |   `-- route.ts
|   |   |   `-- register
|   |   |       `-- route.ts
|   |   |-- events
|   |   |   `-- route.ts
|   |   |-- health
|   |   |   `-- route.ts
|   |   |-- history
|   |   |   `-- [id]
|   |   |       `-- route.ts
|   |   |-- integrations
|   |   |   `-- gdms
|   |   |       |-- ping
|   |   |       |   `-- route.ts
|   |   |       |-- sync
|   |   |       |   `-- route.ts
|   |   |       `-- token
|   |   |           `-- route.ts
|   |   |-- me
|   |   |   `-- route.ts
|   |   |-- register
|   |   |   `-- route.ts
|   |   |-- stats
|   |   |   |-- network-clients
|   |   |   |   `-- route.ts
|   |   |   `-- route.ts
|   |   `-- users
|   |       |-- [id]
|   |       |   `-- route.ts
|   |       `-- route.ts
|   |-- layout.tsx
|   `-- loading.tsx
|-- components
|   |-- AntennaToolbar.tsx
|   |-- AntennaStatusNotifications.tsx
|   |-- AuthInput.tsx
|   |-- AuthParticles.tsx
|   |-- DashboardCards.tsx
|   |-- DonutChart.tsx
|   |-- Footer.tsx
|   |-- LayoutShell.tsx
|   |-- MapClient.tsx
|   |-- PaginationControls.tsx
|   |-- PasswordInput.tsx
|   |-- Sidebar.tsx
|   |-- ThemeScript.tsx
|   |-- ThemeSync.tsx
|   |-- ThemeToggle.tsx
|   |-- TopBar.tsx
|   `-- Client
|       `-- index.tsx
|-- db
|   `-- schema.sql
|-- lib
|   |-- auth.ts
|   |-- csv.ts
|   |-- dbErrors.ts
|   |-- dbMappers.ts
|   |-- gdmsToken.ts
|   |-- email.ts
|   |-- mysql.ts
|   |-- passwordReset.ts
|   |-- rateLimit.ts
|   |-- requestSecurity.ts
|   |-- sse.ts
|   |-- userStatus.ts
|   |-- validators.ts
|   `-- validatorsAuth.ts
|-- public
|   |-- icons.svg
|   `-- logo_etherium.png
|-- scripts
|   |-- docker-entrypoint.sh
|   |-- gdms-cron.mjs
|   |-- init-db.mjs
|   |-- mysql-utils.mjs
|   |-- seed-local.mjs
|   `-- seed-superadmin.mjs
|-- services
|   |-- api.ts
|   |-- gdms.ts
|   `-- sseClient.ts
|-- store
|   |-- theme.ts
|   `-- ui.ts
`-- styles
    `-- globals.css
```

</details>

### Responsabilidade por diretorio

| Diretorio | Responsabilidade |
| --- | --- |
| `app/` | Paginas, layouts e Route Handlers do App Router |
| `components/` | Componentes de UI e blocos de composicao de tela |
| `lib/` | Nucleo de seguranca, banco, validacao, SSE e mapeamento de dados |
| `services/` | Clientes frontend e integracao com GDMS |
| `scripts/` | Bootstrap, seed, cron e utilitarios operacionais |
| `db/` | Schema SQL versionado |
| `public/` | Assets estaticos do projeto |
| `store/` | Estado global de UI/tema |
| `styles/` | CSS global |

## Variaveis de Ambiente

Use [`env.example`](./env.example) como baseline. Abaixo estao as chaves que realmente mudam o comportamento operacional.

### Aplicacao e seguranca

| Variavel | Obrigatoria | Exemplo | Observacao |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | Nao | `Etherium Antennas` | Nome exibido na interface |
| `NODE_ENV` | Sim | `production` | Ativa politicas de seguranca e cookies seguros |
| `HOST` | Sim | `0.0.0.0` | Bind do servidor Next.js |
| `PORT` | Sim | `3000` | Porta interna do container `web` |
| `HOST_PORT` | Sim no Compose | `3200` | Porta exposta no host |
| `APP_URL` | Recomendada | `http://localhost:3200` ou `https://seu-dominio.com` | URL publica usada em validacao de origem e como base para links de reset |
| `TRUST_PROXY_HEADERS` | Nao | `false` | So use `true` atras de proxy reverso confiavel que sanitize `X-Forwarded-*` |
| `JWT_SECRET` | Sim | segredo >= 32 chars | Obrigatorio para assinar/verificar JWT |
| `JWT_EXPIRES_DAYS` | Nao | `7` | TTL do cookie de autenticacao |
| `COOKIE_SECURE` | Sim em producao | `true` | Deve ficar `false` apenas em HTTP local |
| `ALLOW_SELF_REGISTER` | Nao | `false` | Habilita `/api/register` e `/api/auth/register` |
| `INTERNAL_API_KEY` | Sim para worker | segredo >= 24 chars | Protege rotas internas consumidas pelo worker |

### Banco e pool

| Variavel | Obrigatoria | Exemplo | Observacao |
| --- | --- | --- | --- |
| `MYSQL_IMAGE` | Nao | `mysql:8.4` | Imagem do banco no Compose |
| `MYSQL_PORT` | Sim no Compose | `3306` | Porta interna do MySQL dentro da rede Docker |
| `MYSQL_DATABASE` | Sim | `monitoring_grandstream` | Banco principal |
| `MYSQL_USER` | Sim | `monitoring_app` | Usuario da aplicacao |
| `MYSQL_PASSWORD` | Sim | `change-me-app-password` | Senha do usuario da aplicacao |
| `MYSQL_ROOT_PASSWORD` | Sim | `change-me-root-password` | Senha de administracao do MySQL |
| `DATABASE_URL` | Sim | `mysql://monitoring_app:...@mysql:3306/monitoring_grandstream` | O host correto no Compose eh `mysql`, nao `localhost` |
| `MYSQL_POOL_SIZE` | Opcional | `10` | Controla o limite do pool em [`lib/mysql.ts`](./lib/mysql.ts) e ja consta no `env.example` |

### GDMS e sincronizacao

| Variavel | Obrigatoria | Exemplo | Observacao |
| --- | --- | --- | --- |
| `GDMS_BASE` | Sim se usar integracao | `https://www.gwn.cloud` | Base das APIs GDMS |
| `GDMS_OAUTH_URL` | Sim se usar integracao | `https://www.gwn.cloud/oauth/token` | Endpoint OAuth |
| `GDMS_CLIENT_ID` | Sim se usar integracao | `...` | Client ID do GDMS |
| `GDMS_CLIENT_SECRET` | Sim se usar integracao | `...` | Client Secret do GDMS |
| `GDMS_PAGE_SIZE` | Nao | `500` | Limite por pagina nas consultas |
| `GDMS_SHOW` | Nao | `all` | Filtro enviado ao GDMS para APs |
| `APP_BASE_URL` | Sim no worker | `http://web:3000` | URL interna do servico `web` consumida pelo worker |
| `SYNC_PATH` | Sim no worker | `/api/integrations/gdms/sync?mode=status` | Rota chamada pelo cron |
| `SYNC_INTERVAL_MS` | Sim no worker | `300000` | Intervalo do worker em milissegundos |

### Recuperacao de senha e email

| Variavel | Obrigatoria | Exemplo | Observacao |
| --- | --- | --- | --- |
| `PASSWORD_RESET_BASE_URL` | Nao | `https://auth.exemplo.com` | Sobrescreve a base do link de redefinicao quando precisa divergir do `APP_URL` |
| `PASSWORD_RESET_TOKEN_MINUTES` | Nao | `60` | TTL do token de reset |
| `EMAIL_DEFAULT_FROM` | Sim se usar reset por email | `noreply@example.com` | Remetente do email |
| `EMAIL_TRANSPORT_DEFAULT_HOST` | Sim se usar reset por email | `smtp.gmail.com` | Host SMTP |
| `EMAIL_TRANSPORT_DEFAULT_PORT` | Sim se usar reset por email | `587` | Porta SMTP |
| `EMAIL_TRANSPORT_DEFAULT_USERNAME` | Sim se usar reset por email | `usuario@example.com` | Usuario SMTP |
| `EMAIL_TRANSPORT_DEFAULT_PASSWORD` | Sim se usar reset por email | `...` | Senha ou app password SMTP |
| `EMAIL_TRANSPORT_DEFAULT_TLS` | Nao | `true` | Exige TLS no transporte |
| `PASSBOLT_KEY_EMAIL` | Nao | `noreply@example.com` | Fallback para remetente quando `EMAIL_DEFAULT_FROM` nao estiver definido |

### Bootstrap administrativo

| Variavel | Obrigatoria | Exemplo | Observacao |
| --- | --- | --- | --- |
| `SUPERADMIN_EMAIL` | Recomendada | `admin@example.com` | Seed idempotente do superadmin |
| `SUPERADMIN_PASSWORD` | Recomendada | `change-me-superadmin-password` | Necessaria para criacao inicial |
| `SUPERADMIN_NAME` | Nao | `Root` | Nome exibido na conta inicial |
| `SEED_SUPERADMIN_ON_STARTUP` | Nao | `false` | Em producao, mantenha `false`; habilite apenas para bootstrap controlado |
| `SUPERADMIN_PROMOTE_IF_EXISTS` | Nao | `false` | Promove um usuario existente para `SUPERADMIN` somente quando a elevacao automatica for intencional |
| `SUPERADMIN_SYNC_PASSWORD_IF_EXISTS` | Não | `false` | Com `true`, a senha do superadmin é sobrescrita pela do `.env` a cada restart (desfaz redefinições). Mantenha `false` em produção |

### Proxy e origem confiavel

Essas variaveis sao aceitas pelo codigo para origem publica e fallback do frontend:

| Variavel | Quando usar | Papel |
| --- | --- | --- |
| `APP_URL` | Reverse proxy, dominio publico, HTTPS terminado fora do container | Ajuda a validacao de origem em mutacoes e serve de base publica para links de reset |
| `NEXT_PUBLIC_APP_URL` | Mesmo cenario acima | Fallback para a mesma validacao, consumo frontend e build da imagem Docker |
| `TRUST_PROXY_HEADERS` | Quando houver Nginx/Traefik/ALB confiavel na frente da app | Permite confiar em `X-Forwarded-Host`, `X-Forwarded-Proto`, `X-Forwarded-For` e `X-Real-IP` |

Sem `TRUST_PROXY_HEADERS=true`, todos os acessos que chegam pelo proxy compartilham o mesmo IP ("unknown") nos limites por IP (login, recuperação de senha, convite). Atrás de um proxy confiável, habilite a variável.

### Observacoes importantes

- `FORCE_HTTP` e `GDMS_SYNC_INTERVAL_MS` aparecem no `env.example` e no `docker-compose.yml`, mas nao possuem consumo direto no codigo atual do backend.
- `JWT_SECRET` com menos de 32 caracteres quebra a inicializacao do fluxo de autenticacao.
- `INTERNAL_API_KEY` com menos de 24 caracteres nao eh aceita no fluxo `requireRequestAuthOrInternal(...)`.
- `APP_BASE_URL` e `APP_URL` nao sao intercambiaveis: o primeiro eh interno ao Compose; o segundo precisa ser acessivel pelo navegador do usuario.
- `TRUST_PROXY_HEADERS` deve permanecer `false` quando a aplicacao estiver exposta diretamente; habilite apenas atras de proxy confiavel.

## Execucao Local

### 1. Preparar ambiente

```bash
cp env.example .env
# PowerShell: Copy-Item env.example .env
```

Ajuste pelo menos:

- `NODE_ENV=development`
- `COOKIE_SECURE=false`
- `DATABASE_URL`
- `JWT_SECRET`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL` se quiser alinhar a URL publica consumida no frontend e no build Docker
- `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` e `SUPERADMIN_NAME`
- `GDMS_CLIENT_ID` e `GDMS_CLIENT_SECRET` se quiser integrar o GDMS desde o inicio
- `EMAIL_*` se quiser testar o fluxo de recuperacao de senha por email

### 2. Subir banco local

```bash
docker compose up -d mysql
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Aplicar schema

```bash
npm run db:init
```

### 5. Criar ou promover superadmin

```bash
npm run db:seed
```

Alternativa rapida apenas para desenvolvimento:

```bash
node scripts/seed-local.mjs
```

### 6. Subir aplicacao

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Deploy com Docker Compose

### Topologia do stack

| Servico | Funcao | Healthcheck | Porta publicada |
| --- | --- | --- | --- |
| `mysql` | Persistencia MySQL 8.4 | `mysqladmin ping` em `mysql` | Nao publica porta por padrao; acesso interno por DNS `mysql:3306` |
| `web` | UI Next.js, APIs, SSE, bootstrap de schema e seed | `GET /api/health` em `web` | `${HOST_PORT}:${PORT}` |
| `worker` | Cron de sincronizacao GDMS | Depende do `web` healthy | Nao publica porta |

### Convencoes atuais do Compose

- `web` e `worker` carregam variaveis operacionais a partir de `./.env` via `env_file`.
- O build da imagem recebe `NEXT_PUBLIC_APP_NAME` e `NEXT_PUBLIC_APP_URL` como `build.args`.
- Os `healthcheck`s nao usam `localhost` ou `127.0.0.1`; a stack usa os nomes de servico Docker (`mysql` e `web`) para evitar ambiguidade em execucao de producao.
- O MySQL nao publica porta externamente por padrao; a aplicacao acessa o banco por DNS interno `mysql:3306`.
- O `web` sobe pelo `server.js` gerado em `.next/standalone`, que eh o modo recomendado para producao com `output: "standalone"`.
- `web` e `worker` usam `no-new-privileges` e `cap_drop: [ALL]` para reduzir a superficie do container.

### Pre-flight de producao

Antes do primeiro `up`, valide:

- `JWT_SECRET` com 32+ caracteres.
- `INTERNAL_API_KEY` com 24+ caracteres.
- `COOKIE_SECURE=true` em ambiente HTTPS.
- `DATABASE_URL` apontando para `mysql:3306` dentro do Compose atual.
- `APP_URL` apontando para a URL publica real da aplicacao.
- `NEXT_PUBLIC_APP_URL` alinhada com a URL publica quando o frontend precisar refletir esse host.
- `TRUST_PROXY_HEADERS=true` apenas se houver reverse proxy confiavel encaminhando e sanitizando `X-Forwarded-*`.
- `APP_BASE_URL=http://web:3000` para o worker.
- `SEED_SUPERADMIN_ON_STARTUP=false` em producao normal; execute o seed apenas de forma controlada.
- `PASSWORD_RESET_BASE_URL` se os links de email precisarem usar um host diferente do `APP_URL`.
- credenciais SMTP preenchidas se a recuperacao de senha por email estiver habilitada.
- Credenciais GDMS preenchidas se a integracao estiver habilitada.
- Politica de backup do volume `mysql_data`.
- Healthchecks do Compose devem continuar apontando para os nomes de servico/container, nao para `localhost`.

### Subida inicial

```bash
docker compose up -d --build
```

### Validacao do stack

```bash
docker compose ps
docker compose logs -f mysql
docker compose logs -f web
docker compose logs -f worker
curl http://localhost:3200/api/health
```

Se precisar administrar o MySQL sem publicar a porta no host, prefira:

```bash
docker compose exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD"
```

O fluxo de startup real do `web` eh:

1. executa [`scripts/init-db.mjs`](./scripts/init-db.mjs);
2. se `SEED_SUPERADMIN_ON_STARTUP=true` e `SUPERADMIN_*` estiver configurado, executa [`scripts/seed-superadmin.mjs`](./scripts/seed-superadmin.mjs);
3. sobe o servidor Next.js em modo producao;
4. o `worker` aguarda `web` saudavel e passa a chamar `POST /api/integrations/gdms/sync`.

### Primeira carga do inventario GDMS

Por padrao, o worker roda com:

```ini
SYNC_PATH=/api/integrations/gdms/sync?mode=status
```

Isso significa que ele **atualiza somente APs ja existentes no banco**. Em ambiente novo, faca uma carga completa inicial:

Pela interface:

- acesse `/settings` com `ADMIN` ou `SUPERADMIN`;
- clique em `Sincronizar GDMS`.

Por terminal:

```bash
curl -X POST http://localhost:3200/api/integrations/gdms/sync \
  -H "x-internal-api-key: SUA_CHAVE_INTERNA"
```

### Operacao recorrente

Comandos uteis para manutencao:

```bash
docker compose up -d --build web worker
docker compose restart worker
docker compose exec web npm run db:init
docker compose exec mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW DATABASES;"'
```

### Backup rapido do banco

```bash
docker compose exec mysql sh -lc 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > backup.sql
```

## Operacao e Observabilidade

| Recurso | Endpoint ou comando | Objetivo |
| --- | --- | --- |
| Health do backend | `GET /api/health` | Verifica conectividade do `web` com MySQL |
| Teste GDMS | `GET /api/integrations/gdms/ping` | Confirma acesso ao inventario remoto |
| Estado do token GDMS | `GET /api/integrations/gdms/token` | Mostra existencia e expiracao do token persistido |
| Refresh manual do token | `POST /api/integrations/gdms/token` | Forca novo token OAuth |
| Sync full manual | `POST /api/integrations/gdms/sync` | Reconcilia inventario, status e coordenadas faltantes |
| Sync status-only | `POST /api/integrations/gdms/sync?mode=status` | Atualiza somente status dos APs ja conhecidos |
| Logs do worker | `docker compose logs -f worker` | Diagnostica ciclos de sincronizacao |
| Logs da web | `docker compose logs -f web` | Diagnostica autenticacao, DB, SSE e APIs |
| Eventos em tempo real | `GET /api/events` | Stream SSE autenticado para UI |

## Endpoints Principais

### Autenticacao

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/register`
- `POST /api/auth/register`

### Antennas e historico

- `GET /api/antennas`
- `POST /api/antennas`
- `GET /api/antennas/[id]`
- `PATCH /api/antennas/[id]`
- `DELETE /api/antennas/[id]`
- `PATCH /api/antennas/[id]/coords`
- `GET /api/antennas/networks`
- `GET /api/history/[id]`

### Estatisticas e tempo real

- `GET /api/stats`
- `GET /api/stats/network-clients`
- `GET /api/events`

### Integracao GDMS

- `GET /api/integrations/gdms/ping`
- `GET /api/integrations/gdms/token`
- `POST /api/integrations/gdms/token`
- `POST /api/integrations/gdms/sync`

### Administracao

- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/[id]`
- `DELETE /api/users/[id]`

## Scripts Disponiveis

| Script | Efeito |
| --- | --- |
| `npm run dev` | Sobe a aplicacao em modo desenvolvimento |
| `npm run build` | Gera build de producao |
| `npm run start` | Inicia o servidor Next.js em producao |
| `npm run lint` | Executa ESLint |
| `npm run db:init` | Aplica [`db/schema.sql`](./db/schema.sql) no banco |
| `npm run db:seed` | Garante a existencia/promocao do superadmin |
| `node scripts/seed-local.mjs` | Seed auxiliar de desenvolvimento |
| `node scripts/gdms-cron.mjs` | Worker de sincronizacao manual, fora do Compose |

### Estado atual da automacao de testes

O `package.json` declara `npm run test` e `npm run test:e2e`, mas a base atual nao expoe suites de teste ou arquivos de configuracao versionados correspondentes. Trate esses scripts como placeholders ate que a estrategia de testes seja versionada no repositorio.

## Troubleshooting

### `web` nao fica healthy

Sintomas comuns:

- `/api/health` retorna `503`;
- o container `web` reinicia ou fica preso no startup;
- logs mostram falha de conexao com MySQL.

Checklist:

- confirme `DATABASE_URL` com host `mysql` e porta `3306` dentro do Compose;
- valide se `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` e `DATABASE_URL` estao coerentes;
- acompanhe `docker compose logs -f mysql`;
- se a falha comecou apos mexer no schema ou no bootstrap, reconstrua a imagem `web`;
- reexecute o schema:

```bash
docker compose exec web npm run db:init
```

### `ORIGIN_REQUIRED`, `ORIGIN_MISMATCH` ou `CSRF_INVALID`

Esses erros sao esperados quando a mutacao nao respeita a politica de origem/cookie:

- acesse a aplicacao pelo mesmo host/origem usado pelo browser;
- atras de reverse proxy, encaminhe `X-Forwarded-Host` e `X-Forwarded-Proto`;
- configure `APP_URL` ou `NEXT_PUBLIC_APP_URL` se houver dominio publico;
- chamadas `POST`, `PATCH` e `DELETE` com cookie exigem `x-csrf-token`; a UI ja faz isso via [`services/api.ts`](./services/api.ts).

### Clique em `Esqueceu a senha?` nao faz nada

Sintoma comum:

- o usuario clica no link do login, mas continua na mesma tela.

Checklist:

- confirme se `/forgot-password` e `/reset-password` continuam definidos como rotas publicas no [`middleware.ts`](./middleware.ts);
- se acabou de publicar ajuste de middleware, faca `docker compose up -d --build web`;
- force refresh do navegador para descartar assets antigos.

### Email de recuperacao chega com `0.0.0.0`, nome do container ou host interno

O link de reset precisa usar uma URL publica/acessivel pelo navegador. O nome do servico `web` dentro da rede Docker nao serve para o usuario final fora da infraestrutura.

Checklist:

- configure `APP_URL` com o host real da aplicacao, por exemplo `http://localhost:3200` em ambiente local ou `https://app.seu-dominio.com` em producao;
- use `PASSWORD_RESET_BASE_URL` apenas se o host do email precisar ser diferente do `APP_URL`;
- nao use `APP_BASE_URL=http://web:3000` como base de link em email; essa URL existe apenas para trafego interno do worker.

### `docker compose up` falha ao publicar a porta do `web`

Sintoma comum no Windows:

- erro de bind ao expor `0.0.0.0:3001`.

Checklist:

- verifique se a porta escolhida nao esta em faixa reservada do Windows;
- no stack atual o valor recomendado eh `HOST_PORT=3200`;
- valide portas em uso/reservadas antes de insistir no mesmo host port.

### Worker nao cria APs novos

Isso nao eh bug se o worker estiver usando o padrao atual:

```ini
SYNC_PATH=/api/integrations/gdms/sync?mode=status
```

Nesse modo ele apenas atualiza status de APs ja existentes. Solucao:

- execute uma sincronizacao completa inicial em `/settings`; ou
- chame manualmente `POST /api/integrations/gdms/sync` sem `mode=status`.

### `GDMS /oapi/... failed` ou `retCode != 0`

Quando a falha vem do cliente GDMS, ela normalmente aponta para autenticacao, assinatura ou rejeicao do endpoint remoto.

Checklist:

- confirme `GDMS_CLIENT_ID`, `GDMS_CLIENT_SECRET`, `GDMS_BASE` e `GDMS_OAUTH_URL`;
- em producao, valide se `GDMS_BASE` e `GDMS_OAUTH_URL` estao em HTTPS;
- confira hora/data do host ou container, porque a assinatura usa `timestamp`;
- rode `GET /api/integrations/gdms/token` para verificar se existe token valido;
- se necessario, force `POST /api/integrations/gdms/token`;
- execute `GET /api/integrations/gdms/ping` para separar falha de token de falha no sync;
- acompanhe `docker compose logs -f web`.

### Worker responde `401`, `403` ou nao alcanza o `web`

O worker nao deve usar `localhost` para falar com a API interna dentro do Docker.

Checklist:

- mantenha `APP_BASE_URL=http://web:3000` no Compose atual;
- nao aponte `APP_BASE_URL` para `http://localhost:3200` dentro do container;
- valide se `INTERNAL_API_KEY` esta identica em `web` e `worker`;
- confirme se o `web` ja ficou healthy antes de analisar os logs do worker;
- verifique se `SYNC_PATH` continua coerente com o modo desejado (`full` ou `status`).

### Dashboard local funciona, mas clientes por rede falham

`GET /api/stats` depende do banco local. Ja `GET /api/stats/network-clients` depende do GDMS.

Valide:

- `GDMS_CLIENT_ID` e `GDMS_CLIENT_SECRET`;
- `GDMS_OAUTH_URL` e `GDMS_BASE`;
- `GET /api/integrations/gdms/ping`;
- `GET /api/integrations/gdms/token`.

### Mapa abre, mas nao ha APs visiveis

A home carrega:

```http
GET /api/antennas?placed=1&take=5000
```

Logo, APs com `lat=0` e `lon=0` ficam fora do mapa. Se o GDMS nao devolver coordenadas validas:

- finalize a geolocalizacao em `/settings`;
- confirme se a importacao completa trouxe `lat/lng`;
- lembre que APs recem-criados manualmente nascem com status `DOWN`.

### Toast de AP offline/online nao aparece

Essas notificacoes dependem de stream SSE autenticado e do evento `status.changed`.

Checklist:

- confirme que o usuario esta em uma rota do shell autenticado, onde [`components/LayoutShell.tsx`](./components/LayoutShell.tsx) monta [`components/AntennaStatusNotifications.tsx`](./components/AntennaStatusNotifications.tsx);
- verifique se `GET /api/events` esta conectando sem erro no navegador;
- lembre que `antenna.created` nao gera esse toast; o componente reage apenas a `status.changed`;
- em `mode=status`, o AP precisa ja existir no banco para haver transicao observavel;
- se houver reverse proxy, evite buffering agressivo e timeout curto na rota SSE.

### Sessao nao persiste em HTTPS ou proxy

- mantenha `COOKIE_SECURE=true` em producao HTTPS;
- se o TLS termina no proxy, garanta encaminhamento correto de host/protocolo;
- configure `APP_URL` ou `NEXT_PUBLIC_APP_URL` para alinhar a validacao de origem;
- nao teste cookie seguro em `http://localhost` com configuracao de producao.

### Token GDMS nao renova

Se `POST /api/integrations/gdms/token` falhar:

- confira se `GDMS_OAUTH_URL` usa HTTPS em producao;
- valide client ID/secret;
- cheque a tabela `gdms_token`;
- acompanhe os logs do `web`, porque a renovacao passa pelo backend.

## Licenca

Este projeto utiliza a licenca MIT. Consulte [`LICENSE`](./LICENSE).
