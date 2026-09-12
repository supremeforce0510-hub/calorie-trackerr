
(function(){
  const STORAGE_KEY = 'calorieTrackMVP_v1';

  const $ = id => document.getElementById(id);

  const state = loadState();

  function todayLocal(){
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off*60*1000).toISOString().slice(0,10);
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return {settings:{calorieGoal:1800, proteinGoal:100}, days:{}};
      const parsed = JSON.parse(raw);
      return {
        settings:{
          calorieGoal:Number(parsed?.settings?.calorieGoal) || 1800,
          proteinGoal:Number(parsed?.settings?.proteinGoal) || 100
        },
        days: parsed?.days && typeof parsed.days === 'object' ? parsed.days : {}
      };
    }catch(e){
      return {settings:{calorieGoal:1800, proteinGoal:100}, days:{}};
    }
  }

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getDay(date){
    if(!state.days[date]){
      state.days[date] = {foods:[], weights:[]};
    }
    if(!Array.isArray(state.days[date].foods)) state.days[date].foods = [];
    if(!Array.isArray(state.days[date].weights)) state.days[date].weights = [];
    return state.days[date];
  }

  function num(value){
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function format1(n){
    return Math.round((num(n)+Number.EPSILON)*10)/10;
  }

  function selectedDate(){
    return $('selectedDate').value || todayLocal();
  }

  function escapeHtml(text){
    return String(text).replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    })[m]);
  }

  function render(){
    const day = getDay(selectedDate());
    const foods = day.foods;

    const totals = foods.reduce((acc,f)=>{
      acc.calories += num(f.calories);
      acc.protein += num(f.protein);
      acc.carbs += num(f.carbs);
      acc.fat += num(f.fat);
      return acc;
    },{calories:0,protein:0,carbs:0,fat:0});

    const calorieGoal = Math.max(1, num(state.settings.calorieGoal) || 1800);
    const proteinGoal = Math.max(0, num(state.settings.proteinGoal) || 100);
    const remaining = calorieGoal - totals.calories;
    const pct = Math.max(0, totals.calories / calorieGoal * 100);

    $('calorieGoal').value = calorieGoal;
    $('proteinGoal').value = proteinGoal;
    $('sumCalories').textContent = Math.round(totals.calories);
    $('remainingCalories').textContent = Math.round(remaining);
    $('sumProtein').textContent = format1(totals.protein) + 'g';
    $('sumMeals').textContent = foods.length;
    $('calorieProgress').style.width = Math.min(100,pct) + '%';
    $('progressText').textContent =
      Math.round(pct) + '% of calorie goal • ' +
      format1(totals.carbs) + 'g carbs • ' +
      format1(totals.fat) + 'g fat • ' +
      format1(totals.protein) + '/' + format1(proteinGoal) + 'g protein';

    if(!foods.length){
      $('foodLog').innerHTML = '<div class="empty">No food logged for this day.</div>';
    }else{
      $('foodLog').innerHTML = foods.map(f => `
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
      `).join('');
    }

    const weights = day.weights.slice().sort((a,b)=>b.createdAt-a.createdAt);
    if(!weights.length){
      $('weightLog').innerHTML = '<div class="empty">No weight logged for this day.</div>';
    }else{
      $('weightLog').innerHTML = weights.map(w => `
        <div class="log-item">
          <div>
            <div class="log-title">${format1(w.value)} lb</div>
            <div class="log-meta">${new Date(w.createdAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</div>
          </div>
          <button class="danger" style="width:auto;padding:8px 10px" data-weight-delete="${w.id}">Delete</button>
        </div>
      `).join('');
    }

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

  $('addFoodBtn').addEventListener('click', ()=>{
    const name = $('foodName').value.trim();
    const caloriesRaw = $('foodCalories').value.trim();

    if(!name){
      alert('Enter a food name.');
      $('foodName').focus();
      return;
    }
    if(caloriesRaw === '' || num(caloriesRaw) < 0){
      alert('Enter valid calories.');
      $('foodCalories').focus();
      return;
    }

    const day = getDay(selectedDate());
    day.foods.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
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

  $('addWeightBtn').addEventListener('click', ()=>{
    const v = num($('weightValue').value);
    if(v <= 0){
      alert('Enter a valid weight.');
      $('weightValue').focus();
      return;
    }
    const day = getDay(selectedDate());
    day.weights.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
      value:v,
      createdAt:Date.now()
    });
    $('weightValue').value='';
    render();
  });

  $('selectedDate').addEventListener('change', render);

  $('calorieGoal').addEventListener('change', ()=>{
    const v = num($('calorieGoal').value);
    if(v > 0){
      state.settings.calorieGoal = v;
      render();
    }
  });

  $('proteinGoal').addEventListener('change', ()=>{
    const v = num($('proteinGoal').value);
    if(v >= 0){
      state.settings.proteinGoal = v;
      render();
    }
  });

  document.addEventListener('click', e=>{
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

  $('resetDayBtn').addEventListener('click', ()=>{
    if(confirm('Clear all food and weight entries for the selected day?')){
      state.days[selectedDate()] = {foods:[],weights:[]};
      render();
    }
  });

  $('exportBtn').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url;
    a.download='calorie-track-data.json';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });



  // PWA install support
  let deferredInstallPrompt = null;
  const installBtn = $('installBtn');
  const installText = $('installText');

  function isStandalone(){
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  if(isStandalone()){
    if(installText) installText.textContent = 'CalorieTrack is installed on this device.';
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if(installBtn) installBtn.style.display = 'inline-block';
    if(installText) installText.textContent = 'CalorieTrack is ready to install on this device.';
  });

  if(installBtn){
    installBtn.addEventListener('click', async () => {
      if(!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installBtn.style.display = 'none';
    });
  }

  window.addEventListener('appinstalled', () => {
    if(installBtn) installBtn.style.display = 'none';
    if(installText) installText.textContent = 'CalorieTrack is installed on this device.';
  });

  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }

  $('selectedDate').value = todayLocal();
  render();
})();
