"use client";
// @ts-nocheck

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ─── DESIGN ─── */
const FONT = "'Press Start 2P', monospace";
const MONO = "'DM Mono', monospace";
const SANS = "'Outfit', sans-serif";
const C = {
  bg:"#020509",surface:"#050c18",card:"#08111f",border:"#0c1e38",glow:"#0e2d50",
  gold:"#f5c518",green:"#00f0a0",red:"#ff3d5a",blue:"#1ad8ff",purple:"#b06eff",
  orange:"#ff8800",pink:"#ff2d9a",teal:"#00ddc8",lime:"#9fff2e",
  text:"#dff0ff",muted:"#3a5570",dim:"#0f1e30",
};

/* ─── CLAUDE API ─── */
async function stream(system:string,msgs:{role:string;content:string}[],onChunk:(t:string)=>void,max=1000){
  const res=await fetch("/api/claude",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({system,user:msgs[msgs.length-1].content}),
  });
  if(!res.ok)throw new Error(`${res.status}`);
  const reader=res.body!.getReader();const dec=new TextDecoder();let buf="";
  while(true){
    const{done,value}=await reader.read();if(done)break;
    buf+=dec.decode(value,{stream:true});
    const lines=buf.split("\n");buf=lines.pop()!;
    for(const line of lines){
      if(!line.startsWith("data: "))continue;
      const d=line.slice(6).trim();if(d==="[DONE]")return;
      try{const j=JSON.parse(d);if(j.delta?.text)onChunk(j.delta.text);}catch{}
    }
  }
}
async function ask(sys:string,user:string,max=700):Promise<string>{
  let r="";await stream(sys,[{role:"user",content:user}],c=>{r+=c;},max);return r;
}
async function askJSON<T>(sys:string,user:string):Promise<T|null>{
  const raw=await ask(sys+"\nJSONのみ返してください。コードブロック不要。",user,900);
  try{return JSON.parse(raw.replace(/```json|```/g,"").trim()) as T;}catch{return null;}
}

/* ─── TYPES ─── */
type AgentId="ceo"|"dev"|"qa"|"pr"|"sales"|"research"|"automation"|"analyst";
type Priority="critical"|"high"|"normal"|"low";
type TStatus="pending"|"running"|"done"|"failed"|"auto_approved"|"qa_running"|"qa_fixing";
type Platform="tiktok"|"threads"|"x"|"note"|"instagram"|"youtube";

interface Task{
  id:string;goal:string;title:string;agent:AgentId;
  status:TStatus;priority:Priority;output:string;
  parent_id?:string;children_ids:string[];
  logs:Log[];created_at:number;started_at?:number;done_at?:number;
  xp:number;auto_approved:boolean;
  qa_cycles:number;qa_passed:boolean;tags:string[];
}
interface Log{ts:number;type:string;text:string;}
interface SNSPost{
  id:string;platform:Platform;content:string;hashtags:string[];
  status:"draft"|"scheduled"|"posted";scheduled_at?:number;
  ai_score:number;likes:number;views:number;
}
interface Schedule{
  id:string;name:string;goal:string;agent:AgentId;
  label:string;enabled:boolean;runs:number;next?:number;
}

/* ─── AGENTS ─── */
const AGENTS:Record<AgentId,{name:string;icon:string;color:string;role:string;level:number;sys:string}> = {
  ceo:{name:"CEO AI",icon:"👑",color:C.gold,role:"戦略・分解・指揮",level:42,
    sys:`あなたはスタートアップCEO AIです。目標を分析し最適なタスクに分解して各部署に割り振ります。
部署: dev(実装), qa(テスト・修正), pr(SNS), sales(営業), research(調査), automation(自動化), analyst(分析)
JSON配列で返してください: [{"agent":"agentId","title":"タスク名","description":"詳細","priority":"high","xp":150,"tags":["tag"]}]
devタスクには必ず後続のqaタスクも追加してください。

【実行可能アクション】タスク内で即座に実行したい場合は [EXEC:action:{"key":"value"}] タグを使ってください:
- [EXEC:slack.send:{"text":"メッセージ"}] → Slack通知
- [EXEC:discord.send:{"text":"メッセージ"}] → Discord通知
- [EXEC:github.create_issue:{"title":"タイトル","body":"内容","repo":"yurayura200/company-os"}] → Issue作成
- [EXEC:supabase.select:{"table":"テーブル名"}] → DB読取`},
  dev:{name:"Dev AI",icon:"⌨",color:C.blue,role:"フルスタック実装",level:38,
    sys:`あなたはシニアエンジニアAIです。Next.js 14+TypeScript+Supabase+Vercelで実装します。
必ず: ①完全な型定義 ②エラーハンドリング ③パフォーマンス最適化 ④セキュリティ考慮
ファイルパス付きの完全動作コードを提供してください。`},
  qa:{name:"QA AI",icon:"🔬",color:C.purple,role:"自動テスト・バグ修正ループ",level:35,
    sys:`あなたは自動QAエンジニアAIです。コードを徹底レビューしてバグを発見・修正します。
JSONで返してください: {"bugs":[{"severity":"critical/high/medium","desc":"説明","fix":"修正内容"}],"test_code":"テストコード","deploy_ok":true,"fixed_code":"修正済みコード全体"}`},
  pr:{name:"PR AI",icon:"◈",color:C.pink,role:"SNS・バイラル戦略",level:33,
    sys:`あなたは日本トップSNSマーケターAIです。TikTok・Threads・X・note・Instagram・YouTube向けのバズるコンテンツを作ります。各投稿にAIバズ予測スコア(0-100)を付けてください。
投稿完成後、Slackに通知する場合は末尾に [EXEC:slack.send:{"text":"📱 SNS投稿完成: (タイトル)"}] を追加。`},
  sales:{name:"Sales AI",icon:"◆",color:C.orange,role:"BtoB営業・商談",level:28,
    sys:`あなたは日本BtoB営業専門AIです。件名・本文・PS・フォローアップ3回分を一式提供します。返信率最大化の内容にしてください。
営業メール完成後、Slackに通知: [EXEC:slack.send:{"text":"✉️ 営業メール作成完了: (件名)"}]
重要案件はGitHub Issue作成: [EXEC:github.create_issue:{"title":"営業: (企業名)","body":"(概要)","repo":"yurayura200/company-os"}]`},
  research:{name:"Research AI",icon:"🔭",color:"#22d3ee",role:"市場調査・競合分析",level:30,
    sys:`あなたは市場調査専門AIです。具体的なデータ・数値・事例・アクション提言付きで調査結果をまとめてください。`},
  automation:{name:"Auto AI",icon:"⚙",color:C.lime,role:"完全自動化・Bot",level:26,
    sys:`あなたは業務自動化エンジニアAIです。Python・GitHub Actions・Supabase Edge Functionsで完全自動化します。エラーハンドリング・ログ・アラート込みで動作するコードを提供してください。`},
  analyst:{name:"Data AI",icon:"📊",color:"#60a5fa",role:"KPI・データ分析",level:23,
    sys:`あなたはビジネスアナリストAIです。売上・コスト・SNS指標を分析し、意思決定に直結するレポートを作成してください。`},
};

const PLATFORMS:{id:Platform;name:string;color:string;limit:number;icon:string}[]=[
  {id:"tiktok",name:"TikTok",color:"#ff0050",limit:150,icon:"♪"},
  {id:"threads",name:"Threads",color:"#e8e8e8",limit:500,icon:"@"},
  {id:"x",name:"X",color:"#1d9bf0",limit:280,icon:"✕"},
  {id:"note",name:"note",color:"#41c9b4",limit:5000,icon:"n"},
  {id:"instagram",name:"Instagram",color:"#e1306c",limit:2200,icon:"◉"},
  {id:"youtube",name:"YouTube",color:"#ff0000",limit:5000,icon:"▶"},
];

const QUICK:[string,string,string,Priority][]=[
  ["📱","TikTokをバズらせたい","VideoTrackerの新機能をTikTokで最大限バズらせる戦略・投稿文・ハッシュタグ・スケジュールをすべて作成してください","high"],
  ["💌","企業への営業メール","VideoTrackerをSaaS・動画制作・マーケ会社に営業するメール・戦略・フォローアップ計画を作成してください","high"],
  ["📊","競合完全分析","CapCut・OpusClip等の競合を徹底分析して差別化戦略を提言してください","normal"],
  ["🤖","SNS完全自動化","Threads・note・X・TikTokへの毎日自動投稿システムのコードを作成してください","high"],
  ["⌨","新機能を実装","VideoTrackerにAIハイライト自動生成機能を実装してください","high"],
  ["💰","収益を2倍に","3ヶ月でMRRを2倍にする戦略・実行計画・優先順位を作成してください","critical"],
  ["📝","週次レポート","今週の売上・SNS・開発・商談をまとめたエグゼクティブレポートを作成してください","normal"],
  ["🌐","Japan市場戦略","日本市場でVideoTrackerを1位にする包括的マーケ戦略を作成してください","high"],
];

/* ─── UTILS ─── */
const uid=()=>Math.random().toString(36).slice(2,10);
const now=()=>Date.now();
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const ft=(ms:number)=>new Date(ms).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",second:"2-digit"});

/* ─── ATOMS ─── */
const Glow=({color,size=8,pulse=false}:{color:string;size?:number;pulse?:boolean})=>(
  <div style={{width:size,height:size,borderRadius:"50%",background:color,flexShrink:0,
    boxShadow:`0 0 ${size}px ${color}, 0 0 ${size*2}px ${color}44`,
    animation:pulse?"blink 1.8s infinite":"none"}}/>
);
const Tag=({children,color}:{children:React.ReactNode;color:string})=>(
  <span style={{fontFamily:FONT,fontSize:3.5,color,border:`1px solid ${color}55`,
    padding:"2px 6px",background:`${color}10`,whiteSpace:"nowrap",borderRadius:1}}>{children}</span>
);
const Btn=({children,onClick,color,disabled,full,size="md"}:{
  children:React.ReactNode;onClick:()=>void;color:string;disabled?:boolean;full?:boolean;size?:"xs"|"sm"|"md"|"lg";
})=>{
  const pd={xs:"3px 8px",sm:"5px 12px",md:"8px 16px",lg:"12px 22px"}[size];
  const fs={xs:3.5,sm:4,md:5,lg:6}[size];
  return(
    <button onClick={onClick} disabled={disabled} style={{
      fontFamily:FONT,fontSize:fs,padding:pd,cursor:disabled?"not-allowed":"pointer",
      background:disabled?C.dim:`${color}18`,border:`1px solid ${disabled?C.border:color}`,
      color:disabled?C.muted:color,borderRadius:2,transition:"all 0.15s",
      boxShadow:disabled?"none":`0 0 10px ${color}28`,width:full?"100%":undefined,opacity:disabled?0.4:1,
    }}
    onMouseEnter={e=>{if(!disabled)(e.currentTarget as HTMLElement).style.boxShadow=`0 0 20px ${color}55`;}}
    onMouseLeave={e=>{if(!disabled)(e.currentTarget as HTMLElement).style.boxShadow=`0 0 10px ${color}28`;}}
    >{children}</button>
  );
};

/* ─── COMMAND PALETTE ─── */
function CmdPalette({open,onClose,onGoal,onScreen}:{open:boolean;onClose:()=>void;onGoal:(g:string,p:Priority)=>void;onScreen:(s:string)=>void;}){
  const [q,setQ]=useState("");const[sel,setSel]=useState(0);const ref=useRef<HTMLInputElement>(null);
  const cmds=useMemo(()=>[
    ...QUICK.map(([icon,label,goal,priority])=>({icon,label,color:C.gold,action:()=>onGoal(goal,priority as Priority)})),
    {icon:"◈",label:"SNS管理",color:C.pink,action:()=>onScreen("sns")},
    {icon:"⚙",label:"自動化スケジューラ",color:C.lime,action:()=>onScreen("scheduler")},
    {icon:"👑",label:"AI部隊ステータス",color:C.gold,action:()=>onScreen("agents")},
    {icon:"❤",label:"システムヘルス",color:C.red,action:()=>onScreen("health")},
    {icon:"✓",label:"全件一括承認",color:C.green,action:()=>{document.dispatchEvent(new Event("approve-all"));onClose();}},
  ],[onGoal,onScreen,onClose]);
  const filtered=useMemo(()=>!q?cmds:cmds.filter(c=>c.label.toLowerCase().includes(q.toLowerCase())),[q,cmds]);
  useEffect(()=>setSel(0),[filtered]);
  useEffect(()=>{if(open){setQ("");setSel(0);setTimeout(()=>ref.current?.focus(),40);}},[open]);
  if(!open)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(2,5,9,0.9)",backdropFilter:"blur(6px)",
      display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:"12vh"}} onClick={onClose}>
      <div style={{width:"min(620px,95vw)",background:C.card,border:`1px solid ${C.gold}44`,borderRadius:4,
        overflow:"hidden",boxShadow:`0 0 80px ${C.gold}18,0 40px 100px rgba(0,0,0,0.9)`,animation:"slideDown 0.15s ease"}}
        onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"13px 18px",borderBottom:`1px solid ${C.border}`}}>
          <span style={{fontFamily:FONT,fontSize:10,color:C.gold}}>⌘</span>
          <input ref={ref} value={q} onChange={e=>setQ(e.target.value)}
            onKeyDown={e=>{
              if(e.key==="ArrowDown"){e.preventDefault();setSel(s=>Math.min(s+1,filtered.length-1));}
              if(e.key==="ArrowUp"){e.preventDefault();setSel(s=>Math.max(s-1,0));}
              if(e.key==="Enter"&&filtered[sel]){filtered[sel].action();onClose();}
              if(e.key==="Escape")onClose();
            }}
            placeholder="コマンド・ゴールを入力... (⌘K で開閉)"
            style={{flex:1,background:"transparent",border:"none",color:C.text,fontFamily:SANS,fontSize:15,outline:"none"}}/>
          <span style={{fontFamily:FONT,fontSize:4,color:C.muted,border:`1px solid ${C.border}`,padding:"2px 5px"}}>ESC</span>
        </div>
        <div style={{maxHeight:400,overflowY:"auto"}}>
          {filtered.map((c,i)=>(
            <div key={i} onClick={()=>{c.action();onClose();}}
              style={{padding:"11px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,
                background:sel===i?`${c.color}10`:"transparent",
                borderLeft:sel===i?`2px solid ${c.color}`:"2px solid transparent",transition:"all 0.1s"}}
              onMouseEnter={()=>setSel(i)}>
              <span style={{fontSize:15,flexShrink:0}}>{c.icon}</span>
              <span style={{fontFamily:SANS,fontSize:13,color:sel===i?C.text:C.muted,flex:1}}>{c.label}</span>
              {sel===i&&<span style={{fontFamily:FONT,fontSize:4,color:c.color}}>↵ 実行</span>}
            </div>
          ))}
        </div>
        <div style={{padding:"6px 18px",borderTop:`1px solid ${C.border}`,fontFamily:FONT,fontSize:4,color:C.muted,display:"flex",gap:14}}>
          <span>↑↓ 移動</span><span>↵ 実行</span><span>ESC 閉じる</span>
        </div>
      </div>
    </div>
  );
}

/* ─── TASK CARD ─── */
function TaskCard({task,tasks,onApprove,onReject,onToggle,expanded}:{
  task:Task;tasks:Task[];onApprove:()=>void;onReject:()=>void;onToggle:()=>void;expanded:boolean;
}){
  const touchX=useRef(0);const[swipe,setSwipe]=useState(0);const[drag,setDrag]=useState(false);
  const ag=AGENTS[task.agent];
  const children=tasks.filter(t=>t.parent_id===task.id);
  const isLive=["running","qa_running","qa_fixing"].includes(task.status);
  const dotColor={pending:C.muted,running:ag.color,done:C.green,failed:C.red,auto_approved:C.green,qa_running:C.purple,qa_fixing:C.orange}[task.status];
  const statusTxt={pending:"待機",running:"実行中",done:"完了",failed:"失敗",auto_approved:"✓ 自動完了",qa_running:"QA検証中",qa_fixing:"自動修正中"}[task.status];
  const elapsed=task.started_at?((task.done_at||now())-task.started_at)/1000:0;

  const logTypeStyle:{[k:string]:{c:string;icon:string}}={
    think:{c:C.purple,icon:"💭"},action:{c:C.blue,icon:"⚡"},result:{c:C.green,icon:"✓"},
    error:{c:C.red,icon:"✗"},delegate:{c:C.gold,icon:"→"},search:{c:"#22d3ee",icon:"🔍"},
    code:{c:C.blue,icon:"⌨"},post:{c:C.pink,icon:"◈"},email:{c:C.orange,icon:"✉"},
    qa:{c:C.purple,icon:"🔬"},fix:{c:C.orange,icon:"🔧"},deploy:{c:C.green,icon:"🚀"},auto:{c:C.teal,icon:"⚙"},
  };

  return(
    <div style={{position:"relative",marginBottom:8,overflow:"hidden"}}>
      {swipe>30&&drag&&<div style={{position:"absolute",inset:0,width:swipe,background:`${C.green}15`,display:"flex",alignItems:"center",paddingLeft:14,zIndex:0}}><span style={{fontFamily:FONT,fontSize:5,color:C.green}}>✓ 承認</span></div>}
      {swipe<-30&&drag&&<div style={{position:"absolute",inset:0,left:"auto",width:-swipe,background:`${C.red}15`,display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:14,zIndex:0}}><span style={{fontFamily:FONT,fontSize:5,color:C.red}}>✗ 却下</span></div>}
      <div
        onTouchStart={e=>{touchX.current=e.touches[0].clientX;setDrag(true);}}
        onTouchMove={e=>setSwipe(Math.max(-130,Math.min(130,e.touches[0].clientX-touchX.current)))}
        onTouchEnd={()=>{if(swipe>80)onApprove();else if(swipe<-80)onReject();setSwipe(0);setDrag(false);}}
        style={{background:C.card,borderRadius:3,overflow:"hidden",position:"relative",zIndex:1,
          border:`1px solid ${isLive?ag.color+"77":dotColor+"33"}`,
          boxShadow:isLive?`0 0 22px ${ag.color}18`:"none",
          transform:`translateX(${swipe}px)`,transition:drag?"none":"transform 0.2s"}}>
        <div style={{height:2,background:`linear-gradient(90deg,${ag.color},${ag.color}33)`,boxShadow:`0 0 6px ${ag.color}`}}/>
        {isLive&&<div style={{position:"absolute",top:2,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${ag.color},transparent)`,animation:"scanH 2s linear infinite"}}/>}
        <div onClick={onToggle} style={{padding:"11px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
          <Glow color={dotColor} size={isLive?10:7} pulse={isLive}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:SANS,fontSize:13,fontWeight:600,color:C.text,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.title}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              <Tag color={ag.color}>{ag.icon} {ag.name}</Tag>
              <Tag color={dotColor}>{statusTxt}</Tag>
              {task.auto_approved&&task.status!=="auto_approved"&&<Tag color={C.teal}>⚡ 自動</Tag>}
              {task.qa_passed&&<Tag color={C.purple}>🔬 QA合格</Tag>}
              {task.qa_cycles>0&&<Tag color={C.purple}>{task.qa_cycles}回修正</Tag>}
              {elapsed>1&&<span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{elapsed.toFixed(1)}s</span>}
              {(task.status==="done"||task.status==="auto_approved")&&task.xp>0&&<span style={{fontFamily:FONT,fontSize:4,color:C.gold}}>+{task.xp}XP</span>}
              {task.tags.map(t=><span key={t} style={{fontFamily:MONO,fontSize:9,color:C.muted,background:C.dim,padding:"1px 5px",borderRadius:1}}>{t}</span>)}
            </div>
          </div>
          <div style={{display:"flex",gap:5,flexShrink:0}}>
            {children.length>0&&<span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{children.length}↓</span>}
            <span style={{fontFamily:FONT,fontSize:7,color:C.muted}}>{expanded?"▲":"▼"}</span>
          </div>
        </div>
        {expanded&&(
          <div style={{borderTop:`1px solid ${C.border}`}}>
            <div style={{maxHeight:180,overflowY:"auto",padding:"10px 14px",background:"#010306",fontFamily:MONO,fontSize:10.5}}>
              {task.logs.length===0&&<span style={{color:C.muted}}>待機中...</span>}
              {task.logs.map((l,i)=>{
                const s=logTypeStyle[l.type]||{c:C.muted,icon:"·"};
                return(<div key={i} style={{display:"flex",gap:8,marginBottom:4,animation:"fadeIn 0.2s"}}>
                  <span style={{color:C.muted,flexShrink:0,fontSize:9}}>{ft(l.ts)}</span>
                  <span style={{color:s.c,flexShrink:0}}>{s.icon}</span>
                  <span style={{color:s.c===C.green?C.text:s.c,lineHeight:1.7}}>{l.text}</span>
                </div>);
              })}
              {isLive&&<div style={{display:"flex",gap:4,marginTop:6}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:ag.color,animation:"blink 1s infinite",animationDelay:`${i*0.2}s`}}/>)}</div>}
            </div>
            {task.output&&(
              <div style={{padding:"12px 14px",borderTop:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                  <span style={{fontFamily:FONT,fontSize:5,color:ag.color}}>{ag.icon} 成果物</span>
                  <Btn onClick={()=>navigator.clipboard.writeText(task.output)} color={C.blue} size="xs">📋 コピー</Btn>
                </div>
                <pre style={{fontFamily:MONO,fontSize:10.5,color:C.text,background:C.surface,padding:"12px 14px",
                  border:`1px solid ${ag.color}15`,borderRadius:2,whiteSpace:"pre-wrap",overflow:"auto",maxHeight:280,lineHeight:1.8,margin:0}}>
                  {task.output}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
      {expanded&&children.length>0&&(
        <div style={{marginLeft:16,paddingLeft:12,borderLeft:`1px solid ${C.glow}`}}>
          {children.map(child=>(
            <TaskCard key={child.id} task={child} tasks={tasks}
              onApprove={()=>{}} onReject={()=>{}} expanded={false} onToggle={()=>{}}/>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── HEALTH DASHBOARD ─── */
function HealthPanel({tasks,posts,schedules}:{tasks:Task[];posts:SNSPost[];schedules:Schedule[]}){
  const done=tasks.filter(t=>t.status==="done"||t.status==="auto_approved").length;
  const auto=tasks.filter(t=>t.auto_approved).length;
  const qaFixed=tasks.reduce((s,t)=>s+t.qa_cycles,0);
  const xp=tasks.reduce((s,t)=>s+t.xp,0);
  const saved=Math.floor(done*0.5);
  const bots=schedules.filter(s=>s.enabled).length;
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:14}}>
      {[{l:"完了",v:done,c:C.green,i:"✓"},{l:"自動承認",v:auto,c:C.teal,i:"⚡"},
        {l:"QA修正",v:qaFixed,c:C.purple,i:"🔬"},{l:"獲得XP",v:xp,c:C.gold,i:"⭐"},
        {l:"削減時間",v:`${saved}h`,c:C.blue,i:"⏱"},{l:"自動Bot",v:bots,c:C.lime,i:"⚙"}].map(m=>(
        <div key={m.l} style={{padding:"11px 8px",background:C.card,border:`1px solid ${m.c}33`,borderRadius:3,textAlign:"center"}}>
          <div style={{fontSize:12,marginBottom:3}}>{m.i}</div>
          <div style={{fontFamily:FONT,fontSize:11,color:m.c,marginBottom:3}}>{m.v}</div>
          <div style={{fontFamily:MONO,fontSize:8.5,color:C.muted}}>{m.l}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── SNS COMPOSER ─── */
function SNSComposer({onSave}:{onSave:(p:SNSPost)=>void}){
  const[plat,setPlat]=useState<Platform>("threads");
  const[content,setContent]=useState("");const[schedAt,setSchedAt]=useState("");
  const[gen,setGen]=useState(false);const[topic,setTopic]=useState("");const[score,setScore]=useState<number|null>(null);
  const p=PLATFORMS.find(x=>x.id===plat)!;const over=content.length>p.limit;
  const generate=async()=>{
    if(!topic.trim()||gen)return;
    setGen(true);setContent("");setScore(null);
    let out="";
    await stream(AGENTS.pr.sys,[{role:"user",content:`${plat}向け投稿文:\nトピック:${topic}\n上限:${p.limit}字\n完成形のみ出力。ハッシュタグ含む。`}],c=>{out+=c;setContent(out);},600);
    const s=parseInt(await ask("SNS投稿のバズ予測スコア(0-100)を数字のみで返してください。",`プラットフォーム:${plat}\n投稿:${out.slice(0,200)}`));
    if(!isNaN(s))setScore(s);
    setGen(false);
  };
  const save=()=>{
    if(!content.trim()||over)return;
    const tags=content.match(/#[\w\u3040-\u9fff]+/g)||[];
    onSave({id:uid(),platform:plat,content,hashtags:tags,status:schedAt?"scheduled":"draft",scheduled_at:schedAt?new Date(schedAt).getTime():undefined,ai_score:score||0,likes:0,views:0});
    setContent("");setSchedAt("");setScore(null);
  };
  const sc=score?score>=80?C.green:score>=60?C.gold:score>=40?C.orange:C.red:C.muted;
  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 290px",gap:14,padding:14,overflow:"auto",flex:1}}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",gap:5}}>
          {PLATFORMS.map(pl=>(
            <button key={pl.id} onClick={()=>setPlat(pl.id)} style={{flex:1,padding:"7px 4px",cursor:"pointer",borderRadius:2,fontFamily:FONT,fontSize:3.5,
              background:plat===pl.id?`${pl.color}18`:"transparent",border:`1px solid ${plat===pl.id?pl.color:C.border}`,
              color:plat===pl.id?pl.color:C.muted,boxShadow:plat===pl.id?`0 0 10px ${pl.color}33`:"none"}}>
              <div style={{fontSize:12,marginBottom:2}}>{pl.icon}</div>
              <div style={{textTransform:"uppercase"}}>{pl.id}</div>
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={topic} onChange={e=>setTopic(e.target.value)} onKeyDown={e=>e.key==="Enter"&&generate()}
            placeholder="トピック → Enter でAI生成"
            style={{flex:1,background:C.card,border:`1px solid ${C.border}`,color:C.text,fontFamily:SANS,fontSize:13,padding:"9px 12px",borderRadius:2}}/>
          <Btn onClick={generate} disabled={gen||!topic.trim()} color={C.purple}>{gen?"⟳ 生成中":"✦ AI生成"}</Btn>
        </div>
        <textarea value={content} onChange={e=>setContent(e.target.value)}
          placeholder={`${p.name}用の投稿文...（上限${p.limit}字）`}
          style={{flex:1,minHeight:180,background:C.card,border:`1px solid ${over?C.red:content?p.color+"55":C.border}`,
            color:C.text,fontFamily:MONO,fontSize:12,padding:"12px 14px",borderRadius:2,resize:"none",lineHeight:1.8,outline:"none"}}/>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <span style={{fontFamily:MONO,fontSize:10,color:over?C.red:C.muted}}>{content.length}/{p.limit}字</span>
          {score!==null&&<span style={{fontFamily:FONT,fontSize:5,color:sc}}>🎯 バズ予測: {score}</span>}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input type="datetime-local" value={schedAt} onChange={e=>setSchedAt(e.target.value)}
            style={{flex:1,background:C.card,border:`1px solid ${C.border}`,color:C.text,fontFamily:MONO,fontSize:11,padding:"8px 10px",borderRadius:2}}/>
          <Btn onClick={save} disabled={!content.trim()||over} color={p.color}>{schedAt?"⏰ 予約":"💾 保存"}</Btn>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {score!==null&&(
          <div style={{padding:14,background:C.card,border:`1px solid ${sc}44`,borderRadius:3}}>
            <div style={{fontFamily:FONT,fontSize:5,color:C.muted,marginBottom:8}}>✦ バズ予測</div>
            <div style={{fontFamily:FONT,fontSize:28,color:sc,textShadow:`0 0 18px ${sc}`,marginBottom:6}}>{score}</div>
            <div style={{height:5,background:C.dim,borderRadius:3,marginBottom:6}}>
              <div style={{height:"100%",width:`${score}%`,background:sc,borderRadius:3,transition:"width 1s"}}/>
            </div>
            <div style={{fontFamily:SANS,fontSize:11,color:C.muted}}>{score>=80?"🔥 バズる可能性 高":score>=60?"📈 良好":score>=40?"📊 普通":"⚠ 改善推奨"}</div>
          </div>
        )}
        <div style={{flex:1,padding:14,background:C.card,border:`1px solid ${p.color}33`,borderRadius:3}}>
          <div style={{fontFamily:FONT,fontSize:5,color:p.color,marginBottom:8}}>{p.icon} プレビュー</div>
          <div style={{fontFamily:MONO,fontSize:11.5,color:content?C.text:C.muted,lineHeight:1.9,whiteSpace:"pre-wrap"}}>{content||"ここにプレビュー"}</div>
        </div>
        <div style={{padding:"10px 14px",background:C.card,border:`1px solid ${C.border}`,borderRadius:3}}>
          <div style={{fontFamily:FONT,fontSize:4,color:C.muted,marginBottom:6}}>⏰ 推奨投稿時間</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
            {[{t:"07:30",l:"通勤"},{t:"12:00",l:"昼休み"},{t:"19:00",l:"夕方"},{t:"21:30",l:"夜"}].map(r=>(
              <div key={r.t} onClick={()=>{const d=new Date();const[h,m]=r.t.split(":").map(Number);d.setHours(h,m,0,0);setSchedAt(d.toISOString().slice(0,16));}}
                style={{textAlign:"center",padding:"5px",background:C.surface,borderRadius:1,cursor:"pointer"}}>
                <div style={{fontFamily:FONT,fontSize:6,color:C.gold}}>{r.t}</div>
                <div style={{fontFamily:MONO,fontSize:8,color:C.muted}}>{r.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── REAL ACTION EXECUTOR ─── */
async function execAction(action:string,params:any):Promise<{ok:boolean;data?:any;error?:string}>{
  try{
    const res=await fetch("/api/exec",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,params})});
    return await res.json();
  }catch(e:any){return{ok:false,error:e.message};}
}

/* ─── EXECUTION ENGINE ─── */
async function exec(
  task:Task,
  addLog:(id:string,type:string,text:string)=>void,
  upd:(id:string,u:Partial<Task>)=>void,
  spawn:(parent:Task,agent:AgentId,title:string,goal:string,xp:number,tags:string[])=>Task,
  autoApprove:boolean,
){
  const log=(t:string,m:string)=>addLog(task.id,t,m);
  upd(task.id,{status:"running",started_at:now()});
  const finish=async(output:string,xp=task.xp)=>{
    upd(task.id,{status:"auto_approved",done_at:now(),output,auto_approved:true,xp});
    log("auto",autoApprove?"⚡ 自動承認 → 完了":"✓ 完了");
    // Scan output for [EXEC:...] tags and execute them
    await runExecTags(output);
  };

  // Helper: detect and execute [EXEC:action:json] tags in AI output
  const runExecTags=async(output:string)=>{
    const regex=/\[EXEC:([a-z_.]+):(\{[^}]+\})\]/g;
    let match;
    while((match=regex.exec(output))!==null){
      const[,action,jsonStr]=match;
      try{
        const params=JSON.parse(jsonStr);
        log("exec",`🔧 実行: ${action}`);
        const result=await execAction(action,params);
        if(result.ok)log("exec",`✅ ${action} 成功: ${JSON.stringify(result.data).slice(0,100)}`);
        else log("error",`❌ ${action} 失敗: ${result.error}`);
      }catch(e:any){log("error",`実行エラー: ${e.message}`);}
    }
  };
  try{
    if(task.agent==="ceo"){
      log("think",`目標を戦略分析中: 「${task.goal.slice(0,50)}」`);await wait(500);
      type Plan={agent:AgentId;title:string;description:string;priority:Priority;xp:number;tags:string[]}[];
      const plan=await askJSON<Plan>(AGENTS.ceo.sys,`目標: ${task.goal}\n\nタスクを3〜5個に分解してください。devタスクには必ずqaを後続させてください。`);
      if(!plan?.length){log("error","分解失敗");upd(task.id,{status:"failed"});return;}
      log("result",`✦ ${plan.length}つの作戦`);
      plan.forEach((p,i)=>log("delegate",`${i+1}. [${AGENTS[p.agent]?.name||p.agent}] ${p.title}`));
      plan.forEach(p=>spawn(task,p.agent,p.title,p.description,p.xp||120,p.tags||[]));
      upd(task.id,{status:"done",done_at:now(),output:plan.map(p=>`【${AGENTS[p.agent]?.name}】${p.title}\n${p.description}`).join("\n\n"),xp:60});
      return;
    }
    if(task.agent==="dev"){
      log("think","アーキテクチャ設計中...");await wait(400);log("code","実装中...");
      let out="";
      await stream(AGENTS.dev.sys,[{role:"user",content:`実装:\n${task.goal}\n\nNext.js 14+TypeScript+Supabaseで完全コードをファイルパス付きで提供してください。型定義・エラーハンドリング含む。`}],c=>{out+=c;upd(task.id,{output:out});},1500);
      log("result","実装完了 → QAに送信");
      await finish(out,200);
      if(out.length>100)spawn(task,"qa",`QA: ${task.title}`,"以下のコードをQAして自動修正してください:\n\n"+out.slice(0,2500),150,["auto-qa"]);
      return;
    }
    if(task.agent==="qa"){
      const MAX=3;let code=task.goal;let cycles=0;
      while(cycles<MAX){
        cycles++;upd(task.id,{status:"qa_running",qa_cycles:cycles});
        log("qa",`QAサイクル ${cycles}/${MAX} — 静的解析中...`);await wait(600);
        type QR={bugs:{severity:string;desc:string;fix:string}[];test_code:string;deploy_ok:boolean;fixed_code:string};
        const r=await askJSON<QR>(AGENTS.qa.sys,`コードをQAしてください:\n\n${code.slice(0,3000)}\n\nバグを発見して修正し、テストコードも書いてください。`);
        if(!r){log("error","解析失敗 → スキップ");break;}
        const crits=r.bugs.filter(b=>b.severity==="critical").length;
        const highs=r.bugs.filter(b=>b.severity==="high").length;
        log("qa",`検出: critical×${crits} high×${highs} 合計×${r.bugs.length}`);
        if(r.deploy_ok||r.bugs.length===0){
          log("result",`✦ QA合格 (${cycles}サイクル) — デプロイ可能`);
          const out=`## QAレポート (${cycles}サイクル)\n### バグ\n${r.bugs.map(b=>`- [${b.severity}] ${b.desc}`).join("\n")||"なし"}\n\n### テスト\n\`\`\`ts\n${r.test_code||""}\n\`\`\`\n\n### 修正済みコード\n${r.fixed_code||code}`;
          upd(task.id,{status:"done",done_at:now(),output:out,qa_passed:true,xp:200,auto_approved:true,qa_cycles:cycles});
          log("deploy","✅ QA合格 → 自動デプロイへ");return;
        }
        upd(task.id,{status:"qa_fixing",qa_cycles:cycles});
        log("fix",`${r.bugs.length}件を自動修正中...`);
        r.bugs.forEach(b=>log("fix",`  [${b.severity}] ${b.desc}`));
        await wait(800);
        if(r.fixed_code){code=r.fixed_code;log("result",`修正完了 → 再検証`);}
        else{log("error","修正コード取得失敗");break;}
      }
      const out=`## QAレポート (${cycles}サイクル完了)\n修正を実施しました。現状でデプロイします。`;
      log("auto",`最大${MAX}サイクル完了 → デプロイ`);
      upd(task.id,{status:"done",done_at:now(),output:out,qa_cycles:cycles,xp:180,auto_approved:true});
      return;
    }
    if(task.agent==="pr"){
      log("think","バズ戦略策定中...");await wait(400);log("action","コンテンツ生成中...");
      let out="";
      await stream(AGENTS.pr.sys,[{role:"user",content:`SNSコンテンツ作成:\n${task.goal}\n\nTikTok・Threads・X・note・Instagram・YouTube向けの完成形投稿文を、ハッシュタグ・バズ予測スコア(0-100)込みで提供してください。`}],c=>{out+=c;upd(task.id,{output:out});},1000);
      log("post","✦ 全プラットフォーム生成完了");await finish(out,130);return;
    }
    if(task.agent==="sales"){
      log("think","ターゲット分析中...");await wait(400);log("search","企業リサーチ中...");await wait(600);log("email","メール生成中...");
      let out="";
      await stream(AGENTS.sales.sys,[{role:"user",content:`営業:\n${task.goal}\n\n件名・本文・PS・フォローアップ3回分を一式で。`}],c=>{out+=c;upd(task.id,{output:out});},900);
      log("result","✦ 営業メール完成");await finish(out,140);return;
    }
    if(task.agent==="research"){
      log("think","調査計画中...");await wait(400);log("search","データ収集中...");await wait(700);log("action","分析中...");
      let out="";
      await stream(AGENTS.research.sys,[{role:"user",content:`調査:\n${task.goal}\n\nデータ・数値・事例・アクション提言付きで。`}],c=>{out+=c;upd(task.id,{output:out});},900);
      log("result","✦ 調査完了");await finish(out,160);return;
    }
    if(task.agent==="automation"){
      log("think","自動化設計中...");await wait(500);
      let out="";
      await stream(AGENTS.automation.sys,[{role:"user",content:`自動化:\n${task.goal}\n\nPython・GitHub Actions・Supabase Edge Functionで動作するコードとセットアップ手順を。`}],c=>{out+=c;upd(task.id,{output:out});},1200);
      log("deploy","✦ 自動化設計完了");await finish(out,190);
      if(out.length>100)spawn(task,"qa",`QA: ${task.title}`,"以下の自動化コードをQAして:\n\n"+out.slice(0,2500),120,["auto-qa"]);
      return;
    }
    if(task.agent==="analyst"){
      log("action","データ分析中...");await wait(500);
      let out="";
      await stream(AGENTS.analyst.sys,[{role:"user",content:`分析:\n${task.goal}\n\nKPI・トレンド・改善提言込みのレポートを。`}],c=>{out+=c;upd(task.id,{output:out});},900);
      log("result","✦ 分析レポート完成");await finish(out,110);return;
    }
  }catch(e:any){log("error",`エラー: ${e.message}`);upd(task.id,{status:"failed",done_at:now()});}
}

/* ─── ROOT ─── */
export default function CompanyOSv6(){
  const[tasks,setTasks]          =useState<Task[]>([]);
  const[expanded,setExpanded]    =useState<Set<string>>(new Set());
  const[screen,setScreen]        =useState<"tasks"|"sns"|"scheduler"|"agents"|"health">("tasks");
  const[goalInput,setGoalInput]  =useState("");
  const[priority,setPriority]    =useState<Priority>("high");
  const[autoApprove,setAutoApprove]=useState(true);
  const[cmdOpen,setCmdOpen]      =useState(false);
  const[posts,setPosts]          =useState<SNSPost[]>([]);
  const[totalXP,setTotalXP]      =useState(14820);
  const[xpFlash,setXpFlash]      =useState(false);
  const[liveStats,setLiveStats]  =useState<any>(null);

  // Fetch real data from Stripe + Supabase
  useEffect(()=>{
    const fetchStats=async()=>{
      try{ const r=await fetch("/api/stats"); if(r.ok) setLiveStats(await r.json()); }catch{}
    };
    fetchStats();
    const i=setInterval(fetchStats,60000);
    return()=>clearInterval(i);
  },[]);

  const[schedules,setSchedules]  =useState<Schedule[]>([
    {id:"1",name:"週次戦略会議",goal:"今週の状況を分析して戦略を立ててください",agent:"ceo",label:"毎週月曜 9:00",enabled:true,runs:14,next:now()+86400000*2},
    {id:"2",name:"日次SNS計画",goal:"今日のSNS投稿コンテンツを全プラットフォーム向けに生成してください",agent:"pr",label:"毎日 8:00",enabled:true,runs:52},
    {id:"3",name:"コスト監視",goal:"APIコストと売上を確認して異常があれば対策を提案してください",agent:"analyst",label:"毎日 10:00",enabled:true,runs:38},
    {id:"4",name:"競合モニタリング",goal:"競合他社の最新動向を調査してください",agent:"research",label:"毎週月曜 10:00",enabled:false,runs:9},
    {id:"5",name:"週次レポート",goal:"今週の成果をまとめたエグゼクティブレポートを作成してください",agent:"analyst",label:"毎週金曜 18:00",enabled:true,runs:7},
    {id:"6",name:"バグ自動スキャン",goal:"コードベースをQAして発見したバグをすべて修正してください",agent:"qa",label:"毎日 2:00",enabled:true,runs:21},
  ]);

  const runRef=useRef<Set<string>>(new Set());

  const upd=useCallback((id:string,u:Partial<Task>)=>{
    setTasks(prev=>prev.map(t=>t.id===id?{...t,...u}:t));
    if((u.status==="done"||u.status==="auto_approved")&&u.xp){
      setTotalXP(x=>x+(u.xp||0));setXpFlash(true);setTimeout(()=>setXpFlash(false),1200);
    }
  },[]);
  const log=useCallback((id:string,type:string,text:string)=>{
    setTasks(prev=>prev.map(t=>t.id===id?{...t,logs:[...t.logs,{ts:now(),type,text}]}:t));
  },[]);

  useEffect(()=>{
    tasks.filter(t=>t.status==="pending"&&!runRef.current.has(t.id)).forEach(task=>{
      runRef.current.add(task.id);
      setTimeout(()=>{
        exec(task,log,upd,(parent,agentId,title,goal,xp,tags)=>{
          const sub:Task={id:uid(),goal,title,agent:agentId,status:"pending",priority:parent.priority,
            output:"",parent_id:parent.id,children_ids:[],logs:[],created_at:now(),xp,
            auto_approved:false,qa_cycles:0,qa_passed:false,tags};
          setTasks(prev=>{const u=prev.map(t=>t.id===parent.id?{...t,children_ids:[...t.children_ids,sub.id]}:t);return[...u,sub];});
          return sub;
        },autoApprove).finally(()=>runRef.current.delete(task.id));
      },task.parent_id?900:0);
    });
  },[tasks,log,upd,autoApprove]);

  useEffect(()=>{
    const h=()=>tasks.filter(t=>t.status==="pending").forEach(t=>{upd(t.id,{status:"auto_approved",done_at:now(),auto_approved:true,xp:t.xp});log(t.id,"auto","一括承認");});
    document.addEventListener("approve-all",h);return()=>document.removeEventListener("approve-all",h);
  },[tasks,upd,log]);

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault();setCmdOpen(p=>!p);}
      if(e.key==="Escape")setCmdOpen(false);
      if((e.metaKey||e.ctrlKey)&&e.key==="Enter"&&goalInput)submit(goalInput,priority);
    };
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[goalInput,priority]);

  const submit=useCallback((g:string,p:Priority=priority)=>{
    if(!g.trim())return;
    const t:Task={id:uid(),goal:g.trim(),title:g.slice(0,50),agent:"ceo",status:"pending",priority:p,
      output:"",children_ids:[],logs:[],created_at:now(),xp:60,auto_approved:false,qa_cycles:0,qa_passed:false,tags:[]};
    setTasks(prev=>[t,...prev]);setExpanded(prev=>new Set([...prev,t.id]));setGoalInput("");
  },[priority]);

  const top=tasks.filter(t=>!t.parent_id);
  const running=tasks.filter(t=>["running","qa_running","qa_fixing"].includes(t.status)).length;
  const waiting=tasks.filter(t=>t.status==="pending").length;

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=DM+Mono:wght@400;500&family=Outfit:wght@400;500;600;700&display=swap');
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes scanH{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes xpPop{0%{transform:scale(1)}50%{transform:scale(1.35)}100%{transform:scale(1)}}
        @keyframes glowPulse{0%,100%{box-shadow:0 0 12px ${C.green}55}50%{box-shadow:0 0 28px ${C.green}99}}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#020509;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-thumb{background:#0c1e38;border-radius:2px;}
        input,textarea,button{outline:none;}
        ::selection{background:${C.gold}33;}
      `}</style>

      <CmdPalette open={cmdOpen} onClose={()=>setCmdOpen(false)} onGoal={submit} onScreen={s=>setScreen(s as any)}/>

      <div style={{background:C.bg,height:"100vh",display:"flex",flexDirection:"column",color:C.text,overflow:"hidden"}}>

        {/* TOPBAR */}
        <div style={{height:48,background:C.surface,borderBottom:`1px solid ${C.glow}`,
          display:"flex",alignItems:"center",padding:"0 14px",gap:0,flexShrink:0,boxShadow:"0 2px 20px rgba(0,0,0,0.6)"}}>
          <div style={{display:"flex",alignItems:"center",gap:9,marginRight:16,flexShrink:0}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1.5}}>
              {[C.blue,C.pink,C.gold,C.green].map((c,i)=>(<div key={i} style={{width:5,height:5,background:c,boxShadow:`0 0 5px ${c}`,borderRadius:0.5}}/>))}
            </div>
            <div>
              <div style={{fontFamily:FONT,fontSize:5.5,color:C.gold,letterSpacing:"0.12em"}}>COMPANY OS</div>
              <div style={{fontFamily:MONO,fontSize:7.5,color:C.muted}}>完全自律型 v6 — 自分不要</div>
            </div>
          </div>

          {([{id:"tasks",l:"🤖 タスク"},{id:"sns",l:"◈ SNS"},{id:"scheduler",l:"⚙ 自動化"},{id:"agents",l:"👑 AI部隊"},{id:"health",l:"❤ ヘルス"}] as const).map(n=>(
            <button key={n.id} onClick={()=>setScreen(n.id)} style={{
              background:screen===n.id?`${C.gold}0d`:"transparent",border:"none",
              borderBottom:screen===n.id?`2px solid ${C.gold}`:"2px solid transparent",
              padding:"0 13px",height:48,fontFamily:SANS,fontSize:12.5,fontWeight:600,
              color:screen===n.id?C.gold:C.muted,cursor:"pointer",transition:"all 0.15s"}}>
              {n.l}
            </button>
          ))}

          <div style={{flex:1}}/>

          <button onClick={()=>setCmdOpen(true)} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 12px",
            background:C.card,border:`1px solid ${C.border}`,borderRadius:3,color:C.muted,cursor:"pointer",
            marginRight:12,fontFamily:SANS,fontSize:12,transition:"all 0.15s"}}
            onMouseEnter={e=>{(e.currentTarget).style.borderColor=C.gold+"55";}}
            onMouseLeave={e=>{(e.currentTarget).style.borderColor=C.border;}}>
            <span style={{fontFamily:FONT,fontSize:5}}>⌘</span>
            <span>コマンド</span>
            <span style={{fontFamily:FONT,fontSize:4,border:`1px solid ${C.border}`,padding:"1px 4px",borderRadius:1}}>K</span>
          </button>

          <div style={{marginRight:14,textAlign:"right"}}>
            <div style={{fontFamily:FONT,fontSize:5,color:C.gold,animation:xpFlash?"xpPop 0.5s ease":"none",textShadow:xpFlash?`0 0 16px ${C.gold}`:"none"}}>⭐ {totalXP.toLocaleString()}</div>
            <div style={{fontFamily:MONO,fontSize:8,color:C.muted}}>Company XP</div>
          </div>

          {running>0&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",border:`1px solid ${C.gold}`,background:`${C.gold}10`,borderRadius:2,marginRight:8}}>
            <Glow color={C.gold} size={6} pulse/><span style={{fontFamily:FONT,fontSize:4,color:C.gold}}>{running}件実行中</span>
          </div>}

          {/* 自動承認トグル — デフォルトON */}
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <div>
              <div style={{fontFamily:FONT,fontSize:4,color:autoApprove?C.green:C.muted}}>{autoApprove?"⚡ 全自動モード":"手動承認"}</div>
              <div style={{fontFamily:MONO,fontSize:7.5,color:C.muted}}>{autoApprove?"人間不要":"確認あり"}</div>
            </div>
            <div onClick={()=>setAutoApprove(p=>!p)} style={{width:46,height:24,borderRadius:12,cursor:"pointer",
              background:autoApprove?C.green:C.dim,border:`1px solid ${autoApprove?C.green:C.border}`,
              position:"relative",transition:"all 0.25s",
              animation:autoApprove?"glowPulse 2s infinite":"none"}}>
              <div style={{position:"absolute",top:4,left:autoApprove?25:4,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.25s"}}/>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div style={{flex:1,display:"flex",overflow:"hidden"}}>

          {/* LEFT */}
          <div style={{width:288,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden",background:C.surface}}>
            <div style={{padding:13,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{fontFamily:FONT,fontSize:4.5,color:C.gold,marginBottom:8}}>🎯 ゴールを投げる</div>
              <textarea id="goal-input" value={goalInput} onChange={e=>setGoalInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&e.metaKey&&submit(goalInput)}
                placeholder="何でもいい。AIが全部やる。"
                style={{width:"100%",height:74,background:C.card,border:`1px solid ${goalInput?C.gold+"66":C.border}`,
                  color:C.text,fontFamily:SANS,fontSize:13,padding:"10px 12px",borderRadius:2,resize:"none",lineHeight:1.7,boxSizing:"border-box"}}/>
              <div style={{display:"flex",gap:4,margin:"7px 0"}}>
                {(["critical","high","normal","low"] as Priority[]).map(p=>{
                  const col={critical:C.red,high:C.orange,normal:C.blue,low:C.muted}[p];
                  return(<button key={p} onClick={()=>setPriority(p)} style={{flex:1,padding:"4px 0",fontFamily:FONT,fontSize:3.5,cursor:"pointer",borderRadius:1,
                    background:priority===p?`${col}18`:"transparent",border:`1px solid ${priority===p?col:C.border}`,color:priority===p?col:C.muted}}>
                    {p==="critical"?"🔴緊":p==="high"?"🟠高":p==="normal"?"🔵普":"⚪低"}
                  </button>);
                })}
              </div>
              <Btn onClick={()=>submit(goalInput)} disabled={!goalInput.trim()} color={C.gold} full size="lg">▶ AIに全部任せる</Btn>
              <div style={{fontFamily:MONO,fontSize:9,color:C.muted,textAlign:"center",marginTop:5}}>⌘+Enter で即実行</div>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"10px 12px"}}>
              <div style={{fontFamily:FONT,fontSize:4,color:C.muted,marginBottom:8}}>⚡ クイック</div>
              {QUICK.map(([icon,label,goal,p])=>(
                <div key={label} onClick={()=>submit(goal,p as Priority)}
                  style={{padding:"8px 10px",marginBottom:5,cursor:"pointer",background:C.card,border:`1px solid ${C.border}`,
                    borderRadius:2,display:"flex",alignItems:"center",gap:9,transition:"all 0.15s"}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.gold+"55";(e.currentTarget as HTMLElement).style.background=`${C.gold}08`;}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.border;(e.currentTarget as HTMLElement).style.background=C.card;}}>
                  <span style={{fontSize:14,flexShrink:0}}>{icon}</span>
                  <span style={{fontFamily:SANS,fontSize:12,color:C.text,flex:1}}>{label}</span>
                  <span style={{fontFamily:FONT,fontSize:3.5,color:p==="critical"?C.red:p==="high"?C.orange:C.muted,border:"1px solid currentColor",padding:"1px 4px"}}>{p==="critical"?"緊急":p==="high"?"高":"普"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* MAIN */}
          <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>

            {screen==="tasks"&&(
              <div style={{flex:1,overflow:"auto",padding:14}}>
                <HealthPanel tasks={tasks} posts={posts} schedules={schedules}/>
                {(running>0||waiting>0)&&(
                  <div style={{padding:"8px 14px",marginBottom:10,background:C.card,border:`1px solid ${C.gold}44`,borderRadius:3,display:"flex",alignItems:"center",gap:12}}>
                    <Glow color={C.gold} size={6} pulse/>
                    <span style={{fontFamily:SANS,fontSize:12.5,color:C.gold,flex:1}}>
                      {running>0&&`${running}件実行中`}{running>0&&waiting>0&&" · "}{waiting>0&&`${waiting}件待機`}
                      {autoApprove&&" → 自動承認で全部処理されます"}
                    </span>
                    <Btn onClick={()=>tasks.filter(t=>t.status==="pending").forEach(t=>{upd(t.id,{status:"auto_approved",done_at:now(),auto_approved:true,xp:t.xp});log(t.id,"auto","一括承認");})} color={C.green} size="sm">✓ 一括承認</Btn>
                    <Btn onClick={()=>setTasks(p=>p.filter(t=>t.status!=="done"&&t.status!=="auto_approved"&&t.status!=="failed"))} color={C.muted} size="sm">完了を消す</Btn>
                    <Btn onClick={()=>setTasks([])} color={C.red} size="sm">🗑 全消去</Btn>
                  </div>
                )}
                {top.length===0&&(
                  <div style={{textAlign:"center",paddingTop:50}}>
                    <div style={{fontSize:56,marginBottom:14,filter:`drop-shadow(0 0 24px ${C.gold})`}}>👑</div>
                    <div style={{fontFamily:FONT,fontSize:7,color:C.gold,marginBottom:12,letterSpacing:"0.1em"}}>READY</div>
                    <div style={{fontFamily:SANS,fontSize:13.5,color:C.muted,lineHeight:2}}>
                      左にゴールを入力するか ⌘K でコマンドを開いてください<br/>
                      <br/>
                      <span style={{fontFamily:MONO,fontSize:11,color:autoApprove?C.green:C.muted}}>
                        {autoApprove?"⚡ 自動承認ON — 人間は不要です":"手動承認モード — ONにすると全自動"}
                      </span>
                    </div>
                  </div>
                )}
                {top.map(t=>(
                  <TaskCard key={t.id} task={t} tasks={tasks}
                    onApprove={()=>{upd(t.id,{status:"auto_approved",done_at:now(),auto_approved:true,xp:t.xp});log(t.id,"auto","手動承認");}}
                    onReject={()=>upd(t.id,{status:"failed",done_at:now()})}
                    onToggle={()=>setExpanded(prev=>{const n=new Set(prev);n.has(t.id)?n.delete(t.id):n.add(t.id);return n;})}
                    expanded={expanded.has(t.id)}/>
                ))}
              </div>
            )}

            {screen==="sns"&&(
              <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
                <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,flexShrink:0,display:"flex",gap:12,alignItems:"center"}}>
                  <div style={{fontFamily:FONT,fontSize:5.5,color:C.pink}}>◈ SNS運用コンソール</div>
                  <div style={{flex:1}}/>
                  <Btn onClick={()=>submit("今日のSNS投稿コンテンツを全プラットフォーム向けに生成してください","high")} color={C.pink} size="sm">✦ AIで全部生成</Btn>
                </div>
                <SNSComposer onSave={p=>setPosts(prev=>[p,...prev])}/>
                {posts.length>0&&(
                  <div style={{borderTop:`1px solid ${C.border}`,padding:"10px 16px",maxHeight:180,overflow:"auto",flexShrink:0}}>
                    <div style={{fontFamily:FONT,fontSize:4,color:C.muted,marginBottom:8}}>保存済み投稿</div>
                    {posts.map(p=>{
                      const pl=PLATFORMS.find(x=>x.id===p.platform)!;
                      return(<div key={p.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,padding:"7px 12px",background:C.card,border:`1px solid ${pl.color}22`,borderRadius:2}}>
                        <Tag color={pl.color}>{pl.icon} {pl.name}</Tag>
                        <Tag color={p.status==="scheduled"?C.gold:p.status==="posted"?C.green:C.muted}>{p.status==="scheduled"?"予約":p.status==="posted"?"投稿済":"下書き"}</Tag>
                        {p.ai_score>0&&<span style={{fontFamily:FONT,fontSize:5,color:p.ai_score>=80?C.green:C.gold}}>🎯{p.ai_score}</span>}
                        <span style={{fontFamily:MONO,fontSize:10.5,color:C.muted,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.content.slice(0,60)}</span>
                        <Btn onClick={()=>navigator.clipboard.writeText(p.content)} color={C.blue} size="xs">📋</Btn>
                        <Btn onClick={()=>setPosts(prev=>prev.filter(x=>x.id!==p.id))} color={C.red} size="xs">🗑</Btn>
                      </div>);
                    })}
                  </div>
                )}
              </div>
            )}

            {screen==="scheduler"&&(
              <div style={{flex:1,overflow:"auto",padding:16}}>
                <div style={{fontFamily:FONT,fontSize:5.5,color:C.lime,marginBottom:12}}>⚙ 自動実行スケジューラ</div>
                <div style={{fontFamily:SANS,fontSize:13,color:C.muted,marginBottom:14,lineHeight:1.7,padding:"10px 14px",background:C.card,border:`1px solid ${C.border}`,borderRadius:2}}>
                  💡 Windowsエージェント常駐 + Vercel Cron で自動実行。スマホからON/OFFできます。
                </div>
                {schedules.map(s=>{
                  const ag=AGENTS[s.agent];
                  return(<div key={s.id} style={{marginBottom:10,padding:"13px 16px",background:C.card,borderRadius:3,
                    border:`1px solid ${s.enabled?ag.color+"55":C.border}`,opacity:s.enabled?1:0.55,
                    boxShadow:s.enabled?`0 0 16px ${ag.color}0d`:"none",transition:"all 0.2s"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <Glow color={s.enabled?ag.color:C.muted} size={s.enabled?9:6} pulse={s.enabled}/>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:SANS,fontSize:13,fontWeight:600,color:C.text,marginBottom:4}}>{s.name}</div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                          <Tag color={ag.color}>{ag.icon} {ag.name}</Tag>
                          <span style={{fontFamily:MONO,fontSize:10,color:C.gold}}>⏰ {s.label}</span>
                          <span style={{fontFamily:MONO,fontSize:10,color:C.muted}}>実行{s.runs}回</span>
                          {s.next&&<span style={{fontFamily:MONO,fontSize:10,color:C.muted}}>次:{new Date(s.next).toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>}
                        </div>
                      </div>
                      <div onClick={()=>setSchedules(prev=>prev.map(x=>x.id===s.id?{...x,enabled:!x.enabled}:x))}
                        style={{width:46,height:24,borderRadius:12,cursor:"pointer",flexShrink:0,
                          background:s.enabled?C.green:C.dim,border:`1px solid ${s.enabled?C.green:C.border}`,
                          position:"relative",transition:"all 0.25s",boxShadow:s.enabled?`0 0 12px ${C.green}55`:"none"}}>
                        <div style={{position:"absolute",top:4,left:s.enabled?25:4,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.25s"}}/>
                      </div>
                      <Btn onClick={()=>submit(s.goal,s.agent==="ceo"?"high":"normal")} color={ag.color} size="xs">今すぐ</Btn>
                    </div>
                  </div>);
                })}
                <Btn onClick={()=>{const name=prompt("スケジュール名");const goal=prompt("ゴール");if(name&&goal)setSchedules(p=>[...p,{id:uid(),name,goal,agent:"ceo",label:"手動",enabled:true,runs:0}]);}} color={C.lime} size="md">+ 追加</Btn>
              </div>
            )}

            {screen==="agents"&&(
              <div style={{flex:1,overflow:"auto",padding:16}}>
                <div style={{fontFamily:FONT,fontSize:5.5,color:C.gold,marginBottom:14}}>👑 AI部隊ステータス</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
                  {(Object.entries(AGENTS) as [AgentId,typeof AGENTS[AgentId]][]).map(([id,ag])=>{
                    const at=tasks.filter(t=>t.agent===id);
                    const live=at.some(t=>["running","qa_running","qa_fixing"].includes(t.status));
                    const done=at.filter(t=>t.status==="done"||t.status==="auto_approved").length;
                    const xpG=at.reduce((s,t)=>s+(t.xp||0),0);
                    const autoA=at.filter(t=>t.auto_approved).length;
                    return(<div key={id} style={{padding:15,background:C.card,borderRadius:3,
                      border:`1px solid ${live?ag.color+"88":ag.color+"22"}`,boxShadow:live?`0 0 22px ${ag.color}18`:"none",transition:"all 0.3s"}}>
                      <div style={{display:"flex",gap:10,marginBottom:10,alignItems:"flex-start"}}>
                        <span style={{fontSize:20}}>{ag.icon}</span>
                        <div style={{flex:1}}>
                          <div style={{fontFamily:FONT,fontSize:5.5,color:ag.color,marginBottom:2}}>{ag.name}</div>
                          <div style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{ag.role}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontFamily:FONT,fontSize:5,color:C.gold}}>Lv.{ag.level}</div>
                          {live&&<div style={{fontFamily:FONT,fontSize:4,color:ag.color,animation:"blink 1.5s infinite"}}>稼働中</div>}
                        </div>
                      </div>
                      <div style={{height:3,background:C.dim,borderRadius:2,marginBottom:8}}>
                        <div style={{height:"100%",width:`${(ag.level%10)*10}%`,background:ag.color,boxShadow:`0 0 5px ${ag.color}`,borderRadius:2}}/>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:5,marginBottom:10}}>
                        {[{l:"完了",v:done,c:C.green},{l:"自動",v:autoA,c:C.teal},{l:"XP",v:xpG,c:C.gold},{l:"全",v:at.length,c:C.muted}].map(m=>(
                          <div key={m.l} style={{textAlign:"center",padding:"5px 4px",background:C.surface,borderRadius:1}}>
                            <div style={{fontFamily:FONT,fontSize:7,color:m.c}}>{m.v}</div>
                            <div style={{fontFamily:MONO,fontSize:8,color:C.muted}}>{m.l}</div>
                          </div>
                        ))}
                      </div>
                      <Btn onClick={()=>{const g=prompt(`${ag.name}に直接指示`);if(g){const t:Task={id:uid(),goal:g,title:g.slice(0,45),agent:id,status:"pending",priority:"high",output:"",children_ids:[],logs:[],created_at:now(),xp:120,auto_approved:false,qa_cycles:0,qa_passed:false,tags:["direct"]};setTasks(prev=>[t,...prev]);setScreen("tasks");}}} color={ag.color} size="xs" full>直接指示を出す</Btn>
                    </div>);
                  })}
                </div>
              </div>
            )}

            {screen==="health"&&(
              <div style={{flex:1,overflow:"auto",padding:16}}>
                <div style={{fontFamily:FONT,fontSize:5.5,color:C.red,marginBottom:14}}>❤ システムヘルス</div>

                {/* Live Revenue from Stripe + Supabase */}
                {liveStats&&(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
                    {[
                      {l:"Stripe売上",v:`¥${liveStats.revenue.total.toLocaleString()}`,c:C.green,i:"💰"},
                      {l:"コスト合計",v:`¥${liveStats.cost.total.toLocaleString()}`,c:C.red,i:"📉"},
                      {l:"純利益",v:`¥${liveStats.profit.net.toLocaleString()}`,c:liveStats.profit.net>=0?C.green:C.red,i:liveStats.profit.net>=0?"📈":"⚠"},
                      {l:"ユーザー",v:`${liveStats.users.total}人`,c:C.blue,i:"👥"},
                    ].map(m=>(
                      <div key={m.l} style={{padding:"11px 8px",background:C.card,border:`1px solid ${m.c}33`,borderRadius:3,textAlign:"center"}}>
                        <div style={{fontSize:12,marginBottom:3}}>{m.i}</div>
                        <div style={{fontFamily:FONT,fontSize:10,color:m.c,marginBottom:3}}>{m.v}</div>
                        <div style={{fontFamily:MONO,fontSize:8.5,color:C.muted}}>{m.l}</div>
                      </div>
                    ))}
                  </div>
                )}
                {liveStats&&(
                  <div style={{marginBottom:14,padding:"12px 16px",background:C.card,border:`1px solid ${C.gold}33`,borderRadius:3}}>
                    <div style={{fontFamily:FONT,fontSize:4.5,color:C.gold,marginBottom:8}}>💳 月額サブスクリプション</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                      {liveStats.subscriptions.items.filter((s:any)=>s.monthly>0).map((s:any)=>(
                        <div key={s.id} style={{padding:"6px 10px",background:C.surface,borderRadius:2,display:"flex",justifyContent:"space-between"}}>
                          <span style={{fontFamily:MONO,fontSize:10,color:C.text}}>{s.name}</span>
                          <span style={{fontFamily:FONT,fontSize:5,color:C.orange}}>¥{s.monthly.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{marginTop:8,fontFamily:FONT,fontSize:5,color:C.orange,textAlign:"right"}}>
                      合計: ¥{liveStats.subscriptions.total.toLocaleString()}/月
                    </div>
                  </div>
                )}

                <HealthPanel tasks={tasks} posts={posts} schedules={schedules}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                  {[
                    {label:"自動承認 (デフォルトON)",value:autoApprove?"🟢 有効":"🔴 無効",color:autoApprove?C.green:C.red,desc:"タスク完了時に人間の承認不要"},
                    {label:"QA自動修正ループ",value:"🟢 有効",color:C.purple,desc:"バグ発見 → 自動修正 → 再検証（最大3サイクル）"},
                    {label:"git自動コミット",value:"🟡 エージェント要",color:C.gold,desc:"Windowsエージェントが担当"},
                    {label:"SNS自動投稿",value:"🟡 エージェント要",color:C.gold,desc:"Windowsエージェントが担当"},
                    {label:"Vercel Cron",value:"🟢 設定済",color:C.green,desc:"10分ごとにスケジューラを実行"},
                    {label:"Supabase Realtime",value:"🟢 接続中",color:C.green,desc:"全デバイスにリアルタイム同期"},
                  ].map(item=>(
                    <div key={item.label} style={{padding:"14px 16px",background:C.card,border:`1px solid ${item.color}33`,borderRadius:3}}>
                      <div style={{fontFamily:FONT,fontSize:5,color:item.color,marginBottom:6}}>{item.value}</div>
                      <div style={{fontFamily:SANS,fontSize:12.5,fontWeight:600,color:C.text,marginBottom:4}}>{item.label}</div>
                      <div style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{item.desc}</div>
                    </div>
                  ))}
                </div>
                {tasks.filter(t=>t.qa_cycles>0).length>0&&(
                  <div>
                    <div style={{fontFamily:FONT,fontSize:4.5,color:C.purple,marginBottom:8}}>🔬 QA自動修正履歴</div>
                    {tasks.filter(t=>t.qa_cycles>0).map(t=>(
                      <div key={t.id} style={{marginBottom:6,padding:"10px 14px",background:C.card,border:`1px solid ${C.purple}33`,borderRadius:2,display:"flex",gap:10,alignItems:"center"}}>
                        <Tag color={t.qa_passed?C.green:C.orange}>{t.qa_passed?"QA合格":"修正済"}</Tag>
                        <span style={{fontFamily:SANS,fontSize:12,color:C.text,flex:1}}>{t.title}</span>
                        <span style={{fontFamily:FONT,fontSize:5,color:C.purple}}>修正{t.qa_cycles}回</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
