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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="sk" dir="ltr">
    <Head />
    <Preview>Obnovte si heslo pre {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>
          <span style={brandGradient}>Web</span> na prenájom
        </Text>
        <Heading style={h1}>Obnovenie hesla</Heading>
        <Text style={text}>
          Dostali sme žiadosť o obnovenie hesla pre váš účet na {siteName}.
          Kliknutím na tlačidlo nižšie si nastavíte nové heslo.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Obnoviť heslo
        </Button>
        <Text style={footer}>
          Ak ste o obnovenie hesla nežiadali, tento e-mail môžete pokojne ignorovať.
          Vaše heslo zostane nezmenené.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

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
