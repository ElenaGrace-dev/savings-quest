(()=>{
  let editingEnvelopeId=null;
  const modal=document.getElementById('envelopeModal');
  const title=modal?.querySelector('h3');
  const saveBtn=document.getElementById('saveEnvelopeBtn');
  const addBtn=document.getElementById('addEnvelopeBtn');

  function clearEnvelopeForm(){
    envName.value='';
    envTarget.value='';
    envBalance.value='0';
    envWeekly.value='';
    envDueDay.value='';
  }

  function openAddEnvelopeModal(){
    editingEnvelopeId=null;
    clearEnvelopeForm();
    if(title) title.textContent='Add bill envelope';
    if(saveBtn) saveBtn.textContent='Save envelope';
    modal?.classList.add('show');
    setTimeout(()=>envName.focus(),50);
  }

  function openEditEnvelopeModal(id){
    const e=state.envelopes.find(x=>x.id===id);
    if(!e) return toast('Envelope not found.');
    editingEnvelopeId=id;
    envName.value=e.name||'';
    envTarget.value=Number(e.target||0).toFixed(2);
    envBalance.value=Number(e.balance||0).toFixed(2);
    envWeekly.value=Number(e.weekly||0).toFixed(2);
    envDueDay.value=e.dueDay||'';
    if(title) title.textContent='Edit bill envelope';
    if(saveBtn) saveBtn.textContent='Save changes';
    modal?.classList.add('show');
    setTimeout(()=>envName.focus(),50);
  }

  function saveEnvelopeFromModal(){
    const name=envName.value.trim();
    const target=Number(envTarget.value);
    const balance=Number(envBalance.value);
    const weekly=Number(envWeekly.value);
    const dueDay=envDueDay.value===''?0:Number(envDueDay.value);

    if(!name) return toast('Envelope name cannot be blank.');
    if(!Number.isFinite(target)||target<0) return toast('Enter a valid target amount.');
    if(!Number.isFinite(balance)||balance<0) return toast('Enter a valid current balance.');
    if(!Number.isFinite(weekly)||weekly<0) return toast('Enter a valid weekly amount.');
    if(!Number.isFinite(dueDay)||dueDay<0||dueDay>31) return toast('Due day must be between 1 and 31.');

    if(editingEnvelopeId){
      const e=state.envelopes.find(x=>x.id===editingEnvelopeId);
      if(!e) return toast('Envelope not found.');
      const oldName=e.name;
      const oldBalance=Number(e.balance||0);
      e.name=name;
      e.target=Math.round(target*100)/100;
      e.balance=Math.round(balance*100)/100;
      e.weekly=Math.round(weekly*100)/100;
      e.dueDay=dueDay;
      e.history=e.history||[];
      if(oldBalance!==e.balance){
        e.history.push({date:today(),week:state.week,type:'manual balance edit',amount:Math.abs(e.balance-oldBalance)});
      }
      state.repayments.filter(r=>!r.paid&&r.envelopeId===e.id).forEach(r=>r.envelopeName=name);
      closeModal('envelopeModal');
      editingEnvelopeId=null;
      render();
      toast(`${oldName} updated.`);
      return;
    }

    state.envelopes.push({id:uid(),name,target:Math.round(target*100)/100,balance:Math.round(balance*100)/100,weekly:Math.round(weekly*100)/100,dueDay,history:[]});
    closeModal('envelopeModal');
    render();
    toast('Envelope added.');
  }

  window.editEnvelope=openEditEnvelopeModal;
  if(addBtn) addBtn.onclick=openAddEnvelopeModal;
  if(saveBtn) saveBtn.onclick=saveEnvelopeFromModal;
})();