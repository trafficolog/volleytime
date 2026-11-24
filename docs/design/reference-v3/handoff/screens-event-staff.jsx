// Общий блок формы события (Mini App и кабинет): тренер и разминка в составе события
const EVENT_COACHES = [['none', 'Без тренера', ''], ['olga', 'Ольга Романова', 'ведёт серию «Основа»'], ['dima', 'Дмитрий Ковалёв', 'ведёт «Микст · Вс»'], ['me', 'Я сам', 'организатор']];
const WARMUP_PROGS = [['base', 'Базовая · 8 мин', 'суставы, плечи, прыжки'], ['shoulder', 'Плечи и подача · 10 мин', 'резинка, вращения, пасы в стену'], ['legs', 'Ноги и блок · 12 мин', 'голеностоп, выпады, прыжки']];

const EvSeg = ({ value, onChange, opts }) => (
  <div style={{display:'flex', gap:6}}>
    {opts.map(([v, l]) => (
      <button key={v} onClick={() => onChange(v)} className="vt-btn vt-btn--sm" style={{flex:1, background: value === v ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: value === v ? 'var(--vt-paper)' : 'var(--vt-ink)', fontWeight:600}}>{l}</button>
    ))}
  </div>
);

const EventStaffBlock = ({ wide = false, durationMin = 120 }) => {
  const nav = useNav();
  const [coach, setCoach] = React.useState('olga');
  const [wu, setWu] = React.useState('event');
  const [prog, setProg] = React.useState('base');
  const c = EVENT_COACHES.find(x => x[0] === coach);
  const p = WARMUP_PROGS.find(x => x[0] === prog);
  const wuMin = parseInt(p[1].match(/\d+/)[0], 10);
  const pickCoach = () => nav.sheet({ title:'Тренер события', sub:'По умолчанию — тренер серии', items: EVENT_COACHES.map(([v, l, s]) => ({ radio: v === coach, label:l, sub:s || undefined, onClick: () => setCoach(v) })) });
  const pickProg = () => nav.sheet({ title:'Программа разминки', items: WARMUP_PROGS.map(([v, l, s]) => ({ radio: v === prog, label:l, sub:s, onClick: () => setProg(v) })) });
  const field = (icon, text, onClick) => (
    <button onClick={onClick} className="vt-field" style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', width:'100%', textAlign:'left'}}>
      <Icon name={icon} size={14}/> <span style={{flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{text}</span> <Icon name="chevron-d" size={14}/>
    </button>
  );
  return (
    <div style={{display:'grid', gridTemplateColumns: wide ? 'minmax(0,1fr) minmax(0,1fr)' : 'minmax(0,1fr)', gap:14}}>
      <div>
        <label className="vt-label">Тренер</label>
        {field('user', c[1], pickCoach)}
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:6}}>{coach === 'none' ? 'Отмечать пришедших будет организатор' : coach === 'me' ? 'Вы ведёте и отмечаете сами' : 'Видит состав и отмечает пришедших. Оплату — если разрешено в «Команде»'}</div>
      </div>
      <div>
        <label className="vt-label">Разминка</label>
        <EvSeg value={wu} onChange={setWu} opts={[['off', 'Нет'], ['self', 'Сами'], ['event', 'В событии']]}/>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:6}}>
          {wu === 'off' ? 'Игроки увидят только свою разминку, если включили её в профиле'
            : wu === 'self' ? 'Игрокам придёт напоминание размяться за 15 минут до начала'
            : `Тренер запускает таймер у всех. Займёт ${wuMin} из ${durationMin} мин аренды`}
        </div>
      </div>
      {wu === 'event' && (
        <div style={{gridColumn:'1/-1'}}>
          <label className="vt-label">Программа</label>
          {field('ball', `${p[1]} · ${p[2]}`, pickProg)}
          <label style={{display:'flex', alignItems:'center', gap:8, marginTop:8, fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', cursor:'pointer'}}>
            <input type="checkbox" defaultChecked style={{accentColor:'var(--vt-ink)'}}/> Игрок может пропустить и прийти к началу игры
          </label>
        </div>
      )}
    </div>
  );
};

Object.assign(window, { EventStaffBlock });
