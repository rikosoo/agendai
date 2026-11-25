import * as path from "node:path";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import type * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";

interface Props extends StackProps {
  domainName?: string;
  hostedZoneId?: string;
  certificate?: acm.ICertificate;
}

/** Só uma página: S3 privado + CloudFront (HTTPS). Sem API, banco ou login. */
export class PaginaStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);
    const { domainName, hostedZoneId } = props;

    const bucket = new s3.Bucket(this, "Pagina", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const cdn = new cloudfront.Distribution(this, "Cdn", {
      comment: "Agendaí — página",
      defaultRootObject: "index.html",
      domainNames: domainName ? [domainName, `www.${domainName}`] : undefined,
      certificate: props.certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        compress: true,
      },
      errorResponses: [403, 404].map((httpStatus) => ({ httpStatus, responseHttpStatus: 404, responsePagePath: "/index.html", ttl: Duration.minutes(1) })),
    });

    new s3deploy.BucketDeployment(this, "Deploy", {
      destinationBucket: bucket,
      sources: [s3deploy.Source.asset(path.join(__dirname, "..", "..", "pagina"))],
      distribution: cdn,
      distributionPaths: ["/*"],
    });

    if (domainName && hostedZoneId) {
      const zone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", { hostedZoneId, zoneName: domainName });
      const target = route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(cdn));
      new route53.ARecord(this, "Raiz", { zone, target });
      new route53.ARecord(this, "Www", { zone, recordName: "www", target });
    }

    new CfnOutput(this, "PaginaUrl", { value: domainName ? `https://${domainName}` : `https://${cdn.distributionDomainName}` });
  }
}
