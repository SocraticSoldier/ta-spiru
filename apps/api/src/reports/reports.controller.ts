import { Controller, ForbiddenException, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { Role } from '@ta-spiru/database';
import { RevenueSplitReport } from '@ta-spiru/shared';
import { compareSync } from 'bcryptjs';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RevenueReportQueryDto } from './dto/revenue-report-query.dto';
import { ReportsService } from './reports.service';
import { SALES_HIDDEN_KEY, VAULT_CODE_KEY } from './vault.controller';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Monetary revenue is never shown without the vault code (x-vault-code), and
   * never while sales are wiped — the owner's hidden-sales rule applies here too.
   */
  @Get('revenue-splits')
  @Roles(Role.ADMIN)
  async revenueSplits(
    @Query() query: RevenueReportQueryDto,
    @Headers('x-vault-code') vaultCode?: string,
  ): Promise<RevenueSplitReport> {
    const [codeRow, hiddenRow] = await Promise.all([
      this.prisma.appSetting.findUnique({ where: { key: VAULT_CODE_KEY } }),
      this.prisma.appSetting.findUnique({ where: { key: SALES_HIDDEN_KEY } }),
    ]);
    if (!codeRow || !vaultCode || !compareSync(vaultCode, codeRow.value)) {
      throw new ForbiddenException('Monetary reports require the vault code');
    }
    if (hiddenRow?.value === 'true') {
      throw new ForbiddenException('Sales are wiped');
    }
    return this.reportsService.revenueSplits(query);
  }
}
