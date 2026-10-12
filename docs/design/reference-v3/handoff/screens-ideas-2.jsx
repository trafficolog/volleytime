// screens-ideas-2.jsx — самооценка, прогресс навыков, составы, серии, MVP, итоги сезона

const SKILLS = ['Подача','Приём','Пас','Нападение','Блок','Защита'];

// ============================================================
// 3 · Самооценка после игры (30 секунд)
// ============================================================
const SelfCheck = () => {
  const nav = useNav();
  const [mood, setMood] = React.useState(null);
  const [rpe, setRpe] = React.useState(6);
  const [good, setGood] = React.useState([]);
  const [fix, setFix] = React.useState([]);
  const [sent, setSent] = React.useState(false);
  const tog = (arr, set, v) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  if (sent) return (
    <>
      <MiniHeader title="Готово" sub="Основа · 28 мая"/>
      <div className="vt-phone__body" style={{padding:'12px 16px'}}>
        <IdeaH size="var(--fs-4xl)">Записал</IdeaH>
        <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-ink-3)', marginTop:10, lineHeight:1.5}}>Из самооценок складываются ваш прогресс и план тренера.</div>
        <div className="vt-card vt-card--warm" style={{padding:16, marginTop:18}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Заметил закономерность</div>
          <div style={{fontSize:'var(--fs-md)', fontWeight:700, marginTop:8, lineHeight:1.35}}>«{fix[0] || 'Подача'}» вы отмечаете уже 3 игры подряд</div>
          <button onClick={() => window.IDEA_FLOWS ? (location.href = '9.1 AI-тренер.html') : nav.toast('Открываем AI-тренера с целью «' + (fix[0] || 'Подача') + '»')} className="vt-btn vt-btn--ink vt-btn--sm" style={{marginTop:12}}>Собрать план на неделю</button>
        </div>
        <div className="vt-card" style={{padding:16, marginTop:10, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div><div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Нагрузка недели</div><div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:4}}>3 игры · средняя RPE 6,3</div></div>
          <span className="vt-chip vt-chip--grass">норма</span>
        </div>
      </div>
    </>
  );
  return (
    <>
      <MiniHeader title="Как сыграли?" sub="Основа · 28 мая · 30 секунд" onBack/>
      <div className="vt-phone__body" style={{padding:'4px 16px 16px'}}>
        <div className="vt-label">Общее ощущение</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6}}>
          {['Плохо','Так себе','Норм','Хорошо','Огонь'].map((l, i) => (
            <button key={l} onClick={() => setMood(i)} style={{padding:'12px 0', borderRadius:'var(--r-tile)', cursor:'pointer', textAlign:'center',
              background: mood === i ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: mood === i ? '#fff' : 'var(--vt-ink)'}}>
              <div className="vt-mono" style={{fontSize:'var(--fs-xl)', fontWeight:700}}>{i + 1}</div>
              <div style={{fontSize:'var(--fs-2xs)', marginTop:2}}>{l}</div>
            </button>
          ))}
        </div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:20}}>
          <div className="vt-label" style={{margin:0}}>Нагрузка · RPE</div>
          <span className="vt-mono" style={{fontSize:'var(--fs-2xl)', fontWeight:700}}>{rpe}<span style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}> / 10</span></span>
        </div>
        <div role="radiogroup" aria-label="Нагрузка" style={{display:'grid', gridTemplateColumns:'repeat(10,1fr)', gap:3, padding:3, borderRadius:'var(--r-btn)', background:'var(--vt-ctl-track)', marginTop:8}}>
          {Array.from({length:10}, (_, k) => k + 1).map(n => (
            <button key={n} role="radio" aria-checked={rpe === n} onClick={() => setRpe(n)} style={{height:40, minHeight:40, borderRadius:'var(--r-field)', cursor:'pointer', fontFamily:'var(--f-num)', fontWeight:700, fontSize:'var(--fs-sm)',
              background: n <= rpe ? (n === rpe ? 'var(--vt-ink)' : 'var(--vt-bone-2)') : 'transparent', color: n === rpe ? '#fff' : 'var(--vt-ink)'}}>{n}</button>
          ))}
        </div>
        <div style={{display:'flex', justifyContent:'space-between', fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}><span>легко</span><span>на пределе</span></div>
        {[['Что получилось', good, setGood], ['Что подтянуть', fix, setFix]].map(([l, arr, set]) => (
          <div key={l} style={{marginTop:20}}>
            <div className="vt-label">{l}</div>
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>{SKILLS.map(s => <IdeaPick key={s} on={arr.includes(s)} onClick={() => tog(arr, set, s)}>{s}</IdeaPick>)}</div>
          </div>
        ))}
      </div>
      <div style={{padding:'12px 16px 18px'}}>
        <button onClick={() => setSent(true)} className={'vt-btn vt-btn--lg vt-btn--full ' + (mood === null ? '' : 'vt-btn--primary')} style={mood === null ? {background:'var(--vt-ctl)', color:'var(--vt-ink-3)', cursor:'not-allowed'} : null} disabled={mood === null}>{mood === null ? 'Выберите общее ощущение' : 'Сохранить'}</button>
      </div>
    </>
  );
};

// ============================================================
// 4 · Мой прогресс — радар навыков
// ============================================================
const Radar = ({ a, b, size = 250 }) => {
  const c = size / 2, r = c - 34, n = a.length;
  const pt = (v, k) => { const ang = -Math.PI / 2 + k * 2 * Math.PI / n; return [c + Math.cos(ang) * r * v / 5, c + Math.sin(ang) * r * v / 5]; };
  const poly = (vals) => vals.map((v, k) => pt(v, k).join(',')).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Радар навыков">
      {[1,2,3,4,5].map(l => <polygon key={l} points={poly(Array(n).fill(l))} fill="none" stroke="var(--vt-bone-2)" strokeWidth="1"/>)}
      <polygon points={poly(b)} fill="none" stroke="var(--vt-mute-2)" strokeWidth="1.75" strokeDasharray="4 3"/>
      <polygon points={poly(a)} fill="color-mix(in oklab, var(--vt-flame) 22%, transparent)" stroke="var(--vt-flame)" strokeWidth="2.5"/>
      {SKILLS.map((s, k) => { const [x, y] = pt(6.1, k); return <text key={s} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="600" fill="var(--vt-ink-3)" fontFamily="Golos Text">{s}</text>; })}
    </svg>
  );
};
const Progress = () => {
  const [mode, setMode] = React.useState('month');
  const now = [2.8, 3.6, 3.2, 3.4, 2.6, 3.5], past = mode === 'month' ? [2.5, 3.2, 3.2, 3.3, 2.6, 3.1] : [2.1, 2.8, 2.9, 3.0, 2.2, 2.7];
  return (
    <>
      <MiniHeader title="Мой прогресс" sub="Уровень B · доигровщик" onBack/>
      <div className="vt-phone__body" style={{padding:'4px 16px 16px'}}>
        <div style={{display:'inline-flex', padding:3, gap:2, borderRadius:'var(--r-btn)', background:'var(--vt-ctl-track)'}}>
          {[['month','За месяц'],['season','За сезон']].map(([v, l]) => <button key={v} onClick={() => setMode(v)} className="vt-btn vt-btn--sm" style={{background: mode === v ? 'var(--vt-ink)' : 'transparent', color: mode === v ? '#fff' : 'var(--vt-ink)'}}>{l}</button>)}
        </div>
        <div className="vt-card" style={{marginTop:12, padding:'8px 0 14px', display:'flex', flexDirection:'column', alignItems:'center'}}>
          <Radar a={now} b={past}/>
          <div style={{display:'flex', gap:16, fontSize:'var(--fs-xs)'}}>
            <span style={{display:'inline-flex', alignItems:'center', gap:6}}><IdeaDot c="var(--vt-flame)"/>сейчас</span>
            <span style={{display:'inline-flex', alignItems:'center', gap:6}}><span style={{width:14, borderTop:'2px dashed var(--vt-mute-2)', display:'inline-block'}}/>{mode === 'month' ? 'месяц назад' : 'начало сезона'}</span>
          </div>
        </div>
        <div style={{display:'flex', flexDirection:'column', marginTop:6}}>
          {SKILLS.map((s, k) => {
            const d = +(now[k] - past[k]).toFixed(1);
            return (
              <div key={s} style={{display:'flex', alignItems:'center', gap:12, padding:'11px 2px', boxShadow: k ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none'}}>
                <span style={{flex:1, fontSize:'var(--fs-sm)', fontWeight:600}}>{s}</span>
                <span className="vt-mono" style={{fontWeight:700}}>{now[k].toFixed(1).replace('.', ',')}</span>
                <span className="vt-mono" style={{width:44, textAlign:'right', fontSize:'var(--fs-sm)', fontWeight:700, color: d > 0 ? 'var(--vt-grass-ink)' : 'var(--vt-mute-2)'}}>{d > 0 ? `+${String(d).replace('.', ',')}` : '—'}</span>
              </div>
            );
          })}
        </div>
        <div className="vt-card vt-card--cool" style={{padding:16, marginTop:12}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}><span style={{fontSize:'var(--fs-sm)', fontWeight:700}}>До уровня A</span><span className="vt-mono" style={{fontWeight:700}}>68%</span></div>
          <div style={{height:8, borderRadius:'var(--r-pill)', background:'var(--vt-paper)', marginTop:10, overflow:'hidden'}}><div style={{width:'68%', height:'100%', background:'var(--vt-flame)', borderRadius:'var(--r-pill)'}}/></div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:8, lineHeight:1.45}}>Самооценки + оценка организатора. Слабое место — блок и подача.</div>
        </div>
      </div>
    </>
  );
};

// ============================================================
// 5 · Составы на игру — баланс команд
// ============================================================
const TEAMS = [
  { name:'Команда А', mark:'А', bg:'var(--vt-ink)', fg:'#fff', avg:3.4, list:[['Артём','доигр.','B',true],['Маша','связ.','A'],['Игорь','центр.','B'],['Лера','либеро','B'],['Денис','диаг.','B'],['Юля','доигр.','C']] },
  { name:'Команда Б', mark:'Б', bg:'var(--vt-bone-2)', fg:'var(--vt-ink)', avg:3.3, list:[['Никита','связ.','B'],['Соня','доигр.','A'],['Стас','центр.','B'],['Катя','доигр.','A'],['Паша','диаг.','C'],['Даша','либеро','B']] },
];
const Teams = () => {
  const nav = useNav();
  return (
    <>
      <MiniHeader title="Составы" sub="Основа · сегодня 20:00" onBack/>
      <div className="vt-phone__body" style={{padding:'4px 16px 16px'}}>
        <div className="vt-card" style={{padding:16}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}><span className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Баланс команд</span><span className="vt-chip vt-chip--grass">ровно</span></div>
          <div style={{display:'flex', alignItems:'center', gap:10, marginTop:12}}>
            <span style={{display:'flex', flexDirection:'column', alignItems:'center'}}><span className="vt-mono" style={{fontSize:'var(--fs-2xl)', fontWeight:700}}>3,4</span><span style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>А</span></span>
            <div style={{flex:1, height:10, borderRadius:'var(--r-pill)', overflow:'hidden', display:'flex', gap:2}}><span style={{flex:51, background:'var(--vt-ink)'}}/><span style={{flex:49, background:'var(--vt-stroke-2)'}}/></div>
            <span style={{display:'flex', flexDirection:'column', alignItems:'center'}}><span className="vt-mono" style={{fontSize:'var(--fs-2xl)', fontWeight:700}}>3,3</span><span style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>Б</span></span>
          </div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:8}}>Делится по уровню и амплуа: в каждой команде связующий и либеро.</div>
        </div>
        {TEAMS.map(t => (
          <div key={t.name} style={{marginTop:16}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}><span className="vt-mono" style={{width:26, height:26, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'var(--fs-sm)', background:t.bg, color:t.fg}}>{t.mark}</span><span style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:'var(--fs-xl)'}}>{t.name}</span>{t.list.some(p => p[3]) && <span className="vt-chip vt-chip--mine" style={{gap:4}}><Icon name="check" size={12} sw={2.4}/>Вы здесь</span>}</div>
            {t.list.map(([n, role, lvl, me], k) => (
              <div key={n} style={{display:'flex', alignItems:'center', gap:12, padding: me ? '9px 10px' : '9px 2px', margin: me ? '0 -8px' : 0, borderRadius: me ? 'var(--r-field)' : 0, background: me ? 'var(--vt-accent-soft)' : 'transparent', boxShadow: k && !me ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none', fontWeight: me ? 700 : 400}}>
                {(() => { const p = PEOPLE.find(q => q.name === n) || { init: n.slice(0, 2).toUpperCase(), tag: 'ink' }; return <Avi name={n} init={p.init} tag={p.tag} size="sm"/>; })()}
                <span style={{flex:1, fontSize:'var(--fs-sm)'}}>{n}{me ? ' · вы' : ''}</span>
                <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{role}</span>
                <span className="vt-mono" style={{width:16, textAlign:'right', fontWeight:700}}>{lvl}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{padding:'10px 16px 16px'}}>
        <button onClick={() => window.IDEA_FLOWS && window.IDEA_FLOWS.teams ? nav.push('teams-swap') : nav.toast('Запрос на обмен отправлен организатору')} className="vt-btn vt-btn--ghost vt-btn--full">Попросить поменяться</button>
      </div>
    </>
  );
};

// ============================================================
// 6 · Серии и челленджи
// ============================================================
const Streaks = () => {
  const nav = useNav();
  const weeks = [3,2,3,1,3,3,2,3,3,2,3,3];
  return (
    <>
      <MiniHeader title="Серии" sub="Сезон весна–лето 2026" onBack/>
      <div className="vt-phone__body" style={{padding:'4px 16px 16px'}}>
        <div style={{display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:10}}>
          <div className="vt-card vt-card--hero" style={{padding:18, position:'relative', overflow:'hidden'}}>
            <div style={{position:'absolute', right:-30, top:-30, width:100, height:100, borderRadius:'50%', background:'var(--vt-orange)'}}/>
            <div style={{position:'relative'}}>
              <div className="vt-cap" style={{color:'var(--vt-on-hero-3)'}}>Серия</div>
              <div style={{marginTop:14}}><span className="vt-mono" style={{fontSize:'var(--fs-6xl)', fontWeight:700, lineHeight:1}}>7</span><span style={{fontSize:'var(--fs-sm)', marginLeft:6}}>недель подряд</span></div>
            </div>
          </div>
          <div className="vt-card vt-card--warm" style={{padding:16, display:'flex', flexDirection:'column'}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Рекорд</div>
            <div className="vt-mono" style={{fontSize:'var(--fs-4xl)', fontWeight:700, marginTop:'auto'}}>9</div>
          </div>
        </div>
        <div className="vt-card" style={{padding:14, marginTop:10}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Игр в неделю · 12 недель</div>
          <div style={{display:'flex', gap:4, alignItems:'flex-end', height:56, marginTop:10}}>
            {weeks.map((w, k) => <span key={k} style={{flex:1, height:`${w * 33}%`, borderRadius:6, background: k >= weeks.length - 7 ? 'var(--vt-flame)' : 'var(--vt-bone-2)'}}/>)}
          </div>
        </div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'18px 2px 8px'}}>Челленджи</div>
        {[
          ['Ни одной пропущенной игры в июне', 3, 4, 'warm'],
          ['300 подач за месяц', 180, 300, 'cool'],
          ['Приведи друга на тренировку', 0, 1, null],
        ].map(([t, v, max, tone], k) => (
          <div key={t} className={`vt-card${tone ? ' vt-card--' + tone : ''}`} style={{padding:14, marginTop: k ? 8 : 0}}>
            <div style={{display:'flex', justifyContent:'space-between', gap:10, alignItems:'baseline'}}><span style={{fontSize:'var(--fs-sm)', fontWeight:700}}>{t}</span><span className="vt-mono" style={{fontWeight:700, flexShrink:0}}>{v}/{max}</span></div>
            <div style={{height:6, borderRadius:'var(--r-pill)', background:'var(--vt-paper)', marginTop:10, overflow:'hidden'}}><div style={{width:`${v / max * 100}%`, height:'100%', background:'var(--vt-flame)', borderRadius:'var(--r-pill)'}}/></div>
          </div>
        ))}
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'18px 2px 8px'}}>Значки</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8}}>
          {[['10','игр',1],['MVP','×3',1],['Ранняя','пташка',1],['50','игр',0]].map(([a, b, on], k) => (
            <button key={k} onClick={() => nav.toast(on ? 'Получен в апреле' : 'Осталось 8 игр')} style={{aspectRatio:'1', borderRadius:'var(--r-tile)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              background: on ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: on ? '#fff' : 'var(--vt-mute-2)', filter: on ? 'none' : 'grayscale(1)'}}>
              <span style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:'var(--fs-md)'}}>{a}</span><span style={{fontSize:'var(--fs-2xs)'}}>{b}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

// ============================================================
// 7 · MVP-голосование
// ============================================================
const MVP = () => {
  const [cat, setCat] = React.useState(0);
  const [votes, setVotes] = React.useState({});
  const cats = ['MVP игры','Лучшая подача','Надёжный приём'];
  const players = PEOPLE.slice(1, 10);
  const doneAll = cats.every((_, i) => votes[i] !== undefined);
  if (doneAll && cat === 3) return (
    <>
      <MiniHeader title="Итоги" sub="Основа · 28 мая"/>
      <div className="vt-phone__body" style={{padding:'4px 16px 16px'}}>
        <div className="vt-card vt-card--hero" style={{padding:22, textAlign:'center', position:'relative', overflow:'hidden'}}>
          <div style={{position:'absolute', left:'50%', top:-70, width:160, height:160, marginLeft:-80, borderRadius:'50%', background:'var(--vt-orange)'}}/>
          <div style={{position:'relative'}}>
            <div className="vt-cap" style={{color:'var(--vt-on-hero)'}}>MVP игры</div>
            <div style={{display:'flex', justifyContent:'center', marginTop:30}}><Avi idx={2} size="lg"/></div>
            <IdeaH size="var(--fs-4xl)" style={{marginTop:12}}>Маша</IdeaH>
            <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-on-hero-2)', marginTop:6}}>7 голосов из 12</div>
          </div>
        </div>
        {[['Лучшая подача','Соня',5],['Надёжный приём','Лера',6]].map(([c, n, v], k) => (
          <div key={c} className="vt-card" style={{padding:14, marginTop:10, display:'flex', alignItems:'center', gap:12}}>
            <Avi idx={k ? 3 : 5} size="sm"/>
            <div style={{flex:1}}><div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{c}</div><div style={{fontSize:'var(--fs-base)', fontWeight:700, marginTop:2}}>{n}</div></div>
            <span className="vt-mono" style={{fontWeight:700}}>{v}</span>
          </div>
        ))}
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:14, lineHeight:1.45, textAlign:'center'}}>Голоса анонимны. За себя голосовать нельзя.</div>
      </div>
    </>
  );
  return (
    <>
      <MiniHeader title="Голосование" sub="Основа · 28 мая · до 23:00" onBack/>
      <div style={{padding:'4px 16px 0', display:'flex', gap:4}}>
        {cats.map((c, i) => <span key={c} style={{flex:1, height:4, borderRadius:'var(--r-pill)', background: votes[i] !== undefined ? 'var(--vt-flame)' : i === cat ? 'var(--vt-ink)' : 'var(--vt-bone-2)'}}/>)}
      </div>
      <div className="vt-phone__body" style={{padding:'16px 16px'}}>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{cat + 1} из {cats.length}</div>
        <IdeaH size="var(--fs-4xl)" style={{marginTop:6}}>{cats[cat]}</IdeaH>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:18}}>
          {players.map((p, k) => {
            const on = votes[cat] === k;
            return (
              <button key={p.name} onClick={() => setVotes(v => ({ ...v, [cat]: k }))} style={{padding:'14px 6px', borderRadius:'var(--r-tile)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                background: on ? 'var(--vt-flame)' : 'var(--vt-ctl)', color: on ? '#fff' : 'var(--vt-ink)'}}>
                <Avi idx={k + 1} size="md"/>
                <span style={{fontSize:'var(--fs-sm)', fontWeight:700}}>{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{padding:'10px 16px 16px', display:'flex', gap:8}}>
        <button onClick={() => setCat(c => Math.min(3, c + 1))} className="vt-btn vt-btn--ghost" style={{flex:1}}>Пропустить</button>
        <button onClick={() => setCat(c => Math.min(3, c + 1))} disabled={votes[cat] === undefined} className={'vt-btn ' + (votes[cat] === undefined ? '' : 'vt-btn--primary')} style={votes[cat] === undefined ? {flex:2, background:'var(--vt-ctl)', color:'var(--vt-ink-3)', cursor:'not-allowed'} : {flex:2}}>{votes[cat] === undefined ? 'Выберите игрока' : cat === cats.length - 1 ? 'Смотреть итоги' : 'Дальше'}</button>
      </div>
    </>
  );
};

// ============================================================
// 8 · Итоги сезона — истории
// ============================================================
const Wrapped = () => {
  const nav = useNav();
  const [i, setI] = React.useState(0);
  const slides = [
    { bg:'var(--vt-blue-ink)', fg:'#fff', k:'Сезон весна–лето', big:'42', unit:'игры', sub:'Это 84 часа на площадке.' },
    { bg:'var(--vt-orange)', fg:'var(--vt-ink)', k:'Любимый день', big:'Среда', unit:'', sub:'18 игр в «Основе». Пятница на втором месте.' },
    { bg:'var(--vt-ink)', fg:'#fff', k:'Чаще всего в команде с', big:'Маша', unit:'', sub:'16 общих игр в одной команде.', avi:2 },
    { bg:'var(--vt-blue-soft-tile)', fg:'var(--vt-ink)', k:'Рост за сезон', big:'+0,8', unit:'приём', sub:'Самый большой прогресс. Подача — следующая цель.' },
    { bg:'var(--vt-blue-ink)', fg:'#fff', k:'MVP', big:'3', unit:'раза', sub:'И 7 побед в голосовании «Надёжный приём».' },
  ];
  const s = slides[i];
  return (
    <div style={{flex:1, background:s.bg, color:s.fg, display:'flex', flexDirection:'column', padding:'16px 20px 20px', position:'relative', transition:'background .3s'}}>
      <div style={{display:'flex', gap:4}}>{slides.map((_, k) => <span key={k} style={{flex:1, height:3, borderRadius:'var(--r-pill)', background:s.fg, opacity: k <= i ? 1 : .28}}/>)}</div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14}}>
        <span style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700}}>Volley<span style={{color: s.bg === 'var(--vt-orange)' ? 'var(--vt-ink)' : 'var(--vt-orange)'}}>Time</span></span>
        <button onClick={() => nav.canGoBack ? nav.back() : nav.toast('Закрыто')} aria-label="Закрыть" style={{color:s.fg, cursor:'pointer', width:44, height:44, display:'inline-flex', alignItems:'center', justifyContent:'center', marginRight:-10}}><Icon name="close" size={20}/></button>
      </div>
      <button onClick={() => setI(k => (k + 1) % slides.length)} style={{flex:1, display:'flex', flexDirection:'column', justifyContent:'center', textAlign:'left', cursor:'pointer', color:s.fg}}>
        <div style={{fontSize:'var(--fs-md)', fontWeight:600, opacity:.86}}>{s.k}</div>
        {s.avi !== undefined && <div style={{marginTop:18}}><Avi idx={s.avi} size="lg"/></div>}
        <div style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:'var(--fs-7xl)', lineHeight:.95, marginTop:12}}>{s.big}</div>
        {s.unit && <div style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:'var(--fs-3xl)'}}>{s.unit}</div>}
        <div style={{fontSize:'var(--fs-md)', lineHeight:1.45, marginTop:18, maxWidth:300, opacity:.9}}>{s.sub}</div>
      </button>
      <div style={{display:'flex', gap:8}}>
        <button onClick={() => window.IDEA_FLOWS ? nav.push('wrap-share') : nav.toast('Картинка для сторис сохранена')} className="vt-btn vt-btn--lg" style={{flex:1, background: s.fg === '#fff' ? '#fff' : 'var(--vt-ink)', color: s.fg === '#fff' ? 'var(--vt-ink)' : '#fff'}}>Поделиться в сторис</button>
      </div>
      <div style={{textAlign:'center', fontSize:'var(--fs-xs)', opacity:.7, marginTop:10}}>Нажмите на экран, чтобы листать</div>
    </div>
  );
};

Object.assign(window, { SelfCheck, Progress, Teams, Streaks, MVP, Wrapped, IdeaRadar:Radar });
