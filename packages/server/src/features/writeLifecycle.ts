import crypto from "node:crypto";

const PREVIEW_TOKEN_TTL_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

export interface PreviewTokenContext {
  workflow?: string;
  fingerprint?: string;
}

export interface PreviewTokenRecord extends PreviewTokenContext {
  expiresAt: number;
  used: boolean;
}

export interface GeneratedPreviewToken {
  token: string;
  expiresAt: Date;
}

export type PreviewTokenStatus = "missing" | "expired" | "consumed" | "active";

const previewTokens = new Map<string, PreviewTokenRecord>();
let cleanupTimer: NodeJS.Timeout | null = null;

function ensureCleanupTimer() {
  if (cleanupTimer) {
    return;
  }

  cleanupTimer = setInterval(() => {
    cleanupExpiredPreviewTokens();
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
}

function cleanupExpiredPreviewTokens(now = Date.now()) {
  for (const [token, record] of previewTokens.entries()) {
    if (record.expiresAt <= now) {
      previewTokens.delete(token);
    }
  }
}

function matchesContext(record: PreviewTokenRecord, context?: PreviewTokenContext): boolean {
  if (!context) {
    return true;
  }

  if (context.workflow && record.workflow && record.workflow !== context.workflow) {
    return false;
  }

  if (context.fingerprint && record.fingerprint && record.fingerprint !== context.fingerprint) {
    return false;
  }

  return true;
}

export function generatePreviewToken(
  context: PreviewTokenContext = {},
  ttlMs = PREVIEW_TOKEN_TTL_MS,
): GeneratedPreviewToken {
  ensureCleanupTimer();

  const token = crypto.randomUUID();
  const expiresAt = Date.now() + ttlMs;

  previewTokens.set(token, {
    workflow: context.workflow,
    fingerprint: context.fingerprint,
    expiresAt,
    used: false,
  });

  return {
    token,
    expiresAt: new Date(expiresAt),
  };
}

export function getPreviewTokenStatus(
  token: string,
  context?: PreviewTokenContext,
  now = Date.now(),
): PreviewTokenStatus {
  const record = previewTokens.get(token);
  if (!record || !matchesContext(record, context)) {
    return "missing";
  }

  if (record.expiresAt <= now) {
    return "expired";
  }

  if (record.used) {
    return "consumed";
  }

  return "active";
}

export function validatePreviewToken(
  token: string,
  context?: PreviewTokenContext,
): boolean {
  return getPreviewTokenStatus(token, context) === "active";
}

export function consumePreviewToken(
  token: string,
  context?: PreviewTokenContext,
): boolean {
  const record = previewTokens.get(token);
  if (!record || !matchesContext(record, context) || record.expiresAt <= Date.now() || record.used) {
    return false;
  }

  record.used = true;
  previewTokens.set(token, record);
  return true;
}

export function clearPreviewTokensForTests() {
  previewTokens.clear();
}
