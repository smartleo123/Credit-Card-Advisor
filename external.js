"use strict";
(() => {
 const el=id=>document.getElementById(id);
 const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const types={cards:"信用卡",promos:"優惠活動",wallets:"支付工具",fee_rules:"年費規則",today:"當日推薦資料",issuers:"發卡銀行"};
 let data=null;

 let catalogShown=24;
 let discoveryRankings={};
 let fullRewardEvidence={};
 const discoverySlugs=["seven-eleven","familymart","convenience","line-pay","jkopay","apple-pay","shopee","momo","dining","overseas","online","general"];
 const discoveryTitles={"seven-eleven":"7-ELEVEN","familymart":"全家","convenience":"超商","line-pay":"LINE Pay","jkopay":"街口","apple-pay":"Apple Pay","shopee":"蝦皮","momo":"momo","dining":"餐飲","overseas":"海外","online":"網購","general":"一般"};
 function userCards(){try{return JSON.parse(localStorage.getItem("cardwise-tw-settings-v2")||"{}")}catch{return {}}}
 function bankNames(){return Object.fromEntries((data?.datasets?.issuers||[]).map(e=>[e.id,e.name]))}
 function officialLink(row){
   const text=row?.search||"";
   const urls=text.match(/https:\/\/[^\s]+/g)||[];
   const valid=urls.find(u=>/^https:\/\/(?:www\.)?(?:[\w-]+\.)*(?:com\.tw|gov\.tw|org\.tw|com|tw)\//i.test(u)&&!u.includes(".png")&&!u.includes(".jpg"));
   return valid?valid.replace(/[),;]+$/,""):"";
 }
 function rewardHighlights(cardId){
   if(fullRewardEvidence[cardId])return fullRewardEvidence[cardId].slice(0,6).map(x=>({slug:x.slug,title:x.title,rate:x.rateBp/100,verified:x.reviewed,requirements:(x.needs||[]).length,details:x.needs||[],capTwd:x.capTwd}));
   const found=[];
   for(const slug of discoverySlugs){
     const d=discoveryRankings[slug];
     const row=d?.entries?.find(x=>x.card_id===cardId&&!x.expired);
     const v=row?.once||row?.basic;
     if(!v||!Number.isFinite(v.net_rate_bp)||v.net_rate_bp<=0)continue;
     found.push({slug,rate:v.net_rate_bp/100,verified:row.reviewed===true,requirements:v.requirements?.length||0});
   }
   return found.sort((a,b)=>Number(b.verified)-Number(a.verified)||b.rate-a.rate).slice(0,4);
 }
 function renderFullCards(){
   const box=el("full-card-grid");if(!box||!data)return;
   const source=data.datasets.cards||[];
   const byToday=new Map((data.datasets.today||[]).map(c=>[c.id,c]));
   const issuers=bankNames(), q=(el("full-card-search").value||"").trim().toLocaleLowerCase();
   const bank=el("full-card-bank").value, status=el("full-card-status").value;
   const owned=new Set(userCards().owned||[]);
   const filtered=source.filter(c=>{
     if(bank!=="all"&&c.issuer!==bank)return false;
     if(status==="owned"&&!owned.has(c.id))return false;
     if(status==="credit"&&!/\bcredit\b/.test(c.search))return false;
     if(status==="debit"&&!/\bdebit\b/.test(c.search))return false;
     return (c.name+" "+(issuers[c.issuer]||"")+" "+(byToday.get(c.id)?.search||"")).toLocaleLowerCase().includes(q);
   });
   const rows=filtered.slice(0,catalogShown);
   el("full-card-count").textContent=source.length+" 張卡片 · "+Object.keys(issuers).length+" 家機構 · 資料 "+(data.metadata.dataDate||"待查核");
   const info=rows.map(c=>{
     const sourceRow=byToday.get(c.id);
     const issuer=issuers[c.issuer]||c.issuer;
     const high=rewardHighlights(c.id);
     const links=officialLink(sourceRow);
     const evidence=high.length?high.map(v=>'<span class="tag">'+escape(v.title||discoveryTitles[v.slug]||v.slug)+' '+v.rate.toFixed(2)+'%'+(v.verified?" · 已複核":" · 未複核")+'</span>').join(""):'<span class="subtle">尚無此處已索引通路的可量化排行，請查看來源資料</span>';
     const details=high.length?'<details class="bonus-box"><summary>查看各通路回饋的上限與條件</summary><p>各數字為來源的一次設定情境，仍須核對實際資格，不能當作任意金額的保證回饋。</p>'+high.map(v=>'<p><b>'+escape(v.title||discoveryTitles[v.slug]||v.slug)+'：'+v.rate.toFixed(2)+'%</b> · '+(v.verified?'已近期複核':'尚未近期複核')+' · 上限：'+(v.capTwd==null?'未列明':'NT$ '+escape(v.capTwd))+'。 '+escape((v.details||[]).join('；')||'詳細條款請到該通路排行查詢')+'</p>').join('')+'<a href="#source-rankings">開啟完整通路榜單 ↗</a></details>':"";
     return '<article class="card full-card"><div class="bank">'+escape(issuer)+'</div><h3>'+escape(c.name)+'</h3><div class="details">'+evidence+'</div>'+details+'<div class="card-footer"><label class="check"><input type="checkbox" data-full-owned="'+escape(c.id)+'" '+(owned.has(c.id)?"checked":"")+'> 我持有這張卡</label>'+(links?'<a href="'+escape(links)+'" target="_blank" rel="noopener noreferrer">銀行來源 ↗</a>':'<a href="https://pay.elggum.com/" target="_blank" rel="noopener noreferrer">資料提供站 ↗</a>')+'</div><p class="subtle">來源卡片 ID：'+escape(c.id)+'；回饋以詳細資格與銀行官網為準</p></article>';
   }).join("");
   box.innerHTML=rows.length?info:'<div class="empty">找不到符合條件的信用卡。</div>';
   el("full-card-page").textContent="顯示 "+rows.length+" / "+filtered.length+" 張；來源總計 "+source.length+" 張";
   el("full-card-more").hidden=rows.length>=filtered.length;
 }
 async function warmRankingHighlights(){
   await Promise.allSettled(discoverySlugs.map(async slug=>{
     if(discoveryRankings[slug])return;
     const r=await fetch("./data/external/rankings/"+slug+".json",{cache:"no-store"});
     if(!r.ok)return;
     const j=await r.json();
     if(j.slug===slug&&Array.isArray(j.entries))discoveryRankings[slug]=j;
   }));
   renderFullCards();
 }
 function setupFullCards(){
   if(!data)return;
   const options=data.datasets.issuers||[];
   el("full-card-bank").innerHTML='<option value="all">所有發卡機構</option>'+options.filter(x=>(data.datasets.cards||[]).some(c=>c.issuer===x.id)).sort((a,b)=>a.name.localeCompare(b.name,"zh-Hant")).map(i=>'<option value="'+escape(i.id)+'">'+escape(i.name)+'</option>').join("");
   el("full-card-search").addEventListener("input",()=>{catalogShown=24;renderFullCards()});
   el("full-card-bank").addEventListener("change",()=>{catalogShown=24;renderFullCards()});
   el("full-card-status").addEventListener("change",()=>{catalogShown=24;renderFullCards()});
   el("full-card-more").addEventListener("click",()=>{catalogShown+=24;renderFullCards()});
   el("full-card-grid").addEventListener("change",e=>{
     const id=e.target?.dataset?.fullOwned;
     if(!id)return;
     const state=userCards(),set=new Set(state.owned||[]);
     e.target.checked?set.add(id):set.delete(id);
     state.owned=[...set];
     localStorage.setItem("cardwise-tw-settings-v2",JSON.stringify(state));
     renderFullCards();
     // Original calculator re-reads settings on page refresh; source rankings read current localStorage.
   });
   renderFullCards();
   const all=data?.metadata?.rankingsIndex||[];
   const select=el("source-ranking-category");
   if(select&&all.length){
     const current=select.value;
     select.innerHTML=all.map(x=>'<option value="'+escape(x.slug)+'">'+escape(x.title)+'</option>').join("");
     if(all.some(x=>x.slug===current))select.value=current;
   }
   fetch("./data/external/card-reward-highlights.json",{cache:"no-store"})
     .then(r=>r.ok?r.json():null)
     .then(x=>{if(x?.license==="CC BY 4.0"&&x?.cards){fullRewardEvidence=x.cards;renderFullCards()}else warmRankingHighlights()})
     .catch(()=>warmRankingHighlights());
 }

 function render(){
   const kind=el("external-type").value;
   const q=el("external-search").value.trim().toLocaleLowerCase("zh-Hant");
   const records=data?.datasets?.[kind]||[];
   const matched=records.filter(r=>(r.name+" "+r.issuer+" "+r.summary+" "+r.search).toLocaleLowerCase("zh-Hant").includes(q));
   const list=matched.slice(0,80);
   el("external-count").textContent="顯示 "+list.length+"／"+matched.length+" 筆，資料集 "+records.length+" 筆";
   if(!list.length){el("external-list").innerHTML='<div class="empty">找不到對應資料。可能是該資料尚未被 API 索引，或目前沒有符合的記錄。</div>';return}
   el("external-list").innerHTML=list.map(r=>{
    const link=r.url?'<a href="'+escape(r.url)+'" target="_blank" rel="noopener noreferrer">來源連結 ↗</a>':"";
    return '<article class="external-card"><div class="bank">'+escape(r.issuer||types[kind])+'</div><h3>'+escape(r.name||r.id)+'</h3><p>'+escape(r.summary||"提供原始資料索引；完整優惠條件需查看來源")+'</p><div class="external-links">'+link+'</div></article>';
   }).join("");
 }
 async function init(){
   try{
     const res=await fetch("./data/external/index.json",{cache:"no-store"});
     if(!res.ok)throw new Error("快取尚未產生（HTTP "+res.status+"）");
     const loaded=await res.json();
     if(!loaded.metadata||!loaded.datasets||loaded.metadata.license!=="CC BY 4.0")throw new Error("資料不符合授權／格式驗證");
     data=loaded;
     const m=data.metadata;
     const counts=Object.entries(m.recordCounts||{}).map(([k,v])=>(types[k]||k)+" "+v+" 筆").join(" · ");
     el("external-status").innerHTML='<strong>同步來源：</strong><a href="https://pay.elggum.com/" target="_blank" rel="noopener noreferrer">台灣支付優惠站</a>　<strong>資料日期：</strong>'+escape(m.dataDate||"來源未提供")+'　<strong>取得日期：</strong>'+escape(m.syncedAt||"未提供")+'<div class="subtle">'+escape(counts)+'</div>';
     render();
     setupFullCards();
     if(el("card-count"))el("card-count").textContent=(data.datasets.cards||[]).length+" 張卡片已收錄";
   }catch(err){
     el("external-status").textContent="外部 API 的第一份有效快取尚未發布："+err.message+"。GitHub Actions 會自動同步；在完成前，既有核實資料照常使用。";
     el("external-list").innerHTML='<div class="empty">避免顯示空白或編造回饋，外部來源同步成功前不會將其資料納入比較。<a href="https://github.com/smartleo123/Credit-Card-Advisor/actions" target="_blank" rel="noopener noreferrer">查看同步工作流程 ↗</a></div>';
   }
 }
 el("external-type")?.addEventListener("change",render);
 el("external-search")?.addEventListener("input",render);

 const rankingNames={"seven-eleven":"7-ELEVEN","familymart":"全家","convenience":"便利商店綜合","line-pay":"LINE Pay","jkopay":"街口支付","apple-pay":"Apple Pay","shopee":"蝦皮","momo":"momo","dining":"餐飲","overseas":"海外消費","online":"網購","general":"一般消費"};
 const methodNames={physical:"實體卡／輸入卡號",line_pay:"LINE Pay",jkopay:"街口支付",apple_pay:"Apple Pay",pi_wallet:"Pi 拍錢包",icash_pay:"icash Pay",easywallet:"悠遊付",pxpay_plus:"全支付"};
 let rankingCache={};
 function cash(n){return Number.isFinite(Number(n))?"NT$ "+new Intl.NumberFormat("zh-TW",{maximumFractionDigits:2}).format(n):"無可比較金額"}
 function scenario(entry,mode){return entry[mode]&&typeof entry[mode]==="object"?entry[mode]:null}
 function showRanking(){
   const slug=el("source-ranking-category").value;
   const mode=el("source-ranking-mode").value;
   const scope=el("source-ranking-scope").value;
   const data=rankingCache[slug];
   if(!data){el("source-ranking-meta").textContent="排名快取載入中，或此通路資料尚未成功同步。";el("source-ranking-results").innerHTML='<div class="empty">尚無可用排名，請檢查 GitHub Actions 的 Sync licensed credit card data 工作流程。</div>';return}
   let entries=(Array.isArray(data.entries)?data.entries:[]).filter(e=>!e.expired);
   if(scope==="reviewed")entries=entries.filter(e=>e.reviewed===true);
   if(scope==="owned"){
     let owned=[];try{owned=JSON.parse(localStorage.getItem("cardwise-tw-settings-v2")||"{}").owned||[]}catch{}
     entries=entries.filter(e=>owned.includes(e.card_id));
   }
   entries=entries.filter(e=>scenario(e,mode)&&scenario(e,mode).net_twd_per_1000!==null&&scenario(e,mode).net_twd_per_1000!==undefined&&Number.isFinite(Number(scenario(e,mode).net_twd_per_1000)));
   entries.sort((a,b)=>Number(scenario(b,mode).net_twd_per_1000)-Number(scenario(a,mode).net_twd_per_1000));
   const amount=Number(data.amount_twd)||1000;
   el("source-ranking-meta").textContent="資料 "+(data.data_date||"未知")+" · "+(data.title_zh||rankingNames[slug])+" · 以來源單筆 NT$"+amount+" 計算 · "+entries.length+" 張可比較；未進行你的已用額度扣除";
   const note=mode==="best"?"需要達成最佳條件，不能直接視為保證回饋":mode==="once"?"僅計算一次性設定後可拿到的回饋":"沒有完成加碼任務的基本情況";
   const items=entries.slice(0,30).map((e,i)=>{
     const v=scenario(e,mode),rate=Number(v.net_rate_bp),amountValue=Number(v.net_twd_per_1000);
     const req=(v.requirements||[]).filter(x=>typeof x==="string").slice(0,6);
     const method=methodNames[v.method]||v.method||"請依條款";
     const state=e.reviewed===true?"近期二次核對":"來源未近期二次核對";
     const money=Number.isFinite(amountValue)?cash(amountValue):"不可估算";
     const percent=Number.isFinite(rate)?(rate/100).toFixed(2)+"%":"—";
     const cap=v.cap_twd_max==null?"未列出":cash(v.cap_twd_max);
     const eligibility=req.length?'<details class="ranking-detail"><summary>查看適用條件（'+req.length+'）</summary><ul>'+req.map(x=>'<li>'+escape(x)+'</li>').join("")+'</ul></details>':'<span class="subtle">來源未列出額外任務；仍須符合一般消費規則</span>';
     return '<article class="result"><div><div class="bank">'+(i+1)+' · '+escape(state)+' · '+escape(e.confidence||"")+'</div><h3>'+escape(e.card_name||e.card_id)+'</h3><div class="subtle">付款方式：'+escape(method)+' · 方案：'+escape(v.plan||"未指定")+'</div></div><div class="score"><strong>'+money+'</strong><span>單筆 '+cash(amount)+' 預估淨回饋 · '+percent+'</span></div><div class="details"><span class="tag">來源總回饋率 '+percent+'</span><span class="tag">已知回饋上限 '+cap+'</span>'+(v.max_spend_twd==null?"":'<span class="tag">來源適用刷卡額上限 '+cash(v.max_spend_twd)+'</span>')+'<span class="tag">'+escape(note)+'</span></div><div class="details" style="display:block">'+eligibility+'</div></article>';
   }).join("");
   el("source-ranking-results").innerHTML=items||'<div class="empty">此條件下沒有可用的來源排名。可切換至「全部收錄信用卡」。</div>';
 }
 async function loadRanking(){
   const slug=el("source-ranking-category").value;
   if(rankingCache[slug]){showRanking();return}
   try{
     const r=await fetch("./data/external/rankings/"+encodeURIComponent(slug)+".json",{cache:"no-store"});
     if(!r.ok)throw new Error("HTTP "+r.status);
     const d=await r.json();
     if(d.slug!==slug||!Array.isArray(d.entries)||!String(d.license||"").includes("CC BY 4.0"))throw new Error("資料格式／授權不符合預期");
     rankingCache[slug]=d;showRanking();
   }catch(error){
     el("source-ranking-meta").textContent="來源排行尚未準備好："+error.message;
     el("source-ranking-results").innerHTML='<div class="empty">來源排行同步尚未完成，請前往 GitHub Actions 查看結果。既有可核實的信用卡資料仍可查詢。</div>';
   }
 }
 el("source-ranking-category")?.addEventListener("change",loadRanking);
 el("source-ranking-mode")?.addEventListener("change",showRanking);
 el("source-ranking-scope")?.addEventListener("change",showRanking);
 loadRanking();

 init();
})();
