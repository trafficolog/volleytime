// screens-ideas-deep-b.jsx — глубокие флоу: составы, серии, MVP, итоги сезона
window.IDEA_FLOWS = window.IDEA_FLOWS || {};

// ============================== 5 · Составы ==============================
const OTHER_TEAM = ['Никита','Соня','Стас','Катя','Паша','Даша'];
const TeamsGame = () => {
  const nav = useNav();
  return (<>
    <MiniHeader title="Основа" sub="сегодня · 20:00 · Школа №24"/>
    <IBody>
      <div className="vt-card vt-card--hero" style={{padding:20, position:'relative', overflow:'hidden'}}>
        <IOrb/>
        <div style={{position:'relative'}}>
          <div className="vt-cap" style={{color:'var(--vt-on-hero-3)'}}>Составы готовы · 19:00</div>
          <IdeaH size="var(--fs-5xl)" style={{marginTop:10}}>Вы в синих</IdeaH>
          <div style={{display:'flex', alignItems:'center', gap:10, marginTop:14}}>
            <span className="vt-mono" style={{fontWeight:700}}>3,4</span>
            <div style={{flex:1, height:8, borderRadius:'var(--r-pill)', overflow:'hidden', display:'flex'}}><span style={{flex:51, background:'var(--vt-on-hero)'}}/><span style={{flex:49, background:'var(--vt-orange)'}}/></div>
            <span className="vt-mono" style={{fontWeight:700}}>3,3</span>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:'var(--fs-xs)', color:'var(--vt-on-hero-2)', marginTop:6}}><span>Синие · ваша</span><span>Оранжевые</span></div>
        </div>
      </div>
      <IRow icon="users" title="Составы команд" sub="6 на 6 · связующий и либеро в каждой" onClick={() => nav.push('teams-view')}/>
      <IRow icon="arrow-r" title="Попросить обмен" sub="поменяться с игроком другой команды" onClick={() => nav.push('teams-swap')}/>
      <ICap>Для организатора</ICap>
      <IRow icon="settings" title="Управление составами" sub="перемешать, зафиксировать, запросы" onClick={() => nav.push('teams-org')}/>
      <div className="vt-card vt-card--cool" style={{padding:14, marginTop:16, fontSize:'var(--fs-sm)', lineHeight:1.5}}>Составы открываются за час до игры. Если кто-то отменит запись, система пересоберёт команды и пришлёт уведомление.</div>
    </IBody>
  </>);
};
const TeamsSwap = () => {
  const nav = useNav();
  const [who, setWho] = React.useState(null);
  const [why, setWhy] = React.useState('Играть с другом');
  return (<>
    <MiniHeader title="Обмен" sub="Синие → Оранжевые" onBack/>
    <IBody>
      <ICap style={{marginTop:6}}>С кем поменяться</ICap>
      {OTHER_TEAM.map((n, k) => (
        <button key={n} onClick={() => setWho(n)} role="radio" aria-checked={who === n} style={{display:'flex', alignItems:'center', gap:12, width:'100%', textAlign:'left', padding:'10px 2px', boxShadow:'inset 0 -1px 0 var(--vt-bone-2)', cursor:'pointer'}}>
          <Avi idx={k + 6} size="sm"/>
          <span style={{flex:1, fontSize:'var(--fs-sm)', fontWeight:600}}>{n}</span>
          <span style={{width:22, height:22, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', background: who === n ? 'var(--vt-flame)' : 'transparent', boxShadow: who === n ? 'none' : 'inset 0 0 0 2px var(--vt-stroke-2)'}}>
            {who === n && <Icon name="check" size={12} stroke="#fff" sw={2.8}/>}
          </span>
        </button>
      ))}
      <ICap>Причина</ICap>
      <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>{['Играть с другом','Другое амплуа','Баланс команд'].map(r => <IdeaPick key={r} on={why === r} onClick={() => setWhy(r)}>{r}</IdeaPick>)}</div>
    </IBody>
    <IFoot><button disabled={!who} style={{opacity: who ? 1 : .5}} onClick={() => nav.push('teams-sent', { who, why })} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full">Отправить запрос</button></IFoot>
  </>);
};
const TeamsSent = () => {
  const nav = useNav();
  const who = nav.data.who || 'Соня';
  return (<>
    <MiniHeader title="Запрос отправлен" onBack/>
    <IBody>
      <IdeaH size="var(--fs-5xl)" style={{marginTop:6}}>Ждём<br/>ответа</IdeaH>
      <div style={{marginTop:22}}>
        {[['done','Запрос отправлен','19:12'],['wait',`${who} решает`,'до 19:40'],['todo','Организатор подтвердит','после согласия']].map(([st, t, s], k) => (
          <div key={t} style={{display:'flex', gap:12, alignItems:'flex-start'}}>
            <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
              <span style={{width:24, height:24, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', background: st === 'done' ? 'var(--vt-flame)' : st === 'wait' ? 'var(--vt-amber-soft)' : 'var(--vt-ctl)'}}>
                {st === 'done' ? <Icon name="check" size={12} stroke="#fff" sw={2.6}/> : st === 'wait' ? <Icon name="clock" size={12} stroke="var(--vt-amber-ink)"/> : null}
              </span>
              {k < 2 && <span style={{width:2, height:30, background:'var(--vt-bone-2)'}}/>}
            </div>
            <div style={{paddingBottom:12}}><b style={{fontSize:'var(--fs-sm)'}}>{t}</b><div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{s}</div></div>
          </div>
        ))}
      </div>
      <div className="vt-card vt-card--cool" style={{padding:14, marginTop:10, fontSize:'var(--fs-sm)', lineHeight:1.5}}>Если {who} не ответит до 19:40, запрос отменится автоматически, составы останутся как есть.</div>
    </IBody>
    <IFoot><button onClick={() => { nav.reset('teams-game'); setTimeout(() => nav.toast('Запрос отменён'), 60); }} className="vt-btn vt-btn--ghost vt-btn--lg vt-btn--full">Отменить запрос</button></IFoot>
  </>);
};
const TeamsOrg = () => {
  const nav = useNav();
  const [seed, setSeed] = React.useState(0);
  const [locked, setLocked] = React.useState(false);
  const a = [3.4, 3.35, 3.5][seed % 3], b = [3.3, 3.35, 3.2][seed % 3];
  return (<>
    <MiniHeader title="Управление составами" sub="Основа · 12 игроков" onBack/>
    <IBody>
      <div className="vt-card" style={{padding:16}}>
        <div style={{display:'flex', justifyContent:'space-between'}}><span className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Баланс</span><span className={`vt-chip ${Math.round(Math.abs(a - b) * 100) <= 10 ? 'vt-chip--grass' : 'vt-chip--amber'}`}>{Math.round(Math.abs(a - b) * 100) <= 10 ? 'ровно' : 'перекос'}</span></div>
        <div style={{display:'flex', alignItems:'center', gap:10, marginTop:12}}>
          <span className="vt-mono" style={{fontSize:'var(--fs-2xl)', fontWeight:700}}>{fmt(a)}</span>
          <div style={{flex:1, height:10, borderRadius:'var(--r-pill)', overflow:'hidden', display:'flex'}}><span style={{flex:a, background:'var(--vt-flame)'}}/><span style={{flex:b, background:'var(--vt-orange)'}}/></div>
          <span className="vt-mono" style={{fontSize:'var(--fs-2xl)', fontWeight:700}}>{fmt(b)}</span>
        </div>
      </div>
      <ICap>Запросы на обмен · 1</ICap>
      <div className="vt-card vt-card--warm" style={{padding:14}}>
        <div style={{fontSize:'var(--fs-sm)', fontWeight:700}}>Артём ↔ Соня</div>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:2}}>Играть с другом · Соня согласна</div>
        <div style={{display:'flex', gap:6, marginTop:10}}>
          <button onClick={() => nav.toast('Обмен отклонён')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{flex:1}}>Отклонить</button>
          <button onClick={() => nav.toast('Обмен принят · баланс 3,35 / 3,35')} className="vt-btn vt-btn--ink vt-btn--sm" style={{flex:1}}>Принять</button>
        </div>
      </div>
      <ICap>Действия</ICap>
      <IRow icon="filter" title="Перемешать" sub="новый вариант с тем же балансом" onClick={() => { setSeed(s => s + 1); nav.toast('Составы перемешаны'); }}/>
      <IRow icon="users" title="Посмотреть составы" sub="как видят игроки" onClick={() => nav.push('teams-view')}/>
    </IBody>
    <IFoot><button onClick={() => { setLocked(v => !v); nav.toast(locked ? 'Составы открыты для обменов' : 'Составы зафиксированы · игроки получили уведомление'); }} className={`vt-btn vt-btn--lg vt-btn--full ${locked ? 'vt-btn--ghost' : 'vt-btn--primary'}`}>{locked ? 'Снять фиксацию' : 'Зафиксировать составы'}</button></IFoot>
  </>);
};

IDEA_FLOWS.teams = {
  n:5, title:'Составы на игру', tag:'в день игры', effort:'M', href:'9.5 Составы на игру.html',
  one:'Ровные команды по уровню и амплуа за час до игры, обмены между игроками и управление для организатора.',
  screens:[
    { id:'teams-game', name:'День игры', sub:'моя команда и баланс', path:['teams-game'], C:TeamsGame },
    { id:'teams-view', name:'Составы', sub:'обе команды', path:['teams-game','teams-view'], C:() => <Teams/> },
    { id:'teams-swap', name:'Обмен', sub:'выбор игрока и причины', path:['teams-game','teams-swap'], C:TeamsSwap },
    { id:'teams-sent', name:'Статус запроса', sub:'шаги и таймаут', path:['teams-game','teams-swap','teams-sent'], C:TeamsSent },
    { id:'teams-org', name:'Организатор', sub:'баланс, запросы, фиксация', path:['teams-game','teams-org'], C:TeamsOrg },
  ],
};

// ============================== 6 · Серии ==============================
const CHALLENGES = [
  { id:'june', t:'Ни одной пропущенной игры в июне', v:3, max:4, tone:'warm', ends:'до 30 июня', rule:'Сыграть во всех играх, на которые вы записаны. Отмена раньше чем за 24 часа не считается пропуском.' },
  { id:'serve', t:'300 подач за месяц', v:180, max:300, tone:'cool', ends:'до 30 июня', rule:'Подачи считаются из тренировок AI-тренера и отметок организатора.' },
  { id:'friend', t:'Приведи друга', v:0, max:1, tone:null, ends:'без срока', rule:'Друг записывается по вашей ссылке и приходит на первую игру.' },
];
const StreakHub = () => {
  const nav = useNav();
  return (<>
    <MiniHeader title="Серии" sub="Сезон весна–лето"/>
    <IBody>
      <button onClick={() => nav.push('streak-cal')} className="vt-card vt-card--hero" style={{padding:20, width:'100%', textAlign:'left', position:'relative', overflow:'hidden', cursor:'pointer'}}>
        <IOrb/>
        <div style={{position:'relative'}}>
          <div className="vt-cap" style={{color:'var(--vt-on-hero-3)'}}>Серия</div>
          <div style={{marginTop:12}}><span className="vt-mono" style={{fontSize:'var(--fs-7xl)', fontWeight:700, lineHeight:1}}>7</span><span style={{fontSize:'var(--fs-md)', marginLeft:8}}>недель подряд</span></div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-on-hero-2)', marginTop:8}}>Календарь игр →</div>
        </div>
      </button>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10}}>
        <ITile k="Рекорд" v="9" unit="недель" tone="warm"/><ITile k="Заморозки" v="1" unit="из 1" tone="cool" sub="пропуск не обнулит серию"/>
      </div>
      <ICap>Челленджи</ICap>
      {CHALLENGES.map(c => <IRow key={c.id} icon="star" title={c.t} sub={`${c.v} из ${c.max} · ${c.ends}`} onClick={() => nav.push('streak-ch', { c })}/>)}
      <IRow icon="trophy" title="Значки" sub="3 из 12 получено" onClick={() => nav.push('streak-badges')}/>
    </IBody>
  </>);
};
const StreakCal = () => {
  const weeks = Array.from({ length:12 }, (_, w) => Array.from({ length:7 }, (_, d) => ((w * 7 + d) * 37 % 11 < 4 && [2,4,6].includes(d)) || (d === 2 && w > 4) ? 1 : 0));
  weeks[4] = [0,0,0,0,0,0,0];
  return (<>
    <MiniHeader title="Календарь игр" sub="12 недель" onBack/>
    <IBody>
      <div style={{display:'grid', gridTemplateColumns:'28px repeat(7,1fr)', gap:4, alignItems:'center'}}>
        <span/>{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => <span key={d} style={{fontSize:'var(--fs-2xs)', textAlign:'center', color:'var(--vt-mute-2)', fontWeight:600}}>{d}</span>)}
        {weeks.map((w, k) => (
          <React.Fragment key={k}>
            <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{k + 1}</span>
            {w.map((v, d) => <span key={d} style={{aspectRatio:'1', borderRadius:6, background: v ? (k >= 5 ? 'var(--vt-flame)' : 'var(--vt-blue-soft-tile)') : k === 4 ? 'var(--vt-amber-soft)' : 'var(--vt-ctl)'}}/>)}
          </React.Fragment>
        ))}
      </div>
      <div style={{display:'flex', gap:14, flexWrap:'wrap', marginTop:14, fontSize:'var(--fs-xs)'}}>
        <span style={{display:'inline-flex', gap:6, alignItems:'center'}}><IdeaDot c="var(--vt-flame)"/>текущая серия</span>
        <span style={{display:'inline-flex', gap:6, alignItems:'center'}}><IdeaDot c="var(--vt-blue-soft-tile)"/>до серии</span>
        <span style={{display:'inline-flex', gap:6, alignItems:'center'}}><IdeaDot c="var(--vt-amber)"/>неделя без игр</span>
      </div>
      <div className="vt-card vt-card--cool" style={{padding:14, marginTop:16, fontSize:'var(--fs-sm)', lineHeight:1.5}}>Серия считается по неделям, а не по дням: достаточно одной игры в неделю. Раз в месяц можно пропустить неделю — сработает заморозка.</div>
    </IBody>
  </>);
};
const StreakCh = () => {
  const nav = useNav();
  const c = nav.data.c || CHALLENGES[0];
  return (<>
    <MiniHeader title="Челлендж" sub={c.ends} onBack/>
    <IBody>
      <IdeaH size="var(--fs-3xl)" style={{marginTop:6}}>{c.t}</IdeaH>
      <div style={{display:'flex', alignItems:'baseline', gap:6, marginTop:16}}><span className="vt-mono" style={{fontSize:'var(--fs-6xl)', fontWeight:700, lineHeight:1}}>{c.v}</span><span className="vt-mono" style={{fontSize:'var(--fs-xl)', color:'var(--vt-mute-2)'}}>из {c.max}</span></div>
      <div style={{marginTop:12}}><IBar pct={c.v / c.max * 100} h={8}/></div>
      <ICap>Правила</ICap>
      <div style={{fontSize:'var(--fs-sm)', lineHeight:1.5, color:'var(--vt-ink-3)'}}>{c.rule}</div>
      <ICap>В группе</ICap>
      {[['Маша',c.max],['Вы',c.v],['Никита',Math.max(0, c.v - 1)],['Лера',Math.max(0, c.v - 2)]].map(([n, v], k) => (
        <div key={n} style={{display:'flex', alignItems:'center', gap:12, padding:'9px 2px', boxShadow: k ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none', fontWeight: n === 'Вы' ? 700 : 400}}>
          <span className="vt-mono" style={{width:16, color:'var(--vt-mute-2)'}}>{k + 1}</span>{n === 'Вы' ? <Avi name="Артём" init="АР" tag="flame" size="sm"/> : <Avi idx={k + 2} size="sm"/>}
          <span style={{flex:1, fontSize:'var(--fs-sm)'}}>{n}</span><span className="vt-mono" style={{fontWeight:700}}>{v}/{c.max}</span>
        </div>
      ))}
    </IBody>
  </>);
};
const BADGES = [['10','игр',1,'Сыграть 10 игр'],['MVP','×3',1,'Стать MVP три раза'],['Ранняя','пташка',1,'5 утренних игр'],['50','игр',0,'Ещё 8 игр'],['Серия','10',0,'10 недель подряд'],['Друг','×1',0,'Привести друга'],['Подача','300',0,'Челлендж месяца'],['Сезон','полный',0,'Все недели сезона'],['Капитан','',0,'Организовать игру'],['100','игр',0,'Ещё 58 игр'],['Блок','мастер',0,'Блок ≥ 3,5'],['Все','залы',0,'Сыграть во всех залах']];
const StreakBadges = () => {
  const nav = useNav();
  return (<>
    <MiniHeader title="Значки" sub="3 из 12" onBack/>
    <IBody>
      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8}}>
        {BADGES.map(([a, b, on, how], k) => (
          <button key={k} onClick={() => nav.toast(on ? `Получен · ${how}` : how)} style={{aspectRatio:'1', borderRadius:'var(--r-tile)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
            background: on ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: on ? '#fff' : 'var(--vt-mute-2)'}}>
            <span style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:'var(--fs-lg)'}}>{a}</span>
            {b && <span style={{fontSize:'var(--fs-2xs)'}}>{b}</span>}
            {!on && <Icon name="clock" size={12}/>}
          </button>
        ))}
      </div>
      <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:14, textAlign:'center'}}>Нажмите на значок, чтобы узнать условие</div>
    </IBody>
  </>);
};

IDEA_FLOWS.streak = {
  n:6, title:'Серии и челленджи', tag:'игровые механики', effort:'S', href:'9.6 Серии и челленджи.html',
  one:'Недели подряд с заморозкой, челленджи месяца с таблицей группы и коллекция значков.',
  screens:[
    { id:'streak-hub', name:'Обзор', sub:'серия, челленджи, значки', path:['streak-hub'], C:StreakHub },
    { id:'streak-cal', name:'Календарь', sub:'12 недель игр', path:['streak-hub','streak-cal'], C:StreakCal },
    { id:'streak-ch', name:'Челлендж', sub:'прогресс, правила, группа', path:['streak-hub','streak-ch'], C:StreakCh },
    { id:'streak-badges', name:'Значки', sub:'полученные и условия', path:['streak-hub','streak-badges'], C:StreakBadges },
  ],
};

// ============================== 7 · MVP ==============================
const MvpPush = () => {
  const nav = useNav();
  return (<>
    <MiniHeader title="Основа · 28 мая" sub="игра завершена"/>
    <IBody>
      <button onClick={() => nav.push('mvp-vote')} className="vt-card vt-card--hero" style={{padding:20, width:'100%', textAlign:'left', position:'relative', overflow:'hidden', cursor:'pointer'}}>
        <IOrb/>
        <div style={{position:'relative'}}>
          <div className="vt-cap" style={{color:'var(--vt-on-hero-3)'}}>Голосование · до 23:00</div>
          <IdeaH size="var(--fs-5xl)" style={{marginTop:10}}>Кто MVP?</IdeaH>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-on-hero-2)', margin:'10px 0 12px'}}>Проголосовали 7 из 12 · 3 номинации</div>
          <IBar pct={58} dark/>
        </div>
      </button>
      <ICap>Номинации</ICap>
      {[['trophy','MVP игры','главный голос'],['ball','Лучшая подача',''],['shirt','Надёжный приём','']].map(([ic, t, s]) => <IRow key={t} icon={ic} title={t} sub={s || 'анонимно'} />)}
      <ICap>История</ICap>
      <IRow icon="star" title="Зал славы" sub="лидеры сезона и ваши номинации" onClick={() => nav.push('mvp-hall')}/>
      <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:14, lineHeight:1.45}}>Голоса анонимны, за себя голосовать нельзя. Итоги бот пришлёт в чат группы в 23:00.</div>
    </IBody>
  </>);
};
const MvpHall = () => {
  const [tab, setTab] = React.useState(0);
  const data = [[['Маша',5],['Вы',3],['Соня',3],['Игорь',2]],[['Соня',6],['Катя',4],['Вы',2],['Никита',2]],[['Лера',7],['Даша',4],['Вы',3],['Маша',2]]];
  return (<>
    <MiniHeader title="Зал славы" sub="сезон весна–лето" onBack/>
    <IBody>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
        <ITile k="Вы MVP" v="3" unit="раза" tone="cool"/><ITile k="Номинаций" v="8" tone="warm"/>
      </div>
      <div style={{display:'flex', padding:3, gap:2, borderRadius:'var(--r-btn)', background:'var(--vt-ctl-track)', marginTop:16}}>
        {['MVP','Подача','Приём'].map((l, k) => <button key={l} onClick={() => setTab(k)} style={{flex:1, padding:'9px 0', borderRadius:'var(--r-field)', cursor:'pointer', fontWeight:700, fontSize:'var(--fs-sm)', background: tab === k ? 'var(--vt-ink)' : 'transparent', color: tab === k ? '#fff' : 'var(--vt-ink)'}}>{l}</button>)}
      </div>
      <div style={{marginTop:10}}>
        {data[tab].map(([n, v], k) => (
          <div key={n} style={{display:'flex', alignItems:'center', gap:12, padding:'11px 2px', boxShadow: k ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none', fontWeight: n === 'Вы' ? 700 : 400}}>
            <span className="vt-mono" style={{width:16, fontWeight:700, color: k === 0 ? 'var(--vt-orange-ink)' : 'var(--vt-mute-2)'}}>{k + 1}</span>
            {n === 'Вы' ? <Avi name="Артём" init="АР" tag="flame" size="sm"/> : <Avi idx={k + 2} size="sm"/>}<span style={{flex:1, fontSize:'var(--fs-sm)'}}>{n}</span>
            <span className="vt-mono" style={{fontSize:'var(--fs-xl)', fontWeight:700}}>{v}</span>
          </div>
        ))}
      </div>
    </IBody>
  </>);
};

IDEA_FLOWS.mvp = {
  n:7, title:'MVP игры', tag:'ритуал', effort:'S', href:'9.7 MVP игры.html',
  one:'Анонимное голосование в трёх номинациях после игры, итоги в чате группы и зал славы сезона.',
  screens:[
    { id:'mvp-push', name:'После игры', sub:'приглашение голосовать', path:['mvp-push'], C:MvpPush },
    { id:'mvp-vote', name:'Голосование', sub:'3 номинации → итоги', path:['mvp-push','mvp-vote'], C:() => <MVP/> },
    { id:'mvp-hall', name:'Зал славы', sub:'лидеры по номинациям', path:['mvp-push','mvp-hall'], C:MvpHall },
  ],
};

// ============================== 8 · Итоги сезона ==============================
const WrapCover = () => {
  const nav = useNav();
  return (<>
    <MiniHeader title="Итоги сезона" sub="весна–лето 2026"/>
    <IBody>
      <button onClick={() => nav.push('wrap-stories')} className="vt-card vt-card--hero" style={{padding:22, width:'100%', minHeight:300, textAlign:'left', position:'relative', overflow:'hidden', cursor:'pointer', display:'flex', flexDirection:'column'}}>
        <IOrb size={200}/>
        <div style={{position:'relative', marginTop:'auto'}}>
          <div className="vt-cap" style={{color:'var(--vt-on-hero-3)'}}>Готово · 5 историй</div>
          <IdeaH size="var(--fs-6xl)" style={{marginTop:10}}>Ваш<br/>сезон</IdeaH>
          <span className="vt-btn vt-btn--sm" style={{background:'var(--vt-orange)', color:'#fff', marginTop:16, display:'inline-flex'}}>Смотреть</span>
        </div>
      </button>
      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:10}}>
        <ITile k="Игры" v="42" tone="cool"/><ITile k="Часы" v="84" tone="warm"/><ITile k="Приём" v="+0,8"/>
      </div>
      <IRow icon="send" title="Поделиться итогами" sub="картинка для сторис со ссылкой на группу" onClick={() => nav.push('wrap-share')}/>
    </IBody>
  </>);
};
const WrapShare = () => {
  const nav = useNav();
  const [group, setGroup] = React.useState(true);
  return (<>
    <MiniHeader title="Поделиться" onBack/>
    <IBody>
      <div style={{display:'flex', justifyContent:'center'}}>
        <div style={{width:190, aspectRatio:'9/16', borderRadius:'var(--r-card)', background:'var(--vt-blue-ink)', color:'#fff', padding:16, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden'}}>
          <div style={{position:'absolute', right:-40, top:-40, width:120, height:120, borderRadius:'50%', background:'var(--vt-orange)'}}/>
          <span style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:'var(--fs-sm)', position:'relative'}}>Volley<span style={{color:'var(--vt-orange)'}}>Time</span></span>
          <div style={{marginTop:'auto', position:'relative'}}>
            <div style={{fontSize:'var(--fs-2xs)', opacity:.8}}>Мой сезон</div>
            <div style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-6xl)', lineHeight:1}}>42</div>
            <div style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:'var(--fs-lg)'}}>игры</div>
            {group && <div style={{fontSize:'var(--fs-2xs)', marginTop:10, opacity:.85}}>VolleyTime Минск · volleytime.by/g/vt-minsk</div>}
          </div>
        </div>
      </div>
      <button role="switch" aria-checked={group} onClick={() => setGroup(v => !v)} style={{display:'flex', alignItems:'center', gap:12, width:'100%', textAlign:'left', padding:'14px 2px', marginTop:14, boxShadow:'inset 0 -1px 0 var(--vt-bone-2)', cursor:'pointer'}}>
        <span style={{flex:1}}><b style={{fontSize:'var(--fs-sm)'}}>Показать группу и ссылку</b><span style={{display:'block', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>друзья смогут записаться</span></span>
        <span style={{width:40, height:24, borderRadius:'var(--r-pill)', background: group ? 'var(--vt-flame)' : 'var(--vt-ctl-track)', position:'relative', flexShrink:0}}><span style={{position:'absolute', top:3, left: group ? 19 : 3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left .15s'}}/></span>
      </button>
      <IRow icon="tg" title="История в Telegram" onClick={() => nav.toast('Открываем редактор историй Telegram')}/>
      <IRow icon="arrow-d" title="Сохранить картинку" onClick={() => nav.toast('Картинка сохранена · 1080 × 1920')}/>
      <IRow icon="copy" title="Скопировать ссылку" onClick={() => nav.toast('Ссылка скопирована')}/>
    </IBody>
  </>);
};

IDEA_FLOWS.wrap = {
  n:8, title:'Итоги сезона', tag:'виральность', effort:'M', href:'9.8 Итоги сезона.html',
  one:'Раз в сезон — истории с цифрами игрока и карточка для сторис со ссылкой на группу.',
  screens:[
    { id:'wrap-cover', name:'Обложка', sub:'готово, ключевые цифры', path:['wrap-cover'], C:WrapCover },
    { id:'wrap-stories', name:'Истории', sub:'5 слайдов', path:['wrap-cover','wrap-stories'], C:() => <Wrapped/> },
    { id:'wrap-share', name:'Поделиться', sub:'превью и каналы', path:['wrap-cover','wrap-share'], C:WrapShare },
  ],
};
