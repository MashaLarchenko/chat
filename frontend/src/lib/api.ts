import axios from 'axios'
import type {
  AiRequest,
  AiResponse,
  AuthResponse,
  AuthRequest,
  LoginRequest,
  Message,
  PrivateMessage,
  PrivateRequest,
  PrivateRoom,
  RoomMessage,
  ThematicRoom,
} from './types'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

export const authApi = {
  register: (request: AuthRequest) =>
    api.post<AuthResponse>('/auth/register', request).then(({ data }) => data),
  login: (request: LoginRequest) =>
    api.post<AuthResponse>('/auth/login', request).then(({ data }) => data),
}

export const messagesApi = {
  list: () => api.get<Message[]>('/messages').then(({ data }) => data),
  toggleReaction: (messageId: string, emoji: string) =>
    api.post<Message['reactions']>(`/messages/${messageId}/reactions`, { emoji }).then(({ data }) => data),
}

export const aiApi = {
  respond: (request: AiRequest) =>
    api.post<AiResponse>('/ai', request).then(({ data }) => data),
}

export const privateApi = {
  createRequest: (recipientEmail: string) =>
    api.post<PrivateRequest>('/private/requests', { recipientEmail }).then(({ data }) => data),
  listRequests: () => api.get<PrivateRequest[]>('/private/requests').then(({ data }) => data),
  respondToRequest: (id: string, status: 'ACCEPTED' | 'DECLINED') =>
    api.patch<PrivateRequest>(`/private/requests/${id}`, { status }).then(({ data }) => data),
  listRooms: () => api.get<PrivateRoom[]>('/private/rooms').then(({ data }) => data),
  listMessages: (roomId: string) =>
    api.get<PrivateMessage[]>(`/private/rooms/${roomId}/messages`).then(({ data }) => data),
  sendMessage: (roomId: string, content: string) =>
    api.post<PrivateMessage>(`/private/rooms/${roomId}/messages`, { content }).then(({ data }) => data),
}

export const roomsApi = {
  list: () => api.get<ThematicRoom[]>('/rooms').then(({ data }) => data),
  create: (name: string, description?: string) => api.post<ThematicRoom>('/rooms', { name, description }).then(({ data }) => data),
  join: (roomId: string) => api.post(`/rooms/${roomId}/join`).then(({ data }) => data),
  messages: (roomId: string) => api.get<RoomMessage[]>(`/rooms/${roomId}/messages`).then(({ data }) => data),
  sendMessage: (roomId: string, content: string) => api.post<RoomMessage>(`/rooms/${roomId}/messages`, { content }).then(({ data }) => data),
  ban: (roomId: string, memberId: string) => api.post(`/rooms/${roomId}/ban/${memberId}`).then(({ data }) => data),
}

export default api
