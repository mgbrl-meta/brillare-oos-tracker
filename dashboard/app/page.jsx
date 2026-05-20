"use client";
import { useEffect, useState, useMemo } from "react";

const D_AMBER = 10, D_RED = 10;
const PLATFORMS = ["shopify", "amazon", "flipkart", "nykaa", "myntra", "smytten"];
const PLF = { shopify: "Own Site", amazon: "Amazon", flipkart: "Flipkart", nykaa: "Nykaa", myntra: "Myntra", smytten: "Smytten" };

const TH = {
  light: { dark:false, bgA:"#f3f1ea", bgB:"#e9e6db", glass:"rgba(255,255,255,0.62)", glassBorder:"rgba(255,255,255,0.7)", card:"rgba(255,255,255,0.55)", row:"rgba(255,255,255,0.45)", ink:"#1c1a15", mid:"#5d584c", mut:"#8a8475", line:"rgba(20,18,12,0.10)", accent:"#1f6f52", accentInk:"#fff", shadow:"0 1px 2px rgba(40,35,20,.05), 0 10px 30px rgba(40,35,20,.09)", glow:"0 8px 32px rgba(31,111,82,.10)" },
  dark: { dark:true, bgA:"#121116", bgB:"#0c0b0f", glass:"rgba(32,30,38,0.55)", glassBorder:"rgba(255,255,255,0.07)", card:"rgba(34,32,40,0.5)", row:"rgba(255,255,255,0.035)", ink:"#f0eee7", mid:"#b3ad9f", mut:"#827c6e", line:"rgba(255,255,255,0.07)", accent:"#2f9d72", accentInk:"#06140e", shadow:"0 1px 2px rgba(0,0,0,.4), 0 14px 40px rgba(0,0,0,.5)", glow:"0 8px 40px rgba(47,157,114,.14)" },
};
const GREEN="#2fa971", RED="#e0564f", AMBER="#d9962a", GREYD="#8a8474";

export default function Dashboard() {
  const [data,setData]=useState(null);const [report,setReport]=useState(null);const [hist,setHist]=useState(null);
  const [tab,setTab]=useState("oos");const [q,setQ]=useState("");const [open,setOpen]=useState(null);
  const [mode,setMode]=useState("dark");const [err,setErr]=useState(null);
  useEffect(()=>{const sd=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;setMode(sd?"dark":"light");
    fetch("/data/latest.json").then(r=>r.json()).then(setData).catch(e=>setErr(String(e)));
    const m=new Date().toISOString().slice(0,7).replace("-","_");
    fetch(`/data/report_${m}.json`).then(r=>r.ok?r.json():null).then(setReport).catch(()=>{});
    fetch("/data/history_compact.json").then(r=>r.ok?r.json():null).then(setHist).catch(()=>{});},[]);
  const T=TH[mode];
  const k=useMemo(()=>{if(!data)return{n:0,inS:0,oos:0,deep:0,pp:{}};let inS=0,oos=0,deep=0;const pp={};
    PLATFORMS.forEach(p=>pp[p]={in:0,tot:0});
    data.products.forEach(pr=>PLATFORMS.forEach(pl=>{const v=pr.platforms[pl]||{};
      if(v.status==="in_stock"){inS++;pp[pl].in++;pp[pl].tot++;}else if(v.status==="out_of_stock"){oos++;pp[pl].tot++;}
      if(v.discount_pct!=null&&v.discount_pct>=D_RED)deep++;}));
    return{n:data.products.length,inS,oos,deep,pp};},[data]);
  if(err)return <Shell T={T} mode={mode} setMode={setMode}><p style={{color:T.mut}}>Couldn't load data — a successful scraper run is needed first. ({err})</p></Shell>;
  if(!data)return <Shell T={T} mode={mode} setMode={setMode}><p className="pulse" style={{color:T.mut}}>Loading…</p></Shell>;
  const prods=data.products.filter(p=>!q||p.name.toLowerCase().includes(q.toLowerCase())||p.sku.toLowerCase().includes(q.toLowerCase()));
  return (
    <Shell T={T} mode={mode} setMode={setMode} ts={new Date(data.checked_at).toLocaleString()}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:24}}>
        <Kpi T={T} label="Products" big={k.n} sub="across 6 platforms"/>
        <Kpi T={T} label="In stock" big={k.inS} sub="live now" tone={GREEN}/>
        <Kpi T={T} label="Out of stock" big={k.oos} sub="all platforms" tone={RED}/>
        <Kpi T={T} label="Deep discounts" big={k.deep} sub={`\u2265${D_RED}% off`} tone={AMBER}/>
      </div>
      <div style={{fontSize:11.5,color:T.mut,marginBottom:10,fontWeight:700,letterSpacing:".1em"}}>PLATFORM BREAKDOWN</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:11,marginBottom:28}}>
        {PLATFORMS.map(pl=>{const s=k.pp[pl]||{in:0,tot:0};const pct=s.tot?Math.round(s.in/s.tot*100):0;return(
          <div key={pl} style={{background:T.card,backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",border:`1px solid ${T.line}`,borderRadius:14,padding:"13px 15px"}}>
            <div style={{fontSize:12,color:T.mid}}>{PLF[pl]}</div>
            <div style={{display:"flex",alignItems:"baseline",gap:5,marginTop:3}}><span style={{fontSize:19,fontWeight:700,color:T.ink}}>{s.in}</span><span style={{fontSize:12,color:T.mut}}>/ {s.tot||k.n}</span></div>
            <div style={{height:4,background:T.line,borderRadius:3,marginTop:8,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",borderRadius:3,background:pct>=80?GREEN:pct>=60?AMBER:RED,transition:"width .6s ease"}}/></div>
          </div>);})}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
        {[["oos","Out of Stock"],["price","Price"],["summary","Summary"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} style={{fontFamily:"inherit",fontSize:13.5,fontWeight:600,padding:"10px 20px",borderRadius:11,cursor:"pointer",transition:"all .2s ease",border:`1px solid ${tab===id?"transparent":T.line}`,background:tab===id?T.accent:T.card,backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",color:tab===id?T.accentInk:T.mid}}>{lbl}</button>))}
      </div>
      {tab!=="summary"&&(<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search SKU or product…" style={{fontFamily:"inherit",fontSize:14,padding:"12px 16px",borderRadius:12,border:`1px solid ${T.line}`,background:T.card,backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",color:T.ink,width:"100%",marginBottom:18,outline:"none"}}/>)}
      {tab==="summary"?<Summary T={T} report={report}/>:<div style={{display:"grid",gap:12}}>{prods.map((p,i)=>(<ProductCard key={p.sku} p={p} T={T} idx={i} expanded={open===p.sku} onToggle={()=>setOpen(open===p.sku?null:p.sku)} hist={hist&&hist.skus?hist.skus[p.sku]:null}/>))}</div>}
    </Shell>
  );
}
function Shell({children,T,mode,setMode,ts}){return(
  <div style={{minHeight:"100vh",position:"relative",background:`radial-gradient(1200px 600px at 15% -5%, ${T.dark?"rgba(47,157,114,.10)":"rgba(31,111,82,.08)"}, transparent 60%), linear-gradient(180deg, ${T.bgA}, ${T.bgB})`,fontFamily:"'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",transition:"background .4s ease"}}>
    <style>{`*{box-sizing:border-box}body{margin:0}.pulse{animation:pl 1.4s ease-in-out infinite}@keyframes pl{0%,100%{opacity:.4}50%{opacity:1}}@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}.glass{transition:transform .22s ease,box-shadow .22s ease}.glass:hover{transform:translateY(-2px)}table{width:100%;border-collapse:collapse}::placeholder{color:${T.mut}}`}</style>
    <div style={{maxWidth:1160,margin:"0 auto",padding:"40px 24px 70px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:30}}>
        <div><h1 style={{fontSize:30,fontWeight:750,color:T.ink,margin:"0 0 5px",letterSpacing:"-.03em"}}>Brillare OOS Tracker</h1>
          <div style={{fontSize:12.5,color:T.mut,fontFamily:"ui-monospace,'SF Mono',Menlo,monospace"}}>{ts?"Last checked: "+ts:"loading…"}</div></div>
        <button onClick={()=>setMode(mode==="dark"?"light":"dark")} aria-label="Toggle theme" style={{width:42,height:42,borderRadius:13,cursor:"pointer",flexShrink:0,border:`1px solid ${T.glassBorder}`,background:T.glass,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",color:T.ink,fontSize:17,display:"grid",placeItems:"center",boxShadow:T.shadow}}>{mode==="dark"?"\u2600\uFE0E":"\u263E"}</button>
      </div>{children}
    </div>
  </div>);}
function Kpi({T,label,big,sub,tone}){return(
  <div className="glass" style={{background:T.glass,backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)",border:`1px solid ${T.glassBorder}`,borderRadius:18,padding:"18px 20px",boxShadow:T.shadow}}>
    <div style={{fontSize:11.5,color:T.mut,textTransform:"uppercase",letterSpacing:".09em",fontWeight:700}}>{label}</div>
    <div style={{fontSize:30,fontWeight:760,margin:"7px 0 2px",color:tone||T.ink,letterSpacing:"-.02em"}}>{big}</div>
    <div style={{fontSize:11.5,color:T.mut}}>{sub}</div></div>);}
function statusColor(s){return s==="in_stock"?GREEN:s==="out_of_stock"?RED:s==="no_link"?null:GREYD;}
function Spark({series,T}){const pts=(series||[]).filter(x=>x.selling!=null);
  if(pts.length<2)return <span style={{fontSize:11,color:T.mut}}>history builds daily ({(series||[]).length}d)</span>;
  const vals=pts.map(x=>x.selling);const mn=Math.min(...vals),mx=Math.max(...vals),rng=mx-mn||1;const W=120,H=28;
  const d=pts.map((x,i)=>`${(i/(pts.length-1))*W},${H-((x.selling-mn)/rng)*H}`).join(" ");
  return <svg width={W} height={H} style={{display:"block"}}><polyline points={d} fill="none" stroke={T.accent} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/></svg>;}
function ProductCard({p,T,idx,expanded,onToggle,hist}){
  const oosN=PLATFORMS.filter(pl=>(p.platforms[pl]||{}).status==="out_of_stock").length;
  return(<div className="glass" style={{background:T.glass,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:`1px solid ${T.glassBorder}`,borderRadius:20,boxShadow:expanded?T.glow:T.shadow,animation:"rise .5s ease both",animationDelay:`${Math.min(idx*24,500)}ms`,overflow:"hidden"}}>
    <div onClick={onToggle} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",cursor:"pointer",gap:14}}>
      <div style={{minWidth:0}}><div style={{fontSize:15,fontWeight:660,color:T.ink,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
        <div style={{fontSize:11.5,color:T.mut,fontFamily:"ui-monospace,Menlo,monospace",marginTop:2}}>{p.sku} · {p.type}</div></div>
      <div style={{display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
        <div style={{display:"flex",gap:6}}>{PLATFORMS.map(pl=>{const c=statusColor((p.platforms[pl]||{}).status);return <span key={pl} title={PLF[pl]} style={{width:9,height:9,borderRadius:"50%",background:c||"transparent",border:c?"none":`1.5px solid ${T.line}`}}/>;})}</div>
        <span style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:10,background:oosN>=3?(T.dark?"#3a1f1e":"#fbe4e3"):oosN?(T.dark?"#3a2f17":"#faf0d8"):(T.dark?"#16322440":"#e3f4ec"),color:oosN>=3?RED:oosN?AMBER:GREEN}}>{oosN?oosN+" OOS":"OK"}</span>
        <span style={{color:T.mut,fontSize:13,transform:expanded?"rotate(180deg)":"none",transition:"transform .25s ease"}}>⌄</span>
      </div></div>
    {expanded&&(<div style={{borderTop:`1px solid ${T.line}`,padding:"6px 12px 14px"}}>
      {PLATFORMS.map(pl=>{const v=p.platforms[pl]||{};const d=v.discount_pct;
        const dbg=d==null?"transparent":d>=D_RED?(T.dark?"#3a1f1e":"#fbe6e5"):d>=D_AMBER?(T.dark?"#3a2f17":"#faf1da"):"transparent";
        return(<div key={pl} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",borderRadius:12,marginTop:6,background:dbg!=="transparent"?dbg:T.row}}>
          <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
            <span style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:statusColor(v.status)||"transparent",border:statusColor(v.status)?"none":`1.5px solid ${T.line}`}}/>
            <span style={{fontSize:13,color:T.ink,fontWeight:560,width:78}}>{PLF[pl]}</span>
            <span style={{opacity:.8}}><Spark series={hist?hist[pl]:null} T={T}/></span></div>
          <div style={{textAlign:"right",fontFamily:"ui-monospace,Menlo,monospace",fontSize:12.5}}>
            {v.selling!=null?(<span style={{color:T.ink,fontWeight:650}}>{"\u20b9"}{v.selling}{d!=null&&d>0&&<span style={{marginLeft:7,color:d>=D_RED?RED:d>=D_AMBER?AMBER:T.mut}}>{"\u2212"}{d}%</span>}</span>):<span style={{color:T.mut,fontSize:11.5}}>{v.status==="no_link"?"not sold here":v.status==="out_of_stock"?"out of stock":v.status==="in_stock"?"in stock":(v.status||"—")}</span>}
            {v.mrp!=null&&v.mrp!==v.selling&&<div style={{color:T.mut,textDecoration:"line-through",fontSize:10.5}}>{"\u20b9"}{v.mrp}</div>}
          </div></div>);})}
    </div>)}
  </div>);}
function Summary({T,report}){
  if(!report)return <p style={{color:T.mut,fontSize:14}}>No monthly summary yet — it builds automatically as the scraper runs each day. Day one shows "1 day tracked"; trends appear over the month.</p>;
  const rows=[...report.rows].filter(r=>r.days_oos>0||r.max_discount).sort((a,b)=>b.days_oos-a.days_oos);
  return(<div className="glass" style={{background:T.glass,backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)",border:`1px solid ${T.glassBorder}`,borderRadius:18,overflow:"hidden",boxShadow:T.shadow}}>
    <div style={{padding:"14px 18px",fontSize:12.5,color:T.mut,fontFamily:"ui-monospace,Menlo,monospace",borderBottom:`1px solid ${T.line}`}}>{report.month} · generated {new Date(report.generated).toLocaleString()}</div>
    <table><thead><tr>{["SKU","Platform","Days tracked","Days OOS","Longest streak","Max disc","Avg disc"].map(h=>(<th key={h} style={{textAlign:h==="SKU"||h==="Platform"?"left":"center",padding:"12px 16px",fontSize:11,textTransform:"uppercase",letterSpacing:".07em",color:T.mut,fontWeight:700,background:T.row}}>{h}</th>))}</tr></thead>
    <tbody>{rows.map((r,i)=>(<tr key={i} style={{borderTop:`1px solid ${T.line}`}}>
      <td style={{padding:"12px 16px",fontFamily:"ui-monospace,Menlo,monospace",fontSize:12,color:T.mid}}>{r.sku}</td>
      <td style={{padding:"12px 16px",color:T.ink}}>{r.platform}</td>
      <td style={{padding:"12px 16px",textAlign:"center",color:T.ink}}>{r.days_tracked}</td>
      <td style={{padding:"12px 16px",textAlign:"center"}}><span style={{fontWeight:r.days_oos>0?750:400,color:r.days_oos>=5?RED:r.days_oos>0?AMBER:T.ink,background:r.days_oos>=5?(T.dark?"#3a1f1e":"#fbe4e3"):"transparent",padding:r.days_oos>=5?"3px 9px":0,borderRadius:9}}>{r.days_oos}</span></td>
      <td style={{padding:"12px 16px",textAlign:"center",color:T.ink}}>{r.longest_oos_streak}</td>
      <td style={{padding:"12px 16px",textAlign:"center",color:r.max_discount>=D_RED?RED:T.ink}}>{r.max_discount!=null?r.max_discount+"%":"—"}</td>
      <td style={{padding:"12px 16px",textAlign:"center",color:T.ink}}>{r.avg_discount!=null?r.avg_discount+"%":"—"}</td>
    </tr>))}</tbody></table>
  </div>);}