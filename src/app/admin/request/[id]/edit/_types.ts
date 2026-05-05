export interface UploadResponse {
  success: boolean
  data?: unknown[]
  message?: string
}

export interface Report {
  report_id: number
  submitted_at: string
  prefix: string
  full_name: string
  age?: number | null
  id_or_passport_number: string
  phone_number: string
  language?: string

  house_number?: string
  village_number?: string
  alley?: string
  road?: string
  sub_district?: string
  district?: string
  province?: string
  postal_code?: string

  category_id?: number | null
  request_type: string
  request_details?: string | null
  incident_date?: string | null
  incident_time?: string | null
  incident_location?: string | null

  involvement_role?: string | null
  involvement_explain?: string | null

  supporting_documents?: string | null

  status: string
  priority: string
  status_updated_at?: string | null

  assigned_officer_id?: number | null

  officer_comments?: string | null
  officer_decision?: string | null
  internal_notes?: string | null
  public_notes?: string | null
  rejection_reason?: string | null

  created_at: string
  updated_at: string
  created_by?: string | null
  updated_by?: string | null

  latitude?: number | null
  longitude?: number | null
  location_verified_by?: number | null
  location_verified_at?: string | null
  location_verified_officer_name?: string | null
}

export interface Officer {
  officer_id: number
  prefix?: string
  full_name: string
  position?: string
}

export interface Category {
  category_id: number
  category_name: string
}

export type AttachmentCategory = 'idcopy' | 'operation' | 'เอกสารอื่นๆ' | string

export interface Attachment {
  id: number
  file_name: string
  file_type: string
  file_size: number
  uploaded_at: string
  url: string
  category?: AttachmentCategory
}

export interface Media {
  id: string
  file_name: string
  file_type: string
  file_size?: number
  width?: number
  height?: number
  uploaded_at: string
  url: string
  media_type?: 'image' | 'video'
  published?: string
  approval_status?: string
}

export type ActiveTab = 'applicant' | 'officer' | 'docs' | 'photos'
