# MyMemo

MyMemo e um app web mobile-first de estudos por flash cards com perfil gamificado. Ele usa PostgreSQL para toda persistencia, Express/Prisma no backend e React/Vite no frontend.

## Requisitos

- Node.js 22.15+ recomendado
- npm 10+
- PostgreSQL 14+

## Setup local

1. Instale as dependencias:

```bash
npm install
npm run install:all
```

2. Crie o banco PostgreSQL:

```sql
CREATE DATABASE mymemo;
```

3. Configure o backend:

```bash
cp backend/.env.example backend/.env
```

Edite `backend/.env` se seu usuario, senha, host ou porta do PostgreSQL forem diferentes.

4. Rode migrations e seeds:

```bash
npm run db:migrate
npm run db:seed
```

5. Suba a aplicacao:

```bash
npm run dev
```

Depois acesse:

- Frontend: http://localhost:5173
- API: http://localhost:4000/api

## Transcrições por URL

A area `Transcrições` permite que Israel crie jobs assíncronos a partir de uma URL publica de video ou audio. O Express apenas cria e consulta jobs; o processamento pesado roda no worker Python separado em `worker-ai/`.

1. Rode a migration e seed normalmente:

```bash
npm run db:migrate
npm run db:seed
```

2. Configure as variaveis do backend em `backend/.env`:

```env
TRANSCRIPTION_MAX_PENDING_PER_USER=3
TRANSCRIPTION_MAX_URL_LENGTH=2000
TRANSCRIPTION_ALLOWED_TARGET_LANGUAGES="pt-BR,en,es"
TRANSCRIPTION_CREATE_LIST_MAX_BLOCKS=300
```

3. Instale o FFmpeg no sistema operacional e garanta que `ffmpeg` esteja no `PATH`.

- Windows com Chocolatey: `choco install ffmpeg -y`
- Windows com winget: `winget install Gyan.FFmpeg`
- macOS: `brew install ffmpeg`
- Linux: `sudo apt install ffmpeg`

No Windows, feche e abra o PowerShell depois da instalacao e valide com `where.exe ffmpeg`. Se o executavel existir mas nao estiver no `PATH`, configure `FFMPEG_BINARY=C:\caminho\para\ffmpeg.exe` no `worker-ai/.env`.

4. Configure o worker:

```bash
cp worker-ai/.env.example worker-ai/.env
npm run worker:install
npm run worker:argos:install
```

5. Suba backend e frontend:

```bash
npm run dev
```

6. Em outro terminal, rode o worker:

```bash
npm run worker:dev
```

O worker usa `yt-dlp`, FFmpeg, `faster-whisper` e Argos Translate localmente. No pip, o pacote do Argos Translate se chama `argostranslate`. Instale tambem o pacote de idiomas do Argos necessario, inicialmente `en -> pt`, antes de processar jobs reais.

Se o `yt-dlp` falhar com `CERTIFICATE_VERIFY_FAILED`, rode `npm run worker:install` para instalar `certifi`. Em redes com proxy corporativo, configure `YTDLP_CA_CERTS` no `worker-ai/.env` apontando para o certificado raiz em PEM. Para desenvolvimento local, existe `YTDLP_NO_CHECK_CERTIFICATE=true` como ultimo recurso; no PowerShell use `$env:YTDLP_NO_CHECK_CERTIFICATE="true"` antes de iniciar o worker.

Se o `yt-dlp` falhar com `HTTP Error 403: Forbidden`, atualize as dependencias com `npm run worker:install` e tente configurar `YTDLP_YOUTUBE_PLAYER_CLIENTS=mweb,android,web_safari,tv` no `worker-ai/.env`. O script `worker:install` usa `pip install -U`, entao tambem atualiza o `yt-dlp`. O worker continua sem usar cookies ou login.

Se o `faster-whisper` falhar ao baixar o modelo com `CERTIFICATE_VERIFY_FAILED` no Hugging Face Hub, configure `HF_CA_CERTS` no `worker-ai/.env` apontando para o certificado raiz em PEM. Para desenvolvimento local confiavel, use `HF_NO_CHECK_CERTIFICATE=true`. O modelo fica em `worker-ai/.models` quando `WHISPER_DOWNLOAD_ROOT=.models`.

Se a traducao falhar baixando `stanfordnlp/stanza-en/.../combined.pt`, e o Stanza usado pelo Argos Translate. Configure `ARGOS_CA_CERTS` ou `HF_CA_CERTS` com o certificado raiz em PEM. Para desenvolvimento local confiavel, `ARGOS_NO_CHECK_CERTIFICATE=true` ou `HF_NO_CHECK_CERTIFICATE=true` desativa essa verificacao tambem.

Limitacoes da primeira versao:

- Apenas Israel pode criar jobs, editar blocos e gerar listas.
- Sao aceitas apenas URLs publicas `http` e `https`; localhost e IPs privados sao bloqueados.
- O worker nao usa cookies, login, paywall ou APIs pagas.
- Videos muito longos sao recusados pelo limite `MAX_MEDIA_DURATION_SECONDS`.
- A traducao depende de pacotes Argos instalados localmente.

## Novidades recentes

- Tema claro e escuro com preferencia salva no navegador.
- Painel de dicas durante o jogo, com abas para o card atual e para todas as dicas.
- Dicas podem ser criadas, editadas e apagadas; elas ficam salvas localmente por perfil no navegador.
- O painel de dicas tem rolagem propria e pode ser reposicionado na tela.
- Dashboard com rankings dos 5 cards mais jogados, das 5 perguntas mais erradas e das 5 listas mais dificeis.
- Cards exibidos nos rankings podem ser abertos em uma previa com frente, verso e efeito de flip.
- Textos longos dos flash cards ajustam automaticamente o tamanho da fonte ao espaco disponivel.
- O gerenciamento permite minimizar e expandir cada lista para facilitar a navegacao.
- Sessoes em andamento podem ser encerradas pelo botao `Fechar jogo`.

## Login

- Sem login, todo mundo joga como `Player One`.
- Israel pode criar, editar, apagar, importar listas CSV e criar metas.
- Player One pode jogar listas existentes e acumular seu proprio historico.

## CSV

A importacao aceita CSV sem cabecalho:

- Coluna A: frente do card
- Coluna B: verso do card

Israel pode importar para uma lista nova ou adicionar os cards a uma lista existente. Ao final, o app mostra quantos cards foram importados.

## Regras implementadas

- 6 modos de jogo: Base, Spaced Lista, Spaced Geral e as 3 variantes Escrita.
- As variantes escritas nao corrigem automaticamente; o usuario digita, revela e marca se acertou ou errou.
- O card revela resposta pelo botao ou por clique no card, com efeito de flip.
- Toda sessao embaralha a ordem dos cards.
- Spaced Repetition usa apenas cards com erros registrados, ordenados por taxa de erro e erro mais recente.
- Pontuacao separada por direcao, frente e verso.
- Anti-grind: repetir a mesma lista em menos de 3 horas aplica base 0,5 e metade do multiplicador.
- Dashboard com historico filtravel, estatisticas por direcao, grafico de pontuacao, heatmap clicavel, conquistas, metas e rankings.
- O ranking de listas mais dificeis considera apenas listas com pelo menos 2 sessoes registradas.
- Dicas sao vinculadas ao card e separadas entre os perfis `Israel` e `Player One`.
- No gerenciamento, Israel pode renomear listas, minimizar seus paineis e criar, editar ou apagar cards.
- Listas deletadas somem das areas ativas, mas sessoes antigas continuam com o nome da lista salvo.

## Decisoes tecnicas

- A autenticacao e intencionalmente simples porque ha apenas dois perfis: o frontend guarda o perfil atual em `localStorage` e o backend valida a senha de Israel no login. As rotas administrativas tambem verificam o perfil via header.
- Tema e dicas tambem sao persistidos em `localStorage`; por isso, as dicas pertencem ao navegador atual e nao ao banco PostgreSQL.
- O historico de sessoes guarda `listTitle` alem do `listId`, preservando o dashboard quando uma lista e apagada.
- O app usa soft-delete em listas para evitar quebrar relatorios e tentativas antigas.

## Troubleshooting

Os scripts do Prisma usam o repositorio de certificados confiaveis do sistema operacional. Isso evita erros como `unable to get local issuer certificate` ao baixar os engines em redes com proxy corporativo.

Se o certificado raiz da empresa ainda nao estiver instalado, importe-o no repositorio de certificados confiaveis do sistema operacional e execute novamente `npm run db:migrate`.

Nao desative a validacao TLS com `NODE_TLS_REJECT_UNAUTHORIZED=0`.
