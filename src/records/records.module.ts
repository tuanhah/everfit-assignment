import { Module } from '@nestjs/common';
import { ExercisesModule } from '../exercises/exercises.module';
import { UnitsModule } from '../units/units.module';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';

@Module({
  imports: [UnitsModule, ExercisesModule],
  controllers: [RecordsController],
  providers: [RecordsService],
})
export class RecordsModule {}
