import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module.js";
import { ChatModule } from "./chat/chat.module.js";
import { ChecklistModule } from "./checklist/checklist.module.js";
import { validateEnv } from "./config/env.js";
import { ContextsModule } from "./contexts/contexts.module.js";
import { HealthModule } from "./health/health.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { ScraperModule } from "./scraper/scraper.module.js";
import { SettingsModule } from "./settings/settings.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: [".env", "../../.env"],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
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
