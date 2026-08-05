import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReadinessScore } from '@/components/studio/ReadinessScore'

describe('ReadinessScore', () => {
  it('muestra el puntaje global y sus submetricas', () => {
    render(
      <ReadinessScore overall={85} completeness={90} consistency={70} readiness={80} />
    )

    expect(screen.getByText('Puntuación de Preparación')).toBeInTheDocument()
    expect(screen.getByText('85')).toBeInTheDocument()
    expect(screen.getByText('Muy bien')).toBeInTheDocument()
    expect(screen.getByText('Completitud')).toBeInTheDocument()
    expect(screen.getByText('Consistencia')).toBeInTheDocument()
    expect(screen.getByText('Preparación')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('70')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
  })

  it('muestra label Critico para puntaje bajo', () => {
    render(
      <ReadinessScore overall={25} completeness={10} consistency={20} readiness={15} />
    )

    expect(screen.getByText('Crítico')).toBeInTheDocument()
  })

  it('muestra label Excelente para puntaje alto', () => {
    render(
      <ReadinessScore overall={95} completeness={100} consistency={90} readiness={95} />
    )

    expect(screen.getByText('Excelente')).toBeInTheDocument()
  })
})
