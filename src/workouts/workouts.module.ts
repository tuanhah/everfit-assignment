import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExercisesModule } from '../exercises/exercises.module';
import { UnitsModule } from '../units/units.module';
import { WorkoutEntry } from './workout-entry.entity';
import { WorkoutSet } from './set.entity';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkoutEntry, WorkoutSet]),
    UnitsModule,
    ExercisesModule,
  ],
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
})
export class WorkoutsModule {}
