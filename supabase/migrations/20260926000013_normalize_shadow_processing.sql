-- =============================================
-- NORMALIZA LOS OUTGOING QUE QUEDARON EN 'processing'
-- =============================================
-- runtime.ts usaba status='processing' como estado TERMINAL de las respuestas
-- en modo shadow: la respuesta se generaba y persistia, pero no se entregaba,
-- y sent_at se dejaba en NULL. Nada en el codebase actualiza despues una fila
-- de channel_messages (no existe un solo .update() sobre esa tabla en 490
-- archivos), asi que 'processing' quedaba congelado para siempre.
--
-- El efecto fue que 12 respuestas correctamente suprimidas se leian como
-- entregas atascadas en vuelo. El triaje confirmó que las 12 tienen
-- metadata.shadow = true, metadata.delivered = false y sent_at IS NULL: nunca
-- se intento entregar y no hay ninguna entrega perdida.
--
-- Aqui se las lleva a 'sent' —el mismo estado que escribe una entrega real—
-- conservando sent_at en NULL y la metadata intacta. Asi 'status' vuelve a
-- responder "que paso con este mensaje" y la politica de entrega vive solo en
-- metadata. Las que no sean shadow quedan intactas a proposito: si alguna
-- existiera seria un caso distinto y no debe normalizarse a ciegas.
--
-- Idempotente: tras correr una vez no vuelve a encontrar filas que matcheen.
-- =============================================

DO $$
DECLARE
  v_business  CONSTANT uuid := '4fb7418d-6c98-4a09-9094-4e4e4b2006a6';
  v_normalized integer;
BEGIN
  UPDATE public.channel_messages
     SET status = 'sent'
   WHERE business_id = v_business
     AND direction = 'outgoing'
     AND status = 'processing'
     AND sent_at IS NULL
     AND (metadata ->> 'shadow') = 'true'
     AND (metadata ->> 'delivered') = 'false';

  GET DIAGNOSTICS v_normalized = ROW_COUNT;

  RAISE NOTICE 'channel_messages: % respuestas shadow normalizadas de processing a sent', v_normalized;
END $$;