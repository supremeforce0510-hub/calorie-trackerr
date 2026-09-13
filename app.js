(() => {
  'use strict';

  const STORAGE_KEY = 'calorieTrackMVP_v1';
  const $ = id => document.getElementById(id);

  function todayLocal(){
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0,10);
  }

  function defaultState(){
    return {
      settings:{calorieGoal:1800, proteinGoal:100, endGoalWeight:'', theme:'purple', reminderEnabled:false, reminderTime:'19:00'},
      profile:{age:'', sex:'', height:'', weight:'', activity:'sedentary'},
      days:{},
      engagement:{usedDates:[], celebratedMilestones:[]},
      favorites:[]
    };
  }

  function loadState(){
    const fallback = defaultState();
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return fallback;
      const parsed = JSON.parse(raw);
      return {
        settings:{
          calorieGoal:Number(parsed?.settings?.calorieGoal) || 1800,
          proteinGoal:Number(parsed?.settings?.proteinGoal) || 100,
          endGoalWeight:parsed?.settings?.endGoalWeight ?? '',
          theme:['purple','green','red','gold'].includes(parsed?.settings?.theme) ? parsed.settings.theme : 'purple',
          reminderEnabled:Boolean(parsed?.settings?.reminderEnabled),
          reminderTime:/^\d{2}:\d{2}$/.test(parsed?.settings?.reminderTime || '') ? parsed.settings.reminderTime : '19:00'
        },
        profile:{
          age:parsed?.profile?.age ?? '',
          sex:parsed?.profile?.sex ?? '',
          height:parsed?.profile?.height ?? '',
          weight:parsed?.profile?.weight ?? '',
          activity:parsed?.profile?.activity || 'sedentary'
        },
        days:parsed?.days && typeof parsed.days === 'object' ? parsed.days : {},
        engagement:{
          usedDates:Array.isArray(parsed?.engagement?.usedDates) ? parsed.engagement.usedDates.filter(v => /^\d{4}-\d{2}-\d{2}$/.test(String(v))) : [],
          celebratedMilestones:Array.isArray(parsed?.engagement?.celebratedMilestones) ? parsed.engagement.celebratedMilestones : []
        },
        favorites:Array.isArray(parsed?.favorites) ? parsed.favorites : []
      };
    }catch(_){
      return fallback;
    }
  }

  const state = loadState();

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }


  function parseLocalDate(dateString){
    const parts = String(dateString).split('-').map(Number);
    return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1, 12, 0, 0, 0);
  }

  function localDateString(date){
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2,'0');
    const d = String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }

  function addDays(dateString, amount){
    const d = parseLocalDate(dateString);
    d.setDate(d.getDate() + amount);
    return localDateString(d);
  }

  function dateDiffDays(a, b){
    const da = parseLocalDate(a);
    const db = parseLocalDate(b);
    return Math.round((db - da) / 86400000);
  }

  function inferHistoricalUsageDates(){
    return Object.keys(state.days || {}).filter(date => {
      const day = state.days[date];
      return Array.isArray(day?.foods) && day.foods.length > 0 ||
             Array.isArray(day?.weights) && day.weights.length > 0;
    });
  }

  function recordAppOpen(){
    if(!state.engagement || typeof state.engagement !== 'object'){
      state.engagement = {usedDates:[]};
    }
    if(!Array.isArray(state.engagement.usedDates)){
      state.engagement.usedDates = [];
    }

    // On the first version with streak tracking, preserve real prior usage
    // when a day already contains logged food or weight data.
    if(state.engagement.usedDates.length === 0){
      state.engagement.usedDates = inferHistoricalUsageDates();
    }

    const today = todayLocal();
    if(!state.engagement.usedDates.includes(today)){
      state.engagement.usedDates.push(today);
    }

    state.engagement.usedDates = [...new Set(state.engagement.usedDates)]
      .filter(v => /^\d{4}-\d{2}-\d{2}$/.test(v))
      .sort();

    saveState();
  }

  function currentStreakInfo(){
    const today = todayLocal();
    const used = new Set(state.engagement?.usedDates || []);
    let count = 0;
    let cursor = today;

    while(used.has(cursor)){
      count++;
      cursor = addDays(cursor,-1);
    }

    const currentDates = new Set();
    for(let i=0;i<count;i++){
      currentDates.add(addDays(today,-i));
    }

    const previousDates = (state.engagement?.usedDates || []).filter(d => d < today);
    const previousLatest = previousDates.length ? previousDates[previousDates.length - 1] : null;
    const brokeBeforeToday = previousLatest ? dateDiffDays(previousLatest,today) > 1 : false;

    return {count,currentDates,brokeBeforeToday,previousLatest};
  }

  function streakTier(count){
    if(count > 15) return 'green';
    if(count >= 5) return 'purple';
    return 'red';
  }

  function quoteForDate(dateString){
    const quotes = [
      'Small choices stack up. Keep showing up.',
      'Consistency beats perfection every single time.',
      'One good day becomes a pattern when you repeat it.',
      'Your future self is built by what you do today.',
      'Progress counts even when it feels small.',
      'Keep the promise you made to yourself today.',
      'You do not need a perfect day — just a present one.',
      'Every check-in is proof that you are still moving forward.',
      'The goal is not flawless. The goal is consistent.',
      'A little effort today is still momentum.',
      'Keep collecting days. The results will follow.',
      'You are building the habit every time you come back.',
      'Show up today. Let tomorrow worry about tomorrow.',
      'The streak is the reminder — you are the reason.',
      'One day at a time is still a real plan.',
      'Do the next small thing and let it count.'
    ];
    let hash = 0;
    for(const ch of dateString) hash = ((hash * 31) + ch.charCodeAt(0)) >>> 0;
    return quotes[hash % quotes.length];
  }

  function num(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function format1(n){
    return Math.round((num(n) + Number.EPSILON) * 10) / 10;
  }

  function latestLoggedWeight(){
    const all = [];
    Object.values(state.days || {}).forEach(day => {
      (day?.weights || []).forEach(w => all.push(w));
    });
    if(!all.length) return null;
    all.sort((a,b) => num(b.createdAt) - num(a.createdAt));
    return num(all[0].value) || null;
  }

  function formatDurationWeeks(weeks){
    if(!Number.isFinite(weeks) || weeks <= 0) return '—';
    if(weeks < 8) return Math.ceil(weeks) + ' wk';
    const months = weeks / 4.345;
    if(months < 18) return format1(months) + ' mo';
    return format1(months / 12) + ' yr';
  }

  function calculateGoalEstimate(currentWeight, targetWeight, calorieGoal){
    currentWeight = num(currentWeight);
    targetWeight = num(targetWeight);
    calorieGoal = num(calorieGoal);

    if(currentWeight <= 0 || targetWeight <= 0 || calorieGoal <= 0){
      return {
        difference:null,
        weeks:null,
        timeLabel:'—',
        targetDateLabel:'—',
        note:'Enter current weight, goal weight, and a daily calorie goal.'
      };
    }

    const difference = Math.abs(currentWeight - targetWeight);

    if(difference === 0){
      return {
        difference:0,
        weeks:0,
        timeLabel:'Reached',
        targetDateLabel:'Now',
        note:'Your current weight matches your goal weight.'
      };
    }

    // Consistent planning estimate from the inputs available in this MVP.
    // Estimated maintenance = current weight × 14 calories/day.
    // 3,500 calories ≈ 1 lb of body-weight change.
    // Loss is capped at 2 lb/week and gain at 1 lb/week.
    const estimatedMaintenance = currentWeight * 14;
    const losing = targetWeight < currentWeight;
    const dailyGap = losing
      ? estimatedMaintenance - calorieGoal
      : calorieGoal - estimatedMaintenance;

    if(dailyGap <= 0){
      return {
        difference,
        weeks:null,
        timeLabel:'No progress',
        targetDateLabel:'—',
        note: losing
          ? 'At this calorie goal, this estimate does not create a calorie deficit.'
          : 'At this calorie goal, this estimate does not create a calorie surplus.'
      };
    }

    const rawWeeklyChange = dailyGap * 7 / 3500;
    const weeklyChange = losing
      ? Math.min(rawWeeklyChange, 2)
      : Math.min(rawWeeklyChange, 1);

    if(weeklyChange <= 0){
      return {
        difference,
        weeks:null,
        timeLabel:'No estimate',
        targetDateLabel:'—',
        note:'The estimate could not be calculated from these values.'
      };
    }

    const weeks = difference / weeklyChange;
    const days = Math.ceil(weeks * 7);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    const targetDateLabel = targetDate.toLocaleDateString([], {
      month:'short',
      day:'numeric',
      year:'numeric'
    });

    return {
      difference,
      weeks,
      timeLabel:formatDurationWeeks(weeks),
      targetDateLabel,
      note:'Estimate uses your calorie goal, estimated maintenance calories, and the 3,500-calorie-per-pound rule. Actual results vary.'
    };
  }

  function liveCurrentWeight(){
    const typed = num($('weightValue')?.value);
    return typed > 0 ? typed : latestLoggedWeight();
  }

  function liveGoalWeight(){
    const typed = num($('endGoalWeight')?.value);
    return typed > 0 ? typed : num(state.settings.endGoalWeight);
  }

  function updateGoalEstimateLive(){
    const current = liveCurrentWeight();
    const target = liveGoalWeight();
    const calorieGoal = num($('calorieGoal')?.value) || num(state.settings.calorieGoal) || 1800;
    const estimate = calculateGoalEstimate(current, target, calorieGoal);

    $('goalCurrent').textContent = current ? format1(current) + ' lb' : '—';
    $('goalTarget').textContent = target ? format1(target) + ' lb' : '—';
    $('goalDifference').textContent =
      estimate.difference === null ? '—' : format1(estimate.difference) + ' lb';
    $('goalTime').textContent = (estimate.targetDateLabel && estimate.targetDateLabel !== '—' && estimate.targetDateLabel !== 'Now') ? estimate.timeLabel + ' • ' + estimate.targetDateLabel : estimate.timeLabel;
    $('goalEstimateNote').textContent = estimate.note;
  }

  function escapeHtml(text){
    return String(text).replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    })[m]);
  }

  function selectedDate(){
    return $('selectedDate').value || todayLocal();
  }

  function friendlyDate(dateString){
    return new Date(dateString + 'T12:00:00').toLocaleDateString([], {
      weekday:'short', month:'short', day:'numeric'
    });
  }

  function getDay(date){
    if(!state.days[date]) state.days[date] = {foods:[],weights:[],note:'',mood:0,hunger:0};
    if(!Array.isArray(state.days[date].foods)) state.days[date].foods = [];
    if(!Array.isArray(state.days[date].weights)) state.days[date].weights = [];
    if(typeof state.days[date].note !== 'string') state.days[date].note = '';
    state.days[date].mood = num(state.days[date].mood);
    state.days[date].hunger = num(state.days[date].hunger);
    return state.days[date];
  }



  function allWeights(){
    const a=[]; Object.entries(state.days||{}).forEach(([date,d])=>(d?.weights||[]).forEach(w=>a.push({...w,date})));
    return a.sort((x,y)=>(num(x.createdAt)||parseLocalDate(x.date).getTime())-(num(y.createdAt)||parseLocalDate(y.date).getTime()));
  }
  function longestStreak(){
    const d=[...new Set(state.engagement?.usedDates||[])].sort(); if(!d.length)return 0;
    let best=1,run=1; for(let i=1;i<d.length;i++){run=dateDiffDays(d[i-1],d[i])===1?run+1:1;best=Math.max(best,run)} return best;
  }
  function weekDates(offset=0){let m=mondayOfWeek(todayLocal());m=addDays(m,offset*7);return Array.from({length:7},(_,i)=>addDays(m,i))}
  function weekStats(ds){
    const used=new Set(state.engagement?.usedDates||[]), today=todayLocal();
    const tracked=ds.filter(x=>x<=today&&(used.has(x)||(state.days?.[x]?.foods?.length||0)||(state.days?.[x]?.weights?.length||0)));
    let cal=0,pro=0;tracked.forEach(x=>(state.days?.[x]?.foods||[]).forEach(f=>{cal+=num(f.calories);pro+=num(f.protein)}));
    const ww=allWeights().filter(w=>ds.includes(w.date));
    return {days:tracked.length,cal:tracked.length?cal/tracked.length:0,pro:tracked.length?pro/tracked.length:0,w:ww.length>1?num(ww.at(-1).value)-num(ww[0].value):null};
  }
  function renderChart(a){
    const svg=$('weightChart'); if(!a.length){svg.innerHTML='<text x="320" y="95" text-anchor="middle" fill="#94a3b8">Log weight to build your trend</text>';$('chartRange').textContent='No weigh-ins yet';return}
    const vals=a.map(x=>num(x.value)),lo=Math.min(...vals),hi=Math.max(...vals),spread=Math.max(2,hi-lo),pad=28,W=640,H=185;
    const pts=a.map((w,i)=>({x:a.length===1?W/2:pad+i*(W-pad*2)/(a.length-1),y:H-pad-((num(w.value)-lo)/spread)*(H-pad*2),w}));
    svg.innerHTML=`<polyline points="${pts.map(p=>p.x+','+p.y).join(' ')}" fill="none" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>${pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="5" fill="#a855f7"><title>${p.w.date}: ${format1(p.w.value)} lb</title></circle>`).join('')}`;
    $('chartRange').textContent=`${friendlyDate(a[0].date)} → ${friendlyDate(a.at(-1).date)}`;
  }
  function renderDashboard(){
    const w=allWeights(),start=w.length?num(w[0].value):0,current=w.length?num(w.at(-1).value):0,goal=num(state.settings.endGoalWeight),st=currentStreakInfo().count,best=longestStreak();
    $('dashStart').textContent=start?format1(start)+' lb':'—';$('dashCurrent').textContent=current?format1(current)+' lb':'—';$('dashGoal').textContent=goal?format1(goal)+' lb':'—';$('dashStreak').textContent=st;$('dashBest').textContent=best;
    $('dashChange').textContent=start&&current?((current-start>0?'+':'')+format1(current-start)+' lb'):'—';
    let rem=null,p=0;if(start&&current&&goal){rem=Math.abs(current-goal);const total=Math.abs(start-goal);p=total?Math.max(0,Math.min(100,(1-rem/total)*100)):100}
    $('ringRemaining').textContent=rem===null?'—':format1(rem)+' lb';$('goalRing').style.setProperty('--p',p+'%');$('dashMessage').textContent=current&&goal?`${format1(rem)} lb to goal • ${st} day${st===1?'':'s'} streak`:'Log weight and a goal to fill your progress ring.';renderChart(w.slice(-30));
  }
  function renderWeek(){
    const a=weekDates(0),b=weekDates(-1),x=weekStats(a),y=weekStats(b);$('weekRange').textContent=`${friendlyDate(a[0])} – ${friendlyDate(a[6])}`;$('weekDays').textContent=x.days;$('weekCalories').textContent=Math.round(x.cal);$('weekProtein').textContent=format1(x.pro)+'g';$('weekWeight').textContent=x.w===null?'—':(x.w>0?'+':'')+format1(x.w)+' lb';$('weekStreak').textContent=currentStreakInfo().count;
    $('weekCompare').textContent=y.days?`Last week comparison: ${Math.abs(Math.round(x.cal-y.cal))} ${x.cal>=y.cal?'more':'fewer'} avg calories • ${Math.abs(format1(x.pro-y.pro))}g ${x.pro>=y.pro?'more':'less'} avg protein.`:'Your comparison will build as you log more weeks.';
  }
  function renderFavs(){
    const f=(state.favorites||[]).slice().sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0) || String(a.name).localeCompare(String(b.name)));
    $('favList').innerHTML=f.length?f.map(x=>`<div class="fav-item"><div><b>${x.pinned?'📌 ':''}${escapeHtml(x.name)}</b><div class="log-meta">${escapeHtml(x.meal)} • ${Math.round(num(x.calories))} cal • ${format1(x.protein)}g protein</div></div><div class="fav-actions"><button class="pin-btn ${x.pinned?'pinned':''}" data-fav-pin="${x.id}">${x.pinned?'Unpin':'Pin'}</button><button data-fav-add="${x.id}">Add Again</button><button class="danger" data-fav-del="${x.id}">Delete</button></div></div>`).join(''):'<div class="empty">No favorites yet.</div>';
  }
  let mileTimer;
  function celebrate(title,msg,key){state.engagement.celebratedMilestones=state.engagement.celebratedMilestones||[];if(state.engagement.celebratedMilestones.includes(key))return;state.engagement.celebratedMilestones.push(key);saveState();const p=$('milestonePop');p.innerHTML=`<strong>🏆 ${escapeHtml(title)}</strong>${escapeHtml(msg)}`;p.classList.add('show');clearTimeout(mileTimer);mileTimer=setTimeout(()=>p.classList.remove('show'),4200)}
  function checkMilestones(){const w=allWeights();if(w.length>1){const lost=num(w[0].value)-num(w.at(-1).value);[5,10,15,25,50].forEach(m=>{if(lost>=m)celebrate(`${m} lb milestone!`,`You've moved ${m} pounds from your starting weight.`,'loss-'+m)});const g=num(state.settings.endGoalWeight);if(g&&Math.abs(num(w.at(-1).value)-g)<.05)celebrate('Goal reached!','You reached your saved goal weight.','goal-'+g)}const st=currentStreakInfo().count;[7,15,30,60,100].forEach(m=>{if(st>=m)celebrate(`${m}-day streak!`,'You kept showing up.','streak-'+m)})}

  function allFoodHistory(){
    const rows=[];
    Object.entries(state.days||{}).forEach(([date,d])=>(d?.foods||[]).forEach(f=>rows.push({...f,date})));
    return rows.sort((a,b)=>num(b.createdAt)-num(a.createdAt));
  }

  function renderFoodSearch(){
    const box=$('foodSearchResults'); if(!box) return;
    const q=$('foodSearchInput').value.trim().toLowerCase();
    if(!q){box.innerHTML='<div class="tiny" style="padding-top:8px">Type a food name to search your history.</div>';return}
    const rows=allFoodHistory().filter(f=>String(f.name).toLowerCase().includes(q)).slice(0,20);
    box.innerHTML=rows.length?rows.map(f=>`<div class="search-item"><div><b>${escapeHtml(f.name)}</b><div class="log-meta">${friendlyDate(f.date)} • ${escapeHtml(f.meal)} • ${Math.round(num(f.calories))} cal</div></div><button type="button" data-search-add="${f.id}" data-search-date="${f.date}">Add Again</button></div>`).join(''):'<div class="empty">No matching foods found.</div>';
  }

  function renderCheckin(){
    const day=getDay(selectedDate());
    $('dayNote').value=day.note||'';
    const make=(id,value)=>{$(id).innerHTML=[1,2,3,4,5].map(n=>`<button type="button" data-scale="${n}" class="${num(value)===n?'selected':''}">${n}</button>`).join('')};
    make('moodButtons',day.mood); make('hungerButtons',day.hunger);
  }

  function renderMonthlySummary(){
    const today=parseLocalDate(todayLocal()), y=today.getFullYear(), m=today.getMonth();
    const prefix=`${y}-${String(m+1).padStart(2,'0')}-`;
    const used=new Set(state.engagement?.usedDates||[]);
    const dates=[...new Set([...Object.keys(state.days||{}),...(state.engagement?.usedDates||[])])].filter(d=>d.startsWith(prefix)).sort();
    const tracked=dates.filter(d=>used.has(d)||(state.days[d]?.foods?.length||0)||(state.days[d]?.weights?.length||0));
    let cal=0,pro=0,foods=0;
    tracked.forEach(d=>(state.days[d]?.foods||[]).forEach(f=>{cal+=num(f.calories);pro+=num(f.protein);foods++}));
    const ww=allWeights().filter(w=>w.date.startsWith(prefix));
    const wc=ww.length>1?num(ww.at(-1).value)-num(ww[0].value):null;
    $('monthLabel').textContent=today.toLocaleDateString([],{month:'long',year:'numeric'});
    $('monthDays').textContent=tracked.length;
    $('monthCalories').textContent=tracked.length?Math.round(cal/tracked.length):0;
    $('monthProtein').textContent=(tracked.length?format1(pro/tracked.length):0)+'g';
    $('monthWeight').textContent=wc===null?'—':(wc>0?'+':'')+format1(wc)+' lb';
    $('monthFoods').textContent=foods;
  }

  function achievementDefinitions(){
    const foods=allFoodHistory().length, weights=allWeights().length, best=longestStreak(), used=(state.engagement?.usedDates||[]).length;
    return [
      {icon:'🔥',name:'7 Day Streak',desc:'Use the app 7 days straight',on:best>=7},
      {icon:'⚡',name:'30 Day Streak',desc:'Use the app 30 days straight',on:best>=30},
      {icon:'🍽️',name:'100 Foods',desc:'Log 100 food entries',on:foods>=100},
      {icon:'⚖️',name:'25 Weigh-Ins',desc:'Save 25 weights',on:weights>=25},
      {icon:'📅',name:'30 Days Tracked',desc:'Track 30 different days',on:used>=30},
      {icon:'⭐',name:'10 Favorites',desc:'Save 10 favorite foods',on:(state.favorites||[]).length>=10},
      {icon:'🏆',name:'Goal Reached',desc:'Reach your saved goal weight',on:(()=>{const w=allWeights(),g=num(state.settings.endGoalWeight);return !!(w.length&&g&&Math.abs(num(w.at(-1).value)-g)<.05)})()},
      {icon:'💪',name:'15 lb Progress',desc:'Move 15 lb from starting weight',on:(()=>{const w=allWeights();return w.length>1&&Math.abs(num(w.at(-1).value)-num(w[0].value))>=15})()}
    ];
  }

  function renderAchievements(){
    const b=achievementDefinitions(), unlocked=b.filter(x=>x.on).length;
    $('badgeCount').textContent=`${unlocked}/${b.length} unlocked`;
    $('badgeGrid').innerHTML=b.map(x=>`<div class="badge ${x.on?'unlocked':''}"><span class="badge-icon">${x.icon}</span><strong>${escapeHtml(x.name)}</strong><span>${escapeHtml(x.desc)}</span></div>`).join('');
  }

  function applyTheme(){
    document.body.classList.remove('theme-purple','theme-green','theme-red','theme-gold');
    document.body.classList.add('theme-'+(state.settings.theme||'purple'));
    $('themeSelect').value=state.settings.theme||'purple';
    $('reminderEnabled').checked=Boolean(state.settings.reminderEnabled);
    $('reminderTime').value=state.settings.reminderTime||'19:00';
  }

  function hasLoggedToday(){
    const d=state.days?.[todayLocal()];
    return !!((d?.foods?.length||0)||(d?.weights?.length||0));
  }

  function maybeShowReminder(){
    const banner=$('reminderBanner'); if(!banner)return;
    banner.classList.remove('show');
    if(!state.settings.reminderEnabled||hasLoggedToday())return;
    const now=new Date(), parts=(state.settings.reminderTime||'19:00').split(':').map(Number);
    const nowMin=now.getHours()*60+now.getMinutes(), target=parts[0]*60+parts[1];
    if(nowMin>=target) banner.classList.add('show');
  }

  function renderSharePreview(){
    const w=allWeights(), current=w.length?num(w.at(-1).value):0, start=w.length?num(w[0].value):0, goal=num(state.settings.endGoalWeight);
    const change=start&&current?current-start:0, streak=currentStreakInfo().count, days=(state.engagement?.usedDates||[]).length;
    $('sharePreview').innerHTML=`<b>CalorieTrack Progress</b><div class="log-meta" style="margin-top:6px">${current?format1(current)+' lb current':'No weight yet'}${goal?' • '+format1(goal)+' lb goal':''}<br>${start&&current?(change>0?'+':'')+format1(change)+' lb change • ':''}${streak} day streak • ${days} days tracked</div>`;
  }

  let undoState=null, undoTimer=null;
  function showUndo(message,fn){
    undoState=fn; $('undoText').textContent=message; $('undoToast').classList.add('show');
    clearTimeout(undoTimer); undoTimer=setTimeout(()=>{$('undoToast').classList.remove('show');undoState=null},5000);
  }

  function makeProgressCardBlob(){
    const w=allWeights(), current=w.length?num(w.at(-1).value):0, start=w.length?num(w[0].value):0, goal=num(state.settings.endGoalWeight);
    const streak=currentStreakInfo().count, days=(state.engagement?.usedDates||[]).length;
    const delta=start&&current?current-start:0;
    const canvas=document.createElement('canvas'); canvas.width=1080; canvas.height=1080;
    const c=canvas.getContext('2d'), grad=c.createLinearGradient(0,0,1080,1080);grad.addColorStop(0,'#17122b');grad.addColorStop(1,'#10243a');c.fillStyle=grad;c.fillRect(0,0,1080,1080);
    c.fillStyle='#f8fafc';c.font='bold 72px sans-serif';c.fillText('CalorieTrack',70,110);
    c.fillStyle='#c4b5fd';c.font='bold 34px sans-serif';c.fillText('MY PROGRESS',70,170);
    const stat=(label,value,y)=>{c.fillStyle='#94a3b8';c.font='28px sans-serif';c.fillText(label,70,y);c.fillStyle='#f8fafc';c.font='bold 58px sans-serif';c.fillText(value,70,y+62)};
    stat('Current weight',current?format1(current)+' lb':'—',280); stat('Goal weight',goal?format1(goal)+' lb':'—',440);
    stat('Total change',start&&current?(delta>0?'+':'')+format1(delta)+' lb':'—',600); stat('Current streak',streak+' day'+(streak===1?'':'s'),760);
    c.fillStyle='#38bdf8';c.font='bold 34px sans-serif';c.fillText(days+' days tracked',70,940);
    return new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  }

  function historyDates(){
    const usage = state.engagement?.usedDates || [];
    const dataDates = Object.keys(state.days || {}).filter(date => {
      const day = state.days[date];
      return (day?.foods?.length || 0) > 0 || (day?.weights?.length || 0) > 0;
    });
    return [...new Set([...usage,...dataDates])].sort().reverse();
  }

  function renderHistory(){
    const list = $('historyList');
    if(!list) return;

    const dates = historyDates();
    if(!dates.length){
      list.innerHTML = '<div class="history-empty">Your used days will appear here.</div>';
      return;
    }

    list.innerHTML = dates.map(date => {
      const day = state.days?.[date] || {foods:[],weights:[]};
      const foods = Array.isArray(day.foods) ? day.foods : [];
      const weights = Array.isArray(day.weights) ? day.weights : [];
      const calories = foods.reduce((sum,f) => sum + num(f.calories),0);
      const latestWeight = weights.slice().sort((a,b)=>num(b.createdAt)-num(a.createdAt))[0];
      const label = date === todayLocal() ? 'Today' : friendlyDate(date);

      return `
        <button class="history-day ${date === selectedDate() ? 'selected' : ''}" type="button" data-history-date="${date}">
          <div class="history-day-title">
            <span>${escapeHtml(label)}</span>
            <span>${escapeHtml(date)}</span>
          </div>
          <div class="history-day-meta">
            ${Math.round(calories)} cal • ${foods.length} food entr${foods.length === 1 ? 'y' : 'ies'} •
            ${latestWeight ? format1(latestWeight.value) + ' lb' : 'no weight'}
            ${day.note ? ' • note saved' : ''}${num(day.mood) ? ' • mood '+num(day.mood)+'/5' : ''}${num(day.hunger) ? ' • hunger '+num(day.hunger)+'/5' : ''}
          </div>
        </button>
      `;
    }).join('');
  }

  function openHistory(){
    const drawer = $('historyDrawer');
    const backdrop = $('historyBackdrop');
    if(drawer.classList.contains('open')) return;
    drawer.classList.add('open');
    backdrop.classList.add('open');
    drawer.setAttribute('aria-hidden','false');
    renderHistory();
  }

  function closeHistory(){
    const drawer = $('historyDrawer');
    const backdrop = $('historyBackdrop');
    if(!drawer.classList.contains('open')) return;
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    drawer.setAttribute('aria-hidden','true');
  }

  function mondayOfWeek(dateString){
    const d = parseLocalDate(dateString);
    const day = d.getDay(); // Sun=0
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return localDateString(d);
  }

  function renderWeekStrip(streak){
    const today = todayLocal();
    const monday = mondayOfWeek(today);
    const used = new Set(state.engagement?.usedDates || []);
    const letters = ['M','T','W','T','F','S','S'];
    const pieces = [];

    for(let i=0;i<7;i++){
      const date = addDays(monday,i);
      const inCurrent = streak.currentDates.has(date);
      const oldUsed = used.has(date) && !inCurrent;
      const isToday = date === today;
      let cls = '';
      if(inCurrent) cls = 'active';
      else if(oldUsed && date < today) cls = 'broken';

      let connectorClass = '';
      if(i < 6){
        const nextDate = addDays(monday,i+1);
        const bothCurrent = streak.currentDates.has(date) && streak.currentDates.has(nextDate);
        const priorSegment = date < today && !bothCurrent &&
          (used.has(date) || used.has(nextDate)) &&
          !streak.currentDates.has(nextDate);

        if(bothCurrent) connectorClass = 'active';
        else if(priorSegment) connectorClass = 'broken';
      }

      pieces.push(`
        <div class="week-day ${cls} ${isToday ? 'today' : ''}">
          <div class="week-letter">${letters[i]}</div>
          <div class="week-node-wrap">
            <div class="week-node">${inCurrent ? '✓' : (oldUsed ? '×' : String(parseLocalDate(date).getDate()))}</div>
            ${i < 6 ? `<div class="week-connector ${connectorClass}"></div>` : ''}
          </div>
        </div>
      `);
    }

    $('weekRow').innerHTML = pieces.join('');
  }

  function showStreakPopup(){
    const streak = currentStreakInfo();
    const tier = streakTier(streak.count);
    const flame = $('streakFlame');
    const flameStage = $('streakFlameStage');

    flame.classList.remove('red','purple','green');
    flame.classList.add(tier);
    flameStage.classList.remove('red','purple','green');
    flameStage.classList.add(tier);

    $('streakCount').textContent = streak.count;
    $('streakLabel').textContent = streak.count === 1 ? 'day streak' : 'days streak';
    $('streakQuote').textContent = quoteForDate(todayLocal());

    if(streak.brokeBeforeToday && streak.count === 1){
      $('streakStatus').textContent = 'Your last streak ended. Today starts a brand-new streak.';
    }else if(streak.count >= 16){
      $('streakStatus').textContent = 'Green fire unlocked — 16+ days strong.';
    }else if(streak.count >= 5){
      $('streakStatus').textContent = 'Purple fire unlocked — keep the streak moving.';
    }else{
      $('streakStatus').textContent = 'Open CalorieTrack every day to keep this streak alive.';
    }

    renderWeekStrip(streak);

    const overlay = $('streakOverlay');
    overlay.classList.remove('hidden','closing');
  }

  function closeStreakPopup(){
    const overlay = $('streakOverlay');
    if(overlay.classList.contains('hidden') || overlay.classList.contains('closing')) return;
    overlay.classList.add('closing');
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.classList.remove('closing');
    }, 310);
  }

  function render(){
    const day = getDay(selectedDate());
    const foods = day.foods;

    const totals = foods.reduce((acc,f) => {
      acc.calories += num(f.calories);
      acc.protein += num(f.protein);
      acc.carbs += num(f.carbs);
      acc.fat += num(f.fat);
      return acc;
    }, {calories:0,protein:0,carbs:0,fat:0});

    const calorieGoal = Math.max(1, num(state.settings.calorieGoal) || 1800);
    const proteinGoal = Math.max(0, num(state.settings.proteinGoal) || 100);
    const remaining = calorieGoal - totals.calories;
    const pct = Math.max(0, totals.calories / calorieGoal * 100);

    const latestWeightToday = day.weights.slice().sort((a,b)=>num(b.createdAt)-num(a.createdAt))[0];

    const mealTotals = ['Breakfast','Lunch','Dinner','Snack','Drink'].reduce((acc,meal)=>{
      acc[meal] = foods.filter(f=>f.meal===meal).reduce((sum,f)=>sum+num(f.calories),0);
      return acc;
    },{});

    $('calorieGoal').value = calorieGoal;
    $('proteinGoal').value = proteinGoal;
    $('endGoalWeight').value = state.settings.endGoalWeight;

    updateGoalEstimateLive();
    $('summaryDateLabel').textContent = friendlyDate(selectedDate());
    $('sumCalories').textContent = Math.round(totals.calories);
    $('remainingCalories').textContent = Math.round(remaining);
    $('sumMeals').textContent = foods.length;
    $('sumWeight').textContent = latestWeightToday ? format1(latestWeightToday.value) + ' lb' : '—';
    $('sumProtein').textContent = format1(totals.protein) + 'g';
    $('sumCarbs').textContent = format1(totals.carbs) + 'g';
    $('sumFat').textContent = format1(totals.fat) + 'g';
    $('calorieProgress').style.width = Math.min(100,pct) + '%';
    $('progressText').textContent =
      Math.round(pct) + '% of calorie goal • ' +
      (remaining >= 0 ? Math.round(remaining) + ' calories remaining' : Math.abs(Math.round(remaining)) + ' calories over goal') +
      ' • ' + format1(totals.protein) + '/' + format1(proteinGoal) + 'g protein';

    $('mealSummary').innerHTML = ['Breakfast','Lunch','Dinner','Snack','Drink'].map(meal => `
      <div class="meal-summary-row">
        <span>${meal}</span>
        <span>${Math.round(mealTotals[meal])} cal</span>
      </div>
    `).join('');

    $('foodLog').innerHTML = foods.length ? foods.map(f => `
      <div class="log-item">
        <div>
          <div class="log-title">${escapeHtml(f.name)}</div>
          <div class="log-meta">
            <span class="pill">${escapeHtml(f.meal)}</span>
            ${Math.round(num(f.calories))} cal •
            ${format1(f.protein)}g protein •
            ${format1(f.carbs)}g carbs •
            ${format1(f.fat)}g fat
          </div>
        </div>
        <button class="danger" style="width:auto;padding:8px 10px" data-food-delete="${f.id}">Delete</button>
      </div>
    `).join('') : '<div class="empty">No food logged for this day.</div>';

    const weights = day.weights.slice().sort((a,b)=>num(b.createdAt)-num(a.createdAt));
    $('weightLog').innerHTML = weights.length ? weights.map(w => {
      const savedGoal = num(w.goalWeight);
      const savedDiff = w.weightToGoal !== undefined && w.weightToGoal !== null
        ? num(w.weightToGoal)
        : (savedGoal > 0 ? Math.abs(num(w.value) - savedGoal) : null);

      let savedTime = w.estimatedTimeLabel || '—';
      let savedTargetDate = w.estimatedTargetDate || '';
      if((!w.estimatedTimeLabel || !w.estimatedTargetDate) && savedGoal > 0){
        const oldEstimate = calculateGoalEstimate(
          num(w.value),
          savedGoal,
          num(w.calorieGoalAtSave) || num(state.settings.calorieGoal)
        );
        if(!w.estimatedTimeLabel) savedTime = oldEstimate.timeLabel;
        if(!w.estimatedTargetDate) savedTargetDate = oldEstimate.targetDateLabel;
      }
      const savedTimeDisplay =
        savedTargetDate && savedTargetDate !== '—' && savedTargetDate !== 'Now'
          ? savedTime + ' • ' + savedTargetDate
          : savedTime;

      return `
        <div class="weight-history-card">
          <div class="weight-history-top">
            <div class="weight-history-time">${new Date(w.createdAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</div>
            <button class="danger" style="width:auto;padding:7px 10px" data-weight-delete="${w.id}">Delete</button>
          </div>
          <div class="weight-history-grid">
            <div class="weight-history-stat">
              <strong>${format1(w.value)} lb</strong>
              <span>Current weight</span>
            </div>
            <div class="weight-history-stat">
              <strong>${savedGoal > 0 ? format1(savedGoal) + ' lb' : '—'}</strong>
              <span>Goal weight</span>
            </div>
            <div class="weight-history-stat">
              <strong>${savedDiff === null ? '—' : format1(savedDiff) + ' lb'}</strong>
              <span>Weight to goal</span>
            </div>
            <div class="weight-history-stat">
              <strong>${escapeHtml(savedTimeDisplay)}</strong>
              <span>Estimated time</span>
            </div>
          </div>
        </div>
      `;
    }).join('') : '<div class="empty">No weight logged for this day.</div>';

    saveState();
    renderHistory();
    renderDashboard();
    renderWeek();
    renderFavs();
    renderCheckin();
    renderMonthlySummary();
    renderAchievements();
    renderSharePreview();
    applyTheme();
    maybeShowReminder();
    checkMilestones();
  }

  function clearFoodForm(){
    $('foodName').value='';
    $('foodCalories').value='';
    $('foodProtein').value='';
    $('foodCarbs').value='';
    $('foodFat').value='';
    $('mealType').value='Breakfast';
    $('foodName').focus();
  }

  $('addFoodBtn').addEventListener('click', () => {
    const name = $('foodName').value.trim();
    const caloriesRaw = $('foodCalories').value.trim();
    if(!name){ alert('Enter a food name.'); $('foodName').focus(); return; }
    if(caloriesRaw === '' || num(caloriesRaw) < 0){ alert('Enter valid calories.'); $('foodCalories').focus(); return; }

    getDay(selectedDate()).foods.push({
      id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
      name,
      meal:$('mealType').value,
      calories:num(caloriesRaw),
      protein:num($('foodProtein').value),
      carbs:num($('foodCarbs').value),
      fat:num($('foodFat').value),
      createdAt:Date.now()
    });
    clearFoodForm();
    render();
  });

  $('clearFoodBtn').addEventListener('click', clearFoodForm);

  $('addWeightBtn').addEventListener('click', () => {
    const current = num($('weightValue').value);
    const goal = num($('endGoalWeight').value);
    const calorieGoalAtSave = num($('calorieGoal').value) || num(state.settings.calorieGoal) || 1800;

    if(current <= 0){
      alert('Enter a valid current weight.');
      $('weightValue').focus();
      return;
    }

    if(goal <= 0){
      alert('Enter a valid end goal weight.');
      $('endGoalWeight').focus();
      return;
    }

    state.settings.endGoalWeight = goal;
    const estimate = calculateGoalEstimate(current, goal, calorieGoalAtSave);

    getDay(selectedDate()).weights.push({
      id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
      value:current,
      goalWeight:goal,
      weightToGoal:estimate.difference,
      estimatedWeeks:Number.isFinite(estimate.weeks) ? estimate.weeks : null,
      estimatedTimeLabel:estimate.timeLabel,
      estimatedTargetDate:estimate.targetDateLabel,
      calorieGoalAtSave,
      createdAt:Date.now()
    });

    saveState();
    $('weightValue').value='';

    const btn = $('addWeightBtn');
    btn.textContent = 'Saved ✓';
    render();

    setTimeout(() => {
      const b = $('addWeightBtn');
      if(b) b.textContent = 'Save Weight + Goal';
    }, 1400);
  });

  const historyTabButton = $('historyTab');
  historyTabButton.addEventListener('click', openHistory);
  historyTabButton.addEventListener('pointerup', e => {
    // Some ChromeOS/trackpad combinations can swallow an edge-positioned click.
    // Pointerup gives the side button a reliable fallback without changing behavior.
    if(e.pointerType === 'touch' || e.pointerType === 'pen'){
      e.preventDefault();
      openHistory();
    }
  });
  $('historyClose').addEventListener('click', closeHistory);
  $('historyBackdrop').addEventListener('click', closeHistory);

  $('historyList').addEventListener('click', e => {
    const button = e.target.closest('[data-history-date]');
    if(!button) return;
    $('selectedDate').value = button.dataset.historyDate;
    render();
    closeHistory();
    window.scrollTo({top:0, behavior:'smooth'});
  });

  $('streakClose').addEventListener('click', closeStreakPopup);
  $('streakContinue').addEventListener('click', closeStreakPopup);
  $('streakOverlay').addEventListener('click', e => {
    if(e.target === $('streakOverlay')) closeStreakPopup();
  });

  document.addEventListener('keydown', e => {
    if(e.key === 'Escape'){
      closeHistory();
      closeStreakPopup();
    }
  });

  $('saveFavBtn').addEventListener('click',()=>{
    const name=$('favName').value.trim();if(!name){alert('Enter a food name.');return}
    state.favorites.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),name,meal:$('favMeal').value,calories:num($('favCalories').value),protein:num($('favProtein').value),carbs:num($('favCarbs').value),fat:num($('favFat').value),pinned:false});
    ['favName','favCalories','favProtein','favCarbs','favFat'].forEach(id=>$(id).value='');saveState();renderFavs();
  });
  $('favList').addEventListener('click',e=>{
    const add=e.target.closest('[data-fav-add]'),del=e.target.closest('[data-fav-del]'),pin=e.target.closest('[data-fav-pin]');
    if(add){const f=state.favorites.find(x=>x.id===add.dataset.favAdd);if(f){getDay(selectedDate()).foods.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),name:f.name,meal:f.meal,calories:num(f.calories),protein:num(f.protein),carbs:num(f.carbs),fat:num(f.fat),createdAt:Date.now()});render()}}
    if(pin){const f=state.favorites.find(x=>x.id===pin.dataset.favPin);if(f){f.pinned=!f.pinned;saveState();renderFavs()}}
    if(del){const idx=state.favorites.findIndex(x=>x.id===del.dataset.favDel);if(idx>=0){const removed=state.favorites.splice(idx,1)[0];saveState();renderFavs();showUndo('Favorite deleted.',()=>{state.favorites.splice(idx,0,removed);saveState();renderFavs()})}}
  });


  $('saveCheckinBtn').addEventListener('click',()=>{
    const d=getDay(selectedDate());d.note=$('dayNote').value.trim();saveState();
    const btn=$('saveCheckinBtn');btn.textContent='Saved ✓';setTimeout(()=>btn.textContent='Save Day Details',1000);
    renderHistory();
  });
  function bindScale(id,key){
    $(id).addEventListener('click',e=>{
      const b=e.target.closest('[data-scale]');if(!b)return;
      getDay(selectedDate())[key]=num(b.dataset.scale);saveState();renderCheckin();
    });
  }
  bindScale('moodButtons','mood');bindScale('hungerButtons','hunger');

  $('foodSearchInput').addEventListener('input',renderFoodSearch);
  $('foodSearchResults').addEventListener('click',e=>{
    const b=e.target.closest('[data-search-add]');if(!b)return;
    const source=state.days?.[b.dataset.searchDate]?.foods?.find(f=>f.id===b.dataset.searchAdd);if(!source)return;
    getDay(selectedDate()).foods.push({...source,id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),createdAt:Date.now()});render();
  });

  $('copyMealBtn').addEventListener('click',()=>{
    const from=$('copyMealDate').value, meal=$('copyMealType').value;
    if(!from){alert('Choose the date you want to copy from.');return}
    const source=(state.days?.[from]?.foods||[]).filter(f=>f.meal===meal);
    if(!source.length){alert(`No ${meal.toLowerCase()} foods were logged on that date.`);return}
    source.forEach(f=>getDay(selectedDate()).foods.push({...f,id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),createdAt:Date.now()}));
    render();alert(`${source.length} item${source.length===1?'':'s'} copied into ${meal}.`);
  });

  $('saveSettingsBtn').addEventListener('click',async()=>{
    state.settings.theme=$('themeSelect').value;
    state.settings.reminderEnabled=$('reminderEnabled').checked;
    state.settings.reminderTime=$('reminderTime').value||'19:00';
    saveState();applyTheme();maybeShowReminder();
    if(state.settings.reminderEnabled && 'Notification' in window && Notification.permission==='default'){
      try{await Notification.requestPermission()}catch(_){}
    }
    const b=$('saveSettingsBtn');b.textContent='Saved ✓';setTimeout(()=>b.textContent='Save Settings',1000);
  });
  $('themeSelect').addEventListener('change',()=>{state.settings.theme=$('themeSelect').value;saveState();applyTheme()});
  $('dismissReminderBtn').addEventListener('click',()=>{$('reminderBanner').classList.remove('show')});

  $('importBtn').addEventListener('click',async()=>{
    const file=$('importFile').files?.[0];if(!file){alert('Choose a CalorieTrack JSON backup first.');return}
    try{
      const parsed=JSON.parse(await file.text());
      if(!parsed || typeof parsed!=='object' || !parsed.settings || !parsed.days) throw new Error('Invalid backup');
      if(!confirm('Import this backup? This will replace the CalorieTrack data currently stored on this device.'))return;
      localStorage.setItem(STORAGE_KEY,JSON.stringify(parsed));location.reload();
    }catch(err){alert('That file does not look like a valid CalorieTrack JSON backup.')}
  });

  $('shareProgressBtn').addEventListener('click',async()=>{
    const blob=await makeProgressCardBlob();if(!blob)return;
    const file=new File([blob],'calorietrack-progress.png',{type:'image/png'});
    if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
      try{await navigator.share({title:'My CalorieTrack Progress',text:'My CalorieTrack progress',files:[file]});return}catch(err){if(err?.name==='AbortError')return}
    }
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='calorietrack-progress.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });

  $('undoBtn').addEventListener('click',()=>{
    if(undoState){const fn=undoState;undoState=null;fn();$('undoToast').classList.remove('show')}
  });

  $('selectedDate').addEventListener('change', render);

  $('calorieGoal').addEventListener('change', () => {
    const v = num($('calorieGoal').value);
    if(v > 0){ state.settings.calorieGoal = v; render(); }
  });

  $('proteinGoal').addEventListener('change', () => {
    const v = num($('proteinGoal').value);
    if(v >= 0){ state.settings.proteinGoal = v; render(); }
  });

  $('saveEndGoalBtn').addEventListener('click', () => {
    const v = num($('endGoalWeight').value);
    if(v <= 0){
      alert('Enter a valid end goal weight.');
      $('endGoalWeight').focus();
      return;
    }
    state.settings.endGoalWeight = v;
    saveState();
    updateGoalEstimateLive();
    $('saveEndGoalBtn').textContent = 'Saved ✓';
    setTimeout(() => {
      const btn = $('saveEndGoalBtn');
      if(btn) btn.textContent = 'Update Goal';
    }, 1200);
  });

  $('weightValue').addEventListener('input', updateGoalEstimateLive);
  $('endGoalWeight').addEventListener('input', updateGoalEstimateLive);
  $('calorieGoal').addEventListener('input', updateGoalEstimateLive);

  document.addEventListener('click', e => {
    const foodId = e.target?.dataset?.foodDelete;
    const weightId = e.target?.dataset?.weightDelete;

    if(foodId){
      const day = getDay(selectedDate());
      const idx=day.foods.findIndex(f=>f.id===foodId);
      if(idx>=0){const removed=day.foods.splice(idx,1)[0];render();showUndo('Food deleted.',()=>{getDay(selectedDate()).foods.splice(idx,0,removed);render()})}
    }
    if(weightId){
      const day = getDay(selectedDate());
      const idx=day.weights.findIndex(w=>w.id===weightId);
      if(idx>=0){const removed=day.weights.splice(idx,1)[0];render();showUndo('Weight deleted.',()=>{getDay(selectedDate()).weights.splice(idx,0,removed);render()})}
    }
  });

  $('resetDayBtn').addEventListener('click', () => {
    if(confirm('Clear all food and weight entries for the selected day?')){
      state.days[selectedDate()] = {foods:[],weights:[],note:'',mood:0,hunger:0};
      render();
    }
  });

  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calorie-track-data.json';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });


  function maybeSendBrowserReminder(){
    maybeShowReminder();
    if(!state.settings.reminderEnabled || hasLoggedToday() || !('Notification' in window) || Notification.permission!=='granted') return;
    const [h,m]=(state.settings.reminderTime||'19:00').split(':').map(Number), now=new Date();
    if(now.getHours()*60+now.getMinutes() < h*60+m) return;
    const key='calorieTrackReminderNotifiedDate';
    if(localStorage.getItem(key)===todayLocal()) return;
    try{
      new Notification('CalorieTrack',{body:'Remember to log today 🔥'});
      localStorage.setItem(key,todayLocal());
    }catch(_){}
  }
  setInterval(maybeSendBrowserReminder,60000);

  // ----- PWA installation -----
  let deferredInstallPrompt = null;
  const installBtn = $('installBtn');
  const installText = $('installText');
  const installMessage = $('installMessage');

  function standalone(){
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function showInstallMessage(text){
    installMessage.textContent = text;
    installMessage.style.display = 'block';
  }

  if(standalone()){
    installText.textContent = 'CalorieTrack is installed on this device.';
    installBtn.textContent = 'Installed';
    installBtn.disabled = true;
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if(!standalone()){
      installText.textContent = 'Ready to install on this device.';
      installBtn.textContent = 'Install App';
      installBtn.disabled = false;
    }
  });

  installBtn.addEventListener('click', async () => {
    if(standalone()){
      showInstallMessage('CalorieTrack is already installed on this device.');
      return;
    }

    if(deferredInstallPrompt){
      deferredInstallPrompt.prompt();
      const result = await deferredInstallPrompt.userChoice;
      if(result.outcome === 'accepted'){
        installText.textContent = 'Installing CalorieTrack…';
      }
      deferredInstallPrompt = null;
      return;
    }

    const ua = navigator.userAgent.toLowerCase();
    if(/iphone|ipad|ipod/.test(ua)){
      showInstallMessage('On iPhone/iPad: open this page in Safari, tap Share, then choose “Add to Home Screen.”');
    }else{
      showInstallMessage('In Chrome, tap the ⋮ menu and choose “Install app” or “Add to Home screen.” If you already installed CalorieTrack, Chrome may not offer the install option again.');
    }
  });

  window.addEventListener('appinstalled', () => {
    installText.textContent = 'CalorieTrack is installed on this device.';
    installBtn.textContent = 'Installed';
    installBtn.disabled = true;
    installMessage.style.display = 'none';
  });


  // ----- Live device clock -----
  let liveClockTimer = null;

  function getDeviceZoneLabel(now){
    try{
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZoneName:'short'
      }).formatToParts(now);
      const zone = parts.find(part => part.type === 'timeZoneName');
      return zone && zone.value ? zone.value : 'Local Time';
    }catch(err){
      return 'Local Time';
    }
  }

  function updateLiveClock(){
    const timeEl = document.getElementById('liveClockTime');
    const zoneEl = document.getElementById('liveClockZone');
    if(!timeEl || !zoneEl) return;

    const now = new Date();

    let timeText;
    try{
      timeText = new Intl.DateTimeFormat('en-US', {
        hour:'numeric',
        minute:'2-digit',
        second:'2-digit',
        hour12:true
      }).format(now);
    }catch(err){
      timeText = now.toLocaleTimeString();
    }

    timeEl.textContent = timeText;
    zoneEl.textContent = getDeviceZoneLabel(now);
  }

  function startLiveClock(){
    updateLiveClock();
    if(liveClockTimer) clearInterval(liveClockTimer);
    liveClockTimer = setInterval(updateLiveClock, 1000);
  }

  startLiveClock();

  // Refresh immediately when the app comes back into view so the clock
  // always catches up to the phone/computer's current time.
  document.addEventListener('visibilitychange', () => {
    if(!document.hidden) updateLiveClock();
  });

  // ----- Service worker -----
  if('serviceWorker' in navigator){
    window.addEventListener('load', async () => {
      try{
        await navigator.serviceWorker.register('./service-worker.js', {scope:'./'});
      }catch(err){
        console.error('Service worker registration failed:', err);
      }
    });
  }

  recordAppOpen();
  $('selectedDate').value = todayLocal();
  $('copyMealDate').value = addDays(todayLocal(),-1);
  applyTheme();
  render();
  renderFoodSearch();
  maybeSendBrowserReminder();

  // Show the daily streak card immediately on each app launch.
  requestAnimationFrame(showStreakPopup);
})();
