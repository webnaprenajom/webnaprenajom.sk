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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="sk" dir="ltr">
    <Head />
    <Preview>Boli ste pozvaní do {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>
          <span style={brandGradient}>Web</span> na prenájom
        </Text>
        <Heading style={h1}>Pozvánka</Heading>
        <Text style={text}>
          Boli ste pozvaní pripojiť sa k{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Kliknutím na tlačidlo nižšie prijmete pozvánku a vytvoríte si účet.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Prijať pozvánku
        </Button>
        <Text style={footer}>
          Ak ste túto pozvánku neočakávali, tento e-mail môžete pokojne ignorovať.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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
