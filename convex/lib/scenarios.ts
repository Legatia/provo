// ─────────────────────────────────────────────────────────────────────────────
// Demo scenario packs. Each pack retargets the whole product at a real company:
// company config, monitored sources, the agent's seeded history, the ramp of
// public signals, and the customer email text. Web evidence is always real —
// for real products, investigations search the product name directly.
// ─────────────────────────────────────────────────────────────────────────────

export type ScenarioKey = "acme" | "firecrawl" | "agentmail";

export type ScenarioPack = {
  key: ScenarioKey;
  company: {
    name: string;
    product: string;
    productKeywords: string[];
    realProduct: boolean;
  };
  sources: { name: string; kind: string; config: any }[];
  history: {
    resolvedIssue: {
      title: string;
      description: string;
      severity: string;
      affectedSegment: string;
      reasoningSummary: string;
      resolutionNote: string;
      firstDetectedDaysAgo: number;
      resolvedDaysAgo: number;
    };
    signals: { content: string; daysBack: number; source: string; author?: string }[];
    baselines: {
      title: string;
      description: string;
      severity: string;
      segment: string;
      recommended: string;
      thisWeek: number;
      prevWeek: number;
      signals: { content: string; daysBack: number; source: string }[];
    }[];
  };
  customerEmail: { subject: string; text: string };
  questions: { q1: string; q2: string };
};

export const SCENARIOS: Record<ScenarioKey, ScenarioPack> = {
  // ───────────────────────────────────────────────────────────────────────
  acme: {
    key: "acme",
    company: {
      name: "Acme AI",
      product: "Acme Assistant",
      productKeywords: ["Acme Assistant", "Acme AI"],
      realProduct: false,
    },
    sources: [
      { name: "Hacker News mentions", kind: "hn", config: { query: "Acme Assistant" } },
      { name: "Reddit discussions", kind: "reddit_search", config: { query: "Acme Assistant" } },
      {
        name: "General web mentions",
        kind: "web_search",
        config: { query: '"Acme Assistant" review OR complaint' },
      },
    ],
    history: {
      resolvedIssue: {
        title: "Checkout latency (desktop)",
        description:
          "Desktop checkout took 20s+ for a subset of users during payment processing.",
        severity: "high",
        affectedSegment: "desktop users",
        reasoningSummary:
          "Correlated with payment provider timeout metrics between Aug 12–18.",
        resolutionNote:
          "Root cause: payment provider timeout budget too low under load. Fixed Aug 18 by raising the timeout budget.",
        firstDetectedDaysAgo: 17,
        resolvedDaysAgo: 11,
      },
      signals: [
        {
          content:
            "Anyone else seeing Acme Assistant checkout take forever on desktop? Spinning for like 20 seconds at payment.",
          daysBack: 17,
          source: "hacker_news",
          author: "dkl9",
        },
        {
          content:
            "Desktop checkout is unusable today. Card step hangs then fails. Support ticket #4812 opened.",
          daysBack: 15,
          source: "email",
          author: "marcus_p",
        },
        {
          content: "Checkout latency on desktop back to normal for us as of this morning.",
          daysBack: 11,
          source: "hacker_news",
          author: "sarah_builds",
        },
      ],
      baselines: [
        {
          title: "Pricing complaints",
          description: "Recurring grumbles that the Pro plan got expensive after the repricing.",
          severity: "low",
          segment: "pro plan",
          recommended: "Keep watching; consider packaging note in next release comms.",
          thisWeek: 2,
          prevWeek: 5,
          signals: [
            ["$49 for Pro is steep for what I use it for, honestly.", 20, "reddit"],
            ["Considering downgrading after the price change.", 14, "email"],
            ["Pricing feels off vs value lately.", 9, "hacker_news"],
            ["Still salty about Pro pricing but the product works.", 6, "reddit"],
            ["Renewal coming up, evaluating alternatives on cost.", 4, "email"],
          ].map(([content, daysBack, source]) => ({
            content: content as string,
            daysBack: daysBack as number,
            source: source as string,
          })),
        },
        {
          title: "CSV export requests",
          description: "Customers repeatedly ask for CSV export of their assistant logs.",
          severity: "low",
          segment: "all users",
          recommended: "Already on roadmap (Q4) — keep tracking volume.",
          thisWeek: 3,
          prevWeek: 3,
          signals: [
            ["Would love a CSV export of my logs for BI.", 21, "email"],
            ["Any way to export history to CSV? Can't find it.", 12, "reddit"],
            ["+1 for CSV export, need it for compliance.", 8, "hacker_news"],
            ["Export feature is the only thing keeping me on a manual workflow.", 5, "email"],
            ["CSV export please!", 3, "reddit"],
            ["Asked support about CSV export again this week.", 2, "email"],
          ].map(([content, daysBack, source]) => ({
            content: content as string,
            daysBack: daysBack as number,
            source: source as string,
          })),
        },
      ],
    },
    customerEmail: {
      subject: "Checkout painfully slow on my phone",
      text:
        "Hi — I've been trying to buy a Pro plan all morning and checkout on my phone (iPhone, Safari) takes forever. " +
        "The spinner sits at the payment step for 30+ seconds and twice it just failed. " +
        "It worked fine on my laptop last week. Is anyone else seeing this? About to give up and stay on free.\n\n— Dana",
    },
    questions: {
      q1: "Is this only affecting mobile users?",
      q2: "Are competitors seeing the same thing?",
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  firecrawl: {
    key: "firecrawl",
    company: {
      name: "Firecrawl",
      product: "Firecrawl API",
      productKeywords: ["firecrawl"],
      realProduct: true,
    },
    sources: [
      { name: "Hacker News mentions", kind: "hn", config: { query: "Firecrawl" } },
      { name: "Reddit discussions", kind: "reddit_search", config: { query: "Firecrawl scraping" } },
      {
        name: "General web mentions",
        kind: "web_search",
        config: { query: "Firecrawl API rate limits OR errors" },
      },
    ],
    history: {
      resolvedIssue: {
        title: "Scrape timeouts on JS-heavy sites",
        description:
          "Scrapes of JavaScript-heavy pages timed out at high rates for v1 API users during peak hours.",
        severity: "high",
        affectedSegment: "v1 API users",
        reasoningSummary:
          "Correlated with upstream proxy provider latency dashboards between Aug 12–18.",
        resolutionNote:
          "Root cause: upstream proxy pool exhaustion during peak hours. Fixed Aug 18 with adaptive routing and per-domain retry budgets (v1.8.0).",
        firstDetectedDaysAgo: 17,
        resolvedDaysAgo: 11,
      },
      signals: [
        {
          content:
            "Firecrawl scrape timeouts on JS-heavy pages all morning. v1 API, /scrape endpoint just hangs.",
          daysBack: 17,
          source: "hacker_news",
          author: "sre_ops",
        },
        {
          content:
            "Batch scrape job hung on React sites — had to retry manually. Ticket #2214 opened.",
          daysBack: 15,
          source: "email",
          author: "marcus@devshop.io",
        },
        {
          content: "Timeouts gone after the latest release. Back to normal latency for us.",
          daysBack: 11,
          source: "hacker_news",
          author: "crawl_dad",
        },
      ],
      baselines: [
        {
          title: "Markdown quality complaints",
          description:
            "Recurring feedback that markdown extraction misses content on some layouts.",
          severity: "low",
          segment: "self-hosted users",
          recommended: "Keep watching; link known workarounds in docs.",
          thisWeek: 2,
          prevWeek: 4,
          signals: [
            ["Markdown output misses table content on some news sites.", 19, "reddit"],
            ["Extraction quality dipped after the last layout change.", 13, "email"],
            ["Self-hosted version strips some content vs cloud.", 7, "hacker_news"],
            ["Mostly fine since the last parser update.", 3, "reddit"],
          ].map(([content, daysBack, source]) => ({
            content: content as string,
            daysBack: daysBack as number,
            source: source as string,
          })),
        },
        {
          title: "Self-hosted setup questions",
          description: "Steady stream of questions about self-hosting configuration.",
          severity: "low",
          segment: "self-hosted users",
          recommended: "Stable — docs improvements shipped, volume flat.",
          thisWeek: 3,
          prevWeek: 3,
          signals: [
            ["Redis config for self-hosted Firecrawl is unclear.", 16, "reddit"],
            ["How do I run workers separately in self-hosted mode?", 10, "hacker_news"],
            ["Docker compose worked after the updated guide.", 6, "reddit"],
            ["Env var list for self-hosting would help.", 2, "email"],
          ].map(([content, daysBack, source]) => ({
            content: content as string,
            daysBack: daysBack as number,
            source: source as string,
          })),
        },
      ],
    },
    customerEmail: {
      subject: "429 rate limits killing our batch jobs since yesterday",
      text:
        "Hey — we run about 50k pages/day through the Firecrawl API on the Growth plan, and since yesterday evening " +
        "we're getting hammered with 429s on /scrape. Our batch jobs keep failing even with exponential backoff. " +
        "Nothing changed on our side — same volume as last week, still on the v1.8 Python SDK. " +
        "Is there an incident? If this keeps up we'll have to move part of the pipeline to another provider.\n\n— Marcus, platform team",
    },
    questions: {
      q1: "Is this only affecting high-volume API users?",
      q2: "Are competitors seeing the same rate-limit complaints?",
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  agentmail: {
    key: "agentmail",
    company: {
      name: "AgentMail",
      product: "AgentMail API",
      productKeywords: ["agentmail"],
      realProduct: true,
    },
    sources: [
      { name: "Hacker News mentions", kind: "hn", config: { query: "AgentMail" } },
      { name: "Reddit discussions", kind: "reddit_search", config: { query: "AgentMail email API" } },
      {
        name: "General web mentions",
        kind: "web_search",
        config: { query: "AgentMail API webhook delays OR deliverability" },
      },
    ],
    history: {
      resolvedIssue: {
        title: "Outbound send queue delays",
        description:
          "Outbound emails queued for 5–15 minutes during bursts for bulk-sending customers.",
        severity: "high",
        affectedSegment: "bulk senders",
        reasoningSummary:
          "Correlated with send-pool saturation metrics between Aug 12–18.",
        resolutionNote:
          "Root cause: send workpool parallelism too low under org-level bursts. Fixed Aug 18 by raising per-org concurrency.",
        firstDetectedDaysAgo: 17,
        resolvedDaysAgo: 11,
      },
      signals: [
        {
          content:
            "AgentMail sends are queuing for 10+ minutes during our morning blast. Anyone else?",
          daysBack: 17,
          source: "hacker_news",
          author: "growth_eng",
        },
        {
          content: "Our drip campaign sends are hours behind since yesterday. Ticket #3391.",
          daysBack: 15,
          source: "email",
          author: "priya@mailco.ai",
        },
        {
          content: "Send latency back to seconds after the infra update. Confirmed on our side.",
          daysBack: 11,
          source: "hacker_news",
          author: "smtp_sam",
        },
      ],
      baselines: [
        {
          title: "Attachment size limit questions",
          description: "Users repeatedly hit the 25MB attachment ceiling and ask for more.",
          severity: "low",
          segment: "automation users",
          recommended: "Document S3-attachment pattern; evaluate limit raise.",
          thisWeek: 2,
          prevWeek: 4,
          signals: [
            ["Attachment limit blocked our invoice workflow.", 18, "email"],
            ["Is there a way to send 40MB PDFs via the API?", 12, "reddit"],
            ["Workaround with links works fine for now.", 5, "hacker_news"],
          ].map(([content, daysBack, source]) => ({
            content: content as string,
            daysBack: daysBack as number,
            source: source as string,
          })),
        },
        {
          title: "EU residency requests",
          description: "European customers ask whether email data can stay in the EU.",
          severity: "low",
          segment: "enterprise",
          recommended: "Sales enablement: share EU roadmap pointer.",
          thisWeek: 3,
          prevWeek: 3,
          signals: [
            ["Do you have an EU endpoint for data residency?", 15, "email"],
            ["EU data residency would unblock our procurement.", 9, "hacker_news"],
            ["Following up on the EU hosting question.", 3, "email"],
          ].map(([content, daysBack, source]) => ({
            content: content as string,
            daysBack: daysBack as number,
            source: source as string,
          })),
        },
      ],
    },
    customerEmail: {
      subject: "message.received webhooks arriving 10+ minutes late",
      text:
        "Hi — our production AI agent depends on your message.received webhooks. Since yesterday evening they've " +
        "been arriving 10–15 minutes late, so our replies to customers are embarrassingly delayed. Nothing changed " +
        "on our side — same volume, same endpoint, retries enabled. Outbound sending seems fine. " +
        "Is this an incident on your side? If it's not fixed soon we'll have to add polling as a fallback and rethink our stack.\n\n— Priya, engineering",
    },
    questions: {
      q1: "Is this only affecting webhook users?",
      q2: "Are competitors seeing the same delivery delays?",
    },
  },
};

// The ramp: 20 public signals, mild last week → sharp this week (the trend).
export function rampFor(scenario: ScenarioKey): [string, number, number, string, number, string][] {
  const firecrawlRamp: [string, number, number, string, number, string][] = [
    ["Anyone else seeing occasional 429s from Firecrawl? Started yesterday for us.", 9, 0, "reddit", 45, "unknown"],
    ["Firecrawl scrape latency seems higher than usual on batch jobs today.", 8, 0, "reddit", 50, "batch users"],
    ["Got a 429 on /scrape after ~600 requests/min. Docs say the limit is higher?", 7, 0, "hacker_news", 52, "high-volume API users"],
    ["Rate limited twice today on Firecrawl. Retries saved us but still.", 6, 0, "reddit", 55, "high-volume API users"],
    ["Python SDK raises RateLimitException way more often this week.", 6, 0, "hacker_news", 58, "Python SDK"],
    ["Second day of 429 storms on Firecrawl. Our queue is backing up.", 4, 12, "reddit", 70, "high-volume API users"],
    ["Firecrawl rate limits are hitting us at half the volume the docs promise.", 4, 6, "email", 72, "Growth plan"],
    ["Can't finish a 100k-page crawl without hitting 429s now. Worked last week.", 3, 18, "reddit", 70, "high-volume API users"],
    ["Is Firecrawl rate limiting harder this week? Seeing it across 3 projects.", 3, 10, "hacker_news", 65, "unknown"],
    ["Batch job failed 4 times overnight on 429s. Backoff doesn't help anymore.", 3, 4, "reddit", 78, "batch users"],
    ["Rate limited on Firecrawl since Tuesday-ish. Volume unchanged on our side.", 2, 20, "hacker_news", 68, "unknown"],
    ["Same here — 429s at volumes that were fine two weeks ago.", 2, 14, "reddit", 66, "high-volume API users"],
    ["We nearly churned today: Firecrawl 429s broke our nightly sync.", 2, 8, "email", 80, "Growth plan"],
    ["Multiple teams in our Slack seeing Firecrawl rate limit errors this week.", 2, 2, "hacker_news", 72, "unknown"],
    ["Rate limits on the API are noticeably tighter this week.", 1, 20, "reddit", 70, "high-volume API users"],
    ["Two customers complained to us about Firecrawl 429 failures in their pipelines.", 1, 12, "email", 74, "unknown"],
    ["429s on /scrape and /crawl. Reproducible across two accounts and regions.", 1, 5, "hacker_news", 76, "high-volume API users"],
    ["/r/webscraping thread: Firecrawl rate limits — multiple confirmations this week.", 0, 8, "reddit", 78, "unknown"],
    ["Third escalation today about Firecrawl rate limits. This is spreading.", 0, 4, "email", 84, "Growth plan"],
    ["Our Firecrawl 429 rate jumped 5x this week at constant volume.", 0, 1, "hacker_news", 82, "high-volume API users"],
  ];

  const agentmailRamp: [string, number, number, string, number, string][] = [
    ["Anyone else seeing AgentMail message.received webhooks arrive late? Started yesterday.", 9, 0, "reddit", 45, "unknown"],
    ["Webhook took 8 minutes to hit our endpoint today. Usually instant.", 8, 0, "reddit", 50, "webhook users"],
    ["Weird inbound lag this week — outbound sends seem fine.", 7, 0, "hacker_news", 48, "unknown"],
    ["AgentMail webhook delay again today. Our agent replies are getting slow.", 6, 0, "reddit", 55, "production agents"],
    ["Is there incident status anywhere? Inbound feels delayed all morning.", 6, 0, "hacker_news", 58, "webhook users"],
    ["Second day of delayed message.received events. Our support bot is lagging hard.", 4, 12, "reddit", 70, "production agents"],
    ["Webhooks arriving 10+ minutes late since yesterday evening. Ticket #4102.", 4, 6, "email", 72, "webhook users"],
    ["Considering polling as a fallback — webhook delays are breaking our SLAs.", 3, 18, "reddit", 70, "production agents"],
    ["AgentMail inbound latency is rough this week. Anyone else measuring this?", 3, 10, "hacker_news", 65, "unknown"],
    ["Our AI agent replied 20 minutes late to a customer because of webhook lag.", 3, 4, "reddit", 78, "production agents"],
    ["Delayed inbound since Tuesday-ish. Same volume, same endpoint on our side.", 2, 20, "hacker_news", 68, "webhook users"],
    ["Same here — message.received is consistently 10+ min behind.", 2, 14, "reddit", 66, "webhook users"],
    ["Nearly lost a customer today over late email replies. AgentMail webhook lag.", 2, 8, "email", 80, "production agents"],
    ["Multiple teams seeing delayed AgentMail webhooks this week.", 2, 2, "hacker_news", 72, "unknown"],
    ["Inbound webhook delays are getting worse, not better.", 1, 20, "reddit", 70, "webhook users"],
    ["Two customers complained about slow replies caused by AgentMail delays.", 1, 12, "email", 74, "production agents"],
    ["Webhook delivery delays reproducible across two of our inboxes and regions.", 1, 5, "hacker_news", 76, "webhook users"],
    ["/r/AI_Agents thread: AgentMail webhook delays — multiple confirmations.", 0, 8, "reddit", 78, "unknown"],
    ["Third escalation today about webhook delays. This is spreading.", 0, 4, "email", 84, "production agents"],
    ["Our delayed-webhook rate jumped 5x this week at constant volume.", 0, 1, "hacker_news", 82, "webhook users"],
  ];

  const acmeRamp: [string, number, number, string, number, string][] = [
    ["Checkout on Acme Assistant felt sluggish yesterday, desktop fine though.", 9, 0, "reddit", 45, "unknown"],
    ["Anyone's mobile checkout slow on Acme? Mine timed out once.", 8, 0, "reddit", 50, "mobile users"],
    ["Mobile web checkout hanging at payment. Worked around by using desktop.", 7, 0, "hacker_news", 55, "mobile users"],
    ["Acme Assistant checkout took ~15s on my phone this weekend.", 6, 0, "reddit", 50, "mobile users"],
    ["Seeing slow checkout on mobile too (Pixel/Chrome).", 6, 0, "hacker_news", 50, "mobile users"],
    ["Mobile checkout is genuinely broken for me now. 3 failures today.", 4, 12, "reddit", 70, "mobile users"],
    ["Second day in a row checkout hangs on mobile. Support chat no help.", 4, 6, "email", 72, "mobile users"],
    ["Can't upgrade plan — checkout spins forever on iOS.", 3, 18, "reddit", 70, "mobile users"],
    ["Acme Assistant mobile checkout = 30 second spinner. Desktop instant.", 3, 10, "hacker_news", 65, "mobile users"],
    ["Tried 4 times to check out on my phone. Gave up.", 3, 4, "reddit", 78, "mobile users"],
    ["Checkout on mobile unusable since Tuesday it seems.", 2, 20, "hacker_news", 68, "mobile users"],
    ["Same here — mobile checkout dead slow, desktop fine.", 2, 14, "reddit", 66, "mobile users"],
    ["Almost churned today because mobile checkout kept failing.", 2, 8, "email", 80, "mobile users"],
    ["Anyone else seeing Acme mobile checkout issues? Multiple reports in our Slack.", 2, 2, "hacker_news", 72, "mobile users"],
    ["Checkout latency on mobile is really bad this week.", 1, 20, "reddit", 70, "mobile users"],
    ["Two customers complained to us about slow mobile checkout on Acme.", 1, 12, "email", 74, "mobile users"],
    ["Mobile payments timing out on Acme Assistant. Reproducible on LTE+WiFi.", 1, 5, "hacker_news", 76, "mobile users"],
    ["/r/SaaS thread: Acme Assistant checkout slow on mobile — multiple confirmations.", 0, 8, "reddit", 78, "mobile users"],
    ["Third customer escalation today about mobile checkout. This is spreading.", 0, 4, "email", 84, "mobile users"],
    ["Mobile checkout timeout count on our side jumped 5x this week.", 0, 1, "hacker_news", 82, "mobile users"],
  ];

  return { firecrawl: firecrawlRamp, agentmail: agentmailRamp, acme: acmeRamp }[scenario];
}
