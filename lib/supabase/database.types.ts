export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      athlete: {
        Row: {
          athlete_no: number;
          full_name: string;
          gender: Database["public"]["Enums"]["gender"];
          organization_id: number;
        };
        Insert: {
          athlete_no: number;
          full_name: string;
          gender: Database["public"]["Enums"]["gender"];
          organization_id: number;
        };
        Update: {
          athlete_no?: number;
          full_name?: string;
          gender?: Database["public"]["Enums"]["gender"];
          organization_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "athlete_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organization";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor: string;
          after: Json | null;
          at: string;
          before: Json | null;
          entity: string;
          id: string;
          league_id: number;
          reason: string | null;
        };
        Insert: {
          action: string;
          actor: string;
          after?: Json | null;
          at?: string;
          before?: Json | null;
          entity: string;
          id?: string;
          league_id: number;
          reason?: string | null;
        };
        Update: {
          action?: string;
          actor?: string;
          after?: Json | null;
          at?: string;
          before?: Json | null;
          entity?: string;
          id?: string;
          league_id?: number;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "league";
            referencedColumns: ["id"];
          },
        ];
      };
      entry: {
        Row: {
          age_group_code: string;
          athlete_no: number;
          league_id: number;
          organization_id: number;
          run_heat: number;
          swim_heat: number;
          swim_lane: number;
        };
        Insert: {
          age_group_code: string;
          athlete_no: number;
          league_id: number;
          organization_id?: number;
          run_heat: number;
          swim_heat: number;
          swim_lane: number;
        };
        Update: {
          age_group_code?: string;
          athlete_no?: number;
          league_id?: number;
          organization_id?: number;
          run_heat?: number;
          swim_heat?: number;
          swim_lane?: number;
        };
        Relationships: [
          {
            foreignKeyName: "entry_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "league";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entry_organization_id_athlete_no_fkey";
            columns: ["organization_id", "athlete_no"];
            isOneToOne: false;
            referencedRelation: "athlete";
            referencedColumns: ["organization_id", "athlete_no"];
          },
        ];
      };
      league: {
        Row: {
          id: number;
          league_date: string;
          name: string;
          organization_id: number;
          season: number;
        };
        Insert: {
          id?: never;
          league_date: string;
          name: string;
          organization_id: number;
          season: number;
        };
        Update: {
          id?: never;
          league_date?: string;
          name?: string;
          organization_id?: number;
          season?: number;
        };
        Relationships: [
          {
            foreignKeyName: "league_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organization";
            referencedColumns: ["id"];
          },
        ];
      };
      league_race: {
        Row: {
          closed_at: string | null;
          closed_by: string | null;
          device_id: string | null;
          league_id: number;
          run_heat: number;
          started_at: string | null;
        };
        Insert: {
          closed_at?: string | null;
          closed_by?: string | null;
          device_id?: string | null;
          league_id: number;
          run_heat: number;
          started_at?: string | null;
        };
        Update: {
          closed_at?: string | null;
          closed_by?: string | null;
          device_id?: string | null;
          league_id?: number;
          run_heat?: number;
          started_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "league_race_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "league";
            referencedColumns: ["id"];
          },
        ];
      };
      league_team_member: {
        Row: {
          ended_at: string | null;
          id: number;
          league_id: number;
          organization_id: number;
          role: Database["public"]["Enums"]["league_role"];
          started_at: string;
          user_id: string;
        };
        Insert: {
          ended_at?: string | null;
          id?: never;
          league_id: number;
          organization_id?: number;
          role: Database["public"]["Enums"]["league_role"];
          started_at?: string;
          user_id: string;
        };
        Update: {
          ended_at?: string | null;
          id?: never;
          league_id?: number;
          organization_id?: number;
          role?: Database["public"]["Enums"]["league_role"];
          started_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "league_team_member_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "league";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "league_team_member_organization_id_user_id_fkey";
            columns: ["organization_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "organization_member";
            referencedColumns: ["organization_id", "user_id"];
          },
        ];
      };
      operator_note: {
        Row: {
          anchor: number;
          author_id: string | null;
          body: string;
          created_at: string;
          device_id: string;
          id: string;
          league_id: number;
          run_heat: number;
          screen: string;
        };
        Insert: {
          anchor: number;
          author_id?: string | null;
          body: string;
          created_at: string;
          device_id: string;
          id: string;
          league_id: number;
          run_heat: number;
          screen: string;
        };
        Update: {
          anchor?: number;
          author_id?: string | null;
          body?: string;
          created_at?: string;
          device_id?: string;
          id?: string;
          league_id?: number;
          run_heat?: number;
          screen?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operator_note_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "league";
            referencedColumns: ["id"];
          },
        ];
      };
      organization: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id?: never;
          name: string;
        };
        Update: {
          id?: never;
          name?: string;
        };
        Relationships: [];
      };
      organization_member: {
        Row: {
          is_admin: boolean;
          organization_id: number;
          user_id: string;
        };
        Insert: {
          is_admin?: boolean;
          organization_id: number;
          user_id: string;
        };
        Update: {
          is_admin?: boolean;
          organization_id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_member_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organization";
            referencedColumns: ["id"];
          },
        ];
      };
      points_table: {
        Row: {
          age_from: number;
          age_group_code: string;
          age_group_label: string;
          age_to: number;
          bonus_points_per_year: number;
          effective_from: string;
          gender: Database["public"]["Enums"]["gender"];
          run_base_time: string;
          run_distance_m: number;
          run_points_per_second: number;
          sort_order: number;
          swim_base_time: string;
          swim_distance_m: number;
          swim_points_per_second: number;
        };
        Insert: {
          age_from: number;
          age_group_code: string;
          age_group_label: string;
          age_to: number;
          bonus_points_per_year: number;
          effective_from: string;
          gender: Database["public"]["Enums"]["gender"];
          run_base_time: string;
          run_distance_m: number;
          run_points_per_second: number;
          sort_order: number;
          swim_base_time: string;
          swim_distance_m: number;
          swim_points_per_second: number;
        };
        Update: {
          age_from?: number;
          age_group_code?: string;
          age_group_label?: string;
          age_to?: number;
          bonus_points_per_year?: number;
          effective_from?: string;
          gender?: Database["public"]["Enums"]["gender"];
          run_base_time?: string;
          run_distance_m?: number;
          run_points_per_second?: number;
          sort_order?: number;
          swim_base_time?: string;
          swim_distance_m?: number;
          swim_points_per_second?: number;
        };
        Relationships: [];
      };
      position_capture: {
        Row: {
          athlete_no: number | null;
          author_id: string | null;
          device_id: string;
          id: string;
          league_id: number;
          organization_id: number;
          position: number;
          run_heat: number;
          scanned_at: string;
          void_reason: string | null;
          voided: boolean;
        };
        Insert: {
          athlete_no?: number | null;
          author_id?: string | null;
          device_id: string;
          id: string;
          league_id: number;
          organization_id?: number;
          position: number;
          run_heat: number;
          scanned_at: string;
          void_reason?: string | null;
          voided?: boolean;
        };
        Update: {
          athlete_no?: number | null;
          author_id?: string | null;
          device_id?: string;
          id?: string;
          league_id?: number;
          organization_id?: number;
          position?: number;
          run_heat?: number;
          scanned_at?: string;
          void_reason?: string | null;
          voided?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "position_capture_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "league";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "position_capture_organization_id_athlete_no_fkey";
            columns: ["organization_id", "athlete_no"];
            isOneToOne: false;
            referencedRelation: "athlete";
            referencedColumns: ["organization_id", "athlete_no"];
          },
        ];
      };
      run_result: {
        Row: {
          athlete_no: number;
          league_id: number;
          organization_id: number;
          overridden_by: string | null;
          override_reason: string | null;
          run_heat: number;
          run_time: string | null;
          run_time_cs: number | null;
          source: string;
          status: string;
        };
        Insert: {
          athlete_no: number;
          league_id: number;
          organization_id?: number;
          overridden_by?: string | null;
          override_reason?: string | null;
          run_heat: number;
          run_time?: string | null;
          run_time_cs?: never;
          source: string;
          status?: string;
        };
        Update: {
          athlete_no?: number;
          league_id?: number;
          organization_id?: number;
          overridden_by?: string | null;
          override_reason?: string | null;
          run_heat?: number;
          run_time?: string | null;
          run_time_cs?: never;
          source?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "run_result_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "league";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "run_result_organization_id_athlete_no_fkey";
            columns: ["organization_id", "athlete_no"];
            isOneToOne: false;
            referencedRelation: "athlete";
            referencedColumns: ["organization_id", "athlete_no"];
          },
        ];
      };
      swim_result: {
        Row: {
          athlete_no: number;
          distance_m: number | null;
          event_no: number;
          heat: number;
          lane: number;
          league_id: number;
          needs_review: boolean;
          organization_id: number;
          overridden_by: string | null;
          override_reason: string | null;
          place: number | null;
          source: string;
          source_line: string | null;
          status: string;
          swim_time: string | null;
          swim_time_cs: number | null;
        };
        Insert: {
          athlete_no: number;
          distance_m?: number | null;
          event_no: number;
          heat: number;
          lane: number;
          league_id: number;
          needs_review?: boolean;
          organization_id?: number;
          overridden_by?: string | null;
          override_reason?: string | null;
          place?: number | null;
          source: string;
          source_line?: string | null;
          status?: string;
          swim_time?: string | null;
          swim_time_cs?: never;
        };
        Update: {
          athlete_no?: number;
          distance_m?: number | null;
          event_no?: number;
          heat?: number;
          lane?: number;
          league_id?: number;
          needs_review?: boolean;
          organization_id?: number;
          overridden_by?: string | null;
          override_reason?: string | null;
          place?: number | null;
          source?: string;
          source_line?: string | null;
          status?: string;
          swim_time?: string | null;
          swim_time_cs?: never;
        };
        Relationships: [
          {
            foreignKeyName: "swim_result_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "league";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "swim_result_organization_id_athlete_no_fkey";
            columns: ["organization_id", "athlete_no"];
            isOneToOne: false;
            referencedRelation: "athlete";
            referencedColumns: ["organization_id", "athlete_no"];
          },
        ];
      };
      time_capture: {
        Row: {
          author_id: string | null;
          captured_at: string;
          device_id: string;
          elapsed_time: string;
          id: string;
          is_placeholder: boolean;
          league_id: number;
          run_heat: number;
          seq: number;
          void_reason: string | null;
          voided: boolean;
        };
        Insert: {
          author_id?: string | null;
          captured_at: string;
          device_id: string;
          elapsed_time: string;
          id: string;
          is_placeholder?: boolean;
          league_id: number;
          run_heat: number;
          seq: number;
          void_reason?: string | null;
          voided?: boolean;
        };
        Update: {
          author_id?: string | null;
          captured_at?: string;
          device_id?: string;
          elapsed_time?: string;
          id?: string;
          is_placeholder?: boolean;
          league_id?: number;
          run_heat?: number;
          seq?: number;
          void_reason?: string | null;
          voided?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "time_capture_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "league";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_organization: { Args: { org_name: string }; Returns: number };
      organization_members: {
        Args: { org_id: number };
        Returns: {
          email: string;
          is_admin: boolean;
          user_id: string;
        }[];
      };
    };
    Enums: {
      gender: "M" | "F";
      league_role: "official" | "timekeeper" | "placer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      gender: ["M", "F"],
      league_role: ["official", "timekeeper", "placer"],
    },
  },
} as const;
