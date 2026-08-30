import { chatJSON, chatText, MODEL_FAST, MODEL_MAIN } from "./openai";

// ─────────────────────────────────────────────────────────────────────────────
// The agent's intelligence: every LLM interaction, with strict schemas.
// The LLM never decides *what to do next* by itself — orchestration lives in
// deterministic Convex code. The LLM classifies, clusters, assesses, plans
// queries, extracts evidence, remembers, and writes.
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Signal classification ────────────────────────────────────────────────

export type RawItem = {
  externalId: string;
  title?: string;
  content: string;
  author?: string;
  url?: string;
  occurredAt: number;
  source: string;
};

export type ClassifiedSignal = {
  externalId: string;
  relevant: boolean;
  reason: string;
  topics: string[];
  sentiment: "positive" | "neutral" | "negative";
  urgency: number; // 0-100
  productArea: string;
  affectedSegment: string;
};

export async function classifyItems(args: {
  company: string;
  product: string;
  watchRules: { label: string; description: string; keywords: string[] }[];
  items: RawItem[];
}): Promise<ClassifiedSignal[]> {
  const out = await chatJSON<{ signals: ClassifiedSignal[] }>({
    model: MODEL_FAST,
    system:
      "You classify customer voice items for a company's customer intelligence agent. " +
      "Be precise: only items that are genuinely about this company's product (or comparing it to competitors) are relevant. " +
      "Urgency reflects how much pain the customer expresses (0-100). " +
      "productArea is a short slug like 'checkout', 'mobile-app', 'pricing', 'api', 'export'. " +
      "affectedSegment describes who is affected, like 'mobile users', 'desktop users', 'free plan', 'enterprise' — or 'unknown'. " +
      "Return one output per input item, in the same order, using the exact externalId.",
    user: JSON.stringify(
      {
        company: args.company,
        product: args.product,
        watch_rules: args.watchRules,
        items: args.items.map((i) => ({
          external_id: i.externalId,
          source: i.source,
          title: i.title,
          content: i.content.slice(0, 1500),
          author: i.author,
        })),
      },
      null,
      0
    ),
    schema: {
      name: "signal_classifications",
      schema: {
        type: "object",
        properties: {
          signals: {
            type: "array",
            items: {
              type: "object",
              properties: {
                externalId: { type: "string" },
                relevant: { type: "boolean" },
                reason: { type: "string" },
                topics: { type: "array", items: { type: "string" } },
                sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
                urgency: { type: "number" },
                productArea: { type: "string" },
                affectedSegment: { type: "string" },
              },
              required: [
                "externalId",
                "relevant",
                "reason",
                "topics",
                "sentiment",
                "urgency",
                "productArea",
                "affectedSegment",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["signals"],
        additionalProperties: false,
      },
    },
    maxTokens: 2500,
  });
  return out.signals;
}

// ── 2. Clustering: does this signal belong to an existing issue? ────────────

export type IssueForMatching = {
  id: string;
  title: string;
  description: string;
  status: string;
  affectedSegment?: string;
};

export type MatchResult = {
  action: "existing" | "historical" | "new";
  issueId: string;
  rationale: string;
};

export async function matchSignalToIssue(args: {
  signal: { content: string; topics: string[]; productArea: string; affectedSegment?: string };
  openIssues: IssueForMatching[];
  resolvedIssues: IssueForMatching[];
}): Promise<MatchResult> {
  const out = await chatJSON<MatchResult>({
    model: MODEL_FAST,
    system:
      "You are the memory of a customer intelligence agent. Decide whether a new customer signal " +
      "belongs to one of the currently-open issues, matches a RESOLVED historical issue " +
      "(important: it may be a recurrence — choose 'historical' and reference it), or is new. " +
      "Match on the underlying customer problem, not surface wording. " +
      "If nothing matches, use action='new' and issueId=''.",
    user: JSON.stringify(
      {
        signal: args.signal,
        open_issues: args.openIssues,
        resolved_issues: args.resolvedIssues,
      },
      null,
      0
    ),
    schema: {
      name: "issue_match",
      schema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["existing", "historical", "new"] },
          issueId: { type: "string" },
          rationale: { type: "string" },
        },
        required: ["action", "issueId", "rationale"],
        additionalProperties: false,
      },
    },
  });
  return out;
}

// ── 3. New issue synthesis from a signal ────────────────────────────────────

export type NewIssueDraft = {
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
};

export async function draftNewIssue(args: {
  signal: { content: string; topics: string[]; productArea: string; affectedSegment?: string };
}): Promise<NewIssueDraft> {
  return chatJSON<NewIssueDraft>({
    model: MODEL_MAIN,
    system:
      "Synthesize a single customer signal into a concise internal issue. " +
      "Title: 2-5 words naming the customer problem (e.g. 'Checkout latency on mobile'). " +
      "Description: 1-2 sentences of what customers experience. " +
      "Severity reflects customer pain and apparent business impact. " +
      "State only what the evidence supports.",
    user: JSON.stringify(args.signal),
    schema: {
      name: "new_issue",
      schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
        },
        required: ["title", "description", "severity"],
        additionalProperties: false,
      },
    },
  });
}

// ── 4. Investigation planning ───────────────────────────────────────────────

export async function planInvestigation(args: {
  issue: { title: string; description: string; affectedSegment?: string };
  question?: string;
  product: string;
  realProduct?: boolean;
}): Promise<{ queries: string[] }> {
  const naming = args.realProduct
    ? "The product is REAL and well-known — include the product name in your queries so search " +
      "returns actual discussions about it. If the focus question asks about competitors, aim one " +
      "query at the product category and competitor names."
    : "CRITICAL: queries run against the REAL public web. Never include the company or " +
      "product name unless it is a real well-known company — the product may be fictional. " +
      "Instead, search for the underlying technical/customer phenomenon: e.g. " +
      "'mobile checkout latency safari', 'stripe payment latency issues', " +
      "'app store payment failures reddit'. If the focus question asks about competitors " +
      "or the industry, search the phenomenon at other companies and platforms.";
  return chatJSON<{ queries: string[] }>({
    model: MODEL_FAST,
    system:
      "Generate 2-3 targeted web search queries to investigate a customer issue. " +
      naming +
      " Queries should surface public discussions (forums, Reddit, HN, GitHub issues, " +
      "status pages). Keep queries under 8 words.",
    user: JSON.stringify({ ...args }),
    schema: {
      name: "investigation_plan",
      schema: {
        type: "object",
        properties: { queries: { type: "array", items: { type: "string" } } },
        required: ["queries"],
        additionalProperties: false,
      },
    },
  });
}

// ── 5. Evidence extraction from web results ─────────────────────────────────

export type ExtractedEvidence = {
  url: string;
  excerpt: string;
  relevance: number;
  note: string;
};

export async function extractEvidence(args: {
  issue: { title: string; description: string; affectedSegment?: string };
  question?: string;
  results: { title: string; url: string; description: string; markdown?: string }[];
}): Promise<ExtractedEvidence[]> {
  return (
    await chatJSON<{ evidence: ExtractedEvidence[] }>({
      model: MODEL_MAIN,
      system:
        "From web search results, extract items that are real evidence about the given customer " +
        "issue or focus question. Evidence includes: direct reports of the same problem, related " +
        "or similar issues at other companies/platforms (industry-wide signals), and known incidents " +
        "or status reports matching the symptoms. excerpt must be a verbatim quote from the result " +
        "content (max ~280 chars) — never paraphrase or invent. Discard irrelevant or empty results. " +
        "relevance: 0-100 (lower is fine for industry-wide context). note: one short sentence on " +
        "what this evidence indicates.",
      user: JSON.stringify(
        {
          issue: args.issue,
          question: args.question ?? null,
          results: args.results.map((r) => ({
            title: r.title,
            url: r.url,
            description: r.description,
            content: (r.markdown ?? r.description).slice(0, 3000),
          })),
        },
        null,
        0
      ),
      schema: {
        name: "evidence_extraction",
        schema: {
          type: "object",
          properties: {
            evidence: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: { type: "string" },
                  excerpt: { type: "string" },
                  relevance: { type: "number" },
                  note: { type: "string" },
                },
                required: ["url", "excerpt", "relevance", "note"],
                additionalProperties: false,
              },
            },
          },
          required: ["evidence"],
          additionalProperties: false,
        },
      },
      maxTokens: 2500,
    })
  ).evidence;
}

// ── 6. Historical comparison (persistent memory) ────────────────────────────

export async function compareWithHistory(args: {
  issue: { title: string; description: string; affectedSegment?: string };
  resolvedIssues: {
    title: string;
    description: string;
    resolvedAt: number;
    resolutionNote?: string;
    affectedSegment?: string;
  }[];
}): Promise<{ historicalNote: string | null; relatedIssueTitle: string | null }> {
  return chatJSON<{ historicalNote: string | null; relatedIssueTitle: string | null }>({
    model: MODEL_MAIN,
    system:
      "Compare a live customer issue with the company's resolved historical issues. " +
      "If a genuinely similar prior issue exists, write historicalNote: one sentence in the agent's voice " +
      "linking this occurrence to the prior one and noting what is different (e.g. affected segment). " +
      "If none is similar, return null for both fields. Never invent history.",
    user: JSON.stringify(args, null, 0),
    schema: {
      name: "history_comparison",
      schema: {
        type: "object",
        properties: {
          historicalNote: { type: ["string", "null"] },
          relatedIssueTitle: { type: ["string", "null"] },
        },
        required: ["historicalNote", "relatedIssueTitle"],
        additionalProperties: false,
      },
    },
  });
}

// ── 7. Issue assessment: impact, novelty, recommendation ────────────────────

export type IssueAssessment = {
  impact: number; // 0-100
  novelty: number; // 0-100
  recommendedAction: string;
  reasoningSummary: string;
};

export async function assessIssue(args: {
  issue: { title: string; description: string; status: string; affectedSegment?: string };
  evidence: { excerpt: string; source: string; note?: string }[];
  stats: { mentionsThisWeek: number; mentionsPrevWeek: number };
}): Promise<IssueAssessment> {
  return chatJSON<IssueAssessment>({
    model: MODEL_MAIN,
    system:
      "Assess a customer issue for prioritization. impact: estimated effect on customers/business (0-100). " +
      "novelty: how new this problem is versus known/stable issues (0-100). " +
      "recommendedAction: one concrete sentence for the team. " +
      "reasoningSummary: 2-3 sentences summarizing what the evidence shows, in the voice of a " +
      "diligent customer-intelligence analyst. Cite evidence, never speculate beyond it.",
    user: JSON.stringify(args, null, 0),
    schema: {
      name: "issue_assessment",
      schema: {
        type: "object",
        properties: {
          impact: { type: "number" },
          novelty: { type: "number" },
          recommendedAction: { type: "string" },
          reasoningSummary: { type: "string" },
        },
        required: ["impact", "novelty", "recommendedAction", "reasoningSummary"],
        additionalProperties: false,
      },
    },
  });
}

// ── 8. Inbound email routing ────────────────────────────────────────────────

export type EmailIntent = {
  classification: "customer_feedback" | "employee_question" | "other";
  isInternal: boolean;
  question: string | null;
};

export async function classifyInboundEmail(args: {
  from: string;
  employeeEmail: string;
  agentEmail: string;
  subject: string;
  text: string;
}): Promise<EmailIntent> {
  return chatJSON<EmailIntent>({
    model: MODEL_FAST,
    system:
      "Classify an email sent to a customer-intelligence agent's inbox. " +
      "RULES (apply in order): " +
      "1. If the sender address equals the employee email, it is 'employee_question' — even if it reads like customer feedback. " +
      "2. Any other sender is 'customer_feedback' — even if it asks questions like 'is there an incident?' or reads internal. " +
      "Customers asking about incidents/outages are still customers reporting their experience. " +
      "3. Only obvious spam/newsletters/no-reply confirmations are 'other'. " +
      "isInternal must exactly match whether the sender is the employee. " +
      "question: the sender's ask distilled to one sentence (works for both customers and employees), or null.",
    user: JSON.stringify(args, null, 0),
    schema: {
      name: "email_intent",
      schema: {
        type: "object",
        properties: {
          classification: { type: "string", enum: ["customer_feedback", "employee_question", "other"] },
          isInternal: { type: "boolean" },
          question: { type: ["string", "null"] },
        },
        required: ["classification", "isInternal", "question"],
        additionalProperties: false,
      },
    },
  });
}

// ── 9. Report drafting (sent via AgentMail) ─────────────────────────────────

export async function draftIssueReport(args: {
  issue: {
    title: string;
    description: string;
    mentionsThisWeek: number;
    mentionsPrevWeek: number;
    affectedSegment?: string;
    confidence: number;
    historicalNote?: string;
    recommendedAction?: string;
    reasoningSummary?: string;
  };
  evidence: { excerpt: string; url?: string; source: string }[];
  company: string;
  question?: string;
}): Promise<{ subject: string; body: string }> {
  return chatJSON<{ subject: string; body: string }>({
    model: MODEL_MAIN,
    system:
      "You write concise internal alert emails for a customer-intelligence agent. " +
      "Format (plain text, use simple dashes and caps, no markdown headers):\n" +
      "Line 1: a one-sentence summary of what changed and why it matters.\n" +
      "Then labeled sections: MENTIONS (this week vs last week), EVIDENCE (2-4 verbatim excerpts with source), " +
      "AFFECTED, CONFIDENCE, HISTORICAL CONTEXT (only if provided), RECOMMENDED.\n" +
      "Every claim must trace to the given evidence. End with:\n" +
      "— Customer Intelligence Agent (reply to this email with questions or instructions)" +
      (args.question ? "\nThis is a follow-up: answer the given question directly at the top." : ""),
    user: JSON.stringify(args, null, 0),
    schema: {
      name: "issue_report",
      schema: {
        type: "object",
        properties: {
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["subject", "body"],
        additionalProperties: false,
      },
    },
    maxTokens: 1200,
  });
}

// ── 10. Evidence-backed answers (employee replies & dashboard chat) ─────────

export async function answerFromContext(args: {
  question: string;
  context: string;
}): Promise<string> {
  return chatText({
    model: MODEL_MAIN,
    system:
      "You are a company's customer-intelligence agent answering an internal teammate by email. " +
      "Answer the question directly in 3-6 sentences, grounded ONLY in the provided context " +
      "(issues, signals, evidence, investigation findings). Do not open with phrases like " +
      "'Based on the provided context' — get straight to the answer, citing evidence naturally " +
      "(e.g. '3 of the 5 discussions mention…'). If exact evidence is missing but ADJACENT " +
      "evidence exists (similar issues at other companies, industry analyses, known platform " +
      "incidents), use it and frame it honestly — e.g. 'No direct competitor reports yet, but " +
      "this matches a known industry pattern…'. Only say you lack evidence entirely when the " +
      "context truly offers nothing. Plain text, no markdown.",
    user: `CONTEXT:\n${args.context}\n\nQUESTION: ${args.question}`,
    maxTokens: 700,
  });
}

// ── 11. Chat intent detection (dashboard) ───────────────────────────────────

export type ChatIntent = {
  reply: string;
  investigateIssueTitle: string | null;
  sendEmailReport: boolean;
};

export async function chatReply(args: {
  question: string;
  history: { role: string; content: string }[];
  context: string;
  issueTitles: string[];
}): Promise<ChatIntent> {
  return chatJSON<ChatIntent>({
    model: MODEL_MAIN,
    system:
      "You are a customer-intelligence agent chatting with your team in an internal dashboard. " +
      "Answer the user's question from the provided live state context (issues, signals, activity). " +
      "Be concise (2-6 sentences), quantitative when numbers exist, and cite which evidence backs key claims. " +
      "If the user asks to investigate something: set investigateIssueTitle to the matching issue title " +
      "(must be one of the provided titles) or a short new issue title if it doesn't exist yet. " +
      "If the user asks to email/send findings: set sendEmailReport=true. Otherwise leave both null/false.",
    user: JSON.stringify(
      {
        question: args.question,
        conversation_history: args.history.slice(-6),
        live_state: args.context,
        known_issue_titles: args.issueTitles,
      },
      null,
      0
    ),
    schema: {
      name: "chat_reply",
      schema: {
        type: "object",
        properties: {
          reply: { type: "string" },
          investigateIssueTitle: { type: ["string", "null"] },
          sendEmailReport: { type: "boolean" },
        },
        required: ["reply", "investigateIssueTitle", "sendEmailReport"],
        additionalProperties: false,
      },
    },
    maxTokens: 800,
  });
}
