<p align="center">
  <img src="./public/logo_etherium.png" alt="Etheriumtech" width="170" />
</p>

<h1 align="center">Stats A.P</h1>

<p align="center">
  Monitoramento operacional dos APs Grandstream da Etheriumtech: mapa georreferenciado com posição vinda do GWN,
  dashboard, clientes conectados por rede, ocorrências de queda com trilha de auditoria, alertas por e-mail,
  conta do usuário com foto de perfil e atualização em tempo real via SSE.
</p>

<p align="center">
  <img alt="Versão" src="https://img.shields.io/badge/vers%C3%A3o-1.2.0-0F766E" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white" />
  <img alt="MySQL" src="https://img.shields.io/badge/MySQL-8.4-4479A1?logo=mysql&logoColor=white" />
  <img alt="MinIO" src="https://img.shields.io/badge/MinIO-S3-C72E49?logo=minio&logoColor=white" />
  <img alt="Docker" src="https://img.shields.io/badge/Docker_Compose-Deploy-2496ED?logo=docker&logoColor=white" />
  <img alt="Vitest" src="https://img.shields.io/badge/Vitest-201_testes-6E9F18?logo=vitest&logoColor=white" />
</p>

## Sumário

- [Visão geral](#visão-geral)
- [Novidades da v1.2](#novidades-da-v12)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Integração GWN/GDMS](#integração-gwngdms)
- [Ocorrências e alertas](#ocorrências-e-alertas)
- [Convite de usuários](#convite-de-usuários)
- [Minha Conta](#minha-conta)
- [Autenticação, sessão e papéis](#autenticação-sessão-e-papéis)
- [Segurança](#segurança)
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
- **Central de notificações** (sino na barra superior) e avisos em tempo real de AP offline/online.
- **Configurações**: fila de APs que ainda não têm posição no GWN e botão "Sincronizar GDMS".
- **Administração**: convite de usuários por e-mail, papéis `USER`/`ADMIN`/`SUPERADMIN`, bloqueio, suspensão e exclusão.
- **Minha Conta**: cada usuário edita nome, cargo, telefone, e-mail de acesso, senha e foto de perfil.
- **Worker** que sincroniza status e posição com o GWN a cada 5 minutos.

## Novidades da v1.2

Resumo; o detalhe está no [CHANGELOG](./CHANGELOG.md).

**Funcionalidades**

- Latitude e longitude dos APs vêm do GWN no sync (manual e automático). O GWN sempre vence quando informa posição; a digitação manual fica só para APs sem localização no GWN.
- `/clients` e o Dashboard contam os clientes pela lista de clientes conectados do GWN (`client/list`), em vez de somar o contador de cada AP, que inflava o total.
- Ocorrências de AP offline com estados, ações, auditoria só de inserção, e-mail-resumo e central de notificações.
- Convite de usuário por e-mail com link de uso único, no lugar do cadastro direto pelo administrador.
- Minha Conta: dados pessoais, troca de e-mail e de senha e foto de perfil guardada no MinIO.
- Controle de rotação do mapa reescrito (bússola alinhada ao norte, arraste relativo, botões e teclado).
- Sidebar retrátil com a preferência salva, gaveta própria no celular, identidade visual com símbolo e nome, e versão exibida na interface.
- Telas de login, senha e convite com visual fixo, sempre escuro, sem herdar o tema escolhido no app.
- Revisão de acentuação e pontuação em toda a interface.

**Segurança e infraestrutura**

- Sessão revalidada no banco a cada requisição; trocar ou redefinir a senha encerra as sessões abertas em outros dispositivos.
- Bootstrap do usuário padrão: num banco sem nenhum SUPERADMIN, o startup cria o superadmin do `.env`; num banco existente, não mexe em nada.
- Links de e-mail montados só a partir de `APP_URL`; e-mail do superadmin reservado; dependências compatíveis atualizadas.
- Serviços e containers nomeados serviço + projeto, nenhuma porta padrão e toda a configuração no `.env`.
- Testes automatizados com Vitest.

## Stack

| Camada | Implementação | Papel no sistema |
| --- | --- | --- |
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS 3, Zustand | Shell autenticado, mapa, dashboard, ocorrências, formulários |
| Mapa | `maplibre-gl` 5 com tiles ArcGIS e alternativa OpenStreetMap | Visualização geográfica e controle de rotação |
| Backend | Route Handlers em `app/api/*` | API interna, autenticação, papéis, integrações e healthcheck |
| Segurança | `jose`, `bcryptjs`, `zod`, middleware próprio | JWT em cookie, CSRF, validação de origem, limite de requisições |
| E-mail | `nodemailer` com SMTP autenticado | Redefinição de senha, convites, aviso de troca de e-mail e alertas |
| Banco | MySQL 8.4 com `mysql2/promise` e SQL parametrizado | Persistência sem ORM; schema em [`db/schema.sql`](./db/schema.sql) |
| Armazenamento | MinIO (compatível com S3), cliente `minio` | Fotos de perfil, em bucket privado |
| Integração | GWN/GDMS OpenAPI (OAuth client credentials + requisições assinadas) | Redes, APs, status, posição e clientes |
| Tempo real | Server-Sent Events em `/api/events` | Atualização da interface, avisos e notificações |
| Testes | Vitest 2 | Testes unitários em `tests/unit/` |
| Infra | Docker multi-stage + Docker Compose | `mysql-statsap`, `minio-statsap`, `web-statsap` e `worker-statsap` |

## Arquitetura

```mermaid
flowchart LR
  subgraph Browser["Navegador"]
    UI["Páginas App Router<br/>Mapa, Dashboard, Clientes, Ocorrências,<br/>Filtros, Configurações, Minha Conta, Administração"]
    FE["services/api.ts + services/sseClient.ts<br/>(uma EventSource por aba)"]
  end

  Proxy["Proxy reverso (HTTPS)<br/>rede PROXY_NETWORK"]

  subgraph AppNet["Rede interna app_net"]
    subgraph Web["web-statsap · PORT"]
      MW["middleware.ts<br/>proteção de páginas + headers + papéis"]
      API["Route Handlers em app/api/*"]
      CORE["lib/*<br/>auth, gdmsSync, incidents, invites, account, storage, sse"]
    end
    Worker["worker-statsap<br/>scripts/gdms-cron.mjs"]
    DB[("mysql-statsap · MYSQL_PORT<br/>Antenna, StatusHistory, Incident, IncidentEvent,<br/>User, UserInvite, PasswordResetToken, gdms_token")]
    S3[("minio-statsap · MINIO_PORT<br/>fotos de perfil (bucket privado)")]
  end

  subgraph External["Serviços externos"]
    GDMS["GWN/GDMS Cloud<br/>OAuth + /oapi"]
    SMTP["SMTP"]
  end

  UI --> FE
  FE --> Proxy
  Proxy -->|"WEB_PROXY_ALIAS:PORT"| MW
  MW --> API
  API --> CORE
  CORE --> DB
  CORE --> S3
  CORE --> GDMS
  CORE --> SMTP
  Worker -->|"APP_BASE_URL + x-internal-api-key"| API
  API -->|SSE| FE
```

Princípios:

- O navegador nunca chama o GWN nem o MinIO; toda comunicação externa sai do `web-statsap`.
- Só o `web-statsap` fica na rede do proxy. `mysql-statsap`, `minio-statsap` e `worker-statsap` ficam apenas na rede interna `app_net`, sem porta publicada.
- O `worker-statsap` não tem cliente GDMS próprio: ele chama a rota interna de sync, que aplica a mesma regra de negócio do botão da interface.
- `middleware.ts` protege as páginas privadas e bloqueia por papel; as rotas `/api/*` se protegem com `requireRequestAuth(...)` ou `requireRequestAuthOrInternal(...)`.
- O `web-statsap` aplica o schema e as migrações no startup e cria o usuário padrão se o banco não tiver nenhum SUPERADMIN ([`scripts/docker-entrypoint.sh`](./scripts/docker-entrypoint.sh) → [`scripts/init-db.mjs`](./scripts/init-db.mjs) e [`scripts/bootstrap-superadmin.mjs`](./scripts/bootstrap-superadmin.mjs)).
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
| Clientes por rede | [`app/api/stats/network-clients/route.ts`](./app/api/stats/network-clients/route.ts) | Contagem via `client/list` com cache |
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
| `status` | `POST /api/integrations/gdms/sync?mode=status` | não | sim | sim | não | Padrão do worker, a cada `SYNC_INTERVAL_MS` |

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
- Depois de vencido, o último valor (com até 10 minutos) é devolvido na hora enquanto a atualização roda em segundo plano, para a tela não esperar a consulta completa ao GWN.
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
- **Precisão:** o horário da queda é o momento em que o sync a detectou (até um intervalo do worker depois).

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
- O aviso "AP offline" traz o link "Ver ocorrência".
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
  SMTP-->>C: Link APP_URL/accept-invite?token=...
  C->>P: Abre o link (GET /api/auth/invite valida o token)
  C->>P: Nome + senha
  P->>DB: POST /api/auth/accept-invite (SELECT … FOR UPDATE, cria User, marca acceptedAt)
  P-->>C: Cookies de sessão e acesso liberado
```

- Token aleatório de 32 bytes; o banco guarda só o SHA-256. Uso único, validade de `INVITE_TOKEN_HOURS`.
- `409 EMAIL_TAKEN` se já existir usuário com o e-mail; convidar de novo o mesmo e-mail revoga o convite anterior.
- Na Administração, a tabela "Convites pendentes" mostra e-mail, papel, quem convidou e a validade, com as ações **Reenviar** (gera token novo e renova a validade) e **Revogar**.
- Limites: 20 convites/reenvios por hora; validação e aceite do link têm limite por IP.
- A senha segue a política forte: no mínimo 12 caracteres, com letra minúscula, maiúscula, número e símbolo.
- O link sai só da URL pública configurada em `APP_URL` (ou `NEXT_PUBLIC_APP_URL`), em [`lib/publicUrl.ts`](./lib/publicUrl.ts).

## Minha Conta

Tela `/account`, disponível para todos os papéis. Abre pelo card "Bem-vindo" da sidebar (foto ou iniciais + nome) ou pelo item **Minha Conta** do menu.

| Bloco | O que faz | Regras |
| --- | --- | --- |
| Foto de perfil | Enviar, trocar ou remover | PNG, JPEG ou WebP. O navegador recorta o centro e reduz para 256×256 (WebP) antes do envio; o servidor aceita até 512 KB e confere o tipo pelo conteúdo do arquivo (SVG é recusado) |
| Dados pessoais | Nome, cargo e telefone | Nome de 2 a 80 caracteres; cargo até 100; telefone com 8 a 15 dígitos (DDD e DDI opcionais) |
| E-mail de acesso | Troca o e-mail do login | Pede a senha atual; `409 EMAIL_TAKEN` se o e-mail já pertence a outra conta; o endereço antigo recebe um aviso |
| Senha | Troca a senha | Pede a senha atual e segue a política forte; encerra as sessões abertas em outros dispositivos |

- **Onde aparece:** a foto e o nome no card "Bem-vindo" da sidebar; cargo e telefone na lista de usuários da Administração.
- **Armazenamento da foto:** bucket privado `MINIO_BUCKET` do `minio-statsap`, criado pela aplicação no primeiro uso. A chave é `avatars/<id do usuário>/<aleatório>.<ext>`, gerada no servidor; cada foto nova ganha uma chave nova e a anterior é apagada. Excluir um usuário apaga a foto dele.
- **Entrega da foto:** sempre por `GET /api/account/avatar` (só a foto do próprio usuário), com `nosniff` e cache privado.
- **Senha atual errada** responde `400 INVALID_PASSWORD` (e não `401`, que no cliente significa sessão encerrada).
- **Limites:** 5 trocas de e-mail e 5 de senha a cada 15 minutos por usuário; 20 envios de foto por hora.
- **MinIO fora do ar:** o envio de foto responde `503 STORAGE_UNAVAILABLE` e a sidebar mostra as iniciais; o resto da aplicação não é afetado, e o `web-statsap` sobe mesmo sem o MinIO.

## Autenticação, sessão e papéis

### Login e cookies

- `POST /api/auth/login` valida origem, limite de requisições e payload, confere a senha com bcrypt e devolve os cookies `auth` (JWT, `HttpOnly`, `SameSite=Strict`) e `csrf`.
- Mutações com cookie (`POST`, `PATCH`, `DELETE`) exigem o header `x-csrf-token` igual ao cookie `csrf` e origem confiável; o helper [`services/api.ts`](./services/api.ts) já envia.
- Recuperação de senha: `/forgot-password` envia um link temporário (`PASSWORD_RESET_TOKEN_MINUTES`) e `/reset-password` grava a nova senha e consome o token. A resposta do "esqueci a senha" é sempre a mesma, exista ou não o e-mail.

### Sessão revalidada no banco

- O middleware (edge) só confere a assinatura do JWT ([`lib/jwt.ts`](./lib/jwt.ts)). As rotas de API ([`lib/auth.ts`](./lib/auth.ts)) consultam o usuário no banco a cada requisição.
- Usuário excluído, bloqueado ou suspenso recebe `401 SESSION_REVOKED`, e essa resposta apaga os cookies para o navegador não ficar em laço entre `/login` e `/`.
- Trocar ou redefinir a senha grava `User.passwordChangedAt`; tokens emitidos antes desse momento recebem `401 SESSION_REVOKED` ([`lib/sessionRules.ts`](./lib/sessionRules.ts)). A sessão que fez a troca recebe um cookie novo.
- O papel usado na autorização vem do banco, não do token: uma mudança de papel vale na próxima requisição.
- No cliente, qualquer `401` leva o usuário para `/login`.

### Papéis

| Papel | Acesso |
| --- | --- |
| `USER` | Mapa, Dashboard, Clientes, Ocorrências (leitura), Filtros (leitura) e Minha Conta |
| `ADMIN` | Tudo do USER + ações em ocorrências, Configurações, sync GDMS, criação/edição de APs, alertas por e-mail |
| `SUPERADMIN` | Tudo do ADMIN + Administração (usuários e convites) |

## Segurança

### Aplicação

| Controle | Como funciona |
| --- | --- |
| Senhas | bcrypt (custo 12) e política forte (12+ caracteres com minúscula, maiúscula, número e símbolo) |
| Tokens de convite e de redefinição | 32 bytes aleatórios; o banco guarda só o SHA-256; uso único e com validade |
| Sessão | JWT HS256 em cookie `HttpOnly` e `SameSite=Strict`, revalidado no banco a cada requisição; troca de senha encerra as outras sessões |
| CSRF e origem | Cookie `csrf` + header `x-csrf-token` e verificação de `Origin`/`Referer` em toda mutação |
| Limite de requisições | Por IP e por usuário em login, recuperação de senha, convites, sync, conta e foto |
| Links de e-mail | Montados só a partir de `APP_URL`, nunca dos cabeçalhos da requisição (evita que alguém faça o e-mail de redefinição da vítima apontar para outro site) |
| E-mail reservado | Só um SUPERADMIN pode assumir o endereço de `SUPERADMIN_EMAIL` (em Minha Conta ou no autocadastro) |
| Banco | SQL sempre parametrizado; o que é interpolado é constante do código ou número limitado |
| E-mails | Todo texto escapado no HTML |
| Foto de perfil | Tipo conferido pelo conteúdo do arquivo (SVG recusado), até 512 KB, entregue com `nosniff` e CSP restritiva, só para o próprio usuário |
| Erros | A mensagem do banco fica só no log; o cliente recebe um código |

### Infraestrutura

- Serviços e containers nomeados serviço + projeto. O `web-statsap` fica na rede do proxy, compartilhada com outros projetos, onde um nome genérico poderia ser resolvido para o container de outro projeto.
- Nenhum serviço usa a porta padrão do seu software; as portas vêm de `PORT`, `MYSQL_PORT` e `MINIO_PORT`. O protocolo X do MySQL e o console web do MinIO ficam desligados.
- Banco, MinIO e worker sem porta publicada; só o `web-statsap` é publicado (`HOST_PORT`) e fica na rede do proxy.
- `web-statsap`, `worker-statsap` e `minio-statsap` rodam com `no-new-privileges` e `cap_drop: [ALL]`; a imagem da aplicação roda como usuário `node`.
- Healthchecks sem senha na linha de comando; o MinIO não sobe sem credenciais próprias (`MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`).
- O `.env` não é versionado nem entra na imagem (`.dockerignore`).

### Configuração recomendada em produção

- O usuário padrão é criado pelo bootstrap só quando o banco não tem nenhum SUPERADMIN; ele nunca regrava senha, promove conta ou recria quem já existe.
- `SEED_SUPERADMIN_ON_STARTUP=false`, `SUPERADMIN_PROMOTE_IF_EXISTS=false` e `SUPERADMIN_SYNC_PASSWORD_IF_EXISTS=false` depois do primeiro bootstrap.
- `TRUST_PROXY_HEADERS=true` só atrás de proxy que sobrescreva `X-Forwarded-For`/`X-Real-IP`.
- Se o proxy alcança o `web-statsap` pela rede do proxy, avalie remover a publicação de porta (`ports`): com ela, o app também responde direto no host, sem TLS.

### Pendências conhecidas

- `next` 14, `maplibre-gl` 5 e `nodemailer` 8 têm avisos de segurança que só se resolvem trocando de versão maior. Confira com `npm audit --omit=dev`.

## Tempo real (SSE)

`GET /api/events` abre um stream autenticado. Cada aba mantém **uma única** `EventSource`, compartilhada por todos os componentes ([`services/sseClient.ts`](./services/sseClient.ts)); no servidor, o registro de conexões fica em `globalThis` ([`lib/sse.ts`](./lib/sse.ts)).

| Evento | Quando | Quem reage |
| --- | --- | --- |
| `connected`, `ping` | Abertura e keep-alive | — |
| `status.changed` | AP muda entre `UP` e `DOWN` (sync ou manual) | Avisos, Dashboard, filtros |
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
| Minha Conta | `/account` | Foto, dados pessoais, e-mail de acesso e senha do próprio usuário | Autenticado |
| Administração | `/admin` | Usuários, convites, bloqueio, suspensão e exclusão | SUPERADMIN |

## Interface

### Sidebar retrátil

- No desktop, o botão de seta na borda da sidebar recolhe para uma faixa de ícones (`w-20`) e expande de volta (`w-72`). A escolha fica salva no navegador (`localStorage`, chave `sidebarCollapsed`) e é restaurada na próxima visita ([`lib/sidebarPreference.ts`](./lib/sidebarPreference.ts), [`store/ui.ts`](./store/ui.ts)).
- No celular, a sidebar vira uma gaveta sobreposta: abre pelo botão ☰ da barra superior e fecha pelo X, pelo fundo escurecido, pela tecla Esc ou ao trocar de página.
- O card "Bem-vindo" mostra a foto de perfil (ou as iniciais) e leva para Minha Conta ([`components/UserAvatar.tsx`](./components/UserAvatar.tsx), [`store/profile.ts`](./store/profile.ts)).
- Os botões têm `aria-label`, `aria-expanded` e `aria-controls`.

### Identidade e versão

- [`components/BrandMark.tsx`](./components/BrandMark.tsx) mostra o símbolo da Etheriumtech com o nome "Stats A.P"; com a sidebar recolhida, só o símbolo.
- A versão exibida na sidebar e no rodapé vem do `package.json` (ver [Versionamento](#versionamento)).
- O ícone da aba é [`app/icon.png`](./app/icon.png), gerado a partir do símbolo.
- O rodapé traz contato, canais e o bloco "Powered by":

| Nome | Papel | LinkedIn |
| --- | --- | --- |
| Jeferson Oliveira | Network Engineer | `https://www.linkedin.com/in/jeferson-rocha-1b494b1b5` |
| Marcos Ribeiro | Software Engineer | `https://linkedin.com/in/marcos-ribeiro-de-sousa-782b7782` |
| Mickael Lelis | DevOps/SRE | `https://linkedin.com/in/mickael-l-079743133` |

### Tema

- O botão da barra superior alterna entre claro e escuro. A preferência fica em [`store/theme.ts`](./store/theme.ts), é aplicada antes da pintura por [`components/ThemeScript.tsx`](./components/ThemeScript.tsx) e reaplicada a cada troca de tela por [`components/ThemeSync.tsx`](./components/ThemeSync.tsx).
- As telas de login, de senha e de convite têm visual fixo, sempre escuro, com as partículas neon: o tema escolhido no app não vale para elas, nem ao sair do app pelo botão "Sair" ([`lib/themeScope.ts`](./lib/themeScope.ts)). As partículas do fundo também não mudam.

### Rotação do mapa

[`components/map/RotationControl.tsx`](./components/map/RotationControl.tsx), com as contas em [`lib/mapRotation.ts`](./lib/mapRotation.ts):

- o "N" do anel aponta sempre para o norte real do mapa;
- arraste relativo, sem salto ao tocar: o mapa gira no mesmo sentido do dedo ou do mouse;
- botões "Norte", "Girar 45° à esquerda" e "Girar 45° à direita";
- teclado: setas giram 15° e `Home` volta ao norte; toques seguidos se somam (duas setas giram 30°);
- "Cidade" e "Pinos" preservam a rotação ao enquadrar o mapa;
- no celular, o painel de filtros começa fechado e os botões do topo mostram só o ícone.

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
    string phone
    string jobTitle
    string avatarKey
    datetime passwordChangedAt
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
- `User.avatarKey` guarda só a chave do objeto no MinIO; a imagem não fica no banco. `User.passwordChangedAt` é o corte das sessões na troca de senha.
- Todas as mudanças da v1.2 são aditivas (`CREATE TABLE IF NOT EXISTS` e colunas novas verificadas antes do `ALTER`) e aplicadas por `scripts/init-db.mjs` no startup.

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
|   |-- icon.png
|   |-- layout.tsx
|   |-- loading.tsx
|   |-- (app)
|   |   |-- layout.tsx
|   |   |-- page.tsx                      # Mapa
|   |   |-- account/page.tsx              # Minha Conta
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
|       |-- account/{route.ts, avatar/route.ts, email/route.ts, password/route.ts}
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
|   |-- UserAvatar.tsx
|   |-- incidents/IncidentDetailPanel.tsx
|   `-- map/RotationControl.tsx
|-- db/schema.sql
|-- docs/superpowers/{specs,plans}/      # Desenho e plano originais da v1.2 (registro histórico)
|-- lib
|   |-- auth.ts / jwt.ts / roles.ts / sessionRules.ts / requestSecurity.ts / rateLimit.ts
|   |-- account.ts / accountValidators.ts / accountMessages.ts
|   |-- avatarKey.ts / avatarCrop.ts / avatarImage.ts / imageType.ts / storage.ts / storageConfig.ts
|   |-- gdmsToken.ts / gdmsNormalize.ts / gdmsSyncPlan.ts / gdmsSync.ts
|   |-- statusChanges.ts / incidentRules.ts / incidents.ts / incidentAlerts.ts / incidentFormat.ts
|   |-- invites.ts / inviteToken.ts / passwordReset.ts / publicUrl.ts
|   |-- email.ts / emailTemplates.ts
|   |-- mysql.ts / dbErrors.ts / dbMappers.ts
|   |-- sse.ts / ttlCache.ts / dateFormat.ts / csv.ts
|   |-- mapRotation.ts / sidebarPreference.ts / themeScope.ts / version.ts
|   `-- userStatus.ts / validators.ts / validatorsAuth.ts
|-- public/{icons.svg, logo_etherium.png}
|-- scripts
|   |-- bootstrap-rules.mjs / bootstrap-superadmin.mjs   # usuário padrão no primeiro startup
|   |-- dev.mjs                           # npm run dev na porta de PORT
|   |-- docker-entrypoint.sh
|   |-- gdms-cron.mjs                     # worker
|   |-- init-db.mjs / mysql-utils.mjs
|   `-- seed-local.mjs / seed-superadmin.mjs
|-- services/{api.ts, gdms.ts, sseClient.ts}
|-- store/{profile.ts, theme.ts, ui.ts}
|-- styles/globals.css
`-- tests
    |-- stubs/server-only.ts
    `-- unit/*.test.ts                    # 30 arquivos
```

</details>

| Diretório | Responsabilidade |
| --- | --- |
| `app/` | Páginas, layouts e Route Handlers do App Router |
| `components/` | Componentes de interface |
| `lib/` | Regras de negócio, segurança, banco, e-mail, armazenamento, SSE e funções puras testáveis |
| `services/` | Cliente HTTP do navegador, cliente SSE e cliente GDMS |
| `scripts/` | Desenvolvimento, bootstrap do banco, seed, worker e entrypoint do container |
| `db/` | Schema SQL versionado |
| `store/` | Estado global de interface, tema e perfil (Zustand) |
| `tests/` | Testes unitários (Vitest) |
| `docs/` | Especificação e plano originais da v1.2 |

## Variáveis de ambiente

Toda a configuração vem do `.env`: o `docker-compose.yml` só referencia variáveis, sem valores fixos nem padrões. Use [`env.example`](./env.example) como base e confira com `docker compose config`, que avisa sobre variável ausente.

### Aplicação

| Variável | Exemplo | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | `Etherium Antennas` | Argumento de build da imagem |
| `NODE_ENV` | `production` | Ativa as políticas de produção; em produção o cookie é sempre `Secure` |
| `NEXT_TELEMETRY_DISABLED` | `1` | Desliga a telemetria do Next.js |
| `HOST` / `PORT` | `0.0.0.0` / `38410` | Endereço de escuta e porta do web dentro do container (porta não padrão); obrigatórias |
| `HOST_PORT` | `3200` | Porta publicada no host para o web |
| `APP_URL` | `https://statsap.example.com` | URL pública: validação de origem e base obrigatória dos links de e-mail |
| `NEXT_PUBLIC_APP_URL` | igual a `APP_URL` | Alternativa a `APP_URL`; também vai para o build |
| `TRUST_PROXY_HEADERS` | `false` | `true` só atrás de proxy que sobrescreva `X-Forwarded-*` |
| `COOKIE_SECURE` | `true` | Fora de produção, define se o cookie é `Secure` |
| `ALLOW_SELF_REGISTER` | `false` | Habilita `/api/register` e `/api/auth/register` |
| `APP_IMAGE` | `monitoring_grandstream:latest` | Nome da imagem construída para `web-statsap` e `worker-statsap` |
| `PROXY_NETWORK` | `web` | Rede Docker externa do proxy reverso |
| `WEB_PROXY_ALIAS` | `monitoring-grandstream-web` | Nome pelo qual o proxy enxerga o `web-statsap` nessa rede |

### Banco (MySQL)

| Variável | Exemplo | Uso |
| --- | --- | --- |
| `MYSQL_IMAGE` | `mysql:8.4` | Imagem do `mysql-statsap` |
| `MYSQL_HOST` | `mysql-statsap` | Nome do serviço do banco; usado no healthcheck |
| `MYSQL_PORT` | `38420` | Porta do MySQL na rede interna (não padrão) |
| `MYSQL_DATABASE` / `MYSQL_USER` / `MYSQL_PASSWORD` | `monitoring_grandstream` / `monitoring_app` / … | Banco e usuário da aplicação |
| `MYSQL_ROOT_PASSWORD` | … | Senha de administração do MySQL |
| `MYSQL_CHARSET` / `MYSQL_COLLATION` | `utf8mb4` / `utf8mb4_unicode_ci` | Charset e collation do servidor |
| `DATABASE_URL` | `mysql://monitoring_app:...@mysql-statsap:38420/monitoring_grandstream` | Conexão da aplicação; host e porta obrigatórios |
| `MYSQL_POOL_SIZE` | `10` | Tamanho do pool (1 a 50) |

### Fotos de perfil (MinIO)

| Variável | Exemplo | Uso |
| --- | --- | --- |
| `MINIO_IMAGE` | `pgsty/minio:RELEASE.2026-08-04T00-00-00Z` | Imagem do `minio-statsap`. O repositório oficial `minio/minio` saiu do Docker Hub; o exemplo usa o fork comunitário `pgsty/minio` com a versão fixada |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | `statsap` / … | Credenciais do MinIO (senha com 8+ caracteres); o Compose não sobe sem elas |
| `MINIO_ENDPOINT` | `http://minio-statsap:38430` | Endereço interno usado pelo web e pelo healthcheck; sem ele, o envio de foto fica desligado |
| `MINIO_PORT` | `38430` | Porta da API do MinIO (não padrão); a mesma de `MINIO_ENDPOINT` |
| `MINIO_BROWSER` | `off` | Console web do MinIO desligado |
| `MINIO_BUCKET` | `statsap-avatars` | Bucket privado das fotos |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | — | Opcionais: credenciais próprias do app; sem elas, ele usa as de root |

### Sessão, e-mail, convites e alertas

| Variável | Exemplo | Uso |
| --- | --- | --- |
| `JWT_SECRET` | 32+ caracteres | Assina e verifica o JWT |
| `JWT_EXPIRES_DAYS` | `7` | Validade da sessão |
| `INTERNAL_API_KEY` | 24+ caracteres | Autentica as chamadas do worker |
| `PASSWORD_RESET_BASE_URL` | vazio | Sobrescreve a base do link **apenas** de redefinição de senha |
| `PASSWORD_RESET_TOKEN_MINUTES` | `60` | Validade do link de redefinição (15 a 1440 min) |
| `INVITE_TOKEN_HOURS` | `72` | Validade do convite (1 a 336 h) |
| `INCIDENT_ALERTS_ENABLED` | `true` | Liga o e-mail-resumo de APs offline/normalizados |
| `INCIDENT_ALERT_MIN_MINUTES` | `10` | Tempo offline mínimo antes do alerta (1 a 1440 min) |
| `EMAIL_DEFAULT_FROM` | `noreply@example.com` | Remetente |
| `EMAIL_TRANSPORT_DEFAULT_HOST` / `_PORT` | `smtp.example.com` / `587` | Servidor SMTP |
| `EMAIL_TRANSPORT_DEFAULT_USERNAME` / `_PASSWORD` | … | Credenciais SMTP (senha de app, no caso do Gmail) |
| `EMAIL_TRANSPORT_DEFAULT_TLS` | `true` | Exige TLS |

### GWN/GDMS e worker

| Variável | Exemplo | Uso |
| --- | --- | --- |
| `GDMS_BASE` / `GDMS_OAUTH_URL` | `https://www.gwn.cloud` / `https://www.gwn.cloud/oauth/token` | APIs e OAuth do GWN (HTTPS em produção) |
| `GDMS_CLIENT_ID` / `GDMS_CLIENT_SECRET` | … | Credenciais da OpenAPI do GWN |
| `GDMS_PAGE_SIZE` | `500` | Itens por página nas listagens |
| `GDMS_SHOW` | `all` | Filtro de APs enviado ao GWN |
| `APP_BASE_URL` | `http://web-statsap:38410` | Endereço **interno** do web: usado pelo worker e pelo healthcheck; nunca vai em links de e-mail |
| `SYNC_PATH` | `/api/integrations/gdms/sync?mode=status` | Rota chamada a cada ciclo do worker |
| `SYNC_INTERVAL_MS` | `300000` | Intervalo do worker (5 minutos) |

### Superadmin inicial

| Variável | Exemplo | Uso |
| --- | --- | --- |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` / `SUPERADMIN_NAME` | `admin@example.com` / … / `Root` | Usuário padrão: criado automaticamente no startup quando o banco não tem nenhum SUPERADMIN. O e-mail fica reservado ao SUPERADMIN |
| `SEED_SUPERADMIN_ON_STARTUP` | `false` | Modo de recuperação: roda o seed completo a cada startup, com os dois sinalizadores abaixo. O usuário padrão não depende dele |
| `SUPERADMIN_PROMOTE_IF_EXISTS` | `false` | Promove a SUPERADMIN uma conta existente com aquele e-mail |
| `SUPERADMIN_SYNC_PASSWORD_IF_EXISTS` | `false` | Regrava a senha do superadmin com a do `.env` a cada startup (desfaz trocas) |

## Execução local

### Com Docker (recomendado)

```bash
cp env.example .env           # preencha senhas, URLs e credenciais
docker network create web     # a rede do proxy (PROXY_NETWORK); uma vez por máquina
docker compose up -d --build
```

O app abre na porta `HOST_PORT` da máquina. Os e-mails de convite e de redefinição usam `APP_URL`; para testar com outro endereço, redefina `APP_URL` no serviço `web-statsap` com um arquivo de override do Compose (`docker compose -f docker-compose.yml -f override.yml up -d`).

> **Atenção:** com SMTP real configurado, convites, redefinições e alertas são enviados de verdade. Em teste, use `INCIDENT_ALERTS_ENABLED=false` ou um SMTP de testes.

### Com Node (desenvolvimento)

O banco e o MinIO do Compose ficam só na rede interna, sem porta publicada. Para rodar o app direto na máquina, use um MySQL 8 (e, para fotos, um MinIO) alcançável dela e aponte `DATABASE_URL` e `MINIO_ENDPOINT` para eles num `.env.local`, que tem prioridade sobre o `.env` e não é versionado. Ajuste também `APP_URL` e `COOKIE_SECURE=false` se for usar HTTP.

```bash
npm install
node --env-file=.env --env-file=.env.local scripts/init-db.mjs          # schema + migrações
node --env-file=.env --env-file=.env.local scripts/bootstrap-superadmin.mjs  # usuário padrão
npm run dev                                                            # porta de PORT
```

Os scripts de banco leem a configuração do ambiente (no Docker, do `env_file`); por isso o `--env-file` na máquina. O `npm run dev` carrega `.env` e `.env.local` sozinho.

## Deploy com Docker Compose

### Serviços e portas

| Serviço | Função | Healthcheck | Porta |
| --- | --- | --- | --- |
| `mysql-statsap` | MySQL 8.4 com volume `mysql_data`; protocolo X desligado | `mysqladmin ping` em `MYSQL_HOST:MYSQL_PORT` | `MYSQL_PORT`, só na rede interna |
| `minio-statsap` | Fotos de perfil, com volume `minio_data`; console desligado | `GET /minio/health/live` em `MINIO_ENDPOINT` | `MINIO_PORT`, só na rede interna |
| `web-statsap` | Interface, APIs, SSE, schema e seed no startup | `GET /api/health` em `APP_BASE_URL` | `PORT` na rede interna e na rede do proxy; publicada no host em `HOST_PORT` |
| `worker-statsap` | Sync periódico com o GWN | Aguarda o `web-statsap` saudável | — |

- `web-statsap` e `worker-statsap` leem o `.env` via `env_file` e usam a mesma imagem (`APP_IMAGE`), com o `server.js` de `.next/standalone`.
- O `web-statsap` não depende do `minio-statsap` para subir: sem ele, só o envio de foto fica indisponível.
- O proxy reverso precisa encaminhar para `WEB_PROXY_ALIAS` na porta `PORT`.

### Antes do primeiro `up` em produção

- [ ] `JWT_SECRET` com 32+ caracteres e `INTERNAL_API_KEY` com 24+.
- [ ] `APP_URL` com a URL pública real (base dos links de convite e redefinição).
- [ ] Nomes e portas internos coerentes: `MYSQL_HOST` e `DATABASE_URL` em `mysql-statsap:MYSQL_PORT`, `MINIO_ENDPOINT` em `minio-statsap:MINIO_PORT`, `APP_BASE_URL` em `web-statsap:PORT`.
- [ ] `MINIO_ROOT_USER` e `MINIO_ROOT_PASSWORD` definidos.
- [ ] Proxy reverso apontando para `WEB_PROXY_ALIAS:PORT`.
- [ ] `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` e `SUPERADMIN_NAME` preenchidos: em banco novo, o usuário padrão é criado sozinho no primeiro startup.
- [ ] Sinalizadores do seed, `TRUST_PROXY_HEADERS` e publicação de porta conforme [Configuração recomendada em produção](#configuração-recomendada-em-produção).
- [ ] SMTP preenchido e destinatários ADMIN/SUPERADMIN com e-mail válido.
- [ ] Credenciais GDMS preenchidas.
- [ ] Backup dos volumes `mysql_data` e `minio_data`.

### Startup do `web-statsap`

1. O entrypoint exige `HOST` e `PORT` e roda [`scripts/init-db.mjs`](./scripts/init-db.mjs): schema, colunas novas e migrações únicas (`SchemaMigration`).
2. Roda o bootstrap do usuário padrão ([`scripts/bootstrap-superadmin.mjs`](./scripts/bootstrap-superadmin.mjs)): se o banco não tem nenhum SUPERADMIN, cria o do `.env`; senão, não faz nada. O log mostra `Bootstrap: ...`.
3. Só com `SEED_SUPERADMIN_ON_STARTUP=true` (modo de recuperação), roda também o seed completo ([`scripts/seed-superadmin.mjs`](./scripts/seed-superadmin.mjs)).
4. Sobe o Next.js em modo produção em `HOST:PORT`.
5. O `worker-statsap` espera o `web-statsap` ficar saudável e passa a chamar o sync em modo `status` a cada `SYNC_INTERVAL_MS`.

### Atualizar para a v1.2

Os serviços mudaram de nome e de porta. Derrube o stack **antes** de atualizar o código, para o Compose remover os containers com os nomes antigos. Os volumes (banco e fotos) são preservados.

```bash
docker compose down
git pull
# complete o .env a partir do env.example (lista abaixo)
docker compose up -d --build
```

No `.env`:

- **Novas:** `MINIO_IMAGE`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_BROWSER`, `MINIO_BUCKET`, `PROXY_NETWORK`, `WEB_PROXY_ALIAS`, `NEXT_PUBLIC_APP_URL`, `TRUST_PROXY_HEADERS`, `MYSQL_POOL_SIZE`, `INVITE_TOKEN_HOURS`, `INCIDENT_ALERTS_ENABLED` e `INCIDENT_ALERT_MIN_MINUTES`.
- **Mudam de valor:** `PORT`, `MYSQL_HOST`, `MYSQL_PORT`, o host e a porta de `DATABASE_URL` e `APP_BASE_URL` (nomes serviço + projeto e portas não padrão).
- **Proxy reverso:** passa a apontar para a porta nova do web (`WEB_PROXY_ALIAS:PORT`).
- `APP_URL` passa a ser obrigatória para os e-mails de convite e de redefinição de senha.

Depois da subida:

- O schema é atualizado sozinho. Na primeira subida, as ocorrências dos APs que já estavam offline são criadas sem disparar e-mail.
- O primeiro sync aplica a posição do GWN a todos os APs que têm localização configurada lá; a fila de Configurações passa a listar só os que não têm.

### Primeira carga do inventário

O worker roda em `mode=status` e **não cria APs novos**. Em ambiente novo, faça um sync completo:

- pela interface: `/settings` → **Sincronizar GDMS** (ADMIN ou SUPERADMIN);
- pelo terminal, de dentro do worker (que já tem o endereço interno e a chave no ambiente):

```bash
docker compose exec worker-statsap node -e "fetch(process.env.APP_BASE_URL + '/api/integrations/gdms/sync', { method: 'POST', headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }).then((r) => r.json()).then(console.log)"
```

### Manutenção e backup

```bash
docker compose ps
docker compose logs -f web-statsap worker-statsap
docker compose restart worker-statsap
docker compose exec web-statsap node scripts/init-db.mjs
docker compose exec mysql-statsap sh -lc 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > backup.sql
docker run --rm -v statsap_minio_data:/data:ro -v "$(pwd)":/backup busybox tar czf /backup/minio_data.tgz -C /data .
```

O nome do volume do MinIO tem o nome do projeto do Compose como prefixo (`statsap_` no exemplo); confira com `docker volume ls`.

## Testes e verificação

```bash
npm test             # Vitest, uma execução (30 arquivos, 201 testes)
npm run test:watch   # Vitest em modo observação
npx tsc --noEmit     # checagem de tipos
npm run lint         # ESLint
npm run build        # build de produção
npm audit --omit=dev # avisos de segurança das dependências
```

- Os testes ficam em `tests/unit/` e cobrem:
  - GWN: normalização de coordenadas, planejamento e motor do sync, cliente GDMS (renovação em `401`);
  - ocorrências: máquina de estados e alertas;
  - usuários: bootstrap do usuário padrão, convites e tokens, autenticação (revalidação e corte de sessão), Minha Conta (serviço, validações, tipo de imagem, chave e recorte da foto);
  - segurança: URL pública dos e-mails e e-mail reservado do superadmin;
  - infraestrutura: templates de e-mail (escape e corte em 100 itens), configuração do MinIO, cache, mensagens de erro de banco;
  - interface: cliente HTTP e SSE, rotação do mapa, formatação de datas, preferência da sidebar e tema fixo (escuro) das telas de autenticação.
- [`vitest.config.ts`](./vitest.config.ts) usa os mesmos aliases do `tsconfig` (`@lib`, `@services`, …) e troca `server-only` por um módulo vazio.
- `npm run test:e2e` (Playwright) ainda não tem suíte versionada.

## Operação e observabilidade

| Recurso | Endpoint ou comando | Objetivo |
| --- | --- | --- |
| Saúde do backend | `GET /api/health` | Confere a conexão do `web-statsap` com o MySQL |
| Teste do GWN | `GET /api/integrations/gdms/ping` | Confirma token e acesso ao inventário remoto |
| Token do GWN | `GET` / `POST /api/integrations/gdms/token` | Mostra a validade / força a renovação |
| Sync completo | `POST /api/integrations/gdms/sync` | Inventário, status, posição e ocorrências; devolve o resumo |
| Sync de status | `POST /api/integrations/gdms/sync?mode=status` | O que o worker roda a cada ciclo |
| Ocorrências | `/incidents` ou `GET /api/incidents` | Quedas abertas, tratativas e histórico |
| Logs | `docker compose logs -f web-statsap worker-statsap` | Autenticação, banco, SSE, sync, armazenamento e envio de e-mail |

## Endpoints

### Autenticação e convites

| Método e rota | Acesso | Função |
| --- | --- | --- |
| `POST /api/auth/login` | Público | Login |
| `POST /api/auth/logout` | Público | Logout (apaga os cookies) |
| `GET /api/me` | Autenticado | Dados do usuário, lidos do banco (inclui cargo, telefone e o endereço da foto) |
| `POST /api/auth/forgot-password` | Público | Envia o link de redefinição (resposta sempre igual) |
| `POST /api/auth/reset-password` | Público (token) | Grava a nova senha e encerra as sessões anteriores |
| `GET /api/auth/invite?token=` | Público (token) | Valida o convite e devolve e-mail, papel e validade |
| `POST /api/auth/accept-invite` | Público (token) | Cria o usuário a partir do convite e autentica |
| `POST /api/register`, `POST /api/auth/register` | Público, se `ALLOW_SELF_REGISTER=true` | Autocadastro |

### Minha Conta

| Método e rota | Acesso | Função |
| --- | --- | --- |
| `PATCH /api/account` | Autenticado | `{ name, jobTitle, phone }` |
| `POST /api/account/email` | Autenticado | `{ newEmail, currentPassword }`; `400 INVALID_PASSWORD`, `409 EMAIL_TAKEN`; renova o cookie e avisa o e-mail anterior |
| `POST /api/account/password` | Autenticado | `{ currentPassword, newPassword }`; encerra as outras sessões e renova o cookie desta |
| `GET /api/account/avatar` | Autenticado | Foto do próprio usuário (`404` sem foto) |
| `POST /api/account/avatar` | Autenticado | O corpo é a imagem (PNG, JPEG ou WebP, até 512 KB); `415 UNSUPPORTED_IMAGE`, `413 FILE_TOO_LARGE`, `503 STORAGE_UNAVAILABLE` |
| `DELETE /api/account/avatar` | Autenticado | Remove a foto |

### APs, histórico e estatísticas

| Método e rota | Acesso | Função |
| --- | --- | --- |
| `GET /api/antennas` | Autenticado | Lista com filtros e paginação (`placed=1` só APs posicionados) |
| `POST /api/antennas` | ADMIN | Cria AP manualmente |
| `GET` / `PATCH` / `DELETE /api/antennas/[id]` | Leitura: autenticado; mutação: ADMIN | Detalhe, edição (inclusive status) e exclusão |
| `PATCH /api/antennas/[id]/coords` | ADMIN | Posição manual (para APs sem posição no GWN) |
| `GET /api/antennas/networks` | Autenticado | Redes conhecidas |
| `GET /api/history/[id]` | Autenticado | Histórico de status do AP (até 200 linhas) |
| `GET /api/stats` | Autenticado | Totais locais |
| `GET /api/stats/network-clients` | Autenticado | Clientes conectados por rede (GWN, com cache) |
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
| `GET /api/users` | SUPERADMIN | Lista usuários (com cargo e telefone) |
| `PATCH /api/users/[id]` | SUPERADMIN | Bloqueio, suspensão e reativação |
| `DELETE /api/users/[id]` | SUPERADMIN | Exclui o usuário e a foto de perfil dele |
| `GET /api/users/invites` | SUPERADMIN | Convites pendentes |
| `POST /api/users/invites` | SUPERADMIN | `{ email, role }`: cria e envia o convite |
| `POST /api/users/invites/[id]/resend` | SUPERADMIN | Novo token, nova validade e reenvio |
| `DELETE /api/users/invites/[id]` | SUPERADMIN | Revoga o convite |

A criação direta de usuário (`POST /api/users`) foi substituída pelo convite.

## Scripts

| Script | Efeito |
| --- | --- |
| `npm run dev` | Desenvolvimento ([`scripts/dev.mjs`](./scripts/dev.mjs)), na porta definida em `PORT` |
| `npm run build` / `npm run start` | Build e servidor de produção |
| `npm run lint` | ESLint |
| `npm test` / `npm run test:watch` | Testes unitários (Vitest) |
| `npm run db:init` | Schema, colunas novas e migrações únicas (lê `DATABASE_URL` do ambiente) |
| `npm run db:seed` | Seed completo do superadmin conforme os sinalizadores `SUPERADMIN_*` (recuperação) |
| `node scripts/bootstrap-superadmin.mjs` | Cria o usuário padrão do `.env` se o banco não tiver nenhum SUPERADMIN (já roda em todo startup) |
| `node scripts/seed-local.mjs` | Desenvolvimento: garante o superadmin de `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD`, regravando a senha |
| `node scripts/gdms-cron.mjs` | Worker de sync fora do Compose (exige `APP_BASE_URL`) |

## Versionamento

- A versão oficial é a do `package.json` (atual: **1.2.0**). O [`next.config.js`](./next.config.js) a expõe no build como `NEXT_PUBLIC_APP_VERSION`, e [`lib/version.ts`](./lib/version.ts) a entrega à interface (sidebar e rodapé).
- Para lançar uma versão: atualize `version` no `package.json` (e no `package-lock.json` com `npm version <x.y.z> --no-git-tag-version`), registre as mudanças no [CHANGELOG](./CHANGELOG.md) e reconstrua a imagem.
- O projeto segue [versionamento semântico](https://semver.org/lang/pt-BR/).

## Solução de problemas

### `web-statsap` não fica saudável

- `/api/health` retorna `503` ou o container reinicia: confira `DATABASE_URL` (host `mysql-statsap`, porta igual a `MYSQL_PORT`) e a coerência com `MYSQL_*`.
- "defina HOST no .env" ou "defina PORT no .env" no log: as duas variáveis são obrigatórias.
- Acompanhe `docker compose logs -f mysql-statsap web-statsap` e, se necessário, rode `docker compose exec web-statsap node scripts/init-db.mjs`.

### `KeyError: 'id'` ao rodar `docker-compose`

O traceback em Python (`compose/cli/log_printer.py`, `compose/project.py`) vem do `docker-compose` v1, descontinuado e incompatível com o Docker Engine atual. Use o Compose v2 (`docker compose`, com espaço) em todos os comandos deste README. Se ele não estiver instalado no servidor (Debian/Ubuntu): `sudo apt-get install docker-compose-plugin`; confira com `docker compose version`.

### O domínio responde 502 depois de atualizar

O web mudou de porta. Aponte o proxy reverso para `WEB_PROXY_ALIAS` na porta definida em `PORT`.

### `exec ./scripts/docker-entrypoint.sh: no such file or directory` (Windows)

O script foi para a imagem com quebra de linha CRLF. O `.gitattributes` força `*.sh` com LF; se o checkout é anterior a essa regra, recrie o arquivo a partir do Git (sem alterações locais nele) e reconstrua:

```bash
rm scripts/docker-entrypoint.sh
git checkout -- scripts/docker-entrypoint.sh
docker compose up -d --build web-statsap
```

### `network web declared as external, but could not be found`

A rede externa do proxy ainda não existe na máquina. Crie-a com o nome definido em `PROXY_NETWORK` (por exemplo, `docker network create web`).

### `docker compose` para com "required variable MINIO_ROOT_USER is missing a value"

O `minio-statsap` exige credenciais próprias, para nunca subir com a senha de fábrica. Acrescente `MINIO_ROOT_USER` e `MINIO_ROOT_PASSWORD` (8+ caracteres) ao `.env`.

### Foto de perfil não envia ("armazenamento indisponível")

- `docker compose ps` deve mostrar o `minio-statsap` saudável; veja `docker compose logs minio-statsap`.
- `MINIO_ENDPOINT` precisa usar o nome `minio-statsap` e a porta de `MINIO_PORT`.
- Se a imagem de `MINIO_IMAGE` não baixar, confira a tag: o repositório oficial `minio/minio` não está mais no Docker Hub.
- A foto aceita PNG, JPEG ou WebP; outros formatos respondem "Formato não aceito".

### Banco novo e ninguém consegue entrar

O usuário padrão é criado no startup a partir de `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` e `SUPERADMIN_NAME`. Veja a linha `Bootstrap:` no log do `web-statsap` (`docker compose logs web-statsap`):

- **"superadmin inicial criado"**: entre com o e-mail e a senha do `.env`.
- **"faltam SUPERADMIN_..."**: preencha as três variáveis e reinicie o `web-statsap`.
- **"já é de outra conta"**: o e-mail do `.env` pertence a um usuário que não é SUPERADMIN; o bootstrap não promove ninguém sozinho. Use outro e-mail ou promova a conta conscientemente com `SUPERADMIN_PROMOTE_IF_EXISTS=true` e `SEED_SUPERADMIN_ON_STARTUP=true` por um restart.

### O e-mail do superadmin "volta" depois de um restart

Com `SEED_SUPERADMIN_ON_STARTUP=true`, o seed garante a cada startup que exista um superadmin com o `SUPERADMIN_EMAIL` do `.env`. Se o superadmin trocou o e-mail em Minha Conta, o seed cria outra conta com o e-mail e a senha do `.env`. Depois do primeiro bootstrap, mantenha `SEED_SUPERADMIN_ON_STARTUP=false`. O nome editado em Minha Conta é preservado: o seed só define o nome ao criar a conta.

### AP não aparece no mapa / continua em Configurações

- O mapa mostra só APs posicionados (`lat`/`lon` diferentes de `0,0`).
- Configure a localização do AP no GWN e aguarde o próximo sync ou clique em **Sincronizar GDMS**.
- Posição `0,0`, vazia ou fora da faixa no GWN é tratada como "sem posição".
- A posição digitada em Configurações é substituída assim que o GWN passar a informar uma.

### Sync responde `409 SYNC_IN_PROGRESS`

Já existe um sync rodando (normalmente o ciclo do worker). Aguarde o término e tente de novo.

### Alertas de ocorrência não chegam

- `INCIDENT_ALERTS_ENABLED` precisa estar `true` e o SMTP (`EMAIL_*`) configurado.
- O alerta só sai depois de `INCIDENT_ALERT_MIN_MINUTES` offline e no fim de um sync.
- Os destinatários são ADMIN e SUPERADMIN ativos; confira se há algum e se o e-mail deles é válido.
- Ocorrências criadas na implantação (AP que já estava offline) não geram e-mail, por desenho.
- Falha de SMTP aparece no log do `web-statsap`; o envio é tentado de novo no próximo ciclo.

### Convite inválido ou expirado

O link vale `INVITE_TOKEN_HOURS` e uma única vez; reenviar ou convidar de novo invalida o link anterior. Peça ao SUPERADMIN para usar **Reenviar** na Administração.

### E-mails de convite ou de redefinição de senha não chegam

Os links desses e-mails saem só da `APP_URL` (ou de `PASSWORD_RESET_BASE_URL`, no caso da redefinição). Sem `APP_URL` válida, o envio falha e o log do `web-statsap` mostra "URL pública não configurada". Configure `APP_URL` com o endereço que abre no navegador.

### Limite de requisições bloqueia todo mundo atrás do proxy

Sem `TRUST_PROXY_HEADERS=true`, todos os acessos que chegam pelo proxy compartilham o mesmo IP ("unknown") nos limites por IP (login, recuperação de senha, convite). Atrás de um proxy que sobrescreva `X-Forwarded-For`/`X-Real-IP`, habilite a variável. Com a aplicação exposta diretamente, mantenha `false`.

### `ORIGIN_REQUIRED`, `ORIGIN_MISMATCH` ou `CSRF_INVALID`

- Acesse pelo mesmo host configurado em `APP_URL`.
- Atrás de proxy, encaminhe `Host` (ou `X-Forwarded-Host`) e `X-Forwarded-Proto`.
- Mutações com cookie precisam de `x-csrf-token`; a interface já envia.

### Usuário é mandado para `/login` de repente

É a revalidação de sessão (`401 SESSION_REVOKED`). Ou o usuário foi excluído, bloqueado ou suspenso (reative-o na Administração), ou a senha da conta foi trocada ou redefinida em outro dispositivo (basta entrar de novo com a senha nova).

### Worker responde `401`/`403` ou não alcança o `web-statsap`

- `APP_BASE_URL` precisa usar o nome `web-statsap` e a porta de `PORT`; sem ela, o worker nem inicia.
- `INTERNAL_API_KEY` é a mesma para os dois serviços (ambos leem o `.env`).
- Confira se o `web-statsap` está saudável antes de olhar o worker.

### Worker não cria APs novos

É o esperado em `mode=status`. Faça um sync completo em `/settings` ou chame o endpoint sem `mode=status`.

### `GDMS /oapi/... failed` ou `retCode != 0`

- Confira `GDMS_CLIENT_ID`, `GDMS_CLIENT_SECRET`, `GDMS_BASE` e `GDMS_OAUTH_URL` (HTTPS em produção).
- Confira o relógio do host: a assinatura usa `timestamp`.
- Use `GET /api/integrations/gdms/token` e `GET /api/integrations/gdms/ping` para separar falha de token de falha de sync.

### Dashboard funciona, mas "clientes por rede" falha

`/api/stats` lê o banco local; `/api/stats/network-clients` consulta o GWN. Verifique as credenciais e o `ping` do GWN.

### Avisos ou notificações não aparecem

- Dependem do stream `GET /api/events`; confira no navegador se ele conecta.
- Atrás de proxy, desligue o buffering e use timeout longo para a rota SSE.
- Em `mode=status`, o AP precisa já existir no banco para haver transição.

### Sessão não persiste em HTTPS ou atrás de proxy

Em produção o cookie é sempre `Secure`, então o acesso precisa ser por HTTPS. Encaminhe host e protocolo corretamente e alinhe `APP_URL`.

## Licença

Projeto sob a licença MIT. Consulte [`LICENSE`](./LICENSE).
