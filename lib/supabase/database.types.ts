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
        };
        Insert: {
          athlete_no: number;
          full_name: string;
          gender: Database["public"]["Enums"]["gender"];
        };
        Update: {
          athlete_no?: number;
          full_name?: string;
          gender?: Database["public"]["Enums"]["gender"];
        };
        Relationships: [];
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
          reason?: string | null;
        };
        Relationships: [];
      };
      entry: {
        Row: {
          age_group_code: string;
          athlete_no: number;
          league_id: number;
          run_heat: number;
          swim_heat: number;
          swim_lane: number;
        };
        Insert: {
          age_group_code: string;
          athlete_no: number;
          league_id: number;
          run_heat: number;
          swim_heat: number;
          swim_lane: number;
        };
        Update: {
          age_group_code?: string;
          athlete_no?: number;
          league_id?: number;
          run_heat?: number;
          swim_heat?: number;
          swim_lane?: number;
        };
        Relationships: [
          {
            foreignKeyName: "entry_athlete_no_fkey";
            columns: ["athlete_no"];
            isOneToOne: false;
            referencedRelation: "athlete";
            referencedColumns: ["athlete_no"];
          },
          {
            foreignKeyName: "entry_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "league";
            referencedColumns: ["id"];
          },
        ];
      };
      heat_publish: {
        Row: {
          league_id: number;
          published_at: string;
          published_by: string;
          run_heat: number;
        };
        Insert: {
          league_id: number;
          published_at?: string;
          published_by: string;
          run_heat: number;
        };
        Update: {
          league_id?: number;
          published_at?: string;
          published_by?: string;
          run_heat?: number;
        };
        Relationships: [
          {
            foreignKeyName: "heat_publish_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "league";
            referencedColumns: ["id"];
          },
        ];
      };
      heat_timer_start: {
        Row: {
          device_id: string;
          league_id: number;
          run_heat: number;
          started_at: string;
        };
        Insert: {
          device_id: string;
          league_id: number;
          run_heat: number;
          started_at: string;
        };
        Update: {
          device_id?: string;
          league_id?: number;
          run_heat?: number;
          started_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "heat_timer_start_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "league";
            referencedColumns: ["id"];
          },
        ];
      };
      league: {
        Row: {
          id: number;
          league_date: string;
          name: string;
          season: number;
        };
        Insert: {
          id?: never;
          league_date: string;
          name: string;
          season: number;
        };
        Update: {
          id?: never;
          league_date?: string;
          name?: string;
          season?: number;
        };
        Relationships: [];
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
          device_id: string;
          id: string;
          league_id: number;
          position: number;
          run_heat: number;
          scanned_at: string;
          void_reason: string | null;
          voided: boolean;
        };
        Insert: {
          athlete_no?: number | null;
          device_id: string;
          id: string;
          league_id: number;
          position: number;
          run_heat: number;
          scanned_at: string;
          void_reason?: string | null;
          voided?: boolean;
        };
        Update: {
          athlete_no?: number | null;
          device_id?: string;
          id?: string;
          league_id?: number;
          position?: number;
          run_heat?: number;
          scanned_at?: string;
          void_reason?: string | null;
          voided?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "position_capture_athlete_no_fkey";
            columns: ["athlete_no"];
            isOneToOne: false;
            referencedRelation: "athlete";
            referencedColumns: ["athlete_no"];
          },
          {
            foreignKeyName: "position_capture_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "league";
            referencedColumns: ["id"];
          },
        ];
      };
      run_result: {
        Row: {
          athlete_no: number;
          league_id: number;
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
          overridden_by?: string | null;
          override_reason?: string | null;
          run_heat: number;
          run_time?: string | null;
          run_time_cs?: number | null;
          source: string;
          status?: string;
        };
        Update: {
          athlete_no?: number;
          league_id?: number;
          overridden_by?: string | null;
          override_reason?: string | null;
          run_heat?: number;
          run_time?: string | null;
          run_time_cs?: number | null;
          source?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "run_result_athlete_no_fkey";
            columns: ["athlete_no"];
            isOneToOne: false;
            referencedRelation: "athlete";
            referencedColumns: ["athlete_no"];
          },
          {
            foreignKeyName: "run_result_league_id_fkey";
            columns: ["league_id"];
            isOneToOne: false;
            referencedRelation: "league";
            referencedColumns: ["id"];
          },
        ];
      };
      time_capture: {
        Row: {
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
      [_ in never]: never;
    };
    Enums: {
      gender: "M" | "F";
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
    },
  },
} as const;
