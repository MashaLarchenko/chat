import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { PrivateService } from './private.service.js'

interface AuthenticatedRequest {
  user: { userId: string }
}

@Controller('private')
@UseGuards(AuthGuard('jwt'))
export class PrivateController {
  constructor(private privateService: PrivateService) {}

  @Post('requests')
  createRequest(@Req() request: AuthenticatedRequest, @Body() body: { recipientEmail: string }) {
    return this.privateService.createRequest(request.user.userId, body.recipientEmail)
  }

  @Get('requests')
  listRequests(@Req() request: AuthenticatedRequest) {
    return this.privateService.listRequests(request.user.userId)
  }

  @Patch('requests/:id')
  respond(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: { status: 'ACCEPTED' | 'DECLINED' }) {
    return this.privateService.respondToRequest(request.user.userId, id, body.status)
  }

  @Get('rooms')
  listRooms(@Req() request: AuthenticatedRequest) {
    return this.privateService.listRooms(request.user.userId)
  }

  @Get('rooms/:roomId/messages')
  listMessages(@Req() request: AuthenticatedRequest, @Param('roomId') roomId: string) {
    return this.privateService.listMessages(request.user.userId, roomId)
  }

  @Post('rooms/:roomId/messages')
  sendMessage(@Req() request: AuthenticatedRequest, @Param('roomId') roomId: string, @Body() body: { content: string }) {
    return this.privateService.sendMessage(request.user.userId, roomId, body.content)
  }
}
