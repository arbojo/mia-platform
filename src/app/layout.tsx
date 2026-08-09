import type { Metadata } from 'next'
import { Inter, Lora } from 'next/font/google'
import './globals.css'
import '@/styles/design-system.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const lora = Lora({ subsets: ['latin'], variable: '--font-lora' })

export const metadata: Metadata = {
  title: 'MIA - Asistente de Ventas IA',
  description: 'Tu asistente de ventas con inteligencia artificial',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${lora.variable} font-sans`}>{children}</body>
    </html>
  )
}
