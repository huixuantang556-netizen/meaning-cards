// Controller tests use a small DOM adapter; they are not browser or visual tests.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');const {webcrypto}=require('node:crypto'),V=require('../web/private-core.js');
const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function harness(accountVault=null){
 const nodes=new Map(),store=new Map(),downloads=[],events=new Map();let view='today';
 class Element{
  constructor(id=''){this.id=id;this.value='';this.checked=false;this.required=false;this.disabled=false;this.hidden=false;this.files=[];this.dataset={};this.children=[];this.events={};this._html='';this.classList={toggle(){}};if(id)nodes.set(id,this);}
  set innerHTML(s){this._html=s;this.children=[];for(const tag of s.matchAll(/<(input|button|div|form|select|section|label|p)\b([^>]*)>/g)){const attrs=tag[2],id=attrs.match(/\bid="([^"]+)"/)?.[1],el=new Element(id||'');el.tag=tag[1];el.disabled=/\bdisabled\b/.test(attrs);el.checked=/\bchecked\b/.test(attrs);el.required=/\brequired\b/.test(attrs);const choice=attrs.match(/data-choice="([^"]+)"/)?.[1];if(choice)el.dataset.choice=decode(choice);this.children.push(el);}}
  get innerHTML(){return this._html;}append(el){this.children.push(el);}before(el){shell.append(el);}replaceChildren(){this.children=[];this._html='';}addEventListener(k,f){this.events[k]=f;}
  querySelectorAll(selector){if(selector==='button')return [...nodes.values(),...this.children].filter(x=>x.tag==='button');if(selector==='[data-choice]')return nodes.get('vaultPreview')?.children.filter(x=>x.dataset.choice)||[];return [];}
 }
 const shell=new Element('shell'),tabs=new Element('tabs'),footer=new Element('footer');footer.parentElement=shell;
 const context={AccountVault:accountVault,window:null,activeView:'today',scrollTo(){},document:{hidden:false,createElement:()=>new Element(),getElementById:id=>nodes.get(id)||null,querySelector:s=>s==='.shell'?shell:s==='.tabs'?tabs:s==='footer'?footer:null,querySelectorAll:s=>s==='.view'?shell.children:s==='.tab'?tabs.children:[],addEventListener(k,f){if(!events.has(k))events.set(k,[]);events.get(k).push(f);}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},navigator:{locks:{request:async(_name,fn)=>fn()}},crypto:webcrypto,MeaningPrivate:V,esc:x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),setView:v=>view=v,download:(name,text)=>downloads.push({name,text}),backup:()=>'{"cards":[]}',confirm:()=>true,setInterval(){},addEventListener(){},console};context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../web/private-vault.js','utf8'),context);
 async function settle(){for(let i=0;i<600;i++){if(!vm.runInContext('false',context)&&!nodes.get('vaultUnlock').disabled)return;await new Promise(r=>setTimeout(r,2));}throw Error('controller did not settle');}
 return {nodes,store,downloads,context,settle,emit:k=>{for(const f of events.get(k)||[])f();},click:id=>nodes.get(id).onclick(),submit:id=>nodes.get(id).onsubmit({preventDefault(){}}),get view(){return view}};
}
const data={format:'personal-knowledge-transfer-v1',lifeEvents:[{id:'synthetic-event',summary:'合成隐私内容'}]};
test('controller: create encrypted vault, preview without write, require backup, import and lock',async()=>{
 const h=harness();h.nodes.get('vaultPass').value=h.nodes.get('vaultConfirmPass').value='synthetic-long-test-password';h.submit('vaultUnlockForm');await h.settle();const before=h.store.get(V.KEY);assert.ok(before);assert.ok(!before.includes('synthetic-event'));
 h.nodes.get('vaultImportFiles').files=[{name:'test.json',size:100,text:async()=>JSON.stringify(data)}];await h.nodes.get('vaultImportFiles').onchange();assert.equal(h.store.get(V.KEY),before);assert.match(h.nodes.get('vaultPreview').innerHTML,/尚未合并|导入预览/);
 await h.click('vaultApply');assert.equal(h.store.get(V.KEY),before);assert.match(h.nodes.get('vaultStatus').textContent,/备份/);
 h.click('vaultExport');h.nodes.get('vaultBackupConfirmed').checked=true;await h.click('vaultApply');assert.notEqual(h.store.get(V.KEY),before);assert.match(h.nodes.get('vaultRecords').innerHTML,/合成隐私内容/);assert.equal(h.store.size,1);assert.equal(h.downloads.length,1);
 h.click('vaultLock');assert.equal(h.nodes.get('vaultRecords').innerHTML,'');assert.equal(h.nodes.get('vaultPass').value,'');assert.equal(h.nodes.get('vaultOpen').hidden,true);
});
test('controller: wrong password cannot expose any entries or overwrite ciphertext',async()=>{
 const h=harness(),key=await V.createKey('synthetic-long-test-password',webcrypto),s=V.empty();s.records=[{group:'lifeEvents',sourceId:'synthetic-event',value:{id:'synthetic-event',summary:'合成私密内容'},history:[]}];const encrypted=await V.seal(s,key,webcrypto);h.store.set(V.KEY,encrypted);h.nodes.get('vaultPass').value='wrong-synthetic-test-password';h.submit('vaultUnlockForm');await h.settle();assert.equal(h.store.get(V.KEY),encrypted);assert.equal(h.nodes.get('vaultRecords').innerHTML,'');assert.match(h.nodes.get('vaultStatus').textContent,/口令/);
});
test('controller: returning to ordinary views locks the private vault and keeps original navigation',()=>{const h=harness();h.context.setView('private');h.context.setView('today');assert.equal(h.view,'today');assert.equal(h.nodes.get('vaultRecords').innerHTML,'');assert.equal(h.store.size,0);});
test('controller: backup restore is previewed, explicitly confirmed and reversible',async()=>{
 const h=harness();h.nodes.get('vaultPass').value=h.nodes.get('vaultConfirmPass').value='synthetic-long-test-password';h.submit('vaultUnlockForm');await h.settle();
 const previous=h.store.get(V.KEY),other=V.empty();other.records=[{group:'lifeEvents',sourceId:'restored-event',value:{id:'restored-event',summary:'备份中的合成观察'},history:[]}];const otherSession=await V.createKey('another-synthetic-password',webcrypto),backup=await V.seal(other,otherSession,webcrypto);
 h.nodes.get('vaultRestoreFile').files=[{size:backup.length,text:async()=>backup}];h.nodes.get('vaultRestorePass').value='another-synthetic-password';h.submit('vaultRestoreForm');await h.settle();assert.equal(h.store.get(V.KEY),previous);assert.match(h.nodes.get('vaultRestorePreview').innerHTML,/尚未写入/);
 h.click('vaultExport');h.nodes.get('vaultBackupConfirmed').checked=true;await h.click('vaultRestoreApply');let opened=await V.open(h.store.get(V.KEY),'another-synthetic-password',webcrypto);assert.equal(opened.state.records[0].sourceId,'restored-event');await h.click('vaultUndo');opened=await V.open(h.store.get(V.KEY),'another-synthetic-password',webcrypto);assert.equal(opened.state.records.length,0);
});

test('account import survives a brief switch away and saves all selected records with the adjacent backup button',async()=>{
 let state=V.empty(),saved=0,backed=0;
 const account={active:true,unlocked:true,envelope:'synthetic ciphertext',state:()=>V.clone(state),backup:async()=>{backed++;},writePrivate:async next=>{state=V.clone(next);saved++;return V.clone(state);}};
 const h=harness(account);h.context.setView('private');
 h.nodes.get('vaultImportFiles').files=[{name:'test.json',size:100,text:async()=>JSON.stringify(data)}];await h.nodes.get('vaultImportFiles').onchange();
 const preview=h.nodes.get('vaultPreview').innerHTML;
 h.context.document.hidden=true;h.emit('visibilitychange');h.context.document.hidden=false;h.emit('visibilitychange');
 assert.equal(h.nodes.get('vaultPreview').innerHTML,preview);assert.equal(h.context.activeView,'private');
 await h.click('vaultApply');assert.equal(saved,0);assert.match(h.nodes.get('vaultFeedback').textContent,/备份/);
 await h.click('vaultPreviewBackup');h.nodes.get('vaultBackupConfirmed').checked=true;await h.click('vaultApply');
 assert.equal(backed,1);assert.equal(saved,1);assert.equal(state.records.length,1);assert.equal(h.nodes.get('vaultPreview').innerHTML,'');
});
test('missing candidate dependencies are explained beside confirmation and keep the selected preview intact',async()=>{
 const state=V.empty(),account={active:true,unlocked:true,envelope:'synthetic ciphertext',state:()=>V.clone(state),backup:async()=>{}};
 const h=harness(account);h.context.setView('private');
 const transfer={format:'personal-knowledge-transfer-v1',lifeEvents:[{id:'synthetic-event',relatedIds:['synthetic-hypothesis']}],workingHypotheses:[{id:'synthetic-hypothesis',title:'合成候选观点'}]};
 h.nodes.get('vaultImportFiles').files=[{name:'test.json',size:200,text:async()=>JSON.stringify(transfer)}];await h.nodes.get('vaultImportFiles').onchange();
 const choices=h.nodes.get('vaultPreview').children.filter(x=>x.dataset.choice);choices.find(x=>x.dataset.choice.includes('workingHypotheses')).checked=false;
 await h.click('vaultPreviewBackup');h.nodes.get('vaultBackupConfirmed').checked=true;await h.click('vaultApply');
 assert.match(h.nodes.get('vaultFeedback').textContent,/synthetic-hypothesis/);assert.match(h.nodes.get('vaultPreview').innerHTML,/导入预览/);assert.equal(state.records.length,0);assert.equal(choices.find(x=>x.dataset.choice.includes('workingHypotheses')).checked,false);
});
