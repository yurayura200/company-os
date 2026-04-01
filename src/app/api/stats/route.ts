import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { resolve } from "path";

function getEnv(key: string): string {
  if (process.env[key]) return process.env[key]!;
  try {
    const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    const match = envFile.match(new RegExp(`${key}=(.+)`));
    return match?.[1]?.trim() || "";
  } catch { return ""; }
}

async function stripeFetch(path: string) {
  const key = getEnv("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Basic ${Buffer.from(key + ":").toString("base64")}` },
    next: { revalidate: 60 },
  });
  return res.json();
}

async function supaFetch(path: string) {
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_KEY");
  if (!url || !key) throw new Error("Supabase not configured");
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    next: { revalidate: 60 },
  });
  return res.json();
}

// ── API cost per video generation job ──
// Runway Gen-4: ~$0.50/5s = ¥75, Kling: ~$0.30/5s = ¥45
// ElevenLabs TTS: ~$0.30/1000chars = ¥45
// Average per job (video + narration): ~¥120
const COST_PER_VIDEO_JOB = 120;

// ── Anthropic Claude cost ──
// Sonnet: $3/1M input, $15/1M output ≈ ¥2.5/1K tokens avg
// Estimate per callClaude invocation: ~800 tokens = ¥2
const COST_PER_CLAUDE_CALL = 2;

// ── 月額サブスクリプション (固定費) ──
// ※ 実際に契約しているプランを反映。変更時はここを更新。
const SUBSCRIPTIONS = [
  { id: "claude_max",   name: "Claude Max",          monthly: 14400, note: "$100/mo" },
  { id: "runway",       name: "Runway Standard",     monthly: 4350,  note: "$30/mo" },
  { id: "elevenlabs",   name: "ElevenLabs Starter",  monthly: 750,   note: "$5/mo" },
  { id: "supabase",     name: "Supabase Free",       monthly: 0,     note: "Free tier" },
  { id: "vercel",       name: "Vercel Hobby",        monthly: 0,     note: "Free tier" },
  { id: "r2",           name: "Cloudflare R2",       monthly: 50,    note: "~2GB stored" },
  { id: "domain",       name: "ドメイン (.com)",      monthly: 150,   note: "~¥1,800/year" },
];
const TOTAL_SUBSCRIPTIONS = SUBSCRIPTIONS.reduce((s, sub) => s + sub.monthly, 0);

export async function GET() {
  try {
    const now = new Date();
    const todayStart = Math.floor(new Date(now.toISOString().slice(0, 10)).getTime() / 1000);
    const monthStart = Math.floor(new Date(now.toISOString().slice(0, 7) + "-01").getTime() / 1000);
    const todayStr = now.toISOString().slice(0, 10);

    const [charges, balanceTxns, balance, users, creditTxns, jobs] = await Promise.all([
      stripeFetch("charges?limit=100"),
      stripeFetch(`balance_transactions?limit=100`),
      stripeFetch("balance"),
      supaFetch("users?select=id,plan,created_at"),
      supaFetch("credit_transactions?select=type,amount,created_at&order=created_at.desc&limit=500"),
      supaFetch("jobs?select=id,status,created_at&order=created_at.desc&limit=500"),
    ]);

    // ══ REVENUE (Stripe = source of truth) ══
    const succeeded = (charges.data || []).filter((c: { status: string }) => c.status === "succeeded");
    const totalRevenue = succeeded.reduce((s: number, c: { amount: number }) => s + c.amount, 0);
    const todayRevenue = succeeded
      .filter((c: { created: number }) => c.created >= todayStart)
      .reduce((s: number, c: { amount: number }) => s + c.amount, 0);
    const monthRevenue = succeeded
      .filter((c: { created: number }) => c.created >= monthStart)
      .reduce((s: number, c: { amount: number }) => s + c.amount, 0);

    // ══ STRIPE FEES (actual) ══
    const allTxns = balanceTxns.data || [];
    const monthTxns = allTxns.filter((t: { created: number }) => t.created >= monthStart);
    const totalFees = allTxns.reduce((s: number, t: { fee: number }) => s + t.fee, 0);
    const monthFees = monthTxns.reduce((s: number, t: { fee: number }) => s + t.fee, 0);
    const todayFees = allTxns
      .filter((t: { created: number }) => t.created >= todayStart)
      .reduce((s: number, t: { fee: number }) => s + t.fee, 0);
    const totalNet = allTxns.reduce((s: number, t: { net: number }) => s + t.net, 0);

    // ══ STRIPE BALANCE ══
    const availableBalance = (balance.available || []).reduce((s: number, b: { amount: number }) => s + b.amount, 0);
    const pendingBalance = (balance.pending || []).reduce((s: number, b: { amount: number }) => s + b.amount, 0);

    // ══ USERS (Supabase) ══
    const totalUsers = users.length;
    const todayUsers = users.filter((u: { created_at: string }) => u.created_at.startsWith(todayStr)).length;
    const plans = users.reduce((acc: Record<string, number>, u: { plan: string }) => {
      acc[u.plan] = (acc[u.plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // ══ API COSTS (calculated from actual usage) ══

    // Video generation jobs → Runway/Kling cost
    const completedJobs = (jobs || []).filter((j: { status: string }) => j.status === "done" || j.status === "preview_done");
    const videoApiCost = completedJobs.length * COST_PER_VIDEO_JOB;

    // Claude API calls (estimate from credit consume transactions = 1 call per consume)
    const consumeTxns = (creditTxns || []).filter((t: { type: string }) => t.type === "consume");
    const claudeApiCost = consumeTxns.length * COST_PER_CLAUDE_CALL;

    // Total variable API costs (per-use)
    const variableApiCost = videoApiCost + claudeApiCost;

    // ══ TOTAL COSTS ══
    const totalCost = totalFees + variableApiCost + TOTAL_SUBSCRIPTIONS;

    return NextResponse.json({
      revenue: {
        total: totalRevenue,
        today: todayRevenue,
        month: monthRevenue,
        charges: succeeded.length,
      },
      stripe: {
        fees: totalFees,
        monthFees,
        todayFees,
        net: totalNet,
        availableBalance,
        pendingBalance,
        feeRate: totalRevenue > 0 ? Math.round(totalFees / totalRevenue * 1000) / 10 : 0,
      },
      users: {
        total: totalUsers,
        today: todayUsers,
        plans,
      },
      apiCosts: {
        video: { jobs: completedJobs.length, cost: videoApiCost, label: "Runway/Kling 動画生成" },
        claude: { calls: consumeTxns.length, cost: claudeApiCost, label: "Claude API (従量)" },
        variableTotal: variableApiCost,
      },
      subscriptions: {
        items: SUBSCRIPTIONS,
        total: TOTAL_SUBSCRIPTIONS,
      },
      cost: {
        stripeFees: totalFees,
        variableApi: variableApiCost,
        subscriptions: TOTAL_SUBSCRIPTIONS,
        total: totalCost,
      },
      profit: {
        gross: totalRevenue,
        net: totalRevenue - totalCost,
        today: todayRevenue - todayFees,
        month: monthRevenue - monthFees - variableApiCost - TOTAL_SUBSCRIPTIONS,
        stripeNet: totalNet,
      },
      usage: {
        creditsConsumed: consumeTxns.reduce((s: number, t: { amount: number }) => s + Math.abs(t.amount), 0),
        creditsRefunded: (creditTxns || [])
          .filter((t: { type: string }) => t.type === "refund")
          .reduce((s: number, t: { amount: number }) => s + Math.abs(t.amount), 0),
        videoJobs: completedJobs.length,
        totalTransactions: (creditTxns || []).length,
      },
      updatedAt: now.toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
