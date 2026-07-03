import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { HistoryQueryDto } from './dto/history-query.dto';
import { LogWorkoutDto } from './dto/log-workout.dto';
import { WorkoutsService } from './workouts.service';

@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Post()
  async logWorkout(@Body() dto: LogWorkoutDto) {
    // Envelope convention across all endpoints: `data` is the payload
    // itself (array for collections, object for a single resource);
    // metadata like pagination/message are siblings of `data`.
    return { data: await this.workoutsService.logWorkout(dto) };
  }

  @Get()
  getHistory(@Query() query: HistoryQueryDto) {
    return this.workoutsService.getHistory(query);
  }
}
