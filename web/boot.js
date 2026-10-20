/* One startup surface, until the composed UI and initial auth check are ready. */
(function(){
'use strict';
let shell=false,auth=false,shown=false,failed=false;
function message(text){const el=document.getElementById('bootMessage');if(el)el.textContent=text;}
function reveal(){if(shown||failed||!shell||!auth)return;shown=true;requestAnimationFrame(()=>{document.documentElement.classList.remove('app-starting');document.getElementById('bootSplash')?.remove();document.dispatchEvent(new Event('meaningappready'));});}
window.MeaningBoot={authReady(){auth=true;reveal();},shellReady(){shell=true;reveal();}};
document.addEventListener('DOMContentLoaded',()=>{if(!failed){shell=true;reveal();}});
window.addEventListener('error',e=>{if(e.target?.tagName==='SCRIPT'||e.error){failed=true;message('页面组件未能完整加载。请保持联网后重新打开；资料没有被清理。');document.getElementById('bootReload')?.removeAttribute('hidden');}},true);
document.addEventListener('click',e=>{if(e.target.closest('#bootReload'))location.reload();});
setTimeout(()=>{if(!shown&&!failed){message('登录检查较慢，正在准备离线资料入口…');if(shell){if(typeof setView==='function')setView('data');auth=true;reveal();}}},12000);
})();
