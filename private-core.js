/* Private vault v1. No personal data, network calls or AI inference. */
(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const groups=['lifeEvents','workingHypotheses','knowledgeNotes','links'];
const KEY='meaning-private-vault-v1',FORMAT='meaning-private-vault-encrypted-v1',ITERATIONS=600000;
const canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
const key=(group,id)=>JSON.stringify([group,id]);
const empty=()=>({schema:1,revision:0,records:[],sources:[],undo:null});
function validate(s){
 if(!s||s.schema!==1||!Number.isInteger(s.revision)||s.revision<0||!Array.isArray(s.records)||!Array.isArray(s.sources)||s.records.length>5000)throw Error('档案格式或版本不兼容');
 const ids=new Set(),entityIds=new Set();for(const r of s.records){if(!r||!groups.includes(r.group)||typeof r.sourceId!=='string'||!r.value||r.value.id!==r.sourceId||!Array.isArray(r.history))throw Error('条目格式不完整');const k=key(r.group,r.sourceId);if(ids.has(k))throw Error('存在重复 ID');ids.add(k);if(r.group!=='links'){if(entityIds.has(r.sourceId))throw Error('不同类别出现相同 ID，引用可能有歧义');entityIds.add(r.sourceId);}}
 for(const f of s.sources)if(typeof f.name!=='string'||typeof f.text!=='string')throw Error('来源文件格式不兼容');
 if(s.undo){const previous=clone(s.undo);if(previous.undo)throw Error('撤销快照不兼容');validate(previous);}
 return s;
}
function parseFiles(files){
 const rows=[],sources=[],updates=[],seen=new Map();let total=0;
 for(const f of files){
  if(typeof f.text!=='string'||typeof f.name!=='string'||! /\.(json|md|txt)$/i.test(f.name))throw Error('文件读取失败');total+=new TextEncoder().encode(f.text).length;if(total>1000000)throw Error('一次导入最多约 1 MB，请分批处理');
  sources.push({name:f.name,text:f.text});if(!/\.json$/i.test(f.name))continue;
  let d;try{d=JSON.parse(f.text);}catch{throw Error('有 JSON 文件无法解析，请检查后重试');}
  if(!['personal-knowledge-transfer-v1','personal-knowledge-transfer-patch-v1'].includes(d?.format))throw Error('这不是支持的资料交换格式；原程序备份请在「我的数据」恢复');
  for(const group of groups){
   if(d[group]!==undefined&&!Array.isArray(d[group]))throw Error('资料集合必须是数组');
   for(const value of d[group]||[]){
    if(!value||typeof value.id!=='string'||!value.id||value.id.length>200)throw Error('条目缺少有效 ID');
    const k=key(group,value.id);if(seen.has(k)&&canonical(seen.get(k))!==canonical(value))throw Error('同批文件的相同 ID 内容不同，请分批预览并处理冲突');
    if(!seen.has(k)){rows.push({key:k,group,sourceId:value.id,value:clone(value),source:f.name});seen.set(k,value);}
   }
  }
  for(const u of d.proposedUpdatesToExistingHypotheses||[]){if(typeof u.id!=='string'||typeof u.appendEvidenceForId!=='string')throw Error('增量建议格式不兼容');updates.push({key:key('proposal',u.id+':'+u.appendEvidenceForId),value:clone(u),source:f.name});}
 }
 if(!rows.length)throw Error('请选择至少一个受支持的 JSON 文件，可同时附上 Markdown 原文');
 return {rows,sources,updates};
}
function preview(state,parsed){
 validate(state);const existing=new Map(state.records.map(r=>[key(r.group,r.sourceId),r]));
 const rows=parsed.rows.map(r=>{const old=existing.get(r.key);return {...r,old:old?.value||null,action:old?(canonical(old.value)===canonical(r.value)?'same':'conflict'):'new'};});
 const updates=parsed.updates.map(u=>({...u,action:'proposal'}));
 // These are unapproved proposals. No confidence or hypothesis is regenerated.
 const warnings=['来源里的自述尚未经第三方核验；AI 分析仍是假说。','同一事件和它的观察卡不是两份独立证据。','外部资料的原有待核验标记会完整保留。'];
 const hypotheses=new Map(rows.filter(r=>r.group==='workingHypotheses').map(r=>[r.sourceId,r.value]));
 for(const source of parsed.sources.filter(f=>/\.md$/i.test(f.name))){for(const line of source.text.split('\n')){const cells=line.split('|').map(x=>x.trim());if(cells.length>=4&&hypotheses.has(cells[1])&&cells[2]!==hypotheses.get(cells[1]).title){const row=rows.find(r=>r.group==='workingHypotheses'&&r.sourceId===cells[1]);row.sourceVariants=row.sourceVariants||[];row.sourceVariants.push({source:source.name,originalLine:line,comparison:'同编号原始表述不同，未经语义裁定'});}}}
 for(const row of rows){if(row.action==='same'&&row.sourceVariants&&canonical(row.sourceVariants)!==canonical(existing.get(row.key)?.sourceVariants||[]))row.action='conflict';}
 const variants=rows.filter(r=>r.sourceVariants).length;if(variants)warnings.push('有 '+variants+' 个编号的 Markdown 与 JSON 表述不同。是否同义未自动裁定，这些条目默认不勾选；展开可查看两种原文。');
 return {rows,updates,sources:parsed.sources,warnings,baseRevision:state.revision};
}
function missingReferences(state){
 const ids=new Set(state.records.filter(r=>r.group!=='links').map(r=>r.sourceId));const missing=[];
 for(const r of state.records){const v=r.value;for(const field of ['topicIds','relatedIds','evidenceForIds','evidenceAgainstIds'])for(const id of v[field]||[]){if(typeof id!=='string')throw Error('引用 ID 必须为文字');if(!ids.has(id))missing.push({from:r.sourceId,to:id});}if(r.group==='links')for(const field of ['fromId','toId'])if(!ids.has(v[field]))missing.push({from:r.sourceId,to:v[field]});}
 return missing;
}
function checkpoint(state){const n=clone(state);n.undo=null;return n;}
function apply(state,plan,choices,at,options={}){
 validate(state);if(state.revision!==plan.baseRevision)throw Error('档案已变化，请重新预览');
 const n=clone(state);n.undo=checkpoint(state);let changed=0;
 for(const row of plan.rows){const choice=choices[row.key]||'keep';if(choice!=='import'||row.action==='same')continue;
  const i=n.records.findIndex(r=>key(r.group,r.sourceId)===row.key);
  if(i<0)n.records.push({group:row.group,sourceId:row.sourceId,value:clone(row.value),history:[],createdAt:at,updatedAt:at,source:row.source,...(row.sourceVariants?{sourceVariants:clone(row.sourceVariants)}:{})});
  else{const r=n.records[i];r.history.push({value:clone(r.value),at,reason:'用户在导入预览选择采用新版本',source:r.source,sourceVariants:clone(r.sourceVariants||[])});r.value=clone(row.value);r.updatedAt=at;r.source=row.source;if(row.sourceVariants)r.sourceVariants=clone(row.sourceVariants);}
  changed++;
 }
 for(const row of plan.updates){if(choices[row.key]!=='import')continue;const u=row.value,r=n.records.find(r=>r.group==='workingHypotheses'&&r.sourceId===u.id);if(!r)throw Error('要追加证据的假说尚未导入');if(!n.records.some(r=>r.group==='lifeEvents'&&r.sourceId===u.appendEvidenceForId))throw Error('要追加的事件尚未导入');
  const refs=r.value.evidenceForIds||[];if(!refs.includes(u.appendEvidenceForId)){r.history.push({value:clone(r.value),at,reason:'用户接受一项追加证据建议；不提高置信度',source:row.source});r.value.evidenceForIds=[...refs,u.appendEvidenceForId];r.value.importCautions=[...(r.value.importCautions||[]),u.caution||'单次观察，有限证据'];r.updatedAt=at;changed++;}
 }
 if(!changed)throw Error('没有选择新的内容；未改动档案');
 if(options.archiveSources)for(const f of plan.sources)if(!n.sources.some(old=>old.name===f.name&&old.text===f.text))n.sources.push(clone(f));
 if(missingReferences(n).length)throw Error('所选条目引用了未导入的记录，请同时勾选依赖项或先导入基础资料包');
 n.revision++;validate(n);return n;
}
function undo(state){if(!state.undo)throw Error('没有可撤销的操作');const n=clone(state.undo);n.revision=state.revision+1;n.undo=null;return validate(n);}
function remove(state,group,id){const affected=state.records.filter(r=>r.group==='links'&&(r.value.fromId===id||r.value.toId===id));if(affected.length)throw Error('还有显式连接指向此记录，暂不能单独删除');if(state.records.some(r=>['topicIds','relatedIds','evidenceForIds','evidenceAgainstIds'].some(f=>(r.value[f]||[]).includes(id))))throw Error('还有记录引用此条目，暂不能单独删除');const n=clone(state);n.undo=checkpoint(state);n.records=n.records.filter(r=>key(r.group,r.sourceId)!==key(group,id));n.revision++;return n;}
const bytes=x=>new TextEncoder().encode(x),fromBytes=x=>new TextDecoder().decode(x);
function b64(a){let s='';for(const b of a)s+=String.fromCharCode(b);return btoa(s);}
function unb64(s){if(typeof s!=='string'||s.length>6000000)throw Error('备份字段过大或无效');return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
async function derive(pass,salt,crypto){if(typeof pass!=='string'||pass.length<12)throw Error('口令至少 12 个字符，请选择较长且不易猜的口令');const raw=await crypto.subtle.importKey('raw',bytes(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function createKey(pass,crypto){const salt=crypto.getRandomValues(new Uint8Array(16));return {key:await derive(pass,salt,crypto),salt};}
async function seal(state,session,crypto){validate(state);const raw=JSON.stringify(state);if(bytes(raw).length>1600000)throw Error('档案过大，未写入；请减少本次导入或保留外部备份');const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:bytes(FORMAT)},session.key,bytes(raw));return JSON.stringify({format:FORMAT,version:1,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:b64(session.salt),iv:b64(iv),ciphertext:b64(new Uint8Array(encrypted))});}
async function open(raw,pass,crypto){let e;try{e=JSON.parse(raw);}catch{throw Error('加密备份格式错误');}if(e.format!==FORMAT||e.version!==1||e.kdf!=='PBKDF2-SHA256'||e.iterations!==ITERATIONS)throw Error('不支持的加密备份版本');const salt=unb64(e.salt),iv=unb64(e.iv),ciphertext=unb64(e.ciphertext);if(salt.length!==16||iv.length!==12)throw Error('加密参数无效');const session={key:await derive(pass,salt,crypto),salt};let clear;try{clear=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:bytes(FORMAT)},session.key,ciphertext);}catch{throw Error('口令不正确，或备份已损坏');}let state;try{state=validate(JSON.parse(fromBytes(clear)));}catch{throw Error('解密后数据不兼容，请保留原始备份');}return {session,state};}
async function commit(storage,expected,next,session,crypto){const raw=await seal(next,session,crypto);if(storage.getItem(KEY)!==expected)throw Error('另一页面更新了档案，请锁定后重新打开；本次未覆盖');storage.setItem(KEY,raw);return raw;}
const api={KEY,FORMAT,groups,clone,canonical,key,empty,validate,parseFiles,preview,missingReferences,apply,undo,remove,createKey,seal,open,commit};
root.MeaningPrivate=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
