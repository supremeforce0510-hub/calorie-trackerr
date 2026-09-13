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
      settings:{calorieGoal:1800, proteinGoal:100, endGoalWeight:'', weeklyWorkoutGoal:3, prGoalExercise:'', prGoalWeight:'', theme:'purple', reminderEnabled:false, reminderTime:'19:00'},
      profile:{age:'', sex:'', height:'', weight:'', activity:'sedentary'},
      days:{},
      engagement:{usedDates:[], celebratedMilestones:[], unlockedAchievements:[], achievementSystemReady:false},
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
          weeklyWorkoutGoal:Math.max(1, Number(parsed?.settings?.weeklyWorkoutGoal) || 3),
          prGoalExercise:parsed?.settings?.prGoalExercise ?? '',
          prGoalWeight:parsed?.settings?.prGoalWeight ?? '',
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
          celebratedMilestones:Array.isArray(parsed?.engagement?.celebratedMilestones) ? parsed.engagement.celebratedMilestones : [],
          unlockedAchievements:Array.isArray(parsed?.engagement?.unlockedAchievements) ? parsed.engagement.unlockedAchievements : [],
          achievementSystemReady:Boolean(parsed?.engagement?.achievementSystemReady)
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
             Array.isArray(day?.weights) && day.weights.length > 0 ||
             Array.isArray(day?.exercises) && day.exercises.length > 0 ||
             Array.isArray(day?.prs) && day.prs.length > 0;
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
    if(!state.days[date]) state.days[date] = {foods:[],weights:[],exercises:[],prs:[],note:'',mood:0,hunger:0};
    if(!Array.isArray(state.days[date].foods)) state.days[date].foods = [];
    if(!Array.isArray(state.days[date].weights)) state.days[date].weights = [];
    if(!Array.isArray(state.days[date].exercises)) state.days[date].exercises = [];
    if(!Array.isArray(state.days[date].prs)) state.days[date].prs = [];
    if(typeof state.days[date].note !== 'string') state.days[date].note = '';
    state.days[date].mood = num(state.days[date].mood);
    state.days[date].hunger = num(state.days[date].hunger);
    return state.days[date];
  }



  function allWeights(){
    const a=[]; Object.entries(state.days||{}).forEach(([date,d])=>(d?.weights||[]).forEach(w=>a.push({...w,date})));
    return a.sort((x,y)=>(num(x.createdAt)||parseLocalDate(x.date).getTime())-(num(y.createdAt)||parseLocalDate(y.date).getTime()));
  }

  function allExercises(){
    const a=[];Object.entries(state.days||{}).forEach(([date,d])=>(d?.exercises||[]).forEach(x=>a.push({...x,date})));
    return a.sort((x,y)=>(num(x.createdAt)||parseLocalDate(x.date).getTime())-(num(y.createdAt)||parseLocalDate(y.date).getTime()));
  }
  function allPRs(){
    const a=[];Object.entries(state.days||{}).forEach(([date,d])=>(d?.prs||[]).forEach(x=>a.push({...x,date})));
    return a.sort((x,y)=>(num(x.createdAt)||parseLocalDate(x.date).getTime())-(num(y.createdAt)||parseLocalDate(y.date).getTime()));
  }
  function bestPRsByExercise(){
    const map=new Map();
    allPRs().forEach(p=>{
      const name=String(p.exercise||'').trim()||'Lift';
      const prev=map.get(name);
      if(!prev || num(p.weight)>num(prev.weight) || (num(p.weight)===num(prev.weight)&&num(p.reps)>num(prev.reps))) map.set(name,p);
    });
    return [...map.values()].sort((a,b)=>num(b.createdAt)-num(a.createdAt));
  }

  function longestStreak(){
    const d=[...new Set(state.engagement?.usedDates||[])].sort(); if(!d.length)return 0;
    let best=1,run=1; for(let i=1;i<d.length;i++){run=dateDiffDays(d[i-1],d[i])===1?run+1:1;best=Math.max(best,run)} return best;
  }
  function weekDates(offset=0){let m=mondayOfWeek(todayLocal());m=addDays(m,offset*7);return Array.from({length:7},(_,i)=>addDays(m,i))}
  function weekStats(ds){
    const used=new Set(state.engagement?.usedDates||[]), today=todayLocal();
    const tracked=ds.filter(x=>x<=today&&(used.has(x)||(state.days?.[x]?.foods?.length||0)||(state.days?.[x]?.weights?.length||0)||(state.days?.[x]?.exercises?.length||0)||(state.days?.[x]?.prs?.length||0)));
    let cal=0,pro=0;tracked.forEach(x=>(state.days?.[x]?.foods||[]).forEach(f=>{cal+=num(f.calories);pro+=num(f.protein)}));
    const ww=allWeights().filter(w=>ds.includes(w.date));
    return {days:tracked.length,cal:tracked.length?cal/tracked.length:0,pro:tracked.length?pro/tracked.length:0,w:ww.length>1?num(ww.at(-1).value)-num(ww[0].value):null};
  }
  function renderChart(a){
    const svg=$('weightChart'); if(!a.length){svg.innerHTML='<text x="320" y="95" text-anchor="middle" fill="#94a3b8">Log weight to build your trend</text>';$('chartRange').textContent='No weigh-ins yet';return}
    const vals=a.map(x=>num(x.value)),lo=Math.min(...vals),hi=Math.max(...vals),spread=Math.max(2,hi-lo),pad=28,W=640,H=185;
    const pts=a.map((w,i)=>({x:a.length===1?W/2:pad+i*(W-pad*2)/(a.length-1),y:H-pad-((num(w.value)-lo)/spread)*(H-pad*2),w}));
    const linePts=pts.map(p=>p.x+','+p.y).join(' ');
    const areaPts=`${pts[0].x},${H-pad} ${linePts} ${pts.at(-1).x},${H-pad}`;
    svg.innerHTML=`<defs><linearGradient id="v18Line" x1="0" x2="1"><stop offset="0%" stop-color="#a855f7"/><stop offset="55%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#22d3ee"/></linearGradient><linearGradient id="v18Area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38bdf8" stop-opacity=".22"/><stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/></linearGradient></defs><line x1="${pad}" y1="${H-pad}" x2="${W-pad}" y2="${H-pad}" stroke="#334155" stroke-opacity=".65"/><line x1="${pad}" y1="${pad}" x2="${W-pad}" y2="${pad}" stroke="#334155" stroke-opacity=".24"/><polygon points="${areaPts}" fill="url(#v18Area)"/><polyline points="${linePts}" fill="none" stroke="url(#v18Line)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="5" fill="#0b1220" stroke="#7dd3fc" stroke-width="3"><title>${p.w.date}: ${format1(p.w.value)} lb</title></circle>`).join('')}`;
    $('chartRange').textContent=`${friendlyDate(a[0].date)} → ${friendlyDate(a.at(-1).date)}`;
  }

  function trackedDayCount(){
    const usage=state.engagement?.usedDates||[];
    const dataDates=Object.keys(state.days||{}).filter(date=>{
      const d=state.days[date];
      return (d?.foods?.length||0)||(d?.weights?.length||0)||(d?.exercises?.length||0)||(d?.prs?.length||0);
    });
    return new Set([...usage,...dataDates]).size;
  }

  function currentWeekExerciseCount(){
    const dates=new Set(weekDates(0));
    return allExercises().filter(x=>dates.has(x.date)).length;
  }

  function prHistoryByExercise(){
    const map=new Map();
    allPRs().forEach(p=>{
      const name=String(p.exercise||'Lift').trim()||'Lift';
      if(!map.has(name)) map.set(name,[]);
      map.get(name).push(p);
    });
    return map;
  }

  function prImprovementFor(exercise){
    const list=(prHistoryByExercise().get(exercise)||[]).slice().sort((a,b)=>(num(a.createdAt)||0)-(num(b.createdAt)||0));
    if(!list.length) return null;
    const first=num(list[0].weight);
    const best=list.reduce((m,p)=>num(p.weight)>num(m.weight)?p:m,list[0]);
    const gain=num(best.weight)-first;
    const pct=first>0?(gain/first)*100:0;
    return {first,best:num(best.weight),gain,pct};
  }

  function renderHomeDashboard(){
    const weights=allWeights(), exercises=allExercises(), prs=allPRs(), foods=allFoodHistory();
    const start=weights.length?num(weights[0].value):0, current=weights.length?num(weights.at(-1).value):0;
    $('homeCalorieGoal').value=num(state.settings.calorieGoal)||1800;
    $('homeProteinGoal').value=num(state.settings.proteinGoal)||100;
    $('homeWeightGoal').value=state.settings.endGoalWeight||'';
    $('homeWorkoutGoal').value=Math.max(1,num(state.settings.weeklyWorkoutGoal)||3);
    $('homePRGoalExercise').value=state.settings.prGoalExercise||'';
    $('homePRGoalWeight').value=state.settings.prGoalWeight||'';

    $('lifeDays').textContent=trackedDayCount();
    $('lifeFoods').textContent=foods.length;
    $('lifeWorkouts').textContent=exercises.length;
    $('lifeMinutes').textContent=Math.round(exercises.reduce((s,x)=>s+num(x.minutes),0));
    $('lifeBurned').textContent=Math.round(exercises.reduce((s,x)=>s+num(x.caloriesBurned),0));
    $('lifePRs').textContent=prs.length;
    $('lifeStreak').textContent=longestStreak();
    $('lifeWeightChange').textContent=start&&current?`${current-start>0?'+':''}${format1(current-start)} lb`:'—';

    const weekDone=currentWeekExerciseCount(), weekGoal=Math.max(1,num(state.settings.weeklyWorkoutGoal)||3);
    const weightGoal=num(state.settings.endGoalWeight), weightTotal=start&&weightGoal?Math.abs(start-weightGoal):0, weightDone=start&&current&&weightGoal?Math.max(0,weightTotal-Math.abs(current-weightGoal)):0;
    const prGoalName=String(state.settings.prGoalExercise||'').trim(), prGoalWeight=num(state.settings.prGoalWeight);
    const prBest=prGoalName?bestPRsByExercise().find(x=>String(x.exercise).toLowerCase()===prGoalName.toLowerCase()):null;
    const goalRows=[
      {name:'Weight',value:weightGoal?(current?`${format1(current)} / ${format1(weightGoal)} lb`:`Goal ${format1(weightGoal)} lb`):'Not set',pct:weightTotal?weightDone/weightTotal*100:0},
      {name:'Workouts',value:`${weekDone} / ${weekGoal} this week`,pct:weekDone/weekGoal*100},
      {name:'PR goal',value:prGoalName&&prGoalWeight?`${prGoalName}: ${prBest?format1(prBest.weight):0} / ${format1(prGoalWeight)} lb`:'Not set',pct:prGoalWeight&&prBest?num(prBest.weight)/prGoalWeight*100:0}
    ];
    $('goalSnapshot').innerHTML=goalRows.map(g=>`<div class="goal-snapshot-row"><span>${escapeHtml(g.name)}</span><div class="goal-mini-track"><div class="goal-mini-fill" style="width:${Math.max(0,Math.min(100,g.pct||0))}%"></div></div><strong>${escapeHtml(g.value)}</strong></div>`).join('');

    const latest=prs.length?prs.at(-1):null;
    $('homeLatestPR').textContent=latest?`${latest.exercise} • ${format1(latest.weight)} lb × ${Math.max(1,num(latest.reps)||1)}`:'No PRs yet';
    const improvements=bestPRsByExercise().map(p=>({name:p.exercise,...(prImprovementFor(p.exercise)||{})})).filter(x=>Number.isFinite(x.pct));
    improvements.sort((a,b)=>b.pct-a.pct);
    const bestImp=improvements.find(x=>x.gain>0);
    $('homeBestImprovement').textContent=bestImp?`${bestImp.name} +${format1(bestImp.gain)} lb (${format1(bestImp.pct)}%)`:'—';
    $('homeLiftCount').textContent=new Set(prs.map(p=>String(p.exercise).trim()).filter(Boolean)).size;
    const best=bestPRsByExercise();
    $('homePRBoard').innerHTML=best.length?best.map(p=>{
      const imp=prImprovementFor(p.exercise);
      const improve=imp&&imp.gain>0?`Started ${format1(imp.first)} lb → +${format1(imp.gain)} lb / +${format1(imp.pct)}%`:'First logged PR';
      return `<div class="home-pr-item"><div class="pr-name">${escapeHtml(p.exercise)}</div><div class="pr-best">${format1(p.weight)} lb × ${Math.max(1,num(p.reps)||1)}</div><div class="pr-improve">${escapeHtml(improve)}</div></div>`;
    }).join(''):'<div class="home-pr-empty">Log a lifting PR and your personal record board will build here.</div>';
  }

  function lineChart(svgId, items, valueFn, emptyText){
    const svg=$(svgId), W=640,H=190,pad=30;
    if(!items.length){svg.innerHTML=`<text class="progress-empty" x="320" y="98" text-anchor="middle">${escapeHtml(emptyText)}</text>`;return}
    const values=items.map(valueFn), lo=Math.min(...values),hi=Math.max(...values),spread=Math.max(1,hi-lo);
    const pts=items.map((item,i)=>({x:items.length===1?W/2:pad+i*(W-pad*2)/(items.length-1),y:H-pad-((valueFn(item)-lo)/spread)*(H-pad*2),item}));
    const line=pts.map(p=>`${p.x},${p.y}`).join(' ');
    svg.innerHTML=`<defs><linearGradient id="${svgId}Grad" x1="0" x2="1"><stop offset="0%" stop-color="#a855f7"/><stop offset="55%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#22d3ee"/></linearGradient></defs><line x1="${pad}" y1="${H-pad}" x2="${W-pad}" y2="${H-pad}" stroke="#334155"/><polyline points="${line}" fill="none" stroke="url(#${svgId}Grad)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="5" fill="#0b1220" stroke="#7dd3fc" stroke-width="3"></circle>`).join('')}`;
  }

  function renderExerciseProgress(){
    const prs=allPRs(), ex=allExercises();
    const liftNames=[...new Set(prs.map(p=>String(p.exercise||'').trim()).filter(Boolean))].sort();
    const exerciseNames=[...new Set(ex.map(x=>String(x.name||x.type||'Exercise').trim()).filter(Boolean))].sort();
    const liftSel=$('liftProgressSelect'), exSel=$('exerciseProgressSelect');
    const oldLift=liftSel.value, oldEx=exSel.value;
    liftSel.innerHTML=liftNames.length?liftNames.map(n=>`<option>${escapeHtml(n)}</option>`).join(''):'<option value="">No PRs logged yet</option>';
    exSel.innerHTML=exerciseNames.length?exerciseNames.map(n=>`<option>${escapeHtml(n)}</option>`).join(''):'<option value="">No exercises logged yet</option>';
    if(liftNames.includes(oldLift))liftSel.value=oldLift;
    if(exerciseNames.includes(oldEx))exSel.value=oldEx;
    const lift=liftSel.value, exercise=exSel.value;
    const liftData=prs.filter(p=>p.exercise===lift).sort((a,b)=>(num(a.createdAt)||0)-(num(b.createdAt)||0));
    const exData=ex.filter(x=>(x.name||x.type)===exercise).sort((a,b)=>(num(a.createdAt)||0)-(num(b.createdAt)||0));
    $('liftProgressTitle').textContent=lift?`${lift} — PR Weight Progress`:'Lifting PR Progress';
    $('exerciseProgressTitle').textContent=exercise?`${exercise} — Calories Burned`:'Exercise Session Progress';
    lineChart('liftProgressChart',liftData,p=>num(p.weight),'Log PRs to build a lifting progress graph.');
    lineChart('exerciseProgressChart',exData,x=>num(x.caloriesBurned),'Log exercise sessions to build a progress graph.');
  }

  function renderDashboard(){
    const w=allWeights(),start=w.length?num(w[0].value):0,current=w.length?num(w.at(-1).value):0,goal=num(state.settings.endGoalWeight),st=currentStreakInfo().count,best=longestStreak();
    $('dashStart').textContent=start?format1(start)+' lb':'—';$('dashCurrent').textContent=current?format1(current)+' lb':'—';$('dashGoal').textContent=goal?format1(goal)+' lb':'—';$('dashStreak').textContent=st;$('dashBest').textContent=best;
    $('dashChange').textContent=start&&current?((current-start>0?'+':'')+format1(current-start)+' lb'):'—';

    const dashboardDay=getDay(selectedDate());
    const todayExercises=dashboardDay.exercises||[];
    const todayBurned=todayExercises.reduce((sum,x)=>sum+num(x.caloriesBurned),0);
    const prs=allPRs(), latestPR=prs.length?prs.at(-1):null, bestPRs=bestPRsByExercise();

    $('dashBurned').textContent=Math.round(todayBurned);
    $('dashExerciseCount').textContent=todayExercises.length;
    $('dashPRCount').textContent=prs.length;
    $('dashLatestPR').textContent=latestPR?`${latestPR.exercise}: ${format1(latestPR.weight)} lb × ${Math.max(1,num(latestPR.reps)||1)}`:'No PRs logged yet';
    $('dashPRHighlights').innerHTML=bestPRs.length
      ? bestPRs.slice(0,6).map(p=>`<span class="pr-highlight">${escapeHtml(p.exercise)} • ${format1(p.weight)} lb × ${Math.max(1,num(p.reps)||1)}</span>`).join('')
      : '<span class="tiny">Your best lift records will appear here.</span>';

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





  function renderMonthlySummary(){
    const today=parseLocalDate(todayLocal()), y=today.getFullYear(), m=today.getMonth();
    const prefix=`${y}-${String(m+1).padStart(2,'0')}-`;
    const used=new Set(state.engagement?.usedDates||[]);
    const dates=[...new Set([...Object.keys(state.days||{}),...(state.engagement?.usedDates||[])])].filter(d=>d.startsWith(prefix)).sort();
    const tracked=dates.filter(d=>used.has(d)||(state.days[d]?.foods?.length||0)||(state.days[d]?.weights?.length||0)||(state.days[d]?.exercises?.length||0)||(state.days[d]?.prs?.length||0));
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
    const foods=allFoodHistory(), weights=allWeights(), exercises=allExercises(), prs=allPRs();
    const best=longestStreak(), used=trackedDayCount(), favorites=(state.favorites||[]).length;
    const totalBurned=exercises.reduce((s,x)=>s+num(x.caloriesBurned),0);
    const totalMinutes=exercises.reduce((s,x)=>s+num(x.minutes),0);
    const uniqueLifts=new Set(prs.map(p=>String(p.exercise||'').trim()).filter(Boolean)).size;
    const wStart=weights.length?num(weights[0].value):0,wNow=weights.length?num(weights.at(-1).value):0;
    const weightMove=wStart&&wNow?Math.abs(wNow-wStart):0;
    const goal=num(state.settings.endGoalWeight);
    const proteinGoal=Math.max(0,num(state.settings.proteinGoal));
    const calorieGoal=Math.max(1,num(state.settings.calorieGoal)||1800);
    let proteinDays=0, calorieDays=0;
    Object.values(state.days||{}).forEach(d=>{
      const fs=d?.foods||[]; if(!fs.length)return;
      const c=fs.reduce((s,f)=>s+num(f.calories),0),p=fs.reduce((s,f)=>s+num(f.protein),0);
      if(proteinGoal>0&&p>=proteinGoal)proteinDays++;
      if(c<=calorieGoal)calorieDays++;
    });
    let bestPct=0;
    bestPRsByExercise().forEach(p=>{const imp=prImprovementFor(p.exercise);if(imp)bestPct=Math.max(bestPct,imp.pct)});
    const A=(id,icon,name,desc,on,tier='bronze')=>({id,icon,name,desc,on:Boolean(on),tier});
    return [
      A('streak-1','🔥','First Check-In','Open IRONLOG and start your streak',best>=1),
      A('streak-3','🔥','3 Day Streak','Use IRONLOG 3 days straight',best>=3),
      A('streak-7','🔥','7 Day Streak','Use IRONLOG 7 days straight',best>=7,'silver'),
      A('streak-15','🔥','15 Day Streak','Use IRONLOG 15 days straight',best>=15,'silver'),
      A('streak-30','⚡','30 Day Streak','Use IRONLOG 30 days straight',best>=30,'gold'),
      A('streak-60','⚡','60 Day Streak','Use IRONLOG 60 days straight',best>=60,'gold'),
      A('streak-100','👑','100 Day Streak','Use IRONLOG 100 days straight',best>=100,'diamond'),
      A('streak-365','💎','365 Day Streak','Use IRONLOG 365 days straight',best>=365,'diamond'),

      A('food-1','🍽️','First Food','Log your first food entry',foods.length>=1),
      A('food-10','🍽️','10 Foods','Log 10 food entries',foods.length>=10),
      A('food-50','🍽️','50 Foods','Log 50 food entries',foods.length>=50,'silver'),
      A('food-100','🥗','100 Foods','Log 100 food entries',foods.length>=100,'silver'),
      A('food-250','🥗','250 Foods','Log 250 food entries',foods.length>=250,'gold'),
      A('food-500','🥇','500 Foods','Log 500 food entries',foods.length>=500,'gold'),
      A('food-1000','💎','1,000 Foods','Log 1,000 food entries',foods.length>=1000,'diamond'),
      A('protein-1','💪','Protein Goal Day','Reach your protein goal on 1 logged day',proteinDays>=1),
      A('protein-7','💪','7 Protein Goal Days','Reach your protein goal on 7 logged days',proteinDays>=7,'silver'),
      A('protein-30','💪','30 Protein Goal Days','Reach your protein goal on 30 logged days',proteinDays>=30,'gold'),
      A('calorie-1','🎯','Calorie Goal Day','Finish a logged day at or under your calorie goal',calorieDays>=1),
      A('calorie-7','🎯','7 Calorie Goal Days','Finish 7 logged days at or under your calorie goal',calorieDays>=7,'silver'),
      A('calorie-30','🎯','30 Calorie Goal Days','Finish 30 logged days at or under your calorie goal',calorieDays>=30,'gold'),

      A('weight-1','⚖️','First Weigh-In','Save your first weight',weights.length>=1),
      A('weight-5','⚖️','5 Weigh-Ins','Save 5 weights',weights.length>=5),
      A('weight-25','⚖️','25 Weigh-Ins','Save 25 weights',weights.length>=25,'silver'),
      A('weight-50','⚖️','50 Weigh-Ins','Save 50 weights',weights.length>=50,'gold'),
      A('weight-100','💎','100 Weigh-Ins','Save 100 weights',weights.length>=100,'diamond'),
      A('weightmove-5','📉','5 lb Progress','Move 5 lb from your starting weight',weightMove>=5),
      A('weightmove-10','📉','10 lb Progress','Move 10 lb from your starting weight',weightMove>=10,'silver'),
      A('weightmove-15','📉','15 lb Progress','Move 15 lb from your starting weight',weightMove>=15,'silver'),
      A('weightmove-25','🏅','25 lb Progress','Move 25 lb from your starting weight',weightMove>=25,'gold'),
      A('weightmove-50','💎','50 lb Progress','Move 50 lb from your starting weight',weightMove>=50,'diamond'),
      A('goal-reached','🏆','Goal Reached','Reach your saved goal weight',weights.length&&goal&&Math.abs(wNow-goal)<.05,'diamond'),

      A('workout-1','🏃','First Workout','Log your first exercise session',exercises.length>=1),
      A('workout-5','🏃','5 Workouts','Log 5 exercise sessions',exercises.length>=5),
      A('workout-10','🏃','10 Workouts','Log 10 exercise sessions',exercises.length>=10,'silver'),
      A('workout-25','🏋️','25 Workouts','Log 25 exercise sessions',exercises.length>=25,'silver'),
      A('workout-50','🏋️','50 Workouts','Log 50 exercise sessions',exercises.length>=50,'gold'),
      A('workout-100','🥇','100 Workouts','Log 100 exercise sessions',exercises.length>=100,'gold'),
      A('workout-250','💎','250 Workouts','Log 250 exercise sessions',exercises.length>=250,'diamond'),
      A('minutes-60','⏱️','60 Training Minutes','Log 60 total workout minutes',totalMinutes>=60),
      A('minutes-500','⏱️','500 Training Minutes','Log 500 total workout minutes',totalMinutes>=500,'silver'),
      A('minutes-1000','⏱️','1,000 Training Minutes','Log 1,000 total workout minutes',totalMinutes>=1000,'gold'),
      A('minutes-5000','💎','5,000 Training Minutes','Log 5,000 total workout minutes',totalMinutes>=5000,'diamond'),
      A('burn-500','⚡','500 Calories Burned','Log 500 total exercise calories burned',totalBurned>=500),
      A('burn-1000','⚡','1,000 Calories Burned','Log 1,000 total exercise calories burned',totalBurned>=1000,'silver'),
      A('burn-5000','🔥','5,000 Calories Burned','Log 5,000 total exercise calories burned',totalBurned>=5000,'gold'),
      A('burn-10000','💎','10,000 Calories Burned','Log 10,000 total exercise calories burned',totalBurned>=10000,'diamond'),

      A('pr-1','◆','First PR','Log your first lifting personal record',prs.length>=1),
      A('pr-5','◆','5 PRs','Log 5 lifting personal records',prs.length>=5),
      A('pr-10','◆','10 PRs','Log 10 lifting personal records',prs.length>=10,'silver'),
      A('pr-25','🏆','25 PRs','Log 25 lifting personal records',prs.length>=25,'silver'),
      A('pr-50','🏆','50 PRs','Log 50 lifting personal records',prs.length>=50,'gold'),
      A('pr-100','💎','100 PRs','Log 100 lifting personal records',prs.length>=100,'diamond'),
      A('lifts-3','🏋️','3 Lift Board','Log PRs for 3 different lifts',uniqueLifts>=3),
      A('lifts-5','🏋️','5 Lift Board','Log PRs for 5 different lifts',uniqueLifts>=5,'silver'),
      A('lifts-10','💎','10 Lift Board','Log PRs for 10 different lifts',uniqueLifts>=10,'diamond'),
      A('primp-10','📈','10% Stronger','Improve any lift by 10% from its first logged PR',bestPct>=10),
      A('primp-25','📈','25% Stronger','Improve any lift by 25% from its first logged PR',bestPct>=25,'silver'),
      A('primp-50','📈','50% Stronger','Improve any lift by 50% from its first logged PR',bestPct>=50,'gold'),
      A('primp-100','💎','100% Stronger','Double any lift from its first logged PR',bestPct>=100,'diamond'),

      A('days-7','📅','7 Days Tracked','Track activity on 7 different days',used>=7),
      A('days-30','📅','30 Days Tracked','Track activity on 30 different days',used>=30,'silver'),
      A('days-100','🗓️','100 Days Tracked','Track activity on 100 different days',used>=100,'gold'),
      A('days-365','💎','365 Days Tracked','Track activity on 365 different days',used>=365,'diamond'),
      A('favorite-1','⭐','First Favorite','Save your first favorite food',favorites>=1),
      A('favorite-10','⭐','10 Favorites','Save 10 favorite foods',favorites>=10,'silver'),
      A('favorite-25','🌟','25 Favorites','Save 25 favorite foods',favorites>=25,'gold')
    ];
  }

  let achievementTimer=null, achievementQueue=[], achievementShowing=false;
  function showNextAchievement(){
    if(achievementShowing||!achievementQueue.length)return;
    achievementShowing=true;
    const a=achievementQueue.shift(), p=$('achievementPop');
    p.innerHTML=`<strong>🏆 ACHIEVEMENT UNLOCKED — ${escapeHtml(a.name)}</strong><span>${escapeHtml(a.desc)}</span>`;
    p.classList.add('show');
    clearTimeout(achievementTimer);
    achievementTimer=setTimeout(()=>{p.classList.remove('show');achievementShowing=false;setTimeout(showNextAchievement,250)},3000);
  }
  function queueAchievement(a){achievementQueue.push(a);showNextAchievement()}

  function checkAchievementUnlocks(){
    state.engagement.unlockedAchievements=Array.isArray(state.engagement.unlockedAchievements)?state.engagement.unlockedAchievements:[];
    const defs=achievementDefinitions(), unlocked=new Set(state.engagement.unlockedAchievements);
    const newly=defs.filter(a=>a.on&&!unlocked.has(a.id));
    if(!state.engagement.achievementSystemReady){
      newly.forEach(a=>unlocked.add(a.id));
      state.engagement.achievementSystemReady=true;
      state.engagement.unlockedAchievements=[...unlocked];
      saveState();
      return;
    }
    if(newly.length){
      newly.forEach(a=>{unlocked.add(a.id);queueAchievement(a)});
      state.engagement.unlockedAchievements=[...unlocked];
      saveState();
    }
  }

  function renderAchievements(){
    const b=achievementDefinitions(), unlockedSet=new Set(state.engagement?.unlockedAchievements||[]);
    const unlocked=b.filter(x=>unlockedSet.has(x.id)).length;
    $('badgeCount').textContent=`${unlocked}/${b.length} unlocked`;
    $('badgeGrid').innerHTML=b.map(x=>{const on=unlockedSet.has(x.id);return `<div class="badge tier-${x.tier} ${on?'unlocked':''}"><span class="badge-icon">${x.icon}</span><strong>${escapeHtml(x.name)}</strong><span>${escapeHtml(x.desc)}</span><span class="badge-tier">${escapeHtml(x.tier)}</span></div>`}).join('');
  }








  let undoState=null, undoTimer=null;
  function showUndo(message,fn){
    undoState=fn; $('undoText').textContent=message; $('undoToast').classList.add('show');
    clearTimeout(undoTimer); undoTimer=setTimeout(()=>{$('undoToast').classList.remove('show');undoState=null},5000);
  }



  function historyDates(){
    const usage = state.engagement?.usedDates || [];
    const dataDates = Object.keys(state.days || {}).filter(date => {
      const day = state.days[date];
      return (day?.foods?.length || 0) > 0 || (day?.weights?.length || 0) > 0 ||
             (day?.exercises?.length || 0) > 0 || (day?.prs?.length || 0) > 0;
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
      const exercises = Array.isArray(day.exercises) ? day.exercises : [];
      const prs = Array.isArray(day.prs) ? day.prs : [];
      const calories = foods.reduce((sum,f) => sum + num(f.calories),0);
      const burned = exercises.reduce((sum,x)=>sum + num(x.caloriesBurned),0);
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
            ${burned ? ' • '+Math.round(burned)+' burned' : ''}${prs.length ? ' • '+prs.length+' PR'+(prs.length===1?'':'s') : ''}
            
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
      $('streakStatus').textContent = 'Open IRONLOG every day to keep this streak alive.';
    }

    renderWeekStrip(streak);

    const overlay = $('streakOverlay');
    overlay.classList.remove('hidden','closing');
  }


  let streakLaunchTimer=null;
  function launchStreakPopup(){
    try{
      showStreakPopup();
    }catch(err){
      console.error('Streak popup failed to open:',err);
    }
  }
  function scheduleStreakPopup(){
    clearTimeout(streakLaunchTimer);
    requestAnimationFrame(()=>{
      launchStreakPopup();
      streakLaunchTimer=setTimeout(launchStreakPopup,180);
    });
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

    const exercises=(day.exercises||[]).slice().sort((a,b)=>num(b.createdAt)-num(a.createdAt));
    $('exerciseLog').innerHTML=exercises.length?exercises.map(x=>`
      <div class="exercise-entry">
        <div>
          <strong>${escapeHtml(x.name)}</strong>
          <div class="exercise-meta">
            <span class="exercise-pill">${escapeHtml(x.type)}</span>
            ${Math.round(num(x.caloriesBurned))} calories burned${num(x.minutes)>0?' • '+Math.round(num(x.minutes))+' min':''}
          </div>
        </div>
        <button class="danger" style="width:auto;padding:8px 10px" data-exercise-delete="${x.id}">Delete</button>
      </div>
    `).join(''):'<div class="empty">No exercise logged for this day.</div>';

    const prs=(day.prs||[]).slice().sort((a,b)=>num(b.createdAt)-num(a.createdAt));
    $('prLog').innerHTML=prs.length?prs.map(p=>`
      <div class="pr-entry">
        <div>
          <strong>${escapeHtml(p.exercise)}</strong>
          <div class="pr-meta">
            <span class="pr-pill">PR</span>
            ${format1(p.weight)} lb × ${Math.max(1,num(p.reps)||1)} rep${Math.max(1,num(p.reps)||1)===1?'':'s'}
            ${p.note?' • '+escapeHtml(p.note):''}
          </div>
        </div>
        <button class="danger" style="width:auto;padding:8px 10px" data-pr-delete="${p.id}">Delete</button>
      </div>
    `).join(''):'<div class="empty">No lifting PRs logged for this day.</div>';

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
    renderHomeDashboard();
    renderDashboard();
    renderExerciseProgress();
    renderWeek();
    renderFavs();
    renderMonthlySummary();
    checkAchievementUnlocks();
    renderAchievements();
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


  function clearExerciseForm(){
    $('exerciseName').value='';
    $('exerciseType').value='Cardio';
    $('exerciseMinutes').value='';
    $('exerciseCalories').value='';
  }
  function clearPRForm(){
    $('prExercise').value='Deadlift';
    $('prCustomExercise').value='';
    $('customPRWrap').style.display='none';
    $('prWeight').value='';
    $('prReps').value='1';
    $('prNote').value='';
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


  $('addExerciseBtn').addEventListener('click',()=>{
    const name=$('exerciseName').value.trim();
    const calories=$('exerciseCalories').value.trim();
    if(!name){alert('Enter the exercise name.');$('exerciseName').focus();return}
    if(calories==='' || num(calories)<0){alert('Enter valid calories burned.');$('exerciseCalories').focus();return}
    getDay(selectedDate()).exercises.push({
      id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),
      name,
      type:$('exerciseType').value,
      minutes:Math.max(0,num($('exerciseMinutes').value)),
      caloriesBurned:Math.max(0,num(calories)),
      createdAt:Date.now()
    });
    clearExerciseForm();
    render();
  });
  $('clearExerciseBtn').addEventListener('click',clearExerciseForm);

  $('prExercise').addEventListener('change',()=>{
    $('customPRWrap').style.display=$('prExercise').value==='Other / Custom'?'block':'none';
    if($('prExercise').value!=='Other / Custom')$('prCustomExercise').value='';
  });
  $('addPRBtn').addEventListener('click',()=>{
    const selected=$('prExercise').value;
    const exercise=selected==='Other / Custom' ? $('prCustomExercise').value.trim() : selected;
    const weight=num($('prWeight').value);
    const reps=Math.max(1,Math.round(num($('prReps').value)||1));
    if(!exercise){alert('Enter the lift or exercise name.');$('prCustomExercise').focus();return}
    if(weight<=0){alert('Enter a valid PR weight.');$('prWeight').focus();return}
    getDay(selectedDate()).prs.push({
      id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),
      exercise,
      weight,
      reps,
      note:$('prNote').value.trim(),
      createdAt:Date.now()
    });
    clearPRForm();
    render();
  });
  $('clearPRBtn').addEventListener('click',clearPRForm);

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


  // ----- V22 menu navigation -----
  function closeMenu(){
    const drawer=$('menuDrawer'),backdrop=$('menuBackdrop');
    drawer.classList.remove('open');backdrop.classList.remove('open');drawer.setAttribute('aria-hidden','true');
  }
  function openMenu(){
    const drawer=$('menuDrawer'),backdrop=$('menuBackdrop');
    drawer.classList.add('open');backdrop.classList.add('open');drawer.setAttribute('aria-hidden','false');
  }
  function showHome(){
    document.querySelectorAll('.feature-section').forEach(el=>el.classList.remove('active'));
    const shell=$('appShell');shell.classList.add('home-view');shell.classList.remove('section-view');
    closeMenu();window.scrollTo({top:0,behavior:'smooth'});
  }
  function showSection(id){
    const target=document.getElementById(id);if(!target)return;
    document.querySelectorAll('.feature-section').forEach(el=>el.classList.remove('active'));
    target.classList.add('active');
    const shell=$('appShell');shell.classList.remove('home-view');shell.classList.add('section-view');
    closeMenu();window.scrollTo({top:0,behavior:'smooth'});
  }

  const menuTabButton=$('menuTab');
  menuTabButton.addEventListener('click',openMenu);
  menuTabButton.addEventListener('touchend',e=>{e.preventDefault();openMenu()},{passive:false});
  $('menuClose').addEventListener('click',closeMenu);
  $('menuBackdrop').addEventListener('click',closeMenu);
  $('menuDrawer').addEventListener('click',e=>{
    const sectionButton=e.target.closest('[data-menu-section]');
    if(sectionButton){showSection(sectionButton.dataset.menuSection);return}
    if(e.target.closest('[data-menu-home]')){showHome();return}
    if(e.target.closest('[data-menu-history]')){closeMenu();openHistory();return}
    if(e.target.closest('[data-menu-streak]')){closeMenu();launchStreakPopup();return}
  });

  const historyTabButton = $('historyTab');
  historyTabButton.addEventListener('click', openHistory);
  historyTabButton.addEventListener('touchend',e=>{e.preventDefault();openHistory()},{passive:false});
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

  const streakTabButton=$('streakTab');
  function openStreakFromButton(e){
    if(e && e.type==='touchend') e.preventDefault();
    launchStreakPopup();
  }
  streakTabButton.addEventListener('click',openStreakFromButton);
  streakTabButton.addEventListener('touchend',openStreakFromButton,{passive:false});

  $('streakClose').addEventListener('click', closeStreakPopup);
  $('streakContinue').addEventListener('click', closeStreakPopup);
  $('streakOverlay').addEventListener('click', e => {
    if(e.target === $('streakOverlay')) closeStreakPopup();
  });

  document.addEventListener('keydown', e => {
    if(e.key === 'Escape'){
      closeMenu();
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


  $('undoBtn').addEventListener('click',()=>{
    if(undoState){const fn=undoState;undoState=null;fn();$('undoToast').classList.remove('show')}
  });


  $('saveHomeGoalsBtn').addEventListener('click',()=>{
    const cal=num($('homeCalorieGoal').value), pro=num($('homeProteinGoal').value), weight=num($('homeWeightGoal').value), workouts=Math.round(num($('homeWorkoutGoal').value));
    const prName=$('homePRGoalExercise').value.trim(), prWeight=num($('homePRGoalWeight').value);
    if(cal<=0){alert('Enter a valid daily calorie goal.');$('homeCalorieGoal').focus();return}
    if(pro<0){alert('Enter a valid protein goal.');$('homeProteinGoal').focus();return}
    if(weight<=0){alert('Enter a valid goal weight.');$('homeWeightGoal').focus();return}
    if(workouts<=0){alert('Enter a valid weekly workout goal.');$('homeWorkoutGoal').focus();return}
    if((prName&&!prWeight)||(!prName&&prWeight)){alert('For a PR goal, enter both the lift name and target weight — or leave both blank.');return}
    state.settings.calorieGoal=cal;state.settings.proteinGoal=pro;state.settings.endGoalWeight=weight;state.settings.weeklyWorkoutGoal=workouts;state.settings.prGoalExercise=prName;state.settings.prGoalWeight=prWeight||'';
    saveState();render();
    const btn=$('saveHomeGoalsBtn');btn.textContent='Saved ✓';setTimeout(()=>{if($('saveHomeGoalsBtn'))$('saveHomeGoalsBtn').textContent='Save Goals'},1200);
  });
  $('liftProgressSelect').addEventListener('change',renderExerciseProgress);
  $('exerciseProgressSelect').addEventListener('change',renderExerciseProgress);

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
    const exerciseId = e.target?.dataset?.exerciseDelete;
    const prId = e.target?.dataset?.prDelete;

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
    if(exerciseId){
      const day=getDay(selectedDate());
      const idx=day.exercises.findIndex(x=>x.id===exerciseId);
      if(idx>=0){const removed=day.exercises.splice(idx,1)[0];render();showUndo('Exercise deleted.',()=>{getDay(selectedDate()).exercises.splice(idx,0,removed);render()})}
    }
    if(prId){
      const day=getDay(selectedDate());
      const idx=day.prs.findIndex(x=>x.id===prId);
      if(idx>=0){const removed=day.prs.splice(idx,1)[0];render();showUndo('PR deleted.',()=>{getDay(selectedDate()).prs.splice(idx,0,removed);render()})}
    }
  });

  $('resetDayBtn').addEventListener('click', () => {
    if(confirm('Clear all food, exercise, PR, and weight entries for the selected day?')){
      state.days[selectedDate()] = {foods:[],weights:[],exercises:[],prs:[],note:'',mood:0,hunger:0};
      render();
    }
  });

  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ironlog-data.json';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
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
    installText.textContent = 'IRONLOG is installed on this device.';
    installBtn.textContent = 'Installed';
    installBtn.disabled = true;
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if(!standalone()){
      installText.textContent = 'IRONLOG is ready to install on this device.';
      installBtn.textContent = 'Install App';
      installBtn.disabled = false;
    }
  });

  installBtn.addEventListener('click', async () => {
    if(standalone()){
      showInstallMessage('IRONLOG is already installed on this device.');
      return;
    }

    if(deferredInstallPrompt){
      deferredInstallPrompt.prompt();
      const result = await deferredInstallPrompt.userChoice;
      if(result.outcome === 'accepted'){
        installText.textContent = 'Installing IRONLOG…';
      }
      deferredInstallPrompt = null;
      return;
    }

    const ua = navigator.userAgent.toLowerCase();
    if(/iphone|ipad|ipod/.test(ua)){
      showInstallMessage('On iPhone/iPad: open this page in Safari, tap Share, then choose “Add to Home Screen.”');
    }else{
      showInstallMessage('In Chrome, tap the ⋮ menu and choose “Install app” or “Add to Home screen.” If you already installed IRONLOG, Chrome may not offer the install option again.');
    }
  });

  window.addEventListener('appinstalled', () => {
    installText.textContent = 'IRONLOG is installed on this device.';
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

  // V21: open the streak first so another card can never prevent it from appearing.
  scheduleStreakPopup();

  try{
    render();
    showHome();
  }catch(err){
    console.error('IRONLOG render error:',err);
  }

  // Installed PWAs can resume differently than a normal browser tab, so retry on load.
  window.addEventListener('load',()=>{
    if($('streakOverlay')?.classList.contains('hidden')) scheduleStreakPopup();
  },{once:true});
})();
