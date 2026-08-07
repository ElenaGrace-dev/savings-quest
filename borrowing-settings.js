// Savings Quest dynamic self-imposed envelope borrowing penalty.
(() => {
  const DAY = 86400000;
  const INTERNAL_BORROW_TRIGGER = 4;
  const clamp = (n,min,max)=>Math.min(max,Math.max(min,n));
  const dateMs = s => s ? new Date(`${s}T12:00:00`).getTime() : NaN;

  if (!Number.isFinite(Number(state.borrowBasePercent))) {
    state.borrowBasePercent = Number.isFinite(Number(state.borrowInterestPercent)) ? Number(state.borrowInterestPercent) : 10;
  }
  state.borrowBasePercent = clamp(Math.round(Number(state.borrowBasePercent)*100)/100,0,100);
  if (!Number.isFinite(Number(state.borrowCurrentPercent))) state.borrowCurrentPercent = state.borrowBasePercent;
  state.borrowCurrentPercent = clamp(Math.max(state.borrowBasePercent,Number(state.borrowCurrentPercent)),0,100);
  if (!Number.isFinite(Number(state.borrowDecreaseDays))) state.borrowDecreaseDays = 30;
  if (!Number.isFinite(Number(state.borrowCountSinceIncrease))) state.borrowCountSinceIncrease = 0;
  if (!state.lastBorrowDate) state.lastBorrowDate = null;
  if (!state.lastPenaltyReviewDate) state.lastPenaltyReviewDate = state.lastBorrowDate || today();

  function applyInactivityDecrease(){
    if (!state.lastBorrowDate || state.borrowCurrentPercent <= state.borrowBasePercent) return 0;
    const days = Math.max(1,Math.floor(Number(state.borrowDecreaseDays)||30));
    const anchor = dateMs(state.lastPenaltyReviewDate || state.lastBorrowDate);
    if (!Number.isFinite(anchor)) return 0;
    const elapsed = Math.floor((Date.now()-anchor)/DAY);
    const steps = Math.floor(elapsed/days);
    if (steps <= 0) return 0;
    const old = state.borrowCurrentPercent;
    state.borrowCurrentPercent = Math.max(state.borrowBasePercent,state.borrowCurrentPercent-steps);
    state.lastPenaltyReviewDate = new Date(anchor + steps*days*DAY).toISOString().slice(0,10);
    if (state.borrowCurrentPercent === state.borrowBasePercent) state.borrowCountSinceIncrease = 0;
    return old-state.borrowCurrentPercent;
  }

  applyInactivityDecrease();

  const settingsCard = document.getElementById('saveSettings')?.closest('.card');
  const saveBtn = document.getElementById('saveSettings');
  let panel = document.getElementById('borrowingPenaltySettings');
  if (settingsCard && saveBtn && !panel) {
    panel = document.createElement('div');
    panel.id = 'borrowingPenaltySettings';
    panel.className = 'insight';
    panel.style.marginTop = '14px';
    panel.innerHTML = `
      <b>Borrowing penalty</b>
      <div class="mini muted" style="margin:6px 0 10px">Savings Quest quietly raises the penalty when borrowing becomes too frequent and lowers it gradually when you stop borrowing.</div>
      <label style="display:block">Baseline penalty (%)<input id="borrowBasePercent" type="number" min="0" max="100" step="1"></label>
      <label style="display:block;margin-top:9px">Lower by 1% after this many days without borrowing<input id="borrowDecreaseDays" type="number" min="1" max="365" step="1"></label>
      <div class="mini" style="margin-top:10px"><b>Current penalty:</b> <span id="borrowCurrentRate"></span></div>
      <div class="mini muted" id="borrowPenaltyStatus" style="margin-top:4px"></div>`;
    settingsCard.insertBefore(panel,saveBtn);
  }

  const baseInput=document.getElementById('borrowBasePercent');
  const decreaseInput=document.getElementById('borrowDecreaseDays');
  const currentRateEl=document.getElementById('borrowCurrentRate');
  const statusEl=document.getElementById('borrowPenaltyStatus');

  function currentRate(){
    applyInactivityDecrease();
    return Math.max(state.borrowBasePercent,state.borrowCurrentPercent);
  }

  function refreshSettingsUI(){
    if(baseInput) baseInput.value=state.borrowBasePercent;
    if(decreaseInput) decreaseInput.value=state.borrowDecreaseDays;
    if(currentRateEl) currentRateEl.textContent=`${currentRate()}%`;
    if(statusEl){
      const last=state.lastBorrowDate ? `Last borrow: ${state.lastBorrowDate}.` : 'No borrowing recorded yet.';
      statusEl.textContent=`${last} Repeated borrowing can raise the rate automatically. The rate never falls below ${state.borrowBasePercent}%.`;
    }
  }

  const originalSaveSettings=saveBtn?.onclick;
  if(saveBtn){
    saveBtn.onclick=()=>{
      const base=Number(baseInput?.value), days=Number(decreaseInput?.value);
      if(!Number.isFinite(base)||base<0||base>100) return toast('Baseline borrowing penalty must be between 0% and 100%.');
      if(!Number.isInteger(days)||days<1||days>365) return toast('No-borrow cooldown must be between 1 and 365 days.');
      const oldBase=state.borrowBasePercent;
      state.borrowBasePercent=base;
      state.borrowDecreaseDays=days;
      if(state.borrowCurrentPercent<base || state.borrowCurrentPercent===oldBase) state.borrowCurrentPercent=base;
      if(typeof originalSaveSettings==='function') originalSaveSettings(); else {save();render();toast('Settings saved.');}
      refreshSettingsUI();
      refreshBorrowCopy();
    };
  }

  function refreshBorrowCopy(){
    const pct=currentRate();
    const modal=document.getElementById('borrowModal');
    const copy=modal?.querySelector('p');
    const button=document.getElementById('confirmBorrow');
    if(copy) copy.textContent=`Savings Quest adds your current ${pct}% self-imposed penalty and reserves the repayment from next week's Flexible money.`;
    if(button) button.textContent=`Borrow with ${pct}% penalty`;
    refreshSettingsUI();
  }

  confirmBorrow.onclick=()=>{
    const e=getEnvelope(borrowEnvId.value);
    const a=Number(borrowAmount.value)||0;
    if(!e||a<=0||a>e.balance) return toast('Enter an amount available in this envelope.');
    applyInactivityDecrease();
    const pct=currentRate();
    const owed=Math.round(a*(1+pct/100)*100)/100;
    e.balance=Math.round((e.balance-a)*100)/100;
    e.history.push({date:today(),week:state.week,type:'borrow',amount:a,interestPercent:pct});
    state.repayments.push({id:uid(),envelopeId:e.id,envelopeName:e.name,borrowed:a,owed,interestPercent:pct,paid:false,date:today()});
    state.lastBorrowDate=today();
    state.lastPenaltyReviewDate=today();
    state.borrowCountSinceIncrease++;
    let raised=false;
    if(state.borrowCountSinceIncrease>=INTERNAL_BORROW_TRIGGER && state.borrowCurrentPercent<100){
      state.borrowCurrentPercent=Math.min(100,state.borrowCurrentPercent+1);
      state.borrowCountSinceIncrease=0;
      raised=true;
    }
    closeModal('borrowModal');
    render(); save(); refreshSettingsUI(); refreshBorrowCopy();
    toast(raised?`Repayment ${money(owed)}. Your borrowing penalty has increased for future borrowing.`:`Repayment scheduled: ${money(owed)} (${pct}% penalty)`);
  };

  renderRepayments=function(){
    const open=state.repayments.filter(r=>!r.paid);
    repaymentList.innerHTML=open.length?open.map(r=>{
      const pct=Number.isFinite(Number(r.interestPercent))?Number(r.interestPercent):1;
      return `<div class="item"><b>${r.envelopeName}</b><div class="mini muted">Borrowed ${money(r.borrowed)} + ${pct}% penalty = ${money(r.owed)}</div><button class="btn secondary" style="margin-top:8px" onclick="repay('${r.id}')">Mark repaid</button></div>`;
    }).join(''):'<div class="muted mini">No repayments due.</div>';
  };

  repay=function(id){
    const r=state.repayments.find(x=>x.id===id); if(!r)return;
    const e=getEnvelope(r.envelopeId); if(!e)return toast('That envelope could not be found.');
    const pct=Number.isFinite(Number(r.interestPercent))?Number(r.interestPercent):1;
    e.balance=Math.round((e.balance+r.owed)*100)/100;
    e.history.push({date:today(),week:state.week+1,type:`repayment + ${pct}% penalty`,amount:r.owed,interestPercent:pct});
    r.paid=true; render(); save(); toast(`${e.name} repaid with ${pct}% penalty.`);
  };
  window.repay=repay;

  const originalOpenBorrow=openBorrow;
  openBorrow=function(id){originalOpenBorrow(id);refreshBorrowCopy();};
  window.openBorrow=openBorrow;

  refreshSettingsUI(); refreshBorrowCopy(); save(); render();
})();
