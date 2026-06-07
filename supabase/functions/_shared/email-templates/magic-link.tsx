/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="sk" dir="ltr">
    <Head />
    <Preview>Váš prihlasovací odkaz pre {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>
          <span style={brandGradient}>Web</span> na prenájom
        </Text>
        <Heading style={h1}>Prihlasovací odkaz</Heading>
        <Text style={text}>
          Kliknutím na tlačidlo nižšie sa prihlásite do {siteName}.
          Platnosť odkazu čoskoro vyprší.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Prihlásiť sa
        </Button>
        <Text style={footer}>
          Ak ste o tento odkaz nežiadali, tento e-mail môžete pokojne ignorovať.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
