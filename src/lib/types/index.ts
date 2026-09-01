export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface LastCancelledOrder {
  order_id: string
  product_id: string | null
  product_name: string | null
  cancelled_at: string
  reason: string | null
  event_id: string
}

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string
          owner_id: string
          name: string
          onboarding_status: 'created' | 'identity_completed' | 'business_completed' | 'products_completed' | 'rules_completed' | 'ready'
          created_at: string
          updated_at: string
          edition: string | null
          deployment_model: string | null
          status: string | null
          industry: string | null
          capabilities: string[] | null
          onboarding_answers: Record<string, unknown> | null
          capability_sources: Record<string, string> | null
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          onboarding_status?: 'created' | 'identity_completed' | 'business_completed' | 'products_completed' | 'rules_completed' | 'ready'
          created_at?: string
          updated_at?: string
          edition?: string | null
          deployment_model?: string | null
          status?: string | null
          industry?: string | null
          capabilities?: string[] | null
          onboarding_answers?: Record<string, unknown> | null
          capability_sources?: Record<string, string> | null
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          onboarding_status?: 'created' | 'identity_completed' | 'business_completed' | 'products_completed' | 'rules_completed' | 'ready'
          created_at?: string
          updated_at?: string
          edition?: string | null
          deployment_model?: string | null
          status?: string | null
          industry?: string | null
          capabilities?: string[] | null
          onboarding_answers?: Record<string, unknown> | null
          capability_sources?: Record<string, string> | null
        }
        Relationships: []
      }
      brand_identities: {
        Row: {
          id: string
          business_id: string
          business_name: string
          tagline: string | null
          target_customers: string | null
          differentiators: string | null
          elevator_pitch: string | null
          tone_of_voice: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          business_name: string
          tagline?: string | null
          target_customers?: string | null
          differentiators?: string | null
          elevator_pitch?: string | null
          tone_of_voice?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          business_name?: string
          tagline?: string | null
          target_customers?: string | null
          differentiators?: string | null
          elevator_pitch?: string | null
          tone_of_voice?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          business_id: string
          name: string
          sku: string | null
          price: number | null
          description: string | null
          benefits: string | null
          faq: Json
          restrictions: string | null
          image_url: string | null
          documents: string[]
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          sku?: string | null
          price?: number | null
          description?: string | null
          benefits?: string | null
          faq?: Json
          restrictions?: string | null
          image_url?: string | null
          documents?: string[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          sku?: string | null
          price?: number | null
          description?: string | null
          benefits?: string | null
          faq?: Json
          restrictions?: string | null
          image_url?: string | null
          documents?: string[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_items: {
        Row: {
          id: string
          business_id: string
          category: 'business_info' | 'faq' | 'objection' | 'process' | 'tip'
          question: string
          answer: string
          source: 'onboarding' | 'manual' | 'correction' | 'document' | 'audio'
          confidence: 'high' | 'medium' | 'low'
          image_url: string | null
          trigger_condition: string | null
          media_type: 'image' | 'testimonial'
          product_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          category: 'business_info' | 'faq' | 'objection' | 'process' | 'tip'
          question: string
          answer: string
          source: 'onboarding' | 'manual' | 'correction' | 'document' | 'audio'
          confidence?: 'high' | 'medium' | 'low'
          image_url?: string | null
          trigger_condition?: string | null
          media_type?: 'image' | 'testimonial'
          product_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          category?: 'business_info' | 'faq' | 'objection' | 'process' | 'tip'
          question?: string
          answer?: string
          source?: 'onboarding' | 'manual' | 'correction' | 'document' | 'audio'
          confidence?: 'high' | 'medium' | 'low'
          image_url?: string | null
          trigger_condition?: string | null
          media_type?: 'image' | 'testimonial'
          product_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_media_dispatched: {
        Row: {
          id: string
          business_id: string
          conversation_id: string
          customer_id: string | null
          knowledge_item_id: string
          state: 'claimed' | 'dispatched' | 'failed'
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          conversation_id: string
          customer_id?: string | null
          knowledge_item_id: string
          state?: 'claimed' | 'dispatched' | 'failed'
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          conversation_id?: string
          customer_id?: string | null
          knowledge_item_id?: string
          state?: 'claimed' | 'dispatched' | 'failed'
          created_at?: string
        }
        Relationships: []
      }
      sales_rules: {
        Row: {
          id: string
          business_id: string
          category: 'zones' | 'payment' | 'schedule' | 'promotions' | 'restrictions' | 'escalation'
          content: string
          priority: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          category: 'zones' | 'payment' | 'schedule' | 'promotions' | 'restrictions' | 'escalation'
          content: string
          priority?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          category?: 'zones' | 'payment' | 'schedule' | 'promotions' | 'restrictions' | 'escalation'
          content?: string
          priority?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_instructions: {
        Row: {
          id: string
          business_id: string
          instruction: string
          priority: number
          source: 'manual' | 'onboarding' | 'correction'
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          instruction: string
          priority?: number
          source?: 'manual' | 'onboarding' | 'correction'
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          instruction?: string
          priority?: number
          source?: 'manual' | 'onboarding' | 'correction'
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      assistants: {
        Row: {
          id: string
          business_id: string
          name: string
          personality: Json
          communication_style: 'formal' | 'casual' | 'warm' | 'direct'
          avatar_url: string | null
          is_active: boolean
          status: 'draft' | 'training' | 'ready' | 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name?: string
          personality?: Json
          communication_style: 'formal' | 'casual' | 'warm' | 'direct'
          avatar_url?: string | null
          is_active?: boolean
          status?: 'draft' | 'training' | 'ready' | 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          personality?: Json
          communication_style?: 'formal' | 'casual' | 'warm' | 'direct'
          avatar_url?: string | null
          is_active?: boolean
          status?: 'draft' | 'training' | 'ready' | 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      assistant_channels: {
        Row: {
          id: string
          assistant_id: string
          channel: 'web' | 'whatsapp' | 'messenger' | 'instagram'
          credentials: Json
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          assistant_id: string
          channel: 'web' | 'whatsapp' | 'messenger' | 'instagram'
          credentials?: Json
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          assistant_id?: string
          channel?: 'web' | 'whatsapp' | 'messenger' | 'instagram'
          credentials?: Json
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          business_id: string
          name: string | null
          phone: string | null
          email: string | null
          city: string | null
          address: string | null
          tags: string[]
          status: 'new' | 'contacted' | 'interested' | 'converted' | 'lost'
          notes: string | null
          last_interaction: string | null
          last_follow_up_at: string | null
          created_at: string
          updated_at: string
          last_cancelled_order: LastCancelledOrder | null
        }
        Insert: {
          id?: string
          business_id: string
          name?: string | null
          phone?: string | null
          email?: string | null
          city?: string | null
          address?: string | null
          tags?: string[]
          status?: 'new' | 'contacted' | 'interested' | 'converted' | 'lost'
          notes?: string | null
          last_interaction?: string | null
          last_follow_up_at?: string | null
          created_at?: string
          updated_at?: string
          last_cancelled_order?: LastCancelledOrder | null
        }
        Update: {
          id?: string
          business_id?: string
          name?: string | null
          phone?: string | null
          email?: string | null
          city?: string | null
          address?: string | null
          tags?: string[]
          status?: 'new' | 'contacted' | 'interested' | 'converted' | 'lost'
          notes?: string | null
          last_interaction?: string | null
          last_follow_up_at?: string | null
          created_at?: string
          updated_at?: string
          last_cancelled_order?: LastCancelledOrder | null
        }
        Relationships: []
      }
      assistant_memories: {
        Row: {
          id: string
          assistant_id: string
          customer_id: string
          memory_type: 'preference' | 'previous_question' | 'purchase_history' | 'important_note'
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          assistant_id: string
          customer_id: string
          memory_type: 'preference' | 'previous_question' | 'purchase_history' | 'important_note'
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          assistant_id?: string
          customer_id?: string
          memory_type?: 'preference' | 'previous_question' | 'purchase_history' | 'important_note'
          content?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          assistant_id: string
          customer_id: string | null
          type: 'training' | 'live' | 'simulation'
          status: 'active' | 'waiting' | 'completed' | 'abandoned' | 'archived'
          outcome: 'pending' | 'interested' | 'not_interested' | 'sold' | 'needs_follow_up' | null
          deal_value: number | null
          potential_value: number | null
          outcome_updated_at: string | null
          outcome_history: Json
          assigned_to: string | null
          handover_reason: string | null
          media_sent_products: string[]
          active_product_ids: string[]
          sales_cancelled_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          assistant_id: string
          customer_id?: string | null
          type: 'training' | 'live' | 'simulation'
          status?: 'active' | 'waiting' | 'completed' | 'abandoned' | 'archived'
          outcome?: 'pending' | 'interested' | 'not_interested' | 'sold' | 'needs_follow_up' | null
          deal_value?: number | null
          potential_value?: number | null
          outcome_updated_at?: string | null
          outcome_history?: Json
          assigned_to?: string | null
          handover_reason?: string | null
          media_sent_products?: string[]
          active_product_ids?: string[]
          sales_cancelled_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          assistant_id?: string
          customer_id?: string | null
          type?: 'training' | 'live' | 'simulation'
          status?: 'active' | 'waiting' | 'completed' | 'abandoned' | 'archived'
          outcome?: 'pending' | 'interested' | 'not_interested' | 'sold' | 'needs_follow_up' | null
          deal_value?: number | null
          potential_value?: number | null
          outcome_updated_at?: string | null
          outcome_history?: Json
          assigned_to?: string | null
          handover_reason?: string | null
          media_sent_products?: string[]
          active_product_ids?: string[]
          sales_cancelled_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant' | 'correction' | 'system' | 'simulated_customer'
          content: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant' | 'correction' | 'system' | 'simulated_customer'
          content: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: 'user' | 'assistant' | 'correction' | 'system' | 'simulated_customer'
          content?: string
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
      learning_events: {
        Row: {
          id: string
          message_id: string | null
          assistant_id: string
          original_response: string
          corrected_response: string | null
          knowledge_item_id: string | null
          knowledge_change: Json
          status: 'pending' | 'approved' | 'rejected' | 'modified'
          authorized_by: string | null
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          message_id?: string | null
          assistant_id: string
          original_response: string
          corrected_response?: string | null
          knowledge_item_id?: string | null
          knowledge_change?: Json
          status?: 'pending' | 'approved' | 'rejected' | 'modified'
          authorized_by?: string | null
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          message_id?: string | null
          assistant_id?: string
          original_response?: string
          corrected_response?: string | null
          knowledge_item_id?: string | null
          knowledge_change?: Json
          status?: 'pending' | 'approved' | 'rejected' | 'modified'
          authorized_by?: string | null
          created_at?: string
          resolved_at?: string | null
        }
        Relationships: []
      }
      knowledge_versions: {
        Row: {
          id: string
          business_id: string
          entity_type: 'knowledge_item' | 'sales_rule' | 'ai_instruction' | 'product'
          entity_id: string
          previous_value: Json | null
          new_value: Json
          changed_by: string | null
          change_source: 'onboarding' | 'correction' | 'manual' | 'system'
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          entity_type: 'knowledge_item' | 'sales_rule' | 'ai_instruction' | 'product'
          entity_id: string
          previous_value?: Json | null
          new_value: Json
          changed_by?: string | null
          change_source: 'onboarding' | 'correction' | 'manual' | 'system'
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          entity_type?: 'knowledge_item' | 'sales_rule' | 'ai_instruction' | 'product'
          entity_id?: string
          previous_value?: Json | null
          new_value?: Json
          changed_by?: string | null
          change_source?: 'onboarding' | 'correction' | 'manual' | 'system'
          created_at?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          id: string
          business_id: string
          assistant_id: string
          model: string
          tokens_input: number
          tokens_output: number
          cost: number
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          assistant_id: string
          model: string
          tokens_input: number
          tokens_output: number
          cost: number
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          assistant_id?: string
          model?: string
          tokens_input?: number
          tokens_output?: number
          cost?: number
          created_at?: string
        }
        Relationships: []
      }
      knowledge_analysis_reports: {
        Row: {
          id: string
          business_id: string
          status: 'pending' | 'analyzing' | 'completed' | 'failed'
          overall_score: number | null
          completeness_score: number | null
          consistency_score: number | null
          readiness_score: number | null
          gaps: Json
          conflicts: Json
          readiness_issues: Json
          analysis_model: string | null
          tokens_used: number
          cost: number
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          business_id: string
          status?: 'pending' | 'analyzing' | 'completed' | 'failed'
          overall_score?: number | null
          completeness_score?: number | null
          consistency_score?: number | null
          readiness_score?: number | null
          gaps?: Json
          conflicts?: Json
          readiness_issues?: Json
          analysis_model?: string | null
          tokens_used?: number
          cost?: number
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          business_id?: string
          status?: 'pending' | 'analyzing' | 'completed' | 'failed'
          overall_score?: number | null
          completeness_score?: number | null
          consistency_score?: number | null
          readiness_score?: number | null
          gaps?: Json
          conflicts?: Json
          readiness_issues?: Json
          analysis_model?: string | null
          tokens_used?: number
          cost?: number
          created_at?: string
          completed_at?: string | null
        }
        Relationships: []
      }
      knowledge_suggestions: {
        Row: {
          id: string
          report_id: string | null
          business_id: string
          type: 'missing_knowledge' | 'missing_product' | 'missing_rule' | 'contradiction' | 'improvement'
          severity: 'low' | 'medium' | 'high' | 'critical'
          title: string
          description: string
          suggested_category: string | null
          suggested_question: string | null
          suggested_answer: string | null
          suggested_rule_content: string | null
          status: 'pending' | 'approved' | 'rejected'
          knowledge_item_id: string | null
          created_at: string
          resolved_at: string | null
          suggestion_type: 'coaching' | 'success_pattern' | 'safety' | null
          lifecycle_state: 'draft' | 'active' | 'accepted' | 'practiced' | 'applied' | 'verified' | 'completed' | 'archived' | null
          observation: string | null
          suggested_improvement: string | null
          recommended_practice: string | null
          behavior_key: string | null
          applied_at: string | null
          rejection_reason: string | null
        }
        Insert: {
          id?: string
          report_id?: string | null
          business_id: string
          type: 'missing_knowledge' | 'missing_product' | 'missing_rule' | 'contradiction' | 'improvement'
          severity?: 'low' | 'medium' | 'high' | 'critical'
          title: string
          description: string
          suggested_category?: string | null
          suggested_question?: string | null
          suggested_answer?: string | null
          suggested_rule_content?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          knowledge_item_id?: string | null
          created_at?: string
          resolved_at?: string | null
          suggestion_type?: 'coaching' | 'success_pattern' | null
          lifecycle_state?: 'draft' | 'active' | 'accepted' | 'practiced' | 'applied' | 'verified' | 'completed' | 'archived' | null
          observation?: string | null
          suggested_improvement?: string | null
          recommended_practice?: string | null
          behavior_key?: string | null
          applied_at?: string | null
          rejection_reason?: string | null
        }
        Update: {
          id?: string
          report_id?: string | null
          business_id?: string
          type?: 'missing_knowledge' | 'missing_product' | 'missing_rule' | 'contradiction' | 'improvement'
          severity?: 'low' | 'medium' | 'high' | 'critical'
          title?: string
          description?: string
          suggested_category?: string | null
          suggested_question?: string | null
          suggested_answer?: string | null
          suggested_rule_content?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          knowledge_item_id?: string | null
          created_at?: string
          resolved_at?: string | null
          suggestion_type?: 'coaching' | 'success_pattern' | null
          lifecycle_state?: 'draft' | 'active' | 'accepted' | 'practiced' | 'applied' | 'verified' | 'completed' | 'archived' | null
          observation?: string | null
          suggested_improvement?: string | null
          recommended_practice?: string | null
          behavior_key?: string | null
          applied_at?: string | null
          rejection_reason?: string | null
        }
        Relationships: []
      }
      channel_connections: {
        Row: {
          id: string
          business_id: string
          assistant_id: string
          channel: 'web' | 'whatsapp' | 'messenger' | 'instagram'
          status: 'disconnected' | 'connecting' | 'connected' | 'error'
          mode: 'active' | 'shadow' | 'paused'
          credentials: Json
          configuration: Json
          last_sync: string | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          assistant_id: string
          channel: 'web' | 'whatsapp' | 'messenger' | 'instagram'
          status?: 'disconnected' | 'connecting' | 'connected' | 'error'
          mode?: 'active' | 'shadow' | 'paused'
          credentials?: Json
          configuration?: Json
          last_sync?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          assistant_id?: string
          channel?: 'web' | 'whatsapp' | 'messenger' | 'instagram'
          status?: 'disconnected' | 'connecting' | 'connected' | 'error'
          mode?: 'active' | 'shadow' | 'paused'
          credentials?: Json
          configuration?: Json
          last_sync?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_events: {
        Row: {
          id: string
          business_id: string
          assistant_id: string | null
          conversation_id: string | null
          customer_id: string | null
          event_type:
            | 'SALE_STARTED'
            | 'PRODUCT_SELECTED'
            | 'OBJECTION_DETECTED'
            | 'OBJECTION_RESOLVED'
            | 'UPSELL_ACCEPTED'
            | 'CROSSSELL_ACCEPTED'
            | 'FOLLOWUP_REQUIRED'
            | 'SALE_WON'
            | 'SALE_LOST'
            | 'CUSTOMER_HESITATION'
            | 'PRICE_ACCEPTED'
            | 'PRICE_REJECTED'
            | 'SALE_CONFIRMED'
            | 'SALE_CANCELLED'
          product_id: string | null
          amount: number | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          assistant_id?: string | null
          conversation_id?: string | null
          customer_id?: string | null
          event_type:
            | 'SALE_STARTED'
            | 'PRODUCT_SELECTED'
            | 'OBJECTION_DETECTED'
            | 'OBJECTION_RESOLVED'
            | 'UPSELL_ACCEPTED'
            | 'CROSSSELL_ACCEPTED'
            | 'FOLLOWUP_REQUIRED'
            | 'SALE_WON'
            | 'SALE_LOST'
            | 'CUSTOMER_HESITATION'
            | 'PRICE_ACCEPTED'
            | 'PRICE_REJECTED'
            | 'SALE_CONFIRMED'
            | 'SALE_CANCELLED'
          product_id?: string | null
          amount?: number | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          assistant_id?: string | null
          conversation_id?: string | null
          customer_id?: string | null
          event_type?:
            | 'SALE_STARTED'
            | 'PRODUCT_SELECTED'
            | 'OBJECTION_DETECTED'
            | 'OBJECTION_RESOLVED'
            | 'UPSELL_ACCEPTED'
            | 'CROSSSELL_ACCEPTED'
            | 'FOLLOWUP_REQUIRED'
            | 'SALE_WON'
            | 'SALE_LOST'
            | 'CUSTOMER_HESITATION'
            | 'PRICE_ACCEPTED'
            | 'PRICE_REJECTED'
            | 'SALE_CONFIRMED'
            | 'SALE_CANCELLED'
          product_id?: string | null
          amount?: number | null
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
      business_sales_config: {
        Row: {
          business_id: string
          confirmation_message: string
          cancellation_message: string
          ask_address: boolean
          ask_phone: boolean
          allow_cancellation: boolean
          cancellation_window_hours: number
          follow_up_hours: number
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          business_id: string
          confirmation_message?: string
          cancellation_message?: string
          ask_address?: boolean
          ask_phone?: boolean
          allow_cancellation?: boolean
          cancellation_window_hours?: number
          follow_up_hours?: number
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          confirmation_message?: string
          cancellation_message?: string
          ask_address?: boolean
          ask_phone?: boolean
          allow_cancellation?: boolean
          cancellation_window_hours?: number
          follow_up_hours?: number
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'business_sales_config_business_id_fkey'
            columns: ['business_id']
            isOneToOne: true
            referencedRelation: 'businesses'
            referencedColumns: ['id']
          }
        ]
      }
      sales_order_counters: {
        Row: {
          business_id: string
          last_number: number
        }
        Insert: {
          business_id: string
          last_number?: number
        }
        Update: {
          business_id?: string
          last_number?: number
        }
        Relationships: [
          {
            foreignKeyName: 'sales_order_counters_business_id_fkey'
            columns: ['business_id']
            isOneToOne: true
            referencedRelation: 'businesses'
            referencedColumns: ['id']
          }
        ]
      }
      channel_messages: {
        Row: {
          id: string
          business_id: string
          customer_id: string | null
          channel: string
          direction: 'incoming' | 'outgoing'
          content: string
          content_type: 'text' | 'image' | 'audio' | 'document'
          external_id: string | null
          external_customer_id: string | null
          metadata: Json
          status: 'received' | 'processing' | 'sent' | 'delivered' | 'read' | 'failed'
          error_message: string | null
          received_at: string
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          customer_id?: string | null
          channel: string
          direction: 'incoming' | 'outgoing'
          content: string
          content_type?: 'text' | 'image' | 'audio' | 'document'
          external_id?: string | null
          external_customer_id?: string | null
          metadata?: Json
          status?: 'received' | 'processing' | 'sent' | 'delivered' | 'read' | 'failed'
          error_message?: string | null
          received_at?: string
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          customer_id?: string | null
          channel?: string
          direction?: 'incoming' | 'outgoing'
          content?: string
          content_type?: 'text' | 'image' | 'audio' | 'document'
          external_id?: string | null
          external_customer_id?: string | null
          metadata?: Json
          status?: 'received' | 'processing' | 'sent' | 'delivered' | 'read' | 'failed'
          error_message?: string | null
          received_at?: string
          sent_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_user_business_ids: {
        Args: Record<string, never>
        Returns: string[]
      }
    }
    Enums: Record<string, never>
  }
}
