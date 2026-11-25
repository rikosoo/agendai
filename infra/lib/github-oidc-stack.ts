import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

interface Props extends StackProps {
  githubRepo: string; // owner/repo
}

/**
 * Deploy sem access key: o GitHub Actions prova quem é via OIDC e assume esta role.
 * A role só aceita o repositório informado, na branch main, e só pode assumir as roles do `cdk bootstrap`.
 * Faça o deploy deste stack UMA vez, do seu terminal (aws sso login).
 */
export class GithubOidcStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const provider = new iam.OpenIdConnectProvider(this, "GithubProvider", {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"],
    });

    const role = new iam.Role(this, "DeployRole", {
      roleName: "agendai-github-deploy",
      maxSessionDuration: Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": `repo:${props.githubRepo}:ref:refs/heads/main`,
        },
      }),
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*`],
      }),
    );

    new CfnOutput(this, "DeployRoleArn", { value: role.roleArn, description: "Coloque em AWS_DEPLOY_ROLE_ARN (GitHub > Settings > Variables)" });
  }
}
