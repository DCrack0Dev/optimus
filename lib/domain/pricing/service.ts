import { getAdminDb, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type { ServiceInterest, ProtectedPricing } from "@shared/types";

export interface PriceRangeResult {
  low: number;
  high: number;
  currency: "ZAR" | "USD";
  formatted: string;
}

function mapServiceToPricingSlug(service: ServiceInterest): string {
  const map: Record<ServiceInterest, string> = {
    WEBSITE: "website",
    WEB_APP: "webapp",
    MOBILE_APP: "mobile-app",
    SEO: "seo",
    BOOKING_SYSTEM: "booking-system",
    CRM_DASHBOARD: "crm-dashboard",
    ECOMMERCE: "ecommerce",
    CUSTOM: "custom",
  };
  return map[service] ?? "custom";
}

export async function suggestPublicRange(service: ServiceInterest, _brief: string): Promise<PriceRangeResult> {
  if (!isAdminConfigured()) {
    const defaults: Record<ServiceInterest, PriceRangeResult> = {
      WEBSITE: { low: 3500, high: 15000, currency: "ZAR", formatted: "R3,500 – R15,000" },
      WEB_APP: { low: 10000, high: 60000, currency: "ZAR", formatted: "R10,000 – R60,000" },
      MOBILE_APP: { low: 10000, high: 80000, currency: "ZAR", formatted: "R10,000 – R80,000" },
      SEO: { low: 2000, high: 8000, currency: "ZAR", formatted: "R2,000 – R8,000" },
      BOOKING_SYSTEM: { low: 8000, high: 30000, currency: "ZAR", formatted: "R8,000 – R30,000" },
      CRM_DASHBOARD: { low: 12000, high: 70000, currency: "ZAR", formatted: "R12,000 – R70,000" },
      ECOMMERCE: { low: 10000, high: 45000, currency: "ZAR", formatted: "R10,000 – R45,000" },
      CUSTOM: { low: 10000, high: 100000, currency: "ZAR", formatted: "R10,000 – R100,000" },
    };
    return defaults[service] ?? defaults.CUSTOM;
  }

  const db = getAdminDb();
  const slug = mapServiceToPricingSlug(service);
  const snap = await db.collection("protected_pricing").doc(`price_${slug}`).get();

  if (!snap.exists) {
    throw new Error(`Pricing not found for service: ${service}`);
  }

  const pricing = snap.data() as ProtectedPricing;
  const formatted = `${pricing.currency} ${(pricing.publicRangeLowCents / 100).toLocaleString()} – ${pricing.currency} ${(pricing.publicRangeHighCents / 100).toLocaleString()}`;

  return {
    low: pricing.publicRangeLowCents / 100,
    high: pricing.publicRangeHighCents / 100,
    currency: pricing.currency,
    formatted,
  };
}

export async function getProtectedPricingForAdmin(service: ServiceInterest): Promise<ProtectedPricing | null> {
  if (!isAdminConfigured()) return null;
  const db = getAdminDb();
  const slug = mapServiceToPricingSlug(service);
  const snap = await db.collection("protected_pricing").doc(`price_${slug}`).get();
  if (!snap.exists) return null;
  return snap.data() as ProtectedPricing;
}