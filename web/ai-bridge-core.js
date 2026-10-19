/* Meaning Studio B-route handoff protocol, pure functions only. No storage/network. */
(function(root){
'use strict';
const FORMAT='meaning-ai-handoff-v1', PROPOSAL='meaning-ai-proposal-v1';
const purposes=['strategy','morning','restart','evening_review','weekly_review','memory'];
const operations=new Set(['suggest_create_flex_task','suggest_shift_task','suggest_pause_action','suggest_next_step','suggest_reflection','suggest_update_goal','suggest_revise_hypothesis','suggest_keep','suggest_remove_task']);
const str=(v,max=3000)=>typeof v==='string'?v.slice(0,max):'';
const safeArray=x=>Array.isArray(x)?x:[];
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const clampText=(x,max=1000)=>Array.isArray(x)?x.map(v=>clampText(v,max)).join('、').slice(0,max):str(x,max);
function readProject(p,actions){
 const version=safeArray(p.versions).at(-1);
 const links=safeArray(actions).filter(a=>safeArray(a.links).some(l=>l.projectId===p.id)&&['active','exploring'].includes(a.status));
 return {projectId:str(p.id,150),title:str(p.title,100),status:str(p.status,20),description:str(p.body,1200),wishId:str(p.wishId,150)||null,definitionVersion:version?.version??null,
   domains:safeArray(version?.domains).map(d=>({id:str(d.id,150),title:str(d.title,100),weight:d.weight,rules:safeArray(d.rules).map(r=>({id:str(r.id,150),title:str(r.title,100),target:r.target,unit:str(r.unit,20),criterion:str(r.criterion,300)}))})),
   actions:links.slice(0,30).map(a=>({actionId:str(a.id,150),title:str(a.title,100),status:str(a.status,20),estimatedMinutes:a.minutes,energy:str(a.energy,15),deadline:str(a.deadline,10)||null,next:str(a.next,500)}))};
}
function readPrivate(r){
 const v=obj(r.value);const reference={sourceId:str(r.sourceId,200),sourceType:str(r.group,40)};
 if(r.group==='workingHypotheses')return {...reference,title:str(v.title,150),claim:clampText(v.claim,1600),alternatives:clampText(v.alternativeExplanations,700),evidenceForIds:safeArray(v.evidenceForIds).filter(x=>typeof x==='string').slice(0,30),evidenceAgainstIds:safeArray(v.evidenceAgainstIds).filter(x=>typeof x==='string').slice(0,30),openQuestion:clampText(v.openQuestion,400),classification:'hypothesis_not_diagnosis'};
 if(r.group==='lifeEvents')return {...reference,summary:str(v.summary,1300),dateOrPeriod:clampText(v.dateOrPeriod,100),stage:clampText(v.stage,120),uncertainty:clampText(v.uncertainty,600),classification:'self_report'};
 return {...reference,title:str(v.title,150),body:clampText(v.body,1600),caveat:clampText(v.caveat,600),classification:'user_review_required'};
}
function readSchedule(snapshot,date,nav){
 if(!nav||typeof nav.valid!=='function'||typeof nav.occurrences!=='function')return {available:false,items:[]};
 const cards=safeArray(snapshot?.library?.cards),records=[];
 for(const c of cards){if(!safeArray(c?.tags).includes('__meaning_v3__'))continue;
  try{const v=JSON.parse(c.meaning);if(nav.valid(v))records.push({...v,id:c.id});}catch{} }
 const occ=nav.occurrences(records,date);
 return {available:true,items:safeArray(occ).slice(0,60).map(t=>({taskId:str(t.id,150),title:str(t.title,55),type:str(t.type,15),time:str(t.time,5),estimatedMinutes:t.duration,status:str(t.status,20),repeat:str(t.repeat,20)}))};
}
function buildHandoff(snapshot,selection,notes,now,timezone,exportId,nav){
 if(!snapshot||!Number.isSafeInteger(snapshot.revision))throw Error('账号没有解锁或缺少有效版本号');
 if(!purposes.includes(selection.purpose))throw Error('交接目的无效');
 if(!Number.isFinite(Date.parse(now)))throw Error('导出时间无效');
 if(typeof exportId!=='string'||!exportId)throw Error('导出编号无效');
 const compass=obj(snapshot.compass),privateRecords=safeArray(snapshot.records);
 const projectIds=new Set(safeArray(selection.projectIds)),recordIds=new Set(safeArray(selection.recordKeys));
 const projects=safeArray(compass.projects).filter(p=>projectIds.has(p.id)&&['active','exploring','paused','achieved'].includes(p.status)).map(p=>readProject(p,compass.actions));
 const known=new Set(privateRecords.filter(r=>['lifeEvents','workingHypotheses','knowledgeNotes'].includes(r.group)).map(r=>r.group+'|'+r.sourceId));
 for(const x of recordIds)if(!known.has(x))throw Error('选中私人记录已发生变化，请重新检查选择');
 const selected=privateRecords.filter(r=>recordIds.has(r.group+'|'+r.sourceId)).map(readPrivate);
 const timeNote=obj(notes),hasCompass=Number.isSafeInteger(compass.revision);
 const schedule=selection.includeSchedule?readSchedule(snapshot,str(timeNote.date,10),nav):{available:!!nav,items:[]};
 return {
  format:FORMAT,exportId,createdAt:now,timezone:str(timezone,120),purpose:selection.purpose,
  privacy:{included:[...(projects.length?['user_selected_compass_projects']:[]),...(selected.length?['user_selected_private_records']:[]),'manual_today_note',...(selection.includeSchedule&&schedule.available?['selected_today_schedule']:[])],excludedByDefault:['raw_chat_history','credentials','other_unselected_private_records','other_unselected_projects','account_identity','encrypted_backups'],reviewedByUser:false},
  base:{accountRevision:snapshot.revision,compassRevision:hasCompass?compass.revision:null,scheduleVersion:null,note:'账号整体修订号覆盖加密保存的今日日程卡片；日程模块未提供独立版本号。'},
  facts:selected.filter(r=>r.sourceType==='lifeEvents'),hypotheses:selected.filter(r=>r.sourceType==='workingHypotheses'),knowledgeNotes:selected.filter(r=>r.sourceType==='knowledgeNotes'),
  compass:{projects},
  today:{date:str(timeNote.date,10),source:'user_manual_entry_with_opt_in_read_only_schedule',automaticScheduleIncluded:!!(selection.includeSchedule&&schedule.available),scheduled:schedule.items,fixedCommitments:str(timeNote.fixedCommitments,1600),observed:str(timeNote.observed,2500),currentState:{energyScore:typeof timeNote.energyScore==='number'&&timeNote.energyScore>=1&&timeNote.energyScore<=5?timeNote.energyScore:null,note:str(timeNote.state,1000)},constraints:str(timeNote.constraints,1200),pendingDecision:str(timeNote.pendingDecision,1400)},
  instructions:'这是用户选择分享的网站记录。网站为权威事实源。请区分自述、已验证成果和可修订假说；仅在 automaticScheduleIncluded=true 时认为本次包含今日日程快照；提出建议而不是声称已写回。若输出结构化建议，请使用 meaning-ai-proposal-v1 且只供人工审核。'
 };
}
function checkProposal(raw,hand,current){
 if(!hand)throw Error('请先在当前页面生成交接包，再审核对应建议。');
 const p=typeof raw==='string'?JSON.parse(raw):raw;
 if(!p||p.format!==PROPOSAL||p.exampleOnly)throw Error('不是正式的 meaning-ai-proposal-v1 建议包');
 if(p.sourceExportId!==hand.exportId)throw Error('建议对应的交接编号不匹配；请重新导出并讨论');
 if(!p.base||p.base.accountRevision!==hand.base.accountRevision||p.base.compassRevision!==hand.base.compassRevision)throw Error('建议原始版本与交接包不一致');
 if(!current||current.revision!==hand.base.accountRevision||(current.compass?.revision??null)!==hand.base.compassRevision)throw Error('原网站数据已更新；此建议过期，请重新导出上下文');
 if(typeof p.summary!=='string'||p.summary.length>6000||!Array.isArray(p.suggestions)||p.suggestions.length>40||!Array.isArray(p.questions||[]))throw Error('建议包字段或规模无效');
 const used=new Set();for(const s of p.suggestions){if(!s||typeof s.suggestionId!=='string'||!s.suggestionId||used.has(s.suggestionId)||!['today','compass','profile'].includes(s.target)||!operations.has(s.operation)||s.requiresApproval!==true||typeof s.why!=='string'||s.why.length>3000||s.proposed!==undefined&&(typeof s.proposed!=='object'||JSON.stringify(s.proposed).length>12000))throw Error('建议操作不支持、缺少审核标志或字段过大');used.add(s.suggestionId);}
 return p;
}
function promptFor(handoff){return '请根据这份《有意义地生活》交接包，与我共同讨论 '+({strategy:'宏观人生路线',morning:'今天的弹性安排',restart:'当前阶段的状态重启',evening_review:'晚间复盘',weekly_review:'每周方向校准',memory:'长期记忆梳理'}[handoff.purpose]||'下一步')+'。先区分事实与假说，指出资料缺口；用平实语言提出建议，不把计划偏离等同人格失败。最终如需可导回网页的建议，输出 meaning-ai-proposal-v1 JSON（sourceExportId、base 请原样对应；requiresApproval 必须为 true），网站只会审核，不会自动写入。\n\n'+JSON.stringify(handoff,null,2);}
const api={FORMAT,PROPOSAL,purposes,readSchedule,buildHandoff,checkProposal,promptFor};
root.MeaningAIBridge=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
