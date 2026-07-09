# MyMemo AI Worker

Worker Python separado para processar jobs de transcricao por URL.

Fluxo:

1. Busca jobs `PENDING` no PostgreSQL.
2. Marca o job como `DOWNLOADING`.
3. Baixa midia publica com `yt-dlp`.
4. Converte para WAV mono 16 kHz com FFmpeg.
5. Transcreve com `faster-whisper`.
6. Agrupa blocos de frase ou ideia.
7. Traduz com Argos Translate local.
8. Substitui blocos antigos do job e marca `COMPLETED`.

## Setup

Instale o FFmpeg no sistema operacional e deixe o comando `ffmpeg` disponivel no `PATH`.

No Windows, se Chocolatey estiver instalado:

```powershell
choco install ffmpeg -y
```

Outra opcao e:

```powershell
winget install Gyan.FFmpeg
```

Depois feche e abra o PowerShell e confirme:

```powershell
where.exe ffmpeg
ffmpeg -version
```

Se voce ja tem o `ffmpeg.exe`, mas ele nao esta no `PATH`, configure o caminho direto no `worker-ai/.env`:

```env
FFMPEG_BINARY=C:\ffmpeg\bin\ffmpeg.exe
```

Instale ou atualize as dependencias Python:

```bash
npm run worker:install
```

O projeto de traducao se chama Argos Translate, mas o pacote publicado no PyPI e `argostranslate`.

Crie o `.env` do worker:

```bash
cp worker-ai/.env.example worker-ai/.env
```

Revise:

```env
DATABASE_URL=postgresql://postgres:12345@localhost:5432/mymemo?schema=public
WORKER_POLL_INTERVAL_SECONDS=5
WORKER_TEMP_DIR=.tmp
FFMPEG_BINARY=
WHISPER_MODEL=base
WHISPER_DOWNLOAD_ROOT=.models
WHISPER_LOCAL_FILES_ONLY=false
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
HF_CA_CERTS=
HF_NO_CHECK_CERTIFICATE=false
MAX_MEDIA_DURATION_SECONDS=1800
ARGOS_SOURCE_LANGUAGE=en
ARGOS_TARGET_LANGUAGE=pt
ARGOS_CA_CERTS=
ARGOS_NO_CHECK_CERTIFICATE=false
YTDLP_CA_CERTS=
YTDLP_NO_CHECK_CERTIFICATE=false
YTDLP_USER_AGENT=
YTDLP_ACCEPT_LANGUAGE=en-US,en;q=0.9
YTDLP_YOUTUBE_PLAYER_CLIENTS=android,mweb,web_safari
```

Instale o pacote de idioma do Argos. Por padrao, o comando usa `ARGOS_SOURCE_LANGUAGE=en` e `ARGOS_TARGET_LANGUAGE=pt`:

```bash
npm run worker:argos:install
```

Se o download do pacote Argos falhar com erro SSL, configure `ARGOS_CA_CERTS` com o certificado raiz em PEM, ou use `ARGOS_NO_CHECK_CERTIFICATE=true` apenas em desenvolvimento local confiavel. O instalador tambem respeita `HF_NO_CHECK_CERTIFICATE=true` e `YTDLP_NO_CHECK_CERTIFICATE=true` se eles ja estiverem no `.env`.

Durante a traducao, o Argos pode baixar dados do Stanza, por exemplo `stanfordnlp/stanza-en/.../combined.pt`, usando `requests`. O worker aplica as mesmas configuracoes de certificado nessa etapa: prefira `ARGOS_CA_CERTS` ou `HF_CA_CERTS`; em desenvolvimento local confiavel, `ARGOS_NO_CHECK_CERTIFICATE=true` ou `HF_NO_CHECK_CERTIFICATE=true` tambem desativa a verificacao para esse download.

## Rodar

Com backend, frontend e PostgreSQL ativos:

```bash
npm run worker:dev
```

## Erro SSL do yt-dlp

Se o worker falhar com `CERTIFICATE_VERIFY_FAILED`, rode novamente:

```bash
npm run worker:install
```

O worker usa `certifi` como bundle padrao de certificados. Se sua rede usa proxy corporativo com certificado proprio, exporte o certificado raiz em formato PEM e configure:

```env
YTDLP_CA_CERTS=C:\caminho\para\corporate-root-ca.pem
```

Como ultimo recurso em ambiente local confiavel, voce pode desativar a verificacao TLS do `yt-dlp`:

```env
YTDLP_NO_CHECK_CERTIFICATE=true
```

No PowerShell, para valer apenas na sessao atual:

```powershell
$env:YTDLP_NO_CHECK_CERTIFICATE="true"
npm run worker:dev
```

Use essa opcao apenas para desenvolvimento local, porque ela reduz a protecao contra interceptacao de trafego.

## Erro SSL ao baixar o Whisper

Na primeira transcricao, o `faster-whisper` baixa o modelo pelo Hugging Face Hub. Se falhar com `CERTIFICATE_VERIFY_FAILED` durante `transcribing`, voce tem tres caminhos:

1. Preferido em rede corporativa: exporte o certificado raiz em PEM e configure:

```env
HF_CA_CERTS=C:\caminho\para\corporate-root-ca.pem
```

2. Para desenvolvimento local confiavel, desative a verificacao TLS do Hugging Face Hub:

```env
HF_NO_CHECK_CERTIFICATE=true
```

3. Depois que o modelo estiver baixado em `worker-ai/.models`, rode sem internet:

```env
WHISPER_LOCAL_FILES_ONLY=true
```

Voce tambem pode apontar `WHISPER_MODEL` para uma pasta local ja convertida para CTranslate2, em vez de usar `base`, `small`, etc.

## HTTP 403 no download

Se o `yt-dlp` conseguir ler metadados, mas falhar com `HTTP Error 403: Forbidden` ao baixar a midia:

1. Atualize as dependencias do worker:

```bash
npm run worker:install
```

2. Reinicie o worker.

3. Se continuar, tente outro conjunto de clientes publicos do YouTube no `worker-ai/.env`:

```env
YTDLP_YOUTUBE_PLAYER_CLIENTS=mweb,android,web_safari,tv
```

Tambem e possivel configurar um `User-Agent` explicito:

```env
YTDLP_USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36
```

O worker nao usa cookies, login ou paywall. Alguns videos publicos ainda podem ser bloqueados pelo provedor, por regiao, idade, verificacao anti-bot ou mudancas temporarias do YouTube.

## Notas

- O worker nao processa nada dentro do Express.
- O worker remove blocos antigos antes de inserir novos para evitar duplicacao em reprocessamentos.
- Arquivos temporarios ficam em `WORKER_TEMP_DIR` e sao removidos ao final do job.
- URLs locais, localhost e IPs privados sao recusados tambem no worker.
- Nao use cookies, login ou conteudo privado.
- Modelos Whisper, caches e arquivos de midia nao devem ser commitados.
