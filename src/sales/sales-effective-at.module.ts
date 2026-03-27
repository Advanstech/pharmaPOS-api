import { Global, Module } from '@nestjs/common';
import { SalesEffectiveAtService } from './sales-effective-at.service';

@Global()
@Module({
  providers: [SalesEffectiveAtService],
  exports: [SalesEffectiveAtService],
})
export class SalesEffectiveAtModule {}
