-- ============================================================================
-- MIA Sales TRUE_E2E Seed Data (deterministic test tenant)
-- ============================================================================
-- Prerequisite (run once in Supabase Dashboard -> Authentication -> Users):
--   Add user: e2e-test-owner@mia-platform.com / test-password-123
--   (Auto Confirm User = ON)
--
-- Then run THIS script in Supabase SQL Editor.
-- It resolves the owner UUID dynamically by email, so no manual ID editing.
-- Idempotent: safe to re-run.
-- ============================================================================

DO $$
DECLARE
  v_owner_id uuid;
  v_business_id uuid;
  v_assistant_id uuid;
  v_product_id uuid;
BEGIN
  -- ------------------------------------------------------------------
  -- STEP 1: Resolve the auth user created in Supabase Dashboard
  -- ------------------------------------------------------------------
  SELECT id INTO v_owner_id
  FROM auth.users
  WHERE email = 'e2e-test-owner@mia-platform.com';

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION
      'Auth user e2e-test-owner@mia-platform.com not found. Create it first in Dashboard > Authentication > Users (password: test-password-123, Auto Confirm = ON).';
  END IF;

  -- ------------------------------------------------------------------
  -- STEP 2: Business (schema: businesses = id, owner_id, name, onboarding_status)
  -- ------------------------------------------------------------------
  INSERT INTO public.businesses (owner_id, name, onboarding_status)
  VALUES (v_owner_id, 'E2E Test Business', 'ready')
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_business_id
  FROM public.businesses
  WHERE owner_id = v_owner_id AND name = 'E2E Test Business'
  LIMIT 1;

  -- ------------------------------------------------------------------
  -- STEP 3: Brand identity (context builder reads this table)
  -- ------------------------------------------------------------------
  INSERT INTO public.brand_identities (business_id, business_name, tagline, target_customers, differentiators, elevator_pitch, tone_of_voice)
  VALUES (
    v_business_id,
    'E2E Test Business',
    'Validacion E2E de MIA',
    'Clientes de prueba automatizados',
    'Datos deterministas para pruebas',
    'Negocio sintetico usado por la suite TRUE_E2E para validar el flujo completo de venta con medios.',
    'calido'
  )
  ON CONFLICT (business_id) DO NOTHING;

  -- ------------------------------------------------------------------
  -- STEP 4: Assistant (communication_style is NOT NULL + CHECK)
  -- ------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM public.assistants WHERE business_id = v_business_id AND name = 'E2E Test Assistant') THEN
    INSERT INTO public.assistants (business_id, name, personality, communication_style, is_active)
    VALUES (
      v_business_id,
      'E2E Test Assistant',
      '{"warmth":50,"formality":50,"humor":20,"sales_aggressiveness":40}'::jsonb,
      'warm',
      true
    );
  END IF;

  SELECT id INTO v_assistant_id
  FROM public.assistants
  WHERE business_id = v_business_id AND name = 'E2E Test Assistant'
  LIMIT 1;

  -- ------------------------------------------------------------------
  -- STEP 5: Product (no unique(name): guard with NOT EXISTS)
  -- Image URL is a deterministic public placeholder; the assertion checks
  -- the src attribute contains the slug, not that the bytes resolve.
  -- ------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE business_id = v_business_id AND name = 'E2E Test Neurofeet') THEN
    INSERT INTO public.products (business_id, name, price, description, benefits, faq, image_url, is_active)
    VALUES (
      v_business_id,
      'E2E Test Neurofeet',
      499.00,
      'Producto de prueba E2E para validar la resolucion de productos de MIA.',
      'Alivio del dolor, mejora de la movilidad.',
      '[{"q":"¿Cómo se usa?","a":"Se usa según indicaciones."}]'::jsonb,
      'https://xyz.supabase.co/storage/v1/object/public/media/e2e-test-neurofeet.jpg',
      true
    );
  END IF;

  SELECT id INTO v_product_id
  FROM public.products
  WHERE business_id = v_business_id AND name = 'E2E Test Neurofeet'
  LIMIT 1;

  -- ------------------------------------------------------------------
  -- STEP 6: Knowledge item with conditional media trigger
  -- CHECKs: category IN (business_info|faq|objection|process|tip),
  --         source IN (onboarding|manual|correction|document|audio),
  --         media_type IN (image|testimonial)
  -- ------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM public.knowledge_items
    WHERE business_id = v_business_id AND trigger_condition = 'E2E Test Neurofeet'
  ) THEN
    INSERT INTO public.knowledge_items (
      business_id, product_id, category, question, answer,
      trigger_condition, image_url, media_type,
      confidence, is_active, source
    )
    VALUES (
      v_business_id,
      v_product_id,
      'faq',
      '¿Cuáles son los beneficios del E2E Test Neurofeet?',
      'Los beneficios del E2E Test Neurofeet incluyen alivio del dolor y mejora de la movilidad.',
      'E2E Test Neurofeet',
      'https://xyz.supabase.co/storage/v1/object/public/media/e2e-test-neurofeet.jpg',
      'image',
      'high',
      true,
      'manual'
    );
  END IF;

  -- ------------------------------------------------------------------
  -- VERIFICATION
  -- ------------------------------------------------------------------
  RAISE NOTICE '=== SEED OK ===';
  RAISE NOTICE 'owner: %', (SELECT email FROM auth.users WHERE id = v_owner_id);
  RAISE NOTICE 'business: % (%)', (SELECT name FROM public.businesses WHERE id = v_business_id), v_business_id;
  RAISE NOTICE 'assistant: % (% active)', v_assistant_id, (SELECT is_active FROM public.assistants WHERE id = v_assistant_id);
  RAISE NOTICE 'product: % price=% img=%', v_product_id,
    (SELECT price FROM public.products WHERE id = v_product_id),
    (SELECT image_url FROM public.products WHERE id = v_product_id);
END $$;

-- Final cross-check visible in results panel
SELECT
  b.name            AS business,
  a.name            AS assistant,
  p.name            AS product,
  p.price           AS price,
  p.image_url       AS product_image,
  ki.trigger_condition AS trigger,
  ki.media_type     AS media_type,
  ki.image_url      AS knowledge_image
FROM public.businesses b
JOIN public.assistants a      ON a.business_id = b.id
JOIN public.products p        ON p.business_id = b.id
LEFT JOIN public.knowledge_items ki ON ki.product_id = p.id
WHERE b.name = 'E2E Test Business';
