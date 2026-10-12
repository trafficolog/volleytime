// screens-ideas-1.jsx — гипотезы вовлечения игрока: оболочка, AI-тренер (агент), разминка

const IdeaPhone = ({ children, height = 780 }) => {
  const { ctx, sheet, popover, toast, alertCfg } = useNavState('demo');
  const fitRef = React.useRef(null);
  const [k, setK] = React.useState(1);
  React.useLayoutEffect(() => {
    const el = fitRef.current?.parentElement; if (!el) return;
    const upd = () => { const cs = getComputedStyle(el); const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); setK(Math.min(1, Math.max(0.6, w / 390))); };
    upd(); const ro = new ResizeObserver(upd); ro.observe(el); addEventListener('resize', upd); return () => { ro.disconnect(); removeEventListener('resize', upd); };
  }, []);
  return (
    <NavContext.Provider value={ctx}>
      <div ref={fitRef} className="vt-phone vt-frame vt-phone--fit" data-vt-popover-root="" style={{
        zoom: k < 1 ? k : undefined, maxWidth:'none',
        width:390, minHeight:height, borderRadius:32, overflow:'hidden', position:'relative', flexShrink:0,
        display:'flex', flexDirection:'column', background:'var(--vt-paper)',
        boxShadow:'0 1px 2px rgba(21,22,26,.06), 0 18px 40px -18px rgba(21,22,26,.28)'
      }}>
        {children}
        <NavOverlays sheet={sheet} popover={popover} toast={toast} alertCfg={alertCfg} ctx={ctx}/>
      </div>
    </NavContext.Provider>
  );
};

const H = ({ children, size = 'var(--fs-3xl)', style }) => (
  <div style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, letterSpacing:0, lineHeight:1, fontSize:size, ...style}}>{children}</div>
);
const Pick = ({ on, onClick, children }) => (
  <button onClick={onClick} className="vt-chip" style={{cursor:'pointer', padding:'10px 14px', minHeight:40, fontSize:'var(--fs-sm)',
    background: on ? 'var(--vt-ink)' : 'var(--vt-ctl-chip)', color: on ? 'var(--vt-paper)' : 'var(--vt-ink)'}}>{children}</button>
);
const Dot = ({ c }) => <span style={{width:8, height:8, borderRadius:'50%', background:c, display:'inline-block', flexShrink:0}}/>;

// ============================================================
// 1 · AI-тренер — агент собирает план вокруг расписания игрока
// ============================================================
const GAME_DAYS = { 'Ср':'Основа · 20:00', 'Пт':'Открытая игра · 19:30', 'Вс':'Микст · 10:00' };
const FALLBACK_PLAN = (goal) => ({
  title: `${goal} · неделя 1`,
  why: 'Игры в ср, пт и вс — тренировки ставлю в дни между ними, накануне игры только мобильность.',
  days: [
    { d:'Пн', type:'session', title:'Техника подачи', min:30, items:[
      { name:'Подача в зону 1–5–6', dose:'5 × 10', cue:'Подброс на вытянутую руку, удар перед собой' },
      { name:'Подача на точность по мишеням', dose:'3 × 8', cue:'Цель — 6 из 8 в зону' },
      { name:'Плечо: резинка, наружная ротация', dose:'3 × 15', cue:'Локоть прижат' } ] },
    { d:'Вт', type:'mobility', title:'Мобильность · 15 мин', min:15, items:[
      { name:'Грудной отдел, «книжка»', dose:'2 × 10', cue:'Медленно' },
      { name:'Голеностоп у стены', dose:'2 × 12', cue:'Пятка на полу' } ] },
    { d:'Ср', type:'game' },
    { d:'Чт', type:'session', title:'Сила для подачи и прыжка', min:30, items:[
      { name:'Медбол: бросок из-за головы', dose:'4 × 8', cue:'Взрывно, от ног' },
      { name:'Выпрыгивания на тумбу', dose:'4 × 6', cue:'Мягкое приземление' },
      { name:'Планка с касанием плеча', dose:'3 × 30 с', cue:'Таз неподвижен' } ] },
    { d:'Пт', type:'game' },
    { d:'Сб', type:'rest' },
    { d:'Вс', type:'game' },
  ]
});

const STEP = { schedule:'Смотрю ваше расписание игр', profile:'Читаю уровень и самооценки', pick:'Подбираю упражнения под цель', place:'Расставляю нагрузку между играми' };
const makeTools = (onStep) => [
  { name:'get_schedule', description:'Расписание игр игрока на неделю (дни и время)', input_schema:{ type:'object', properties:{}, required:[] },
    run: async () => { onStep(STEP.schedule); return JSON.stringify(Object.entries(GAME_DAYS).map(([d, v]) => ({ day:d, game:v }))); } },
  { name:'get_player_profile', description:'Уровень, амплуа, посещаемость и последние самооценки игрока', input_schema:{ type:'object', properties:{}, required:[] },
    run: async () => { onStep(STEP.profile); return JSON.stringify({ level:'B', role:'доигровщик', gamesLast30:11, selfRatings:{ подача:2.8, приём:3.6, пас:3.2, нападение:3.4, блок:2.6 }, injuries:'иногда тянет плечо' }); } },
];

const askCoach = async (form, feedback, prev, onStep = () => {}) => {
  const tools = makeTools((s) => { onStep(s); });
  if (!window.claude || !window.claude.complete) {
    // без модели: те же инструменты, шаблонный план
    for (const t of tools) { await t.run(); await new Promise(r => setTimeout(r, 350)); }
    onStep(STEP.pick); await new Promise(r => setTimeout(r, 350)); onStep(STEP.place);
    return null;
  }
  const system = 'Ты волейбольный тренер для любителей. Сначала вызови get_schedule и get_player_profile, затем составь план на 7 дней (Пн–Вс). В дни игр ставь type "game", накануне игры — только "mobility" или "rest". Ответ — ТОЛЬКО JSON без пояснений: {"title":string,"why":string (1–2 предложения, почему так),"days":[{"d":"Пн","type":"session|mobility|rest|game","title":string,"min":number,"items":[{"name":string,"dose":string,"cue":string}]}]}. Для session 2–4 упражнения, для mobility 2. Пиши по-русски, коротко.';
  const user = `Цель: ${form.goal}. Где: ${form.place}. Инвентарь: ${form.gear.join(', ') || 'нет'}. Тренировок в неделю: ${form.times}, по ${form.min} минут.` + (feedback ? `\nТекущий план: ${JSON.stringify(prev)}\nПросьба игрока: ${feedback}. Перестрой план с учётом просьбы.` : '');
  try {
    const text = await window.claude.complete({ system, messages:[{ role:'user', content:user }], tools, max_tokens: 2000 });
    onStep(STEP.pick);
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const p = JSON.parse(json);
    onStep(STEP.place);
    return p && Array.isArray(p.days) ? p : null;
  } catch (e) { return null; }
};

const AICoach = () => {
  const nav = useNav();
  const [step, setStep] = React.useState('form');
  const [form, setForm] = React.useState({ goal:'Подача', place:'Зал', gear:['Мяч','Резинка'], times:2, min:30 });
  const [plan, setPlan] = React.useState(null);
  const [agentLog, setAgentLog] = React.useState([]);
  const [done, setDone] = React.useState({});
  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const tog = (v) => set('gear', form.gear.includes(v) ? form.gear.filter(x => x !== v) : [...form.gear, v]);

  const build = async (feedback) => {
    setBusy(true);
    if (!feedback) setStep('agent');
    setAgentLog([]);
    const p = await askCoach(form, feedback, plan, (s) => setAgentLog(l => l.includes(s) ? l : [...l, s]));
    setTimeout(() => {
      setPlan(p ? { ...p, source:'ai' } : { ...FALLBACK_PLAN(form.goal), source:'template' });
      setStep('plan'); setBusy(false); setMsg('');
      if (feedback) nav.toast(p ? 'План перестроен' : 'Модель недоступна — показан шаблон');
    }, 400);
  };

  if (step === 'form') return (
    <>
      <MiniHeader title="AI-тренер" sub="План под ваши игры" onBack/>
      <div className="vt-phone__body" style={{padding:'4px 16px 16px'}}>
        <div className="vt-card vt-card--hero" style={{padding:20}}>
          <div>
            <div className="vt-cap" style={{color:'var(--vt-on-hero-3)'}}>Агент</div>
            <H size="var(--fs-3xl)" style={{marginTop:8}}>Что подтянуть?</H>
            <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-on-hero-2)', marginTop:8, lineHeight:1.45}}>Тренер посмотрит ваши игры и самооценки и соберёт план на неделю вокруг них.</div>
          </div>
        </div>
        {[
          ['Цель', 'goal', ['Подача','Приём','Пас','Нападение','Блок','Прыжок','Выносливость']],
          ['Где', 'place', ['Зал','Дома','Улица']],
        ].map(([l, k, opts]) => (
          <div key={k} style={{marginTop:18}}>
            <div className="vt-label">{l}</div>
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>{opts.map(o => <Pick key={o} on={form[k] === o} onClick={() => set(k, o)}>{o}</Pick>)}</div>
          </div>
        ))}
        <div style={{marginTop:18}}>
          <div className="vt-label">Инвентарь</div>
          <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>{['Мяч','Резинка','Медбол','Скакалка','Тумба'].map(o => <Pick key={o} on={form.gear.includes(o)} onClick={() => tog(o)}>{o}</Pick>)}</div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:18}}>
          {[['Раз в неделю','times',[1,2,3]],['Минут','min',[20,30,45]]].map(([l, k, opts]) => (
            <div key={k}>
              <div className="vt-label">{l}</div>
              <div style={{display:'flex', padding:3, gap:2, borderRadius:'var(--r-btn)', background:'var(--vt-ctl-track)'}}>
                {opts.map(o => <button key={o} onClick={() => set(k, o)} style={{flex:1, padding:'8px 0', borderRadius:'var(--r-field)', cursor:'pointer', fontFamily:'var(--f-num)', fontWeight:700, fontSize:'var(--fs-md)', background: form[k] === o ? 'var(--vt-ink)' : 'transparent', color: form[k] === o ? '#fff' : 'var(--vt-ink)'}}>{o}</button>)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:'12px 16px 18px'}}>
        <button onClick={() => build()} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full">Собрать план</button>
      </div>
    </>
  );

  if (step === 'agent') return (
    <>
      <MiniHeader title="AI-тренер" sub="Собираю план"/>
      <div className="vt-phone__body" style={{padding:'24px 20px', display:'flex', flexDirection:'column', justifyContent:'center'}}>
        <H size="var(--fs-4xl)">Думаю<br/>над планом</H>
        <div style={{display:'flex', flexDirection:'column', gap:12, marginTop:28}}>
          {Object.values(STEP).map((s, i) => {
            const ok = agentLog.includes(s);
            return (
              <div key={s} style={{display:'flex', alignItems:'center', gap:12, opacity: ok ? 1 : .45, transition:'opacity .3s'}}>
                <span style={{width:26, height:26, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', background: ok ? 'var(--vt-flame)' : 'var(--vt-bone)'}}>
                  {ok ? <Icon name="check" size={13} stroke="#fff" sw={2.6}/> : <span className="vt-mono" style={{fontSize:'var(--fs-xs)'}}>{i+1}</span>}
                </span>
                <span style={{fontSize:'var(--fs-base)', fontWeight:600}}>{s}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  const doneCount = Object.values(done).filter(Boolean).length;
  const sessions = plan.days.filter(d => d.type === 'session' || d.type === 'mobility');
  return (
    <>
      <MiniHeader title="План на неделю" sub={plan.source === 'template' ? 'шаблон · модель недоступна' : plan.title} onBack={() => setStep('form')}/>
      <div className="vt-phone__body" style={{padding:'4px 16px 12px'}}>
        <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:10}}>
          <div className="vt-card vt-card--hero" style={{padding:16}}>
            <div className="vt-cap" style={{color:'var(--vt-on-hero-3)'}}>Цель</div>
            <H size="var(--fs-2xl)" style={{marginTop:6}}>{form.goal}</H>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-on-hero-2)', marginTop:8, lineHeight:1.4}}>{plan.why}</div>
          </div>
          <div className="vt-card vt-card--warm" style={{padding:16, display:'flex', flexDirection:'column'}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Сделано</div>
            <div style={{marginTop:'auto'}}><span className="vt-mono" style={{fontSize:'var(--fs-4xl)', fontWeight:700}}>{doneCount}</span><span className="vt-mono" style={{fontSize:'var(--fs-lg)', color:'var(--vt-mute-2)'}}> из {sessions.length}</span></div>
          </div>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:14}}>
          {plan.days.map((d, i) => {
            if (d.type === 'game') return (
              <div key={i} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:'var(--r-tile)', background:'var(--vt-blue-soft-tile)'}}>
                <span className="vt-mono" style={{width:28, fontWeight:700}}>{d.d}</span>
                <Icon name="court" size={16}/><span style={{fontSize:'var(--fs-sm)', fontWeight:700}}>Игра · {GAME_DAYS[d.d] || 'по расписанию'}</span>
              </div>
            );
            if (d.type === 'rest') return (
              <div key={i} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 12px', fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>
                <span className="vt-mono" style={{width:28, fontWeight:700, color:'var(--vt-ink)'}}>{d.d}</span>Отдых
              </div>
            );
            const key = d.d, isDone = !!done[key];
            return (
              <div key={i} className="vt-card" style={{padding:14, filter: isDone ? 'grayscale(1)' : 'none'}}>
                <div style={{display:'flex', alignItems:'center', gap:12}}>
                  <span className="vt-mono" style={{width:28, fontWeight:700}}>{d.d}</span>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:'var(--fs-base)', fontWeight:700}}>{d.title}</div>
                    <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{d.min} мин · {(d.items || []).length} упр.</div>
                  </div>
                  <button onClick={() => { setDone(s => ({ ...s, [key]: !s[key] })); if (!isDone) nav.toast('Отмечено · тренер учтёт в следующем плане'); }}
                    aria-label="Отметить выполнено" aria-pressed={isDone} style={{width:44, height:44, borderRadius:'50%', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center',
                      background: isDone ? 'var(--vt-flame)' : 'var(--vt-paper)'}}>
                    <Icon name="check" size={16} stroke={isDone ? '#fff' : 'var(--vt-icon-idle)'} sw={2.4}/>
                  </button>
                </div>
                <div style={{marginTop:10, display:'flex', flexDirection:'column', gap:8, paddingLeft:40}}>
                  {(d.items || []).map((it, j) => (
                    <div key={j}>
                      <div style={{display:'flex', justifyContent:'space-between', gap:8, fontSize:'var(--fs-sm)'}}><span style={{fontWeight:600}}>{it.name}</span><span className="vt-mono" style={{fontWeight:700, flexShrink:0}}>{it.dose}</span></div>
                      <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{it.cue}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{padding:'10px 16px 16px', display:'flex', gap:8}}>
        <input className="vt-field" value={msg} onChange={e => setMsg(e.target.value)} placeholder="Например: короче, нет мячей, болит плечо" aria-label="Попросить тренера"
          onKeyDown={e => { if (e.key === 'Enter' && msg.trim() && !busy) build(msg.trim()); }}/>
        <button onClick={() => msg.trim() && !busy && build(msg.trim())} className="vt-btn vt-btn--ink" style={{flexShrink:0, width:48, padding:0}} aria-label="Отправить">
          {busy ? <span className="vt-mono">…</span> : <Icon name="send" size={16}/>}
        </button>
      </div>
    </>
  );
};

// ============================================================
// 2 · Разминка перед игрой — таймер
// ============================================================
const WARMUP = [
  ['Бег на месте, высокое колено', 60], ['Махи руками, круги плечами', 60], ['Выпады с поворотом корпуса', 60],
  ['Голеностоп и колени', 45], ['Прыжки «блок» на месте', 60], ['Резинка: наружная ротация плеча', 60],
  ['Пасы в стену', 75], ['Ускорения 3 × 5 м', 60],
];
const WarmupTimer = ({ onBack, inGame }) => {
  const [i, setI] = React.useState(0);
  const [left, setLeft] = React.useState(WARMUP[0][1]);
  const [run, setRun] = React.useState(false);
  React.useEffect(() => {
    if (!run) return;
    const t = setInterval(() => setLeft(l => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [run]);
  React.useEffect(() => {
    if (!run || left > 0) return;
    if (i >= WARMUP.length - 1) { setRun(false); return; }
    setI(i + 1); setLeft(WARMUP[i + 1][1]);
  }, [left, run]);
  const total = WARMUP.reduce((s, w) => s + w[1], 0);
  const passed = WARMUP.slice(0, i).reduce((s, w) => s + w[1], 0) + (WARMUP[i][1] - left);
  const mm = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return (
    <>
      <MiniHeader title="Разминка" sub={inGame ? 'В составе игры · идёт в зале' : 'Основа · сегодня 20:00'} onBack={onBack}/>
      <div className="vt-phone__body" style={{padding:'4px 16px 16px'}}>
        <div className="vt-card vt-card--hero" style={{padding:22, textAlign:'center', position:'relative', overflow:'hidden'}}>
          <div className="vt-cap" style={{color:'var(--vt-on-hero-3)'}}>Упражнение {i + 1} из {WARMUP.length}</div>
          <div className="vt-mono" style={{fontSize:'var(--fs-7xl)', fontWeight:700, lineHeight:1, marginTop:16}}>{mm(left)}</div>
          <div style={{fontSize:'var(--fs-lg)', fontWeight:700, marginTop:12}}>{WARMUP[i][0]}</div>
          <div style={{display:'flex', gap:3, marginTop:18}}>
            {WARMUP.map((w, k) => <span key={k} style={{flex:w[1], height:6, borderRadius:'var(--r-pill)', background: k < i ? 'var(--vt-on-hero)' : k === i ? 'var(--vt-orange)' : 'var(--vt-on-hero-line)'}}/>)}
          </div>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:'var(--fs-xs)', color:'var(--vt-on-hero-3)', marginTop:8}}><span>прошло {mm(passed)}</span><span>всего {mm(total)}</span></div>
        </div>
        <div style={{display:'flex', gap:8, marginTop:12}}>
          <button onClick={() => { setI(Math.max(0, i - 1)); setLeft(WARMUP[Math.max(0, i - 1)][1]); }} className="vt-btn vt-btn--ghost vt-btn--lg" style={{width:56, padding:0}} aria-label="Назад"><Icon name="chevron-l" size={18}/></button>
          <button onClick={() => setRun(r => !r)} className="vt-btn vt-btn--primary vt-btn--lg" style={{flex:1}}>{run ? 'Пауза' : passed ? 'Продолжить' : 'Начать'}</button>
          <button onClick={() => { const n = Math.min(WARMUP.length - 1, i + 1); setI(n); setLeft(WARMUP[n][1]); }} className="vt-btn vt-btn--ghost vt-btn--lg" style={{width:56, padding:0}} aria-label="Дальше"><Icon name="chevron-r" size={18}/></button>
        </div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'20px 2px 6px'}}>Дальше</div>
        {WARMUP.map((w, k) => k > i && (
          <div key={k} style={{display:'flex', justifyContent:'space-between', padding:'11px 2px', boxShadow:'inset 0 1px 0 var(--vt-bone-2)', fontSize:'var(--fs-sm)'}}>
            <span>{w[0]}</span><span className="vt-mono" style={{fontWeight:700}}>{w[1]} с</span>
          </div>
        ))}
        <div className="vt-card vt-card--cool" style={{padding:14, marginTop:14, display:'flex', gap:10, alignItems:'flex-start'}}>
          <Icon name="bell" size={16}/>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', lineHeight:1.45}}>{inGame ? 'Тот же таймер организатор выводит на экран в зале — все разминаются синхронно.' : 'Бот напомнит за 30 минут до игры. Упражнение для плеча добавлено, потому что вы отмечали, что его тянет.'}</div>
        </div>
      </div>
    </>
  );
};

const WSeg = ({ v, set }) => (
  <div style={{display:'flex', gap:4, padding:4, borderRadius:'var(--r-pill)', background:'var(--vt-ctl-chip)'}} role="tablist" aria-label="Как организатор настроил разминку">
    {[['solo','Своя, до игры'],['game','В составе игры']].map(([k, l]) => (
      <button key={k} role="tab" aria-selected={v === k} onClick={() => set(k)} style={{flex:1, minHeight:40, border:0, cursor:'pointer', borderRadius:'var(--r-pill)', fontFamily:'inherit', fontSize:'var(--fs-sm)', fontWeight:600,
        background: v === k ? 'var(--vt-paper)' : 'transparent', color:'var(--vt-ink)', boxShadow: v === k ? 'var(--vt-shadow-card)' : 'none'}}>{l}</button>
    ))}
  </div>
);

const WarmupEvent = ({ mode, setMode, onStart }) => {
  const [skip, setSkip] = React.useState(false);
  const inGame = mode === 'game';
  const rows = inGame
    ? [['19:25','Своя разминка до игры', 'pre'], ['19:55','Сбор в зале', false], ['20:00','Разминка · 15 мин, ведёт организатор', true], ['20:15','Игра · 3 партии', false], ['21:45','Самооценка', false]]
    : [['19:30','Своя разминка · 8 мин', true], ['19:55','Сбор в зале', false], ['20:00','Игра · 3 партии', false], ['21:30','Самооценка', false]];
  return (
    <>
      <MiniHeader title="Игра сегодня" sub="Основа · Гимназия №5" onBack/>
      <div className="vt-phone__body" style={{padding:'4px 16px 16px', display:'flex', flexDirection:'column', gap:12}}>
        <div>
          <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', margin:'0 4px 6px'}}>Демо · как организатор настроил событие</div>
          <WSeg v={mode} set={(m) => { setMode(m); setSkip(false); }}/>
        </div>
        <div className="vt-card" style={{padding:16}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Программа события</div>
          {rows.map(([t, l, w]) => (
            <div key={t} style={{display:'flex', gap:12, alignItems:'center', padding:'10px 0', boxShadow:'inset 0 -1px 0 var(--vt-bone-2)', opacity: w === 'pre' && skip ? .5 : 1}}>
              <span className="vt-mono" style={{fontWeight:700, width:44, flexShrink:0}}>{t}</span>
              <span style={{flex:1, minWidth:0, fontSize:'var(--fs-sm)', fontWeight: w === true ? 700 : 500, color: w === 'pre' ? 'var(--vt-ink-3)' : 'var(--vt-ink)', textDecoration: w === 'pre' && skip ? 'line-through' : 'none'}}>{l}</span>
              {w === 'pre' && <span className="vt-chip" style={{fontSize:'var(--fs-2xs)', flexShrink:0}}>{skip ? 'пропущена' : 'не нужна'}</span>}
              {w === true && <span className="vt-chip" style={{fontSize:'var(--fs-2xs)', flexShrink:0, background: inGame ? 'var(--vt-blue-soft-tile)' : 'var(--vt-orange-soft)'}}>{inGame ? 'в игре' : 'до игры'}</span>}
            </div>
          ))}
        </div>
        {inGame ? (
          skip ? (
            <div className="vt-card vt-card--cool" style={{padding:16, display:'flex', flexDirection:'column', gap:10}}>
              <div style={{display:'flex', gap:10, alignItems:'center'}}><Icon name="check" size={18} stroke="var(--vt-grass-ink)" sw={2.4}/><b>Разминаетесь в зале</b></div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', lineHeight:1.45}}>Напоминание за 30 минут отключено. Бот напишет в 19:40: «Приходите к 19:55, в 20:00 общая разминка».</div>
              <button onClick={() => setSkip(false)} className="vt-btn vt-btn--ghost" style={{alignSelf:'flex-start'}}>Отменить</button>
            </div>
          ) : (
            <div className="vt-card vt-card--warm" style={{padding:16, display:'flex', flexDirection:'column', gap:12}}>
              <div><b>Разминка уже входит в игру</b><div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:4, lineHeight:1.45}}>Организатор проведёт её в первые 15 минут. Отдельная разминка до игры не нужна.</div></div>
              <button onClick={() => setSkip(true)} className="vt-btn vt-btn--primary vt-btn--lg">Пропустить разминку до игры</button>
              <button onClick={onStart} className="vt-btn vt-btn--ghost">Открыть таймер в зале</button>
            </div>
          )
        ) : (
          <div className="vt-card vt-card--warm" style={{padding:16, display:'flex', flexDirection:'column', gap:12}}>
            <div><b>Разминка за 30 минут до игры</b><div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:4, lineHeight:1.45}}>8 упражнений, 8 минут. Бот напомнит в 19:30.</div></div>
            <button onClick={onStart} className="vt-btn vt-btn--primary vt-btn--lg">Начать разминку</button>
          </div>
        )}
      </div>
    </>
  );
};

const Warmup = () => {
  const [mode, setMode] = React.useState('game');
  const [screen, setScreen] = React.useState('event');
  return screen === 'timer'
    ? <WarmupTimer inGame={mode === 'game'} onBack={() => setScreen('event')}/>
    : <WarmupEvent mode={mode} setMode={setMode} onStart={() => setScreen('timer')}/>;
};

Object.assign(window, { IdeaPhone, IdeaH:H, IdeaPick:Pick, IdeaDot:Dot, AICoach, Warmup, WarmupEvent, WSeg });
