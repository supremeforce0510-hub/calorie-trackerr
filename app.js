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
      settings:{calorieGoal:1800, proteinGoal:100, endGoalWeight:''},
      profile:{age:'', sex:'', height:'', weight:'', activity:'sedentary'},
      days:{}
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
          endGoalWeight:parsed?.settings?.endGoalWeight ?? ''
        },
        profile:{
          age:parsed?.profile?.age ?? '',
          sex:parsed?.profile?.sex ?? '',
          height:parsed?.profile?.height ?? '',
          weight:parsed?.profile?.weight ?? '',
          activity:parsed?.profile?.activity || 'sedentary'
        },
        days:parsed?.days && typeof parsed.days === 'object' ? parsed.days : {}
      };
    }catch(_){
      return fallback;
    }
  }

  const state = loadState();

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
        note:'Enter a current weight, end goal weight, and daily calorie goal to see a general estimate.'
      };
    }

    const difference = Math.abs(currentWeight - targetWeight);
    if(difference === 0){
      return {
        difference:0,
        weeks:0,
        timeLabel:'Reached',
        note:'Your current weight matches your end goal.'
      };
    }

    // General planning estimate only.
    // Approximate maintenance = current body weight × 12 calories/day.
    // Approximate 3,500-calorie energy gap = 1 lb of body-weight change.
    const estimatedMaintenance = currentWeight * 12;
    const losing = targetWeight < currentWeight;
    const dailyGap = losing
      ? estimatedMaintenance - calorieGoal
      : calorieGoal - estimatedMaintenance;

    if(dailyGap <= 0){
      return {
        difference,
        weeks:null,
        timeLabel:'No estimate',
        note:'At this calorie goal, this simple estimate does not predict movement toward the saved goal.'
      };
    }

    const weeklyChange = dailyGap * 7 / 3500;
    if(weeklyChange <= 0){
      return {
        difference,
        weeks:null,
        timeLabel:'No estimate',
        note:'There is not enough information for a useful estimate.'
      };
    }

    const weeks = difference / weeklyChange;
    return {
      difference,
      weeks,
      timeLabel:formatDurationWeeks(weeks),
      note:'General estimate using the daily calorie goal above. Real weight change can be faster or slower.'
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
    $('goalTime').textContent = estimate.timeLabel;
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
    if(!state.days[date]) state.days[date] = {foods:[],weights:[]};
    if(!Array.isArray(state.days[date].foods)) state.days[date].foods = [];
    if(!Array.isArray(state.days[date].weights)) state.days[date].weights = [];
    return state.days[date];
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
      if(!w.estimatedTimeLabel && savedGoal > 0){
        const oldEstimate = calculateGoalEstimate(
          num(w.value),
          savedGoal,
          num(w.calorieGoalAtSave) || num(state.settings.calorieGoal)
        );
        savedTime = oldEstimate.timeLabel;
      }

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
              <strong>${escapeHtml(savedTime)}</strong>
              <span>Estimated time</span>
            </div>
          </div>
        </div>
      `;
    }).join('') : '<div class="empty">No weight logged for this day.</div>';

    saveState();
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
    const v = num($('weightValue').value);
    if(v <= 0){ alert('Enter a valid weight.'); $('weightValue').focus(); return; }

    const goal = liveGoalWeight();
    const calorieGoalAtSave = num($('calorieGoal').value) || num(state.settings.calorieGoal) || 1800;
    const estimate = calculateGoalEstimate(v, goal, calorieGoalAtSave);

    getDay(selectedDate()).weights.push({
      id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
      value:v,
      goalWeight:goal > 0 ? goal : '',
      weightToGoal:estimate.difference,
      estimatedWeeks:Number.isFinite(estimate.weeks) ? estimate.weeks : null,
      estimatedTimeLabel:estimate.timeLabel,
      calorieGoalAtSave,
      createdAt:Date.now()
    });

    $('weightValue').value='';
    const btn = $('addWeightBtn');
    btn.textContent = 'Saved ✓';
    render();
    setTimeout(() => {
      const b = $('addWeightBtn');
      if(b) b.textContent = 'Save Weight';
    }, 1200);
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
      if(btn) btn.textContent = 'Save Goal';
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
      day.foods = day.foods.filter(f => f.id !== foodId);
      render();
    }
    if(weightId){
      const day = getDay(selectedDate());
      day.weights = day.weights.filter(w => w.id !== weightId);
      render();
    }
  });

  $('resetDayBtn').addEventListener('click', () => {
    if(confirm('Clear all food and weight entries for the selected day?')){
      state.days[selectedDate()] = {foods:[],weights:[]};
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

  $('selectedDate').value = todayLocal();
  render();
})();
