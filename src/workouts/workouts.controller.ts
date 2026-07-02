import { Body, Controller, Post } from '@nestjs/common';
import { LogWorkoutDto } from './dto/log-workout.dto';
import { WorkoutsService } from './workouts.service';

@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Post()
  async logWorkout(@Body() dto: LogWorkoutDto) {
    const entries = await this.workoutsService.logWorkout(dto);
    return { data: { entries } };
  }
}
