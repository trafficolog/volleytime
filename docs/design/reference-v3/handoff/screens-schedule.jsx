// screens-schedule.jsx — месячное расписание (игрок и организатор) + серии тренировок

const RU_MONTH_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const RU_MONTH_NOM = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const RU_DOW = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const RU_DOW_DAT = ['воскресеньям','понедельникам','вторникам','средам','четвергам','пятницам','субботам'];
const WEEK_ORDER = [1,2,3,4,5,6,0];
const fmtDay = (d) => `${d.getDate()} ${RU_MONTH_GEN[d.getMonth()]}`;
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};
const trainings = (n) => `${n} ${plural(n, 'тренировка', 'тренировки', 'тренировок')}`;

// Постоянные слоты группы → события месяца (реальные дни недели)
const GROUP_SLOTS = [
  { dow:3, t:'20:00', title:'Основа',        venue:'Школа №24',      cap:14 },
  { dow:5, t:'19:30', title:'Открытая игра', venue:'СК «Заслонова»', cap:14 },
  { dow:0, t:'10:00', title:'Микст',         venue:'Школа №24',      cap:14 },
];
const monthEvents = (y, m) => {
  const out = [];
  const days = new Date(y, m + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const date = new Date(y, m, d);
    GROUP_SLOTS.forEach((s, si) => {
      if (date.getDay() !== s.dow) return;
      const k = d * 7 + si + m;
      const taken = Math.min(s.cap, 5 + (k * 5) % 10);
      const ev = {
        id:`m${y}-${m}-${d}-${si}`, d, date: fmtDay(date), day: RU_DOW[date.getDay()],
        time: s.t, title: s.title, venue: s.venue,
        main: `${taken}/${s.cap}`, m: `${taken}/${s.cap}`,
        meterPct: Math.round(taken / s.cap * 100), meter: Math.round(taken / s.cap * 100),
        status: taken >= s.cap ? 'full' : 'open', joined: k % 4 === 0,
      };
      if (ev.status === 'full' && !ev.joined && k % 3 === 0) { ev.inWaitlist = true; ev.waitPos = 2; }
      out.push(ev);
    });
  }
  return out;
};

// ============================================================
// ScheduleMonth — календарь месяца + список, общий для ролей
// ============================================================
const ScheduleMonth = ({ role = 'player' }) => {
  const nav = useNav();
  const [[y, m], setYm] = React.useState([2026, 5]);
  const [view, setView] = React.useState('cal');
  const [only, setOnly] = React.useState('all');
  const [sel, setSel] = React.useState(null);

  const all = monthEvents(y, m);
  const evs = only === 'mine' ? all.filter(e => e.joined || e.inWaitlist) : all;
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const byDay = (d) => evs.filter(e => e.d === d);
  const selDay = sel ?? (evs[0] && evs[0].d);
  const shift = (k) => {
    let nm = m + k, ny = y;
    if (nm < 0) { nm = 11; ny--; } if (nm > 11) { nm = 0; ny++; }
    setYm([ny, nm]); setSel(null);
  };
  const open = (e) => nav.push(role === 'org' ? 'event-detail' : 'event', { event: e });
  const mineCount = all.filter(e => e.joined).length;

  const Row = ({ e, i }) => (
    <button onClick={() => open(e)} style={{
      display:'flex', alignItems:'center', gap:14, width:'100%', textAlign:'left', cursor:'pointer',
      padding:'12px 0', boxShadow: i ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none'
    }}>
      <div style={{width:40, textAlign:'center', flexShrink:0}}>
        <div className="vt-mono" style={{fontSize:'var(--fs-2xl)', fontWeight:700, lineHeight:1}}>{e.d}</div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:4}}>{e.day}</div>
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:'var(--fs-base)', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{e.title}</div>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4}}>{e.time} · {e.venue}</div>
      </div>
      <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0}}>
        {role === 'player' && <MyChip e={e}/>}
        <SeatsMini e={e} width={48}/>
      </div>
    </button>
  );

  // группировка по неделям для списка
  const weeks = [];
  evs.forEach(e => {
    const wk = Math.floor((e.d + lead - 1) / 7);
    (weeks[wk] = weeks[wk] || []).push(e);
  });

  return (
    <>
      <MiniHeader title="Расписание" sub={`${trainings(all.length)} · ${role === 'player' ? `вы записаны на ${mineCount}` : 'вся группа'}`} onBack
        right={role === 'org' ? (
          <button onClick={() => nav.push('create')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{width:44, height:44, padding:0}}><Icon name="plus" size={18}/></button>
        ) : null}/>

      <div className="vt-phone__body" style={{padding:'8px 16px 16px'}}>
        {/* Month switcher */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <button onClick={() => shift(-1)} className="vt-btn vt-btn--ghost" style={{width:44, height:44, padding:0}} aria-label="Предыдущий месяц"><Icon name="chevron-l" size={18}/></button>
          <h2 style={{fontSize:'var(--fs-2xl)'}}>{RU_MONTH_NOM[m]} {y}</h2>
          <button onClick={() => shift(1)} className="vt-btn vt-btn--ghost" style={{width:44, height:44, padding:0}} aria-label="Следующий месяц"><Icon name="chevron-r" size={18}/></button>
        </div>

        {/* View + filter */}
        <div style={{display:'flex', gap:8, marginTop:12}}>
          <div style={{display:'flex', flex:1, padding:4, gap:2, background:'var(--vt-bone)', borderRadius:'var(--r-field)'}}>
            {[['cal','Календарь'],['list','Список']].map(([k, l]) => (
              <button key={k} onClick={() => setView(k)} style={{
                flex:1, padding:'10px 0', borderRadius:'var(--r-chip)', fontSize:'var(--fs-sm)', fontWeight:700, cursor:'pointer',
                background: view === k ? 'var(--vt-raised)' : 'transparent',
                boxShadow: view === k ? 'var(--vt-shadow-card)' : 'none',
                color: view === k ? 'var(--vt-ink)' : 'var(--vt-mute-2)'
              }}>{l}</button>
            ))}
          </div>
          {role === 'player' && (
            <button onClick={() => { setOnly(o => o === 'all' ? 'mine' : 'all'); setSel(null); }} className="vt-btn vt-btn--sm" style={{
              background: only === 'mine' ? 'var(--vt-blue-ink)' : 'var(--vt-ctl)',
              color: only === 'mine' ? 'var(--vt-on-hero)' : 'var(--vt-ink)', gap:6
            }}>
              <Icon name="check" size={13} sw={2.4}/>Мои
            </button>
          )}
        </div>

        {view === 'cal' ? (
          <>
            <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4, marginTop:16}}>
              {WEEK_ORDER.map(d => <div key={d} className="vt-cap" style={{textAlign:'center', color:'var(--vt-mute-2)', paddingBottom:4}}>{RU_DOW[d]}</div>)}
              {cells.map((d, i) => {
                if (!d) return <div key={`e${i}`}/>;
                const list = byDay(d);
                const isSel = d === selDay;
                const mine = list.some(e => e.joined || e.inWaitlist);
                return (
                  <button key={d} onClick={() => list.length && setSel(d)} style={{
                    height:48, borderRadius:'var(--r-field)', cursor: list.length ? 'pointer' : 'default',
                    background: isSel ? 'var(--vt-ink)' : list.length ? 'var(--vt-ctl)' : 'transparent',
                    color: isSel ? 'var(--vt-paper)' : list.length ? 'var(--vt-ink)' : 'var(--vt-mute)',
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4
                  }}>
                    <span className="vt-mono" style={{fontSize:'var(--fs-md)', fontWeight:700, lineHeight:1}}>{d}</span>
                    {list.length > 0 && (
                      <span style={{display:'flex', gap:4}}>
                        {list.map(e => (
                          <i key={e.id} style={{width:6, height:6, borderRadius:'var(--r-pill)', display:'block',
                            background: e.joined ? (isSel ? 'var(--vt-on-hero)' : 'var(--vt-blue-ink)') : 'transparent',
                            boxShadow: e.joined ? 'none' : `inset 0 0 0 1.5px ${isSel ? 'var(--vt-on-hero-3)' : e.inWaitlist ? 'var(--vt-flame-ink)' : 'var(--vt-icon-idle)'}`}}/>
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{display:'flex', gap:14, marginTop:12, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>
              <span style={{display:'flex', alignItems:'center', gap:6}}><i style={{width:7, height:7, borderRadius:'var(--r-pill)', background:'var(--vt-blue-ink)', display:'block'}}/>вы идёте</span>
              <span style={{display:'flex', alignItems:'center', gap:6}}><i style={{width:7, height:7, borderRadius:'var(--r-pill)', boxShadow:'inset 0 0 0 1.5px var(--vt-icon-idle)', display:'block'}}/>тренировка</span>
            </div>

            <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:20}}>
              {selDay ? `${selDay} ${RU_MONTH_GEN[m]}` : 'Нет тренировок'}
            </div>
            <div style={{marginTop:2}}>
              {(selDay ? byDay(selDay) : []).map((e, i) => <Row key={e.id} e={e} i={i}/>)}
            </div>
          </>
        ) : (
          <div style={{marginTop:8}}>
            {weeks.filter(Boolean).map((list, wi) => (
              <div key={wi} style={{marginTop:14}}>
                <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>
                  {list[0].d}–{list[list.length - 1].d} {RU_MONTH_GEN[m]}
                </div>
                {list.map((e, i) => <Row key={e.id} e={e} i={i}/>)}
              </div>
            ))}
            {evs.length === 0 && (
              <div style={{padding:'40px 8px', textAlign:'center', fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>В этом месяце у вас нет записей</div>
            )}
          </div>
        )}
      </div>
      {role === 'org' ? <OrgTabBar active="home"/> : <TabBar active="home"/>}
    </>
  );
};

// ============================================================
// RecurrenceBlock — серия тренировок одним действием
// ============================================================
const RecurrenceBlock = ({ start = new Date(2026, 5, 6), balance = 32, onCount, wide }) => {
  const [freq, setFreq] = React.useState('weekly');
  const [dows, setDows] = React.useState([start.getDay()]);
  const [span, setSpan] = React.useState('quarter');
  const SPANS = { month:['Месяц', 1], quarter:['Квартал', 3], half:['Полгода', 6], year:['Год', 12] };

  const end = new Date(start); end.setMonth(end.getMonth() + SPANS[span][1]);
  const weekStart = new Date(start); weekStart.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const dates = [];
  if (freq === 'none') dates.push(new Date(start));
  else {
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      if (!dows.includes(d.getDay())) continue;
      const wk = Math.floor((d - weekStart) / 864e5 / 7);
      if (freq === 'biweekly' && wk % 2) continue;
      dates.push(new Date(d));
    }
  }
  const n = dates.length;
  const busy = freq === 'none' ? -1 : 2;              // демонстрация: зал занят на третьей дате
  const short = Math.max(0, n - balance);
  React.useEffect(() => { onCount && onCount(n); }, [n]);

  const toggleDow = (d) => setDows(s => s.includes(d) ? (s.length > 1 ? s.filter(x => x !== d) : s) : [...s, d]);
  const daysText = WEEK_ORDER.filter(d => dows.includes(d)).map(d => RU_DOW_DAT[d]);
  const rule = freq === 'none' ? 'один раз'
    : `${freq === 'biweekly' ? 'раз в две недели' : 'каждую неделю'} по ${daysText.length > 1 ? daysText.slice(0, -1).join(', ') + ' и ' + daysText.slice(-1) : daysText[0]}`;
  const Seg = ({ value, set, opts }) => (
    <div style={{display:'flex', padding:4, gap:2, background:'var(--vt-bone)', borderRadius:'var(--r-field)'}}>
      {opts.map(([k, l]) => (
        <button key={k} onClick={() => set(k)} style={{
          flex:1, padding:'10px 4px', borderRadius:'var(--r-chip)', fontSize:'var(--fs-sm)', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
          background: value === k ? 'var(--vt-raised)' : 'transparent',
          boxShadow: value === k ? 'var(--vt-shadow-card)' : 'none',
          color: value === k ? 'var(--vt-ink)' : 'var(--vt-mute-2)'
        }}>{l}</button>
      ))}
    </div>
  );

  return (
    <div style={{display:'flex', flexDirection:'column', gap:14}}>
      <div>
        <label className="vt-label">Повторять</label>
        <Seg value={freq} set={setFreq} opts={[['none','Один раз'],['weekly','Каждую неделю'],['biweekly','Раз в 2 недели']]}/>
      </div>

      {freq !== 'none' && (
        <>
          <div>
            <label className="vt-label">По дням</label>
            <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:6}}>
              {WEEK_ORDER.map(d => {
                const on = dows.includes(d);
                return (
                  <button key={d} onClick={() => toggleDow(d)} aria-pressed={on} style={{
                    height:42, borderRadius:'var(--r-field)', fontSize:'var(--fs-sm)', fontWeight:700, cursor:'pointer',
                    background: on ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: on ? 'var(--vt-paper)' : 'var(--vt-ink-3)'
                  }}>{RU_DOW[d]}</button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="vt-label">Как долго</label>
            <Seg value={span} set={setSpan} opts={Object.entries(SPANS).map(([k, [l]]) => [k, l])}/>
          </div>
        </>
      )}

      {/* Preview */}
      <div className="vt-card vt-card--cool" style={{padding:16}}>
        <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:10}}>
          <div style={{display:'flex', alignItems:'baseline', gap:8}}>
            <span className="vt-mono" style={{fontSize:'var(--fs-5xl)', fontWeight:700, lineHeight:1}}>{n}</span>
            <span style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{plural(n, 'тренировка', 'тренировки', 'тренировок')}</span>
          </div>
          <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', textAlign:'right'}}>{(() => {
            const a = dates[0], b = dates[n - 1];
            const cross = n > 1 && a.getFullYear() !== b.getFullYear();
            const f = (d) => cross ? `${fmtDay(d)} ${d.getFullYear()}` : fmtDay(d);
            return n > 1 ? `${f(a)} — ${f(b)}` : f(a);
          })()}</span>
        </div>
        <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-ink-3)', marginTop:6}}>{rule[0].toUpperCase() + rule.slice(1)}</div>
        <div style={{display:'flex', flexWrap:'wrap', gap:6, marginTop:12}}>
          {dates.slice(0, wide ? 12 : 8).map((d, i) => (
            <span key={i} className={`vt-chip ${i === busy ? 'vt-chip--amber' : ''}`} style={i === busy ? null : {background:'var(--vt-paper)', borderColor:'transparent'}}>
              {`${RU_DOW[d.getDay()]} ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`}
            </span>
          ))}
          {n > (wide ? 12 : 8) && <span className="vt-chip vt-chip--state">{`+${n - (wide ? 12 : 8)}`}</span>}
        </div>
        {busy >= 0 && busy < n && (
          <div style={{display:'flex', gap:8, alignItems:'flex-start', marginTop:12, fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', lineHeight:1.45}}>
            <Icon name="bell" size={14} stroke="var(--vt-amber-ink)"/>
            <span>{fmtDay(dates[busy])} — в зале уже есть бронь на это время. Дата будет создана черновиком, её можно перенести.</span>
          </div>
        )}
      </div>

      {/* Credits */}
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:'var(--r-btn)', background: short ? 'var(--vt-amber-soft)' : 'var(--vt-bone)'}}>
        <Icon name="ticket" size={16} stroke={short ? 'var(--vt-amber-ink)' : 'var(--vt-icon-idle)'}/>
        <div style={{flex:1, fontSize:'var(--fs-sm)', lineHeight:1.4}}>
          {short
            ? <>Нужно <b>{n} credits</b>, на балансе {balance}. Опубликуем первые {balance}, остальные {short} станут черновиками до пополнения.</>
            : <>Спишется <b>{n} {plural(n, 'credit', 'credits', 'credits')}</b> — по одному на тренировку. На балансе {balance}, останется {balance - n}.</>}
        </div>
      </div>
      <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', lineHeight:1.45}}>
        Серию можно отредактировать целиком или любую дату отдельно. Отмена будущих дат возвращает credits.
      </div>
    </div>
  );
};

const PlayerSchedule = () => <ScheduleMonth role="player"/>;
const OrgSchedule = () => <ScheduleMonth role="org"/>;

Object.assign(window, { ScheduleMonth, PlayerSchedule, OrgSchedule, RecurrenceBlock, plural, trainings, monthEvents });
