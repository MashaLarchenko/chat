import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service.js'

@Injectable()
export class PrivateService {
  constructor(private prisma: PrismaService) {}

  private readonly userSummary = { id: true, name: true, email: true } as const

  async createRequest(requesterId: string, recipientEmail: string) {
    const recipient = await this.prisma.user.findUnique({ where: { email: recipientEmail } })
    if (!recipient) throw new NotFoundException('User not found')
    if (recipient.id === requesterId) throw new BadRequestException('You cannot request yourself')

    const existing = await this.prisma.privateRequest.findFirst({
      where: {
        OR: [
          { requesterId, recipientId: recipient.id },
          { requesterId: recipient.id, recipientId: requesterId },
        ],
      },
    })
    if (existing?.status === 'ACCEPTED') throw new BadRequestException('Private room already exists')
    if (existing?.status === 'PENDING') throw new BadRequestException('Request already exists')

    return this.prisma.privateRequest.create({
      data: { requesterId, recipientId: recipient.id },
      include: { requester: { select: this.userSummary }, recipient: { select: this.userSummary } },
    })
  }

  async listRequests(userId: string) {
    return this.prisma.privateRequest.findMany({
      where: { OR: [{ requesterId: userId }, { recipientId: userId }] },
      include: {
        requester: { select: this.userSummary },
        recipient: { select: this.userSummary },
        room: { include: { userOne: { select: this.userSummary }, userTwo: { select: this.userSummary } } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async respondToRequest(userId: string, requestId: string, status: 'ACCEPTED' | 'DECLINED') {
    if (status !== 'ACCEPTED' && status !== 'DECLINED') {
      throw new BadRequestException('Invalid request status')
    }

    const request = await this.prisma.privateRequest.findUnique({ where: { id: requestId } })
    if (!request) throw new NotFoundException('Private request not found')
    if (request.recipientId !== userId) throw new ForbiddenException('Only the recipient can respond')
    if (request.status !== 'PENDING') throw new BadRequestException('Request is no longer pending')

    if (status === 'DECLINED') {
      return this.prisma.privateRequest.update({ where: { id: requestId }, data: { status } })
    }

    const [userOneId, userTwoId] = [request.requesterId, request.recipientId].sort()
    return this.prisma.$transaction(async (transaction) => {
      const room = await transaction.privateRoom.upsert({
        where: { userOneId_userTwoId: { userOneId, userTwoId } },
        update: {},
        create: { userOneId, userTwoId },
      })
      return transaction.privateRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED', roomId: room.id },
        include: {
          room: { include: { userOne: { select: this.userSummary }, userTwo: { select: this.userSummary } } },
        },
      })
    })
  }

  async listRooms(userId: string) {
    return this.prisma.privateRoom.findMany({
      where: { OR: [{ userOneId: userId }, { userTwoId: userId }] },
      include: { userOne: { select: this.userSummary }, userTwo: { select: this.userSummary } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async listMessages(userId: string, roomId: string) {
    await this.getRoomForUser(userId, roomId)
    return this.prisma.privateMessage.findMany({
      where: { roomId },
      include: { sender: { select: this.userSummary } },
      orderBy: { createdAt: 'asc' },
    })
  }

  async sendMessage(userId: string, roomId: string, content: string) {
    await this.getRoomForUser(userId, roomId)
    return this.prisma.privateMessage.create({
      data: { content, senderId: userId, roomId },
      include: { sender: { select: this.userSummary } },
    })
  }

  async getParticipants(userId: string, roomId: string) {
    const room = await this.getRoomForUser(userId, roomId)
    return [room.userOneId, room.userTwoId]
  }

  private async getRoomForUser(userId: string, roomId: string) {
    const room = await this.prisma.privateRoom.findFirst({
      where: { id: roomId, OR: [{ userOneId: userId }, { userTwoId: userId }] },
    })
    if (!room) throw new NotFoundException('Private room not found')
    return room
  }
}
