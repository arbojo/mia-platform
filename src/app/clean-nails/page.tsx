import type { Metadata } from 'next'
import { Bodoni_Moda, Jost } from 'next/font/google'
import { CleanNailsFunnel } from '@/components/clean-nails/CleanNailsFunnel'
import { WebChatWidget } from '@/components/widget/WebChatWidget'

const bodoni = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--cn-font-display',
})

const jost = Jost({
  subsets: ['latin'],
  variable: '--cn-font-body',
})

const BUSINESS_ID = '0d40a769-7a21-4cb3-9472-bdc9638675d6'
const WHATSAPP_URL = 'https://wa.me/524775250039'

export const metadata: Metadata = {
  title: 'Clean Nails - Luz para el cuidado de tus uñas',
  description:
    'Dispositivo de luz para el cuidado de la apariencia de tus uñas desde casa. 7 minutos, dos veces al día.',
}

export default function CleanNailsLanding() {
  return (
    <div
      data-atmosphere="clean-nails"
      className={`${bodoni.variable} ${jost.variable} bg-background`}
    >
      <CleanNailsFunnel />
      <WebChatWidget
        businessId={BUSINESS_ID}
        welcome="Hola, soy MIA 👋 Te ayudo con tus dudas sobre Clean Nails: cómo funciona, precios y envíos."
        position="left"
        whatsappUrl={WHATSAPP_URL}
      />
    </div>
  )
}
