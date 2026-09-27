import type {
  SearchProvider,
  SearchResult,
  SearchOptions,
  BusinessSearchProvider,
  BusinessSearchResult,
  BusinessSearchOptions,
  WebFetcher,
  WebPageContent,
  FetchOptions,
  WebsiteAuditor,
  WebsiteAuditResult,
  AuditOptions,
  ResearchProvider,
  ResearchCategory,
  ResearchOptions,
  ResearchResult,
  ResearchEnrichInput,
  ResearchEnrichResult,
} from "./types";

export class NoOpSearchProvider implements SearchProvider {
  name = "noop";

  async search(_query: string, _options?: SearchOptions): Promise<SearchResult[]> {
    return [{
      title: "Search provider not connected",
      url: "",
      snippet: "Configure a search provider (SerpAPI, Google Custom Search, Bing) to enable web search.",
      source: "system",
      metadata: { provider: this.name },
    }];
  }

  getSupportedSources(): string[] {
    return ["system"];
  }
}

export class NoOpBusinessSearchProvider implements BusinessSearchProvider {
  name = "noop";

  async searchBusinesses(_query: string, _options?: BusinessSearchOptions): Promise<BusinessSearchResult[]> {
    return [{
      name: "Business search provider not connected",
      sourceUrl: "",
      source: "system",
      metadata: { provider: this.name },
    }];
  }

  getSupportedCategories(): string[] {
    return ["system"];
  }
}

export class NoOpWebFetcher implements WebFetcher {
  name = "noop";

  async fetch(_url: string, _options?: FetchOptions): Promise<WebPageContent> {
    return {
      url: _url,
      title: "Web fetcher not connected",
      html: "",
      text: "Configure a web fetcher (Puppeteer, Playwright, Cheerio) to enable website fetching.",
      links: [],
      meta: {},
      fetchedAt: Date.now(),
      statusCode: 0,
    };
  }

  async fetchMultiple(urls: string[], _options?: FetchOptions): Promise<WebPageContent[]> {
    const results = await Promise.all(urls.map((url) => this.fetch(url)));
    return results;
  }

  isAllowed(_url: string): boolean {
    return true;
  }

  getRateLimit(): { requestsPerMinute: number; concurrent: number } {
    return { requestsPerMinute: 0, concurrent: 0 };
  }
}

export class NoOpWebsiteAuditor implements WebsiteAuditor {
  name = "noop";

  async audit(_url: string, _options?: AuditOptions): Promise<WebsiteAuditResult> {
    return {
      url: _url,
      auditedAt: Date.now(),
      checks: [{
        id: "provider_not_connected",
        category: "technical",
        name: "Website Auditor Provider",
        passed: false,
        severity: "critical",
        message: "Website auditor provider not connected. Configure Puppeteer/Playwright to enable website auditing.",
        details: { provider: this.name },
      }],
      summary: {
        totalChecks: 1,
        passed: 0,
        failed: 1,
        critical: 1,
        high: 0,
        medium: 0,
        low: 0,
        score: 0,
      },
      technology: [],
      performance: null,
    };
  }

  getSupportedChecks(): string[] {
    return ["provider_not_connected"];
  }
}

export class NoOpResearchProvider implements ResearchProvider {
  name = "noop";
  category = "company_discovery" as ResearchCategory;

  async search(_query: string, _options?: ResearchOptions): Promise<ResearchResult[]> {
    return [{
      id: `noop_${Date.now()}`,
      type: "company_discovery",
      title: "Research provider not connected",
      data: { message: "Configure a research provider (SerpAPI, Google Custom Search, etc.) to enable research." },
      source: "system",
      confidence: 0,
      fetchedAt: Date.now(),
    }];
  }

  async enrich(_data: ResearchEnrichInput): Promise<ResearchEnrichResult> {
    return {
      companyName: "Unknown",
      confidence: 0,
      sources: ["system"],
    };
  }

  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    return {
      valid: false,
      errors: ["No research provider configured. Set RESEARCH_PROVIDER and required API keys."],
    };
  }
}

export function createSearchProvider(): SearchProvider {
  const provider = process.env.SEARCH_PROVIDER?.toLowerCase() ?? "noop";
  switch (provider) {
    case "serpapi":
      // return new SerpApiProvider();
      return new NoOpSearchProvider();
    case "google":
      // return new GoogleCustomSearchProvider();
      return new NoOpSearchProvider();
    case "bing":
      // return new BingSearchProvider();
      return new NoOpSearchProvider();
    default:
      return new NoOpSearchProvider();
  }
}

export function createBusinessSearchProvider(): BusinessSearchProvider {
  const provider = process.env.BUSINESS_SEARCH_PROVIDER?.toLowerCase() ?? "noop";
  switch (provider) {
    case "google_places":
      // return new GooglePlacesProvider();
      return new NoOpBusinessSearchProvider();
    case "yelp":
      // return new YelpProvider();
      return new NoOpBusinessSearchProvider();
    default:
      return new NoOpBusinessSearchProvider();
  }
}

export function createWebFetcher(): WebFetcher {
  const provider = process.env.WEB_FETCHER_PROVIDER?.toLowerCase() ?? "noop";
  switch (provider) {
    case "puppeteer":
      // return new PuppeteerFetcher();
      return new NoOpWebFetcher();
    case "playwright":
      // return new PlaywrightFetcher();
      return new NoOpWebFetcher();
    case "cheerio":
      // return new CheerioFetcher();
      return new NoOpWebFetcher();
    default:
      return new NoOpWebFetcher();
  }
}

export function createWebsiteAuditor(): WebsiteAuditor {
  const provider = process.env.WEBSITE_AUDITOR_PROVIDER?.toLowerCase() ?? "noop";
  switch (provider) {
    case "puppeteer":
      // return new PuppeteerAuditor();
      return new NoOpWebsiteAuditor();
    case "playwright":
      // return new PlaywrightAuditor();
      return new NoOpWebsiteAuditor();
    case "lighthouse":
      // return new LighthouseAuditor();
      return new NoOpWebsiteAuditor();
    default:
      return new NoOpWebsiteAuditor();
  }
}

export function createResearchProvider(_category: string): ResearchProvider {
  const provider = process.env.RESEARCH_PROVIDER?.toLowerCase() ?? "noop";
  switch (provider) {
    case "serpapi":
      // return new SerpApiResearchProvider();
      return new NoOpResearchProvider();
    case "google":
      // return new GoogleResearchProvider();
      return new NoOpResearchProvider();
    case "linkedin":
      // return new LinkedInResearchProvider();
      return new NoOpResearchProvider();
    default:
      return new NoOpResearchProvider();
  }
}