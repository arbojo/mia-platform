import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface DemoPaywallProps {
  isAuthenticated: boolean
}

export default function DemoPaywall({ isAuthenticated }: DemoPaywallProps) {
  return (
    <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-white">
      <CardHeader className="text-center">
        <CardTitle className="text-xl text-violet-900">
          Llegaste al límite de la demo
        </CardTitle>
        <CardDescription>
          Ya viste a MIA en acción. Ahora liberá todo su potencial.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>Tu asistente entrenado con tus productos y conocimientos</li>
          <li>MIA conversando con tus clientes por WhatsApp</li>
          <li>Memoria de cada cliente y seguimiento inteligente</li>
        </ul>
        {isAuthenticated ? (
          <Link href="/dashboard/onboarding" className="block">
            <Button className="w-full bg-violet-600 hover:bg-violet-700">
              Comenzar mi asistente
            </Button>
          </Link>
        ) : (
          <div className="space-y-2">
            <Link href="/signup?source=demo" className="block">
              <Button className="w-full bg-violet-600 hover:bg-violet-700">
                Crear mi asistente
              </Button>
            </Link>
            <Link href="/login" className="block">
              <Button variant="outline" className="w-full">
                Ya tengo cuenta
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
