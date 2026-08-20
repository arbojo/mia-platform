-- =============================================================================
-- SEED DATA: Experience Memory — Patrones globales e industriales de prueba
-- Ejecutar después de supabase db reset o supabase db push
-- =============================================================================

-- Patrones GLOBALES (scope = 'global', business_id = NULL)
INSERT INTO public.experience_memory (scope, industry, pattern_key, customer_objection, sample_raw_query, suggested_response, conversion_probability, confidence_level, observation_count)
VALUES
  ('global', NULL, 'precio-alto', 'El precio es muy alto', '¿No tienen algo más barato?', 'Entiendo su preocupación por el precio. Nuestro producto incluye garantía de por vida y soporte prioritario, lo cual reduce el costo total de propiedad.', 0.780, 0.820, 342),
  ('global', NULL, 'envio-lento', '¿Cuánto tarda en llegar?', '¿Pueden enviarlo rápido?', 'Trabajamos con empresas de logística de primer nivel. El envío estándar llega en 3-5 días hábiles, y ofrecemos express en 24-48 horas con costo adicional.', 0.810, 0.790, 287),
  ('global', NULL, 'duda-calidad', '¿De qué está hecho? ¿Es de buena calidad?', '¿La calidad es buena?', 'Todos nuestros productos pasan por control de calidad riguroso. Usamos materiales premium y ofrecemos certificación de calidad con cada compra.', 0.750, 0.770, 198),
  ('global', NULL, 'comparacion-competencia', 'Vi algo similar más barato en otra tienda', '¿Por qué son más caros que los demás?', 'La diferencia está en la garantía, el soporte post-venta y la calidad de materiales. Nuestros clientes reportan 40% menos devoluciones que el promedio del mercado.', 0.690, 0.710, 156),
  ('global', NULL, 'garantia-incertidumbre', '¿Qué pasa si no me gusta?', '¿Puedo devolverlo?', 'Ofrecemos 30 días de garantía de satisfacción. Si no estás conforme, lo cambiamos o te devolvemos el 100% de tu dinero sin preguntas.', 0.830, 0.850, 412),
  ('global', NULL, 'urgencia-perdida', 'Ya lo voy a pensar', 'Después regreso', 'Perfecto, tómate tu tiempo. Solo quiero que sepas que esta promoción es por tiempo limitado y tenemos stock limitado. ¿Te guardo uno mientras decides?', 0.620, 0.680, 234),
  ('global', NULL, 'confianza-online', '¿Son una empresa seria?', '¿Compro aquí con confianza?', 'Somos una empresa con más de 5 años en el mercado, con más de 10,000 clientes satisfechos. Puedes revisar nuestras reseñas en Google y redes sociales.', 0.770, 0.800, 189);

-- Patrones INDUSTRIALES para salud_suplementos (scope = 'industry')
INSERT INTO public.experience_memory (scope, industry, pattern_key, customer_objection, sample_raw_query, suggested_response, conversion_probability, confidence_level, observation_count)
VALUES
  ('industry', 'salud_suplementos', 'efectos-secundarios', '¿Tiene efectos secundarios?', '¿Me puede hacer daño?', 'Todos nuestros suplementos cuentan con certificación sanitaria. Los ingredientes son 100% naturales y no causan efectos secundarios. Consulta la ficha técnica de cada producto para más detalles.', 0.820, 0.840, 167),
  ('industry', 'salud_suplementos', 'resultados-tiempo', '¿Cuánto tarda en hacer efecto?', '¿Cuándo voy a ver resultados?', 'Los suplementos naturales requieren uso constante. La mayoría de nuestros clientes reportan mejoras visibles entre las 2 y 4 semanas de uso regular.', 0.760, 0.780, 143),
  ('industry', 'salud_suplementos', 'interacciones-medicamentos', '¿Puedo tomarlo con mi medicina?', '¿Interactúa con otros medicamentos?', 'Recomendamos consultar con tu médico antes de tomar cualquier suplemento si estás medicado. Cada producto tiene una lista de contraindicaciones en su ficha.', 0.850, 0.870, 98),
  ('industry', 'salud_suplementos', 'autenticidad-producto', '¿Es original? ¿No es falso?', '¿Garantizan que es original?', 'Somos distribuidores autorizados. Cada producto tiene código de verificación y certificado de autenticidad. Puedes verificarlo directamente con el fabricante.', 0.880, 0.900, 112),
  ('industry', 'salud_suplementos', 'mejor-opcion', '¿Cuál me recomienda para mi caso?', '¿Cuál es el mejor para mí?', 'Para darte la mejor recomendación, cuéntame: ¿cuál es tu objetivo principal? ¿Energía, digestión, inmunidad, o algo específico? Así te oriento al producto ideal.', 0.910, 0.890, 201);

-- Patrones INDUSTRIALES para inmobiliaria (scope = 'industry')
INSERT INTO public.experience_memory (scope, industry, pattern_key, customer_objection, sample_raw_query, suggested_response, conversion_probability, confidence_level, observation_count)
VALUES
  ('industry', 'inmobiliaria', 'financiamiento', '¿Aceptan financiamiento?', '¿Puedo pagar a meses?', 'Trabajamos con varios bancos y ofrecemos planes de financiamiento directo con Enganche desde 10%. ¿Te interesa que te cotice uno a tu medida?', 0.790, 0.810, 87),
  ('industry', 'inmobiliaria', 'ubicacion-seguridad', '¿La zona es segura?', '¿Es seguro vivir ahí?', 'La zona cuenta con vigilancia 24/7, accesos controlados y está a 5 minutos de centros comerciales y hospitales. Puedes revisar las estadísticas de seguridad del municipio.', 0.830, 0.850, 76),
  ('industry', 'inmobiliaria', 'precio-metro', '¿Cuánto cuesta por metro cuadrado?', '¿El precio es justo?', 'Nuestros precios están alineados con el mercado de la zona. Incluye acabados de primera y áreas comunes. ¿Quieres que te muestre la comparativa con propiedades similares?', 0.740, 0.760, 65);

SELECT 'Seed data inserted successfully' AS result;
SELECT count(*) AS total_patterns FROM public.experience_memory;
