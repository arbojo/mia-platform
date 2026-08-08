import { DriverLogin } from '@/components/driver/DriverLogin'

export const dynamic = 'force-dynamic'

export default async function DriverLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; d?: string }>
}) {
  const params = await searchParams

  if (!params.t || !params.d) {
    return (
      <div className="rounded-xl bg-white p-6 text-center shadow">
        <p className="text-slate-600">
          Accedé con el enlace que te envió tu administrador.
        </p>
      </div>
    )
  }

  return <DriverLogin token={params.t} driverId={params.d} />
}
