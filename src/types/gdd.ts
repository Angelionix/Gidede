// ============================================================
// GDD Generator — TypeScript types (mirrors backend schemas)
// ============================================================

import type { AlgorithmMetadata } from "@/lib/algorithm-metadata";

export interface GDDFormatSpec {
  format: string; // one_sheet | ten_pager | treatment | sketch_design | full_gdd | concept_doc | narrative_bible | modular
  detail_level: string; // overview | standard | detailed | exhaustive
  sections: string[];
  estimated_pages: number;
  audience?: string;
  export_formats: string[];
}

export interface SectionMapping {
  source: string;
  auto_fill: boolean;
  ai_enrich: boolean;
  ai_generate: boolean;
  ai_suggest: boolean;
  manual: boolean;
  diagram: boolean;
  tables: boolean;
  formulas: boolean;
}

export interface SectionReadiness {
  status: "ready" | "ai_generatable" | "ai_suggestable" | "manual_required";
  coverage: number;
  auto_fillable: boolean;
}

export interface SectionContent {
  content: string;
  source: string; // auto_fill | ai_generate | ai_enrich | manual | merged
  auto_filled: boolean;
  diagram?: string;
  tables?: Record<string, unknown>[];
  formulas?: string[];
  requires_review: boolean;
}

export interface ConsistencyIssue {
  severity: "error" | "warning" | "info";
  section_a: string;
  section_b: string;
  issue_type: string;
  description: string;
  suggestion: string;
}

export interface ConsistencyReport {
  issues: ConsistencyIssue[];
  error_count: number;
  warning_count: number;
  info_count: number;
  is_valid: boolean;
}

export interface GDDAssembledSection {
  section_name: string;
  content: string;
  source: string;
  has_diagram: boolean;
  has_tables: boolean;
  has_formulas: boolean;
  requires_review: boolean;
}

export interface GDDAssembledDocument {
  sections: Record<string, GDDAssembledSection>;
  section_order: string[];
  consistency_report: ConsistencyReport;
  total_sections: number;
  filled_sections: number;
  coverage_score: number;
}

export interface GDDFormattedDocument {
  markdown: string;
  title: string;
  table_of_contents: string;
  section_count: number;
  word_count: number;
  estimated_pages: number;
}

export interface GDDProfile {
  format_spec: GDDFormatSpec;
  data_mapping?: {
    active_mappings: Record<string, SectionMapping>;
    section_readiness: Record<string, SectionReadiness>;
    auto_fillable_sections: string[];
    manual_sections: string[];
    ai_generatable_sections: string[];
    coverage_score: number;
  };
  auto_filled_sections?: {
    sections: Record<string, SectionContent>;
    count: number;
    total_coverage: number;
  };
  ai_enriched_sections?: {
    enriched_sections: Record<string, SectionContent>;
    generated_sections: Record<string, SectionContent>;
    enriched_count: number;
    generated_count: number;
    failed_sections: string[];
    total_coverage: number;
  };
  manual_skeletons?: {
    skeletons: Record<string, {
      section_name: string;
      priority: "critical" | "important" | "optional";
      template: string;
      hints: string[];
      estimated_effort: string;
    }>;
    critical_sections: string[];
    important_sections: string[];
    optional_sections: string[];
    total_manual_count: number;
  };
  assembled_document?: GDDAssembledDocument;
  formatted_document?: GDDFormattedDocument;
  algorithm_metadata: AlgorithmMetadata;
  stages_completed: number[];
  coverage_score: number;
  latency_ms: number;
}

export interface GDDGenerationRequest {
  target_format?: string;
  target_audience_doc?: string;
  detail_level?: string;
  project_stage?: string;
  custom_sections?: string[];
  excluded_sections?: string[];
  language?: string;
}

export interface ChecklistValidationProfile {
  scope: {
    active_checklists: string[];
    depth: string;
    estimated_checks: number;
  };
  mda_check?: {
    skipped: boolean;
    issues: Array<{ severity: string; issue_type: string; description: string; suggestion: string }>;
    overall_mda_score: number;
  };
  balance_check?: {
    skipped: boolean;
    issues: Array<{ severity: string; issue_type: string; description: string; suggestion: string }>;
    overall_balance_score: number;
  };
  narrative_check?: {
    skipped: boolean;
    issues: Array<{ severity: string; issue_type: string; description: string; suggestion: string }>;
    overall_narrative_score: number;
  };
  economy_check?: {
    skipped: boolean;
    issues: Array<{ severity: string; issue_type: string; description: string; suggestion: string }>;
  };
  lens_check?: {
    skipped: boolean;
    issues: Array<{ severity: string; issue_type: string; description: string; suggestion: string }>;
  };
  summary?: {
    overall_score: number;
    readiness: string; // ready | almost | not_ready
    top_5_issues: Array<{ severity: string; issue_type: string; description: string }>;
    quick_wins: Array<{ description: string; effort: string }>;
  };
  algorithm_metadata: AlgorithmMetadata;
  stages_completed: number[];
  latency_ms: number;
}

export interface GDDExportResponse {
  format: string;
  content: string; // base64 encoded
  filename: string;
  mime_type: string;
  size_bytes: number;
}
