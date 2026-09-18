import type { Metadata } from 'next'
import '@/styles/catalogo.css'
import { CatalogExperience } from '@/components/catalogo/CatalogExperience'

export const metadata: Metadata = {
  title: 'Catálogo Vitanova',
  description: 'Explora los aliados de Vitanova para tu día a día.',
  robots: { index: false },
}

export default function CatalogoPage() {
  return <CatalogExperience />
}