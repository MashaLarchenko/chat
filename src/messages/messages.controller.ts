import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { MessagesService } from './messages.service.js'

@Controller('messages')
@UseGuards(AuthGuard('jwt'))
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get()
  async findAll() {
    return this.messagesService.findAll()
  }

  @Post(':messageId/reactions')
  toggleReaction(
    @Param('messageId') messageId: string,
    @Req() request: { user: { userId: string } },
    @Body() body: { emoji: string },
  ) {
    return this.messagesService.toggleReaction(messageId, request.user.userId, body.emoji)
  }
}