// atoms.jsx — shared atoms used across all screens
// Exposes to window so other babel scripts can use them.

const Ball = ({ size = 16, style = {} }) => (
  <span className="vt-ball" style={{ fontSize: size, ...style }} />
);

// Simple stroked icon set — kept geometric, no AI-slop figures
const Icon = ({ name, size = 18, stroke = 'currentColor', sw = 1.6 }) => {
  const c = { width: size, height: size, fill: 'none', stroke, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home': return <svg viewBox="0 0 24 24" {...c}><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/></svg>;
    case 'calendar': return <svg viewBox="0 0 24 24" {...c}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>;
    case 'ticket': return <svg viewBox="0 0 24 24" {...c}><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z"/><path d="M12 7v10"/></svg>;
    case 'user': return <svg viewBox="0 0 24 24" {...c}><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>;
    case 'plus': return <svg viewBox="0 0 24 24" {...c}><path d="M12 5v14M5 12h14"/></svg>;
    case 'chevron-r': return <svg viewBox="0 0 24 24" {...c}><path d="m9 6 6 6-6 6"/></svg>;
    case 'chevron-l': return <svg viewBox="0 0 24 24" {...c}><path d="m15 6-6 6 6 6"/></svg>;
    case 'chevron-d': return <svg viewBox="0 0 24 24" {...c}><path d="m6 9 6 6 6-6"/></svg>;
    case 'close': return <svg viewBox="0 0 24 24" {...c}><path d="m6 6 12 12M18 6 6 18"/></svg>;
    case 'check': return <svg viewBox="0 0 24 24" {...c}><path d="m5 12 5 5 9-11"/></svg>;
    case 'bell': return <svg viewBox="0 0 24 24" {...c}><path d="M6 16V10a6 6 0 0 1 12 0v6"/><path d="M4 17h16"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>;
    case 'pin': return <svg viewBox="0 0 24 24" {...c}><path d="M12 21s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>;
    case 'clock': return <svg viewBox="0 0 24 24" {...c}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'wallet': return <svg viewBox="0 0 24 24" {...c}><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="15" r="1.5"/></svg>;
    case 'users': return <svg viewBox="0 0 24 24" {...c}><circle cx="9" cy="9" r="3.5"/><path d="M3 19c.7-3 3.3-5 6-5s5.3 2 6 5"/><path d="M16 11a3 3 0 1 0 0-6"/><path d="M18 19c-.4-2-1.8-3.5-3.5-4.3"/></svg>;
    case 'card': return <svg viewBox="0 0 24 24" {...c}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/></svg>;
    case 'settings': return <svg viewBox="0 0 24 24" {...c}><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M5.6 18.4l1.5-1.5M16.9 7.1l1.5-1.5"/></svg>;
    case 'chart': return <svg viewBox="0 0 24 24" {...c}><path d="M4 19V5M4 19h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/></svg>;
    case 'send': return <svg viewBox="0 0 24 24" {...c}><path d="m22 2-7 20-4-9-9-4Z"/></svg>;
    case 'search': return <svg viewBox="0 0 24 24" {...c}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case 'filter': return <svg viewBox="0 0 24 24" {...c}><path d="M3 5h18M6 12h12M10 19h4"/></svg>;
    case 'edit': return <svg viewBox="0 0 24 24" {...c}><path d="M4 20h4l10-10-4-4L4 16Z"/><path d="m14 6 4 4"/></svg>;
    case 'trash': return <svg viewBox="0 0 24 24" {...c}><path d="M4 7h16M9 7V4h6v3M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7"/></svg>;
    case 'more': return <svg viewBox="0 0 24 24" {...c}><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>;
    case 'copy': return <svg viewBox="0 0 24 24" {...c}><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>;
    case 'link': return <svg viewBox="0 0 24 24" {...c}><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>;
    case 'tg': return <svg viewBox="0 0 24 24" {...c}><path d="m21 4-3 17-7-5-3 2v-4l11-9-13 7-4-1Z"/></svg>;
    case 'arrow-r': return <svg viewBox="0 0 24 24" {...c}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'arrow-u': return <svg viewBox="0 0 24 24" {...c}><path d="M12 5v14M6 11l6-6 6 6"/></svg>;
    case 'arrow-d': return <svg viewBox="0 0 24 24" {...c}><path d="M12 5v14M6 13l6 6 6-6"/></svg>;
    case 'menu': return <svg viewBox="0 0 24 24" {...c}><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
    case 'building': return <svg viewBox="0 0 24 24" {...c}><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2"/></svg>;
    case 'gift': return <svg viewBox="0 0 24 24" {...c}><rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 13h18M12 9v12M8 9a3 3 0 1 1 4-3 3 3 0 1 1 4 3"/></svg>;
    case 'star': return <svg viewBox="0 0 24 24" {...c}><path d="m12 4 2.6 5.4 6 .9-4.3 4.2 1 6L12 17.6l-5.3 2.9 1-6L3.4 10.3l6-.9Z"/></svg>;
    case 'qr': return <svg viewBox="0 0 24 24" {...c}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3M20 14v3M14 20h3M20 17v4"/></svg>;
    case 'logout': return <svg viewBox="0 0 24 24" {...c}><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>;
    case 'globe': return <svg viewBox="0 0 24 24" {...c}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
    case 'ball': return <svg viewBox="0 0 24 24" {...c}><circle cx="12" cy="12" r="9"/><path d="M12 3c-1.5 3-1.5 6 0 9s4.5 5 9 4.5"/><path d="M3.6 8.2c3.2-.4 6.2.7 8.4 3.8"/><path d="M8.2 20.4c-.6-3.3.6-6.3 3.8-8.4"/></svg>;
    case 'trophy': return <svg viewBox="0 0 24 24" {...c}><path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8.5 20h7M10 17h4v3h-4z"/></svg>;
    case 'shirt': return <svg viewBox="0 0 24 24" {...c}><path d="M9 4 4 6.5 5.5 11 8 10v10h8V10l2.5 1L20 6.5 15 4a3 3 0 0 1-6 0Z"/></svg>;
    case 'arena': return <svg viewBox="0 0 24 24" {...c}><path d="M3 9 12 4l9 5"/><path d="M5 9v10M19 9v10M3 19h18"/><rect x="9" y="13" width="6" height="6" rx="1"/></svg>;
    case 'party': return <svg viewBox="0 0 24 24" {...c}><path d="m4 20 5-13 8 8Z"/><path d="M14 4v2M19 5l-1.5 1.5M20 10h-2M15 9l3-3"/></svg>;
    case 'bus': return <svg viewBox="0 0 24 24" {...c}><rect x="4" y="4" width="16" height="13" rx="2"/><path d="M4 11h16M8 17v3M16 17v3"/><circle cx="8" cy="14" r=".6" fill="currentColor"/><circle cx="16" cy="14" r=".6" fill="currentColor"/></svg>;
    case 'court': return (
      <svg viewBox="0 0 24 24" {...c}>
        <rect x="3" y="6" width="18" height="12" rx="1"/>
        <path d="M12 6v12M3 12h18M7 6v12M17 6v12"/>
      </svg>
    );
    default: return null;
  }
};

// People mock data — used across all screens for visual continuity
const PEOPLE = [
  { name: 'Артём',   init:'АР', tag: 'flame',  level:'A' },
  { name: 'Никита',  init:'НК', tag: 'ink',    level:'B' },
  { name: 'Маша',    init:'МА', tag: 'amber',  level:'A' },
  { name: 'Лера',    init:'ЛР', tag: 'grass',  level:'B' },
  { name: 'Игорь',   init:'ИГ', tag: 'ink',    level:'B' },
  { name: 'Соня',    init:'СН', tag: 'flame',  level:'A' },
  { name: 'Денис',   init:'ДН', tag: 'amber',  level:'B' },
  { name: 'Юля',     init:'ЮЛ', tag: 'grass',  level:'C' },
  { name: 'Стас',    init:'СТ', tag: 'ink',    level:'B' },
  { name: 'Катя',    init:'КТ', tag: 'flame',  level:'A' },
  { name: 'Паша',    init:'ПШ', tag: 'amber',  level:'C' },
  { name: 'Даша',    init:'ДШ', tag: 'grass',  level:'B' },
  { name: 'Лёша',    init:'ЛА', tag: 'ink',    level:'A' },
  { name: 'Оля',     init:'ОЛ', tag: 'flame',  level:'B' },
];

const Avi = ({ idx = 0, size = 'md', name, init, tag }) => {
  const p = (name || init) ? { name, init, tag } : PEOPLE[idx % PEOPLE.length];
  const cls = ['vt-avi', size === 'sm' ? 'vt-avi--sm' : size === 'lg' ? 'vt-avi--lg' : '', `vt-avi--${p.tag || 'ink'}`].filter(Boolean).join(' ');
  return <span className={cls}>{p.init}</span>;
};

// iOS-style status bar
const StatusBar = ({ time = '19:24' }) => (
  <div className="vt-phone__status">
    <span>{time}</span>
    <span className="right">
      <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="6" width="3" height="4"/><rect x="4" y="4" width="3" height="6"/><rect x="8" y="2" width="3" height="8"/><rect x="12" y="0" width="3" height="10"/></svg>
      <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M1 5c2-3 10-3 12 0M3 7c1.5-2 5.5-2 8 0M5.5 9c.8-1 2.2-1 3 0"/></svg>
      <svg width="22" height="11" viewBox="0 0 22 11" fill="none" stroke="currentColor" strokeWidth="1"><rect x=".5" y=".5" width="18" height="10" rx="2.5"/><rect x="2" y="2" width="13" height="7" fill="currentColor"/><rect x="19.5" y="3.5" width="1.5" height="4" fill="currentColor"/></svg>
    </span>
  </div>
);

// Mini app top header (with optional close + title)
const MiniHeader = ({ title, sub, onBack, right }) => {
  const nav = typeof useNav === 'function' ? useNav() : null;
  const handleBack = onBack === true
    ? () => nav && nav.back()
    : (typeof onBack === 'function' ? onBack : null);
  return (
    <div className="vt-miniheader">
      <div style={{display:'flex', alignItems:'center', gap:10, minWidth:0}}>
        {handleBack && (
          <button onClick={handleBack} className="vt-btn vt-btn--ghost vt-btn--sm" style={{borderRadius:'var(--r-sm)', padding:'6px 8px'}}>
            <Icon name="chevron-l" size={16}/>
          </button>
        )}
        <div style={{minWidth:0}}>
          <div style={{fontFamily:'var(--f-display)', fontWeight:600, fontSize:'var(--fs-md)', lineHeight:1.15, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{title}</div>
          {sub && <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  );
};

// Tab bar — Player
const TabBar = ({ active = 'home' }) => {
  const nav = typeof useNav === 'function' ? useNav() : null;
  const tabs = [
    { id:'home', screen:'home', label:'Главная', icon:'home' },
    { id:'subs', screen:'subs', label:'Абонементы', icon:'ticket' },
    { id:'contrib', screen:'contrib-hub', label:'Сборы', icon:'gift' },
    { id:'me', screen:'profile', label:'Профиль', icon:'user' },
  ];
  const handle = (t) => {
    if (!nav) return;
    if (t.screen) nav.reset(t.screen);
  };
  return (
    <div className="vt-tabbar">
      {tabs.map(t => (
        <button key={t.id} data-active={active === t.id} onClick={() => handle(t)}>
          <span className="ico"><Icon name={t.icon} size={20}/></span>
          {t.label}
        </button>
      ))}
    </div>
  );
};

// Organizer tab bar
const OrgTabBar = ({ active = 'home' }) => {
  const nav = typeof useNav === 'function' ? useNav() : null;
  const tabs = [
    { id:'home', screen:'home', label:'События', icon:'calendar' },
    { id:'members', screen:'members', label:'Игроки', icon:'users' },
    { id:'cash', screen:'ledger', label:'Касса', icon:'wallet' },
    { id:'contrib', screen:'contribs', label:'Сборы', icon:'gift' },
  ];
  const handle = (t) => { if (nav && t.screen) nav.reset(t.screen); };
  return (
    <div className="vt-tabbar">
      {tabs.map(t => (
        <button key={t.id} data-active={active === t.id} onClick={() => handle(t)}>
          <span className="ico"><Icon name={t.icon} size={20}/></span>
          {t.label}
        </button>
      ))}
    </div>
  );
};

// Generic phone wrapper
const Phone = ({ children, time }) => (
  <div className="vt-phone">
    <StatusBar time={time}/>
    {children}
  </div>
);

// Ledger category labels — enum stays internal, this is what users read
const CAT_LABEL = {
  rent:'аренда зала', balls:'мячи / инвентарь', training_fee:'тренировка',
  subscription:'абонемент', contribution:'сбор', refund:'возврат',
  referee:'судья / тренер', other:'прочее',
};
const catLabel = (c) => CAT_LABEL[c] || c;

// Payment-method labels — enum stays internal
const METHOD_LABEL = { cash:'наличные', transfer:'перевод', erip:'ЕРИП', online:'картой онлайн', subscription:'абонемент' };
const methodLabel = (m) => METHOD_LABEL[m] || m;

// Capacity colour — one rule, used by every meter so list and detail cannot diverge
const meterTint = (pct) => pct >= 100 ? 'var(--vt-rose)' : pct > 70 ? 'var(--vt-amber)' : 'var(--vt-grass)';

// Group settings — one store. Every surface reads the same value, and the
// controls that change it write through here, so a switch cannot desync
// from the setting it controls.
const VT_SETTINGS = { subsOn: true, maxSeats: 3, priceMode: 'fixed', cancelAllowed: true, cancelCutoff: 'за 6 ч' };
const vtSettingsSubs = new Set();
const getSetting = (k) => VT_SETTINGS[k];
const setSetting = (k, v) => { VT_SETTINGS[k] = v; vtSettingsSubs.forEach(fn => fn()); };
// React binding: re-renders consumers when any setting changes
const useGroupSettings = () => {
  const [, bump] = React.useState(0);
  React.useEffect(() => {
    const fn = () => bump(n => n + 1);
    vtSettingsSubs.add(fn);
    return () => vtSettingsSubs.delete(fn);
  }, []);
  return [VT_SETTINGS, setSetting];
};

// Roster rule — one source for list badges and the detail screen.
// Seats are packed until the event's seat count is filled, so a player
// holding several seats occupies one row but several places.
const SEATS_BY_NAME = { 'Маша': 2, 'Игорь': 3 };
const seatsOf = (p) => SEATS_BY_NAME[p.name] || 1;
const buildRoster = (headCount, { isSplit = false, subsEnabled = VT_SETTINGS.subsOn } = {}) => {
  // Subscriptions are optional per group, and never apply when the total is split
  const subsUsable = subsEnabled && !isSplit;
  const rows = [];
  let filled = 0;
  for (const p of PEOPLE) {
    const s = seatsOf(p);
    if (filled + s > headCount) continue;
    rows.push(p); filled += s;
    if (filled >= headCount) break;
  }
  return rows.map((p, i) => ({
    ...p,
    seats: seatsOf(p),
    pay: i % 5 === 0 ? 'pending' : (subsUsable && i % 7 === 0) ? 'subs' : 'paid',
  }));
};
const pendingOf = (headCount, opts) => buildRoster(headCount, opts).filter(p => p.pay === 'pending').length;

// Canonical event fixture — one shape, read by the dashboard list, the events
// table and the detail screen, so a detail screen cannot receive a shape its
// renderer doesn't expect.
const VT_EVENTS = [
  { id:'e1', dow:'СР', dnum:28, month:'мая', t:'20:00', m:'Основа', venue:'Школа №24',
    main:'12/14', meter:86, joinedCount:12, paid:'10/12', pending:2, st:'Запись', col:3 },
  { id:'e2', dow:'СР', dnum:28, month:'мая', t:'08:00', m:'Утренняя', venue:'Школа №24',
    main:'6/12', meter:50, joinedCount:6, paid:'6/6', okAll:true, st:'Запись', col:3 },
  { id:'e3', dow:'ПТ', dnum:30, month:'мая', t:'19:30', m:'Открытая игра', venue:'СК «Заслонова»',
    main:'9/14', meter:64, joinedCount:9, paid:'9/9', okAll:true, st:'Запись', col:5 },
  { id:'e4', dow:'СБ', dnum:7, month:'июня', t:'11:00', m:'Аренда большого зала', venue:'СК «Заслонова»',
    main:'8/16', meter:50, joinedCount:8, paid:'5/8', pending:3, st:'Запись', col:6,
    priceMode:'split', total:240 },
  { id:'e9', dow:'ВС', dnum:8, month:'июня', t:'11:00', m:'Воскресная игра', venue:'Школа №24',
    main:'12/16', meter:75, joinedCount:12, paid:'8/12', pending:4, st:'Закрыта', closed:true, col:7,
    priceMode:'split', total:180 },
  { id:'e5', dow:'ВС', dnum:1, month:'июня', t:'10:00', m:'Микст', venue:'Школа №24',
    main:'14/14', meter:100, joinedCount:14, paid:'12/14', wait:2, pending:2, st:'Мест нет', col:7 },
  { id:'e6', dow:'СР', dnum:4, month:'июня', t:'20:00', m:'Основа', venue:'Школа №24',
    main:'3/14', meter:21, joinedCount:3, paid:'2/3', st:'Запись', col:3 },
  { id:'e7', dow:'ПН', dnum:25, month:'мая', t:'20:00', m:'Основа', venue:'Школа №24',
    main:'13/14', meter:93, joinedCount:13, paid:'13/13', okAll:true, st:'Прошла', past:true, col:1 },
  { id:'e8', dow:'ВС', dnum:31, month:'мая', t:'10:00', m:'Товарищеская', venue:'СК «Заслонова»',
    main:'12/12', meter:100, joinedCount:12, paid:'12/12', okAll:true, st:'Прошла', past:true, col:7,
    priceMode:'split', total:180 },
];
// Payment counts are derived from the same roster rule the detail page uses,
// so the list row and the event page cannot disagree.
VT_EVENTS.forEach(e => {
  if (e.past || e.okAll || !e.joinedCount) return;
  const rows = buildRoster(e.joinedCount, { isSplit: e.priceMode === 'split' });
  const pend = rows.filter(p => p.pay === 'pending').reduce((s, p) => s + p.seats, 0);
  e.pending = pend;
  e.paid = `${e.joinedCount - pend}/${e.joinedCount}`;
});
// Upcoming first in date order, past after — newest first
{
  const M = { 'апреля':4, 'мая':5, 'июня':6, 'июля':7 };
  const key = (e) => (M[e.month] || 0) * 100 + e.dnum;
  VT_EVENTS.sort((x, y) => (!!x.past - !!y.past) || (x.past ? key(y) - key(x) : key(x) - key(y)));
}
if (typeof window !== 'undefined') window.VT_EVENTS = VT_EVENTS;
// Display helpers so every surface labels the same event identically
const evDate = (e) => `${e.dow} ${e.dnum} ${e.month}`;
const evPrice = (e) => e.priceMode === 'split' ? e.total / e.joinedCount : 15;

// Pending payments — one queue, read by the Mini App and the desktop dashboard
const PENDING_PAYMENTS = [
  { id:1, name:'Никита', init:'НК', tag:'ink', event:'Основа · 28 мая', amount:15, seats:1, ago:'6 ч', method:'cash' },
  { id:2, name:'Маша', init:'МА', tag:'amber', event:'Аренда большого зала · 7 июня', amount:30, seats:2, ago:'4 ч', method:'transfer', split:true, perSeat:30 },
  { id:3, name:'Игорь', init:'ИГ', tag:'ink', event:'Аренда большого зала · 7 июня', amount:30, seats:3, ago:'2 ч', method:'cash', split:true, perSeat:30 },
  { id:4, name:'Соня', init:'СН', tag:'flame', event:'Микст · 1 июня · абонемент', amount:110, seats:1, ago:'1 ч', method:'transfer', sub:true },
];

// Campaign icons — stroked SVG in a toned tile, same language as the rest of the UI
const CAMPAIGN_ICONS = {
  ball:   { label:'Мячи / инвентарь', bg:'var(--vt-orange-soft)',     fg:'var(--vt-orange-ink)' },
  trophy: { label:'Турнир',           bg:'var(--vt-blue-soft-tile)',  fg:'var(--vt-flame-deep)' },
  shirt:  { label:'Форма',            bg:'var(--vt-grass-soft)',      fg:'var(--vt-grass-ink)' },
  arena:  { label:'Аренда зала',      bg:'var(--vt-bone-2)',          fg:'var(--vt-ink-3)' },
  party:  { label:'Праздник',         bg:'var(--vt-amber-soft)',      fg:'var(--vt-amber-ink)' },
  bus:    { label:'Выезд',            bg:'var(--vt-rose-soft)',       fg:'var(--vt-rose-ink)' },
};
const CampaignIcon = ({ name = 'ball', size = 44, onDark }) => {
  const m = CAMPAIGN_ICONS[name] || CAMPAIGN_ICONS.ball;
  return (
    <span style={{
      width:size, height:size, borderRadius: Math.round(size*0.32), flexShrink:0,
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      background: onDark ? 'var(--vt-on-hero-fill)' : m.bg,
      color: onDark ? 'var(--vt-on-hero)' : m.fg,
    }}><Icon name={name} size={Math.round(size*0.5)} sw={1.8}/></span>
  );
};

// Player event feed — one list for Главная and Мои записи, so they cannot diverge
const PLAYER_EVENTS = [
  { id:'e1', day:'Ср', date:'28 мая', title:'Основа', time:'20:00 — 22:00', venue:'Школа №24', hall:'малый зал', main:'12/14', meterPct:86, status:'open', joined:true, pay:'sub', mySeats:1 },
  { id:'e2', day:'Пт', date:'30 мая', title:'Открытая игра', time:'19:30 — 22:00', venue:'СК «Заслонова»', main:'9/14', meterPct:64, status:'open', joined:false },
  { id:'e3', day:'Вс', date:'1 июня', title:'Микст', time:'10:00 — 13:00', venue:'Школа №24', hall:'большой зал', main:'14/14', meterPct:100, status:'full', wait:3, joined:false, inWaitlist:true, waitPos:3 },
  { id:'e4', day:'Ср', date:'4 июня', title:'Основа', time:'20:00 — 22:00', venue:'Школа №24', hall:'малый зал', main:'3/14', meterPct:21, status:'open', joined:false },
  { id:'e5', day:'Сб', date:'7 июня', title:'Аренда большого зала', time:'12:00 — 15:00', venue:'СК «Заслонова»', main:'8/16', meterPct:50, status:'open', joined:true,
    priceMode:'split', total:240, joinedCount:8, pay:'split', mySeats:1 },
  { id:'e6', day:'Вс', date:'8 июня', title:'Воскресная игра', time:'11:00 — 14:00', venue:'Школа №24', hall:'большой зал', main:'12/16', meterPct:75, status:'closed', joined:true,
    priceMode:'split', total:180, joinedCount:12, mySeats:2, pay:'pending' },
];

// Data state — 'data' | 'empty' | 'offline'. Driven by the Tweaks panel so every
// screen can be reviewed in its empty and offline form without separate mockups.
const DataStateContext = React.createContext('data');
const useDataState = () => React.useContext(DataStateContext);
// Derived rules — every surface reads these, so banner, CTAs and badges agree
const canBook   = (ds) => ds !== 'offline';
const hasUnread = (ds) => ds !== 'empty';
const OFFLINE_REASON = 'Нет сети — запись недоступна';

// Empty state — icon in a toned tile, one line of why, one next action
const EmptyState = ({ icon = 'calendar', title, body, action, onAction, tone = 'cool' }) => (
  <div style={{display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'40px 24px 32px'}}>
    <div className={`vt-card vt-card--${tone}`} style={{width:72, height:72, borderRadius:'var(--r-card)', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <Icon name={icon} size={30} stroke={tone === 'warm' ? 'var(--vt-orange)' : 'var(--vt-blue-ink)'} sw={1.8}/>
    </div>
    <h2 style={{fontSize:'var(--fs-2xl)', lineHeight:1.05, marginTop:18}}>{title}</h2>
    <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', lineHeight:1.5, marginTop:8, maxWidth:280, textWrap:'pretty'}}>{body}</div>
    {action && <button onClick={onAction} className="vt-btn vt-btn--primary" style={{marginTop:20}}>{action}</button>}
  </div>
);

// Offline banner — sits above the screen, content below stays readable (cached)
const OfflineBanner = ({ onRetry }) => (
  <div style={{margin:'0 16px 8px', padding:'10px 12px', borderRadius:'var(--r-btn)', background:'var(--vt-ink)', color:'var(--vt-paper)', display:'flex', alignItems:'center', gap:10}}>
    <span style={{width:8, height:8, borderRadius:'var(--r-pill)', background:'var(--vt-orange)', flexShrink:0}}/>
    <div style={{flex:1, minWidth:0}}>
      <div style={{fontSize:'var(--fs-sm)', fontWeight:700}}>Нет соединения</div>
      <div style={{fontSize:'var(--fs-2xs)', opacity:.72, marginTop:2}}>Показаны данные от 19:02 · запись недоступна</div>
    </div>
    <button onClick={onRetry} className="vt-btn vt-btn--sm" style={{background:'var(--vt-on-hero-fill)', color:'var(--vt-on-hero)'}}>Повторить</button>
  </div>
);

// Logo — resolved once so a bundled/offline build can swap in an inlined blob
const LOGO_URL = (window.__resources && window.__resources.logo) || 'assets/logo/vt-mark-color.svg';

// ============================================================
// Статусная модель — три оси, никогда не смешиваются
//  1. Моё участие   → чип СЛОВОМ, фирменный синий («это про вас»). Только у игрока.
//                     going «Иду» · waitlist «В очереди · N-й» · не записан — чипа нет
//  2. Событие       → нейтральный серый чип СЛОВОМ: «Запись закрыта» · «Прошла» · «Отменена»
//  3. Места         → только ЦИФРА + ШКАЛА. Цвет живёт на шкале (meterTint), текст нейтральный.
//  Оплата (отдельно) → amber «ждёт оплаты» · grass «оплачено» · neutral «абонемент»
//  Правило: цвет чипа = участие/оплата, цвет шкалы = заполненность. Формы разные — смыслы не путаются.
// ============================================================
const participationOf = (e) =>
  e.joined ? { key:'going', label:'Иду', icon:'check' }
  : e.inWaitlist ? { key:'waitlist', label:`В очереди · ${e.waitPos}-й`, icon:'clock' }
  : null;
const eventStateOf = (e) =>
  e.cancelled ? 'Отменена' : e.past ? 'Прошла' : e.status === 'closed' ? 'Запись закрыта' : null;
const isFull = (e) => e.status === 'full' || (e.meterPct || 0) >= 100;
// та же семантика, светлые тона для тёмной/синей поверхности
const meterTintOnDark = (pct) => pct >= 100 ? 'var(--vt-rose-on-hero)' : pct > 70 ? 'var(--vt-amber-on-hero)' : 'var(--vt-meter-ok-on-hero)';

const MyChip = ({ e, onDark }) => {
  const p = participationOf(e); if (!p) return null;
  const going = p.key === 'going';
  const style = onDark
    ? { background:'var(--vt-on-hero)', color:'var(--vt-blue-ink)', borderColor:'transparent' }
    : null;
  return (
    <span className={`vt-chip ${going ? 'vt-chip--mine' : 'vt-chip--queue'}`} style={{...style, gap:4}}>
      <Icon name={p.icon} size={12} sw={2.4}/>{p.label}
    </span>
  );
};
const StateChip = ({ e }) => {
  const s = eventStateOf(e); if (!s) return null;
  return <span className="vt-chip vt-chip--state">{s}</span>;
};
const SeatsMini = ({ e, width = 56 }) => {
  const pct = e.meterPct || 0;
  const dim = !!eventStateOf(e);
  return (
    <span style={{display:'inline-flex', alignItems:'center', gap:8}}>
      <span style={{width, height:5, borderRadius:'var(--r-pill)', background:'var(--vt-bone-2)', overflow:'hidden', display:'inline-block'}}>
        <i style={{display:'block', height:'100%', width:`${Math.min(100,pct)}%`, borderRadius:'var(--r-pill)',
          background: dim ? 'var(--vt-stroke-2)' : meterTint(pct)}}/>
      </span>
      <span className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600, color:'var(--vt-ink-3)', minWidth:34, textAlign:'right'}}>
        {isFull(e) && !dim ? 'мест нет' : e.main}
      </span>
    </span>
  );
};

// Логотип группы. Нет логотипа → монограмма: 2 буквы Oswald на тоновой плитке,
// цвет стабилен для имени (хэш), чтобы группа всегда узнавалась одинаково.
const ORG_TINTS = [
  ['var(--vt-blue-soft-tile)', 'var(--vt-flame-ink)'],
  ['var(--vt-orange-soft)',    'var(--vt-orange-ink)'],
  ['var(--vt-grass-soft)',     'var(--vt-grass-ink)'],
  ['var(--vt-amber-soft)',     'var(--vt-amber-ink)'],
];
const orgInitials = (name) => name.replace(/[«»"']/g, '').split(/[\s.·-]+/).filter(w => /^[A-Za-zА-Яа-яЁё]/.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const OrgLogo = ({ name, logo, size = 40 }) => {
  if (logo) return <span style={{width:size, height:size, borderRadius:size * .3, flexShrink:0, display:'inline-block', background:`#fff url(${logo}) center/72% no-repeat`, boxShadow:'inset 0 0 0 1px var(--vt-bone-2)'}}/>;
  const h = [...name].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
  const [bg, fg] = ORG_TINTS[h % ORG_TINTS.length];
  return (
    <span style={{width:size, height:size, borderRadius:size * .3, flexShrink:0, background:bg, color:fg,
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      fontFamily:'var(--f-display)', fontWeight:700, fontSize:size * .4, letterSpacing:0}}>{orgInitials(name)}</span>
  );
};

// Helper: format BYN
const byn = (n) => `${(Number(n).toFixed(2)).replace('.', ',')} Br`;

// Export to window
Object.assign(window, {
  Ball, Icon, Avi, PEOPLE,
  StatusBar, MiniHeader, TabBar, OrgTabBar, Phone, byn, CAT_LABEL, catLabel, METHOD_LABEL, methodLabel, meterTint, SEATS_BY_NAME, seatsOf, buildRoster, pendingOf, PLAYER_EVENTS, DataStateContext, useDataState, EmptyState, OfflineBanner, canBook, hasUnread, OFFLINE_REASON, LOGO_URL, participationOf, eventStateOf, isFull, meterTintOnDark, MyChip, StateChip, SeatsMini, OrgLogo, orgInitials, VT_EVENTS, evDate, evPrice, PENDING_PAYMENTS,
  VT_SETTINGS, getSetting, setSetting, useGroupSettings, CAMPAIGN_ICONS, CampaignIcon,
});
