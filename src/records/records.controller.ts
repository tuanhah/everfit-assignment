import { Controller, Get, Param, Query } from '@nestjs/common';
import { RecordsQueryDto } from './dto/records-query.dto';
import { RecordsService } from './records.service';

@Controller('users/:userId/records')
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Get()
  async getRecords(
    @Param('userId') userId: string,
    @Query() query: RecordsQueryDto,
  ) {
    return { data: await this.recordsService.getRecords(userId, query) };
  }
}
