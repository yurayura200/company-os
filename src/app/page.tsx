"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   DESIGN TOKENS
============================================================ */
const FONT = "'Press Start 2P', monospace";
const MONO = "'DM Mono', monospace";
const C = {
  bg:"#020508", panel:"#060d14", border:"#0a2030",
  gold:"#fbbf24", goldDim:"#92400e",
  green:"#4ade80", greenDim:"#14532d",
  red:"#f87171", redDim:"#7f1d1d",
  blue:"#38bdf8", blueDim:"#0c4a6e",
  purple:"#c084fc", purpleDim:"#4a1d96",
  orange:"#fb923c",
  text:"#e2e8f0", muted:"#475569", dim:"#1e293b",
  hp:"#22c55e", mp:"#818cf8", xp:"#f59e0b",
};

/* ============================================================
   CLAUDE API (via server-side proxy)
============================================================ */
async function callClaude(system, user, onChunk) {
  const res = await fetch("/api/claude", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ system, user }),
  });
  if(!res.ok) throw new Error(`API ${res.status}`);
  const reader=res.body.getReader(); const dec=new TextDecoder(); let buf="";
  while(true){
    const{done,value}=await reader.read(); if(done) break;
    buf+=dec.decode(value,{stream:true});
    const lines=buf.split("\n"); buf=lines.pop();
    for(const line of lines){
      if(!line.startsWith("data: ")) continue;
      const d=line.slice(6).trim(); if(d==="[DONE]") return;
      try{const j=JSON.parse(d);if(j.delta?.text)onChunk(j.delta.text);}catch{}
    }
  }
}

/* ============================================================
   ANIMATED COUNTER
============================================================ */
function Counter({ target, prefix="", suffix="", color, size=14, duration=1200 }) {
  const [val, setVal] = useState(0);
  const start = useRef(Date.now());
  useEffect(() => {
    start.current = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start.current;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(Math.floor(ease * target));
      if (progress < 1) requestAnimationFrame(tick);
      else setVal(target);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return (
    <span style={{ fontFamily:FONT, fontSize:size, color,
      textShadow:`0 0 12px ${color}88`, letterSpacing:"0.05em" }}>
      {prefix}{val.toLocaleString()}{suffix}
    </span>
  );
}

/* ============================================================
   HP / MP / XP BAR
============================================================ */
function StatBar({ label, value, max, color, icon, showVal=true }) {
  const pct = Math.min(value/max*100, 100);
  const barColor = pct > 60 ? color : pct > 30 ? C.orange : C.red;
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3, alignItems:"center" }}>
        <span style={{ fontFamily:FONT, fontSize:4.5, color:C.muted }}>
          {icon} {label}
        </span>
        {showVal && (
          <span style={{ fontFamily:FONT, fontSize:4.5, color:barColor }}>
            {value}/{max}
          </span>
        )}
      </div>
      <div style={{ height:8, background:"#0a1520", borderRadius:1, overflow:"hidden",
        border:`1px solid ${color}33`, position:"relative" }}>
        <div style={{
          height:"100%", width:`${pct}%`, background:barColor,
          boxShadow:`0 0 8px ${barColor}88`,
          transition:"width 0.8s ease",
          position:"relative",
        }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:"40%",
            background:"rgba(255,255,255,0.15)" }}/>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PIXEL STAR RATING
============================================================ */
const Stars = ({ count, max=5, color }) => (
  <div style={{ display:"flex", gap:2 }}>
    {Array.from({length:max}).map((_,i)=>(
      <div key={i} style={{ width:8, height:8,
        background:i<count?color:"#1e293b",
        boxShadow:i<count?`0 0 4px ${color}`:undefined,
        clipPath:"polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)"
      }}/>
    ))}
  </div>
);

/* ============================================================
   QUEST CARD
============================================================ */
function QuestCard({ quest, onComplete }) {
  const diffColor = { S:C.gold, A:"#f97316", B:C.blue, C:C.green }[quest.diff];
  return (
    <div style={{
      padding:"10px 12px", marginBottom:8, borderRadius:2,
      border:`1px solid ${quest.done?C.green+"44":diffColor+"55"}`,
      background:quest.done?`${C.green}08`:`${diffColor}06`,
      opacity:quest.done?0.7:1,
      transition:"all 0.3s",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
        <div style={{ fontFamily:FONT, fontSize:5, color:diffColor, padding:"2px 5px",
          border:`1px solid ${diffColor}`, flexShrink:0 }}>{quest.diff}</div>
        <span style={{ fontFamily:FONT, fontSize:5, color:quest.done?C.green:C.text, flex:1,
          textDecoration:quest.done?"line-through":"none" }}>{quest.title}</span>
        <span style={{ fontFamily:FONT, fontSize:5, color:C.gold }}>+{quest.xp}XP</span>
      </div>
      <div style={{ fontFamily:MONO, fontSize:10, color:C.muted, marginBottom:quest.done?0:8,
        lineHeight:1.7 }}>{quest.desc}</div>
      {!quest.done && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ flex:1, marginRight:10 }}>
            <div style={{ height:4, background:C.border, borderRadius:1 }}>
              <div style={{ height:"100%", width:`${quest.progress}%`, background:diffColor,
                boxShadow:`0 0 4px ${diffColor}`, borderRadius:1, transition:"width 0.6s" }}/>
            </div>
            <div style={{ fontFamily:MONO, fontSize:9, color:C.muted, marginTop:2 }}>{quest.progress}%</div>
          </div>
          {quest.progress>=100 && (
            <button onClick={()=>onComplete(quest.id)} style={{
              fontFamily:FONT, fontSize:4, padding:"4px 10px",
              background:`${C.gold}22`, border:`1px solid ${C.gold}`,
              color:C.gold, cursor:"pointer", borderRadius:1,
              boxShadow:`0 0 8px ${C.gold}44`,
              animation:"pulse 1s infinite",
            }}>✓ 完了！</button>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   LEVEL UP OVERLAY
============================================================ */
function LevelUpOverlay({ dept, level, onClose }) {
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:1000,
      background:"rgba(0,0,0,0.85)",
      display:"flex", alignItems:"center", justifyContent:"center",
      animation:"fadeIn 0.3s ease",
    }} onClick={onClose}>
      <div style={{
        textAlign:"center", padding:40,
        border:`2px solid ${C.gold}`,
        background:"#020508",
        boxShadow:`0 0 60px ${C.gold}44, inset 0 0 40px ${C.goldDim}22`,
        position:"relative",
      }}>
        {Array.from({length:12}).map((_,i)=>(
          <div key={i} style={{
            position:"absolute",
            left:`${10+Math.random()*80}%`, top:`${10+Math.random()*80}%`,
            width:4, height:4, background:C.gold,
            animation:`sparkle ${0.5+Math.random()}s ease-out infinite`,
            animationDelay:`${Math.random()*0.5}s`,
          }}/>
        ))}
        <div style={{ fontFamily:FONT, fontSize:8, color:C.gold, marginBottom:12,
          textShadow:`0 0 20px ${C.gold}`, letterSpacing:"0.2em" }}>
          LEVEL UP!
        </div>
        <div style={{ fontFamily:FONT, fontSize:24, color:"#fff", marginBottom:8,
          textShadow:`0 0 30px ${C.gold}` }}>Lv.{level}</div>
        <div style={{ fontFamily:MONO, fontSize:14, color:C.gold, marginBottom:20 }}>
          {dept} がレベルアップしました！
        </div>
        <div style={{ fontFamily:FONT, fontSize:5, color:C.muted }}>
          タップして続ける
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   AI ADVISOR CHARACTER
============================================================ */
function AIAdvisor({ advice, loading, onAsk }) {
  const [frame, setFrame] = useState(0);
  useEffect(()=>{
    const i=setInterval(()=>setFrame(f=>(f+1)%4),400);
    return()=>clearInterval(i);
  },[]);
  const bob=[0,-2,0,2][frame];

  return (
    <div style={{
      background:"#030a10", border:`1px solid ${C.gold}44`,
      borderRadius:3, overflow:"hidden",
      boxShadow:`0 0 20px ${C.gold}11`,
    }}>
      <div style={{ padding:"8px 12px", background:`${C.gold}11`,
        borderBottom:`1px solid ${C.gold}33`,
        display:"flex", alignItems:"center", gap:10 }}>
        <svg width={28} height={40} style={{ flexShrink:0 }}>
          <g transform={`translate(14,${20+bob})`}>
            <ellipse cx={0} cy={16} rx={6} ry={1.5} fill="rgba(0,0,0,0.4)"/>
            <rect x={-4} y={-2} width={8} height={10} fill={C.purple} rx={1}/>
            <rect x={-6} y={-1} width={3} height={7} fill={C.purple} rx={1}/>
            <rect x={3} y={-1} width={3} height={7} fill={C.purple} rx={1}/>
            <rect x={-3} y={8} width={3} height={8} fill="#1e293b" rx={1}/>
            <rect x={0} y={8} width={3} height={8} fill="#1e293b" rx={1}/>
            <rect x={-4} y={-11} width={8} height={9} fill="#FDDCB5" rx={1}/>
            <rect x={-2} y={-8} width={2} height={2} fill="#1a1a2e"/>
            <rect x={1} y={-8} width={2} height={2} fill="#1a1a2e"/>
            <polygon points="0,-20 -5,-12 5,-12" fill={C.purple}/>
            <rect x={-6} y={-13} width={12} height={2} fill={C.purple}/>
            <rect x={-1} y={-22} width={2} height={3} fill={C.gold}/>
            <rect x={-1.5} y={-23} width={3} height={3} fill={C.gold} rx={0.5}/>
            <rect x={2} y={-18} width={2} height={2} fill={C.gold} opacity={0.8}/>
          </g>
        </svg>
        <div>
          <div style={{ fontFamily:FONT, fontSize:5.5, color:C.gold }}>AIアドバイザー</div>
          <div style={{ fontFamily:MONO, fontSize:10, color:C.muted, marginTop:2 }}>
            戦略魔法使い · Lv.99
          </div>
        </div>
        <div style={{ marginLeft:"auto" }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:C.green,
            boxShadow:`0 0 6px ${C.green}`, animation:"pulse 2s infinite" }}/>
        </div>
      </div>

      <div style={{ padding:"12px 14px", minHeight:80, position:"relative" }}>
        {loading ? (
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {[0,1,2].map(i=>(
              <div key={i} style={{ width:6, height:6, borderRadius:"50%",
                background:C.gold, animation:"pulse 1s infinite",
                animationDelay:`${i*0.2}s` }}/>
            ))}
            <span style={{ fontFamily:MONO, fontSize:10, color:C.muted }}>分析中...</span>
          </div>
        ) : advice ? (
          <div style={{ fontFamily:MONO, fontSize:11, color:C.text, lineHeight:1.9,
            whiteSpace:"pre-wrap" }}>{advice}</div>
        ) : (
          <div style={{ fontFamily:MONO, fontSize:11, color:C.muted, lineHeight:1.8 }}>
            「現在の状況を分析して<br/>最適な戦略を提案します」
          </div>
        )}
      </div>

      <div style={{ padding:"8px 12px", borderTop:`1px solid ${C.border}`,
        display:"flex", gap:8, flexWrap:"wrap" }}>
        {["今日の戦略を聞く","売上を上げるには","コスト削減のヒント","次の一手は？"].map(q=>(
          <button key={q} onClick={()=>onAsk(q)} disabled={loading} style={{
            fontFamily:FONT, fontSize:4, padding:"4px 8px",
            background:loading?"transparent":`${C.purple}22`,
            border:`1px solid ${loading?C.border:C.purple+"66"}`,
            color:loading?C.muted:C.purple, cursor:loading?"not-allowed":"pointer",
            borderRadius:1, transition:"all 0.2s",
          }}>{q}</button>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   DEPT RPG CARD
============================================================ */
function DeptRPGCard({ dept, onClick }) {
  const [hovered, setHovered] = useState(false);
  const levelColor = dept.level>=10?C.gold:dept.level>=7?"#f97316":dept.level>=4?C.blue:C.green;

  return (
    <div
      onClick={onClick}
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>setHovered(false)}
      style={{
        background:C.panel, borderRadius:3, overflow:"hidden",
        border:`1px solid ${hovered?dept.color:dept.color+"44"}`,
        boxShadow:hovered?`0 0 20px ${dept.color}33`:"none",
        cursor:"pointer", transition:"all 0.15s",
        transform:hovered?"translateY(-2px)":"none",
      }}
    >
      <div style={{ height:3, background:dept.color,
        boxShadow:`0 0 8px ${dept.color}` }}/>
      <div style={{ padding:"12px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <span style={{ fontSize:18 }}>{dept.icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:FONT, fontSize:5.5, color:dept.color }}>{dept.name}</div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
              <div style={{ fontFamily:FONT, fontSize:4, color:levelColor,
                padding:"1px 5px", border:`1px solid ${levelColor}`,
                background:`${levelColor}18` }}>Lv.{dept.level}</div>
              <Stars count={Math.min(Math.ceil(dept.level/2),5)} color={dept.color}/>
            </div>
          </div>
          {dept.status && (
            <div style={{ fontFamily:FONT, fontSize:4, color:dept.statusColor||C.green,
              padding:"2px 6px", border:`1px solid ${dept.statusColor||C.green}44`,
              background:`${dept.statusColor||C.green}11`,
              animation:dept.statusAnim?"pulse 2s infinite":"none" }}>
              {dept.status}
            </div>
          )}
        </div>
        <StatBar label="HP" value={dept.hp} max={dept.maxHp} color={C.hp} icon="♥" showVal={false}/>
        <StatBar label="パフォーマンス" value={dept.perf} max={100} color={dept.color} icon="⚡" showVal={false}/>
        <div style={{ marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
            <span style={{ fontFamily:FONT, fontSize:4, color:C.muted }}>📈 EXP</span>
            <span style={{ fontFamily:FONT, fontSize:4, color:C.xp }}>{dept.xp}/{dept.xpNext}</span>
          </div>
          <div style={{ height:5, background:"#0a1520", borderRadius:1, overflow:"hidden" }}>
            <div style={{
              height:"100%", width:`${dept.xp/dept.xpNext*100}%`,
              background:`linear-gradient(90deg,${C.xp}88,${C.xp})`,
              boxShadow:`0 0 6px ${C.xp}`,
              transition:"width 0.8s ease",
            }}/>
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between",
          padding:"6px 8px", background:C.bg, borderRadius:2,
          border:`1px solid ${C.border}` }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:FONT, fontSize:7, color:dept.todayColor||C.green }}>
              {dept.todayValue}
            </div>
            <div style={{ fontFamily:MONO, fontSize:9, color:C.muted }}>{dept.todayLabel}</div>
          </div>
          <div style={{ width:1, background:C.border }}/>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:FONT, fontSize:7,
              color:dept.trend>=0?C.green:C.red }}>
              {dept.trend>=0?"↑":"↓"}{Math.abs(dept.trend)}%
            </div>
            <div style={{ fontFamily:MONO, fontSize:9, color:C.muted }}>前日比</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TODAY'S SCORE PANEL
============================================================ */
function TodayScore({ revenue, cost, profit, target, stats }) {
  const pct = Math.min(profit/target*100, 100);
  const clock = new Date();
  const hour = clock.getHours();
  const progress = Math.round((hour/24)*100);

  return (
    <div style={{
      background:"#030a10", border:`2px solid ${C.gold}44`,
      borderRadius:3, padding:"16px 20px",
      boxShadow:`0 0 30px ${C.gold}11`,
      position:"relative", overflow:"hidden",
    }}>
      <div style={{ position:"absolute", right:-20, top:-20, width:120, height:120,
        borderRadius:"50%", background:`${C.gold}06`,
        border:`40px solid ${C.gold}04` }}/>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
        <div style={{ width:6, height:6, background:C.gold,
          boxShadow:`0 0 8px ${C.gold}`, animation:"pulse 2s infinite" }}/>
        <span style={{ fontFamily:FONT, fontSize:5.5, color:C.gold, letterSpacing:"0.15em" }}>
          TODAY&apos;S SCORE
        </span>
        <span style={{ fontFamily:MONO, fontSize:10, color:C.muted, marginLeft:"auto" }}>
          {clock.toLocaleDateString("ja-JP",{month:"long",day:"numeric"})}
        </span>
      </div>
      <div style={{ textAlign:"center", marginBottom:16, padding:"10px 0" }}>
        <div style={{ fontFamily:MONO, fontSize:11, color:C.muted, marginBottom:4 }}>本日の純利益</div>
        <Counter target={profit} prefix="¥" color={profit>=0?C.green:C.red} size={22}/>
        <div style={{ fontFamily:MONO, fontSize:10, color:C.muted, marginTop:4 }}>
          目標 ¥{target.toLocaleString()} まで
          <span style={{ color:C.gold }}> ¥{Math.max(target-profit,0).toLocaleString()}</span>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        <div style={{ padding:"10px", background:`${C.green}08`,
          border:`1px solid ${C.green}33`, borderRadius:2, textAlign:"center" }}>
          <div style={{ fontFamily:MONO, fontSize:10, color:C.muted, marginBottom:4 }}>売上</div>
          <Counter target={revenue} prefix="¥" color={C.green} size={12}/>
        </div>
        <div style={{ padding:"10px", background:`${C.red}08`,
          border:`1px solid ${C.red}33`, borderRadius:2, textAlign:"center" }}>
          <div style={{ fontFamily:MONO, fontSize:10, color:C.muted, marginBottom:4 }}>コスト</div>
          <Counter target={cost} prefix="¥" color={C.red} size={12}/>
        </div>
      </div>
      <div style={{ marginBottom:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
          <span style={{ fontFamily:FONT, fontSize:4.5, color:C.muted }}>🎯 月次目標進捗</span>
          <span style={{ fontFamily:FONT, fontSize:4.5, color:C.gold }}>{Math.round(pct)}%</span>
        </div>
        <div style={{ height:10, background:"#0a1520", borderRadius:1,
          border:`1px solid ${C.gold}33`, overflow:"hidden", position:"relative" }}>
          <div style={{
            height:"100%", width:`${pct}%`,
            background:`linear-gradient(90deg,${C.goldDim},${C.gold})`,
            boxShadow:`0 0 10px ${C.gold}66`,
            transition:"width 1s ease", position:"relative",
          }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:"40%",
              background:"rgba(255,255,255,0.2)" }}/>
          </div>
          <div style={{ position:"absolute", top:0, bottom:0,
            left:`${progress}%`, width:1, background:"rgba(255,255,255,0.4)" }}/>
        </div>
        <div style={{ fontFamily:MONO, fontSize:9, color:C.muted, marginTop:3 }}>
          本日 {progress}% 経過 · ペース {pct>progress?"✦ 順調":"⚠ 要改善"}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
        {[
          {label:"ユーザー",value:stats?`${stats.users.total}人`:"—",color:C.blue,id:"users"},
          {label:"取引数",value:stats?`${stats.credits.transactions}件`:"—",color:C.purple,id:"txns"},
          {label:"購入数",value:stats?`${stats.revenue.purchases}件`:"—",color:C.green,id:"rev"},
        ].map(s=>(
          <div key={s.label} style={{ textAlign:"center", padding:"5px",
            background:C.bg, borderRadius:1 }}>
            <div style={{ fontFamily:FONT, fontSize:7, color:s.color }}>{s.value}</div>
            <div style={{ fontFamily:MONO, fontSize:8, color:C.muted }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   ACHIEVEMENT TOAST
============================================================ */
function AchievementToast({ achievement, onClose }) {
  useEffect(()=>{
    const t=setTimeout(onClose,4000);
    return()=>clearTimeout(t);
  },[onClose]);
  return (
    <div style={{
      position:"fixed", bottom:20, right:20, zIndex:999,
      padding:"12px 16px", background:"#030a10",
      border:`2px solid ${C.gold}`,
      boxShadow:`0 0 30px ${C.gold}55`,
      animation:"slideUp 0.3s ease",
      maxWidth:280,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:24 }}>{achievement.icon}</span>
        <div>
          <div style={{ fontFamily:FONT, fontSize:4.5, color:C.gold, marginBottom:3 }}>実績解除！</div>
          <div style={{ fontFamily:FONT, fontSize:5, color:C.text }}>{achievement.name}</div>
          <div style={{ fontFamily:MONO, fontSize:10, color:C.muted, marginTop:2 }}>{achievement.desc}</div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN GAME SCREEN
============================================================ */
const INITIAL_DEPTS = [
  { id:"dev", name:"開発部", icon:"⌨", color:"#22d3ee",
    level:8, hp:85, maxHp:100, perf:78, xp:340, xpNext:500,
    todayValue:"3PR", todayLabel:"マージ数", todayColor:"#22d3ee", trend:50,
    status:"🔥 スプリント中", statusColor:"#f97316", statusAnim:true,
    quests:[
      {id:"q1",title:"PR #142 マージ完了",desc:"レビュー待ちのPRをマージする",diff:"A",xp:120,progress:100,done:false},
      {id:"q2",title:"テストカバレッジ80%達成",desc:"現在62% → 80%まで引き上げる",diff:"B",xp:200,progress:62,done:false},
      {id:"q3",title:"Vercel本番デプロイ",desc:"ステージングで確認後、本番反映",diff:"S",xp:300,progress:0,done:false},
    ]
  },
  { id:"pr", name:"広報部", icon:"◈", color:"#ec4899",
    level:6, hp:92, maxHp:100, perf:88, xp:180, xpNext:300,
    todayValue:"6本", todayLabel:"投稿数", todayColor:"#ec4899", trend:20,
    status:"⚡ 絶好調", statusColor:"#4ade80",
    quests:[
      {id:"q4",title:"TikTok 3本投稿",desc:"15:00のスケジュール投稿を完遂",diff:"B",xp:80,progress:100,done:true},
      {id:"q5",title:"note記事 1,000PV",desc:"本日公開の記事を1,000PV達成",diff:"A",xp:150,progress:72,done:false},
    ]
  },
  { id:"sales", name:"営業部", icon:"◆", color:"#f59e0b",
    level:7, hp:70, maxHp:100, perf:65, xp:420, xpNext:500,
    todayValue:"¥48万", todayLabel:"商談額", todayColor:"#f59e0b", trend:-5,
    status:"⚠ 要注意", statusColor:"#f59e0b", statusAnim:true,
    quests:[
      {id:"q6",title:"A社 最終提案送付",desc:"本日18:00までに提案書を送る",diff:"S",xp:400,progress:45,done:false},
      {id:"q7",title:"新規コンタクト5社",desc:"ターゲットリストから5社にメール",diff:"B",xp:100,progress:60,done:false},
    ]
  },
  { id:"finance", name:"財務部", icon:"💰", color:"#facc15",
    level:5, hp:100, maxHp:100, perf:95, xp:60, xpNext:200,
    todayValue:"87%", todayLabel:"目標達成率", todayColor:"#4ade80", trend:3,
    status:"✦ 安定", statusColor:"#4ade80",
    quests:[
      {id:"q8",title:"月次P/L確認完了",desc:"全APIコストと売上を突き合わせ",diff:"C",xp:50,progress:100,done:true},
    ]
  },
];

const ACHIEVEMENTS_LIST = [
  { id:"a1", name:"初回デプロイ", icon:"🚀", desc:"本番環境に初めてデプロイした", unlocked:true },
  { id:"a2", name:"MRR ¥50万突破", icon:"💰", desc:"月次売上が50万円を超えた", unlocked:true },
  { id:"a3", name:"SNS職人", icon:"◈", desc:"1日10本以上投稿した", unlocked:false },
  { id:"a4", name:"全部署Lv.10", icon:"⭐", desc:"すべての部署をLv.10にした", unlocked:false },
  { id:"a5", name:"ゼロダウンタイム", icon:"🛡", desc:"30日間無停止運用を達成", unlocked:false },
  { id:"a6", name:"AIマスター", icon:"🤖", desc:"Claude APIを1000回使用した", unlocked:false },
  { id:"a7", name:"ユーザー1000人", icon:"👥", desc:"登録ユーザーが1000人を超えた", unlocked:true },
  { id:"a8", name:"完全自動化", icon:"⚙", desc:"全9ボットが1週間無停止稼働", unlocked:false },
];

export default function CompanyOSGame() {
  const [depts, setDepts] = useState(INITIAL_DEPTS);
  const [selectedDept, setSelectedDept] = useState(null);
  const [advice, setAdvice] = useState("");
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [levelUp, setLevelUp] = useState(null);
  const [achievement, setAchievement] = useState(null);
  const [tab, setTab] = useState("map");
  const [totalXP, setTotalXP] = useState(2840);
  const [companyLevel] = useState(12);

  const [revenue, setRevenue] = useState(0);
  const [cost, setCost] = useState(0);
  const [liveStats, setLiveStats] = useState(null);

  // Fetch real data from Supabase via /api/stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) return;
      const data = await res.json();
      setRevenue(data.revenue.total);
      setCost(data.cost.total);
      setLiveStats(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchStats(); // initial
    const i = setInterval(fetchStats, 60000); // refresh every 60s
    return () => clearInterval(i);
  }, [fetchStats]);

  const profit = revenue - cost;

  const completeQuest = useCallback((questId) => {
    let earnedXP = 0;
    setDepts(prev => prev.map(dept => {
      const quest = dept.quests.find(q=>q.id===questId);
      if (!quest) return dept;
      earnedXP = quest.xp;
      const newXP = dept.xp + quest.xp;
      const leveled = newXP >= dept.xpNext;
      if (leveled) {
        setTimeout(()=>setLevelUp({dept:dept.name, level:dept.level+1}), 300);
      }
      return {
        ...dept,
        xp: leveled ? newXP - dept.xpNext : newXP,
        level: leveled ? dept.level+1 : dept.level,
        quests: dept.quests.map(q=>q.id===questId?{...q,done:true}:q),
      };
    }));
    setTotalXP(x=>x+earnedXP);
    if (Math.random() > 0.6) {
      const locked = ACHIEVEMENTS_LIST.filter(a=>!a.unlocked);
      if (locked.length > 0) {
        setAchievement(locked[Math.floor(Math.random()*locked.length)]);
      }
    }
  }, []);

  const askAdvisor = useCallback(async (question) => {
    setAdviceLoading(true); setAdvice(""); setTab("advisor");
    const deptSummary = depts.map(d=>
      `${d.name}: Lv${d.level} HP${d.hp}% パフォーマンス${d.perf}% 今日${d.todayValue}`
    ).join(", ");
    const sys = `あなたは経営戦略AIアドバイザーです。ゲームのキャラクターのように、
具体的な数値と短いアクションアイテムで回答してください。
絵文字を使い、RPGのクエスト提案のようなトーンで。100字以内で簡潔に。`;
    const usr = `質問: ${question}
今日の収支: 売上¥${revenue.toLocaleString()} コスト¥${cost.toLocaleString()} 利益¥${profit.toLocaleString()}
部署状況: ${deptSummary}`;
    try {
      let full="";
      await callClaude(sys, usr, c=>{full+=c; setAdvice(full);});
    } catch(e) { setAdvice("⚠ 魔法が失敗しました: "+e.message); }
    setAdviceLoading(false);
  }, [depts, revenue, cost, profit]);

  const dept = selectedDept ? depts.find(d=>d.id===selectedDept) : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=DM+Mono:wght@400;500&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes sparkle{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(0) translateY(-20px)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#020508;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#020508;}
        ::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:2px;}
        input,textarea,button{outline:none;}
      `}</style>

      <div style={{ position:"fixed",inset:0,
        background:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.03) 3px,rgba(0,0,0,0.03) 4px)",
        pointerEvents:"none",zIndex:998 }}/>

      <div style={{ background:C.bg, minHeight:"100vh", color:C.text, overflow:"hidden" }}>

        {/* ── TOP BAR ── */}
        <div style={{
          height:44, background:"#030a14",
          borderBottom:`1px solid ${C.gold}33`,
          display:"flex", alignItems:"center", padding:"0 16px", gap:0,
          flexShrink:0,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginRight:20, flexShrink:0 }}>
            <svg width={16} height={16}>
              {[["#22d3ee",0,0],["#ec4899",8,0],["#f59e0b",0,8],["#4ade80",8,8]].map(([c,x,y])=>(
                <rect key={c+x} x={x} y={y} width={7} height={7} fill={c} rx={0.5}/>
              ))}
            </svg>
            <span style={{ fontFamily:FONT, fontSize:6, color:C.gold, letterSpacing:"0.15em" }}>
              COMPANY OS
            </span>
            <span style={{ fontFamily:FONT, fontSize:4, color:C.muted }}>RPG</span>
          </div>

          {[
            {id:"map",label:"MAP",icon:"🗺"},
            {id:"quests",label:"QUEST",icon:"📋"},
            {id:"achievements",label:"実績",icon:"🏆"},
            {id:"advisor",label:"AI参謀",icon:"🔮"},
          ].map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)} style={{
              background:tab===n.id?`${C.gold}15`:"transparent",
              border:"none",
              borderBottom:tab===n.id?`2px solid ${C.gold}`:"2px solid transparent",
              padding:"0 14px", height:44,
              fontFamily:FONT, fontSize:4.5,
              color:tab===n.id?C.gold:C.muted,
              cursor:"pointer", display:"flex", alignItems:"center", gap:5,
            }}>
              <span style={{fontSize:10}}>{n.icon}</span>{n.label}
            </button>
          ))}

          <div style={{ flex:1 }}/>

          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6,
              padding:"4px 10px", border:`1px solid ${C.gold}44`,
              background:`${C.gold}11` }}>
              <span style={{ fontFamily:FONT, fontSize:4.5, color:C.muted }}>COMPANY</span>
              <span style={{ fontFamily:FONT, fontSize:6, color:C.gold }}>Lv.{companyLevel}</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ fontSize:10 }}>⭐</span>
              <Counter target={totalXP} suffix=" XP" color={C.xp} size={9}/>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:5, height:5, borderRadius:"50%",
                background:C.green, animation:"pulse 1.5s infinite" }}/>
              <Counter target={profit} prefix="¥" color={C.green} size={9}/>
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ display:"flex", height:"calc(100vh - 44px)", overflow:"hidden" }}>

          <div style={{ width:280, borderRight:`1px solid ${C.border}`,
            display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
            <div style={{ flex:1, overflowY:"auto", padding:12 }}>
              <TodayScore revenue={revenue} cost={cost} profit={profit} target={50000} stats={liveStats}/>
              <div style={{ height:12 }}/>
              <AIAdvisor advice={advice} loading={adviceLoading} onAsk={askAdvisor}/>
            </div>
          </div>

          <div style={{ flex:1, overflow:"auto" }}>

            {tab==="map" && (
              <div style={{ padding:20 }}>
                <div style={{ fontFamily:FONT, fontSize:5.5, color:C.muted,
                  marginBottom:16, letterSpacing:"0.15em" }}>■ OFFICE MAP — 部署一覧</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  {depts.map(d=>(
                    <DeptRPGCard key={d.id} dept={d} onClick={()=>setSelectedDept(selectedDept===d.id?null:d.id)}/>
                  ))}
                </div>
                {dept && (
                  <div style={{
                    marginTop:16, padding:16,
                    background:C.panel, borderRadius:3,
                    border:`1px solid ${dept.color}55`,
                    boxShadow:`0 0 20px ${dept.color}11`,
                    animation:"fadeIn 0.2s ease",
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                      <span style={{ fontSize:20 }}>{dept.icon}</span>
                      <span style={{ fontFamily:FONT, fontSize:8, color:dept.color }}>{dept.name}</span>
                      <div style={{ marginLeft:"auto", fontFamily:FONT, fontSize:6,
                        color:C.gold, padding:"2px 8px",
                        border:`1px solid ${C.gold}44` }}>Lv.{dept.level}</div>
                    </div>
                    <div style={{ fontFamily:FONT, fontSize:5, color:C.muted,
                      marginBottom:8, letterSpacing:"0.1em" }}>アクティブクエスト</div>
                    {dept.quests.map(q=>(
                      <QuestCard key={q.id} quest={q} onComplete={completeQuest}/>
                    ))}
                    <button
                      onClick={()=>askAdvisor(`${dept.name}の改善方法を教えて`)}
                      style={{
                        width:"100%", marginTop:8, padding:"8px",
                        background:`${dept.color}18`, border:`1px solid ${dept.color}44`,
                        fontFamily:FONT, fontSize:4.5, color:dept.color, cursor:"pointer",
                        borderRadius:2,
                      }}>
                      🔮 AI参謀に {dept.name} の戦略を聞く
                    </button>
                  </div>
                )}
              </div>
            )}

            {tab==="quests" && (
              <div style={{ padding:20 }}>
                <div style={{ fontFamily:FONT, fontSize:5.5, color:C.muted,
                  marginBottom:16, letterSpacing:"0.15em" }}>■ ACTIVE QUESTS</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:20 }}>
                  {[
                    {label:"進行中",value:depts.flatMap(d=>d.quests).filter(q=>!q.done).length,color:C.blue},
                    {label:"完了済",value:depts.flatMap(d=>d.quests).filter(q=>q.done).length,color:C.green},
                    {label:"獲得XP",value:totalXP,color:C.xp},
                  ].map(s=>(
                    <div key={s.label} style={{ padding:"12px", background:C.panel,
                      border:`1px solid ${s.color}33`, borderRadius:2, textAlign:"center" }}>
                      <Counter target={s.value} color={s.color} size={16}/>
                      <div style={{ fontFamily:MONO, fontSize:10, color:C.muted, marginTop:4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {depts.map(d=>(
                  <div key={d.id} style={{ marginBottom:20 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                      <span style={{ fontSize:14 }}>{d.icon}</span>
                      <span style={{ fontFamily:FONT, fontSize:6, color:d.color }}>{d.name}</span>
                      <div style={{ fontFamily:FONT, fontSize:4, color:C.gold,
                        padding:"1px 5px", border:`1px solid ${C.gold}44` }}>Lv.{d.level}</div>
                    </div>
                    {d.quests.map(q=>(
                      <QuestCard key={q.id} quest={q} onComplete={completeQuest}/>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {tab==="achievements" && (
              <div style={{ padding:20 }}>
                <div style={{ fontFamily:FONT, fontSize:5.5, color:C.muted,
                  marginBottom:6, letterSpacing:"0.15em" }}>■ ACHIEVEMENTS</div>
                <div style={{ fontFamily:MONO, fontSize:11, color:C.muted, marginBottom:16 }}>
                  {ACHIEVEMENTS_LIST.filter(a=>a.unlocked).length} / {ACHIEVEMENTS_LIST.length} 解除済み
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  {ACHIEVEMENTS_LIST.map(a=>(
                    <div key={a.id} style={{
                      padding:"14px 16px", borderRadius:3,
                      border:`1px solid ${a.unlocked?C.gold+"55":C.border}`,
                      background:a.unlocked?`${C.gold}08`:C.panel,
                      opacity:a.unlocked?1:0.5,
                    }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                        <span style={{ fontSize:22,
                          filter:a.unlocked?"none":"grayscale(1)" }}>{a.icon}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontFamily:FONT, fontSize:5,
                            color:a.unlocked?C.gold:C.muted }}>{a.name}</div>
                          <div style={{ fontFamily:MONO, fontSize:10,
                            color:C.muted, marginTop:3 }}>{a.desc}</div>
                        </div>
                        {a.unlocked && (
                          <div style={{ fontFamily:FONT, fontSize:5, color:C.gold }}>✓</div>
                        )}
                      </div>
                      {!a.unlocked && (
                        <div style={{ fontFamily:FONT, fontSize:4.5,
                          color:C.muted, letterSpacing:"0.1em" }}>???</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab==="advisor" && (
              <div style={{ padding:20 }}>
                <div style={{ fontFamily:FONT, fontSize:5.5, color:C.muted,
                  marginBottom:16, letterSpacing:"0.15em" }}>■ AI参謀 — 戦略ブリーフィング</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
                  {[
                    {title:"売上 改善余地", value:"+¥12万/月", detail:"広報部の投稿頻度を2倍にすると推定", color:C.green, icon:"📈"},
                    {title:"コスト 削減余地", value:"-¥3.2万/月", detail:"Runway APIをバッチ処理に変えると削減可能", color:C.blue, icon:"💡"},
                    {title:"リスク警告", value:"営業部HP低下", detail:"商談数が減少傾向。フォローアップを強化", color:C.red, icon:"⚠"},
                    {title:"今週のチャンス", value:"note流入↑", detail:"SEO記事のCV率が最高水準。投稿強化タイミング", color:C.gold, icon:"✦"},
                  ].map(c=>(
                    <div key={c.title} style={{
                      padding:"12px 14px", background:C.panel, borderRadius:2,
                      border:`1px solid ${c.color}44`,
                      boxShadow:`0 0 12px ${c.color}11`,
                    }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                        <span style={{ fontSize:16 }}>{c.icon}</span>
                        <span style={{ fontFamily:FONT, fontSize:4.5, color:c.color }}>{c.title}</span>
                      </div>
                      <div style={{ fontFamily:FONT, fontSize:10, color:c.color, marginBottom:5 }}>{c.value}</div>
                      <div style={{ fontFamily:MONO, fontSize:10, color:C.muted, lineHeight:1.7 }}>{c.detail}</div>
                      <button
                        onClick={()=>askAdvisor(c.title+"の詳細な改善策を教えて")}
                        style={{ marginTop:8, padding:"4px 10px",
                          fontFamily:FONT, fontSize:4, background:`${c.color}18`,
                          border:`1px solid ${c.color}44`, color:c.color,
                          cursor:"pointer", borderRadius:1 }}>
                        詳しく聞く
                      </button>
                    </div>
                  ))}
                </div>
                {(advice || adviceLoading) && (
                  <div style={{ padding:16, background:`${C.purple}08`,
                    border:`1px solid ${C.purple}44`, borderRadius:2, marginBottom:16 }}>
                    <div style={{ fontFamily:FONT, fontSize:5, color:C.purple, marginBottom:8 }}>
                      🔮 AI参謀からの回答
                    </div>
                    {adviceLoading && !advice ? (
                      <div style={{ display:"flex", gap:6 }}>
                        {[0,1,2].map(i=>(
                          <div key={i} style={{ width:6, height:6, borderRadius:"50%",
                            background:C.purple, animation:"pulse 1s infinite",
                            animationDelay:`${i*0.2}s` }}/>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontFamily:MONO, fontSize:12, color:C.text,
                        lineHeight:1.9, whiteSpace:"pre-wrap" }}>
                        {advice}
                        {adviceLoading && (
                          <span style={{ display:"inline-block", width:7, height:13,
                            background:C.purple, marginLeft:2,
                            animation:"pulse 0.8s infinite", verticalAlign:"text-bottom" }}/>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ fontFamily:FONT, fontSize:5, color:C.muted, marginBottom:10 }}>
                  クイック相談
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {[
                    "今日の収支を改善するには？",
                    "どの部署を強化すべき？",
                    "今週中にできる施策は？",
                    "APIコストを下げるには？",
                    "売上を今月20%上げるには？",
                    "一番緊急度の高い課題は？",
                  ].map(q=>(
                    <button key={q} onClick={()=>askAdvisor(q)} disabled={adviceLoading}
                      style={{
                        padding:"10px 12px", textAlign:"left",
                        fontFamily:MONO, fontSize:11,
                        background:adviceLoading?C.bg:`${C.purple}11`,
                        border:`1px solid ${adviceLoading?C.border:C.purple+"44"}`,
                        color:adviceLoading?C.muted:C.text, cursor:adviceLoading?"not-allowed":"pointer",
                        borderRadius:2, lineHeight:1.6, transition:"all 0.2s",
                      }}>
                      🔮 {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {levelUp && (
        <LevelUpOverlay dept={levelUp.dept} level={levelUp.level} onClose={()=>setLevelUp(null)}/>
      )}
      {achievement && (
        <AchievementToast achievement={achievement} onClose={()=>setAchievement(null)}/>
      )}
    </>
  );
}
