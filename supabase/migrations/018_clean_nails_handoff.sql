-- =============================================
-- MIA - Asistente de Ventas IA
-- Clean Nails landing: handoff a WhatsApp
-- (knowledge item para el negocio Vitanova)
-- =============================================

INSERT INTO public.knowledge_items (business_id, category, question, answer, source, confidence, is_active)
VALUES (
  '0d40a769-7a21-4cb3-9472-bdc9638675d6',
  'process',
  'El cliente quiere comprar Clean Nails desde el web chat de la landing',
  'En el web chat de la landing de Clean Nails, si el cliente muestra intención de compra (pregunta por precio, quiere pedir, pregunta por pagos, envío o coordinación de entrega), invítalo a continuar por WhatsApp para cerrar su pedido con acompañamiento real. Responde con un mensaje amable que incluya el enlace https://wa.me/524775250039 con un mensaje prellenado como "Hola, quiero pedir mi Clean Nails". No forces al cliente: si insiste en quedarse en el web chat, continúa asesorándolo ahí.',
  'manual',
  'high',
  true
);
