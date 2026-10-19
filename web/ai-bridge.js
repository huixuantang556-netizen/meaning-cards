/* ChatGPT B-route bridge: user-selective, read-only handoff and manual proposal review. */
(function(){
'use strict';
const B=window.MeaningAIBridge;
if(!B){return;}
const $=id=>document.getElementById(id);
const host=$('navigation')||$('view-today');
if(!host)return;
const el=document.createElement('details');el.className='ai-bridge';el.id='aiBridge';
el.innerHTML='<summary><strong>✦ 与 ChatGPT 一起规划</strong><small>选择资料 → 对话 → 审核建议（不新建日程库）</small></summary>'+
'<div class="ai-bridge-body"><p class="ai-muted">本功能不会自动上传或修改资料；只有你阅读确认后复制、下载的内容才会离开网站。私人经历默认不选。</p>'+
'<p id="abGate" class="ai-status"></p><label class="ai-field">交接目的<select id="abPurpose"><option value="strategy">宏观路线</option><option value="morning">早晨规划</option><option value="restart">中途重启</option><option value="evening_review">晚间复盘</option><option value="weekly_review">每周调整</option><option value="memory">长期记忆交接</option></select></label>'+
'<div class="ai-grid"><label class="ai-field">今天不能错过的事<textarea id="abFixed" maxlength="2500"></textarea></label><label class="ai-field">实际完成与发生的事<textarea id="abObserved" maxlength="2500"></textarea></label><label class="ai-field">阻碍与限制<textarea id="abConstraints" maxlength="2500"></textarea></label><label class="ai-field">此刻的感受<textarea id="abState" maxlength="2500"></textarea></label><label class="ai-field">想解决的问题<textarea id="abPending" maxlength="2500"></textarea></label><label class="ai-field">主观精力<select id="abEnergy"><option value="">暂不评价</option><option value="1">1 · 很疲惫</option><option value="2">2 · 比较疲惫</option><option value="3">3 · 一般</option><option value="4">4 · 清醒</option><option value="5">5 · 很活跃</option></select></label></div>'+
'<label class="ai-check"><input type="checkbox" id="abSchedule"><span>包含今天真实的日程快照（默认不包含）</span></label>'+
'<fieldset><legend>人生罗盘 · 自选项目</legend><div id="abProjects"></div></fieldset>'+
'<fieldset><legend>认识自己 · 自选档案</legend><div id="abPrivate"></div></fieldset>'+
'<div class="ai-row"><button class="btn primary" id="abGenerate" type="button">生成交接预览</button></div><p id="abStatus" class="ai-status" role="status" aria-live="polite"></p>'+
'<div id="abPreviewBox" hidden><h3>请先核查将分享的全部内容</h3><p class="ai-muted">注意个人隐私及第三方资料。下载的文件是明文，请妥善保存。</p><textarea id="abPreview" class="ai-json" readonly rows="13"></textarea>'+
'<label class="ai-check"><input type="checkbox" id="abApprove"><span>我已阅读并决定主动分享这份交接内容</span></label>'+
'<div class="ai-row"><button class="btn primary" id="abCopy" type="button">复制给 ChatGPT</button><button class="btn" id="abJSON" type="button">下载 JSON</button><button class="btn" id="abMD" type="button">下载 Markdown</button></div></div>'+
'<h3>ChatGPT 的建议 → 回网站审核</h3><p class="ai-muted">粘贴 meaning-ai-proposal-v1 JSON。此阶段只审核和复制建议，不会自动修改原有资料。</p>'+
'<textarea id="abProposal" class="ai-json" maxlength="150000" placeholder="粘贴 ChatGPT 返回的 JSON"></textarea><div class="ai-row"><button class="btn" id="abReview" type="button">校验并预览建议</button><button class="btn primary" id="abSelected" type="button" hidden>复制选中建议（手动执行）</button></div><div id="abResults"></div></div>';
host.prepend(el);
const current=()=>window.AccountVault?.state?.()||null;
let handoff=null,proposal=null,signature='',identity=window.meaningContext;
const note=msg=>{$('abStatus').textContent=msg;};
const safeName=t=>String(t||'').slice(0,100);
function addChoices(id,items){
 const node=$(id);node.replaceChildren();
 if(!items.length){node.textContent='目前没有可选记录';return;}
 for(const item of items){
 const lab=document.createElement('label');lab.className='ai-check';
 const inp=document.createElement('input');inp.type='checkbox';inp.value=item.id;
 const span=document.createElement('span');const bold=document.createElement('strong');bold.textContent=item.name;
 const small=document.createElement('small');small.textContent=item.info||'';
 span.append(bold,small);lab.append(inp,span);node.append(lab);
 }
}
function fill(){
 const s=current();const next=s?String(s.revision)+'/'+String(s.compass?.revision)+'/'+String(identity):'locked';
 if(next===signature)return;signature=next;
 $('abGate').textContent=s?'已解锁：请选择这次要共享的资料。':'请先前往「设置 → 账号与数据」解锁加密账户。';
 $('abGenerate').disabled=!s;
 const p=s?.compass?.projects||[],r=s?.records||[];
 addChoices('abProjects',p.filter(x=>['active','exploring','paused'].includes(x.status)).slice(0,60).map(x=>({id:x.id,name:safeName(x.title),info:x.status})));
 addChoices('abPrivate',r.filter(x=>['lifeEvents','workingHypotheses','knowledgeNotes'].includes(x.group)).slice(0,80).map(x=>({id:x.group+'|'+x.sourceId,name:x.group+' · '+safeName(x.value?.title||x.value?.summary||x.sourceId),info:x.sourceId})));
 invalidate();
}
function invalidate(){handoff=null;proposal=null;$('abPreviewBox').hidden=true;$('abApprove').checked=false;$('abResults').replaceChildren();$('abSelected').hidden=true;}
function checked(id){return [...$(id).querySelectorAll('input:checked')].map(e=>e.value);}
function localDate(){return window.MeaningNav.date(new Date());}
$('abGenerate').onclick=()=>{
 try{
 const s=current();if(!s)throw Error('请先解锁账户');
 const notes={date:localDate(),fixedCommitments:$('abFixed').value,observed:$('abObserved').value,constraints:$('abConstraints').value,state:$('abState').value,pendingDecision:$('abPending').value,energyScore:$('abEnergy').value?Number($('abEnergy').value):null};
 const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'unknown';
 handoff=B.buildHandoff(s,{purpose:$('abPurpose').value,projectIds:checked('abProjects'),recordKeys:checked('abPrivate'),includeSchedule:$('abSchedule').checked},notes,new Date().toISOString(),tz,crypto.randomUUID(),window.MeaningNav);
 $('abPreview').value=JSON.stringify(handoff,null,2);
 $('abPreviewBox').hidden=false;$('abApprove').checked=false;note('预览已生成，尚未分享。请核查所有内容并勾选确认。');
 }catch(e){note('无法导出：'+e.message);}
};
const authorized=()=>{
 if(!handoff||!$('abApprove').checked)throw Error('请先生成预览并勾选主动分享确认');
 const s=current();if(!s||s.revision!==handoff.base.accountRevision||(s.compass?.revision??null)!==handoff.base.compassRevision)throw Error('网站资料已变化，请重新导出');
};
function download(name,body,mime){const url=URL.createObjectURL(new Blob([body],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
async function copy(text){if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);}else{const t=document.createElement('textarea');t.value=text;document.body.append(t);t.select();if(!document.execCommand('copy'))throw Error('请手动复制预览');t.remove();}}
$('abCopy').onclick=async()=>{try{authorized();await copy(B.promptFor({...handoff,privacy:{...handoff.privacy,reviewedByUser:true}}));note('已复制。请打开 ChatGPT 主动发送。');}catch(e){note(e.message);}};
$('abJSON').onclick=()=>{try{authorized();download('meaning-ai-handoff-'+localDate()+'.json',JSON.stringify({...handoff,privacy:{...handoff.privacy,reviewedByUser:true}},null,2),'application/json;charset=utf-8');note('JSON 已下载（明文）。');}catch(e){note(e.message);}};
$('abMD').onclick=()=>{try{authorized();const body=JSON.stringify({...handoff,privacy:{...handoff.privacy,reviewedByUser:true}},null,2);download('meaning-ai-handoff-'+localDate()+'.md','# AI 协作交接\n\n以下内容为你选择主动分享的记录，请妥善保存。\n\n~~~json\n'+body+'\n~~~\n','text/markdown;charset=utf-8');note('Markdown 已下载（明文）。');}catch(e){note(e.message);}};
$('abReview').onclick=()=>{
 const target=$('abResults');target.replaceChildren();$('abSelected').hidden=true;proposal=null;
 try{
 proposal=B.checkProposal($('abProposal').value,handoff,current());
 const intro=document.createElement('p');intro.textContent=proposal.summary;target.append(intro);
 for(const s of proposal.suggestions){
 const div=document.createElement('section');div.className='ai-review';
 const label=document.createElement('label');label.className='ai-check';const cb=document.createElement('input');cb.type='checkbox';cb.value=s.suggestionId;
 const title=document.createElement('strong');title.textContent=s.target+' · '+s.operation+' · '+s.suggestionId;label.append(cb,title);
 const why=document.createElement('p');why.textContent=s.why;const pre=document.createElement('pre');pre.textContent=JSON.stringify(s.proposed||{},null,2);
 div.append(label,why,pre);target.append(div);
 }
 $('abSelected').hidden=!proposal.suggestions.length;note('建议已核对来源和版本。当前只能复制待办建议，不会写入网站。');
 }catch(e){note('无法审核：'+e.message);}
};
$('abSelected').onclick=async()=>{
 try{B.checkProposal(proposal,handoff,current());const ids=new Set([...$('abResults').querySelectorAll('input:checked')].map(e=>e.value));if(!ids.size)throw Error('请先选择认可的建议');
 await copy(proposal.suggestions.filter(s=>ids.has(s.suggestionId)).map(s=>s.target+' / '+s.operation+': '+JSON.stringify(s.proposed||{})+'\n理由：'+s.why).join('\n\n'));
 note('建议已复制。请在对应原有模块中手动实施。');
 }catch(e){note(e.message);}
};
el.addEventListener('input',e=>{if(e.target.id==='abProposal'||e.target.id==='abApprove')return;invalidate();});
el.addEventListener('change',e=>{if(e.target.id==='abProposal'||e.target.id==='abApprove')return;invalidate();});
el.addEventListener('toggle',()=>{if(el.open)fill();});
function accountChanged(){
 if(window.meaningContext!==identity){identity=window.meaningContext;signature='';$('abProposal').value='';for(const id of ['abFixed','abObserved','abConstraints','abState','abPending'])$(id).value='';$('abSchedule').checked=false;invalidate();}
 const s=current();if(handoff&&(!s||s.revision!==handoff.base.accountRevision||(s.compass?.revision??null)!==handoff.base.compassRevision)){invalidate();note('账号记录更新，旧预览已经失效。');}
 if(el.open)fill();
}
document.addEventListener('meaningsecurechange',accountChanged);
document.addEventListener('meaningaccountready',accountChanged);
window.MeaningAIBridgeUI={open(){if(typeof setView==='function')setView('today');el.open=true;el.scrollIntoView({behavior:'smooth'});fill();}};
})();
