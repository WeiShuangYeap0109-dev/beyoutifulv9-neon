/* V10.5: package contract price and actual receipts are separate. */
(function () {
  'use strict';
  let saving = false;
  const clone = x => JSON.parse(JSON.stringify(x));
  const uid = prefix => prefix + crypto.randomUUID();
  function cents(value) {
    if (value === '' || value == null || !Number.isFinite(Number(value))) throw Error('请输入有效金额');
    const scaled=Number(value)*100, rounded=Math.round(scaled);
    if (rounded<0 || !Number.isSafeInteger(rounded) || Math.abs(scaled-rounded)>0.00001) throw Error('金额必须为非负数，最多两位小数');
    return rounded;
  }
  function receipts(p, state=data) {
    return state.orders.filter(o=>o.packageId===p.id && ['package_initial','package_balance'].includes(o.paymentKind));
  }
  function totals(p, state=data) {
    const total=cents(p.price||0);
    const paid=p.paymentTracking===1?receipts(p,state).reduce((n,o)=>n+cents(o.amount),0):total;
    return {total:total/100,paid:paid/100,due:Math.max(0,total-paid)/100};
  }
  // Compare-and-swap: never overwrite another device's changes with a stale form.
  async function commit(next, expected) {
    if (syncing) throw Error('系统正在保存，请稍后再试');
    const body=JSON.stringify({expectedData:expected,backupData:next});
    if(new Blob([body]).size>4*1024*1024) throw Error('资料较大，请联系维护人员处理');
    syncing=true;
    try {
      const r=await fetch(API,{method:'PUT',headers:{'Content-Type':'application/json','X-Beyoutiful-State-Update':'1'},body});
      if(r.status===409) throw Error('资料已被其他设备更新，请刷新后重新操作');
      if(!r.ok) throw Error('保存未确认成功，请刷新核对订单后再操作');
      data=next;
    } finally {syncing=false;}
  }
  // The app normalizes old records on load; fetch an authoritative baseline and
  // require the local collections to match after the same harmless normalization.
  async function baseline() {
    const r=await fetch(API,{cache:'no-store'});if(!r.ok) throw Error('无法读取最新资料');
    if(r.headers.get('X-Beyoutiful-State-Protocol')!=='1') throw Error('后台更新尚未完成，请等待部署完成后刷新');
    const raw=await r.json(),normalized=clone(raw);
    for(const k of ['customers','appointments','orders','packages','usage','services','commissions','packageTransactions','leads']) if(!Array.isArray(normalized[k])) normalized[k]=[];
    normalized.nextCustomer=Number(normalized.nextCustomer||1);
    normalized.customers.forEach(c=>{c.birthday??='';c.remark??='';});
    normalized.appointments.forEach(a=>{a.endTime??=calcEndTime(a.time,service(a.service).duration||90);a.remark??='';});
    normalized.orders.forEach(o=>{o.discount=Number(o.discount||0);o.originalAmount=o.originalAmount===undefined?Number(o.amount||0)+o.discount:Number(o.originalAmount||0);});
    const local=clone(data);for(const k of ['leads','commissions','packageTransactions']) if(!Array.isArray(local[k]))local[k]=[];
    // Recursively stable ordering avoids depending on JSONB key ordering.
    function stable(x){if(Array.isArray(x))return x.map(stable);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])]));return x;}
    if(JSON.stringify(stable(local))!==JSON.stringify(stable(normalized))) throw Error('资料已有变化或仍在加载，请刷新后重新操作');
    return raw;
  }
  const oldRefresh=window.refreshOrder;
  window.refreshOrder=function(){
    const result=oldRefresh.apply(this,arguments);
    if(billingType()==='package_buy' && $('pPrice') && !$('pPaidToday')) {
      $('packageSummary').insertAdjacentHTML('beforebegin',`<div class="field"><label>今天实收 / Deposit（留空表示付清）</label><input id="pPaidToday" type="number" min="0" step="0.01" placeholder="留空 = 配套总价" oninput="refreshPackagePaymentSummary()"></div><div id="packagePaymentSummary" class="summary"></div>`);
      window.refreshPackagePaymentSummary();
    }
    return result;
  };
  window.refreshPackagePaymentSummary=function(){
    const box=$('packagePaymentSummary');if(!box)return;
    try {const total=cents($('pPrice').value||0),raw=$('pPaidToday').value,paid=raw===''?total:cents(raw);if(paid>total)throw Error('今天实收不能超过配套总价');
      box.innerHTML=`<div><span>今天实收</span><b>${money(paid/100)}</b></div><div><span>尚欠尾款</span><b>${money((total-paid)/100)}</b></div>`;
    }catch(e){box.textContent=e.message;}
  };
  const oldSummary=window.refreshPackageSummary;
  window.refreshPackageSummary=function(){const result=oldSummary.apply(this,arguments);window.refreshPackagePaymentSummary();return result;};
  const oldComplete=window.completeOrder;
  window.completeOrder=async function(e){
    if(billingType()!=='package_buy')return oldComplete.apply(this,arguments);
    e.preventDefault();if(!currentUser || saving)return;
    saving=true;
    try {
      const customer=data.customers.find(c=>c.id===$('oCustomer').value),items=getOrderItems();
      if(!customer || items.length!==1)throw Error('请选择顾客和一个配套项目');
      const item=items[0],s=service(item.service),price=cents($('pPrice').value),raw=$('pPaidToday').value,paid=raw===''?price:cents(raw);
      if(paid>price)throw Error('今天实收不能超过配套总价');
      const type=$('pType').value,now=localDate(),pid=uid('P'),oid=uid('O');
      const p={id:pid,customerId:customer.id,customerName:customer.name,service:item.service,price:price/100,packageType:type,times:0,used:0,purchasedAt:now,expiredAt:(type==='value'?$('pExpiryValue'):$('pExpiry'))?.value||'',source:'purchase',paymentTracking:1};
      if(type==='value') {
        const buy=cents($('pValue').value||0),bonus=cents($('pBonusValue').value||0),total=$('pTotalValue').value===''?buy+bonus:cents($('pTotalValue').value);
        if(total<=0)throw Error('请输入有效 Total PKG Value');
        Object.assign(p,{service:'Any Service',originalTotal:0,buyValue:buy/100,bonusValue:bonus/100,totalValue:total/100,valueBalance:total/100});
      }else {
        const times=Number($('pTimes').value);if(!Number.isSafeInteger(times)||times<1)throw Error('购买次数必须为正整数');
        Object.assign(p,{times,originalTotal:Number(s.price)*times});
      }
      const order={id:oid,date:now,customerId:customer.id,customerName:customer.name,service:item.service,billing:'购买配套',originalAmount:paid/100,discount:0,amount:paid/100,payment:$('oPayment').value,paymentBy:$('oPaymentBy')?.value||'',staff:item.staff,items:[{service:item.service,staff:item.staff,amount:paid/100}],packageId:pid,remark:$('oRemark').value.trim(),paymentKind:'package_initial',packagePrice:price/100,paidAfter:paid/100,balanceAfter:(price-paid)/100};
      const expected=await baseline(),next=clone(data);next.packages.push(p);next.orders.push(order);
      if(item.staff)next.commissions.push({id:uid('C'),orderId:oid,customerId:customer.id,staff:item.staff,service:item.service,amount:0,date:now,type:'Package Sale'});
      next.packageTransactions.push({id:uid('PT'),orderId:oid,packageId:pid,customerId:customer.id,customerName:customer.name,service:item.service,type:'Purchase',timesChange:p.times,valueChange:type==='value'?p.totalValue:0,staff:item.staff,date:now});
      await commit(next,expected);closeModal();render();toast(`配套已保存 · 实收 ${money(paid/100)} · 尚欠 ${money((price-paid)/100)}`);
    }catch(e){toast(e.message);}finally{saving=false;}
  };
  function paymentCard(p){const t=totals(p);return `<div class="row" style="flex-wrap:wrap"><div><b>${esc(p.service)}</b><div>总价 ${money(t.total)} · 已收 ${money(t.paid)} · <b>尚欠 ${money(t.due)}</b></div></div><button class="btn" onclick="openPackagePayment('${esc(p.id)}')">付款记录${t.due>0?' / 收尾款':''}</button></div>`;}
  const oldCustomer=window.openCustomerDetail;
  window.openCustomerDetail=function(id){const result=oldCustomer.apply(this,arguments);const ps=data.packages.filter(p=>p.customerId===id&&p.paymentTracking===1);if(ps.length)$('modalBody').insertAdjacentHTML('beforeend','<div class="section"><h3>配套付款</h3>'+ps.map(paymentCard).join('')+'</div>');return result;};
  const oldPackages=window.packagesView;
  window.packagesView=function(){
    // Preserve legacy display; tracked records have a dedicated payment card,
    // including fully used packages with money still outstanding.
    const ps=data.packages.filter(p=>p.paymentTracking===1);
    let html=oldPackages.apply(this,arguments);
    if(ps.length)html='<div class="card"><h3>配套付款 / Package Payments</h3>'+ps.map(p=>`<div><b>${esc(p.customerName)}</b>${paymentCard(p)}</div>`).join('')+'</div>'+html;
    return html;
  };
  window.packagePaymentTotals=totals;
  window.openPackagePayment=function(id){
    if(!currentUser)return;const p=data.packages.find(p=>p.id===id&&p.paymentTracking===1);if(!p)return toast('找不到配套付款记录');
    const t=totals(p),rows=receipts(p).map(o=>`<div class="row"><div>${esc(o.date)} · ${o.paymentKind==='package_initial'?'首次付款':'补收尾款'}<div class="muted">${esc(o.payment)} · ${esc(o.paymentBy||'—')}</div></div><b>${money(o.amount)}</b>${currentUser.key==='belle'?`<button class="btn" onclick="printReceipt('${esc(o.id)}')">Receipt</button>`:''}</div>`).join('');
    openModal('配套付款 · '+p.customerName,`<div class="summary"><div><span>项目</span><b>${esc(p.service)}</b></div><div><span>配套总价</span><b>${money(t.total)}</b></div><div><span>累计实收</span><b>${money(t.paid)}</b></div><div><span>尚欠尾款</span><b>${money(t.due)}</b></div></div>${rows}${t.due>0?`<form class="form" onsubmit="receivePackagePayment(event,'${esc(id)}')"><div class="field"><label>本次收款金额</label><input id="tailAmount" type="number" min="0.01" max="${t.due}" step="0.01" value="${t.due}" required></div><div class="field"><label>Payment</label><select id="tailMethod"><option>Cash</option><option>TNG</option><option>Bank Transfer</option><option>Other</option></select></div><div class="field"><label>Payment By</label><select id="tailBy">${(currentUser.role==='owner'?STAFF:[currentUser.name]).map(s=>`<option>${esc(s)}</option>`).join('')}</select></div><div class="field"><label>备注</label><input id="tailRemark"></div><button class="btn dark">保存本次收款</button></form>`:'<p><b>已付清</b></p>'}`);
  };
  window.receivePackagePayment=async function(e,id){
    e.preventDefault();if(!currentUser||saving)return;saving=true;
    try{
      const p=data.packages.find(p=>p.id===id&&p.paymentTracking===1);if(!p)throw Error('找不到配套');
      const t=totals(p),amount=cents($('tailAmount').value);if(amount<=0||amount>cents(t.due))throw Error('收款须大于 0，且不能超过尚欠尾款');
      const order={id:uid('O'),date:localDate(),customerId:p.customerId,customerName:p.customerName,service:p.service,billing:'Payment Balance',paymentKind:'package_balance',packageId:id,originalAmount:amount/100,discount:0,amount:amount/100,payment:$('tailMethod').value,paymentBy:$('tailBy').value,staff:'',items:[],remark:$('tailRemark').value.trim(),packagePrice:t.total,paidAfter:(cents(t.paid)+amount)/100,balanceAfter:(cents(t.due)-amount)/100};
      const expected=await baseline(),next=clone(data);next.orders.push(order);
      await commit(next,expected);render();window.openPackagePayment(id);toast('尾款已记录 · 尚欠 '+money(order.balanceAfter));
    }catch(e){toast(e.message);}finally{saving=false;}
  };
  const oldDelete=window.deleteOrder;
  window.deleteOrder=async function(id){
    const o=data.orders.find(o=>o.id===id);if(!o?.paymentKind)return oldDelete.apply(this,arguments);
    if(currentUser?.key!=='belle'||saving)return;
    if(!confirm('删除此付款记录？实收金额和欠款会同步重新计算。'))return;
    saving=true;
    try{
      const expected=await baseline(),next=clone(data);
      if(o.paymentKind==='package_initial'){
        if(next.orders.some(x=>x.id!==id&&x.packageId===o.packageId&&x.paymentKind==='package_balance'))throw Error('已有尾款记录，请先处理尾款记录');
        if(next.usage.some(u=>u.packageId===o.packageId||u.packageAllocations?.some(a=>a.packageId===o.packageId)))throw Error('配套已有使用记录，不能删除购买记录');
        next.packages=next.packages.filter(p=>p.id!==o.packageId);
      }
      next.orders=next.orders.filter(x=>x.id!==id);next.commissions=next.commissions.filter(x=>x.orderId!==id);next.packageTransactions=next.packageTransactions.filter(x=>x.orderId!==id);
      await commit(next,expected);closeModal();render();toast('记录已删除，实收及欠款已更新');
    }catch(e){toast(e.message);}finally{saving=false;}
  };
  const oldReceipt=window.printReceipt;
  window.printReceipt=function(id){
    const o=data.orders.find(o=>o.id===id);if(!o?.paymentKind)return oldReceipt.apply(this,arguments);
    const p=data.packages.find(p=>p.id===o.packageId);if(!p)return toast('找不到配套');
    const t=totals(p),win=window.open('','_blank');if(!win)return toast('请允许弹出窗口');
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt ${esc(o.id)}</title><style>body{font:16px Arial,sans-serif;max-width:650px;margin:30px auto;padding:20px}td{padding:12px;border-bottom:1px solid #ddd}table{width:100%}@media print{button{display:none}}</style></head><body><h2>BEYOUTIFUL STUDIO & ACADEMY</h2><p>收款收据 / Payment Receipt</p><p>${esc(o.customerName)}<br>${esc(o.date)}<br>${esc(o.id)}</p><p>${esc(p.service)} · ${p.packageType==='times'?p.times+' 次':'Value 配套'}</p><table><tr><td>配套总价</td><td>${money(p.price)}</td></tr><tr><td>本次实收</td><td><b>${money(o.amount)}</b></td></tr><tr><td>当前累计实收</td><td>${money(t.paid)}</td></tr><tr><td>当前尚欠尾款</td><td>${money(t.due)}</td></tr></table><p>Payment: ${esc(o.payment)} · ${esc(o.paymentBy)}</p><p>${esc(o.remark||'')}</p><p>累计实收和尾款以本次打印时的记录为准。</p><button onclick="window.print()">Print / Save PDF</button></body></html>`);win.document.close();
  };
})();
