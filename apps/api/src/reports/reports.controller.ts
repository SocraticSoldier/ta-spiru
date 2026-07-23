import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@ta-spiru/database';
import { RevenueSplitReport } from '@ta-spiru/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RevenueReportQueryDto } from './dto/revenue-report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue-splits')
  @Roles(Role.ADMIN)
  revenueSplits(@Query() query: RevenueReportQueryDto): Promise<RevenueSplitReport> {
    return this.reportsService.revenueSplits(query);
  }
}
