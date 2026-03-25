import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginApi, registerApi, getProfileApi, type LoginData, type RegisterData } from '@/api/auth'

interface User {
  id: string
  username: string
  email: string
  role: string
  avatar?: string
}

export const useUserStore = defineStore('user', () => {
  // 状态
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)

  // 计算属性
  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const userRole = computed(() => user.value?.role || 'guest')
  const userName = computed(() => user.value?.username || '未知用户')

  // 方法
  const setUser = (userData: User) => {
    user.value = userData
    localStorage.setItem('user-info', JSON.stringify(userData))
  }

  const setToken = (tokenValue: string) => {
    token.value = tokenValue
    // 保存到本地存储（兼容 request.ts 中读取 'auth-token' 和 'token'）
    localStorage.setItem('auth-token', tokenValue)
    localStorage.setItem('token', tokenValue)
  }

  const login = async (data: LoginData) => {
    const res = await loginApi(data)
    if (res.data) {
      setUser(res.data.user)
      setToken(res.data.token)
    }
  }

  const register = async (data: RegisterData) => {
    const res = await registerApi(data)
    if (res.data) {
      setUser(res.data.user)
      setToken(res.data.token)
    }
  }

  const logout = () => {
    user.value = null
    token.value = null
    // 清除本地存储
    localStorage.removeItem('auth-token')
    localStorage.removeItem('token')
    localStorage.removeItem('user-info')
  }

  const updateUser = (userData: Partial<User>) => {
    if (user.value) {
      user.value = { ...user.value, ...userData }
      localStorage.setItem('user-info', JSON.stringify(user.value))
    }
  }

  const fetchProfile = async () => {
    try {
      const res = await getProfileApi()
      if (res.data) {
        setUser(res.data)
      }
    } catch {
      logout()
    }
  }

  const initialize = async () => {
    // 从本地存储恢复 token 和用户信息
    const savedToken = localStorage.getItem('auth-token') || localStorage.getItem('token')
    const savedUser = localStorage.getItem('user-info')

    if (savedToken && savedUser) {
      try {
        token.value = savedToken
        user.value = JSON.parse(savedUser)
        // 验证 token 有效性（静默失败）
        await fetchProfile()
      } catch {
        logout()
      }
    }
  }

  const checkPermission = (permission: string): boolean => {
    if (!user.value) return false

    if (user.value.role === 'admin') return true

    const rolePermissions: Record<string, string[]> = {
      user: ['read:certificates', 'read:agents'],
      operator: ['read:certificates', 'read:agents', 'write:certificates'],
      admin: ['*']
    }

    const permissions = rolePermissions[user.value.role] || []
    return permissions.includes('*') || permissions.includes(permission)
  }

  return {
    // 状态
    user,
    token,

    // 计算属性
    isLoggedIn,
    userRole,
    userName,

    // 方法
    setUser,
    setToken,
    login,
    register,
    logout,
    updateUser,
    fetchProfile,
    initialize,
    checkPermission
  }
})
