import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CarouselController } from './carousel.controller';
import { CarouselService } from './carousel.service';
import { ScreenshotService } from './screenshot.service';
import { CoverService } from './cover.service';

@Module({
  imports: [AuthModule],
  controllers: [CarouselController],
  providers: [CarouselService, ScreenshotService, CoverService],
  exports: [CoverService],
})
export class CarouselModule {}
