import { Module } from '@nestjs/common';
import { UsersAdminService } from './users-admin.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersAdminService],
})
export class UsersModule {}
