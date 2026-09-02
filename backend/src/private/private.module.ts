import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module.js'
import { PrivateController } from './private.controller.js'
import { PrivateService } from './private.service.js'

@Module({
  imports: [PrismaModule],
  controllers: [PrivateController],
  providers: [PrivateService],
  exports: [PrivateService],
})
export class PrivateModule {}
