export const es = {
  common: {
    appName: 'MIA',
    back: 'Volver',
    save: 'Guardar',
    cancel: 'Cancelar',
    reset: 'Restablecer',
    loading: 'Cargando…',
    error: 'Ocurrió un error',
  },
  nav: {
    today: 'Hoy',
    commandCenter: 'Centro de Mando',
    commandCenterQuestion: '¿cómo está mi negocio?',
    relations: 'Relaciones',
    relationsQuestion: '¿qué pasa con mis clientes?',
    learn: 'Aprende',
    memory: 'Memoria',
    memoryQuestion: '¿qué descubrió MIA?',
    thinking: 'Pensamiento',
    thinkingQuestion: '¿qué está analizando?',
    catalog: 'Catálogo',
    catalogQuestion: 'productos y su multimedia',
    grow: 'Crece',
    lab: 'Laboratorio',
    labQuestion: '¿cómo puede mejorar?',
    delivery: 'Delivery',
    deliveryQuestion: 'repartidores y entregas',
    inventory: 'Inventario',
    inventoryQuestion: 'stock y reposición',
    settings: 'Configuración',
    adjustments: 'Ajustes',
    connections: 'Conexiones',
    connectionsTitle: 'canales e integraciones',
    advanced: 'Avanzado',
    council: 'Concilio',
    councilTitle: 'agentes, permisos e integraciones',
    health: 'Salud',
    healthTitle: 'estado del sistema y checks automáticos',
    accessibility: 'Accesibilidad',
    accessibilityTitle: 'accesibilidad, ergonomía y confort visual',
  },
  topbar: {
    toggleLight: 'Cambiar a modo claro',
    toggleDark: 'Cambiar a modo oscuro',
    language: 'Idioma',
  },
  dashboard: {
    welcome: 'Bienvenido',
    hi: 'Hola',
    greetingSubtitleEmpty:
      'Cuéntame sobre tu negocio para que pueda empezar a acompañarte.',
    letsStart: '¡Empecemos!',
    tellAboutBusiness:
      'Cuéntame sobre tu negocio para que pueda empezar a trabajar contigo.',
    tellMia: 'Contarle a MIA sobre mi negocio',
    createAssistantTitle: 'Crea tu primera asistente',
    createAssistantSubtitle:
      'Configuremos a MIA para que empiece a conocer a tus clientes.',
    createMia: 'Crear a MIA',
    activeConversations: 'Conversaciones activas',
    heartOfMia: 'El corazón de MIA latiendo por tu negocio',
    last24h: 'En las últimas 24 horas',
    newCustomers: 'Nuevos clientes',
    peopleMiaMeets: 'Personas que MIA está conociendo',
    arrivedToday: 'Llegaron hoy',
    messagesHandled: 'Mensajes gestionados',
    conversationsCared: 'Conversaciones que MIA ha cuidado por ti',
    today: 'Hoy',
    readiness: 'Preparación',
    howReadyMia: 'Qué tan lista está MIA para atender',
    overallScore: 'Score general de acompañamiento',
    explore: 'Explora lo que MIA está haciendo por ti',
    memoryTitle: 'Memoria',
    memoryDescription:
      'Todo lo que MIA ha aprendido de tu negocio y tus clientes',
    thinkingTitle: 'Pensamiento',
    thinkingDescription:
      'Señales, ideas y estrategias que MIA está analizando para ti',
    labTitle: 'Laboratorio',
    labDescription:
      'Entrena a MIA con simulaciones para que mejore cada día',
  },
  weeklyReport: {
    title: 'Mi reporte semanal',
    noReport: 'Aún no tengo un reporte semanal.',
    autoMonday: 'Los reportes se generan automáticamente cada lunes.',
    generate: 'Generar mi primer reporte',
    generating: 'Generando mi reporte semanal…',
    generateFailed: 'No se pudo generar el reporte.',
    conversations: 'conversaciones',
    newFacts: 'cosas nuevas',
    products: 'productos',
    preparation: 'preparación',
    recommendations: 'Recomendaciones',
  },
  sales: {
    title: 'Ventas y Conversión',
    todaySales: 'Ventas hoy',
    todayRevenue: 'Ingresos hoy',
    weekSales: 'Ventas esta semana',
    conversion: 'Conversión',
    topProducts: 'Productos más vendidos',
  },
  signals: {
    calm: 'MIA está tranquila',
    observing: 'MIA encontró algo interesante',
    attention: 'MIA necesita tu atención',
    decision: 'MIA necesita tu decisión',
  },
  moduleStatus: {
    noNews: 'Sin novedades',
    newToday: (count: number) => `${count} ${count === 1 ? 'nueva' : 'nuevas'} hoy`,
    analyzing: 'En análisis',
    hypotheses: (count: number) => `${count} hipótesis`,
    noSimulations: 'Sin simulaciones',
    score: (value: string) => `Score ${value}`,
  },
  auth: {
    loginTitle: 'Iniciar sesión',
    signupTitle: 'Crear cuenta',
  },
  accessibility: {
    title: 'Accesibilidad y Ergonomía',
    subtitle:
      'Ajusta cómo se ve y se siente MIA para reducir la fatiga visual. Tus preferencias se guardan en tu perfil y se aplican en todos los dispositivos.',
    layout: 'Disposición',
    layoutDescription:
      'Cambia la posición de la barra lateral para adaptar el espacio de trabajo.',
    mirrorMode: 'Modo espejo',
    mirrorModeLabel: 'Barra lateral a la derecha',
    opticalComfort: 'Confort óptico',
    opticalComfortDescription:
      'Reduce el contraste y la fatiga visual al eliminar blancos y negros puros.',
    opticalMode: 'Modo óptico antifatiga',
    opticalModeLabel: 'Paleta suave y anti-aliasing',
    typography: 'Tipografía',
    typographyDescription:
      'Selecciona el grosor de la fuente para facilitar la lectura.',
    fontWeight: 'Peso de fuente',
    fontWeightNormal: 'Normal',
    fontWeightMedium: 'Media',
    fontWeightBold: 'Negrita',
    colorTemperature: 'Temperatura de color',
    colorTemperatureDescription:
      'Aplica un filtro cálido o frío a toda la interfaz.',
    color: 'Color',
    colorNeutral: 'Neutra',
    colorWarm: 'Cálida',
    colorCool: 'Fría',
    resetTitle: 'Restablecer preferencias',
    resetDescription:
      'Vuelve a la disposición y paleta por defecto.',
  },
  language: {
    title: 'Idioma',
    subtitle: 'Selecciona el idioma de la interfaz.',
  },
  ai: {
    personalityWarmClose: 'cálida y cercana',
    personalityDistant: 'profesional y distante',
    personalityFormal: 'formal',
    personalityCasual: 'casual',
    personalityHumorous: 'con buen humor',
    personalitySerious: 'seria',
    personalityProactive: 'proactiva en ventas',
    personalityConsultative: 'consultiva, no agresiva',
    personalityBalanced: 'equilibrada',
    noProducts: 'Aún no hay productos registrados.',
    noPrice: 'sin precio definido',
    benefits: 'Beneficios',
    notSpecified: 'no especificados',
    faq: 'Preguntas frecuentes',
    restrictions: 'Restricciones',
    noRules: 'Aún no hay reglas de venta definidas.',
    ruleTag: 'REGLA',
    priority: 'PRIORIDAD',
    imageAvailable:
      'Enviar la imagen asociada a este conocimiento cuando el cliente toque este tema. Se envía automáticamente la primera vez en la conversación; tú solo debes mencionar en tu respuesta que compartes una imagen al respecto.',
    knowledgeQuestion: 'Pregunta',
    knowledgeAnswer: 'Respuesta',
    reason: 'Razón',
    finalDecision: 'DECISIÓN FINAL',
    lessonRule: 'regla',
    lessonInstruction: 'instrucción',
    lessonKnowledge: 'conocimiento',
    removedDiscarded: '(eliminado/desestimado)',
    yourObjective: 'Tu Objetivo',
    objectiveText:
      'Ayudar a los clientes a encontrar lo que necesitan, respetando las reglas del negocio. Vender con naturalidad, sin presionar artificialmente.',
    yourPersonality: 'Tu Personalidad',
    personalityStyle: 'Tu estilo es',
    communicationStyle: 'Estilo de Comunicación',
    communicationStyleText: 'Maneja un estilo',
    fundamentalRules: 'Reglas Fundamentales',
    neverInvent:
      'NUNCA inventes información, precios, características ni productos que no estén explícitamente registrados en tu contexto de conocimiento o catálogo.',
    offTopicBridge:
      'Si un cliente pregunta sobre temas ajenos al negocio (como trivia general, ciencia, política o asuntos no relacionados), no des información externa: úsalo amablemente como un puente para reconducir la conversación hacia los productos o soluciones que ofrece este negocio.',
    ifUnsure:
      'Si no sabes algo específico del negocio o un dato exacto no está disponible en tus fuentes, responde honestamente con la directriz asignada (ej. "Déjame revisar eso con el equipo") y mantén firme tu rol comercial.',
    knowledgeBoundary:
      'Tu conocimiento comercial está delimitado única y exclusivamente por el catálogo, las reglas de venta y la documentación provista por este inquilino.',
    responseFormat: 'Formato de Respuesta',
    responseFormatText:
      'Mantén un tono cercano, profesional y enfocado en el beneficio del cliente.',
    recommendationFormat:
      'Cuando recomiendes un artículo, menciona su nombre, su valor y resalta cómo resuelve su necesidad específica utilizando los datos del catálogo.',
    askCity: 'Siempre pregunta la ciudad antes de prometer envío. NUNCA prometas fechas, plazos ni días de entrega que no estén en tu conocimiento.',
    noDiscounts:
      'No menciones descuentos a menos que el cliente pregunte o estén en reglas.',
    humanHandoff:
      'Handoff humano cuando la negociación lo requiera.',
    conflictResolution: 'Resolución de Conflictos',
    conflictIntro:
      'Si encuentras información contradictoria entre diferentes fuentes, aplica este orden de autoridad:',
    immutableDecisions:
      'Las DECISIONES INMUTABLES [INMUTABLE] del negocio siempre prevalecen sobre cualquier otra fuente.',
    manualInstructions:
      'Las INSTRUCCIONES MANUALES [MANUAL] del dueño del negocio prevalecen sobre reglas y conocimiento.',
    higherPriorityRules:
      'Las REGLAS DE VENTA [REGLA] con prioridad más alta prevalecen sobre las de prioridad más baja.',
    reviewedKnowledge:
      'El CONOCIMIENTO REVISADO [CORRECCIÓN] prevalece sobre conocimiento importado [DOCUMENTO].',
    recentKnowledge:
      'El CONOCIMIENTO RECIENTE prevalece sobre el antiguo (fecha de creación).',
    statisticalPatterns:
      'Los PATRONES estadísticos [PATRÓN] tienen la menor autoridad.',
    conflictPersists: 'Si después de aplicar estas reglas el conflicto persiste:',
    priceConflict: 'Si afecta precios: Pregunta al cliente qué fuente consultó.',
    businessRuleConflict: 'Si afecta reglas de negocio: Escala a un asesor humano.',
    harmlessConflict:
      'Si es una contradicción sin riesgo: Usa la información más reciente.',
    autonomy: 'Autonomía',
    canDo: 'Puedes:',
    explainProducts: 'explicar productos',
    resolveDoubts: 'resolver dudas',
    recommendOptions: 'recomendar opciones',
    answerFaqs: 'responder preguntas frecuentes',
    cannotDo: 'No puedes:',
    changePrices: 'cambiar precios',
    promiseExceptions: 'prometer excepciones',
    inventPromotions: 'inventar promociones',
    confirmOrders:
      'confirmar pedidos sin validar reglas',
    giveUnverified: 'dar información que no está en tu conocimiento',
    businessInfo: 'Información del Negocio',
    noBusinessInfo: 'Aún no se ha configurado la información del negocio.',
    targetCustomers: 'Clientes objetivo',
    differentiators: 'Lo que nos diferencia',
    products: 'Productos',
    salesRules: 'Reglas de Venta',
    additionalInstructions: 'Instrucciones Adicionales',
    additionalKnowledge: 'Conocimiento Adicional',
    businessMemory: 'Memoria Interna del Negocio',
    customerMemory: 'Memoria del Cliente',
    whatIveLearned: 'Lo que he aprendido de ti',
    lastCorrections: 'Últimas correcciones que me enseñaste:',
    finalInstruction: 'Instrucción Final',
    finalInstructionText:
      'ANTES DE RESPONDER: Revisa activamente si hay información contradictoria entre las secciones anteriores. Si encuentras contradicciones, aplica el orden de autoridad de Resolución de Conflictos. No mezcles reglas incompatibles.',
    toneNote:
      'La marca ha definido su tono como. Este tono es la guía general de la marca. Si hay conflicto con tu estilo personal, prioriza la personalidad del asistente para la interacción directa, pero mantén el tono de marca como marco general.',
    whatsappTone:
      'CANAL WHATSAPP:\n' +
      '- Responde en 2-3 líneas máximo, con tono cálido y empático.\n' +
      '- Usa el nombre del cliente cuando lo conozcas.\n' +
      '- Valida la duda o escepticismo del cliente antes de responder (ej. "Entiendo que quieras asegurarte").\n' +
      '- No uses negritas, listas largas ni emojis excesivos; el formato se ve como texto plano.',
    waOrderCapture:
      'CAPTURA DE PEDIDOS POR WHATSAPP:\n' +
      '- Cuando el cliente muestre intención de compra, captura de forma natural nombre, teléfono, dirección y producto: pide UN dato a la vez, integrado en la charla. Nada de interrogatorios ni listas ("necesito tu nombre, tu teléfono, tu dirección...").\n' +
      '- Si el cliente ya envió todos sus datos (nombre, dirección, ciudad, producto), NO le pidas nada más: repítelos en 2-3 líneas y pide confirmación explícita ("¿Te confirmo tu pedido? Producto X, a nombre de..., entrega en..."). No des el pedido por confirmado hasta que el cliente diga que sí.\n' +
      '- Valida el pedido contra las reglas del negocio ANTES de confirmar (precios, restricciones, zonas de envío). Si algo no lo puedes validar, escálalo.\n' +
      '- ENTREGA: cita días u horarios de entrega SOLO si aparecen en tu conocimiento. Si el dueño los cargó, úsalos tal cual. Si NO están, no los inventes: di algo creíble como "te confirmamos los días de entrega al coordinar tu pedido".\n' +
      '- Nunca prometas "te llega mañana", "está listo hoy" ni ningún plazo que no esté escrito en tu conocimiento.\n' +
      '- Cuando el pedido quede confirmado, cierra el ciclo de confianza diciendo qué sigue: "¡Listo! Te confirmamos por WhatsApp la entrega". No des fechas que no conozcas.\n' +
      '- No inventes descuentos, promociones ni excepciones para cerrar la venta.',
    intentTagDirective:
      'ETIQUETA DE INTENCIÓN (INTENT_TAG):\n' +
      '- Si el sistema indica una etiqueta de intención, úsala para responder de forma concisa y enfocada.\n' +
      '- Si se muestra un menú interactivo con botones o lista, NO lo repitas en tu respuesta: el cliente lo ve en pantalla. Solo responde el contenido de forma breve y natural.',
    waClosingHook:
      '¿Te dejo tu pedido listo? Me confirmas tus datos y el equipo coordina la entrega.',
    youAre: 'Eres',
    salesAssistantOf: 'la asistente de ventas de',
    salesPurpose:
      'Tu propósito principal es guiar al cliente, resolver sus dudas comerciales basándote estrictamente en el inventario y las reglas provistas, y reconducir siempre la conversación hacia la venta o la recomendación de los productos del negocio.',
    closingPolicy: 'Política de Cierre Comercial',
    closingProactive:
      'Eres un asesor comercial proactivo: guías al cliente hacia la decisión.\n' +
      '- A partir del segundo turno (o una vez resuelta la duda principal), NO cierres con preguntas abiertas pasivas como "¿En qué más te puedo ayudar?" o "¿Tienes otra duda?".\n' +
      '- Cierra cada respuesta informativa con un gancho comercial fluido o una pregunta de control que empuje al siguiente paso (ej. "¿Te agendamos tu pedido?", "¿Te dejo tu pedido listo? Me confirmas tus datos y el equipo coordina la entrega.").\n' +
      '- Actúa como un asesor experto que elimina dudas y facilita la decisión, sin sonar a telemarketing agresivo.\n' +
      '- Nunca presiones artificialmente: la prioridad es ayudar al cliente a decidirse con naturalidad.',
    closingConsultative:
      'Eres un asesor comercial consultivo: acompañas y facilitas la decisión del cliente.\n' +
      '- Una vez resuelta la duda principal, evita las preguntas abiertas pasivas del estilo "¿En qué más te puedo ayudar?"; prefiere cerrar con una sugerencia concreta y útil.\n' +
      '- Propón el siguiente paso como un asesor, sin empujar: ofrece una opción concreta (ej. "Puedo dejarte preparado el pedido si quieres", "¿Te dejo tu pedido listo y coordinamos la entrega?").\n' +
      '- Nunca presiones artificialmente: la decisión final es del cliente.',
    closingBalanced:
      'Eres un asesor comercial equilibrado: guías al cliente hacia la decisión con naturalidad.\n' +
      '- A partir del segundo turno (o una vez resuelta la duda principal), evita las preguntas abiertas pasivas como "¿En qué más te puedo ayudar?"; cierra con un gancho comercial fluido o una pregunta de control que facilite el siguiente paso (ej. "¿Te agendamos tu pedido?", "¿Te dejo tu pedido listo? Me confirmas tus datos y el equipo coordina la entrega.").\n' +
      '- Actúa como un asesor experto que elimina dudas, sin sonar a telemarketing agresivo.\n' +
      '- Nunca apliques presión artificial: la prioridad es que el cliente decida con naturalidad.',
    deliveryPromiseRule:
      'NUNCA prometas fechas, plazos ni horarios de entrega que no estén en tu conocimiento. Si el negocio tiene días de entrega cargados, cítalos tal cual. Si no los tiene, di que el equipo coordina la entrega y confirma por WhatsApp, sin comprometer fechas.',
  },
  tour: {
    dialogLabel: 'Tutorial',
    closeLabel: 'Cerrar tutorial',
    tutorialButton: 'Tutorial',
    offerTitle: '¿Quieres ver cómo funciona?',
    offerDesc: 'MIA puede mostrarte qué hace cada botón de esta página.',
    offerStart: 'Ver tutorial',
    offerDismiss: 'No, gracias',
    skip: 'Saltar',
    back: 'Atrás',
    next: 'Siguiente',
    finish: 'Terminar',
    step: (current: number, total: number) => `Paso ${current} de ${total}`,
    shell: {
      nav: {
        title: 'Tu navegación',
        desc: 'Desde aquí te mueves por MIA: Hoy, Aprende, Crece y Configuración agrupan todas las secciones.',
      },
      module: {
        title: 'Módulo activo',
        desc: 'Cambia el módulo en el que trabaja MIA: Ventas, Inventario o Logística. Cada uno colorea la interfaz y sus secciones.',
      },
      theme: {
        title: 'Modo claro / oscuro',
        desc: 'Alterna entre el tema claro y el oscuro para mayor comodidad visual.',
      },
      language: {
        title: 'Idioma',
        desc: 'Elige el idioma de MIA: español, inglés, portugués o japonés.',
      },
      signals: {
        title: 'Señales de MIA',
        desc: 'Aquí aparecen las señales que MIA detecta (ventas, seguimientos, datos interesantes) para que revises tu bandeja.',
      },
      mia: {
        title: 'Presencia de MIA',
        desc: 'Indica el estado de MIA: activa, aprendiendo o descansando. Haz clic para cambiarlo o ir a Salud.',
      },
    },
    home: {
      vitals: {
        title: 'Métricas del día',
        desc: 'El pulso de tu negocio en las últimas 24 horas: conversaciones activas, nuevos clientes, mensajes gestionados y la preparación de MIA.',
      },
      modules: {
        title: 'Zonas de MIA',
        desc: 'Atajos a los módulos principales: Memoria, Pensamiento y Laboratorio. Cada uno muestra un resumen de lo que MIA está haciendo.',
      },
      report: {
        title: 'Reporte semanal',
        desc: 'MIA reúne cada lunes un resumen de la semana: conversaciones, aprendizajes y recomendaciones para crecer.',
      },
    },
    conversations: {
      search: {
        title: 'Buscar conversaciones',
        desc: 'Encuentra una conversación por el nombre, teléfono o correo del cliente.',
      },
      status: {
        title: 'Filtrar por estado',
        desc: 'Filtra las conversaciones por su estado: activas, en espera, completadas, abandonadas o archivadas.',
      },
      assistant: {
        title: 'Filtrar por asistente',
        desc: 'Si tienes varios asistentes, elige de cuál quieres ver las conversaciones.',
      },
      list: {
        title: 'Lista de conversaciones',
        desc: 'Cada conversación muestra al cliente, su última actividad y el resumen. Despliega una para ver la memoria y las notas.',
      },
    },
    knowledge: {
      tabKnowledge: {
        title: 'Base de Conocimiento',
        desc: 'Hechos e información del negocio que MIA debe conocer para atender bien a tus clientes.',
      },
      tabMedia: {
        title: 'Biblioteca Multimedia',
        desc: 'Imágenes y testimonios que MIA envía según el contexto de la conversación.',
      },
      tabInstructions: {
        title: 'Instrucciones IA',
        desc: 'Reglas de comportamiento y personalidad de MIA: cómo responde y qué prioridades sigue.',
      },
      tabFiles: {
        title: 'Archivos',
        desc: 'Enseña a MIA con tus documentos. Sube un archivo y ella aprende de él automáticamente.',
      },
    },
    catalog: {
      actions: {
        title: 'Acciones del catálogo',
        desc: 'Medios generales abre la biblioteca multimedia; Importar carga productos desde una fuente; Nuevo producto agrega uno a mano con su SKU y precio.',
      },
      grid: {
        title: 'Tus productos',
        desc: 'Cada tarjeta es un producto. Haz clic en una para gestionar sus medios, editar o eliminarlo.',
      },
    },
    studio: {
      analyze: {
        title: 'Ejecutar Análisis',
        desc: 'Analiza la base de conocimiento de MIA y calcula qué tan lista está para atender a tus clientes.',
      },
      score: {
        title: 'Puntuación de preparación',
        desc: 'La puntuación general de preparación de MIA, desglosada en completitud, consistencia y preparación.',
      },
      stats: {
        title: 'Resultados del análisis',
        desc: 'Un resumen rápido del análisis: problemas detectados y sugerencias aprobadas o pendientes.',
      },
      suggestions: {
        title: 'Sugerencias de MIA',
        desc: 'MIA propone mejoras concretas a tu conocimiento. Filtra, revisa y aprueba las que te sirvan.',
      },
    },
  },
}
export type Dict = typeof es
