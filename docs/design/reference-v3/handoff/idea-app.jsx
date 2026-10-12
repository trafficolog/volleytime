// idea-app.jsx — оболочка страницы гипотезы: карта экранов слева, телефон с навигацией в глубину справа

const IRow = ({ icon, title, sub, right, onClick, tone }) => { const Tag = onClick ? 'button' : 'div'; return (
  <Tag onClick={onClick} style={{display:'flex', alignItems:'center', gap:12, width:'100%', textAlign:'left', padding:'12px 2px',
    cursor: onClick ? 'pointer' : 'default', boxShadow:'inset 0 -1px 0 var(--vt-bone-2)'}}>
    {icon && <span style={{width:38, height:38, borderRadius:'var(--r-btn)', display:'inline-flex', alignItems:'center', justifyContent:'center', background: tone || 'var(--vt-ctl)', flexShrink:0}}><Icon name={icon} size={17}/></span>}
    <span style={{flex:1, minWidth:0}}>
      <span style={{display:'block', fontSize:'var(--fs-base)', fontWeight:700}}>{title}</span>
      {sub && <span style={{display:'block', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{sub}</span>}
    </span>
    {right}
    {onClick && <Icon name="chevron-r" size={16} stroke="var(--vt-icon-idle)"/>}
  </Tag>
); };
const ICap = ({ children, style }) => <div style={{fontSize:'var(--fs-sm)', fontWeight:700, color:'var(--vt-ink-3)', margin:'22px 2px 8px', ...style}}>{children}</div>;
const IBody = ({ children }) => <div className="vt-phone__body" style={{padding:'4px 16px 24px'}}>{children}</div>;
const IFoot = ({ children }) => <div style={{padding:'10px 16px 20px', display:'flex', gap:8}}>{children}</div>;
const IOrb = ({ size = 130, at = 'tr' }) => <div style={{position:'absolute', width:size, height:size, borderRadius:'50%', background:'var(--vt-orange)',
  ...(at === 'tr' ? { right:-size * .3, top:-size * .3 } : { right:-size * .3, bottom:-size * .3 })}}/>;
const IBar = ({ pct, dark, h = 6 }) => (
  <div style={{height:h, borderRadius:'var(--r-pill)', overflow:'hidden', background: dark ? 'var(--vt-on-hero-line)' : 'var(--vt-ctl-track)'}}>
    <div style={{width:`${pct}%`, height:'100%', borderRadius:'var(--r-pill)', background: dark ? 'var(--vt-on-hero)' : 'var(--vt-flame)'}}/>
  </div>
);
const ITile = ({ k, v, unit, tone, sub }) => (
  <div className={`vt-card${tone ? ' vt-card--' + tone : ''}`} style={{padding:14, display:'flex', flexDirection:'column', minHeight:92}}>
    <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{k}</div>
    <div style={{marginTop:'auto', paddingTop:10}}>
      <span className="vt-mono" style={{fontSize:'var(--fs-3xl)', fontWeight:700, lineHeight:1}}>{v}</span>
      {unit && <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginLeft:4}}>{unit}</span>}
    </div>
    {sub && <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:4}}>{sub}</div>}
  </div>
);

const IdeaDeepApp = () => {
  const FLOWS = window.IDEA_FLOWS;
  const ORDER = ['coach','warm','self','prog','teams','streak','mvp','wrap'];
  const file = decodeURIComponent((location.pathname.split('/').pop() || ''));
  const id = window.IDEA_ID || ORDER.find(k => FLOWS[k] && file === FLOWS[k].href) || location.hash.slice(1) || 'coach';
  const F = FLOWS[id];
  const { ctx, sheet, popover, toast, alertCfg } = useNavState(F.screens[0].id);
  const [scale, setScale] = React.useState(1);
  const stageRef = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = stageRef.current;
    const f = () => {
      const h = el ? el.clientHeight : window.innerHeight;
      const w = el ? el.clientWidth : window.innerWidth;
      setScale(Math.max(.3, Math.min(1, (h - 64) / 860, (w - 32) / 400)));
    };
    f();
    const ro = new ResizeObserver(f);
    if (el) ro.observe(el);
    ro.observe(document.documentElement);
    window.addEventListener('resize', f);
    return () => { ro.disconnect(); window.removeEventListener('resize', f); };
  }, []);
  React.useEffect(() => { document.title = `VolleyTime · ${F.title}`; }, []);
  const cur = F.screens.find(s => s.id === ctx.current) || F.screens[0];
  const go = (s) => { ctx.reset(s.path[0]); s.path.slice(1).forEach(p => ctx.push(p)); };
  const i = ORDER.indexOf(id), prev = FLOWS[ORDER[i - 1]], next = FLOWS[ORDER[i + 1]];
  const Scr = cur.C;
  return (
    <div className="ia">
      <aside className="ia-side">
        <a className="ia-back" href="9 Гипотезы для игроков.html">← Все гипотезы</a>
        <div className="ia-num">{String(F.n).padStart(2, '0')} · {F.tag} · усилие {F.effort}</div>
        <h1 className="D">{F.title}</h1>
        <p className="ia-lead">{F.one}</p>
        <div className="ia-cap">Экраны · {F.screens.length}</div>
        <ol className="ia-map">
          {F.screens.map((s, k) => (
            <li key={s.id}>
              <button className={s.id === ctx.current ? 'on' : ''} onClick={() => go(s)} aria-current={s.id === ctx.current ? 'step' : undefined}>
                <span className="i">{k + 1}</span>
                <span className="t"><b>{s.name}</b><small>{s.sub}</small></span>
                <span className="d">{'›'.repeat(s.path.length - 1) || ''}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="ia-hint">Экраны связаны: нажимайте внутри телефона, «назад» в шапке возвращает по стеку. Список слева сразу переносит на нужный экран, стрелки показывают глубину.</div>
        <nav className="ia-pn">
          {prev ? <a href={prev.href}>← {prev.title}</a> : <span/>}
          {next ? <a href={next.href}>{next.title} →</a> : <span/>}
        </nav>
      </aside>
      <main className="ia-stage" ref={stageRef}>
        <div style={{width:390 * scale, height:844 * scale}}>
          <div style={{transform:`scale(${scale})`, transformOrigin:'0 0'}}>
            <div className="vt-phone vt-frame" data-vt-popover-root="" style={{width:390, height:844, borderRadius:44, overflow:'hidden', position:'relative',
              display:'flex', flexDirection:'column', background:'var(--vt-paper)', boxShadow:'0 1px 2px rgba(21,22,26,.06), 0 24px 60px -24px rgba(21,22,26,.35)'}}>
              <NavContext.Provider value={ctx}>
                <StatusBar time="19:24"/>
                <div style={{flex:1, display:'flex', flexDirection:'column', minHeight:0, position:'relative'}}>
                  <Scr key={ctx.current}/>
                </div>
                <NavOverlays sheet={sheet} popover={popover} toast={toast} alertCfg={alertCfg} ctx={ctx}/>
              </NavContext.Provider>
            </div>
          </div>
        </div>
        <div className="ia-now">Сейчас: <b>{cur.name}</b></div>
      </main>
    </div>
  );
};

Object.assign(window, { IRow, ICap, IBody, IFoot, IOrb, IBar, ITile, IdeaDeepApp });
