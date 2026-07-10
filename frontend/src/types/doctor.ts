export interface Doctor {
  id: number
  organization_id: number
  external_id: string | null
  name: string
  document: string | null
  specialty: string | null
  country: string | null
  region: string | null
  provincia: string | null
  comuna: string | null
  institution: string | null
  category: string | null
  last_visit_date: string | null
  days_since_last_visit: number | null
  product: string | null
  adoption_level: string | null
  assigned_rep_id: number | null
  email: string | null
  phone: string | null
  mobile_phone: string | null
  address: string | null
  created_by_id: number | null
  active: boolean
  created_at: string
  updated_at: string
}

export type DoctorListParams = {
  q?: string
  region?: string
  category?: string
  assigned_rep_id?: number
  page?: number
}

export interface DoctorPayload {
  name: string
  document?: string
  specialty?: string
  country?: string
  region?: string
  provincia?: string
  comuna?: string
  institution?: string
  category?: string
  product?: string
  adoption_level?: string
  email?: string
  phone?: string
  mobile_phone?: string
  address?: string
  assigned_rep_id?: number
}
