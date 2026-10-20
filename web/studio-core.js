/* Presentation helpers only. No private content or independent storage. */
(function(root){
'use strict';
const sections={calendar:'today',manager:'manager',compass:'today',today:'today',care:'care',haven:'care',habits:'care',journal:'care',explore:'explore',thought:'explore',cards:'explore',create:'explore',profile:'profile',settings:'settings',data:'settings',private:'settings'};
const section=view=>sections[view]||'today';
function water(records,day){const entries=records.filter(x=>x.kind==='water'&&x.day===day).sort((a,b)=>a.at-b.at);return {entries,total:entries.reduce((s,x)=>s+x.amount,0)};}
function text(x){if(x===null||x===undefined)return '';if(typeof x==='string')return x;if(Array.isArray(x))return x.map(text).filter(Boolean).join('\n');if(typeof x==='object')return Object.entries(x).map(([k,v])=>k+'：'+text(v)).join('\n');return String(x);}
function profile(state,query=''){const records=state?.records||[],q=query.trim().toLocaleLowerCase();return {hypotheses:records.filter(r=>r.group==='workingHypotheses'&&(!q||[r.sourceId,text(r.value),text(r.sourceVariants)].join(' ').toLocaleLowerCase().includes(q))),events:records.filter(r=>r.group==='lifeEvents'),notes:records.filter(r=>r.group==='knowledgeNotes')};}
const api={section,water,text,profile};root.MeaningStudio=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
