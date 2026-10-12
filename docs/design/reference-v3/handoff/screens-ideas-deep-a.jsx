// screens-ideas-deep-a.jsx — глубокие флоу: AI-тренер, разминка, самооценка, прогресс
window.IDEA_FLOWS = window.IDEA_FLOWS || {};
const ihBtn = { width:44, padding:0 };

// ============================== 1 · AI-тренер ==============================
const COACH_EX = [
  { id:'serve', name:'Подача в зону 1–5–6', dose:'5 × 10', sets:5, cue:'Подброс на вытянутую руку, удар перед собой.',
    steps:['Стойка: левая нога впереди, вес на правой','Подброс на высоту вытянутой руки','Удар ладонью по центру мяча','Перенос веса вперёд, шаг в площадку'],
    errs:['Подброс за спину — мяч уходит в сетку','Удар без доворота корпуса'] },
  { id:'target', name:'Подача по мишеням', dose:'3 × 8', sets:3, cue:'Цель — 6 из 8 в зону.',
    steps:['Мишень — полотенце в зоне 1','8 подач, считаем попадания','Между сериями 60 с отдыха'], errs:['Сила вместо точности'] },
  { id:'band', name:'Резинка: наружная ротация', dose:'3 × 15', sets:3, cue:'Локоть прижат к корпусу.',
    steps:['Резинка на уровне пояса','Локоть 90°, прижат','Медленно наружу и обратно'], errs:['Локоть отходит от корпуса','Рывок вместо медленного движения'] },
];

const CoachHub = () => {
  const nav = useNav();
  const days = [['Пн','s','Подача'],['Вт','m','Мобил.'],['Ср','g','Игра'],['Чт','s','Сила'],['Пт','g','Игра'],['Сб','r','Отдых'],['Вс','g','Игра']];
  const cell = { s:['var(--vt-flame)','#fff'], m:['var(--vt-orange-soft)','var(--vt-ink)'], g:['var(--vt-blue-soft-tile)','var(--vt-ink)'], r:['var(--vt-ctl)','var(--vt-mute-2)'] };
  return (<>
    <MiniHeader title="AI-тренер" sub="Ваш план на неделю"
      right={<button onClick={() => nav.push('coach-history')} aria-label="История планов" className="vt-btn vt-btn--ghost vt-btn--sm" style={ihBtn}><Icon name="clock" size={16}/></button>}/>
    <IBody>
      <div className="vt-card vt-card--hero" style={{padding:20, position:'relative', overflow:'hidden'}}>
        <IOrb/>
        <div style={{position:'relative'}}>
          <div className="vt-cap" style={{color:'var(--vt-on-hero-3)'}}>План · неделя 1 из 4</div>
          <IdeaH size="var(--fs-5xl)" style={{marginTop:10}}>Подача</IdeaH>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-on-hero-2)', margin:'10px 0 12px'}}>1 из 3 тренировок · следующая сегодня</div>
          <IBar pct={33} dark/>
        </div>
      </div>
      <ICap>Сегодня · понедельник</ICap>
      <button onClick={() => nav.push('coach-session')} className="vt-card vt-card--raised" style={{padding:16, width:'100%', display:'flex', alignItems:'center', gap:14, textAlign:'left', cursor:'pointer'}}>
        <span style={{width:44, height:44, borderRadius:'var(--r-btn)', background:'var(--vt-flame)', display:'inline-flex', alignItems:'center', justifyContent:'center'}}><Icon name="ball" size={20} stroke="#fff"/></span>
        <span style={{flex:1}}><b style={{fontSize:'var(--fs-md)'}}>Техника подачи</b><span style={{display:'block', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>30 мин · 3 упражнения · зал</span></span>
        <Icon name="chevron-r" size={18} stroke="var(--vt-icon-idle)"/>
      </button>
      <ICap>Неделя</ICap>
      <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4}}>
        {days.map(([d, t, l], k) => (
          <div key={d} style={{borderRadius:'var(--r-field)', padding:'8px 0', textAlign:'center', background:cell[t][0], color:cell[t][1], outline: k === 0 ? '2px solid var(--vt-ink)' : 'none', outlineOffset:2}}>
            <div className="vt-mono" style={{fontWeight:700}}>{d}</div>
            <div style={{fontSize:'var(--fs-2xs)', marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>
      <ICap>Почему такой план</ICap>
      <div className="vt-card vt-card--warm" style={{padding:14, fontSize:'var(--fs-sm)', lineHeight:1.5, color:'var(--vt-ink-3)'}}>
        «Подачу» вы отмечали в трёх последних самооценках. Игры в ср, пт и вс, поэтому силовая — в четверг, а накануне игр только мобильность.
      </div>
    </IBody>
    <IFoot><button onClick={() => nav.push('coach-new')} className="vt-btn vt-btn--ghost vt-btn--lg vt-btn--full">Собрать новый план</button></IFoot>
  </>);
};

const CoachSession = () => {
  const nav = useNav();
  const [sets, setSets] = React.useState({ serve:2 });
  const total = COACH_EX.reduce((s, e) => s + e.sets, 0), done = Object.values(sets).reduce((s, v) => s + v, 0);
  return (<>
    <MiniHeader title="Техника подачи" sub="Пн · 30 мин · зал" onBack/>
    <IBody>
      <div className="vt-card" style={{padding:16}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10}}>
          <span className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Подходы</span>
          <span><span className="vt-mono" style={{fontSize:'var(--fs-2xl)', fontWeight:700}}>{done}</span><span className="vt-mono" style={{color:'var(--vt-mute-2)'}}> из {total}</span></span>
        </div>
        <IBar pct={done / total * 100}/>
      </div>
      {COACH_EX.map((e, k) => (
        <div key={e.id} className="vt-card vt-card--raised" style={{padding:14, marginTop:10}}>
          <button onClick={() => nav.push('coach-ex', { ex:e })} style={{display:'flex', alignItems:'center', gap:12, width:'100%', textAlign:'left', cursor:'pointer'}}>
            <span className="vt-mono" style={{width:22, fontWeight:700, color:'var(--vt-mute-2)'}}>{k + 1}</span>
            <span style={{flex:1}}><b style={{fontSize:'var(--fs-base)'}}>{e.name}</b><span style={{display:'block', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{e.cue}</span></span>
            <span className="vt-mono" style={{fontWeight:700}}>{e.dose}</span>
            <Icon name="chevron-r" size={16} stroke="var(--vt-icon-idle)"/>
          </button>
          <div style={{display:'flex', gap:6, marginTop:12, paddingLeft:34}}>
            {Array.from({ length:e.sets }).map((_, s) => {
              const on = s < (sets[e.id] || 0);
              return <button key={s} aria-label={`Подход ${s + 1}`} onClick={() => setSets(v => ({ ...v, [e.id]: (v[e.id] || 0) === s + 1 ? s : s + 1 }))}
                style={{flex:1, height:40, minHeight:0, borderRadius:'var(--r-field)', cursor:'pointer', background: on ? 'var(--vt-flame)' : 'var(--vt-ctl)'}}>{on && <Icon name="check" size={13} stroke="#fff" sw={2.6}/>}</button>;
            })}
          </div>
        </div>
      ))}
    </IBody>
    <IFoot><button onClick={() => nav.push('coach-done')} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full">Завершить тренировку</button></IFoot>
  </>);
};

const CoachEx = () => {
  const nav = useNav();
  const e = nav.data.ex || COACH_EX[0];
  const [left, setLeft] = React.useState(0);
  React.useEffect(() => { if (!left) return; const t = setTimeout(() => setLeft(l => l - 1), 1000); return () => clearTimeout(t); }, [left]);
  return (<>
    <MiniHeader title={e.name} sub={`${e.dose} · отдых 45 с`} onBack/>
    <IBody>
      <div style={{height:200, borderRadius:'var(--r-card)', background:'repeating-linear-gradient(135deg, var(--vt-bone) 0 14px, var(--vt-bone-2) 14px 28px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8}}>
        <Icon name="court" size={30}/><span className="vt-code" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>видео техники · 12 с</span>
      </div>
      <ICap>Как выполнять</ICap>
      {e.steps.map((s, k) => (
        <div key={k} style={{display:'flex', gap:12, padding:'10px 2px', boxShadow: k ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none'}}>
          <span className="vt-mono" style={{width:24, height:24, borderRadius:'50%', background:'var(--vt-ink)', color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'var(--fs-xs)', fontWeight:700, flexShrink:0}}>{k + 1}</span>
          <span style={{fontSize:'var(--fs-sm)', lineHeight:1.45}}>{s}</span>
        </div>
      ))}
      <ICap>Частые ошибки</ICap>
      {e.errs.map(s => <div key={s} style={{display:'flex', gap:10, alignItems:'center', padding:'8px 2px', fontSize:'var(--fs-sm)'}}><IdeaDot c="var(--vt-rose)"/>{s}</div>)}
      <div className="vt-card vt-card--cool" style={{padding:14, marginTop:14, display:'flex', gap:10, fontSize:'var(--fs-sm)', lineHeight:1.45}}><Icon name="star" size={16}/><span><b>Главное:</b> {e.cue}</span></div>
    </IBody>
    <IFoot>
      <button onClick={() => { if (!left) { setLeft(45); nav.toast('Подход записан'); } }} className={`vt-btn vt-btn--lg vt-btn--full ${left ? 'vt-btn--ghost' : 'vt-btn--primary'}`}>
        {left ? `Отдых · ${left} с` : 'Подход сделан'}
      </button>
    </IFoot>
  </>);
};

const CoachDone = () => {
  const nav = useNav();
  const [r, setR] = React.useState(null);
  const reply = { 0:'В четверг добавлю подход и усложню мишени.', 1:'Оставляю нагрузку как есть.', 2:'В четверг снижу объём на треть, плечу — больше мобильности.' };
  return (<>
    <MiniHeader title="Тренировка завершена" sub="Техника подачи · пн"/>
    <IBody>
      <IdeaH size="var(--fs-6xl)" style={{marginTop:8}}>Готово</IdeaH>
      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:18}}>
        <ITile k="Время" v="31" unit="мин"/><ITile k="Подходы" v="11" tone="cool"/><ITile k="Неделя" v="1/3" tone="warm"/>
      </div>
      <ICap>Как ощущалось?</ICap>
      <div style={{display:'flex', gap:6}}>
        {['Легко','В самый раз','Тяжело'].map((l, k) => <button key={l} onClick={() => setR(k)} className="vt-btn" style={{flex:1, background: r === k ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: r === k ? '#fff' : 'var(--vt-ink)'}}>{l}</button>)}
      </div>
      {r !== null && (
        <div className="vt-card vt-card--warm" style={{padding:14, marginTop:14, display:'flex', gap:10}}>
          <Icon name="settings" size={16}/>
          <div><div style={{fontSize:'var(--fs-sm)', fontWeight:700}}>Тренер подстроит план</div><div style={{fontSize:'var(--fs-sm)', color:'var(--vt-ink-3)', marginTop:4, lineHeight:1.45}}>{reply[r]}</div></div>
        </div>
      )}
    </IBody>
    <IFoot><button onClick={() => { nav.reset('coach-hub'); setTimeout(() => nav.toast('План обновлён'), 60); }} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full" disabled={r === null} style={{opacity: r === null ? .5 : 1}}>К плану</button></IFoot>
  </>);
};

const CoachHistory = () => {
  const nav = useNav();
  return (<>
    <MiniHeader title="История планов" sub="3 плана за сезон" onBack/>
    <IBody>
      {[['Подача','май · идёт',1,4,33,'raised'],['Приём','апрель',4,4,82,null],['Выносливость','март',3,4,58,null]].map(([g, m, w, wt, p, tone]) => (
        <button key={g} onClick={() => nav.toast(`План «${g}» · ${p}% выполнено`)} className={`vt-card${tone ? ' vt-card--' + tone : ''}`} style={{width:'100%', textAlign:'left', padding:16, marginTop:10, cursor:'pointer'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
            <IdeaH size="var(--fs-2xl)">{g}</IdeaH><span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{m}</span>
          </div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', margin:'6px 0 10px'}}>неделя {w} из {wt} · выполнено {p}%</div>
          <IBar pct={p}/>
        </button>
      ))}
      <div className="vt-card vt-card--cool" style={{padding:14, marginTop:14, fontSize:'var(--fs-sm)', lineHeight:1.45}}>После плана «Приём» самооценка приёма выросла с 3,2 до 3,6.</div>
    </IBody>
  </>);
};

IDEA_FLOWS.coach = {
  n:1, title:'AI-тренер', tag:'агент', effort:'L', href:'9.1 AI-тренер.html',
  one:'Агент собирает план тренировок на неделю вокруг ваших игр и подстраивает его по отметкам и обратной связи.',
  screens:[
    { id:'coach-hub', name:'План недели', sub:'хаб: сегодня, неделя, почему', path:['coach-hub'], C:CoachHub },
    { id:'coach-session', name:'Тренировка', sub:'упражнения и подходы', path:['coach-hub','coach-session'], C:CoachSession },
    { id:'coach-ex', name:'Упражнение', sub:'техника, ошибки, отдых', path:['coach-hub','coach-session','coach-ex'], C:CoachEx },
    { id:'coach-done', name:'Завершение', sub:'итог и ощущение', path:['coach-hub','coach-session','coach-done'], C:CoachDone },
    { id:'coach-new', name:'Новый план', sub:'цель → агент → план', path:['coach-hub','coach-new'], C:() => <AICoach/> },
    { id:'coach-history', name:'История планов', sub:'прошлые планы и эффект', path:['coach-hub','coach-history'], C:CoachHistory },
  ],
};

// ============================== 2 · Разминка ==============================
const WARM_PROGS = [
  { id:'pre', name:'Перед игрой', min:8, sub:'Основа · сегодня 20:00', steps:['Бег на месте','Махи и круги плечами','Выпады с поворотом','Голеностоп и колени','Прыжки «блок»','Резинка для плеча','Пасы в стену','Ускорения 3 × 5 м'] },
  { id:'shoulder', name:'Плечо', min:6, sub:'вы отмечали дискомфорт', steps:['Круги плечами','Резинка: наружная ротация','Резинка: внутренняя ротация','«Ангелы» у стены','Растяжка задней дельты'] },
  { id:'knees', name:'Колени и голеностоп', min:7, sub:'перед прыжковой игрой', steps:['Голеностоп у стены','Полуприсед на одной ноге','Выпады назад','Прыжки на месте','Приземление с паузой','Подъёмы на носки'] },
  { id:'cool', name:'Заминка после игры', min:5, sub:'через бот после игры', steps:['Ходьба и дыхание','Растяжка бедра','Растяжка икр','Грудной отдел','Плечо у стены'] },
];
const WARM_DUR = [45,40,45,30,40,45,60,45];
const wmin = (p) => Math.max(1, Math.round(p.steps.reduce((s, _, k) => s + WARM_DUR[k % 8], 0) / 60));
const WarmList = () => {
  const nav = useNav();
  const [p0, ...rest] = WARM_PROGS;
  return (<>
    <MiniHeader title="Разминка" sub="Готовые программы"
      right={<button onClick={() => nav.push('warm-settings')} aria-label="Настройки" className="vt-btn vt-btn--ghost vt-btn--sm" style={ihBtn}><Icon name="settings" size={16}/></button>}/>
    <IBody>
      <button onClick={() => nav.push('warm-preview', { p:p0 })} className="vt-card vt-card--hero" style={{padding:20, width:'100%', textAlign:'left', position:'relative', overflow:'hidden', cursor:'pointer'}}>
        <IOrb/>
        <div style={{position:'relative'}}>
          <div className="vt-cap" style={{color:'var(--vt-on-hero-3)'}}>Через 1 ч 40 мин · {p0.sub}</div>
          <IdeaH size="var(--fs-5xl)" style={{marginTop:10}}>{p0.name}</IdeaH>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14}}>
            <span style={{fontSize:'var(--fs-sm)', color:'var(--vt-on-hero-2)'}}>{wmin(p0)} мин · {p0.steps.length} упражнений</span>
            <span className="vt-btn vt-btn--sm" style={{background:'var(--vt-orange)', color:'#fff'}}>Открыть</span>
          </div>
        </div>
      </button>
      <ICap>Другие программы</ICap>
      {rest.map(p => <IRow key={p.id} icon="clock" title={p.name} sub={`${wmin(p)} мин · ${p.sub}`} onClick={() => nav.push('warm-preview', { p })}/>)}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:18}}>
        <ITile k="Разминок" v="9" sub="за май" tone="cool"/><ITile k="Перед играми" v="75" unit="%" tone="warm"/>
      </div>
    </IBody>
  </>);
};
const WarmPreview = () => {
  const nav = useNav();
  const p = nav.data.p || WARM_PROGS[0];
  const [team, setTeam] = React.useState(false);
  return (<>
    <MiniHeader title={p.name} sub={`${wmin(p)} мин · ${p.steps.length} упражнений`} onBack/>
    <IBody>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
        <ITile k="Время" v={wmin(p)} unit="мин" tone="cool"/><ITile k="Инвентарь" v={['pre','shoulder'].includes(p.id) ? 'резинка' : 'не нужен'} tone="warm"/>
      </div>
      <ICap>Упражнения</ICap>
      {p.steps.map((s, k) => (
        <div key={s} style={{display:'flex', alignItems:'center', gap:12, padding:'11px 2px', boxShadow: k ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none'}}>
          <span className="vt-mono" style={{width:22, fontWeight:700, color:'var(--vt-mute-2)'}}>{k + 1}</span>
          <span style={{flex:1, fontSize:'var(--fs-sm)', fontWeight:600}}>{s}</span>
          <span className="vt-mono" style={{fontWeight:700}}>{WARM_DUR[k % 8]} с</span>
        </div>
      ))}
      <button role="switch" aria-checked={team} onClick={() => setTeam(v => !v)} className="vt-card" style={{padding:14, marginTop:16, width:'100%', display:'flex', alignItems:'center', gap:12, textAlign:'left', cursor:'pointer'}}>
        <Icon name="users" size={18}/>
        <span style={{flex:1}}><b style={{fontSize:'var(--fs-sm)'}}>Для всей команды</b><span style={{display:'block', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>Таймер на экране организатора, все делают вместе</span></span>
        <span style={{width:40, height:24, borderRadius:'var(--r-pill)', background: team ? 'var(--vt-flame)' : 'var(--vt-ctl-track)', position:'relative', flexShrink:0}}>
          <span style={{position:'absolute', top:3, left: team ? 19 : 3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left .15s'}}/>
        </span>
      </button>
    </IBody>
    <IFoot><button onClick={() => nav.push('warm-run')} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full">{team ? 'Запустить для команды' : 'Начать'}</button></IFoot>
  </>);
};
const WarmSettings = () => {
  const [mins, setMins] = React.useState(30);
  const [t, setT] = React.useState({ bot:true, adapt:true, cool:false });
  const Tg = ({ k, title, sub }) => (
    <button role="switch" aria-checked={t[k]} onClick={() => setT(v => ({ ...v, [k]: !v[k] }))} style={{display:'flex', alignItems:'center', gap:12, width:'100%', textAlign:'left', padding:'13px 2px', boxShadow:'inset 0 -1px 0 var(--vt-bone-2)', cursor:'pointer'}}>
      <span style={{flex:1}}><b style={{fontSize:'var(--fs-sm)'}}>{title}</b><span style={{display:'block', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{sub}</span></span>
      <span style={{width:40, height:24, borderRadius:'var(--r-pill)', background: t[k] ? 'var(--vt-flame)' : 'var(--vt-ctl-track)', position:'relative', flexShrink:0}}>
        <span style={{position:'absolute', top:3, left: t[k] ? 19 : 3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left .15s'}}/>
      </span>
    </button>
  );
  return (<>
    <MiniHeader title="Настройки разминки" onBack/>
    <IBody>
      <ICap style={{marginTop:6}}>Напоминать до игры</ICap>
      <div style={{display:'flex', padding:3, gap:2, borderRadius:'var(--r-btn)', background:'var(--vt-ctl-track)'}}>
        {[30,45,60].map(m => <button key={m} onClick={() => setMins(m)} style={{flex:1, padding:'10px 0', borderRadius:'var(--r-field)', cursor:'pointer', fontWeight:700, background: mins === m ? 'var(--vt-ink)' : 'transparent', color: mins === m ? '#fff' : 'var(--vt-ink)'}}>за {m} мин</button>)}
      </div>
      <ICap>Поведение</ICap>
      <Tg k="bot" title="Напоминание в боте" sub="С кнопкой «Открыть разминку»"/>
      <Tg k="adapt" title="Учитывать жалобы" sub="Плечо, колени — из самооценки"/>
      <Tg k="cool" title="Заминка после игры" sub="Бот пришлёт через 5 минут после окончания"/>
    </IBody>
  </>);
};

IDEA_FLOWS.warm = {
  n:2, title:'Разминка', tag:'перед игрой', effort:'S', href:'9.2 Разминка.html',
  one:'Короткие программы с таймером: перед игрой, для плеча и колен, заминка. Можно запустить сразу для всей команды.',
  screens:[
    { id:'warm-list', name:'Программы', sub:'ближайшая игра и список', path:['warm-list'], C:WarmList },
    { id:'warm-preview', name:'Программа', sub:'упражнения, режим команды', path:['warm-list','warm-preview'], C:WarmPreview },
    { id:'warm-run', name:'Таймер', sub:'пошагово, пауза, назад', path:['warm-list','warm-preview','warm-run'], C:() => <Warmup/> },
    { id:'warm-settings', name:'Настройки', sub:'напоминание и поведение', path:['warm-list','warm-settings'], C:WarmSettings },
  ],
};

// ============================== 3 · Самооценка ==============================
const SELF_GAMES = [
  { id:'g1', name:'Микст', date:'вс · 25 мая', mood:4, rpe:7, good:['Приём','Защита'], fix:['Подача'], note:'Подача шла в сетку во второй партии' },
  { id:'g2', name:'Открытая игра', date:'пт · 23 мая', mood:3, rpe:6, good:['Пас'], fix:['Подача','Блок'], note:'' },
  { id:'g3', name:'Основа', date:'ср · 21 мая', mood:5, rpe:8, good:['Нападение','Приём'], fix:['Подача'], note:'Лучшая игра месяца' },
  { id:'g4', name:'Микст', date:'вс · 18 мая', mood:3, rpe:5, good:['Приём'], fix:['Нападение'], note:'' },
];
const SelfInbox = () => {
  const nav = useNav();
  return (<>
    <MiniHeader title="Самооценка" sub="После каждой игры · 30 секунд"/>
    <IBody>
      <button onClick={() => nav.push('self-form')} className="vt-card vt-card--hero" style={{padding:20, width:'100%', textAlign:'left', position:'relative', overflow:'hidden', cursor:'pointer'}}>
        <IOrb/>
        <div style={{position:'relative'}}>
          <div className="vt-cap" style={{color:'var(--vt-on-hero-3)'}}>Вчера · 20:00</div>
          <IdeaH size="var(--fs-4xl)" style={{marginTop:10}}>Как сыграли<br/>в «Основе»?</IdeaH>
          <span className="vt-btn vt-btn--sm" style={{background:'var(--vt-orange)', color:'#fff', marginTop:14, display:'inline-flex'}}>Оценить · 30 с</span>
        </div>
      </button>
      <ICap>Ещё без оценки</ICap>
      <IRow icon="court" title="Открытая игра" sub="пт · 30 мая · осталось 2 дня" onClick={() => nav.push('self-form')}/>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:18}}>
        <ITile k="Оценок" v="11" sub="за май" tone="cool"/><ITile k="Средняя RPE" v="6,3" sub="норма" tone="warm"/>
      </div>
      <ICap>Архив</ICap>
      <IRow icon="clock" title="История оценок" sub="11 игр · подача — в 3 последних" onClick={() => nav.push('self-history')}/>
    </IBody>
  </>);
};
const SelfHistory = () => {
  const nav = useNav();
  return (<>
    <MiniHeader title="История оценок" sub="май 2026" onBack/>
    <IBody>
      <div className="vt-card" style={{padding:14}}>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Ощущение · последние 8 игр</div>
        <div style={{display:'flex', gap:6, alignItems:'flex-end', height:64, marginTop:10}}>
          {[3,4,3,5,3,4,3,4].map((v, k) => <span key={k} style={{flex:1, height:`${v * 20}%`, borderRadius:6, background: k === 7 ? 'var(--vt-flame)' : 'var(--vt-ctl-track)'}}/>)}
        </div>
      </div>
      {SELF_GAMES.map(g => (
        <IRow key={g.id} title={g.name} sub={`${g.date} · подтянуть: ${g.fix.join(', ').toLowerCase()}`}
          right={<span className="vt-mono" style={{fontSize:'var(--fs-2xl)', fontWeight:700, marginRight:4}}>{g.mood}</span>}
          onClick={() => nav.push('self-game', { g })}/>
      ))}
    </IBody>
  </>);
};
const SelfGame = () => {
  const nav = useNav();
  const g = nav.data.g || SELF_GAMES[0];
  return (<>
    <MiniHeader title={g.name} sub={g.date} onBack/>
    <IBody>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
        <ITile k="Ощущение" v={g.mood} unit="из 5" tone="cool"/><ITile k="Нагрузка" v={g.rpe} unit="из 10" tone="warm"/>
      </div>
      <ICap>Получилось</ICap>
      <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>{g.good.map(s => <span key={s} className="vt-chip vt-chip--grass">{s}</span>)}</div>
      <ICap>Подтянуть</ICap>
      <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>{g.fix.map(s => <span key={s} className="vt-chip vt-chip--amber">{s}</span>)}</div>
      {g.note && <><ICap>Заметка</ICap><div style={{fontSize:'var(--fs-sm)', lineHeight:1.5}}>«{g.note}»</div></>}
      <div className="vt-card vt-card--cool" style={{padding:14, marginTop:18, fontSize:'var(--fs-sm)', lineHeight:1.5}}>
        Средняя оценка игры по группе — <b className="vt-mono">3,6</b>. Ваша — <b className="vt-mono">{g.mood}</b>.
      </div>
    </IBody>
    <IFoot><button onClick={() => { location.href = '9.1 AI-тренер.html'; }} className="vt-btn vt-btn--ghost vt-btn--lg vt-btn--full">План на «{g.fix[0].toLowerCase()}»</button></IFoot>
  </>);
};

IDEA_FLOWS.self = {
  n:3, title:'Самооценка', tag:'после игры', effort:'S', href:'9.3 Самооценка.html',
  one:'30 секунд после игры: ощущение, нагрузка, что получилось и что подтянуть. Из этих данных строятся прогресс и план тренера.',
  screens:[
    { id:'self-inbox', name:'Входящие', sub:'игры без оценки', path:['self-inbox'], C:SelfInbox },
    { id:'self-form', name:'Оценка игры', sub:'форма и инсайт', path:['self-inbox','self-form'], C:() => <SelfCheck/> },
    { id:'self-history', name:'История', sub:'динамика и список игр', path:['self-inbox','self-history'], C:SelfHistory },
    { id:'self-game', name:'Оценка одной игры', sub:'детали и сравнение', path:['self-inbox','self-history','self-game'], C:SelfGame },
  ],
};

// ============================== 4 · Прогресс навыков ==============================
const SKILL_ROWS = [['Подача',2.8,2.5],['Приём',3.6,3.2],['Пас',3.2,3.2],['Нападение',3.4,3.3],['Блок',2.6,2.6],['Защита',3.5,3.1]];
const fmt = (v) => String(v.toFixed(1)).replace('.', ',');
const ProgHub = () => {
  const nav = useNav();
  return (<>
    <MiniHeader title="Мой прогресс" sub="Уровень B · доигровщик"/>
    <IBody>
      <button onClick={() => nav.push('prog-level')} className="vt-card vt-card--hero" style={{padding:20, width:'100%', textAlign:'left', position:'relative', overflow:'hidden', cursor:'pointer'}}>
        <IOrb/>
        <div style={{position:'relative'}}>
          <div className="vt-cap" style={{color:'var(--vt-on-hero-3)'}}>До уровня A</div>
          <div style={{marginTop:12}}><span className="vt-mono" style={{fontSize:'var(--fs-6xl)', fontWeight:700, lineHeight:1}}>68</span><span className="vt-mono" style={{fontSize:'var(--fs-2xl)'}}>%</span></div>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-on-hero-2)', margin:'8px 0 12px'}}>2 из 4 условий выполнены</div>
          <IBar pct={68} dark/>
        </div>
      </button>
      <IRow icon="chart" title="Радар навыков" sub="сравнить с месяцем назад" onClick={() => nav.push('prog-radar')}/>
      <ICap>Навыки</ICap>
      {SKILL_ROWS.map(([s, now, past]) => {
        const d = +(now - past).toFixed(1);
        return <IRow key={s} title={s} sub={d > 0 ? `+${fmt(d)} за месяц` : 'без изменений'}
          right={<span className="vt-mono" style={{fontSize:'var(--fs-xl)', fontWeight:700, marginRight:4}}>{fmt(now)}</span>}
          onClick={() => nav.push('prog-skill', { s:[s, now, past] })}/>;
      })}
    </IBody>
  </>);
};
const ProgSkill = () => {
  const nav = useNav();
  const [s, now, past] = nav.data.s || SKILL_ROWS[0];
  const pts = [past, past + .1, past - .1, past + .2, past + .1, past + .3, now - .2, now - .1, now, now];
  const W = 320, H = 120, x = (k) => 34 + k * (W - 44) / 9, y = (v) => H - 12 - (v - 1.5) / 3 * (H - 24);
  return (<>
    <MiniHeader title={s} sub="последние 10 игр" onBack/>
    <IBody>
      <div style={{display:'flex', alignItems:'baseline', gap:10}}>
        <span className="vt-mono" style={{fontSize:'var(--fs-6xl)', fontWeight:700, lineHeight:1}}>{fmt(now)}</span>
        <span className="vt-chip vt-chip--grass">+{fmt(now - past)} за месяц</span>
      </div>
      <div className="vt-card" style={{padding:'12px 8px', marginTop:14}}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Динамика навыка">
          {[2,3,4].map(v => <g key={v}><line x1="24" x2={W} y1={y(v)} y2={y(v)} stroke="var(--vt-bone-2)"/><text x="4" y={y(v) + 4} fontSize="11" fill="var(--vt-mute-2)" fontFamily="Golos Text">{v}</text></g>)}
          <polyline points={pts.map((v, k) => `${x(k)},${y(v)}`).join(' ')} fill="none" stroke="var(--vt-flame)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
          {pts.map((v, k) => <circle key={k} cx={x(k)} cy={y(v)} r={k === 9 ? 5 : 3} fill={k === 9 ? 'var(--vt-orange)' : 'var(--vt-flame)'}/>)}
        </svg>
        <div style={{display:'flex', justifyContent:'space-between', fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', padding:'2px 6px 0 34px'}}><span>10 игр назад</span><span>последняя</span></div>
      </div>
      <ICap>Из чего складывается</ICap>
      <IRow icon="user" title="Ваши самооценки" sub="9 игр" right={<span className="vt-mono" style={{fontWeight:700, marginRight:4}}>{fmt(now - .1)}</span>}/>
      <IRow icon="star" title="Оценка организатора" sub="вес ×2 · 12 мая" right={<span className="vt-mono" style={{fontWeight:700, marginRight:4}}>{fmt(now + .1)}</span>}/>
      <div className="vt-card vt-card--warm" style={{padding:14, marginTop:16, fontSize:'var(--fs-sm)', lineHeight:1.5}}>
        <b>Что мешает:</b> подача уходит в сетку при усталости — в третьей партии оценки ниже на 0,6.
      </div>
    </IBody>
    <IFoot><button onClick={() => { location.href = '9.1 AI-тренер.html'; }} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full">План на «{s.toLowerCase()}»</button></IFoot>
  </>);
};
const ProgLevel = () => (<>
  <MiniHeader title="Путь до уровня A" sub="условия группы" onBack/>
  <IBody>
    {[
      ['ok','Посещаемость','≥ 8 игр в месяц','11 игр'],
      ['ok','Стабильность','без пропусков 4 недели','7 недель'],
      ['wait','Средняя оценка навыков','≥ 3,5','3,2'],
      ['no','Слабое место','каждый навык ≥ 2,8','блок 2,6'],
    ].map(([st, t, rule, v], k) => (
      <div key={t} style={{display:'flex', gap:12, alignItems:'flex-start', padding:'14px 2px', boxShadow: k ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none'}}>
        <span style={{width:28, height:28, borderRadius:'50%', flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center',
          background: st === 'ok' ? 'var(--vt-flame)' : st === 'wait' ? 'var(--vt-amber-soft)' : 'var(--vt-rose-soft)'}}>
          <Icon name={st === 'ok' ? 'check' : st === 'wait' ? 'clock' : 'close'} size={14} stroke={st === 'ok' ? '#fff' : st === 'wait' ? 'var(--vt-amber-ink)' : 'var(--vt-rose-ink)'} sw={2.4}/>
        </span>
        <span style={{flex:1}}><b style={{fontSize:'var(--fs-sm)'}}>{t}</b><span style={{display:'block', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{rule}</span></span>
        <span className="vt-mono" style={{fontWeight:700}}>{v}</span>
      </div>
    ))}
    <div className="vt-card vt-card--cool" style={{padding:14, marginTop:14, fontSize:'var(--fs-sm)', lineHeight:1.5}}>Уровень меняет организатор. Когда все условия выполнены, ему придёт подсказка пересмотреть ваш уровень.</div>
  </IBody>
</>);

IDEA_FLOWS.prog = {
  n:4, title:'Прогресс навыков', tag:'данные', effort:'M', href:'9.4 Прогресс навыков.html',
  one:'Шесть навыков с динамикой, источники оценок и понятный путь до следующего уровня.',
  screens:[
    { id:'prog-hub', name:'Обзор', sub:'уровень и навыки', path:['prog-hub'], C:ProgHub },
    { id:'prog-radar', name:'Радар', sub:'месяц / сезон', path:['prog-hub','prog-radar'], C:() => <Progress/> },
    { id:'prog-skill', name:'Навык', sub:'динамика и источники', path:['prog-hub','prog-skill'], C:ProgSkill },
    { id:'prog-level', name:'Путь до уровня A', sub:'условия и статус', path:['prog-hub','prog-level'], C:ProgLevel },
  ],
};
