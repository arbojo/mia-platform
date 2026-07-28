-- Sprint 10.1: Business Memory, Skills, Weekly Reports, Learning Velocity
-- MIA becomes an employee that improves every day

-- ============================================================
-- BUSINESS MEMORY
-- Stores patterns, experiences, and trends (not just facts)
-- ============================================================
CREATE TABLE business_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('pattern', 'experience', 'insight', 'trend')),
  category TEXT NOT NULL CHECK (category IN (
    'customer_behavior',
    'product_performance',
    'sales_pattern',
    'objection_trend',
    'faq_frequency',
    'delivery_question',
    'payment_question',
    'warranty_question',
    'pricing_question',
    'competition_question'
  )),
  content TEXT NOT NULL,
  evidence JSONB DEFAULT '{}',
  confidence INTEGER DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  first_observed_at TIMESTAMPTZ DEFAULT NOW(),
  last_observed_at TIMESTAMPTZ DEFAULT NOW(),
  observation_count INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE business_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own business memory"
  ON business_memory FOR SELECT
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own business memory"
  ON business_memory FOR INSERT
  WITH CHECK (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Users can update their own business memory"
  ON business_memory FOR UPDATE
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own business memory"
  ON business_memory FOR DELETE
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

CREATE INDEX idx_business_memory_business_id ON business_memory(business_id);
CREATE INDEX idx_business_memory_category ON business_memory(category);
CREATE INDEX idx_business_memory_active ON business_memory(is_active) WHERE is_active = TRUE;

-- ============================================================
-- MIA SKILLS
-- Tracks skill levels per business (like an employee development record)
-- ============================================================
CREATE TABLE mia_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  skill_key TEXT NOT NULL CHECK (skill_key IN (
    'product_knowledge',
    'sales_conversations',
    'business_rules',
    'objection_handling',
    'upselling',
    'cross_selling',
    'guarantees',
    'returns',
    'payment_methods',
    'delivery_logistics'
  )),
  skill_name TEXT NOT NULL,
  level INTEGER DEFAULT 0 CHECK (level >= 0 AND level <= 100),
  status TEXT DEFAULT 'not_started' CHECK (status IN ('mastered', 'learning', 'needs_practice', 'not_started')),
  evidence_count INTEGER DEFAULT 0,
  last_demonstrated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, skill_key)
);

ALTER TABLE mia_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own MIA skills"
  ON mia_skills FOR SELECT
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own MIA skills"
  ON mia_skills FOR INSERT
  WITH CHECK (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Users can update their own MIA skills"
  ON mia_skills FOR UPDATE
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

CREATE INDEX idx_mia_skills_business_id ON mia_skills(business_id);
CREATE INDEX idx_mia_skills_status ON mia_skills(status);

-- ============================================================
-- WEEKLY REPORTS
-- MIA's self-authored weekly reports (story first, metrics second)
-- ============================================================
CREATE TABLE weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  conversations_attended INTEGER DEFAULT 0,
  new_facts_learned INTEGER DEFAULT 0,
  missing_rules_found INTEGER DEFAULT 0,
  products_reviewed INTEGER DEFAULT 0,
  preparation_before INTEGER DEFAULT 0,
  preparation_after INTEGER DEFAULT 0,
  narrative TEXT,
  recommendations JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own weekly reports"
  ON weekly_reports FOR SELECT
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own weekly reports"
  ON weekly_reports FOR INSERT
  WITH CHECK (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Users can update their own weekly reports"
  ON weekly_reports FOR UPDATE
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

CREATE INDEX idx_weekly_reports_business_id ON weekly_reports(business_id);
CREATE INDEX idx_weekly_reports_week ON weekly_reports(week_start, week_end);

-- ============================================================
-- LEARNING VELOCITY SNAPSHOTS
-- Tracks learning rate over time (daily, weekly, monthly)
-- ============================================================
CREATE TABLE learning_velocity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  new_facts INTEGER DEFAULT 0,
  new_products INTEGER DEFAULT 0,
  new_rules INTEGER DEFAULT 0,
  new_faqs INTEGER DEFAULT 0,
  preparation_delta INTEGER DEFAULT 0,
  confidence_delta INTEGER DEFAULT 0,
  conversations_analyzed INTEGER DEFAULT 0,
  opportunities_found INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE learning_velocity_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own learning velocity"
  ON learning_velocity_snapshots FOR SELECT
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own learning velocity"
  ON learning_velocity_snapshots FOR INSERT
  WITH CHECK (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

CREATE INDEX idx_learning_velocity_business_id ON learning_velocity_snapshots(business_id);
CREATE INDEX idx_learning_velocity_period ON learning_velocity_snapshots(period, period_start);
