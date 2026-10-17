/* Optional trusted-device keys. No passphrases, exports or network operations. */
(function(root){'use strict';
function createStore(idb){
 async function open(){if(!idb)throw Error('当前浏览器不能记住解锁，请继续使用资料密码');return new Promise((resolve,reject)=>{const r=idb.open('meaning-trusted-device-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('keys');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('无法打开本机解锁存储'));r.onblocked=()=>reject(Error('本机解锁存储被其他页面占用'));});}
 async function run(mode,fn){const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('keys',mode);let value;const req=fn(tx.objectStore('keys'));req.onsuccess=()=>value=req.result;tx.oncomplete=()=>resolve(value);tx.onabort=tx.onerror=()=>reject(Error('无法更新本机解锁记录'));});}finally{db.close();}}
 return {async get(scope){const s=await run('readonly',o=>o.get(scope));if(!s)return null;if(s.version!==1||s.key?.type!=='secret'||s.key.extractable!==false||s.key.algorithm?.name!=='AES-GCM'||!(s.salt instanceof Uint8Array)||s.salt.length!==16)throw Error('本机解锁记录不兼容，请重新输入资料密码');return {key:s.key,salt:s.salt};},async put(scope,s){if(s.key?.extractable!==false)throw Error('仅允许保存不可导出的解锁密钥');await run('readwrite',o=>o.put({version:1,key:s.key,salt:new Uint8Array(s.salt)},scope));},async remove(scope){await run('readwrite',o=>o.delete(scope));}};
}
root.MeaningDeviceKeys={createStore};if(typeof module!=='undefined')module.exports=root.MeaningDeviceKeys;
})(typeof window==='undefined'?globalThis:window);
