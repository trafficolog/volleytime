// screens-web.jsx — Web SaaS desktop screens (1280x820)

// Shared web shell with sidebar + topbar
const WebShell = ({ activeNav, title, sub, topRight, children }) => {
  const nav = typeof useNav === 'function' ? useNav() : null;
  const handleNav = (k) => {
    if (!nav) return;
    const map = { dashboard:'dashboard', events:'events', members:'members', ledger:'ledger', billing:'billing', settings:'settings', contributions:'contributions', reports:'reports', plans:'plans' };
    if (map[k]) nav.reset(map[k]);
    else if (k === 'reports') nav.reset('reports');
  };
  const orgSwitch = () => nav && nav.popover({
    anchor: document.getElementById('vt-org-switch-anchor'),
    align: 'left',
    items: [
      { icon:'check', label:'VolleyTime Минск', sub:'OWNER · 14 игр.' },
      { icon:'building', label:'СпайкКлуб', sub:'organizer' },
      '---',
      { icon:'plus', label:'Создать новую', onClick: () => nav.toast('Создание организации') },
    ]
  });
  const [s] = useGroupSettings();
  const subsEnabled = s.subsOn;
  const nav_ = [
    ['dashboard', 'home', 'Обзор'],
    ['events', 'calendar', 'События'],
    ['members', 'users', 'Игроки'],
    ...(subsEnabled ? [['plans', 'ticket', 'Абонементы']] : []),
    ['ledger', 'wallet', 'Касса'],
    ['contributions', 'gift', 'Сборы'],
    ['reports', 'chart', 'Отчёты'],
  ];
  const platform = [
    ['billing', 'card', 'Credits & биллинг'],
    ['settings', 'settings', 'Настройки'],
  ];
  return (
    <div className="vt-web">
      <aside className="vt-web__nav">
        <div className="vt-stripe" style={{padding:'2px 10px 18px', fontSize:'var(--fs-xl)'}}>
          <span className="vt-ball" style={{fontSize:'var(--fs-lg)'}}/>
          <span>Volley<span style={{color:'var(--vt-flame-ink)'}}>Time</span></span>
        </div>
        <button id="vt-org-switch-anchor" onClick={orgSwitch} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 10px', margin:'0 -4px 4px', borderRadius:'var(--r-sm)', cursor:'pointer', textAlign:'left', width:'100%'}}>
          <span className="vt-avi vt-avi--brand" style={{width:28, height:28, fontSize:'var(--fs-2xs)'}}></span>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontWeight:600, fontSize:'var(--fs-sm)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>VolleyTime Минск</div>
            <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>Owner · 14 игр.</div>
          </div>
          <Icon name="chevron-d" size={14} stroke="var(--vt-mute)"/>
        </button>

        <div className="navhead">Организация</div>
        {nav_.map(([k, ic, l]) => (
          <a key={k} onClick={() => handleNav(k)} data-active={activeNav === k}>
            <span className="icowrap" style={{display:'flex'}}><Icon name={ic} size={16}/></span>
            <span>{l}</span>
          </a>
        ))}

        <div className="navhead">Платформа</div>
        {platform.map(([k, ic, l]) => (
          <a key={k} onClick={() => handleNav(k)} data-active={activeNav === k}>
            <span className="icowrap" style={{display:'flex'}}><Icon name={ic} size={16}/></span>
            <span>{l}</span>
          </a>
        ))}

        <div style={{marginTop:'auto', paddingTop:18}}>
          <div className="vt-card vt-card--hero" style={{padding:'12px 14px'}}>
            <div style={{fontSize:'var(--fs-xs)', opacity:0.7}}>Credits</div>
            <div style={{display:'flex', alignItems:'baseline', gap:6, marginTop:2}}>
              <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-lg)'}}>32</div>
              <div style={{fontSize:'var(--fs-2xs)', opacity:0.7}}>осталось</div>
            </div>
            <button onClick={() => nav && nav.reset('billing')} className="vt-btn vt-btn--sm" style={{width:'100%', marginTop:8, background:'var(--vt-orange)', color:'var(--vt-on-hero)'}}>Пополнить</button>
          </div>
        </div>
      </aside>

      <main className="vt-web__main">
        <div className="vt-web__topbar">
          <div style={{flexShrink:0, minWidth:0, marginRight:16}}>
            <h2 style={{fontSize:'var(--fs-xl)', whiteSpace:'nowrap'}}>{title}</h2>
            {sub && <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{sub}</div>}
          </div>
          <div style={{display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0, justifyContent:'flex-end'}}>
            {topRight}
            <div className="vt-field" style={{width:260, padding:'8px 12px', display:'flex', alignItems:'center', gap:8, color:'var(--vt-mute)', fontSize:'var(--fs-sm)'}}>
              <Icon name="search" size={14}/> <span>Поиск или ⌘K</span>
            </div>
            <button onClick={() => nav && nav.reset('notifications')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'8px 10px', position:'relative'}}><Icon name="bell" size={16}/><span style={{position:'absolute', top:6, right:8, width:6, height:6, borderRadius:'var(--r-pill)', background:'var(--vt-flame)'}}/></button>
            <Avi size="sm" name="Иван П." init="ИП" tag="ink"/>
          </div>
        </div>
        <div style={{padding:'24px 28px'}}>{children}</div>
      </main>
    </div>
  );
};

// ---------- WebDashboard ----------
const WebDashboard = () => {
  const nav = useNav();
  const [s] = useGroupSettings();
  const subsEnabled = s.subsOn;
  const pending = PENDING_PAYMENTS.filter(p => subsEnabled || !p.sub);
  return (
  <WebShell
    activeNav="dashboard"
    title="Обзор · май 2026"
    sub="14 активных игроков · 12 событий за месяц"
    topRight={<button onClick={() => nav.push('event-create')} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6}}><Icon name="plus" size={14}/> Новая тренировка</button>}
  >
    {/* KPI row */}
    <div style={{display:'grid', gridTemplateColumns:'minmax(0,1.35fr) minmax(0,1fr) minmax(0,1fr)', gridTemplateRows:'auto auto', gap:16}}>
      {[
        { label:'Касса', val:'+248,50 Br', delta:'+82,50 за неделю', tint:'flame', big:true },
        { label:'Событий за месяц', val:'12', delta:'+3 к апрелю' },
        { label:'Бронирований', val:'168', delta:'87% заполнение' },
        ...(subsEnabled ? [{ label:'Активные абонементы', val:'9', delta:'2 истекают на неделе', tint:'amber' }] : []),
      ].map((k, i) => (
        <div key={i} className={"vt-card" + (k.big ? " vt-card--hero" : "")} style={{
          padding: k.big ? 24 : 18, position:'relative', overflow:'hidden', display:'flex', flexDirection:'column',
          gridRow: k.big ? 'span 2' : undefined,
          gridColumn: k.big ? undefined : (subsEnabled ? (i === 3 ? 'span 2' : undefined) : 'span 2'),
          background: k.big ? undefined : ['var(--vt-orange-soft)','var(--vt-blue-soft-tile)','var(--vt-bone)'][(i - 1) % 3],
        }}>
          {k.big && <div style={{position:'absolute', right:-50, top:-50, width:180, height:180, borderRadius:'50%', background:'var(--vt-orange)'}}/>}
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative'}}>
            <div className="vt-cap" style={{color: k.big?'var(--vt-on-hero-3)':'var(--vt-mute-2)'}}>{k.label}</div>
          </div>
          <div className="vt-mono" style={{fontWeight:700, fontSize: k.big ? 'var(--fs-6xl)' : 'var(--fs-4xl)', lineHeight:1, marginTop: k.big ? 'auto' : 14, paddingTop: k.big ? 28 : 0, position:'relative'}}>{k.val}</div>
          <div style={{fontSize:'var(--fs-sm)', color: k.big?'var(--vt-on-hero-2)':'var(--vt-ink-3)', marginTop:8, position:'relative'}}>{k.delta}</div>
        </div>
      ))}
    </div>

    {/* Main grid */}
    <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:16, marginTop:18}}>
      {/* Upcoming events */}
      <div className="vt-card" style={{padding:18}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
          <h3 style={{fontSize:'var(--fs-md)'}}>Ближайшие события</h3>
          <button onClick={() => nav.reset('events')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{fontSize:'var(--fs-xs)'}}>Все события <Icon name="chevron-r" size={12}/></button>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:0, marginTop:14}}>
          {VT_EVENTS.filter(e => !e.past).slice(0, 4).map((e,i, arr) => (
            <div key={i} style={{display:'flex', alignItems:'center', gap:14, padding:'12px 0', borderBottom: i<arr.length-1?'1px solid var(--vt-bone-2)':'none'}}>
              <div style={{textAlign:'center', minWidth:42, padding:'6px 0', borderRadius:'var(--r-sm)', background:'var(--vt-bone-2)'}}>
                <div className="vt-cap" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{e.dow}</div>
                <div style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-lg)', lineHeight:1, marginTop:2}}>{e.dnum}</div>
              </div>
              <div style={{flex:1}}>
                <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between'}}>
                  <div style={{fontFamily:'var(--f-display)', fontWeight:600, fontSize:'var(--fs-md)'}}>{e.m}</div>
                  <span className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{e.main}</span>
                </div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{e.t} · {e.venue}</div>
                <div className="vt-meter" style={{marginTop:8}}><i style={{width:`${e.meter}%`, background: meterTint(e.meter)}}/></div>
              </div>
              <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, minWidth:130}}>
                {e.pending > 0 && <span className="vt-chip vt-chip--amber vt-chip--dot">{`${e.pending} ${e.pending % 10 === 1 && e.pending % 100 !== 11 ? 'ждёт' : 'ждут'} оплаты`}</span>}
                {e.wait && <span className="vt-chip vt-chip--state">{`очередь · ${e.wait}`}</span>}
                {!e.pending && !e.wait && <span className="vt-chip vt-chip--grass vt-chip--dot">все оплатили</span>}
                {e.priceMode === 'split' && <span className="vt-chip vt-chip--state" style={{fontSize:'var(--fs-2xs)'}}>≈ {byn(evPrice(e))} за место</span>}
                <button onClick={() => nav.push('event-detail', { event: e })} className="vt-btn vt-btn--ghost vt-btn--sm" style={{fontSize:'var(--fs-2xs)'}}>Открыть <Icon name="chevron-r" size={11}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right col: pending payments + cash chart */}
      <div style={{display:'flex', flexDirection:'column', gap:16}}>
        <div className="vt-card" style={{padding:18}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
            <h3 style={{fontSize:'var(--fs-md)'}}>Платежи <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-amber)', fontWeight:600, marginLeft:6}}>{pending.length} ждут</span></h3>
            <button className="vt-btn vt-btn--ghost vt-btn--sm" style={{fontSize:'var(--fs-xs)'}}>Все</button>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:14}}>
            {pending.map((p, i) => {
              const due = p.amount * (p.seats || 1);
              return (
              <div key={p.id} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:'var(--r-sm)', background:'var(--vt-bone-2)'}}>
                <Avi name={p.name} init={p.init} tag={p.tag} size="sm"/>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{p.name}</div>
                  <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{p.event}{p.seats > 1 ? ' · ' + p.seats + ' места' : ''}</div>
                </div>
                <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-sm)'}}>+{byn(due)}</div>
                <button onClick={() => nav.toast('Подтверждено · +' + byn(due) + ' в кассу')} className="vt-btn vt-btn--primary vt-btn--sm" style={{padding:'6px 10px', fontSize:'var(--fs-2xs)'}}>✓</button>
              </div>
              );
            })}
          </div>
        </div>

        {/* Mini chart */}
        <div className="vt-card" style={{padding:18}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
            <h3 style={{fontSize:'var(--fs-md)'}}>Касса за 4 недели</h3>
            <span className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-grass)', fontWeight:600}}>+82,50 Br</span>
          </div>
          <div style={{display:'flex', gap:8, alignItems:'flex-end', height:90, marginTop:18}}>
            {[42, 68, 51, 88].map((h, i) => (
              <div key={i} style={{flex:1, height:'100%', display:'flex', flexDirection:'column', justifyContent:'flex-end', alignItems:'center', gap:6}}>
                <div style={{width:'100%', flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end'}}>
                  <div style={{width:'100%', height:`${h}%`, flexShrink:0, background: i===3?'var(--vt-flame)':'var(--vt-stroke-2)', borderRadius:'var(--r-xs)'}}/>
                </div>
                <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', flexShrink:0}}>Н{i+1}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </WebShell>
  );
};

// ---------- WebEvents ----------
const WebEvents = () => {
  const nav = useNav();
  const [view, setView] = React.useState('list');
  const events = VT_EVENTS;
  return (
  <WebShell
    activeNav="events"
    title="События"
    sub="Все тренировки и игры организации"
    topRight={
      <>
        <div style={{display:'flex', gap:2, padding:2, background:'var(--vt-bone-2)', borderRadius:'var(--r-sm)'}}>
          {[['list','Список'],['calendar','Календарь']].map(([v,l]) => (
            <button key={v} onClick={() => setView(v)} className="vt-btn vt-btn--sm" style={{background:view===v?'var(--vt-paper)':'transparent', boxShadow:view===v?'var(--vt-seg-shadow)':'none', fontWeight:600}}>{l}</button>
          ))}
        </div>
        <button onClick={() => nav.push('event-create')} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6}}><Icon name="plus" size={14}/> Создать</button>
      </>
    }
  >
    {/* Filter strip */}
    <div style={{display:'flex', gap:8, marginBottom:14, alignItems:'center'}}>
      {['Все','Открыта запись','Прошедшие','Отменённые'].map((t,i) => (
        <button key={t} className="vt-btn vt-btn--sm" style={{
          background: i===0?'var(--vt-ink)':'var(--vt-ctl)',
          color: i===0?'var(--vt-paper)':'var(--vt-ink)',
          fontWeight:600
        }}>{t} {i===1 && <span style={{opacity:0.6, marginLeft:4}}>3</span>}</button>
      ))}
      <div style={{marginLeft:'auto', display:'flex', gap:6}}>
        <button className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="filter" size={14}/> Фильтры</button>
        <button onClick={() => nav.toast('CSV событий скачан')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="arrow-d" size={14}/> Экспорт</button>
      </div>
    </div>

    {view === 'calendar' ? (
      <WebEventsCalendar events={events} nav={nav}/>
    ) : (
    <>
    {/* Table */}
    <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
      <div style={{display:'grid', gridTemplateColumns:'90px 1.6fr 160px 140px 140px 110px 40px', padding:'10px 16px', borderBottom:'1px solid var(--vt-bone-2)'}}>
        {['Дата','Тренировка','Зал','Состав','Оплаты','Статус',''].map((h,i) => (
          <div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>
        ))}
      </div>
      {events.map((e,i,arr) => (
        <div key={i} onClick={() => nav.push('event-detail', { event: e })} style={{display:'grid', gridTemplateColumns:'90px 1.6fr 160px 140px 140px 110px 40px', padding:'12px 16px', borderBottom:i<arr.length-1?'1px solid var(--vt-bone-2)':'none', alignItems:'center', filter: e.past ? 'grayscale(1)' : 'none', cursor:'pointer'}}
          onMouseEnter={ev => ev.currentTarget.style.background='var(--vt-bone-2)'}
          onMouseLeave={ev => ev.currentTarget.style.background='transparent'}
        >
          <div>
            <div style={{fontSize:'var(--fs-xs)', fontWeight:600}}>{e.dow} {e.dnum}</div>
            <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{e.month} · {e.t}</div>
          </div>
          <div>
            <div style={{fontWeight:600, fontSize:'var(--fs-base)'}}>{e.m}</div>
            {e.priceMode === 'split' && <span className="vt-chip vt-chip--flame" style={{fontSize:'var(--fs-2xs)', marginTop:4}}>делёж суммы</span>}
          </div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{e.venue}</div>
          <div>
            <div className="vt-mono" style={{fontSize:'var(--fs-xs)', fontWeight:600}}>{e.main}</div>
            <div className="vt-meter" style={{marginTop:4, width:90}}><i style={{width:`${e.meter}%`, background: meterTint(e.meter)}}/></div>
          </div>
          <div>
            <div className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600}}>
              {e.paid} {e.pending > 0 && <span style={{color:'var(--vt-amber)', fontSize:'var(--fs-2xs)', marginLeft:4}}>+{e.pending}</span>}
            </div>
            {e.priceMode === 'split' && (
              <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2}}>
                {(e.past || e.closed) ? '' : '≈ '}{byn(e.total/e.joinedCount)} за место
              </div>
            )}
          </div>
          <div>
            {e.okAll ? <span className="vt-chip vt-chip--grass" style={{fontSize:'var(--fs-2xs)'}}>OK</span>
              : e.wait ? <span className="vt-chip vt-chip--rose" style={{fontSize:'var(--fs-2xs)'}}>{e.st}</span>
              : <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>{e.st}</span>}
          </div>
          <div onClick={ev => ev.stopPropagation()}><ActionMore mode="popover" align="right" items={[
            { icon:'globe', label:'Открыть событие', onClick: () => nav.push('event-detail', { event: e }) },
            { icon:'copy', label:'Дублировать', onClick: () => nav.toast('Событие дублировано') },
            { icon:'send', label:'В чат группы', onClick: () => nav.toast('Опубликовано в чате') },
            '---',
            { icon:'close', tone:'danger', label:'Отменить событие', onClick: () => nav.alert({
              title:'Отменить событие?', body:'Все записи будут отменены. Credit вернётся, если запись не открывалась.',
              confirm:'Отменить', danger:true,
              onConfirm: () => nav.toast(`«${e.m}» отменено`)
            })},
          ]}/></div>
        </div>
      ))}
    </div>

    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>
      <span>Показано 6 из 24</span>
      <div style={{display:'flex', gap:4}}>
        <button className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'4px 8px'}}><Icon name="chevron-l" size={14}/></button>
        <button className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'4px 8px'}}><Icon name="chevron-r" size={14}/></button>
      </div>
    </div>
    </>
    )}
  </WebShell>
  );
};

// Calendar grid view for WebEvents
const WebEventsCalendar = ({ events, nav }) => {
  const dows = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  // Group events into arrays per day (a day can hold several)
  const byDay = {};
  events.forEach(e => {
    const month = e.month === 'июня' ? 6 : 5;
    const key = `${month}-${e.dnum}`;
    (byDay[key] = byDay[key] || []).push(e);
  });
  // sort each day's events by time
  Object.values(byDay).forEach(list => list.sort((a,b) => a.t.localeCompare(b.t)));

  const cells = [];
  for (let d=27; d<=30; d++) cells.push({ m:4, d });
  for (let d=1; d<=31; d++) cells.push({ m:5, d });
  for (let d=1; d<=7; d++) cells.push({ m:6, d });
  const tint = (e) => e.past ? 'var(--vt-stroke-2)' : meterTint(e.meter);

  const monthName = (m) => m===4?'апр':m===6?'июн':'мая';
  // Open a day with multiple events → action sheet to pick which one
  const openDay = (list, c) => {
    if (list.length === 1) { nav.push('event-detail', { event: list[0] }); return; }
    nav.sheet({
      title: `${c.d} ${monthName(c.m)} · ${list.length} события`,
      sub: 'Выберите тренировку',
      items: list.map(e => ({
        icon: 'calendar',
        label: `${e.t} · ${e.m}`,
        sub: e.main,
        onClick: () => nav.push('event-detail', { event: e }),
      })),
    });
  };

  const EventPill = (e, onClick) => (
    <button key={e.m + e.t} onClick={(ev) => { ev.stopPropagation(); onClick(); }} style={{
      display:'block', width:'100%', textAlign:'left', cursor:'pointer',
      background: e.past?'var(--vt-ctl-track)':'var(--vt-accent-soft)', borderRadius:'var(--r-sm)', padding:'4px 6px',
      borderLeft:`2px solid ${tint(e)}`,
    }}>
      <div style={{fontSize:'var(--fs-2xs)', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{e.t} {e.m}</div>
      <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{e.main}{e.pending?` · +${e.pending}`:''}</div>
    </button>
  );

  return (
    <div className="vt-card" style={{padding:18}}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
        <h3 style={{fontSize:'var(--fs-md)'}}>Май 2026</h3>
        <div style={{display:'flex', gap:4}}>
          <button onClick={() => nav.toast('← Апрель')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'4px 8px'}}><Icon name="chevron-l" size={14}/></button>
          <button onClick={() => nav.toast('Сегодня')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{fontSize:'var(--fs-xs)'}}>Сегодня</button>
          <button onClick={() => nav.toast('Июнь →')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'4px 8px'}}><Icon name="chevron-r" size={14}/></button>
        </div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:6}}>
        {dows.map(d => <div key={d} className="vt-cap" style={{color:'var(--vt-mute-2)', textAlign:'center', paddingBottom:4}}>{d}</div>)}
        {cells.map((c,i) => {
          const list = byDay[`${c.m}-${c.d}`] || [];
          const dim = c.m !== 5;
          const shown = list.slice(0, 2);
          const extra = list.length - shown.length;
          return (
            <div key={i} onClick={() => list.length && openDay(list, c)} style={{
              minHeight:84, borderRadius:'var(--r-sm)', padding:'6px 8px',
              background: dim ? 'transparent' : 'var(--vt-paper)',
              opacity: dim ? 0.4 : 1,
              cursor: list.length ? 'pointer' : 'default',
              display:'flex', flexDirection:'column', gap:4,
            }}
            onMouseEnter={ev => { if(list.length) ev.currentTarget.style.borderColor='var(--vt-ink)'; }}
            onMouseLeave={ev => { ev.currentTarget.style.borderColor='var(--vt-stroke)'; }}
            >
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', fontWeight:600}}>{c.d}</span>
                {list.length > 1 && <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', fontWeight:700, color:'var(--vt-flame-ink)', background:'var(--vt-accent-soft)', borderRadius:'var(--r-pill)', padding:'0 6px'}}>{list.length}</span>}
              </div>
              {shown.map(e => EventPill(e, () => nav.push('event-detail', { event: e })))}
              {extra > 0 && (
                <button onClick={(ev) => { ev.stopPropagation(); openDay(list, c); }} style={{textAlign:'left', cursor:'pointer', fontSize:'var(--fs-2xs)', fontWeight:600, color:'var(--vt-mute-2)', padding:'2px 6px'}}>
                  +{extra} ещё
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------- WebEventDetail ----------
const WebEventDetail = () => {
  const nav = useNav();
  const e = nav.data.event || VT_EVENTS[0];
  const isSplit = e.priceMode === 'split';
  const isPast = !!e.past;
  const isClosed = !!e.closed;
  const headCount = e.joinedCount || (e.main ? parseInt(e.main, 10) : 12);
  const capacity = e.main ? parseInt(e.main.split('/')[1], 10) : 14;
  const perSeat = evPrice(e);
  const main = buildRoster(headCount, { isSplit });
  const waitlist = isPast ? [] : PEOPLE.slice(headCount, headCount + 2);
  const paidSeats = main.filter(p => p.pay === 'paid').reduce((s, p) => s + p.seats, 0);
  const pendingSeats = main.filter(p => p.pay === 'pending').reduce((s, p) => s + p.seats, 0);
  const subsSeats = main.filter(p => p.pay === 'subs').reduce((s, p) => s + p.seats, 0);
  return (
    <WebShell
      activeNav="events"
      title={`${e.m} · ${evDate(e)}`}
      sub={`${e.t} · ${e.venue} · ${isSplit ? `${byn(e.total)} на всех` : byn(perSeat)}`}
      topRight={
        <>
          <button onClick={() => nav.toast('Событие дублировано · 4 июня 20:00')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="copy" size={14}/> Дублировать</button>
          <button onClick={() => nav.toast('Опубликовано в чате группы')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="send" size={14}/> В чат</button>
          <button onClick={() => nav.alert({
            title:'Отменить событие?', body:'Все записи будут отменены. Если запись ещё не открывалась, credit вернётся.',
            confirm:'Отменить событие', danger:true,
            onConfirm: () => { nav.reset('events'); setTimeout(() => nav.toast('Событие отменено · +1 credit'), 80); }
          })} className="vt-btn vt-btn--ghost vt-btn--sm" style={{color:'var(--vt-rose)'}}>Отменить</button>
        </>
      }
    >
      <div style={{display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:16}}>
        {/* Roster */}
        <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
          <div style={{padding:'14px 18px', borderBottom:'1px solid var(--vt-bone-2)', display:'flex', alignItems:'center', gap:14}}>
            <h3 style={{fontSize:'var(--fs-md)'}}>Состав</h3>
            <div style={{display:'flex', alignItems:'center', gap:10, marginLeft:10}}>
              <div className="vt-meter" style={{width:120}}><i style={{width:`${e.meter}%`, background: meterTint(e.meter)}}/></div>
              <span className="vt-mono" style={{fontSize:'var(--fs-xs)', fontWeight:600}}>{headCount} / {capacity} мест</span>
              {main.length !== headCount && <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>· {main.length} игроков</span>}
            </div>
            <button className="vt-btn vt-btn--ghost vt-btn--sm" style={{marginLeft:'auto'}}><Icon name="plus" size={14}/> Добавить</button>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr'}}>
            {main.map((p, i) => (
              <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderBottom: i<10 ? '1px solid var(--vt-bone-2)' : 'none', borderRight: i%2===0?'1px solid var(--vt-bone-2)':'none'}}>
                <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', width:16}}>{i+1}</span>
                <Avi name={p.name} init={p.init} tag={p.tag} size="sm"/>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:'var(--fs-sm)', fontWeight:500, display:'flex', alignItems:'center', gap:6}}>
                    {p.name}
                    {p.seats > 1 && <span className="vt-chip vt-chip--flame" style={{fontSize:'var(--fs-2xs)', padding:'2px 6px'}}>+{p.seats-1}</span>}
                  </div>
                  <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>
                    {p.seats > 1 ? `${p.seats} места · ${byn(perSeat * p.seats)}` : `уровень ${p.level}`}
                  </div>
                </div>
                {p.pay === 'pending'
                  ? <span className="vt-chip vt-chip--amber" style={{fontSize:'var(--fs-2xs)'}}>ждёт оплаты</span>
                  : p.pay === 'subs'
                  ? <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>абон.</span>
                  : <Icon name="check" size={14} stroke="var(--vt-grass)" sw={2.2}/>}
              </div>
            ))}
          </div>
          <div style={{padding:'12px 16px', background:'var(--vt-bone-2)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{isPast ? 'Состав зафиксирован' : `Лист ожидания · ${waitlist.length}`}</div>
            <div style={{display:'flex', gap:12, alignItems:'center'}}>
              {waitlist.map((p, i) => (
                <div key={i} style={{display:'flex', alignItems:'center', gap:6, fontSize:'var(--fs-sm)'}}>
                  <Avi name={p.name} init={p.init} tag={p.tag} size="sm"/>
                  <span>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side info */}
        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          {isSplit && !isPast && !isClosed && (
            <div className="vt-card vt-card--cool" style={{padding:18}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                <h3 style={{fontSize:'var(--fs-base)'}}>Прогноз цены</h3>
                <span className="vt-chip vt-chip--amber" style={{fontSize:'var(--fs-2xs)'}}>уточнится</span>
              </div>
              <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:10}}>
                <span className="vt-mono" style={{fontSize:'var(--fs-4xl)', fontWeight:700}}>≈ {byn(perSeat)}</span>
                <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>с места сейчас</span>
              </div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4}}>{byn(e.total)} ÷ {headCount} мест</div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6, marginTop:12}}>
                {[headCount, Math.min(capacity, headCount + 2), Math.min(capacity, headCount + 4), capacity].map((n, i) => (
                  <div key={i} style={{padding:'8px 10px', borderRadius:'var(--r-field)', background: i === 0 ? 'var(--vt-inverse-bg)' : 'var(--vt-raised)', color: i === 0 ? 'var(--vt-inverse-fg)' : 'var(--vt-ink)'}}>
                    <div style={{fontSize:'var(--fs-2xs)', color: i === 0 ? 'color-mix(in oklab, var(--vt-inverse-fg) 70%, transparent)' : 'var(--vt-mute-2)'}}>{n} мест</div>
                    <div className="vt-mono" style={{fontSize:'var(--fs-md)', fontWeight:700, marginTop:4}}>{byn(e.total / n)}</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:12, lineHeight:1.45}}>
                Сумма распределится автоматически при закрытии записи. Игроки получат точную цифру в Telegram.
              </div>
              <button onClick={() => nav.alert({
                title:'Закрыть запись и распределить?',
                body:`${byn(e.total)} поделится на ${headCount} мест — по ${byn(perSeat)}. Новые записи станут недоступны.`,
                confirm:'Распределить',
                onConfirm: () => nav.toast(`Распределено · ${byn(perSeat)} с места · уведомления отправлены`)
              })} className="vt-btn vt-btn--ink vt-btn--sm" style={{marginTop:12, width:'100%'}}>Закрыть запись и распределить</button>
            </div>
          )}

          {isSplit && isClosed && (
            <div className="vt-card vt-card--hero" style={{padding:18, position:'relative', overflow:'hidden'}}>
              <div style={{position:'absolute', right:-36, top:-36, width:120, height:120, borderRadius:'50%', background:'var(--vt-orange)', opacity:.9}}/>
              <div style={{position:'relative'}}>
                <div className="vt-cap" style={{opacity:.72}}>Сумма распределена</div>
                <div className="vt-mono" style={{fontSize:'var(--fs-5xl)', fontWeight:700, marginTop:10}}>{byn(perSeat)}</div>
                <div style={{fontSize:'var(--fs-sm)', opacity:.85, marginTop:4}}>с места · {byn(e.total)} ÷ {headCount} мест</div>
                <div style={{height:6, borderRadius:'var(--r-pill)', background:'var(--vt-on-hero-line)', marginTop:14, overflow:'hidden'}}>
                  <div style={{width:`${Math.round(paidSeats / headCount * 100)}%`, height:'100%', background:'var(--vt-on-hero)', borderRadius:'var(--r-pill)'}}/>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:'var(--fs-xs)', marginTop:8, opacity:.9}}>
                  <span>Собрано {byn(perSeat * paidSeats)}</span>
                  <span>ждут {headCount - paidSeats}</span>
                </div>
                <button onClick={() => nav.toast(`Напоминание отправлено · ${headCount - paidSeats} игрокам`)} className="vt-btn vt-btn--sm" style={{marginTop:14, width:'100%', background:'var(--vt-orange)', color:'var(--vt-on-hero)'}}>
                  Напомнить неоплатившим
                </button>
              </div>
            </div>
          )}

          {/* Settings card */}
          <div className="vt-card" style={{padding:16}}>
            <h3 style={{fontSize:'var(--fs-base)'}}>Параметры</h3>
            <div style={{display:'grid', gridTemplateColumns:'auto 1fr', columnGap:14, rowGap:10, marginTop:12, fontSize:'var(--fs-sm)'}}>
              <span style={{color:'var(--vt-mute-2)'}}>Тип оплаты</span>
              <span>{isSplit ? 'Делим общую сумму' : 'Фиксированная цена'}</span>
              {isSplit ? (
                <>
                  <span style={{color:'var(--vt-mute-2)'}}>Сумма к сбору</span>
                  <span className="vt-mono" style={{fontWeight:600}}>{byn(e.total)}</span>
                  <span style={{color:'var(--vt-mute-2)'}}>За место</span>
                  <span className="vt-mono" style={{fontWeight:600}}>
                    {(isPast || isClosed) ? byn(perSeat) : `≈ ${byn(perSeat)}`}
                    {!(isPast || isClosed) && <span style={{fontWeight:400, color:'var(--vt-mute-2)', fontFamily:'var(--f-body)', fontSize:'var(--fs-xs)'}}> · уточнится</span>}
                  </span>
                </>
              ) : (
                <>
                  <span style={{color:'var(--vt-mute-2)'}}>Цена за место</span>
                  <span className="vt-mono" style={{fontWeight:600}}>{byn(perSeat)}</span>
                </>
              )}
              <span style={{color:'var(--vt-mute-2)'}}>Запись закроется</span><span>{isPast || isClosed ? 'закрыта' : '27 мая 20:00 (за 24 ч)'}</span>
              <span style={{color:'var(--vt-mute-2)'}}>Состав</span><span>{capacity} мест{isPast ? '' : ' + лист ожидания'}</span>
              <span style={{color:'var(--vt-mute-2)'}}>Уровень</span><span>B / A</span>
              <span style={{color:'var(--vt-mute-2)'}}>Владелец</span><span>Иван Петренко</span>
              <span style={{color:'var(--vt-mute-2)'}}>Credit</span><span>−1 (списан 22 мая)</span>
            </div>
            <button className="vt-btn vt-btn--ghost vt-btn--sm" style={{marginTop:14, width:'100%'}}><Icon name="edit" size={13}/> Изменить</button>
          </div>

          {/* Payments summary */}
          <div className="vt-card" style={{padding:16}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
              <h3 style={{fontSize:'var(--fs-base)'}}>Оплаты</h3>
              <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{paidSeats + subsSeats} / {headCount} мест</span>
            </div>
            <div style={{display:'flex', gap:4, marginTop:10}}>
              {Array.from({length: headCount}).map((_, i) => (
                <span key={i} style={{flex:1, height:14, borderRadius:'var(--r-xs)',
                  background: i < paidSeats ? 'var(--vt-grass)' :
                              i < paidSeats + subsSeats ? 'var(--vt-grass-soft)' :
                              'var(--vt-amber)'
                }}/>
              ))}
            </div>
            <div style={{display:'flex', gap:14, fontSize:'var(--fs-xs)', marginTop:10, color:'var(--vt-mute-2)'}}>
              <span style={{display:'flex', alignItems:'center', gap:4}}><span style={{width:8,height:8,background:'var(--vt-grass)',borderRadius:'var(--r-xs)'}}/> Оплачено {paidSeats}</span>
              {subsSeats > 0 && <span style={{display:'flex', alignItems:'center', gap:4}}><span style={{width:8,height:8,background:'var(--vt-grass-soft)',borderRadius:'var(--r-xs)'}}/> Абон. {subsSeats}</span>}
              <span style={{display:'flex', alignItems:'center', gap:4}}><span style={{width:8,height:8,background:'var(--vt-amber)',borderRadius:'var(--r-xs)'}}/> Ждут {pendingSeats}</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="vt-card" style={{padding:16}}>
            <h3 style={{fontSize:'var(--fs-base)'}}>Журнал</h3>
            <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:12, fontSize:'var(--fs-xs)'}}>
              {[
                ['22 мая 14:02', 'Иван Петренко создал событие'],
                ['22 мая 16:30', isSplit ? 'Артём записался' : 'Артём записался · с абонемента'],
                ['23 мая 10:11', 'Маша записалась · pending'],
                ['Сегодня 14:22', 'Никита оплатил наличными'],
              ].map(([t, e], i) => (
                <div key={i} style={{display:'flex', gap:10, alignItems:'flex-start'}}>
                  <span style={{width:7, height:7, borderRadius:'var(--r-pill)', background:'var(--vt-stroke-2)', marginTop:6, flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{t}</div>
                    <div style={{marginTop:2}}>{e}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </WebShell>
  );
};

// ---------- WebMembers ----------
const WebMembers = () => {
  const nav = useNav();
  return (
  <WebShell
    activeNav="members"
    title="Игроки"
    sub="14 активных · 2 на модерации · 1 заблокирован"
    topRight={
      <>
        <button onClick={() => nav.toast('Invite-link скопирован: t.me/volleytime_bot?start=org_7gK4nT')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="copy" size={14}/> Скопировать invite-link</button>
        <button onClick={() => nav.sheet({
          title:'Пригласить игрока',
          sub:'Способ приглашения',
          items:[
            { icon:'tg', label:'Через Telegram · invite-link', onClick: () => nav.toast('Ссылка отправлена в Telegram') },
            { icon:'qr', label:'Показать QR-код', onClick: () => nav.toast('QR-код открыт') },
            { icon:'send', label:'Поделиться в чате группы', onClick: () => nav.toast('Опубликовано') },
          ]
        })} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6}}><Icon name="plus" size={14}/> Пригласить</button>
      </>
    }
  >
    {/* Tabs */}
    <div style={{display:'flex', gap:8, marginBottom:14}}>
      {[
        ['Все', 17, true],
        ['Активные', 14, false],
        ['Заявки', 2, false, 'amber'],
        ['Гости', 1, false],
        ['Заблокированы', 1, false],
      ].map(([l, n, act, tint], i) => (
        <button key={l} className="vt-btn vt-btn--sm" style={{
          background: act?'var(--vt-ink)':'var(--vt-ctl)',
          color: act?'var(--vt-paper)':'var(--vt-ink)',
          gap:6, fontWeight:600
        }}>{l} <span style={{
          padding:'0 6px', borderRadius:'var(--r-pill)', fontSize:'var(--fs-2xs)',
          background: tint==='amber'?'var(--vt-amber)':act?'var(--vt-on-hero-fill)':'var(--vt-bone-2)',
          color: tint==='amber'?'var(--vt-ink)':'inherit'
        }}>{n}</span></button>
      ))}
    </div>

    {/* Members table */}
    <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 130px 100px 100px 40px', padding:'10px 18px', borderBottom:'1px solid var(--vt-bone-2)'}}>
        {['Игрок','Телеграм','Роль','Активность','Абонемент','Задолж.',''].map((h,i)=>(
          <div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>
        ))}
      </div>
      {PEOPLE.slice(0, 8).map((p, i) => {
        const role = i === 0 ? 'owner' : i === 1 ? 'organizer' : i === 7 ? 'guest' : 'player';
        const sub = i % 3 === 0 ? '5 / 8' : i % 4 === 0 ? '0 / 4' : '—';
        const debt = i === 5 ? 15 : 0;
        return (
          <div key={i} style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 130px 100px 100px 40px', padding:'12px 18px', borderBottom:i<7?'1px solid var(--vt-bone-2)':'none', alignItems:'center'}}>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <Avi name={p.name} init={p.init} tag={p.tag} size="md"/>
              <div>
                <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>{p.name}</div>
                <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>уровень {p.level} · {['доигр.','связ.','либеро'][i%3]}</div>
              </div>
            </div>
            <div className="vt-mono" style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', display:'flex', alignItems:'center', gap:4}}>
              <Icon name="tg" size={11}/> @{p.name.toLowerCase()}_{i}
            </div>
            <div>
              <span className="vt-chip" style={{
                background: role==='owner'?'var(--vt-ink)':role==='organizer'?'var(--vt-flame)':role==='guest'?'var(--vt-bone-2)':'var(--vt-bone)',
                color: role==='owner'?'var(--vt-paper)':role==='organizer'?'var(--vt-on-hero)':'var(--vt-ink)',
                fontSize:'var(--fs-2xs)'
              }}>{role}</span>
            </div>
            <div style={{fontSize:'var(--fs-xs)'}}>
              <div className="vt-mono" style={{fontWeight:600}}>{[24,18,9,32,6,12,21,4][i]} тр.</div>
              <div style={{color:'var(--vt-mute-2)', fontSize:'var(--fs-2xs)'}}>посл. {['вчера','сегодня','3 дня','6 ч','неделя','вчера','2 дня','5 дн'][i]}</div>
            </div>
            <div className="vt-mono" style={{fontSize:'var(--fs-xs)', fontWeight:600, color: sub === '—' ? 'var(--vt-mute-2)' : 'inherit'}}>{sub}</div>
            <div className="vt-mono" style={{fontSize:'var(--fs-xs)', fontWeight:600, color: debt > 0 ? 'var(--vt-rose)' : 'var(--vt-mute-2)'}}>{debt > 0 ? `−${debt} Br` : '—'}</div>
            <ActionMore mode="popover" align="right" items={[
              { icon:'tg', label:'Открыть профиль', onClick: () => nav.toast(`Профиль · ${p.name}`) },
              { icon:'send', label:'Написать в Telegram', onClick: () => nav.toast(`Открываем чат с ${p.name}`) },
              { icon:'edit', label:'Сменить роль', onClick: () => nav.toast(`Роль ${p.name} → organizer`) },
              { icon:'star', label:'Уровень и амплуа', onClick: () => nav.toast(`Уровень · ${p.level}`) },
              '---',
              { icon:'logout', tone:'danger', label:'Удалить из группы', onClick: () => nav.alert({
                title:`Удалить ${p.name}?`, body:'Игрок не сможет видеть события группы и не получит уведомлений.',
                confirm:'Удалить', danger:true, onConfirm: () => nav.toast(`${p.name} удалён`)
              })},
            ]}/>
          </div>
        );
      })}
    </div>
  </WebShell>
  );
};

// ---------- WebLedger ----------
const WebLedger = () => {
  const nav = useNav();
  return (
  <WebShell
    activeNav="ledger"
    title="Касса"
    sub="май 2026 · полный журнал движений"
    topRight={
      <>
        <button onClick={() => nav.toast('CSV-файл скачан · cash-may-2026.csv')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="arrow-d" size={14}/> Экспорт CSV</button>
        <button onClick={() => nav.sheet({
          title:'Новая запись',
          items:[
            { icon:'arrow-d', label:'Поступление', onClick: () => nav.push('ledger-entry', { kind:'income' }) },
            { icon:'arrow-u', label:'Расход', onClick: () => nav.push('ledger-entry', { kind:'expense' }) },
          ]
        })} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6}}><Icon name="plus" size={14}/> Запись</button>
      </>
    }
  >
    {/* Top stats */}
    <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:14, marginBottom:18}}>
      <div className="vt-card vt-card--hero" style={{padding:18}}>
        <div className="vt-cap" style={{opacity:0.6}}>Баланс кассы</div>
        <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-5xl)', marginTop:8}}>+248,50 Br</div>
        <div style={{fontSize:'var(--fs-xs)', opacity:0.7, marginTop:4}}>обновлено 14:22 сегодня</div>
      </div>
      {[
        ['Поступило', '+318,50 Br', 'grass'],
        ['Списано', '−70,00 Br', 'rose'],
        ['Долги', '15,00 Br', 'amber'],
      ].map(([l,v,c], i) => (
        <div key={i} className="vt-card" style={{padding:18}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{l}</div>
          <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-2xl)', marginTop:8, color: c==='grass'?'var(--vt-grass)':c==='rose'?'var(--vt-rose)':'var(--vt-amber)'}}>{v}</div>
        </div>
      ))}
    </div>

    {/* Filters */}
    <div style={{display:'flex', gap:8, marginBottom:12, alignItems:'center', flexWrap:'wrap'}}>
      <div className="vt-field" style={{width:'auto', padding:'8px 12px', display:'flex', alignItems:'center', gap:8, fontSize:'var(--fs-sm)'}}>
        <Icon name="calendar" size={14}/> май 2026 <Icon name="chevron-d" size={12} style={{opacity:0.5}}/>
      </div>
      {['Все','Поступления','Расходы','По игрокам','По категориям'].map((t,i) => (
        <button key={t} className="vt-btn vt-btn--sm" style={{
          background:i===0?'var(--vt-ink)':'var(--vt-ctl)',
          color:i===0?'var(--vt-paper)':'var(--vt-ink)',
          fontWeight:600
        }}>{t}</button>
      ))}
      <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:8, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>
        <span>Сортировка:</span>
        <span style={{fontWeight:600, color:'var(--vt-ink)'}}>Новые сверху <Icon name="chevron-d" size={11}/></span>
      </div>
    </div>

    {/* Journal */}
    <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
      <div style={{display:'grid', gridTemplateColumns:'130px 1fr 140px 140px 130px 40px', padding:'10px 18px', borderBottom:'1px solid var(--vt-bone-2)'}}>
        {['Дата','Описание','Категория','Способ','Сумма',''].map((h,i)=>(
          <div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>
        ))}
      </div>
      {[
        ['Сегодня 14:22', 'Артём, Никита · Основа 28 мая', 'training_fee', 'cash', 30, 'in'],
        ['Сегодня 12:08', 'Маша · Открытая 30 мая', 'training_fee', 'transfer', 15, 'in'],
        ['Сегодня 09:50', 'Аренда Школа №24', 'rent', 'cash', 42, 'out'],
        ['Вчера 19:31', 'Соня · Абонемент 8 сессий', 'subscription', 'transfer', 110, 'in'],
        ['Вчера 14:11', 'Лера · Открытая 23 мая', 'training_fee', 'cash', 15, 'in'],
        ['24 мая 17:00', 'Мячи Mikasa MVA200 ×2', 'balls', 'transfer', 18, 'out'],
        ['22 мая 10:30', 'Артём · Основа 21 мая', 'training_fee', 'cash', 15, 'in'],
        ['21 мая 17:14', 'Денис · Refund (отмена)', 'refund', 'cash', 15, 'out'],
      ].map(([d, e, cat, m, a, ty], i, arr) => (
        <div key={i} style={{display:'grid', gridTemplateColumns:'130px 1fr 140px 140px 130px 40px', padding:'12px 18px', borderBottom:i<arr.length-1?'1px solid var(--vt-bone-2)':'none', alignItems:'center'}}>
          <div className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{d}</div>
          <div style={{fontSize:'var(--fs-sm)', fontWeight:500}}>{e}</div>
          <div><span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>{catLabel(cat)}</span></div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{m}</div>
          <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-base)', color: ty === 'in' ? 'var(--vt-grass)' : 'var(--vt-rose)'}}>
            {ty === 'in' ? '+' : '−'}{a},00 Br
          </div>
          <ActionMore mode="popover" align="right" items={[
            { icon:'edit', label:'Редактировать запись', onClick: () => nav.toast('Редактирование') },
            { icon:'copy', label:'Дублировать', onClick: () => nav.toast('Дублировано') },
            '---',
            { icon:'trash', tone:'danger', label:'Удалить запись', onClick: () => nav.alert({
              title:'Удалить запись?', body:'Запись будет помечена как удалённая. Баланс кассы пересчитается.',
              confirm:'Удалить', danger:true, onConfirm: () => nav.toast('Запись удалена')
            })},
          ]}/>
        </div>
      ))}
    </div>
  </WebShell>
  );
};

// ---------- WebBilling ----------
const WebBilling = () => {
  const nav = useNav();
  return (
  <WebShell
    activeNav="billing"
    title="Credits & биллинг"
    sub="32 credits на балансе · ≈ 2,5 месяца при текущей частоте"
  >
    <div style={{display:'grid', gridTemplateColumns:'1fr 1.4fr', gap:16}}>
      {/* Left: balance + history */}
      <div style={{display:'flex', flexDirection:'column', gap:14}}>
        <div className="vt-card vt-card--hero" style={{padding:24, position:'relative', overflow:'hidden'}}>
          <div style={{position:'absolute', right:-30, bottom:-30, width:160, height:160, borderRadius:'50%', background:'var(--vt-orange)', opacity:0.28}}/>
          <div className="vt-cap" style={{opacity:0.6}}>Баланс credits</div>
          <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-6xl)', marginTop:6, lineHeight:1}}>32</div>
          <div style={{fontSize:'var(--fs-sm)', opacity:0.7, marginTop:8}}>1 credit = 1 событие. Возврат при отмене до открытия записи.</div>
          <button onClick={() => nav.sheet({
            title:'Купить credits',
            sub:'Выберите пакет',
            items:[
              { icon:'card', label:'10 credits · 50 Br', onClick: () => nav.toast('Платёж создан · 50 Br') },
              { icon:'card', label:'30 credits · 120 Br', onClick: () => nav.toast('Платёж создан · 120 Br') },
              { icon:'card', label:'100 credits · 350 Br', onClick: () => nav.toast('Платёж создан · 350 Br') },
            ]
          })} className="vt-btn vt-btn--full" style={{marginTop:18, background:'var(--vt-orange)', color:'var(--vt-on-hero)'}}>Купить ещё</button>
        </div>

        <div className="vt-card" style={{padding:16}}>
          <h3 style={{fontSize:'var(--fs-base)'}}>Расход за месяц</h3>
          <div style={{display:'flex', alignItems:'flex-end', gap:6, height:80, marginTop:14}}>
            {[2,3,1,4,2,5,3,2].map((h,i) => (
              <div key={i} style={{flex:1, height:`${h*15}%`, background:'var(--vt-flame)', borderRadius:'var(--r-xs)', opacity:0.4 + i*0.07}}/>
            ))}
          </div>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:8}}>
            <span>Н1</span><span>Н2</span><span>Н3</span><span>Н4</span><span>Н5</span><span>Н6</span><span>Н7</span><span>Н8</span>
          </div>
          <div style={{marginTop:14, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>В среднем 12 событий/мес · ~146 Br/мес в credits</div>
        </div>
      </div>

      {/* Right: packages */}
      <div className="vt-card" style={{padding:22}}>
        <h3 style={{fontSize:'var(--fs-md)'}}>Пакеты credits</h3>
        <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>Чем больше пакет, тем дешевле каждый credit. Без подписки, без обязательств.</div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginTop:18}}>
          {[
            { n:10,  price:50, per:5.00, badge:null },
            { n:30,  price:120, per:4.00, badge:'Популярный' },
            { n:100, price:350, per:3.50, badge:'−30%' },
          ].map((p, i) => (
            <div key={i} className="vt-card" style={{
              padding:18,
              borderColor: p.badge==='Популярный'?'var(--vt-ink)':'var(--vt-stroke)',
              background: p.badge==='Популярный'?'var(--vt-bone-2)':'var(--vt-paper)',
              position:'relative'
            }}>
              {p.badge && (
                <span className="vt-chip vt-chip--solid" style={{position:'absolute', top:-10, left:14, fontSize:'var(--fs-2xs)'}}>{p.badge}</span>
              )}
              <div style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-4xl)', lineHeight:1}}>{p.n}</div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4}}>credits</div>
              <div className="vt-divider" style={{margin:'14px 0'}}/>
              <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-xl)'}}>{p.price} Br</div>
              <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2}}>{p.per.toFixed(2).replace('.', ',')} Br / credit</div>
              <button onClick={() => nav.alert({
                title:`Купить «${p.n} credits»?`,
                body:`Будет списано ${p.price} Br. Метод оплаты — наличные / перевод (онлайн-оплата в Phase 12).`,
                confirm:'Подтвердить покупку',
                onConfirm: () => nav.toast(`Покупка создана · +${p.n} credits будут зачислены после подтверждения`)
              })} className="vt-btn vt-btn--ink vt-btn--full vt-btn--sm" style={{marginTop:14}}>Купить</button>
            </div>
          ))}
        </div>

        <h3 style={{fontSize:'var(--fs-base)', marginTop:24}}>История</h3>
        <div className="vt-card" style={{padding:0, marginTop:10, overflow:'hidden', background:'var(--vt-paper)'}}>
          {[
            ['Сегодня', 'Событие «Основа · 28 мая»', '−1', 'spend'],
            ['25 мая', 'Событие «Турнир «Внутри»»', '−1', 'spend'],
            ['22 мая', 'Пакет 30 credits', '+30', 'purchase', '120 Br'],
            ['15 мая', 'Возврат · отменено событие', '+1', 'refund'],
            ['1 мая', 'Demo grant от платформы', '+5', 'grant'],
          ].map(([d,e,v,t,amt], i, arr) => (
            <div key={i} style={{display:'flex', alignItems:'center', gap:14, padding:'10px 14px', borderBottom:i<arr.length-1?'1px solid var(--vt-bone-2)':'none', fontSize:'var(--fs-sm)'}}>
              <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', width:60}}>{d}</div>
              <div style={{flex:1}}>{e}</div>
              <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>{t}</span>
              {amt && <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', width:60, textAlign:'right'}}>{amt}</span>}
              <div className="vt-mono" style={{fontWeight:700, width:40, textAlign:'right', color: v.startsWith('+') ? 'var(--vt-grass)' : 'var(--vt-ink)'}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </WebShell>
  );
};

// Small toggle row used in Settings → Уведомления
const SettingsToggle = ({ t, s, on: initOn, nav }) => {
  const [on, setOn] = React.useState(initOn);
  return (
    <button onClick={() => { setOn(v => !v); nav.toast(on ? `${t} · выкл` : `${t} · вкл`); }}
      style={{display:'flex', alignItems:'center', gap:14, padding:'12px 14px', borderRadius:'var(--r-chip)', background:'var(--vt-ctl-track)', width:'100%', textAlign:'left', cursor:'pointer'}}>
      <div style={{flex:1}}>
        <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>{t}</div>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{s}</div>
      </div>
      <div style={{width:36, height:20, borderRadius:'var(--r-pill)', background:on?'var(--vt-ink)':'var(--vt-stroke-2)', position:'relative', flexShrink:0}}>
        <span style={{position:'absolute', top:2, left: on?18:2, width:16, height:16, borderRadius:'var(--r-pill)', background:'var(--vt-paper)', transition:'left .15s'}}/>
      </div>
    </button>
  );
};

// ---------- WebSettings ----------
const WebSettings = () => {
  const nav = useNav();
  const [activeTab, setActiveTab] = React.useState('Профиль');
  const [pays, setPays] = React.useState({ cash:true, transfer:true, erip:false, bepaid:false });
  const [s, set] = useGroupSettings();
  const cancelAllowed = s.cancelAllowed, cancelCutoff = s.cancelCutoff;
  const setCancelAllowed = (v) => set('cancelAllowed', typeof v === 'function' ? v(s.cancelAllowed) : v);
  const setCancelCutoff = (v) => set('cancelCutoff', v);
  const subsOn = s.subsOn, maxSeats = s.maxSeats, priceMode = s.priceMode;
  const setSubsOn = (v) => set('subsOn', v);
  const setMaxSeats = (fn) => set('maxSeats', typeof fn === 'function' ? fn(s.maxSeats) : fn);
  const setPriceMode = (v) => set('priceMode', v);
  return (
  <WebShell
    activeNav="settings"
    title="Настройки"
    sub="Профиль, расписание, оплаты, бот и интеграции"
  >
    <div style={{display:'grid', gridTemplateColumns:'200px 1fr', gap:24}}>
      {/* Side menu */}
      <div style={{display:'flex', flexDirection:'column', gap:2}}>
        {[
          'Профиль',
          'Расписание по умолчанию',
          'Записи и оплата',
          'Залы и площадки',
          'Способы оплаты',
          'Уведомления',
          'Telegram-бот',
          'Опасная зона',
        ].map((t, i) => {
          const danger = t === 'Опасная зона';
          const act = activeTab === t;
          return (
            <a key={i} onClick={() => setActiveTab(t)} style={{
              padding:'10px 12px', borderRadius:'var(--r-sm)',
              background: act?'var(--vt-bone-2)':'transparent',
              fontSize:'var(--fs-base)', fontWeight: act?600:500,
              color: danger?'var(--vt-rose)':act?'var(--vt-ink)':'var(--vt-ink-3)',
              cursor:'pointer'
            }}>{t}</a>
          );
        })}
      </div>

      {/* Form */}
      <div style={{display:'flex', flexDirection:'column', gap:18}}>
        {activeTab === 'Профиль' && (
        <div className="vt-card" style={{padding:22}}>
          <h3 style={{fontSize:'var(--fs-md)'}}>Профиль организации</h3>
          <div style={{display:'flex', alignItems:'center', gap:18, marginTop:18}}>
            <span className="vt-avi vt-avi--brand" style={{width:64, height:64, fontSize:'var(--fs-xl)'}}></span>
            <div>
              <button className="vt-btn vt-btn--ghost vt-btn--sm">Загрузить логотип</button>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:6}}>PNG или SVG, до 1 МБ. Квадратный.</div>
            </div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:18}}>
            <div>
              <label className="vt-label">Название</label>
              <input className="vt-field" defaultValue="VolleyTime Минск"/>
            </div>
            <div>
              <label className="vt-label">Короткая ссылка</label>
              <div style={{display:'flex'}}>
                <div className="vt-field" style={{width:130, borderRight:'none', borderRadius:'10px 0 0 10px', background:'var(--vt-bone-2)', color:'var(--vt-mute-2)', fontSize:'var(--fs-sm)'}}>volleytime.by/</div>
                <input className="vt-field" defaultValue="vt-minsk" style={{borderRadius:'0 10px 10px 0'}}/>
              </div>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label className="vt-label">Описание</label>
              <textarea className="vt-field" rows={3} defaultValue="Любительская группа в Минске. Тренировки 3 раза в неделю, средний уровень B/A."/>
            </div>
            <div>
              <label className="vt-label">Город</label>
              <input className="vt-field" defaultValue="Минск"/>
            </div>
            <div>
              <label className="vt-label">Часовой пояс</label>
              <input className="vt-field" defaultValue="Europe/Minsk (UTC+3)"/>
            </div>
          </div>
          <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:18}}>
            <button className="vt-btn vt-btn--ghost vt-btn--sm">Отмена</button>
            <button onClick={() => nav.toast('Профиль организации сохранён')} className="vt-btn vt-btn--ink vt-btn--sm">Сохранить</button>
          </div>
        </div>
        )}

        {activeTab === 'Расписание по умолчанию' && (
        <div className="vt-card" style={{padding:22}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
            <div>
              <h3 style={{fontSize:'var(--fs-md)'}}>Политика отмены записи</h3>
              <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>Действует на все тренировки организации. На уровне отдельной тренировки не настраивается.</div>
            </div>
            <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>глобально</span>
          </div>

          <div style={{display:'flex', alignItems:'center', gap:14, padding:'14px', borderRadius:'var(--r-chip)', background:'var(--vt-bone-2)', marginTop:16}}>
            <Icon name="close" size={18} stroke={cancelAllowed?'var(--vt-ink)':'var(--vt-mute)'}/>
            <div style={{flex:1}}>
              <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>Разрешить игрокам отменять запись</div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>При отмене сессия абонемента возвращается, место уходит листу ожидания.</div>
            </div>
            <button onClick={() => { setCancelAllowed(v => !v); nav.toast(cancelAllowed ? 'Отмена записи выключена' : 'Отмена записи включена'); }}
              style={{width:36, height:20, borderRadius:'var(--r-pill)', background:cancelAllowed?'var(--vt-ink)':'var(--vt-stroke-2)', position:'relative', flexShrink:0, cursor:'pointer'}}>
              <span style={{position:'absolute', top:2, left: cancelAllowed?18:2, width:16, height:16, borderRadius:'var(--r-pill)', background:'var(--vt-paper)', transition:'left .15s'}}/>
            </button>
          </div>

          <div style={{marginTop:16, opacity: cancelAllowed ? 1 : 0.4, pointerEvents: cancelAllowed ? 'auto' : 'none'}}>
            <label className="vt-label">Крайний срок отмены до начала тренировки</label>
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
              {['в любое время', 'за 1 ч', 'за 2 ч', 'за 6 ч', 'за 24 ч'].map((t) => (
                <button key={t} onClick={() => { setCancelCutoff(t); nav.toast(`Отмена — ${t}`); }} className="vt-btn vt-btn--sm" style={{
                  background: cancelCutoff===t ? 'var(--vt-ink)' :'var(--vt-ctl)',
                  color: cancelCutoff===t ? 'var(--vt-paper)' : 'var(--vt-ink)', fontWeight:600
                }}>{t}</button>
              ))}
            </div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:10, display:'flex', gap:8, alignItems:'flex-start'}}>
              <Icon name="clock" size={13} stroke="var(--vt-mute-2)"/>
              <span>{cancelCutoff === 'в любое время'
                ? 'Игроки смогут отменять запись вплоть до начала тренировки.'
                : `Позже срока «${cancelCutoff}» до начала отменить запись будет нельзя — место не успеет уйти листу ожидания.`}</span>
            </div>
          </div>
          <div className="vt-divider" style={{margin:'20px 0'}}/>
          <h3 style={{fontSize:'var(--fs-md)'}}>Шаблоны расписания</h3>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>Регулярные слоты — события создаются автоматически на неделю вперёд.</div>
          <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:14}}>
            {[['Пн','20:00','Основа','Школа №24'],['Ср','20:00','Основа','Школа №24'],['Пт','19:30','Открытая игра','СК «Заслонова»'],['Вс','10:00','Микст','Школа №24']].map((r,i) => (
              <div key={i} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:'var(--r-chip)', background:'var(--vt-bone-2)'}}>
                <span className="vt-chip vt-chip--solid" style={{fontSize:'var(--fs-2xs)'}}>{r[0]}</span>
                <span className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{r[1]}</span>
                <span style={{flex:1, fontSize:'var(--fs-sm)'}}>{r[2]} · <span style={{color:'var(--vt-mute-2)'}}>{r[3]}</span></span>
                <ActionMore mode="popover" align="right" items={[
                  { icon:'edit', label:'Изменить', onClick: () => nav.toast('Изменение слота') },
                  { icon:'trash', tone:'danger', label:'Удалить слот', onClick: () => nav.toast('Слот удалён') },
                ]}/>
              </div>
            ))}
            <button onClick={() => nav.toast('Добавление слота')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{alignSelf:'flex-start', gap:6, marginTop:4}}><Icon name="plus" size={13}/> Добавить слот</button>
          </div>
          <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:18}}>
            <button onClick={() => nav.toast('Расписание сохранено')} className="vt-btn vt-btn--ink vt-btn--sm">Сохранить</button>
          </div>
        </div>
        )}

        {activeTab === 'Записи и оплата' && (
        <div style={{display:'flex', flexDirection:'column', gap:18}}>
          <div className="vt-card" style={{padding:22}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
              <div>
                <h3 style={{fontSize:'var(--fs-md)'}}>Абонементы</h3>
                <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>{subsOn ? 'Включены: игроки покупают планы и списывают сессии при записи. Раздел «Абонементы» виден в кабинете и в Mini App.' : 'Выключены: игроки платят за каждое посещение. Раздел «Абонементы» скрыт и в кабинете, и в Mini App.'}</div>
              </div>
              <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>опционально</span>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:14, padding:'14px', borderRadius:'var(--r-chip)', background:'var(--vt-bone-2)', marginTop:16}}>
              <Icon name="ticket" size={18} stroke={subsOn?'var(--vt-ink)':'var(--vt-icon-idle)'}/>
              <div style={{flex:1}}>
                <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>Включить абонементы в группе</div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>Появятся планы, покупка и списание сессий при записи.</div>
              </div>
              <button onClick={() => { const next = !subsOn; setSubsOn(next); nav.toast(next ? 'Абонементы включены' : 'Абонементы выключены · раздел скрыт'); }}
                style={{width:36, height:20, borderRadius:'var(--r-pill)', background:subsOn?'var(--vt-ink)':'var(--vt-stroke-2)', position:'relative', flexShrink:0, cursor:'pointer'}}>
                <span style={{position:'absolute', top:2, left: subsOn?18:2, width:16, height:16, borderRadius:'var(--r-pill)', background:'var(--vt-paper)', transition:'left .15s'}}/>
              </button>
            </div>
            {!subsOn && (
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:12, display:'flex', gap:8, alignItems:'flex-start'}}>
                <Icon name="bell" size={13} stroke="var(--vt-icon-idle)"/>
                <span>Выключение не трогает уже купленные абонементы — они доживут свой срок, новые продаваться не будут.</span>
              </div>
            )}
          </div>

          <div className="vt-card" style={{padding:22}}>
            <h3 style={{fontSize:'var(--fs-md)'}}>Мест на одного игрока</h3>
            <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>Сколько мест игрок может занять одной записью — например, привести друзей.</div>
            <div style={{display:'flex', alignItems:'center', gap:18, marginTop:16}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <button onClick={() => setMaxSeats(s => Math.max(1, s-1))} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'6px 12px'}}>−</button>
                <span className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-xl)', width:34, textAlign:'center'}}>{maxSeats}</span>
                <button onClick={() => setMaxSeats(s => Math.min(10, s+1))} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'6px 12px'}}>+</button>
              </div>
              <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', lineHeight:1.45}}>
                {maxSeats === 1
                  ? 'Только своё место — приводить гостей нельзя.'
                  : <>Игрок займёт до <b style={{color:'var(--vt-ink)'}}>{maxSeats}</b> мест: своё и ещё {maxSeats-1}. Оплата считается за каждое.</>}
              </div>
            </div>
          </div>

          <div className="vt-card" style={{padding:22}}>
            <h3 style={{fontSize:'var(--fs-md)'}}>Оплата по умолчанию</h3>
            <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>Подставляется при создании события — на самом событии можно поменять.</div>
            <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:16}}>
              {[
                { v:'fixed', t:'Фиксированная цена', s:'Каждый платит одну и ту же сумму за место.', ex:'15 Br × 12 мест = 180 Br' },
                { v:'split', t:'Делим общую сумму', s:'Известна стоимость аренды — делится на всех после закрытия записи.', ex:'180 Br ÷ 12 мест = 15 Br за место' },
              ].map(o => {
                const sel = priceMode === o.v;
                return (
                  <button key={o.v} onClick={() => { setPriceMode(o.v); nav.toast(`По умолчанию — ${o.t.toLowerCase()}`); }} style={{
                    display:'flex', gap:12, padding:'14px', borderRadius:'var(--r-chip)', textAlign:'left', cursor:'pointer',
                    border:`1px solid ${sel?'var(--vt-flame)':'var(--vt-stroke)'}`,
                    background: sel?'var(--vt-accent-soft)':'var(--vt-paper)'
                  }}>
                    <span style={{width:18, height:18, borderRadius:'var(--r-pill)', border:`${sel?5:2}px solid ${sel?'var(--vt-flame)':'var(--vt-stroke)'}`, flexShrink:0, marginTop:2}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>{o.t}</div>
                      <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4, lineHeight:1.45}}>{o.s}</div>
                      <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:6}}>{o.ex}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {priceMode === 'split' && (
              <div style={{marginTop:14, padding:'12px 14px', borderRadius:'var(--r-chip)', background:'var(--vt-amber-soft)', display:'flex', gap:10, alignItems:'flex-start'}}>
                <Icon name="clock" size={14} stroke="var(--vt-amber-ink)"/>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', lineHeight:1.45}}>
                  При делении итоговая сумма станет известна только после закрытия записи. До этого игрок видит прогноз — он меняется по мере того, как люди записываются.
                </div>
              </div>
            )}
            <div style={{display:'flex', justifyContent:'flex-end', marginTop:18}}>
              <button onClick={() => nav.toast('Настройки записи сохранены')} className="vt-btn vt-btn--ink vt-btn--sm">Сохранить</button>
            </div>
          </div>
        </div>
        )}

        {activeTab === 'Залы и площадки' && (
        <div className="vt-card" style={{padding:22}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
            <h3 style={{fontSize:'var(--fs-md)'}}>Залы и площадки</h3>
            <button onClick={() => nav.toast('Добавление зала')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{gap:6}}><Icon name="plus" size={13}/> Добавить зал</button>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:16}}>
            {[['Школа №24, малый зал','ул. Кропоткина 91 · 15 Br/ч','чаще всего'],['СК «Заслонова»','ул. Заслонова 27 · 20 Br/ч',''],['Школа №3, большой зал','пр. Независимости 45 · 25 Br/ч','']].map((v,i) => (
              <div key={i} style={{display:'flex', alignItems:'center', gap:12, padding:'14px', borderRadius:'var(--r-chip)'}}>
                <div style={{width:38, height:38, borderRadius:'var(--r-sm)', background:'var(--vt-bone-2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}><Icon name="pin" size={18}/></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'var(--fs-base)', fontWeight:600, display:'flex', alignItems:'center', gap:8}}>{v[0]} {v[2] && <span className="vt-chip vt-chip--flame" style={{fontSize:'var(--fs-2xs)'}}>{v[2]}</span>}</div>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{v[1]}</div>
                </div>
                <ActionMore mode="popover" align="right" items={[
                  { icon:'edit', label:'Редактировать', onClick: () => nav.toast('Редактирование зала') },
                  { icon:'pin', label:'На карте', onClick: () => nav.toast('Открыть карту') },
                  '---',
                  { icon:'trash', tone:'danger', label:'Удалить', onClick: () => nav.toast('Зал удалён') },
                ]}/>
              </div>
            ))}
          </div>
        </div>
        )}

        {activeTab === 'Способы оплаты' && (
        <div className="vt-card" style={{padding:22}}>
          <h3 style={{fontSize:'var(--fs-md)'}}>Способы оплаты</h3>
          <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:14}}>
            {[
              { key:'cash', t:'Наличными организатору', s:'Касса обновляется после подтверждения' },
              { key:'transfer', t:'Перевод на карту', s:'Belarusbank · *3214 · ФИО Иван П.' },
              { key:'erip', t:'ЕРИП', s:'недоступно в Phase 8' },
              { key:'bepaid', t:'Картой онлайн (bePaid)', s:'недоступно в Phase 8' },
            ].map((p, i) => {
              const on = pays[p.key];
              const disabled = p.key === 'erip' || p.key === 'bepaid';
              return (
                <button key={i} onClick={() => {
                  if (disabled) { nav.toast(`«${p.t}» — Phase 12`); return; }
                  setPays(s => ({...s, [p.key]: !s[p.key]}));
                  nav.toast(on ? `${p.t} · выключен` : `${p.t} · включён`);
                }} style={{display:'flex', alignItems:'center', gap:14, padding:'12px 14px', borderRadius:'var(--r-chip)', background:'var(--vt-ctl-track)', width:'100%', textAlign:'left', cursor:'pointer', filter: disabled ? 'grayscale(1)' : 'none'}}>
                  <Icon name="card" size={18} stroke={on?'var(--vt-ink)':'var(--vt-mute)'}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'var(--fs-base)', fontWeight:600, color: on?'var(--vt-ink)':'var(--vt-mute-2)'}}>{p.t}</div>
                    <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{p.s}</div>
                  </div>
                  <div style={{width:36, height:20, borderRadius:'var(--r-pill)', background:on?'var(--vt-ink)':'var(--vt-stroke-2)', position:'relative'}}>
                    <span style={{position:'absolute', top:2, left: on?18:2, width:16, height:16, borderRadius:'var(--r-pill)', background:'var(--vt-paper)', transition:'left .15s'}}/>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        )}

        {activeTab === 'Уведомления' && (
        <div className="vt-card" style={{padding:22}}>
          <h3 style={{fontSize:'var(--fs-md)'}}>Уведомления</h3>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>Что и когда бот присылает игрокам и организаторам.</div>
          <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:16}}>
            {[
              ['Напоминание за 24 часа','Игрокам основного состава', true],
              ['Напоминание за 2 часа','С запросом подтверждения', true],
              ['Освободилось место','Первому из листа ожидания, TTL 30 мин', true],
              ['Подтверждение оплаты','Игроку — когда организатор подтвердил', true],
              ['Итог тренировки','Сводка организатору после события', false],
              ['Еженедельный отчёт','Организатору по понедельникам', false],
            ].map(([t,s,on],i) => (
              <SettingsToggle key={i} t={t} s={s} on={on} nav={nav}/>
            ))}
          </div>
        </div>
        )}

        {activeTab === 'Telegram-бот' && (
        <div className="vt-card" style={{padding:22}}>
          <h3 style={{fontSize:'var(--fs-md)'}}>Telegram-бот</h3>
          <div style={{display:'grid', gridTemplateColumns:'auto 1fr', columnGap:14, rowGap:12, marginTop:16, fontSize:'var(--fs-sm)', alignItems:'center'}}>
            <span style={{color:'var(--vt-mute-2)'}}>Бот</span><span className="vt-mono" style={{fontWeight:600, color:'var(--vt-flame-ink)'}}>@volleytime_bot</span>
            <span style={{color:'var(--vt-mute-2)'}}>Статус</span><span style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:8,height:8,borderRadius:'var(--r-pill)',background:'var(--vt-grass)'}}/> подключён · webhook активен</span>
            <span style={{color:'var(--vt-mute-2)'}}>Чат группы</span><span>VolleyTime Минск · 14 участников</span>
            <span style={{color:'var(--vt-mute-2)'}}>Mini App</span><span className="vt-mono" style={{fontSize:'var(--fs-xs)'}}>t.me/volleytime_bot/app</span>
          </div>
          <div className="vt-divider" style={{margin:'18px 0'}}/>
          <h3 style={{fontSize:'var(--fs-base)'}}>Invite-ссылка</h3>
          <div style={{display:'flex', gap:8, marginTop:10}}>
            <div className="vt-field vt-mono" style={{flex:1, fontSize:'var(--fs-xs)', display:'flex', alignItems:'center', color:'var(--vt-ink-3)'}}>t.me/volleytime_bot?start=org_7gK4nT</div>
            <button onClick={() => nav.toast('Ссылка скопирована')} className="vt-btn vt-btn--ink vt-btn--sm" style={{gap:6}}><Icon name="copy" size={13}/> Копировать</button>
          </div>
          <div style={{display:'flex', gap:8, marginTop:16}}>
            <button onClick={() => nav.toast('Тестовое сообщение отправлено')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="send" size={13}/> Тест-сообщение</button>
            <button onClick={() => nav.toast('Бот переподключён')} className="vt-btn vt-btn--ghost vt-btn--sm">Переподключить</button>
          </div>
        </div>
        )}

        {activeTab === 'Опасная зона' && (
        <div className="vt-card" style={{padding:22, borderColor:'color-mix(in oklab, var(--vt-rose) 30%, transparent)'}}>
          <h3 style={{fontSize:'var(--fs-md)', color:'var(--vt-rose)'}}>Опасная зона</h3>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>Необратимые действия. Будьте осторожны.</div>
          <div style={{display:'flex', flexDirection:'column', gap:12, marginTop:16}}>
            {[
              ['Архивировать организацию','События скроются, данные сохранятся','Архивировать'],
              ['Передать владение','Назначить нового owner-а','Передать'],
              ['Удалить организацию','Все события, касса и записи будут удалены','Удалить'],
            ].map(([t,s,btn],i) => (
              <div key={i} style={{display:'flex', alignItems:'center', gap:14, padding:'14px', borderRadius:'var(--r-chip)'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>{t}</div>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{s}</div>
                </div>
                <button onClick={() => nav.alert({ title:`${t}?`, body:s, confirm:btn, danger:true, onConfirm: () => nav.toast(`${btn} · выполнено`) })}
                  className="vt-btn vt-btn--sm" style={{border:'1px solid var(--vt-rose)', color:'var(--vt-rose)'}}>{btn}</button>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>
    </div>
  </WebShell>
  );
};

// ---------- WebPlans (Абонементы — планы + активные) ----------
const WebPlans = () => {
  const nav = useNav();
  const [seg, setSeg] = React.useState('plans');

  const plans = [
    { id:'p1', name:'4 сессии', sessions:4, price:60, per:15.00, valid:30, active:true, sold:12, holders:3 },
    { id:'p2', name:'8 сессий', sessions:8, price:110, per:13.75, valid:45, active:true, sold:24, holders:5, popular:true },
    { id:'p3', name:'12 сессий', sessions:12, price:150, per:12.50, valid:60, active:true, sold:7, holders:1 },
    { id:'p4', name:'Безлимит / месяц', sessions:'∞', price:180, per:0, valid:30, active:false, sold:0, holders:0, draft:true },
  ];

  const active = PEOPLE.slice(0, 9).map((p, i) => ({
    ...p,
    plan: ['8 сессий','4 сессии','8 сессий','12 сессий','4 сессии','8 сессий','8 сессий','4 сессии','12 сессий'][i],
    left: [5,2,8,11,0,3,6,1,9][i],
    total: [8,4,8,12,4,8,8,4,12][i],
    until: ['12 июня','5 июня','20 июня','1 июля','истёк','15 июня','18 июня','3 июня','5 июля'][i],
    expiring: i===1 || i===7,
    expired: i===4,
  }));

  const planMenu = (p) => [
    { icon:'edit', label:'Редактировать план', onClick: () => nav.toast(`Редактируем «${p.name}»`) },
    { icon:'copy', label:'Дублировать', onClick: () => nav.toast('План дублирован') },
    { icon:'globe', label: p.active ? 'Снять с продажи' : 'Включить продажу', onClick: () => nav.toast(p.active ? 'План скрыт' : 'План активен') },
    '---',
    { icon:'trash', tone:'danger', label:'Удалить план', onClick: () => nav.alert({ title:`Удалить «${p.name}»?`, body:'Существующие абонементы игроков сохранятся.', confirm:'Удалить', danger:true, onConfirm: () => nav.toast('План удалён') }) },
  ];

  return (
  <WebShell activeNav="plans" title="Абонементы" sub="Планы абонементов и активные подписки игроков"
    topRight={<>
      <button onClick={() => nav.toast('CSV абонементов скачан')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="arrow-d" size={14}/> Экспорт</button>
      <button onClick={() => nav.push('plan-create')} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6}}><Icon name="plus" size={14}/> Новый план</button>
    </>}>
    {/* KPI */}
    <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginBottom:18}}>
      {[
        ['Активных абонементов','9','у 9 игроков'],
        ['Продано за май','5','+110 Br ср. чек','grass'],
        ['Доход с абонементов','+540 Br','43% поступлений','grass'],
        ['Истекают на неделе','2','напомнить игрокам','amber'],
      ].map(([l,v,d,c],i) => (
        <div key={i} className="vt-card" style={{padding:16}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{l}</div>
          <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-2xl)', marginTop:8, color:c==='grass'?'var(--vt-grass)':c==='amber'?'var(--vt-amber)':'inherit'}}>{v}</div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:6}}>{d}</div>
        </div>
      ))}
    </div>

    {/* Segment */}
    <div style={{display:'flex', gap:2, padding:4, background:'var(--vt-bone-2)', borderRadius:'var(--r-chip)', width:'fit-content', marginBottom:18}}>
      {[['plans','Планы'],['active','Активные абонементы']].map(([k,l]) => (
        <button key={k} onClick={() => setSeg(k)} className="vt-btn vt-btn--sm" style={{
          background: seg===k ? 'var(--vt-paper)' : 'transparent',
          color: seg===k ? 'var(--vt-ink)' : 'var(--vt-mute-2)',
          boxShadow: seg===k ? 'var(--vt-seg-shadow)' : 'none', fontWeight:600
        }}>{l}</button>
      ))}
    </div>

    {seg === 'plans' ? (
      <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14}}>
        {plans.map(p => (
          <div key={p.id} className="vt-card" style={{padding:20, position:'relative', borderColor: p.popular?'var(--vt-ink)':'var(--vt-stroke)', filter: p.draft ? 'grayscale(1)' : 'none'}}>
            {p.popular && <span className="vt-chip vt-chip--solid" style={{position:'absolute', top:-10, left:16, fontSize:'var(--fs-2xs)'}}>Популярный</span>}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
              <div style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-3xl)', lineHeight:1}}>{p.sessions}</div>
              <ActionMore mode="popover" align="right" items={planMenu(p)}/>
            </div>
            <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>{p.name}</div>
            <div className="vt-divider" style={{margin:'14px 0'}}/>
            <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-xl)'}}>{p.price} Br</div>
            <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2}}>{p.per>0 ? `${p.per.toFixed(2).replace('.', ',')} Br/сессия · ` : ''}{p.valid} дней</div>
            <div style={{display:'flex', gap:6, marginTop:14, flexWrap:'wrap'}}>
              {p.draft
                ? <span className="vt-chip vt-chip--amber" style={{fontSize:'var(--fs-2xs)'}}>черновик</span>
                : p.active
                ? <span className="vt-chip vt-chip--grass vt-chip--dot" style={{fontSize:'var(--fs-2xs)'}}>в продаже</span>
                : <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>скрыт</span>}
              {!p.draft && <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>{p.sold} продаж</span>}
            </div>
          </div>
        ))}
        <button onClick={() => nav.push('plan-create')} className="vt-card" style={{padding:20, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, cursor:'pointer', background:'var(--vt-bone)', color:'var(--vt-mute-2)', minHeight:160}}>
          <Icon name="plus" size={24}/>
          <span style={{fontSize:'var(--fs-sm)', fontWeight:600}}>Новый план</span>
        </button>
      </div>
    ) : (
      <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
        <div style={{display:'grid', gridTemplateColumns:'2fr 1.3fr 1fr 1.2fr 100px 40px', padding:'10px 18px', borderBottom:'1px solid var(--vt-bone-2)'}}>
          {['Игрок','План','Остаток','Действует до','Статус',''].map((h,i) => <div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>)}
        </div>
        {active.map((m,i,arr) => (
          <div key={i} style={{display:'grid', gridTemplateColumns:'2fr 1.3fr 1fr 1.2fr 100px 40px', padding:'12px 18px', borderBottom: i<arr.length-1?'1px solid var(--vt-bone-2)':'none', alignItems:'center', filter: m.expired ? 'grayscale(1)' : 'none'}}>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <Avi name={m.name} init={m.init} tag={m.tag} size="sm"/>
              <span style={{fontSize:'var(--fs-base)', fontWeight:600}}>{m.name}</span>
            </div>
            <div style={{fontSize:'var(--fs-sm)'}}>{m.plan}</div>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <div className="vt-meter" style={{width:54}}><i style={{width:`${(m.left/m.total)*100}%`, background: m.expired?'var(--vt-stroke-2)':m.left===0?'var(--vt-rose)':'var(--vt-flame)'}}/></div>
              <span className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{m.left}/{m.total}</span>
            </div>
            <div className="vt-mono" style={{fontSize:'var(--fs-sm)', color: m.expired?'var(--vt-rose)':'var(--vt-ink-3)'}}>{m.until}</div>
            <div>
              {m.expired ? <span className="vt-chip vt-chip--rose" style={{fontSize:'var(--fs-2xs)'}}>истёк</span>
                : m.expiring ? <span className="vt-chip vt-chip--amber vt-chip--dot" style={{fontSize:'var(--fs-2xs)'}}>истекает</span>
                : <span className="vt-chip vt-chip--grass vt-chip--dot" style={{fontSize:'var(--fs-2xs)'}}>активен</span>}
            </div>
            <ActionMore mode="popover" align="right" items={[
              { icon:'send', label:'Напомнить о продлении', onClick: () => nav.toast(`Напоминание · ${m.name}`) },
              { icon:'plus', label:'Продлить вручную', onClick: () => nav.toast('Абонемент продлён') },
              { icon:'wallet', label:'История списаний', onClick: () => nav.toast('История списаний') },
              '---',
              { icon:'close', tone:'danger', label:'Аннулировать', onClick: () => nav.toast('Абонемент аннулирован') },
            ]}/>
          </div>
        ))}
      </div>
    )}
  </WebShell>
  );
};

// ---------- WebContributions ----------
const WebContributions = () => {
  const nav = useNav();
  const campaigns = (typeof CAMPAIGNS !== 'undefined' ? CAMPAIGNS : []);
  const cpct = (c) => Math.min(100, Math.round((c.collected / c.target) * 100));
  return (
  <WebShell
    activeNav="contributions"
    title="Сборы"
    sub="Кампании по сбору на инвентарь, залы и турниры"
    topRight={
      <>
        <button onClick={() => nav.toast('CSV сборов скачан')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="arrow-d" size={14}/> Экспорт</button>
        <button onClick={() => nav.push('contrib-create')} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6}}><Icon name="plus" size={14}/> Новый сбор</button>
      </>
    }
  >
    {/* KPI row */}
    <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginBottom:18}}>
      {[
        ['Активных сборов', '2', null],
        ['Собрано в этом месяце', '+295 Br', 'grass'],
        ['Обещано · ждёт', '70 Br', 'amber'],
        ['Участников', '24', null],
      ].map(([l, v, c], i) => (
        <div key={i} className="vt-card" style={{padding:16}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{l}</div>
          <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-2xl)', marginTop:8, color: c==='grass'?'var(--vt-grass)':c==='amber'?'var(--vt-amber)':'inherit'}}>{v}</div>
        </div>
      ))}
    </div>

    <div style={{display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:16}}>
      {/* Campaign cards */}
      <div style={{display:'flex', flexDirection:'column', gap:14}}>
        {campaigns.map((c) => (
          <div key={c.id} className="vt-card" style={{padding:18, filter: c.status==='done' ? 'grayscale(1)' : 'none'}}>
            <div style={{display:'flex', gap:14, alignItems:'flex-start'}}>
              <CampaignIcon name={c.icon} size={48}/>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:10}}>
                  <h3 style={{fontSize:'var(--fs-md)', lineHeight:1.2}}>{c.title}</h3>
                  {c.status === 'active'
                    ? <span className="vt-chip vt-chip--flame" style={{fontSize:'var(--fs-2xs)'}}>активен</span>
                    : <span className="vt-chip vt-chip--grass vt-chip--dot" style={{fontSize:'var(--fs-2xs)'}}>завершён</span>}
                </div>
                <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:6, lineHeight:1.4}}>{c.desc}</div>

                <div style={{display:'flex', alignItems:'center', gap:10, marginTop:14}}>
                  <div className="vt-meter vt-meter--grass" style={{flex:1, height:8}}><i style={{width:`${cpct(c)}%`, background: c.status==='done'?'var(--vt-grass)':'var(--vt-flame)'}}/></div>
                  <span className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:700}}>{cpct(c)}%</span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10}}>
                  <span className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{byn(c.collected)} <span style={{color:'var(--vt-mute-2)', fontWeight:400}}>/ {byn(c.target)}</span></span>
                  <div style={{display:'flex', alignItems:'center', gap:14}}>
                    <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{c.contributors} участников · {c.deadline}</span>
                    <ActionMore mode="popover" align="right" items={[
                      { icon:'edit', label:'Редактировать', onClick: () => nav.toast(`Редактируем «${c.title}»`) },
                      { icon:'send', label:'Напомнить участникам', onClick: () => nav.toast('Напоминание отправлено') },
                      { icon:'send', label:'В чат группы', onClick: () => nav.toast('Опубликовано') },
                      '---',
                      ...(c.status === 'active' ? [{ icon:'check', label:'Завершить сбор', onClick: () => nav.toast(`«${c.title}» завершён`) }] : []),
                      { icon:'trash', tone:'danger', label:'Удалить сбор', onClick: () => nav.alert({
                        title:'Удалить сбор?', body:'Все взносы и обещания будут удалены.', confirm:'Удалить', danger:true,
                        onConfirm: () => nav.toast('Сбор удалён')
                      })},
                    ]}/>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pending pledges */}
      <div className="vt-card" style={{padding:18, alignSelf:'flex-start'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
          <h3 style={{fontSize:'var(--fs-md)'}}>Обещания <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-amber)', fontWeight:600, marginLeft:4}}>4 ждут</span></h3>
        </div>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4}}>Подтвердите, когда получите деньги — попадут в кассу.</div>
        <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:14}}>
          {PEOPLE.slice(0, 4).map((p, i) => (
            <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 10px', borderRadius:'var(--r-sm)', background:'var(--vt-bone-2)'}}>
              <Avi name={p.name} init={p.init} tag={p.tag} size="sm"/>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{p.name}</div>
                <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>Новый комплект мячей</div>
              </div>
              <span className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-sm)'}}>{byn([15,20,10,25][i])}</span>
              <button onClick={() => nav.toast(`Подтверждено · ${p.name}`)} className="vt-btn vt-btn--primary vt-btn--sm" style={{padding:'6px 10px', fontSize:'var(--fs-2xs)'}}>✓</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  </WebShell>
  );
};

// ---------- WebNotifications ----------
const WebNotifications = () => {
  const nav = useNav();
  const [filter, setFilter] = React.useState('all');
  const items = [
    { cat:'payments', icon:'wallet', tone:'amber', title:'4 платежа ждут подтверждения', body:'По событиям «Основа · 28 мая» и «Микст · 1 июня». Самому старому 6 ч.', time:'14:30', day:'Сегодня', action:{label:'Проверить платежи', to:'ledger'} },
    { cat:'events', icon:'user', tone:'flame', title:'Новая запись', body:'Денис записался на «Открытая игра · 30 мая».', time:'13:08', day:'Сегодня', read:true, action:{label:'Открыть событие', to:'events'} },
    { cat:'events', icon:'close', tone:'rose', title:'Отмена записи', body:'Катя отменила запись на «Основа · 28 мая» — место ушло первому из листа ожидания.', time:'11:40', day:'Сегодня', read:true },
    { cat:'billing', icon:'card', tone:'amber', title:'Мало credits', body:'Осталось 8 credits — хватит примерно на 8 событий. Пополните баланс.', time:'09:00', day:'Сегодня', read:true, action:{label:'Пополнить', to:'billing'} },
    { cat:'events', icon:'gift', tone:'grass', title:'Новое обещание взноса', body:'Соня обещала 20 Br в сбор «Новый комплект мячей».', time:'19:31', day:'Вчера', read:true, action:{label:'Открыть сборы', to:'contributions'} },
    { cat:'members', icon:'users', tone:'flame', title:'Заявка на вступление', body:'Marina V. хочет вступить по invite-ссылке.', time:'16:05', day:'Вчера', read:true, action:{label:'Игроки', to:'members'} },
    { cat:'system', icon:'chart', tone:'ink', title:'Отчёт за апрель готов', body:'Касса +166 Br, 9 событий, 84% заполнение. Доступен экспорт CSV.', time:'1 мая', day:'Ранее', read:true },
  ];
  const filtered = filter === 'all' ? items : items.filter(i => i.cat === filter);
  const days = ['Сегодня','Вчера','Ранее'];

  return (
  <WebShell
    activeNav=""
    title="Уведомления"
    sub="Платежи, события, игроки и биллинг"
    topRight={<button onClick={() => nav.toast('Все отмечены прочитанными')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="check" size={14}/> Прочитать всё</button>}
  >
    {/* Filters */}
    <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap'}}>
      {[['all','Все'],['payments','Платежи'],['events','События'],['members','Игроки'],['billing','Биллинг'],['system','Система']].map(([id,l]) => (
        <button key={id} onClick={() => setFilter(id)} className="vt-btn vt-btn--sm" style={{
          background: filter===id?'var(--vt-ink)':'var(--vt-ctl)',
          color: filter===id?'var(--vt-paper)':'var(--vt-ink)',
          fontWeight:600
        }}>{l}</button>
      ))}
    </div>

    <div style={{maxWidth:760, display:'flex', flexDirection:'column', gap:18}}>
      {days.map(day => {
        const dayItems = filtered.filter(i => i.day === day);
        if (!dayItems.length) return null;
        return (
          <div key={day}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>{day}</div>
            <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
              {dayItems.map((n, i) => (
                <div key={i} style={{display:'flex', gap:14, padding:'14px 18px', borderBottom: i<dayItems.length-1?'1px solid var(--vt-bone-2)':'none', alignItems:'flex-start', filter: n.read ? 'grayscale(1)' : 'none', position:'relative'}}>
                  {!n.read && <span style={{position:'absolute', left:7, top:'50%', width:6, height:6, borderRadius:'var(--r-pill)', background:'var(--vt-flame)', transform:'translateY(-50%)'}}/>}
                  <div style={{
                    width:38, height:38, borderRadius:'var(--r-chip)', flexShrink:0,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background: n.tone==='flame'?'var(--vt-accent-soft)':n.tone==='grass'?'var(--vt-grass-soft)':n.tone==='amber'?'var(--vt-amber-soft)':n.tone==='rose'?'var(--vt-rose-soft)':'var(--vt-bone-2)',
                    color: n.tone==='flame'?'var(--vt-flame-deep)':n.tone==='grass'?'var(--vt-grass)':n.tone==='amber'?'var(--vt-amber-ink)':n.tone==='rose'?'var(--vt-rose)':'var(--vt-ink-3)',
                  }}><Icon name={n.icon} size={19}/></div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{display:'flex', justifyContent:'space-between', gap:10, alignItems:'baseline'}}>
                      <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>{n.title}</div>
                      <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', flexShrink:0}}>{n.time}</span>
                    </div>
                    <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4, lineHeight:1.45}}>{n.body}</div>
                    {n.action && (
                      <button onClick={() => nav.reset(n.action.to)} className="vt-btn vt-btn--ghost vt-btn--sm" style={{marginTop:10, fontSize:'var(--fs-xs)'}}>
                        {n.action.label} <Icon name="chevron-r" size={12}/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  </WebShell>
  );
};

Object.assign(window, { WebShell, WebDashboard, WebEvents, WebEventDetail, WebMembers, WebLedger, WebBilling, WebSettings, WebContributions, WebNotifications, WebPlans });
