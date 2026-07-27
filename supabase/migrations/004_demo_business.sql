-- Demo business for public demo mode
-- This migration creates a pre-configured demo business

INSERT INTO businesses (id, owner_id, name, onboarding_status, created_at, updated_at)
VALUES (
  'demo-business-00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'Zapatería Demo',
  'ready',
  NOW(),
  NOW()
);

INSERT INTO brand_identities (business_id, business_name, tagline, target_customers, differentiators, elevator_pitch, tone_of_voice)
VALUES (
  'demo-business-00000000-0000-0000-0000-000000000000',
  'Zapatería Demo',
  'Tu zapato ideal te espera',
  'Personas jóvenes y adultas que buscan zapatos cómodos y con estilo para uso diario y deportivo',
  'Garantía de 6 meses en todos nuestros productos, envío gratis en la ciudad, y asesoría personalizada para encontrar tu zapato perfecto',
  'Somos Zapatería Demo, tu tienda de confianza para zapatos deportivos y casuales con la mejor calidad y servicio.',
  'Amable y cercana'
);

INSERT INTO assistants (id, business_id, name, personality, communication_style, is_active)
VALUES (
  'demo-assistant-00000000-0000-0000-0000-000000000000',
  'demo-business-00000000-0000-0000-0000-000000000000',
  'Luna',
  '{"warmth": 85, "formality": 40, "humor": 50, "sales_aggressiveness": 50}',
  'warm',
  true
);

INSERT INTO assistant_channels (assistant_id, channel, is_active)
VALUES (
  'demo-assistant-00000000-0000-0000-0000-000000000000',
  'web',
  true
);

INSERT INTO products (business_id, name, price, description, benefits, is_active)
VALUES
  (
    'demo-business-00000000-0000-0000-0000-000000000000',
    'Tenis Deportivos Pro',
    1299.00,
    'Tenis deportivos para running y entrenamiento con tecnología de amortiguación avanzada.',
    'Comodidad extrema, durabilidad, diseño moderno, ideales para entrenamiento diario.',
    true
  ),
  (
    'demo-business-00000000-0000-0000-0000-000000000000',
    'Sneakers Urbanos Classic',
    899.00,
    'Zapatos casuales estilo urbano, perfectos para el día a día.',
    'Versátiles, fáciles de combinar, cómodos para uso prolongado.',
    true
  ),
  (
    'demo-business-00000000-0000-0000-0000-000000000000',
    'Sandalias Comfort',
    599.00,
    'Sandalias con suela anatómica para máximo confort en días calurosos.',
    'Soporte ergonámico, materiales transpirables, ideales para el verano.',
    true
  ),
  (
    'demo-business-00000000-0000-0000-0000-000000000000',
    'Botas de Montaña Trail',
    1899.00,
    'Botas resistentes para senderismo y aventura con tracción superior.',
    'Impermeables, suela antideslizante, protección en tobillo.',
    true
  );

INSERT INTO sales_rules (business_id, category, content, priority, is_active)
VALUES
  (
    'demo-business-00000000-0000-0000-0000-000000000000',
    'zones',
    'Hacemos envíos a toda la ciudad. Envío gratis en compras mayores a $500.',
    1,
    true
  ),
  (
    'demo-business-00000000-0000-0000-0000-000000000000',
    'payment',
    'Aceptamos efectivo, tarjeta de débito, tarjeta de crédito y transferencia bancaria. Puedes pagar a 3 meses sin intereses con tarjeta de crédito.',
    1,
    true
  ),
  (
    'demo-business-00000000-0000-0000-0000-000000000000',
    'schedule',
    'Atendemos de lunes a sábado de 9:00 a 20:00 y domingos de 10:00 a 18:00.',
    1,
    true
  ),
  (
    'demo-business-00000000-0000-0000-0000-000000000000',
    'restrictions',
    'No realizamos cambios sin etiqueta. Los productos en liquidación no tienen cambio. Garantía de 6 meses contra defectos de fabricación.',
    1,
    true
  );

INSERT INTO knowledge_items (business_id, category, question, answer, source, is_active)
VALUES
  (
    'demo-business-00000000-0000-0000-0000-000000000000',
    'faq',
    '¿Tienen garantía?',
    'Sí, todos nuestros productos tienen garantía de 6 meses contra defectos de fabricación. Si tu zapato tiene algún problema, traelo y lo revisamos.',
    'onboarding',
    true
  ),
  (
    'demo-business-00000000-0000-0000-0000-000000000000',
    'faq',
    '¿Puedo devolver un producto?',
    'Sí, tienes 30 días para devoluciones. El producto debe estar sin uso y con etiqueta. En liquidación no se aceptan devoluciones.',
    'onboarding',
    true
  ),
  (
    'demo-business-00000000-0000-0000-0000-000000000000',
    'faq',
    '¿Cuánto tarda el envío?',
    'El envío tarda de 1 a 3 días hábiles dependiendo de tu zona. En compras mayores a $500 el envío es gratis.',
    'onboarding',
    true
  ),
  (
    'demo-business-00000000-0000-0000-0000-000000000000',
    'tip',
    '¿Cómo elijo mi talla?',
    'Te recomiendo medir tu pie por la tarde cuando está más hinchado. Mide desde el talón hasta la punta y consulta nuestra guía de tallas.',
    'onboarding',
    true
  ),
  (
    'demo-business-00000000-0000-0000-0000-000000000000',
    'objection',
    '¿Por qué son más caros que otras tiendas?',
    'Nuestros zapatos tienen garantía de 6 meses, materiales de alta calidad y asesoría personalizada. La inversión vale la pena por la durabilidad y comodidad.',
    'onboarding',
    true
  );
