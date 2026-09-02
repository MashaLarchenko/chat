import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service.js'

const userSummary = { id: true, name: true, email: true } as const

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    const rooms = await this.prisma.room.findMany({
      include: { creator: { select: userSummary }, _count: { select: { members: true, messages: true } }, members: { include: { user: { select: userSummary } } } },
      orderBy: { createdAt: 'desc' },
    })
    return rooms.map((room) => {
      const membership = room.members.find((member) => member.userId === userId)
      return { ...room, isMember: Boolean(membership && !membership.bannedAt), isBanned: Boolean(membership?.bannedAt) }
    })
  }

  async create(userId: string, name: string, description?: string) {
    const cleanName = name.trim()
    if (!cleanName) throw new BadRequestException('Room name is required')
    const room = await this.prisma.room.create({
      data: { name: cleanName, description: description?.trim() || null, createdBy: userId, members: { create: { userId } } },
      include: { creator: { select: userSummary }, _count: { select: { members: true, messages: true } } },
    })
    return { ...room, isMember: true, isBanned: false }
  }

  async join(userId: string, roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } })
    if (!room) throw new NotFoundException('Room not found')
    const member = await this.prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } })
    if (member?.bannedAt) throw new ForbiddenException('You are banned from this room')
    await this.prisma.roomMember.upsert({ where: { roomId_userId: { roomId, userId } }, update: {}, create: { roomId, userId } })
    return { joined: true }
  }

  async messages(userId: string, roomId: string) {
    await this.requireMember(userId, roomId)
    return this.prisma.roomMessage.findMany({ where: { roomId }, include: { user: { select: userSummary } }, orderBy: { createdAt: 'asc' }, take: 200 })
  }

  async sendMessage(userId: string, roomId: string, content: string) {
    await this.requireMember(userId, roomId)
    if (!content.trim()) throw new BadRequestException('Message cannot be empty')
    return this.prisma.roomMessage.create({ data: { roomId, userId, content: content.trim() }, include: { user: { select: userSummary } } })
  }

  async canAccess(userId: string, roomId: string) {
    await this.requireMember(userId, roomId)
    return true
  }

  async ban(creatorId: string, roomId: string, memberId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, select: { createdBy: true } })
    if (!room) throw new NotFoundException('Room not found')
    if (room.createdBy !== creatorId) throw new ForbiddenException('Only the room creator can ban users')
    if (memberId === creatorId) throw new BadRequestException('The creator cannot ban themselves')
    const member = await this.prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId: memberId } } })
    if (!member) throw new NotFoundException('Member not found')
    await this.prisma.roomMember.update({ where: { id: member.id }, data: { bannedAt: new Date() } })
    return { banned: true }
  }

  private async requireMember(userId: string, roomId: string) {
    const member = await this.prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } })
    if (!member) throw new ForbiddenException('Join this room first')
    if (member.bannedAt) throw new ForbiddenException('You are banned from this room')
    return member
  }
}
