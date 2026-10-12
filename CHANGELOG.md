# Changelog

Todas as mudanças relevantes do Stats A.P ficam registradas aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [versionamento semântico](https://semver.org/lang/pt-BR/).

## 1.2.0 — 2026-10-12

### Adicionado

- **Posição dos APs vinda do GWN.** O sync (botão "Sincronizar GDMS" e worker a cada 5 minutos) aplica a latitude e a longitude cadastradas no GWN. O GWN sempre vence quando informa posição; a digitação manual em Configurações fica só para APs sem localização no GWN.
- **Ocorrências de AP offline** (`/incidents`): cada queda abre uma ocorrência com os estados Aberta, Em tratativa e Resolvida; ações de assumir, comentar e resolver (ADMIN e SUPERADMIN); linha do tempo de auditoria só de inserção; resolução automática quando o AP volta e ninguém assumiu.
- **Alertas por e-mail** para ADMIN e SUPERADMIN: um resumo por ciclo dos APs offline há mais de `INCIDENT_ALERT_MIN_MINUTES` e outro dos APs normalizados, com no máximo 100 itens por e-mail.
- **Central de notificações** no sino da barra superior, com contador de não lidas, últimas ocorrências, "Ver todas" e "Marcar como lidas". O toast "AP offline" ganhou o link "Ver ocorrência".
- **Convite de usuário por e-mail**: o SUPERADMIN convida pelo e-mail e escolhe o papel; o link (uso único, validade de `INVITE_TOKEN_HOURS`) leva à tela `/accept-invite`. Convites pendentes podem ser reenviados ou revogados.
- **Minha Conta** (`/account`): cada usuário edita nome, cargo e telefone, troca o e-mail de acesso e a senha (as duas confirmadas pela senha atual) e envia, troca ou remove a foto de perfil. A foto aparece no card "Bem-vindo" da sidebar; cargo e telefone aparecem na Administração.
- **Serviço MinIO** no `docker-compose` para as fotos de perfil: só na rede interna, bucket privado criado no primeiro uso, e as fotos saem sempre pela aplicação. Se o MinIO cair, só o envio de foto fica indisponível.
- **Ícone da aba** com o símbolo da Etheriumtech.
- **Sidebar retrátil** com botão de seta na borda, preferência salva no navegador e gaveta própria no celular (abre pelo ☰, fecha pelo X, pelo fundo, por Esc ou ao trocar de página).
- **Identidade visual** com símbolo e nome "Stats A.P" na sidebar e no rodapé; a versão do `package.json` aparece na sidebar e no rodapé.
- **Resumo do sync** em Configurações: criados, atualizados, coordenadas aplicadas, APs sem posição no GWN e erros.
- **Testes automatizados** com Vitest (`npm test`).
- Variáveis novas com padrão: `INVITE_TOKEN_HOURS`, `INCIDENT_ALERTS_ENABLED`, `INCIDENT_ALERT_MIN_MINUTES`, `MINIO_IMAGE`, `MINIO_ENDPOINT` e `MINIO_BUCKET`. Obrigatórias no Compose: `MINIO_ROOT_USER` e `MINIO_ROOT_PASSWORD`.
- Tabelas novas: `UserInvite`, `Incident`, `IncidentEvent`, `SchemaMigration`; colunas novas em `User`: `notificationsSeenAt`, `phone`, `jobTitle`, `avatarKey` e `passwordChangedAt`.

### Alterado

- **`/clients` e Dashboard** contam os clientes pela lista de clientes conectados do GWN (`client/list`). A consulta tem cache de 60 s compartilhado entre usuários.
- **Controle de rotação do mapa** reescrito: o "N" aponta para o norte real, o arraste é relativo e acompanha o dedo ou o mouse, há botões de 45° e "Norte", e o teclado funciona (setas e `Home`). "Cidade" e "Pinos" preservam a rotação.
- **Sessão revalidada no banco** a cada requisição: usuário excluído, bloqueado ou suspenso perde o acesso na hora (`401 SESSION_REVOKED`, com os cookies apagados). O papel vem do banco, não do token.
- **Trocar ou redefinir a senha encerra as sessões abertas em outros dispositivos.** A sessão que fez a troca continua ativa.
- Trocar o e-mail de acesso avisa o endereço anterior por e-mail.
- A consulta de clientes por rede devolve o último valor (com até 10 minutos) enquanto atualiza em segundo plano, em vez de fazer a tela esperar o GWN.
- No celular, o painel de filtros do mapa começa fechado e os botões do topo mostram só o ícone.
- O seed do superadmin não sobrescreve mais o nome de uma conta existente (o nome editado em Minha Conta é preservado).
- Excluir um usuário apaga também a foto de perfil dele.
- O Dashboard carrega os totais e os clientes por rede de forma independente: os cartões não esperam a consulta ao GWN.
- Uma única conexão SSE por aba, compartilhada por todos os componentes.
- O sync emite um único `antenna.updated` agrupado, em vez de um evento por AP, e roda um de cada vez (`409 SYNC_IN_PROGRESS`).
- O worker não entra mais no limite de requisições do sync; usuários passaram de 2 para 4 syncs a cada 15 minutos.
- O cliente GDMS renova o token e repete a chamada uma vez quando recebe `401`.
- E-mails (redefinição de senha, convite e alertas) usam um layout único, com escape de HTML.
- Revisão de acentuação e pontuação em toda a interface, nas mensagens de validação e nos e-mails.
- Título da página "Stats A.P" e botão de login "Entrar".
- README reescrito para a v1.2.

### Corrigido

- Partículas da tela de login: com o sistema operacional em modo escuro, o app claro mostrava a paleta escura (quase invisível), e todas as partículas eram recriadas a cada troca de tema. Agora seguem só o tema do app e não são recriadas.
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

- O schema é atualizado sozinho no startup do container `web`; as mudanças são aditivas.
- Na primeira subida, as ocorrências dos APs que já estavam offline são criadas sem disparar e-mail.
- O primeiro sync aplica a posição do GWN; a fila de Configurações passa a listar só os APs sem localização no GWN.
- **Antes de subir:** acrescente `MINIO_ROOT_USER` e `MINIO_ROOT_PASSWORD` (8+ caracteres) ao `.env`. Sem elas, o `docker compose` para com a mensagem "defina MINIO_ROOT_USER no .env".
- A imagem padrão do MinIO é o fork comunitário `pgsty/minio`, com a versão fixada, porque o repositório oficial `minio/minio` saiu do Docker Hub. Para usar outra imagem compatível, defina `MINIO_IMAGE`.
- Inclua o volume `minio_data` na rotina de backup.
- Com `SEED_SUPERADMIN_ON_STARTUP=true`, trocar o e-mail do superadmin em Minha Conta faz o próximo restart criar outra conta com o e-mail do `.env`.
- Recomendado em produção: `SEED_SUPERADMIN_ON_STARTUP=false` e `SUPERADMIN_SYNC_PASSWORD_IF_EXISTS=false`. Com `true`, a senha do superadmin volta à do `.env` a cada restart.

## 1.1.0

Versão anterior em produção.

- Mapa georreferenciado com filtros, busca e satélite/OpenStreetMap.
- Dashboard com totais, disponibilidade e clientes por rede.
- Filtros Cluster com paginação, exportação CSV, troca de status e exclusão.
- Configurações com a fila de APs sem coordenadas, preenchidas manualmente, e sync com o GDMS.
- Administração de usuários com papéis `USER`, `ADMIN` e `SUPERADMIN`, bloqueio, suspensão e exclusão.
- Login com JWT em cookie, CSRF, validação de origem, limite de requisições e recuperação de senha por e-mail.
- Toasts em tempo real de AP offline/online via SSE.
- Worker de sync com o GDMS e deploy com Docker Compose (`mysql`, `web`, `worker`).
