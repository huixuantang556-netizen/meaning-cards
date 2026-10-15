/* 有意义地生活 V2 · 向后兼容扩展
 * 此文件在 config.js、app.js、sync.js 之后加载。
 * 不创建第二套数据库，新增的卡片、书信与观察记录使用旧版 cards 数组。
 */
(function () {
  'use strict';
  if (window.MEANING_V2_LOADED) return;
  window.MEANING_V2_LOADED = true;
  const $ = id => document.getElementById(id);
  if (typeof cards === 'undefined' || typeof save !== 'function' || !$('view-today') || !$('editMeaning')) {
    console.warn('Meaning V2: 未找到原版卡片应用，扩展未加载。');
    return;
  }
  const NOTE_TAG = '情绪私信';
  const OBS_TAG = '自我观察';
  const META_MARK = '\n\n【行为机制】';
  const meta = {
    '按时吃饭': ['手机容易带来即时满足，饥饿不强烈时就容易把吃饭一拖再拖。', '到了家里的日常饭点，或家人说可以吃饭时。', '提前知道厨房有什么现成食物；在餐桌旁吃，不边刷视频边拖延。'],
    '刷牙': ['上床刷屏后，离开被窝去洗手间的启动成本变高。', '早晨进入洗手间时，以及晚上准备上床之前。', '把牙刷和含氟牙膏放在伸手能拿到的位置；尽量先刷牙再躺下。'],
    '洗脸': ['在家不见人时，容易误以为只有被别人看到才有必要清洁。', '早晨第一次走进洗手间时。', '洗脸用品放在洗手台显眼处；只做皮肤需要的清洁。'],
    '温和洁面': ['一想到后续完整护肤流程就觉得麻烦，连洁面也不愿开始。', '晚上卸妆或清洗防晒时；依皮肤需要使用。', '固定放一种适合肤质的温和洁面产品，不必堆叠步骤。'],
    '准备睡觉': ['手机有即时奖励；“还需要听 ASMR”有时可能成为继续刷屏的理由。', '到你自己选定的睡前准备时段。', '先刷牙再上床；手机放在手够不到的位置，如需声音优先固定纯音频并设定停止。'],
    '洗头和洗澡': ['想到要准备毛巾、衣服和后续护理，可能让整个任务显得太大。', '计划洗澡的时段，或明显出汗、需要清洁时。', '先放好毛巾和干净衣服，降低开始的步骤数。'],
    '叠被子': ['睡醒以后立刻投入手机，被子就变成无关紧要的麻烦。', '双脚离开床铺之后。', '先拉平被面，不要求整理成照片里的样子。'],
    '出门散步': ['待在书房太久时，手机成了最省力的环境变化来源。', '午餐后、长时间坐着后，或发现思维停滞时。', '鞋子放在方便出门处；院子里走两分钟也算开始。'],
    '整理书桌': ['桌子同时承载游戏与学习，坐下可能自动进入旧的娱乐模式。', '准备开始一段学习或创作之前。', '让桌面只留下这次任务需要的材料；必要时换到另一处工作。'],
    '泡咖啡': ['把愉快的晨间仪式误当成额外负担。', '已经起床洗漱、想享用饮品时。', '杯子、咖啡与工具集中放好；别用咖啡代替正餐。'],
    '护肤': ['洗完澡一躺到床上、打开 QQ，就很难重新起身护理。', '洗澡擦干后、回到床上之前。', '把简单的保湿产品放在洗手台或毛巾旁；白天按需要防晒。'],
    '化妆': ['如果把化妆当成必须完整完成的任务，起步成本就很高。', '想尝试审美表达、穿搭之后。', '保留一两样最喜欢的单品；不用化妆也完全可以出门。'],
    '穿漂亮的衣服': ['长期居家时容易觉得“反正没人看”，忽略衣服对自己的感受。', '早晨洗漱后，准备开始白天的活动时。', '提前放好一套舒服、让自己精神的衣服。'],
    '喷香水': ['把香气误认为只有出门见人才能使用。', '想增添感官愉悦时，尤其换好衣服后。', '放在自己能看到的位置；注意香味敏感与使用场合。'],
    '放下手机': ['即时内容不断提供新刺激；偶尔会用“我需要查点东西”延长使用。', '发现自己连续刷屏、或身体出现吃饭洗漱等需求时。', '先把手机放在够不到的地方，站起来；不要求立刻戒掉所有娱乐。'],
    '涂身体乳': ['洗澡后直接躺到床上打开 QQ，想涂身体乳时就需要重新起身。', '洗澡后擦干身体、离开浴室之前。', '将按压式身体乳放在毛巾附近；干燥时先涂最需要的部位。']
  };
  const lotion = {
    title:'涂身体乳', category:'style', symbol:'🧴', tags:['肌肤舒适','顺手完成','温柔照料'],
    line:'我可以在离开浴室之前，把身体的舒适照顾好。',
    meaning:'身体乳可以缓解干燥并帮助维持皮肤舒适，尤其在皮肤干燥时。不是每个人都必须每天全身涂抹，按肤质和需要选择即可。',
    identity:'我愿意为自己的舒适安排顺手的小动作，不靠一次完美护理证明自己。',
    tiny:'洗澡擦干后，先在一处干燥皮肤上涂一点身体乳。',
    restart:'已经回床刷 QQ 也不代表失败；想涂可现在补涂，不方便就留给下次洗澡。'
  };
  const e = (s) => esc(String(s == null ? '' : s));
  function isLetter(c) { return Array.isArray(c?.tags) && c.tags.includes(NOTE_TAG); }
  function isObservation(c) { return Array.isArray(c?.tags) && c.tags.includes(OBS_TAG); }
  function isSpecial(c) { return isLetter(c) || isObservation(c); }
  function parseMeaning(value) {
    const full = String(value || '');
    const at = full.lastIndexOf(META_MARK);
    if (at === -1) return { base: full, mechanism:'', trigger:'', environment:'' };
    const rest = full.slice(at + 2);
    const m = rest.match(/^【行为机制】([\s\S]*?)\n【触发时机】([\s\S]*?)\n【环境安排】([\s\S]*)$/);
    return m ? { base:full.slice(0,at), mechanism:m[1], trigger:m[2], environment:m[3] }
             : { base:full, mechanism:'', trigger:'', environment:'' };
  }
  function composeMeaning(base, mechanism, trigger, environment) {
    const fields = [mechanism,trigger,environment].map(s=>String(s || '').trim().replace(/\s*\n\s*/g,' '));
    if (!fields.some(Boolean)) return base.trim();
    return base.trim() + '\n\n【行为机制】' + fields[0] + '\n【触发时机】' + fields[1] + '\n【环境安排】' + fields[2];
  }
  // 完全沿用现有 cloudSave/save/normalized：扩展字段以可读的文字形式存入 meaning。
  const extraEditor = document.createElement('div');
  extraEditor.className='v2-extra-editor';
  extraEditor.innerHTML=`<div class="v2-extra-title">从认知到行动 · 行为设计</div>
  <p class="tip">这些文字会随原有卡片一起备份和同步；不填写也没关系。</p>
  <div class="field"><label for="v2Mechanism">为什么平时难以做到？（行为机制）</label><textarea id="v2Mechanism" maxlength="200" placeholder="例如：洗澡后先躺下刷 QQ，就很难再起身。"></textarea></div>
  <div class="field"><label for="v2Trigger">触发时机</label><textarea id="v2Trigger" maxlength="160" placeholder="例如：洗澡后擦干身体、离开浴室之前。"></textarea></div>
  <div class="field"><label for="v2Environment">环境设计</label><textarea id="v2Environment" maxlength="160" placeholder="例如：身体乳放在毛巾旁，手机留在卧室。"></textarea></div>`;
  $('editMeaning').closest('.field').insertAdjacentElement('afterend',extraEditor);
  const originalEditCard = editCard;
  editCard = function(card) {
    const current = typeof card==='string' ? getCard(card) : card;
    originalEditCard(card);
    const bits = parseMeaning(current?.meaning || '');
    $('editMeaning').value = bits.base;
    $('v2Mechanism').value=bits.mechanism;
    $('v2Trigger').value=bits.trigger;
    $('v2Environment').value=bits.environment;
  };
  document.addEventListener('click',ev=>{
    if(!ev.target.closest('#saveCard') || !editing)return;
    const packed=composeMeaning($('editMeaning').value,$('v2Mechanism').value,$('v2Trigger').value,$('v2Environment').value);
    if(packed.length>1200){
      ev.preventDefault();ev.stopImmediatePropagation();
      toast('卡片文字过长（最多约 1200 字），请精简行为机制或实际价值。');return;
    }
    $('editMeaning').value=packed;
  },true);
  const originalOpenReader=openReader;
  openReader=function(id){
    originalOpenReader(id);
    const card=getCard(id);if(!card || isSpecial(card))return;
    const bits=parseMeaning(card.meaning);
    const read=$('readerBody');
    if(!bits.mechanism&&!bits.trigger&&!bits.environment)return;
    const p=read.querySelector('.reader-text');if(p)p.textContent=bits.base;
    const section=document.createElement('div');section.className='v2-reader-extras';
    section.innerHTML=`<div class="v2-small-head">理解阻力 · 设计下一步</div>
       ${bits.mechanism?`<p><strong>🧩 为什么难做</strong><span>${e(bits.mechanism)}</span></p>`:''}
       ${bits.trigger?`<p><strong>⏰ 行动触发器</strong><span>${e(bits.trigger)}</span></p>`:''}
       ${bits.environment?`<p><strong>🏡 环境设计</strong><span>${e(bits.environment)}</span></p>`:''}`;
    const before=read.querySelector('.reader-soft');
    before ? before.insertAdjacentElement('beforebegin',section) : read.append(section);
  };
  const oldPrompt=aiPrompt;
  aiPrompt=function(){return oldPrompt()+`\n\nV2 提示：可额外提供 "mechanism"（行为阻力）、"trigger"（触发时机）、"environment"（环境布置）三个字符串字段。卡片导入时会把它们转成可同步的卡片内容。`;};
  document.addEventListener('click',ev=>{
    if(!ev.target.closest('#importAI'))return;
    try {
      const input=$('aiJSON'), data=parseJSON(input.value), arr=Array.isArray(data)?data:Array.isArray(data?.cards)?data.cards:[data];
      if(!arr.length||arr.length>100)return;
      for(const item of arr){
        if(item && typeof item==='object' && (item.mechanism||item.trigger||item.environment)) {
          const full=composeMeaning(String(item.meaning||''),item.mechanism,item.trigger,item.environment);
          if(full.length>1200){toast('AI 卡片内容太长，请精简后导入');return;}
          item.meaning=full;
          delete item.mechanism;delete item.trigger;delete item.environment;
        }
      }
      input.value=JSON.stringify(data);
    } catch { /* 格式错误仍交给原版导入器报错 */ }
  },true);
  // 情绪私信与观察记录与原版卡片共用保存/备份/云同步机制，避免出现另一份不同步的私密数据。
  const oldGrid=renderGrid;
  renderGrid=function(){
    const original=cards;
    try{ cards=original.filter(c=>!isSpecial(c));oldGrid(); }
    finally{ cards=original; }
    queueMicrotask(refreshV2);
  };
  const oldMorning=pickMorning;
  pickMorning=function(){
    const original=cards;
    try{ cards=original.filter(c=>!isSpecial(c));oldMorning(); }
    finally{ cards=original; }
  };
  const oldSetView=setView;
  const v2Views=['haven','habits','journal'];
  setView=function(v){
    if(!v2Views.includes(v))return oldSetView(v);
    activeView=v;
    document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id==='view-'+v));
    document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active',el.dataset.view===v));
    refreshV2();window.scrollTo({top:0,behavior:'smooth'});
  };
  const nav=document.querySelector('.tabs');
  [['haven','♡ 情绪避风港'],['habits','🌱 原子习惯'],['journal','✎ 自我观察']].forEach(([key,label])=>{
    const b=document.createElement('button');b.type='button';b.className='tab';b.dataset.view=key;b.textContent=label;
    b.addEventListener('click',()=>setView(key));nav.append(b);
  });
  const states=document.createElement('div');states.className='v2-state';
  states.innerHTML=`<div class="eyebrow">MY CURRENT STATE · 不用测试，也不打分</div><h2>此刻，你想怎样被帮助？</h2>
  <p>可以只选一个入口，读一句话就去生活。不需要等到精神亢奋才允许自己行动。</p>
  <div class="v2-state-grid">
    <button type="button" data-state="fog">🌫️ <strong>头脑浑噩</strong><small>先让身体接触世界</small></button>
    <button type="button" data-state="phone">📱 <strong>被手机吸住</strong><small>恢复一点选择权</small></button>
    <button type="button" data-state="sad">🌧️ <strong>很难过</strong><small>先陪伴，不催促</small></button>
    <button type="button" data-state="alive">✨ <strong>思维很活跃</strong><small>把想法带进现实</small></button>
    <button type="button" data-state="normal">🌱 <strong>想照顾生活</strong><small>从一个小动作开始</small></button>
  </div><div class="v2-state-result" id="v2StateResult" hidden></div>`;
  $('view-today').insertAdjacentElement('afterbegin',states);
  const identities=document.createElement('section');identities.className='v2-identities';
  identities.innerHTML=`<div class="v2-identity-head"><strong>我想成为怎样的人？</strong><span>身份不是对今天表现的判决</span></div><div class="v2-role-buttons">
  <button type="button" data-role="explore">🔎 探索者</button><button type="button" data-role="create">✎ 创造者</button><button type="button" data-role="live">🌿 生活参与者</button><button type="button" data-role="care">♡ 身体照料者</button><button type="button" data-role="return">↗ 能够重新开始的人</button></div><p id="v2RoleText">我不需要用完美表现换取身份；一次分心也不会剥夺我的好奇心。</p>`;
  states.insertAdjacentElement('afterend',identities);
  identities.addEventListener('click',ev=>{const b=ev.target.closest('[data-role]');if(!b)return;
    const words={explore:'我愿意观察世界、提出问题。今天的好奇心可以从身边的一件小事开始。',create:'我可以把想法变成真实作品，即使一次只能推进很小的一步。',live:'我不只是屏幕前的旁观者。我可以走动、交流，感受这个世界的变化。',care:'照顾身体不是附加任务，而是让我有精力继续生活的基础。',return:'我允许自己被打断。重要的不是从不分心，而是可以重新选择下一步。'};
    $('v2RoleText').textContent=words[b.dataset.role];identities.querySelectorAll('[data-role]').forEach(x=>x.classList.toggle('chosen',x===b));
  });
  states.addEventListener('click',ev=>{
    const button=ev.target.closest('[data-state]');if(!button)return;
    const info={
      fog:['精神迟缓不代表你没有能力。先去窗边或院子里看看真实世界，愿意时再返回桌前。','出门散步'],
      phone:['你现在想玩手机，这是一种欲望，不一定是必须立刻满足的需求。先站起来，再决定。','放下手机'],
      sad:['你可以难过，不用马上分析原因或变得积极。先读一封写给自己的信。',null,'haven'],
      alive:['这种活跃感很珍贵。选一件想法，写下下一步，或直接开始一个真实的项目。',null,'journal'],
      normal:['今天不用证明自己优秀。先找一项现实生活里值得照顾的小事。',null,'habits']
    }[button.dataset.state];
    const box=$('v2StateResult');box.hidden=false;box.replaceChildren();
    const p=document.createElement('p');p.textContent=info[0];box.append(p);
    const b=document.createElement('button');b.type='button';b.className='btn primary';b.textContent='看看下一步 →';
    b.addEventListener('click',()=>{if(info[2])setView(info[2]);else{const item=cards.find(c=>c.title===info[1]);if(item)openReader(item.id);else setView('cards');}});
    box.append(b);
  });
  const main=document.querySelector('main');
  const haven=document.createElement('section');haven.className='view';haven.id='view-haven';
  haven.innerHTML=`<div class="page-head"><div class="kicker">A QUIET PLACE</div><h1>情绪避风港</h1><p>不必急着讲清楚为什么难过，也无需立刻积极。清醒时给自己的文字，可以在低谷时成为一点陪伴。</p></div>
  <div class="v2-layout"><div class="panel"><h2>此刻需要什么？</h2><div class="v2-choice">
   <button type="button" data-comfort="words">读一段温暖的话</button><button type="button" data-comfort="cry">只想哭一会儿</button><button type="button" data-comfort="return">愿意慢慢回来</button></div>
   <div class="v2-comfort" id="v2Comfort" aria-live="polite">今天的某一刻很难熬，不代表整个人生都失去了颜色。你现在可以什么都不解释。</div>
   <h3>自己写给自己的话</h3><div id="v2Letters" class="v2-saved-list"></div></div>
  <div class="panel"><h2>留给未来的自己</h2><p class="sub">只存入你自己的卡片库，不会自动发布到 GitHub。请先确认浏览器或云端保存状态。</p>
   <div class="field"><label for="v2LetterTitle">标题</label><input id="v2LetterTitle" maxlength="55" placeholder="例如：写给难过时的自己"></div>
   <div class="field"><label for="v2LetterKind">类型</label><select id="v2LetterKind"><option value="信">给自己的信</option><option value="诗">诗歌</option><option value="短句">温暖短句</option></select></div>
   <div class="field"><label for="v2LetterText">想留给自己的文字</label><textarea id="v2LetterText" maxlength="1200" rows="7" placeholder="请写下清醒时的你，想对悲伤时的自己说的话。"></textarea></div>
   <div class="v2-actions"><button class="btn primary" id="v2SaveLetter">保存这段话</button><button class="btn" id="v2ClearLetter">清空输入</button></div>
   <p class="tip">暂不上传语音文件：原云同步卡片库有容量限制。未来可以单独增加安全的私密语音存储。此处的语音朗读如果开放，也不等于你本人的录音。</p>
  </div></div><div class="v2-bottom-hint">如果悲伤强烈到难以照顾自己，或者经常持续很久，请考虑向信任的人和心理健康专业人员寻求支持。这里是辅助工具，不是诊断或治疗。</div>`;
  main.append(haven);
  let selectedLetter=null;
  haven.addEventListener('click',ev=>{
    const choice=ev.target.closest('[data-comfort]');if(!choice)return;
    const messages={
      words:'你曾经感受过教室里的活力，也感受过散步时世界的辽阔。此刻的悲伤是真的，过去那些温暖也是真的。它们可以同时存在。',
      cry:'可以哭。现在不需要总结、复盘或找出正确答案。试着靠在舒服的位置，喝一点水；愿意的话，联系一个值得信任的人。',
      return:'不必一下子走向整个世界。看看窗外的一棵树，走几步，吃一点东西，或继续休息。任何一个选择都不代表你是否足够坚强。'
    };
    $('v2Comfort').textContent=messages[choice.dataset.comfort];
    haven.querySelectorAll('[data-comfort]').forEach(x=>x.classList.toggle('chosen',x===choice));
  });
  $('v2SaveLetter').addEventListener('click',()=>{
    const title=$('v2LetterTitle').value.trim(), body=$('v2LetterText').value.trim(), kind=$('v2LetterKind').value;
    if(!title||!body){toast('先写下标题和想保存的文字');return;}
    const item=normalized({id:selectedLetter||uuid(),title,category:'energy',symbol:'💌',tags:[NOTE_TAG,kind],line:body.slice(0,180),meaning:body,identity:'这是清醒时的我留给自己的话。',tiny:'想读的时候，打开这封信。',restart:'今天读不进去也没关系。',favorite:false});
    const i=cards.findIndex(c=>c.id===item.id);if(i>=0){item.favorite=cards[i].favorite;cards[i]=item;}else cards.unshift(item);
    save();selectedLetter=null;$('v2LetterTitle').value='';$('v2LetterText').value='';refreshV2();toast('已保存到个人卡片库，云同步状态请看页面顶部');
  });
  $('v2ClearLetter').addEventListener('click',()=>{selectedLetter=null;$('v2LetterTitle').value='';$('v2LetterText').value='';});
  $('v2Letters').addEventListener('click',ev=>{
    const btn=ev.target.closest('[data-letter-action]');if(!btn)return;
    const c=getCard(btn.dataset.id);if(!c||!isLetter(c))return;
    if(btn.dataset.letterAction==='read'){
      const box=$('v2Comfort');box.replaceChildren();const h=document.createElement('h3');h.textContent=c.title;const p=document.createElement('p');p.style.whiteSpace='pre-wrap';p.textContent=c.meaning;box.append(h,p);
    } else if(btn.dataset.letterAction==='edit') {
      selectedLetter=c.id;$('v2LetterTitle').value=c.title;$('v2LetterText').value=c.meaning;
      $('v2LetterKind').value=c.tags.includes('诗')?'诗':c.tags.includes('短句')?'短句':'信';$('v2LetterText').focus();
    } else if(btn.dataset.letterAction==='delete') {
      if(!confirm('确定删除这段私人文字？删除会同步到其他设备，建议先导出备份。'))return;
      cards=cards.filter(x=>x.id!==c.id);save();refreshV2();toast('已删除私人文字');
    }
  });
  const habits=document.createElement('section');habits.className='view';habits.id='view-habits';
  habits.innerHTML=`<div class="page-head"><div class="kicker">FROM MEANING TO ACTION</div><h1>原子习惯实验室</h1><p>先理解为什么值得做，再观察真实阻力，给行为安排触发时机、环境和最小行动。没有连续打卡，也不会给“失败”扣分。</p></div>
    <div class="panel"><div class="v2-actions"><button class="btn primary" id="v2Enrich">为已有卡片补充行为设计示例</button><button class="btn" id="v2GoCards">回认知卡片库</button></div>
    <p class="tip">仅对没有行为设计的卡片添加文字，并补一张「涂身体乳」卡。不会覆盖你已经编辑过的实际价值或身份宣言。修改前请先在「我的数据」导出备份。</p></div>
    <div class="v2-habits" id="v2HabitList"></div>`;
  main.append(habits);
  $('v2GoCards').addEventListener('click',()=>setView('cards'));
  $('v2Enrich').addEventListener('click',()=>{
    if(!confirm('建议先到「我的数据」导出 JSON 备份。现在只为尚无行为设计的卡片补充示例，并补充身体乳卡片，是否继续？'))return;
    let count=0, skipped=0;
    for(const card of cards){
      if(isSpecial(card) || !meta[card.title])continue;
      const bits=parseMeaning(card.meaning);if(bits.mechanism||bits.trigger||bits.environment)continue;
      const m=meta[card.title], packed=composeMeaning(bits.base,...m);
      if(packed.length>1200){skipped++;continue;}
      card.meaning=packed;count++;
    }
    if(!cards.some(c=>c.title==='涂身体乳')){
      const c=normalized({...lotion,id:uuid()});c.meaning=composeMeaning(c.meaning,...meta['涂身体乳']);cards.unshift(c);count++;
    }
    if(count)save();renderGrid();pickMorning();refreshV2();
    toast('已补充 '+count+' 张卡片'+(skipped?'；'+skipped+' 张过长未修改':''));
  });
  $('v2HabitList').addEventListener('click',ev=>{
    const b=ev.target.closest('[data-habit]');if(!b)return;
    const c=getCard(b.dataset.habit);if(!c)return;
    if(b.dataset.action==='edit')editCard(c.id);else openReader(c.id);
  });
  const journal=document.createElement('section');journal.className='view';journal.id='view-journal';
  journal.innerHTML=`<div class="page-head"><div class="kicker">NOTICE · LEARN · ADJUST</div><h1>自我观察</h1><p>不是情绪流水账，也不是成绩单。记录“发生了什么、发现了什么、下次想试什么”，把生活经验变成温和的实验。</p></div>
  <div class="v2-layout"><div class="panel"><h2>记录一件小事</h2>
    <div class="field"><label for="v2What">发生了什么？</label><textarea id="v2What" maxlength="400" placeholder="例如：洗完澡躺在床上打开 QQ，忘了身体乳。"></textarea></div>
    <div class="field"><label for="v2Found">我观察到了什么？</label><textarea id="v2Found" maxlength="400" placeholder="例如：一旦先躺下，重新起身变得困难。"></textarea></div>
    <div class="field"><label for="v2Next">下次想尝试什么？</label><textarea id="v2Next" maxlength="300" placeholder="例如：把身体乳放在毛巾旁，先涂再回床。"></textarea></div>
    <div class="v2-actions"><button class="btn primary" id="v2SaveObs">保存观察</button><button class="btn" id="v2ClearObs">清空</button></div><p class="tip">不记录分数和连续天数。保存的观察也会包含在原版 JSON 备份及账户卡片库中。</p>
  </div><div class="panel"><h2>最近的发现</h2><div id="v2Observations" class="v2-saved-list"></div></div></div>`;
  main.append(journal);
  $('v2SaveObs').addEventListener('click',()=>{
    const what=$('v2What').value.trim(),found=$('v2Found').value.trim(),next=$('v2Next').value.trim();
    if(!what){toast('先写下发生了什么');return;}
    const text=`发生了什么：${what}\n\n我发现：${found||'暂时还不确定'}\n\n下次试试：${next||'可以先不决定'}`;
    if(text.length>1200){toast('记录过长，请稍微精简');return;}
    cards.unshift(normalized({id:uuid(),title:'观察 · '+new Date().toLocaleDateString('zh-CN')+' · '+what.slice(0,16),category:'energy',symbol:'📖',tags:[OBS_TAG],line:what.slice(0,180),meaning:text,identity:'我在认识自己的行为规律，不是评判今天的表现。',tiny:next||'下一次再观察。',restart:'这是一份观察，不存在失败。'}));
    save();['v2What','v2Found','v2Next'].forEach(id=>$(id).value='');refreshV2();toast('观察已保存');
  });
  $('v2ClearObs').addEventListener('click',()=>['v2What','v2Found','v2Next'].forEach(id=>$(id).value=''));
  $('v2Observations').addEventListener('click',ev=>{
    const b=ev.target.closest('[data-obs]');if(!b)return;const c=getCard(b.dataset.obs);if(!c||!isObservation(c))return;
    if(b.dataset.action==='view'){
      const panel=document.createElement('div');panel.className='v2-obs-detail';panel.textContent=c.meaning;
      const old=$('v2Observations').querySelector('.v2-obs-detail');if(old)old.remove();b.closest('.v2-list-row').insertAdjacentElement('afterend',panel);
    }else if(b.dataset.action==='convert'){
      const draft=normalized({id:uuid(),title:'从观察中建立新习惯',category:'energy',symbol:'🌱',tags:['从观察到行动','行为实验'],line:'我愿意用环境设计帮助行动发生。',meaning:'基于一则观察：'+c.line.slice(0,110),identity:'我能够通过小实验慢慢了解自己，而不是要求每次都成功。',tiny:c.tiny,restart:'效果不好也只是得到了一条新信息。'});
      draft.meaning=composeMeaning(draft.meaning,c.meaning.slice(0,140),'','');editCard(draft);
    }else if(b.dataset.action==='delete'){
      if(!confirm('删除这则观察？删除会同步到其他设备，建议先备份。'))return;
      cards=cards.filter(x=>x.id!==c.id);save();refreshV2();toast('已删除观察');
    }
  });
  // 给新版数据区增加说明，不改动原来的备份与云同步流程。
  const note=document.createElement('p');note.className='tip v2-data-note';
  note.textContent='V2 兼容提醒：情绪私信、行为设计、自我观察都保存在现有卡片库，随「下载 JSON 备份」一起保存。使用「恢复最初示例卡片」会替换并删除这些个人数据，请先备份。此网站若未配置 Supabase，手机和电脑不会自动同步。';
  $('view-data').querySelector('.page-head').append(note);
  function refreshV2(){
    const letters=cards.filter(isLetter),observations=cards.filter(isObservation);
    if($('v2Letters')) $('v2Letters').innerHTML=letters.length ? letters.slice(0,30).map(c=>
       `<div class="v2-list-row"><div><strong>${e(c.title)}</strong><small>${e(c.tags[1]||'信')}</small></div><div class="v2-row-actions"><button type="button" data-letter-action="read" data-id="${e(c.id)}">阅读</button><button type="button" data-letter-action="edit" data-id="${e(c.id)}">修改</button><button type="button" data-letter-action="delete" data-id="${e(c.id)}">删除</button></div></div>`).join('') : '<p class="tip">还没有私人信件。你可以先读上面的温暖文字，或者为未来的自己留一段话。</p>';
    if($('v2Observations')) $('v2Observations').innerHTML=observations.length ? observations.slice(0,25).map(c=>
       `<div class="v2-list-row"><div><strong>${e(c.title)}</strong><small>${e(c.line.slice(0,45))}</small></div><div class="v2-row-actions"><button type="button" data-action="view" data-obs="${e(c.id)}">展开</button><button type="button" data-action="convert" data-obs="${e(c.id)}">转习惯</button><button type="button" data-action="delete" data-obs="${e(c.id)}">删除</button></div></div>`).join('') : '<p class="tip">还没有记录。可以从今天发现的一个小规律开始。</p>';
    if($('v2HabitList')){
      const items=cards.filter(c=>!isSpecial(c));
      $('v2HabitList').innerHTML=items.length ? items.map(c=>{
        const bits=parseMeaning(c.meaning);
        return `<article class="v2-habit"><div class="v2-habit-top"><div><span class="v2-emoji">${e(c.symbol)}</span><strong>${e(c.title)}</strong></div><span class="v2-tag">${bits.trigger?'已设计触发器':'待探索触发器'}</span></div>
        <p><b>最小行动</b>${e(c.tiny)}</p><p><b>触发时机</b>${e(bits.trigger || '尚未设定，可以从自己的生活场景观察。')}</p>
        <p><b>环境线索</b>${e(bits.environment || '尚未设定。')}</p>
        <div class="v2-row-actions"><button type="button" data-habit="${e(c.id)}" data-action="read">阅读意义</button><button type="button" data-habit="${e(c.id)}" data-action="edit">完善设计</button></div></article>`;
      }).join('') : '<p class="tip">还没有认知卡片，先去创建一张。</p>';
    }
  }
  renderGrid();pickMorning();refreshV2();
})();
