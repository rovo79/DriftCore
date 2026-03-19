import type { MCPTool } from "../../types.js";

export { runUpgradeAssessment, type UpgradeAssessmentData, type UpgradeCandidate } from "./upgradeAssessment.js";
export { runConfigDriftAssessment, type ConfigDriftAssessmentData, type ConfigDriftChange } from "./configDriftAssessment.js";
export {
  runCacheRebuildPreview,
  runCacheRebuildApply,
  runCacheRebuildVerify,
  type CacheRebuildPreviewData,
  type CacheRebuildResultData,
  type CacheRebuildVerificationData,
  type CacheRebuildApplyInput,
} from "./cacheRebuild.js";
export {
  runModuleScaffoldPreview,
  runModuleScaffoldApply,
  runModuleScaffoldVerify,
  parseModuleScaffoldInput,
  type ModuleScaffoldInput,
  type ModuleScaffoldPreviewData,
  type ModuleScaffoldResultData,
  type ModuleScaffoldVerificationData,
  type ModuleScaffoldApplyInput,
} from "./moduleScaffold.js";
export {
  runConfigExportPreview,
  runConfigExportApply,
  runConfigExportVerify,
  type ConfigExportPreviewData,
  type ConfigExportResultData,
  type ConfigExportVerificationData,
  type ConfigExportApplyInput,
} from "./configExport.js";
export {
  runScaffoldPlanning,
  parseScaffoldPlanInput,
  type ScaffoldPlanData,
  type ScaffoldPlanFile,
  type ScaffoldPlanInput,
} from "./scaffoldPlanning.js";

export function getWorkflowTools(): MCPTool[] {
  return [
    {
      name: "drift.upgrade_assessment",
      description:
        "Inspects composer and Drupal manifest state and returns a structured upgrade assessment.",
      command: "drift upgrade-assessment",
      args: [],
      examples: ["/workflows/upgrade-assessment", "upgrade_assessment"],
    },
    {
      name: "drift.config_drift_assessment",
      description:
        "Inspects config sync layout and Drush config status to report pending configuration drift.",
      command: "drift config-drift-assessment",
      args: [],
      examples: ["/workflows/config-drift", "config_drift_assessment"],
    },
    {
      name: "drift.scaffold_plan",
      description:
        "Builds a read-only scaffold plan for a new custom Drupal module or theme.",
      command: "drift scaffold-plan",
      args: ["machine_name", "target_type"],
      examples: [
        "/workflows/scaffold-plan?machine_name=acme_blog&target_type=module",
        '{"action":"scaffold_plan","params":{"machine_name":"acme_blog","target_type":"module"}}',
      ],
    },
    {
      name: "drift.cache_rebuild",
      description:
        "Previews, applies, and verifies a cache rebuild using a short-lived preview token.",
      command: "drift cache-rebuild",
      args: [],
      examples: ["/workflows/cache-rebuild/preview", "cache_rebuild_preview"],
    },
    {
      name: "drift.module_scaffold",
      description:
        "Previews, applies, and verifies a minimal custom Drupal module scaffold.",
      command: "drift scaffold",
      args: ["machine_name", "target_type"],
      examples: [
        "/workflows/scaffold/preview?machine_name=acme_blog&target_type=module",
        "scaffold_preview",
      ],
    },
    {
      name: "drift.config_export",
      description:
        "Previews, applies, and verifies a Drupal config export into the sync directory.",
      command: "drift config-export",
      args: [],
      examples: ["/workflows/config-export/preview", "config_export_preview"],
    },
  ];
}
