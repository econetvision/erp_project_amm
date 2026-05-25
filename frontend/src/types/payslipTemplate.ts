export interface TemplateField {
  key: string;
  label: string;
  enabled: boolean;
  masked?: boolean;
}

export interface TemplateSection {
  id: string;
  type: "header" | "info" | "table" | "summary" | "note" | "footer";
  label: string;
  enabled: boolean;
  order: number;
  fields?: TemplateField[];
}

export interface TemplateLayout {
  paperSize: string;
  orientation: string;
  margins: { top: number; right: number; bottom: number; left: number };
  showHeader: boolean;
  showFooter: boolean;
  showLogo: boolean;
  showSignature: boolean;
  primaryColor: string;
  headerBg: string;
  headerTextColor: string;
  fontFamily: string;
  fontSize: number;
  sections: TemplateSection[];
}

export interface PayslipTemplate {
  id: number;
  name: string;
  description: string | null;
  company_id: number | null;
  is_default: boolean;
  is_active: boolean;
  layout: TemplateLayout;
  logo_url: string | null;
  company_name: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  footer_text: string | null;
  signature_label: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface PayslipTemplateCreate {
  name: string;
  description?: string;
  company_id?: number | null;
  is_default?: boolean;
  layout: TemplateLayout;
  logo_url?: string;
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  footer_text?: string;
  signature_label?: string;
}

export interface PayslipTemplateUpdate {
  name?: string;
  description?: string;
  is_default?: boolean;
  is_active?: boolean;
  layout?: TemplateLayout;
  logo_url?: string;
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  footer_text?: string;
  signature_label?: string;
}
