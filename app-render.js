function contextText(rows){ const ref=maxDate(dimensionalRows()); return fmtNum(rows.length)+' transactions · '+(ref?'reference date '+toDateKey(ref):'no transactions')+' · period '+state.period; }

function renderKPIs(){
  const rows=currentRows(); setText('kpiSales',fmtMoney(sales(rows))); setText('kpiOrders',fmtNum(orders(rows))); setText('kpiQty',fmtNum(quantity(rows)));
  const q=qoq(), qel=document.getElementById('kpiQoQ'); qel.textContent=fmtPct(q); qel.classList.remove('positive','negative'); if(q!==null)qel.classList.add(q>=0?'positive':'negative');
  setText('kpiAov',fmtMoney(aov(rows))); setText('kpiL3M',fmtMoney(last3MonthsSales(rows))); setText('salesContext',contextText(rows));
  setText('custSales',fmtMoney(sales(rows))); setText('custTotal',fmtNum(customers(rows))); setText('custActive',fmtNum(customers(rows))); setText('custRegions',fmtNum(distinctCount(rows,r=>r.region))); setText('custDiversity',basketDiversity(rows)===null?'N/A':fmtNum(basketDiversity(rows),2)); setText('customerContext',contextText(rows));
}

function periodRowsByCategory(cat,period){ const base=dimensionalRows().filter(r=>cat==='All'||r.category===cat), ref=maxDate(dimensionalRows()); return ref?rowsForNamedPeriod(base,period,ref):[]; }
function buildCategoryRows(){
  const rows=currentRows(), cats=uniq(rows.map(r=>r.category)).sort(), total=sales(rows), ref=maxDate(dimensionalRows()), base=dimensionalRows();
  return cats.map(cat=>{const cr=rows.filter(r=>r.category===cat), cb=base.filter(r=>r.category===cat); return {category:cat,sales:sales(cr),share:total?sales(cr)/total:null,mtd:ref?sales(rowsForNamedPeriod(cb,'MTD',ref)):0,qtd:ref?sales(rowsForNamedPeriod(cb,'QTD',ref)):0,ytd:ref?sales(rowsForNamedPeriod(cb,'YTD',ref)):0};});
}
function sortRows(rows,stateObj){ const {key,dir}=stateObj; return rows.slice().sort((a,b)=>{const av=a[key],bv=b[key]; if(typeof av==='string')return av.localeCompare(bv)*(dir==='asc'?1:-1); return (safeNum(av)-safeNum(bv))*(dir==='asc'?1:-1);}); }
function renderCategoryTable(){ const tb=document.querySelector('#categoryTable tbody'), rows=sortRows(buildCategoryRows(),sortState.category); if(!rows.length){tb.innerHTML='<tr><td colspan="6" style="text-align:center;color:#98a2b3">No data for current filters</td></tr>';return;} tb.innerHTML=rows.map(r=>'<tr><td>'+esc(r.category)+'</td><td>'+fmtMoney(r.sales)+'</td><td>'+fmtPct(r.share)+'</td><td>'+fmtMoney(r.mtd)+'</td><td>'+fmtMoney(r.qtd)+'</td><td>'+fmtMoney(r.ytd)+'</td></tr>').join(''); }

function aggregate(rows,keyFn,valFn){ const m=new Map(); rows.forEach(r=>{const k=keyFn(r); m.set(k,(m.get(k)||0)+safeNum(valFn(r)))}); return [...m].map(([label,value])=>({label,value})); }
function renderDonut(id,data,centerLabel,centerValue,formatter=fmtMoney){
  const el=document.getElementById(id); const valid=data.filter(d=>d.value>0); const total=valid.reduce((a,d)=>a+d.value,0);
  if(!total){el.innerHTML='<div class="empty">No data for current filters</div>';return;}
  const r=66,c=2*Math.PI*r; let offset=0;
  const segs=valid.map((d,i)=>{const frac=d.value/total, dash=frac*c, html='<circle class="donut-seg" cx="100" cy="100" r="'+r+'" fill="none" stroke="'+PALETTE[i%PALETTE.length]+'" stroke-width="24" stroke-dasharray="'+dash+' '+(c-dash)+'" stroke-dashoffset="-'+offset+'" transform="rotate(-90 100 100)" data-tooltip="'+esc(d.label)+': '+esc(formatter(d.value))+' ('+fmtPct(frac)+')"></circle>'; offset+=dash; return html;}).join('');
  const legend=valid.map((d,i)=>'<div class="legend-row"><span class="dot" style="background:'+PALETTE[i%PALETTE.length]+'"></span><span>'+esc(d.label)+'</span><strong style="color:#344054">'+esc(formatter(d.value))+'</strong></div>').join('');
  el.innerHTML='<div class="donut-wrap"><svg viewBox="0 0 200 200" role="img" aria-label="'+esc(centerLabel)+'"><circle class="donut-bg" cx="100" cy="100" r="'+r+'" fill="none" stroke-width="24"></circle>'+segs+'<text x="100" y="94" text-anchor="middle" style="font-size:11px;fill:#667085">'+esc(centerLabel)+'</text><text x="100" y="116" text-anchor="middle" style="font-size:17px;font-weight:700;fill:#17365d">'+esc(centerValue)+'</text></svg><div class="legend">'+legend+'</div></div>';
}
function renderRegionalSales(){ const rows=currentRows(), d=aggregate(rows,r=>r.region,r=>r.salesUSD).sort((a,b)=>b.value-a.value); renderDonut('regionalSalesDonut',d,'Total Sales',fmtMoney(sales(rows)),fmtMoney); }

function renderMonthly(){
  const el=document.getElementById('monthlyChart'), rows=currentRows(); if(!rows.length){el.innerHTML='<div class="empty">No data for current filters</div>';return;}
  const g=groupBy(rows,r=>r.year+'-'+String(r.monthNum).padStart(2,'0')); const data=[...g].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,rs])=>({k,label:MONTH_NAMES[Number(k.slice(5))-1].slice(0,3)+' '+k.slice(2,4),sales:sales(rs),orders:orders(rs)}));
  const W=900,H=220,padL=52,padR=38,padT=18,padB=34, innerW=W-padL-padR, innerH=H-padT-padB, maxS=Math.max(...data.map(d=>d.sales),1), maxO=Math.max(...data.map(d=>d.orders),1), step=innerW/data.length, bw=Math.min(42,step*.58);
  let grid=''; for(let i=0;i<=4;i++){const y=padT+innerH*(i/4), val=maxS*(1-i/4); grid+='<line class="gridline" x1="'+padL+'" x2="'+(W-padR)+'" y1="'+y+'" y2="'+y+'"></line><text class="axis" x="'+(padL-7)+'" y="'+(y+3)+'" text-anchor="end">'+esc(compactMoney(val))+'</text>';}
  let bars='',labels='',pts=[]; data.forEach((d,i)=>{const x=padL+i*step+step/2, bh=(d.sales/maxS)*innerH, y=padT+innerH-bh, oy=padT+innerH-(d.orders/maxO)*innerH; bars+='<rect class="bar-sales" x="'+(x-bw/2)+'" y="'+y+'" width="'+bw+'" height="'+Math.max(1,bh)+'" rx="3" data-tooltip="'+esc(d.label)+'<br>Sales: '+esc(fmtMoney(d.sales))+'<br>Transactions: '+esc(fmtNum(d.orders))+'"></rect>'; labels+='<text class="axis" x="'+x+'" y="'+(H-11)+'" text-anchor="middle">'+esc(d.label)+'</text>'; pts.push([x,oy,d]); });
  const line=pts.map((p,i)=>(i?'L':'M')+p[0]+' '+p[1]).join(' '), circles=pts.map(p=>'<circle class="point-orders" cx="'+p[0]+'" cy="'+p[1]+'" r="3.5" data-tooltip="'+esc(p[2].label)+'<br>Transactions: '+esc(fmtNum(p[2].orders))+'<br>Sales: '+esc(fmtMoney(p[2].sales))+'"></circle>').join('');
  el.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+grid+bars+'<path class="line-orders" d="'+line+'"></path>'+circles+labels+'<text class="axis" x="'+(W-4)+'" y="12" text-anchor="end">■ Sales   ● Transactions</text></svg>';
}
function compactMoney(v){ const n=safeNum(v); if(Math.abs(n)>=1e6)return '$'+(n/1e6).toFixed(1)+'M'; if(Math.abs(n)>=1e3)return '$'+(n/1e3).toFixed(0)+'K'; return '$'+Math.round(n); }

function renderPeriodComparison(){ const el=document.getElementById('periodComparison'), c=monthComparison(); if(!c){el.innerHTML='<div class="empty">No period comparison available</div>';return;} const cls=c.change===null?'':(c.change>=0?'positive':'negative'); el.innerHTML='<div class="comparison"><div class="comp"><div class="cl">'+esc(c.curLabel)+' MTD</div><div class="cv">'+fmtMoney(c.cur)+'</div></div><div class="comp"><div class="cl">'+esc(c.prevLabel)+' comparable</div><div class="cv">'+fmtMoney(c.prev)+'</div></div><div class="comp"><div class="cl">Change</div><div class="cv '+cls+'">'+fmtPct(c.change)+'</div></div></div><div style="font-size:11px;color:#667085;line-height:1.55;margin-top:10px">Comparison uses the same elapsed-day window in the previous calendar month and preserves current non-date filters.</div>'; }

function renderRegionLoyalty(){
  const el=document.getElementById('regionLoyaltyBars'), rows=currentRows(); if(!rows.length){el.innerHTML='<div class="empty">No data for current filters</div>';return;}
  const loy=uniq(rows.map(r=>r.loyalty)).sort(), regions=uniq(rows.map(r=>r.region)).sort(); const totals=regions.map(reg=>({reg,total:sales(rows.filter(r=>r.region===reg))})).sort((a,b)=>b.total-a.total); const max=Math.max(...totals.map(x=>x.total),1);
  const html=totals.map(x=>{const rs=rows.filter(r=>r.region===x.reg); const seg=loy.map((l,i)=>{const v=sales(rs.filter(r=>r.loyalty===l)), pct=x.total?v/x.total:0; return '<div class="stack-seg" style="width:'+(pct*100)+'%;background:'+PALETTE[i%PALETTE.length]+'" data-tooltip="'+esc(x.reg)+' · '+esc(l)+': '+esc(fmtMoney(v))+'"></div>';}).join(''); return '<div class="stack-row"><div class="stack-label">'+esc(x.reg)+'</div><div class="stack" style="width:'+Math.max(12,x.total/max*100)+'%">'+seg+'</div><div class="stack-value">'+compactMoney(x.total)+'</div></div>';}).join('');
  const legend='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;font-size:10.5px;color:#667085">'+loy.map((l,i)=>'<span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:'+PALETTE[i%PALETTE.length]+';margin-right:4px"></i>'+esc(l)+'</span>').join('')+'</div>';
  el.innerHTML='<div class="stack-bars">'+html+'</div>'+legend;
}
function customerAgg(rows,metric){ const g=groupBy(rows,r=>r.customerId); return [...g].map(([id,rs])=>({id,name:rs[0].customerName,value:metric==='sales'?sales(rs):quantity(rs)})); }
function renderRank(id,metric,top){
  const el=document.getElementById(id), rows=currentRows(), arr=customerAgg(rows,metric).sort((a,b)=>top?b.value-a.value:a.value-b.value).slice(0,5); if(!arr.length){el.innerHTML='<div class="empty">No customer data</div>';return;}
  const max=Math.max(...arr.map(x=>x.value),1), fmt=metric==='sales'?fmtMoney:v=>fmtNum(v);
  el.innerHTML='<div class="rank-list">'+arr.map((x,i)=>'<div class="rank-row"><div class="rank-no">'+(i+1)+'</div><div class="rank-name" title="'+esc(x.name)+'">'+esc(x.name)+'</div><div class="bar-bg"><div class="bar-fill" style="width:'+(x.value/max*100)+'%"></div></div><div class="rank-val">'+fmt(x.value)+'</div></div>').join('')+'</div>';
}
function renderCustomerDonuts(){
  const rows=currentRows();
  const regions=uniq(rows.map(r=>r.region)).map(reg=>({label:reg,value:distinctCount(rows.filter(r=>r.region===reg),r=>r.customerId)})).sort((a,b)=>b.value-a.value);
  renderDonut('regionalCustomerDonut',regions,'Customers',fmtNum(customers(rows)),v=>fmtNum(v)); setText('regionalCustomerCount',fmtNum(customers(rows)));
  const loy=uniq(rows.map(r=>r.loyalty)).map(l=>({label:l,value:distinctCount(rows.filter(r=>r.loyalty===l),r=>r.customerId)})).sort((a,b)=>b.value-a.value); renderDonut('loyaltyDonut',loy,'Customers',fmtNum(customers(rows)),v=>fmtNum(v));
}
function buildTxnRows(){
  const rows=currentRows(), cats=uniq(rows.map(r=>r.category)).sort(), ref=maxDate(dimensionalRows()), base=dimensionalRows();
  return cats.map(cat=>{const cr=rows.filter(r=>r.category===cat), cb=base.filter(r=>r.category===cat);return {category:cat,orders:orders(cr),mtd:ref?sales(rowsForNamedPeriod(cb,'MTD',ref)):0,qtd:ref?sales(rowsForNamedPeriod(cb,'QTD',ref)):0,sales:sales(cr)};});
}
function renderTxnTable(){ const tb=document.querySelector('#txnTable tbody'), rows=sortRows(buildTxnRows(),sortState.txn); if(!rows.length){tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:#98a2b3">No data for current filters</td></tr>';return;} tb.innerHTML=rows.map(r=>'<tr><td>'+esc(r.category)+'</td><td>'+fmtNum(r.orders)+'</td><td>'+fmtMoney(r.mtd)+'</td><td>'+fmtMoney(r.qtd)+'</td><td>'+fmtMoney(r.sales)+'</td></tr>').join(''); }

function renderAll(){
  renderKPIs(); renderCategoryTable(); renderRegionalSales(); renderMonthly(); renderPeriodComparison(); renderRegionLoyalty(); renderRank('topSales','sales',true); renderRank('bottomSales','sales',false); renderRank('topQty','qty',true); renderRank('bottomQty','qty',false); renderCustomerDonuts(); renderTxnTable();
  document.querySelectorAll('[data-period]').forEach(b=>b.classList.toggle('active',b.dataset.period===state.period));
}

function bindEvents(){
  ['yearFilter','quarterFilter','monthFilter','categoryFilter','regionFilter','loyaltyFilter','periodFilter'].forEach(id=>document.getElementById(id).addEventListener('change',e=>{ readFilters(); document.getElementById('customerCategoryFilter').value=state.category; renderAll(); }));
  document.getElementById('customerCategoryFilter').addEventListener('change',e=>{state.category=e.target.value; document.getElementById('categoryFilter').value=state.category; renderAll();});
  document.getElementById('resetFilters').addEventListener('click',resetFilters); document.querySelectorAll('[data-period]').forEach(b=>b.addEventListener('click',()=>setPeriod(b.dataset.period)));
  document.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x===b)); document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===b.dataset.page));}));
  document.querySelectorAll('#categoryTable th[data-key]').forEach(th=>th.addEventListener('click',()=>{const s=sortState.category,k=th.dataset.key; s.dir=s.key===k&&s.dir==='desc'?'asc':'desc'; s.key=k; renderCategoryTable();}));
  document.querySelectorAll('#txnTable th[data-key]').forEach(th=>th.addEventListener('click',()=>{const s=sortState.txn,k=th.dataset.key; s.dir=s.key===k&&s.dir==='desc'?'asc':'desc'; s.key=k; renderTxnTable();}));
  const tip=document.getElementById('tooltip'); document.addEventListener('pointermove',e=>{const t=e.target.closest('[data-tooltip]'); if(!t){tip.classList.remove('show');return;} tip.innerHTML=t.getAttribute('data-tooltip'); tip.style.left=Math.min(window.innerWidth-245,e.clientX+14)+'px'; tip.style.top=Math.min(window.innerHeight-80,e.clientY+14)+'px'; tip.classList.add('show');}); document.addEventListener('pointerleave',()=>tip.classList.remove('show'));
}

initFilters(); bindEvents(); renderQuality(); renderAll();
