CREATE TABLE mia_signals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('LEARNING', 'SALES', 'CUSTOMER', 'INVENTORY', 'SYSTEM', 'DECISION')),
  priority TEXT NOT NULL CHECK (priority IN ('info', 'observacion', 'atencion', 'decision')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'resolved', 'dismissed')),
  action_available TEXT,
  action_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE mia_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_owner_signals" ON mia_signals
  FOR ALL
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

CREATE INDEX idx_mia_signals_business ON mia_signals(business_id, status);
CREATE INDEX idx_mia_signals_priority ON mia_signals(business_id, priority, created_at DESC);
