import * as path from "node:path";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cwActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as ses from "aws-cdk-lib/aws-ses";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type { Construct } from "constructs";

interface Props extends StackProps {
  domainName?: string;
  hostedZoneId?: string;
  cloudFrontCertificate?: acm.ICertificate;
  alertEmail?: string;
  budgetUsd: number;
  sesFromEmail?: string;
}

const ROOT = path.join(__dirname, "..", "..");

export class AgendaiStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);
    const { domainName, hostedZoneId } = props;
    const appDomain = domainName ? `app.${domainName}` : undefined;
    const apiDomain = domainName ? `api.${domainName}` : undefined;
    const zone =
      domainName && hostedZoneId ? route53.HostedZone.fromHostedZoneAttributes(this, "Zone", { hostedZoneId, zoneName: domainName }) : undefined;

    // ───────────────────────── Banco: DynamoDB on-demand + PITR ─────────────────────────
    const table = new dynamodb.TableV2(this, "Main", {
      tableName: "agendai-main",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
      globalSecondaryIndexes: [
        {
          indexName: "GSI1",
          partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
          sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
        },
      ],
    });

    // ───────────────────────── Login: Cognito ─────────────────────────
    const userPool = new cognito.UserPool(this, "Users", {
      userPoolName: "agendai-clientes",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: false }, fullname: { required: true, mutable: true } },
      passwordPolicy: { minLength: 8, requireLowercase: true, requireUppercase: true, requireDigits: true, requireSymbols: false },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { otp: true, sms: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const userPoolClient = userPool.addClient("Web", {
      userPoolClientName: "agendai-web",
      generateSecret: false, // SPA: sem secret
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
    });

    // ───────────────────────── E-mails: SES ─────────────────────────
    const sesFrom = props.sesFromEmail ?? (domainName ? `no-reply@${domainName}` : undefined);
    let sesIdentityArn: string | undefined;
    if (zone && domainName) {
      const identity = new ses.EmailIdentity(this, "SesDomain", { identity: ses.Identity.publicHostedZone(zone) });
      sesIdentityArn = `arn:aws:ses:${this.region}:${this.account}:identity/${domainName}`;
      identity.node.addMetadata("note", "DKIM publicado automaticamente no Route 53");
    } else if (sesFrom) {
      new ses.EmailIdentity(this, "SesEmail", { identity: ses.Identity.email(sesFrom) });
      sesIdentityArn = `arn:aws:ses:${this.region}:${this.account}:identity/${sesFrom}`;
    }

    // ───────────────────────── Site: S3 privado + CloudFront ─────────────────────────
    const siteBucket = new s3.Bucket(this, "Site", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY, // o site é recriável a partir do código
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, "Cdn", {
      comment: "Agendaí — site",
      defaultRootObject: "index.html",
      domainNames: appDomain ? [appDomain] : undefined,
      certificate: props.cloudFrontCertificate,
      ...(props.cloudFrontCertificate ? { minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021 } : {}),
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        compress: true,
      },
      // SPA: rotas do React Router caem no index.html
      errorResponses: [403, 404].map((httpStatus) => ({ httpStatus, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: Duration.seconds(0) })),
    });
    const appUrl = appDomain ? `https://${appDomain}` : `https://${distribution.distributionDomainName}`;

    // ───────────────────────── API: Lambda arm64 + API Gateway HTTP ─────────────────────────
    const lambdaEnv = { TABLE_NAME: table.tableName, APP_URL: appUrl, ...(sesFrom ? { SES_FROM: sesFrom } : {}), NODE_OPTIONS: "--enable-source-maps" };
    const lambdaBase = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      environment: lambdaEnv,
      bundling: { minify: true, sourceMap: true, target: "node22" },
      projectRoot: ROOT,
      depsLockFilePath: path.join(ROOT, "package-lock.json"),
    };

    const apiFn = new NodejsFunction(this, "Api", {
      ...lambdaBase,
      functionName: "agendai-api",
      entry: path.join(ROOT, "backend/src/handler.ts"),
      timeout: Duration.seconds(10),
      logGroup: new logs.LogGroup(this, "ApiLogs", { retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY }),
    });
    table.grantReadWriteData(apiFn); // menor privilégio: só a tabela da Agendaí

    const remindersFn = new NodejsFunction(this, "Reminders", {
      ...lambdaBase,
      functionName: "agendai-lembretes",
      entry: path.join(ROOT, "backend/src/reminders.ts"),
      timeout: Duration.minutes(5),
      logGroup: new logs.LogGroup(this, "RemindersLogs", { retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY }),
    });
    table.grantReadData(remindersFn);

    if (sesIdentityArn) {
      const sesPolicy = new iam.PolicyStatement({ actions: ["ses:SendEmail"], resources: [sesIdentityArn] });
      apiFn.addToRolePolicy(sesPolicy);
      remindersFn.addToRolePolicy(sesPolicy);
    }

    // Lembretes: todo dia às 08:00 de São Paulo (11:00 UTC)
    new events.Rule(this, "LembretesDiarios", {
      schedule: events.Schedule.cron({ minute: "0", hour: "11" }),
      targets: [new targets.LambdaFunction(remindersFn)],
    });

    const api = new apigw.HttpApi(this, "HttpApi", {
      apiName: "agendai-http",
      createDefaultStage: false,
      corsPreflight: {
        allowOrigins: [appUrl, "http://localhost:5173"],
        allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.POST, apigw.CorsHttpMethod.PUT, apigw.CorsHttpMethod.DELETE],
        allowHeaders: ["authorization", "content-type"],
        maxAge: Duration.hours(1),
      },
    });
    // Limite de requisições: protege a conta de abuso (e a fatura)
    const stage = new apigw.HttpStage(this, "DefaultStage", {
      httpApi: api,
      autoDeploy: true,
      throttle: { rateLimit: 50, burstLimit: 100 },
    });

    let apiUrl = stage.url.replace(/\/$/, "");
    if (zone && apiDomain) {
      const apiCert = new acm.Certificate(this, "ApiCert", { domainName: apiDomain, validation: acm.CertificateValidation.fromDns(zone) });
      const domain = new apigw.DomainName(this, "ApiDomain", { domainName: apiDomain, certificate: apiCert });
      new apigw.ApiMapping(this, "ApiMapping", { api, domainName: domain, stage });
      new route53.ARecord(this, "ApiAlias", {
        zone,
        recordName: "api",
        target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayv2DomainProperties(domain.regionalDomainName, domain.regionalHostedZoneId)),
      });
      apiUrl = `https://${apiDomain}`;
    }
    if (zone) {
      new route53.ARecord(this, "AppAlias", {
        zone,
        recordName: "app",
        target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
      });
    }

    const integration = new HttpLambdaIntegration("ApiIntegration", apiFn);
    const authorizer = new HttpJwtAuthorizer("Cognito", `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`, {
      jwtAudience: [userPoolClient.userPoolClientId],
      authorizerName: "cognito-agendai",
    });
    const M = apigw.HttpMethod;
    const publicas: [apigw.HttpMethod, string][] = [
      [M.GET, "/negocios"],
      [M.GET, "/negocios/{id}"],
      [M.GET, "/horarios"],
    ];
    const protegidas: [apigw.HttpMethod, string][] = [
      [M.POST, "/agendamentos"],
      [M.GET, "/agendamentos"],
      [M.DELETE, "/agendamentos/{id}"],
      [M.POST, "/negocios"],
      [M.GET, "/meu-negocio"],
      [M.PUT, "/meu-negocio"],
      [M.POST, "/meu-negocio/servicos"],
      [M.DELETE, "/meu-negocio/servicos/{id}"],
      [M.GET, "/meu-negocio/agendamentos"],
    ];
    for (const [method, p] of publicas) api.addRoutes({ path: p, methods: [method], integration });
    for (const [method, p] of protegidas) api.addRoutes({ path: p, methods: [method], integration, authorizer });

    // ───────────────────────── Deploy do site + config.json ─────────────────────────
    // O site lê /config.json em tempo de execução: o build do React não precisa conhecer a infra.
    new s3deploy.BucketDeployment(this, "DeploySite", {
      destinationBucket: siteBucket,
      sources: [
        s3deploy.Source.asset(path.join(ROOT, "frontend", "dist")),
        s3deploy.Source.jsonData("config.json", {
          apiUrl,
          region: this.region,
          userPoolId: userPool.userPoolId,
          userPoolClientId: userPoolClient.userPoolClientId,
        }),
      ],
      distribution,
      distributionPaths: ["/*"],
      memoryLimit: 512,
    });

    // ───────────────────────── Operar: alarmes + orçamento ─────────────────────────
    const alertas = new sns.Topic(this, "Alertas", { topicName: "agendai-alertas" });
    if (props.alertEmail) alertas.addSubscription(new subs.EmailSubscription(props.alertEmail));
    const acao = new cwActions.SnsAction(alertas);
    const alarme = (id: string, nome: string, metric: cloudwatch.IMetric, threshold = 5) =>
      new cloudwatch.Alarm(this, id, {
        alarmName: nome,
        metric,
        threshold,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }).addAlarmAction(acao);
    alarme("LambdaErrors", "agendai-api-erros", apiFn.metricErrors({ period: Duration.minutes(5), statistic: "Sum" }));
    alarme("LambdaThrottles", "agendai-api-throttles", apiFn.metricThrottles({ period: Duration.minutes(5), statistic: "Sum" }));
    alarme("Api5xx", "agendai-api-5xx", api.metricServerError({ period: Duration.minutes(5), statistic: "Sum" }));
    alarme("RemindersErrors", "agendai-lembretes-erros", remindersFn.metricErrors({ period: Duration.hours(1), statistic: "Sum" }), 1);

    if (props.alertEmail) {
      const notificacao = (tipo: string, limite: number) => ({
        notification: {
          notificationType: tipo,
          comparisonOperator: "GREATER_THAN",
          threshold: limite,
          thresholdType: "PERCENTAGE",
        },
        subscribers: [{ subscriptionType: "EMAIL", address: props.alertEmail! }],
      });
      new budgets.CfnBudget(this, "Orcamento", {
        budget: {
          budgetName: "agendai-mensal",
          budgetType: "COST",
          timeUnit: "MONTHLY",
          budgetLimit: { amount: props.budgetUsd, unit: "USD" },
        },
        notificationsWithSubscribers: [
          notificacao("ACTUAL", 50),
          notificacao("ACTUAL", 80),
          notificacao("ACTUAL", 100),
          notificacao("FORECASTED", 100),
        ],
      });
    }

    // ───────────────────────── Saídas ─────────────────────────
    new CfnOutput(this, "SiteUrl", { value: appUrl });
    new CfnOutput(this, "ApiUrl", { value: apiUrl });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
    new CfnOutput(this, "TableName", { value: table.tableName });
  }
}
