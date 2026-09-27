export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface SearchProvider {
  name: string;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getSupportedSources(): string[];
}

export interface SearchOptions {
  maxResults?: number;
  location?: string;
  language?: string;
  safeSearch?: boolean;
  recencyDays?: number;
}

export interface BusinessSearchResult {
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  sourceUrl: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface BusinessSearchProvider {
  name: string;
  searchBusinesses(query: string, options?: BusinessSearchOptions): Promise<BusinessSearchResult[]>;
  getSupportedCategories(): string[];
}

export interface BusinessSearchOptions {
  location?: string;
  radiusKm?: number;
  category?: string;
  maxResults?: number;
  minRating?: number;
  minReviewCount?: number;
}

export interface WebPageContent {
  url: string;
  title: string;
  html: string;
  text: string;
  links: string[];
  meta: Record<string, string>;
  fetchedAt: number;
  statusCode: number;
}

export interface WebFetcher {
  fetch(url: string, options?: FetchOptions): Promise<WebPageContent>;
  fetchMultiple(urls: string[], options?: FetchOptions): Promise<WebPageContent[]>;
  isAllowed(url: string): boolean;
  getRateLimit(): { requestsPerMinute: number; concurrent: number };
}

export interface FetchOptions {
  timeoutMs?: number;
  userAgent?: string;
  followRedirects?: boolean;
  maxSizeBytes?: number;
  renderJavaScript?: boolean;
  waitForSelector?: string;
}

export interface WebsiteAuditResult {
  url: string;
  auditedAt: number;
  checks: AuditCheck[];
  summary: AuditSummary;
  technology: TechnologyFingerprint[];
  performance: PerformanceMetrics | null;
}

export interface AuditCheck {
  id: string;
  category: "seo" | "performance" | "accessibility" | "security" | "content" | "technical" | "conversion";
  name: string;
  passed: boolean;
  severity: "critical" | "high" | "medium" | "low" | "info";
  message: string;
  details?: Record<string, unknown>;
  evidence?: string[];
}

export interface AuditSummary {
  totalChecks: number;
  passed: number;
  failed: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  score: number;
}

export interface TechnologyFingerprint {
  name: string;
  category: "cms" | "framework" | "analytics" | "marketing" | "security" | "hosting" | "cdn" | "other";
  confidence: number;
  version?: string;
  evidence: string[];
}

export interface PerformanceMetrics {
  loadTimeMs: number;
  ttfbMs: number;
  fcpMs: number | null;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  pageSizeBytes: number;
  requestCount: number;
}

export interface WebsiteAuditor {
  audit(url: string, options?: AuditOptions): Promise<WebsiteAuditResult>;
  getSupportedChecks(): string[];
}

export interface AuditOptions {
  checks?: string[];
  timeoutMs?: number;
  mobileViewport?: boolean;
  includePerformance?: boolean;
  includeTechnology?: boolean;
}

export const RESEARCH_CATEGORIES = [
  "company_discovery",
  "lead_generation",
  "market_research",
  "competitor_analysis",
  "website_audit",
  "contact_enrichment",
] as const;

export type ResearchCategory = typeof RESEARCH_CATEGORIES[number];

export interface ResearchProvider {
  name: string;
  category: ResearchCategory;
  search(query: string, options?: ResearchOptions): Promise<ResearchResult[]>;
  enrich(data: ResearchEnrichInput): Promise<ResearchEnrichResult>;
  validate(): Promise<{ valid: boolean; errors: string[] }>;
}

export interface ResearchOptions {
  maxResults?: number;
  location?: string;
  filters?: Record<string, unknown>;
}

export interface ResearchResult {
  id: string;
  type: ResearchCategory;
  title: string;
  url?: string;
  data: Record<string, unknown>;
  source: string;
  confidence: number;
  fetchedAt: number;
}

export interface ResearchEnrichInput {
  companyName?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface ResearchEnrichResult {
  companyName: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  socialProfiles?: Record<string, string>;
  employees?: number;
  revenue?: string;
  industry?: string;
  technologies?: string[];
  confidence: number;
  sources: string[];
}