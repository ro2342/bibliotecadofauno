# Biblioteca do Fauno (Calibre-Web Fork)

O **Biblioteca do Fauno** é uma versão customizada do [Calibre-Web](https://github.com/janeczku/calibre-web) que integra a interface visual "Bookshelf" para monitoramento de leitura.

Esta versão modifica o backend original para substituir dependências externas (como Firebase) pelo próprio banco de dados do Calibre-Web e adiciona suporte nativo para Docker em arquitetura ARM (Raspberry Pi).

## Funcionalidades Adicionadas

- **Interface Bookshelf Integrada**: Acesse sua biblioteca através de `/bookshelf` com uma interface moderna e responsiva.
- **No More Firebase**: Todo o armazenamento de progresso de leitura, avaliações e configurações de usuário agora é feito localmente no banco de dados SQLite do Calibre-Web.
- **Porta Customizada**: A aplicação roda por padrão na porta **8342** (ao invés da 8083 original), para evitar conflitos com outras instâncias.
- **Suporte a Raspberry Pi**: Inclui Dockerfile otimizado e workflows automáticos para gerar imagens compatíveis com ARM64.

## Como Usar (Docker)

Esta é a forma recomendada de instalação. A imagem é construída automaticamente a cada atualização no GitHub.

### Rodando o Container

```bash
docker run -d \
  --name=calibre-web-bookshelf \
  -p 8342:8342 \
  -v /caminho/para/sua/biblioteca/calibre:/app/library \
  -v /caminho/para/sua/configuracao:/app/config \
  --restart unless-stopped \
  ghcr.io/ro2342/bibliotecadofauno:latest
```

_Substitua `/caminho/para/sua/...` pelos caminhos reais onde estão seus livros e arquivos de configuração._

### Acessando

- **Interface Principal**: `http://seu-ip:8342/`
- **Bookshelf (Nova Interface)**: `http://seu-ip:8342/bookshelf`

## Desenvolvimento

As principais modificações neste fork estão em:

- `cps/bookshelf.py`: Novo blueprint Flask que gerencia a API da Bookshelf.
- `cps/static/bookshelf/`: Arquivos frontend (JS/CSS) da interface Bookshelf.
- `cps/templates/bookshelf_app.html`: Template principal da nova interface.
- `Dockerfile`: Configuração de build multi-arquitetura.

---

_Este projeto é um fork do [Calibre-Web](https://github.com/janeczku/calibre-web)._
