import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthMiddleware } from './auth.middleware';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, AuthMiddleware],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
