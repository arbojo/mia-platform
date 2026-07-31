import type { Metadata } from 'next'
import { WebChatWidget } from '@/components/widget/WebChatWidget'
import { OpenWidgetButton } from '@/components/widget/OpenWidgetButton'
import { Sparkles, Home, ShieldCheck, Clock, MessageCircle } from 'lucide-react'

const BUSINESS_ID = '0d40a769-7a21-4cb3-9472-bdc9638675d6'

export const metadata: Metadata = {
  title: 'Clean Nails - Luz UV para hongos de uñas',
  description:
    'Dispositivo de luz UV para tratar onicomicosis desde casa. Discreto, fácil de usar y sin visitas al salón.',
}

export default function CleanNailsLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-rose-50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold">
              C
            </span>
            <span className="text-xl font-bold text-rose-900">Clean Nails</span>
          </div>
          <OpenWidgetButton variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50">
            <MessageCircle className="w-4 h-4 mr-2" />
            Hablar con MIA
          </OpenWidgetButton>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-4 py-1 text-sm font-medium text-rose-700 mb-6">
            <Sparkles className="w-4 h-4" />
            Tratamiento de onicomicosis en casa
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 max-w-3xl mx-auto leading-tight">
            Di adiós a los hongos de las uñas con{' '}
            <span className="text-rose-600">Clean Nails</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mt-6">
            Dispositivo de luz UV diseñado para tratar el hongo de la uña
            (onicomicosis) desde la comodidad de tu hogar. Discreto, fácil de
            usar y sin visitas al salón.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <OpenWidgetButton className="bg-rose-600 hover:bg-rose-700 px-8 py-6 text-lg">
              Pregúntale a MIA
            </OpenWidgetButton>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Responde en segundos: uso, beneficios, precios y envíos.
          </p>
        </section>

        <section className="container mx-auto px-4 py-12">
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <Home className="w-8 h-8 text-rose-600 mb-3" />
              <h3 className="font-semibold text-gray-900">Desde tu hogar</h3>
              <p className="text-sm text-gray-600 mt-1">
                Rutina de cuidado sin salir de casa ni esperar turno en el salón.
              </p>
            </div>
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <ShieldCheck className="w-8 h-8 text-rose-600 mb-3" />
              <h3 className="font-semibold text-gray-900">Resultados graduales</h3>
              <p className="text-sm text-gray-600 mt-1">
                La luz UV actúa mientras la uña crece; la constancia es la clave.
              </p>
            </div>
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <Clock className="w-8 h-8 text-rose-600 mb-3" />
              <h3 className="font-semibold text-gray-900">Discreto y práctico</h3>
              <p className="text-sm text-gray-600 mt-1">
                Uso simple y cómodo, pensado para tu rutina diaria.
              </p>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16 text-center">
          <h2 className="text-3xl font-bold text-gray-900">¿Tienes dudas?</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mt-4">
            Habla con MIA, la asistente virtual de Clean Nails. Te cuenta cómo
            funciona, para quién es, y resuelve tus preguntas sobre precios y
            envíos.
          </p>
          <div className="mt-8">
            <OpenWidgetButton className="bg-rose-600 hover:bg-rose-700 px-8 py-6 text-lg">
              <MessageCircle className="w-5 h-5 mr-2" />
              Empezar a conversar
            </OpenWidgetButton>
          </div>
        </section>
      </main>

      <footer className="border-t bg-white/80">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-gray-500">
          Clean Nails · Tu asistente virtual está lista para ayudarte.
        </div>
      </footer>

      <WebChatWidget businessId={BUSINESS_ID} />
    </div>
  )
}
