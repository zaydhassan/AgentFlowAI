import "server-only";
import type {
  ActionContext,
  ActionLogEvent,
  ActionResult,
} from "../../types";
import { GMAIL_API_BASE } from "./scopes";
import { base64UrlDecode, base64UrlEncode } from "./oauth";

export class GmailApiError extends Error {
  status: number;
  /** True when the access/refresh token is invalid/expired (401 / invalid_grant). */
  invalidGrant: boolean;
  constructor(message: string, status: number, invalidGrant = false) {
    super(message);
    this.name = "GmailApiError";
    this.status = status;
    this.invalidGrant = invalidGrant;
  }
}

interface GmailFetchOpts {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | string[] | undefined>;
  signal?: { stopped: () => boolean };
}

async function gmailFetch<T = Record<string, unknown>>(path: string, accessToken: string, opts: GmailFetchOpts = {}): Promise<T> {
  const url = new URL(`${GMAIL_API_BASE}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, String(item));
      } else {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  // 204 → no body (e.g. some trashes). Treat as empty success.
  if (res.status === 204) return {} as T;

  const text = await res.text();
  let json: Record<string, unknown> = {};
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { raw: text };
    }
  }
  if (!res.ok) {
    const err = json.error as GmailErrorBody | undefined;
    const msg = err?.message || err?.errors?.[0]?.message || `Gmail API ${res.status} ${res.statusText}`;
    const invalidGrant = res.status === 401 || err?.status === "UNAUTHENTICATED";
    throw new GmailApiError(msg, res.status, invalidGrant);
  }
  return json as T;
}

interface GmailHeader { name: string; value: string }
interface GmailPart {
  mimeType?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
}

/** Raw Gmail message shape — only the fields this integration reads. */
interface GmailMessageRaw {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  payload?: { headers?: GmailHeader[]; parts?: GmailPart[]; body?: { data?: string } };
}

/** Gmail API error body (from `{ "error": { ... } }`). */
interface GmailErrorBody {
  message?: string;
  status?: string;
  errors?: { message?: string }[];
}

function headerValue(headers: GmailHeader[] | undefined, name: string): string | null {
  if (!headers) return null;
  const h = headers.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? null;
}

/** Recursively pull the first text/plain or text/html body from a message payload. */
function extractBody(payload: { parts?: GmailPart[]; body?: { data?: string }; mimeType?: string } | undefined): {
  text: string | null;
  html: string | null;
} {
  if (!payload) return { text: null, html: null };
  let text: string | null = null;
  let html: string | null = null;

  const walk = (part: GmailPart): void => {
    if (text && html) return;
    if (part.mimeType === "text/plain" && part.body?.data && !text) {
      text = base64UrlDecode(part.body.data).toString("utf8");
    } else if (part.mimeType === "text/html" && part.body?.data && !html) {
      html = base64UrlDecode(part.body.data).toString("utf8");
    } else if (part.parts) {
      for (const p of part.parts) {
        walk(p);
        if (text && html) break;
      }
    }
  };

  // Top-level body (simple messages have no parts).
  if (payload.body?.data && payload.mimeType === "text/plain" && !text) {
    text = base64UrlDecode(payload.body.data).toString("utf8");
  } else if (payload.body?.data && payload.mimeType === "text/html" && !html) {
    html = base64UrlDecode(payload.body.data).toString("utf8");
  } else if (payload.parts) {
    for (const p of payload.parts) walk(p);
  }
  return { text, html };
}

function buildRfc822(headers: Record<string, string | undefined>, body: string, html?: string): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined || v === "") continue;
    lines.push(`${k}: ${v.replace(/\r?\n/g, "\r\n")}`);
  }
  let content: string;
  if (html) {
    const boundary = `agentflow_${Math.random().toString(36).slice(2)}`;
    lines.push("MIME-Version: 1.0");
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push("", "");
    content = [
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      body || "",
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      html,
      "",
      `--${boundary}--`,
      "",
    ].join("\r\n");
  } else {
    lines.push("MIME-Version: 1.0");
    lines.push("Content-Type: text/plain; charset=UTF-8");
    lines.push("Content-Transfer-Encoding: 8bit");
    lines.push("", "");
    content = body || "";
  }
  return lines.join("\r\n") + content;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Resolve a message/thread id from config, falling back to upstream output. */
function pickId(ctx: ActionContext, configKey: string): string {
  const fromConfig = asString(ctx.config[configKey]);
  if (fromConfig) return fromConfig;
  // Upstream output shapes we accept: { id }, { messageId }, or an array of those.
  for (const inp of ctx.inputs) {
    if (!inp || typeof inp !== "object") continue;
    const items = Array.isArray(inp) ? inp : [inp];
    for (const it of items) {
      if (!it || typeof it !== "object") continue;
      const rec = it as Record<string, unknown>;
      const id = asString(rec.id) ?? asString(rec.messageId) ?? asString(rec.threadId);
      if (id) return id;
    }
  }
  throw new Error(
    `No message id provided. Set the "${configKey}" field, or feed a Gmail node (Search/New Email/Read) into this node.`,
  );
}

interface GmailLabel { id: string; name: string; type?: string }
interface GmailLabelList { labels?: GmailLabel[] }
interface GmailIdResult { id: string; threadId?: string }
interface GmailMessageList { messages?: { id: string; threadId?: string }[] }
interface GmailDraftResult { id: string; message?: { threadId?: string } }

async function resolveLabelId(accessToken: string, name: string, signal: { stopped: () => boolean }): Promise<string> {
  const res = await gmailFetch<GmailLabelList>("/labels", accessToken, { signal });
  const labels: GmailLabel[] = res.labels ?? [];
  const found = labels.find((l) => l.name.toLowerCase() === name.toLowerCase());
  if (found) return found.id;
  // Gmail lets you create user labels on the fly via /labels POST.
  const created = await gmailFetch<GmailIdResult>("/labels", accessToken, {
    method: "POST",
    body: { name },
    signal,
  });
  return created.id;
}

interface ShapedMessage {
  id: string;
  threadId?: string;
  from: string | null;
  to: string | null;
  cc: string | null;
  subject: string | null;
  date: string | null;
  snippet: string | null;
  labelIds: string[];
  unread: boolean;
  body?: string | null;
  html?: string | null;
}

function shapeMessageHeaders(msg: GmailMessageRaw): ShapedMessage {
  const headers: GmailHeader[] = msg.payload?.headers ?? [];
  const labelIds: string[] = msg.labelIds ?? [];
  return {
    id: msg.id,
    threadId: msg.threadId,
    from: headerValue(headers, "From"),
    to: headerValue(headers, "To"),
    cc: headerValue(headers, "Cc"),
    subject: headerValue(headers, "Subject"),
    date: headerValue(headers, "Date"),
    snippet: msg.snippet ?? null,
    labelIds,
    unread: labelIds.includes("UNREAD"),
  };
}

type ActionGen = AsyncGenerator<ActionLogEvent, ActionResult, unknown>;

function log(line: string): ActionLogEvent {
  return { type: "log", log: line };
}

function configStr(ctx: ActionContext, key: string): string {
  return typeof ctx.config[key] === "string" ? (ctx.config[key] as string) : "";
}

function configNum(ctx: ActionContext, key: string, fallback: number): number {
  const v = ctx.config[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

async function* sendEmail(ctx: ActionContext, accessToken: string): ActionGen {
  const to = configStr(ctx, "to");
  const subject = configStr(ctx, "subject");
  const body = configStr(ctx, "body");
  if (!to) return { status: "failed", error: '"To" is required to send an email.' };
  if (!subject) return { status: "failed", error: '"Subject" is required to send an email.' };
  yield log(`Composing email to ${to}`);
  const raw = buildRfc822(
    {
      To: to,
      Cc: configStr(ctx, "cc") || undefined,
      Bcc: configStr(ctx, "bcc") || undefined,
      Subject: subject,
      "In-Reply-To": configStr(ctx, "inReplyTo") || undefined,
      References: configStr(ctx, "references") || undefined,
    },
    body,
    ctx.config.html ? body : undefined, // plain-only for now; html toggle reserved
  );
  yield log("Uploading to Gmail…");
  const msg = await gmailFetch<GmailIdResult>("/messages/send", accessToken, {
    method: "POST",
    body: { raw: base64UrlEncode(raw), threadId: configStr(ctx, "threadId") || undefined },
    signal: ctx.signal,
  });
  yield log(`Sent — message ${msg.id}`);
  return {
    status: "succeeded",
    output: { id: msg.id, threadId: msg.threadId, to, subject },
  };
}

async function* replyEmail(ctx: ActionContext, accessToken: string): ActionGen {
  const messageId = pickId(ctx, "messageId");
  const body = configStr(ctx, "body");
  if (!body) return { status: "failed", error: '"Body" is required to reply.' };
  yield log(`Fetching original message ${messageId}`);
  const orig = await gmailFetch<GmailMessageRaw>(`/messages/${messageId}`, accessToken, {
    query: { format: "metadata" },
    signal: ctx.signal,
  });
  const headers: GmailHeader[] = orig.payload?.headers ?? [];
  const origSubject = headerValue(headers, "Subject") ?? "";
  const origMsgId = headerValue(headers, "Message-ID");
  const origRefs = headerValue(headers, "References");
  const origFrom = headerValue(headers, "Reply-To") ?? headerValue(headers, "From");
  const replyAll = Boolean(ctx.config.replyAll);
  const toAddrs = origFrom ?? "";
  const ccAddrs = replyAll ? [headerValue(headers, "To"), headerValue(headers, "Cc")].filter(Boolean).join(", ") : "";
  const subject = /^re:/i.test(origSubject) ? origSubject : `Re: ${origSubject}`;
  const refs = [origRefs, origMsgId].filter(Boolean).join(" ");
  yield log(`Replying to "${subject}"`);
  const raw = buildRfc822(
    {
      To: toAddrs,
      Cc: ccAddrs || undefined,
      Subject: subject,
      "In-Reply-To": origMsgId ?? undefined,
      References: refs || undefined,
    },
    body,
  );
  const msg = await gmailFetch<GmailIdResult>("/messages/send", accessToken, {
    method: "POST",
    body: { raw: base64UrlEncode(raw), threadId: orig.threadId },
    signal: ctx.signal,
  });
  yield log(`Reply sent — message ${msg.id} (thread ${orig.threadId})`);
  return {
    status: "succeeded",
    output: { id: msg.id, threadId: orig.threadId, messageId, inReplyTo: origMsgId, subject },
  };
}

async function* forwardEmail(ctx: ActionContext, accessToken: string): ActionGen {
  const messageId = pickId(ctx, "messageId");
  const to = configStr(ctx, "to");
  if (!to) return { status: "failed", error: '"To" is required to forward.' };
  yield log(`Fetching original message ${messageId}`);
  const orig = await gmailFetch<GmailMessageRaw>(`/messages/${messageId}`, accessToken, {
    query: { format: "full" },
    signal: ctx.signal,
  });
  const headers: GmailHeader[] = orig.payload?.headers ?? [];
  const { text } = extractBody(orig.payload);
  const origSubject = headerValue(headers, "Subject") ?? "";
  const origMsgId = headerValue(headers, "Message-ID");
  const origRefs = headerValue(headers, "References");
  const subject = /^fwd:/i.test(origSubject) ? origSubject : `Fwd: ${origSubject}`;
  const intro = configStr(ctx, "body");
  const fwdBlock = [
    "---------- Forwarded message ----------",
    `From: ${headerValue(headers, "From") ?? ""}`,
    `Date: ${headerValue(headers, "Date") ?? ""}`,
    `Subject: ${origSubject}`,
    `To: ${headerValue(headers, "To") ?? ""}`,
    "",
    text ?? "",
  ].join("\r\n");
  const body = intro ? `${intro}\r\n\r\n${fwdBlock}` : fwdBlock;
  yield log(`Forwarding to ${to}`);
  const raw = buildRfc822(
    {
      To: to,
      Subject: subject,
      "In-Reply-To": origMsgId ?? undefined,
      References: origRefs ?? undefined,
    },
    body,
  );
  const msg = await gmailFetch<GmailIdResult>("/messages/send", accessToken, {
    method: "POST",
    body: { raw: base64UrlEncode(raw), threadId: orig.threadId },
    signal: ctx.signal,
  });
  yield log(`Forwarded — message ${msg.id}`);
  return { status: "succeeded", output: { id: msg.id, threadId: orig.threadId, messageId, to, subject } };
}

async function listMessages(
  accessToken: string,
  query: string,
  maxResults: number,
  signal: { stopped: () => boolean },
): Promise<{ id: string; threadId?: string }[]> {
  const list = await gmailFetch<GmailMessageList>("/messages", accessToken, {
    query: { q: query, maxResults },
    signal,
  });
  return list.messages ?? [];
}

async function fetchMany(
  accessToken: string,
  ids: { id: string }[],
  signal: { stopped: () => boolean },
  withBody = false,
): Promise<ShapedMessage[]> {
  const out: ShapedMessage[] = [];
  for (const { id } of ids) {
    const msg = await gmailFetch<GmailMessageRaw>(`/messages/${id}`, accessToken, {
      query: { format: withBody ? "full" : "metadata", metadataHeaders: ["From", "To", "Cc", "Subject", "Date"] },
      signal,
    });
    const shaped = shapeMessageHeaders(msg);
    if (withBody) {
      const { text, html } = extractBody(msg.payload);
      shaped.body = text;
      shaped.html = html;
    }
    out.push(shaped);
  }
  return out;
}

async function* searchEmails(ctx: ActionContext, accessToken: string): ActionGen {
  const query = configStr(ctx, "query") || "is:unread";
  const maxResults = configNum(ctx, "maxResults", 25);
  yield log(`Searching Gmail: "${query}" (up to ${maxResults})`);
  const ids = await listMessages(accessToken, query, maxResults, ctx.signal);
  if (ids.length === 0) {
    yield log("No messages matched the query.");
    return { status: "succeeded", output: { messages: [], count: 0, query } };
  }
  yield log(`Found ${ids.length} message(s); fetching details…`);
  const messages = await fetchMany(accessToken, ids, ctx.signal, false);
  yield log(`Returned ${messages.length} message(s)`);
  return { status: "succeeded", output: { messages, count: messages.length, query } };
}

async function* readEmail(ctx: ActionContext, accessToken: string): ActionGen {
  const messageId = pickId(ctx, "messageId");
  yield log(`Reading message ${messageId}`);
  const msg = await gmailFetch<GmailMessageRaw>(`/messages/${messageId}`, accessToken, {
    query: { format: "full" },
    signal: ctx.signal,
  });
  const shaped = shapeMessageHeaders(msg);
  const { text, html } = extractBody(msg.payload);
  shaped.body = text;
  shaped.html = html;
  yield log(`Read "${shaped.subject ?? "(no subject)"}" from ${shaped.from ?? "unknown"}`);
  return { status: "succeeded", output: shaped };
}

async function* createDraft(ctx: ActionContext, accessToken: string): ActionGen {
  const to = configStr(ctx, "to");
  const subject = configStr(ctx, "subject");
  const body = configStr(ctx, "body");
  if (!to) return { status: "failed", error: '"To" is required to create a draft.' };
  yield log(`Composing draft to ${to}`);
  const raw = buildRfc822({ To: to, Subject: subject }, body);
  const draft = await gmailFetch<GmailDraftResult>("/drafts", accessToken, {
    method: "POST",
    body: { message: { raw: base64UrlEncode(raw) } },
    signal: ctx.signal,
  });
  yield log(`Draft created — ${draft.id}`);
  return { status: "succeeded", output: { id: draft.id, threadId: draft.message?.threadId, to, subject } };
}

async function* modifyLabels(
  ctx: ActionContext,
  accessToken: string,
  mode: "add" | "remove",
): ActionGen {
  const messageId = pickId(ctx, "messageId");
  const labelName = configStr(ctx, "label");
  if (!labelName) return { status: "failed", error: '"Label" name is required.' };
  yield log(`Resolving label "${labelName}"`);
  const labelId = await resolveLabelId(accessToken, labelName, ctx.signal);
  yield log(`${mode === "add" ? "Adding" : "Removing"} label on message ${messageId}`);
  await gmailFetch(`/messages/${messageId}/modify`, accessToken, {
    method: "POST",
    body: mode === "add" ? { addLabelIds: [labelId] } : { removeLabelIds: [labelId] },
    signal: ctx.signal,
  });
  yield log(`${mode === "add" ? "Added" : "Removed"} label "${labelName}"`);
  return { status: "succeeded", output: { id: messageId, label: labelName, action: mode } };
}

async function* archiveEmail(ctx: ActionContext, accessToken: string): ActionGen {
  const messageId = pickId(ctx, "messageId");
  yield log(`Archiving message ${messageId} (removing INBOX)`);
  await gmailFetch(`/messages/${messageId}/modify`, accessToken, {
    method: "POST",
    body: { removeLabelIds: ["INBOX"] },
    signal: ctx.signal,
  });
  yield log("Archived");
  return { status: "succeeded", output: { id: messageId, archived: true } };
}

async function* markReadEmail(ctx: ActionContext, accessToken: string): ActionGen {
  const messageId = pickId(ctx, "messageId");
  yield log(`Marking message ${messageId} as read`);
  await gmailFetch(`/messages/${messageId}/modify`, accessToken, {
    method: "POST",
    body: { removeLabelIds: ["UNREAD"] },
    signal: ctx.signal,
  });
  yield log("Marked as read");
  return { status: "succeeded", output: { id: messageId, read: true } };
}

async function* deleteEmail(ctx: ActionContext, accessToken: string): ActionGen {
  const messageId = pickId(ctx, "messageId");
  yield log(`Moving message ${messageId} to Trash`);
  await gmailFetch(`/messages/${messageId}/trash`, accessToken, { method: "POST", signal: ctx.signal });
  yield log("Moved to Trash");
  return { status: "succeeded", output: { id: messageId, trashed: true } };
}

async function* newEmailTrigger(ctx: ActionContext, accessToken: string): ActionGen {
  const baseQuery = configStr(ctx, "query") || "is:unread";
  const maxResults = configNum(ctx, "maxResults", 10);
  const watermark = ctx.account.lastPollHistoryId; // epoch-ms string of last seen
  // Append `after:<seconds>` on subsequent polls so we only see new mail.
  const query = watermark ? `${baseQuery} after:${Math.floor(Number(watermark) / 1000)}` : baseQuery;
  yield log(`Polling Gmail for new mail: "${query}"`);
  const ids = await listMessages(accessToken, query, maxResults, ctx.signal);
  if (ids.length === 0) {
    yield log("No new messages since last poll.");
    return { status: "succeeded", output: { messages: [], count: 0 } };
  }
  yield log(`${ids.length} new message(s); fetching details…`);
  const messages = await fetchMany(accessToken, ids, ctx.signal, false);
  // Advance the watermark to the newest internalDate we saw (or now).
  const newest = messages.reduce((max, m) => {
    const t = Date.parse(m.date ?? "") || 0;
    return t > max ? t : max;
  }, Date.now());
  return {
    status: "succeeded",
    output: { messages, count: messages.length, watermark: String(newest) },
  };
}

export async function* runGmailAction(ctx: ActionContext, accessToken: string): ActionGen {
  const guard = async <T>(fn: () => ActionGen | Promise<ActionGen>): Promise<ActionGen> =>
    (await (fn() as Promise<ActionGen>)) as ActionGen;
  void guard; // reserved for future cooperative-cancel wiring
  try {
    let gen: ActionGen;
    switch (ctx.actionId) {
      case "send": gen = sendEmail(ctx, accessToken); break;
      case "reply": gen = replyEmail(ctx, accessToken); break;
      case "forward": gen = forwardEmail(ctx, accessToken); break;
      case "search": gen = searchEmails(ctx, accessToken); break;
      case "read": gen = readEmail(ctx, accessToken); break;
      case "draft": gen = createDraft(ctx, accessToken); break;
      case "label.add": gen = modifyLabels(ctx, accessToken, "add"); break;
      case "label.remove": gen = modifyLabels(ctx, accessToken, "remove"); break;
      case "archive": gen = archiveEmail(ctx, accessToken); break;
      case "markRead": gen = markReadEmail(ctx, accessToken); break;
      case "delete": gen = deleteEmail(ctx, accessToken); break;
      case "newEmail": gen = newEmailTrigger(ctx, accessToken); break;
      default:
        return { status: "failed", error: `Unknown Gmail action: ${ctx.actionId}` };
    }
    let result: ActionResult | undefined;
    while (true) {
      if (ctx.signal.stopped()) return { status: "failed", error: "Cancelled" };
      const { value, done } = await gen.next();
      if (done) {
        result = value;
        break;
      }
      yield value;
    }
    return result ?? { status: "failed", error: "Gmail action produced no result" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gmail action failed";
    const invalidGrant = err instanceof GmailApiError && err.invalidGrant;
    return {
      status: "failed",
      error: invalidGrant ? `Gmail access expired or revoked — reconnect the account. (${msg})` : msg,
    };
  }
}