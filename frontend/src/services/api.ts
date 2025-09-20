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
  uploadMultiple: async (files: File[], metadata?: any) => {
    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata))
    }
    const response = await api.post('/api/files/upload-multiple', formData)
    return response.data
  },
  getFiles: async () => {
    const response = await api.get('/api/files')
    return response.data
  },
  searchFiles: async (query: string, tagIds: string[], type: string) => {
    const params = new URLSearchParams()
    if (query) params.append('query', query)
    if (tagIds.length > 0) params.append('tagIds', tagIds.join(','))
    if (type) params.append('type', type)

    const response = await api.get(`/api/files/search?${params.toString()}`)
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
  updateMetadata: async (id: string, metadata: any) => {
    const response = await api.put(`/api/files/${id}/metadata`, { metadata })
    return response.data
  },
  updateVisibility: async (id: string, isPublic: boolean) => {
    const response = await api.put(`/api/files/${id}/visibility`, { isPublic })
    return response.data
  },
}

export const tagService = {
  getTags: async () => {
    const response = await api.get('/api/tags')
    return response.data
  },
  createTag: async (name: string) => {
    const response = await api.post('/api/tags', { name })
    return response.data
  },
  deleteTag: async (id: string) => {
    const response = await api.delete(`/api/tags/${id}`)
    return response.data
  },
  getFileTags: async (fileId: string) => {
    const response = await api.get(`/api/tags/file/${fileId}`)
    return response.data
  },
  updateFileTags: async (fileId: string, tagIds: string[]) => {
    const response = await api.post(`/api/tags/file/${fileId}`, { tagIds })
    return response.data
  },
}