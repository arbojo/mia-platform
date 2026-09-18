import type { ReactNode } from 'react'

export default function CatalogoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <script
        src="/pixel.js"
        data-business-id="4fb7418d-6c98-4a09-9094-4e4e4b2006a6"
        data-landing-id="catalogo"
        data-landing-version="v1"
        async
      />
    </>
  )
}