import { Module } from '@nestjs/common';
import { UnitConverterRegistry } from './unit-converter.registry';

@Module({
  providers: [UnitConverterRegistry],
  exports: [UnitConverterRegistry],
})
export class UnitsModule {}
