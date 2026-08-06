(function() {
  'use strict'

  // Mia Pixel — ultraligero (ADR-015)
  // Lee data-assistant-id (o data-business-id) para resolver el tenant.
  // Self-ignora en localhost y cuando mia_mode === 'developer'.

  var scriptEl = document.currentScript
  if (!scriptEl) return

  var config = {
    assistantId: scriptEl.getAttribute('data-assistant-id') || '',
    businessId: scriptEl.getAttribute('data-business-id') || '',
    landingId: scriptEl.getAttribute('data-landing-id') || '',
    landingVersion: scriptEl.getAttribute('data-landing-version') || 'v1',
    endpoint: scriptEl.getAttribute('data-endpoint') || '',
    debounceMs: 400
  }

  if (!config.businessId && !config.assistantId) {
    console.warn('[MIA Pixel] data-assistant-id o data-business-id requerido')
    return
  }

  var isLocal = /^localhost$/.test(window.location.hostname) || window.location.hostname === '127.0.0.1'
  var isDevMode = false
  try {
    isDevMode = window.localStorage.getItem('mia_mode') === 'developer'
  } catch { /* storage bloqueado */ }

  if (isLocal || isDevMode) {
    console.info('[MIA Pixel] desactivado (localhost / mia_mode=developer)')
    return
  }

  var baseUrl = config.endpoint
  if (!baseUrl) {
    baseUrl = scriptEl.src.replace(/\/pixel\.js.*$/, '')
  }
  var trackUrl = baseUrl + '/api/pixel/track'

  function generateSessionToken() {
    var key = 'mia_pixel_visit'
    try {
      var existing = sessionStorage.getItem(key)
      if (existing) return existing
    } catch { /* noop */ }
    var token = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
    try {
      sessionStorage.setItem(key, token)
    } catch { /* noop */ }
    return token
  }

  function getUtmParam(name) {
    return new URLSearchParams(window.location.search).get('utm_' + name) || ''
  }

  function detectDeviceType() {
    var w = window.innerWidth
    if (w < 768) return 'mobile'
    if (w < 1024) return 'tablet'
    return 'desktop'
  }

  function visitContext() {
    return {
      landingId: config.landingId,
      landingVersion: config.landingVersion,
      sessionToken: sessionToken,
      assistantId: config.assistantId || undefined,
      businessId: config.businessId || undefined,
      userAgent: navigator.userAgent,
      deviceType: detectDeviceType(),
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      language: navigator.language,
      referrer: document.referrer || '',
      utmSource: getUtmParam('source'),
      utmMedium: getUtmParam('medium'),
      utmCampaign: getUtmParam('campaign'),
      utmContent: getUtmParam('content'),
      utmTerm: getUtmParam('term'),
      isBounce: !hasInteracted
    }
  }

  var sessionToken = generateSessionToken()
  var sessionStart = Date.now()
  var pending = []
  var lastSent = 0
  var maxDepthSent = 0
  var clickedAt = null
  var hasInteracted = false

  function queue(eventName, value) {
    var now = Date.now()
    if (lastSent > 0 && now - lastSent < config.debounceMs) return
    pending.push({
      eventName: eventName,
      secondsFromStart: Math.round((now - sessionStart) / 1000),
      value: value || {}
    })
    scheduleFlush()
  }

  function scheduleFlush() {
    if (window.__miaPixelTimer) return
    window.__miaPixelTimer = setTimeout(flush, 800)
  }

  function flush() {
    window.__miaPixelTimer = null
    if (pending.length === 0) return

    var payload = { visit: visitContext(), events: pending }
    pending = []
    lastSent = Date.now()

    if (navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
      navigator.sendBeacon(trackUrl, blob)
      return
    }

    fetch(trackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function() { /* fire-and-forget */ })
  }

  function isWhatsappLink(el) {
    var href = el.getAttribute('href') || ''
    return /wa\.me|api\.whatsapp\.com/.test(href)
  }

  function isCta(el) {
    var cls = el.className || ''
    var href = el.getAttribute('href') || ''
    var tag = (el.tagName || '').toLowerCase()
    return /cta|btn|button/.test(String(cls)) || href.indexOf('#cta') !== -1 || tag === 'button'
  }

  function onFirstInteraction() {
    if (clickedAt) return
    hasInteracted = true
    clickedAt = Date.now()
    queue('time_to_click', { ms: clickedAt - sessionStart })
  }

  function onClick(e) {
    onFirstInteraction()
    var el = e.target
    while (el && el !== document.body) {
      if (isWhatsappLink(el)) { queue('whatsapp_click', { text: (el.textContent || '').trim().slice(0, 60) }); return }
      if (isCta(el)) { queue('cta_click', { text: (el.textContent || '').trim().slice(0, 60) }); return }
      el = el.parentElement
    }
  }

  function onScroll() {
    hasInteracted = true
    var doc = document.documentElement
    var scrollTop = window.pageYOffset || doc.scrollTop
    var max = Math.max(doc.scrollHeight - window.innerHeight, 1)
    var depth = Math.round((scrollTop / max) * 100)
    var thresholds = [25, 50, 75, 100]
    for (var i = 0; i < thresholds.length; i++) {
      var t = thresholds[i]
      if (depth >= t && maxDepthSent < t) {
        maxDepthSent = t
        queue('scroll_depth', { depth: t })
      }
    }
  }

  function onLeave() {
    flush()
  }

  window.addEventListener('click', onClick, true)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('pagehide', onLeave)
  window.addEventListener('beforeunload', onLeave)
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'hidden') flush() })

  queue('init_visit', { title: document.title })

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { queue('init_visit', { ready: true }) })
  }

  // API pública para que la app (React/Vite) emita eventos del funnel
  window.MiaPixel = {
    track: function(name, value) {
      if (!name) return
      hasInteracted = true
      queue(String(name), value || {})
    }
  }
})()

// Configuración mínima:
// <script src="https://mia-platform-psi.vercel.app/pixel.js"
//         data-assistant-id="2f57cd29-fef3-4167-8745-4f02b57d4850"
//         data-landing-id="clean-nails"
//         data-landing-version="v1"></script>
