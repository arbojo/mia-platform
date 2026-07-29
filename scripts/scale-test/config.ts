export const SCALE_TEST_PREFIX = '[SCALE TEST]'
export const SCALE_TEST_OWNER_ID = 'e8031a2c-2c0b-4e06-a7d1-837a9423afdc'

export type Complexity = 'small' | 'medium' | 'large'

export interface BusinessDef {
  id: string
  name: string
  industry: string
  complexity: Complexity
  brand: {
    business_name: string
    tagline: string
    target_customers: string
    differentiators: string
    elevator_pitch: string
    tone_of_voice: string
  }
  assistantName: string
  personality: { warmth: number; formality: number; humor: number; sales_aggressiveness: number }
  communicationStyle: 'formal' | 'casual' | 'warm' | 'direct'
  baseProducts: Array<{ name: string; price: number; description: string; benefits: string }>
  baseKnowledge: Array<{ category: string; question: string; answer: string }>
  baseRules: Array<{ category: string; content: string; priority: number }>
  baseInstructions: string[]
}

export interface ModeConfig {
  maxBusinesses: number
  conversationsPerBusiness: number
  knowledgeDocuments: number
  simulatedDays: number
}

export const MODES: Record<'safe' | 'full', ModeConfig> = {
  safe: {
    maxBusinesses: 3,
    conversationsPerBusiness: 50,
    knowledgeDocuments: 5,
    simulatedDays: 7,
  },
  full: {
    maxBusinesses: 10,
    conversationsPerBusiness: 500,
    knowledgeDocuments: 50,
    simulatedDays: 30,
  },
}

export const COMPLEXITY_TARGETS: Record<Complexity, { products: number; knowledge: number; rules: number; instructions: number }> = {
  small: { products: 5, knowledge: 8, rules: 5, instructions: 3 },
  medium: { products: 15, knowledge: 25, rules: 15, instructions: 8 },
  large: { products: 30, knowledge: 50, rules: 30, instructions: 15 },
}

const p = (name: string, price: number, desc: string, benefits: string) => ({ name, price, description: desc, benefits })
const k = (category: string, question: string, answer: string) => ({ category, question, answer })
const r = (category: string, content: string, priority: number = 5) => ({ category, content, priority })

const COMMON_RULES = [
  r('payment', 'Aceptamos pagos en efectivo contra entrega, transferencia bancaria y tarjetas de crédito/débito.', 10),
  r('schedule', 'Entregamos de lunes a sábado de 9:00 a 18:00 horas.', 5),
  r('restrictions', 'No realizamos devoluciones de productos en oferta o liquidación.', 8),
]

export const BUSINESS_DEFS: Omit<BusinessDef, 'id'>[] = [
  {
    name: 'VidaSana',
    industry: 'Health & wellness products',
    complexity: 'medium',
    brand: {
      business_name: 'VidaSana',
      tagline: 'Tu bienestar es nuestra prioridad',
      target_customers: 'Personas de 25-60 años interesadas en cuidado personal y bienestar',
      differentiators: 'Productos con respaldo médico, envío gratis en compras mayores a $500, atención personalizada',
      elevator_pitch: 'En VidaSana ofrecemos productos de salud y bienestar que mejoran tu calidad de vida, con respaldo profesional y precios accesibles.',
      tone_of_voice: 'Cálido, profesional, alentador',
    },
    assistantName: 'Salud',
    personality: { warmth: 75, formality: 50, humor: 30, sales_aggressiveness: 50 },
    communicationStyle: 'warm',
    baseProducts: [
      p('Multivitamínico Diario', 349, 'Suplemento con 12 vitaminas y minerales esenciales para el día a día.', 'Fortalece el sistema inmune y aumenta tu energía natural.'),
      p('Colágeno Hidrolizado', 399, 'Colágeno tipo I y III en polvo para piel, uñas y articulaciones.', 'Mejora la elasticidad de la piel y fortalece uñas y articulaciones.'),
      p('Té Detox Verde', 189, 'Mezcla de té verde, jengibre y hierbas depurativas.', 'Ayuda a la digestión y elimina toxinas del cuerpo.'),
      p('Aceite de Coco Orgánico', 159, 'Aceite de coco virgen extra para cocina y cuidado personal.', 'Hidrata la piel y el cabello de forma natural.'),
      p('Difusor de Aromaterapia', 449, 'Difusor ultrasónico con luces LED para aceites esenciales.', 'Crea un ambiente relajante y mejora la calidad del sueño.'),
    ],
    baseKnowledge: [
      k('faq', '¿Cuánto tarda el envío?', 'El envío llega en 2-4 días hábiles dentro de nuestra zona de cobertura.'),
      k('faq', '¿Los productos tienen garantía?', 'Todos nuestros productos tienen 30 días de garantía de satisfacción.'),
      k('objection', '¿Por qué es tan caro el colágeno?', 'Nuestro colágeno es hidrolizado de alta calidad, con mejor absorción que el convencional.'),
      k('business_info', '¿Desde cuándo existe VidaSana?', 'VidaSana comenzó operaciones en 2020 y desde entonces hemos ayudado a más de 5,000 clientes.'),
      k('tip', '¿Cómo tomar el multivitamínico?', 'Recomendamos tomar una cápsula después del desayuno con un vaso de agua.'),
    ],
    baseRules: [
      ...COMMON_RULES,
      r('zones', 'Cubrimos León, Irapuato, Silao, Lagos de Moreno y Guanajuato Capital.', 10),
      r('promotions', '10% de descuento en la primera compra usando el código BIENVENIDO10.', 7),
    ],
    baseInstructions: [
      'Siempre recomienda el multivitamínico como primer producto para nuevos clientes.',
      'Si el cliente duda, ofrece el paquete de prueba de 3 productos con 15% de descuento.',
    ],
  },
  {
    name: 'ZapatoFit',
    industry: 'Shoe ecommerce',
    complexity: 'small',
    brand: {
      business_name: 'ZapatoFit',
      tagline: 'El calzado que tu estilo merece',
      target_customers: 'Hombres y mujeres de 20-45 años que buscan calzado moderno y cómodo',
      differentiators: 'Diseños exclusivos, materiales de primera calidad, cambio gratuito por talla',
      elevator_pitch: 'ZapatoFit ofrece calzado moderno y cómodo para el día a día, con diseños que combinan estilo y funcionalidad.',
      tone_of_voice: 'Joven, moderno, casual',
    },
    assistantName: 'Fit',
    personality: { warmth: 70, formality: 30, humor: 50, sales_aggressiveness: 60 },
    communicationStyle: 'casual',
    baseProducts: [
      p('Tenis Urbanos', 699, 'Tenis casuales con suela amortiguada para uso diario.', 'Comodidad todo el día con diseño moderno.'),
      p('Botines Chelsea', 899, 'Botines de piel sintética con elásticos laterales.', 'Estilo elegante y fácil de poner y quitar.'),
      p('Sandalias Playeras', 349, 'Sandalias resistentes al agua para playa o ciudad.', 'Ligeras, secado rápido y antiderrapantes.'),
      p('Zapatos Formales', 1099, 'Zapatos de vestir con plantilla de记忆 foam.', 'Elegancia con comodidad para toda la jornada.'),
      p('Panteras Deportivas', 549, 'Panteras ligeras ideales para el gimnasio.', 'Transpirables y con soporte para el arco del pie.'),
    ],
    baseKnowledge: [
      k('faq', '¿Cómo sé mi talla correcta?', 'Tenemos una guía de tallas en la página. Mide tu pie del talón al dedo más largo.'),
      k('faq', '¿Puedo cambiar la talla si no me queda?', 'Sí, ofrecemos cambio gratuito por talla dentro de los primeros 15 días.'),
      k('objection', 'He tenido malas experiencias comprando zapatos en línea', 'Entendemos tu desconfianza. Ofrecemos cambio gratuito por talla y devolución sin preguntas en 15 días.'),
    ],
    baseRules: [
      r('payment', 'Aceptamos tarjetas de crédito/débito, transferencia y efectivo contra entrega.', 10),
      r('schedule', 'Entregamos de lunes a viernes de 10:00 a 19:00 horas.', 5),
      r('restrictions', 'Los cambios aplican solo para productos sin uso y en empaque original.', 8),
      r('zones', 'Cobertura en León, Irapuato y Silao.', 10),
      r('promotions', '2x1 en sandalias durante el mes de julio.', 7),
    ],
    baseInstructions: [
      'Siempre pregunta la talla y el estilo que busca el cliente antes de recomendar.',
    ],
  },
  {
    name: 'BellezaPura',
    industry: 'Beauty products',
    complexity: 'medium',
    brand: {
      business_name: 'BellezaPura',
      tagline: 'Belleza natural, resultados reales',
      target_customers: 'Mujeres de 18-55 años interesadas en cuidado facial, corporal y maquillaje',
      differentiators: 'Ingredientes naturales, libres de crueldad animal, asesoría de belleza personalizada',
      elevator_pitch: 'BellezaPura ofrece productos de belleza naturales y libres de crueldad animal, con ingredientes que realmente funcionan.',
      tone_of_voice: 'Femenino, cálido, aspiracional',
    },
    assistantName: 'Bella',
    personality: { warmth: 80, formality: 40, humor: 40, sales_aggressiveness: 55 },
    communicationStyle: 'warm',
    baseProducts: [
      p('Sérum Facial Vitamina C', 499, 'Sérum con Vitamina C y ácido hialurónico para rostro.', 'Ilumina la piel y reduce manchas en 4 semanas.'),
      p('Crema Hidratante Facial', 349, 'Crema ligera con aloe vera y manteca de karité.', 'Hidratación profunda sin sensación grasosa.'),
      p('Mascarilla de Arcilla', 249, 'Mascarilla purificante con arcilla verde y té verde.', 'Limpia poros profundamente y controla el exceso de grasa.'),
      p('Labial Mate', 179, 'Labial mate de larga duración en 8 tonos.', 'Color intenso que dura hasta 8 horas.'),
      p('Aceite Corporal de Rosa Mosqueta', 299, 'Aceite regenerador para cicatrices y estrías.', 'Reduce la apariencia de cicatrices y mejora la textura de la piel.'),
    ],
    baseKnowledge: [
      k('faq', '¿Son libres de crueldad animal?', 'Sí, todos nuestros productos son cruelty-free y no testados en animales.'),
      k('faq', '¿Cuánto dura el sérum?', 'Un frasco de 30ml dura aproximadamente 2 meses con uso diario.'),
      k('objection', 'He usado otros sérums y no me han funcionado', 'Nuestro sérum tiene una concentración del 15% de Vitamina C pura, mayor que la mayoría en el mercado.'),
      k('tip', '¿Cómo aplicar el sérum correctamente?', 'Aplica 3 gotas en rostro limpio por la mañana, antes de tu crema hidratante.'),
    ],
    baseRules: [
      ...COMMON_RULES,
      r('promotions', 'Compra 3 labiales y llévate el cuarto gratis.', 7),
      r('zones', 'Cobertura nacional con envío a través de paquetería.', 10),
    ],
    baseInstructions: [
      'Recomienda el sérum de Vitamina C como producto estrella para nuevos clientes.',
      'Si la clienta pregunta por maquillaje, sugiere el labial mate como entrada de gama.',
    ],
  },
  {
    name: 'TechMundo',
    industry: 'Electronics store',
    complexity: 'large',
    brand: {
      business_name: 'TechMundo',
      tagline: 'Tecnología para todos',
      target_customers: 'Hombres y mujeres de 18-50 años, entusiastas de la tecnología y el hogar inteligente',
      differentiators: 'Mejor relación calidad-precio, asesoría técnica especializada, garantía extendida de 2 años',
      elevator_pitch: 'TechMundo es tu tienda de tecnología con los mejores precios, asesoría experta y garantía extendida en todos nuestros productos.',
      tone_of_voice: 'Moderno, técnico pero accesible, entusiasta',
    },
    assistantName: 'Tech',
    personality: { warmth: 60, formality: 50, humor: 35, sales_aggressiveness: 65 },
    communicationStyle: 'direct',
    baseProducts: [
      p('Audífonos Bluetooth Pro', 899, 'Audífonos inalámbricos con cancelación de ruido activa.', 'Sumérgete en tu música sin distracciones externas.'),
      p('Cargador Rápido 65W', 349, 'Cargador USB-C GaN de 65W para laptops y dispositivos.', 'Carga tu laptop 3 veces más rápido que un cargador convencional.'),
      p('Bocina Portátil Resistente', 599, 'Bocina Bluetooth waterproof con 20 horas de batería.', 'Lleva tu música a cualquier parte sin preocuparte por el agua.'),
      p('Hub Multipuerto USB-C', 449, 'Hub de 7 puertos: HDMI, USB-A, USB-C PD, lector SD.', 'Conecta todos tus dispositivos con un solo puerto USB-C.'),
      p('Lámpara Inteligente LED', 299, 'Lámpara WiFi con control por app y compatibilidad Alexa.', 'Controla la iluminación de tu hogar desde tu teléfono.'),
    ],
    baseKnowledge: [
      k('faq', '¿Cuál es la garantía de los audífonos?', 'Todos nuestros audífonos tienen garantía de 2 años por defectos de fábrica.'),
      k('faq', '¿Son compatibles con iPhone?', 'Sí, todos nuestros productos Bluetooth son compatibles con iOS y Android.'),
      k('objection', 'En Amazon está más barato', 'Igualamos precios de Amazon México y además te damos garantía de 2 años contra 1 año de Amazon.'),
      k('tip', '¿Cómo cuidar la batería de tu laptop?', 'Evita dejar la batería al 100% por largos periodos. Mantenla entre 20-80%.'),
    ],
    baseRules: [
      ...COMMON_RULES,
      r('zones', 'Cobertura en León, Irapuato, Silao y envíos nacionales por paquetería.', 10),
      r('promotions', '10% de descuento en accesorios al comprar un producto principal.', 7),
    ],
    baseInstructions: [
      'Siempre ofrece la garantía extendida como valor agregado antes del precio.',
      'Si el cliente duda entre dos productos, recomienda el de mayor potencia/resolución.',
    ],
  },
  {
    name: 'SaborExpress',
    industry: 'Restaurant delivery',
    complexity: 'small',
    brand: {
      business_name: 'SaborExpress',
      tagline: 'El sabor de casa, rápido y fresco',
      target_customers: 'Profesionistas y familias de 20-50 años que buscan comida casera con entrega rápida',
      differentiators: 'Ingredientes frescos del día, tiempo de entrega menor a 40 minutos, cocina abierta',
      elevator_pitch: 'SaborExpress lleva a tu puerta comida casera preparada con ingredientes frescos, en menos de 40 minutos.',
      tone_of_voice: 'Amigable, entusiasta, familiar',
    },
    assistantName: 'Chef',
    personality: { warmth: 85, formality: 25, humor: 55, sales_aggressiveness: 45 },
    communicationStyle: 'casual',
    baseProducts: [
      p('Paquete Ejecutivo Comida', 129, 'Guisado del día con arroz, frijoles y tortillas.', 'Comida completa y balanceada a un precio accesible.'),
      p('Hamburguesa Clásica', 99, 'Hamburguesa con carne angus, queso, lechuga y jitomate.', 'Jugosa y preparada al momento con carne angus.'),
      p('Tacos de Canasta (orden)', 89, 'Orden de 5 tacos de canasta de diferentes guisados.', 'Tacos tradicionales con el sabor de la abuela.'),
      p('Ensalada César', 109, 'Ensalada con lechuga romana, crutones, parmesano y aderezo césar.', 'Opción ligera y saludable para el lunch.'),
      p('Bebida Natural 1L', 45, 'Agua fresca natural de horchata, jamaica o limón.', 'Refrescante y natural, sin colorantes artificiales.'),
    ],
    baseKnowledge: [
      k('faq', '¿Cuánto tarda la entrega?', 'Nuestro tiempo promedio de entrega es de 30-40 minutos.'),
      k('faq', '¿Cuál es el horario?', 'Abrimos de lunes a sábado de 8:00 a 21:00 horas. Domingos de 9:00 a 17:00.'),
      k('objection', 'Me queda muy lejos', 'Verifica tu código postal, cubrimos un área de 15km a la redonda.'),
    ],
    baseRules: [
      r('payment', 'Efectivo contra entrega, tarjeta al recibir o pago por app.', 10),
      r('schedule', 'Pedidos hasta las 20:00 para entrega el mismo día.', 8),
      r('zones', 'Entregamos en un radio de 15km del centro de León.', 10),
      r('restrictions', 'Mínimo de pedido: $80. Aplica cargo de $15 por entregas fuera del radio de 10km.', 8),
    ],
    baseInstructions: [
      'Siempre ofrece el paquete ejecutivo como opción económica para nuevos clientes.',
      'Pregunta si tienen alguna preferencia o alergia alimentaria.',
    ],
  },
  {
    name: 'FitZone',
    industry: 'Fitness products',
    complexity: 'medium',
    brand: {
      business_name: 'FitZone',
      tagline: 'Transforma tu cuerpo, transforma tu vida',
      target_customers: 'Hombres y mujeres de 18-45 años interesados en fitness, crossfit y entrenamiento en casa',
      differentiators: 'Equipo profesional a precio accesible, rutinas incluidas con cada producto, asesoría virtual gratuita',
      elevator_pitch: 'FitZone ofrece equipo de fitness profesional para que puedas entrenar en casa con la misma calidad que en el gym.',
      tone_of_voice: 'Energético, motivador, directo',
    },
    assistantName: 'Fit',
    personality: { warmth: 65, formality: 35, humor: 45, sales_aggressiveness: 70 },
    communicationStyle: 'direct',
    baseProducts: [
      p('Kit de Resistencias', 599, 'Set de 5 bandas de resistencia de diferentes niveles.', 'Ideal para tonificar y fortalecer desde casa.'),
      p('Cuerda para Saltar', 199, 'Cuerda profesional con rodamientos de alta velocidad.', 'Quema calorías rápido con el mejor cardio de salto.'),
      p('Mat de Yoga', 349, 'Tapete antiderrapante de 6mm con bolsa de transporte.', 'Comodidad y seguridad para tu práctica de yoga o ejercicio.'),
      p('Juego de Mancuernas', 899, 'Par de mancuernas hexagonales de 5kg cada una.', 'Perfectas para ejercicios de tonificación y fuerza.'),
      p('Rodillo de Espuma', 299, 'Rodillo de espuma de alta densidad para liberación muscular.', 'Recupérate más rápido después de cada entrenamiento.'),
    ],
    baseKnowledge: [
      k('faq', '¿Qué nivel de resistencia elegir?', 'Principiantes: nivel ligero. Intermedios: nivel medio. Avanzados: nivel pesado.'),
      k('faq', '¿Incluyen rutinas?', 'Sí, cada producto incluye acceso a nuestra app con rutinas guiadas.'),
      k('objection', 'No sé si lo voy a usar suficiente', 'Empieza con la cuerda para saltar, es el equipo más versátil y económico.'),
      k('tip', '¿Cómo empezar una rutina en casa?', 'Comienza con 15 minutos al día con bandas de resistencia y aumenta gradualmente.'),
    ],
    baseRules: [
      ...COMMON_RULES,
      r('promotions', 'Compra el Kit de Resistencias y llévate la cuerda con 50% de descuento.', 8),
      r('zones', 'Envíos a todo México con un cargo de $99 para zonas fuera de cobertura local.', 5),
    ],
    baseInstructions: [
      'Recomienda empezar con el kit de resistencias para clientes nuevos.',
      'Si el cliente menciona dolor de espalda, sugiere el rodillo de espuma como prioridad.',
    ],
  },
  {
    name: 'PatitasFelices',
    industry: 'Pet products',
    complexity: 'small',
    brand: {
      business_name: 'PatitasFelices',
      tagline: 'Todo para tu mejor amigo',
      target_customers: 'Dueños de perros y gatos de 25-55 años que buscan lo mejor para sus mascotas',
      differentiators: 'Alimento premium importado, juguetes interactivos, asesoría veterinaria incluida',
      elevator_pitch: 'PatitasFelices tiene todo lo que tu mascota necesita: alimento premium, juguetes y accesorios con la mejor calidad.',
      tone_of_voice: 'Cálido, juguetón, amante de los animales',
    },
    assistantName: 'Patitas',
    personality: { warmth: 90, formality: 20, humor: 60, sales_aggressiveness: 40 },
    communicationStyle: 'warm',
    baseProducts: [
      p('Alimento Premium Perro Adulto 3kg', 399, 'Croquetas con proteína real de pollo para perros adultos.', 'Nutrición completa con ingredientes naturales.'),
      p('Juguete Interactivo Kong', 249, 'Juguete de goma dura para rellenar con premios.', 'Horas de diversión y estimulación mental para tu perro.'),
      p('Cama Ortopédica para Mascotas', 599, 'Cama con memoria foam para perros y gatos.', 'Máxima comodidad para el descanso de tu mascota.'),
      p('Correa Retráctil 5m', 299, 'Correa automática de 5 metros con mango ergonómico.', 'Control y libertad para tu paseo diario.'),
      p('Rascador para Gatos', 449, 'Rascador de 3 niveles con sisal y plataforma.', 'Tu gato tendrá su propio espacio para jugar y afilar uñas.'),
    ],
    baseKnowledge: [
      k('faq', '¿Qué marca de alimento venden?', 'Manejamos Royal Canin, Hill\'s y nuestra marca premium PatitasFelices.'),
      k('faq', '¿Tienen juguetes para gatos?', 'Sí, tenemos rascadores, pelotas con campana y varitas interactivas.'),
      k('objection', 'Mi perro es muy exigente con la comida', 'Ofrecemos muestras gratis de 200g para que pruebe antes de comprar.'),
    ],
    baseRules: [
      r('payment', 'Aceptamos efectivo, tarjeta y transferencia.', 10),
      r('schedule', 'Entregamos de lunes a sábado de 10:00 a 19:00 horas.', 5),
      r('zones', 'Cobertura local en León y Lagos de Moreno.', 10),
      r('restrictions', 'No aceptamos devoluciones de alimento abierto por higiene.', 8),
    ],
    baseInstructions: [
      'Siempre pregunta qué tipo de mascota tiene el cliente antes de recomendar.',
      'Ofrece muestras de alimento para clientes indecisos.',
    ],
  },
  {
    name: 'ModaUrbana',
    industry: 'Clothing store',
    complexity: 'large',
    brand: {
      business_name: 'ModaUrbana',
      tagline: 'Viste la ciudad',
      target_customers: 'Jóvenes y adultos de 18-40 años que siguen tendencias de moda urbana',
      differentiators: 'Diseños exclusivos, ediciones limitadas, colaboraciones con artistas locales',
      elevator_pitch: 'ModaUrbana es tu tienda de ropa con diseños exclusivos y ediciones limitadas que reflejan el estilo de la ciudad.',
      tone_of_voice: 'Moderno, cool, auténtico',
    },
    assistantName: 'Urbana',
    personality: { warmth: 60, formality: 25, humor: 55, sales_aggressiveness: 65 },
    communicationStyle: 'casual',
    baseProducts: [
      p('Playera Algodón Orgánico', 299, 'Playera de algodón orgánico con diseño serigrafiado.', 'Cómoda, transpirable y con diseño exclusivo.'),
      p('Jeans Skinny Rectos', 599, 'Jeans de mezclilla elástica con corte recto.', 'Comodidad y estilo que se adapta a tu cuerpo.'),
      p('Chamarra Bomber', 899, 'Chamarra tipo bomber con forro térmico.', 'Abriga sin sacrificar el estilo urbano.'),
      p('Gorra Snapback', 249, 'Gorra ajustable con diseño bordado.', 'El accesorio perfecto para completar tu look.'),
      p('Mochila Urbana 25L', 549, 'Mochila con compartimiento para laptop de 15\".', 'Funcional y moderna para tu día a día.'),
    ],
    baseKnowledge: [
      k('faq', '¿Cómo cuido mi playera estampada?', 'Lávala del revés con agua fría para conservar el estampado.'),
      k('faq', '¿Tienen tabla de tallas?', 'Sí, en cada producto encontrarás una guía de tallas específica.'),
      k('objection', '¿La chamarra es buena para el frío?', 'Sí, tiene forro térmico interior y es resistente al viento.'),
    ],
    baseRules: [
      ...COMMON_RULES,
      r('promotions', 'Llévate 2 playeras y obten 30% de descuento en la tercera.', 8),
      r('zones', 'Envíos a todo México con cobertura local en León, Irapuato, Silao.', 10),
    ],
    baseInstructions: [
      'Siempre pregunta el estilo que busca el cliente: casual, formal o deportivo.',
      'Ofrece la chamarra bomber como artículo versátil para cualquier ocasión.',
    ],
  },
  {
    name: 'NutriVida',
    industry: 'Supplements',
    complexity: 'medium',
    brand: {
      business_name: 'NutriVida',
      tagline: 'Nutrición inteligente',
      target_customers: 'Personas de 20-50 años que buscan mejorar su alimentación y rendimiento físico',
      differentiators: 'Suplementos con certificación GMP, asesoría nutricional gratuita, ingredientes importados',
      elevator_pitch: 'NutriVida ofrece suplementos de alta calidad con certificación GMP y asesoría nutricional gratuita para ayudarte a alcanzar tus metas.',
      tone_of_voice: 'Profesional, científico, motivador',
    },
    assistantName: 'Nutri',
    personality: { warmth: 65, formality: 60, humor: 25, sales_aggressiveness: 55 },
    communicationStyle: 'direct',
    baseProducts: [
      p('Proteína Whey Aislada 1kg', 699, 'Proteína de suero de leche aislada con 25g de proteína por porción.', 'Recuperación muscular rápida con mínimas calorías.'),
      p('Pre-entreno Explosivo', 449, 'Pre-entreno con cafeína, beta-alanina y citrulina.', 'Energía y enfoque para tus entrenamientos más intensos.'),
      p('Creatina Monohidratada', 399, 'Creatina micronizada pura 100% sin aditivos.', 'Aumenta tu fuerza y rendimiento en ejercicios de alta intensidad.'),
      p('Omega 3 Triple Concentración', 299, 'Aceite de pescado con EPA y DHA concentrados.', 'Apoya la salud cardiovascular y cognitiva.'),
      p('Barra Proteica Sabor Chocolate', 189, 'Barra con 20g de proteína, baja en azúcar. Paquete de 12.', 'Snack proteico práctico para llevar a cualquier parte.'),
    ],
    baseKnowledge: [
      k('faq', '¿Cuándo debo tomar la proteína?', 'Ideal después del entrenamiento dentro de la ventana anabólica de 30 minutos.'),
      k('faq', '¿La creatina retiene líquidos?', 'La creatina aumenta el volumen muscular intracelular, no causa retención subcutánea.'),
      k('objection', 'Los suplementos son caros', 'Por porción, nuestra proteína sale a $23, más barato que una comida post-entreno.'),
      k('tip', '¿Cómo empezar con suplementos?', 'Recomendamos empezar con proteína whey y creatina como base.'),
    ],
    baseRules: [
      ...COMMON_RULES,
      r('promotions', 'Compra proteína + creatina y obtén 15% de descuento en el paquete.', 8),
      r('zones', 'Envíos a todo México. Gratis en compras mayores a $800.', 5),
    ],
    baseInstructions: [
      'Siempre pregunta el objetivo del cliente (perder peso, ganar músculo, rendimiento) antes de recomendar.',
      'El paquete proteína + creatina es la mejor opción para principiantes.',
    ],
  },
  {
    name: 'ServiPro',
    industry: 'Local services',
    complexity: 'small',
    brand: {
      business_name: 'ServiPro',
      tagline: 'Profesionales de confianza',
      target_customers: 'Propietarios de casa y departamentos de 25-60 años que necesitan servicios de reparación y mantenimiento',
      differentiators: 'Profesionales verificados, presupuesto sin compromiso, garantía de servicio de 90 días',
      elevator_pitch: 'ServiPro conecta a propietarios con profesionales verificados para reparación y mantenimiento del hogar, con presupuesto sin compromiso.',
      tone_of_voice: 'Profesional, confiable, claro',
    },
    assistantName: 'Pro',
    personality: { warmth: 70, formality: 55, humor: 20, sales_aggressiveness: 50 },
    communicationStyle: 'formal',
    baseProducts: [
      p('Paquete Plomería Express', 499, 'Reparación de fugas, instalación de llaves y desagües.', 'Solución rápida para emergencias de plomería.'),
      p('Servicio Eléctrico Completo', 599, 'Instalación de contactos, apagadores y centros de carga.', 'Electricidad segura y conforme a norma.'),
      p('Pintura Interior m²', 45, 'Pintura de interiores con materiales incluidos por metro cuadrado.', 'Renueva tus espacios con precio por m².'),
      p('Limpieza Profunda', 799, 'Limpieza general de casa de hasta 100m².', 'Tu casa limpia y desinfectada de principio a fin.'),
      p('Mantenimiento de Aire', 399, 'Limpieza y servicio básico de unidad split.', 'Mejora la eficiencia y vida útil de tu aire acondicionado.'),
    ],
    baseKnowledge: [
      k('faq', '¿Dan presupuesto a domicilio?', 'Sí, el presupuesto es sin compromiso y totalmente gratuito.'),
      k('faq', '¿Cuánto dura la garantía?', 'Todos nuestros servicios tienen garantía de 90 días.'),
      k('objection', 'He tenido malas experiencias con servicios anteriores', 'Todos nuestros profesionales están verificados y evaluados por otros clientes.'),
    ],
    baseRules: [
      r('payment', 'Aceptamos efectivo, tarjeta y transferencia. Pago contra recepción del servicio.', 10),
      r('schedule', 'Agendamos servicios de lunes a sábado de 8:00 a 18:00 horas.', 8),
      r('zones', 'Cobertura en León y zona metropolitana.', 10),
      r('restrictions', 'El presupuesto es gratuito pero si no se concreta el servicio, se cobra una visita de $150.', 7),
    ],
    baseInstructions: [
      'Siempre ofrece el presupuesto sin compromiso como primer paso.',
      'Pregunta si es emergencia o servicio programado para priorizar la agenda.',
    ],
  },
]

function generateVariants<T>(baseItems: T[], targetCount: number, makeVariant: (base: T, index: number) => T): T[] {
  if (baseItems.length >= targetCount) return baseItems.slice(0, targetCount)
  const result = [...baseItems]
  while (result.length < targetCount) {
    const base = result[result.length % baseItems.length]
    result.push(makeVariant(base, result.length))
  }
  return result
}

export function generateBusinessDefs(businessCount: number): BusinessDef[] {
  const defs = BUSINESS_DEFS.slice(0, businessCount)
  return defs.map((b, i) => {
    const complexityTargets = COMPLEXITY_TARGETS[b.complexity]
    return {
      ...b,
      id: crypto.randomUUID(),
      name: `${SCALE_TEST_PREFIX} ${b.name}`,
      baseProducts: generateVariants(b.baseProducts, complexityTargets.products, (base, idx) => ({
        name: `${base.name} ${idx % 3 === 0 ? 'Plus' : idx % 3 === 1 ? 'Pro' : 'Estandar'}`,
        price: Math.round(base.price * (0.8 + (idx % 5) * 0.1)),
        description: `${base.description} (Variante ${idx + 1})`,
        benefits: base.benefits,
      })),
      baseKnowledge: generateVariants(b.baseKnowledge, complexityTargets.knowledge, (base, idx) => ({
        category: base.category,
        question: `${base.question} (${idx + 1})`,
        answer: `${base.answer} [Variante ${idx + 1}]`,
      })),
      baseRules: generateVariants(b.baseRules, complexityTargets.rules, (base, idx) => ({
        category: base.category,
        content: `${base.content} (Regla ${idx + 1})`,
        priority: Math.max(1, base.priority - (idx % 3)),
      })),
      baseInstructions: generateVariants(b.baseInstructions, complexityTargets.instructions, (base, idx) =>
        `${base} (Instrucción complementaria ${idx + 1})`
      ),
    }
  })
}