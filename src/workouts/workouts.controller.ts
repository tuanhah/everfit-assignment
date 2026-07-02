import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { HistoryQueryDto } from './dto/history-query.dto';
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

  @Get()
  getHistory(@Query() query: HistoryQueryDto) {
    return this.workoutsService.getHistory(query);
  }
}
