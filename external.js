"use strict";
(() => {
 const el=id=>document.getElementById(id);
 const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const types={cards:"信用卡",promos:"優惠活動",wallets:"支付工具",fee_rules:"年費規則",today:"當日推薦資料",issuers:"發卡銀行"};
 let data=null;
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
   }catch(err){
     el("external-status").textContent="外部 API 的第一份有效快取尚未發布："+err.message+"。GitHub Actions 會自動同步；在完成前，既有核實資料照常使用。";
     el("external-list").innerHTML='<div class="empty">避免顯示空白或編造回饋，外部來源同步成功前不會將其資料納入比較。<a href="https://github.com/smartleo123/Credit-Card-Advisor/actions" target="_blank" rel="noopener noreferrer">查看同步工作流程 ↗</a></div>';
   }
 }
 el("external-type")?.addEventListener("change",render);
 el("external-search")?.addEventListener("input",render);
 init();
})();
