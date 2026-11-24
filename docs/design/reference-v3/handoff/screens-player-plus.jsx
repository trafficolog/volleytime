// screens-player-plus.jsx — Mini App игрока после гипотез (вариант A «Лента дня»):
// лента функций на главной, общий календарь, личная настройка «Что показывать», флоу гипотез в стеке

const usePlayerFeat = () => { const [s] = useGroupSettings(); return s.feat || {}; };

const PlayerStreakChip = () => {
  const nav = useNav();
  const f = usePlayerFeat();
  if (!f.streak) return null;
  return (
    <button onClick={() => nav.push('streak-hub')} aria-label="Серия: 6 недель подряд" className="vt-chip"
      style={{gap:5, background:'var(--vt-orange-soft)', color:'var(--vt-orange-ink)', flexShrink:0, cursor:'pointer', border:0, minHeight:32}}>
      <Icon name="star" size={12} sw={2.2}/>6 нед.
    </button>
  );
};

const PfRow = ({ icon, title, sub, onClick, tone = '' }) => (
  <button onClick={onClick} className={`vt-card${tone ? ' vt-card--' + tone : ''}`} style={{padding:'14px 16px', display:'flex', alignItems:'center', gap:12, textAlign:'left', cursor:'pointer', width:'100%'}}>
    <span style={{width:36, height:36, borderRadius:'var(--r-btn)', background:'var(--vt-ctl)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}><Icon name={icon} size={17}/></span>
    <span style={{flex:1, minWidth:0}}>
      <span style={{display:'block', fontSize:'var(--fs-base)', fontWeight:700}}>{title}</span>
      {sub && <span style={{display:'block', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{sub}</span>}
    </span>
    <Icon name="chevron-r" size={16} stroke="var(--vt-icon-idle)" sw={2.2}/>
  </button>
);

// Лента на главной: только включённые игроком функции
const PlayerFeed = () => {
  const nav = useNav();
  const f = usePlayerFeat();
  const any = f.teams || f.warmup || f.self || f.mvp || f.coach || f.wrapped;
  return (
    <>
      {any && <h2 style={{fontSize:'var(--fs-xl)', marginTop:28}}>Сегодня</h2>}
      <div style={{display:'flex', flexDirection:'column', gap:12, marginTop: any ? 12 : 0}}>
        {f.teams && <PfRow icon="users" title="Составы на игру" sub="Основа · появятся в 19:00, за час до начала" onClick={() => nav.push('teams-game')}/>}
        {f.warmup && <FWarmInGame time="20:00" arrive="19:55" compact/>}
        {(f.self || f.mvp) && (
          <div className="vt-card vt-card--warm" style={{padding:16}}>
            <div className="vt-cap" style={{color:'var(--vt-orange-ink)'}}>После игры · Вс, Микст</div>
            <div style={{fontSize:'var(--fs-md)', fontWeight:700, marginTop:6}}>Как сыграли?</div>
            <div style={{display:'flex', gap:8, marginTop:12}}>
              {f.self && <button onClick={() => nav.push('self-form')} className="vt-btn vt-btn--ink vt-btn--sm" style={{flex:1}}>Самооценка</button>}
              {f.mvp && <button onClick={() => nav.push('mvp-vote')} className="vt-btn vt-btn--sm" style={{flex:1, background: f.self ? 'var(--vt-paper)' : 'var(--vt-ink)', color: f.self ? 'var(--vt-ink)' : 'var(--vt-paper)'}}>MVP · до 23:00</button>}
            </div>
          </div>
        )}
        {f.coach && (
          <button onClick={() => nav.push('coach-hub')} className="vt-card vt-card--cool" style={{padding:16, textAlign:'left', cursor:'pointer'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span className="vt-cap" style={{color:'var(--vt-flame-ink)'}}>Тренер · подача · неделя 2</span>
              <Icon name="chevron-r" size={16} stroke="var(--vt-flame-ink)" sw={2.2}/>
            </div>
            <div style={{fontSize:'var(--fs-sm)', marginTop:6, color:'var(--vt-ink)'}}>Следующая: <b>Чт · техника подачи · 30 мин</b></div>
            <FWeekStrip/>
          </button>
        )}
        {f.wrapped && <PfRow icon="gift" title="Итоги сезона готовы" sub="Весна–лето · 8 историй о ваших играх" onClick={() => nav.push('wrap-cover')}/>}
      </div>
    </>
  );
};

const PlayerFeedFoot = () => {
  const nav = useNav();
  const f = usePlayerFeat();
  const on = FA_FEATS.filter(x => f[x.k]).length;
  return (
    <button onClick={() => nav.push('features')} style={{marginTop:24, width:'100%', padding:'12px 14px', borderRadius:'var(--r-chip)', background:'var(--vt-bone)', border:0, cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left', font:'inherit', color:'var(--vt-ink)', minHeight:44}}>
      <Icon name="settings" size={16}/>
      <span style={{flex:1, fontSize:'var(--fs-xs)', lineHeight:1.4}}>{on ? 'Лишнее на главной? Выключите в профиле.' : 'Сейчас только расписание игр. Другие функции — в профиле.'}</span>
      <Icon name="chevron-r" size={14} stroke="var(--vt-icon-idle)"/>
    </button>
  );
};

// Блок «Мои функции» в профиле — ссылки только на включённое
const PlayerProfileFeatures = () => {
  const nav = useNav();
  const f = usePlayerFeat();
  const rows = [
    f.self && ['chart', 'Мой прогресс', 'навыки и путь до уровня', 'prog-hub'],
    f.coach && ['ball', 'План тренера', 'история занятий', 'coach-history'],
    f.streak && ['star', 'Серии и челленджи', '6 недель подряд', 'streak-hub'],
    f.mvp && ['trophy', 'Зал славы MVP', 'итоги голосований', 'mvp-hall'],
  ].filter(Boolean);
  return (
    <>
      <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'22px 4px 8px'}}>Мои функции</div>
      <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
        {[...rows, ['settings', 'Что показывать в приложении', `${FA_FEATS.filter(x => f[x.k]).length} из ${FA_FEATS.length} включено`, 'features']].map(([ic, t, s, to], i, a) => (
          <button key={t} onClick={() => nav.push(to)} style={{display:'flex', alignItems:'center', gap:12, padding:'12px 14px', boxShadow: i < a.length - 1 ? 'inset 0 -1px 0 var(--vt-bone-2)' : 'none', width:'100%', textAlign:'left', cursor:'pointer'}}>
            <Icon name={ic} size={16} stroke="var(--vt-mute-2)"/>
            <div style={{flex:1}}>
              <div style={{fontSize:'var(--fs-base)', fontWeight: to === 'features' ? 700 : 500}}>{t}</div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{s}</div>
            </div>
            <Icon name="chevron-r" size={14} stroke="var(--vt-icon-idle)"/>
          </button>
        ))}
      </div>
    </>
  );
};

const PlayerFeatures = () => {
  const nav = useNav();
  const f = usePlayerFeat();
  return <FaFeatures embed f={f} setF={(v) => setSetting('feat', v)} onBack={() => nav.canGoBack ? nav.back() : nav.reset('profile')}/>;
};

const PlayerMyCalendar = () => <MyCalendar embed/>;

// Флоу гипотез (IDEA_FLOWS) встают в стек Mini App: id экранов уже с префиксами
const ideaScreens = () => {
  const out = {};
  Object.values(window.IDEA_FLOWS || {}).forEach(F => F.screens.forEach(s => { out[s.id] = { Component: s.C, label: s.name }; }));
  return out;
};

Object.assign(window, { usePlayerFeat, PlayerStreakChip, PlayerFeed, PlayerFeedFoot, PlayerProfileFeatures, PlayerFeatures, PlayerMyCalendar, ideaScreens });
