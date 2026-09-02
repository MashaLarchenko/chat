import { Module } from '@nestjs/common'
import { ChatGateway } from './chat.gateway.js'
import { MessagesModule } from '../messages/messages.module.js'
import { RoomsModule } from '../rooms/rooms.module.js'
import { PrivateModule } from '../private/private.module.js'

@Module({
  imports: [MessagesModule, RoomsModule, PrivateModule],
  providers: [ChatGateway],
})
export class ChatModule {}