/* Life Compass: deterministic, source-linked plan accounting. No network or storage. */
(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const statuses=['active','exploring','paused','achieved','retired'];
const empty=()=>({schemaVersion:1,revision:0,wishes:[],projects:[],actions:[],logs:[],revisions:[]});
const fail=message=>{throw Error(message);};
const text=(x,max=300)=>typeof x==='string'&&x.length<=max;
const number=x=>typeof x==='number'&&Number.isFinite(x);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const id=x=>text(x,150)&&!!x;
const time=x=>text(x,40)&&Number.isFinite(Date.parse(x));
const round=x=>Math.round((x+Number.EPSILON)*1e8)/1e8;
function definition(p,version=p.versions.length){return p.versions.find(v=>v.version===version);}
function rules(p,version){return definition(p,version)?.domains.flatMap(d=>d.rules.map(r=>({...r,domainId:d.id,domainTitle:d.title,weight:d.weight})))||[];}
function validateDefinition(v){
 if(!v||!Number.isSafeInteger(v.version)||v.version<1||!time(v.at)||!text(v.reason,500)||!Array.isArray(v.domains)||!v.domains.length||v.domains.length>20)fail('请填写 1～20 个学习领域');
 const domainIds=new Set(),ruleIds=new Set();let weights=0;
 for(const d of v.domains){if(!id(d.id)||domainIds.has(d.id)||!text(d.title,100)||!d.title.trim()||!number(d.weight)||d.weight<=0||d.weight>100||!Array.isArray(d.rules)||!d.rules.length||d.rules.length>30)fail('领域名称、权重或成果规则无效');domainIds.add(d.id);weights+=d.weight;let shares=0;
 for(const r of d.rules){if(!id(r.id)||ruleIds.has(r.id)||!text(r.title,100)||!r.title.trim()||!number(r.share)||r.share<=0||r.share>100||!number(r.target)||r.target<=0||r.target>1e9||!text(r.unit,20)||!r.unit.trim()||!text(r.criterion,500))fail('成果规则的名称、份额、目标总量或单位无效');ruleIds.add(r.id);shares+=r.share;}
 if(Math.abs(shares-100)>1e-6)fail('同一领域内各规则份额须合计 100%');}
 if(Math.abs(weights-100)>1e-6)fail('各领域权重须合计 100%');
}
function validate(c){
 if(!c||c.schemaVersion!==1||!Number.isSafeInteger(c.revision)||c.revision<0)fail('人生罗盘版本不兼容，请更新网页');
 const ids=new Set();for(const name of ['wishes','projects','actions','logs','revisions']){if(!Array.isArray(c[name])||c[name].length>(name==='logs'||name==='revisions'?2500:300))fail('人生罗盘记录过多或格式不兼容，请先备份');for(const e of c[name]){if(!e||!id(e.id)||ids.has(e.id)||!time(e.at))fail('人生罗盘编号或时间无效');ids.add(e.id);}}
 for(const w of c.wishes)if(!text(w.title,100)||!w.title.trim()||!text(w.body,3000)||!text(w.horizon,30)||!statuses.includes(w.status))fail('愿望格式无效');
 for(const p of c.projects){if(!text(p.title,100)||!p.title.trim()||!text(p.body,3000)||!statuses.includes(p.status)||!Array.isArray(p.versions)||!p.versions.length||p.versions.length>100||p.wishId&&!c.wishes.some(w=>w.id===p.wishId)||p.parentId&&!c.projects.some(x=>x.id===p.parentId))fail('项目关联或版本无效');
 p.versions.forEach((v,i)=>{validateDefinition(v);if(v.version!==i+1)fail('项目版本不连续');});
 // Rules with the same ID retain units and meaning; renamed/replaced measures get new IDs.
 const measures=new Map();for(const v of p.versions)for(const r of rules(p,v.version)){const old=measures.get(r.id);if(old&&(old.unit!==r.unit||old.criterion!==r.criterion||old.title!==r.title))fail('改变成果含义或单位时须新建规则，旧规则保留历史');measures.set(r.id,r);}
 const parents=new Set([p.id]);let parent=p.parentId;while(parent){if(parents.has(parent))fail('项目层级不能循环');parents.add(parent);parent=c.projects.find(x=>x.id===parent)?.parentId;}}
 for(const a of c.actions){if(!text(a.title,100)||!a.title.trim()||!statuses.includes(a.status)||!Array.isArray(a.links)||!a.links.length||a.links.length>8||!text(a.next,1000)||!Number.isInteger(a.minutes)||a.minutes<1||a.minutes>720||!['low','any','high'].includes(a.energy)||!text(a.deadline,10)||!text(a.cardId,150))fail('行动格式无效');if(a.deadline&&!/^\d{4}-\d{2}-\d{2}$/.test(a.deadline))fail('截止日期无效');const seen=new Set();let unit='';for(const l of a.links){const p=c.projects.find(p=>p.id===l.projectId),r=p&&rules(p).find(r=>r.id===l.ruleId),key=JSON.stringify([l.projectId,l.ruleId]);if(!r||seen.has(key))fail('行动成果规则缺失或重复');if([...seen].some(x=>JSON.parse(x)[0]===l.projectId))fail('同一行动在同一项目只可选择一条成果规则');seen.add(key);if(unit&&unit!==r.unit)fail('同一次数量记录只可关联相同单位的规则');unit=r.unit;}}
 const batches=new Set();for(const l of c.logs){if(!['contribution','effort','evidence','reversal'].includes(l.kind)||!text(l.body,4000)||l.note!==undefined&&!text(l.note,500)||!text(l.source,1000)||!text(l.date,10)||!/^\d{4}-\d{2}-\d{2}$/.test(l.date))fail('成果记录格式无效');if(l.kind==='reversal'){if(!id(l.reversesId)||!c.logs.some(x=>x.id===l.reversesId&&x.kind!=='reversal')||c.logs.some(x=>x!==l&&x.kind==='reversal'&&x.reversesId===l.reversesId))fail('撤销记录无效或重复');continue;}
 if(!c.projects.some(p=>p.id===l.projectId))fail('成果的项目不存在');
 if(l.kind==='contribution'){if(!text(l.actionId,150)||l.actionId&&!c.actions.some(a=>a.id===l.actionId)||!id(l.batchKey)||!number(l.quantity)||l.quantity<=0||l.quantity>1e9||!['self-report','item-verified'].includes(l.verification)||!Array.isArray(l.itemKeys)||l.itemKeys.length>1000||new Set(l.itemKeys).size!==l.itemKeys.length||l.itemKeys.some(k=>!id(k))||l.verification==='item-verified'&&l.itemKeys.length!==l.quantity||!Array.isArray(l.allocations)||!l.allocations.length||l.allocations.length>8)fail('数量、批次标识或验证方式无效');
 const seen=new Set();let allocationUnit='';for(const a of l.allocations){const p=c.projects.find(p=>p.id===a.projectId),r=p&&rules(p,a.version).find(r=>r.id===a.ruleId),k=JSON.stringify([a.projectId,a.ruleId]);if(!r||seen.has(k)||!number(a.settledPoints)||a.settledPoints<0||a.settledPoints>100)fail('贡献来源规则缺失或重复');if([...seen].some(x=>JSON.parse(x)[0]===a.projectId))fail('同一成果不能在同一项目多次结算');seen.add(k);if(allocationUnit&&allocationUnit!==r.unit)fail('同一数量成果的单位必须一致');allocationUnit=r.unit;const batch=JSON.stringify([a.projectId,a.ruleId,l.batchKey]);if(batches.has(batch))fail('这个批次已计入该规则，不能重复提交');batches.add(batch);}}
 }
 for(const r of c.revisions)if(!text(r.reason,500)||!text(r.entityId,150)||!r.before||typeof r.before!=='object')fail('修订记录无效');
 return c;
}
function activeLogs(c){const reversed=new Set(c.logs.filter(l=>l.kind==='reversal').map(l=>l.reversesId));return c.logs.filter(l=>l.kind!=='reversal'&&!reversed.has(l.id));}
function progress(c,projectId,version){const p=c.projects.find(x=>x.id===projectId);if(!p)fail('项目不存在');const v=definition(p,version);if(!v)fail('计划版本不存在');const rows=rules(p,v.version).map(r=>{const entries=activeLogs(c).filter(l=>l.kind==='contribution'&&l.allocations.some(a=>a.projectId===p.id&&a.ruleId===r.id&&(version===undefined||a.version<=version)));const keys=new Set();let reported=0;for(const l of entries){if(l.verification==='item-verified')l.itemKeys.forEach(k=>keys.add(k));else reported+=l.quantity;}const quantity=keys.size+reported,ratio=Math.min(quantity/r.target,1),points=round(r.weight*r.share/100*ratio);return {...r,quantity,points,ratio,selfReported:reported>0};});const domains=v.domains.map(d=>({...d,points:round(rows.filter(r=>r.domainId===d.id).reduce((n,r)=>n+r.points,0))}));return {version:v.version,points:round(rows.reduce((n,r)=>n+r.points,0)),rules:rows,domains};}
function mutate(c,work){validate(c);const n=clone(c);work(n);n.revision++;validate(n);return n;}
function putWish(c,w,meta){return mutate(c,n=>{const old=n.wishes.find(x=>x.id===w.id);if(old){n.revisions.push({id:meta.id,at:meta.at,entityId:old.id,reason:meta.reason||'修改愿望',before:clone(old)});Object.assign(old,w);}else n.wishes.push({...w,at:meta.at});});}
function putProject(c,p,meta){return mutate(c,n=>{const old=n.projects.find(x=>x.id===p.id);if(old){if(old.versions.length!==p.expectedVersion)fail('项目已变化，请重新打开编辑');n.revisions.push({id:meta.id,at:meta.at,entityId:old.id,reason:meta.reason||'调整项目',before:{title:old.title,body:old.body,status:old.status,wishId:old.wishId,parentId:old.parentId,version:old.versions.length}});for(const k of ['title','body','status','wishId','parentId'])old[k]=p[k];if(!same(old.versions.at(-1).domains,p.domains))old.versions.push({version:old.versions.length+1,at:meta.at,reason:meta.reason||'用户确认调整计划，旧版本保留',domains:clone(p.domains)});}else n.projects.push({id:p.id,at:meta.at,title:p.title,body:p.body,status:p.status,wishId:p.wishId,parentId:p.parentId,versions:[{version:1,at:meta.at,reason:'用户确认初始计划',domains:clone(p.domains)}]});});}
function putAction(c,a,meta){return mutate(c,n=>{const old=n.actions.find(x=>x.id===a.id);if(old){n.revisions.push({id:meta.id,at:meta.at,entityId:old.id,reason:meta.reason||'修改行动',before:clone(old)});Object.assign(old,a);}else n.actions.push({...a,at:meta.at});});}
function record(c,log){return mutate(c,n=>{if(n.logs.some(l=>l.id===log.id))fail('这条记录已经保存，请勿重复提交');const l=clone(log);if(l.kind==='contribution'){if(!Array.isArray(l.allocations)||!l.allocations.length)fail('请选择成果规则');for(const a of l.allocations){const before=progress(n,a.projectId);a.version=before.version;a.settledPoints=0;const r=before.rules.find(r=>r.id===a.ruleId);if(!r)fail('规则已变化，请重新选择');const keys=new Set(activeLogs(n).filter(x=>x.kind==='contribution'&&x.verification==='item-verified'&&x.allocations.some(z=>z.projectId===a.projectId&&z.ruleId===a.ruleId)).flatMap(x=>x.itemKeys));const added=l.verification==='item-verified'?l.itemKeys.filter(k=>!keys.has(k)).length:l.quantity;a.settledPoints=round(r.weight*r.share/100*Math.max(0,Math.min((r.quantity+added)/r.target,1)-r.ratio));}}n.logs.push(l);});}
function reverse(c,targetId,meta){return record(c,{id:meta.id,at:meta.at,date:meta.date,kind:'reversal',reversesId:targetId,body:meta.reason||'用户撤销本次成果',source:''});}
function ielts(makeId){const domain=(title,weight,rows)=>({id:makeId(),title,weight,rules:rows.map(([title,target,unit,share,criterion])=>({id:makeId(),title,target,unit,share,criterion}))});return [domain('词汇基础',14,[['确认掌握目标词汇',2000,'词',100,'按自己确认的掌握标准；不同批次目标词不重叠。']]),domain('听力',20,[['听力训练与复盘',40,'次',100,'一次包含练习和复盘，不只播放材料。']]),domain('阅读',20,[['错题分析',400,'题',50,'写下错因和修正理解，同一题不重复计入。'],['限时阅读与复盘',20,'次',50,'一次包含限时练习与复盘。']]),domain('写作',23,[['写作与修订',20,'篇',100,'完成写作并根据反馈修订。']]),domain('口语',23,[['口语录音与反馈',46,'次',100,'完成录音及自查或反馈。']])];}
const api={empty,clone,validate,validateDefinition,definition,rules,progress,activeLogs,putWish,putProject,putAction,record,reverse,ielts,statuses};root.MeaningCompass=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
