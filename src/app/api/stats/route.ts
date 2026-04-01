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

// ── Stripe API ──
async function stripeFetch(path: string) {
  const key = getEnv("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Basic ${Buffer.from(key + ":").toString("base64")}` },
    next: { revalidate: 60 },
  });
  return res.json();
}

// ── Supabase API ──
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

export async function GET() {
  try {
    const now = new Date();
    const todayStart = Math.floor(new Date(now.toISOString().slice(0, 10)).getTime() / 1000);
    const monthStart = Math.floor(new Date(now.toISOString().slice(0, 7) + "-01").getTime() / 1000);

    // Parallel fetch: Stripe + Supabase
    const [charges, balanceTxns, balance, users, creditTxns] = await Promise.all([
      stripeFetch("charges?limit=100"),
      stripeFetch(`balance_transactions?limit=100&created[gte]=${monthStart}`),
      stripeFetch("balance"),
      supaFetch("users?select=id,plan,created_at"),
      supaFetch("credit_transactions?select=type,amount,created_at&order=created_at.desc&limit=200"),
    ]);

    // ── Revenue from Stripe (source of truth) ──
    const succeededCharges = (charges.data || []).filter((c: { status: string }) => c.status === "succeeded");
    const totalRevenue = succeededCharges.reduce((s: number, c: { amount: number }) => s + c.amount, 0);
    const todayCharges = succeededCharges.filter((c: { created: number }) => c.created >= todayStart);
    const todayRevenue = todayCharges.reduce((s: number, c: { amount: number }) => s + c.amount, 0);
    const monthCharges = succeededCharges.filter((c: { created: number }) => c.created >= monthStart);
    const monthRevenue = monthCharges.reduce((s: number, c: { amount: number }) => s + c.amount, 0);

    // ── Stripe fees (actual cost from Stripe) ──
    const totalFees = (balanceTxns.data || []).reduce((s: number, t: { fee: number }) => s + t.fee, 0);
    const todayFees = (balanceTxns.data || [])
      .filter((t: { created: number }) => t.created >= todayStart)
      .reduce((s: number, t: { fee: number }) => s + t.fee, 0);

    // ── Net from Stripe ──
    const totalNet = (balanceTxns.data || []).reduce((s: number, t: { net: number }) => s + t.net, 0);

    // ── Stripe Balance ──
    const availableBalance = (balance.available || []).reduce((s: number, b: { amount: number }) => s + b.amount, 0);
    const pendingBalance = (balance.pending || []).reduce((s: number, b: { amount: number }) => s + b.amount, 0);

    // ── Users from Supabase ──
    const todayStr = now.toISOString().slice(0, 10);
    const totalUsers = users.length;
    const todayUsers = users.filter((u: { created_at: string }) => u.created_at.startsWith(todayStr)).length;
    const planBreakdown = users.reduce((acc: Record<string, number>, u: { plan: string }) => {
      acc[u.plan] = (acc[u.plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // ── Credit usage from Supabase ──
    const totalCreditsUsed = (creditTxns || [])
      .filter((t: { type: string }) => t.type === "consume")
      .reduce((s: number, t: { amount: number }) => s + Math.abs(t.amount), 0);

    // ── API cost estimate (Anthropic, Runway, etc.) ──
    // Rough: ¥3 per credit for video gen API costs
    const apiCostEstimate = Math.round(totalCreditsUsed * 3);

    return NextResponse.json({
      // Stripe revenue (source of truth)
      revenue: {
        total: totalRevenue,
        today: todayRevenue,
        month: monthRevenue,
        charges: succeededCharges.length,
        todayCharges: todayCharges.length,
        monthCharges: monthCharges.length,
      },
      // Stripe fees & net
      stripe: {
        fees: totalFees,
        todayFees,
        net: totalNet,
        availableBalance,
        pendingBalance,
      },
      // Users from Supabase
      users: {
        total: totalUsers,
        today: todayUsers,
        plans: planBreakdown,
      },
      // Credit usage
      credits: {
        totalUsed: totalCreditsUsed,
        transactions: (creditTxns || []).length,
      },
      // Combined costs
      cost: {
        stripeFees: totalFees,
        apiEstimate: apiCostEstimate,
        total: totalFees + apiCostEstimate,
      },
      // Profit
      profit: {
        gross: totalRevenue,
        net: totalRevenue - totalFees - apiCostEstimate,
        today: todayRevenue - todayFees,
        stripeNet: totalNet,
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
