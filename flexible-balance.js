// Savings Quest true Flexible balance tracker.
(() => {
  const roundMoney = n => Math.round((Number(n) || 0) * 100) / 100;

  // First migration: start from the user's current real Flexible balance.
  if (!Number.isFinite(Number(state.flexBalance))) state.flexBalance = 29.13;
  state.flexBalance = Math.max(0, roundMoney(state.flexBalance));

  const settingsCard = document.getElementById('saveSettings')?.closest('.card');
  const saveBtn = document.getElementById('saveSettings');
  let flexPanel = document.getElementById('trueFlexibleSettings');

  if (settingsCard && saveBtn && !flexPanel) {
    flexPanel = document.createElement('div');
    flexPanel.id = 'trueFlexibleSettings';
    flexPanel.className = 'insight';
    flexPanel.style.marginTop = '14px';
    flexPanel.innerHTML = `
      <b>True Flexible balance</b>
      <div class="mini muted" style="margin:6px 0 10px">This is the money you actually have available in Flexible right now. Building a weekly plan will not overwrite it.</div>
      <label style="display:block">Current Flexible balance<input id="flexBalanceInput" type="number" min="0" step=".01"></label>
      <div class="row" style="margin-top:9px;justify-content:flex-start;flex-wrap:wrap">
        <button id="flexAddBtn" class="btn secondary" type="button">+ Add money</button>
        <button id="flexSpendBtn" class="btn soft" type="button">− Record spending</button>
      </div>`;
    settingsCard.insertBefore(flexPanel, saveBtn);
  }

  const flexBalanceInput = document.getElementById('flexBalanceInput');
  const flexAddBtn = document.getElementById('flexAddBtn');
  const flexSpendBtn = document.getElementById('flexSpendBtn');

  function syncFlexInput(){
    if (flexBalanceInput && document.activeElement !== flexBalanceInput) {
      flexBalanceInput.value = state.flexBalance.toFixed(2);
    }
  }

  function adjustFlexible(delta, label){
    const next = roundMoney(state.flexBalance + delta);
    if (next < 0) return toast(`You only have ${money(state.flexBalance)} available in Flexible.`);
    state.flexBalance = next;
    save();
    render();
    toast(`${label}: Flexible is now ${money(state.flexBalance)}.`);
  }

  if (flexAddBtn) flexAddBtn.onclick = () => {
    const v = prompt('Amount to add to Flexible:', '');
    if (v === null) return;
    const a = Number(v);
    if (!Number.isFinite(a) || a <= 0) return toast('Enter an amount greater than $0.');
    adjustFlexible(a, 'Money added');
  };

  if (flexSpendBtn) flexSpendBtn.onclick = () => {
    const v = prompt(`Amount spent from Flexible (available ${money(state.flexBalance)}):`, '');
    if (v === null) return;
    const a = Number(v);
    if (!Number.isFinite(a) || a <= 0) return toast('Enter an amount greater than $0.');
    adjustFlexible(-a, 'Spending recorded');
  };

  // Preserve all existing settings behavior, then save the real Flexible balance too.
  const previousSaveSettings = saveBtn?.onclick;
  if (saveBtn) {
    saveBtn.onclick = () => {
      const v = Number(flexBalanceInput?.value);
      if (!Number.isFinite(v) || v < 0) return toast('Current Flexible balance must be $0 or more.');
      state.flexBalance = roundMoney(v);
      if (typeof previousSaveSettings === 'function') previousSaveSettings();
      else { save(); render(); toast('Settings saved.'); }
      syncFlexInput();
    };
  }

  // Keep the weekly planning math, but show the real balance as the primary Flexible number.
  const originalRender = render;
  render = function(){
    originalRender();
    const p = calc();
    const cards = document.querySelectorAll('#allocationCards .abox');
    const flexCard = cards[3];
    if (flexCard) {
      flexCard.innerHTML = `
        <span class="mini muted">Flexible available</span>
        <strong>${money(state.flexBalance)}</strong>
        <div class="mini muted" style="margin-top:4px">This week's plan: ${money(p.flexible)}</div>
        <div class="bar" style="background:#f4aec7"></div>`;
    }
    syncFlexInput();
    save();
  };
  window.render = render;

  // Re-bind the plan button because app.js attached the original render function directly.
  const recalcBtn = document.getElementById('recalcBtn');
  if (recalcBtn) recalcBtn.onclick = render;

  // A repayment comes out of the real Flexible balance when it is actually marked repaid.
  const penaltyRepay = window.repay;
  repay = function(id){
    const r = state.repayments.find(x => x.id === id);
    if (!r || r.paid) return;
    const owed = roundMoney(r.owed);
    if (state.flexBalance + 0.0001 < owed) {
      return toast(`Not enough Flexible to repay ${money(owed)}. Available: ${money(state.flexBalance)}.`);
    }
    state.flexBalance = roundMoney(state.flexBalance - owed);
    penaltyRepay(id);
    save();
    render();
  };
  window.repay = repay;

  save();
  render();
})();
