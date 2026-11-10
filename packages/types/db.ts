
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_membership_id": string | null,"created_at": string,"details": NonNullable<Json>,"entity": string,"entity_id": string | null,"id": string,"org_id": string,"outlet_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_membership_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity": string,"entity_id"?: string | null,"id"?: string,"org_id": string,"outlet_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_membership_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity"?: string,"entity_id"?: string | null,"id"?: string,"org_id"?: string,"outlet_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_membership_id_fkey"
      columns: ["actor_membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_log_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"org_id": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"org_id": string,"sort"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"org_id"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"device_pairings": {
                  Row: {
                    "code_hash": string,"created_at": string,"created_by": string | null,"device_id": string | null,"expires_at": string,"id": string,"label": string,"org_id": string,"outlet_id": string,"used_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code_hash": string,"created_at"?: string,"created_by"?: string | null,"device_id"?: string | null,"expires_at": string,"id"?: string,"label": string,"org_id": string,"outlet_id": string,"used_at"?: string | null
                  }
                  Update: {
                    "code_hash"?: string,"created_at"?: string,"created_by"?: string | null,"device_id"?: string | null,"expires_at"?: string,"id"?: string,"label"?: string,"org_id"?: string,"outlet_id"?: string,"used_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "device_pairings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "device_pairings_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "device_pairings_outlet_id_org_id_fkey"
      columns: ["outlet_id","org_id"]
isOneToOne: false
      referencedRelation: "outlets"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"devices": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"id": string,"kind": string,"label": string,"last_seen_at": string | null,"org_id": string,"outlet_id": string,"revoked_at": string | null,"secret_hash": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: string,"label": string,"last_seen_at"?: string | null,"org_id": string,"outlet_id": string,"revoked_at"?: string | null,"secret_hash"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: string,"label"?: string,"last_seen_at"?: string | null,"org_id"?: string,"outlet_id"?: string,"revoked_at"?: string | null,"secret_hash"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "devices_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "devices_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "devices_outlet_id_fkey"
      columns: ["outlet_id"]
isOneToOne: false
      referencedRelation: "outlets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "devices_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"item_modifier_groups": {
                  Row: {
                    "group_id": string,"item_id": string,"org_id": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"item_id": string,"org_id": string,"sort"?: number
                  }
                  Update: {
                    "group_id"?: string,"item_id"?: string,"org_id"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_modifier_groups_group_id_org_id_fkey"
      columns: ["group_id","org_id"]
isOneToOne: false
      referencedRelation: "modifier_groups"
      referencedColumns: ["id","org_id"]
    },{
      foreignKeyName: "item_modifier_groups_item_id_org_id_fkey"
      columns: ["item_id","org_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"item_outlet_overrides": {
                  Row: {
                    "id": string,"is_available": boolean,"item_id": string,"org_id": string,"outlet_id": string,"price_paise": number | null,"updated_at": string,"variant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"is_available"?: boolean,"item_id": string,"org_id": string,"outlet_id": string,"price_paise"?: number | null,"updated_at"?: string,"variant_id"?: string | null
                  }
                  Update: {
                    "id"?: string,"is_available"?: boolean,"item_id"?: string,"org_id"?: string,"outlet_id"?: string,"price_paise"?: number | null,"updated_at"?: string,"variant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_outlet_overrides_item_id_org_id_fkey"
      columns: ["item_id","org_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","org_id"]
    },{
      foreignKeyName: "item_outlet_overrides_outlet_id_org_id_fkey"
      columns: ["outlet_id","org_id"]
isOneToOne: false
      referencedRelation: "outlets"
      referencedColumns: ["id","org_id"]
    },{
      foreignKeyName: "item_outlet_overrides_variant_id_org_id_fkey"
      columns: ["variant_id","org_id"]
isOneToOne: false
      referencedRelation: "item_variants"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"item_variants": {
                  Row: {
                    "id": string,"item_id": string,"name": string,"org_id": string,"price_paise": number,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"item_id": string,"name": string,"org_id": string,"price_paise": number,"sort"?: number
                  }
                  Update: {
                    "id"?: string,"item_id"?: string,"name"?: string,"org_id"?: string,"price_paise"?: number,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_variants_item_id_org_id_fkey"
      columns: ["item_id","org_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"items": {
                  Row: {
                    "category_id": string,"code": string,"created_at": string,"description": string | null,"food": Database["public"]['Enums']["food_type"],"id": string,"is_active": boolean,"name": string,"org_id": string,"price_paise": number,"sort": number,"tax_rate_bp": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"code": string,"created_at"?: string,"description"?: string | null,"food"?: Database["public"]['Enums']["food_type"],"id"?: string,"is_active"?: boolean,"name": string,"org_id": string,"price_paise": number,"sort"?: number,"tax_rate_bp"?: number,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: string,"code"?: string,"created_at"?: string,"description"?: string | null,"food"?: Database["public"]['Enums']["food_type"],"id"?: string,"is_active"?: boolean,"name"?: string,"org_id"?: string,"price_paise"?: number,"sort"?: number,"tax_rate_bp"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "items_category_id_org_id_fkey"
      columns: ["category_id","org_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","org_id"]
    },{
      foreignKeyName: "items_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"org_id": string,"outlet_ids": (string)[],"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"org_id": string,"outlet_ids"?: (string)[],"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"org_id"?: string,"outlet_ids"?: (string)[],"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"modifier_groups": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"org_id": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"org_id": string,"sort"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"org_id"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "modifier_groups_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"modifiers": {
                  Row: {
                    "group_id": string,"id": string,"is_active": boolean,"name": string,"org_id": string,"price_paise": number,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"id"?: string,"is_active"?: boolean,"name": string,"org_id": string,"price_paise"?: number,"sort"?: number
                  }
                  Update: {
                    "group_id"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"org_id"?: string,"price_paise"?: number,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "modifiers_group_id_org_id_fkey"
      columns: ["group_id","org_id"]
isOneToOne: false
      referencedRelation: "modifier_groups"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "id": string,"item_id": string | null,"line_total_paise": number,"modifiers": NonNullable<Json>,"name": string,"order_id": string,"org_id": string,"outlet_id": string,"qty": number,"sort": number,"tax_rate_bp": number,"unit_paise": number,"variant_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"item_id"?: string | null,"line_total_paise": number,"modifiers"?: NonNullable<Json>,"name": string,"order_id": string,"org_id": string,"outlet_id": string,"qty": number,"sort"?: number,"tax_rate_bp": number,"unit_paise": number,"variant_name"?: string | null
                  }
                  Update: {
                    "id"?: string,"item_id"?: string | null,"line_total_paise"?: number,"modifiers"?: NonNullable<Json>,"name"?: string,"order_id"?: string,"org_id"?: string,"outlet_id"?: string,"qty"?: number,"sort"?: number,"tax_rate_bp"?: number,"unit_paise"?: number,"variant_name"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_org_id_fkey"
      columns: ["order_id","org_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "bill_number": string,"bill_seq": number,"billed_by": string | null,"billed_by_name": string,"business_date": string,"cgst_paise": number,"created_at": string,"customer_phone": string | null,"device_id": string,"financial_year": string,"gst_scheme": string,"id": string,"item_total_paise": number,"order_type": string,"org_id": string,"outlet_id": string,"prices_include_tax": boolean,"round_off_paise": number,"sgst_paise": number,"status": Database["public"]['Enums']["order_status"],"synced_at": string,"tax_rounding": string,"taxable_paise": number,"total_paise": number,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bill_number": string,"bill_seq": number,"billed_by"?: string | null,"billed_by_name": string,"business_date": string,"cgst_paise": number,"created_at": string,"customer_phone"?: string | null,"device_id": string,"financial_year": string,"gst_scheme": string,"id": string,"item_total_paise": number,"order_type": string,"org_id": string,"outlet_id": string,"prices_include_tax": boolean,"round_off_paise": number,"sgst_paise": number,"status"?: Database["public"]['Enums']["order_status"],"synced_at"?: string,"tax_rounding": string,"taxable_paise": number,"total_paise": number,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "bill_number"?: string,"bill_seq"?: number,"billed_by"?: string | null,"billed_by_name"?: string,"business_date"?: string,"cgst_paise"?: number,"created_at"?: string,"customer_phone"?: string | null,"device_id"?: string,"financial_year"?: string,"gst_scheme"?: string,"id"?: string,"item_total_paise"?: number,"order_type"?: string,"org_id"?: string,"outlet_id"?: string,"prices_include_tax"?: boolean,"round_off_paise"?: number,"sgst_paise"?: number,"status"?: Database["public"]['Enums']["order_status"],"synced_at"?: string,"tax_rounding"?: string,"taxable_paise"?: number,"total_paise"?: number,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_billed_by_fkey"
      columns: ["billed_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_device_id_org_id_fkey"
      columns: ["device_id","org_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["id","org_id"]
    },{
      foreignKeyName: "orders_outlet_id_org_id_fkey"
      columns: ["outlet_id","org_id"]
isOneToOne: false
      referencedRelation: "outlets"
      referencedColumns: ["id","org_id"]
    },{
      foreignKeyName: "orders_voided_by_fkey"
      columns: ["voided_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    }
                  ]
                },"orgs": {
                  Row: {
                    "created_at": string,"day_close_hour": number,"gst_scheme": string,"gstin": string | null,"id": string,"modules": (string)[],"name": string,"plan": string,"prices_include_tax": boolean,"slug": string,"timezone": string,"usage": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day_close_hour"?: number,"gst_scheme"?: string,"gstin"?: string | null,"id"?: string,"modules"?: (string)[],"name": string,"plan"?: string,"prices_include_tax"?: boolean,"slug": string,"timezone"?: string,"usage"?: NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"day_close_hour"?: number,"gst_scheme"?: string,"gstin"?: string | null,"id"?: string,"modules"?: (string)[],"name"?: string,"plan"?: string,"prices_include_tax"?: boolean,"slug"?: string,"timezone"?: string,"usage"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"outlets": {
                  Row: {
                    "address": string | null,"city": string | null,"code": string,"created_at": string,"id": string,"is_active": boolean,"name": string,"org_id": string,"upi_vpa": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"city"?: string | null,"code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"org_id": string,"upi_vpa"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"city"?: string | null,"code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"org_id"?: string,"upi_vpa"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "outlets_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_paise": number,"created_at": string,"id": string,"mode": Database["public"]['Enums']["payment_mode"],"order_id": string,"org_id": string,"outlet_id": string,"tendered_paise": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"created_at": string,"id": string,"mode": Database["public"]['Enums']["payment_mode"],"order_id": string,"org_id": string,"outlet_id": string,"tendered_paise"?: number | null
                  }
                  Update: {
                    "amount_paise"?: number,"created_at"?: string,"id"?: string,"mode"?: Database["public"]['Enums']["payment_mode"],"order_id"?: string,"org_id"?: string,"outlet_id"?: string,"tendered_paise"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_order_id_org_id_fkey"
      columns: ["order_id","org_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string,"id": string,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name": string,"id": string,"phone"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"id"?: string,"phone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"staff_pins": {
                  Row: {
                    "failed_attempts": number,"locked_until": string | null,"membership_id": string,"pin_hash": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "failed_attempts"?: number,"locked_until"?: string | null,"membership_id": string,"pin_hash": string,"updated_at"?: string
                  }
                  Update: {
                    "failed_attempts"?: number,"locked_until"?: string | null,"membership_id"?: string,"pin_hash"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_pins_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: true
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_staff":
{ Args: { "p": Json }; Returns: string
                           },
"create_pairing_code":
{ Args: { "p_label": string,"p_outlet_id": string }; Returns: Json
                           },
"device_last_bill_seq":
{ Args: { "p_device_id": string,"p_financial_year": string,"p_secret"?: string }; Returns: number
                           },
"device_roster":
{ Args: { "p_device_id": string,"p_secret": string }; Returns: Json
                           },
"ensure_personal_device":
{ Args: { "p_label": string,"p_outlet_id": string }; Returns: Json
                           },
"health":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"list_staff":
{ Args: { "p_org_id": string }; Returns: Json
                           },
"pair_device":
{ Args: { "p_code": string }; Returns: Json
                           },
"register_device":
{ Args: { "p_label": string,"p_outlet_id": string }; Returns: Json
                           },
"revoke_device":
{ Args: { "p_device_id": string }; Returns: undefined
                           },
"save_item":
{ Args: { "p": Json }; Returns: string
                           },
"save_modifier_group":
{ Args: { "p": Json }; Returns: string
                           },
"set_staff_pin":
{ Args: { "p_membership_id": string,"p_pin": string }; Returns: undefined
                           },
"update_staff":
{ Args: { "p": Json }; Returns: undefined
                           },
"upsert_order":
{ Args: { "p": Json,"p_secret"?: string }; Returns: Json
                           },
"verify_staff_pin":
{ Args: { "p_device_id": string,"p_membership_id": string,"p_pin": string,"p_secret": string }; Returns: Json
                           },
"void_order":
{ Args: { "p": Json,"p_secret"?: string }; Returns: Json
                           }
          }
          Enums: {
            "app_role": "owner"|"manager"|"cashier"|"kitchen"|"loyalty_staff","food_type": "veg"|"nonveg"|"egg","order_status": "paid"|"void","payment_mode": "cash"|"upi"|"card"|"due"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "app_role": ["owner", "manager", "cashier", "kitchen", "loyalty_staff"],"food_type": ["veg", "nonveg", "egg"],"order_status": ["paid", "void"],"payment_mode": ["cash", "upi", "card", "due"]
          }
        }
} as const
