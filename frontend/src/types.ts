export type Role = 'admin' | 'manager' | 'rep';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  role_id: number;
  organization_id: number;
  organization_name?: string;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  last_page: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  error: {
    type: string;
    description: string;
  };
  message?: string;
}
