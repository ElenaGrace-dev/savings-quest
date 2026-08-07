// Savings Quest configurable self-imposed envelope borrowing penalty.
(() => {
  // Preserve existing users while defaulting new/previous installs to the stronger deterrent.
  if (!Number.isFinite(Number(state.borrowInterestPercent))) state.borrowInterestPercent = 10;

  const settingsCard = document.getElementById('saveSettings')?.closest('.card');
  const saveBtn = document.getElementById('saveSettings');
  if (settingsCard && saveBtn && !document.getElementById('borrowInterestPercent')) {
    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.marginTop = '10px';
    label.innerHTML = 'Envelope borrowing penalty (%)<input id="borrowInterestPercent" type="number" min="0" max="100" step="1">';
    settingsCard.insertBefore(label, saveBtn);
  }

  const interestInput = document.getElementById('borrowInterestPercent');
  if (interestInput) interestInput.value = state.borrowInterestPercent;

  // Extend the existing settings save action.
  const originalSaveSettings = saveSettings.onclick;
  saveSettings.onclick = () => {
    const pct = Number(interestInput?.value);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast('Borrowing penalty must be between 0% and 100%.');
      return;
    }
    state.borrowInterestPercent = Math.round(pct * 100) / 100;
    if (typeof originalSaveSettings === 'function') originalSaveSettings();
    else { save(); render(); toast('Settings saved.'); }
  };

  function currentRate() {
    const pct = Number(state.borrowInterestPercent);
    return Number.isFinite(pct) ? Math.max(0, pct) : 10;
  }

  function refreshBorrowCopy() {
    const modal = document.getElementById('borrowModal');
    const copy = modal?.querySelector('p');
    const button = document.getElementById('confirmBorrow');
    const pct = currentRate();
    if (copy) copy.textContent = `Savings Quest adds your ${pct}% self-imposed penalty and reserves the full repayment from next week's Flexible money.`;
    if (button) button.textContent = `Borrow with ${pct}% penalty`;
  }

  // Use the chosen rate for all new borrowing.
  confirmBorrow.onclick = () => {
    const e = getEnvelope(borrowEnvId.value);
    const a = Number(borrowAmount.value) || 0;
    if (!e || a <= 0 || a > e.balance) return toast('Enter an amount available in this envelope.');

    const pct = currentRate();
    const owed = Math.round(a * (1 + pct / 100) * 100) / 100;
    e.balance = Math.round((e.balance - a) * 100) / 100;
    e.history.push({ date: today(), week: state.week, type: 'borrow', amount: a, interestPercent: pct });
    state.repayments.push({
      id: uid(), envelopeId: e.id, envelopeName: e.name,
      borrowed: a, owed, interestPercent: pct, paid: false, date: today()
    });
    closeModal('borrowModal');
    render();
    toast(`Repayment scheduled: ${money(owed)} (${pct}% penalty)`);
  };

  // Display the actual rate attached to each repayment. Legacy repayments remain 1%.
  renderRepayments = function() {
    const open = state.repayments.filter(r => !r.paid);
    repaymentList.innerHTML = open.length ? open.map(r => {
      const pct = Number.isFinite(Number(r.interestPercent)) ? Number(r.interestPercent) : 1;
      return `<div class="item"><b>${r.envelopeName}</b><div class="mini muted">Borrowed ${money(r.borrowed)} + ${pct}% penalty = ${money(r.owed)}</div><button class="btn secondary" style="margin-top:8px" onclick="repay('${r.id}')">Mark repaid</button></div>`;
    }).join('') : '<div class="muted mini">No repayments due.</div>';
  };

  repay = function(id) {
    const r = state.repayments.find(x => x.id === id);
    if (!r) return;
    const e = getEnvelope(r.envelopeId);
    if (!e) return toast('That envelope could not be found.');
    const pct = Number.isFinite(Number(r.interestPercent)) ? Number(r.interestPercent) : 1;
    e.balance = Math.round((e.balance + r.owed) * 100) / 100;
    e.history.push({ date: today(), week: state.week + 1, type: `repayment + ${pct}% penalty`, amount: r.owed, interestPercent: pct });
    r.paid = true;
    render();
    toast(`${e.name} repaid with ${pct}% penalty.`);
  };
  window.repay = repay;

  // Keep modal wording current if the setting changes.
  const originalOpenBorrow = openBorrow;
  openBorrow = function(id) {
    originalOpenBorrow(id);
    refreshBorrowCopy();
  };
  window.openBorrow = openBorrow;

  refreshBorrowCopy();
  save();
  render();
})();
