// screens-ideas-future.jsx — Mini App после внедрения гипотез + общий календарь игрока

const FG = [
  { id:'vt', name:'VolleyTime Минск', short:'VT Минск', logo:LOGO_URL, c:'var(--vt-blue-ink)' },
  { id:'mv', name:'МинскВолей · Воскресные', short:'МинскВолей', c:'var(--vt-orange)' },
  { id:'sk', name:'СпайкКлуб', short:'СпайкКлуб', c:'var(--vt-grass)' },
];
const fgOf = (id) => FG.find(g => g.id === id);
const FG_SLOTS = [
  { g:'vt', dow:3, s:'20:00', e:'22:00', title:'Основа', venue:'Школа №24' },
  { g:'vt', dow:5, s:'19:30', e:'22:00', title:'Открытая игра', venue:'СК «Заслонова»' },
  { g:'vt', dow:0, s:'10:00', e:'13:00', title:'Микст', venue:'Школа №24' },
  { g:'mv', dow:2, s:'21:00', e:'23:00', title:'Вечерняя', venue:'Гимназия №5' },
  { g:'mv', dow:0, s:'11:00', e:'14:00', title:'Воскресная игра', venue:'Гимназия №5' },
  { g:'sk', dow:6, s:'12:00', e:'14:00', title:'Пляж 4×4', venue:'СК «Дрозды»' },
];
const FG_MINE = { 'vt-3':'go','vt-10':'go','vt-17':'go','vt-24':'go','vt-12':'go','vt-7':'wait','vt-14':'go','mv-2':'go','mv-9':'go','mv-14':'go','mv-21':'go','mv-28':'go','sk-6':'go','sk-20':'go' };
const FG_FULL = { 'vt-19':1, 'sk-13':1, 'vt-7':1 };
const FG_TODAY = 2;
const FG_DOW = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const FG_WEEK = [1,2,3,4,5,6,0];
const fgMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fgDayLabel = (d) => {
  if (d === FG_TODAY) return 'Сегодня';
  if (d === FG_TODAY + 1) return 'Завтра';
  return `${FG_DOW[new Date(2026, 5, d).getDay()]}, ${d} июня`;
};
const fgEvents = (mine) => {
  const out = [];
  for (let d = 1; d <= 30; d++) {
    const dow = new Date(2026, 5, d).getDay();
    FG_SLOTS.forEach(s => {
      if (s.dow !== dow) return;
      const key = `${s.g}-${d}`;
      out.push({ ...s, key, d, st: mine[key] || null, full: !!FG_FULL[key] });
    });
  }
  out.forEach(e => {
    e.clash = !!e.st && e.st === 'go' && out.some(o => o !== e && o.d === e.d && o.st === 'go' && fgMin(e.s) < fgMin(o.e) && fgMin(o.s) < fgMin(e.e));
  });
  return out.sort((a, b) => a.d - b.d || fgMin(a.s) - fgMin(b.s));
};

const FDot = ({ c, ring, size = 7 }) => <i style={{width:size, height:size, borderRadius:'50%', display:'block', flexShrink:0, background: ring ? 'transparent' : c, boxShadow: ring ? `inset 0 0 0 1.5px ${c}` : 'none'}}/>;
const FScreen = ({ children, h = 780 }) => <div style={{height:h, display:'flex', flexDirection:'column', minHeight:0}}>{children}</div>;
const FBody = ({ children, style }) => <div style={{flex:1, minHeight:0, overflowY:'auto', scrollbarWidth:'none', padding:'8px 16px 16px', ...style}}>{children}</div>;
const FTitle = ({ children, size = 'var(--fs-xl)', style }) => <div style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, lineHeight:1, fontSize:size, ...style}}>{children}</div>;

const FTabBar = ({ tabs, active }) => {
  const nav = useNav();
  return (
    <div className="vt-tabbar">
      {tabs.map(([id, label, icon, isNew]) => (
        <button key={id} data-active={active === id} onClick={() => active !== id && nav.toast(`Вкладка «${label}»`)} style={{position:'relative'}}>
          <span className="ico"><Icon name={icon} size={20}/></span>{label}
          {isNew && <span style={{position:'absolute', top:4, right:'calc(50% - 18px)', width:7, height:7, borderRadius:'50%', background:'var(--vt-orange)'}}/>}
        </button>
      ))}
    </div>
  );
};

// ============================================================
// Мой календарь — все группы игрока
// ============================================================
const MyCalendar = () => {
  const nav = useNav();
  const [mine, setMine] = React.useState(FG_MINE);
  const [view, setView] = React.useState('agenda');
  const [grp, setGrp] = React.useState('all');
  const [avail, setAvail] = React.useState(false);
  const [sel, setSel] = React.useState(FG_TODAY);
  const all = fgEvents(mine);
  const inGrp = all.filter(e => grp === 'all' || e.g === grp);
  const shown = inGrp.filter(e => e.st || avail);
  const goCount = all.filter(e => e.st === 'go').length;
  const clashDays = [...new Set(all.filter(e => e.clash).map(e => e.d))];

  const setSt = (key, st, msg) => { setMine(m => { const n = { ...m }; if (st) n[key] = st; else delete n[key]; return n; }); nav.toast(msg); };
  const openEv = (e) => {
    const g = fgOf(e.g);
    const items = e.st === 'go' ? [
      { icon:'arrow-r', label:`Открыть в группе «${g.short}»`, onClick: () => nav.toast(`Переход в «${g.short}»`) },
      { icon:'pin', label:'Открыть на карте', onClick: () => nav.toast('Открываем карту') },
      '---',
      { icon:'close', tone:'danger', label:'Отменить запись', onClick: () => setSt(e.key, null, 'Запись отменена') },
    ] : e.st === 'wait' ? [
      { icon:'arrow-r', label:`Открыть в группе «${g.short}»`, onClick: () => nav.toast(`Переход в «${g.short}»`) },
      { icon:'close', tone:'danger', label:'Выйти из листа ожидания', onClick: () => setSt(e.key, null, 'Вы вышли из очереди') },
    ] : [
      e.full ? { icon:'clock', label:'Встать в лист ожидания', onClick: () => setSt(e.key, 'wait', 'Вы в листе ожидания') }
             : { icon:'check', label:'Записаться', onClick: () => setSt(e.key, 'go', `Записаны · ${g.short}`) },
      { icon:'arrow-r', label:`Открыть в группе «${g.short}»`, onClick: () => nav.toast(`Переход в «${g.short}»`) },
    ];
    nav.sheet({ title: e.title, sub: `${g.short} · ${fgDayLabel(e.d)} · ${e.s}–${e.e} · ${e.venue}`, items });
  };
  const resolveClash = (d) => {
    const list = all.filter(e => e.d === d && e.clash);
    nav.sheet({ title:`Пересечение · ${d} июня`, sub:'Записи в двух группах накладываются по времени. Место в отменённой игре уйдёт листу ожидания.',
      items: [
        ...list.map(keep => ({ org:true, label:`Оставить «${keep.title}»`, logo: fgOf(keep.g).logo, sub:`${fgOf(keep.g).short} · ${keep.s}–${keep.e}`,
          onClick: () => { setMine(m => { const n = { ...m }; list.filter(o => o !== keep).forEach(o => delete n[o.key]); return n; }); nav.toast(`Оставили «${keep.title}»`); } })),
        '---',
        { icon:'check', label:'Оставить обе', onClick: () => nav.toast('Напомним за день') },
      ] });
  };

  const Status = ({ e }) => {
    if (e.clash) return <span className="vt-chip" style={{background:'var(--vt-amber-soft)', color:'var(--vt-amber-ink)'}}>пересечение</span>;
    if (e.st === 'go') return <span className="vt-chip vt-chip--mine" style={{gap:4}}><Icon name="check" size={12} sw={2.4}/>Иду</span>;
    if (e.st === 'wait') return <span className="vt-chip vt-chip--queue" style={{gap:4}}><Icon name="clock" size={12} sw={2.4}/>В очереди · 2-й</span>;
    return <span className="vt-chip vt-chip--state">{e.full ? 'мест нет' : 'есть места'}</span>;
  };
  const Row = ({ e, i }) => {
    const g = fgOf(e.g);
    return (
      <button onClick={() => openEv(e)} style={{display:'flex', alignItems:'center', gap:12, width:'100%', textAlign:'left', cursor:'pointer', padding:'12px 0', boxShadow: i ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none', opacity: e.st ? 1 : .78}}>
        <div style={{width:46, flexShrink:0}}>
          <div className="vt-mono" style={{fontSize:'var(--fs-md)', fontWeight:700, lineHeight:1}}>{e.s}</div>
          <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:4}}>{e.e}</div>
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:'var(--fs-base)', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{e.title}</div>
          <div style={{display:'flex', alignItems:'center', gap:6, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4, minWidth:0}}>
            <FDot c={g.c}/><span style={{color:'var(--vt-ink-3)', fontWeight:600, whiteSpace:'nowrap', flexShrink:0}}>{g.short}</span><span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>· {e.venue}</span>
          </div>
        </div>
        <span style={{flexShrink:0}}><Status e={e}/></span>
      </button>
    );
  };

  const days = [...new Set(shown.filter(e => e.d >= FG_TODAY).map(e => e.d))];
  const selList = shown.filter(e => e.d === sel);

  return (
    <FScreen>
      <MiniHeader title="Мой календарь" sub={`${FG.length} группы · ${goCount} записей в июне`}
        right={<button onClick={() => nav.sheet({ title:'Календарь', items:[
          { icon:'calendar', label:'Подписка для календаря телефона', sub:'.ics', onClick: () => nav.toast('Подписка создана · обновляется сама') },
          { icon:'bell', label:'Сводка недели в боте', sub:'пн 9:00', onClick: () => nav.toast('Сводка включена') },
        ] })} className="vt-btn vt-btn--ghost vt-btn--sm" style={{width:44, height:44, padding:0}} aria-label="Синхронизация"><Icon name="link" size={17}/></button>}/>
      <FBody>
        <div style={{display:'flex', padding:4, gap:2, background:'var(--vt-bone)', borderRadius:'var(--r-field)'}}>
          {[['agenda','Ближайшие'],['month','Месяц']].map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} style={{flex:1, padding:'10px 0', borderRadius:'var(--r-chip)', fontSize:'var(--fs-sm)', fontWeight:700, cursor:'pointer',
              background: view === k ? 'var(--vt-raised)' : 'transparent', boxShadow: view === k ? 'var(--vt-shadow-card)' : 'none', color: view === k ? 'var(--vt-ink)' : 'var(--vt-mute-2)'}}>{l}</button>
          ))}
        </div>
        <div style={{display:'flex', gap:6, marginTop:10, overflowX:'auto', scrollbarWidth:'none'}}>
          {[{ id:'all', short:'Все' }, ...FG].map(g => (
            <button key={g.id} onClick={() => setGrp(g.id)} className="vt-chip" style={{cursor:'pointer', padding:'8px 12px', minHeight:36, gap:6, flexShrink:0, fontSize:'var(--fs-sm)',
              background: grp === g.id ? 'var(--vt-ink)' : 'var(--vt-ctl-chip)', color: grp === g.id ? 'var(--vt-paper)' : 'var(--vt-ink)'}}>
              {g.c && <FDot c={g.c} size={8}/>}{g.short}
            </button>
          ))}
        </div>
        <button onClick={() => setAvail(a => !a)} role="switch" aria-checked={avail} style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, width:'100%', marginTop:10, minHeight:44, textAlign:'left', fontSize:'var(--fs-sm)', color:'var(--vt-ink-3)', cursor:'pointer'}}>
          Показывать игры, куда можно записаться
          <span style={{width:44, height:26, borderRadius:99, flexShrink:0, position:'relative', display:'block', background: avail ? 'var(--vt-flame)' : 'var(--vt-stroke-2)', transition:'background .15s'}}>
            <i style={{position:'absolute', top:3, left: avail ? 21 : 3, width:20, height:20, borderRadius:'50%', background:'#fff', display:'block', transition:'left .15s'}}/>
          </span>
        </button>

        {clashDays.length > 0 && (
          <button onClick={() => resolveClash(clashDays[0])} style={{display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left', cursor:'pointer', marginTop:12, padding:'12px 14px', borderRadius:'var(--r-btn)', background:'var(--vt-amber-soft)', color:'var(--vt-amber-ink)'}}>
            <Icon name="clock" size={18}/>
            <span style={{flex:1, fontSize:'var(--fs-sm)', lineHeight:1.35}}><b>{clashDays[0]} июня две записи пересекаются</b><br/>Выберите, на какую игру идти</span>
            <Icon name="chevron-r" size={16} sw={2.2}/>
          </button>
        )}

        {view === 'agenda' ? (
          <div style={{marginTop:8}}>
            {days.map(d => (
              <div key={d} style={{marginTop:14}}>
                <div className="vt-cap" style={{color: d === FG_TODAY ? 'var(--vt-flame-deep)' : 'var(--vt-mute-2)'}}>{fgDayLabel(d)}</div>
                {shown.filter(e => e.d === d).map((e, i) => <Row key={e.key} e={e} i={i}/>)}
              </div>
            ))}
            {days.length === 0 && <div style={{padding:'40px 8px', textAlign:'center', fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>В этой группе у вас нет записей</div>}
          </div>
        ) : (
          <>
            <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4, marginTop:14}}>
              {FG_WEEK.map(d => <div key={d} className="vt-cap" style={{textAlign:'center', color:'var(--vt-mute-2)', paddingBottom:4}}>{FG_DOW[d]}</div>)}
              {Array.from({ length: 30 }, (_, i) => i + 1).map(d => {
                const list = shown.filter(e => e.d === d);
                const isSel = d === sel, clash = list.some(e => e.clash);
                return (
                  <button key={d} onClick={() => setSel(d)} style={{height:48, borderRadius:'var(--r-field)', cursor:'pointer', position:'relative',
                    background: list.length ? 'var(--vt-ctl)' : 'transparent', boxShadow: isSel ? 'inset 0 0 0 2px var(--vt-ink)' : 'none',
                    color: d < FG_TODAY ? 'var(--vt-mute)' : 'var(--vt-ink)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:5}}>
                    <span className="vt-mono" style={{fontSize:'var(--fs-md)', fontWeight: d === FG_TODAY ? 800 : 700, lineHeight:1, color: d === FG_TODAY ? 'var(--vt-flame-deep)' : undefined}}>{d}</span>
                    {list.length > 0 && <span style={{display:'flex', gap:3}}>{list.map(e => <FDot key={e.key} c={e.st ? fgOf(e.g).c : 'var(--vt-icon-idle)'} ring={e.st !== 'go'} size={6}/>)}</span>}
                    {clash && <i style={{position:'absolute', top:5, right:5, width:6, height:6, borderRadius:'50%', background:'var(--vt-amber)'}}/>}
                  </button>
                );
              })}
            </div>
            <div style={{display:'flex', flexWrap:'wrap', gap:12, marginTop:10, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>
              {FG.map(g => <span key={g.id} style={{display:'flex', alignItems:'center', gap:5}}><FDot c={g.c}/>{g.short}</span>)}
              <span style={{display:'flex', alignItems:'center', gap:5}}><FDot c="var(--vt-mute-2)" ring/>очередь</span>
            </div>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:18}}>{fgDayLabel(sel)}</div>
            {selList.length ? selList.map((e, i) => <Row key={e.key} e={e} i={i}/>) : <div style={{padding:'16px 0', fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>Игр нет</div>}
          </>
        )}
      </FBody>
      <FTabBar active="cal" tabs={[['home','Главная','home'],['cal','Календарь','calendar',true],['subs','Абонементы','ticket'],['me','Профиль','user']]}/>
    </FScreen>
  );
};

// ============================================================
// Общие куски для вариантов главной
// ============================================================
const FGroupsHead = ({ right }) => {
  const nav = useNav();
  return (
    <div style={{padding:'8px 16px 0', display:'flex', alignItems:'center', gap:10}}>
      <button onClick={() => nav.sheet({ title:'Мои группы', items:[...FG.map(g => ({ org:true, label:g.name, logo:g.logo, sub:'открыть группу', onClick: () => nav.toast(`Открыта «${g.short}»`) })), '---', { icon:'link', label:'Вступить по ссылке' }] })}
        style={{display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0, textAlign:'left', cursor:'pointer'}}>
        <span style={{display:'flex', gap:4}}>{FG.map(g => <OrgLogo key={g.id} name={g.name} logo={g.logo} size={28}/>)}</span>
        <span style={{minWidth:0}}>
          <span style={{display:'flex', alignItems:'center', gap:4, fontSize:'var(--fs-md)', fontWeight:700}}>Артём <Icon name="chevron-d" size={14} stroke="var(--vt-icon-idle)"/></span>
          <span style={{display:'block', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>3 группы</span>
        </span>
      </button>
      {right}
      <button onClick={() => nav.toast('Уведомления')} className="vt-btn vt-btn--ghost" style={{width:44, height:44, padding:0, flexShrink:0}}><Icon name="bell" size={18}/></button>
    </div>
  );
};
const FStreak = () => <span className="vt-chip" style={{gap:5, background:'var(--vt-orange-soft)', color:'var(--vt-orange-ink)', flexShrink:0}}><Icon name="star" size={12} sw={2.2}/>6 нед.</span>;

const FNextHero = ({ extra }) => {
  const nav = useNav();
  return (
    <button onClick={() => nav.toast('Событие · МинскВолей')} className="vt-card vt-card--hero" style={{padding:18, width:'100%', textAlign:'left', cursor:'pointer', color:'var(--vt-on-hero)', display:'flex', flexDirection:'column', gap:6}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <span className="vt-cap" style={{opacity:.75}}>Сегодня · МинскВолей</span>
        <span className="vt-chip" style={{background:'var(--vt-on-hero)', color:'var(--vt-blue-ink)', gap:4}}><Icon name="check" size={12} sw={2.4}/>Иду</span>
      </div>
      <div style={{display:'flex', alignItems:'baseline', gap:10}}>
        <span className="vt-mono" style={{fontSize:'var(--fs-5xl)', fontWeight:700, lineHeight:.9}}>21:00</span>
        <span style={{fontSize:'var(--fs-base)', fontWeight:600}}>Вечерняя</span>
      </div>
      <div style={{fontSize:'var(--fs-xs)', opacity:.78}}>Гимназия №5 · занято 11 из 12</div>
      {extra}
    </button>
  );
};

const FWeekStrip = () => {
  const d = [['Пн','done'],['Вт','game'],['Ср','game'],['Чт','train'],['Пт','mob'],['Сб','game'],['Вс','rest']];
  return (
    <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginTop:12}}>
      {d.map(([l, t], i) => (
        <div key={l} style={{display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'8px 0', borderRadius:12, background: i === 1 ? 'var(--vt-paper)' : 'transparent'}}>
          <span className="vt-cap" style={{color:'var(--vt-ink-3)'}}>{l}</span>
          {t === 'game' ? <Icon name="ball" size={16} stroke="var(--vt-blue-ink)"/> : t === 'done' ? <Icon name="check" size={16} stroke="var(--vt-grass-ink)" sw={2.4}/> : t === 'rest' ? <i style={{width:16, height:16}}/> : <FDot c="var(--vt-blue-ink)" ring={t === 'mob'} size={10}/>}
        </div>
      ))}
      <div style={{gridColumn:'1/-1', display:'flex', flexWrap:'wrap', justifyContent:'center', gap:'4px 12px', marginTop:4, fontSize:'var(--fs-2xs)', color:'var(--vt-ink-3)'}}>
        <span style={{display:'flex', alignItems:'center', gap:4}}><Icon name="ball" size={12} stroke="var(--vt-blue-ink)"/>игра</span>
        <span style={{display:'flex', alignItems:'center', gap:4}}><FDot c="var(--vt-blue-ink)" size={8}/>тренировка</span>
        <span style={{display:'flex', alignItems:'center', gap:4}}><FDot c="var(--vt-blue-ink)" ring size={8}/>мобильность</span>
        <span style={{display:'flex', alignItems:'center', gap:4}}><Icon name="check" size={12} stroke="var(--vt-grass-ink)" sw={2.4}/>сделано</span>
      </div>
    </div>
  );
};

const FWarmInGame = ({ tone = 'warm', time = '21:00', arrive = '20:55', compact }) => {
  const nav = useNav();
  const [skip, setSkip] = React.useState(false);
  const hero = tone === 'hero';
  const sub = hero ? 'var(--vt-on-hero-2)' : 'var(--vt-ink-3)';
  return (
    <div className={`vt-card ${hero ? 'vt-card--hero' : skip ? 'vt-card--cool' : ''}`} style={{padding:16, display:'flex', flexDirection:'column', gap:10, color: hero ? 'var(--vt-on-hero)' : 'var(--vt-ink)'}}>
      <div style={{display:'flex', gap:12, alignItems:'flex-start'}}>
        <Icon name={skip ? 'check' : 'clock'} size={20} stroke={hero ? 'var(--vt-on-hero)' : skip ? 'var(--vt-grass-ink)' : 'var(--vt-blue-ink)'} sw={skip ? 2.4 : 2}/>
        <div style={{flex:1, minWidth:0}}>
          <b style={{fontSize:'var(--fs-base)'}}>{skip ? 'Разминаетесь в зале' : 'Разминка входит в игру'}</b>
          <div style={{fontSize:'var(--fs-xs)', color:sub, marginTop:2, lineHeight:1.45}}>{skip ? `Напоминание отключено. Приходите к ${arrive}, разминка в ${time}.` : `${time} · 15 мин, ведёт организатор. Своя до игры не нужна.`}</div>
        </div>
      </div>
      {skip
        ? <button onClick={() => setSkip(false)} className="vt-btn vt-btn--ghost vt-btn--sm" style={{alignSelf:'flex-start'}}>Отменить</button>
        : <div style={{display:'flex', flexDirection:'column', gap:6}}>
            <button onClick={() => setSkip(true)} className="vt-btn vt-btn--sm" style={{width:'100%', whiteSpace:'nowrap', ...(hero ? {background:'var(--vt-on-hero)', color:'var(--vt-blue-ink)'} : {background:'var(--vt-ink)', color:'var(--vt-paper)'})}}>Пропустить разминку до игры</button>
            {!compact && <button onClick={() => nav.toast('Таймер в зале')} className="vt-btn vt-btn--sm" style={{width:'100%', background:'transparent', boxShadow:'none', color: hero ? 'var(--vt-on-hero)' : 'var(--vt-ink)'}}>Таймер в зале <Icon name="chevron-r" size={14} sw={2.2}/></button>}
          </div>}
    </div>
  );
};

const FPostGame = () => {
  const nav = useNav();
  return (
    <div className="vt-card vt-card--warm" style={{padding:16}}>
      <div className="vt-cap" style={{color:'var(--vt-orange-ink)'}}>После игры · Вс, Микст · VT Минск</div>
      <div style={{fontSize:'var(--fs-md)', fontWeight:700, marginTop:6}}>Как сыграли?</div>
      <div style={{display:'flex', gap:8, marginTop:12}}>
        <button onClick={() => nav.toast('Самооценка · 30 сек')} className="vt-btn vt-btn--ink vt-btn--sm" style={{flex:1}}>Самооценка</button>
        <button onClick={() => nav.toast('Голосование MVP')} className="vt-btn vt-btn--sm" style={{flex:1, background:'var(--vt-paper)'}}>MVP · до 23:00</button>
      </div>
    </div>
  );
};

// ============================================================
// Вариант A — «Лента дня»: главная становится личной
// ============================================================
const FutureVarA = () => {
  const nav = useNav();
  return (
    <FScreen>
      <FGroupsHead right={<FStreak/>}/>
      <FBody style={{display:'flex', flexDirection:'column', gap:12, paddingTop:14}}>
        <FNextHero extra={<div style={{marginTop:6, paddingTop:10, boxShadow:'inset 0 1px 0 var(--vt-on-hero-line)', fontSize:'var(--fs-xs)', display:'flex', justifyContent:'space-between'}}><span>Составы появятся в 20:00</span><span style={{opacity:.8}}>разминка в составе игры</span></div>}/>
        <FWarmInGame time="21:00" compact/>
        <FPostGame/>
        <button onClick={() => nav.toast('План AI-тренера')} className="vt-card vt-card--cool" style={{padding:16, textAlign:'left', cursor:'pointer'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span className="vt-cap" style={{color:'var(--vt-flame-ink)'}}>Тренер · подача · неделя 2</span>
            <Icon name="chevron-r" size={16} stroke="var(--vt-flame-ink)" sw={2.2}/>
          </div>
          <div style={{fontSize:'var(--fs-sm)', marginTop:6, color:'var(--vt-ink)'}}>Следующая: <b>Чт · техника подачи · 30 мин</b></div>
          <FWeekStrip/>
        </button>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:6}}>
          <FTitle>Моя неделя</FTitle>
          <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>все группы</span>
        </div>
        {[['Ср 3','20:00','Основа','vt'],['Сб 6','12:00','Пляж 4×4','sk'],['Вс 7','10:00','Микст · очередь','vt']].map(([d, t, n, g], i) => (
          <div key={d} style={{display:'flex', alignItems:'center', gap:12, padding:'2px 0'}}>
            <span className="vt-mono" style={{width:40, fontWeight:700, fontSize:'var(--fs-sm)'}}>{d}</span>
            <FDot c={fgOf(g).c} ring={i === 2}/>
            <span style={{flex:1, fontSize:'var(--fs-sm)', fontWeight:600}}>{n}</span>
            <span className="vt-mono" style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>{t}</span>
          </div>
        ))}
      </FBody>
      <FTabBar active="home" tabs={[['home','Главная','home'],['cal','Календарь','calendar',true],['subs','Абонементы','ticket'],['contrib','Сборы','gift'],['me','Профиль','user']]}/>
    </FScreen>
  );
};

// ============================================================
// Вариант B — отдельная вкладка «Форма»
// ============================================================
const FutureVarB = () => {
  const nav = useNav();
  const skills = [['Подача',62,'+8'],['Приём',55,'+3'],['Пас',48,'+1'],['Атака',58,'+5'],['Блок',40,'0'],['Защита',51,'+2']];
  return (
    <FScreen>
      <MiniHeader title="Форма" sub="уровень B · серия 6 недель" right={<FStreak/>}/>
      <FBody style={{display:'flex', flexDirection:'column', gap:12}}>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'2px 2px -4px'}}>Сегодня игра в 21:00 · МинскВолей</div>
        <FWarmInGame tone="hero" time="21:00"/>
        <button onClick={() => nav.toast('План AI-тренера')} className="vt-card vt-card--cool" style={{padding:16, textAlign:'left', cursor:'pointer'}}>
          <div style={{display:'flex', justifyContent:'space-between'}}><span className="vt-cap" style={{color:'var(--vt-flame-ink)'}}>План тренера · 1 из 3</span><Icon name="chevron-r" size={16} stroke="var(--vt-flame-ink)" sw={2.2}/></div>
          <FWeekStrip/>
        </button>
        <div className="vt-card" style={{padding:16}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}><FTitle size="var(--fs-lg)">Навыки</FTitle><span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>за месяц</span></div>
          <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:12}}>
            {skills.map(([n, v, dlt]) => (
              <div key={n} style={{display:'grid', gridTemplateColumns:'64px 1fr 28px', alignItems:'center', gap:8, fontSize:'var(--fs-xs)'}}>
                <span style={{color:'var(--vt-ink-3)'}}>{n}</span>
                <span style={{height:6, borderRadius:99, background:'var(--vt-bone-2)', overflow:'hidden'}}><i style={{display:'block', height:'100%', width:`${v}%`, background:'var(--vt-blue-ink)', borderRadius:99}}/></span>
                <span className="vt-mono" style={{textAlign:'right', color: dlt === '0' ? 'var(--vt-mute-2)' : 'var(--vt-grass-ink)', fontWeight:700}}>{dlt}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
          <div className="vt-card vt-card--warm" style={{padding:14}}>
            <div className="vt-cap" style={{color:'var(--vt-orange-ink)'}}>Челлендж июня</div>
            <div className="vt-mono" style={{fontSize:'var(--fs-2xl)', fontWeight:700, marginTop:6}}>3/8</div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)'}}>игр в месяце</div>
          </div>
          <div className="vt-card" style={{padding:14}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Итоги сезона</div>
            <div className="vt-mono" style={{fontSize:'var(--fs-2xl)', fontWeight:700, marginTop:6}}>24 дн.</div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)'}}>до сторис</div>
          </div>
        </div>
      </FBody>
      <FTabBar active="form" tabs={[['games','Игры','home'],['cal','Календарь','calendar',true],['form','Форма','ball',true],['wallet','Кошелёк','wallet'],['me','Профиль','user']]}/>
    </FScreen>
  );
};

// ============================================================
// Вариант C — главная меняется по фазе игры
// ============================================================
const FutureVarC = () => {
  const nav = useNav();
  const [ph, setPh] = React.useState('day');
  const phases = [['between','Между'],['day','День игры'],['after','После'],['season','Сезон']];
  return (
    <FScreen>
      <FGroupsHead right={<FStreak/>}/>
      <div style={{margin:'10px 16px 0', padding:4, display:'flex', gap:2, background:'var(--vt-bone)', borderRadius:'var(--r-field)'}}>
        {phases.map(([k, l]) => (
          <button key={k} onClick={() => setPh(k)} style={{flex:1, padding:'10px 2px', minHeight:40, whiteSpace:'nowrap', borderRadius:'var(--r-chip)', fontSize:'var(--fs-xs)', fontWeight:700, cursor:'pointer',
            background: ph === k ? 'var(--vt-raised)' : 'transparent', boxShadow: ph === k ? 'var(--vt-shadow-card)' : 'none', color: ph === k ? 'var(--vt-ink)' : 'var(--vt-mute-2)'}}>{l}</button>
        ))}
      </div>
      <FBody style={{display:'flex', flexDirection:'column', gap:12, paddingTop:12}}>
        {ph === 'between' && <>
          <div className="vt-card vt-card--hero" style={{padding:18, color:'var(--vt-on-hero)'}}>
            <div className="vt-cap" style={{opacity:.75}}>Сегодня по плану · Чт</div>
            <FTitle size="var(--fs-3xl)" style={{marginTop:8}}>Техника подачи</FTitle>
            <div style={{fontSize:'var(--fs-xs)', opacity:.8, marginTop:6}}>30 мин · 3 упражнения · нужен мяч</div>
            <button onClick={() => nav.toast('Тренировка')} className="vt-btn vt-btn--sm" style={{marginTop:14, background:'var(--vt-on-hero)', color:'var(--vt-blue-ink)'}}>Начать</button>
          </div>
          <div className="vt-card vt-card--cool" style={{padding:16}}><span className="vt-cap" style={{color:'var(--vt-flame-ink)'}}>Неделя</span><FWeekStrip/></div>
        </>}
        {ph === 'day' && <>
          <FNextHero extra={<div style={{marginTop:8, paddingTop:10, boxShadow:'inset 0 1px 0 var(--vt-on-hero-line)'}}>
            <div style={{fontSize:'var(--fs-xs)', opacity:.8}}>Ваша команда · Синие · вы связующий</div>
            <div style={{display:'flex', gap:4, marginTop:8}}>{[0,2,4,5,8,10].map(p => <Avi key={p} idx={p} size="sm"/>)}</div>
          </div>}/>
          <FWarmInGame time="21:00"/>
        </>}
        {ph === 'after' && <>
          <div className="vt-card vt-card--hero" style={{padding:18, color:'var(--vt-on-hero)'}}>
            <div className="vt-cap" style={{opacity:.75}}>Вечерняя · МинскВолей · 23:05</div>
            <FTitle size="var(--fs-3xl)" style={{marginTop:8}}>Как сыграли?</FTitle>
            <div style={{display:'flex', gap:6, marginTop:14}}>{[1,2,3,4,5].map(n => <button key={n} onClick={() => nav.toast('Самооценка сохранена')} className="vt-mono" style={{flex:1, height:44, borderRadius:12, background:'var(--vt-on-hero-fill)', color:'var(--vt-on-hero)', fontWeight:700, fontSize:'var(--fs-md)', cursor:'pointer'}}>{n}</button>)}</div>
          </div>
          <button onClick={() => nav.toast('Голосование MVP')} className="vt-card vt-card--warm" style={{padding:16, textAlign:'left', cursor:'pointer', display:'flex', alignItems:'center', gap:12}}>
            <Icon name="trophy" size={22} stroke="var(--vt-orange-ink)"/>
            <span style={{flex:1}}><b style={{fontSize:'var(--fs-base)'}}>MVP игры · 3 номинации</b><br/><span style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)'}}>Голосование до 23:59 · проголосовали 7</span></span>
            <Icon name="chevron-r" size={16} stroke="var(--vt-orange-ink)" sw={2.2}/>
          </button>
        </>}
        {ph === 'season' && <>
          <div className="vt-card vt-card--hero" style={{padding:18, color:'var(--vt-on-hero)', background:'var(--vt-orange)'}}>
            <div className="vt-cap" style={{opacity:.85}}>Сезон весна 2026</div>
            <div className="vt-mono" style={{fontSize:'var(--fs-6xl)', fontWeight:700, lineHeight:.9, marginTop:10}}>46</div>
            <div style={{fontSize:'var(--fs-base)', fontWeight:600, marginTop:4}}>игр в трёх группах</div>
            <button onClick={() => nav.toast('Итоги сезона')} className="vt-btn vt-btn--sm" style={{marginTop:14, background:'var(--vt-on-hero)', color:'var(--vt-orange-ink)'}}>Смотреть итоги</button>
          </div>
        </>}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:4}}><FTitle>Дальше</FTitle><span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>из календаря</span></div>
        {[['Ср 3','20:00','Основа','vt'],['Сб 6','12:00','Пляж 4×4','sk']].map(([d, t, n, g]) => (
          <div key={d} style={{display:'flex', alignItems:'center', gap:12}}>
            <span className="vt-mono" style={{width:40, fontWeight:700, fontSize:'var(--fs-sm)'}}>{d}</span><FDot c={fgOf(g).c}/>
            <span style={{flex:1, fontSize:'var(--fs-sm)', fontWeight:600}}>{n}</span><span className="vt-mono" style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>{t}</span>
          </div>
        ))}
      </FBody>
      <FTabBar active="home" tabs={[['home','Главная','home'],['cal','Календарь','calendar',true],['wallet','Кошелёк','wallet'],['me','Профиль','user']]}/>
    </FScreen>
  );
};

Object.assign(window, { MyCalendar, FutureVarA, FutureVarB, FutureVarC, FDot, FTabBar, FGroupsHead, FStreak, FNextHero, FWeekStrip, FWarmInGame, FPostGame });
