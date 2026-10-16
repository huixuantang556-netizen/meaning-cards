const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const {randomUUID}=require('node:crypto');
const app=fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8');
function harness(){
 const nodes=new Map(),storage=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},events:{},addEventListener(k,f){this.events[k]=f},focus(){},click(){},append(){},remove(){},checkValidity(){return true;}});return nodes.get(id)};
 const context={document:{getElementById:node,querySelectorAll:()=>[],querySelector:()=>node('shell'),body:node('body'),hidden:false,addEventListener(){},createElement:()=>node(randomUUID())},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},console,crypto:{randomUUID},setTimeout:()=>0,clearTimeout(){},setInterval(){},addEventListener(){},confirm:()=>true,navigator:{onLine:true,locks:{request:async(_n,_o,f)=>f({})}},URL,Blob};context.window=context;context.scrollTo=()=>{};
 vm.createContext(context);vm.runInContext(app,context);return {context,node,storage,run:code=>vm.runInContext(code,context)};
}
test('15 original cards, complete fields, template draft, edit, favorite and backup',()=>{
 const h=harness();assert.equal(h.run('starter.length'),15);assert.equal(h.run('cards.length'),15);
 assert.equal(h.run('starter.every(c=>["title","meaning","identity","tiny","restart"].every(k=>c[k]))'),true);
 h.run('editCard(cards[0].id)');h.node('editTitle').value='新的标题';h.node('saveCard').events.click();assert.equal(h.run('cards[0].title'),'新的标题');
 h.run('cards[0].favorite=true;save()');assert.equal(JSON.parse(h.run('backup()')).cards[0].favorite,true);
 h.node('newBehavior').value='喝水';h.node('newCat').value='basic';h.node('makeDraft').events.click();assert.equal(h.run('editing.title'),'喝水');
 h.run('closeEditor()');h.run('editCard(cards[0].id)');h.node('deleteCard').events.click();assert.equal(h.run('cards.length'),14);
});
test('import handles null and escapes script markup; category prototype keys rejected',()=>{
 const h=harness();h.node('aiJSON').value='null';assert.doesNotThrow(()=>h.node('importAI').events.click());
 assert.equal(h.run('normalized({category:"__proto__"}).category'),'energy');assert.equal(h.run('esc("<script>")'),'&lt;script&gt;');
 h.node('aiJSON').value='{"title":"测试","meaning":"保留文字"}';h.node('importAI').events.click();assert.equal(h.run('cards[0].meaning'),'保留文字');
});
async function syncHarness(){
 const h=harness();let remote=null,writeCalls=0,writeHook=null,fail=false;
 const client={from(){return {select(){return {eq(){return {async maybeSingle(){if(fail)return {error:Error('offline')};return {data:remote&&structuredClone(remote)}}}}}}}},async rpc(_name,p){writeCalls++;if(writeHook){const f=writeHook;writeHook=null;f();}if((remote?.revision||0)!==p.expected_revision)return {data:{ok:false,current:remote}};remote={revision:p.expected_revision+1,cards:structuredClone(p.new_cards),last_op:p.operation_id};return {data:{ok:true,current:structuredClone(remote)}}},auth:{onAuthStateChange(){},async getSession(){return {data:{session:{user:{id:'user-a',email:'a@example.com'}}}}},async signOut(){return {}}}};
 h.context.MEANING_CONFIG={supabaseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_test'};h.context.__sdk={createClient:()=>client};
 let src=fs.readFileSync(path.join(__dirname,'../web/sync.js'),'utf8').replace("import('https://esm.sh/@supabase/supabase-js@2.57.4')","Promise.resolve(__sdk)");await vm.runInContext(src,h.context);
 return {...h,get remote(){return remote},set remote(v){remote=v},get writeCalls(){return writeCalls},set hook(f){writeHook=f},set fail(v){fail=v}};
}
test('login does not upload starter cards; save and periodic pull synchronize deletions/favorites',async()=>{
 const h=await syncHarness();assert.equal(h.run('cards.length'),0);assert.equal(h.writeCalls,0);
 h.run('cards=[normalized({id:"a",title:"A",favorite:true})];save()');await h.node('syncNow').onclick();assert.equal(h.remote.cards[0].favorite,true);
 h.remote={revision:2,cards:[],last_op:'remote'};await h.node('syncNow').onclick();assert.equal(h.run('cards.length'),0);
});
test('conflicting edits preserve local and cloud versions; no silent overwrite',async()=>{
 const h=await syncHarness();h.run('cards=[normalized({id:"a",title:"local"})];save()');h.remote={revision:1,cards:[{id:'a',title:'cloud'}],last_op:'remote'};await h.node('syncNow').onclick();
 assert.equal(h.writeCalls,0);assert.equal(h.run('cards[0].title'),'local');assert.equal(h.node('conflictBox').hidden,false);
 const saved=JSON.parse(h.storage.get('meaning-cloud-v1:https://example.supabase.co:user-a'));assert.equal(saved.conflict.cards[0].title,'cloud');
});
test('offline changes persist and an edit during upload remains pending',async()=>{
 const h=await syncHarness();h.run('cards=[normalized({id:"a",title:"first"})];save()');h.fail=true;await h.node('syncNow').onclick();assert.match(h.node('syncStatus').textContent,/未完成/);h.fail=false;
 h.hook=()=>h.run('cards[0].title="later";save()');await h.node('syncNow').onclick();assert.equal(h.remote.cards[0].title,'first');await h.node('syncNow').onclick();assert.equal(h.remote.cards[0].title,'later');
});
test('open editor defers pulling changes',async()=>{
 const h=await syncHarness();h.run('editCard(normalized({id:"draft",title:"draft"}))');h.remote={revision:1,cards:[],last_op:'remote'};await h.node('syncNow').onclick();assert.equal(h.run('editing.title'),'draft');assert.equal(h.writeCalls,0);
});

test("original 15-card source is byte-for-byte preserved",()=>{const block=app.match(/const starter=(\[.*?\n\]);/s)[1];assert.equal(require("node:crypto").createHash("sha256").update(block).digest("hex"),"4a1e004269785d38462a16c4d9fe293fcc6b7b1a0addd448ad9e07dadb2d80aa");});
test('copying guest V3 tasks to an account remaps linked cards and daily overrides together',async()=>{
 const h=await syncHarness();const guest=[{id:'card',title:'认知卡'},{id:'task',title:'日程',tags:['__meaning_v3__'],meaning:JSON.stringify({v:3,kind:'task',card:'card'})},{id:'override',title:'状态',tags:['__meaning_v3__'],meaning:JSON.stringify({v:3,kind:'override',task:'task'})}];h.storage.set('meaning-studio-v1',JSON.stringify({cards:guest}));h.node('copyGuest').onclick();const copied=JSON.parse(h.run('JSON.stringify(cards)'));assert.equal(JSON.parse(copied[1].meaning).card,copied[0].id);assert.equal(JSON.parse(copied[2].meaning).task,copied[1].id);assert.notEqual(copied[0].id,'card');
});
