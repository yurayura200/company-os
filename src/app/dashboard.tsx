"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   DESIGN TOKENS
============================================================ */
const FONT = "'Press Start 2P', monospace";
const MONO = "'DM Mono', 'Courier New', monospace";
const C = {
  bg:"#050810", panel:"#080d18", border:"#0f2040",
  dev:"#22d3ee", pr:"#ec4899", sales:"#f59e0b", sec:"#4ade80",
  finance:"#facc15", product:"#a78bfa", ai:"#f97316", data:"#38bdf8",
  hr:"#fb7185", marketing:"#c084fc", legal:"#94a3b8", cs:"#34d399",
  japan:"#ff6b6b", content:"#fbbf24", research:"#818cf8",
  automation:"#2dd4bf", partner:"#e879f9",
  text:"#e2e8f0", muted:"#475569", dim:"#1e293b",
};

/* ============================================================
   CLAUDE API
============================================================ */
async function callClaude(system, user, onChunk) {
  const res = await fetch("/api/claude", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ system, user }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream:true });
    const lines = buf.split("\n"); buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const d = line.slice(6).trim();
      if (d === "[DONE]") return;
      try { const j = JSON.parse(d); if (j.delta?.text) onChunk(j.delta.text); } catch {}
    }
  }
}

/* ============================================================
   SHARED UI
============================================================ */
const Dot = ({ color, pulse, size=6 }) => (
  <div style={{ width:size, height:size, borderRadius:"50%", background:color,
    boxShadow:`0 0 ${size}px ${color}`, animation:pulse?"pulse 2s infinite":"none", flexShrink:0 }}/>
);
const Badge = ({ children, color }) => (
  <span style={{ fontFamily:FONT, fontSize:4, color, border:`1px solid ${color}`,
    padding:"2px 6px", boxShadow:`0 0 6px ${color}22` }}>{children}</span>
);
const Tag = ({ label, color }) => (
  <span style={{ fontFamily:MONO, fontSize:10, color, background:`${color}18`,
    padding:"2px 8px", borderRadius:2, border:`1px solid ${color}33` }}>{label}</span>
);
const ProgressBar = ({ value, color, height=4 }) => (
  <div style={{ height, background:C.border, borderRadius:2, overflow:"hidden" }}>
    <div style={{ height:"100%", width:`${Math.min(value,100)}%`, borderRadius:2, transition:"width 0.6s",
      background:`linear-gradient(90deg,${color}77,${color})`,
      boxShadow:value>=100?`0 0 6px ${color}`:"none" }}/>
  </div>
);
const Card = ({ children, accent, style={} }) => (
  <div style={{ background:C.panel, border:`1px solid ${accent?accent+"44":C.border}`,
    borderRadius:3, boxShadow:accent?`0 0 16px ${accent}08`:"none", ...style }}>{children}</div>
);
const SectionTitle = ({ children, color }) => (
  <div style={{ fontFamily:FONT, fontSize:5.5, color, borderBottom:`1px solid ${color}33`,
    paddingBottom:6, marginBottom:10, letterSpacing:"0.15em" }}>{children}</div>
);
const StatCard = ({ label, value, sub, color, trend }) => (
  <Card accent={color} style={{ padding:"14px 16px" }}>
    <div style={{ fontFamily:MONO, fontSize:10, color:C.muted, marginBottom:6 }}>{label}</div>
    <div style={{ fontFamily:FONT, fontSize:17, color, marginBottom:4 }}>{value}</div>
    {sub && <div style={{ fontFamily:MONO, fontSize:10, color:C.muted }}>{sub}</div>}
    {trend !== undefined && (
      <div style={{ fontFamily:MONO, fontSize:10, color:trend>=0?C.sec:"#ef4444", marginTop:4 }}>
        {trend>=0?"▲":""}{trend}%
      </div>
    )}
  </Card>
);
const DeptHeader = ({ color, icon, title, subtitle, badges=[] }) => (
  <div style={{ padding:"12px 20px", borderBottom:`1px solid ${C.border}`,
    display:"flex", alignItems:"center", gap:12, flexShrink:0,
    background:`${color}08`, borderLeft:`3px solid ${color}` }}>
    <span style={{ fontSize:20 }}>{icon}</span>
    <div>
      <div style={{ fontFamily:FONT, fontSize:8, color }}>{title}</div>
      <div style={{ fontFamily:MONO, fontSize:11, color:C.muted, marginTop:3 }}>{subtitle}</div>
    </div>
    <div style={{ marginLeft:"auto", display:"flex", gap:7, flexWrap:"wrap" }}>
      {badges.map(b=><Badge key={b} color={color}>{b}</Badge>)}
    </div>
  </div>
);
const TabBar = ({ tabs, active, setActive, color }) => (
  <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`,
    padding:"0 20px", flexShrink:0, overflowX:"auto" }}>
    {tabs.map(t=>(
      <button key={t.k} onClick={()=>setActive(t.k)} style={{
        fontFamily:FONT, fontSize:5, padding:"10px 13px", background:"transparent", border:"none",
        borderBottom:active===t.k?`2px solid ${color}`:"2px solid transparent",
        color:active===t.k?color:C.muted, cursor:"pointer", whiteSpace:"nowrap",
      }}>{t.l}</button>
    ))}
  </div>
);
const Sparkline = ({ data, color, width=120, height=32 }) => {
  const max=Math.max(...data), min=Math.min(...data), range=max-min||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*width},${height-((v-min)/range)*(height-4)+2}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display:"block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}
        style={{ filter:`drop-shadow(0 0 3px ${color})` }}/>
      <circle cx={width} cy={height-((data[data.length-1]-min)/range)*(height-4)+2} r={3} fill={color}/>
    </svg>
  );
};
const BarChart = ({ data, color, height=100 }) => {
  const max = Math.max(...data.map(d=>d.value));
  return (
    <svg width="100%" height={height+20} viewBox={`0 0 ${data.length*36} ${height+20}`}>
      {data.map((d,i)=>{
        const h=Math.round((d.value/max)*(height-10));
        return (
          <g key={i}>
            <rect x={i*36+4} y={height-h} width={28} height={h} fill={d.highlight?color:color+"55"} rx={2}/>
            <text x={i*36+18} y={height+14} textAnchor="middle" fontSize={7} fill={C.muted} fontFamily={MONO}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
};
const Donut = ({ segments, size=100 }) => {
  const r=38, cx=size/2, cy=size/2, circ=2*Math.PI*r;
  let offset=0;
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={10}/>
      {segments.map((s,i)=>{
        const dash=(s.pct/100)*circ;
        const el=<circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={10}
          strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={-offset*circ/100}
          transform={`rotate(-90 ${cx} ${cy})`} style={{ filter:`drop-shadow(0 0 4px ${s.color}66)` }}/>;
        offset+=s.pct; return el;
      })}
    </svg>
  );
};
const AIBtn = ({ onClick, loading, color, children }) => (
  <button onClick={onClick} disabled={loading} style={{
    display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
    background:`${color}22`, border:`1px solid ${color}`, borderRadius:2,
    fontFamily:FONT, fontSize:5, color, cursor:loading?"not-allowed":"pointer",
    boxShadow:loading?"none":`0 0 10px ${color}22`, opacity:loading?0.7:1,
  }}>
    {loading ? <><span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>◌</span> 生成中...</> : <>✦ {children}</>}
  </button>
);

function useClock() {
  const [t,setT]=useState(new Date());
  useEffect(()=>{ const i=setInterval(()=>setT(new Date()),1000); return()=>clearInterval(i); },[]);
  return t;
}

/* ============================================================
   NOTIFICATION CENTER
============================================================ */
const NOTIF_TYPES = {
  dev:{color:C.dev,icon:"⌨"}, pr:{color:C.pr,icon:"◈"}, sales:{color:C.sales,icon:"◆"},
  secretary:{color:C.sec,icon:"◇"}, finance:{color:C.finance,icon:"💰"},
  product:{color:C.product,icon:"📦"}, ai:{color:C.ai,icon:"🤖"},
  data:{color:C.data,icon:"📊"}, system:{color:"#94a3b8",icon:"⊞"},
};
const INIT_NOTIFS = [
  {id:1,dept:"dev",title:"PR #142 マージ待ち",body:"佐藤さんからレビューリクエスト",time:"14:32",read:false,urgent:true},
  {id:2,dept:"pr",title:"15:00 投稿スケジュール",body:"TikTok・Threads・X 3本が予定中",time:"14:20",read:false,urgent:false},
  {id:3,dept:"finance",title:"月次MRR 更新",body:"今月 ¥640,000 — 目標達成 ✓",time:"14:10",read:false,urgent:false},
  {id:4,dept:"sales",title:"A社 田中様から返信",body:"ご提案の件、前向きに検討します",time:"14:15",read:true,urgent:true},
  {id:5,dept:"ai",title:"Claude API コスト警告",body:"本日コスト ¥5,580 — 上限の 56%",time:"13:55",read:true,urgent:false},
  {id:6,dept:"system",title:"全デバイス同期完了",body:"Windows / Mac / iPhone 最新状態",time:"13:00",read:true,urgent:false},
];
function NotificationPanel({ notifs, setNotifs, onClose }) {
  const unread=notifs.filter(n=>!n.read).length;
  return (
    <div style={{ position:"fixed",top:40,right:0,bottom:0,width:320,background:C.panel,
      borderLeft:`1px solid ${C.border}`,zIndex:500,display:"flex",flexDirection:"column",
      boxShadow:"-8px 0 32px rgba(0,0,0,0.6)",animation:"slideIn 0.2s ease" }}>
      <div style={{ padding:"12px 16px",borderBottom:`1px solid ${C.border}`,
        display:"flex",alignItems:"center",gap:10,flexShrink:0 }}>
        <span style={{ fontFamily:FONT,fontSize:6,color:C.text }}>通知センター</span>
        {unread>0&&<div style={{ background:C.pr,borderRadius:10,padding:"1px 6px",fontFamily:FONT,fontSize:4,color:"#fff" }}>{unread}</div>}
        <div style={{ flex:1 }}/>
        {unread>0&&<button onClick={()=>setNotifs(p=>p.map(n=>({...n,read:true})))}
          style={{ fontFamily:FONT,fontSize:4,color:C.muted,background:"transparent",border:"none",cursor:"pointer" }}>すべて既読</button>}
        <button onClick={onClose} style={{ fontFamily:FONT,fontSize:5,color:C.muted,
          background:"transparent",border:"none",cursor:"pointer",padding:"2px 6px" }}>✕</button>
      </div>
      <div style={{ flex:1,overflowY:"auto",padding:12 }}>
        {notifs.map(n=>{
          const cfg=NOTIF_TYPES[n.dept]||NOTIF_TYPES.system;
          return (
            <div key={n.id} onClick={()=>setNotifs(p=>p.map(x=>x.id===n.id?{...x,read:true}:x))}
              style={{ padding:"10px 12px",marginBottom:8,borderRadius:2,cursor:"pointer",
                background:n.read?"transparent":`${cfg.color}08`,
                border:`1px solid ${n.read?C.border:cfg.color+"44"}`,position:"relative" }}>
              {!n.read&&<div style={{ position:"absolute",left:0,top:0,bottom:0,width:3,background:cfg.color,borderRadius:"2px 0 0 2px" }}/>}
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4,paddingLeft:n.read?0:6 }}>
                <span style={{ fontSize:12 }}>{cfg.icon}</span>
                <span style={{ fontFamily:FONT,fontSize:5,color:cfg.color,flex:1 }}>{n.title}</span>
                {n.urgent&&<Badge color={C.pr}>急ぎ</Badge>}
                <span style={{ fontFamily:MONO,fontSize:9,color:C.muted }}>{n.time}</span>
                <button onClick={e=>{e.stopPropagation();setNotifs(p=>p.filter(x=>x.id!==n.id));}}
                  style={{ background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:10 }}>✕</button>
              </div>
              <div style={{ fontFamily:MONO,fontSize:10,color:n.read?C.muted:C.text,
                lineHeight:1.7,paddingLeft:n.read?20:26 }}>{n.body}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   TOP BAR
============================================================ */
const ALL_DEPTS = [
  {id:"floor",    label:"FLOOR",  icon:"⊞", color:"#94a3b8"},
  {id:"dev",      label:"開発部", icon:"⌨", color:C.dev},
  {id:"pr",       label:"広報部", icon:"◈", color:C.pr},
  {id:"sales",    label:"営業部", icon:"◆", color:C.sales},
  {id:"secretary",label:"秘書室", icon:"◇", color:C.sec},
  {id:"finance",  label:"財務部", icon:"💰", color:C.finance},
  {id:"product",  label:"PdM",   icon:"📦", color:C.product},
  {id:"ai",       label:"AI部",  icon:"🤖", color:C.ai},
  {id:"data",     label:"データ",icon:"📊", color:C.data},
  {id:"hr",       label:"HR",      icon:"👥", color:C.hr},
  {id:"marketing",label:"マーケ",  icon:"🎯", color:C.marketing},
  {id:"legal",    label:"法務",    icon:"🛡", color:C.legal},
  {id:"cs",       label:"CS",      icon:"🤝", color:C.cs},
  {id:"japan",    label:"JP市場",  icon:"🇯🇵", color:C.japan},
  {id:"content",  label:"コンテンツ",icon:"🎬",color:C.content},
  {id:"research", label:"リサーチ", icon:"🔬", color:C.research},
  {id:"automation",label:"自動化", icon:"🤖", color:C.automation},
  {id:"partner",  label:"パートナー",icon:"🌐",color:C.partner},
];
function TopBar({ screen, setScreen, notifCount, onBell }) {
  const clock=useClock();
  const fmt=d=>d.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  return (
    <div style={{ height:40,background:C.panel,borderBottom:`1px solid ${C.border}`,
      display:"flex",alignItems:"center",paddingLeft:12,gap:0,flexShrink:0,overflowX:"auto" }}>
      <div style={{ display:"flex",alignItems:"center",gap:7,marginRight:14,flexShrink:0 }}>
        <svg width={14} height={14}>
          {[["#22d3ee",0,0],["#ec4899",7,0],["#f59e0b",0,7],["#4ade80",7,7]].map(([c,x,y])=>(
            <rect key={c+x} x={x} y={y} width={6} height={6} fill={c} rx={0.5}/>
          ))}
        </svg>
        <span style={{ fontFamily:FONT,fontSize:5,color:"#64748b",letterSpacing:"0.12em",whiteSpace:"nowrap" }}>CO.</span>
      </div>
      {ALL_DEPTS.map(n=>{
        const active=screen===n.id;
        return (
          <button key={n.id} onClick={()=>setScreen(n.id)} style={{
            background:active?`${n.color}18`:"transparent",border:"none",
            borderBottom:active?`2px solid ${n.color}`:"2px solid transparent",
            padding:"0 10px",height:40,fontFamily:FONT,fontSize:4.5,
            color:active?n.color:C.muted,cursor:"pointer",
            display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap",flexShrink:0,
          }}>
            <span style={{ fontSize:9 }}>{n.icon}</span>{n.label}
          </button>
        );
      })}
      <div style={{ flex:1,minWidth:20 }}/>
      <div style={{ display:"flex",alignItems:"center",gap:10,paddingRight:12,flexShrink:0 }}>
        <Dot color="#4ade80" pulse size={5}/>
        <button onClick={onBell} style={{ position:"relative",background:"transparent",
          border:`1px solid ${C.border}`,borderRadius:2,padding:"3px 9px",cursor:"pointer",
          color:notifCount>0?C.pr:C.muted,fontSize:13,boxShadow:notifCount>0?`0 0 8px ${C.pr}44`:"none" }}>
          🔔
          {notifCount>0&&<div style={{ position:"absolute",top:-5,right:-5,background:C.pr,
            borderRadius:10,minWidth:15,height:15,display:"flex",alignItems:"center",justifyContent:"center",
            fontFamily:FONT,fontSize:4,color:"#fff",padding:"0 3px" }}>{notifCount}</div>}
        </button>
        <span style={{ fontFamily:MONO,fontSize:11,color:C.dev,letterSpacing:"0.08em" }}>{fmt(clock)}</span>
      </div>
    </div>
  );
}

/* ============================================================
   SIDEBAR
============================================================ */
const MEMBERS_DATA = [
  {name:"田中",dept:"dev",      color:C.dev,    online:true, task:"PR #142 レビュー"},
  {name:"佐藤",dept:"dev",      color:C.dev,    online:true, task:"UI コンポーネント"},
  {name:"鈴木",dept:"dev",      color:C.dev,    online:false,task:null},
  {name:"山田",dept:"pr",       color:C.pr,     online:true, task:"TikTok 動画編集"},
  {name:"伊藤",dept:"pr",       color:C.pr,     online:true, task:"note 原稿"},
  {name:"中村",dept:"sales",    color:C.sales,  online:true, task:"A社 提案書"},
  {name:"小林",dept:"sales",    color:C.sales,  online:true, task:"B社 フォロー"},
  {name:"加藤",dept:"sales",    color:C.sales,  online:false,task:null},
  {name:"松本",dept:"secretary",color:C.sec,    online:true, task:"カレンダー同期"},
  {name:"橋本",dept:"finance",  color:C.finance,online:true, task:"月次P/L確認"},
  {name:"木村",dept:"product",  color:C.product,online:true, task:"S2 ロードマップ"},
  {name:"石井",dept:"ai",       color:C.ai,     online:true, task:"APIコスト最適化"},
];
function Sidebar({ screen }) {
  const col=ALL_DEPTS.find(d=>d.id===screen)?.color||C.dev;
  const list=screen==="floor"?MEMBERS_DATA:MEMBERS_DATA.filter(m=>m.dept===screen);
  return (
    <div style={{ width:148,background:C.panel,borderRight:`1px solid ${C.border}`,
      display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden" }}>
      <div style={{ flex:1,overflowY:"auto",padding:"10px 8px" }}>
        <SectionTitle color={col}>ONLINE</SectionTitle>
        {list.map(m=>(
          <div key={m.name} style={{ display:"flex",gap:6,alignItems:"flex-start",
            padding:"5px 4px",borderBottom:`1px solid ${C.border}` }}>
            <div style={{ marginTop:2 }}><Dot color={m.online?m.color:C.dim} pulse={m.online} size={5}/></div>
            <div>
              <div style={{ fontFamily:FONT,fontSize:4.5,color:m.online?C.text:C.muted }}>{m.name}</div>
              {m.task&&<div style={{ fontFamily:MONO,fontSize:9,color:C.muted,marginTop:2 }}>{m.task}</div>}
            </div>
          </div>
        ))}
        <div style={{ marginTop:16 }}>
          <SectionTitle color={col}>DEVICES</SectionTitle>
          {[{l:"Windows",ok:true},{l:"MacBook",ok:true},{l:"iPhone",ok:true},
            {l:"Vercel",ok:true},{l:"GitHub",ok:true},{l:"Supabase",ok:true}].map(d=>(
            <div key={d.l} style={{ display:"flex",alignItems:"center",gap:5,
              padding:"4px 4px",borderBottom:`1px solid ${C.border}` }}>
              <Dot color={d.ok?"#4ade80":C.muted} pulse={d.ok} size={4}/>
              <span style={{ fontFamily:FONT,fontSize:4,color:d.ok?"#4b6b5a":C.muted }}>{d.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   FLOOR
============================================================ */
function FloorScreen({ setScreen }) {
  const ALL_ROOMS=[
    {id:"dev",color:C.dev,label:"開発部",icon:"⌨",desc:"コード・デプロイ・PR"},
    {id:"pr",color:C.pr,label:"広報部",icon:"◈",desc:"SNS・AI投稿生成"},
    {id:"sales",color:C.sales,label:"営業部",icon:"◆",desc:"AIメール・商談CRM"},
    {id:"secretary",color:C.sec,label:"秘書室",icon:"◇",desc:"カレンダー管理"},
    {id:"finance",color:C.finance,label:"財務部",icon:"💰",desc:"Stripe・APIコスト"},
    {id:"product",color:C.product,label:"PdM",icon:"📦",desc:"3プロダクト横断"},
    {id:"ai",color:C.ai,label:"AI部",icon:"🤖",desc:"API監視・品質"},
    {id:"data",color:C.data,label:"データ部",icon:"📊",desc:"分析・BI・コホート"},
    {id:"hr",color:C.hr,label:"HR / 採用部",icon:"👥",desc:"採用・オンボーディング"},
    {id:"marketing",color:C.marketing,label:"マーケ部",icon:"🎯",desc:"広告・SEO・LP"},
    {id:"legal",color:C.legal,label:"法務部",icon:"🛡",desc:"コンプラ・利用規約"},
    {id:"cs",color:C.cs,label:"CS部",icon:"🤝",desc:"チケット・FAQ・AI返信"},
    {id:"japan",color:C.japan,label:"JP市場部",icon:"🇯🇵",desc:"日本市場特化"},
    {id:"content",color:C.content,label:"コンテンツ",icon:"🎬",desc:"動画・記事・量産"},
    {id:"research",color:C.research,label:"リサーチ部",icon:"🔬",desc:"トレンド・競合分析"},
    {id:"automation",color:C.automation,label:"自動化部",icon:"🤖",desc:"ボット・スケジューラ"},
    {id:"partner",color:C.partner,label:"パートナー",icon:"🌐",desc:"API連携・代理店"},
  ];
  return (
    <div style={{ flex:1,overflow:"auto",padding:20 }}>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20 }}>
        {ALL_ROOMS.map(r=>(
          <div key={r.id} onClick={()=>setScreen(r.id)} style={{
            cursor:"pointer",border:`2px solid ${r.color}44`,borderRadius:3,
            overflow:"hidden",background:C.panel,transition:"all 0.15s",
          }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=r.color;e.currentTarget.style.boxShadow=`0 0 16px ${r.color}33`;}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=r.color+"44";e.currentTarget.style.boxShadow="none";}}>
            <div style={{ height:90,background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",position:"relative" }}>
              <span style={{ fontSize:30,filter:`drop-shadow(0 0 10px ${r.color})` }}>{r.icon}</span>
              <div style={{ position:"absolute",top:5,right:8,display:"flex",gap:3,alignItems:"center" }}>
                <Dot color="#4ade80" pulse size={4}/>
              </div>
            </div>
            <div style={{ padding:"8px 12px",background:`${r.color}10`,borderTop:`1px solid ${r.color}33` }}>
              <div style={{ fontFamily:FONT,fontSize:6,color:r.color,marginBottom:2 }}>{r.label}</div>
              <div style={{ fontFamily:MONO,fontSize:9,color:C.muted }}>{r.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10 }}>
        {[
          {l:"オンライン",v:"10/12",c:C.dev},{l:"MRR",v:"¥64万",c:C.finance},
          {l:"AI API/日",v:"4,218",c:C.ai},{l:"総ユーザー",v:"2,040",c:C.data},
        ].map(s=>(
          <Card key={s.l} accent={s.c} style={{ padding:"12px 14px",textAlign:"center" }}>
            <div style={{ fontFamily:FONT,fontSize:15,color:s.c,marginBottom:5 }}>{s.v}</div>
            <div style={{ fontFamily:MONO,fontSize:9,color:C.muted }}>{s.l}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   DEV — ポモドーロ込み
============================================================ */
const POMO_MODES=[{key:"work",label:"作業",min:25,color:C.dev},{key:"short",label:"短休憩",min:5,color:C.sec},{key:"long",label:"長休憩",min:15,color:"#a855f7"}];
function PomodoroTimer({ pushNotif }) {
  const [mi,setMi]=useState(0);
  const [secs,setSecs]=useState(25*60);
  const [running,setRunning]=useState(false);
  const [rounds,setRounds]=useState(0);
  const [task,setTask]=useState("ゲームアプリ UI 実装");
  const [log,setLog]=useState([]);
  const ref=useRef(null);
  const mode=POMO_MODES[mi];
  const total=mode.min*60;
  const pct=((total-secs)/total)*100;
  const mm=String(Math.floor(secs/60)).padStart(2,"0");
  const ss=String(secs%60).padStart(2,"0");
  useEffect(()=>{
    if(!running) return;
    ref.current=setInterval(()=>{
      setSecs(s=>{
        if(s<=1){
          clearInterval(ref.current); setRunning(false);
          const nr=rounds+1; setRounds(nr);
          const msg=mode.key==="work"?`✓ ${task} ${mode.min}分完了 (${nr}セット目)`:"休憩終了！";
          setLog(p=>[{text:msg,time:new Date().toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"}),col:mode.color},...p.slice(0,9)]);
          pushNotif("dev",mode.key==="work"?"作業セット完了":"休憩終了",msg);
          const next=mode.key==="work"?(nr%4===0?2:1):0;
          setMi(next); setSecs(POMO_MODES[next].min*60); return 0;
        }
        return s-1;
      });
    },1000);
    return()=>clearInterval(ref.current);
  },[running,mode,task,rounds]);
  const switchMode=i=>{clearInterval(ref.current);setRunning(false);setMi(i);setSecs(POMO_MODES[i].min*60);};
  const R=54,circ=2*Math.PI*R,dash=circ*(1-pct/100);
  return (
    <Card accent={mode.color} style={{ padding:20,maxWidth:420 }}>
      <SectionTitle color={mode.color}>🍅 ポモドーロタイマー</SectionTitle>
      <div style={{ display:"flex",gap:6,marginBottom:16 }}>
        {POMO_MODES.map((m,i)=>(
          <button key={m.key} onClick={()=>switchMode(i)} style={{
            flex:1,padding:"5px 0",fontFamily:FONT,fontSize:4.5,
            background:mi===i?`${m.color}22`:"transparent",
            border:`1px solid ${mi===i?m.color:C.border}`,
            color:mi===i?m.color:C.muted,cursor:"pointer",borderRadius:2,
          }}>{m.label}</button>
        ))}
      </div>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:5 }}>現在のタスク</div>
        <input value={task} onChange={e=>setTask(e.target.value)} style={{
          width:"100%",background:"#030810",border:`1px solid ${mode.color}44`,
          color:C.text,fontFamily:MONO,fontSize:11,padding:"6px 10px",borderRadius:2,boxSizing:"border-box",
        }}/>
      </div>
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",marginBottom:16 }}>
        <svg width={130} height={130} style={{ transform:"rotate(-90deg)" }}>
          <circle cx={65} cy={65} r={R} fill="none" stroke={C.border} strokeWidth={8}/>
          <circle cx={65} cy={65} r={R} fill="none" stroke={mode.color} strokeWidth={8}
            strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
            style={{ transition:"stroke-dashoffset 0.9s ease",filter:`drop-shadow(0 0 6px ${mode.color})` }}/>
        </svg>
        <div style={{ marginTop:-75,fontFamily:FONT,fontSize:22,color:mode.color,
          letterSpacing:"0.1em",textShadow:`0 0 20px ${mode.color}` }}>{mm}:{ss}</div>
        <div style={{ fontFamily:MONO,fontSize:10,color:C.muted,marginTop:4 }}>{mode.label} · {rounds}セット完了</div>
      </div>
      <div style={{ display:"flex",gap:8,marginBottom:16 }}>
        <button onClick={()=>setRunning(r=>!r)} style={{
          flex:2,padding:"10px",fontFamily:FONT,fontSize:6,
          background:`${mode.color}22`,border:`1px solid ${mode.color}`,
          color:mode.color,cursor:"pointer",borderRadius:2,boxShadow:`0 0 12px ${mode.color}22`,
        }}>{running?"⏸ 一時停止":"▶ スタート"}</button>
        <button onClick={()=>{clearInterval(ref.current);setRunning(false);setSecs(mode.min*60);}} style={{
          flex:1,padding:"10px",fontFamily:FONT,fontSize:5,
          background:"transparent",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",borderRadius:2,
        }}>↺</button>
      </div>
      {log.length>0&&(
        <div style={{ borderTop:`1px solid ${C.border}`,paddingTop:10 }}>
          {log.slice(0,4).map((l,i)=>(
            <div key={i} style={{ display:"flex",gap:8,marginBottom:5 }}>
              <span style={{ fontFamily:MONO,fontSize:9,color:C.muted,flexShrink:0 }}>{l.time}</span>
              <span style={{ fontFamily:MONO,fontSize:10,color:l.col,lineHeight:1.6 }}>{l.text}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
const DEV_TASKS_INIT=[
  {id:1,title:"ゲームアプリ UI 実装",  progress:85, status:"in_progress",assignee:"佐藤"},
  {id:2,title:"API エンドポイント設計", progress:100,status:"done",       assignee:"鈴木"},
  {id:3,title:"テストカバレッジ 80%",   progress:62, status:"in_progress",assignee:"鈴木"},
  {id:4,title:"ステージング デプロイ",  progress:0,  status:"todo",       assignee:"田中"},
  {id:5,title:"モバイル対応 (PWA)",    progress:30, status:"in_progress",assignee:"佐藤"},
];
function DevScreen({ pushNotif }) {
  const [tasks,setTasks]=useState(DEV_TASKS_INIT);
  const [tab,setTab]=useState("tasks");
  const sC=s=>({done:C.dev,in_progress:"#f59e0b",todo:C.muted})[s];
  const sL=s=>({done:"完了",in_progress:"進行中",todo:"未着手"})[s];
  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
      <DeptHeader color={C.dev} icon="⌨" title="開発部 / DEV" subtitle="3名オンライン · PR #142 レビュー待ち" badges={["Next.js 14","Supabase","Vercel"]}/>
      <TabBar color={C.dev} active={tab} setActive={setTab} tabs={[{k:"tasks",l:"タスク"},{k:"pomodoro",l:"🍅 ポモドーロ"},{k:"deploys",l:"デプロイ"},{k:"prs",l:"PR"}]}/>
      <div style={{ flex:1,overflow:"auto",padding:20 }}>
        {tab==="tasks"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {tasks.map(t=>(
              <Card key={t.id} accent={sC(t.status)} style={{ padding:"12px 16px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                  <Dot color={sC(t.status)} size={6} pulse={t.status==="in_progress"}/>
                  <span style={{ fontFamily:FONT,fontSize:6,color:C.text,flex:1 }}>{t.title}</span>
                  <Badge color={sC(t.status)}>{sL(t.status)}</Badge>
                  <span style={{ fontFamily:MONO,fontSize:10,color:C.muted }}>{t.assignee}</span>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <div style={{ flex:1 }}><ProgressBar value={t.progress} color={sC(t.status)} height={5}/></div>
                  <span style={{ fontFamily:FONT,fontSize:5,color:sC(t.status),width:36,textAlign:"right" }}>{t.progress}%</span>
                  <input type="range" min={0} max={100} value={t.progress}
                    onChange={e=>setTasks(p=>p.map(x=>x.id===t.id?{...x,progress:+e.target.value,status:+e.target.value===100?"done":+e.target.value>0?"in_progress":"todo"}:x))}
                    style={{ width:80,accentColor:C.dev,cursor:"pointer" }}/>
                </div>
              </Card>
            ))}
          </div>
        )}
        {tab==="pomodoro"&&<PomodoroTimer pushNotif={pushNotif}/>}
        {tab==="deploys"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {[{ok:true,msg:"prod → Vercel デプロイ完了",time:"13:55",hash:"a3f91c2"},
              {ok:true,msg:"Supabase migration 適用",time:"12:40",hash:"b7e2d44"},
              {ok:false,msg:"テスト失敗 — coverage 62%",time:"11:20",hash:"c1a09f3"},
              {ok:true,msg:"stg → Vercel デプロイ完了",time:"10:05",hash:"d8b3e11"}].map((d,i)=>(
              <Card key={i} accent={d.ok?C.dev:"#ef4444"} style={{ padding:"12px 16px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <span style={{ color:d.ok?C.dev:"#ef4444",fontSize:14 }}>{d.ok?"✓":"✗"}</span>
                  <span style={{ fontFamily:MONO,fontSize:11,color:C.text,flex:1 }}>{d.msg}</span>
                  <span style={{ fontFamily:MONO,fontSize:10,color:C.muted }}>{d.time}</span>
                  <span style={{ fontFamily:MONO,fontSize:9,color:C.border,background:"#0a0f18",padding:"2px 6px" }}>{d.hash}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
        {tab==="prs"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {[{no:142,title:"feat: ゲームUI コンポーネント追加",author:"佐藤",status:"review"},
              {no:141,title:"fix: API レート制限バグ修正",author:"鈴木",status:"merged"},
              {no:140,title:"chore: 依存パッケージ更新",author:"田中",status:"merged"}].map(pr=>{
              const sc=pr.status==="merged"?"#8b5cf6":C.sales;
              return (
                <Card key={pr.no} accent={sc} style={{ padding:"14px 16px" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <span style={{ fontFamily:FONT,fontSize:7,color:sc }}>#{pr.no}</span>
                    <span style={{ fontFamily:MONO,fontSize:11,color:C.text,flex:1 }}>{pr.title}</span>
                    <span style={{ fontFamily:MONO,fontSize:10,color:C.muted }}>{pr.author}</span>
                    <Badge color={sc}>{pr.status}</Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   PR — AI投稿生成込み
============================================================ */
const PR_PLATFORMS=["TikTok","Threads","X (Twitter)","note"];
const PR_TONES=["フレンドリー","プロフェッショナル","ユーモア","感情的","情報提供"];
function AIPRCompose({ pushNotif }) {
  const [platform,setPlatform]=useState("TikTok");
  const [tone,setTone]=useState("フレンドリー");
  const [topic,setTopic]=useState("");
  const [keywords,setKeywords]=useState("");
  const [output,setOutput]=useState("");
  const [loading,setLoading]=useState(false);
  const [copied,setCopied]=useState(false);
  const LIMITS={"TikTok":150,"Threads":500,"X (Twitter)":280,"note":3000};
  const generate=async()=>{
    if(!topic.trim()) return;
    setLoading(true); setOutput("");
    const sys=`あなたは日本語SNSマーケティングの専門家です。${platform}に最適化した投稿文のみを出力してください。余計な説明不要。文字数: 最大${LIMITS[platform]}字。`;
    const usr=`プラットフォーム:${platform}\nトーン:${tone}\nトピック:${topic}\nキーワード:${keywords||"なし"}`;
    try {
      let full="";
      await callClaude(sys,usr,c=>{full+=c;setOutput(full);});
      pushNotif("pr","AI投稿文 生成完了",`${platform}用の投稿文が生成されました`);
    } catch(e){ setOutput("⚠ "+e.message); }
    setLoading(false);
  };
  const charCount=output.length; const limit=LIMITS[platform];
  return (
    <div style={{ display:"flex",gap:16 }}>
      <div style={{ flex:1 }}>
        <Card accent={C.pr} style={{ padding:20 }}>
          <SectionTitle color={C.pr}>✦ AI投稿文生成</SectionTitle>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:6 }}>プラットフォーム</div>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {PR_PLATFORMS.map(p=><button key={p} onClick={()=>setPlatform(p)} style={{
                padding:"5px 10px",fontFamily:FONT,fontSize:4.5,cursor:"pointer",borderRadius:2,
                background:platform===p?`${C.pr}22`:"transparent",
                border:`1px solid ${platform===p?C.pr:C.border}`,color:platform===p?C.pr:C.muted,
              }}>{p}</button>)}
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:6 }}>トーン</div>
            <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
              {PR_TONES.map(t=><button key={t} onClick={()=>setTone(t)} style={{
                padding:"4px 8px",fontFamily:FONT,fontSize:4,cursor:"pointer",borderRadius:2,
                background:tone===t?`${C.pr}22`:"transparent",
                border:`1px solid ${tone===t?C.pr:C.border}`,color:tone===t?C.pr:C.muted,
              }}>{t}</button>)}
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:6 }}>トピック *</div>
            <textarea value={topic} onChange={e=>setTopic(e.target.value)} placeholder="例: 新しいCompany OSをリリースしました！"
              style={{ width:"100%",height:70,background:"#080010",border:`1px solid ${C.pr}44`,
                color:C.text,fontFamily:MONO,fontSize:11,padding:10,borderRadius:2,resize:"vertical",
                boxSizing:"border-box",lineHeight:1.7 }}/>
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:6 }}>キーワード（任意）</div>
            <input value={keywords} onChange={e=>setKeywords(e.target.value)} placeholder="CompanyOS, ドット絵, スタートアップ"
              style={{ width:"100%",background:"#080010",border:`1px solid ${C.pr}44`,
                color:C.text,fontFamily:MONO,fontSize:11,padding:"7px 10px",borderRadius:2,boxSizing:"border-box" }}/>
          </div>
          <AIBtn onClick={generate} loading={loading} color={C.pr}>投稿文を生成</AIBtn>
        </Card>
      </div>
      <div style={{ flex:1 }}>
        <Card accent={output?C.pr:undefined} style={{ padding:20,minHeight:300 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
            <SectionTitle color={C.pr}>生成結果</SectionTitle>
            {output&&<div style={{ display:"flex",gap:8,alignItems:"center" }}>
              <span style={{ fontFamily:MONO,fontSize:10,color:charCount>limit?"#ef4444":C.sec }}>{charCount}/{limit}字</span>
              <button onClick={()=>{navigator.clipboard.writeText(output);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{
                fontFamily:FONT,fontSize:4,padding:"4px 10px",cursor:"pointer",borderRadius:2,
                background:copied?`${C.sec}22`:`${C.pr}22`,border:`1px solid ${copied?C.sec:C.pr}`,color:copied?C.sec:C.pr,
              }}>{copied?"✓ コピー済":"コピー"}</button>
            </div>}
          </div>
          {output?(
            <div style={{ fontFamily:MONO,fontSize:11.5,color:C.text,lineHeight:1.9,whiteSpace:"pre-wrap",
              background:`${C.pr}06`,padding:14,border:`1px solid ${C.pr}22`,borderRadius:2,minHeight:200 }}>
              {output}
              {loading&&<span style={{ display:"inline-block",width:7,height:13,background:C.pr,marginLeft:2,animation:"pulse 0.8s infinite",verticalAlign:"text-bottom" }}/>}
            </div>
          ):(
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:200,flexDirection:"column",gap:10 }}>
              <span style={{ fontSize:32,opacity:0.3 }}>◈</span>
              <span style={{ fontFamily:MONO,fontSize:11,color:C.muted }}>左のフォームを入力して生成してください</span>
            </div>
          )}
          {output&&!loading&&(
            <div style={{ marginTop:12 }}>
              <div style={{ fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:8 }}>バリエーション</div>
              <div style={{ display:"flex",gap:6 }}>
                {["短縮版","より明るく","ハッシュタグ追加"].map(v=>(
                  <button key={v} onClick={async()=>{
                    setLoading(true);setOutput("");
                    try{let f="";await callClaude("投稿文を指示通りにリライトして、投稿文のみ出力。",`指示:${v}\n\n元の投稿:\n${output}`,c=>{f+=c;setOutput(f);});}
                    catch(e){setOutput("⚠ "+e.message);}
                    setLoading(false);
                  }} style={{ fontFamily:FONT,fontSize:4,padding:"4px 8px",background:"transparent",
                    border:`1px solid ${C.pr}44`,color:C.muted,cursor:"pointer",borderRadius:2 }}>{v}</button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
function PRScreen({ pushNotif }) {
  const [tab,setTab]=useState("ai-compose");
  const sC=s=>s==="done"?C.sec:s==="pending"?C.sales:"#ef4444";
  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
      <DeptHeader color={C.pr} icon="◈" title="広報部 / PR" subtitle="2名オンライン · 本日9本投稿予定" badges={["TikTok ×4","Threads","X / note"]}/>
      <TabBar color={C.pr} active={tab} setActive={setTab} tabs={[{k:"ai-compose",l:"✦ AI投稿生成"},{k:"schedule",l:"スケジュール"},{k:"accounts",l:"アカウント"}]}/>
      <div style={{ flex:1,overflow:"auto",padding:20 }}>
        {tab==="ai-compose"&&<AIPRCompose pushNotif={pushNotif}/>}
        {tab==="schedule"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {[{time:"10:00",platform:"TikTok",content:"新機能デモ動画",status:"done"},
              {time:"12:00",platform:"Threads",content:"開発日記 vol.3",status:"done"},
              {time:"15:00",platform:"TikTok",content:"ドット絵オフィス紹介",status:"pending"},
              {time:"17:00",platform:"X",content:"本日の進捗スレッド",status:"pending"},
              {time:"19:00",platform:"note",content:"週次レポート記事",status:"pending"}].map((p,i)=>(
              <Card key={i} accent={sC(p.status)} style={{ padding:"12px 16px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <span style={{ fontFamily:FONT,fontSize:7,color:C.muted,width:44 }}>{p.time}</span>
                  <Dot color={sC(p.status)} size={6} pulse={p.status==="pending"}/>
                  <Tag label={p.platform} color={sC(p.status)}/>
                  <span style={{ fontFamily:MONO,fontSize:11,color:C.text,flex:1 }}>{p.content}</span>
                  <Badge color={sC(p.status)}>{p.status==="done"?"投稿済":"予定"}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
        {tab==="accounts"&&(
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            {[{p:"TikTok",h:"@yura_dev_1",f:"12.4K",t:3,col:"#ff0050"},
              {p:"TikTok",h:"@yura_dev_2",f:"8.2K",t:2,col:"#ff0050"},
              {p:"TikTok",h:"@company_jp",f:"31.0K",t:1,col:"#ff0050"},
              {p:"Threads",h:"@yura.company",f:"2.1K",t:1,col:"#fff"},
              {p:"X",h:"@yura_dev",f:"4.8K",t:2,col:"#1d9bf0"},
              {p:"note",h:"yura_dev",f:"1.3K",t:1,col:"#41c9b4"}].map((a,i)=>(
              <Card key={i} accent={a.col} style={{ padding:"14px 16px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                  <Tag label={a.p} color={a.col}/>
                  <span style={{ fontFamily:MONO,fontSize:11,color:C.text,flex:1 }}>{a.h}</span>
                  <Dot color="#4ade80" pulse size={5}/>
                </div>
                <div style={{ display:"flex",gap:16 }}>
                  <div><div style={{ fontFamily:FONT,fontSize:12,color:a.col }}>{a.f}</div><div style={{ fontFamily:MONO,fontSize:9,color:C.muted }}>フォロワー</div></div>
                  <div><div style={{ fontFamily:FONT,fontSize:12,color:C.sec }}>{a.t}本</div><div style={{ fontFamily:MONO,fontSize:9,color:C.muted }}>本日</div></div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   SALES — AIメール込み
============================================================ */
const EMAIL_TYPES=["初回アプローチ","フォローアップ","提案書送付","お礼メール","断られた後の返信"];
function AIEmailCompose({ pushNotif }) {
  const [emailType,setEmailType]=useState("初回アプローチ");
  const [company,setCompany]=useState("");
  const [contact,setContact]=useState("");
  const [product,setProduct]=useState("Company OS — 社内業務管理システム");
  const [context,setContext]=useState("");
  const [output,setOutput]=useState({subject:"",body:""});
  const [raw,setRaw]=useState("");
  const [loading,setLoading]=useState(false);
  const [copied,setCopied]=useState(false);
  const generate=async()=>{
    if(!company.trim()) return;
    setLoading(true); setRaw(""); setOutput({subject:"",body:""});
    const sys=`あなたは日本のBtoBセールスの専門家です。JSON形式のみで返してください（マークダウン不要）:{"subject":"件名","body":"本文"}`;
    const usr=`種類:${emailType}\n企業:${company}\n担当者:${contact||"ご担当者様"}\n商品:${product}\n補足:${context||"なし"}`;
    try {
      let full="";
      await callClaude(sys,usr,c=>{
        full+=c; setRaw(full);
        try{const j=JSON.parse(full.replace(/```json|```/g,"").trim());setOutput(j);}catch{}
      });
      pushNotif("sales","AIメール 生成完了",`${company}宛のメール下書きが完成しました`);
    } catch(e){ setRaw("⚠ "+e.message); }
    setLoading(false);
  };
  return (
    <div style={{ display:"flex",gap:16 }}>
      <div style={{ width:270,flexShrink:0 }}>
        <Card accent={C.sales} style={{ padding:20 }}>
          <SectionTitle color={C.sales}>✦ AIメール下書き</SectionTitle>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:6 }}>種類</div>
            {EMAIL_TYPES.map(t=><button key={t} onClick={()=>setEmailType(t)} style={{
              width:"100%",marginBottom:4,padding:"6px 10px",fontFamily:FONT,fontSize:4,cursor:"pointer",
              background:emailType===t?`${C.sales}22`:"transparent",textAlign:"left",
              border:`1px solid ${emailType===t?C.sales:C.border}`,color:emailType===t?C.sales:C.muted,borderRadius:2,
            }}>{emailType===t?"▸ ":""}{t}</button>)}
          </div>
          {[{l:"企業名 *",v:company,s:setCompany,p:"株式会社○○"},{l:"担当者名",v:contact,s:setContact,p:"田中 様"},
            {l:"自社商品",v:product,s:setProduct,p:""}].map(f=>(
            <div key={f.l} style={{ marginBottom:10 }}>
              <div style={{ fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:5 }}>{f.l}</div>
              <input value={f.v} onChange={e=>f.s(e.target.value)} placeholder={f.p} style={{
                width:"100%",background:"#080a00",border:`1px solid ${C.sales}44`,
                color:C.text,fontFamily:MONO,fontSize:10.5,padding:"6px 8px",borderRadius:2,boxSizing:"border-box",
              }}/>
            </div>
          ))}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:5 }}>補足（任意）</div>
            <textarea value={context} onChange={e=>setContext(e.target.value)} placeholder="展示会で名刺交換した等"
              style={{ width:"100%",height:55,background:"#080a00",border:`1px solid ${C.sales}44`,
                color:C.text,fontFamily:MONO,fontSize:10.5,padding:8,borderRadius:2,resize:"none",boxSizing:"border-box",lineHeight:1.7 }}/>
          </div>
          <AIBtn onClick={generate} loading={loading} color={C.sales}>メールを生成</AIBtn>
        </Card>
      </div>
      <div style={{ flex:1 }}>
        <Card accent={output.body?C.sales:undefined} style={{ padding:20,minHeight:380 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <SectionTitle color={C.sales}>生成されたメール</SectionTitle>
            {output.body&&<button onClick={()=>{navigator.clipboard.writeText(`件名: ${output.subject}\n\n${output.body}`);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{
              fontFamily:FONT,fontSize:4,padding:"4px 10px",cursor:"pointer",borderRadius:2,
              background:copied?`${C.sec}22`:`${C.sales}22`,border:`1px solid ${copied?C.sec:C.sales}`,color:copied?C.sec:C.sales,
            }}>{copied?"✓ コピー済":"コピー"}</button>}
          </div>
          {output.subject&&<div style={{ marginBottom:12,padding:10,background:`${C.sales}08`,border:`1px solid ${C.sales}33`,borderRadius:2 }}>
            <div style={{ fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:4 }}>件名</div>
            <div style={{ fontFamily:MONO,fontSize:12,color:C.sales }}>{output.subject}</div>
          </div>}
          {output.body?(
            <div style={{ fontFamily:MONO,fontSize:11.5,color:C.text,lineHeight:2,whiteSpace:"pre-wrap",
              background:"#080a00",padding:16,border:`1px solid ${C.sales}22`,borderRadius:2,minHeight:220 }}>
              {output.body}
              {loading&&<span style={{ display:"inline-block",width:7,height:13,background:C.sales,marginLeft:2,animation:"pulse 0.8s infinite",verticalAlign:"text-bottom" }}/>}
            </div>
          ):loading?(
            <div style={{ fontFamily:MONO,fontSize:11,color:C.muted,padding:20,background:"#080a00",
              minHeight:220,display:"flex",alignItems:"flex-start",border:`1px solid ${C.sales}22`,borderRadius:2 }}>
              <span style={{ color:C.sales,whiteSpace:"pre-wrap" }}>{raw}</span>
              <span style={{ display:"inline-block",width:7,height:13,background:C.sales,marginLeft:2,animation:"pulse 0.8s infinite",verticalAlign:"text-bottom" }}/>
            </div>
          ):(
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:220,flexDirection:"column",gap:10 }}>
              <span style={{ fontSize:32,opacity:0.3 }}>✉</span>
              <span style={{ fontFamily:MONO,fontSize:11,color:C.muted }}>左のフォームを入力して生成してください</span>
            </div>
          )}
          {output.body&&!loading&&(
            <div style={{ marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}` }}>
              <div style={{ fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:8 }}>トーン調整</div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {["もっと丁寧に","よりカジュアルに","短くまとめる"].map(v=>(
                  <button key={v} onClick={async()=>{
                    setLoading(true);setOutput({...output,body:""});
                    try{let f="";await callClaude("メールをリライトしてJSON{subject,body}形式のみで返してください。",`指示:${v}\n件名:${output.subject}\n本文:${output.body}`,c=>{f+=c;try{setOutput(JSON.parse(f.replace(/```json|```/g,"").trim()));}catch{}});} catch(e){setOutput({...output,body:"⚠ "+e.message});}
                    setLoading(false);
                  }} style={{ fontFamily:FONT,fontSize:4,padding:"4px 8px",background:"transparent",border:`1px solid ${C.sales}44`,color:C.muted,cursor:"pointer",borderRadius:2 }}>{v}</button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
function SalesScreen({ pushNotif }) {
  const [tab,setTab]=useState("ai-email");
  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
      <DeptHeader color={C.sales} icon="◆" title="営業部 / SALES" subtitle="2名オンライン · 商談6件進行中" badges={["Gmail","Notion CRM","Zoom"]}/>
      <TabBar color={C.sales} active={tab} setActive={setTab} tabs={[{k:"ai-email",l:"✦ AIメール生成"},{k:"crm",l:"商談CRM"},{k:"report",l:"レポート"}]}/>
      <div style={{ flex:1,overflow:"auto",padding:20 }}>
        {tab==="ai-email"&&<AIEmailCompose pushNotif={pushNotif}/>}
        {tab==="crm"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {[{co:"A社 田中産業",stage:"提案",amount:"¥480,000",prob:80,col:C.sales},
              {co:"B社 鈴木商事",stage:"交渉",amount:"¥1,200,000",prob:90,col:"#10b981"},
              {co:"C社 伊藤工業",stage:"初回接触",amount:"¥320,000",prob:30,col:"#f97316"},
              {co:"D社 山本HD",stage:"クロージング",amount:"¥2,400,000",prob:95,col:C.sec}].map((d,i)=>(
              <Card key={i} accent={d.col} style={{ padding:"12px 16px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                  <Dot color={d.col} size={6}/>
                  <span style={{ fontFamily:MONO,fontSize:12,color:C.text,flex:1,fontWeight:"bold" }}>{d.co}</span>
                  <Tag label={d.stage} color={d.col}/>
                  <span style={{ fontFamily:FONT,fontSize:6,color:d.col }}>{d.amount}</span>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <div style={{ flex:1 }}><ProgressBar value={d.prob} color={d.col} height={4}/></div>
                  <span style={{ fontFamily:FONT,fontSize:5,color:d.col,width:36,textAlign:"right" }}>{d.prob}%</span>
                </div>
              </Card>
            ))}
          </div>
        )}
        {tab==="report"&&(
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
            <Card accent={C.sales} style={{ padding:16 }}>
              <SectionTitle color={C.sales}>月次 売上推移</SectionTitle>
              <BarChart data={[{label:"11月",value:180},{label:"12月",value:220},{label:"1月",value:310},{label:"2月",value:290},{label:"3月",value:420},{label:"4月",value:480,highlight:true}]} color={C.sales} height={120}/>
            </Card>
            <Card accent={C.sales} style={{ padding:16 }}>
              <SectionTitle color={C.sales}>KPI</SectionTitle>
              {[{l:"月間目標達成率",v:87,c:C.sales},{l:"商談転換率",v:42,c:C.sec},{l:"メール返信率",v:68,c:C.dev}].map(k=>(
                <div key={k.l} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                    <span style={{ fontFamily:MONO,fontSize:10,color:C.text }}>{k.l}</span>
                    <span style={{ fontFamily:FONT,fontSize:5,color:k.c }}>{k.v}%</span>
                  </div>
                  <ProgressBar value={k.v} color={k.c} height={5}/>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   SECRETARY
============================================================ */
function SecretaryScreen() {
  const clock=useClock();
  const EVENTS=[
    {time:"09:00",end:"09:30",title:"朝礼ミーティング",loc:"Zoom",done:true,color:C.sec},
    {time:"11:00",end:"12:00",title:"A社 オンライン商談",loc:"Google Meet",done:true,color:C.sales},
    {time:"14:00",end:"15:00",title:"開発部 週次MTG",loc:"会議室A",done:false,color:C.dev},
    {time:"15:30",end:"16:00",title:"広報部 コンテンツ確認",loc:"Slack",done:false,color:C.pr},
    {time:"18:00",end:"18:30",title:"日次レポート作成",loc:"デスク",done:false,color:C.sec},
  ];
  const CAL={1:[{t:"朝礼",c:C.sec},{t:"A社商談",c:C.sales}],3:[{t:"開発MTG",c:C.dev}],5:[{t:"経営会議",c:"#a855f7"}],8:[{t:"全体会議",c:C.sales}]};
  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
      <DeptHeader color={C.sec} icon="◇" title="秘書室 / SECRETARY" subtitle="1名オンライン · 残り3件の予定" badges={["TimeTree","iPhone Cal","Google Cal"]}/>
      <div style={{ flex:1,overflow:"auto",padding:20,display:"flex",gap:16 }}>
        <Card accent={C.sec} style={{ flex:1,padding:16 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <span style={{ fontFamily:FONT,fontSize:8,color:C.sec }}>2026年 4月</span>
            <span style={{ fontFamily:FONT,fontSize:16,color:C.sec }}>{clock.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})}</span>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4 }}>
            {["月","火","水","木","金","土","日"].map(d=><div key={d} style={{ textAlign:"center",fontFamily:FONT,fontSize:4,color:C.muted,padding:"3px 0" }}>{d}</div>)}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2 }}>
            {Array.from({length:2},(_,i)=><div key={`e${i}`}/>)}
            {Array.from({length:30},(_,i)=>{
              const d=i+1,isT=d===1,ev=CAL[d]||[];
              return (
                <div key={d} style={{ minHeight:44,padding:3,borderRadius:2,
                  border:`1px solid ${isT?C.sec:C.border}`,background:isT?`${C.sec}18`:C.panel }}>
                  <div style={{ fontFamily:FONT,fontSize:4,color:isT?C.sec:C.muted,marginBottom:2 }}>{d}</div>
                  {ev.map((e,j)=><div key={j} style={{ fontFamily:MONO,fontSize:7,color:e.c,background:`${e.c}22`,
                    padding:"1px 2px",borderRadius:1,marginBottom:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.t}</div>)}
                </div>
              );
            })}
          </div>
        </Card>
        <div style={{ width:290,flexShrink:0 }}>
          <Card accent={C.sec} style={{ padding:16 }}>
            <SectionTitle color={C.sec}>本日のタイムライン</SectionTitle>
            <div style={{ position:"relative",paddingLeft:50 }}>
              <div style={{ position:"absolute",left:34,top:0,bottom:0,width:2,background:C.border }}/>
              {EVENTS.map((ev,i)=>(
                <div key={i} style={{ position:"relative",marginBottom:14 }}>
                  <div style={{ position:"absolute",left:-44,top:8,fontFamily:FONT,fontSize:4,color:ev.done?C.muted:ev.color }}>{ev.time}</div>
                  <div style={{ position:"absolute",left:-18,top:12,width:10,height:10,borderRadius:"50%",
                    background:ev.done?"#1e293b":ev.color,border:`2px solid ${ev.done?C.dim:ev.color}`,
                    boxShadow:ev.done?"none":`0 0 8px ${ev.color}`,zIndex:1 }}/>
                  <div style={{ padding:"8px 12px",background:ev.done?"transparent":`${ev.color}08`,
                    border:`1px solid ${ev.done?C.border:ev.color+"44"}`,borderRadius:2,opacity:ev.done?0.6:1 }}>
                    <div style={{ fontFamily:FONT,fontSize:5.5,color:ev.done?C.muted:ev.color,marginBottom:3 }}>{ev.done?"✓ ":""}{ev.title}</div>
                    <div style={{ fontFamily:MONO,fontSize:9,color:C.muted }}>📍 {ev.loc} · {ev.time}–{ev.end}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   FINANCE
============================================================ */
const STRIPE_PRODUCTS=[
  {name:"VideoTracker Pro",mrr:480000,growth:12,users:1240,color:C.finance},
  {name:"匿名BBS Premium",mrr:128000,growth:28,users:640,color:"#fb923c"},
  {name:"Kusuriko Plus",mrr:32000,growth:5,users:160,color:"#34d399"},
];
const API_COSTS=[
  {name:"Anthropic (Claude)",daily:2400,monthly:72000,limit:100000,color:C.ai,icon:"🤖"},
  {name:"Runway Gen-4",daily:1800,monthly:54000,limit:80000,color:"#a78bfa",icon:"🎬"},
  {name:"ElevenLabs",daily:600,monthly:18000,limit:30000,color:"#f472b6",icon:"🔊"},
  {name:"Supabase",daily:200,monthly:6000,limit:50000,color:C.sec,icon:"🗄"},
  {name:"Vercel",daily:160,monthly:4800,limit:20000,color:"#94a3b8",icon:"▲"},
  {name:"Cloudflare R2",daily:80,monthly:2400,limit:10000,color:"#f97316",icon:"☁"},
];
function FinanceScreen() {
  const [tab,setTab]=useState("overview");
  const totalMRR=STRIPE_PRODUCTS.reduce((s,p)=>s+p.mrr,0);
  const totalCost=API_COSTS.reduce((s,c)=>s+c.monthly,0);
  const profit=totalMRR-totalCost;
  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
      <DeptHeader color={C.finance} icon="💰" title="財務部 / FINANCE" subtitle={`MRR ¥${totalMRR.toLocaleString()} · 利益率 ${Math.round(profit/totalMRR*100)}%`} badges={["Stripe","自動集計"]}/>
      <TabBar color={C.finance} active={tab} setActive={setTab} tabs={[{k:"overview",l:"概要"},{k:"mrr",l:"売上 MRR"},{k:"costs",l:"APIコスト"},{k:"pl",l:"P/L"}]}/>
      <div style={{ flex:1,overflow:"auto",padding:20 }}>
        {tab==="overview"&&(
          <div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20 }}>
              <StatCard label="月次売上 MRR" value={`¥${(totalMRR/10000).toFixed(1)}万`} sub="前月比 +14%" color={C.finance} trend={14}/>
              <StatCard label="APIコスト合計" value={`¥${(totalCost/10000).toFixed(1)}万`} sub="月間" color={C.ai} trend={-3}/>
              <StatCard label="純利益" value={`¥${(profit/10000).toFixed(1)}万`} sub="利益率 87%" color={C.sec} trend={18}/>
              <StatCard label="有料ユーザー" value="2,040名" sub="全プロダクト" color={C.data} trend={22}/>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16 }}>
              <Card accent={C.finance} style={{ padding:16 }}>
                <SectionTitle color={C.finance}>プロダクト別 MRR</SectionTitle>
                {STRIPE_PRODUCTS.map(p=>(
                  <div key={p.name} style={{ marginBottom:14 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:6 }}>
                      <Dot color={p.color} size={6}/>
                      <span style={{ fontFamily:MONO,fontSize:11,color:C.text,flex:1 }}>{p.name}</span>
                      <span style={{ fontFamily:FONT,fontSize:6,color:p.color }}>¥{p.mrr.toLocaleString()}</span>
                      <span style={{ fontFamily:MONO,fontSize:10,color:C.sec }}>+{p.growth}%</span>
                    </div>
                    <ProgressBar value={Math.round(p.mrr/totalMRR*100)} color={p.color} height={5}/>
                    <div style={{ fontFamily:MONO,fontSize:9,color:C.muted,marginTop:3 }}>{p.users.toLocaleString()}名 · {Math.round(p.mrr/totalMRR*100)}%</div>
                  </div>
                ))}
              </Card>
              <Card accent={C.finance} style={{ padding:16,display:"flex",flexDirection:"column",alignItems:"center",gap:12 }}>
                <SectionTitle color={C.finance}>売上構成</SectionTitle>
                <Donut size={110} segments={STRIPE_PRODUCTS.map(p=>({color:p.color,pct:Math.round(p.mrr/totalMRR*100)}))}/>
                {STRIPE_PRODUCTS.map(p=>(
                  <div key={p.name} style={{ display:"flex",alignItems:"center",gap:6,width:"100%",marginBottom:4 }}>
                    <Dot color={p.color} size={5}/>
                    <span style={{ fontFamily:MONO,fontSize:9,color:C.muted,flex:1 }}>{p.name.split(" ")[0]}</span>
                    <span style={{ fontFamily:FONT,fontSize:4.5,color:p.color }}>{Math.round(p.mrr/totalMRR*100)}%</span>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}
        {tab==="mrr"&&(
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
            <Card accent={C.finance} style={{ padding:16 }}>
              <SectionTitle color={C.finance}>MRR 推移（万円）</SectionTitle>
              <BarChart data={[{label:"11月",value:180},{label:"12月",value:220},{label:"1月",value:310},{label:"2月",value:290},{label:"3月",value:420},{label:"4月",value:480,highlight:true}]} color={C.finance} height={120}/>
            </Card>
            <Card accent={C.finance} style={{ padding:16 }}>
              <SectionTitle color={C.finance}>Stripe 最新取引</SectionTitle>
              {[{name:"田中 一郎",plan:"VideoTracker",amt:3980,time:"14:22"},
                {name:"Yamamoto S.",plan:"匿名BBS",amt:980,time:"13:45"},
                {name:"鈴木 花子",plan:"VideoTracker",amt:3980,time:"13:10"},
                {name:"Kim H.",plan:"Kusuriko",amt:480,time:"12:55"}].map((t,i)=>(
                <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:`1px solid ${C.border}` }}>
                  <Dot color={C.finance} size={5}/>
                  <span style={{ fontFamily:MONO,fontSize:10,color:C.text,flex:1 }}>{t.name}</span>
                  <Tag label={t.plan} color={C.finance}/>
                  <span style={{ fontFamily:FONT,fontSize:5,color:C.finance }}>¥{t.amt.toLocaleString()}</span>
                  <span style={{ fontFamily:MONO,fontSize:9,color:C.muted }}>{t.time}</span>
                </div>
              ))}
            </Card>
          </div>
        )}
        {tab==="costs"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {API_COSTS.map(a=>(
              <Card key={a.name} accent={a.color} style={{ padding:"14px 16px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:10 }}>
                  <span style={{ fontSize:18 }}>{a.icon}</span>
                  <span style={{ fontFamily:MONO,fontSize:12,color:C.text,flex:1,fontWeight:"bold" }}>{a.name}</span>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:FONT,fontSize:8,color:a.color }}>¥{a.monthly.toLocaleString()}<span style={{ fontSize:5,color:C.muted }}>/月</span></div>
                    <div style={{ fontFamily:MONO,fontSize:9,color:C.muted }}>¥{a.daily}/日</div>
                  </div>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <div style={{ flex:1 }}><ProgressBar value={Math.round(a.monthly/a.limit*100)} color={a.color} height={6}/></div>
                  <span style={{ fontFamily:FONT,fontSize:5,color:a.color }}>{Math.round(a.monthly/a.limit*100)}%</span>
                  <span style={{ fontFamily:MONO,fontSize:9,color:C.muted }}>/ ¥{a.limit.toLocaleString()} 上限</span>
                </div>
              </Card>
            ))}
          </div>
        )}
        {tab==="pl"&&(
          <Card accent={C.finance} style={{ padding:20,maxWidth:500 }}>
            <SectionTitle color={C.finance}>月次 損益計算書</SectionTitle>
            {[{label:"売上合計 (MRR)",val:totalMRR,type:"income"},
              {label:"APIコスト",val:-totalCost,type:"expense"},
              {label:"Vercel / インフラ",val:-4800,type:"expense"},
              {label:"ドメイン・その他",val:-2000,type:"expense"}].map((r,i)=>(
              <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.border}` }}>
                <span style={{ fontFamily:FONT,fontSize:5,color:r.type==="income"?C.sec:"#ef4444" }}>{r.type==="income"?"▲":"▼"}</span>
                <span style={{ fontFamily:MONO,fontSize:11,color:C.text,flex:1 }}>{r.label}</span>
                <span style={{ fontFamily:FONT,fontSize:7,color:r.type==="income"?C.sec:"#ef4444" }}>{r.type==="income"?"":"-"}¥{Math.abs(r.val).toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display:"flex",alignItems:"center",gap:10,padding:"14px 0",borderTop:`2px solid ${C.finance}` }}>
              <span style={{ fontFamily:FONT,fontSize:6,color:C.finance,flex:1 }}>純利益</span>
              <span style={{ fontFamily:FONT,fontSize:14,color:C.finance }}>¥{profit.toLocaleString()}</span>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   PRODUCT
============================================================ */
const PRODUCTS=[
  {id:"videotracker",name:"VideoTracker",icon:"🎬",color:C.product,status:"beta",version:"0.8.2",
   kpi:{users:1240,dau:380,retention:62,nps:71},progress:72,
   roadmap:[{title:"BuzzRadar 本番リリース",done:true,sprint:"S1"},{title:"アフィリエイトリンク",done:true,sprint:"S1"},
     {title:"バッチ動画生成エンジン",done:false,sprint:"S2"},{title:"TikTok直接投稿",done:false,sprint:"S2"},{title:"料金プラン再設計",done:false,sprint:"S3"}],
   bugs:{critical:0,high:2,medium:5}},
  {id:"bbs",name:"匿名BBS / DM",icon:"💬",color:"#f472b6",status:"alpha",version:"0.3.1",
   kpi:{users:640,dau:210,retention:48,nps:58},progress:38,
   roadmap:[{title:"自動削除メッセージ",done:true,sprint:"S1"},{title:"Stripe決済統合",done:true,sprint:"S1"},
     {title:"匿名DM暗号化",done:false,sprint:"S2"},{title:"モデレーションAI",done:false,sprint:"S2"},{title:"iOS App Store申請",done:false,sprint:"S3"}],
   bugs:{critical:1,high:3,medium:8}},
  {id:"kusuriko",name:"Kusuriko",icon:"💊",color:"#34d399",status:"mvp",version:"0.1.0",
   kpi:{users:160,dau:42,retention:35,nps:64},progress:18,
   roadmap:[{title:"薬レビュー投稿機能",done:true,sprint:"S1"},{title:"Claude API 推薦エンジン",done:false,sprint:"S2"},
     {title:"副作用データベース",done:false,sprint:"S2"},{title:"薬剤師監修コンテンツ",done:false,sprint:"S3"},{title:"ユーザー認証",done:false,sprint:"S3"}],
   bugs:{critical:0,high:1,medium:3}},
];
function ProductScreen() {
  const [tab,setTab]=useState("overview");
  const [sel,setSel]=useState("videotracker");
  const prod=PRODUCTS.find(p=>p.id===sel);
  const sCol={beta:C.sec,alpha:C.sales,mvp:C.data};
  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
      <DeptHeader color={C.product} icon="📦" title="プロダクト部 / PRODUCT" subtitle="3プロダクト管理中 · スプリント S2 進行中" badges={["VideoTracker","匿名BBS","Kusuriko"]}/>
      <TabBar color={C.product} active={tab} setActive={setTab} tabs={[{k:"overview",l:"横断概要"},{k:"roadmap",l:"ロードマップ"},{k:"bugs",l:"バグ"},{k:"kpi",l:"KPI"}]}/>
      <div style={{ flex:1,overflow:"auto",padding:20 }}>
        {tab==="overview"&&(
          <div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20 }}>
              {PRODUCTS.map(p=>(
                <div key={p.id} onClick={()=>setSel(p.id)} style={{
                  cursor:"pointer",padding:16,borderRadius:3,
                  border:`2px solid ${sel===p.id?p.color:p.color+"44"}`,
                  background:sel===p.id?`${p.color}10`:C.panel,transition:"all 0.15s",
                }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                    <span style={{ fontSize:20 }}>{p.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:FONT,fontSize:6.5,color:p.color }}>{p.name}</div>
                      <div style={{ fontFamily:MONO,fontSize:9,color:C.muted }}>v{p.version}</div>
                    </div>
                    <Badge color={sCol[p.status]||C.muted}>{p.status}</Badge>
                  </div>
                  <ProgressBar value={p.progress} color={p.color} height={5}/>
                  <div style={{ fontFamily:FONT,fontSize:5,color:p.color,marginTop:5 }}>{p.progress}% 完成</div>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:10 }}>
                    {[{l:"ユーザー",v:p.kpi.users.toLocaleString()},{l:"DAU",v:p.kpi.dau}].map(k=>(
                      <div key={k.l} style={{ textAlign:"center",padding:"5px",background:C.bg,borderRadius:2 }}>
                        <div style={{ fontFamily:FONT,fontSize:9,color:p.color }}>{k.v}</div>
                        <div style={{ fontFamily:MONO,fontSize:8,color:C.muted }}>{k.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {prod&&(
              <Card accent={prod.color} style={{ padding:16 }}>
                <SectionTitle color={prod.color}>{prod.icon} {prod.name} — ロードマップ</SectionTitle>
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {prod.roadmap.map((r,i)=>(
                    <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:2,
                      background:r.done?`${prod.color}08`:"transparent",border:`1px solid ${r.done?prod.color+"44":C.border}` }}>
                      <span style={{ color:r.done?prod.color:C.muted,fontSize:12 }}>{r.done?"✓":"○"}</span>
                      <span style={{ fontFamily:MONO,fontSize:11,color:r.done?C.text:C.muted,flex:1 }}>{r.title}</span>
                      <Tag label={r.sprint} color={r.done?prod.color:C.muted}/>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
        {tab==="roadmap"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
            {["S1","S2","S3"].map(sprint=>(
              <Card key={sprint} style={{ padding:16 }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
                  <Badge color={sprint==="S1"?C.sec:sprint==="S2"?C.sales:C.muted}>{sprint}</Badge>
                  <span style={{ fontFamily:FONT,fontSize:5,color:C.muted }}>{sprint==="S1"?"完了":sprint==="S2"?"進行中":"予定"}</span>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10 }}>
                  {PRODUCTS.flatMap(p=>p.roadmap.filter(r=>r.sprint===sprint).map((r,i)=>(
                    <div key={p.id+i} style={{ padding:"8px 10px",borderRadius:2,border:`1px solid ${r.done?p.color+"55":C.border}`,background:r.done?`${p.color}08`:C.panel }}>
                      <div style={{ fontFamily:FONT,fontSize:4,color:p.color,marginBottom:4 }}>{p.icon} {p.name}</div>
                      <div style={{ fontFamily:MONO,fontSize:10,color:r.done?C.text:C.muted }}>{r.title}</div>
                    </div>
                  )))}
                </div>
              </Card>
            ))}
          </div>
        )}
        {tab==="bugs"&&(
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14 }}>
            {PRODUCTS.map(p=>(
              <Card key={p.id} accent={p.color} style={{ padding:16 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
                  <span style={{ fontSize:16 }}>{p.icon}</span>
                  <span style={{ fontFamily:FONT,fontSize:6,color:p.color }}>{p.name}</span>
                </div>
                {[{level:"CRITICAL",count:p.bugs.critical,col:"#ef4444"},{level:"HIGH",count:p.bugs.high,col:"#f97316"},{level:"MEDIUM",count:p.bugs.medium,col:C.sales}].map(b=>(
                  <div key={b.level} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}` }}>
                    <Badge color={b.col}>{b.level}</Badge>
                    <div style={{ flex:1 }}/>
                    <span style={{ fontFamily:FONT,fontSize:12,color:b.count>0?b.col:C.muted }}>{b.count}</span>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        )}
        {tab==="kpi"&&(
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14 }}>
            {PRODUCTS.map(p=>(
              <Card key={p.id} accent={p.color} style={{ padding:16 }}>
                <SectionTitle color={p.color}>{p.icon} {p.name}</SectionTitle>
                {[{l:"総ユーザー",v:p.kpi.users.toLocaleString(),pct:null},{l:"DAU",v:p.kpi.dau,pct:Math.round(p.kpi.dau/p.kpi.users*100)},
                  {l:"継続率",v:`${p.kpi.retention}%`,pct:p.kpi.retention},{l:"NPS",v:p.kpi.nps,pct:p.kpi.nps}].map(k=>(
                  <div key={k.l} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                      <span style={{ fontFamily:MONO,fontSize:10,color:C.text }}>{k.l}</span>
                      <span style={{ fontFamily:FONT,fontSize:6,color:p.color }}>{k.v}</span>
                    </div>
                    {k.pct!==null&&<ProgressBar value={k.pct} color={p.color} height={4}/>}
                  </div>
                ))}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   AI OPS
============================================================ */
const AI_APIS=[
  {name:"Claude Sonnet",provider:"Anthropic",model:"claude-sonnet-4",rpm:120,latency:1.2,success:99.8,tokens_today:284000,cost_today:2400,color:C.ai,icon:"🤖"},
  {name:"Claude Haiku",provider:"Anthropic",model:"claude-haiku-4-5",rpm:300,latency:0.4,success:99.9,tokens_today:820000,cost_today:600,color:"#fb923c",icon:"⚡"},
  {name:"Runway Gen-4",provider:"Runway",model:"gen4-turbo",rpm:10,latency:8.4,success:98.2,tokens_today:340,cost_today:1800,color:"#a78bfa",icon:"🎬"},
  {name:"ElevenLabs",provider:"Eleven",model:"eleven_turbo_v2",rpm:60,latency:1.8,success:99.1,tokens_today:92000,cost_today:600,color:"#f472b6",icon:"🔊"},
  {name:"Whisper",provider:"OpenAI",model:"whisper-1",rpm:50,latency:2.1,success:99.5,tokens_today:18000,cost_today:180,color:C.sec,icon:"🎙"},
];
const AI_LOGS=[
  {time:"14:31",api:"Claude Sonnet",type:"広報部 投稿生成",tokens:1240,ms:1180,ok:true},
  {time:"14:28",api:"Claude Haiku",type:"営業部 メール生成",tokens:890,ms:410,ok:true},
  {time:"14:22",api:"Runway Gen-4",type:"VideoTracker 動画",tokens:1,ms:8420,ok:true},
  {time:"14:15",api:"ElevenLabs",type:"ナレーション生成",tokens:3200,ms:1820,ok:true},
  {time:"14:08",api:"Claude Sonnet",type:"Kusuriko 推薦",tokens:2100,ms:1340,ok:false},
  {time:"14:01",api:"Whisper",type:"文字起こし",tokens:6000,ms:2100,ok:true},
];
function AIScreen() {
  const [tab,setTab]=useState("dashboard");
  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
      <DeptHeader color={C.ai} icon="🤖" title="AI部 / AI OPS" subtitle="5 API 監視中 · 本日コスト ¥5,580" badges={["Claude","Runway","ElevenLabs","Whisper"]}/>
      <TabBar color={C.ai} active={tab} setActive={setTab} tabs={[{k:"dashboard",l:"ダッシュボード"},{k:"apis",l:"API詳細"},{k:"logs",l:"ログ"},{k:"quality",l:"品質"}]}/>
      <div style={{ flex:1,overflow:"auto",padding:20 }}>
        {tab==="dashboard"&&(
          <div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20 }}>
              <StatCard label="本日 APIコスト" value="¥5,580" sub="月間 ¥157,200" color={C.ai} trend={-8}/>
              <StatCard label="総リクエスト" value="4,218" sub="本日" color={C.data} trend={12}/>
              <StatCard label="平均成功率" value="99.3%" sub="全API" color={C.sec}/>
              <StatCard label="平均レイテンシ" value="1.8s" sub="全API" color={C.product}/>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {AI_APIS.map(a=>(
                <Card key={a.name} accent={a.color} style={{ padding:"14px 16px" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                    <span style={{ fontSize:20 }}>{a.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:3 }}>
                        <span style={{ fontFamily:FONT,fontSize:6,color:a.color }}>{a.name}</span>
                        <Tag label={a.provider} color={a.color}/>
                        <Dot color="#4ade80" pulse size={5}/>
                      </div>
                      <span style={{ fontFamily:MONO,fontSize:9,color:C.muted }}>{a.model}</span>
                    </div>
                    <div style={{ display:"grid",gridTemplateColumns:"repeat(4,75px)",gap:8,textAlign:"center" }}>
                      {[{l:"RPM",v:a.rpm},{l:"レイテンシ",v:`${a.latency}s`},{l:"成功率",v:`${a.success}%`},{l:"本日コスト",v:`¥${a.cost_today}`}].map(s=>(
                        <div key={s.l} style={{ padding:"5px 0",background:C.bg,borderRadius:2 }}>
                          <div style={{ fontFamily:FONT,fontSize:7,color:a.color }}>{s.v}</div>
                          <div style={{ fontFamily:MONO,fontSize:8,color:C.muted }}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                    <Sparkline data={[1.1,1.3,1.0,1.2,1.4,1.1,1.2].map(v=>v*a.latency/1.2)} color={a.color} width={90} height={28}/>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
        {tab==="apis"&&(
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
            {AI_APIS.map(a=>(
              <Card key={a.name} accent={a.color} style={{ padding:16 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:14 }}>
                  <span style={{ fontSize:20 }}>{a.icon}</span>
                  <div>
                    <div style={{ fontFamily:FONT,fontSize:7,color:a.color }}>{a.name}</div>
                    <div style={{ fontFamily:MONO,fontSize:10,color:C.muted }}>{a.model}</div>
                  </div>
                </div>
                {[{l:"本日トークン",v:a.tokens_today.toLocaleString()},{l:"本日コスト",v:`¥${a.cost_today.toLocaleString()}`},
                  {l:"平均レイテンシ",v:`${a.latency}s`},{l:"成功率",v:`${a.success}%`},{l:"レート制限",v:`${a.rpm} RPM`}].map(k=>(
                  <div key={k.l} style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}` }}>
                    <span style={{ fontFamily:MONO,fontSize:10,color:C.muted }}>{k.l}</span>
                    <span style={{ fontFamily:FONT,fontSize:5.5,color:a.color }}>{k.v}</span>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        )}
        {tab==="logs"&&(
          <Card style={{ padding:0,overflow:"hidden" }}>
            <div style={{ display:"grid",gridTemplateColumns:"55px 120px 150px 1fr 65px 60px 45px",
              padding:"8px 14px",borderBottom:`1px solid ${C.border}`,background:C.bg }}>
              {["時刻","API","用途","モデル","トークン","時間","状態"].map(h=>(
                <span key={h} style={{ fontFamily:FONT,fontSize:4,color:C.muted }}>{h}</span>
              ))}
            </div>
            {AI_LOGS.map((l,i)=>(
              <div key={i} style={{ display:"grid",gridTemplateColumns:"55px 120px 150px 1fr 65px 60px 45px",
                padding:"9px 14px",borderBottom:`1px solid ${C.border}`,background:i%2===0?"transparent":`${C.border}22` }}>
                <span style={{ fontFamily:MONO,fontSize:10,color:C.muted }}>{l.time}</span>
                <span style={{ fontFamily:MONO,fontSize:10,color:C.ai }}>{l.api}</span>
                <span style={{ fontFamily:MONO,fontSize:10,color:C.text }}>{l.type}</span>
                <span style={{ fontFamily:MONO,fontSize:9,color:C.muted }}>{AI_APIS.find(a=>a.name===l.api)?.model}</span>
                <span style={{ fontFamily:MONO,fontSize:10,color:C.muted }}>{l.tokens.toLocaleString()}</span>
                <span style={{ fontFamily:MONO,fontSize:10,color:C.muted }}>{l.ms}ms</span>
                <span style={{ fontFamily:FONT,fontSize:4,color:l.ok?C.sec:"#ef4444" }}>{l.ok?"OK":"ERR"}</span>
              </div>
            ))}
          </Card>
        )}
        {tab==="quality"&&(
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
            <Card accent={C.ai} style={{ padding:16 }}>
              <SectionTitle color={C.ai}>Claude 出力品質スコア</SectionTitle>
              {[{l:"広報部 投稿生成",score:94,col:C.pr},{l:"営業部 メール生成",score:91,col:C.sales},
                {l:"Kusuriko 推薦",score:87,col:"#34d399"},{l:"議事録 生成",score:96,col:C.sec}].map(q=>(
                <div key={q.l} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                    <span style={{ fontFamily:MONO,fontSize:10,color:C.text }}>{q.l}</span>
                    <span style={{ fontFamily:FONT,fontSize:6,color:q.col }}>{q.score}</span>
                  </div>
                  <ProgressBar value={q.score} color={q.col} height={5}/>
                </div>
              ))}
            </Card>
            <Card accent={C.ai} style={{ padding:16 }}>
              <SectionTitle color={C.ai}>エラー分析</SectionTitle>
              {[{reason:"Rate Limit超過",count:3,col:"#f97316"},{reason:"タイムアウト",count:1,col:"#ef4444"},
                {reason:"入力長超過",count:2,col:C.sales},{reason:"JSON解析失敗",count:1,col:C.muted}].map(e=>(
                <div key={e.reason} style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:`1px solid ${C.border}` }}>
                  <Dot color={e.col} size={5}/>
                  <span style={{ fontFamily:MONO,fontSize:11,color:C.text,flex:1 }}>{e.reason}</span>
                  <span style={{ fontFamily:FONT,fontSize:8,color:e.col }}>{e.count}</span>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   DATA ANALYTICS
============================================================ */
const USER_GROWTH=[{label:"10月",value:420},{label:"11月",value:680},{label:"12月",value:980},
  {label:"1月",value:1240},{label:"2月",value:1580},{label:"3月",value:1890},{label:"4月",value:2040,highlight:true}];
const TRAFFIC_SOURCES=[{label:"TikTok",value:42,color:C.pr},{label:"オーガニック",value:28,color:C.sec},
  {label:"X / note",value:16,color:C.data},{label:"紹介",value:9,color:C.product},{label:"その他",value:5,color:C.muted}];
const RETENTION=[  [100,62,48,41,38,35],[100,65,51,44,40],[100,68,53,46],[100,71,55],[100,74],[100]];
function DataScreen() {
  const [tab,setTab]=useState("overview");
  const [heatDay,setHeatDay]=useState(null);
  const heatData=useRef(Array.from({length:28},()=>Math.random()));
  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
      <DeptHeader color={C.data} icon="📊" title="データ部 / ANALYTICS" subtitle="全プロダクト 2,040 ユーザー · DAU 632" badges={["Supabase","GA4","Mixpanel"]}/>
      <TabBar color={C.data} active={tab} setActive={setTab} tabs={[{k:"overview",l:"概要"},{k:"growth",l:"成長"},{k:"retention",l:"継続率"},{k:"traffic",l:"流入分析"}]}/>
      <div style={{ flex:1,overflow:"auto",padding:20 }}>
        {tab==="overview"&&(
          <div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20 }}>
              <StatCard label="全プロダクト MAU" value="2,040" sub="前月比 +150" color={C.data} trend={8}/>
              <StatCard label="DAU / MAU" value="31%" sub="エンゲージ率" color={C.product} trend={3}/>
              <StatCard label="平均継続率 30日" value="48%" sub="全プロダクト" color={C.sec} trend={5}/>
              <StatCard label="本日 PV" value="8,420" sub="全サービス合計" color={C.data}/>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16 }}>
              <Card accent={C.data} style={{ padding:16 }}>
                <SectionTitle color={C.data}>ユーザー数推移</SectionTitle>
                <BarChart data={USER_GROWTH} color={C.data} height={120}/>
              </Card>
              <Card accent={C.data} style={{ padding:16 }}>
                <SectionTitle color={C.data}>流入元構成</SectionTitle>
                {TRAFFIC_SOURCES.map(s=>(
                  <div key={s.label} style={{ marginBottom:8 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",marginBottom:3 }}>
                      <span style={{ fontFamily:MONO,fontSize:10,color:C.text }}>{s.label}</span>
                      <span style={{ fontFamily:FONT,fontSize:5,color:s.color }}>{s.value}%</span>
                    </div>
                    <ProgressBar value={s.value} color={s.color} height={4}/>
                  </div>
                ))}
              </Card>
            </div>
            <Card accent={C.data} style={{ padding:16 }}>
              <SectionTitle color={C.data}>アクティビティ ヒートマップ（過去28日）</SectionTitle>
              <div style={{ display:"flex",gap:3,flexWrap:"wrap" }}>
                {heatData.current.map((v,i)=>(
                  <div key={i} onMouseEnter={()=>setHeatDay(i)} onMouseLeave={()=>setHeatDay(null)}
                    style={{ width:24,height:24,borderRadius:2,cursor:"pointer",
                      background:`rgba(56,189,248,${0.1+v*0.9})`,
                      border:heatDay===i?`1px solid ${C.data}`:"1px solid transparent",
                      boxShadow:heatDay===i?`0 0 8px ${C.data}`:"none",transition:"all 0.1s" }}/>
                ))}
              </div>
              <div style={{ fontFamily:MONO,fontSize:9,color:C.muted,marginTop:8 }}>
                {heatDay!==null?`${28-heatDay}日前: アクセス多`:"各マスにホバーで詳細表示"}
              </div>
            </Card>
          </div>
        )}
        {tab==="growth"&&(
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
            <Card accent={C.data} style={{ padding:16 }}>
              <SectionTitle color={C.data}>全体ユーザー推移</SectionTitle>
              <BarChart data={USER_GROWTH} color={C.data} height={130}/>
            </Card>
            <Card accent={C.data} style={{ padding:16 }}>
              <SectionTitle color={C.data}>プロダクト別成長率</SectionTitle>
              {[{name:"VideoTracker",growth:22,users:1240,color:C.product},
                {name:"匿名BBS",growth:35,users:640,color:"#f472b6"},
                {name:"Kusuriko",growth:12,users:160,color:"#34d399"}].map(p=>(
                <div key={p.name} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
                    <span style={{ fontFamily:MONO,fontSize:11,color:C.text }}>{p.name}</span>
                    <div style={{ display:"flex",gap:10 }}>
                      <span style={{ fontFamily:FONT,fontSize:5,color:C.sec }}>+{p.growth}%</span>
                      <span style={{ fontFamily:MONO,fontSize:10,color:C.muted }}>{p.users.toLocaleString()}名</span>
                    </div>
                  </div>
                  <ProgressBar value={p.users/2040*100} color={p.color} height={5}/>
                </div>
              ))}
            </Card>
          </div>
        )}
        {tab==="retention"&&(
          <Card accent={C.data} style={{ padding:20 }}>
            <SectionTitle color={C.data}>コホート継続率分析</SectionTitle>
            <div style={{ overflowX:"auto" }}>
              <table style={{ borderCollapse:"collapse",width:"100%" }}>
                <thead>
                  <tr>{["コホート","W0","W1","W2","W3","W4","W5"].map(h=>(
                    <th key={h} style={{ fontFamily:FONT,fontSize:4.5,color:C.muted,padding:"6px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}` }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {RETENTION.map((row,ri)=>(
                    <tr key={ri}>
                      <td style={{ fontFamily:MONO,fontSize:10,color:C.muted,padding:"6px 10px" }}>3月 W{ri+1}</td>
                      {row.map((v,ci)=>(
                        <td key={ci} style={{ padding:"4px 6px",textAlign:"center" }}>
                          <div style={{ padding:"5px 0",borderRadius:2,background:`rgba(56,189,248,${v/100*0.8+0.1})`,
                            fontFamily:FONT,fontSize:5,color:v===100?"#fff":v>60?C.data:v>40?C.sales:"#ef4444" }}>{v}%</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontFamily:MONO,fontSize:10,color:C.muted,marginTop:12 }}>✦ 平均30日継続率 48% — 業界平均 (35%) を上回っています</div>
          </Card>
        )}
        {tab==="traffic"&&(
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
            <Card accent={C.data} style={{ padding:16 }}>
              <SectionTitle color={C.data}>流入元詳細</SectionTitle>
              {TRAFFIC_SOURCES.map(s=>(
                <div key={s.label} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
                    <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                      <Dot color={s.color} size={6}/><span style={{ fontFamily:MONO,fontSize:11,color:C.text }}>{s.label}</span>
                    </div>
                    <span style={{ fontFamily:FONT,fontSize:5.5,color:s.color }}>{s.value}%</span>
                  </div>
                  <ProgressBar value={s.value} color={s.color} height={5}/>
                  <div style={{ fontFamily:MONO,fontSize:9,color:C.muted,marginTop:3 }}>{Math.round(8420*s.value/100)} PV / 本日</div>
                </div>
              ))}
            </Card>
            <Card accent={C.data} style={{ padding:16 }}>
              <SectionTitle color={C.data}>SNS別 CV率</SectionTitle>
              {[{platform:"TikTok",cv:3.2,sessions:3538,color:C.pr},{platform:"Threads",cv:5.8,sessions:844,color:"#fff"},
                {platform:"X",cv:4.1,sessions:674,color:"#1d9bf0"},{platform:"note",cv:7.2,sessions:421,color:"#41c9b4"}].map(s=>(
                <div key={s.platform} style={{ padding:"10px 0",borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:5 }}>
                    <Tag label={s.platform} color={s.color}/>
                    <span style={{ fontFamily:MONO,fontSize:10,color:C.muted,flex:1 }}>{s.sessions.toLocaleString()} セッション</span>
                    <span style={{ fontFamily:FONT,fontSize:6,color:s.color }}>{s.cv}%</span>
                  </div>
                  <ProgressBar value={s.cv*10} color={s.color} height={3}/>
                </div>
              ))}
              <div style={{ fontFamily:MONO,fontSize:10,color:C.muted,marginTop:12 }}>✦ note の CV率が最高 — 記事経由ユーザーの質が高い</div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   👥 HR / 採用部
============================================================ */
const CANDIDATES = [
  {name:"山口 太郎",role:"フルスタックエンジニア",stage:"最終面接",score:88,date:"4/3",color:C.hr,src:"Wantedly"},
  {name:"Kim Jisoo",role:"iOSエンジニア",stage:"技術課題",score:74,date:"4/5",color:"#fb923c",src:"LinkedIn"},
  {name:"田村 花",role:"UIデザイナー",stage:"1次面接",score:91,date:"4/7",color:"#a78bfa",src:"Twitter/X"},
  {name:"Nguyen V.",role:"バックエンド",stage:"書類選考",score:62,date:"4/10",color:C.muted,src:"Wantedly"},
  {name:"佐々木 健",role:"マーケター",stage:"オファー",score:95,date:"4/1",color:C.sec,src:"紹介"},
];
const STAGES=["書類選考","技術課題","1次面接","最終面接","オファー"];
const ONBOARDING=[
  {name:"橋本（財務部）",day:14,tasks:[{t:"PC・ツールセットアップ",done:true},{t:"Supabase権限付与",done:true},{t:"Notionアクセス設定",done:true},{t:"業務引き継ぎMTG",done:false},{t:"初月KPI設定",done:false}]},
  {name:"木村（PdM）",day:32,tasks:[{t:"PC・ツールセットアップ",done:true},{t:"プロダクト概要共有",done:true},{t:"顧客インタビュー同席",done:true},{t:"S2ロードマップ承認",done:true},{t:"初月KPI設定",done:true}]},
];
const JOB_POSTS=[
  {title:"フルスタックエンジニア",type:"正社員",views:342,apps:12,active:true},
  {title:"iOSエンジニア",type:"業務委託",views:218,apps:7,active:true},
  {title:"UIデザイナー",type:"正社員",views:156,apps:4,active:true},
  {title:"コンテンツライター",type:"副業",views:89,apps:2,active:false},
];
function HRScreen() {
  const [tab,setTab]=useState("pipeline");
  const [sel,setSel]=useState(null);
  const stageColor=s=>({"書類選考":C.muted,"技術課題":C.sales,"1次面接":C.hr,"最終面接":"#f97316","オファー":C.sec})[s]||C.muted;
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <DeptHeader color={C.hr} icon="👥" title="HR / 採用部" subtitle="候補者 5名 · 今月 内定予定 2名" badges={["Wantedly","LinkedIn","採用管理"]}/>
      <TabBar color={C.hr} active={tab} setActive={setTab} tabs={[{k:"pipeline",l:"採用パイプライン"},{k:"onboarding",l:"オンボーディング"},{k:"posts",l:"求人票"},{k:"culture",l:"カルチャー"}]}/>
      <div style={{flex:1,overflow:"auto",padding:20}}>

        {tab==="pipeline" && (
          <div style={{display:"flex",gap:16}}>
            {/* Kanban */}
            <div style={{flex:1}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:16}}>
                {STAGES.map(s=>(
                  <div key={s} style={{textAlign:"center",padding:"4px 0",borderBottom:`2px solid ${stageColor(s)}`,fontFamily:FONT,fontSize:4,color:stageColor(s)}}>
                    {s} <span style={{color:C.muted}}>({CANDIDATES.filter(c=>c.stage===s).length})</span>
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,alignItems:"start"}}>
                {STAGES.map(s=>(
                  <div key={s} style={{display:"flex",flexDirection:"column",gap:8}}>
                    {CANDIDATES.filter(c=>c.stage===s).map(cand=>(
                      <div key={cand.name} onClick={()=>setSel(sel?.name===cand.name?null:cand)} style={{
                        padding:"10px 12px",borderRadius:2,cursor:"pointer",
                        border:`1px solid ${sel?.name===cand.name?cand.color:C.border}`,
                        background:sel?.name===cand.name?`${cand.color}10`:C.panel,
                      }}>
                        <div style={{fontFamily:FONT,fontSize:4.5,color:cand.color,marginBottom:4}}>{cand.name}</div>
                        <div style={{fontFamily:MONO,fontSize:9,color:C.muted,marginBottom:6}}>{cand.role}</div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{cand.src}</span>
                          <span style={{fontFamily:FONT,fontSize:6,color:cand.score>=80?C.sec:cand.score>=70?C.sales:C.muted}}>{cand.score}</span>
                        </div>
                        <ProgressBar value={cand.score} color={cand.color} height={3}/>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {/* Detail */}
            {sel && (
              <Card accent={sel.color} style={{width:220,padding:16,flexShrink:0,alignSelf:"flex-start"}}>
                <SectionTitle color={sel.color}>候補者詳細</SectionTitle>
                {[{l:"氏名",v:sel.name},{l:"ポジション",v:sel.role},{l:"ステージ",v:sel.stage},{l:"スコア",v:`${sel.score}/100`},{l:"面接日",v:sel.date},{l:"流入元",v:sel.src}].map(r=>(
                  <div key={r.l} style={{marginBottom:8}}>
                    <div style={{fontFamily:FONT,fontSize:4,color:C.muted,marginBottom:2}}>{r.l}</div>
                    <div style={{fontFamily:MONO,fontSize:11,color:sel.color}}>{r.v}</div>
                  </div>
                ))}
                <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:12}}>
                  {["面接スケジュール送信","評価フォーム送付","次のステージへ"].map(a=>(
                    <button key={a} style={{padding:"6px 10px",fontFamily:FONT,fontSize:4,background:`${sel.color}18`,
                      border:`1px solid ${sel.color}44`,color:sel.color,cursor:"pointer",borderRadius:2,textAlign:"left"}}>▸ {a}</button>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {tab==="onboarding" && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {ONBOARDING.map(p=>(
              <Card key={p.name} accent={C.hr} style={{padding:16}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:`${C.hr}22`,
                    border:`2px solid ${C.hr}`,display:"flex",alignItems:"center",justifyContent:"center",
                    fontFamily:FONT,fontSize:7,color:C.hr}}>{p.name[0]}</div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:FONT,fontSize:6,color:C.hr,marginBottom:2}}>{p.name}</div>
                    <div style={{fontFamily:MONO,fontSize:10,color:C.muted}}>入社 {p.day}日目</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:FONT,fontSize:12,color:C.sec}}>{p.tasks.filter(t=>t.done).length}/{p.tasks.length}</div>
                    <div style={{fontFamily:MONO,fontSize:9,color:C.muted}}>タスク完了</div>
                  </div>
                </div>
                <ProgressBar value={Math.round(p.tasks.filter(t=>t.done).length/p.tasks.length*100)} color={C.hr} height={5}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:10}}>
                  {p.tasks.map((t,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",
                      background:t.done?`${C.hr}08`:C.bg,border:`1px solid ${t.done?C.hr+"44":C.border}`,borderRadius:2}}>
                      <span style={{color:t.done?C.hr:C.muted,fontSize:10}}>{t.done?"✓":"○"}</span>
                      <span style={{fontFamily:MONO,fontSize:9,color:t.done?C.text:C.muted}}>{t.t}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab==="posts" && (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
              <StatCard label="公開中の求人" value="3件" color={C.hr}/>
              <StatCard label="今月の応募" value="25名" sub="前月比 +8" color={C.hr} trend={47}/>
              <StatCard label="内定承諾率" value="80%" sub="今月" color={C.sec}/>
            </div>
            {JOB_POSTS.map((j,i)=>(
              <Card key={i} accent={j.active?C.hr:C.muted} style={{padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <Dot color={j.active?C.hr:C.muted} size={7} pulse={j.active}/>
                  <span style={{fontFamily:FONT,fontSize:6,color:j.active?C.hr:C.muted,flex:1}}>{j.title}</span>
                  <Tag label={j.type} color={j.active?C.hr:C.muted}/>
                  <span style={{fontFamily:MONO,fontSize:10,color:C.muted}}>閲覧 {j.views}</span>
                  <span style={{fontFamily:FONT,fontSize:6,color:j.active?C.sec:C.muted}}>応募 {j.apps}名</span>
                  <Badge color={j.active?C.sec:C.muted}>{j.active?"公開中":"非公開"}</Badge>
                </div>
              </Card>
            ))}
            <button style={{width:"100%",marginTop:8,padding:"10px",background:`${C.hr}18`,
              border:`1px solid ${C.hr}`,fontFamily:FONT,fontSize:5,color:C.hr,cursor:"pointer",borderRadius:2}}>
              + 新規求人票を作成
            </button>
          </div>
        )}

        {tab==="culture" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card accent={C.hr} style={{padding:16}}>
              <SectionTitle color={C.hr}>チームスコア</SectionTitle>
              {[{l:"エンゲージメント",v:84,c:C.hr},{l:"心理的安全性",v:91,c:C.sec},
                {l:"成長実感",v:88,c:C.sales},{l:"ワークライフバランス",v:76,c:C.data}].map(s=>(
                <div key={s.l} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontFamily:MONO,fontSize:10,color:C.text}}>{s.l}</span>
                    <span style={{fontFamily:FONT,fontSize:5.5,color:s.c}}>{s.v}</span>
                  </div>
                  <ProgressBar value={s.v} color={s.c} height={5}/>
                </div>
              ))}
            </Card>
            <Card accent={C.hr} style={{padding:16}}>
              <SectionTitle color={C.hr}>チームバリュー</SectionTitle>
              {[{v:"Ship Fast",d:"考えすぎず、まず出す"},
                {v:"AI First",d:"すべての仕事でAIを使う"},
                {v:"Japan x Global",d:"日本市場を起点に世界へ"},
                {v:"Radical Honesty",d:"遠慮なく本音で話す"},
                {v:"Build in Public",d:"進捗をオープンに共有"}].map(b=>(
                <div key={b.v} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                  <div style={{fontFamily:FONT,fontSize:5,color:C.hr,marginBottom:3}}>{b.v}</div>
                  <div style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{b.d}</div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   🎯 マーケ部
============================================================ */
const CAMPAIGNS=[
  {name:"VideoTracker Launch",status:"active",budget:50000,spent:32000,clicks:4820,cvr:3.2,color:C.marketing},
  {name:"Kusuriko SEO強化",status:"active",budget:20000,spent:8400,clicks:1240,cvr:5.8,color:"#a78bfa"},
  {name:"匿名BBS SNS広告",status:"paused",budget:30000,spent:12000,clicks:890,cvr:1.9,color:"#f472b6"},
];
const SEO_KEYWORDS=[
  {kw:"動画 AI 自動生成",rank:4,vol:"2,400",trend:"up",color:C.sec},
  {kw:"TikTok 自動投稿ツール",rank:7,vol:"1,800",trend:"up",color:C.sec},
  {kw:"薬 口コミ アプリ",rank:12,vol:"5,400",trend:"stable",color:C.sales},
  {kw:"匿名 SNS 日本",rank:18,vol:"3,200",trend:"down",color:"#ef4444"},
  {kw:"動画生成 ツール 比較",rank:3,vol:"880",trend:"up",color:C.sec},
];
const LP_LIST=[
  {name:"VideoTracker LP",cvr:4.2,visitors:3840,color:C.marketing},
  {name:"匿名BBS LP",cvr:2.8,visitors:1240,color:"#f472b6"},
  {name:"Kusuriko LP",cvr:6.1,visitors:620,color:"#34d399"},
];
function MarketingScreen() {
  const [tab,setTab]=useState("overview");
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <DeptHeader color={C.marketing} icon="🎯" title="マーケ部 / MARKETING" subtitle="広告 3本稼働中 · 今月 CVR 3.8%" badges={["Google Ads","Meta","SEO","LP"]}/>
      <TabBar color={C.marketing} active={tab} setActive={setTab} tabs={[{k:"overview",l:"概要"},{k:"campaigns",l:"広告"},{k:"seo",l:"SEO"},{k:"lp",l:"LP管理"}]}/>
      <div style={{flex:1,overflow:"auto",padding:20}}>

        {tab==="overview" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
              <StatCard label="今月 広告費" value="¥52,400" sub="予算 ¥100,000" color={C.marketing} trend={-8}/>
              <StatCard label="総クリック数" value="6,950" sub="今月" color={C.data} trend={22}/>
              <StatCard label="平均CVR" value="3.8%" sub="全施策平均" color={C.sec} trend={0.4}/>
              <StatCard label="CAC" value="¥2,840" sub="顧客獲得単価" color={C.marketing} trend={-12}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
              <Card accent={C.marketing} style={{padding:16}}>
                <SectionTitle color={C.marketing}>施策別パフォーマンス</SectionTitle>
                {CAMPAIGNS.map(c=>(
                  <div key={c.name} style={{marginBottom:14,padding:"10px 12px",
                    border:`1px solid ${c.status==="active"?c.color+"44":C.border}`,
                    background:c.status==="active"?`${c.color}06`:C.bg,borderRadius:2}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <Dot color={c.status==="active"?c.color:C.muted} pulse={c.status==="active"} size={6}/>
                      <span style={{fontFamily:FONT,fontSize:5.5,color:c.status==="active"?c.color:C.muted,flex:1}}>{c.name}</span>
                      <Badge color={c.status==="active"?C.sec:C.muted}>{c.status==="active"?"稼働中":"停止中"}</Badge>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:6}}>
                      {[{l:"予算",v:`¥${c.budget.toLocaleString()}`},{l:"消化",v:`¥${c.spent.toLocaleString()}`},
                        {l:"クリック",v:c.clicks.toLocaleString()},{l:"CVR",v:`${c.cvr}%`}].map(s=>(
                        <div key={s.l} style={{textAlign:"center",padding:"4px",background:C.panel,borderRadius:2}}>
                          <div style={{fontFamily:FONT,fontSize:7,color:c.color}}>{s.v}</div>
                          <div style={{fontFamily:MONO,fontSize:8,color:C.muted}}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                    <ProgressBar value={Math.round(c.spent/c.budget*100)} color={c.color} height={4}/>
                    <div style={{fontFamily:MONO,fontSize:9,color:C.muted,marginTop:3}}>
                      予算消化率 {Math.round(c.spent/c.budget*100)}%
                    </div>
                  </div>
                ))}
              </Card>
              <Card accent={C.marketing} style={{padding:16}}>
                <SectionTitle color={C.marketing}>チャネル別 CVR</SectionTitle>
                {[{ch:"Google検索",cvr:5.2,col:C.sec},{ch:"Meta広告",cvr:2.8,col:"#1877f2"},
                  {ch:"TikTok広告",cvr:3.1,col:C.pr},{ch:"SEOオーガニック",cvr:7.4,col:C.marketing}].map(c=>(
                  <div key={c.ch} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontFamily:MONO,fontSize:10,color:C.text}}>{c.ch}</span>
                      <span style={{fontFamily:FONT,fontSize:5.5,color:c.col}}>{c.cvr}%</span>
                    </div>
                    <ProgressBar value={c.cvr*10} color={c.col} height={4}/>
                  </div>
                ))}
                <div style={{fontFamily:MONO,fontSize:10,color:C.muted,marginTop:10}}>
                  ✦ SEOオーガニックのCVR最高
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab==="seo" && (
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
            <Card accent={C.marketing} style={{padding:16}}>
              <SectionTitle color={C.marketing}>検索順位トラッキング</SectionTitle>
              {SEO_KEYWORDS.map((k,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontFamily:FONT,fontSize:10,color:k.color,width:28,textAlign:"center"}}>{k.rank}位</span>
                  <span style={{fontFamily:MONO,fontSize:11,color:C.text,flex:1}}>{k.kw}</span>
                  <span style={{fontFamily:MONO,fontSize:10,color:C.muted}}>月{k.vol}回</span>
                  <span style={{fontSize:12}}>{k.trend==="up"?"📈":k.trend==="down"?"📉":"➡"}</span>
                </div>
              ))}
            </Card>
            <Card accent={C.marketing} style={{padding:16}}>
              <SectionTitle color={C.marketing}>技術SEOスコア</SectionTitle>
              {[{l:"Core Web Vitals",v:82,c:C.sec},{l:"モバイル対応",v:96,c:C.sec},
                {l:"内部リンク",v:68,c:C.sales},{l:"コンテンツ量",v:54,c:"#f97316"}].map(s=>(
                <div key={s.l} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontFamily:MONO,fontSize:10,color:C.text}}>{s.l}</span>
                    <span style={{fontFamily:FONT,fontSize:5.5,color:s.c}}>{s.v}</span>
                  </div>
                  <ProgressBar value={s.v} color={s.c} height={5}/>
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab==="lp" && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
            {LP_LIST.map(lp=>(
              <Card key={lp.name} accent={lp.color} style={{padding:16}}>
                <SectionTitle color={lp.color}>{lp.name}</SectionTitle>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                  {[{l:"CVR",v:`${lp.cvr}%`},{l:"訪問者",v:lp.visitors.toLocaleString()}].map(s=>(
                    <div key={s.l} style={{textAlign:"center",padding:"8px",background:C.bg,borderRadius:2}}>
                      <div style={{fontFamily:FONT,fontSize:12,color:lp.color}}>{s.v}</div>
                      <div style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{s.l}</div>
                    </div>
                  ))}
                </div>
                <ProgressBar value={lp.cvr*10} color={lp.color} height={5}/>
                <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:12}}>
                  {["A/Bテスト開始","ヒートマップ確認","コピー改善"].map(a=>(
                    <button key={a} style={{padding:"5px 8px",fontFamily:FONT,fontSize:4,background:`${lp.color}18`,
                      border:`1px solid ${lp.color}44`,color:lp.color,cursor:"pointer",borderRadius:2,textAlign:"left"}}>▸ {a}</button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab==="campaigns" && (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {CAMPAIGNS.map((c,i)=>(
              <Card key={i} accent={c.color} style={{padding:"16px 18px"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                  <Dot color={c.status==="active"?c.color:C.muted} pulse={c.status==="active"} size={8}/>
                  <span style={{fontFamily:FONT,fontSize:7,color:c.color,flex:1}}>{c.name}</span>
                  <Badge color={c.status==="active"?C.sec:C.muted}>{c.status==="active"?"稼働中":"停止中"}</Badge>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}}>
                  {[{l:"総予算",v:`¥${c.budget.toLocaleString()}`},{l:"消化額",v:`¥${c.spent.toLocaleString()}`},
                    {l:"クリック",v:c.clicks.toLocaleString()},{l:"CVR",v:`${c.cvr}%`}].map(s=>(
                    <div key={s.l} style={{textAlign:"center",padding:"8px",background:C.bg,borderRadius:2}}>
                      <div style={{fontFamily:FONT,fontSize:10,color:c.color}}>{s.v}</div>
                      <div style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{s.l}</div>
                    </div>
                  ))}
                </div>
                <ProgressBar value={Math.round(c.spent/c.budget*100)} color={c.color} height={6}/>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   🛡 法務 / コンプラ
============================================================ */
const DOCS=[
  {name:"利用規約 (VideoTracker)",status:"最新",lastUpdate:"2026/3/15",risk:"低",color:C.sec},
  {name:"プライバシーポリシー",status:"要更新",lastUpdate:"2025/12/01",risk:"中",color:C.sales},
  {name:"匿名BBS 運用ポリシー",status:"最新",lastUpdate:"2026/2/20",risk:"低",color:C.sec},
  {name:"Kusuriko 医療情報免責",status:"要レビュー",lastUpdate:"2026/1/10",risk:"高",color:"#ef4444"},
  {name:"Cookie / GDPR 対応",status:"要更新",lastUpdate:"2025/11/15",risk:"中",color:C.sales},
  {name:"パートナー契約テンプレ",status:"最新",lastUpdate:"2026/3/28",risk:"低",color:C.sec},
];
const RISKS=[
  {title:"Kusuriko 薬事法リスク",level:"高",detail:"医療情報の提供方法について薬事法の観点でレビュー必要",color:"#ef4444",due:"4/15"},
  {title:"匿名BBS 誹謗中傷対策",level:"中",detail:"削除フロー・通報機能の法的要件を確認",color:C.sales,due:"4/30"},
  {title:"個人情報保護法 改正対応",level:"中",detail:"2024年改正の要件に沿ったポリシー更新",color:C.sales,due:"5/15"},
  {title:"Stripe 利用規約確認",level:"低",detail:"サブスク解約ポリシーが規約に準拠しているか",color:C.sec,due:"5/31"},
];
function LegalScreen() {
  const [tab,setTab]=useState("overview");
  const riskCol=r=>({高:"#ef4444",中:C.sales,低:C.sec})[r]||C.muted;
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <DeptHeader color={C.legal} icon="🛡" title="法務 / コンプライアンス" subtitle="要対応 3件 · ドキュメント 6件管理中" badges={["利用規約","GDPR","薬事法","プライバシー"]}/>
      <TabBar color={C.legal} active={tab} setActive={setTab} tabs={[{k:"overview",l:"概要"},{k:"docs",l:"ドキュメント"},{k:"risks",l:"リスク管理"},{k:"checklist",l:"コンプラ確認"}]}/>
      <div style={{flex:1,overflow:"auto",padding:20}}>

        {tab==="overview" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
              <StatCard label="管理ドキュメント" value="6件" color={C.legal}/>
              <StatCard label="要対応" value="3件" sub="今月中に対応" color="#ef4444"/>
              <StatCard label="高リスク項目" value="1件" sub="Kusuriko薬事法" color={C.sales}/>
              <StatCard label="コンプラスコア" value="72/100" sub="前月比 +5" color={C.sec} trend={5}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <Card accent={C.legal} style={{padding:16}}>
                <SectionTitle color={C.legal}>ドキュメント状況</SectionTitle>
                {DOCS.map((d,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                    <Dot color={d.color} size={6}/>
                    <span style={{fontFamily:MONO,fontSize:10,color:C.text,flex:1}}>{d.name}</span>
                    <Badge color={d.color}>{d.status}</Badge>
                  </div>
                ))}
              </Card>
              <Card accent={C.legal} style={{padding:16}}>
                <SectionTitle color={C.legal}>リスクサマリー</SectionTitle>
                {RISKS.map((r,i)=>(
                  <div key={i} style={{padding:"8px 10px",marginBottom:6,border:`1px solid ${r.color}44`,
                    background:`${r.color}08`,borderRadius:2}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <Badge color={r.color}>{r.level}</Badge>
                      <span style={{fontFamily:FONT,fontSize:5,color:r.color,flex:1}}>{r.title}</span>
                      <span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{r.due}まで</span>
                    </div>
                    <div style={{fontFamily:MONO,fontSize:10,color:C.muted,paddingLeft:4}}>{r.detail}</div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {tab==="docs" && (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {DOCS.map((d,i)=>(
              <Card key={i} accent={d.color} style={{padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <Dot color={d.color} size={7}/>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:FONT,fontSize:6,color:d.color,marginBottom:4}}>{d.name}</div>
                    <div style={{fontFamily:MONO,fontSize:10,color:C.muted}}>最終更新: {d.lastUpdate}</div>
                  </div>
                  <Tag label={`リスク: ${d.risk}`} color={riskCol(d.risk)}/>
                  <Badge color={d.color}>{d.status}</Badge>
                  <button style={{padding:"5px 10px",fontFamily:FONT,fontSize:4,background:`${d.color}18`,
                    border:`1px solid ${d.color}`,color:d.color,cursor:"pointer",borderRadius:2}}>確認</button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab==="risks" && (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {RISKS.map((r,i)=>(
              <Card key={i} accent={r.color} style={{padding:16}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                  <Badge color={r.color}>リスク {r.level}</Badge>
                  <span style={{fontFamily:FONT,fontSize:6,color:r.color,flex:1}}>{r.title}</span>
                  <span style={{fontFamily:FONT,fontSize:5,color:C.muted}}>対応期限: {r.due}</span>
                </div>
                <div style={{fontFamily:MONO,fontSize:11,color:C.text,lineHeight:1.8,marginBottom:10}}>{r.detail}</div>
                <div style={{display:"flex",gap:8}}>
                  {["担当者アサイン","外部弁護士相談","対応完了としてマーク"].map(a=>(
                    <button key={a} style={{padding:"5px 10px",fontFamily:FONT,fontSize:4,background:`${r.color}18`,
                      border:`1px solid ${r.color}44`,color:r.color,cursor:"pointer",borderRadius:2}}>▸ {a}</button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab==="checklist" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            {[
              {title:"プロダクト",items:[{t:"利用規約 掲載",ok:true},{t:"プライバシーポリシー掲載",ok:true},{t:"Cookie同意バナー",ok:false},{t:"未成年者保護条項",ok:false}]},
              {title:"決済・課金",items:[{t:"特定商取引法 表記",ok:true},{t:"キャンセルポリシー明記",ok:true},{t:"返金フロー整備",ok:false},{t:"領収書自動発行",ok:true}]},
              {title:"個人情報",items:[{t:"データ保存期間の明示",ok:false},{t:"第三者提供の同意取得",ok:true},{t:"データ削除リクエスト対応",ok:false},{t:"セキュリティポリシー",ok:true}]},
              {title:"コンテンツ",items:[{t:"著作権表記",ok:true},{t:"医療情報免責",ok:false},{t:"UGCモデレーション",ok:false},{t:"禁止事項の明示",ok:true}]},
            ].map(cat=>(
              <Card key={cat.title} accent={C.legal} style={{padding:16}}>
                <SectionTitle color={C.legal}>{cat.title}</SectionTitle>
                {cat.items.map((item,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                    <span style={{color:item.ok?C.sec:"#ef4444",fontSize:12}}>{item.ok?"✓":"✗"}</span>
                    <span style={{fontFamily:MONO,fontSize:10,color:item.ok?C.text:C.muted,flex:1}}>{item.t}</span>
                    {!item.ok && <Badge color="#ef4444">要対応</Badge>}
                  </div>
                ))}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   🤝 CS / カスタマーサポート
============================================================ */
const TICKETS=[
  {id:"#1042",user:"田中 一郎",product:"VideoTracker",issue:"動画生成が途中で止まる",priority:"高",status:"対応中",time:"14:22",color:"#ef4444"},
  {id:"#1041",user:"Yamamoto S.",product:"匿名BBS",issue:"メッセージが届かない",priority:"中",status:"調査中",time:"13:55",color:C.sales},
  {id:"#1040",user:"鈴木 花子",product:"VideoTracker",issue:"決済エラー",priority:"高",status:"解決済",time:"13:20",color:C.sec},
  {id:"#1039",user:"Kim H.",product:"Kusuriko",issue:"薬の情報が古い",priority:"低",status:"対応中",time:"12:40",color:C.cs},
  {id:"#1038",user:"佐藤 次郎",product:"匿名BBS",issue:"アカウント削除方法",priority:"低",status:"解決済",time:"11:15",color:C.sec},
];
const CS_METRICS={responseTime:"8分",csat:94,open:12,solved:48};
function CSScreen() {
  const [tab,setTab]=useState("tickets");
  const [aiOutput,setAiOutput]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const [selectedTicket,setSelectedTicket]=useState(null);
  const pCol=p=>({高:"#ef4444",中:C.sales,低:C.cs})[p]||C.muted;
  const sCol=s=>({対応中:C.sales,調査中:"#f97316",解決済:C.sec})[s]||C.muted;

  const generateReply=async(ticket)=>{
    setAiLoading(true); setAiOutput("");
    const sys="あなたは日本のスタートアップのCS担当です。丁寧で簡潔なサポートメールを日本語で書いてください。";
    const usr=`ユーザー:${ticket.user}\nプロダクト:${ticket.product}\n問題:${ticket.issue}\n優先度:${ticket.priority}`;
    try{
      let f="";
      await callClaude(sys,usr,c=>{f+=c;setAiOutput(f);});
    }catch(e){setAiOutput("⚠ "+e.message);}
    setAiLoading(false);
  };

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <DeptHeader color={C.cs} icon="🤝" title="カスタマーサポート / CS" subtitle={`未解決 ${CS_METRICS.open}件 · 平均応答 ${CS_METRICS.responseTime} · CSAT ${CS_METRICS.csat}%`} badges={["Zendesk","メール","FAQ"]}/>
      <TabBar color={C.cs} active={tab} setActive={setTab} tabs={[{k:"tickets",l:"チケット"},{k:"ai-reply",l:"✦ AI返信生成"},{k:"faq",l:"FAQ"},{k:"metrics",l:"メトリクス"}]}/>
      <div style={{flex:1,overflow:"auto",padding:20}}>

        {tab==="tickets" && (
          <div style={{display:"flex",gap:16}}>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:8}}>
                <StatCard label="未解決" value={CS_METRICS.open} color="#ef4444"/>
                <StatCard label="今日解決" value={CS_METRICS.solved} color={C.sec}/>
                <StatCard label="CSAT" value={`${CS_METRICS.csat}%`} color={C.cs}/>
              </div>
              {TICKETS.map(t=>(
                <Card key={t.id} accent={sCol(t.status)} style={{padding:"12px 16px",cursor:"pointer",
                  background:selectedTicket?.id===t.id?`${C.cs}08`:C.panel}}
                  onClick={()=>setSelectedTicket(selectedTicket?.id===t.id?null:t)}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontFamily:FONT,fontSize:5,color:C.cs,width:42}}>{t.id}</span>
                    <Tag label={t.priority} color={pCol(t.priority)}/>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:MONO,fontSize:11,color:C.text,marginBottom:2}}>{t.issue}</div>
                      <div style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{t.user} · {t.product}</div>
                    </div>
                    <Badge color={sCol(t.status)}>{t.status}</Badge>
                    <span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{t.time}</span>
                  </div>
                </Card>
              ))}
            </div>
            {selectedTicket && (
              <Card accent={C.cs} style={{width:260,padding:16,flexShrink:0,alignSelf:"flex-start"}}>
                <SectionTitle color={C.cs}>チケット詳細</SectionTitle>
                {[{l:"ID",v:selectedTicket.id},{l:"ユーザー",v:selectedTicket.user},
                  {l:"プロダクト",v:selectedTicket.product},{l:"優先度",v:selectedTicket.priority},{l:"ステータス",v:selectedTicket.status}].map(r=>(
                  <div key={r.l} style={{marginBottom:8}}>
                    <div style={{fontFamily:FONT,fontSize:4,color:C.muted,marginBottom:2}}>{r.l}</div>
                    <div style={{fontFamily:MONO,fontSize:11,color:C.cs}}>{r.v}</div>
                  </div>
                ))}
                <div style={{fontFamily:MONO,fontSize:11,color:C.text,lineHeight:1.8,padding:"8px 0",
                  borderTop:`1px solid ${C.border}`,marginTop:4}}>{selectedTicket.issue}</div>
                <AIBtn onClick={()=>generateReply(selectedTicket)} loading={aiLoading} color={C.cs}>返信を生成</AIBtn>
                {aiOutput && (
                  <div style={{marginTop:10,padding:10,background:`${C.cs}08`,border:`1px solid ${C.cs}33`,borderRadius:2}}>
                    <div style={{fontFamily:FONT,fontSize:4,color:C.cs,marginBottom:6}}>✦ AI返信案</div>
                    <div style={{fontFamily:MONO,fontSize:9,color:C.text,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{aiOutput}</div>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {tab==="ai-reply" && (
          <div style={{maxWidth:700}}>
            <Card accent={C.cs} style={{padding:20}}>
              <SectionTitle color={C.cs}>✦ AIサポート返信生成</SectionTitle>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                {[{l:"ユーザー名",ph:"田中 様"},{l:"プロダクト",ph:"VideoTracker"}].map(f=>(
                  <div key={f.l}>
                    <div style={{fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:5}}>{f.l}</div>
                    <input placeholder={f.ph} style={{width:"100%",background:C.bg,border:`1px solid ${C.cs}44`,
                      color:C.text,fontFamily:MONO,fontSize:11,padding:"6px 10px",borderRadius:2,boxSizing:"border-box"}}/>
                  </div>
                ))}
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:5}}>問い合わせ内容</div>
                <textarea placeholder="ユーザーからの問い合わせをここに貼り付けてください"
                  style={{width:"100%",height:80,background:C.bg,border:`1px solid ${C.cs}44`,
                    color:C.text,fontFamily:MONO,fontSize:11,padding:10,borderRadius:2,resize:"vertical",
                    boxSizing:"border-box",lineHeight:1.7}}/>
              </div>
              <div style={{marginBottom:16}}>
                <div style={{fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:6}}>返信トーン</div>
                <div style={{display:"flex",gap:6}}>
                  {["丁寧・フォーマル","親しみやすい","簡潔・端的"].map(t=>(
                    <button key={t} style={{padding:"5px 10px",fontFamily:FONT,fontSize:4,cursor:"pointer",
                      background:`${C.cs}22`,border:`1px solid ${C.cs}44`,color:C.cs,borderRadius:2}}>{t}</button>
                  ))}
                </div>
              </div>
              <AIBtn onClick={()=>{}} loading={false} color={C.cs}>返信文を生成</AIBtn>
            </Card>
          </div>
        )}

        {tab==="faq" && (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[{q:"動画生成が途中で止まります",a:"生成時間は動画の長さにより3〜15分かかります。タブをそのまま開いてお待ちください。5分以上止まる場合はページを更新してください。",views:342,helpful:89},
              {q:"解約方法を教えてください",a:"設定 > サブスクリプション > キャンセル から手続きできます。月末まで利用可能です。",views:218,helpful:94},
              {q:"請求書・領収書の発行方法",a:"設定 > 請求 > 領収書ダウンロード からPDFで取得できます。",views:156,helpful:97},
              {q:"データはどこに保存されますか？",a:"日本国内のサーバー（Supabase Tokyo）に暗号化して保存されます。第三者への提供は一切行いません。",views:89,helpful:91}].map((f,i)=>(
              <Card key={i} accent={C.cs} style={{padding:"14px 16px"}}>
                <div style={{fontFamily:FONT,fontSize:5.5,color:C.cs,marginBottom:8}}>Q. {f.q}</div>
                <div style={{fontFamily:MONO,fontSize:11,color:C.text,lineHeight:1.8,marginBottom:8}}>A. {f.a}</div>
                <div style={{display:"flex",gap:12}}>
                  <span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>閲覧 {f.views}回</span>
                  <span style={{fontFamily:MONO,fontSize:9,color:C.sec}}>役立った {f.helpful}%</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab==="metrics" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <StatCard label="平均応答時間" value="8分" sub="目標 10分以内" color={C.cs} trend={-20}/>
            <StatCard label="CSAT スコア" value="94%" sub="今月平均" color={C.sec} trend={2}/>
            <StatCard label="1回解決率" value="78%" sub="FCR" color={C.cs}/>
            <StatCard label="エスカレーション率" value="4%" sub="月間" color={C.muted}/>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   🇯🇵 JAPAN MARKET部
============================================================ */
function JapanScreen() {
  const [tab,setTab]=useState("overview");
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <DeptHeader color={C.japan} icon="🇯🇵" title="Japan Market部" subtitle="日本市場特化 · note/Threads/請求書PDF対応" badges={["note","Threads","振込対応","日本語SEO"]}/>
      <TabBar color={C.japan} active={tab} setActive={setTab} tabs={[{k:"overview",l:"市場概要"},{k:"localization",l:"ローカライズ"},{k:"billing",l:"日本向け請求"},{k:"platforms",l:"JP特化SNS"}]}/>
      <div style={{flex:1,overflow:"auto",padding:20}}>

        {tab==="overview" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
              <StatCard label="日本ユーザー比率" value="78%" sub="全ユーザー中" color={C.japan}/>
              <StatCard label="JP MRR" value="¥49.9万" sub="全体の78%" color={C.japan} trend={16}/>
              <StatCard label="日本語コンテンツ" value="142本" sub="累計" color={C.sales}/>
              <StatCard label="JPキーワード 1位" value="3件" sub="検索上位" color={C.sec}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <Card accent={C.japan} style={{padding:16}}>
                <SectionTitle color={C.japan}>日本市場 特性メモ</SectionTitle>
                {[{title:"note 経由CV率が高い",detail:"技術記事→LP→購入の導線が機能。note記事を週2本維持"},
                  {title:"Threads の伸びが顕著",detail:"X離れの受け皿として急成長。フォロワー増加率 +28%/月"},
                  {title:"請求書PDF が必須",detail:"法人顧客は請求書ダウンロード必須。Stripeカスタム請求書設定済み"},
                  {title:"Apple課金 vs Web課金",detail:"iOS経由は30%手数料。Web決済誘導で収益性 1.4倍"},
                  {title:"振込対応の需要",detail:"月10件程度の振込希望あり。GMOペイメントゲートウェイ検討中"}].map((m,i)=>(
                  <div key={i} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{fontFamily:FONT,fontSize:5,color:C.japan,marginBottom:3}}>{m.title}</div>
                    <div style={{fontFamily:MONO,fontSize:10,color:C.muted,lineHeight:1.7}}>{m.detail}</div>
                  </div>
                ))}
              </Card>
              <Card accent={C.japan} style={{padding:16}}>
                <SectionTitle color={C.japan}>JP競合マップ</SectionTitle>
                {[{name:"CapCut (TikTok)",threat:"高",note:"VideoTrackerの主競合。中国製への不信感が差別化ポイント",col:"#ef4444"},
                  {name:"LIPS (COCO)",threat:"中",note:"Kusirukoの参考モデル。薬領域での展開は未着手",col:C.sales},
                  {name:"Peing / NGL",threat:"中",note:"匿名BBSの競合。機能差別化で対抗",col:C.sales},
                  {name:"X (Twitter)",threat:"低",note:"Threadsへの移行が進行中。Threads先行は有利",col:C.cs}].map((c,i)=>(
                  <div key={i} style={{padding:"8px 10px",marginBottom:6,border:`1px solid ${c.col}44`,background:`${c.col}06`,borderRadius:2}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontFamily:FONT,fontSize:5,color:c.col,flex:1}}>{c.name}</span>
                      <Badge color={c.col}>脅威 {c.threat}</Badge>
                    </div>
                    <div style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{c.note}</div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {tab==="localization" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card accent={C.japan} style={{padding:16}}>
              <SectionTitle color={C.japan}>翻訳・ローカライズ状況</SectionTitle>
              {[{item:"VideoTracker UI",pct:100,col:C.sec},{item:"Kusuriko LP",pct:100,col:C.sec},
                {item:"匿名BBS 利用規約",pct:100,col:C.sec},{item:"エラーメッセージ",pct:80,col:C.sales},
                {item:"メール通知文",pct:65,col:C.sales},{item:"Pushnoti文言",pct:40,col:"#f97316"}].map(l=>(
                <div key={l.item} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontFamily:MONO,fontSize:10,color:C.text}}>{l.item}</span>
                    <span style={{fontFamily:FONT,fontSize:5.5,color:l.col}}>{l.pct}%</span>
                  </div>
                  <ProgressBar value={l.pct} color={l.col} height={4}/>
                </div>
              ))}
            </Card>
            <Card accent={C.japan} style={{padding:16}}>
              <SectionTitle color={C.japan}>日本語対応チェック</SectionTitle>
              {[{t:"敬語・丁寧語の統一",ok:true},{t:"フリガナ入力対応",ok:true},
                {t:"全角/半角の自動変換",ok:false},{t:"郵便番号からの住所補完",ok:false},
                {t:"和暦表示オプション",ok:false},{t:"日本語フォント最適化",ok:true},
                {t:"携帯電話番号形式対応",ok:true},{t:"コンビニ払い対応",ok:false}].map((c,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{color:c.ok?C.sec:"#ef4444",fontSize:12}}>{c.ok?"✓":"✗"}</span>
                  <span style={{fontFamily:MONO,fontSize:10,color:c.ok?C.text:C.muted,flex:1}}>{c.t}</span>
                  {!c.ok&&<Badge color="#ef4444">未対応</Badge>}
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab==="billing" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card accent={C.japan} style={{padding:16}}>
              <SectionTitle color={C.japan}>日本向け請求設定</SectionTitle>
              {[{t:"Stripe 請求書PDF 自動発行",ok:true},{t:"消費税 10% 自動計算",ok:true},
                {t:"インボイス番号 記載",ok:true},{t:"振込先情報の表示",ok:false},
                {t:"GMO 振込決済",ok:false},{t:"法人向け月末締め翌月払い",ok:false}].map((c,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{color:c.ok?C.sec:"#ef4444",fontSize:12}}>{c.ok?"✓":"✗"}</span>
                  <span style={{fontFamily:MONO,fontSize:10,color:c.ok?C.text:C.muted,flex:1}}>{c.t}</span>
                  {!c.ok&&<Badge color={C.sales}>対応予定</Badge>}
                </div>
              ))}
            </Card>
            <Card accent={C.japan} style={{padding:16}}>
              <SectionTitle color={C.japan}>今月の請求サマリー</SectionTitle>
              {[{l:"カード決済",v:"¥48.2万",pct:75,col:C.japan},{l:"Apple IAP",v:"¥9.8万",pct:15,col:"#555"},
                {l:"振込（手動）",v:"¥6.4万",pct:10,col:C.sales}].map(b=>(
                <div key={b.l} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontFamily:MONO,fontSize:10,color:C.text}}>{b.l}</span>
                    <span style={{fontFamily:FONT,fontSize:6,color:b.col}}>{b.v}</span>
                  </div>
                  <ProgressBar value={b.pct} color={b.col} height={5}/>
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab==="platforms" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {[{name:"note",icon:"n",color:"#41c9b4",followers:"1,320",posts:48,topPost:"VideoTracker開発日記 vol.3 — 8,400PV"},
              {name:"Threads",icon:"@",color:"#fff",followers:"2,140",posts:62,topPost:"毎日コード書いてる人と繋がりたい — いいね892"},
              {name:"Zenn",icon:"Z",color:"#3ea8ff",followers:"840",posts:12,topPost:"SupabaseリアルタイムDB完全ガイド — 14,200PV"},
              {name:"Qiita",icon:"Q",color:"#55c500",followers:"620",posts:8,topPost:"Claude Code × Next.js実践Tips — 6,800LGTM"}].map(p=>(
              <Card key={p.name} accent={p.color} style={{padding:"14px 18px"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:36,height:36,background:`${p.color}22`,border:`2px solid ${p.color}`,
                    borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",
                    fontFamily:"serif",fontSize:18,color:p.color,flexShrink:0}}>{p.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:FONT,fontSize:7,color:p.color,marginBottom:3}}>{p.name}</div>
                    <div style={{fontFamily:MONO,fontSize:10,color:C.muted}}>フォロワー {p.followers} · {p.posts}本</div>
                  </div>
                  <div style={{textAlign:"right",maxWidth:300}}>
                    <div style={{fontFamily:MONO,fontSize:10,color:C.muted,marginBottom:2}}>最高パフォーマンス記事</div>
                    <div style={{fontFamily:MONO,fontSize:10,color:C.text}}>{p.topPost}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   🎬 コンテンツファクトリー
============================================================ */
function ContentFactoryScreen() {
  const [tab,setTab]=useState("pipeline");
  const [briefOutput,setBriefOutput]=useState("");
  const [briefLoading,setBriefLoading]=useState(false);
  const [briefTopic,setBriefTopic]=useState("");

  const generateBrief=async()=>{
    if(!briefTopic.trim()) return;
    setBriefLoading(true); setBriefOutput("");
    const sys="あなたはバズるコンテンツのクリエイティブディレクターです。TikTok動画の制作ブリーフを作成してください。構成:タイトル/フック(最初の3秒)/本編の流れ/CTA/推奨BGM/予想再生数。";
    const usr=`テーマ: ${briefTopic}\nターゲット: 日本の20-35歳 スタートアップ/テック系`;
    try{let f="";await callClaude(sys,usr,c=>{f+=c;setBriefOutput(f);});}
    catch(e){setBriefOutput("⚠ "+e.message);}
    setBriefLoading(false);
  };

  const CONTENT_PIPELINE=[
    {title:"VideoTracker デモ動画",type:"TikTok",status:"編集中",due:"4/3",platform:"TikTok",assignee:"山田"},
    {title:"開発日記 vol.4",type:"note",status:"執筆中",due:"4/5",platform:"note",assignee:"田中"},
    {title:"AI動画生成の仕組み解説",type:"YouTube Short",status:"撮影待ち",due:"4/8",platform:"YouTube",assignee:"伊藤"},
    {title:"Kusuriko 薬レビュー機能紹介",type:"Threads",status:"完成",due:"4/2",platform:"Threads",assignee:"山田"},
    {title:"匿名BBS プライバシー解説",type:"X スレッド",status:"完成",due:"4/1",platform:"X",assignee:"田中"},
  ];

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <DeptHeader color={C.content} icon="🎬" title="コンテンツファクトリー" subtitle="VideoTrackerで自社コンテンツを量産 · 今月8本制作" badges={["VideoTracker自社活用","AI台本","バズ分析"]}/>
      <TabBar color={C.content} active={tab} setActive={setTab} tabs={[{k:"pipeline",l:"制作パイプライン"},{k:"brief",l:"✦ AI台本生成"},{k:"performance",l:"パフォーマンス"},{k:"studio",l:"スタジオ設定"}]}/>
      <div style={{flex:1,overflow:"auto",padding:20}}>

        {tab==="pipeline" && (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
              <StatCard label="今月制作本数" value="8本" color={C.content}/>
              <StatCard label="総再生数" value="124K" sub="今月" color={C.content} trend={34}/>
              <StatCard label="VideoTracker活用率" value="100%" sub="全動画" color={C.sec}/>
              <StatCard label="平均制作時間" value="2.4時間" sub="AI活用で68%削減" color={C.sec}/>
            </div>
            {CONTENT_PIPELINE.map((c,i)=>{
              const sCol={編集中:C.content,執筆中:C.sales,撮影待ち:"#f97316",完成:C.sec}[c.status]||C.muted;
              return (
                <Card key={i} accent={sCol} style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <Dot color={sCol} size={7} pulse={c.status!=="完成"}/>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:FONT,fontSize:5.5,color:C.text,marginBottom:3}}>{c.title}</div>
                      <div style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{c.type} · {c.assignee}</div>
                    </div>
                    <Tag label={c.platform} color={sCol}/>
                    <Badge color={sCol}>{c.status}</Badge>
                    <span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{c.due}締切</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {tab==="brief" && (
          <div style={{display:"flex",gap:16}}>
            <div style={{flex:1}}>
              <Card accent={C.content} style={{padding:20}}>
                <SectionTitle color={C.content}>✦ AI動画台本・ブリーフ生成</SectionTitle>
                <div style={{marginBottom:12}}>
                  <div style={{fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:6}}>動画テーマ</div>
                  <input value={briefTopic} onChange={e=>setBriefTopic(e.target.value)}
                    placeholder="例: VideoTrackerを使って10分で動画を作った結果"
                    style={{width:"100%",background:C.bg,border:`1px solid ${C.content}44`,
                      color:C.text,fontFamily:MONO,fontSize:11,padding:"8px 12px",borderRadius:2,boxSizing:"border-box"}}/>
                </div>
                <div style={{marginBottom:16}}>
                  <div style={{fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:8}}>フォーマット</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {["TikTok 60秒","YouTube Short","Threads 動画","note 記事"].map(f=>(
                      <button key={f} style={{padding:"5px 10px",fontFamily:FONT,fontSize:4,cursor:"pointer",
                        background:`${C.content}22`,border:`1px solid ${C.content}44`,color:C.content,borderRadius:2}}>{f}</button>
                    ))}
                  </div>
                </div>
                <AIBtn onClick={generateBrief} loading={briefLoading} color={C.content}>台本・ブリーフを生成</AIBtn>
              </Card>
            </div>
            <div style={{flex:1}}>
              <Card accent={briefOutput?C.content:undefined} style={{padding:20,minHeight:300}}>
                <SectionTitle color={C.content}>生成されたブリーフ</SectionTitle>
                {briefOutput?(
                  <div style={{fontFamily:MONO,fontSize:11,color:C.text,lineHeight:1.9,whiteSpace:"pre-wrap",
                    background:`${C.content}06`,padding:14,border:`1px solid ${C.content}22`,borderRadius:2}}>
                    {briefOutput}
                    {briefLoading&&<span style={{display:"inline-block",width:7,height:13,background:C.content,marginLeft:2,animation:"pulse 0.8s infinite",verticalAlign:"text-bottom"}}/>}
                  </div>
                ):(
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,flexDirection:"column",gap:10}}>
                    <span style={{fontSize:32,opacity:0.3}}>🎬</span>
                    <span style={{fontFamily:MONO,fontSize:11,color:C.muted}}>テーマを入力して生成してください</span>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {tab==="performance" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card accent={C.content} style={{padding:16}}>
              <SectionTitle color={C.content}>コンテンツ別 再生数</SectionTitle>
              {[{title:"VideoTracker AI動画紹介",views:"42K",platform:"TikTok",col:C.content},
                {title:"開発日記 vol.3",views:"8,400PV",platform:"note",col:"#41c9b4"},
                {title:"Supabase解説動画",views:"18K",platform:"YouTube",col:"#ff0000"},
                {title:"匿名BBS使い方",views:"12K",platform:"TikTok",col:C.content},
                {title:"Kusuriko概要",views:"6,200PV",platform:"note",col:"#41c9b4"}].map((c,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                  <Tag label={c.platform} color={c.col}/>
                  <span style={{fontFamily:MONO,fontSize:10,color:C.text,flex:1}}>{c.title}</span>
                  <span style={{fontFamily:FONT,fontSize:6,color:c.col}}>{c.views}</span>
                </div>
              ))}
            </Card>
            <Card accent={C.content} style={{padding:16}}>
              <SectionTitle color={C.content}>VideoTracker 自社活用実績</SectionTitle>
              {[{l:"AI台本生成率",v:100,c:C.sec},{l:"ナレーション AI化",v:85,c:C.sec},
                {l:"サムネ自動生成",v:60,c:C.sales},{l:"投稿自動化",v:40,c:"#f97316"}].map(s=>(
                <div key={s.l} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontFamily:MONO,fontSize:10,color:C.text}}>{s.l}</span>
                    <span style={{fontFamily:FONT,fontSize:5.5,color:s.c}}>{s.v}%</span>
                  </div>
                  <ProgressBar value={s.v} color={s.c} height={5}/>
                </div>
              ))}
              <div style={{fontFamily:MONO,fontSize:10,color:C.muted,marginTop:12}}>
                ✦ 「作ったツールで自分たちがバズる」を実証中
              </div>
            </Card>
          </div>
        )}

        {tab==="studio" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card accent={C.content} style={{padding:16}}>
              <SectionTitle color={C.content}>使用ツールスタック</SectionTitle>
              {[{tool:"VideoTracker",role:"動画生成・自動化",status:"自社製品",col:C.content},
                {tool:"ElevenLabs",role:"AI ナレーション",status:"API連携済",col:"#f472b6"},
                {tool:"Runway Gen-4",role:"映像生成",status:"API連携済",col:"#a78bfa"},
                {tool:"Canva",role:"サムネイル作成",status:"手動",col:"#00c4cc"},
                {tool:"CapCut",role:"追加編集（敵を知る）",status:"参考分析",col:"#000"}].map(t=>(
                <div key={t.tool} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontFamily:FONT,fontSize:6,color:t.col,width:100}}>{t.tool}</span>
                  <span style={{fontFamily:MONO,fontSize:10,color:C.muted,flex:1}}>{t.role}</span>
                  <Badge color={t.col}>{t.status}</Badge>
                </div>
              ))}
            </Card>
            <Card accent={C.content} style={{padding:16}}>
              <SectionTitle color={C.content}>制作フロー</SectionTitle>
              {[{n:1,step:"テーマ決定（BuzzRadar分析）",time:"10分",done:true},
                {n:2,step:"AI台本生成（Claude）",time:"5分",done:true},
                {n:3,step:"映像生成（Runway / VideoTracker）",time:"15分",done:true},
                {n:4,step:"ナレーション（ElevenLabs）",time:"5分",done:false},
                {n:5,step:"編集・テロップ追加",time:"20分",done:false},
                {n:6,step:"自動投稿（広報部スケジューラ）",time:"0分",done:false}].map(f=>(
                <div key={f.n} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontFamily:FONT,fontSize:7,color:f.done?C.content:C.muted,width:20}}>{f.n}</span>
                  <span style={{fontFamily:MONO,fontSize:10,color:f.done?C.text:C.muted,flex:1}}>{f.step}</span>
                  <span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{f.time}</span>
                </div>
              ))}
              <div style={{fontFamily:FONT,fontSize:5,color:C.content,marginTop:12}}>合計: 約 55分 / 1本</div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   🔬 プロダクトリサーチ部
============================================================ */
function ResearchScreen() {
  const [tab,setTab]=useState("trends");
  const [researchOutput,setResearchOutput]=useState("");
  const [researchLoading,setResearchLoading]=useState(false);
  const [researchQuery,setResearchQuery]=useState("");

  const runResearch=async()=>{
    if(!researchQuery.trim()) return;
    setResearchLoading(true); setResearchOutput("");
    const sys="あなたは日本のスタートアップ市場のリサーチャーです。指定されたトピックについて、市場機会・競合・ユーザーニーズ・推奨アクションを分析してください。";
    const usr=`リサーチテーマ: ${researchQuery}\n対象市場: 日本 (モバイルファースト・SNS活用層)`;
    try{let f="";await callClaude(sys,usr,c=>{f+=c;setResearchOutput(f);});}
    catch(e){setResearchOutput("⚠ "+e.message);}
    setResearchLoading(false);
  };

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <DeptHeader color={C.research} icon="🔬" title="プロダクトリサーチ部" subtitle="BuzzRadarで次のトレンドを捕捉 · 競合分析 常時実施" badges={["BuzzRadar","競合分析","ユーザーインタビュー","AI分析"]}/>
      <TabBar color={C.research} active={tab} setActive={setTab} tabs={[{k:"trends",l:"トレンド"},{k:"ai-research",l:"✦ AI分析"},{k:"interviews",l:"ユーザーインタビュー"},{k:"next",l:"次の一手"}]}/>
      <div style={{flex:1,overflow:"auto",padding:20}}>

        {tab==="trends" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
              <StatCard label="監視キーワード" value="48件" color={C.research}/>
              <StatCard label="急上昇トレンド" value="7件" sub="今週" color={C.sales}/>
              <StatCard label="競合プロダクト" value="23件" sub="追跡中" color={C.research}/>
              <StatCard label="次回リサーチ" value="4/7" sub="月次" color={C.muted}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
              <Card accent={C.research} style={{padding:16}}>
                <SectionTitle color={C.research}>BuzzRadar — 急上昇トレンド</SectionTitle>
                {[{kw:"AI動画 自動生成",score:94,category:"VideoTracker関連",trend:"🔥",col:"#ef4444"},
                  {kw:"薬 副作用 調べ方",score:87,category:"Kusuriko関連",trend:"📈",col:C.research},
                  {kw:"匿名 SNS 安全",score:82,category:"BBS関連",trend:"📈",col:C.research},
                  {kw:"TikTok 企業 活用",score:78,category:"VideoTracker関連",trend:"📈",col:C.research},
                  {kw:"CapCut 代替",score:71,category:"競合分析",trend:"⚡",col:C.sales},
                  {kw:"note 収益化",score:65,category:"コンテンツ関連",trend:"➡",col:C.muted}].map((t,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                    <span style={{fontSize:14}}>{t.trend}</span>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:FONT,fontSize:5,color:t.col,marginBottom:2}}>{t.kw}</div>
                      <div style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{t.category}</div>
                    </div>
                    <div style={{width:80}}>
                      <ProgressBar value={t.score} color={t.col} height={4}/>
                    </div>
                    <span style={{fontFamily:FONT,fontSize:6,color:t.col,width:28}}>{t.score}</span>
                  </div>
                ))}
              </Card>
              <Card accent={C.research} style={{padding:16}}>
                <SectionTitle color={C.research}>競合アップデート</SectionTitle>
                {[{name:"CapCut",update:"新機能: AI BGM自動生成",impact:"中",time:"2日前"},
                  {name:"LIPS",update:"薬レビュー機能テスト中",impact:"高",time:"5日前"},
                  {name:"Peing",update:"iOS 新バージョンリリース",impact:"低",time:"1週前"}].map((c,i)=>(
                  <div key={i} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <span style={{fontFamily:FONT,fontSize:5,color:C.research}}>{c.name}</span>
                      <Badge color={{高:"#ef4444",中:C.sales,低:C.muted}[c.impact]}>{c.impact}影響</Badge>
                      <span style={{fontFamily:MONO,fontSize:9,color:C.muted,marginLeft:"auto"}}>{c.time}</span>
                    </div>
                    <div style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{c.update}</div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {tab==="ai-research" && (
          <div style={{display:"flex",gap:16}}>
            <div style={{flex:1}}>
              <Card accent={C.research} style={{padding:20}}>
                <SectionTitle color={C.research}>✦ AI市場リサーチ</SectionTitle>
                <div style={{marginBottom:12}}>
                  <div style={{fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:6}}>リサーチテーマ</div>
                  <input value={researchQuery} onChange={e=>setResearchQuery(e.target.value)}
                    placeholder="例: 日本の薬レビュー市場の競合状況と参入機会"
                    style={{width:"100%",background:C.bg,border:`1px solid ${C.research}44`,
                      color:C.text,fontFamily:MONO,fontSize:11,padding:"8px 12px",borderRadius:2,boxSizing:"border-box"}}/>
                </div>
                <div style={{marginBottom:16}}>
                  <div style={{fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:8}}>クイック分析テンプレ</div>
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    {["VideoTrackerの次のターゲット市場","Kusirukoの差別化ポイント分析","匿名BBSのマネタイズ改善案"].map(t=>(
                      <button key={t} onClick={()=>setResearchQuery(t)} style={{padding:"6px 10px",fontFamily:MONO,fontSize:10,
                        background:`${C.research}18`,border:`1px solid ${C.research}44`,color:C.research,cursor:"pointer",
                        borderRadius:2,textAlign:"left"}}>▸ {t}</button>
                    ))}
                  </div>
                </div>
                <AIBtn onClick={runResearch} loading={researchLoading} color={C.research}>AI分析を実行</AIBtn>
              </Card>
            </div>
            <div style={{flex:1.5}}>
              <Card accent={researchOutput?C.research:undefined} style={{padding:20,minHeight:400}}>
                <SectionTitle color={C.research}>分析結果</SectionTitle>
                {researchOutput?(
                  <div style={{fontFamily:MONO,fontSize:11,color:C.text,lineHeight:1.9,whiteSpace:"pre-wrap"}}>
                    {researchOutput}
                    {researchLoading&&<span style={{display:"inline-block",width:7,height:13,background:C.research,marginLeft:2,animation:"pulse 0.8s infinite",verticalAlign:"text-bottom"}}/>}
                  </div>
                ):(
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:300,flexDirection:"column",gap:10}}>
                    <span style={{fontSize:40,opacity:0.2}}>🔬</span>
                    <span style={{fontFamily:MONO,fontSize:11,color:C.muted}}>テーマを入力して分析を実行してください</span>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {tab==="interviews" && (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:8}}>
              <StatCard label="今月インタビュー" value="8件" color={C.research}/>
              <StatCard label="NPS平均" value="71" sub="全プロダクト" color={C.sec}/>
              <StatCard label="重要フィードバック" value="12件" sub="対応済 8件" color={C.research}/>
            </div>
            {[{user:"田中 一郎 (VideoTracker Pro)",quote:"AIで動画作れるのは革命的。でも日本語ナレーションの精度をもっと上げてほしい",sentiment:"positive",date:"3/28"},
              {user:"Kim Jisoo (匿名BBS Beta)",quote:"匿名だからこそ言える本音がある。ただもっとカテゴリ分けしてほしい",sentiment:"mixed",date:"3/25"},
              {user:"鈴木 花子 (Kusuriko)",quote:"副作用の情報がすごく助かる。でも薬の読み方がわからない時がある",sentiment:"positive",date:"3/22"}].map((i,idx)=>(
              <Card key={idx} accent={C.research} style={{padding:16}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <span style={{fontSize:16}}>{i.sentiment==="positive"?"😊":"🤔"}</span>
                  <span style={{fontFamily:FONT,fontSize:5.5,color:C.research,flex:1}}>{i.user}</span>
                  <span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{i.date}</span>
                </div>
                <div style={{fontFamily:MONO,fontSize:11,color:C.text,lineHeight:1.8,fontStyle:"italic",
                  padding:"10px 14px",background:`${C.research}08`,border:`1px solid ${C.research}33`,borderRadius:2}}>
                  「{i.quote}」
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab==="next" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card accent={C.research} style={{padding:16}}>
              <SectionTitle color={C.research}>次のプロダクト候補</SectionTitle>
              {[{name:"AI薬剤師チャット",score:88,market:"健康・医療",fit:"Kusuriko拡張",col:"#34d399"},
                {name:"動画SEOツール",score:81,market:"コンテンツマーケ",fit:"VideoTracker拡張",col:C.research},
                {name:"企業向け匿名フィードバック",score:74,market:"HR Tech",fit:"BBS BtoB展開",col:"#f472b6"},
                {name:"日本語特化 AI コピーライター",score:69,market:"マーケ",fit:"新プロダクト",col:C.muted}].map(p=>(
                <div key={p.name} style={{padding:"10px 12px",marginBottom:8,border:`1px solid ${p.col}44`,
                  background:`${p.col}06`,borderRadius:2}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <span style={{fontFamily:FONT,fontSize:5.5,color:p.col,flex:1}}>{p.name}</span>
                    <span style={{fontFamily:FONT,fontSize:10,color:p.col}}>{p.score}</span>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <Tag label={p.market} color={p.col}/>
                    <Tag label={p.fit} color={p.col}/>
                  </div>
                </div>
              ))}
            </Card>
            <Card accent={C.research} style={{padding:16}}>
              <SectionTitle color={C.research}>機能追加ロードマップ候補</SectionTitle>
              {[{feature:"VideoTracker: 日本語字幕自動生成",votes:42,col:C.research},
                {feature:"Kusuriko: お薬手帳連携",votes:38,col:"#34d399"},
                {feature:"BBS: 既読/未読 管理",votes:31,col:"#f472b6"},
                {feature:"VideoTracker: YouTube自動アップ",votes:28,col:C.research},
                {feature:"全プロダクト: LINE通知",votes:24,col:"#06c755"}].map(f=>(
                <div key={f.feature} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontFamily:FONT,fontSize:8,color:f.col,width:28}}>{f.votes}</span>
                  <span style={{fontFamily:MONO,fontSize:10,color:C.text,flex:1}}>{f.feature}</span>
                  <span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>票</span>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   🤖 AI自動化部
============================================================ */
function AutomationScreen() {
  const [tab,setTab]=useState("bots");
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <DeptHeader color={C.automation} icon="🤖" title="AI自動化部 / AUTOMATION" subtitle="常時稼働 9ボット · 本日 342タスク自動処理" badges={["GitHub Actions","Windowsエージェント","Supabase Trigger","Claude API"]}/>
      <TabBar color={C.automation} active={tab} setActive={setTab} tabs={[{k:"bots",l:"稼働ボット"},{k:"logs",l:"実行ログ"},{k:"scheduler",l:"スケジューラ"},{k:"new",l:"新規自動化"}]}/>
      <div style={{flex:1,overflow:"auto",padding:20}}>

        {tab==="bots" && (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:12}}>
              <StatCard label="稼働ボット数" value="9本" color={C.automation}/>
              <StatCard label="本日処理タスク" value="342" color={C.sec} trend={8}/>
              <StatCard label="エラー率" value="0.3%" sub="過去7日" color={C.sales}/>
              <StatCard label="推定削減時間" value="4.2時間/日" color={C.automation}/>
            </div>
            {[
              {name:"SNS自動投稿ボット",desc:"Threads/note/Xへの定時投稿を完全自動化",tech:"GitHub Actions + Claude API",status:"稼働中",runs:"18回/日",col:C.pr,dept:"広報部"},
              {name:"Windowsエージェント",desc:"全PC同期・デバイスping・presence更新",tech:"Python + Supabase",status:"稼働中",runs:"60回/時",col:C.automation,dept:"全社"},
              {name:"売上レポートBot",desc:"Stripe→Supabase→Notion 毎日自動サマリー",tech:"GitHub Actions + Stripe API",status:"稼働中",runs:"1回/日",col:C.finance,dept:"財務部"},
              {name:"コスト監視Bot",desc:"APIコストが上限80%に達したらSlack通知",tech:"Supabase Edge Function",status:"稼働中",runs:"常時監視",col:C.ai,dept:"AI部"},
              {name:"CS自動振り分けBot",desc:"問い合わせを優先度・プロダクト別に自動分類",tech:"Claude API + Zendesk",status:"稼働中",runs:"問い合わせ毎",col:C.cs,dept:"CS部"},
              {name:"SEOキーワード監視Bot",desc:"検索順位変動を毎朝チェックしてレポート送信",tech:"Python + SearchConsole API",status:"稼働中",runs:"1回/日",col:C.marketing,dept:"マーケ部"},
              {name:"競合分析Bot",desc:"CapCut/LIPS等の更新情報を自動収集",tech:"GitHub Actions + スクレイピング",status:"稼働中",runs:"1回/日",col:C.research,dept:"リサーチ部"},
              {name:"カレンダー同期Bot",desc:"TimeTree/Google Cal/iPhoneを常時同期",tech:"CalDAV + TimeTree API",status:"稼働中",runs:"15分毎",col:C.sec,dept:"秘書室"},
              {name:"バグ自動トリアージBot",desc:"エラーログからバグを検出し自動チケット作成",tech:"Supabase + Claude API",status:"テスト中",runs:"エラー毎",col:C.sales,dept:"開発部"},
            ].map((bot,i)=>(
              <Card key={i} accent={bot.status==="稼働中"?bot.col:C.muted} style={{padding:"14px 18px"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <Dot color={bot.status==="稼働中"?bot.col:C.muted} pulse={bot.status==="稼働中"} size={8}/>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontFamily:FONT,fontSize:6,color:bot.status==="稼働中"?bot.col:C.muted}}>{bot.name}</span>
                      <Tag label={bot.dept} color={bot.col}/>
                    </div>
                    <div style={{fontFamily:MONO,fontSize:10,color:C.muted,marginBottom:3}}>{bot.desc}</div>
                    <div style={{fontFamily:MONO,fontSize:9,color:C.dim}}>使用技術: {bot.tech}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontFamily:FONT,fontSize:6,color:bot.col,marginBottom:3}}>{bot.runs}</div>
                    <Badge color={bot.status==="稼働中"?C.sec:C.sales}>{bot.status}</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab==="logs" && (
          <Card style={{padding:0,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"55px 180px 1fr 70px 45px",
              padding:"8px 14px",borderBottom:`1px solid ${C.border}`,background:C.bg}}>
              {["時刻","ボット名","実行内容","所要時間","状態"].map(h=>(
                <span key={h} style={{fontFamily:FONT,fontSize:4,color:C.muted}}>{h}</span>
              ))}
            </div>
            {[
              {time:"14:35",bot:"SNS自動投稿",action:"Threads: 開発日記投稿完了",ms:1240,ok:true},
              {time:"14:30",bot:"カレンダー同期",action:"TimeTree ↔ Google Cal 同期完了 (8件)",ms:890,ok:true},
              {time:"14:25",bot:"コスト監視",action:"Anthropic API: 56% — 正常範囲",ms:120,ok:true},
              {time:"14:20",bot:"Windowsエージェント",action:"全デバイスpingOK / presence更新",ms:200,ok:true},
              {time:"14:15",bot:"競合分析",action:"CapCut: 新機能確認 → リサーチ部へ通知",ms:4200,ok:true},
              {time:"14:08",bot:"バグ自動トリアージ",action:"エラーログ解析: 新規バグ0件",ms:680,ok:true},
              {time:"14:00",bot:"SEOキーワード監視",action:"ERROR: SearchConsole API タイムアウト",ms:10000,ok:false},
            ].map((l,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"55px 180px 1fr 70px 45px",
                padding:"9px 14px",borderBottom:`1px solid ${C.border}`,background:i%2===0?"transparent":`${C.border}22`}}>
                <span style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{l.time}</span>
                <span style={{fontFamily:MONO,fontSize:10,color:C.automation}}>{l.bot}</span>
                <span style={{fontFamily:MONO,fontSize:10,color:l.ok?C.text:C.muted}}>{l.action}</span>
                <span style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{l.ms}ms</span>
                <span style={{fontFamily:FONT,fontSize:4,color:l.ok?C.sec:"#ef4444"}}>{l.ok?"OK":"ERR"}</span>
              </div>
            ))}
          </Card>
        )}

        {tab==="scheduler" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Card accent={C.automation} style={{padding:16}}>
              <SectionTitle color={C.automation}>定期実行スケジュール</SectionTitle>
              {[{time:"毎分",bots:["Windowsエージェント ping","Presence heartbeat"]},
                {time:"15分毎",bots:["カレンダー同期"]},
                {time:"毎時",bots:["コスト監視","エラーログ確認"]},
                {time:"毎朝 9:00",bots:["SEOキーワードレポート","競合分析"]},
                {time:"毎日 18:00",bots:["売上レポート生成","CS日次サマリー"]},
                {time:"投稿時刻毎",bots:["SNS自動投稿 (10,12,15,17,19時)"]},
              ].map(s=>(
                <div key={s.time} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                  <div style={{fontFamily:FONT,fontSize:4.5,color:C.automation,marginBottom:5}}>{s.time}</div>
                  {s.bots.map(b=>(
                    <div key={b} style={{fontFamily:MONO,fontSize:10,color:C.text,
                      padding:"2px 8px",marginBottom:3,background:`${C.automation}10`,borderRadius:2}}>▸ {b}</div>
                  ))}
                </div>
              ))}
            </Card>
            <Card accent={C.automation} style={{padding:16}}>
              <SectionTitle color={C.automation}>時間帯別 実行数</SectionTitle>
              <svg width="100%" height={140} viewBox="0 0 240 120">
                {[12,18,45,32,28,38,65,42,58,72,88,95,82,74,68,62,55,48,40,35,28,22,18,14].map((v,i)=>{
                  const h=Math.round(v/100*100);
                  return <rect key={i} x={i*10} y={100-h} width={8} height={h} fill={C.automation} opacity={0.6+h/300} rx={1}/>;
                })}
                {["0","6","12","18","23"].map((l,i)=>(
                  <text key={l} x={i*60} y={118} fontSize={7} fill={C.muted} fontFamily={MONO}>{l}時</text>
                ))}
              </svg>
              <div style={{fontFamily:MONO,fontSize:10,color:C.muted,marginTop:8}}>
                ピーク: 10〜12時 · 深夜帯も自動稼働中
              </div>
            </Card>
          </div>
        )}

        {tab==="new" && (
          <Card accent={C.automation} style={{padding:20,maxWidth:600}}>
            <SectionTitle color={C.automation}>新規自動化を追加</SectionTitle>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[{l:"自動化の名前",ph:"例: Stripe → Notion 売上Bot"},{l:"実行トリガー",ph:"例: 毎日 9:00 / Webhook / Supabase変更時"}].map(f=>(
                <div key={f.l}>
                  <div style={{fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:5}}>{f.l}</div>
                  <input placeholder={f.ph} style={{width:"100%",background:C.bg,border:`1px solid ${C.automation}44`,
                    color:C.text,fontFamily:MONO,fontSize:11,padding:"7px 10px",borderRadius:2,boxSizing:"border-box"}}/>
                </div>
              ))}
              <div>
                <div style={{fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:5}}>使用技術スタック</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {["GitHub Actions","Python","Supabase Edge Function","Claude API","n8n"].map(t=>(
                    <button key={t} style={{padding:"5px 10px",fontFamily:FONT,fontSize:4,cursor:"pointer",
                      background:`${C.automation}22`,border:`1px solid ${C.automation}44`,color:C.automation,borderRadius:2}}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontFamily:FONT,fontSize:4.5,color:C.muted,marginBottom:5}}>処理内容の説明</div>
                <textarea placeholder="何をどのように自動化するか" style={{width:"100%",height:80,background:C.bg,
                  border:`1px solid ${C.automation}44`,color:C.text,fontFamily:MONO,fontSize:11,padding:10,
                  borderRadius:2,resize:"none",boxSizing:"border-box",lineHeight:1.7}}/>
              </div>
              <button style={{padding:"10px",fontFamily:FONT,fontSize:6,background:`${C.automation}22`,
                border:`1px solid ${C.automation}`,color:C.automation,cursor:"pointer",borderRadius:2}}>
                ✦ 自動化を追加
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   🌐 パートナー部
============================================================ */
function PartnerScreen() {
  const [tab,setTab]=useState("overview");
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <DeptHeader color={C.partner} icon="🌐" title="パートナー部 / ALLIANCE" subtitle="API連携 4件 · 代理店 2社 · コラボ進行 3件" badges={["API連携","代理店","インフルエンサー","企業提携"]}/>
      <TabBar color={C.partner} active={tab} setActive={setTab} tabs={[{k:"overview",l:"概要"},{k:"api-partners",l:"API・技術提携"},{k:"influencers",l:"インフルエンサー"},{k:"pipeline",l:"商談パイプライン"}]}/>
      <div style={{flex:1,overflow:"auto",padding:20}}>

        {tab==="overview" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
              <StatCard label="技術パートナー" value="4社" color={C.partner}/>
              <StatCard label="代理店" value="2社" sub="契約済" color={C.sec}/>
              <StatCard label="コラボ案件" value="3件" sub="進行中" color={C.partner} trend={50}/>
              <StatCard label="パートナー経由 MRR" value="¥8.2万" sub="全体の13%" color={C.partner}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
              <Card accent={C.partner} style={{padding:16}}>
                <SectionTitle color={C.partner}>パートナー一覧</SectionTitle>
                {[{name:"Runway ML",type:"技術提携",detail:"Gen-4 優先APIアクセス・割引料金",status:"契約中",col:C.partner},
                  {name:"ElevenLabs",type:"技術提携",detail:"TurboV2 API・ボリューム割引",status:"契約中",col:"#f472b6"},
                  {name:"Wantedly",type:"採用提携",detail:"求人掲載 優先表示・採用支援",status:"契約中",col:"#ff7f7f"},
                  {name:"マクアケ",type:"資金調達候補",detail:"VideoTracker クラファン検討中",status:"交渉中",col:C.sales},
                  {name:"株式会社A（代理店）",type:"代理店",detail:"中小企業向け VideoTracker 販売",status:"稼働中",col:C.sec},
                  {name:"デジタルマーケB社",type:"代理店",detail:"マーケ業界向けパッケージ販売",status:"稼働中",col:C.sec}].map((p,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                    <Dot color={p.status==="稼働中"||p.status==="契約中"?p.col:C.sales} size={7} pulse={p.status==="稼働中"}/>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:FONT,fontSize:5.5,color:p.col,marginBottom:3}}>{p.name}</div>
                      <div style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{p.detail}</div>
                    </div>
                    <Tag label={p.type} color={p.col}/>
                    <Badge color={p.status==="稼働中"||p.status==="契約中"?C.sec:C.sales}>{p.status}</Badge>
                  </div>
                ))}
              </Card>
              <Card accent={C.partner} style={{padding:16}}>
                <SectionTitle color={C.partner}>進行中コラボ</SectionTitle>
                {[{title:"テック系YouTuber × VideoTracker",status:"交渉中",reach:"8.2万人",col:C.partner},
                  {title:"Zenn × 技術記事スポンサー",status:"確定",reach:"月30万PV",col:C.sec},
                  {title:"HR Techカンファレンス登壇",status:"申込済",reach:"500名",col:C.research}].map((c,i)=>(
                  <div key={i} style={{padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{fontFamily:FONT,fontSize:5,color:c.col,marginBottom:4}}>{c.title}</div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <Badge color={c.col}>{c.status}</Badge>
                      <span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>リーチ {c.reach}</span>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {tab==="api-partners" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            {[{name:"Runway ML",icon:"🎬",tier:"プレミアム",discount:"15%OFF",rpm:20,sla:"99.9%",col:C.partner},
              {name:"ElevenLabs",icon:"🔊",tier:"ビジネス",discount:"20%OFF",rpm:120,sla:"99.5%",col:"#f472b6"},
              {name:"Anthropic",icon:"🤖",tier:"スタンダード",discount:"なし",rpm:300,sla:"99.9%",col:C.ai},
              {name:"Supabase",icon:"🗄",tier:"Pro",discount:"なし",rpm:null,sla:"99.9%",col:C.sec}].map(p=>(
              <Card key={p.name} accent={p.col} style={{padding:16}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <span style={{fontSize:24}}>{p.icon}</span>
                  <div>
                    <div style={{fontFamily:FONT,fontSize:7,color:p.col}}>{p.name}</div>
                    <div style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{p.tier}</div>
                  </div>
                </div>
                {[{l:"割引",v:p.discount},{l:"RPM上限",v:p.rpm?`${p.rpm}回/分`:"無制限"},{l:"SLA",v:p.sla}].map(s=>(
                  <div key={s.l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                    <span style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{s.l}</span>
                    <span style={{fontFamily:FONT,fontSize:5.5,color:p.col}}>{s.v}</span>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        )}

        {tab==="influencers" && (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[{name:"@tech_startup_jp",platform:"X",followers:"42K",niche:"スタートアップ",status:"コラボ中",rate:"¥80,000/投稿",col:C.partner},
              {name:"@ai_video_creator",platform:"TikTok",followers:"128K",niche:"AI・動画",status:"交渉中",rate:"¥150,000/動画",col:C.pr},
              {name:"@pharmacy_note",platform:"note",followers:"8,200",niche:"薬・健康",status:"候補",rate:"¥30,000/記事",col:"#34d399"},
              {name:"@anonymous_life_jp",platform:"Threads",followers:"22K",niche:"ライフスタイル",status:"候補",rate:"¥50,000/投稿",col:"#fff"}].map((inf,i)=>(
              <Card key={i} accent={inf.col} style={{padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <Dot color={inf.status==="コラボ中"?inf.col:C.muted} size={7} pulse={inf.status==="コラボ中"}/>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontFamily:FONT,fontSize:6,color:inf.col}}>{inf.name}</span>
                      <Tag label={inf.platform} color={inf.col}/>
                      <Tag label={inf.niche} color={inf.col}/>
                    </div>
                    <div style={{fontFamily:MONO,fontSize:10,color:C.muted}}>フォロワー {inf.followers}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:FONT,fontSize:6,color:inf.col,marginBottom:4}}>{inf.rate}</div>
                    <Badge color={inf.status==="コラボ中"?C.sec:inf.status==="交渉中"?C.sales:C.muted}>{inf.status}</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab==="pipeline" && (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:12}}>
              <StatCard label="商談中" value="5件" color={C.partner}/>
              <StatCard label="今月成約予定" value="2件" color={C.sec}/>
              <StatCard label="パートナー経由売上予測" value="¥12万/月" color={C.partner} trend={48}/>
            </div>
            {[{name:"C社 (SaaS代理店)",stage:"最終提案",value:"¥50万/年",prob:80,col:C.sec},
              {name:"D社 (HR系SaaS)",stage:"NDA締結",value:"¥30万/年",prob:60,col:C.partner},
              {name:"E社 (医療IT)",stage:"初回MTG",value:"¥80万/年",prob:25,col:"#f97316"},
              {name:"YouTuber F氏",stage:"見積送付",value:"¥15万/動画",prob:70,col:C.pr},
              {name:"G社 (ECプラットフォーム)",stage:"情報収集",value:"未定",prob:15,col:C.muted}].map((p,i)=>(
              <Card key={i} accent={p.col} style={{padding:"12px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <Dot color={p.col} size={6}/>
                  <span style={{fontFamily:MONO,fontSize:12,color:C.text,flex:1,fontWeight:"bold"}}>{p.name}</span>
                  <Tag label={p.stage} color={p.col}/>
                  <span style={{fontFamily:FONT,fontSize:6,color:p.col}}>{p.value}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1}}><ProgressBar value={p.prob} color={p.col} height={4}/></div>
                  <span style={{fontFamily:FONT,fontSize:5,color:p.col,width:36,textAlign:"right"}}>{p.prob}%</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
/* ============================================================
   ROOT
============================================================ */
export default function CompanyOS() {
  const [screen,setScreen]=useState("floor");
  const [notifs,setNotifs]=useState(INIT_NOTIFS);
  const [showNotifs,setShowNotifs]=useState(false);
  const unread=notifs.filter(n=>!n.read).length;
  const pushNotif=useCallback((dept,title,body)=>{
    setNotifs(prev=>[{id:Date.now(),dept,title,body,
      time:new Date().toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"}),
      read:false,urgent:false},...prev]);
  },[]);
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=DM+Mono:wght@400;500&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#050810;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#050810;}
        ::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:2px;}
        input[type=range]{height:4px;}
        input,textarea,button{outline:none;}
      `}</style>
      <div style={{ background:C.bg,height:"100vh",display:"flex",flexDirection:"column",color:C.text,overflow:"hidden" }}>
        <TopBar screen={screen} setScreen={setScreen} notifCount={unread} onBell={()=>setShowNotifs(v=>!v)}/>
        <div style={{ flex:1,display:"flex",overflow:"hidden",position:"relative" }}>
          <Sidebar screen={screen}/>
          <div style={{ flex:1,display:"flex",overflow:"hidden" }}>
            {screen==="floor"     && <FloorScreen setScreen={setScreen}/>}
            {screen==="dev"       && <DevScreen pushNotif={pushNotif}/>}
            {screen==="pr"        && <PRScreen pushNotif={pushNotif}/>}
            {screen==="sales"     && <SalesScreen pushNotif={pushNotif}/>}
            {screen==="secretary" && <SecretaryScreen/>}
            {screen==="finance"   && <FinanceScreen/>}
            {screen==="product"   && <ProductScreen/>}
            {screen==="ai"        && <AIScreen/>}
            {screen==="data"      && <DataScreen/>}
            {screen==="hr"         && <HRScreen/>}
            {screen==="marketing"  && <MarketingScreen/>}
            {screen==="legal"      && <LegalScreen/>}
            {screen==="cs"         && <CSScreen/>}
            {screen==="japan"      && <JapanScreen/>}
            {screen==="content"    && <ContentFactoryScreen/>}
            {screen==="research"   && <ResearchScreen/>}
            {screen==="automation" && <AutomationScreen/>}
            {screen==="partner"    && <PartnerScreen/>}
          </div>
          {showNotifs&&<NotificationPanel notifs={notifs} setNotifs={setNotifs} onClose={()=>setShowNotifs(false)}/>}
        </div>
      </div>
    </>
  );
}
