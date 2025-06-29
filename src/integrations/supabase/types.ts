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
      admin_settings: {
        Row: {
          id: string
          setting_type: string
          whatsapp_number: string | null
          is_whatsapp_share_enabled: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          setting_type: string
          whatsapp_number?: string | null
          is_whatsapp_share_enabled?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          setting_type?: string
          whatsapp_number?: string | null
          is_whatsapp_share_enabled?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          check_in_time: string
          check_out_time: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          status: string
          total_hours: number | null
          late_duration: number | null
          sequence_number: number
        }
        Insert: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          date?: string
          employee_id: string
          id?: string
          status?: string
          total_hours?: number | null
          late_duration?: number | null
          sequence_number?: number
        }
        Update: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          status?: string
          total_hours?: number | null
          late_duration?: number | null
          sequence_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_view"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          department_id: string | null
          email: string | null
          first_name: string | null
          id: string
          join_date: string
          last_name: string | null
          name: string
          phone: string | null
          position: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          join_date?: string
          last_name?: string | null
          name: string
          phone?: string | null
          position?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          join_date?: string
          last_name?: string | null
          name?: string
          phone?: string | null
          position?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      gate_pass_logs: {
        Row: {
          action: string
          gate_pass_id: string
          id: string
          new_status: Database["public"]["Enums"]["pass_status"] | null
          notes: string | null
          old_status: Database["public"]["Enums"]["pass_status"] | null
          performed_at: string
          performed_by: string
        }
        Insert: {
          action: string
          gate_pass_id: string
          id?: string
          new_status?: Database["public"]["Enums"]["pass_status"] | null
          notes?: string | null
          old_status?: Database["public"]["Enums"]["pass_status"] | null
          performed_at?: string
          performed_by: string
        }
        Update: {
          action?: string
          gate_pass_id?: string
          id?: string
          new_status?: Database["public"]["Enums"]["pass_status"] | null
          notes?: string | null
          old_status?: Database["public"]["Enums"]["pass_status"] | null
          performed_at?: string
          performed_by?: string
        }
        Relationships: []
      }
      gate_passes: {
        Row: {
          created_at: string
          created_by: string
          employee_id: string
          employee_name: string
          exit_time: string | null
          expected_exit_time: string | null
          expected_return_time: string | null
          expires_at: string
          id: string
          last_used_at: string | null
          pass_code: string
          reason: string
          return_time: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: Database["public"]["Enums"]["pass_status"]
          type: Database["public"]["Enums"]["pass_type"]
          updated_at: string | null
          use_count: number | null
          used_at: string | null
          used_by: string | null
          validity: Database["public"]["Enums"]["pass_validity"]
        }
        Insert: {
          created_at?: string
          created_by: string
          employee_id: string
          employee_name: string
          exit_time?: string | null
          expected_exit_time?: string | null
          expected_return_time?: string | null
          expires_at: string
          id?: string
          last_used_at?: string | null
          pass_code: string
          reason: string
          return_time?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: Database["public"]["Enums"]["pass_status"]
          type: Database["public"]["Enums"]["pass_type"]
          updated_at?: string | null
          use_count?: number | null
          used_at?: string | null
          used_by?: string | null
          validity: Database["public"]["Enums"]["pass_validity"]
        }
        Update: {
          created_at?: string
          created_by?: string
          employee_id?: string
          employee_name?: string
          exit_time?: string | null
          expected_exit_time?: string | null
          expected_return_time?: string | null
          expires_at?: string
          id?: string
          last_used_at?: string | null
          pass_code?: string
          reason?: string
          return_time?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: Database["public"]["Enums"]["pass_status"]
          type?: Database["public"]["Enums"]["pass_type"]
          updated_at?: string | null
          use_count?: number | null
          used_at?: string | null
          used_by?: string | null
          validity?: Database["public"]["Enums"]["pass_validity"]
        }
        Relationships: [
          {
            foreignKeyName: "gate_passes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_passes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_view"
            referencedColumns: ["id"]
          },
        ]
      }
      rosters: {
        Row: {
          id: string;
          employee_id: string;
          department_id: string;
          position: string;
          name?: string;
          description?: string;
          start_date: string;
          end_date: string;
          start_time: string;
          end_time: string;
          break_start?: string;
          break_end?: string;
          break_duration: number;
          shift_pattern: ShiftPattern[];
          notes?: string;
          is_active: boolean;
          status: 'active' | 'completed' | 'upcoming';
          grace_period: number;
          early_departure_threshold: number;
          created_at: string;
          updated_at: string;
          created_by?: string;
          updated_by?: string;
          assignment_time?: string;
          completion_time?: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          department_id: string;
          position: string;
          name?: string;
          description?: string;
          start_date: string;
          end_date: string;
          start_time: string;
          end_time: string;
          break_start?: string;
          break_end?: string;
          break_duration: number;
          shift_pattern: ShiftPattern[];
          notes?: string;
          is_active: boolean;
          status?: 'active' | 'completed' | 'upcoming';
          grace_period: number;
          early_departure_threshold: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string;
          updated_by?: string;
          assignment_time?: string;
          completion_time?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          department_id?: string;
          position?: string;
          name?: string;
          description?: string;
          start_date?: string;
          end_date?: string;
          start_time?: string;
          end_time?: string;
          break_start?: string;
          break_end?: string;
          break_duration?: number;
          shift_pattern?: ShiftPattern[];
          notes?: string;
          is_active?: boolean;
          status?: 'active' | 'completed' | 'upcoming';
          grace_period?: number;
          early_departure_threshold?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string;
          updated_by?: string;
          assignment_time?: string;
          completion_time?: string;
        };
      }
    }
    Views: {
      employees_view: {
        Row: {
          created_at: string | null
          department: string | null
          department_id: string | null
          email: string | null
          first_name: string | null
          id: string | null
          join_date: string | null
          last_name: string | null
          phone: string | null
          position: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auto_expire_passes: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_gate_pass: {
        Args: {
          p_employee_id: string
          p_pass_code: string
          p_employee_name: string
          p_validity: Database["public"]["Enums"]["pass_validity"]
          p_type: Database["public"]["Enums"]["pass_type"]
          p_reason: string
          p_created_by: string
          p_expires_at: string
        }
        Returns: {
          created_at: string
          created_by: string
          employee_id: string
          employee_name: string
          exit_time: string | null
          expected_exit_time: string | null
          expected_return_time: string | null
          expires_at: string
          id: string
          last_used_at: string | null
          pass_code: string
          reason: string
          return_time: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: Database["public"]["Enums"]["pass_status"]
          type: Database["public"]["Enums"]["pass_type"]
          updated_at: string | null
          use_count: number | null
          used_at: string | null
          used_by: string | null
          validity: Database["public"]["Enums"]["pass_validity"]
        }
      }
      revoke_gate_pass: {
        Args: {
          p_pass_id: string
          p_revoked_by: string
          p_reason: string
        }
        Returns: {
          created_at: string
          created_by: string
          employee_id: string
          employee_name: string
          exit_time: string | null
          expected_exit_time: string | null
          expected_return_time: string | null
          expires_at: string
          id: string
          last_used_at: string | null
          pass_code: string
          reason: string
          return_time: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: Database["public"]["Enums"]["pass_status"]
          type: Database["public"]["Enums"]["pass_type"]
          updated_at: string | null
          use_count: number | null
          used_at: string | null
          used_by: string | null
          validity: Database["public"]["Enums"]["pass_validity"]
        }
      }
      use_gate_pass: {
        Args: {
          p_pass_id: string
          p_used_by: string
        }
        Returns: {
          created_at: string
          created_by: string
          employee_id: string
          employee_name: string
          exit_time: string | null
          expected_exit_time: string | null
          expected_return_time: string | null
          expires_at: string
          id: string
          last_used_at: string | null
          pass_code: string
          reason: string
          return_time: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: Database["public"]["Enums"]["pass_status"]
          type: Database["public"]["Enums"]["pass_type"]
          updated_at: string | null
          use_count: number | null
          used_at: string | null
          used_by: string | null
          validity: Database["public"]["Enums"]["pass_validity"]
        }
      }
    }
    Enums: {
      pass_status: "active" | "used" | "expired" | "revoked"
      pass_type: "entry" | "exit" | "both"
      pass_validity: "single" | "day" | "week" | "month"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export type ShiftType = 'morning' | 'evening' | 'night' | 'off';

export interface TimeSlot {
  start_time: string;  // Format: "HH:mm"
  end_time: string;    // Format: "HH:mm"
}

export interface DailyShift {
  date: string;
  shift: 'morning' | 'evening' | 'night' | 'off';
  time_slot?: {
    start_time: string;
    end_time: string;
  };
}

export interface Roster {
  id: string;
  employee_id: string;
  department_id: string;
  position: string;
  name?: string;
  description?: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  break_start?: string;
  break_end?: string;
  break_duration: number;
  shift_pattern: ShiftPattern[];
  notes?: string;
  is_active: boolean;
  status: 'active' | 'completed' | 'upcoming';
  grace_period: number;
  early_departure_threshold: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  assignment_time?: string;
  completion_time?: string;
}
