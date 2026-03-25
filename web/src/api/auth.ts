import { request } from './request'

export interface LoginData {
  username: string
  password: string
}

export interface RegisterData {
  username: string
  email: string
  password: string
}

export interface ProfileUpdateData {
  username?: string
  email?: string
  avatar?: string
}

export interface ChangePasswordData {
  oldPassword: string
  newPassword: string
}

export interface UserInfo {
  id: string
  username: string
  email: string
  role: string
  avatar?: string
  created_at?: string
}

export interface AuthResponse {
  success: boolean
  data?: {
    token: string
    user: UserInfo
  }
  error?: string
}

export const loginApi = (data: LoginData) =>
  request.post<AuthResponse>('/api/v1/auth/login', data)

export const registerApi = (data: RegisterData) =>
  request.post<AuthResponse>('/api/v1/auth/register', data)

export const getProfileApi = () =>
  request.get<{ success: boolean; data: UserInfo }>('/api/v1/auth/profile')

export const updateProfileApi = (data: ProfileUpdateData) =>
  request.put<{ success: boolean; data: UserInfo }>('/api/v1/auth/profile', data)

export const changePasswordApi = (data: ChangePasswordData) =>
  request.put<{ success: boolean; data: { message: string } }>('/api/v1/auth/password', data)
