import { Module } from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { ReminderController } from './reminder.controller';
import { ReminderTaskService } from './reminder-task.service';

@Module({
  controllers: [ReminderController],
  providers: [ReminderService, ReminderTaskService],
  exports: [ReminderService],
})
export class ReminderModule {}
