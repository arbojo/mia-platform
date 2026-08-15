import type { TourDef } from '@/components/tour/types'

export const SHELL_TOUR: TourDef = {
  key: 'shell',
  steps: [
    { target: 'aside[aria-label="Navegación"]', titleKey: 'shell.nav.title', descKey: 'shell.nav.desc' },
    { target: '[data-tour="module-chip"]', titleKey: 'shell.module.title', descKey: 'shell.module.desc' },
    { target: '[data-tour="theme-toggle"]', titleKey: 'shell.theme.title', descKey: 'shell.theme.desc' },
    { target: '[data-tour="language-button"]', titleKey: 'shell.language.title', descKey: 'shell.language.desc' },
    { target: '[data-tour="signals-bell"]', titleKey: 'shell.signals.title', descKey: 'shell.signals.desc' },
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
  '/dashboard/catalog': {
    key: 'catalog',
    steps: [
      { target: '[data-tour="catalog-actions"]', titleKey: 'catalog.actions.title', descKey: 'catalog.actions.desc' },
      { target: '[data-tour="catalog-grid"]', titleKey: 'catalog.grid.title', descKey: 'catalog.grid.desc' },
    ],
  },
}

export function getPageTour(pathname: string): TourDef | null {
  return pageTours[pathname] ?? null
}

export function hasContextualTour(pathname: string): boolean {
  return pathname in pageTours
}
