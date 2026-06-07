/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="sk" dir="ltr">
    <Head />
    <Preview>Potvrďte svoj e-mail pre {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>
          <span style={brandGradient}>Web</span> na prenájom
        </Text>
        <Heading style={h1}>Potvrďte svoj e-mail</Heading>
        <Text style={text}>
          Ďakujeme za registráciu na{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          !
        </Text>
        <Text style={text}>
          Prosím, potvrďte svoju e-mailovú adresu (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) kliknutím na tlačidlo nižšie:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Overiť e-mail
        </Button>
        <Text style={footer}>
          Ak ste si nevytvorili účet, tento e-mail môžete pokojne ignorovať.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 28px' }
const brand = {
  fontSize: '18px',
  fontWeight: 'bold' as const,
  fontFamily: "'Space Grotesk', Arial, sans-serif",
  color: '#0f1724',
  margin: '0 0 28px',
}
const brandGradient = { color: '#1a9fff' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  fontFamily: "'Space Grotesk', Arial, sans-serif",
  color: '#0f1724',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55606d',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const link = { color: '#1a9fff', textDecoration: 'underline' }
const button = {
  backgroundColor: '#1a9fff',
  color: '#0f1724',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
