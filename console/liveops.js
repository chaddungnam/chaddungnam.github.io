(function (root) {
  const byId = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const names = {exp:"런 EXP 배수",boss:"주간 보스 변형",mail:"이벤트 시약 우편",lab_home:"연구소 홈",lab_pass:"연구소 패스",economy_v2:"경제 v2",deep_zone:"심층 존 입구",vip1_sales:"VIP1 판매",phase6:"P6 열기",boss_p7:"P7 열기",boss_p8:"P8 열기"};
  const flags = {exp:"feature_liveops_event",boss:"feature_boss_weekly_variant",phase6:"feature_boss_variant",lab_home:"feature_lab_home",lab_pass:"feature_lab_pass",economy_v2:"lab_economy_v2",deep_zone:"feature_deep_zone",vip1_sales:"feature_vip1_sales",boss_p7:"feature_boss_variant_p7",boss_p8:"feature_boss_variant_p8"};
  const warnings = {vip1_sales:"스토어 상품 등록·심사 뒤에만 켜세요.",boss_p7:"P6이 열린 뒤에만 켜세요.",boss_p8:"P7이 열린 뒤에만 켜세요."};
  const pending = new WeakMap();
  let sequence = 0, busy = false, ready = false;
  const post = body => root.ConsoleAPI.post("admin-console",body);
  function json(v) { try {const o=JSON.parse(v);return o && typeof o === 'object' && !Array.isArray(o) ? o : {};} catch (_) {return {};} }
  function localTime(v) { const d=new Date(v);return Number.isNaN(d.getTime()) ? "" : new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); }
  function render(config) {
    const exp=json(config.liveops_config), mail=json(config.console_event_mail);
    byId("liveopsForms").innerHTML = Object.entries(names).map(([kind,name]) => {
      const enabled=kind==='mail' ? mail.enabled === true : config[flags[kind]] === 'true';
      const dates = kind==='exp' && exp.ends_at ? ` · ${exp.starts_at} → ${exp.ends_at}` : kind==='mail' && mail.endsAt ? ` · 수령 종료 ${mail.endsAt}` : '';
      const fields=kind==='exp' ? `<div class="form-pair"><label>이벤트 ID<input name="eventId" value="${esc(exp.event_id)}" pattern="[a-z0-9][a-z0-9_-]{1,47}" maxlength="48" required></label><label>EXP 배수 (1~3)<input name="multiplier" type="number" min="1" max="3" step="0.1" value="${Number(exp.exp_multiplier)||1.5}" required></label></div><div class="form-pair"><label>시작 (현재 시간대)<input name="startsAt" type="datetime-local" value="${localTime(exp.starts_at)}" required></label><label>종료 (현재 시간대)<input name="endsAt" type="datetime-local" value="${localTime(exp.ends_at)}" required></label></div>` : kind==='mail' ? `<p>기존 계정에게 즉시 발송합니다. 미래 자동 발송은 지원하지 않습니다. 같은 키는 계정당 한 번만 지급합니다. 끄기는 이미 발송한 우편을 회수하지 않습니다.</p><div class="form-pair"><label>이벤트 키<input name="eventKey" pattern="[a-z0-9][a-z0-9_-]{1,47}" maxlength="48" value="${esc(mail.eventKey)}" required></label><label>계정당 시약<input name="reagent" type="number" min="1" max="1000000" step="1" value="${Number(mail.reagent)||200}" required></label></div><label>수령 기간 (오늘부터 1~30일)<input name="expiresInDays" type="number" min="1" max="30" step="1" value="${Number(mail.expiresInDays)||7}" required></label>` : `<p>호환 2.0 클라이언트가 설정을 다시 읽을 때 반영됩니다.${warnings[kind] ? ` <strong>${esc(warnings[kind])}</strong>` : ''}</p>`;
      return `<details class="operation-task" ${kind==='exp' ? 'open' : ''}><summary>${name} · ${enabled ? '켜짐' : '꺼짐'}${esc(dates)}</summary><form class="admin-form liveops-form" data-kind="${kind}"><fieldset>${fields}<label>변경 사유<input name="reason" maxlength="300" required></label><div class="detail-actions"><button class="primary-button" type="submit">미리보기 후 켜기</button><button type="button" data-disable="${kind}">끄기</button></div><p class="liveops-preview" role="status"></p></fieldset></form></details>`;
    }).join('');
    byId('liveopsForms').querySelectorAll('form').forEach(form=>{
      form.addEventListener('submit',e=>{e.preventDefault();change(form,true);});
      form.querySelector('[data-disable]').addEventListener('click',()=>change(form,false));
    });
  }
  async function load() {
    if(busy)return;
    const seq=++sequence;ready=false;
    byId('liveopsPanel').setAttribute('aria-busy','true');
    byId('liveopsForms').querySelectorAll('fieldset').forEach(f=>f.disabled=true);
    byId('liveopsMessage').textContent='이벤트 상태를 불러오는 중입니다. 확인 전에는 변경할 수 없습니다.';
    try {
      const d=await post({action:'liveops.get'});if(seq!==sequence)return;
      if(!d.config || typeof d.config!=='object')throw new Error('invalid_liveops_response');
      render(d.config);ready=true;byId('liveopsForms').querySelectorAll('fieldset').forEach(f=>f.disabled=false);
      byId('liveopsMessage').textContent='설정의 켜짐과 실제 이벤트 기간을 함께 확인하세요. EXP 배수는 기간 안에서만 적용됩니다.';
    } catch (_) {if(seq===sequence)byId('liveopsMessage').textContent='설정을 조회하지 못했습니다. 서버 적용 상태·권한을 확인한 뒤 상태 새로고침을 눌러 주세요. 변경은 잠겨 있습니다.';}
    finally {if(seq===sequence)byId('liveopsPanel').setAttribute('aria-busy','false');}
  }
  async function change(form,enabled) {
    if(busy || !ready)return;
    const reason=form.elements.reason.value.trim();
    const report=form.querySelector('.liveops-preview');
    if(!reason){report.textContent='변경 사유를 입력해 주세요.';form.elements.reason.focus();return;}
    if(enabled && !form.reportValidity())return;
    const kind=form.dataset.kind;let config={};
    if(enabled && kind==='exp'){
      const startsAt=new Date(form.elements.startsAt.value),endsAt=new Date(form.elements.endsAt.value);
      if(!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt<=startsAt || endsAt<=new Date()){report.textContent='종료는 시작과 현재 시각보다 뒤여야 합니다.';return;}
      config={eventId:form.elements.eventId.value.trim(),startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString(),multiplier:Number(form.elements.multiplier.value)};
    }
    if(enabled && kind==='mail')config={eventKey:form.elements.eventKey.value.trim(),reagent:Number(form.elements.reagent.value),expiresInDays:Number(form.elements.expiresInDays.value)};
    const payload={action:'liveops.update',kind,enabled,config,reason};
    const fingerprint=JSON.stringify(payload),prior=pending.get(form);
    const requestId=prior?.fingerprint===fingerprint ? prior.requestId : crypto.randomUUID();
    const route=root.location.hash;
    busy=true;byId('liveopsForms').querySelectorAll('fieldset').forEach(f=>f.disabled=true);byId('liveopsRefresh').disabled=true;
    let succeeded=false;
    try {
      let summary=`${names[kind]} ${enabled ? '켜기' : '끄기'}\n사유: ${reason}`;
      if(enabled){
        report.textContent='대상 수와 지급량을 확인하는 중입니다.';
        const preview=await post({action:'liveops.preview',kind,enabled,config});
        summary+=`\n현재 계정 기준 대상 ${preview.targets}명 (접속 인원 예측 아님)`;
        if(kind==='mail')summary+=`\n계정당 ${preview.reagent_per_account}시약 · 총 ${preview.total_reagent}시약\n동일 키 기지급 ${preview.already_received}명 제외\n키 ${config.eventKey} · 오늘부터 ${config.expiresInDays}일 수령`;
        if(kind==='exp')summary+=`\n${config.eventId} · ${config.multiplier}배\n${config.startsAt} → ${config.endsAt}`;
        summary+='\n미리보기 이후 계정 수는 달라질 수 있습니다.';
      } else if(kind==='mail')summary+='\n이미 발송한 우편은 남습니다.';
      report.textContent=summary;
      if(route!==root.location.hash || !await root.ConsoleApp.confirmChange(`${names[kind]} 변경 확인`,summary) || route!==root.location.hash)return;
      pending.set(form,{fingerprint,requestId});report.textContent='변경 중입니다...';
      const result=await post({...payload,requestId});
      if(result.ok===false)throw new Error(result.error || 'liveops_update_failed');
      pending.delete(form);succeeded=true;
      byId('liveopsMessage').textContent=`${names[kind]} ${enabled ? '켜기' : '끄기'} 완료 · 감사 기록에 저장했습니다.${kind==='mail' && enabled ? ` 실제 발송 ${result.grant?.inserted ?? '확인 필요'}건.` : ''}`;
    } catch (error) {
      if(Number(error?.status)>=400 && Number(error?.status)<500)pending.delete(form);
      report.textContent=error?.message==='event_key_conflict' ? '이미 사용한 키의 시약량은 바꿀 수 없습니다. 새 이벤트 키를 사용해 주세요.' : '처리 결과를 확인하지 못했습니다. 감사 기록에서 확인하거나 같은 입력으로 재시도하세요. 입력은 유지했습니다.';
    } finally {
      busy=false;byId('liveopsForms').querySelectorAll('fieldset').forEach(f=>f.disabled=false);byId('liveopsRefresh').disabled=false;
      if(succeeded){const text=byId('liveopsMessage').textContent;await load();if(ready)byId('liveopsMessage').textContent=text;}
    }
  }
  byId('liveopsRefresh').addEventListener('click',load);
  root.ConsoleLiveops={mount:load};
})(window);
