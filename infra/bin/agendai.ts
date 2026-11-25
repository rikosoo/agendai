#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { AgendaiStack } from "../lib/agendai-stack";
import { CertificateStack } from "../lib/certificate-stack";
import { GithubOidcStack } from "../lib/github-oidc-stack";

/**
 * Parâmetros (via `-c chave=valor` ou infra/cdk.context.json). Todos opcionais:
 *   domainName      agendai.com.br        (ativa domínio próprio + HTTPS)
 *   hostedZoneId    Z0123...              (id da hosted zone criada no Route 53)
 *   alertEmail      time@agendai.com.br   (alarmes e orçamento)
 *   budgetUsd       50                    (orçamento mensal em dólares)
 *   sesFromEmail    no-reply@...          (remetente; padrão no-reply@<domainName>)
 *   githubRepo      owner/repo            (para o stack AgendaiGithubOidc)
 */
const app = new App();
const ctx = (k: string) => (app.node.tryGetContext(k) as string | undefined) || undefined;

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = "sa-east-1";
const domainName = ctx("domainName");
const hostedZoneId = ctx("hostedZoneId");

if (domainName && !hostedZoneId) throw new Error("Informe -c hostedZoneId=<id da hosted zone> junto com domainName");
if (domainName && !account) throw new Error("Com domínio próprio é preciso estar logado na AWS (CDK_DEFAULT_ACCOUNT)");

let cloudFrontCertificate;
if (domainName && hostedZoneId) {
  // Certificados usados no CloudFront precisam estar em us-east-1.
  const cert = new CertificateStack(app, "AgendaiCertificate", {
    env: { account, region: "us-east-1" },
    crossRegionReferences: true,
    domainName,
    hostedZoneId,
  });
  cloudFrontCertificate = cert.certificate;
}

new AgendaiStack(app, "AgendaiStack", {
  env: { account, region },
  crossRegionReferences: true,
  domainName,
  hostedZoneId,
  cloudFrontCertificate,
  alertEmail: ctx("alertEmail"),
  budgetUsd: Number(ctx("budgetUsd") ?? 50),
  sesFromEmail: ctx("sesFromEmail"),
});

new GithubOidcStack(app, "AgendaiGithubOidc", {
  env: { account, region },
  githubRepo: ctx("githubRepo") ?? "OWNER/agendai",
});
