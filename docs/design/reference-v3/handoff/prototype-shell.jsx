// prototype-shell.jsx — Viewport-scaled frames + scene context bar
// PhonePrototype: centered phone, role switcher, tweaks panel
// DesktopPrototype: centered desktop, mode switcher

const SceneBar = ({ left, right, sub }) => (
  <div style={{
    position:'fixed', top:16, left:16, right:16, zIndex:100,
    display:'flex', alignItems:'center', justifyContent:'space-between', gap:14,
    pointerEvents:'none',
  }}>
    <div style={{display:'flex', alignItems:'center', gap:10, pointerEvents:'auto'}}>
      <a href="Volley Time.html" style={{
        display:'inline-flex', alignItems:'center', gap:8,
        padding:'6px 12px 6px 8px', borderRadius:99,
        background:'rgba(255,255,255,0.75)',
        backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
        border:'1px solid rgba(0,0,0,0.06)',
        fontFamily:"'Golos Text', system-ui, sans-serif",
        fontSize:12.5, fontWeight:600, color:'#0E0E10',
        textDecoration:'none',
        boxShadow:'0 1px 2px rgba(0,0,0,0.04)',
      }}>
        <span style={{
          width:18, height:18, borderRadius:'50%',
          background:'#fff',
          backgroundImage:`url(${window.LOGO_URL || (window.__resources && window.__resources.logo) || 'assets/logo/vt-mark-color.svg'})`,
          backgroundSize:'78%', backgroundPosition:'center', backgroundRepeat:'no-repeat',
          border:'1px solid rgba(0,0,0,0.05)',
        }}/>
        <span>← Все разделы</span>
      </a>
      {left}
    </div>
    <div style={{display:'flex', alignItems:'center', gap:8, pointerEvents:'auto'}}>
      {sub && <span style={{fontSize:11.5, color:'#5B5C64', fontFamily:"'Golos Text', sans-serif"}}>{sub}</span>}
      {right}
    </div>
  </div>
);

const Segmented = ({ value, options, onChange }) => (
  <div style={{
    display:'inline-flex', padding:3, gap:2,
    background:'rgba(255,255,255,0.75)',
    backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
    border:'1px solid rgba(0,0,0,0.06)',
    borderRadius:99,
    boxShadow:'0 1px 2px rgba(0,0,0,0.04)',
  }}>
    {options.map(o => {
      const v = typeof o === 'string' ? o : o.value;
      const lbl = typeof o === 'string' ? o : o.label;
      const active = v === value;
      return (
        <button key={v} onClick={() => onChange(v)} style={{
          border:0, cursor:'pointer',
          padding:'5px 12px', borderRadius:99,
          fontSize:12, fontWeight:600,
          background: active ? '#0E0E10' : 'transparent',
          color: active ? '#fff' : '#0E0E10',
          fontFamily:"'Golos Text', system-ui, sans-serif",
          transition:'background .15s, color .15s',
        }}>{lbl}</button>
      );
    })}
  </div>
);

// Compute viewport-fit scale for a given design size
function useFitScale(designW, designH, padY = 100, padX = 80) {
  const [scale, setScale] = React.useState(1);
  React.useLayoutEffect(() => {
    const calc = () => {
      // Short/narrow panes: shrink the reserved margin before it eats the frame,
      // and never let the available space (or the scale) go non-positive.
      const px = Math.min(padX, window.innerWidth * 0.08);
      const py = Math.min(padY, window.innerHeight * 0.1);
      const vw = Math.max(1, window.innerWidth - px * 2);
      const vh = Math.max(1, window.innerHeight - py * 2);
      setScale(Math.max(0.2, Math.min(1, vw / designW, vh / designH)));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [designW, designH, padY, padX]);
  return scale;
}

// --- Phone prototype shell -------------------------------------------------
const PhonePrototype = ({ width = 390, height = 820, frameCls, children, overlay, sceneLeft, sceneRight }) => {
  const scale = useFitScale(width + 32, height + 32, 100, 60);
  return (
    <div style={{
      width:'100vw', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'radial-gradient(circle at 50% 30%, var(--vt-accent-soft), transparent 60%), #ECEBEF',
      overflow:'hidden',
    }}>
      <SceneBar left={sceneLeft} right={sceneRight}/>
      <div style={{transform:`scale(${scale})`, transformOrigin:'center center'}}>
        <div style={{
          width: width + 24, height: height + 24,
          padding: 12,
          background: '#0E0E10',
          borderRadius: 50,
          boxShadow:'0 24px 60px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.12)',
        }}>
          <div data-vt-popover-root="" className={`vt-phone ${frameCls || ''}`} style={{
            position:'relative',
            width,  height,
            background:'var(--vt-paper)',
            borderRadius: 38,
            overflow:'hidden',
            display:'flex', flexDirection:'column',
          }}>
            {children}
            {overlay}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Desktop prototype shell -----------------------------------------------
const DesktopPrototype = ({ width = 1440, height = 900, frameCls, children, overlay, sceneLeft, sceneRight }) => {
  const scale = useFitScale(width + 60, height + 100, 80, 40);
  return (
    <div style={{
      width:'100vw', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'radial-gradient(circle at 50% 30%, var(--vt-accent-soft), transparent 60%), #ECEBEF',
      overflow:'hidden',
    }}>
      <SceneBar left={sceneLeft} right={sceneRight}/>
      <div style={{transform:`scale(${scale})`, transformOrigin:'center center'}}>
        <div style={{
          width, height,
          background:'var(--vt-paper)',
          borderRadius: 18,
          boxShadow:'0 24px 60px rgba(0,0,0,0.18), 0 2px 4px rgba(0,0,0,0.08)',
          overflow:'hidden',
          position:'relative',
        }}>
          {/* Window chrome */}
          <div style={{
            height: 36, background:'#F4F4F6', borderBottom:0,
            display:'flex', alignItems:'center', gap:8, padding:'0 14px',
            flexShrink:0,
          }}>
            <span style={{width:11, height:11, borderRadius:99, background:'#F45D49'}}/>
            <span style={{width:11, height:11, borderRadius:99, background:'#F7B731'}}/>
            <span style={{width:11, height:11, borderRadius:99, background:'#22C155'}}/>
            <div style={{flex:1, textAlign:'center', fontSize:11.5, color:'#5B5C64', fontFamily:"'Golos Text', sans-serif"}}>app.volleytime.by</div>
          </div>
          <div data-vt-popover-root="" className={frameCls || ''} style={{
            position:'relative',
            width:'100%', height: height - 36,
            background:'var(--vt-paper)',
            overflow:'hidden',
          }}>
            {children}
            {overlay}
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { SceneBar, Segmented, PhonePrototype, DesktopPrototype, useFitScale });
