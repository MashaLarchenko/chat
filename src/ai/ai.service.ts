import { Injectable } from '@nestjs/common'

@Injectable()
export class AiService {
  async getResponse(message: string): Promise<string> {
    // Если есть API ключ
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'mistralai/mistral-7b-instruct:free',
            messages: [
              { role: 'system', content: 'You are a helpful assistant. Keep responses short and friendly.' },
              { role: 'user', content: message },
            ],
            max_tokens: 150,
          }),
        })

        const data = await response.json()
        return data.choices?.[0]?.message?.content || 'Sorry, I could not respond.'
      } catch (error) {
        console.error('AI API error:', error)
        return this.getFallbackResponse()
      }
    }

    return this.getFallbackResponse()
  }

  private getFallbackResponse(): string {
    const responses = [
      "That's a great question! I think you should consider...",
      "Interesting point! Here's my perspective on that...",
      "I'd be happy to help with that. Let me think about it...",
      "From my understanding, the best approach would be...",
      "That's a complex topic. Let me break it down for you...",
    ]
    return responses[Math.floor(Math.random() * responses.length)] + ' (Simulated AI)'
  }
}