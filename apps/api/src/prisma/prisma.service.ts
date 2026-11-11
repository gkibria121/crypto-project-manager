import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { createDbClient, type PulseDbClient } from "@repo/database";

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly db: PulseDbClient = createDbClient();

  async onModuleInit() {
    try {
      await this.db.connect();
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "DRIVER.ALREADY_CONNECTED"
      ) {
        return;
      }
      throw error;
    }
    this.logger.log("Connected to PostgreSQL via Prisma 8");
  }

  async onModuleDestroy() {
    await this.db.close();
    this.logger.log("Disconnected from PostgreSQL");
  }
}
