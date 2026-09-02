export interface User {
  id: string
  email: string
  name: string | null
  role: 'USER' | 'ADMIN'
}

export interface AuthRequest {
  email: string
  password: string
  name?: string
}

export type LoginRequest = Omit<AuthRequest, 'name'>

export interface Message {
  id: string
  content: string
  userId: string
  isAI: boolean
  createdAt: string
  user?: UserSummary
  userName?: string
  reactions?: Reaction[]
}

export interface Reaction {
  id: string
  emoji: string
  userId: string
}

export interface UserSummary {
  id: string
  name: string | null
  email: string
}

export interface SocketMessage {
  id: string
  content: string
  userId: string
  userName: string
  isAI: false
  createdAt: string
}

export interface SendMessageRequest {
  content: string
  userId: string
  userName: string
}

export interface AiRequest {
  message: string
}

export interface AiResponse {
  response: string
}

export interface AuthResponse {
  token: string
  user: User
}

export type PrivateRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED'

export interface PrivateRoom {
  id: string
  userOne: UserSummary
  userTwo: UserSummary
  createdAt: string
}

export interface PrivateRequest {
  id: string
  requesterId: string
  recipientId: string
  status: PrivateRequestStatus
  roomId: string | null
  requester: UserSummary
  recipient: UserSummary
  room?: PrivateRoom | null
  createdAt: string
  updatedAt: string
}

export interface PrivateMessage {
  id: string
  content: string
  senderId: string
  sender: UserSummary
  roomId: string
  createdAt: string
}

export interface ThematicRoom {
  id: string
  name: string
  description: string | null
  createdBy: string
  creator: UserSummary
  members?: RoomMember[]
  isMember: boolean
  isBanned: boolean
  _count: { members: number; messages: number }
  createdAt: string
}

export interface RoomMember {
  id: string
  userId: string
  user: UserSummary
  bannedAt: string | null
  joinedAt: string
}

export interface RoomMessage {
  id: string
  content: string
  userId: string
  user: UserSummary
  roomId: string
  createdAt: string
}

export interface RoomSocketEvents {
  'room-message': (message: RoomMessage) => void
}

export interface RoomClientEvents {
  'user-join': (userId: string) => void
  'room-join': (data: { roomId: string; userId: string }) => void
  'room-message': (data: { roomId: string; userId: string; content: string }) => void
}

export interface PrivateSocketEvents {
  'private-room-message': (message: PrivateMessage) => void
}

export interface PrivateClientEvents {
  'user-join': (userId: string) => void
  'private-room-message': (data: { roomId: string; userId: string; content: string }) => void
}