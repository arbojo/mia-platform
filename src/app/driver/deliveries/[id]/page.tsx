import { DeliveryDetail } from '@/components/driver/DeliveryDetail'

export const dynamic = 'force-dynamic'

export default async function DriverDeliveryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <DeliveryDetail visitId={id} />
}
