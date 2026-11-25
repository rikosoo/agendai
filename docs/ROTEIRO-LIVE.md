# Roteiro da live — do zero ao ar

Cada passo aponta o slide correspondente. Tempo total estimado: ~1 hora.

## Antes da live (feito uma vez)

- Node 22+, AWS CLI v2 e este repositório no GitHub.
- Domínio `.com.br` registrado no Registro.br (opcional: sem domínio tudo funciona com URLs `*.cloudfront.net` e `*.execute-api.*`).

---

## Ato 1 — Conta (slides 6–11)

Feito no **console**, porque é a parte que ensina:

1. Criar a conta com e-mail de grupo (`aws-root@...`), **Paid plan** (slide 7).
2. **MFA no root** com passkey/chave física; nunca criar access key do root (slide 8).
3. Criar a AWS Organization + **IAM Identity Center**; um usuário por pessoa, permission set `AdministratorAccess` (sessão de 4 h) para fundadores (slide 9).
4. **Budget** mensal com alertas de 50/80/100% e previsão (slide 10) — *ou* deixe o CDK criar com `-c alertEmail=... -c budgetUsd=...` (passo 6).
5. Região: **sa-east-1** (slide 11).

No terminal:

```bash
aws configure sso          # uma vez
aws sso login --profile agendai
export AWS_PROFILE=agendai
```

## Ato 2 — Arquitetura (slides 12–14)

Nada para clicar: a arquitetura da live **é** o `infra/lib/agendai-stack.ts`.
Mostre o arquivo ao explicar: Lambda arm64 (slide 13), DynamoDB on-demand com PITR e chaves `PK`/`SK` (slide 14).

## Ato 3 — Subindo (slides 15–25)

### 1. Domínio (slide 15) — opcional

1. Route 53 → **Hosted zones** → criar zona pública `agendai.com.br`.
2. Copiar os 4 servidores **NS** para o Registro.br.
3. Anotar o **Hosted zone ID** (`Z0123…`).

### 2. Bootstrap do CDK (uma vez)

```bash
cd infra
npx cdk bootstrap aws://CONTA/sa-east-1 aws://CONTA/us-east-1   # us-east-1 só se usar domínio (slide 11: certificado do CloudFront)
```

### 3. Deploy

**Sem domínio** (mais rápido para a live):

```bash
npm install
npm run deploy -- -c alertEmail=time@seudominio.com.br -c budgetUsd=50
```

**Com domínio** (slides 15–17 e 19):

```bash
npm run deploy -- \
  -c domainName=agendai.com.br -c hostedZoneId=Z0123456789ABC \
  -c alertEmail=time@agendai.com.br -c budgetUsd=50
```

O que o comando cria, na ordem dos slides:

| Slide | Recurso | Onde está no código |
|---|---|---|
| 16 | Certificado ACM `*.dominio` (DNS, us-east-1) | `certificate-stack.ts` |
| 17 | S3 privado + CloudFront com Origin Access Control, HTTP→HTTPS | `agendai-stack.ts` (`Site`, `Cdn`) |
| 18 | Lambda `agendai-api`, Node 22, arm64, role mínima | `Api` + `table.grantReadWriteData` |
| 19 | API Gateway HTTP, rotas, autorizador JWT do Cognito, `api.dominio` | `HttpApi`, `HttpJwtAuthorizer` |
| 20 | DynamoDB `agendai-main` on-demand + PITR | `Main` |
| 21 | Cognito User Pool + app client SPA sem secret | `Users`, `Web` |
| 22 | SES: identidade, DKIM no Route 53 | `SesDomain` |
| 26 | Alarmes (erros da Lambda, 5xx da API) → SNS → e-mail | `Alarme*` |
| 10 | Budget mensal | `Orcamento` |

No final: `SiteUrl` e `ApiUrl`. Abra a `SiteUrl`, clique em **Criar conta**, confirme o código recebido por e-mail e use o **Painel** para cadastrar o negócio.

> **Pegadinhas conhecidas**
> - **SES sandbox** (slide 22): enquanto a conta estiver no sandbox, só chegam e-mails para endereços verificados. Peça acesso de produção no console do SES. A reserva funciona normalmente mesmo se o e-mail falhar.
> - **Remetente sem domínio:** passe `-c sesFromEmail=voce@gmail.com` e clique no link de verificação que a AWS enviar.
> - O Cognito, sem SES configurado nele, envia no máximo ~50 códigos de confirmação por dia.
> - O CloudFront leva ~5 min para propagar no primeiro deploy.

### 4. Segredos (slide 23)

A Agendaí ainda não precisa de segredos. Quando precisar (ex.: gateway de pagamento):

```bash
aws ssm put-parameter --name /agendai/prod/gateway-pagamento --type SecureString --value '...'
```

e conceda leitura só ao caminho `/agendai/prod/*` na role da Lambda (`ssm.StringParameter.fromSecureStringParameterAttributes(...).grantRead(apiFn)`).

### 5. Deploy automático sem access key (slides 24–25)

1. Deploy **uma vez** da role OIDC, pelo seu terminal:

   ```bash
   cd infra
   npx cdk deploy AgendaiGithubOidc -c githubRepo=SEU_USUARIO/agendai
   ```

   Copie o `DeployRoleArn` impresso. A role só aceita **este repositório, branch `main`**, e só pode assumir as roles do `cdk bootstrap`.
2. No GitHub → *Settings → Secrets and variables → Actions → **Variables***:

   | Variável | Valor |
   |---|---|
   | `AWS_DEPLOY_ROLE_ARN` | o ARN acima |
   | `DOMAIN_NAME`, `HOSTED_ZONE_ID` | só se usar domínio |
   | `ALERT_EMAIL`, `BUDGET_USD` | opcionais |

3. `git push` na `main` → o workflow `deploy.yml` testa, builda e faz `cdk deploy`. **Nenhum segredo da AWS fica no GitHub.**

## Ato 4 — Operar (slides 26–33)

- Confirme a assinatura do SNS (e-mail da AWS) para receber os alarmes.
- Logs com retenção de 1 mês (padrão seria "nunca expirar").
- DynamoDB com point-in-time recovery e proteção contra exclusão.
- Cost Anomaly Detection: ligue no console (Billing → Cost Anomaly Detection) — complementa o budget.
- Throttling da API: 50 req/s (burst 100) em `HttpStage`; ajuste conforme o crescimento.

## Desfazer tudo

```bash
cd infra && npx cdk destroy AgendaiStack
```

A tabela DynamoDB e o User Pool têm `RETAIN` (proteção de dados): apague-os manualmente se quiser zerar a conta.
