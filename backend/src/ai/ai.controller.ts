import { Controller, Post, Body } from '@nestjs/common'
import { AiService } from './ai.service.js'

@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Post()
  async getResponse(@Body() body: { message: string }) {
    const response = await this.aiService.getResponse(body.message)
    return { response }
  }
}