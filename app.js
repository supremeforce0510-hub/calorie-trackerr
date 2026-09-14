(() => {
  'use strict';

  const STORAGE_KEY = 'calorieTrackMVP_v1';
  const APP_VERSION = 'V32';
  const $ = id => document.getElementById(id);

  function todayLocal(){
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0,10);
  }

  function defaultState(){
    return {
      settings:{calorieGoal:1800, proteinGoal:100, endGoalWeight:'', weeklyWorkoutGoal:3, prGoalExercise:'', prGoalWeight:'', lastBackupAt:'', backupReminderStartedAt:'', dailyBackupReminderDate:'', dailyBackupReminderStartedAt:'', dailyBackupReminderShownDate:'', theme:'purple', reminderEnabled:false, reminderTime:'19:00'},
      profile:{age:'', sex:'', height:'', weight:'', activity:'sedentary'},
      days:{},
      engagement:{usedDates:[], celebratedMilestones:[], unlockedAchievements:[], achievementUnlockedAt:{}, completedAchievementCategories:[], categoryCompletionV32Ready:false, achievementSystemReady:false, achievementV25Ready:false},
      favorites:[],
      exerciseFavorites:[],
      customMeals:[]
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
          lastBackupAt:parsed?.settings?.lastBackupAt ?? '',
          backupReminderStartedAt:parsed?.settings?.backupReminderStartedAt ?? '',
          dailyBackupReminderDate:parsed?.settings?.dailyBackupReminderDate ?? '',
          dailyBackupReminderStartedAt:parsed?.settings?.dailyBackupReminderStartedAt ?? '',
          dailyBackupReminderShownDate:parsed?.settings?.dailyBackupReminderShownDate ?? '',
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
          achievementUnlockedAt:parsed?.engagement?.achievementUnlockedAt && typeof parsed.engagement.achievementUnlockedAt === 'object' ? parsed.engagement.achievementUnlockedAt : {},
          completedAchievementCategories:Array.isArray(parsed?.engagement?.completedAchievementCategories) ? parsed.engagement.completedAchievementCategories : [],
          categoryCompletionV32Ready:Boolean(parsed?.engagement?.categoryCompletionV32Ready),
          achievementSystemReady:Boolean(parsed?.engagement?.achievementSystemReady),
          achievementV25Ready:Boolean(parsed?.engagement?.achievementV25Ready)
        },
        favorites:Array.isArray(parsed?.favorites) ? parsed.favorites : [],
        exerciseFavorites:Array.isArray(parsed?.exerciseFavorites) ? parsed.exerciseFavorites : [],
        customMeals:Array.isArray(parsed?.customMeals) ? parsed.customMeals.filter(v=>String(v).trim()).map(v=>String(v).trim()) : []
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

  function allFoodHistory(){
    const a=[];
    Object.entries(state.days||{}).forEach(([date,d])=>(d?.foods||[]).forEach(f=>a.push({...f,date})));
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
  function dayHasRealData(date){
    const d=state.days?.[date];
    return Boolean((d?.foods?.length||0)||(d?.weights?.length||0)||(d?.exercises?.length||0)||(d?.prs?.length||0));
  }
  function weekStats(ds){
    const today=todayLocal();
    const tracked=ds.filter(x=>x<=today&&dayHasRealData(x));
    let cal=0,pro=0,foodDays=0,foods=0,workouts=0,burned=0,prs=0;
    tracked.forEach(x=>{
      const d=state.days?.[x]||{};
      const fs=d.foods||[], ex=d.exercises||[], pp=d.prs||[];
      if(fs.length){
        foodDays++;foods+=fs.length;
        fs.forEach(f=>{cal+=num(f.calories);pro+=num(f.protein)});
      }
      workouts+=ex.length;burned+=ex.reduce((sum,e)=>sum+num(e.caloriesBurned),0);prs+=pp.length;
    });
    const ww=allWeights().filter(w=>ds.includes(w.date));
    return {
      days:tracked.length, foods, foodDays,
      cal:foodDays?cal/foodDays:0, pro:foodDays?pro/foodDays:0,
      workouts,burned,prs,weighins:ww.length,
      w:ww.length>1?num(ww.at(-1).value)-num(ww[0].value):null
    };
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
      return `<button type="button" class="home-pr-item" data-pr-timeline="${escapeHtml(p.exercise)}" aria-label="Open ${escapeHtml(p.exercise)} PR timeline"><div class="pr-name">${escapeHtml(p.exercise)}</div><div class="pr-best">${format1(p.weight)} lb × ${Math.max(1,num(p.reps)||1)}</div><div class="pr-improve">${escapeHtml(improve)} • Tap for timeline</div></button>`;
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

  function weightClosestOnOrBefore(date){
    const target=parseLocalDate(date).getTime();
    const list=allWeights().filter(w=>(num(w.createdAt)||parseLocalDate(w.date).getTime())<=target).sort((a,b)=>(num(a.createdAt)||parseLocalDate(a.date).getTime())-(num(b.createdAt)||parseLocalDate(b.date).getTime()));
    return list.length?list.at(-1):null;
  }

  function render15DaySnapshot(){
    const end=todayLocal(), start=addDays(end,-14);
    const inWindow=x=>String(x.date||'')>=start&&String(x.date||'')<=end;
    const startW=weightClosestOnOrBefore(start), endW=weightClosestOnOrBefore(end);
    const workouts=allExercises().filter(inWindow), prs=allPRs().filter(inWindow);
    const burned=workouts.reduce((s,x)=>s+num(x.caloriesBurned),0);
    const change=startW&&endW?num(endW.value)-num(startW.value):null;
    const since=parseLocalDate(start).setHours(0,0,0,0), through=parseLocalDate(end).setHours(23,59,59,999);
    const unlockedAt=state.engagement?.achievementUnlockedAt||{};
    const achievements=Object.values(unlockedAt).filter(ts=>num(ts)>=since&&num(ts)<=through).length;
    $('snapshotRange').textContent=`${friendlyDate(start)} – ${friendlyDate(end)}`;
    $('snapshotWeight').textContent=change===null?'—':`${change>0?'+':''}${format1(change)} lb`;
    $('snapshotWorkouts').textContent=workouts.length;
    $('snapshotBurned').textContent=Math.round(burned).toLocaleString();
    $('snapshotPRs').textContent=prs.length;
    $('snapshotAchievements').textContent=achievements;
  }

  function renderDashboard(){
    render15DaySnapshot();
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
  function achievementUnlocksBetween(startDate,endDate){
    const defs=[...achievementDefinitions(), masterAchievementDefinition()];
    const byId=new Map(defs.map(a=>[a.id,a]));
    const start=parseLocalDate(startDate).getTime();
    const end=parseLocalDate(endDate).getTime()+86399999;
    return Object.entries(state.engagement?.achievementUnlockedAt||{})
      .map(([id,ts])=>({id,ts:Number(ts)||0,a:byId.get(id)}))
      .filter(x=>x.a&&x.ts>=start&&x.ts<=end)
      .sort((a,b)=>a.ts-b.ts);
  }
  function openReportAchievements(title,startDate,endDate){
    const items=achievementUnlocksBetween(startDate,endDate);
    $('reportAchievementTitle').textContent=title;
    $('reportAchievementList').innerHTML=items.length?items.map(x=>`<button type="button" class="report-achievement-item" data-report-achievement-id="${escapeHtml(x.id)}"><span>${achievementIconMarkup(x.a,'report-achievement-icon')}</span><span><strong>${escapeHtml(x.a.name)}</strong><small>${new Date(x.ts).toLocaleDateString()}</small></span></button>`).join(''):'<div class="empty">No dated achievement unlocks in this period yet.</div>';
    $('reportAchievementBackdrop').classList.add('open');
    $('reportAchievementBackdrop').setAttribute('aria-hidden','false');
  }
  function closeReportAchievements(){
    $('reportAchievementBackdrop').classList.remove('open');
    $('reportAchievementBackdrop').setAttribute('aria-hidden','true');
  }

  function renderWeek(){
    const a=weekDates(0),b=weekDates(-1),x=weekStats(a),y=weekStats(b);
    $('weekRange').textContent=`${friendlyDate(a[0])} – ${friendlyDate(a[6])}`;
    $('weekDays').textContent=x.days;
    $('weekFoods').textContent=x.foods;
    $('weekCalories').textContent=Math.round(x.cal);
    $('weekProtein').textContent=format1(x.pro)+'g';
    $('weekWorkouts').textContent=x.workouts;
    $('weekBurned').textContent=Math.round(x.burned);
    $('weekPRs').textContent=x.prs;
    $('weekWeight').textContent=x.w===null?'—':(x.w>0?'+':'')+format1(x.w)+' lb';
    $('weekStreak').textContent=currentStreakInfo().count;
    const weekAchievements=achievementUnlocksBetween(a[0],a[6]);
    $('weekAchievements').textContent=weekAchievements.length;
    $('weekAchievementsCard').dataset.rangeStart=a[0];$('weekAchievementsCard').dataset.rangeEnd=a[6];
    if(y.days){
      const workoutDiff=x.workouts-y.workouts, burnedDiff=Math.round(x.burned-y.burned);
      $('weekCompare').textContent=`Compared with last week: ${workoutDiff>=0?'+':''}${workoutDiff} workouts • ${burnedDiff>=0?'+':''}${burnedDiff} exercise calories • ${x.foods-y.foods>=0?'+':''}${x.foods-y.foods} food entries.`;
    }else $('weekCompare').textContent='This report updates automatically from the food, weight, exercise, and PR data you log.';
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
    const todayKey=todayLocal();
    const dates=Object.keys(state.days||{}).filter(d=>d.startsWith(prefix)&&d<=todayKey&&dayHasRealData(d)).sort();
    let cal=0,pro=0,foodDays=0,foods=0,workouts=0,burned=0,prs=0,weighins=0;
    dates.forEach(date=>{
      const d=state.days[date]||{},fs=d.foods||[],ex=d.exercises||[],pp=d.prs||[],ww=d.weights||[];
      if(fs.length){foodDays++;foods+=fs.length;fs.forEach(f=>{cal+=num(f.calories);pro+=num(f.protein)})}
      workouts+=ex.length;burned+=ex.reduce((sum,e)=>sum+num(e.caloriesBurned),0);prs+=pp.length;weighins+=ww.length;
    });
    const ww=allWeights().filter(w=>w.date.startsWith(prefix));
    const wc=ww.length>1?num(ww.at(-1).value)-num(ww[0].value):null;
    $('monthLabel').textContent=today.toLocaleDateString([],{month:'long',year:'numeric'});
    $('monthDays').textContent=dates.length;
    $('monthCalories').textContent=foodDays?Math.round(cal/foodDays):0;
    $('monthProtein').textContent=(foodDays?format1(pro/foodDays):0)+'g';
    $('monthWeight').textContent=wc===null?'—':(wc>0?'+':'')+format1(wc)+' lb';
    $('monthFoods').textContent=foods;
    $('monthWorkouts').textContent=workouts;
    $('monthBurned').textContent=Math.round(burned);
    $('monthPRs').textContent=prs;
    $('monthWeighIns').textContent=weighins;
    const monthStart=`${prefix}01`, monthEnd=todayKey;
    const monthAchievements=achievementUnlocksBetween(monthStart,monthEnd);
    $('monthAchievements').textContent=monthAchievements.length;
    $('monthAchievementsCard').dataset.rangeStart=monthStart;$('monthAchievementsCard').dataset.rangeEnd=monthEnd;
  }

  function achievementDefinitions(){
    const foods=allFoodHistory(), weights=allWeights(), exercises=allExercises(), prs=allPRs();
    const best=longestStreak(), favorites=(state.favorites||[]).length;
    const totalBurned=exercises.reduce((s,x)=>s+num(x.caloriesBurned),0);
    const totalMinutes=exercises.reduce((s,x)=>s+num(x.minutes),0);
    const uniqueLifts=new Set(prs.map(p=>String(p.exercise||'').trim()).filter(Boolean)).size;
    const wStart=weights.length?num(weights[0].value):0,wNow=weights.length?num(weights.at(-1).value):0;
    const weightMove=wStart&&wNow?Math.abs(wNow-wStart):0;
    const goal=num(state.settings.endGoalWeight);
    const proteinGoal=Math.max(0,num(state.settings.proteinGoal));
    const calorieGoal=Math.max(1,num(state.settings.calorieGoal)||1800);
    const dataDates=Object.keys(state.days||{}).filter(dayHasRealData);
    let proteinDays=0, calorieDays=0, bothGoalDays=0, foodDays=0;
    const mealTypes=new Set();
    let earlyBird=false,nightOwl=false,doubleDuty=false,fullHouse=false,ironDiscipline=false;
    dataDates.forEach(date=>{
      const d=state.days[date]||{},fs=d.foods||[],ex=d.exercises||[],pp=d.prs||[],ww=d.weights||[];
      if(fs.length)foodDays++;
      fs.forEach(f=>mealTypes.add(String(f.meal||'').toLowerCase()));
      const c=fs.reduce((s,f)=>s+num(f.calories),0),p=fs.reduce((s,f)=>s+num(f.protein),0);
      const proteinHit=proteinGoal>0&&p>=proteinGoal, calorieHit=fs.length>0&&c<=calorieGoal;
      if(proteinHit)proteinDays++;if(calorieHit)calorieDays++;if(proteinHit&&calorieHit)bothGoalDays++;
      if(ex.length&&pp.length)doubleDuty=true;
      if(fs.length&&ww.length&&ex.length&&pp.length)fullHouse=true;
      if(ex.length&&proteinHit&&calorieHit)ironDiscipline=true;
      [...fs,...ex,...pp,...ww].forEach(item=>{
        const t=num(item.createdAt);if(!t)return;const h=new Date(t).getHours();if(h<7)earlyBird=true;if(h>=22)nightOwl=true;
      });
    });
    const mealExplorer=['breakfast','lunch','dinner','snack','drink'].every(x=>mealTypes.has(x));
    const A=(id,icon,name,desc,on,tier='bronze',category='special')=>({id,icon,iconId:'icon-'+id,name,desc,on:Boolean(on),tier,category});
    return [
      A('streak-1','🔥','1 Day','Start a 1-day IRONLOG streak',best>=1,'bronze','streak'),
      A('streak-3','🔥','3 Days','Reach a 3-day streak',best>=3,'bronze','streak'),
      A('streak-5','🔥','5 Days','Reach a 5-day streak',best>=5,'silver','streak'),
      A('streak-10','⚡','10 Days','Reach a 10-day streak',best>=10,'silver','streak'),
      A('streak-20','⚡','20 Days','Reach a 20-day streak',best>=20,'gold','streak'),
      A('streak-30','👑','30 Days','Reach a 30-day streak',best>=30,'gold','streak'),
      A('streak-35','💎','35 Days','Reach a 35-day streak',best>=35,'diamond','streak'),

      A('food-1','🍎','First Bite','Log your first food entry',foods.length>=1,'bronze','food'),
      A('food-10','🥪','10 Foods','Log 10 food entries',foods.length>=10,'bronze','food'),
      A('food-25','🥗','25 Foods','Log 25 food entries',foods.length>=25,'silver','food'),
      A('food-50','🍲','50 Foods','Log 50 food entries',foods.length>=50,'silver','food'),
      A('food-100','🍽️','100 Foods','Log 100 food entries',foods.length>=100,'gold','food'),
      A('food-250','👩‍🍳','250 Foods','Log 250 food entries',foods.length>=250,'gold','food'),
      A('food-500','🏅','500 Foods','Log 500 food entries',foods.length>=500,'diamond','food'),
      A('food-1000','💎','1,000 Foods','Log 1,000 food entries',foods.length>=1000,'diamond','food'),

      A('weight-1','⚖️','First Weigh-In','Save your first weight',weights.length>=1,'bronze','weight'),
      A('weight-5','📟','5 Weigh-Ins','Save 5 weight entries',weights.length>=5,'bronze','weight'),
      A('weight-10','📊','10 Weigh-Ins','Save 10 weight entries',weights.length>=10,'silver','weight'),
      A('weight-25','📉','25 Weigh-Ins','Save 25 weight entries',weights.length>=25,'silver','weight'),
      A('weight-50','🏅','50 Weigh-Ins','Save 50 weight entries',weights.length>=50,'gold','weight'),
      A('weightmove-5','⬇️','5 lb Progress','Move 5 lb from your starting weight',weightMove>=5,'gold','weight'),
      A('weightmove-10','🏆','10 lb Progress','Move 10 lb from your starting weight',weightMove>=10,'diamond','weight'),
      A('goal-reached','🎯','Goal Weight','Reach your saved goal weight',weights.length&&goal&&Math.abs(wNow-goal)<.05,'diamond','weight'),

      A('workout-1','🏋️','1 Workout','Log your first exercise session',exercises.length>=1,'bronze','workout'),
      A('workout-5','👟','5 Workouts','Log 5 exercise sessions',exercises.length>=5,'bronze','workout'),
      A('workout-10','💪','10 Workouts','Log 10 exercise sessions',exercises.length>=10,'silver','workout'),
      A('workout-25','🏋️','25 Workouts','Log 25 exercise sessions',exercises.length>=25,'silver','workout'),
      A('workout-50','🚴','50 Workouts','Log 50 exercise sessions',exercises.length>=50,'gold','workout'),
      A('workout-100','🥇','100 Workouts','Log 100 exercise sessions',exercises.length>=100,'gold','workout'),
      A('workout-250','⛰️','250 Workouts','Log 250 exercise sessions',exercises.length>=250,'diamond','workout'),
      A('minutes-60','⏱️','60 Minutes','Log 60 total workout minutes',totalMinutes>=60,'silver','workout'),
      A('minutes-1000','⌛','1,000 Minutes','Log 1,000 total workout minutes',totalMinutes>=1000,'diamond','workout'),

      A('pr-1','👑','First PR','Log your first lifting personal record',prs.length>=1,'bronze','pr'),
      A('pr-5','🏋️','5 PRs','Log 5 lifting personal records',prs.length>=5,'bronze','pr'),
      A('pr-10','⭐','10 PRs','Log 10 lifting personal records',prs.length>=10,'silver','pr'),
      A('pr-25','🏅','25 PRs','Log 25 lifting personal records',prs.length>=25,'silver','pr'),
      A('pr-50','📈','50 PRs','Log 50 lifting personal records',prs.length>=50,'gold','pr'),
      A('pr-100','🏆','100 PRs','Log 100 lifting personal records',prs.length>=100,'diamond','pr'),
      A('lifts-3','3️⃣','3 Lift Board','Log PRs for 3 different lifts',uniqueLifts>=3,'silver','pr'),
      A('lifts-5','5️⃣','5 Lift Board','Log PRs for 5 different lifts',uniqueLifts>=5,'gold','pr'),
      A('lifts-10','🔟','10 Lift Board','Log PRs for 10 different lifts',uniqueLifts>=10,'diamond','pr'),

      A('protein-1','💪','Protein Goal Day','Reach your protein goal on 1 logged day',proteinDays>=1,'bronze','nutrition'),
      A('protein-7','🥩','7 Protein Days','Reach your protein goal on 7 days',proteinDays>=7,'silver','nutrition'),
      A('protein-30','🥇','30 Protein Days','Reach your protein goal on 30 days',proteinDays>=30,'gold','nutrition'),
      A('calorie-1','🎯','Calorie Goal Day','Finish 1 logged food day at or under your calorie goal',calorieDays>=1,'bronze','nutrition'),
      A('calorie-7','✅','7 Calorie Days','Finish 7 food-log days at or under your calorie goal',calorieDays>=7,'silver','nutrition'),
      A('calorie-30','🏹','30 Calorie Days','Finish 30 food-log days at or under your calorie goal',calorieDays>=30,'gold','nutrition'),
      A('bothgoal-7','🥗','7 Balanced Days','Hit both calorie and protein goals on 7 days',bothGoalDays>=7,'gold','nutrition'),
      A('bothgoal-30','🌈','30 Balanced Days','Hit both calorie and protein goals on 30 days',bothGoalDays>=30,'diamond','nutrition'),

      A('days-7','📅','7 Days Tracked','Log real data on 7 different days',dataDates.length>=7,'bronze','progress'),
      A('days-30','🗓️','30 Days Tracked','Log real data on 30 different days',dataDates.length>=30,'silver','progress'),
      A('days-90','📆','90 Days Tracked','Log real data on 90 different days',dataDates.length>=90,'silver','progress'),
      A('days-180','📈','180 Days Tracked','Log real data on 180 different days',dataDates.length>=180,'gold','progress'),
      A('days-365','💎','1 Year Tracked','Log real data on 365 different days',dataDates.length>=365,'diamond','progress'),
      A('weightmove-25','⬇️','25 lb Progress','Move 25 lb from your starting weight',weightMove>=25,'gold','progress'),
      A('weightmove-50','🏆','50 lb Progress','Move 50 lb from your starting weight',weightMove>=50,'diamond','progress'),

      A('favorite-1','⭐','First Favorite','Save your first favorite food',favorites>=1,'bronze','lifestyle'),
      A('favorite-10','🌟','10 Favorites','Save 10 favorite foods',favorites>=10,'silver','lifestyle'),
      A('favorite-25','✨','25 Favorites','Save 25 favorite foods',favorites>=25,'gold','lifestyle'),
      A('meal-explorer','🍴','Meal Explorer','Log Breakfast, Lunch, Dinner, Snack, and Drink at least once',mealExplorer,'silver','lifestyle'),
      A('fooddays-7','🍏','7 Food-Log Days','Log food on 7 different days',foodDays>=7,'gold','lifestyle'),
      A('fooddays-30','🌿','30 Food-Log Days','Log food on 30 different days',foodDays>=30,'diamond','lifestyle'),

      A('special-early','🌅','Early Bird','Log something before 7:00 AM',earlyBird,'silver','special'),
      A('special-night','🌙','Night Owl','Log something at or after 10:00 PM',nightOwl,'silver','special'),
      A('special-double','⚔️','Double Duty','Log a workout and a PR on the same day',doubleDuty,'gold','special'),
      A('special-full','🧰','Full House','Log food, weight, exercise, and a PR on the same day',fullHouse,'gold','special'),
      A('special-discipline','⚡','Iron Discipline','Hit calorie + protein goals and log a workout on the same day',ironDiscipline,'diamond','special')
    ];
  }

  function masterAchievementDefinition(){
    const defs=achievementDefinitions(), unlocked=new Set(state.engagement?.unlockedAchievements||[]);
    return {id:'master-of-all',icon:'👑',iconId:'icon-master-of-all',name:'MASTER OF ALL',desc:'Unlock all 67 IRONLOG achievements.',tier:'diamond',category:'master',on:defs.every(a=>unlocked.has(a.id))};
  }

  let achievementTimer=null, achievementQueue=[], achievementShowing=false;
  function showNextAchievement(){
    if(achievementShowing||!achievementQueue.length)return;
    achievementShowing=true;
    const item=achievementQueue.shift(), p=$('achievementPop');
    p.innerHTML=`<strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.message)}</span>`;
    p.classList.add('show');
    clearTimeout(achievementTimer);
    achievementTimer=setTimeout(()=>{p.classList.remove('show');achievementShowing=false;setTimeout(showNextAchievement,250)},item.duration||3000);
  }
  function queueAchievement(a){achievementQueue.push({title:`🏆 ACHIEVEMENT UNLOCKED — ${a.name}`,message:a.desc,duration:3000});showNextAchievement()}
  function queueTopNotice(title,message,duration=2000){achievementQueue.push({title,message,duration});showNextAchievement()}

  function checkAchievementUnlocks(){
    state.engagement.unlockedAchievements=Array.isArray(state.engagement.unlockedAchievements)?state.engagement.unlockedAchievements:[];
    const defs=achievementDefinitions(), unlocked=new Set(state.engagement.unlockedAchievements);
    const newly=defs.filter(a=>a.on&&!unlocked.has(a.id));
    state.engagement.achievementUnlockedAt=state.engagement.achievementUnlockedAt&&typeof state.engagement.achievementUnlockedAt==='object'?state.engagement.achievementUnlockedAt:{};
    if(!state.engagement.achievementV25Ready){
      newly.forEach(a=>unlocked.add(a.id));
      state.engagement.achievementV25Ready=true;
    }else newly.forEach(a=>{unlocked.add(a.id);state.engagement.achievementUnlockedAt[a.id]=Date.now();queueAchievement(a)});
    state.engagement.unlockedAchievements=[...unlocked];
    const master=masterAchievementDefinition();
    if(master.on&&!unlocked.has(master.id)){
      unlocked.add(master.id);
      state.engagement.unlockedAchievements=[...unlocked];
      if(state.engagement.achievementV25Ready){state.engagement.achievementUnlockedAt[master.id]=Date.now();queueAchievement(master)}
    }
    state.engagement.completedAchievementCategories=Array.isArray(state.engagement.completedAchievementCategories)?state.engagement.completedAchievementCategories:[];
    const completedSet=new Set(state.engagement.completedAchievementCategories);
    const categoryReady=Boolean(state.engagement.categoryCompletionV32Ready);
    ['streak','food','weight','workout','pr','nutrition','progress','lifestyle','special'].forEach(key=>{
      const items=defs.filter(a=>a.category===key);
      if(items.length&&items.every(a=>unlocked.has(a.id))&&!completedSet.has(key)){
        completedSet.add(key);
        if(categoryReady&&state.engagement.achievementV25Ready){const cat=ACHIEVEMENT_CATEGORIES[key];queueTopNotice(`🏆 ${cat.name.replace(' Achievements','')} COMPLETE`,`${items.length}/${items.length} achievements unlocked`,2000)}
      }
    });
    state.engagement.completedAchievementCategories=[...completedSet];
    state.engagement.categoryCompletionV32Ready=true;
    saveState();
  }

  const ACHIEVEMENT_CATEGORIES={
    streak:{key:'streak',icon:'🔥',name:'Streak Achievements',desc:'Build consistency. Show up for yourself.'},
    food:{key:'food',icon:'🍎',name:'Food Tracking Achievements',desc:'Log your meals. Build awareness.'},
    weight:{key:'weight',icon:'⚖️',name:'Weight Achievements',desc:'Track progress. Celebrate change.'},
    workout:{key:'workout',icon:'🏋️',name:'Workout Achievements',desc:'Put in the work. Get stronger.'},
    pr:{key:'pr',icon:'👑',name:'Strength / PR Achievements',desc:'Set records. Raise the bar.'},
    nutrition:{key:'nutrition',icon:'🥗',name:'Nutrition Achievements',desc:'Hit your goals. Fuel your potential.'},
    progress:{key:'progress',icon:'📈',name:'Progress Achievements',desc:'Look back. Be proud. Keep going.'},
    lifestyle:{key:'lifestyle',icon:'🧠',name:'Lifestyle Achievements',desc:'Small habits. Big results.'},
    special:{key:'special',icon:'⭐',name:'Special Achievements',desc:'Unique milestones. Extra rewards.'},
    master:{key:'master',icon:'👑',name:'Secret Achievement',desc:'The ultimate IRONLOG completion badge.'}
  };
  function achievementCategoryFor(aOrId){
    const a=typeof aOrId==='string'?achievementDefinitions().find(x=>x.id===aOrId):aOrId;
    if(a?.id==='master-of-all')return ACHIEVEMENT_CATEGORIES.master;
    return ACHIEVEMENT_CATEGORIES[a?.category]||ACHIEVEMENT_CATEGORIES.special;
  }
  function achievementIconMarkup(a,cls='achievement-tile-icon'){
    return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><use href="./achievement-icons.svg#${escapeHtml(a.iconId)}"></use></svg>`;
  }
  function openAchievementDetail(id){
    const core=achievementDefinitions(), master=masterAchievementDefinition();
    const a=id===master.id?master:core.find(x=>x.id===id);if(!a)return;
    const unlockedSet=new Set(state.engagement?.unlockedAchievements||[]),on=unlockedSet.has(a.id),cat=achievementCategoryFor(a);
    $('achievementDetailIcon').innerHTML=achievementIconMarkup(a,'achievement-detail-svg');
    $('achievementDetailName').textContent=a.name;
    $('achievementDetailDesc').textContent=a.desc;
    $('achievementDetailStatus').textContent=on?'Unlocked':'Locked';
    $('achievementDetailTier').textContent=a.tier;
    $('achievementDetailCategory').textContent=cat.name.replace(' Achievements','');
    $('achievementDetailHint').textContent=on?'You unlocked this achievement.':'Unlock requirement: '+a.desc;
    $('achievementDetail').classList.toggle('unlocked',on);
    $('achievementDetailBackdrop').classList.add('open');
    $('achievementDetailBackdrop').setAttribute('aria-hidden','false');
  }
  function closeAchievementDetail(){
    $('achievementDetailBackdrop').classList.remove('open');
    $('achievementDetailBackdrop').setAttribute('aria-hidden','true');
  }

  function renderAchievements(){
    const b=achievementDefinitions(), unlockedSet=new Set(state.engagement?.unlockedAchievements||[]);
    const unlocked=b.filter(x=>unlockedSet.has(x.id)).length;
    $('badgeCount').textContent=`${unlocked}/67 unlocked`;
    if($('achievementUnlockedCount'))$('achievementUnlockedCount').textContent=`${unlocked} / 67`;
    const order=['streak','food','weight','workout','pr','nutrition','progress','lifestyle','special'];
    const groups=new Map();
    b.forEach(a=>{const c=achievementCategoryFor(a);if(!groups.has(c.key))groups.set(c.key,{...c,items:[]});groups.get(c.key).items.push(a)});
    let html=order.map(key=>{
      const g=groups.get(key);if(!g)return '';
      const got=g.items.filter(a=>unlockedSet.has(a.id)).length;
      return `<section class="achievement-group"><div class="achievement-group-head"><div class="achievement-group-title"><span class="cat-icon">${g.icon}</span><div><strong>${escapeHtml(g.name)}</strong><span>${escapeHtml(g.desc)}</span></div></div><div class="achievement-group-count">${got} / ${g.items.length}</div></div><div class="achievement-strip">${g.items.map(a=>{const on=unlockedSet.has(a.id);return `<button type="button" class="achievement-tile tier-${a.tier} ${on?'unlocked':''}" data-achievement-id="${escapeHtml(a.id)}" aria-label="${escapeHtml(a.name)} — ${on?'unlocked':'locked'}">${achievementIconMarkup(a)}<span class="achievement-name">${escapeHtml(a.name)}</span><span class="lock-mark">${on?'✓':'🔒'}</span></button>`}).join('')}</div></section>`;
    }).join('');
    const master=masterAchievementDefinition(), masterUnlocked=unlockedSet.has(master.id);
    if(masterUnlocked){
      html+=`<button type="button" class="master-achievement unlocked" data-achievement-id="master-of-all"><div class="master-icon">${achievementIconMarkup(master,'master-svg')}</div><div><span>SECRET ACHIEVEMENT</span><strong>MASTER OF ALL</strong><p>All 67 achievements unlocked. You completed the entire IRONLOG collection.</p></div></button>`;
    }else{
      html+=`<section class="master-achievement locked"><div class="master-lock">🔒</div><div><span>SECRET ACHIEVEMENT</span><strong>????</strong><p>Unlock all 67 achievements to reveal the final secret badge.</p></div></section>`;
    }
    $('badgeGrid').innerHTML=html;
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

  const DEFAULT_MEALS=['Breakfast','Lunch','Dinner','Snack','Drink'];
  function mealNames(){return [...DEFAULT_MEALS,...(state.customMeals||[])].filter((v,i,a)=>a.findIndex(x=>x.toLowerCase()===String(v).toLowerCase())===i)}
  function renderMealOptions(){
    const names=mealNames();
    ['mealType','favMeal'].forEach(id=>{const el=$(id);if(!el)return;const old=el.value;el.innerHTML=names.map(m=>`<option>${escapeHtml(m)}</option>`).join('');el.value=names.includes(old)?old:names[0]});
    const list=$('customMealList');if(list)list.innerHTML=(state.customMeals||[]).length?(state.customMeals||[]).map(m=>`<button type="button" class="custom-meal-chip" data-remove-meal="${escapeHtml(m)}">${escapeHtml(m)} ×</button>`).join(''):'<span class="tiny">No custom meals yet.</span>';
  }
  function renderExerciseFavorites(){
    const wrap=$('exerciseFavorites');if(!wrap)return;const favs=state.exerciseFavorites||[];
    wrap.innerHTML=favs.length?favs.map(f=>`<button type="button" class="exercise-fav-chip" data-ex-fav-id="${escapeHtml(f.id)}"><span>★ ${escapeHtml(f.name)}</span><small>${escapeHtml(f.type)}</small></button>`).join(''):'<span class="tiny">No favorite exercises yet.</span>';
  }
  function renderExerciseFavoritesManage(){
    const el=$('exerciseFavoritesManage');if(!el)return;const favs=state.exerciseFavorites||[];
    el.innerHTML=favs.length?favs.map(f=>`<span class="exercise-fav-manage"><b>${escapeHtml(f.name)}</b><button type="button" data-remove-ex-fav="${escapeHtml(f.id)}" aria-label="Remove ${escapeHtml(f.name)} from favorites">×</button></span>`).join(''):'<span class="tiny">Favorite exercises will appear here.</span>';
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

    renderMealOptions();
    renderExerciseFavorites();
    renderExerciseFavoritesManage();
    const meals=mealNames();
    const mealTotals = meals.reduce((acc,meal)=>{
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

    $('mealSummary').innerHTML = meals.map(meal => `
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
    checkAchievementUnlocks();
    renderWeek();
    renderFavs();
    renderMonthlySummary();
    renderAchievements();
    checkMilestones();
  }

  function clearFoodForm(){
    $('foodName').value='';
    $('foodCalories').value='';
    $('foodProtein').value='';
    $('foodCarbs').value='';
    $('foodFat').value='';
    $('mealType').value=mealNames()[0]||'Breakfast';
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
  $('addCustomMealBtn').addEventListener('click',()=>{
    const name=$('customMealName').value.trim();if(!name)return;
    if(mealNames().some(m=>m.toLowerCase()===name.toLowerCase())){alert('That meal name already exists.');return}
    state.customMeals.push(name);$('customMealName').value='';saveState();renderMealOptions();$('mealType').value=name;
  });
  $('customMealList').addEventListener('click',e=>{const btn=e.target.closest('[data-remove-meal]');if(!btn)return;const name=btn.dataset.removeMeal;state.customMeals=(state.customMeals||[]).filter(m=>m!==name);saveState();renderMealOptions()});


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
  $('favoriteExerciseBtn').addEventListener('click',()=>{
    const name=$('exerciseName').value.trim();if(!name){alert('Enter an exercise name first.');$('exerciseName').focus();return}
    const type=$('exerciseType').value;
    if((state.exerciseFavorites||[]).some(f=>f.name.toLowerCase()===name.toLowerCase())){alert('That exercise is already a favorite.');return}
    state.exerciseFavorites.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),name,type});saveState();renderExerciseFavorites();renderExerciseFavoritesManage();
  });
  $('exerciseFavorites').addEventListener('click',e=>{const btn=e.target.closest('[data-ex-fav-id]');if(!btn)return;const f=(state.exerciseFavorites||[]).find(x=>x.id===btn.dataset.exFavId);if(!f)return;$('exerciseName').value=f.name;$('exerciseType').value=f.type});
  $('exerciseFavoritesManage').addEventListener('click',e=>{const btn=e.target.closest('[data-remove-ex-fav]');if(!btn)return;state.exerciseFavorites=(state.exerciseFavorites||[]).filter(x=>x.id!==btn.dataset.removeExFav);saveState();renderExerciseFavorites();renderExerciseFavoritesManage()});

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


  // ----- V24 achievement gallery interactions -----
  $('badgeGrid').addEventListener('click',e=>{
    const tile=e.target.closest('[data-achievement-id]');
    if(tile)openAchievementDetail(tile.dataset.achievementId);
  });
  $('achievementDetailClose').addEventListener('click',closeAchievementDetail);
  $('achievementDetailBackdrop').addEventListener('click',e=>{if(e.target===$('achievementDetailBackdrop'))closeAchievementDetail()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('achievementDetailBackdrop').classList.contains('open'))closeAchievementDetail()});

  // ----- V28 PR timeline -----
  function closePRTimeline(){
    const b=$('prTimelineBackdrop');if(!b)return;b.classList.remove('open');b.setAttribute('aria-hidden','true');
  }
  function openPRTimeline(exercise){
    const list=allPRs().filter(p=>String(p.exercise||'').trim().toLowerCase()===String(exercise||'').trim().toLowerCase())
      .sort((a,b)=>(num(a.createdAt)||parseLocalDate(a.date).getTime())-(num(b.createdAt)||parseLocalDate(b.date).getTime()));
    if(!list.length)return;
    const best=Math.max(...list.map(p=>num(p.weight)));
    $('prTimelineTitle').textContent=`${exercise} PR Timeline`;
    $('prTimelineSummary').textContent=`${list.length} logged record${list.length===1?'':'s'} • chronological from earliest to latest`;
    $('prTimelineList').innerHTML=list.map((p,i)=>`<div class="pr-timeline-entry ${num(p.weight)===best?'is-best':''}"><div class="date">${escapeHtml(friendlyDate(p.date))}</div><div class="lift">${escapeHtml(p.exercise)}<small>${p.note?escapeHtml(p.note):`Record ${i+1} of ${list.length}`}</small></div><div class="value">${format1(p.weight)} lb × ${Math.max(1,num(p.reps)||1)}</div></div>`).join('');
    const b=$('prTimelineBackdrop');b.classList.add('open');b.setAttribute('aria-hidden','false');
  }
  let lastPRTimelineTouch=0;
  function handlePRTimelineOpen(e){
    const tile=e.target.closest('[data-pr-timeline]');if(!tile)return;
    if(e.type==='touchend'){e.preventDefault();lastPRTimelineTouch=Date.now()}else if(Date.now()-lastPRTimelineTouch<700)return;
    openPRTimeline(tile.dataset.prTimeline);
  }
  $('homePRBoard').addEventListener('click',handlePRTimelineOpen);
  $('homePRBoard').addEventListener('touchend',handlePRTimelineOpen,{passive:false});
  $('prTimelineClose').addEventListener('click',closePRTimeline);
  $('prTimelineBackdrop').addEventListener('click',e=>{if(e.target===$('prTimelineBackdrop'))closePRTimeline()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('prTimelineBackdrop')?.classList.contains('open'))closePRTimeline()});

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
      closePhotoViewer();
      closeReportAchievements();
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

  $('exportBtn').addEventListener('click', exportIronlogData);

  // Restore an exported IRONLOG JSON backup. The imported JSON replaces the
  // current tracking state only after validation + explicit confirmation.
  // V27: mobile-safe file picker handling for Android/Chrome.
  const importBackupInput=$('importBackupInput');
  const importBackupBtn=$('importBackupBtn');
  let lastImportPickerOpen=0;
  function openImportBackupPicker(e){
    if(e && e.type==='touchend') e.preventDefault();
    const now=Date.now();
    if(now-lastImportPickerOpen<700)return; // prevent touchend + click double-open
    lastImportPickerOpen=now;
    importBackupInput.value='';
    try{
      if(typeof importBackupInput.showPicker==='function'){
        importBackupInput.showPicker();
      }else{
        importBackupInput.click();
      }
    }catch(_){
      // Fallback for browsers that reject showPicker on this element.
      importBackupInput.click();
    }
  }
  importBackupBtn.addEventListener('click',openImportBackupPicker);
  importBackupBtn.addEventListener('touchend',openImportBackupPicker,{passive:false});
  importBackupInput.addEventListener('change',async()=>{
    const file=importBackupInput.files && importBackupInput.files[0];
    if(!file)return;
    try{
      const text=await file.text();
      const imported=JSON.parse(text);
      const valid=imported && typeof imported==='object' && !Array.isArray(imported)
        && imported.settings && typeof imported.settings==='object' && !Array.isArray(imported.settings)
        && imported.days && typeof imported.days==='object' && !Array.isArray(imported.days)
        && imported.engagement && typeof imported.engagement==='object' && !Array.isArray(imported.engagement)
        && Array.isArray(imported.favorites);
      if(!valid){
        alert('That file does not look like a valid IRONLOG backup. Nothing was changed.');
        return;
      }
      const ok=confirm('Restore this IRONLOG backup?\n\nYour current tracking data on this device will be replaced by the data in the backup. Progress Photos are stored separately and will not be changed.');
      if(!ok)return;
      localStorage.setItem(STORAGE_KEY,JSON.stringify(imported));
      alert('Backup restored. IRONLOG will reload now.');
      location.reload();
    }catch(_){
      alert('IRONLOG could not read that backup file. Nothing was changed.');
    }finally{
      importBackupInput.value='';
    }
  });
  // ----- V26 progress photos (stored separately in IndexedDB) -----
  const PHOTO_DB='ironlogProgressPhotos_v1';
  function openPhotoDB(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(PHOTO_DB,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('photos'))req.result.createObjectStore('photos',{keyPath:'id'})};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
  }
  async function photoStore(mode='readonly'){
    const db=await openPhotoDB();return db.transaction('photos',mode).objectStore('photos');
  }
  function storeRequest(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
  async function getProgressPhotos(){const store=await photoStore();return (await storeRequest(store.getAll())).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||b.createdAt-a.createdAt)}
  async function putProgressPhoto(photo){const store=await photoStore('readwrite');return storeRequest(store.put(photo))}
  async function deleteProgressPhoto(id){const store=await photoStore('readwrite');return storeRequest(store.delete(id))}
  function escapeHtml(text){return String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function closestWeightToDate(date){
    const weights=allWeights();if(!weights.length)return null;
    const target=parseLocalDate(date).getTime();
    return weights.reduce((best,w)=>{
      const wt=num(w.createdAt)||parseLocalDate(w.date).getTime(), diff=Math.abs(wt-target);
      if(!best||diff<best.diff)return {item:w,diff};
      return best;
    },null)?.item||null;
  }
  let photoViewerItems=[],photoViewerIndex=0;
  async function renderProgressPhotos(){
    const gallery=$('progressPhotoGallery');if(!gallery)return;
    try{
      const photos=await getProgressPhotos();photoViewerItems=photos.slice().reverse();
      if(!photos.length){gallery.innerHTML='<div class="tiny" style="grid-column:1/-1">No progress photos yet.</div>';return}
      gallery.innerHTML=photos.map(p=>{
        const weight=closestWeightToDate(p.date);
        const weightLine=weight?`<div class="photo-weight">${format1(weight.value)} lb <span class="tiny">closest logged weight • ${escapeHtml(friendlyDate(weight.date))}</span></div>`:`<div class="photo-weight none">No logged weight near this photo yet</div>`;
        return `<article class="progress-photo"><button type="button" class="photo-open" data-open-photo="${p.id}" aria-label="Open progress photo from ${escapeHtml(p.date)}"><img src="${p.dataUrl}" alt="Progress photo from ${escapeHtml(p.date)}"></button><div class="progress-photo-info"><strong class="photo-date-line">${escapeHtml(friendlyDate(p.date))}</strong>${weightLine}${p.note?`<p>${escapeHtml(p.note)}</p>`:''}<button type="button" data-delete-photo="${p.id}">Delete</button></div></article>`;
      }).join('');
    }catch(_){gallery.innerHTML='<div class="tiny" style="grid-column:1/-1">Progress photos are not available in this browser.</div>'}
  }
  function resizePhoto(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onerror=()=>reject(reader.error);reader.onload=()=>{
        const img=new Image();img.onerror=()=>reject(new Error('Could not read image'));img.onload=()=>{
          const max=1400,scale=Math.min(1,max/Math.max(img.width,img.height));
          const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
          canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.82));
        };img.src=reader.result;
      };reader.readAsDataURL(file);
    });
  }
  let pendingPhotoData='';
  $('progressPhotoDate').value=todayLocal();
  $('progressPhotoFile').addEventListener('change',async e=>{
    const file=e.target.files?.[0];pendingPhotoData='';$('progressPhotoPreview').style.display='none';if(!file)return;
    try{pendingPhotoData=await resizePhoto(file);$('progressPhotoPreview').src=pendingPhotoData;$('progressPhotoPreview').style.display='block';$('progressPhotoMessage').textContent='Photo ready to save.'}catch(_){$('progressPhotoMessage').textContent='That photo could not be loaded.'}
  });
  $('saveProgressPhotoBtn').addEventListener('click',async()=>{
    const date=$('progressPhotoDate').value||todayLocal();if(!pendingPhotoData){$('progressPhotoMessage').textContent='Choose a photo first.';return}
    try{await putProgressPhoto({id:`photo_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,date,note:$('progressPhotoNote').value.trim(),dataUrl:pendingPhotoData,createdAt:Date.now()});pendingPhotoData='';$('progressPhotoFile').value='';$('progressPhotoNote').value='';$('progressPhotoPreview').style.display='none';$('progressPhotoMessage').textContent='Progress photo saved.';await renderProgressPhotos()}catch(_){$('progressPhotoMessage').textContent='Could not save this photo. Your device storage may be full.'}
  });
  function renderPhotoViewer(){
    const p=photoViewerItems[photoViewerIndex];if(!p)return;
    $('photoViewerImage').src=p.dataUrl;$('photoViewerDate').textContent=friendlyDate(p.date);
    const weight=closestWeightToDate(p.date);$('photoViewerWeight').textContent=weight?`${format1(weight.value)} lb • closest logged weight ${friendlyDate(weight.date)}`:'No logged weight near this photo yet';
    $('photoViewerNote').textContent=p.note||'';$('photoViewerCounter').textContent=`${photoViewerIndex+1} / ${photoViewerItems.length}`;
    $('photoViewerPrev').disabled=photoViewerIndex<=0;$('photoViewerNext').disabled=photoViewerIndex>=photoViewerItems.length-1;
  }
  function openPhotoViewer(id){const idx=photoViewerItems.findIndex(p=>p.id===id);if(idx<0)return;photoViewerIndex=idx;renderPhotoViewer();$('photoViewerBackdrop').classList.add('open');$('photoViewerBackdrop').setAttribute('aria-hidden','false')}
  function closePhotoViewer(){$('photoViewerBackdrop').classList.remove('open');$('photoViewerBackdrop').setAttribute('aria-hidden','true')}
  function movePhotoViewer(delta){const next=photoViewerIndex+delta;if(next<0||next>=photoViewerItems.length)return;photoViewerIndex=next;renderPhotoViewer()}
  $('progressPhotoGallery').addEventListener('click',async e=>{const del=e.target.closest('[data-delete-photo]');if(del){if(confirm('Delete this progress photo?')){await deleteProgressPhoto(del.dataset.deletePhoto);renderProgressPhotos()}return}const open=e.target.closest('[data-open-photo]');if(open)openPhotoViewer(open.dataset.openPhoto)});
  $('photoViewerClose').addEventListener('click',closePhotoViewer);$('photoViewerPrev').addEventListener('click',()=>movePhotoViewer(-1));$('photoViewerNext').addEventListener('click',()=>movePhotoViewer(1));$('photoViewerBackdrop').addEventListener('click',e=>{if(e.target===$('photoViewerBackdrop'))closePhotoViewer()});
  let photoTouchX=0;$('photoViewer').addEventListener('touchstart',e=>{photoTouchX=e.changedTouches[0].clientX},{passive:true});$('photoViewer').addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-photoTouchX;if(Math.abs(dx)>55)movePhotoViewer(dx<0?1:-1)},{passive:true});
  renderProgressPhotos();

  // ----- V32 daily backup reminder -----
  const BACKUP_REMINDER_DELAY=5*60*1000;
  let backupReminderTimer=null;
  function showDailyBackupReminder(){
    const today=todayLocal();if(state.settings.dailyBackupReminderShownDate===today)return;
    state.settings.dailyBackupReminderShownDate=today;saveState();
    queueTopNotice('💾 BACK UP YOUR IRONLOG DATA','Export a backup so your tracking data stays safe.',2000);
  }
  function scheduleDailyBackupReminder(){
    const today=todayLocal();
    if(state.settings.dailyBackupReminderDate!==today){state.settings.dailyBackupReminderDate=today;state.settings.dailyBackupReminderStartedAt=new Date().toISOString();saveState()}
    if(state.settings.dailyBackupReminderShownDate===today)return;
    const started=Date.parse(state.settings.dailyBackupReminderStartedAt)||Date.now();
    const wait=Math.max(0,BACKUP_REMINDER_DELAY-(Date.now()-started));
    clearTimeout(backupReminderTimer);backupReminderTimer=setTimeout(showDailyBackupReminder,wait);
  }
  function exportIronlogData(){
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ironlog-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    state.settings.lastBackupAt=new Date().toISOString();saveState();
  }
  scheduleDailyBackupReminder();


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


  // ----- V32 report achievement details -----
  $('weekAchievementsCard').addEventListener('click',()=>openReportAchievements('Achievements earned this week',$('weekAchievementsCard').dataset.rangeStart,$('weekAchievementsCard').dataset.rangeEnd));
  $('monthAchievementsCard').addEventListener('click',()=>openReportAchievements('Achievements earned this month',$('monthAchievementsCard').dataset.rangeStart,$('monthAchievementsCard').dataset.rangeEnd));
  $('reportAchievementClose').addEventListener('click',closeReportAchievements);$('reportAchievementBackdrop').addEventListener('click',e=>{if(e.target===$('reportAchievementBackdrop'))closeReportAchievements()});
  $('reportAchievementList').addEventListener('click',e=>{const b=e.target.closest('[data-report-achievement-id]');if(b){closeReportAchievements();openAchievementDetail(b.dataset.reportAchievementId)}});

  // ----- V32 swipe day navigation -----
  let daySwipeStartX=0,daySwipeStartY=0;
  const appShell=$('appShell');
  appShell.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;daySwipeStartX=e.touches[0].clientX;daySwipeStartY=e.touches[0].clientY},{passive:true});
  appShell.addEventListener('touchend',e=>{
    if(!daySwipeStartX)return;const t=e.changedTouches[0],dx=t.clientX-daySwipeStartX,dy=t.clientY-daySwipeStartY;daySwipeStartX=0;
    if(Math.abs(dx)<70||Math.abs(dx)<Math.abs(dy)*1.35)return;
    if(e.target.closest('input,select,textarea,button,.achievement-strip,.photo-gallery,.menu-drawer,.history-drawer,.streak-modal,.photo-viewer,.pr-timeline-modal'))return;
    const next=addDays(selectedDate(),dx<0?1:-1);$('selectedDate').value=next;appShell.classList.remove('day-swipe-left','day-swipe-right');void appShell.offsetWidth;appShell.classList.add(dx<0?'day-swipe-left':'day-swipe-right');render();setTimeout(()=>appShell.classList.remove('day-swipe-left','day-swipe-right'),260);
  },{passive:true});

  if($('appVersion'))$('appVersion').textContent=`IRONLOG ${APP_VERSION}`;

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
    if(!document.hidden){updateLiveClock();scheduleDailyBackupReminder()}
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
