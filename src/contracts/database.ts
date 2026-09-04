/** Generated-shape placeholder owned by Developer 1. Regenerate from the linked Supabase project after migrations apply. */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>;
    Views: Record<string, never>;
    Functions: {
      claim_jobs: {
        Args: { worker_id: string; batch_size: number; lease_seconds: number };
        Returns: Array<{ id: string; type: string; incident_id: string | null; attempt: number; payload: Json }>;
      };
    };
    Enums: Record<string, string>;
    CompositeTypes: Record<string, never>;
  };
};
