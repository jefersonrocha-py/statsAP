# Changelog

Todas as mudanças relevantes do Stats A.P ficam registradas aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [versionamento semântico](https://semver.org/lang/pt-BR/).

## 1.2.0 — 2026-10-15

### Adicionado

- **Posição dos APs vinda do GWN.** O sync (botão "Sincronizar GDMS" e worker) aplica a latitude e a longitude cadastradas no GWN. O GWN sempre vence quando informa posição; a digitação manual em Configurações fica só para APs sem localização no GWN.
- **Ocorrências de AP offline** (`/incidents`): cada queda abre uma ocorrência com os estados Aberta, Em tratativa e Resolvida; ações de assumir, comentar e resolver (ADMIN e SUPERADMIN); linha do tempo de auditoria só de inserção; resolução automática quando o AP volta e ninguém assumiu.
- **Alertas por e-mail** para ADMIN e SUPERADMIN: um resumo por ciclo dos APs offline há mais de `INCIDENT_ALERT_MIN_MINUTES` e outro dos APs normalizados, com no máximo 100 itens por e-mail.
- **Central de notificações** no sino da barra superior, com contador de não lidas, últimas ocorrências, "Ver todas" e "Marcar como lidas". O aviso "AP offline" ganhou o link "Ver ocorrência".
- **Convite de usuário por e-mail**: o SUPERADMIN convida pelo e-mail e escolhe o papel; o link (uso único, validade de `INVITE_TOKEN_HOURS`) leva à tela `/accept-invite`. Convites pendentes podem ser reenviados ou revogados.
- **Minha Conta** (`/account`): cada usuário edita nome, cargo e telefone, troca o e-mail de acesso e a senha (as duas confirmadas pela senha atual) e envia, troca ou remove a foto de perfil. A foto aparece no card "Bem-vindo" da sidebar; cargo e telefone aparecem na Administração.
- **Bootstrap do usuário padrão**: a cada startup, se o banco não tem nenhum SUPERADMIN, o `web-statsap` cria o superadmin do `.env` (`SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_NAME`). Num banco existente ele não faz nada: não regrava senha, não promove conta nem recria quem já existe.
- **Serviço MinIO** (`minio-statsap`) para as fotos de perfil: só na rede interna, bucket privado criado no primeiro uso, e as fotos saem sempre pela aplicação. Se o MinIO cair, só o envio de foto fica indisponível.
- **Sidebar retrátil** com botão de seta na borda, preferência salva no navegador e gaveta própria no celular (abre pelo ☰, fecha pelo X, pelo fundo, por Esc ou ao trocar de página).
- **Identidade visual** com símbolo e nome "Stats A.P" na sidebar e no rodapé, ícone da aba e versão do `package.json` exibida na interface.
- **Resumo do sync** em Configurações: criados, atualizados, coordenadas aplicadas, APs sem posição no GWN e erros.
- **Testes automatizados** com Vitest (`npm test`): 30 arquivos, 201 testes.
- Tabelas novas: `UserInvite`, `Incident`, `IncidentEvent` e `SchemaMigration`; colunas novas em `User`: `notificationsSeenAt`, `phone`, `jobTitle`, `avatarKey` e `passwordChangedAt`.

### Alterado

- **`/clients` e Dashboard** contam os clientes pela lista de clientes conectados do GWN (`client/list`). A consulta tem cache de 60 s compartilhado entre usuários e, depois de vencida, devolve o último valor (com até 10 minutos) enquanto atualiza em segundo plano.
- **Controle de rotação do mapa** reescrito: o "N" aponta para o norte real, o arraste é relativo e acompanha o dedo ou o mouse, há botões de 45° e "Norte", e o teclado funciona (setas e `Home`). "Cidade" e "Pinos" preservam a rotação.
- **Sessão revalidada no banco** a cada requisição: usuário excluído, bloqueado ou suspenso perde o acesso na hora (`401 SESSION_REVOKED`, com os cookies apagados). O papel vem do banco, não do token.
- **Trocar ou redefinir a senha encerra as sessões abertas em outros dispositivos**; a sessão que fez a troca continua ativa. Trocar o e-mail de acesso avisa o endereço anterior.
- **Telas de login, senha e convite** com visual fixo, sempre escuro: o tema escolhido no app não vale para elas.
- **Compose:**
  - serviços e containers nomeados serviço + projeto (`mysql-statsap`, `minio-statsap`, `web-statsap` e `worker-statsap`);
  - toda a configuração vem do `.env`, sem valores fixos, padrões ou comentários;
  - a rede do proxy e o nome do web nela viraram `PROXY_NETWORK` e `WEB_PROXY_ALIAS`.
- **Portas:**
  - web, MySQL e MinIO usam portas não padrão definidas no `.env` (`PORT`, `MYSQL_PORT` e `MINIO_PORT`);
  - Dockerfile, entrypoint e código não têm mais porta de reserva;
  - `npm run dev` sobe na porta de `PORT`.
- No celular, o painel de filtros do mapa começa fechado e os botões do topo mostram só o ícone.
- O seed do superadmin não sobrescreve mais o nome de uma conta existente.
- Excluir um usuário apaga também a foto de perfil dele.
- O Dashboard carrega os totais e os clientes por rede de forma independente: os cartões não esperam a consulta ao GWN.
- Uma única conexão SSE por aba, compartilhada por todos os componentes.
- O sync emite um único `antenna.updated` agrupado, em vez de um evento por AP, e roda um de cada vez (`409 SYNC_IN_PROGRESS`).
- O worker não entra mais no limite de requisições do sync; usuários passaram de 2 para 4 syncs a cada 15 minutos.
- O cliente GDMS renova o token e repete a chamada uma vez quando recebe `401`.
- E-mails (redefinição de senha, convite, aviso de troca de e-mail e alertas) usam um layout único, com escape de HTML.
- Revisão de acentuação e pontuação em toda a interface, nas mensagens de validação e nos e-mails.
- Título da página "Stats A.P" e botão de login "Entrar".
- README e documentação reescritos para a v1.2.

### Segurança

- Os links dos e-mails de convite e de redefinição de senha saem só da URL configurada em `APP_URL`. Antes, sem `APP_URL`, eram montados a partir dos cabeçalhos da requisição, e quem pedisse a redefinição de senha de outra pessoa com cabeçalhos forjados faria o e-mail da vítima apontar para um site seu.
- Só um SUPERADMIN pode assumir o e-mail de `SUPERADMIN_EMAIL`. Com `SUPERADMIN_PROMOTE_IF_EXISTS=true`, um usuário comum que trocasse o próprio e-mail para esse endereço seria promovido no restart seguinte.
- Serviços e containers com nome único. O web fica na rede do proxy, compartilhada com outros projetos, onde um nome genérico poderia ser resolvido para o container de outro projeto.
- Nenhum serviço na porta padrão do seu software; o protocolo X do MySQL e o console web do MinIO ficam desligados.
- O healthcheck do MySQL não leva mais a senha de root na linha de comando.
- O worker exige `APP_BASE_URL` em vez de assumir um endereço padrão para enviar a chave interna.
- O `seed-local.mjs` não tem mais usuário e senha de reserva fixos: exige `SUPERADMIN_EMAIL` e `SUPERADMIN_PASSWORD`.
- Dependências atualizadas dentro da mesma versão maior: `mysql2` (vazamento de senha para um servidor falso por rebaixamento do método de autenticação), `lodash`, `nanoid`, `source-map-js` e `protocol-buffers-schema`.
- **Pendente:** `next` 14, `maplibre-gl` 5 e `nodemailer` 8 têm avisos de segurança que só se resolvem trocando de versão maior.

### Corrigido

- O tema escolhido no app vazava para as telas de login, de senha e de convite (inclusive ao sair pelo botão "Sair"), e as partículas do fundo eram recriadas a cada troca de tema.
- Painel da ocorrência, menu do sino e diálogo "Nova antena" estavam semitransparentes e o conteúdo de trás vazava por baixo do texto.
- Rotação do mapa: toques seguidos nas setas ou nos botões de 45° perdiam parte do giro.
- Clientes no celular: os cards de rede passavam da borda da tela.
- Contagem inflada de clientes em `/clients` e no Dashboard: o total somava o contador `clients` de cada AP (em uma rede, 138 contra 30 clientes realmente conectados).
- Alertas de ocorrência deixavam de ser processados quando a leitura do GWN falhava.
- A carga inicial de ocorrências (APs que já estavam offline na implantação) não dispara e-mail nem indica "alerta enviado".
- O mapa recarregava uma vez por AP durante o sync.
- No celular, a sidebar abria por padrão sobre o conteúdo e não havia botão para reabri-la.
- Selects com o texto encostado na seta e campos que estouravam o card em telas estreitas.
- Paginação com concordância errada em listas vazias ("Nenhum ocorrências") e exibida como vazia durante o carregamento.
- Erros de banco deixam de expor a mensagem SQL na resposta da API.
- O `docker-entrypoint.sh` quebrava o container quando o checkout no Windows convertia o arquivo para CRLF (`.gitattributes` força LF em `*.sh`).

### Removido

- Criação direta de usuário pelo administrador (`POST /api/users`), substituída pelo convite por e-mail.

### Notas de atualização

1. **Antes de atualizar o código**, rode `docker compose down`: os serviços mudaram de nome e o Compose precisa remover os containers antigos. Os volumes (banco e fotos) são preservados.
2. **Complete o `.env`** a partir do `env.example`:
   - novas: `MINIO_IMAGE`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_BROWSER`, `MINIO_BUCKET`, `PROXY_NETWORK`, `WEB_PROXY_ALIAS`, `NEXT_PUBLIC_APP_URL`, `TRUST_PROXY_HEADERS`, `MYSQL_POOL_SIZE`, `INVITE_TOKEN_HOURS`, `INCIDENT_ALERTS_ENABLED` e `INCIDENT_ALERT_MIN_MINUTES`;
   - mudam de valor: `PORT`, `MYSQL_HOST`, `MYSQL_PORT`, o host e a porta de `DATABASE_URL` e `APP_BASE_URL`.
3. **Proxy reverso:** aponte para `WEB_PROXY_ALIAS` na porta nova de `PORT`.
4. Suba com `docker compose up -d --build`. O schema é atualizado sozinho, com mudanças aditivas.
5. Na primeira subida, as ocorrências dos APs que já estavam offline são criadas sem disparar e-mail, e o primeiro sync aplica a posição do GWN; a fila de Configurações passa a listar só os APs sem localização no GWN.

Também vale saber:

- `APP_URL` passa a ser obrigatória para os e-mails de convite e de redefinição de senha.
- A imagem do MinIO no `env.example` é o fork comunitário `pgsty/minio`, com a versão fixada, porque o repositório oficial `minio/minio` saiu do Docker Hub.
- Inclua o volume `minio_data` na rotina de backup.
- Em produção, mantenha `SEED_SUPERADMIN_ON_STARTUP`, `SUPERADMIN_PROMOTE_IF_EXISTS` e `SUPERADMIN_SYNC_PASSWORD_IF_EXISTS` em `false`: o usuário padrão de um banco novo vem do bootstrap, que não depende deles. Com o seed ligado, trocar o e-mail do superadmin em Minha Conta faz o próximo restart criar outra conta com o e-mail do `.env`.

## 1.1.0

Versão anterior em produção.

- Mapa georreferenciado com filtros, busca e satélite/OpenStreetMap.
- Dashboard com totais, disponibilidade e clientes por rede.
- Filtros Cluster com paginação, exportação CSV, troca de status e exclusão.
- Configurações com a fila de APs sem coordenadas, preenchidas manualmente, e sync com o GDMS.
- Administração de usuários com papéis `USER`, `ADMIN` e `SUPERADMIN`, bloqueio, suspensão e exclusão.
- Login com JWT em cookie, CSRF, validação de origem, limite de requisições e recuperação de senha por e-mail.
- Avisos em tempo real de AP offline/online via SSE.
- Worker de sync com o GDMS e deploy com Docker Compose (serviços `mysql`, `web` e `worker`, nomes da época).
