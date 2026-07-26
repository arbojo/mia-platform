export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

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
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          onboarding_status?: 'created' | 'identity_completed' | 'business_completed' | 'products_completed' | 'rules_completed' | 'ready'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          onboarding_status?: 'created' | 'identity_completed' | 'business_completed' | 'products_completed' | 'rules_completed' | 'ready'
          created_at?: string
          updated_at?: string
        }
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
      }
      products: {
        Row: {
          id: string
          business_id: string
          name: string
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
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
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
          created_at?: string
          updated_at?: string
        }
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
      }
      customers: {
        Row: {
          id: string
          business_id: string
          name: string | null
          phone: string | null
          email: string | null
          city: string | null
          tags: string[]
          status: 'new' | 'contacted' | 'interested' | 'converted' | 'lost'
          notes: string | null
          last_interaction: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name?: string | null
          phone?: string | null
          email?: string | null
          city?: string | null
          tags?: string[]
          status?: 'new' | 'contacted' | 'interested' | 'converted' | 'lost'
          notes?: string | null
          last_interaction?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string | null
          phone?: string | null
          email?: string | null
          city?: string | null
          tags?: string[]
          status?: 'new' | 'contacted' | 'interested' | 'converted' | 'lost'
          notes?: string | null
          last_interaction?: string | null
          created_at?: string
          updated_at?: string
        }
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
      }
      conversations: {
        Row: {
          id: string
          assistant_id: string
          customer_id: string | null
          type: 'training' | 'live' | 'simulation'
          status: 'active' | 'archived'
          assigned_to: string | null
          handover_reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          assistant_id: string
          customer_id?: string | null
          type: 'training' | 'live' | 'simulation'
          status?: 'active' | 'archived'
          assigned_to?: string | null
          handover_reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          assistant_id?: string
          customer_id?: string | null
          type?: 'training' | 'live' | 'simulation'
          status?: 'active' | 'archived'
          assigned_to?: string | null
          handover_reason?: string | null
          created_at?: string
        }
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
