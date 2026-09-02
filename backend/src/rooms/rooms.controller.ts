import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { RoomsService } from './rooms.service.js'

interface AuthenticatedRequest { user: { userId: string } }

@Controller('rooms')
@UseGuards(AuthGuard('jwt'))
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) { return this.roomsService.list(request.user.userId) }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: { name: string; description?: string }) { return this.roomsService.create(request.user.userId, body.name, body.description) }

  @Post(':roomId/join')
  join(@Req() request: AuthenticatedRequest, @Param('roomId') roomId: string) { return this.roomsService.join(request.user.userId, roomId) }

  @Get(':roomId/messages')
  messages(@Req() request: AuthenticatedRequest, @Param('roomId') roomId: string) { return this.roomsService.messages(request.user.userId, roomId) }

  @Post(':roomId/messages')
  sendMessage(@Req() request: AuthenticatedRequest, @Param('roomId') roomId: string, @Body() body: { content: string }) { return this.roomsService.sendMessage(request.user.userId, roomId, body.content) }

  @Post(':roomId/ban/:memberId')
  ban(@Req() request: AuthenticatedRequest, @Param('roomId') roomId: string, @Param('memberId') memberId: string) { return this.roomsService.ban(request.user.userId, roomId, memberId) }
}
