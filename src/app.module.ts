import { Module } from '@nestjs/common';
import { CarouselModule } from './carousel/carousel.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [CarouselModule, AuthModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
