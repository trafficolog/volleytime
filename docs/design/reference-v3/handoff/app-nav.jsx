// app-nav.jsx — Navigation, action sheets, popovers, toasts
// Drives the interactive Mini App and Web SaaS prototypes.

const NavContext = React.createContext({
  current: 'home', data: {}, canGoBack: false,
  push: () => {}, replace: () => {}, back: () => {}, reset: () => {},
  setData: () => {},
  sheet: (cfg) => {},
  popover: (cfg) => {},
  toast: (msg) => {},
  alert: (cfg) => {},
});

const useNav = () => React.useContext(NavContext);

// --- Hook implementing the stack + overlays ---
function useNavState(initial = 'home') {
  const [stack, setStack] = React.useState([{ s: initial, data: {} }]);
  const top = stack[stack.length - 1];

  const push    = (s, data = {}) => setStack(p => [...p, { s, data }]);
  const replace = (s, data = {}) => setStack(p => [...p.slice(0, -1), { s, data }]);
  const back    = () => setStack(p => p.length > 1 ? p.slice(0, -1) : p);
  const reset   = (s = initial, data = {}) => setStack([{ s, data }]);
  const setData = (d) => setStack(p => {
    const n = p.slice();
    n[n.length - 1] = { ...top, data: { ...top.data, ...d } };
    return n;
  });

  const [sheet, setSheetState] = React.useState(null);
  const sheet_open = (cfg) => setSheetState(cfg);
  const sheet_close = () => setSheetState(null);

  const [popover, setPopoverState] = React.useState(null);
  const popover_open = (cfg) => setPopoverState(cfg);
  const popover_close = () => setPopoverState(null);

  const [toast, setToastState] = React.useState(null);
  const toastTimer = React.useRef();
  const toast_show = (msg, tone = 'ok') => {
    setToastState({ msg, tone });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastState(null), 2400);
  };

  const [alertCfg, setAlertCfg] = React.useState(null);
  const alert_open = (cfg) => setAlertCfg(cfg);
  const alert_close = () => setAlertCfg(null);

  const ctx = {
    current: top.s, data: top.data, canGoBack: stack.length > 1,
    push, replace, back, reset, setData,
    sheet: sheet_open, popover: popover_open,
    toast: toast_show, alert: alert_open,
    _close: { sheet: sheet_close, popover: popover_close, alert: alert_close },
  };
  if (typeof window !== 'undefined') window.__vtNav = ctx;

  return { ctx, sheet, popover, toast, alertCfg };
}

// --- Action sheet (bottom sheet, scoped within container) ---
const ActionSheet = ({ title, sub, items, onClose }) => (
  <>
    <div onClick={onClose} style={{
      position:'absolute', inset:0, background:'var(--vt-scrim)',
      zIndex:50, animation:'vt-fade .14s ease-out'
    }}/>
    <div style={{
      position:'absolute', left:0, right:0, bottom:0,
      background:'var(--vt-paper)',
      borderRadius:'24px 24px 0 0',
      padding:'10px 14px 16px',
      zIndex:51,
      boxShadow:'var(--vt-sheet-shadow)',
      animation:'vt-sheet-up .18s cubic-bezier(.2,.7,.2,1)',
    }}>
      <div style={{width:36, height:4, borderRadius:'var(--r-pill)', background:'var(--vt-stroke-2)', margin:'2px auto 10px'}}/>
      {title && (
        <div style={{padding:'2px 8px 10px', marginBottom:6}}>
          <div style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:'var(--fs-xl)', letterSpacing:0}}>{title}</div>
          {sub && <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{sub}</div>}
        </div>
      )}
      <div style={{display:'flex', flexDirection:'column'}}>
        {items.map((it, i) => it === '---' ? (
          <div key={i} className="vt-divider" style={{margin:'6px 0'}}/>
        ) : (
          <button key={i} role={it.radio !== undefined ? 'radio' : undefined} aria-checked={it.radio !== undefined ? !!it.radio : undefined} onClick={(e) => { onClose(); it.onClick && it.onClick(e); }} style={{
            display:'flex', alignItems:'center', gap:12,
            padding:'12px 8px', textAlign:'left',
            color: it.tone==='danger' ? 'var(--vt-rose)' : 'var(--vt-ink)',
            fontSize:'var(--fs-base)', fontWeight:500, fontFamily:'var(--f-body)',
          }}>
            {it.org
              ? <OrgLogo name={it.label} logo={it.logo}/>
              : it.icon && <Icon name={it.icon} size={17} stroke={it.tone==='danger' ? 'var(--vt-rose)' : 'currentColor'}/>}
            {it.org ? (
              <span style={{flex:1, minWidth:0}}>
                <span style={{display:'block', fontWeight:700, fontSize:'var(--fs-base)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{it.label}</span>
                {it.sub && <span style={{display:'block', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{it.sub}</span>}
              </span>
            ) : <span style={{flex:1}}>{it.label}</span>}
            {!it.org && it.sub && <span style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{it.sub}</span>}
            {it.radio !== undefined && (
              <span aria-hidden="true" style={{width:24, height:24, borderRadius:'var(--r-pill)', flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center',
                background: it.radio ? 'var(--vt-flame)' : 'transparent',
                boxShadow: it.radio ? 'none' : 'inset 0 0 0 2px var(--vt-stroke-2)'}}>
                {it.radio && <Icon name="check" size={14} stroke="var(--vt-on-accent)" sw={2.8}/>}
              </span>
            )}
            {it.check && <Icon name="check" size={16} stroke="var(--vt-flame)" sw={2.4}/>}
          </button>
        ))}
      </div>
      <button onClick={onClose} className="vt-btn vt-btn--ghost vt-btn--full" style={{marginTop:6, fontSize:'var(--fs-base)', padding:'12px 0', borderRadius:'var(--r-chip)'}}>Отмена</button>
    </div>
  </>
);

// --- Popover (desktop, positioned by anchor element) ---
const Popover = ({ anchor, items, onClose, align='right' }) => {
  const ref = React.useRef();
  const [pos, setPos] = React.useState({ top: -9999, left: -9999 });

  React.useLayoutEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const container = anchor.closest('[data-vt-popover-root]') || document.body;
    const cr = container.getBoundingClientRect();
    const top  = r.bottom - cr.top + 6;
    const left = align === 'right'
      ? r.right - cr.left - 200    // panel ~200px wide
      : r.left - cr.left;
    setPos({ top, left });
  }, [anchor, align]);

  return (
    <>
      <div onClick={onClose} style={{position:'absolute', inset:0, zIndex:60, background:'transparent'}}/>
      <div ref={ref} style={{
        position:'absolute', top: pos.top, left: pos.left, width:210,
        background:'var(--vt-paper)',
        border:'1px solid var(--vt-stroke)',
        borderRadius:'var(--r-chip)',
        boxShadow:'var(--vt-pop-shadow)',
        padding:6, zIndex:61,
        animation:'vt-pop-in .12s ease-out',
      }}>
        {items.map((it, i) => it === '---' ? (
          <div key={i} className="vt-divider" style={{margin:'4px 4px'}}/>
        ) : (
          <button key={i} role={it.radio !== undefined ? 'radio' : undefined} aria-checked={it.radio !== undefined ? !!it.radio : undefined} onClick={(e) => { onClose(); it.onClick && it.onClick(e); }} style={{
            display:'flex', alignItems:'center', gap:10, width:'100%',
            padding:'8px 10px', textAlign:'left', borderRadius:'var(--r-sm)',
            color: it.tone==='danger' ? 'var(--vt-rose)' : 'var(--vt-ink)',
            fontSize:'var(--fs-sm)', fontWeight:500, fontFamily:'var(--f-body)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--vt-bone-2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {it.icon && <Icon name={it.icon} size={14} stroke={it.tone==='danger' ? 'var(--vt-rose)' : 'currentColor'}/>}
            <span style={{flex:1}}>{it.label}</span>
            {it.shortcut && <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{it.shortcut}</span>}
          </button>
        ))}
      </div>
    </>
  );
};

// --- Toast (scoped to container) ---
const Toast = ({ msg, tone }) => (
  <div style={{
    position:'absolute', left:'50%', bottom: 84, transform: 'translateX(-50%)',
    background: tone==='danger' ? 'var(--vt-rose)' : 'var(--vt-ink)',
    color: 'var(--vt-on-hero)',
    padding:'10px 16px', borderRadius:'var(--r-pill)',
    fontSize:'var(--fs-sm)', fontWeight:500,
    zIndex:80, whiteSpace:'nowrap',
    boxShadow:'var(--vt-toast-shadow)',
    animation:'vt-toast-in .18s ease-out',
  }}>{msg}</div>
);

// --- Alert (centered modal confirm) ---
const AlertModal = ({ title, body, confirm, cancel='Отмена', onConfirm, onClose, danger }) => (
  <>
    <div onClick={onClose} style={{position:'absolute', inset:0, background:'var(--vt-scrim)', zIndex:90}}/>
    <div style={{
      position:'absolute', left:'50%', top:'50%', transform:'translate(-50%, -50%)',
      width:'min(86%, 360px)',
      background:'var(--vt-paper)',
      border:'1px solid var(--vt-stroke)',
      borderRadius:'var(--r-btn)',
      padding:20, zIndex:91,
      boxShadow:'var(--vt-modal-shadow)',
    }}>
      <div style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-md)'}}>{title}</div>
      {body && <div style={{marginTop:8, fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', lineHeight:1.45}}>{body}</div>}
      <div style={{display:'flex', gap:8, marginTop:18, justifyContent:'flex-end'}}>
        <button className="vt-btn vt-btn--ghost vt-btn--sm" onClick={onClose}>{cancel}</button>
        <button
          className={"vt-btn vt-btn--sm " + (danger ? '' : 'vt-btn--ink')}
          style={danger ? { background:'var(--vt-rose)', color:'var(--vt-on-hero)' } : null}
          onClick={() => { onConfirm && onConfirm(); onClose(); }}>{confirm}</button>
      </div>
    </div>
  </>
);

// --- Single component that hosts all the overlays for a NavProvider ---
const NavOverlays = ({ sheet, popover, toast, alertCfg, ctx }) => (
  <>
    {sheet && <ActionSheet {...sheet} onClose={ctx._close.sheet}/>}
    {popover && <Popover {...popover} onClose={ctx._close.popover}/>}
    {toast && <Toast {...toast}/>}
    {alertCfg && <AlertModal {...alertCfg} onClose={ctx._close.alert}/>}
  </>
);

// --- A small helper: <ActionMore/> — three-dot button that opens an action sheet OR popover ---
const ActionMore = ({ items, title, sub, mode = 'sheet', align = 'right', size = 16, style }) => {
  const nav = useNav();
  const ref = React.useRef();
  const onClick = (e) => {
    e.stopPropagation();
    if (mode === 'popover') {
      nav.popover({ anchor: ref.current, items, align });
    } else {
      nav.sheet({ title, sub, items });
    }
  };
  return (
    <button ref={ref} onClick={onClick} style={{padding:4, color:'var(--vt-mute)', display:'inline-flex', ...style}}>
      <Icon name="more" size={size}/>
    </button>
  );
};

// --- Keyframes (injected once) ---
if (typeof document !== 'undefined' && !document.getElementById('vt-anim-styles')) {
  const s = document.createElement('style');
  s.id = 'vt-anim-styles';
  s.textContent = `
    @keyframes vt-fade { from { opacity:0 } to { opacity:1 } }
    @keyframes vt-sheet-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
    @keyframes vt-pop-in { from { opacity:0; transform: translateY(-4px) } to { opacity:1; transform: translateY(0) } }
    @keyframes vt-toast-in { from { opacity:0; transform: translate(-50%, 6px) } to { opacity:1; transform: translate(-50%, 0) } }
  `;
  document.head.appendChild(s);
}

Object.assign(window, {
  NavContext, useNav, useNavState,
  ActionSheet, Popover, Toast, AlertModal, NavOverlays, ActionMore,
});
