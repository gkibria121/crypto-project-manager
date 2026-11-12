import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  activateAiProviderDtoSchema,
  aiProviderSchema,
  checklistItemConfigSchema,
  promptTemplateSchema,
  updateAgencyProfileDtoSchema,
  updateAiProviderConfigDtoSchema,
  type ActivateAiProviderDto,
  type ChecklistItemConfig,
  type PromptTemplate,
  type UpdateAgencyProfileDto,
  type UpdateAiProviderConfigDto,
} from "@repo/shared";
import {
  CurrentUser,
  RequirePermissions,
  type AuthenticatedUser,
} from "../auth/auth.decorators.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { AiProvidersService } from "./ai-providers.service.js";
import { SettingsService } from "./settings.service.js";

@ApiTags("settings")
@ApiBearerAuth()
@Controller("settings")
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly aiProvidersService: AiProvidersService
  ) {}

  @Get("prompt-templates")
  @RequirePermissions("settings:read")
  @ApiOperation({ summary: "List global system prompt templates" })
  listPromptTemplates() {
    return this.settingsService.listPromptTemplates();
  }

  @Put("prompt-templates")
  @RequirePermissions("settings:write")
  @ApiOperation({ summary: "Create or update a global prompt template" })
  savePromptTemplate(
    @Body(new ZodValidationPipe(promptTemplateSchema))
    body: PromptTemplate
  ) {
    return this.settingsService.savePromptTemplate(body);
  }

  @Delete("prompt-templates/:id")
  @RequirePermissions("settings:write")
  @ApiOperation({ summary: "Delete a global prompt template" })
  deletePromptTemplate(@Param("id") id: string) {
    return this.settingsService.deletePromptTemplate(id);
  }

  @Get("checklist-items")
  @RequirePermissions("settings:read")
  @ApiOperation({ summary: "List global feature checklist items" })
  listChecklistItems() {
    return this.settingsService.listChecklistItems();
  }

  @Put("checklist-items")
  @RequirePermissions("settings:write")
  @ApiOperation({ summary: "Create or update a global checklist item" })
  saveChecklistItem(
    @Body(new ZodValidationPipe(checklistItemConfigSchema))
    body: ChecklistItemConfig
  ) {
    return this.settingsService.saveChecklistItem(body);
  }

  @Delete("checklist-items/:id")
  @RequirePermissions("settings:write")
  @ApiOperation({ summary: "Delete a global checklist item" })
  deleteChecklistItem(@Param("id") id: string) {
    return this.settingsService.deleteChecklistItem(id);
  }

  @Get("about-us")
  @RequirePermissions("settings:read")
  @ApiOperation({
    summary:
      "Fetch our agency profile (company details, address, and representative info)",
  })
  getAgencyProfile() {
    return this.settingsService.getAgencyProfile();
  }

  @Put("about-us")
  @RequirePermissions("settings:write")
  @ApiOperation({
    summary:
      "Save or update our agency profile (company details, address, and representative info)",
  })
  saveAgencyProfile(
    @Body(new ZodValidationPipe(updateAgencyProfileDtoSchema))
    body: UpdateAgencyProfileDto,
    @CurrentUser() user: AuthenticatedUser | undefined
  ) {
    return this.settingsService.saveAgencyProfile(body, user);
  }

  @Get("ai-providers")
  @RequirePermissions("settings:read")
  @ApiOperation({
    summary:
      "List AI provider statuses, selected models, and active provider (API keys masked)",
  })
  listAiProviders() {
    return this.aiProvidersService.listProviderConfiguration();
  }

  @Get("ai-providers/:provider/models")
  @RequirePermissions("settings:read")
  @ApiOperation({
    summary: "List available models for an AI provider (live when key configured)",
  })
  listAiProviderModels(@Param("provider") providerParam: string) {
    const parsed = aiProviderSchema.safeParse(providerParam);
    if (!parsed.success) {
      throw new BadRequestException(
        `Unsupported AI provider "${providerParam}". Expected: google, openai, anthropic, groq, openrouter.`
      );
    }
    return this.aiProvidersService.listProviderModels(parsed.data);
  }

  @Put("ai-providers/:provider")
  @RequirePermissions("settings:write")
  @ApiOperation({
    summary:
      "Save or update an encrypted AI provider API key, selected model, or active status",
  })
  saveAiProviderConfig(
    @Param("provider") providerParam: string,
    @Body(new ZodValidationPipe(updateAiProviderConfigDtoSchema))
    body: UpdateAiProviderConfigDto,
    @CurrentUser() user: AuthenticatedUser | undefined
  ) {
    const parsed = aiProviderSchema.safeParse(providerParam);
    if (!parsed.success) {
      throw new BadRequestException(
        `Unsupported AI provider "${providerParam}". Expected: google, openai, anthropic, groq, openrouter.`
      );
    }
    return this.aiProvidersService.saveProviderConfig(parsed.data, body, user);
  }

  @Put("ai-providers/:provider/activate")
  @RequirePermissions("settings:write")
  @ApiOperation({
    summary: "Set an AI provider (and optional model) as active for chat",
  })
  activateAiProvider(
    @Param("provider") providerParam: string,
    @Body(new ZodValidationPipe(activateAiProviderDtoSchema))
    body: ActivateAiProviderDto,
    @CurrentUser() user: AuthenticatedUser | undefined
  ) {
    const parsed = aiProviderSchema.safeParse(providerParam);
    if (!parsed.success) {
      throw new BadRequestException(
        `Unsupported AI provider "${providerParam}". Expected: google, openai, anthropic, groq, openrouter.`
      );
    }
    return this.aiProvidersService.activateProvider(parsed.data, body, user);
  }

  @Delete("ai-providers/:provider")
  @RequirePermissions("settings:write")
  @ApiOperation({
    summary: "Remove workspace override API key for an AI provider",
  })
  deleteAiProviderKey(
    @Param("provider") providerParam: string,
    @CurrentUser() user: AuthenticatedUser | undefined
  ) {
    const parsed = aiProviderSchema.safeParse(providerParam);
    if (!parsed.success) {
      throw new BadRequestException(
        `Unsupported AI provider "${providerParam}". Expected: google, openai, anthropic, groq, openrouter.`
      );
    }
    return this.aiProvidersService.deleteProviderKey(parsed.data, user);
  }
}
