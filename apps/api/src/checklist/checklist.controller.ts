import { Body, Controller, Param, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  scanSingleChecklistDtoSchema,
  type ScanSingleChecklistDto,
} from "@repo/shared";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { ChecklistService } from "./checklist.service.js";

@ApiTags("checklist")
@Controller("projects/:projectId/checklist")
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Patch(":itemId/toggle")
  @ApiOperation({ summary: "Toggle checklist item state for a project" })
  toggleItem(
    @Param("projectId") projectId: string,
    @Param("itemId") itemId: string
  ) {
    return this.checklistService.toggleChecklistItem(projectId, itemId);
  }

  @Post("scan-all")
  @ApiOperation({
    summary: "Scan all global checklist items against project contexts & scraped signals",
  })
  scanAll(@Param("projectId") projectId: string) {
    return this.checklistService.scanAllChecklistItems(projectId);
  }

  @Post(":itemId/scan")
  @ApiOperation({ summary: "Scan a single checklist item in project chat" })
  scanSingle(
    @Param("projectId") projectId: string,
    @Param("itemId") itemId: string,
    @Body(new ZodValidationPipe(scanSingleChecklistDtoSchema))
    body: ScanSingleChecklistDto
  ) {
    return this.checklistService.scanSingleChecklistItem(
      projectId,
      itemId,
      body.item
    );
  }
}
