import { MiaSpinner } from '@/components/ui/mia-spinner'

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <MiaSpinner className="h-10 w-10" />
    </div>
  )
}
