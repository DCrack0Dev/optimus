const PROTECTED_PRICE_PATTERNS = [
  /\bR\s*\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?\b/g,
  /\bZAR\s*\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?\b/gi,
  /\b\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?\s*ZAR\b/gi,
];

const RANGE_PATTERN = /\bR\s*\?\s*[–-]\s*R\s*\?\b/gi;
const RANGE_WITH_NUMS = /\bR\s*\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?\s*[–-]\s*R\s*\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?\b/gi;

export function stripExactProtectedValues(text: string, _leadContext?: Record<string, unknown>): string {
  let result = text;

  // First, protect existing range patterns like "R? – R?" or "R10,000 – R30,000"
  const protectedRanges: string[] = [];
  result = result.replace(RANGE_WITH_NUMS, (match) => {
    protectedRanges.push(match);
    return `__PROTECTED_RANGE_${protectedRanges.length - 1}__`;
  });
  result = result.replace(RANGE_PATTERN, (match) => {
    protectedRanges.push(match);
    return `__PROTECTED_RANGE_${protectedRanges.length - 1}__`;
  });

  // Strip exact price mentions
  for (const pattern of PROTECTED_PRICE_PATTERNS) {
    result = result.replace(pattern, (match) => {
      // Don't strip if it looks like a range already
      if (RANGE_WITH_NUMS.test(match)) return match;
      return "[price range]";
    });
  }

  // Restore protected ranges
  for (let i = 0; i < protectedRanges.length; i++) {
    const replacement = protectedRanges[i];
    if (replacement !== undefined) {
      result = result.replace(new RegExp(`__PROTECTED_RANGE_${i}__`, "g"), replacement);
    }
  }

  return result;
}

export function ensureRangeFormat(text: string): string {
  // If text mentions price but doesn't have a range format, add disclaimer
  const hasPriceMention = /price|cost|quote|budget|pay|charge|fee|rate/i.test(text);
  const hasRange = RANGE_WITH_NUMS.test(text) || RANGE_PATTERN.test(text);
  
  if (hasPriceMention && !hasRange) {
    return `${text} (Exact pricing provided upon consultation — we'll share a tailored range)`;
  }
  return text;
}