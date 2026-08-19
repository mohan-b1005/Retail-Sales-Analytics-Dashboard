'use strict';

/* Source-of-truth workbook data. Every source row is embedded; no network requests are made. */
const SOURCE_DATA = window.SOURCE_DATA;
const BUILD_SUMMARY = {"salesRows":1000,"productRows":20,"customerRows":51,"dateRows":365,"currencyRows":5,"minDate":"2024-01-01","maxDate":"2024-12-30","missingProductLinks":0,"missingCustomerLinks":0,"missingCurrencyRates":0};
const DATA = SOURCE_DATA.Sales;
const REPORTING_CURRENCY = 'USD';

/* Currency rates are supplied by the workbook and centralized here for easy replacement. */
const CONFIGURED_RATES_TO_USD = Object.fromEntries((SOURCE_DATA.CurrencyRates || []).map(r => [String(r.Currency), Number(r.RateToUSD)]));

const PALETTE = ['#2f6bff','#0f9f91','#d58a00','#7b61c9','#d64545','#4c7a93','#7a9b34','#d46b2c'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthIndex = Object.fromEntries(MONTH_NAMES.map((m,i)=>[m,i+1]));

function toDateKey(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function parseDate(s){ if(!s) return null; const p=String(s).slice(0,10).split('-').map(Number); return p.length===3 ? new Date(p[0],p[1]-1,p[2]) : null; }
function quarterOf(d){ return 'Q'+(Math.floor(d.getMonth()/3)+1); }
function startOfMonth(d){ return new Date(d.getFullYear(),d.getMonth(),1); }
function startOfQuarter(d){ return new Date(d.getFullYear(),Math.floor(d.getMonth()/3)*3,1); }
function endOfQuarter(d){ return new Date(d.getFullYear(),Math.floor(d.getMonth()/3)*3+3,0); }
function startOfYear(d){ return new Date(d.getFullYear(),0,1); }
function addMonths(d,n){ return new Date(d.getFullYear(),d.getMonth()+n,d.getDate()); }
function daysBetween(a,b){ return Math.floor((b-a)/86400000); }
function esc(v){ return String(v==null?'':v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function safeNum(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
function uniq(arr){ return [...new Set(arr.filter(v=>v!==null&&v!==undefined&&v!==''))]; }
function sum(rows,fn){ return rows.reduce((a,r)=>a+safeNum(fn(r)),0); }
function distinctCount(rows,fn){ return new Set(rows.map(fn).filter(v=>v!==null&&v!==undefined&&v!=='')).size; }
function groupBy(rows,fn){ const m=new Map(); rows.forEach(r=>{const k=fn(r); if(!m.has(k))m.set(k,[]); m.get(k).push(r)}); return m; }
function fmtMoney(v){ return (v===null||v===undefined||!Number.isFinite(Number(v)))?'N/A':new Intl.NumberFormat('en-US',{style:'currency',currency:REPORTING_CURRENCY,maximumFractionDigits:0}).format(Number(v)); }
function fmtNum(v,d=0){ return (v===null||v===undefined||!Number.isFinite(Number(v)))?'N/A':new Intl.NumberFormat('en-US',{maximumFractionDigits:d,minimumFractionDigits:d}).format(Number(v)); }
function fmtPct(v){ return (v===null||v===undefined||!Number.isFinite(Number(v)))?'N/A':(Number(v)*100).toFixed(1)+'%'; }
function maxDate(rows){ let m=null; rows.forEach(r=>{if(r.date && (!m || r.date>m))m=r.date}); return m; }
function inRange(d,a,b){ return !!d && d>=a && d<=b; }
function setText(id,v){ const el=document.getElementById(id); if(el)el.textContent=v; }

/* BI-style normalization layer. Sales is not stored directly, so Total Sales is Quantity × UnitPrice × supplied RateToUSD. */
const productMap = new Map((SOURCE_DATA.Products||[]).map(r=>[String(r.ProductID),r]));
const customerMap = new Map((SOURCE_DATA.Customers||[]).map(r=>[String(r.CustomerID),r]));
const dateMap = new Map((SOURCE_DATA.Date||[]).map(r=>[String(r.Date),r]));

const MODEL = (DATA||[]).map((s,idx)=>{
  const d=parseDate(s.Date), p=productMap.get(String(s.ProductID))||{}, c=customerMap.get(String(s.CustomerID))||{}, dm=dateMap.get(String(s.Date))||{};
  const qty=safeNum(s.Quantity), unit=safeNum(s.UnitPrice), rate=CONFIGURED_RATES_TO_USD[String(s.Currency)];
  const validRate=Number.isFinite(Number(rate));
  return {
    rowIndex:idx, salesId:s.SalesID, date:d, dateKey:s.Date, customerId:s.CustomerID, customerName:c.CustomerName||('Customer '+s.CustomerID),
    productId:s.ProductID, productName:p.ProductName||('Product '+s.ProductID), category:p.Category||'N/A', subCategory:p.SubCategory||'N/A',
    region:c.Region||'N/A', loyalty:c.LoyaltyStatus||'N/A', quantity:qty, unitPrice:unit, currency:String(s.Currency||''), rateToUSD:validRate?Number(rate):null,
    rawSales:qty*unit, salesUSD:validRate?qty*unit*Number(rate):null,
    year:d?d.getFullYear():(dm.Year||null), monthNum:d?(d.getMonth()+1):(monthIndex[dm.Month]||null), monthName:d?MONTH_NAMES[d.getMonth()]:(dm.Month||'N/A'),
    quarter:d?quarterOf(d):(dm.Quarter||'N/A')
  };
}).filter(r=>r.date);

const state={year:'All',quarter:'All',month:'All',category:'All',region:'All',loyalty:'All',period:'All'};
const sortState={category:{key:'sales',dir:'desc'},txn:{key:'sales',dir:'desc'}};

function matchesNonDate(r){
  return (state.category==='All'||r.category===state.category) && (state.region==='All'||r.region===state.region) && (state.loyalty==='All'||r.loyalty===state.loyalty);
}
function matchesDateDimensions(r){
  return (state.year==='All'||String(r.year)===state.year) && (state.quarter==='All'||r.quarter===state.quarter) && (state.month==='All'||r.monthName===state.month);
}
function dimensionalRows(){ return MODEL.filter(r=>matchesNonDate(r)&&matchesDateDimensions(r)); }
function nonDateRows(){ return MODEL.filter(matchesNonDate); }
function periodBounds(period,ref){
  if(!ref||period==='All')return null;
  if(period==='MTD')return [startOfMonth(ref),ref];
  if(period==='QTD')return [startOfQuarter(ref),ref];
  if(period==='YTD')return [startOfYear(ref),ref];
  return null;
}
function currentRows(){
  const base=dimensionalRows(), ref=maxDate(base), b=periodBounds(state.period,ref);
  return b?base.filter(r=>inRange(r.date,b[0],b[1])):base;
}
function rowsForNamedPeriod(base,period,ref){ const b=periodBounds(period,ref); return b?base.filter(r=>inRange(r.date,b[0],b[1])):base; }

/* Measure definitions:
   Total Sales = sum(salesUSD); Orders = distinct SalesID; Quantity = sum(quantity); AOV = Sales / Orders.
   Customers = distinct CustomerID; Active Customers = customers with ≥1 transaction in current filtered period.
   Basket Diversity = average distinct categories per customer.
   MTD/QTD/YTD anchor to latest date in dimensional filter context.
   QoQ compares current quarter-to-date with the same elapsed-day window in the previous quarter.
   Last 3 Months = sales across the three latest calendar months represented in the current filtered rows.
*/
function sales(rows){ return sum(rows,r=>r.salesUSD===null?0:r.salesUSD); }
function orders(rows){ return distinctCount(rows,r=>r.salesId); }
function quantity(rows){ return sum(rows,r=>r.quantity); }
function aov(rows){ const o=orders(rows); return o?sales(rows)/o:null; }
function customers(rows){ return distinctCount(rows,r=>r.customerId); }
function basketDiversity(rows){
  if(!rows.length)return null;
  const byCust=groupBy(rows,r=>r.customerId); let total=0,n=0;
  byCust.forEach(rs=>{ total+=distinctCount(rs,r=>r.category); n++; }); return n?total/n:null;
}
function qoq(){
  const dim=dimensionalRows(), ref=maxDate(dim); if(!ref)return null;
  const universe=nonDateRows();
  const curStart=startOfQuarter(ref), elapsed=daysBetween(curStart,ref);
  const prevRefBase=new Date(curStart.getFullYear(),curStart.getMonth()-3,1), prevEnd=endOfQuarter(prevRefBase);
  const prevComparable=new Date(prevRefBase.getFullYear(),prevRefBase.getMonth(),prevRefBase.getDate()+elapsed);
  const prevRef=prevComparable>prevEnd?prevEnd:prevComparable;
  const cur=sales(universe.filter(r=>inRange(r.date,curStart,ref)));
  const prev=sales(universe.filter(r=>inRange(r.date,prevRefBase,prevRef)));
  return prev>0?(cur-prev)/prev:null;
}
function last3MonthsSales(rows){
  const months=uniq(rows.map(r=>r.year+'-'+String(r.monthNum).padStart(2,'0'))).sort().slice(-3);
  const set=new Set(months); return sales(rows.filter(r=>set.has(r.year+'-'+String(r.monthNum).padStart(2,'0'))));
}
function monthComparison(){
  const dim=dimensionalRows(), ref=maxDate(dim); if(!ref)return null;
  const universe=nonDateRows(), curStart=startOfMonth(ref), prevStart=new Date(curStart.getFullYear(),curStart.getMonth()-1,1), prevEnd=new Date(curStart.getFullYear(),curStart.getMonth(),0);
  const cur=sales(universe.filter(r=>inRange(r.date,curStart,ref)));
  const elapsed=daysBetween(curStart,ref), prevComparable=new Date(prevStart.getFullYear(),prevStart.getMonth(),prevStart.getDate()+elapsed), pEnd=prevComparable>prevEnd?prevEnd:prevComparable;
  const prev=sales(universe.filter(r=>inRange(r.date,prevStart,pEnd)));
  return {ref,cur,prev,change:prev>0?(cur-prev)/prev:null,curLabel:MONTH_NAMES[ref.getMonth()],prevLabel:MONTH_NAMES[prevStart.getMonth()]};
}

function fillSelect(id,values,formatter=v=>v){ const el=document.getElementById(id); el.innerHTML='<option value="All">All</option>'+values.map(v=>'<option value="'+esc(v)+'">'+esc(formatter(v))+'</option>').join(''); }
function initFilters(){
  fillSelect('yearFilter',uniq(MODEL.map(r=>String(r.year))).sort());
  fillSelect('quarterFilter',uniq(MODEL.map(r=>r.quarter)).sort());
  fillSelect('monthFilter',uniq(MODEL.map(r=>r.monthName)).sort((a,b)=>monthIndex[a]-monthIndex[b]));
  const cats=uniq(MODEL.map(r=>r.category)).sort(), regs=uniq(MODEL.map(r=>r.region)).sort(), loy=uniq(MODEL.map(r=>r.loyalty)).sort();
  fillSelect('categoryFilter',cats); fillSelect('customerCategoryFilter',cats); fillSelect('regionFilter',regs); fillSelect('loyaltyFilter',loy);
}
function readFilters(){
  state.year=document.getElementById('yearFilter').value; state.quarter=document.getElementById('quarterFilter').value; state.month=document.getElementById('monthFilter').value;
  state.category=document.getElementById('categoryFilter').value; state.region=document.getElementById('regionFilter').value; state.loyalty=document.getElementById('loyaltyFilter').value; state.period=document.getElementById('periodFilter').value;
}
function setPeriod(p){ state.period=p; document.getElementById('periodFilter').value=p; document.querySelectorAll('[data-period]').forEach(b=>b.classList.toggle('active',b.dataset.period===p)); renderAll(); }
function resetFilters(){ ['yearFilter','quarterFilter','monthFilter','categoryFilter','regionFilter','loyaltyFilter','periodFilter','customerCategoryFilter'].forEach(id=>{const e=document.getElementById(id); if(e)e.value='All'}); Object.keys(state).forEach(k=>state[k]='All'); document.querySelectorAll('[data-period]').forEach(b=>b.classList.toggle('active',b.dataset.period==='All')); renderAll(); }

function renderQuality(){
  const missingSalesRate=MODEL.filter(r=>r.rateToUSD===null).length;
  const ref=maxDate(MODEL), min=MODEL.reduce((m,r)=>(!m||r.date<m)?r.date:m,null);
  setText('subtitle',(min?toDateKey(min):'N/A')+' to '+(ref?toDateKey(ref):'N/A')+' · '+fmtNum(MODEL.length)+' transactions embedded from Retail_Sales_Dataset.xlsx');
  const notes=[];
  notes.push('Data quality: '+fmtNum(BUILD_SUMMARY.salesRows)+' sales rows embedded');
  notes.push(BUILD_SUMMARY.missingProductLinks===0?'all product links mapped':BUILD_SUMMARY.missingProductLinks+' product links missing');
  notes.push(BUILD_SUMMARY.missingCustomerLinks===0?'all customer links mapped':BUILD_SUMMARY.missingCustomerLinks+' customer links missing');
  notes.push(missingSalesRate===0?'all currencies have supplied USD rates':missingSalesRate+' sales rows have no currency rate and are excluded from revenue totals');
  notes.push('Revenue derived from Quantity × UnitPrice because no separate Sales column exists');
  setText('qualityNote',notes.join(' · '));
}
