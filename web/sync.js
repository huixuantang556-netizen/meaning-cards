'use strict';
// Local-first, whole-library compare-and-swap. No privileged credentials.
(async function () {
  const $ = id => document.getElementById(id);
  const status = text => $('syncStatus').textContent = text;
  let client, user=null, state=null, busy=false, epoch=0, timer, conflictExported=false;
  const config=window.MEANING_CONFIG||{};
  const namespace='meaning-cloud-v1:'+config.supabaseUrl+':';
  const storageKey=()=>namespace+user.id;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const digest=x=>JSON.stringify(x);
  function validate(list){
    if(!Array.isArray(list)||list.length>5000||!list.every(c=>c&&typeof c.title==='string'&&typeof c.id==='string'))throw Error('卡片数据不兼容');
    if(new Set(list.map(c=>c.id)).size!==list.length)throw Error('卡片 ID 重复');
    if(JSON.stringify(list).length>1500000)throw Error('卡片库过大，请拆分备份');
    return list.map(normalized);
  }
  function persist(){
    try { localStorage.setItem(storageKey(),JSON.stringify(state)); }
    catch(e){status('本地保存失败，请立即导出 JSON 备份，并释放浏览器空间。');throw e;}
  }
  function refresh(){renderGrid();pickMorning();if(activeView==='data')setView('data');}
  function controls(){
    $('accountLabel').textContent=user?'当前账户：'+user.email:'未登录 · 本机卡片库';
    $('authFields').hidden=!!user;
    ['syncNow','copyGuest','logout'].forEach(id=>$(id).disabled=!user);
    $('conflictBox').hidden=!state?.conflict;
  }
  function showConflict(remote){
    state.conflict=clone(remote);persist();conflictExported=false;controls();
    status('同步冲突：本机修改已保留，请到「我的数据」处理两份版本。');
  }
  window.cloudSave=()=>{
    if(!user){try{localStorage.setItem(KEY,JSON.stringify({version:1,cards}));status('本机卡片已保存 · 未登录');return true;}catch(e){status('保存失败，请立即导出 JSON 备份。');return false;}}
    state.cards=clone(cards);state.dirty=true;state.op=crypto.randomUUID();
    try{persist();}catch{return false;}
    if(!state.conflict){status('本机已保存 · 等待同步');clearTimeout(timer);timer=setTimeout(sync,800);}
    return true;
  };
  async function sync(){
    // An open editor is a draft based on the current version. Do not replace it underneath the user.
    if(!client||!user||busy||state.conflict||editing||(document.getElementById('taskDialog')?.open||(!state.dirty&&window.thoughtEditing))||document.hidden)return;
    busy=true; const token=epoch, uid=user.id;
    try{
      status(navigator.onLine?'正在同步…':'离线 · 本机修改待联网同步');
      const {data,error}=await client.from('meaning_libraries').select('revision,cards,last_op').eq('user_id',uid).maybeSingle();
      if(error)throw error;if(token!==epoch)return;
      const remote=data||{revision:0,cards:[],last_op:null};remote.cards=validate(remote.cards);
      if(editing||(document.getElementById('taskDialog')?.open||(!state.dirty&&window.thoughtEditing)))return; // user opened editor while the fetch was pending
      if(state.dirty){
        if(remote.last_op===state.op){state.revision=remote.revision;state.dirty=false;persist();}
        else if(remote.revision!==state.revision){showConflict(remote);return;}
        else{
          const sent=clone(state), {data:result,error:writeError}=await client.rpc('save_meaning_library',{
            expected_revision:sent.revision,new_cards:sent.cards,operation_id:sent.op
          });
          if(writeError)throw writeError;if(token!==epoch)return;
          if(!result.ok){showConflict(result.current);return;}
          state.revision=result.current.revision;
          // A later local edit stays pending; acknowledging an older upload never clears it.
          if(state.op===sent.op)state.dirty=false;
          persist();
        }
      }else if(remote.revision!==state.revision){
        state.cards=remote.cards;state.revision=remote.revision;cards=clone(state.cards);persist();refresh();
      }
      status(state.dirty?'本机已保存 · 还有修改等待同步':'已同步 · '+new Date().toLocaleTimeString()+' · 每 15 秒检查');
    }catch(e){status('同步未完成，本机内容保留：'+(e.message||'请检查网络和配置'));}
    finally{busy=false;}
  }
  async function switchAccount(session){
    const next=session?.user||null;if(next?.id===user?.id)return;
    epoch++;window.meaningContext=epoch;closeReader();closeEditor();user=next;state=null;
    if(user){
      let cached=localStorage.getItem(storageKey());
      if(cached){try{state=JSON.parse(cached);state.cards=validate(state.cards);}catch{status('账户缓存无法读取。请保留浏览器数据，联系维护者恢复。');throw Error('invalid cache');}}
      else state={cards:[],revision:0,dirty:false,op:crypto.randomUUID(),conflict:null};
      cards=clone(state.cards);controls();refresh();if(state.conflict){status('存在未处理的同步冲突，请到「我的数据」查看。');}else await sync();
    }else{
      const local=localStorage.getItem(KEY);cards=local?JSON.parse(local).cards.map(normalized):defaultCards();controls();refresh();status('本机模式 · 未登录');
    }
  }
  // One editable tab per origin: prevents stale whole-library writes between browser tabs.
  if(!navigator.locks){
    status('此浏览器不支持安全的多标签页协调，云同步已禁用。请用最新版 Safari / Chrome 的 HTTPS 页面。');
    ['sendCode','verifyCode','syncNow','copyGuest','logout'].forEach(id=>$(id).disabled=true);return;
  }
  let acquired;
  const ready=new Promise(resolve=>acquired=resolve);
  navigator.locks.request('meaning-studio-editor',{ifAvailable:true},lock=>{
    acquired(!!lock);if(lock)return new Promise(()=>{});
  });
  if(!await ready){
    const blocker=document.createElement('div');blocker.className='overlay open';blocker.style.zIndex='100';
    const box=document.createElement('div');box.className='modal';box.textContent='另一个标签页正在使用卡片库。请关闭那个标签页，再刷新本页，以避免相互覆盖。';blocker.append(box);document.body.append(blocker);document.querySelector('.shell').inert=true;return;
  }
  controls();
  $('syncNow').onclick=sync;
  $('copyGuest').onclick=()=>{
    if(!user||state.conflict)return;
    if(!confirm('将本机卡片作为新卡片追加到账户？重复点击会再次复制。'))return;
    const local=JSON.parse(localStorage.getItem(KEY)||'{"cards":[]}');
    // Preserve internal task/card/override references when copying guest data.
    const ids=new Map(local.cards.map(c=>[c.id,uuid()]));
    const copied=local.cards.map(c=>{
      let meaning=c.meaning;
      if(c.tags?.includes('__meaning_v3__')){
        try{const x=JSON.parse(meaning);if(x.card&&ids.has(x.card))x.card=ids.get(x.card);if(x.task&&ids.has(x.task))x.task=ids.get(x.task);meaning=JSON.stringify(x);}catch{}
      }
      return normalized({...c,id:ids.get(c.id),meaning,...(c.thought?{thought:window.MeaningThought.remap(c.thought,ids)}:{})});
    });
    cards=[...copied,...cards];save();refresh();
  };
  $('exportConflict').onclick=()=>{
    download('冲突备份-'+Date.now()+'.json',JSON.stringify({format:'meaning-conflict-bundle',local:{cards:state.cards},cloud:{cards:state.conflict.cards},cloudRevision:state.conflict.revision},null,2));
    conflictExported=true;toast('两份版本已打包下载，请确认文件已保存');
  };
  function resolveConflict(useLocal){
    if(!state?.conflict)return;
    if(!conflictExported){toast('请先下载冲突两份备份');return;}
    if(!confirm('确认已保存冲突备份，并采用'+(useLocal?'本机':'云端')+'版本？未采用的内容可从冲突备份恢复。'))return;
    state.revision=state.conflict.revision;
    if(!useLocal)state.cards=validate(state.conflict.cards);
    state.conflict=null;state.dirty=useLocal;state.op=crypto.randomUUID();cards=clone(state.cards);persist();controls();refresh();sync();
  }
  $('useLocal').onclick=()=>resolveConflict(true);$('useCloud').onclick=()=>resolveConflict(false);
  if(!config.supabaseUrl||!config.publishableKey){
    status('本机模式 · 部署者填写 config.js 后可启用跨设备同步');
    $('sendCode').disabled=$('verifyCode').disabled=true;return;
  }
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl)||!config.publishableKey.startsWith('sb_publishable_')){
    status('同步配置无效：请使用 Supabase 项目 HTTPS 地址和 sb_publishable_ 公开键。');return;
  }
  try{
    const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.57.4');
    client=createClient(config.supabaseUrl,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:namespace+'auth'}});
    window.askThoughtAI=async(payload)=>{if(!user)throw Error('请先登录后使用 AI');const {data,error}=await client.functions.invoke('thought-partner',{body:payload});if(error)throw error;if(typeof data?.text!=='string')throw Error('AI 回复格式不正确');return data.text;};
    $('sendCode').onclick=async()=>{
      const email=$('email').value.trim();if(!$('email').checkValidity()||!email){toast('请输入有效邮箱');return;}
      $('sendCode').disabled=true;
      try{const {error}=await client.auth.signInWithOtp({email});if(error)throw error;toast('已发送，请查看邮箱中的验证码');}
      catch(e){status('验证码发送失败：'+e.message);}finally{$('sendCode').disabled=false;}
    };
    $('verifyCode').onclick=async()=>{
      $('verifyCode').disabled=true;
      try{const {data,error}=await client.auth.verifyOtp({email:$('email').value.trim(),token:$('otp').value.trim(),type:'email'});if(error)throw error;$('otp').value='';await switchAccount(data.session);}
      catch(e){status('登录失败：'+e.message);}finally{$('verifyCode').disabled=false;}
    };
    $('logout').onclick=async()=>{
      if(busy){toast('正在同步，请稍后退出');return;}
      if(state?.dirty||state?.conflict){toast('还有未同步内容或冲突，请先同步并处理冲突后退出');return;}
      const key=storageKey();const {error}=await client.auth.signOut({scope:'local'});if(error){status('退出失败：'+error.message);return;}
      localStorage.removeItem(key);await switchAccount(null);
    };
    client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>switchAccount(session).catch(e=>status(e.message)),0);});
    const {data,error}=await client.auth.getSession();if(error)throw error;await switchAccount(data.session);
    setInterval(sync,15000);addEventListener('online',sync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
    addEventListener('beforeunload',e=>{if(state?.dirty){e.preventDefault();e.returnValue='';}});
    if(!user)status('同步已配置 · 请到「我的数据」用邮箱登录');
  }catch(e){status('云同步加载失败，本机功能可继续使用：'+e.message);}
})();
