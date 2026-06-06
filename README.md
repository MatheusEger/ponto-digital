<p align="center">
  <img src="public/icon.png" width="64" height="64" alt="Ponto Digital">
</p>

<h1 align="center">Ponto Digital</h1>

<p align="center">
  App web de <strong>registro eletrônico de ponto</strong> para funcionarios em home office.<br>
  <strong>100% gratuito</strong> rodando no Vercel (Hobby) + Turso (SQLite).
</p>

---

- **Funcionario** acessa `/`, identifica o dispositivo via cookie JWT e bate ponto (entrada, pausas, saida) em ate 3 cliques.
- **Admin** acessa `/admin` (senha inicial `admin123`), gerencia funcionarios, registros, relatorios PDF, configuracoes e backup JSON.
- **Relatorio diario por email** automatico as 23h — admin recebe consolidado, cada funcionario recebe comprovante individual.
- **Observacao de saida** — campo obrigatorio ao registrar qualquer saida, funciona como canal de comunicacao funcionario -> admin.
- **Banco de horas** — saldo acumulado por funcionario (credito/debito), visivel no dashboard admin.
- **Periodo de excecao (hora extra)** — funcionario pode abrir turno extra apos encerrar expediente normal, com alertas automaticos e email de aviso as 22h.
- **Reabertura de expediente** — se o funcionario encerrou por engano (< 3 min) ou antes de completar a jornada (< 8h, antes das 18h), pode reabrir clicando em ENTRADA novamente.
- **Envio manual de relatorio** — admin pode disparar o email consolidado + comprovantes a qualquer momento via botao no dashboard.
- **Reply-To inteligente** — funcionario pode responder o comprovante direto para o email profissional do admin (configuravel).
- **Captcha no login admin** — protecao contra bots no formulario de autenticacao.
- **Datas no padrao brasileiro** — todas as datas no app, emails, PDFs e nomes de arquivos usam DD/MM/YYYY.

> Desenvolvido por **[Ary Ribeiro](mailto:aryribeiro@gmail.com)** — [LinkedIn](https://www.linkedin.com/in/aryribeiro) | [GitHub](https://github.com/aryribeiro)

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript strict, Tailwind |
| UI | Componentes proprios + sonner (toasts) + zustand (loading) |
| Backend | Next.js Route Handlers + libSQL (Turso) |
| Auth | bcryptjs (cost 12) + jose (JWT HS256) |
| Email | Nodemailer + Gmail SMTP (App Password) com imagens inline via CID |
| PDF | @react-pdf/renderer + jszip (bulk export) |
| Anti-fraude | Cookie JWT HttpOnly + 2FA por email |
| Cron | Vercel Cron Jobs (`*/15 * * * *` — 2 jobs) |

---

## Deploy no Vercel — receita de bolo

> Tempo total: **~20 minutos** (incluindo cadastros nas plataformas).

### 1. Criar contas gratuitas (3 cadastros)

- **GitHub** — <https://github.com/signup>
- **Vercel** — <https://vercel.com/signup> -> "Continue with GitHub"
- **Turso** — <https://app.turso.tech/sign-up> -> "Continue with GitHub"

### 2. Criar o banco de dados no Turso

Acesse o dashboard: **https://app.turso.tech** -> login com GitHub.

1. Clique em **Create Database**
2. Nome: `ponto-digital` -> regiao: deixe a padrao (mais proxima)
3. Apos criar, copie a **Database URL** (formato `libsql://ponto-digital-xxx.turso.io`)
4. Va em **Create Token** -> copie o token gerado

> Anote a URL e o token. Voce vai precisar deles na etapa 5.

### 3. Gerar a App Password do Gmail

1. Acesse <https://myaccount.google.com/security> e ative a **Verificacao em duas etapas (2FA)**
2. Acesse <https://myaccount.google.com/apppasswords>
3. Em **Nome do app**, digite `Ponto Digital` -> clique em **Criar**
4. Copie os **16 digitos sem espacos** (ex: `abcdefghijklmnop`)

> App Password so funciona se 2FA estiver ativo. Senha normal do Gmail **nao funciona** via SMTP.

### 4. Subir o codigo para o GitHub

No terminal, dentro da pasta do projeto:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/ponto-digital.git
git push -u origin main
```

### 5. Deploy no Vercel

1. Acesse <https://vercel.com/new>
2. Clique em **Import** ao lado do repositorio `ponto-digital`
3. Em **Configure Project**, expanda **Environment Variables** e cole as 6 variaveis abaixo:

| Nome | Valor |
|---|---|
| `TURSO_DATABASE_URL` | A URL `libsql://...` da etapa 2 |
| `TURSO_AUTH_TOKEN` | O token `eyJ...` da etapa 2 |
| `JWT_SECRET` | Gere no terminal: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `CRON_SECRET` | Rode o mesmo comando acima para gerar outro valor diferente |
| `GMAIL_USER` | Seu email Gmail completo |
| `GMAIL_APP_PASSWORD` | Os 16 digitos da etapa 3 |
| `NEXT_PUBLIC_APP_URL` | Deixe `https://ponto-digital.vercel.app` (ajuste depois com a URL real) |

4. Clique em **Deploy** e aguarde ~2 minutos
5. Apos o deploy, copie a URL final (ex: `https://ponto-digital-abc.vercel.app`) e atualize a variavel `NEXT_PUBLIC_APP_URL` em **Settings -> Environment Variables** -> redeploy

### 6. Aplicar o schema no banco Turso

No seu terminal local, com `.env.local` configurado igual ao Vercel, rode:

```bash
npm install
npm run db:setup
```

Saida esperada:

```
[db:setup] Applied 10 SQL statements.
[db:setup] Seeded admin_config with default password "admin123".
```

> Esse script e idempotente — pode rodar varias vezes sem duplicar dados.

### 7. Verificar os crons

1. No dashboard do Vercel -> seu projeto -> aba **Cron Jobs**
2. Confirme que os 2 crons aparecem:
   - `/api/cron/daily-report` — envia relatorio diario ao admin as 23h
   - `/api/cron/overtime-alert` — envia alerta individual ao funcionario que nao bateu saida as 22h
3. Ambos executam `*/15 * * * *` e so agem dentro da sua janela de horario
4. Clique em **Run** para forcar uma execucao de teste e ver os logs

### 8. Primeiro acesso ao painel admin

1. Abra `https://seu-dominio.vercel.app/admin/login`
2. Senha: `admin123`
3. **Imediatamente** va em **Trocar senha** e defina uma senha forte
4. Em **Configuracoes**, preencha:
   - **Email do administrador** (destino do relatorio consolidado)
   - **Email profissional** (reply-to nos comprovantes dos funcionarios)
   - **Horario do envio** (padrao: 23:00)
5. Em **Funcionarios**, cadastre o primeiro funcionario

Pronto! App em producao.

---

## Rodar localmente (opcional)

```bash
# 1. Clonar
git clone https://github.com/SEU-USUARIO/ponto-digital.git
cd ponto-digital

# 2. Instalar
npm install

# 3. Criar .env.local com as mesmas variaveis (use file:./local.db para SQLite local)
echo "TURSO_DATABASE_URL=file:./local.db" > .env.local
# ...complete as outras variaveis

# 4. Aplicar schema + seed
npm run db:setup

# 5. Rodar dev server
npm run dev
# Abra http://localhost:3000
```

---

## Sistema de Emails

O app envia emails inline com logo via CID attachment (compativel com Gmail, Outlook, etc). Dois tipos de email as 23h (mesmo cron, mesmo disparo). **Se ninguem trabalhou no dia, nenhum email e enviado.**

| Destinatario | Conteudo |
|---|---|
| **Admin** | Relatorio consolidado: todos os funcionarios, horarios, IPs, horas trabalhadas, anomalias e observacoes de saida |
| **Cada funcionario** | Comprovante individual com apenas os dados dele (recibo pessoal) |

**Configuracao de enderecos (em Configuracoes do admin):**
- **Email do administrador** — recebe o relatorio consolidado (TO)
- **Email profissional do administrador** — usado como `Reply-To` nos comprovantes dos funcionarios

O Gmail configurado no `.env` e apenas o remetente SMTP (nao monitorado). Quando o funcionario responde o comprovante, a resposta vai para o email profissional do admin.

---

## Observacao de Saida

Toda vez que um funcionario registra saida (normal, hora extra ou excecao), um campo de texto obrigatorio aparece:

- **Minimo:** 2 caracteres
- **Maximo:** 500 caracteres
- **Finalidade:** canal de comunicacao funcionario -> admin (relato do que foi feito no expediente)
- **No email:** aparece dentro do card do funcionario, na secao "Relato do funcionario"
- **Retencao:** armazenado permanentemente no banco de dados (historico completo)

---

## Banco de Horas

O dashboard do admin exibe uma tabela com o **saldo acumulado** de cada funcionario ativo:

| Coluna | Descricao |
|---|---|
| Dias trabalhados | Dias com ENTRADA + SAIDA completos |
| Horas trabalhadas | Total liquido (descontando pausas, somando periodo extra) |
| Horas esperadas | Dias trabalhados x 8h (jornada padrao 09h-18h) |
| Saldo | Diferenca entre trabalhado e esperado |
| Status | **Credito** (positivo), **Debito** (negativo), ou **Pode folgar 1 dia** (>= 8h de credito) |

O calculo e acumulativo desde o primeiro registro do funcionario. Inclui horas de periodos de excecao.

---

## Periodo de Excecao (Hora Extra)

Para cenarios em que o funcionario precisa trabalhar fora do expediente normal:

**Fluxo automatico:**
1. As **22:00** — email enviado automaticamente ao funcionario que ainda nao registrou SAIDA
2. As **22:59+** — alerta visual na tela do funcionario com duas opcoes:
   - Bater SAIDA normalmente (entra no relatorio do dia)
   - Confirmar "hora extra" (continua trabalhando, SAIDA entra no relatorio do proximo dia util)
3. As **23:00** — relatorio enviado ao admin com os registros ate aquele momento

**Cenario "voltou a trabalhar depois de bater SAIDA":**
- Apos a SAIDA normal, o funcionario pode abrir um **periodo de excecao** na tela
- Registra `ENTRADA_EXTRA` -> trabalha -> registra `SAIDA_EXTRA`
- Permitido 1 periodo extra por dia
- Horas contabilizadas no banco de horas e no relatorio do proximo dia util

**Reabertura de expediente:**
- Se a saida foi acidental (< 3 minutos de jornada) ou prematura (< 8h trabalhadas e antes das 18h), o botao ENTRADA fica habilitado para reabrir o turno
- Apos reabrir, os botoes de pausa e saida voltam a funcionar normalmente
- Nao e necessario abrir periodo de excecao neste caso

---

## Seguranca

**Modelo de confianca (JWT-only):**
- O funcionario vincula o dispositivo via 2FA por email (codigo de 6 digitos, 10min de validade, 3 tentativas)
- Apos vinculacao, recebe um cookie JWT (`pd_session`, HttpOnly + Secure + SameSite=Strict, 30 dias)
- Todas as requisicoes sao autenticadas exclusivamente pelo JWT (assinatura + expiracao)
- Se o admin resetar o dispositivo, o funcionario precisa refazer o primeiro acesso

**Login admin:**
- Senha com bcrypt (cost 12)
- Captcha obrigatorio no formulario de login
- JWT separado (`pd_admin`, 12h de duracao)

**Para casos legitimos (troca de navegador/notebook):**
- Admin reseta o `device_hash` em **Funcionarios -> Resetar device**
- Funcionario refaz o primeiro acesso com 2FA

---

## Troubleshooting

| Sintoma | Causa provavel | Solucao |
|---|---|---|
| Email retorna `535 Username and Password not accepted` | App Password incorreta | Refaca em <https://myaccount.google.com/apppasswords>, cole **sem espacos** |
| Cron nao dispara | Plano Hobby do Vercel pode atrasar ate 1h | Para testar imediatamente: clique em **Run** no dashboard de Cron Jobs |
| Funcionario pede para trocar de browser | `device_hash` ficou no antigo | Admin reseta em **Funcionarios -> Resetar device** |
| Funcionario nao consegue registrar saida | Campo de observacao nao preenchido (min. 2 chars) | O campo e obrigatorio — orientar o funcionario a preencher |
| Funcionario responde o email mas admin nao recebe | `Reply-To` nao configurado | Admin deve preencher o email profissional em **Configuracoes** |
| Logo nao aparece no email | Cliente de email bloqueia imagens externas | Ja tratado com CID inline — funciona no Gmail, Outlook, etc. |
| Funcionario agarrado na tela de primeiro acesso | Admin resetou dispositivo | Funcionario deve digitar email e completar 2FA normalmente |

---

## Estrutura

```
ponto-digital/
├─ app/
│  ├─ admin/                  # Painel admin (login, dashboard, CRUD, etc.)
│  ├─ api/
│  │  ├─ ponto/              # POST registro + GET status do turno
│  │  ├─ admin/send-report/  # POST envio manual de relatorio
│  │  ├─ banco-horas/        # GET saldo acumulado (admin)
│  │  ├─ cron/
│  │  │  ├─ daily-report/    # Relatorio diario as 23h
│  │  │  └─ overtime-alert/  # Alerta individual as 22h
│  │  ├─ ip/                 # GET IP real do cliente
│  │  └─ ...                 # auth, employees, records, config, backup, reports
│  ├─ primeiro-acesso/        # Fluxo 2FA do funcionario
│  ├─ layout.tsx              # Layout raiz com footer global
│  └─ page.tsx                # Pagina de bater ponto (mobile-first)
├─ components/
│  ├─ ui/                     # Button, Input, Card, Dialog, etc.
│  ├─ AdminNav.tsx
│  └─ SendReportButton.tsx    # Botao de envio manual de relatorio
├─ db/
│  ├─ schema.sql              # Tabelas + indices
│  └─ setup.ts                # Bootstrap + seed do admin
├─ lib/
│  ├─ bancoHoras.ts           # Calculo de saldo acumulado por funcionario
│  ├─ dailyReport.ts          # Templates de email (admin + comprovante funcionario)
│  ├─ overtimeAlert.ts        # Email de alerta para turno aberto as 22h
│  ├─ email.ts                # Nodemailer (suporta to, cc, replyTo, CID attachments)
│  ├─ pdf.tsx                 # Geracao de PDF mensal com logo
│  ├─ timezone.ts             # Formatacao de datas (padrao brasileiro)
│  └─ ...                     # db, auth, fingerprint, validation, etc.
├─ public/
│  └─ icon.png                # Logo do app (128x128, usada em emails, PDF e UI)
├─ middleware.ts              # Protege rotas /admin e /api/admin
└─ vercel.json                # 2 crons + maxDuration
```

---

## Criterios de aceite

- [x] Funcionario bate ponto em 3 cliques ou menos
- [x] IP real capturado (`x-forwarded-for[0]`)
- [x] Autenticacao por JWT (cookie HttpOnly, 30 dias)
- [x] 2FA por email para vinculacao de dispositivo
- [x] Login admin com captcha e troca de senha obrigatoria
- [x] Mensagens genericas em auth (sem enumeration)
- [x] Export JSON completo (funcionarios, registros, notas e config)
- [x] Import upsert por email (restaura backup)
- [x] Cron protegido por Bearer + idempotencia via `last_report_sent_at`
- [x] PDF mensal individual e ZIP bulk com logo
- [x] Spinner global em todas as escritas
- [x] Writes serializados (fila in-process)
- [x] Banco de horas com saldo acumulado (credito/debito) no dashboard
- [x] Periodo de excecao (ENTRADA_EXTRA / SAIDA_EXTRA) para hora extra
- [x] Reabertura de expediente (saida acidental ou prematura)
- [x] Email de alerta as 22h para funcionario com turno aberto
- [x] IP real do funcionario exibido no rodape com data/hora em tempo real
- [x] Relatorio diario configurado para 23h (permite turnos estendidos)
- [x] Envio manual de relatorio pelo admin (botao no dashboard)
- [x] Observacao de saida obrigatoria (canal funcionario -> admin)
- [x] Comprovante individual por email para cada funcionario
- [x] Reply-To configuravel (email profissional do admin)
- [x] Logo inline nos emails via CID (compativel com Gmail)
- [x] Logo no PDF e na tela de primeiro acesso
- [x] Todas as datas no padrao brasileiro (DD/MM/YYYY)
- [x] Relatorio diario nao enviado em dias sem atividade

---

## Autor

**Ary Ribeiro**

- [aryribeiro@gmail.com](mailto:aryribeiro@gmail.com)
- [linkedin.com/in/aryribeiro](https://www.linkedin.com/in/aryribeiro)
- [github.com/aryribeiro](https://github.com/aryribeiro)

---

## Licenca

MIT — uso pessoal e comercial livre.
