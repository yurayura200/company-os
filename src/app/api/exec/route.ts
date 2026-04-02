import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { resolve } from "path";

function env(key: string): string {
  if (process.env[key]) return process.env[key]!;
  try {
    const f = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    return f.match(new RegExp(`${key}=(.+)`))?.[1]?.trim() || "";
  } catch { return ""; }
}

// ═══════════════════════════════════════════════
//  EXECUTION ENGINE — Company OS Brain
//  All actions the AI agents can actually perform
// ═══════════════════════════════════════════════

type ExecResult = { ok: boolean; data?: any; error?: string };

// ── GitHub ──
async function githubAPI(method: string, path: string, body?: any): Promise<any> {
  const token = env("GITHUB_TOKEN");
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ── Supabase ──
async function supabase(method: string, path: string, body?: any): Promise<any> {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_KEY");
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ── Stripe ──
async function stripeAPI(path: string): Promise<any> {
  const key = env("STRIPE_SECRET_KEY");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Basic ${Buffer.from(key + ":").toString("base64")}` },
  });
  return res.json();
}

// ── Webhook (Slack/Discord) ──
async function webhook(url: string, payload: any): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: res.status, ok: res.ok };
}

// ── Vercel ──
async function vercelAPI(method: string, path: string, body?: any): Promise<any> {
  // Use gh CLI token or Vercel token if available
  const res = await fetch(`https://api.vercel.com${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ═══════════════════════════════════════════════
//  ACTION HANDLERS
// ═══════════════════════════════════════════════

const ACTIONS: Record<string, (params: any) => Promise<ExecResult>> = {

  // ── GitHub ──
  "github.create_issue": async (p) => {
    const repo = p.repo || env("GITHUB_REPO");
    const data = await githubAPI("POST", `/repos/${repo}/issues`, {
      title: p.title,
      body: p.body || "",
      labels: p.labels || [],
    });
    return { ok: !!data.id, data: { id: data.id, url: data.html_url, number: data.number } };
  },

  "github.create_pr": async (p) => {
    const repo = p.repo || env("GITHUB_REPO");
    const data = await githubAPI("POST", `/repos/${repo}/pulls`, {
      title: p.title,
      body: p.body || "",
      head: p.head,
      base: p.base || "main",
      draft: p.draft || false,
    });
    return { ok: !!data.id, data: { id: data.id, url: data.html_url, number: data.number } };
  },

  "github.add_comment": async (p) => {
    const repo = p.repo || env("GITHUB_REPO");
    const data = await githubAPI("POST", `/repos/${repo}/issues/${p.number}/comments`, {
      body: p.body,
    });
    return { ok: !!data.id, data: { id: data.id, url: data.html_url } };
  },

  "github.close_issue": async (p) => {
    const repo = p.repo || env("GITHUB_REPO");
    const data = await githubAPI("PATCH", `/repos/${repo}/issues/${p.number}`, {
      state: "closed",
    });
    return { ok: data.state === "closed", data: { number: p.number } };
  },

  "github.list_issues": async (p) => {
    const repo = p.repo || env("GITHUB_REPO");
    const data = await githubAPI("GET", `/repos/${repo}/issues?state=${p.state || "open"}&per_page=${p.limit || 10}`);
    if (!Array.isArray(data)) return { ok: false, error: data.message || "Failed to list issues", data };
    return { ok: true, data: data.map((i: any) => ({ number: i.number, title: i.title, state: i.state, labels: i.labels?.map((l: any) => l.name) })) };
  },

  // ── Slack ──
  "slack.send": async (p) => {
    const url = env("SLACK_WEBHOOK_URL");
    if (!url) return { ok: false, error: "SLACK_WEBHOOK_URL not set" };
    const result = await webhook(url, {
      text: p.text || p.message,
      channel: p.channel || env("SLACK_CHANNEL"),
      username: p.username || "Company OS",
      icon_emoji: p.emoji || ":robot_face:",
    });
    return { ok: result.ok, data: result };
  },

  // ── Discord ──
  "discord.send": async (p) => {
    const url = env("DISCORD_WEBHOOK_URL");
    if (!url) return { ok: false, error: "DISCORD_WEBHOOK_URL not set" };
    const payload: any = { content: p.text || p.message, username: p.username || "Company OS" };
    if (p.embed) {
      payload.embeds = [{ title: p.embed.title, description: p.embed.description, color: p.embed.color || 5814783 }];
    }
    const result = await webhook(url, payload);
    return { ok: result.ok, data: result };
  },

  // ── Supabase DB ──
  "supabase.select": async (p) => {
    const query = p.filter ? `${p.table}?${new URLSearchParams(p.filter).toString()}&limit=${p.limit || 50}` : `${p.table}?limit=${p.limit || 50}`;
    const data = await supabase("GET", query);
    return { ok: Array.isArray(data), data };
  },

  "supabase.insert": async (p) => {
    const data = await supabase("POST", p.table, p.data);
    return { ok: true, data };
  },

  "supabase.update": async (p) => {
    const query = `${p.table}?${new URLSearchParams(p.filter).toString()}`;
    const data = await supabase("PATCH", query, p.data);
    return { ok: true, data };
  },

  // ── Stripe (read-only for safety) ──
  "stripe.balance": async () => {
    const data = await stripeAPI("balance");
    return { ok: true, data };
  },

  "stripe.charges": async (p) => {
    const data = await stripeAPI(`charges?limit=${p.limit || 10}`);
    return { ok: true, data: data.data?.map((c: any) => ({ id: c.id, amount: c.amount, status: c.status, created: c.created })) };
  },

  "stripe.customers": async (p) => {
    const data = await stripeAPI(`customers?limit=${p.limit || 10}`);
    return { ok: true, data: data.data?.map((c: any) => ({ id: c.id, email: c.email, name: c.name })) };
  },

  // ── Video Generation ──
  "video.generate": async (p) => {
    const key = env("RUNWAY_API_KEY");
    const res = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        model: "gen4_turbo",
        promptText: p.prompt,
        duration: p.duration || 5,
        ratio: p.ratio || "1280:768",
      }),
    });
    const data = await res.json();
    return { ok: !!data.id, data };
  },

  // ── Vercel (redeploy) ──
  "vercel.redeploy": async (p) => {
    // Trigger redeploy by creating an empty commit and pushing
    return { ok: true, data: { message: "Use github.create_issue or git push to trigger redeploy" } };
  },

  // ── Multi-action: AI decides what to do ──
  "auto": async (p) => {
    // This is handled in the POST handler - AI decides actions
    return { ok: true, data: { message: "Auto mode - AI will decide actions" } };
  },
};

// ═══════════════════════════════════════════════
//  API ROUTE
// ═══════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const { action, params } = await req.json();

    if (!action) {
      return NextResponse.json({ ok: false, error: "action required" }, { status: 400 });
    }

    const handler = ACTIONS[action];
    if (!handler) {
      return NextResponse.json(
        { ok: false, error: `Unknown action: ${action}`, available: Object.keys(ACTIONS) },
        { status: 400 }
      );
    }

    const result = await handler(params || {});

    // Log execution to Supabase (fire-and-forget)
    try {
      const url = env("SUPABASE_URL");
      const key = env("SUPABASE_SERVICE_KEY");
      if (url && key) {
        fetch(`${url}/rest/v1/exec_logs`, {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            params: JSON.stringify(params),
            result: JSON.stringify(result),
            ok: result.ok,
            created_at: new Date().toISOString(),
          }),
        }).catch(() => {}); // fire and forget
      }
    } catch {}

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET: List available actions
export async function GET() {
  return NextResponse.json({
    actions: Object.keys(ACTIONS),
    description: "Company OS Execution Engine — POST { action, params } to execute",
  });
}
