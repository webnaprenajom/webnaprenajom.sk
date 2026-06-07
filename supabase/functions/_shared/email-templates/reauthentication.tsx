/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="sk" dir="ltr">
    <Head />
    <Preview>Váš overovací kód</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>
          <span style={brandGradient}>Web</span> na prenájom
        </Text>
        <Heading style={h1}>Overenie totožnosti</Heading>
        <Text style={text}>Použite kód nižšie na potvrdenie svojej identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Platnosť kódu čoskoro vyprší. Ak ste o tento kód nežiadali,
          tento e-mail môžete pokojne ignorovať.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

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
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#1a9fff',
  margin: '0 0 30px',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
