import { Stack, type StackProps } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";

interface Props extends StackProps {
  domainName: string;
  hostedZoneId: string;
}

/** Certificado *.dominio em us-east-1 (exigência do CloudFront), validado por DNS no Route 53. */
export class CertificateStack extends Stack {
  readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);
    const zone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", { hostedZoneId: props.hostedZoneId, zoneName: props.domainName });
    this.certificate = new acm.Certificate(this, "Cert", {
      domainName: props.domainName,
      subjectAlternativeNames: [`*.${props.domainName}`],
      validation: acm.CertificateValidation.fromDns(zone),
    });
  }
}
