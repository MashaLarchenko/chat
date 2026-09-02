import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service.js'

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.message.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        reactions: {
          select: { id: true, emoji: true, userId: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })
  }

  async create(data: { content: string; userId: string; isAI?: boolean }) {
    return this.prisma.message.create({
      data: {
        content: data.content,
        userId: data.userId,
        isAI: data.isAI || false,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        reactions: {
          select: { id: true, emoji: true, userId: true },
        },
      },
    })
  }

  async toggleReaction(messageId: string, userId: string, emoji: string) {
    const existing = await this.prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    })

    if (existing) {
      await this.prisma.messageReaction.delete({ where: { id: existing.id } })
    } else {
      await this.prisma.messageReaction.create({ data: { messageId, userId, emoji } })
    }

    return this.prisma.messageReaction.findMany({
      where: { messageId },
      select: { id: true, emoji: true, userId: true },
    })
  }
}