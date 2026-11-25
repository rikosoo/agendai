# Agendaí

Agendamento online para salões, barbearias e consultórios — o projeto da live **"Do zero ao ar: subindo sua primeira empresa na AWS"**.
Site, login, API, banco, e-mails, alarmes e deploy, tudo como código.

```
Usuário → Route 53 → CloudFront → S3 privado (site React)
                   → API Gateway (HTTP) → Lambda (Node 22, arm64) → DynamoDB
        Cognito (login/JWT) · SES (e-mails) · CloudWatch + SNS (alarmes) · Budgets · GitHub Actions (OIDC)
```

## O que o site faz

| Para quem | Funcionalidades |
|---|---|
| Cliente | Buscar negócios por nome/cidade/categoria, ver serviços e horários, escolher data e horário livre, confirmar, ver e cancelar seus agendamentos, e-mail de confirmação e lembrete no dia anterior |
| Dono do negócio | Cadastrar o negócio, definir horário de funcionamento, criar/remover serviços, ver a agenda dia a dia, cancelar horários |

Sem conflito de horário: cada reserva grava os blocos de 30 min em **uma transação** do DynamoDB com `attribute_not_exists` — dois clientes nunca pegam o mesmo horário.

## Rodar localmente (sem AWS)

```bash
npm install
npm run dev        # http://localhost:5173
```

Sem `config.json`, o site abre em **modo demonstração** (dados no navegador). Já existe um usuário salvo:

| Login | Senha |
|---|---|
| `123456` | `123456` |

Esse usuário é dono do **Studio Bella** (com agenda de exemplo) e tem um agendamento na Barbearia do Zé.
O usuário `123456` existe **só no modo demonstração**: o Cognito exige senha forte (8+ caracteres), então na AWS você cria sua conta pela tela *Criar conta*.

## Subir na AWS

Passo a passo completo, na ordem da live: **[docs/ROTEIRO-LIVE.md](docs/ROTEIRO-LIVE.md)**.

Resumo (região `sa-east-1`, conta já com `aws sso login`):

```bash
npm install
(cd infra && npx cdk bootstrap)       # uma vez por conta/região (e us-east-1 se usar domínio)
npm run deploy                        # builda o site e sobe tudo
```

Ao final, o terminal imprime `SiteUrl` e `ApiUrl`. Abra a `SiteUrl`.

## Estrutura

```
shared/    tipos e regras puras (horários livres, validação) — usadas por site, API e demo
backend/   Lambda: handler.ts (API), reminders.ts (lembretes diários), db.ts, email.ts
frontend/  React + Vite (React Router); lê /config.json gerado pelo CDK
infra/     AWS CDK: stack principal, certificado (us-east-1) e role OIDC do GitHub
.github/   deploy.yml (push na main) e ci.yml (pull requests)
```

## Comandos

```bash
npm run typecheck   # TypeScript em todos os pacotes
npm test            # regras de horário + API (DynamoDB simulado)
npm run synth       # gera o CloudFormation sem publicar
```
