import { request } from './request'

export interface PaymentPlan {
  id: string
  name: string
  description: string
  price: number
  duration_days: number
  features: string[]
  created_at: string
}

export interface PaymentOrder {
  id: string
  user_id: string
  order_no: string
  amount: number
  payment_method: 'wechat' | 'alipay'
  status: 'pending' | 'paid' | 'cancelled' | 'refunded'
  description: string
  plan_id?: string
  pay_url?: string
  paid_at?: string
  created_at: string
  updated_at: string
}

export interface CreatePaymentData {
  amount: number
  paymentMethod: 'wechat' | 'alipay'
  description: string
  planId?: string
}

export const getPlansApi = () =>
  request.get<{ success: boolean; data: PaymentPlan[] }>('/api/v1/payment/plans')

export const createPaymentApi = (data: CreatePaymentData) =>
  request.post<{ success: boolean; data: PaymentOrder }>('/api/v1/payment/create', data)

export const getOrdersApi = () =>
  request.get<{ success: boolean; data: PaymentOrder[] }>('/api/v1/payment/orders')

export const getOrderDetailApi = (orderId: string) =>
  request.get<{ success: boolean; data: PaymentOrder }>(`/api/v1/payment/orders/${orderId}`)
