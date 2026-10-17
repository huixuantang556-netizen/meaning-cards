const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const {randomUUID}=require('node:crypto');
const app=fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8');
function harness(){
 const nodes=new Map(),storage=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},events:{},addEventListener(k,f){this.events[k]=f},focus(){},click(){},append(){},remove(){},checkValidity(){return true;}});return nodes.get(id)};
 const context={document:{getElementById:node,querySelectorAll:()=>[],querySelector:()=>node('shell'),body:node('body'),hidden:false,addEventListener(){},createElement:()=>node(randomUUID())},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},console,crypto:{randomUUID},setTimeout:()=>0,clearTimeout(){},setInterval(){},addEventListener(){},confirm:()=>true,navigator:{onLine:true,locks:{request:async(_n,_o,f)=>f({})}},URL,Blob,TextEncoder};context.window=context;context.scrollTo=()=>{};
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
test("original 15-card source is byte-for-byte preserved",()=>{const block=app.match(/const starter=(\[.*?\n\]);/s)[1];assert.equal(require("node:crypto").createHash("sha256").update(block).digest("hex"),"4a1e004269785d38462a16c4d9fe293fcc6b7b1a0addd448ad9e07dadb2d80aa");});
