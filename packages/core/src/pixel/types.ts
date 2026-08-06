/**
 * Mia Pixel — shared types for landing-page telemetry.
 *
 * These types are the contract between the public pixel.js snippet, the
 * /api/pixel/track endpoint, and the landing_visits / landing_events tables.
 */

export const PIXEL_EVENT_NAMES = [
  'init_visit',
  'scroll_depth',
  'time_to_click',
  'whatsapp_click',
  'cta_click',
  'form_started',
  'form_submitted',
  'city_selected',
  'support_opt_in_enabled',
  'support_opt_in_disabled',
  'step_view',
  'step_completed',
  'offer_view',
  'order_request_created',
] as const

export type PixelEventName = (typeof PIXEL_EVENT_NAMES)[number]

export interface PixelVisitContext {
  landingId: string
  landingVersion?: string
  sessionToken: string
  assistantId?: string
  businessId?: string
  userAgent?: string
  deviceType?: string
  screenWidth?: number
  screenHeight?: number
  language?: string
  referrer?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  isBounce?: boolean
}

export interface PixelEventInput {
  visitId?: string
  sessionToken: string
  eventName: PixelEventName
  secondsFromStart: number
  value?: Record<string, unknown>
}

export interface PixelTrackRequest {
  visit: PixelVisitContext
  events: PixelEventInput[]
}

export interface PixelTrackResponse {
  visitId: string
  accepted: number
}
