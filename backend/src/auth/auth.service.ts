import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service.js'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(email: string, password: string, name?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) throw new UnauthorizedException('User already exists')

    const hashedPassword = bcrypt.hashSync(password, 10)
    const user = await this.prisma.user.create({
      data: { email, password: hashedPassword, name: name || email.split('@')[0] },
    })

    const token = this.jwtService.sign({ userId: user.id })
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user) throw new UnauthorizedException('Invalid credentials')

    const isValid = bcrypt.compareSync(password, user.password)
    if (!isValid) throw new UnauthorizedException('Invalid credentials')

    const token = this.jwtService.sign({ userId: user.id })
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } }
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } })
  }
}