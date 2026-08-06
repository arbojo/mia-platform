(function() {
  'use strict'

  var config = {
    assistantId: null,
    name: 'MIA',
    position: 'bottom-right',
    color: '#7c3aed',
    width: '380px',
    height: '520px',
    landingId: null,
    brand: null,
    product: null,
    greeting: null
  }

  var scriptEl = document.currentScript
  if (scriptEl) {
    config.assistantId = scriptEl.getAttribute('data-assistant-id') || config.assistantId
    config.name = scriptEl.getAttribute('data-name') || config.name
    config.position = scriptEl.getAttribute('data-position') || config.position
    config.color = scriptEl.getAttribute('data-color') || config.color
    config.width = scriptEl.getAttribute('data-width') || config.width
    config.height = scriptEl.getAttribute('data-height') || config.height
    config.landingId = scriptEl.getAttribute('data-landing-id') || null
    config.brand = scriptEl.getAttribute('data-brand') || null
    config.product = scriptEl.getAttribute('data-product') || null
    config.greeting = scriptEl.getAttribute('data-greeting') || null
  }

  if (!config.assistantId) {
    console.error('[MIA Widget] data-assistant-id es requerido')
    return
  }

  var baseUrl = scriptEl ? scriptEl.src.replace(/\/widget\.js.*$/, '') : ''

  function createStyles() {
    var style = document.createElement('style')
    style.textContent = [
      '#mia-widget-container { position: fixed; z-index: 999999; transition: all 0.3s ease; }',
      '#mia-widget-container.mia-bottom-right { bottom: 20px; right: 20px; }',
      '#mia-widget-container.mia-bottom-left { bottom: 20px; left: 20px; }',
      '#mia-widget-container.mia-hidden { transform: scale(0); opacity: 0; pointer-events: none; }',
      '#mia-widget-container.mia-visible { transform: scale(1); opacity: 1; pointer-events: auto; }',
      '#mia-widget-frame { border: none; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); }',
      '#mia-widget-toggle {',
      '  position: fixed; z-index: 999998; width: 56px; height: 56px; border-radius: 50%;',
      '  border: none; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.2);',
      '  display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;',
      '}',
      '#mia-widget-toggle:hover { transform: scale(1.08); }',
      '#mia-widget-toggle.mia-bottom-right { bottom: 20px; right: 20px; }',
      '#mia-widget-toggle.mia-bottom-left { bottom: 20px; left: 20px; }',
      '#mia-widget-toggle svg { width: 28px; height: 28px; fill: white; }',
      '#mia-widget-toggle .mia-icon-close { display: none; }',
      '#mia-widget-toggle.mia-open .mia-icon-chat { display: none; }',
      '#mia-widget-toggle.mia-open .mia-icon-close { display: block; }',
      '@media (max-width: 767px) {',
      '  #mia-widget-container { top: 0; left: 0; right: 0; bottom: 0; }',
      '  #mia-widget-container.mia-hidden { transform: translateY(100%); opacity: 0; pointer-events: none; }',
      '  #mia-widget-container.mia-visible { transform: translateY(0); opacity: 1; pointer-events: auto; }',
      '  #mia-widget-container.mia-bottom-right, #mia-widget-container.mia-bottom-left { bottom: 0; right: 0; left: 0; }',
      '  #mia-widget-frame { width: 100% !important; height: 100% !important; border-radius: 0; }',
      '}',
    ].join('\n')
    document.head.appendChild(style)
  }

  function createWidget() {
    createStyles()

    var toggle = document.createElement('button')
    toggle.id = 'mia-widget-toggle'
    toggle.className = 'mia-' + config.position
    toggle.innerHTML = '<svg class="mia-icon-chat" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg><svg class="mia-icon-close" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
    toggle.style.backgroundColor = config.color
    document.body.appendChild(toggle)

    var container = document.createElement('div')
    container.id = 'mia-widget-container'
    container.className = 'mia-' + config.position + ' mia-hidden'
    document.body.appendChild(container)

    var iframe = document.createElement('iframe')
    iframe.id = 'mia-widget-frame'
    var params = [
      'assistantId=' + encodeURIComponent(config.assistantId),
      'name=' + encodeURIComponent(config.name)
    ]
    if (config.landingId) params.push('landingId=' + encodeURIComponent(config.landingId))
    if (config.brand) params.push('brand=' + encodeURIComponent(config.brand))
    if (config.product) params.push('product=' + encodeURIComponent(config.product))
    if (config.greeting) params.push('greeting=' + encodeURIComponent(config.greeting))
    iframe.src = baseUrl + '/widget?' + params.join('&')
    iframe.style.width = config.width
    iframe.style.height = config.height
    container.appendChild(iframe)

    var isOpen = false
    toggle.addEventListener('click', function() {
      isOpen = !isOpen
      toggle.classList.toggle('mia-open', isOpen)
      container.classList.toggle('mia-hidden', !isOpen)
      container.classList.toggle('mia-visible', isOpen)
    })

    window.addEventListener('message', function(event) {
      if (event.source !== iframe.contentWindow) return
      if (event.data && event.data.type === 'mia-widget-close') {
        isOpen = false
        toggle.classList.remove('mia-open')
        container.classList.add('mia-hidden')
        container.classList.remove('mia-visible')
      }
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget)
  } else {
    createWidget()
  }
})()
