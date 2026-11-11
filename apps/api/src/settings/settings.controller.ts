import { Body, Controller, Delete, Get, Param, Put } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  checklistItemConfigSchema,
  promptTemplateSchema,
  type ChecklistItemConfig,
  type PromptTemplate,
} from "@repo/shared";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { SettingsService } from "./settings.service.js";

@ApiTags("settings")
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("prompt-templates")
  @ApiOperation({ summary: "List global system prompt templates" })
  listPromptTemplates() {
    return this.settingsService.listPromptTemplates();
  }

  @Put("prompt-templates")
  @ApiOperation({ summary: "Create or update a global prompt template" })
  savePromptTemplate(
    @Body(new ZodValidationPipe(promptTemplateSchema))
    body: PromptTemplate
  ) {
    return this.settingsService.savePromptTemplate(body);
  }

  @Delete("prompt-templates/:id")
  @ApiOperation({ summary: "Delete a global prompt template" })
  deletePromptTemplate(@Param("id") id: string) {
    return this.settingsService.deletePromptTemplate(id);
  }

  @Get("checklist-items")
  @ApiOperation({ summary: "List global feature checklist items" })
  listChecklistItems() {
    return this.settingsService.listChecklistItems();
  }

  @Put("checklist-items")
  @ApiOperation({ summary: "Create or update a global checklist item" })
  saveChecklistItem(
    @Body(new ZodValidationPipe(checklistItemConfigSchema))
    body: ChecklistItemConfig
  ) {
    return this.settingsService.saveChecklistItem(body);
  }

  @Delete("checklist-items/:id")
  @ApiOperation({ summary: "Delete a global checklist item" })
  deleteChecklistItem(@Param("id") id: string) {
    return this.settingsService.deleteChecklistItem(id);
  }
}
