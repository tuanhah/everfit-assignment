import { Controller, Get, Query } from '@nestjs/common';
import { RecordsQueryDto } from './dto/records-query.dto';
import { RecordsService } from './records.service';

/**
 * Resource style is consistent across the API: top-level resources
 * (/workouts, /records) with userId always passed as a parameter —
 * matching the assignment's "pass userId as a parameter".
 */
@Controller('records')
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Get()
  async getRecords(@Query() query: RecordsQueryDto) {
    return { data: await this.recordsService.getRecords(query) };
  }
}
