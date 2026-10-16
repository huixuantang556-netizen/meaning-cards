/* Pure calendar logic. Local dates intentionally follow the device timezone. */
(function(root){
'use strict';
const date=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
const clock=n=>`${String(Math.floor(n/60)%24).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
const shift=(day,n)=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return date(d);};
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&date(new Date(s+'T12:00:00'))===s;
const time=s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
function valid(x){
 if(!x||x.v!==3||JSON.stringify(x).length>1200)return false;
 if(x.kind==='settings')return ['wake','wind','bed'].every(k=>time(x[k]))&&x.wake!==x.wind;
 if(x.kind==='task')return typeof x.title==='string'&&x.title.trim().length>0&&x.title.length<=55&&['anchor','flex','play'].includes(x.type)&&time(x.time)&&Number.isInteger(x.duration)&&x.duration>0&&x.duration<=720&&['once','weekly'].includes(x.repeat)&&validDay(x.date)&&Array.isArray(x.days)&&x.days.every(d=>Number.isInteger(d)&&d>=0&&d<=6)&&(x.repeat==='once'||x.days.length>0)&&typeof x.card==='string';
 if(x.kind==='override')return typeof x.task==='string'&&validDay(x.day)&&['pending','done','skipped','deferred'].includes(x.status)&&(!x.time||time(x.time));
 if(x.kind==='timer')return typeof x.title==='string'&&x.title.length<=55&&Number.isFinite(x.start)&&Number.isFinite(x.end)&&x.end>x.start&&Number.isInteger(x.estimate)&&x.estimate>0&&x.estimate<=240;
 return false;
}
function occurrences(records,day){
 const overrides=records.filter(x=>x.kind==='override'&&x.day===day);
 return records.filter(x=>x.kind==='task'&&(x.repeat==='once'?x.date===day:(x.days||[]).includes(new Date(day+'T12:00:00').getDay()))).map(t=>{
 const o=overrides.find(x=>x.task===t.id);return {...t,...(o||{}),id:t.id,status:o?.status||'pending',time:o?.time||t.time};
 }).sort((a,b)=>minutes(a.time)-minutes(b.time));
}
function plan(items,start,limit,rest){
 let cursor=start+rest;const moves=[];
 for(const t of items.filter(x=>x.status==='pending')){
  if(t.type==='anchor')continue;
  // Move past every overlapping anchor, including adjacent fixed appointments.
  const anchors=items.filter(a=>a.type==='anchor'&&a.status==='pending').sort((a,b)=>minutes(a.time)-minutes(b.time));
  for(const a of anchors){const start=minutes(a.time),end=start+a.duration;if(cursor<end&&cursor+t.duration>start)cursor=end;}
  if(cursor+t.duration<=limit){moves.push({task:t.id,time:clock(cursor),status:'pending'});cursor+=t.duration;}
  else moves.push({task:t.id,status:'deferred'});
 }return moves;
}
const api={date,minutes,clock,shift,validDay,valid,occurrences,plan};
if(typeof module!=='undefined')module.exports=api;root.MeaningNav=api;
})(typeof window==='undefined'?globalThis:window);
