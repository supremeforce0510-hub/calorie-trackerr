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
      settings:{calorieGoal:1800, proteinGoal:100},
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
          proteinGoal:Number(parsed?.settings?.proteinGoal) || 100
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

  function latestSavedWeight(){
    const all = [];
    Object.values(state.days).forEach(day => {
      (day.weights || []).forEach(w => all.push(w));
    });
    all.sort((a,b) => num(b.createdAt) - num(a.createdAt));
    return all[0] ? num(all[0].value) : 0;
  }

  function teenProteinRDA(age, sex){
    if(age >= 14 && age <= 18) return sex === 'male' ? 52 : 46;
    if(age >= 9 && age <= 13) return 34;
    if(age >= 4 && age <= 8) return 19;
    if(age >= 1 && age <= 3) return 13;
    return null;
  }

  // 2023 National Academies total-energy-expenditure equations.
  // Height in cm, weight in kg.
  function estimatedCalories(age, sex, heightCm, weightKg, activity){
    const a = activity || 'sedentary';

    if(age >= 3 && age <= 18){
      if(sex === 'male'){
        const formulas = {
          sedentary: [-447.51, 3.68, 13.01, 13.15],
          light: [19.12, 3.68, 8.62, 20.28],
          moderate: [-388.19, 3.68, 12.66, 20.46],
          active: [-671.75, 3.68, 15.38, 23.25]
        };
        const [c,ageC,hC,wC] = formulas[a] || formulas.sedentary;
        return c + ageC*age + hC*heightCm + wC*weightKg;
      }else{
        const formulas = {
          sedentary: [55.59, -22.25, 8.43, 17.07],
          light: [-297.54, -22.25, 12.77, 14.73],
          moderate: [-189.55, -22.25, 11.74, 18.34],
          active: [-709.59, -22.25, 18.22, 14.25]
        };
        const [c,ageC,hC,wC] = formulas[a] || formulas.sedentary;
        return c + ageC*age + hC*heightCm + wC*weightKg;
      }
    }

    if(age >= 19){
      if(sex === 'male'){
        const formulas = {
          sedentary: [753.07, -10.83, 6.50, 14.10],
          light: [581.47, -10.83, 8.30, 14.94],
          moderate: [1004.82, -10.83, 6.52, 15.91],
          active: [-517.88, -10.83, 15.61, 19.11]
        };
        const [c,ageC,hC,wC] = formulas[a] || formulas.sedentary;
        return c + ageC*age + hC*heightCm + wC*weightKg;
      }else{
        const formulas = {
          sedentary: [584.90, -7.01, 5.72, 11.71],
          light: [575.77, -7.01, 6.60, 12.14],
          moderate: [710.25, -7.01, 6.54, 12.34],
          active: [511.83, -7.01, 9.07, 12.56]
        };
        const [c,ageC,hC,wC] = formulas[a] || formulas.sedentary;
        return c + ageC*age + hC*heightCm + wC*weightKg;
      }
    }
    return null;
  }

  function renderGuidance(){
    const age = num(state.profile.age);
    const sex = state.profile.sex;
    const heightIn = num(state.profile.height);
    const weightLb = num(state.profile.weight) || latestSavedWeight();
    const activity = state.profile.activity || 'sedentary';

    $('profileAge').value = state.profile.age;
    $('profileSex').value = sex;
    $('profileHeight').value = state.profile.height;
    $('profileWeight').value = state.profile.weight || (weightLb ? format1(weightLb) : '');
    $('profileActivity').value = activity;

    const missing = [];
    if(!age) missing.push('age');
    if(!sex) missing.push('sex');
    if(!heightIn) missing.push('height');
    if(!weightLb) missing.push('weight');

    if(missing.length){
      $('suggestedWeight').textContent = 'Add ' + missing.join(', ');
      $('suggestedCalories').textContent = 'Complete profile';
      $('suggestedProtein').textContent = 'Complete profile';
      $('guidanceNote').textContent =
        'Fill in age, sex, height, weight and activity. The numbers update automatically as soon as the profile is complete.';
      return;
    }

    const heightCm = heightIn * 2.54;
    const weightKg = weightLb * 0.45359237;
    const bmi = weightLb / (heightIn * heightIn) * 703;
    const calories = estimatedCalories(age, sex, heightCm, weightKg, activity);

    if(age < 20){
      const protein = teenProteinRDA(age, sex);
      $('suggestedWeight').textContent = 'BMI ' + format1(bmi) + ' • growth chart';
      $('suggestedCalories').textContent = calories ? Math.max(0, Math.round(calories)).toLocaleString() + ' cal/day' : 'Growth-based';
      $('suggestedProtein').textContent = protein ? protein + ' g/day RDA' : 'Age-specific';

      $('guidanceNote').textContent =
        'For ages 2–19, there is not one safe target weight based on pounds alone. CDC interprets BMI using age- and sex-specific growth-chart percentiles; healthy weight is the 5th to under the 85th percentile. The calorie number shown is an estimated energy need from age, sex, height, weight and activity—not a weight-loss prescription.';
      return;
    }

    const lowLb = 18.5 * heightIn * heightIn / 703;
    const highLb = 24.9 * heightIn * heightIn / 703;
    const protein = Math.round(0.8 * weightKg);

    $('suggestedWeight').textContent = Math.round(lowLb) + '–' + Math.round(highLb) + ' lb';
    $('suggestedCalories').textContent = calories ? Math.max(0, Math.round(calories)).toLocaleString() + ' cal/day' : '—';
    $('suggestedProtein').textContent = protein + ' g/day baseline';
    $('guidanceNote').textContent =
      'Adult weight guidance uses the standard BMI 18.5–24.9 screening range. Calories are estimated maintenance needs from age, sex, height, weight and activity. Protein is the general adult RDA baseline of about 0.8 g/kg. Individual needs can differ.';
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
    $('weightLog').innerHTML = weights.length ? weights.map(w => `
      <div class="log-item">
        <div>
          <div class="log-title">${format1(w.value)} lb</div>
          <div class="log-meta">${new Date(w.createdAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</div>
        </div>
        <button class="danger" style="width:auto;padding:8px 10px" data-weight-delete="${w.id}">Delete</button>
      </div>
    `).join('') : '<div class="empty">No weight logged for this day.</div>';

    renderGuidance();
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

    getDay(selectedDate()).weights.push({
      id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
      value:v,
      createdAt:Date.now()
    });
    state.profile.weight = String(v);
    $('weightValue').value='';
    render();
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

  ['profileAge','profileSex','profileHeight','profileWeight','profileActivity'].forEach(id => {
    $(id).addEventListener('input', () => {
      state.profile.age = $('profileAge').value;
      state.profile.sex = $('profileSex').value;
      state.profile.height = $('profileHeight').value;
      state.profile.weight = $('profileWeight').value;
      state.profile.activity = $('profileActivity').value;
      saveState();
      renderGuidance();
    });
    $(id).addEventListener('change', () => {
      state.profile.age = $('profileAge').value;
      state.profile.sex = $('profileSex').value;
      state.profile.height = $('profileHeight').value;
      state.profile.weight = $('profileWeight').value;
      state.profile.activity = $('profileActivity').value;
      saveState();
      renderGuidance();
    });
  });

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
