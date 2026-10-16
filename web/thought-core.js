/* Versioned thought records. Raw entries and revisions are retained; never truncate. */
(function(root){
'use strict';
const TAG='__meaning_thought_v1__', clone=x=>JSON.parse(JSON.stringify(x));
const states=['继续探索','暂时搁置','已经形成认识','目前不需要解决'];
const kinds=['自由思考','猜想','新发现','反对意见','未解决的问题','现实观察','阅读摘录','AI 建议','知识卡','成长记录'];
function valid(t){
 if(!t||t.version!==1||!states.includes(t.state)||typeof t.next!=='string'||typeof t.draft!=='string'||!Array.isArray(t.entries)||!Array.isArray(t.links))return false;
 if(t.scratch&&(!Object.values(t.scratch).every(v=>typeof v==='string')))return false;
 if(!t.entries.every(e=>e&&typeof e.id==='string'&&typeof e.text==='string'&&typeof e.at==='string'&&kinds.includes(e.kind)&&Array.isArray(e.revisions)&&e.revisions.every(r=>typeof r.text==='string'&&typeof r.reason==='string'&&typeof r.at==='string')))return false;
 if(new Set(t.entries.map(e=>e.id)).size!==t.entries.length)return false;
 return t.links.every(l=>l&&typeof l.label==='string'&&typeof l.url==='string'&&typeof l.card==='string'&&typeof l.note==='string');
}
function create(){return {version:1,state:states[0],next:'',draft:'',entries:[],links:[]};}
function append(t,text,kind,id,at){if(!text.trim()||!kinds.includes(kind))throw Error('请写下一点内容');const n=clone(t);n.entries.push({id,text,kind,at,revisions:[]});n.draft='';return n;}
function revise(t,id,text,reason,at){if(!text.trim()||!reason.trim())throw Error('请填写修改内容与理由');const n=clone(t),e=n.entries.find(x=>x.id===id);if(!e)throw Error('记录不存在');e.revisions.push({text,reason,at});return n;}
const current=e=>e.revisions.length?e.revisions[e.revisions.length-1].text:e.text;
const safeURL=s=>{try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
function remap(t,ids){const n=clone(t);n.links.forEach(l=>{if(ids.has(l.card))l.card=ids.get(l.card);});return n;}
const api={TAG,states,kinds,valid,create,append,revise,current,safeURL,remap,clone};
root.MeaningThought=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
