export const TEST_BUSINESS_NAME = '[STRESS TEST] ImportCorp'
export const TEST_OWNER_ID = 'e8031a2c-2c0b-4e06-a7d1-837a9423afdc'
export const TOTAL_DOCUMENTS = 50

export interface DocumentDef {
  id: string
  type: 'knowledge' | 'catalog' | 'pricing' | 'policy' | 'faq' | 'instructions' | 'legal' | 'internal'
  title: string
  content: string
  expectedCategory: 'products' | 'knowledge_items' | 'sales_rules' | 'ai_instructions' | 'business_memory'
  isConflict: boolean
  conflictWith?: string
}

export type Complexity = 'small' | 'medium' | 'enterprise'

export const COMPLEXITY_CONFIG: Record<Complexity, { docs: number; label: string }> = {
  small: { docs: 50, label: 'Pequeño (~50 docs/mes)' },
  medium: { docs: 200, label: 'Mediano (~200 docs/mes)' },
  enterprise: { docs: 1000, label: 'Enterprise (~1000+ docs/mes)' },
}

export const DEFAULT_COMPLEXITY: Complexity = 'small'

export const INDUSTRY_SECTORS = [
  'Tecnología / SaaS',
  'Manufactura / Industria',
  'Salud / Farmacéutica',
  'Finanzas / Seguros',
  'Comercio / Retail',
  'Servicios profesionales',
  'Logística / Transporte',
  'Alimentos / Bebidas',
]

export function generateDocuments(): DocumentDef[] {
  const docs: DocumentDef[] = []
  let id = 0

  const nextId = () => `doc_${String(++id).padStart(3, '0')}`

  // 10 Knowledge documents
  const knowledgeTopics = [
    { t: 'Procedimiento de devoluciones', c: 'Las devoluciones se aceptan dentro de 30 días con el producto en su empaque original. El cliente debe generar una guía de devolución desde el portal. El reembolso se procesa en 5-7 días hábiles.' },
    { t: 'Proceso de instalación de equipos', c: 'La instalación estándar incluye configuración básica, conexión a red eléctrica y pruebas de funcionamiento. Se requiere que el cliente tenga el espacio preparado. Instalaciones especiales tienen costo adicional.' },
    { t: 'Garantía de productos', c: 'Todos los productos tienen garantía de 1 año contra defectos de fabricación. La garantía cubre partes y mano de obra. No cubre daños por mal uso, descargas eléctricas o desgaste natural.' },
    { t: 'Proceso de facturación electrónica', c: 'Las facturas se emiten electrónicamente dentro de las 48 horas siguientes a la compra. El cliente recibe un CFDI con todos los requisitos fiscales. Para cambios de datos fiscales, el cliente tiene 72 horas.' },
    { t: 'Métodos de envío disponibles', c: 'Ofrecemos envío terrestre (3-5 días), exprés (24-48 hrs) y recolección en tienda. El envío terrestre es gratuito en compras mayores a $1,500 MXN.' },
    { t: 'Política de precios por volumen', c: 'Clientes que compren más de 100 unidades reciben 15% de descuento. Más de 500 unidades: 25% de descuento. Estos descuentos no son acumulables con otras promociones.' },
    { t: 'Procedimiento de atención a quejas', c: 'Las quejas se registran en el sistema y se asignan a un ejecutivo en menos de 2 horas. El tiempo de resolución máximo es de 48 horas. El cliente recibe actualizaciones cada 12 horas.' },
    { t: 'Especificaciones técnicas de conectividad', c: 'Los equipos requieren conexión a internet de al menos 10 Mbps. Compatibilidad con redes WiFi 5GHz y 2.4GHz. Se recomienda uso de cable Ethernet para configuración inicial.' },
    { t: 'Proceso de capacitación de usuarios', c: 'Incluimos 2 horas de capacitación remota con cada equipo adquirido. Capacitación presencial tiene costo de $1,500 MXN por hora. Grupos de hasta 5 personas por sesión.' },
    { t: 'Política de privacidad de datos', c: 'Los datos del cliente se almacenan de acuerdo con la Ley Federal de Protección de Datos. No compartimos información con terceros sin autorización expresa. El cliente puede solicitar la eliminación de sus datos en cualquier momento.' },
  ]
  for (const k of knowledgeTopics) {
    docs.push({
      id: nextId(),
      type: 'knowledge',
      title: k.t,
      content: k.c,
      expectedCategory: 'knowledge_items',
      isConflict: false,
    })
  }

  // 8 Product catalogs
  const catalogItems = [
    { name: 'Equipo Profesional X200', price: 12999, desc: 'Equipo profesional de gama alta con procesador Intel i7, 32GB RAM, 1TB SSD. Incluye licencia de software. Ideal para empresas que requieren máximo rendimiento.' },
    { name: 'Equipo Estándar E100', price: 7999, desc: 'Equipo de gama media con procesador Intel i5, 16GB RAM, 512GB SSD. Perfecto para uso empresarial diario. Incluye garantía de 1 año.' },
    { name: 'Estación de Trabajo W500', price: 24999, desc: 'Estación de trabajo con doble procesador Xeon, 64GB ECC RAM, 2TB NVMe SSD. Certificada para aplicaciones CAD/CAM. Incluye monitor 27" 4K.' },
    { name: 'Servidor Empresarial S1000', price: 45999, desc: 'Servidor rackeable 2U con procesador Xeon, 128GB RAM, 4x4TB SAS en RAID 10. Fuente de poder redundante. Ideal para virtualización.' },
    { name: 'Switch Gestionable 48 Puertos', price: 8999, desc: 'Switch Gigabit Ethernet de 48 puertos con 4 uplinks SFP+. Administración vía web y SNMP. VLAN, QoS y enlace troncal.' },
    { name: 'Firewall Corporativo FG-200', price: 14999, desc: 'Firewall de siguiente generación con IPS, antivirus y filtrado web. Throughput de 2 Gbps. Soporta hasta 500 usuarios concurrentes.' },
    { name: 'Access Point WiFi 6 Pro', price: 3499, desc: 'Access Point WiFi 6 (802.11ax) con cobertura de hasta 300m². Soporta hasta 200 dispositivos concurrentes. Alimentación PoE+.' },
    { name: 'Respaldo UPS 1500VA', price: 5499, desc: 'UPS de 1500VA con baterías de respaldo. Autonomía de 30 minutos a carga media. Protección contra sobretensión y regulación automática.' },
  ]
  for (const c of catalogItems) {
    docs.push({
      id: nextId(),
      type: 'catalog',
      title: `Catálogo: ${c.name}`,
      content: `Producto: ${c.name}\nPrecio: $${c.price} MXN\n${c.desc}`,
      expectedCategory: 'products',
      isConflict: false,
    })
  }

  // 6 Pricing documents (2 with conflicts)
  const pricingDocs = [
    { title: 'Lista de precios general 2026', content: 'Equipo X200: $12,999 | E100: $7,999 | W500: $24,999 | S1000: $45,999 | Switch 48P: $8,999 | FG-200: $14,999 | AP WiFi6: $3,499 | UPS 1500: $5,499' },
    { title: 'Precios distribuidor autorizado', content: 'Equipo X200: $10,999 | E100: $6,499 | W500: $21,999 | S1000: $39,999' },
    { title: 'Precios especiales gobierno', content: 'Equipo X200: $11,500 | E100: $7,200 | W500: $22,500 | S1000: $42,000' },
    { title: 'Lista de precios actualizada marzo (CONFLICTO)', content: 'Equipo X200: $13,999 | E100: $8,499 | W500: $26,999 | S1000: $48,999 | Switch 48P: $8,499 | FG-200: $15,499', isConflict: true, conflictWith: 'Lista de precios general 2026' },
    { title: 'Promoción temporal junio', content: 'X200: $11,999 (hasta agotar existencias) | Switch 48P: $7,499 | AP WiFi6: $2,999' },
    { title: 'Precios mayoristas 2026 (CONFLICTO)', content: 'Equipo X200 por volumen (100+): $9,999 | E100 por volumen (100+): $5,999 | Precios no válidos para distribuidores', isConflict: true, conflictWith: 'Política de precios por volumen' },
  ]
  for (const p of pricingDocs) {
    docs.push({
      id: nextId(),
      type: 'pricing',
      title: p.title,
      content: p.content,
      expectedCategory: 'products',
      isConflict: p.isConflict ?? false,
      conflictWith: p.conflictWith,
    })
  }

  // 8 Policies (2 with conflicts)
  const policies = [
    { title: 'Política de crédito para clientes', content: 'Línea de crédito inicial hasta $50,000 MXN con aprobación de buró de crédito. Clientes con 6 meses de antigüedad pueden solicitar incremento. Tasa de interés mensual: 2.5%.' },
    { title: 'Política de entregas internacionales', content: 'Entregas internacionales tienen costo adicional basado en destino y peso. Tiempo estimado: 5-10 días hábiles. El cliente cubre aranceles e impuestos locales. No aplican garantías internacionales.' },
    { title: 'Política de soporte técnico', content: 'Soporte técnico disponible 8am-8pm L-V. Soporte 24/7 disponible con contrato premium. Tiempo de respuesta máximo: 4 horas para tickets normales, 1 hora para críticos.' },
    { title: 'Política de renovación de contratos', content: 'Los contratos se renuevan automáticamente a menos que el cliente notifique con 30 días de anticipación. Incremento anual máximo: 10% sobre el precio base.' },
    { title: 'Política de pruebas y demostraciones', content: 'Prueba gratuita de 15 días en equipos seleccionados. Se requiere depósito reembolsable del 20% del valor. El cliente paga flete de devolución si no compra.' },
    { title: 'Política antigua de envíos (CONFLICTO)', content: 'Envío gratuito en compras mayores a $500 MXN. Tiempo de entrega: 7-10 días hábiles.', isConflict: true, conflictWith: 'Métodos de envío disponibles' },
    { title: 'Política de privacidad versión anterior (CONFLICTO)', content: 'Los datos del cliente pueden compartirse con empresas afiliadas para fines promocionales. El cliente autoriza automáticamente al crear su cuenta.', isConflict: true, conflictWith: 'Política de privacidad de datos' },
    { title: 'Política de pagos', content: 'Aceptamos transferencia electrónica, tarjeta de crédito/débito y PayPal. Pago contra entrega disponible en zona metropolitana. Facturación a 30 días para empresas con historial crediticio.' },
  ]
  for (const p of policies) {
    docs.push({
      id: nextId(),
      type: 'policy',
      title: p.title,
      content: p.content,
      expectedCategory: 'sales_rules',
      isConflict: p.isConflict ?? false,
      conflictWith: p.conflictWith,
    })
  }

  // 6 FAQ documents
  const faqs = [
    { title: 'FAQ: Primeros pasos', content: 'P: ¿Cómo configuro mi equipo nuevo?\nR: Siga la guía de inicio rápido incluida en la caja. Escanee el código QR para ver el video tutorial.\n\nP: ¿Necesito crear una cuenta?\nR: Sí, debe registrar su equipo en nuestro portal para activar la garantía.\n\nP: ¿Cuánto tarda la activación?\nR: La activación se realiza en menos de 24 horas hábiles.' },
    { title: 'FAQ: Problemas de conectividad', content: 'P: Mi equipo no se conecta a WiFi\nR: Verifique que esté en la banda correcta (2.4GHz o 5GHz). Reinicie el equipo y el router.\n\nP: ¿Por qué mi conexión es lenta?\nR: Mida la velocidad en speedtest.net. Si es menor a 10 Mbps, contacte a su ISP.\n\nP: ¿Funciona con datos móviles?\nR: Sí, pero no garantizamos estabilidad en redes 4G/5G.' },
    { title: 'FAQ: Garantía y reparaciones', content: 'P: ¿Cómo solicito una reparación?\nR: Genere un ticket en nuestro portal de soporte. Adjunte su factura y describa el problema.\n\nP: ¿Me prestan un equipo mientras reparan el mío?\nR: Sí, con contrato de garantía premium. Equipo de préstamo de gama equivalente.' },
    { title: 'FAQ: Facturación y pagos', content: 'P: ¿Cómo descargo mi factura?\nR: Ingrese a su portal, sección "Mis facturas". Descarga disponible en PDF y XML.\n\nP: ¿Puedo cambiar mi método de pago?\nR: Sí, desde el portal puede actualizar su método de pago en cualquier momento.' },
    { title: 'FAQ: Cursos y certificaciones', content: 'P: ¿Ofrecen cursos?\nR: Sí, tenemos cursos presenciales y en línea. Consulte nuestro calendario en el portal.\n\nP: ¿Los cursos tienen certificación?\nR: Sí, al completar el curso recibe un certificado con validez oficial.' },
    { title: 'FAQ: Devoluciones y reembolsos', content: 'P: ¿Puedo devolver un producto?\nR: Sí, dentro de 30 días. El producto debe estar sin usar y en su empaque original.\n\nP: ¿Cuánto tarda el reembolso?\nR: 5-7 días hábiles después de recibir el producto en nuestro almacén.' },
  ]
  for (const f of faqs) {
    docs.push({
      id: nextId(),
      type: 'faq',
      title: f.title,
      content: f.content,
      expectedCategory: 'knowledge_items',
      isConflict: false,
    })
  }

  // 4 Instructions
  const instructions = [
    { title: 'Instrucciones de atención al cliente', content: 'Salude al cliente por su nombre. Escuche activamente sin interrumpir. Confirme que entendió el problema antes de ofrecer solución. Nunca diga "no sé", diga "permítame investigarlo". Siempre ofrezca seguimiento.' },
    { title: 'Instrucciones para manejo de objeciones', content: 'Cuando un cliente objete el precio: explique valor agregado y compare con competencia. Cuando objete el tiempo: ofrezca seguimiento prioritario. Cuando objete la calidad: mencione casos de éxito y garantía.' },
    { title: 'Instrucciones para venta consultiva', content: 'Primero entienda la necesidad del negocio. Haga preguntas abiertas: ¿qué problema resuelve?, ¿qué han usado antes?, ¿cuál es su presupuesto?. Proponga 2 opciones: una estándar y una premium.' },
    { title: 'Instrucciones opuestas (CONFLICTO)', content: 'Siempre ofrezca primero el producto más caro. No pregunte por el presupuesto del cliente. Si el cliente duda, insista sin dar opciones alternativas.', isConflict: true, conflictWith: 'Instrucciones para venta consultiva' },
  ]
  for (const inst of instructions) {
    docs.push({
      id: nextId(),
      type: 'instructions',
      title: inst.title,
      content: inst.content,
      expectedCategory: 'ai_instructions',
      isConflict: inst.isConflict ?? false,
      conflictWith: inst.conflictWith,
    })
  }

  // 4 Legal documents
  const legalDocs = [
    { title: 'Restricciones legales de exportación', content: 'No podemos vender a países con embargo comercial. El cliente debe firmar declaración de uso final para equipos de doble propósito. Sanciones por incumplimiento: hasta $5M USD.' },
    { title: 'Términos de licencia de software', content: 'Licencia por usuario, no transferible. Prohibida la ingeniería inversa. Licencias en volumen requieren contrato enterprise. Auditorías anuales de cumplimiento.' },
    { title: 'Acuerdo de nivel de servicio (SLA)', content: 'Disponibilidad del sistema: 99.9% (excepto mantenimiento programado). Penalización por incumplimiento: 5% del costo mensual por cada hora de caída. Máximo de penalización: 50% del costo mensual.' },
    { title: 'Restricciones de revendedores', content: 'Revendedores autorizados no pueden comercializar productos fuera de su territorio asignado. Precio mínimo anunciado: 95% del precio de lista. Violaciones resultan en terminación del contrato.' },
  ]
  for (const l of legalDocs) {
    docs.push({
      id: nextId(),
      type: 'legal',
      title: l.title,
      content: l.content,
      expectedCategory: 'sales_rules',
      isConflict: false,
    })
  }

  // 4 Internal documents
  const internalDocs = [
    { title: 'Manual de operaciones (interno)', content: 'Proceso de onboarding: Día 1: bienvenida y alta en sistema. Día 2-3: capacitación básica. Día 4-5: configuración de equipos. Día 6-7: pruebas y ajustes. Día 8: entrega oficial y firma.' },
    { title: 'Guía de escalamiento de tickets', content: 'Nivel 1: Soporte básico (resolución < 2 hrs). Nivel 2: Soporte técnico (resolución < 8 hrs). Nivel 3: Ingeniería (resolución < 24 hrs). Nivel 4: Desarrollo (resolución < 72 hrs).' },
    { title: 'Procedimiento de control de calidad', content: 'Cada equipo pasa por 3 fases: inspección visual, pruebas funcionales (2 hrs), y quemado de 24 horas. Equipos con tasa de falla > 2% se retienen para revisión.' },
    { title: 'Memorándum: Nuevo proceso de atención (CONFLICTO)', content: 'Atención al cliente exclusivamente por chat. No dar seguimiento telefónico. Tiempo máximo por llamada: 15 minutos (aplica solo para emergencias). Clientes sin contrato premium: solo chat.', isConflict: true, conflictWith: 'Instrucciones de atención al cliente' },
  ]
  for (const d of internalDocs) {
    docs.push({
      id: nextId(),
      type: 'internal',
      title: d.title,
      content: d.content,
      expectedCategory: 'business_memory',
      isConflict: d.isConflict ?? false,
      conflictWith: d.conflictWith,
    })
  }

  return docs
}

export function getConflictPairs(): Array<{ docA: string; docB: string; type: string }> {
  return [
    { docA: 'Lista de precios actualizada marzo (CONFLICTO)', docB: 'Lista de precios general 2026', type: 'Precios inconsistentes' },
    { docA: 'Precios mayoristas 2026 (CONFLICTO)', docB: 'Política de precios por volumen', type: 'Política de descuentos contradictoria' },
    { docA: 'Política antigua de envíos (CONFLICTO)', docB: 'Métodos de envío disponibles', type: 'Política de envíos desactualizada' },
    { docA: 'Política de privacidad versión anterior (CONFLICTO)', docB: 'Política de privacidad de datos', type: 'Privacidad de datos contradictoria' },
    { docA: 'Instrucciones opuestas (CONFLICTO)', docB: 'Instrucciones para venta consultiva', type: 'Metodología de venta contradictoria' },
    { docA: 'Memorándum: Nuevo proceso de atención (CONFLICTO)', docB: 'Instrucciones de atención al cliente', type: 'Proceso de atención contradictorio' },
  ]
}
