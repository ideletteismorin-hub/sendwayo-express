#!/usr/bin/env node
const fs=require('fs');
const data=JSON.parse(fs.readFileSync(0,'utf8'));
const root=data.sendwayo_express_v2||data||{};
const cols=['envios','recargas','paqueticos','pagos','paquetes'];
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const dayKey=v=>{
  if(v==null||v==='')return '';
  let n=Number(v);
  if(Number.isFinite(n)&&n>0){if(n<1e12)n*=1000;const d=new Date(n);if(!isNaN(d))return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
  const d=new Date(v);if(!isNaN(d))return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  return '';
};
const localToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const closeDate=process.env.CLOSE_DATE||localToday();
const approved=[],missingLedger=[];
for(const col of cols){
  const live=root[col]||{},ledger=(root.ledger&&root.ledger[col])||{};
  for(const [id,r] of Object.entries(live)){
    if(!r||String(r.status||'').toLowerCase()!=='aprobado')continue;
    const date=['reviewedAt','approvedAt','balanceSettledAt','createdAt','updatedAt','date','timestamp'].map(k=>dayKey(r[k])).find(Boolean)||'';
    if(date===closeDate){approved.push({col,id,r});if(!ledger[id])missingLedger.push(col+':'+id)}
  }
}
let gross=0,admin=0,remitter=0,amount=0;
const byCollection={};
for(const x of approved){
  const r=x.r,g=num(r.commissionTotal??r.commission??r.commissionAmount??r.fee);
  gross+=g;admin+=num(r.commissionAdmin??g*.5);remitter+=num(r.commissionUser??g*.5);amount+=num(r.amount);
  if(!byCollection[x.col])byCollection[x.col]={operations:0,amount:0,commission:0,adminCommission:0,remitterCommission:0};
  const b=byCollection[x.col];b.operations++;b.amount+=num(r.amount);b.commission+=g;b.adminCommission+=num(r.commissionAdmin??g*.5);b.remitterCommission+=num(r.commissionUser??g*.5);
}
const issues=missingLedger.map(x=>'OPERACION_SIN_LIBRO:'+x);
for(const [id,u] of Object.entries(root.users||{})){
  if(!u)continue;
  if(num(u.balance)<-0.009)issues.push('BALANCE_NEGATIVO:'+id);
  if(num(u.commission)<-0.009||num(u.commissionAccrued)<-0.009)issues.push('COMISION_NEGATIVA:'+id);
}
const report={closeDate,closedAt:new Date().toISOString(),timezone:'America/Santo_Domingo',closingHour:'22:00',status:issues.length?'REVISAR':'CERRADO',operationsApproved:approved.length,totalAmount:Number(amount.toFixed(2)),grossCommission:Number(gross.toFixed(2)),adminCommission:Number(admin.toFixed(2)),remitterCommission:Number(remitter.toFixed(2)),byCollection,issues};
process.stdout.write(JSON.stringify(report));
