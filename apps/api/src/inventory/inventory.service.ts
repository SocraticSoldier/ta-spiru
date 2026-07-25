import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Product, Role, StockMovementKind } from '@ta-spiru/database';
import { StockLevelRow } from '@ta-spiru/shared';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { PrismaService } from '../prisma/prisma.service';
import {
  BackBarUseDto,
  LevelsQueryDto,
  StockAdjustDto,
  ProductReturnDto,
  StockIntakeDto,
  StockTransferDto,
} from './dto/inventory.dtos';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async intake(dto: StockIntakeDto, actor: AuthenticatedUser): Promise<StockLevelRow> {
    try {
      const product = await this.resolveProduct(dto.productId, dto.barcode);
      const level = await this.prisma.$transaction(async (tx) => {
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            locationId: dto.locationId,
            kind: StockMovementKind.INTAKE,
            quantityDelta: dto.quantity,
            reference: dto.reference ?? null,
            performedById: actor.id,
          },
        });
        return tx.stockLevel.upsert({
          where: { productId_locationId: { productId: product.id, locationId: dto.locationId } },
          update: { quantity: { increment: dto.quantity } },
          create: { productId: product.id, locationId: dto.locationId, quantity: dto.quantity },
          include: { location: { select: { name: true } } },
        });
      });
      return this.toRow(product, level.locationId, level.location.name, level.quantity, level.reorderThreshold);
    } catch (error) {
      throw this.wrap(error, 'Stock intake failed');
    }
  }

  async transfer(dto: StockTransferDto, actor: AuthenticatedUser): Promise<StockLevelRow[]> {
    if (dto.fromLocationId === dto.toLocationId) {
      throw new BadRequestException('fromLocationId and toLocationId must differ');
    }
    if (actor.role === Role.MANAGER && actor.locationId !== dto.fromLocationId) {
      throw new ForbiddenException('Managers can only transfer stock out of their own branch');
    }
    try {
      const product = await this.resolveProduct(dto.productId, undefined);
      const batchReference = `transfer:${randomUUID()}`;

      const [fromLevel, toLevel] = await this.prisma.$transaction(
        async (tx) => {
          const source = await tx.stockLevel.findUnique({
            where: {
              productId_locationId: { productId: product.id, locationId: dto.fromLocationId },
            },
          });
          if (!source || source.quantity < dto.quantity) {
            throw new ConflictException(
              `Insufficient stock at source branch (have ${source?.quantity ?? 0}, need ${dto.quantity})`,
            );
          }

          const updatedSource = await tx.stockLevel.update({
            where: {
              productId_locationId: { productId: product.id, locationId: dto.fromLocationId },
            },
            data: { quantity: { decrement: dto.quantity } },
            include: { location: { select: { name: true } } },
          });
          const updatedTarget = await tx.stockLevel.upsert({
            where: {
              productId_locationId: { productId: product.id, locationId: dto.toLocationId },
            },
            update: { quantity: { increment: dto.quantity } },
            create: { productId: product.id, locationId: dto.toLocationId, quantity: dto.quantity },
            include: { location: { select: { name: true } } },
          });

          await tx.stockMovement.createMany({
            data: [
              {
                productId: product.id,
                locationId: dto.fromLocationId,
                kind: StockMovementKind.TRANSFER_OUT,
                quantityDelta: -dto.quantity,
                reference: batchReference,
                performedById: actor.id,
              },
              {
                productId: product.id,
                locationId: dto.toLocationId,
                kind: StockMovementKind.TRANSFER_IN,
                quantityDelta: dto.quantity,
                reference: batchReference,
                performedById: actor.id,
              },
            ],
          });

          return [updatedSource, updatedTarget] as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return [
        this.toRow(product, fromLevel.locationId, fromLevel.location.name, fromLevel.quantity, fromLevel.reorderThreshold),
        this.toRow(product, toLevel.locationId, toLevel.location.name, toLevel.quantity, toLevel.reorderThreshold),
      ];
    } catch (error) {
      throw this.wrap(error, 'Stock transfer failed');
    }
  }

  async adjust(dto: StockAdjustDto, actor: AuthenticatedUser): Promise<StockLevelRow> {
    try {
      const product = await this.resolveProduct(dto.productId, undefined);
      const level = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.stockLevel.upsert({
          where: { productId_locationId: { productId: product.id, locationId: dto.locationId } },
          update: { quantity: { increment: dto.quantityDelta } },
          create: {
            productId: product.id,
            locationId: dto.locationId,
            quantity: dto.quantityDelta,
          },
          include: { location: { select: { name: true } } },
        });
        if (updated.quantity < 0) {
          throw new ConflictException('Adjustment would drive stock negative');
        }
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            locationId: dto.locationId,
            kind: StockMovementKind.ADJUSTMENT,
            quantityDelta: dto.quantityDelta,
            note: dto.reason,
            performedById: actor.id,
          },
        });
        return updated;
      });
      return this.toRow(product, level.locationId, level.location.name, level.quantity, level.reorderThreshold);
    } catch (error) {
      throw this.wrap(error, 'Stock adjustment failed');
    }
  }

  /** Back-bar consumption by barbers / wash attendants (own-branch usage, not a sale). */
  async backBarUse(dto: BackBarUseDto, actor: AuthenticatedUser): Promise<StockLevelRow> {
    if (actor.role !== Role.ADMIN && actor.locationId !== null && actor.locationId !== dto.locationId) {
      throw new ForbiddenException('Back-bar use must be recorded at your own branch');
    }
    try {
      const product = await this.resolveProduct(dto.productId, dto.barcode);
      const level = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.stockLevel.findUnique({
          where: { productId_locationId: { productId: product.id, locationId: dto.locationId } },
        });
        if (!existing || existing.quantity < dto.quantity) {
          throw new ConflictException(
            `Insufficient stock (have ${existing?.quantity ?? 0}, need ${dto.quantity})`,
          );
        }
        const updated = await tx.stockLevel.update({
          where: { productId_locationId: { productId: product.id, locationId: dto.locationId } },
          data: { quantity: { decrement: dto.quantity } },
          include: { location: { select: { name: true } } },
        });
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            locationId: dto.locationId,
            kind: StockMovementKind.BACK_BAR_USE,
            quantityDelta: -dto.quantity,
            note: dto.note ?? null,
            performedById: actor.id,
          },
        });
        return updated;
      });
      return this.toRow(product, level.locationId, level.location.name, level.quantity, level.reorderThreshold);
    } catch (error) {
      throw this.wrap(error, 'Recording back-bar use failed');
    }
  }

  /** Reception takes a product back: stock returns and the movement is logged. */
  async productReturn(dto: ProductReturnDto, actor: AuthenticatedUser): Promise<StockLevelRow> {
    if (actor.role !== Role.ADMIN && actor.locationId !== null && actor.locationId !== dto.locationId) {
      throw new ForbiddenException('Returns must be recorded at your own branch');
    }
    try {
      const product = await this.resolveProduct(dto.productId, dto.barcode);
      const level = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.stockLevel.upsert({
          where: { productId_locationId: { productId: product.id, locationId: dto.locationId } },
          update: { quantity: { increment: dto.quantity } },
          create: {
            productId: product.id,
            locationId: dto.locationId,
            quantity: dto.quantity,
            reorderThreshold: 6,
          },
          include: { location: { select: { name: true } } },
        });
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            locationId: dto.locationId,
            kind: StockMovementKind.RETURN,
            quantityDelta: dto.quantity,
            note: dto.reason ?? null,
            performedById: actor.id,
          },
        });
        return updated;
      });
      return this.toRow(product, level.locationId, level.location.name, level.quantity, level.reorderThreshold);
    } catch (error) {
      throw this.wrap(error, 'Recording the return failed');
    }
  }

  async levels(query: LevelsQueryDto): Promise<StockLevelRow[]> {
    try {
      const rows = await this.prisma.stockLevel.findMany({
        where: query.locationId ? { locationId: query.locationId } : undefined,
        include: {
          product: true,
          location: { select: { name: true } },
        },
        orderBy: [{ location: { name: 'asc' } }, { product: { name: 'asc' } }],
      });
      const mapped = rows.map((row) =>
        this.toRow(row.product, row.locationId, row.location.name, row.quantity, row.reorderThreshold),
      );
      return query.lowStockOnly === 'true' ? mapped.filter((row) => row.lowStock) : mapped;
    } catch (error) {
      throw this.wrap(error, 'Failed to list stock levels');
    }
  }

  /** Camera-scan lookup: product details plus its per-branch levels. */
  async byBarcode(barcode: string): Promise<{ product: Product; levels: StockLevelRow[] }> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { barcode },
        include: { stockLevels: { include: { location: { select: { name: true } } } } },
      });
      if (!product) {
        throw new NotFoundException(`No product with barcode ${barcode}`);
      }
      const { stockLevels, ...rest } = product;
      return {
        product: rest as Product,
        levels: stockLevels.map((level) =>
          this.toRow(rest as Product, level.locationId, level.location.name, level.quantity, level.reorderThreshold),
        ),
      };
    } catch (error) {
      throw this.wrap(error, 'Barcode lookup failed');
    }
  }

  private async resolveProduct(productId?: string, barcode?: string): Promise<Product> {
    if (!productId && !barcode) {
      throw new BadRequestException('Provide productId or barcode');
    }
    const product = await this.prisma.product.findFirst({
      where: productId ? { id: productId } : { barcode },
    });
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found or inactive');
    }
    return product;
  }

  private toRow(
    product: Product,
    locationId: string,
    locationName: string,
    quantity: number,
    reorderThreshold: number,
  ): StockLevelRow {
    return {
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      brand: product.brand,
      priceCents: product.priceCents,
      locationId,
      locationName,
      quantity,
      reorderThreshold,
      lowStock: quantity <= reorderThreshold,
    };
  }

  private wrap(error: unknown, fallback: string): HttpException {
    return error instanceof HttpException ? error : new InternalServerErrorException(fallback);
  }
}
