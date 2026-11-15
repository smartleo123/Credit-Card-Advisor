"use strict";
const $=s=>document.querySelector(s);
const fmt=n=>new Intl.NumberFormat("zh-TW",{maximumFractionDigits:2}).format(n);
const money=n=>"NT$ "+fmt(n);
const KEY="cardwise-tw-settings-v2";
const today=()=>new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Taipei"});
const categories={general:"一般消費",linepay:"LINE Pay",jkopay:"街口支付",applepay:"Apple Pay",shopee:"蝦皮購物",momo:"momo 購物網",convenience:"超商",overseas:"海外消費",dining:"餐飲",shopping:"購物"};
const labels={"esun-estatement":"玉山已設定帳單 e 化（基本0.3%）","esun-autopay":"玉山電子帳單＋本行帳戶自扣","esun-simple":"玉山簡單選（與 UP 選擇一）","esun-up":"玉山 UP 選已符合訂閱／任務","cube-fixed":"CUBE 已切換固定回饋方案","overseas-physical":"海外實體面對面交易","fubon-tasks":"富邦電子帳單＋本行帳戶自扣","j-asia-country":"富邦 J：實際消費在日本／韓國／泰國","daway-bind":"DAWAY 已綁 LINE Pay","daway-go":"DAWAY GO 三項任務皆完成","new-customer":"符合當期信用卡新戶定義","hsbc-eligible":"滙豐該筆為官方指定合格通路","hsbc-autopay":"滙豐本行帳戶自扣任務完成","cube-digital":"CUBE 玩數位方案已選定","cube-dining":"CUBE 樂饗購方案已選定","cube-curated":"CUBE 當日已選定集精選方案","cube-level1":"CUBE Level 1","cube-level2":"CUBE Level 2 已完成升級資格","cube-level3":"CUBE Level 3 財管貴賓"};
let catalog=[];
let merchantPolicies={};
const defaults=()=>({owned:[],conditions:[],used:{},fee:{},pointValue:{}});
let settings=load();
function load(){try{const x=JSON.parse(localStorage.getItem(KEY));return {...defaults(),...x,used:x?.used||{},fee:x?.fee||{},pointValue:x?.pointValue||{}}}catch{return defaults()}}
function save(){localStorage.setItem(KEY,JSON.stringify(settings))}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function findLimit(card,rule){return card.id+":"+rule.id}
function capGroup(card,rule){return card.id+":"+(rule.capGroup||rule.id)}
function activeRule(rule,date){return (!rule.start||rule.start<=date)&&(!rule.end||date<=rule.end)}
function conditionsMet(rule){return(rule.conditions||[]).every(x=>settings.conditions.includes(x))}
function eligible(rule,cat){return (rule.category||[]).includes(cat)||(rule.category||[]).includes("all")}
function chooseRules(card,cat,date){
  const rules=(card.rules||[]).filter(r=>eligible(r,cat)&&activeRule(r,date)&&conditionsMet(r));
  if(card.id==="cathay-cube"&&rules.some(r=>r.id==="cube-fixed"||r.id==="cube-overseas"))return rules.filter(r=>!r.id.startsWith("cube-digital")&&!r.id.startsWith("cube-dining")&&!r.id.startsWith("cube-curated"));
  if(card.id==="esun-unicard"&&rules.some(r=>r.id==="esun-up"))return rules.filter(r=>r.id!=="esun-simple");
  return rules;
}
function compute(card,amount,cat,date,annualSpend,fxFee,merchant,policies){
 if(!Number.isFinite(card.base.rate))return null;
 const overseas=cat==="overseas";
 const policy=cat==="convenience" ? policies?.convenience?.[card.id] : null;
 if(cat==="convenience"){
   if(!merchant)return {card,status:"unknown",reason:"請先選擇實際超商，才能核對該卡適用資格"};
   if(!policy || !policy.merchants.includes(merchant))return {card,status:"unknown",reason:"尚未確認此張卡於該超商的官方回饋條款"};
   if(policy.status==="excluded")return {card,status:"excluded",reason:policy.note,source:policy.source};
   if(policy.status==="conditional" && !(card.rules||[]).some(r=>r.category.includes("convenience") && (!r.merchants || r.merchants.includes(merchant)) && activeRule(r,date) && conditionsMet(r)))
     return {card,status:"unknown",reason:"已查到指定超商加碼，但你尚未勾選當日適用的權益方案；無法當成已確認回饋",source:policy.source};
 }
 if((card.exclude||[]).includes(cat))return {card,status:"excluded",reason:"銀行條款列為排除的消費類型",source:card.source};
 const point=Number(settings.pointValue[card.id]??card.pointValue??1);
 const validPoint=Number.isFinite(point)&&point>=0?point:0;
 const base=(card.base.conditions||[]).every(x=>settings.conditions.includes(x))?amount*card.base.rate:0;
 const rules=chooseRules(card,cat,date).filter(r=>!r.merchants || r.merchants.includes(merchant));
 let bonus=0;const lines=[card.base.note||"基本回饋"];const usedGroups={};
 for(const rule of rules){
  let raw=amount*rule.rate;let cap=rule.cap;
  if(cap!=null){const group=capGroup(card,rule);const used=Number(settings.used[group]??settings.used[findLimit(card,rule)]??0);const previous=usedGroups[group]||0;raw=Math.max(0,Math.min(raw,cap-Math.max(0,used)-previous));usedGroups[group]=previous+raw}
  if(raw>0){bonus+=raw;lines.push(rule.label+"：+"+fmt(raw*validPoint)+" 元估值")}
 }
 const gross=(base+bonus)*validPoint;
 const feeInput=settings.fee[card.id];
 const annualFee=feeInput!==undefined&&feeInput!==""?Number(feeInput):card.fee;
 const feeKnown=annualFee!==null&&annualFee!==undefined&&Number.isFinite(Number(annualFee))&&Number(annualFee)>=0;
 // Per-spend proportional allocation. Avoid dividing by zero.
 const feeCost=feeKnown&&annualSpend>0?Number(annualFee)*amount/annualSpend:0;
 const fxCost=overseas?amount*fxFee/100:0;
 const net=gross-feeCost-fxCost;
 const warnings=[];
 if(!feeKnown)warnings.push("年費未核實，暫未扣除；可在卡片設定填入"); else if(Number(annualFee)>0) warnings.push("依牌告年費攤提；若已達免年費條件，請將個人實際年費設為0");
 if(cat==="convenience")warnings.push("僅適用所選超商的合格一般商品；代收、儲值等交易另有排除");
 if(["linepay","jkopay","applepay"].includes(cat))warnings.push("實際商戶認列與第三方支付排除依銀行公告");
 if(cat==="overseas")warnings.push("跨境手續費為估算值，匯率與交易認列可能不同");
 if(rules.some(r=>r.cap!=null))warnings.push("剩餘上限依你手動填寫的已用點數計算");
 return {card,base,bonus,gross,feeCost,fxCost,net,lines,warnings,eligible:true,status:"ranked"};
}
function renderConditions(){
 $("#condition-list").innerHTML=Object.entries(labels).map(([id,label])=>'<label class="check"><input type="checkbox" data-condition="'+escapeHtml(id)+'" '+(settings.conditions.includes(id)?"checked":"")+'> '+escapeHtml(label)+'</label>').join("");
 $("#condition-list").addEventListener("change",event=>{const id=event.target.dataset.condition;if(!id)return;let s=new Set(settings.conditions);event.target.checked?s.add(id):s.delete(id);
 if(event.target.checked&&["cube-fixed","cube-digital","cube-dining","cube-curated"].includes(id)){for(const other of ["cube-fixed","cube-digital","cube-dining","cube-curated"])if(other!==id)s.delete(other)}
 if(event.target.checked&&["cube-level1","cube-level2","cube-level3"].includes(id)){for(const other of ["cube-level1","cube-level2","cube-level3"])if(other!==id)s.delete(other)}
 if(id==="esun-simple"&&event.target.checked)s.delete("esun-up");
 if(id==="esun-up"&&event.target.checked)s.delete("esun-simple");
 settings.conditions=[...s];save();renderConditions();renderResults()}, {once:true});
}
function renderResults(){
 const amount=Math.max(0,Number($("#amount").value)||0),cat=$("#category").value,date=$("#date").value||today();
 const merchant=$("#merchant").value;
 $("#merchant-wrap").hidden=cat!=="convenience";
 const annualSpend=Math.max(0,Number($("#annual-spend").value)||0),fxFee=Math.max(0,Number($("#fx-fee").value)||0);
 const scope=$("#scope").value;
 const computed=catalog.filter(c=>scope==="all"||settings.owned.includes(c.id)).map(c=>compute(c,amount,cat,date,annualSpend,fxFee,merchant,merchantPolicies)).filter(Boolean);
 const results=computed.filter(x=>x.status==="ranked").sort((a,b)=>b.net-a.net);
 const others=computed.filter(x=>x.status!=="ranked");
 $("#results-summary").textContent=results.length+" 張可比較 · "+others.length+" 張待查核或明確不適用 · "+categories[cat]+" · "+money(amount);
 const main=results.length?results.map((r,i)=>'<article class="result"><div><div class="bank">'+escapeHtml(r.card.bank)+'　'+(i===0?"★ 已確認條件中排名最高":"")+'</div><h3>'+escapeHtml(r.card.name)+'</h3><div class="subtle">基本 '+money(r.base*(settings.pointValue[r.card.id]??r.card.pointValue??1))+' ＋ 加碼 '+money(r.bonus*(settings.pointValue[r.card.id]??r.card.pointValue??1))+'</div></div><div class="score"><strong>'+money(r.net)+'</strong><span>預估淨回饋／本筆</span></div><div class="details"><span class="tag">總回饋現值 '+money(r.gross)+'</span><span class="tag">年費攤提 -'+money(r.feeCost)+'</span><span class="tag">海外手續費 -'+money(r.fxCost)+'</span>'+r.warnings.map(w=>'<span class="tag warn">'+escapeHtml(w)+'</span>').join('')+'</div><div class="details">'+r.lines.map(w=>'<span>· '+escapeHtml(w)+'</span>').join('')+'</div><div class="details"><a href="'+escapeHtml(r.card.source)+'" target="_blank" rel="noopener noreferrer">官方條款 ↗</a></div></article>').join(""):'<div class="empty">目前沒有可依據已確認規則計算的回饋，請檢查商家與持卡權益設定。這不是指所有卡片回饋都是 0 元。</div>';
 const otherHtml=others.length?'<h3>未納入排名的卡片</h3>'+others.map(r=>'<article class="result"><div><div class="bank">'+escapeHtml(r.card.bank)+' · '+(r.status==="excluded"?"官方明確排除":"資料／資格待確認")+'</div><h3>'+escapeHtml(r.card.name)+'</h3><div class="subtle">'+escapeHtml(r.reason)+'</div></div><div class="score"><span>'+(r.status==="excluded"?"不適用":"不排名")+'</span></div><div class="details"><a href="'+escapeHtml(r.source||r.card.source)+'" target="_blank" rel="noopener noreferrer">核對官方來源 ↗</a></div></article>').join(""):'';
 $("#results").innerHTML=main+otherHtml;
}
function renderCard(card){
 const owned=settings.owned.includes(card.id);
 const amount=card.fee==null?"尚待核實":money(card.fee);
 const feeOverride=settings.fee[card.id]??"";
 const pointValue=settings.pointValue[card.id]??card.pointValue??1;
 const rules=(card.rules||[]).filter(r=>r.cap!=null);
 const status=card.verified?"已查核部分回饋":"回饋待查核";
 return '<article class="card"><span class="bank">'+escapeHtml(card.bank)+' · '+status+'</span><h3>'+escapeHtml(card.name)+'</h3><p>'+escapeHtml(card.base.note)+'</p><div class="facts"><div>牌告年費<strong>'+amount+'</strong></div><div>最低年收入<strong>'+(card.income==null?"尚待核實":money(card.income))+'</strong></div><div>免年費方式<strong>'+escapeHtml(card.waiver)+'</strong></div><div>點數形式<strong>'+escapeHtml(card.reward)+'</strong></div></div><div class="card-footer"><label class="check"><input type="checkbox" data-owned="'+escapeHtml(card.id)+'" '+(owned?"checked":"")+'> 我持有這張卡</label><a href="'+escapeHtml(card.source)+'" target="_blank" rel="noopener noreferrer">查看官方條款 ↗</a><a href="'+escapeHtml(card.application)+'" target="_blank" rel="noopener noreferrer">申辦資訊 ↗</a></div><details class="bonus-box"><summary>個人設定：年費、點數價值、已用加碼額度</summary><label>個人預估實付年費（元；免年費填0）<input type="number" min="0" placeholder="未確認" data-fee="'+escapeHtml(card.id)+'" value="'+escapeHtml(feeOverride)+'"></label><label>每 1 點換算新台幣<input type="number" min="0" step=".01" data-point="'+escapeHtml(card.id)+'" value="'+escapeHtml(pointValue)+'"></label>'+rules.map(rule=>'<label>'+escapeHtml(rule.label)+' 已用點數（'+escapeHtml(rule.period==="statement"?"帳單週期":"每月")+'，上限 '+fmt(rule.cap)+'）<input type="number" min="0" step="1" data-used="'+escapeHtml(capGroup(card,rule))+'" value="'+escapeHtml(settings.used[capGroup(card,rule)]??0)+'"></label>').join('')+'<p>若多項回饋共用上限，請以實際官方條款核對。請手動在新計費週期歸零。</p></details><p class="subtle">查核日：'+escapeHtml(card.verified||"待查核")+' · '+escapeHtml(card.gift||"未登錄首刷禮")+'</p></article>';
}
function renderCards(){
 const q=$("#search").value.trim().toLowerCase(),bank=$("#bank-filter").value,ownedOnly=$("#owned-filter").checked;
 const filtered=catalog.filter(c=>(bank==="all"||c.bank===bank)&&(!ownedOnly||settings.owned.includes(c.id))&&((c.bank+c.name).toLowerCase().includes(q)));
 $("#card-grid").innerHTML=filtered.length?filtered.map(renderCard).join(""):'<div class="empty">沒有找到信用卡</div>';
}

const matrixCategories=["linepay","jkopay","applepay","shopee","momo","convenience","overseas","dining"];
function renderMatrix(){
 const target=$("#channel-matrix");if(!target)return;
 const bank=$("#channel-bank").value,filter=$("#channel-filter").value,owned=$("#channel-owned").checked;
 const keys=filter==="all"?matrixCategories:[filter];
 const cards=catalog.filter(c=>(bank==="all"||c.bank===bank)&&(!owned||settings.owned.includes(c.id)));
 const head=keys.map(k=>'<th>'+escapeHtml(categories[k])+'</th>').join("");
 const rows=cards.map(c=>'<tr><th><strong>'+escapeHtml(c.name)+'</strong><small>'+escapeHtml(c.bank)+'</small></th>'+keys.map(k=>{
 const fact=(c.channelFacts||[]).find(x=>x.category===k);
 if(!fact)return '<td><span class="matrix-unknown">待查核</span></td>';
 return '<td><details class="matrix-detail"><summary><strong>'+escapeHtml(fact.rate)+'</strong><small>'+escapeHtml(fact.status)+'</small></summary><div class="matrix-info"><p>'+escapeHtml(fact.criteria)+'</p><p><b>上限：</b>'+escapeHtml(fact.limit)+'</p><a href="'+escapeHtml(fact.source||c.source)+'" target="_blank" rel="noopener noreferrer">官方條款 ↗</a></div></details></td>';
 }).join("")+'</tr>').join("");
 target.innerHTML=cards.length?'<table class="matrix-table"><thead><tr><th>銀行／卡片</th>'+head+'</tr></thead><tbody>'+rows+'</tbody></table>':'<div class="empty">無符合條件的信用卡</div>';
}

function renderAlerts(){
 const now=today();const out=[];
 for(const card of catalog){for(const r of card.rules||[]){if(!r.end)continue;const days=Math.ceil((new Date(r.end+"T12:00:00Z")-new Date(now+"T12:00:00Z"))/86400000);if(days<0||days<=45)out.push({card:card.name,label:r.label,end:r.end,days})}
 if(!card.verified)out.push({card:card.name,label:"基本回饋仍待核實",end:"",days:null});
 if(card.fee===null)out.push({card:card.name,label:"申辦／年費資料未核實",end:"",days:null})}
 out.sort((a,b)=>(a.days??999)-(b.days??999));
 $("#alerts-list").innerHTML=out.length?out.slice(0,35).map(a=>'<div class="alert"><span>'+escapeHtml(a.card)+' · '+escapeHtml(a.label)+'</span><b>'+(a.days===null?"待核實":a.days<0?"已到期":a.days===0?"今天到期":a.days+" 天後到期（"+a.end+"）")+'</b></div>').join(''):'<div class="empty">目前沒有 45 天內到期的已知優惠；仍請留意官方更新。</div>';
}
function bind(){
 $("#calculate").addEventListener("click",renderResults);
 ["amount","category","merchant","date","annual-spend","fx-fee","scope"].forEach(id=>$("#"+id).addEventListener("change",renderResults));
 ["search","bank-filter","owned-filter"].forEach(id=>$("#"+id).addEventListener("input",renderCards));
 ["channel-filter","channel-bank","channel-owned"].forEach(id=>$("#"+id).addEventListener("change",renderMatrix));
 $("#card-grid").addEventListener("change",e=>{let t=e.target;if(t.dataset.owned){settings.owned=t.checked?[...new Set([...settings.owned,t.dataset.owned])]:settings.owned.filter(x=>x!==t.dataset.owned)}
 if(t.dataset.fee){settings.fee[t.dataset.fee]=t.value}
 if(t.dataset.point){settings.pointValue[t.dataset.point]=Number(t.value)}
 if(t.dataset.used){settings.used[t.dataset.used]=Math.max(0,Number(t.value)||0)}
 save();renderResults();renderMatrix()});
}
async function init(){
 $("#date").value=today();bind();
 try{const res=await fetch("./data/cards.json",{cache:"no-store"});if(!res.ok)throw new Error("HTTP "+res.status);const payload=await res.json();catalog=payload.cards||[];merchantPolicies=payload.merchantPolicies||{};
 $("#card-count").textContent=catalog.length+" 張卡片追蹤中";
 $("#verified-date").textContent="資料基準 "+payload.checkedAt;
 $("#channel-bank").innerHTML='<option value="all">全部銀行</option>'+[...new Set(catalog.map(c=>c.bank))].sort().map(x=>'<option value="'+escapeHtml(x)+'">'+escapeHtml(x)+'</option>').join("");
 $("#bank-filter").innerHTML='<option value="all">全部銀行</option>'+[...new Set(catalog.map(c=>c.bank))].sort().map(x=>'<option value="'+escapeHtml(x)+'">'+escapeHtml(x)+'</option>').join("");
 renderConditions();renderCards();renderMatrix();renderResults();renderAlerts();
 }catch(err){$("#results").innerHTML='<div class="empty">資料載入失敗：'+escapeHtml(err.message)+'。請檢查 data/cards.json 路徑與 GitHub Pages 部署。</div>'}
}
init();