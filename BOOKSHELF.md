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

## Limitações conhecidas

- `ReadBook` do CWA não tem uma coluna de "data de término" dedicada — a Bookshelf aproxima usando
  `last_modified` de quando o status virou `lido`. Pode ser sobrescrita manualmente se a data automática
  estiver errada.
- Porta: em vez de fixar porta no Dockerfile (como a versão antiga fazia), use a variável de ambiente
  já suportada pelo CWA: `CWA_PORT_OVERRIDE=8342`.

## Acessando

- `http://seu-ip:8083/bookshelf` (ou a porta que você configurar via `CWA_PORT_OVERRIDE`).
