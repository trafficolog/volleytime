// Root Admin: жалобы (R-10), склейка дублей (R-11)
const COMPLAINTS = [
  { id:'C-214', from:'Лера С.', to:'СпайкКлуб', kind:'Деньги не вернули после отмены', amt:'15,00 BYN', age:'2 ч', st:'new' },
  { id:'C-213', from:'Антон К. (организатор)', to:'Марат Г.', kind:'Неявки и долг', amt:'30,00 BYN', age:'5 ч', st:'new' },
  { id:'C-211', from:'Маша В.', to:'Пляж Минск', kind:'Игру отменили без предупреждения', amt:'—', age:'1 д', st:'work' },
  { id:'C-207', from:'Никита В.', to:'VolleyTime Минск', kind:'Грубость или неуважение', amt:'—', age:'3 д', st:'done' },
];
const C_ST = { new:['новая','vt-chip--rose'], work:['в работе','vt-chip--amber'], done:['решена','vt-chip--grass'] };

const AdminComplaints = () => {
  const nav = useNav();
  const [f, setF] = React.useState('open');
  const rows = COMPLAINTS.filter(c => f === 'all' || (f === 'open' ? c.st !== 'done' : c.st === 'done'));
  const cols = '80px minmax(0,1.4fr) minmax(0,1.2fr) minmax(0,1.8fr) 110px 70px 110px 40px';
  const open = (c) => nav.sheet({
    title:`${c.id} · ${c.kind}`, sub:`${c.from} → ${c.to}${c.amt !== '—' ? ' · ' + c.amt : ''}`,
    items:[
      { icon:'chat', label:'Запросить объяснение у стороны', onClick: () => nav.toast(`Запрос отправлен «${c.to}» · срок 48 ч`) },
      { icon:'wallet', label:'Зафиксировать возврат', onClick: () => nav.toast(`${c.id} · возврат зафиксирован, игрок уведомлён`) },
      { icon:'lock', label:'Предупреждение организации', onClick: () => nav.toast(`«${c.to}» · предупреждение, запись в журнал`) },
      '---',
      { icon:'check', label:'Закрыть без мер', onClick: () => nav.toast(`${c.id} закрыта`) },
    ]
  });
  return (
    <AdminShell activeNav="complaints" title="Жалобы" sub="Обращения игроков и организаторов · ответ в течение 24 ч">
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:14, marginBottom:18}}>
        {[['Новые', '2', 'старшей 5 ч'], ['В работе', '1', 'ждём ответа стороны'], ['Решено за 30 дней', '11', 'среднее время 9 ч']].map(([l, v, d]) => (
          <div key={l} className="vt-card" style={{padding:16}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{l}</div>
            <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-2xl)', marginTop:8}}>{v}</div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4}}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex', gap:8, marginBottom:14}}>
        {[['open','Открытые'],['done','Решённые'],['all','Все']].map(([k, l]) => (
          <button key={k} onClick={() => setF(k)} className="vt-btn vt-btn--sm" style={{background: f === k ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: f === k ? 'var(--vt-paper)' : 'var(--vt-ink)', fontWeight:600}}>{l}</button>
        ))}
      </div>
      <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
        <div style={{display:'grid', gridTemplateColumns:cols, gap:12, padding:'10px 18px', borderBottom:'1px solid var(--vt-bone-2)'}}>
          {['№','От кого','На кого','Суть','Сумма','Возраст','Статус',''].map((h, i) => <div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>)}
        </div>
        {rows.map((c, i) => (
          <div key={c.id} style={{display:'grid', gridTemplateColumns:cols, gap:12, padding:'12px 18px', alignItems:'center', borderBottom: i < rows.length - 1 ? '1px solid var(--vt-bone-2)' : 'none', fontSize:'var(--fs-sm)'}}>
            <span className="vt-mono" style={{color:'var(--vt-mute-2)'}}>{c.id}</span>
            <span style={{fontWeight:600}}>{c.from}</span>
            <span>{c.to}</span>
            <span>{c.kind}</span>
            <span className="vt-mono">{c.amt}</span>
            <span className="vt-mono" style={{color:'var(--vt-mute-2)'}}>{c.age}</span>
            <span><span className={`vt-chip vt-chip--dot ${C_ST[c.st][1]}`} style={{fontSize:'var(--fs-2xs)'}}>{C_ST[c.st][0]}</span></span>
            <button onClick={() => open(c)} aria-label="Действия" className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'6px 8px'}}><Icon name="more" size={14}/></button>
          </div>
        ))}
      </div>
    </AdminShell>
  );
};

const AdminDuplicates = () => {
  const nav = useNav();
  const [pairs, setPairs] = React.useState([
    { a:['Маша Волкова', '@m_volk', 'Telegram · 14 записей · 2 группы'], b:['Maria Volk', 'maria@…', 'email · 3 записи · 1 группа'], why:'одно имя, один телефон' },
    { a:['Сергей Богдан', '@sergey_b', 'Telegram · 9 записей · организатор'], b:['Sergey B.', 's.bogdan@…', 'email · вход в кабинет'], why:'email указан в Telegram-профиле' },
  ]);
  const merge = (i) => {
    const p = pairs[i];
    nav.alert({
      title:`Объединить в «${p.a[0]}»?`, body:'Записи, членства, абонементы и история оплат перейдут в основную учётную запись. Второй способ входа останется рабочим. Отменить можно в течение 7 дней.',
      confirm:'Объединить', onConfirm: () => { setPairs(ps => ps.filter((_, j) => j !== i)); nav.toast('Учётные записи объединены · записано в журнал'); }
    });
  };
  if (!pairs.length) return null;
  return (
    <div className="vt-card" style={{padding:18, marginBottom:18}}>
      <div style={{display:'flex', alignItems:'baseline', gap:10}}>
        <h3 style={{fontSize:'var(--fs-md)'}}>Возможные дубли</h3>
        <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>Один человек вошёл через Telegram и через email</span>
      </div>
      {pairs.map((p, i) => (
        <div key={p.a[1]} style={{display:'grid', gridTemplateColumns:'minmax(0,1fr) 24px minmax(0,1fr) minmax(0,0.9fr) auto', gap:14, alignItems:'center', padding:'12px 0', borderTop:'1px solid var(--vt-bone-2)', marginTop: i ? 0 : 12}}>
          {[p.a, p.b].map((u, k) => (
            <React.Fragment key={k}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{u[0]} <span className="vt-mono" style={{fontWeight:400, color:'var(--vt-mute-2)'}}>{u[1]}</span></div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{u[2]}</div>
              </div>
              {k === 0 && <Icon name="arrow-r" size={14} stroke="var(--vt-icon-idle)"/>}
            </React.Fragment>
          ))}
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)'}}>{p.why}</div>
          <div style={{display:'flex', gap:6}}>
            <button onClick={() => setPairs(ps => ps.filter((_, j) => j !== i))} className="vt-btn vt-btn--ghost vt-btn--sm">Разные люди</button>
            <button onClick={() => merge(i)} className="vt-btn vt-btn--primary vt-btn--sm">Объединить</button>
          </div>
        </div>
      ))}
    </div>
  );
};

Object.assign(window, { AdminComplaints, AdminDuplicates });
