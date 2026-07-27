# Bookshelf sobre o Calibre-Web Automated

Esta branch (`cwa-base`) troca a base deste fork de [Calibre-Web](https://github.com/janeczku/calibre-web)
puro para [Calibre-Web Automated](https://github.com/crocodilestick/calibre-web-automated) (CWA),
mantendo a interface "Bookshelf" (`/bookshelf`) como uma camada fina por cima.

## Por que essa base

O CWA já resolve automaticamente boa parte do que um book tracker (tipo Goodreads) precisa:

- **Status de leitura** (`quero ler` / `lendo` / `lido`) via `ReadBook`.
- **Progresso real (%)** e **tempo de leitura** via `KoboReadingState` / `KoboBookmark` / `KoboStatistics`,
  alimentados automaticamente por sync com Kobo e com KOReader (`progress_syncing/protocols/kosync.py`) —
  ou seja, funciona mesmo sem um Kobo físico, só usando um app de leitura compatível.
- Metadados via Hardcover.app já integrados como provedor.

Por isso o Bookshelf **não duplica** esses dados em uma tabela própria: ele lê e escreve direto nas
tabelas nativas do CWA, e só guarda em `User.view_settings['bookshelf']` (JSON que já existe em todo
usuário, sem migração nova) o que o CWA não tem conceito nenhum:

- status `abandonado` (o CWA só conhece unread/in_progress/finished);
- datas editadas manualmente, sinopse alternativa, review pessoal, tipo de livro (físico/digital/audiobook),
  tema/avatar/perfil da interface, ordenação das estantes.

Edição manual sempre é possível (import de CSV do Goodreads, edição de estante, etc.) e tem prioridade
sobre o valor automático quando definida.

## Footprint no código do CWA

Só duas edições no core, o resto é tudo arquivo novo:

- `cps/main.py`: +2 linhas (import e `register_blueprint`).
- `cps/templates/layout.html`: +3 linhas (link "Bookshelf" no menu).
- Novo: `cps/bookshelf.py`, `cps/static/bookshelf/`, `cps/templates/bookshelf/`, `cps/static/js/lib_do_fauno.js`.

Isso é proposital: manter esse footprint mínimo é o que torna viável puxar atualizações do upstream do
CWA sem brigar com conflito de merge toda hora.

## Audiobookshelf (opcional)

Se você usa [Audiobookshelf](https://github.com/advplyr/audiobookshelf) pros audiobooks, o Bookshelf pode
puxar o progresso de lá também — configure `AUDIOBOOKSHELF_URL` e `AUDIOBOOKSHELF_TOKEN` (env vars, ver
`docker-compose.yml`). Sem essas duas variáveis, o recurso fica desligado e nada muda.

- **Só leitura**: o Bookshelf lê status/progresso/datas do ABS a cada 60s (cache em memória) e nunca
  escreve de volta nele. Continue controlando o audiobook pelo app/servidor do ABS normalmente.
- **Casamento com o Calibre**: livros que existem nos dois (ex: você tem o ebook no Calibre e o audiobook
  no ABS) são casados por título+autor normalizados (`cps/bookshelf.py:_norm`) e viram **um card só** —
  o progresso do ABS só empurra o status/progresso pra frente (nunca reduz o que já estava mais avançado),
  e nunca sobrescreve um valor que você editou manualmente.
- **Audiobook sem edição em ebook**: vira um card próprio, com id sintético `abs:<item_id>` (não existe
  como `Books.id` no Calibre). Esse card guarda tudo — status, progresso, estante, edições manuais — em
  `view_settings`, já que não há uma linha em `ReadBook`/`BookShelf` pra ele.
- Capas dos audiobooks são servidas via `/bookshelf/api/abs-cover/<item_id>`, um proxy que busca a imagem
  no ABS no servidor (nunca expõe o token da API no navegador, e funciona mesmo se o ABS só for acessível
  de dentro da rede do container).
- Cards que só existem no ABS vêm com `mediaType: 'audiobook'` e `totalTime` já formatado (`HH:MM:SS`),
  e `currentProgress` em **segundos** (não fração 0-1) — é isso que o editor de progresso do app.js espera
  pra esse tipo de mídia. Pra livros casados com um ebook do Calibre, isso fica em campos à parte
  (`audiobookProgress`/`audiobookTotalTime`) pra não mexer no progresso de leitura por página que já vem
  do Kobo.

## Login com Google

O CWA já tem suporte nativo a login via Google (`cps/oauth_bb.py`, usa `flask-dance`) — não precisa de
nada novo neste fork. Pra ativar: crie um OAuth Client ID em
[console.developers.google.com](https://console.developers.google.com/apis/credentials), configure em
**Admin → Configurações Básicas → Login/Registo** dentro do próprio calibre-web-automated, e depois
vincule sua conta em **Perfil → Ligações Externas**. Isso autentica no calibre-web (e por extensão no
Bookshelf, que usa a mesma sessão) — não sincroniza dados, é só um método de login.

## Sync com o Bookshelf original (Firebase, opcional)

Se você ainda usa o [app original do Bookshelf](https://github.com/ro2342/bookshelf) (Firestore) no
dia a dia, o Bookshelf pode manter isso sincronizado — configure `FIREBASE_LEGACY_PROJECT_ID`,
`FIREBASE_LEGACY_USER_ID` e `FIREBASE_LEGACY_SERVICE_ACCOUNT_PATH` (ver `docker-compose.yml`/`.env.example`).
Sem essas variáveis, o recurso fica desligado.

- **Só leitura**, igual ao Audiobookshelf: nunca escreve de volta no Firestore.
- Fala direto com a **API REST do Firestore** usando um fluxo de autenticação JWT feito à mão
  (`cps/services/firebase_legacy.py`) em vez do SDK `firebase-admin`, que traria uma dependência pesada
  (grpcio, google-cloud-firestore) pra imagem — só usa `requests` e `cryptography`, que o CWA já tem.
- **Segurança da chave**: use uma conta de serviço com o papel **Cloud Datastore Viewer** (só leitura),
  nunca Editor/Owner — mesmo que a chave vaze, não dá pra apagar ou alterar nada no seu Firestore.
- **Diferente do Audiobookshelf**: lá o CWA já tem uma fonte própria de progresso (Kobo), então o merge só
  empurra status/progresso pra frente. Aqui, o Firebase é a **única** fonte pra avaliação pessoal, review,
  datas, "favorito", tipo de mídia etc — esses campos são sempre sobrescritos pelo valor mais recente do
  Firestore a cada sync (60s de cache). Se você editar um desses campos direto no Bookshelf novo pra um
  livro que também existe no Firebase, a próxima sincronização vai substituir pelo valor de lá.
- **Casamento com o Calibre**: por título normalizado (não usa autor — o formato do nome no Firebase,
  "Fulano de Tal", geralmente não bate com o `author_sort` do Calibre, "de Tal, Fulano").
- Livro sem match vira card `fb:<id>`, o mesmo esquema de ID usado pela importação única (`/api/import_firebase`)
  — então rodar as duas (importar uma vez e depois ligar o sync) não duplica nada, o sync só mantém os
  mesmos cards atualizados.
- Estantes são casadas por **nome** contra as suas estantes reais no CWA; uma estante nova criada no
  Firebase depois da importação inicial não aparece sozinha aqui (rode a importação de novo pra pegá-la).

## Exportando para o Bookshelf standalone (ro2342/bookshelf)

O plano é o inverso do resto deste documento: em vez do CWA puxar de fora, é o
[`ro2342/bookshelf`](https://github.com/ro2342/bookshelf) (site estático, Firebase + login Google, hospedado
no GitHub Pages) que passa a puxar **deste** CWA — pra continuar sendo a "conta central", só que agora com
dados automáticos de leitura/audiobook também. Isso usa `GET /bookshelf/api/export`, autenticado por token
(não por sessão/cookie — um site de outra origem não consegue usar cookie daqui), com CORS liberado só pra
origem configurada.

Variáveis (ver `docker-compose.yml`/`.env.example`): `BOOKSHELF_EXPORT_TOKEN` (gere com
`openssl rand -hex 32`), `BOOKSHELF_EXPORT_USERNAME` (qual conta do CWA é exportada — é single-user por
natureza, não tem conceito de "qual usuário" além do token), `BOOKSHELF_EXPORT_ALLOWED_ORIGIN` (origem exata
do site, ex: `https://ro2342.github.io`, sem barra no final). Sem `BOOKSHELF_EXPORT_TOKEN`, o endpoint
retorna 404 — desligado por padrão.

Mecanismo técnico: `current_user` dentro do CWA normalmente vem da sessão via cookie, mas o próprio CWA já
tem um caminho alternativo pra isso (usado pelo OPDS com HTTP Basic Auth): setar `g.flask_httpauth_user`
antes de chamar a view faz `current_user` resolver pra esse usuário sem precisar de cookie nenhum
(`cps/cw_login/utils.py:_get_user`). O endpoint de export usa exatamente esse mecanismo, reaproveitando 100%
da lógica de `/api/data` (`_build_bookshelf_payload()`, compartilhada entre as duas rotas).

**Só leitura** — o CWA nunca é alterado por essa via, só lido.

Pro Audiobookshelf também aparecer automaticamente no `ro2342/bookshelf`: como o ABS só está na rede local
(sem túnel público), a sincronização direta do navegador com ele só funciona quando o dispositivo estiver
na mesma rede/VPN de casa. Adicione a origem do GitHub Pages em **Configurações → allowedOrigins** no
próprio Audiobookshelf (não use `ALLOW_CORS=1` — libera geral, menos seguro que a lista específica).

## Limitações conhecidas

- `ReadBook` do CWA não tem uma coluna de "data de término" dedicada — a Bookshelf aproxima usando
  `last_modified` de quando o status virou `lido`. Pode ser sobrescrita manualmente se a data automática
  estiver errada.
- Porta: em vez de fixar porta no Dockerfile (como a versão antiga fazia), use a variável de ambiente
  já suportada pelo CWA: `CWA_PORT_OVERRIDE=8342`.

## Acessando

- `http://seu-ip:8083/bookshelf` (ou a porta que você configurar via `CWA_PORT_OVERRIDE`).
