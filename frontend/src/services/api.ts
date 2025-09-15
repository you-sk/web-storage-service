import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const api = axios.create({
  baseURL: API_URL,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authService = {
  login: async (username: string, password: string) => {
    const response = await api.post('/api/auth/login', { username, password })
    return response.data
  },
  register: async (username: string, email: string, password: string) => {
    const response = await api.post('/api/auth/register', { username, email, password })
    return response.data
  },
  getMe: async () => {
    const response = await api.get('/api/auth/me')
    return response.data
  },
}

export const fileService = {
  upload: async (file: File, metadata?: any) => {
    const formData = new FormData()
    formData.append('file', file)
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata))
    }
    const response = await api.post('/api/files/upload', formData)
    return response.data
  },
  getFiles: async () => {
    const response = await api.get('/api/files')
    return response.data
  },
  getFile: async (id: string) => {
    const response = await api.get(`/api/files/${id}`)
    return response.data
  },
  downloadFile: async (id: string, filename: string) => {
    const response = await api.get(`/api/files/${id}/download`, {
      responseType: 'blob'
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },
  deleteFile: async (id: string) => {
    const response = await api.delete(`/api/files/${id}`)
    return response.data
  },
}