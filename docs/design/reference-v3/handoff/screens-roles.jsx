// Роли в группе: переключение режима, тренер, «Состав сегодня», расход, «Я оплатил»
const RoleContext = React.createContext({ person:'player', mode:'play', coachPay:false, setMode:() => {} });
const ROLE_MODES = { player:['play'], organizer:['play','manage'], coach:['play','lead'] };
const MODE_LABEL = { play:'Играю', manage:'Управляю', lead:'Веду' };
const defaultModeOf = (person) => person === 'organizer' ? 'manage' : person === 'coach' ? 'lead' : 'play';

// Помощь и поддержка — для организатора и тренера (у игрока вход из профиля)
const SupHelpBtn = () => {
  const nav = typeof useNav === 'function' ? useNav() : null;
  return (
    <button aria-label="Помощь и поддержка" onClick={() => nav && nav.push('support')} style={{width:36, height:36, borderRadius:'var(--r-pill)', background:'var(--vt-bone)', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer'}}>
      <span aria-hidden="true" style={{fontWeight:700, fontSize:'var(--fs-sm)'}}>?</span>
    </button>
  );
};
const ModeBar = () => {
  const r = React.useContext(RoleContext);
  const modes = ROLE_MODES[r.person] || ['play'];
  if (modes.length < 2) return null;
  return (
    <div style={{padding:'4px 16px 8px', display:'flex', alignItems:'center', gap:10}}>
      <div style={{flex:1, minWidth:0, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
        VolleyTime Минск · {r.person === 'organizer' ? 'владелец' : 'тренер'}
      </div>
      <div style={{display:'flex', padding:3, gap:2, borderRadius:'var(--r-pill)', background:'var(--vt-bone)'}}>
        {modes.map(m => (
          <button key={m} onClick={() => r.setMode(m)} style={{
            minHeight:36, padding:'0 14px', borderRadius:'var(--r-pill)', cursor:'pointer',
            fontSize:'var(--fs-xs)', fontWeight:600,
            background: r.mode === m ? 'var(--vt-ink)' : 'transparent',
            color: r.mode === m ? 'var(--vt-paper)' : 'var(--vt-ink-3)'
          }}>{MODE_LABEL[m]}</button>
        ))}
      </div>
      <SupHelpBtn/>
    </div>
  );
};

const CoachTabBar = ({ active = 'home' }) => {
  const nav = useNav();
  const tabs = [
    { id:'home', screen:'home', label:'Сегодня', icon:'home' },
    { id:'roster', screen:'roster', label:'Состав', icon:'users' },
    { id:'schedule', screen:'schedule', label:'Расписание', icon:'calendar' },
  ];
  return (
    <div className="vt-tabbar">
      {tabs.map(t => (
        <button key={t.id} data-active={active === t.id} onClick={() => nav.reset(t.screen)}>
          <span className="ico"><Icon name={t.icon} size={20}/></span>{t.label}
        </button>
      ))}
    </div>
  );
};

const COACH_EVENTS = [
  { id:'c1', day:'Ср', date:'28', time:'20:00–22:00', title:'Основа', venue:'Школа №24, малый зал', m:'12 / 14', meter:86, today:true },
  { id:'c2', day:'Пт', date:'30', time:'19:30–22:00', title:'Открытая игра', venue:'СК «Заслонова»', m:'9 / 14', meter:64 },
  { id:'c3', day:'Ср', date:'4', time:'20:00–22:00', title:'Основа', venue:'Школа №24, малый зал', m:'5 / 14', meter:36 },
];

const RoleNote = ({ icon, tone = 'state', children }) => (
  <div style={{padding:'12px 14px', borderRadius:'var(--r-chip)', display:'flex', gap:10, alignItems:'flex-start',
    background: tone === 'grass' ? 'var(--vt-grass-soft)' : tone === 'amber' ? 'var(--vt-amber-soft)' : 'var(--vt-bone)'}}>
    <Icon name={icon} size={15} stroke={tone === 'grass' ? 'var(--vt-grass-ink)' : tone === 'amber' ? 'var(--vt-amber-ink)' : 'var(--vt-icon-idle)'} sw={2}/>
    <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', lineHeight:1.45, flex:1}}>{children}</div>
  </div>
);

const CoachEventRows = ({ events, onOpen }) => (
  <div>
    {events.map((e, i) => (
      <button key={e.id} onClick={() => onOpen(e)} style={{display:'flex', alignItems:'center', gap:16, width:'100%', textAlign:'left', cursor:'pointer', padding:'12px 0', boxShadow: i ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none'}}>
        <div style={{width:44, textAlign:'center', flexShrink:0}}>
          <div className="vt-mono" style={{fontSize:'var(--fs-3xl)', fontWeight:700, lineHeight:1}}>{e.date}</div>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:4}}>{e.day}</div>
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:'var(--fs-md)', fontWeight:700}}>{e.title}</div>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>{e.time} · {e.venue}</div>
          <div style={{display:'flex', alignItems:'center', gap:8, marginTop:8}}>
            <div className="vt-meter" style={{flex:1, maxWidth:120}}><i style={{width:`${e.meter}%`, background: meterTint(e.meter)}}/></div>
            <span className="vt-mono" style={{fontSize:'var(--fs-sm)'}}>{e.m}</span>
          </div>
        </div>
        {e.today && <span className="vt-chip vt-chip--flame">сегодня</span>}
      </button>
    ))}
  </div>
);

const CoachToday = () => {
  const nav = useNav();
  const r = React.useContext(RoleContext);
  const ev = COACH_EVENTS[0];
  return (
    <>
      <MiniHeader title="Сегодня" sub="Ср, 28 мая · вы ведёте 1 тренировку"/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px'}}>
        <div className="vt-card vt-card--hero" style={{padding:18, color:'var(--vt-on-hero)'}}>
          <div className="vt-cap" style={{opacity:.72}}>Вы тренер · начало через 36 мин</div>
          <div style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-3xl)', lineHeight:1, marginTop:10}}>{ev.title} · 20:00</div>
          <div style={{fontSize:'var(--fs-sm)', opacity:.8, marginTop:6}}>{ev.venue}</div>
          <div style={{display:'flex', alignItems:'center', gap:8, marginTop:14}}>
            <div className="vt-meter" style={{flex:1}}><i style={{width:`${ev.meter}%`, background: meterTintOnDark(ev.meter)}}/></div>
            <span className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{ev.m}</span>
          </div>
          <button onClick={() => nav.reset('roster')} className="vt-btn vt-btn--lg vt-btn--full" style={{marginTop:16, background:'var(--vt-paper)', color:'var(--vt-ink)'}}>Отметить пришедших</button>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:10, marginTop:12}}>
          {[
            ['ball', 'Разминка', 'таймер у 12 игроков', () => nav.toast('Разминка запущена · 12 игроков получили таймер')],
            ['users', 'Составы', 'по уровням В1–В4+', () => nav.toast('Составы: 2 команды по 6 · можно поправить вручную')],
          ].map(([ic, t, s, fn]) => (
            <button key={t} onClick={fn} className="vt-card" style={{padding:14, textAlign:'left', cursor:'pointer', display:'flex', flexDirection:'column', gap:10}}>
              <Icon name={ic} size={18} stroke="var(--vt-ink-3)"/>
              <div>
                <div style={{fontWeight:600, fontSize:'var(--fs-base)'}}>{t}</div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{s}</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{marginTop:12}}>
          {r.coachPay
            ? <RoleNote icon="wallet" tone="grass">Иван П. разрешил вам принимать оплату на зале. Каждая подтверждённая оплата попадёт в кассу группы с вашим именем.</RoleNote>
            : <RoleNote icon="lock">Оплату и кассу ведёт организатор Иван П. Вам видны состав и посещаемость.</RoleNote>}
        </div>
        <h2 style={{fontSize:'var(--fs-xl)', marginTop:24}}>На неделе</h2>
        <CoachEventRows events={COACH_EVENTS.slice(1)} onOpen={(e) => nav.toast(`${e.title} · ${e.date} · отметка откроется в день тренировки`)}/>
      </div>
      <CoachTabBar active="home"/>
    </>
  );
};

const CoachSchedule = () => {
  const nav = useNav();
  return (
    <>
      <MiniHeader title="Мои тренировки" sub="Только события, где вы тренер"/>
      <div className="vt-phone__body" style={{padding:'4px 16px 16px'}}>
        <CoachEventRows events={COACH_EVENTS} onOpen={(e) => e.today ? nav.reset('roster') : nav.toast(`${e.title} · ${e.date} · отметка откроется в день тренировки`)}/>
        <div style={{marginTop:12}}>
          <RoleNote icon="calendar">Создавать и переносить события может только организатор. Тренера назначают на серию или на одно событие.</RoleNote>
        </div>
      </div>
      <CoachTabBar active="schedule"/>
    </>
  );
};

const ATT_OPTS = [
  ['here', 'check', 'пришёл', 'var(--vt-grass-soft)', 'var(--vt-grass-ink)'],
  ['late', 'clock', 'опоздал', 'var(--vt-amber-soft)', 'var(--vt-amber-ink)'],
  ['absent', 'close', 'не пришёл', 'var(--vt-rose-soft)', 'var(--vt-rose-ink)'],
];
const AttSeg = ({ value, onChange }) => (
  <div style={{display:'flex', gap:4, flexShrink:0}}>
    {ATT_OPTS.map(([v, ic, label, bg, ink]) => (
      <button key={v} aria-label={label} onClick={() => onChange(v)} style={{
        width:40, height:40, borderRadius:'var(--r-sm)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
        background: value === v ? bg : 'var(--vt-ctl)'
      }}>
        <Icon name={ic} size={16} stroke={value === v ? ink : 'var(--vt-icon-idle)'} sw={value === v ? 2.4 : 1.8}/>
      </button>
    ))}
  </div>
);

const rosterInit = () => buildRoster(12, {}).map((p, i) => ({
  ...p, att: i < 6 ? 'here' : i === 6 ? 'late' : null, claimed: p.pay === 'pending' && i % 2 === 0
}));

const RosterToday = () => {
  const nav = useNav();
  const r = React.useContext(RoleContext);
  const isOrg = r.mode === 'manage';
  const canPay = isOrg || r.coachPay;
  const [rows, setRows] = React.useState(rosterInit);
  const price = 15;
  const setAtt = (i, v) => setRows(rs => rs.map((p, j) => j === i ? { ...p, att: p.att === v ? null : v } : p));
  const done = (i, m) => {
    const p = rows[i];
    setRows(rs => rs.map((x, j) => j === i ? { ...x, pay:'paid', claimed:false } : x));
    nav.toast(`${p.name} · ${byn(price * p.seats)} · ${methodLabel(m)} · в кассе от имени ${isOrg ? 'Ивана П.' : 'Ольги Р.'}`);
  };
  const acceptPay = (i) => {
    const p = rows[i];
    nav.sheet({
      title:`Оплата · ${p.name}`,
      sub:`${byn(price * p.seats)}${p.claimed ? ' · игрок отметил «Я оплатил»' : ''}`,
      items:[
        { icon:'wallet', label:'Получил наличными', onClick: () => done(i, 'cash') },
        { icon:'card', label:'Перевод пришёл', onClick: () => done(i, 'transfer') },
      ]
    });
  };
  const here = rows.filter(p => p.att === 'here' || p.att === 'late').length;
  const absent = rows.filter(p => p.att === 'absent').length;
  const unmarked = rows.length - here - absent;
  const toPay = rows.filter(p => p.pay === 'pending').length;
  const stats = [
    [here, 'пришли', 'var(--vt-ink)'],
    [absent, 'не пришли', 'var(--vt-ink)'],
    [unmarked, 'не отмечены', 'var(--vt-ink)'],
    ...(canPay ? [[toPay, 'к оплате', 'var(--vt-amber-ink)']] : []),
  ];
  const save = () => nav.toast(unmarked ? `Не отмечено ещё ${unmarked} · сохраним, когда отметите всех` : `Посещаемость сохранена · не пришли: ${absent}`);
  return (
    <>
      <MiniHeader title="Состав · Основа" sub="Сегодня 20:00 · Школа №24"/>
      <div className="vt-phone__body" style={{padding:'4px 16px 16px'}}>
        <div style={{display:'grid', gridTemplateColumns:`repeat(${stats.length}, minmax(0,1fr))`, gap:6}}>
          {stats.map(([n, l, c]) => (
            <div key={l} className="vt-card" style={{padding:'10px 6px', textAlign:'center'}}>
              <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-lg)', color:c}}>{n}</div>
              <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:2, fontSize:'var(--fs-2xs)'}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8, marginTop:10, flexWrap:'wrap'}}>
          {[['связ.', 1, true], ['доигр.', 6], ['диаг.', 2], ['центр.', 2], ['либеро', 1]].map(([l, n, warn]) => (
            <span key={l} className={`vt-chip ${warn ? 'vt-chip--amber' : ''}`} style={{fontSize:'var(--fs-2xs)'}}>{l} {n}</span>
          ))}
          <button onClick={() => nav.sheet({ title:'QR на вход', sub:'Игроки сканируют — отметка и оплата сразу', items:[{ icon:'qr', label:'Показать QR на экране', onClick: () => nav.toast('QR открыт · обновляется каждую минуту') }, { icon:'send', label:'Отправить в чат группы', onClick: () => nav.toast('QR отправлен в чат') }] })} className="vt-btn vt-btn--ghost vt-btn--sm" style={{marginLeft:'auto'}}><Icon name="qr" size={14}/> QR</button>
        </div>
        <div style={{display:'flex', justifyContent:'flex-end', gap:12, fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', margin:'12px 0 2px'}}>
          {ATT_OPTS.map(([v, ic, label]) => <span key={v} style={{display:'flex', alignItems:'center', gap:4}}><Icon name={ic} size={11}/>{label}</span>)}
        </div>
        {rows.map((p, i) => (
          <div key={i} style={{padding:'10px 0', boxShadow: i ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none'}}>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <Avi name={p.name} init={p.init} tag={p.tag} size="sm"/>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:'var(--fs-base)', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{p.name}{p.seats > 1 ? ` +${p.seats - 1}` : ''}</div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>
                  {p.level}{canPay && p.pay === 'paid' ? ' · оплачено' : ''}{canPay && p.pay === 'subs' ? ' · абонемент' : ''}
                </div>
              </div>
              <AttSeg value={p.att} onChange={(v) => setAtt(i, v)}/>
            </div>
            {canPay && p.pay === 'pending' && (
              <div style={{display:'flex', alignItems:'center', gap:8, marginTop:8, paddingLeft:42}}>
                <span className={`vt-chip ${p.claimed ? 'vt-chip--amber' : 'vt-chip--state'}`} style={{fontSize:'var(--fs-2xs)'}}>{p.claimed ? 'говорит, что перевёл' : 'не оплачено'}</span>
                <span className="vt-mono" style={{fontSize:'var(--fs-xs)', fontWeight:600}}>{byn(price * p.seats)}</span>
                <button onClick={() => acceptPay(i)} className="vt-btn vt-btn--ghost vt-btn--sm" style={{marginLeft:'auto'}}>{p.claimed ? 'Подтвердить' : 'Принять'}</button>
              </div>
            )}
          </div>
        ))}
        <button onClick={() => nav.toast('Добавлен игрок без записи · место 13 из 14')} className="vt-btn vt-btn--ghost vt-btn--full" style={{marginTop:8, justifyContent:'flex-start', gap:10}}>
          <Icon name="plus" size={16}/> Пришёл без записи
        </button>
        {!canPay && (
          <div style={{marginTop:12}}>
            <RoleNote icon="lock">Статусы оплаты видит и фиксирует организатор. Попросите Ивана П. включить вам приём оплаты, если собираете деньги на зале.</RoleNote>
          </div>
        )}
      </div>
      <div style={{padding:'12px 16px', borderTop:'1px solid var(--vt-stroke)', background:'var(--vt-paper)'}}>
        <button onClick={save} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full" style={{justifyContent:'space-between'}}>
          <span>Сохранить отметки</span><span className="vt-mono" style={{opacity:.85}}>{here} / {rows.length}</span>
        </button>
      </div>
      {isOrg ? <OrgTabBar active="home"/> : <CoachTabBar active="roster"/>}
    </>
  );
};

const PickPill = ({ on, onClick, children }) => (
  <button onClick={onClick} style={{
    minHeight:40, padding:'0 14px', borderRadius:'var(--r-pill)', cursor:'pointer', fontSize:'var(--fs-sm)', fontWeight:600, whiteSpace:'nowrap',
    background: on ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: on ? 'var(--vt-paper)' : 'var(--vt-ink)'
  }}>{children}</button>
);

const OrgExpense = () => {
  const nav = useNav();
  const [amt, setAmt] = React.useState('');
  const [cat, setCat] = React.useState('rent');
  const [ev, setEv] = React.useState('Основа · 28 мая');
  const [note, setNote] = React.useState('');
  const n = parseFloat(String(amt).replace(',', '.')) || 0;
  const save = () => { if (!n) return; nav.back(); setTimeout(() => nav.toast(`Расход −${byn(n)} · ${catLabel(cat)} · записан в кассу`), 80); };
  return (
    <>
      <MiniHeader title="Расход" sub="Запишется в кассу группы"/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px'}}>
        <div className="vt-card" style={{padding:18}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Сумма</div>
          <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:6}}>
            <input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.,]/g, ''))} inputMode="decimal" placeholder="0,00" autoFocus
              className="vt-mono" style={{flex:1, minWidth:0, border:'none', outline:'none', background:'transparent', color:'var(--vt-ink)', fontSize:'var(--fs-5xl)', fontWeight:700, padding:0}}/>
            <span style={{fontSize:'var(--fs-lg)', fontWeight:600, color:'var(--vt-mute-2)'}}>BYN</span>
          </div>
        </div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'18px 4px 10px'}}>Категория</div>
        <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
          {['rent','balls','referee','other'].map(c => <PickPill key={c} on={cat === c} onClick={() => setCat(c)}>{catLabel(c)}</PickPill>)}
        </div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'18px 4px 10px'}}>К событию</div>
        <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
          {['Основа · 28 мая', 'Открытая игра · 30 мая', 'Без события'].map(x => <PickPill key={x} on={ev === x} onClick={() => setEv(x)}>{x}</PickPill>)}
        </div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'18px 4px 10px'}}>Комментарий</div>
        <input className="vt-field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: аренда за 2 часа"/>
      </div>
      <div style={{padding:'12px 16px', borderTop:'1px solid var(--vt-stroke)', background:'var(--vt-paper)'}}>
        <button onClick={save} disabled={!n} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full" style={{justifyContent:'space-between'}}>
          <span>Записать расход</span><span className="vt-mono" style={{opacity:.85}}>{n ? `−${byn(n)}` : '—'}</span>
        </button>
      </div>
    </>
  );
};

const PayDetails = ({ purpose = 'Основа 28 мая · Артём К.' }) => {
  const nav = useNav();
  const rows = [
    ['Карта', 'Belarusbank · 4255 •••• 3214', true],
    ['Получатель', 'Иван Петренко', false],
    ['Назначение', purpose, true],
  ];
  return (
    <div style={{borderRadius:'var(--r-chip)', background:'var(--vt-bone)', padding:'4px 12px'}}>
      {rows.map(([k, v, copy], i) => (
        <div key={k} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 0', boxShadow: i ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none'}}>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', width:84, flexShrink:0}}>{k}</div>
          <div style={{flex:1, minWidth:0, fontSize:'var(--fs-sm)', fontWeight:500}}>{v}</div>
          {copy && <button onClick={() => nav.toast('Скопировано')} aria-label="Скопировать" className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'6px 8px'}}><Icon name="copy" size={14}/></button>}
        </div>
      ))}
    </div>
  );
};

const EventHosts = () => {
  const nav = useNav();
  const hosts = [
    { name:'Иван Петренко', init:'ИП', tag:'ink', role:'организатор' },
    { name:'Ольга Романова', init:'ОР', tag:'grass', role:'тренер' },
  ];
  return (
    <div style={{padding:'12px 16px 0'}}>
      <div className="vt-card" style={{padding:'4px 14px'}}>
        {hosts.map((h, i) => (
          <div key={h.name} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 0', boxShadow: i ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none'}}>
            <Avi size="sm" name={h.name} init={h.init} tag={h.tag}/>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{h.name}</div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{h.role}</div>
            </div>
            <button onClick={() => nav.toast(`Открываем чат с ${h.name}`)} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="send" size={14}/> Написать</button>
          </div>
        ))}
      </div>
    </div>
  );
};

const PlayerPayCard = ({ amount = 15 }) => {
  const nav = useNav();
  const [st, setSt] = React.useState('due');
  if (st === 'paid') return null;
  const claim = () => nav.sheet({
    title:'Как вы оплатили?',
    items:[
      { icon:'card', label:'Перевёл на карту', onClick: () => { setSt('claimed'); nav.toast('Отметка отправлена · организатор подтвердит перевод'); } },
      { icon:'wallet', label:'Отдам наличными на игре', onClick: () => { setSt('claimed'); nav.toast('Отметка отправлена · подтвердят на зале'); } },
    ]
  });
  return (
    <div style={{padding:'12px 16px 0'}}>
      <div className="vt-card" style={{padding:16}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Оплата</div>
          <span className={`vt-chip vt-chip--amber ${st === 'claimed' ? 'vt-chip--dot' : ''}`} style={{fontSize:'var(--fs-2xs)'}}>{st === 'claimed' ? 'ждём подтверждения' : 'не оплачено'}</span>
        </div>
        <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-2xl)', marginTop:8}}>{byn(amount)}</div>
        {st === 'due' && (<>
          <div style={{marginTop:12}}><PayDetails/></div>
          <button onClick={claim} className="vt-btn vt-btn--primary vt-btn--full" style={{marginTop:12}}>Я оплатил</button>
        </>)}
        {st === 'claimed' && (<>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:8, lineHeight:1.45}}>Вы отметили оплату сегодня в 19:24. Организатор или тренер подтвердит её, статус придёт в бот.</div>
          <button onClick={() => { setSt('due'); nav.toast('Отметка об оплате снята'); }} className="vt-btn vt-btn--ghost vt-btn--full" style={{marginTop:10}}>Снять отметку</button>
        </>)}
      </div>
    </div>
  );
};

Object.assign(window, { RoleContext, ROLE_MODES, MODE_LABEL, defaultModeOf, ModeBar, CoachTabBar, CoachToday, CoachSchedule, RosterToday, OrgExpense, PayDetails, EventHosts, PlayerPayCard });
