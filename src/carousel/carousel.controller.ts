import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { CarouselItem, CarouselService } from './carousel.service';
import type { Request } from 'express';

@Controller('api/carousel')
export class CarouselController {
  constructor(
    private readonly carouselService: CarouselService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  getItems(@Req() req: Request): Promise<CarouselItem[]> {
    const session = this.auth.getSessionFromRequest(req);
    return this.carouselService.getItems({ username: session?.username });
  }
}
