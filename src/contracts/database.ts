export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          agent_name: string
          created_at: string
          id: string
          incident_id: string
          institution_id: string
          latency_ms: number
          model: string
          prompt_version: string
          provider: string
          safe_error: string | null
          status: string
          validated_outcome: Json | null
        }
        Insert: {
          agent_name: string
          created_at?: string
          id: string
          incident_id: string
          institution_id: string
          latency_ms: number
          model: string
          prompt_version: string
          provider: string
          safe_error?: string | null
          status: string
          validated_outcome?: Json | null
        }
        Update: {
          agent_name?: string
          created_at?: string
          id?: string
          incident_id?: string
          institution_id?: string
          latency_ms?: number
          model?: string
          prompt_version?: string
          provider?: string
          safe_error?: string | null
          status?: string
          validated_outcome?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_incident_id_institution_id_fkey"
            columns: ["incident_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "agent_runs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          action_payload: Json | null
          action_payload_hash: string
          approver_membership_id: string | null
          created_at: string
          decided_at: string | null
          decision: string | null
          id: string
          incident_id: string
          institution_id: string
          plan_version: number
          reason: string | null
          task_id: string | null
        }
        Insert: {
          action_payload?: Json | null
          action_payload_hash: string
          approver_membership_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          id?: string
          incident_id: string
          institution_id: string
          plan_version: number
          reason?: string | null
          task_id?: string | null
        }
        Update: {
          action_payload?: Json | null
          action_payload_hash?: string
          approver_membership_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          id?: string
          incident_id?: string
          institution_id?: string
          plan_version?: number
          reason?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_approver_membership_id_institution_id_fkey"
            columns: ["approver_membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "approvals_incident_id_institution_id_fkey"
            columns: ["incident_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "approvals_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          acknowledgement_deadline: string
          active_version: boolean
          assignee_membership_id: string
          created_at: string
          id: string
          institution_id: string
          state: Database["public"]["Enums"]["assignment_status"]
          task_id: string
          updated_at: string
          version: number
        }
        Insert: {
          acknowledgement_deadline: string
          active_version?: boolean
          assignee_membership_id: string
          created_at?: string
          id?: string
          institution_id: string
          state?: Database["public"]["Enums"]["assignment_status"]
          task_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          acknowledgement_deadline?: string
          active_version?: boolean
          assignee_membership_id?: string
          created_at?: string
          id?: string
          institution_id?: string
          state?: Database["public"]["Enums"]["assignment_status"]
          task_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assignments_assignee_membership_id_institution_id_fkey"
            columns: ["assignee_membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "assignments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_task_id_institution_id_fkey"
            columns: ["task_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "incident_tasks"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_membership_id: string | null
          created_at: string
          id: string
          institution_id: string
          safe_payload: Json
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_membership_id?: string | null
          created_at?: string
          id?: string
          institution_id: string
          safe_payload?: Json
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_membership_id?: string | null
          created_at?: string
          id?: string
          institution_id?: string
          safe_payload?: Json
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_membership_id_institution_id_fkey"
            columns: ["actor_membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "audit_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      campus_locations: {
        Row: {
          asset_counts: Json
          created_at: string
          id: string
          institution_id: string
          kind: string
          label: string
          parent_id: string | null
        }
        Insert: {
          asset_counts?: Json
          created_at?: string
          id?: string
          institution_id: string
          kind: string
          label: string
          parent_id?: string | null
        }
        Update: {
          asset_counts?: Json
          created_at?: string
          id?: string
          institution_id?: string
          kind?: string
          label?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campus_locations_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campus_locations_parent_id_institution_id_fkey"
            columns: ["parent_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "campus_locations"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      category_routes: {
        Row: {
          category: string
          emergency_contact_membership_id: string | null
          id: string
          institution_id: string
          responsible_department_id: string | null
          safety_floor: Database["public"]["Enums"]["incident_severity"]
          verifier_role: Database["public"]["Enums"]["role_name"]
        }
        Insert: {
          category: string
          emergency_contact_membership_id?: string | null
          id?: string
          institution_id: string
          responsible_department_id?: string | null
          safety_floor?: Database["public"]["Enums"]["incident_severity"]
          verifier_role: Database["public"]["Enums"]["role_name"]
        }
        Update: {
          category?: string
          emergency_contact_membership_id?: string | null
          id?: string
          institution_id?: string
          responsible_department_id?: string | null
          safety_floor?: Database["public"]["Enums"]["incident_severity"]
          verifier_role?: Database["public"]["Enums"]["role_name"]
        }
        Relationships: [
          {
            foreignKeyName: "category_routes_emergency_contact_membership_id_institutio_fkey"
            columns: ["emergency_contact_membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "category_routes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_routes_responsible_department_id_institution_id_fkey"
            columns: ["responsible_department_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      club_terms: {
        Row: {
          club_id: string
          coordinator_membership_id: string | null
          ends_at: string
          id: string
          institution_id: string
          president_membership_id: string | null
          starts_at: string
        }
        Insert: {
          club_id: string
          coordinator_membership_id?: string | null
          ends_at: string
          id?: string
          institution_id: string
          president_membership_id?: string | null
          starts_at: string
        }
        Update: {
          club_id?: string
          coordinator_membership_id?: string | null
          ends_at?: string
          id?: string
          institution_id?: string
          president_membership_id?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_terms_club_id_institution_id_fkey"
            columns: ["club_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "club_terms_coordinator_membership_id_institution_id_fkey"
            columns: ["coordinator_membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "club_terms_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_terms_president_membership_id_institution_id_fkey"
            columns: ["president_membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      clubs: {
        Row: {
          id: string
          institution_id: string
          name: string
        }
        Insert: {
          id?: string
          institution_id: string
          name: string
        }
        Update: {
          id?: string
          institution_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          id: string
          institution_id: string
          kind: string
          name: string
        }
        Insert: {
          id?: string
          institution_id: string
          kind: string
          name: string
        }
        Update: {
          id?: string
          institution_id?: string
          kind?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_action_tokens: {
        Row: {
          assignment_id: string
          assignment_version: number
          consumed_at: string | null
          expires_at: string
          id: string
          institution_id: string
          intended_membership_id: string
          nonce_hash: string
        }
        Insert: {
          assignment_id: string
          assignment_version: number
          consumed_at?: string | null
          expires_at: string
          id?: string
          institution_id: string
          intended_membership_id: string
          nonce_hash: string
        }
        Update: {
          assignment_id?: string
          assignment_version?: number
          consumed_at?: string | null
          expires_at?: string
          id?: string
          institution_id?: string
          intended_membership_id?: string
          nonce_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_action_tokens_assignment_id_institution_id_fkey"
            columns: ["assignment_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "email_action_tokens_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_action_tokens_intended_membership_id_institution_id_fkey"
            columns: ["intended_membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      email_events: {
        Row: {
          happened_at: string
          institution_id: string
          outbox_id: string
          processed_at: string
          provider_event_id: string
          type: string
        }
        Insert: {
          happened_at: string
          institution_id: string
          outbox_id: string
          processed_at?: string
          provider_event_id: string
          type: string
        }
        Update: {
          happened_at?: string
          institution_id?: string
          outbox_id?: string
          processed_at?: string
          provider_event_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_outbox_id_institution_id_fkey"
            columns: ["outbox_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "email_outbox"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          action_token_ciphertext: string | null
          assignment_id: string | null
          assignment_version: number | null
          created_at: string
          id: string
          idempotency_key: string
          institution_id: string
          last_event_at: string | null
          message_type: string
          provider_id: string | null
          recipient: string
          transport_state: Database["public"]["Enums"]["email_status"]
          updated_at: string
        }
        Insert: {
          action_token_ciphertext?: string | null
          assignment_id?: string | null
          assignment_version?: number | null
          created_at?: string
          id?: string
          idempotency_key: string
          institution_id: string
          last_event_at?: string | null
          message_type: string
          provider_id?: string | null
          recipient: string
          transport_state?: Database["public"]["Enums"]["email_status"]
          updated_at?: string
        }
        Update: {
          action_token_ciphertext?: string | null
          assignment_id?: string | null
          assignment_version?: number | null
          created_at?: string
          id?: string
          idempotency_key?: string
          institution_id?: string
          last_event_at?: string | null
          message_type?: string
          provider_id?: string | null
          recipient?: string
          transport_state?: Database["public"]["Enums"]["email_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_assignment_id_institution_id_fkey"
            columns: ["assignment_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "email_outbox_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          id: string
          incident_id: string
          institution_id: string
          mime_type: string
          storage_key: string
          uploader_membership_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          id?: string
          incident_id: string
          institution_id: string
          mime_type: string
          storage_key: string
          uploader_membership_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          incident_id?: string
          institution_id?: string
          mime_type?: string
          storage_key?: string
          uploader_membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_attachments_incident_id_institution_id_fkey"
            columns: ["incident_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "incident_attachments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_attachments_uploader_membership_id_institution_id_fkey"
            columns: ["uploader_membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      incident_case_access: {
        Row: {
          created_at: string
          granted_by: string
          incident_id: string
          institution_id: string
          membership_id: string
        }
        Insert: {
          created_at?: string
          granted_by: string
          incident_id: string
          institution_id: string
          membership_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string
          incident_id?: string
          institution_id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_case_access_granted_by_institution_id_fkey"
            columns: ["granted_by", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "incident_case_access_incident_id_institution_id_fkey"
            columns: ["incident_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "incident_case_access_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_case_access_membership_id_institution_id_fkey"
            columns: ["membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      incident_events: {
        Row: {
          action: string
          actor_membership_id: string | null
          actor_type: string
          created_at: string
          id: string
          incident_id: string
          institution_id: string
          safe_payload: Json
        }
        Insert: {
          action: string
          actor_membership_id?: string | null
          actor_type: string
          created_at?: string
          id?: string
          incident_id: string
          institution_id: string
          safe_payload?: Json
        }
        Update: {
          action?: string
          actor_membership_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          incident_id?: string
          institution_id?: string
          safe_payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "incident_events_actor_membership_id_institution_id_fkey"
            columns: ["actor_membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "incident_events_incident_id_institution_id_fkey"
            columns: ["incident_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "incident_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          incident_id: string
          institution_id: string
          rating: number
          reporter_membership_id: string
          resolution_version: number
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          incident_id: string
          institution_id: string
          rating: number
          reporter_membership_id: string
          resolution_version: number
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          incident_id?: string
          institution_id?: string
          rating?: number
          reporter_membership_id?: string
          resolution_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_feedback_incident_id_institution_id_fkey"
            columns: ["incident_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "incident_feedback_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_feedback_reporter_membership_id_institution_id_fkey"
            columns: ["reporter_membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      incident_plans: {
        Row: {
          acknowledgement_minutes: number
          agent_run_id: string | null
          created_at: string
          explanation: string
          id: string
          incident_id: string
          institution_id: string
          priority: Database["public"]["Enums"]["incident_severity"]
          status: string
          version: number
        }
        Insert: {
          acknowledgement_minutes: number
          agent_run_id?: string | null
          created_at?: string
          explanation: string
          id?: string
          incident_id: string
          institution_id: string
          priority: Database["public"]["Enums"]["incident_severity"]
          status?: string
          version: number
        }
        Update: {
          acknowledgement_minutes?: number
          agent_run_id?: string | null
          created_at?: string
          explanation?: string
          id?: string
          incident_id?: string
          institution_id?: string
          priority?: Database["public"]["Enums"]["incident_severity"]
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "incident_plans_agent_run_id_institution_id_fkey"
            columns: ["agent_run_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "incident_plans_incident_id_institution_id_fkey"
            columns: ["incident_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "incident_plans_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_tasks: {
        Row: {
          carried_from_task_id: string | null
          checklist: Json
          created_at: string
          designated_verifier_membership_id: string | null
          evidence_requirements: Json
          evidence_version: number
          goal: string
          id: string
          institution_id: string
          local_id: string
          logical_task_key: string
          plan_id: string
          requires_approval: boolean
          specialist_profile: string
          state: Database["public"]["Enums"]["task_status"]
          updated_at: string
          verifier_due_at: string | null
        }
        Insert: {
          carried_from_task_id?: string | null
          checklist?: Json
          created_at?: string
          designated_verifier_membership_id?: string | null
          evidence_requirements: Json
          evidence_version?: number
          goal: string
          id?: string
          institution_id: string
          local_id: string
          logical_task_key: string
          plan_id: string
          requires_approval?: boolean
          specialist_profile: string
          state?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
          verifier_due_at?: string | null
        }
        Update: {
          carried_from_task_id?: string | null
          checklist?: Json
          created_at?: string
          designated_verifier_membership_id?: string | null
          evidence_requirements?: Json
          evidence_version?: number
          goal?: string
          id?: string
          institution_id?: string
          local_id?: string
          logical_task_key?: string
          plan_id?: string
          requires_approval?: boolean
          specialist_profile?: string
          state?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
          verifier_due_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_tasks_carried_from_task_id_institution_id_fkey"
            columns: ["carried_from_task_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "incident_tasks"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "incident_tasks_designated_verifier_membership_id_instituti_fkey"
            columns: ["designated_verifier_membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "incident_tasks_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_tasks_plan_id_institution_id_fkey"
            columns: ["plan_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "incident_plans"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      incident_votes: {
        Row: {
          created_at: string
          incident_id: string
          institution_id: string
          membership_id: string
        }
        Insert: {
          created_at?: string
          incident_id: string
          institution_id: string
          membership_id: string
        }
        Update: {
          created_at?: string
          incident_id?: string
          institution_id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_votes_incident_id_institution_id_fkey"
            columns: ["incident_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "incident_votes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_votes_membership_id_institution_id_fkey"
            columns: ["membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      incidents: {
        Row: {
          accused_membership_id: string | null
          cancelled_at: string | null
          category: string
          clarification_request: Json | null
          created_at: string
          description: string
          id: string
          institution_id: string
          location_id: string | null
          location_text: string | null
          parent_duplicate_id: string | null
          plan_version: number
          reopened_at: string | null
          reporter_membership_id: string
          reporting_scope: Json
          resolution_version: number
          resolved_at: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          state: Database["public"]["Enums"]["incident_status"]
          triage_summary: string | null
          updated_at: string
          version: number
          visibility: Database["public"]["Enums"]["incident_visibility"]
        }
        Insert: {
          accused_membership_id?: string | null
          cancelled_at?: string | null
          category: string
          clarification_request?: Json | null
          created_at?: string
          description: string
          id?: string
          institution_id: string
          location_id?: string | null
          location_text?: string | null
          parent_duplicate_id?: string | null
          plan_version?: number
          reopened_at?: string | null
          reporter_membership_id: string
          reporting_scope?: Json
          resolution_version?: number
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          state?: Database["public"]["Enums"]["incident_status"]
          triage_summary?: string | null
          updated_at?: string
          version?: number
          visibility?: Database["public"]["Enums"]["incident_visibility"]
        }
        Update: {
          accused_membership_id?: string | null
          cancelled_at?: string | null
          category?: string
          clarification_request?: Json | null
          created_at?: string
          description?: string
          id?: string
          institution_id?: string
          location_id?: string | null
          location_text?: string | null
          parent_duplicate_id?: string | null
          plan_version?: number
          reopened_at?: string | null
          reporter_membership_id?: string
          reporting_scope?: Json
          resolution_version?: number
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          state?: Database["public"]["Enums"]["incident_status"]
          triage_summary?: string | null
          updated_at?: string
          version?: number
          visibility?: Database["public"]["Enums"]["incident_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "incidents_accused_membership_id_institution_id_fkey"
            columns: ["accused_membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "incidents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_location_id_institution_id_fkey"
            columns: ["location_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "campus_locations"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "incidents_parent_duplicate_id_institution_id_fkey"
            columns: ["parent_duplicate_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "incidents_reporter_membership_id_institution_id_fkey"
            columns: ["reporter_membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      institution_memberships: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "institution_memberships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          approval_state: string
          approved_by: string | null
          code: string
          created_at: string
          id: string
          is_demo: boolean
          name: string
        }
        Insert: {
          approval_state?: string
          approved_by?: string | null
          code: string
          created_at?: string
          id?: string
          is_demo?: boolean
          name: string
        }
        Update: {
          approval_state?: string
          approved_by?: string | null
          code?: string
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          attempt: number
          created_at: string
          dedupe_key: string
          due_at: string
          id: string
          incident_id: string | null
          institution_id: string
          last_error: string | null
          lease_until: string | null
          payload: Json
          status: Database["public"]["Enums"]["job_status"]
          type: string
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          attempt?: number
          created_at?: string
          dedupe_key: string
          due_at?: string
          id?: string
          incident_id?: string | null
          institution_id: string
          last_error?: string | null
          lease_until?: string | null
          payload?: Json
          status?: Database["public"]["Enums"]["job_status"]
          type: string
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          attempt?: number
          created_at?: string
          dedupe_key?: string
          due_at?: string
          id?: string
          incident_id?: string | null
          institution_id?: string
          last_error?: string | null
          lease_until?: string | null
          payload?: Json
          status?: Database["public"]["Enums"]["job_status"]
          type?: string
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_incident_id_institution_id_fkey"
            columns: ["incident_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "jobs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          link: string | null
          read_at: string | null
          recipient_membership_id: string
          safe_text: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          link?: string | null
          read_at?: string | null
          recipient_membership_id: string
          safe_text: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          link?: string | null
          read_at?: string | null
          recipient_membership_id?: string
          safe_text?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "notifications_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_membership_id_institution_id_fkey"
            columns: ["recipient_membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      rate_limit_counters: {
        Row: {
          action_key: string
          count: number
          institution_id: string
          membership_id: string
          window_started_at: string
        }
        Insert: {
          action_key: string
          count?: number
          institution_id: string
          membership_id: string
          window_started_at: string
        }
        Update: {
          action_key?: string
          count?: number
          institution_id?: string
          membership_id?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_counters_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_limit_counters_membership_id_institution_id_fkey"
            columns: ["membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      resolution_evidence: {
        Row: {
          created_at: string
          evidence_version: number
          id: string
          institution_id: string
          kind: string
          storage_key: string | null
          structured_result: Json | null
          task_id: string
          uploader_membership_id: string
        }
        Insert: {
          created_at?: string
          evidence_version: number
          id?: string
          institution_id: string
          kind: string
          storage_key?: string | null
          structured_result?: Json | null
          task_id: string
          uploader_membership_id: string
        }
        Update: {
          created_at?: string
          evidence_version?: number
          id?: string
          institution_id?: string
          kind?: string
          storage_key?: string | null
          structured_result?: Json | null
          task_id?: string
          uploader_membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resolution_evidence_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resolution_evidence_task_id_institution_id_fkey"
            columns: ["task_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "incident_tasks"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "resolution_evidence_uploader_membership_id_institution_id_fkey"
            columns: ["uploader_membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      role_grants: {
        Row: {
          club_id: string | null
          cr_seat: number | null
          created_at: string
          department_id: string | null
          ends_at: string | null
          granted_by: string
          id: string
          institution_id: string
          membership_id: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          role: Database["public"]["Enums"]["role_name"]
          section_id: string | null
          starts_at: string
        }
        Insert: {
          club_id?: string | null
          cr_seat?: number | null
          created_at?: string
          department_id?: string | null
          ends_at?: string | null
          granted_by: string
          id?: string
          institution_id: string
          membership_id: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role: Database["public"]["Enums"]["role_name"]
          section_id?: string | null
          starts_at?: string
        }
        Update: {
          club_id?: string | null
          cr_seat?: number | null
          created_at?: string
          department_id?: string | null
          ends_at?: string | null
          granted_by?: string
          id?: string
          institution_id?: string
          membership_id?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role?: Database["public"]["Enums"]["role_name"]
          section_id?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_grants_club_id_institution_id_fkey"
            columns: ["club_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "role_grants_department_id_institution_id_fkey"
            columns: ["department_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "role_grants_granted_by_institution_id_fkey"
            columns: ["granted_by", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "role_grants_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_grants_membership_id_institution_id_fkey"
            columns: ["membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "role_grants_revoked_by_institution_id_fkey"
            columns: ["revoked_by", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "role_grants_section_id_institution_id_fkey"
            columns: ["section_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      sections: {
        Row: {
          academic_term: string
          department_id: string
          id: string
          institution_id: string
          name: string
        }
        Insert: {
          academic_term: string
          department_id: string
          id?: string
          institution_id: string
          name: string
        }
        Update: {
          academic_term?: string
          department_id?: string
          id?: string
          institution_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_department_id_institution_id_fkey"
            columns: ["department_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "sections_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_capabilities: {
        Row: {
          availability: Database["public"]["Enums"]["availability_status"]
          id: string
          institution_id: string
          membership_id: string
          skills: string[]
          updated_at: string
          updated_by: string
          version: number
          workload_limit: number
          zones: string[]
        }
        Insert: {
          availability?: Database["public"]["Enums"]["availability_status"]
          id?: string
          institution_id: string
          membership_id: string
          skills?: string[]
          updated_at?: string
          updated_by: string
          version?: number
          workload_limit?: number
          zones?: string[]
        }
        Update: {
          availability?: Database["public"]["Enums"]["availability_status"]
          id?: string
          institution_id?: string
          membership_id?: string
          skills?: string[]
          updated_at?: string
          updated_by?: string
          version?: number
          workload_limit?: number
          zones?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "staff_capabilities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_capabilities_membership_id_institution_id_fkey"
            columns: ["membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "staff_capabilities_updated_by_institution_id_fkey"
            columns: ["updated_by", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      student_roster: {
        Row: {
          academic_year: number | null
          claimed_user_id: string | null
          department_id: string
          id: string
          institution_id: string
          residence_kind: string | null
          roll_number: string
          roster_email: string
          section_id: string | null
        }
        Insert: {
          academic_year?: number | null
          claimed_user_id?: string | null
          department_id: string
          id?: string
          institution_id: string
          residence_kind?: string | null
          roll_number: string
          roster_email: string
          section_id?: string | null
        }
        Update: {
          academic_year?: number | null
          claimed_user_id?: string | null
          department_id?: string
          id?: string
          institution_id?: string
          residence_kind?: string | null
          roll_number?: string
          roster_email?: string
          section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_roster_department_id_institution_id_fkey"
            columns: ["department_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "student_roster_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_roster_section_id_institution_id_fkey"
            columns: ["section_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          institution_id: string
          prerequisite_task_id: string
          task_id: string
        }
        Insert: {
          institution_id: string
          prerequisite_task_id: string
          task_id: string
        }
        Update: {
          institution_id?: string
          prerequisite_task_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_prerequisite_task_id_institution_id_fkey"
            columns: ["prerequisite_task_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "incident_tasks"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_institution_id_fkey"
            columns: ["task_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "incident_tasks"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      transport_enrollments: {
        Row: {
          active: boolean
          bus_code: string | null
          id: string
          institution_id: string
          membership_id: string
          route_code: string
          verified_by: string | null
        }
        Insert: {
          active?: boolean
          bus_code?: string | null
          id?: string
          institution_id: string
          membership_id: string
          route_code: string
          verified_by?: string | null
        }
        Update: {
          active?: boolean
          bus_code?: string | null
          id?: string
          institution_id?: string
          membership_id?: string
          route_code?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_enrollments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_enrollments_membership_id_institution_id_fkey"
            columns: ["membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "transport_enrollments_verified_by_institution_id_fkey"
            columns: ["verified_by", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
      verification_records: {
        Row: {
          agent_verdict: string
          created_at: string
          evidence_version: number
          human_result: string | null
          id: string
          institution_id: string
          reasons: Json
          task_id: string
          verifier_membership_id: string | null
        }
        Insert: {
          agent_verdict: string
          created_at?: string
          evidence_version: number
          human_result?: string | null
          id?: string
          institution_id: string
          reasons: Json
          task_id: string
          verifier_membership_id?: string | null
        }
        Update: {
          agent_verdict?: string
          created_at?: string
          evidence_version?: number
          human_result?: string | null
          id?: string
          institution_id?: string
          reasons?: Json
          task_id?: string
          verifier_membership_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_records_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_records_task_id_institution_id_fkey"
            columns: ["task_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "incident_tasks"
            referencedColumns: ["id", "institution_id"]
          },
          {
            foreignKeyName: "verification_records_verifier_membership_id_institution_id_fkey"
            columns: ["verifier_membership_id", "institution_id"]
            isOneToOne: false
            referencedRelation: "institution_memberships"
            referencedColumns: ["id", "institution_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acknowledge_email_assignment: {
        Args: {
          expected_assignment_version: number
          token_id: string
          token_nonce_hash: string
        }
        Returns: string
      }
      claim_jobs: {
        Args: { batch_size: number; lease_seconds: number; worker_id: string }
        Returns: {
          attempt: number
          due_at: string
          id: string
          incident_id: string
          institution_id: string
          lease_until: string
          payload: Json
          type: string
        }[]
      }
      get_specialist_context: { Args: { job_id: string }; Returns: Json }
      orion_assignment_action: {
        Args: {
          actor_id: string
          expected_version: number
          reason?: string
          requested_action: string
          target_id: string
        }
        Returns: Json
      }
      orion_confirm_incident: {
        Args: {
          actor_id: string
          decision: string
          expected_version: number
          reason: string
          target_id: string
        }
        Returns: Json
      }
      persist_commander_plan: {
        Args: {
          agent_run_id: string
          expected_incident_version: number
          job_id: string
          plan_payload: Json
        }
        Returns: string
      }
      persist_specialist_action: {
        Args: {
          action_payload: Json
          agent_run_id: string
          expected_incident_version: number
          expected_staff_version: number
          job_id: string
        }
        Returns: string
      }
      record_dead_job_escalation: {
        Args: { job_id: string; safe_reason: string }
        Returns: undefined
      }
      record_email_event: {
        Args: {
          event_type: string
          happened_at: string
          next_state: Database["public"]["Enums"]["email_status"]
          provider_email_id: string
          provider_event_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      assignment_status:
        | "offered"
        | "acknowledged"
        | "active"
        | "handover_requested"
        | "released"
        | "completed"
        | "cancelled"
      availability_status: "available" | "busy" | "off_duty"
      email_status:
        | "queued"
        | "sending"
        | "sent"
        | "delivered"
        | "failed"
        | "bounced"
        | "suppressed"
      incident_severity: "low" | "normal" | "high" | "critical"
      incident_status:
        | "reported"
        | "triaging"
        | "needs_clarification"
        | "planned"
        | "awaiting_approval"
        | "assigned"
        | "acknowledged"
        | "in_progress"
        | "submitted_for_verification"
        | "resolved"
        | "reopened"
        | "escalated"
        | "cancelled"
      incident_visibility: "routine" | "restricted" | "confidential"
      job_status: "queued" | "running" | "succeeded" | "retry_wait" | "dead"
      membership_status: "active" | "inactive"
      role_name:
        | "principal"
        | "admin"
        | "hod"
        | "supervisor"
        | "cr"
        | "student"
        | "staff"
        | "transport_admin"
        | "president"
        | "coordinator"
        | "safeguarding_officer"
      task_status:
        | "pending"
        | "ready"
        | "assigned"
        | "acknowledged"
        | "in_progress"
        | "blocked"
        | "submitted"
        | "verified"
        | "failed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      assignment_status: [
        "offered",
        "acknowledged",
        "active",
        "handover_requested",
        "released",
        "completed",
        "cancelled",
      ],
      availability_status: ["available", "busy", "off_duty"],
      email_status: [
        "queued",
        "sending",
        "sent",
        "delivered",
        "failed",
        "bounced",
        "suppressed",
      ],
      incident_severity: ["low", "normal", "high", "critical"],
      incident_status: [
        "reported",
        "triaging",
        "needs_clarification",
        "planned",
        "awaiting_approval",
        "assigned",
        "acknowledged",
        "in_progress",
        "submitted_for_verification",
        "resolved",
        "reopened",
        "escalated",
        "cancelled",
      ],
      incident_visibility: ["routine", "restricted", "confidential"],
      job_status: ["queued", "running", "succeeded", "retry_wait", "dead"],
      membership_status: ["active", "inactive"],
      role_name: [
        "principal",
        "admin",
        "hod",
        "supervisor",
        "cr",
        "student",
        "staff",
        "transport_admin",
        "president",
        "coordinator",
        "safeguarding_officer",
      ],
      task_status: [
        "pending",
        "ready",
        "assigned",
        "acknowledged",
        "in_progress",
        "blocked",
        "submitted",
        "verified",
        "failed",
        "cancelled",
      ],
    },
  },
} as const
