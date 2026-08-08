import { redirect } from 'next/navigation'

export default async function ProductsPage() {
  redirect('/dashboard/catalog')
}
