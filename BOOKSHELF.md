# Bookshelf: sidecar de exportação pro calibre-web-automated

## Histórico rápido

Esse projeto começou como um fork completo do
[calibre-web-automated](https://github.com/crocodilestick/calibre-web-automated) (CWA) com uma UI de
book tracker ("Bookshelf") embutida dentro dele. Funcionava, mas trazia de volta o problema original:
manter um fork em dia com um upstream ativo.

Com o [`ro2342/bookshelf`](https://github.com/ro2342/bookshelf) (site estático, Firebase + login Google,
hospedado no GitHub Pages) virando a interface principal de tracking, a única coisa que o CWA
realmente precisa fornecer é **dado de leitura pra ser lido de fora**. Esse repositório foi reduzido a
só isso: um **sidecar** pequeno e separado, sem nenhum fork do CWA.

## Arquitetura atual

```
calibre-web-automated (imagem oficial, sem fork)  --[SQLite, só leitura]-->  bookshelf-export-sidecar
                                                                                       |
                                                                              GET /api/export (token)
                                                                                       |
                                                                                       v
                                                                    ro2342/bookshelf (GitHub Pages, Firebase)
```

- **`calibre-web-automated`**: roda a imagem publicada oficialmente
  (`crocodilestick/calibre-web-automated:latest`). `docker compose pull` sempre pega a versão mais nova,
  sem build, sem CI, sem fork.
- **`sidecar/`**: um Flask bem pequeno que lê `app.db` (config do CWA) e `metadata.db` (biblioteca
  Calibre) direto via SQLite (`mode=ro`), monta a mesma resposta que o site espera, e serve em
  `GET /api/export` — autenticado por token, CORS liberado só pra origem do site. Não escreve nada em
  lugar nenhum. Ver `sidecar/app.py`.
- O `ro2342/bookshelf` puxa esse endpoint direto do navegador do usuário (a cada carregamento da
  página), casa os livros por título normalizado com o que já existe no Firestore, e só empurra
  status/progresso pra frente — nunca sobrescreve edição manual. A mesma lógica já existe lá pro
  Audiobookshelf.

## Por que sidecar em vez de fork

Trocar table/column do `app.db`/`metadata.db` por SQL direto é mais frágil, em teoria, do que usar os
modelos SQLAlchemy que o próprio CWA mantém — mas essas tabelas (`book_read_link`, `kobo_reading_state`,
`kobo_bookmark`, `shelf`, `book_shelf_link`, schema do Calibre) são estáveis e mudam raramente. Em troca,
o `calibre-web-automated` em si nunca precisa ser reconstruído, testado, ou ter conflito de merge — é
literalmente a imagem oficial, sempre atualizada com um `docker compose pull`.

## Configuração

Variáveis (ver `docker-compose.yml`/`.env.example`), todas pro serviço `bookshelf-export-sidecar`:

- `BOOKSHELF_EXPORT_TOKEN`: gere com `openssl rand -hex 32`. Em branco = endpoint desligado (404).
- `BOOKSHELF_EXPORT_USERNAME`: qual conta do CWA é exportada (é single-user por natureza).
- `BOOKSHELF_EXPORT_ALLOWED_ORIGIN`: origem exata do site, ex: `https://ro2342.github.io`.
- `BOOKSHELF_EXPORT_PORT`: porta publicada do sidecar no host (padrão 5000).

O sidecar builda local (`docker compose build`) — é só Python + Flask + waitress, sem Calibre/compilação
nenhuma, builda em segundos até num Raspberry Pi. Não tem pipeline de CI pra isso; não precisa.

## Limitações conhecidas

- `book_read_link` (CWA) não tem uma coluna de "data de término" dedicada — o sidecar aproxima usando
  `last_modified` de quando o status virou `lido` (`read_status = 1`).
- Capa (`/api/cover/<id>`) não é protegida por token — `<img src>` não manda headers customizados, e uma
  imagem de capa sozinha não é dado sensível.
- Se o CWA mudar o schema dessas tabelas numa versão futura, o sidecar (não o CWA) vai precisar de um
  ajuste de SQL. Isso deve ser raro, mas é o trade-off consciente de não usar os modelos do próprio CWA.

## O que sobrou do fork antigo neste repositório

O código-fonte completo do CWA (`cps/`, `Dockerfile`, etc.) ainda está no histórico/árvore deste
repositório, mas não é mais usado por nada em produção - `docker-compose.yml` não referencia mais
`build: .` pra ele. Fica como está por enquanto (removê-lo é um passo separado, não urgente).
