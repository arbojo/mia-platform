import type { TourDef } from '@/components/tour/types'

export const SHELL_TOUR: TourDef = {
  key: 'shell',
  steps: [
    { target: 'aside[aria-label="Navegación"]', titleKey: 'shell.nav.title', descKey: 'shell.nav.desc' },
    { target: '[data-tour="module-chip"]', titleKey: 'shell.module.title', descKey: 'shell.module.desc' },
    { target: '[data-tour="mia-indicator"]', titleKey: 'shell.mia.title', descKey: 'shell.mia.desc' },
  ],
}

const pageTours: Record<string, TourDef> = {
  '/dashboard': {
    key: 'home',
    steps: [
      { target: '[data-tour="home-vitals"]', titleKey: 'home.vitals.title', descKey: 'home.vitals.desc' },
      { target: '[data-tour="home-modules"]', titleKey: 'home.modules.title', descKey: 'home.modules.desc' },
      { target: '[data-tour="home-report"]', titleKey: 'home.report.title', descKey: 'home.report.desc' },
    ],
  },
  '/dashboard/conversations': {
    key: 'conversations',
    steps: [
      { target: '#conversation-search', titleKey: 'conversations.search.title', descKey: 'conversations.search.desc' },
      { target: '#conversation-status', titleKey: 'conversations.status.title', descKey: 'conversations.status.desc' },
      { target: '#conversation-assistant', titleKey: 'conversations.assistant.title', descKey: 'conversations.assistant.desc' },
      { target: '[data-tour="conversation-list"]', titleKey: 'conversations.list.title', descKey: 'conversations.list.desc' },
    ],
  },
  '/dashboard/knowledge': {
    key: 'knowledge',
    steps: [
      { target: '[data-tour="knowledge-tab-knowledge"]', titleKey: 'knowledge.tabKnowledge.title', descKey: 'knowledge.tabKnowledge.desc' },
      { target: '[data-tour="knowledge-tab-media"]', titleKey: 'knowledge.tabMedia.title', descKey: 'knowledge.tabMedia.desc' },
      { target: '[data-tour="knowledge-tab-instructions"]', titleKey: 'knowledge.tabInstructions.title', descKey: 'knowledge.tabInstructions.desc' },
      { target: '[data-tour="knowledge-tab-files"]', titleKey: 'knowledge.tabFiles.title', descKey: 'knowledge.tabFiles.desc' },
    ],
  },
  '/dashboard/knowledge-studio': {
    key: 'studio',
    steps: [
      { target: '[data-tour="studio-analyze"]', titleKey: 'studio.analyze.title', descKey: 'studio.analyze.desc' },
      { target: '[data-tour="studio-score"]', titleKey: 'studio.score.title', descKey: 'studio.score.desc' },
      { target: '[data-tour="studio-stats"]', titleKey: 'studio.stats.title', descKey: 'studio.stats.desc' },
      { target: '[data-tour="studio-suggestions"]', titleKey: 'studio.suggestions.title', descKey: 'studio.suggestions.desc' },
    ],
  },
  '/dashboard/catalog': {
    key: 'catalog',
    steps: [
      { target: '[data-tour="catalog-actions"]', titleKey: 'catalog.actions.title', descKey: 'catalog.actions.desc' },
      { target: '[data-tour="catalog-grid"]', titleKey: 'catalog.grid.title', descKey: 'catalog.grid.desc' },
    ],
  },
  '/dashboard/delivery': {
    key: 'delivery',
    steps: [
      { target: '[data-tour="delivery-routes"]', titleKey: 'delivery.tour.routes.title', descKey: 'delivery.tour.routes.desc' },
      { target: '[data-tour="delivery-drivers"]', titleKey: 'delivery.tour.drivers.title', descKey: 'delivery.tour.drivers.desc' },
      { target: '[data-tour="delivery-orders"]', titleKey: 'delivery.tour.orders.title', descKey: 'delivery.tour.orders.desc' },
      { target: '[data-tour="delivery-closures"]', titleKey: 'delivery.tour.closures.title', descKey: 'delivery.tour.closures.desc' },
    ],
  },
}

export function getPageTour(pathname: string): TourDef | null {
  return pageTours[pathname] ?? null
}

export function hasContextualTour(pathname: string): boolean {
  return pathname in pageTours
}
