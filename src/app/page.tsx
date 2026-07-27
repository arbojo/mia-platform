import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-violet-900">MIA</h1>
          <div className="flex gap-4">
            <Link href="/login">
              <Button variant="ghost">Iniciar sesión</Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-violet-600 hover:bg-violet-700">
                Comenzar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 text-center space-y-8">
          <h2 className="text-5xl font-bold text-gray-900">
            Tu asistente de ventas{' '}
            <span className="text-violet-600">con inteligencia artificial</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Enseña a MIA sobre tu negocio, productos y reglas. Ella se encargará
            de vender y responder a tus clientes 24/7.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/demo">
              <Button size="lg" variant="outline">
                Probar demo
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="lg" className="bg-violet-600 hover:bg-violet-700">
                Crear mi asistente
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-gray-500">
          MIA - Asistente de Ventas IA
        </div>
      </footer>
    </div>
  )
}
