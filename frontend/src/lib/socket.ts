import { io, type Socket } from 'socket.io-client'
import type { SendMessageRequest, SocketMessage } from './types'

export interface ServerToClientEvents {
  message: (message: SocketMessage) => void
}

export interface ClientToServerEvents {
  'user-join': (userId: string) => void
  message: (message: SendMessageRequest) => void
}

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export const createChatSocket = (): ChatSocket =>
  io(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000')
