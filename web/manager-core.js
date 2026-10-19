/* Smart Life Manager v1: deterministic planning helpers; no DOM/storage/network. */
(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const empty=()=>({schemaVersion:1,revision:0,checks:[],tasks:[],reviews:[],prefs:{remindInterval:45,reviewTime:'20:30',notifications:false}});
const date=d=>{const x=d instanceof Date?d:new Date(d);return [x.getFullYear(),String(x.getMonth()+1).padStart(2,'0'),String(x.getDate()).padStart(2,'0')].join('-');};
const daypart=d=>{const h=(d instanceof Date?d:new Date(d)).getHours();return h>=5&&h<12?'morning':h>=12&&h<18?'afternoon':'evening';};
const dayName={morning:'上午',afternoon:'下午',evening:'晚上'};
const validText=(v,max)=>typeof v==='string'&&v.length<=max;
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&date(new Date(v+'T12:00:00'))===v;
const validClock=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const validAt=v=>typeof v==='string'&&v.length<=40&&Number.isFinite(Date.parse(v));
const isInt=(x,a,b)=>Number.isInteger(x)&&x>=a&&x<=b;
function validate(s){
 if(!s||s.schemaVersion!==1||!isInt(s.revision,0,100000000)||!Array.isArray(s.checks)||!Array.isArray(s.tasks)||!Array.isArray(s.reviews)||s.checks.length>1000||s.tasks.length>1000||s.reviews.length>400)throw Error('智慧管家记录版本不兼容或过多，请先备份');
 const p=s.prefs;if(!p||!isInt(p.remindInterval,0,240)||!validClock(p.reviewTime)||typeof p.notifications!=='boolean')throw Error('提醒设置不兼容');
 const ids=new Set();for(const [kind,arr] of [['check',s.checks],['task',s.tasks],['review',s.reviews]])for(const x of arr){
  if(!x||!validText(x.id,120)||!x.id||ids.has(x.id)||!validAt(x.at)||!validDate(x.date))throw Error('智慧管家记录编号、日期不正确');ids.add(x.id);
  if(kind==='check'&&(!['morning','afternoon','evening'].includes(x.phase)||!isInt(x.energy,1,5)||!validText(x.note,500)||!['home','outside','shared','other'].includes(x.context)))throw Error('精力记录不正确');
  if(kind==='task'&&(!validText(x.title,120)||!x.title.trim()||!isInt(x.minutes,5,360)||!['low','any','high'].includes(x.energy)||!['fixed','flex'].includes(x.type)||!['open','done','deferred'].includes(x.status)||!validText(x.time,5)||x.time&&!validClock(x.time)||x.type==='fixed'&&!x.time||!validText(x.compassId,150)||!validText(x.note,500)))throw Error('任务内容或时间不正确');
  if(kind==='review'&&(!validText(x.progress,2000)||!validText(x.obstacle,1200)||!validText(x.next,1000)||!validText(x.kindness,700)))throw Error('复盘内容过长或不兼容');
 }
 return s;
}
function insights(s,now=new Date()){
 validate(s);const cutoff=new Date(now);cutoff.setDate(cutoff.getDate()-30);
 const byDay=new Map();for(const c of s.checks){if(new Date(c.at)<cutoff||new Date(c.at)>now)continue;const k=c.date+'|'+c.phase;const old=byDay.get(k);if(!old||old.at<c.at)byDay.set(k,c);}
 const result={};for(const part of ['morning','afternoon','evening']){const rows=[...byDay.values()].filter(x=>x.phase===part);const avg=rows.length?rows.reduce((a,c)=>a+c.energy,0)/rows.length:null;result[part]={count:rows.length,average:avg===null?null:Math.round(avg*10)/10,confidence:rows.length>=7?'可初步参考':rows.length>=3?'样本较少':'尚不能判断'};}
 return result;
}
function suggestion(s,now=new Date(),compass=[]){
 validate(s);const today=date(now),part=daypart(now),ins=insights(s,now),cur=s.checks.filter(x=>x.date===today).sort((a,b)=>b.at.localeCompare(a.at))[0];
 const energy=cur?.energy??(ins[part].count>=3?Math.round(ins[part].average):null);
 const own=s.tasks.filter(t=>t.date===today&&t.status==='open');
 const fixed=own.filter(t=>t.type==='fixed').sort((a,b)=>a.time.localeCompare(b.time));
 const flex=own.filter(t=>t.type==='flex').sort((a,b)=>Number(a.energy==='high')-Number(b.energy==='high'));
 const choices=flex.slice().sort((a,b)=>{const fit=t=>energy===null?0:energy<=2?(t.energy==='low'?3:t.energy==='any'?2:0):energy>=4?(t.energy==='high'?3:t.energy==='any'?2:1):(t.energy==='any'?3:2);return fit(b)-fit(a)||a.minutes-b.minutes;});
 const advice=energy===null?'还没有足够的精力观察。先选择一件小事，做过再调整。':energy<=2?'现在精力偏低：可以先喝水、散步或休息，再尝试5分钟的轻任务。':energy>=4?'目前精神比较活跃：可以优先安排需要专注的工作，但不用把剩余时间排满。':'现在状态适中：适合从一件清晰、可完成的任务开始。';
 const slots=['morning','afternoon','evening'].filter(p=>ins[p].count>=3).sort((a,b)=>ins[b].average-ins[a].average);
 return {energy,part,advice,next:choices[0]||null,fixed,choices,slots,insight:ins,compass:compass.filter(x=>x&&x.status==='active'&&typeof x.title==='string').slice(0,30)};
}
function withRevision(s,change){validate(s);const n=clone(s);change(n);n.revision++;return validate(n);}
const api={empty,validate,clone,date,daypart,dayName,insights,suggestion,withRevision};root.MeaningManager=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
