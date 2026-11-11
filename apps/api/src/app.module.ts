import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ChatModule } from "./chat/chat.module";
import { ChecklistModule } from "./checklist/checklist.module";
import { validateEnv } from "./config/env";
import { ContextsModule } from "./contexts/contexts.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProjectsModule } from "./projects/projects.module";
import { ScraperModule } from "./scraper/scraper.module";
import { SettingsModule } from "./settings/settings.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: [".env", "../../.env"],
    }),
    PrismaModule,
    HealthModule,
    ProjectsModule,
    ContextsModule,
    ChatModule,
    ChecklistModule,
    SettingsModule,
    ScraperModule,
  ],
})
export class AppModule {}
