import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module.js'
import { AuthModule } from './auth/auth.module.js'
import { MessagesModule } from './messages/messages.module.js'
import { AiModule } from './ai/ai.module.js'
import { ChatModule } from './chat/chat.module.js'
import { PrivateModule } from './private/private.module.js'
import { RoomsModule } from './rooms/rooms.module.js'

@Module({
  imports: [PrismaModule, AuthModule, MessagesModule, AiModule, ChatModule, PrivateModule, RoomsModule],
})
export class AppModule {}