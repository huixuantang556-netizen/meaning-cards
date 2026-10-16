(function(){
if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
addEventListener('load',()=>{navigator.serviceWorker.register('./sw-secure.js',{scope:'./',updateViaCache:'none'}).then(reg=>{if(reg.waiting){const note=document.createElement('p');note.className='tip';note.textContent='有新的离线程序资源。请确认资料已保存后刷新页面。';document.querySelector('.shell').append(note);}}).catch(()=>{const note=document.createElement('p');note.className='tip';note.textContent='离线启动资源尚未准备好，请保持联网完成一次加载。';document.querySelector('.shell').append(note);});});
})();
