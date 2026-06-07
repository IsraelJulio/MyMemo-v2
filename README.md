# MyMemo

MyMemo e um app web mobile-first de estudos por flash cards com perfil gamificado. Ele usa PostgreSQL para toda persistencia, Express/Prisma no backend e React/Vite no frontend.

## Requisitos

- Node.js 22+ recomendado
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

## Login

- Sem login, todo mundo joga como `Player One`.
- Para entrar como Israel, clique em `Israel` e informe a senha `123`.
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
- Dashboard com historico filtravel, estatisticas por direcao, heatmap clicavel, conquistas e metas.
- Listas deletadas somem das areas ativas, mas sessoes antigas continuam com o nome da lista salvo.

## Decisoes tecnicas

- A autenticacao e intencionalmente simples porque ha apenas dois perfis: o frontend guarda o perfil atual em `localStorage` e o backend valida a senha de Israel no login. As rotas administrativas tambem verificam o perfil via header.
- O historico de sessoes guarda `listTitle` alem do `listId`, preservando o dashboard quando uma lista e apagada.
- O app usa soft-delete em listas para evitar quebrar relatorios e tentativas antigas.

## Troubleshooting

Se `prisma generate` falhar com erro de certificado ao baixar engines da Prisma, rode apenas esse comando:

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED='0'; npm run prisma:generate --prefix backend
```

Use isso somente se a cadeia de certificados local bloquear o download.
