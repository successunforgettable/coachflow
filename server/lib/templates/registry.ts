// server/lib/templates/registry.ts
import type { TemplateConfig, TemplateStyleId } from "./types";
import { ENERGETIC } from "./energetic";

const TEMPLATES: Record<TemplateStyleId, TemplateConfig> = {
  energetic: ENERGETIC,
  // Sprint 2 additions:
  executive: ENERGETIC,  // placeholder — will be replaced with real config
  clinical: ENERGETIC,   // placeholder
  warm: ENERGETIC,       // placeholder
  bold: ENERGETIC,       // placeholder
};

export function getTemplate(id: TemplateStyleId): TemplateConfig {
  return TEMPLATES[id];
}

export function isTemplateStyleId(s: string): s is TemplateStyleId {
  return s in TEMPLATES;
}

export { TEMPLATES };
