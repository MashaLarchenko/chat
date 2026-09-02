import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { MessagesService } from '../messages/messages.service.js'
import { RoomsService } from '../rooms/rooms.service.js'
import { PrivateService } from '../private/private.service.js'

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private users: { [socketId: string]: string } = {}

  constructor(private messagesService: MessagesService, private roomsService: RoomsService, private privateService: PrivateService) {}

  handleConnection(client: Socket) {
    console.log(`⚡ Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Client disconnected: ${client.id}`)
    delete this.users[client.id]
  }

  private getSocketByUserId(userId: string): string | undefined {
    return Object.entries(this.users).find(([, id]) => id === userId)?.[0]
  }

  @SubscribeMessage('user-join')
  handleUserJoin(client: Socket, userId: string) {
    this.users[client.id] = userId
    console.log(`👤 User ${userId} joined`)
  }

  @SubscribeMessage('message')
  async handleMessage(client: Socket, data: any) {
    console.log('📨 Message:', data)

    // Сохраняем в базу
    try {
      await this.messagesService.create({
        content: data.content,
        userId: data.userId,
        isAI: false,
      })
    } catch (error) {
      console.error('Save message error:', error)
    }

    // Отправляем всем
    this.server.emit('message', {
      id: Date.now().toString(),
      content: data.content,
      userId: data.userId,
      userName: data.userName,
      isAI: false,
      createdAt: new Date().toISOString(),
    })
  }

  @SubscribeMessage('private-message')
async handlePrivateMessage(client: Socket, data: any) {
  // Сохраняем в БД
  const message = {
    content: data.content,
    userId: data.userId,
    recipientId: data.recipientId, // 👈 кому отправляем
    isAI: false,
  }
  await this.messagesService.create(message)

  const recipientSocket = this.getSocketByUserId(data.recipientId)
  if (recipientSocket) {
    this.server.to(recipientSocket).emit('private-message', {
      id: Date.now().toString(),
      content: data.content,
      userId: data.userId,
      userName: data.userName,
      isAI: false,
      isPrivate: true,
      createdAt: new Date().toISOString(),
    })
  }
}

  @SubscribeMessage('room-join')
  async handleRoomJoin(client: Socket, data: { roomId: string; userId: string }) {
    await this.roomsService.canAccess(data.userId, data.roomId)
    await client.join(`room:${data.roomId}`)
  }

  @SubscribeMessage('room-message')
  async handleRoomMessage(client: Socket, data: { roomId: string; userId: string; content: string }) {
    await this.roomsService.canAccess(data.userId, data.roomId)
    const message = await this.roomsService.sendMessage(data.userId, data.roomId, data.content)
    this.server.to(`room:${data.roomId}`).emit('room-message', message)
  }

  @SubscribeMessage('private-room-message')
  async handlePrivateRoomMessage(client: Socket, data: { roomId: string; userId: string; content: string }) {
    const participants = await this.privateService.getParticipants(data.userId, data.roomId)
    const message = await this.privateService.sendMessage(data.userId, data.roomId, data.content)
    const recipientId = participants.find((id) => id !== data.userId)
    const recipientSocket = recipientId ? this.getSocketByUserId(recipientId) : undefined
    const event = { ...message, roomId: data.roomId }
    if (recipientSocket) this.server.to(recipientSocket).emit('private-room-message', event)
    this.server.to(client.id).emit('private-room-message', event)
  }
}