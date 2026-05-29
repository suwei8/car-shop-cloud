import { Module } from '@nestjs/common';
import { StoredValueCardService } from './stored-value-card.service';
import { StoredValueCardController } from './stored-value-card.controller';

@Module({
  controllers: [StoredValueCardController],
  providers: [StoredValueCardService],
  exports: [StoredValueCardService],
})
export class StoredValueCardModule {}
