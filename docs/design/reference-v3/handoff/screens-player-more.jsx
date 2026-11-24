// Игрок: место из листа ожидания, передача места, напарник, автозапись, отметка по QR, открытые игры, жалоба
const pmNote = (txt, icon = 'clock') => (
  <div style={{padding:'10px 12px', background:'var(--vt-bone)', borderRadius:'var(--r-chip)', fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', display:'flex', gap:8, lineHeight:1.45}}>
    <Icon name={icon} size={13} stroke="var(--vt-icon-idle)"/><span>{txt}</span>
  </div>
);
const PmEventCard = ({ title = 'Основа · Пятница', when = 'Пт, 30 мая · 20:00–22:00', venue = 'СК «Заслонова», зал 2', price = '15,00 BYN' }) => (
  <div className="vt-card" style={{padding:16}}>
    <div style={{fontSize:'var(--fs-md)', fontWeight:700}}>{title}</div>
    <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>{when}</div>
    <div style={{display:'flex', justifyContent:'space-between', marginTop:8, fontSize:'var(--fs-sm)'}}>
      <span style={{color:'var(--vt-mute-2)'}}>{venue}</span><span className="vt-mono" style={{fontWeight:600}}>{price}</span>
    </div>
  </div>
);
const PmFoot = ({ children }) => <div style={{padding:'12px 16px', borderTop:'1px solid var(--vt-stroke)', background:'var(--vt-paper)', display:'flex', flexDirection:'column', gap:8}}>{children}</div>;

const PlayerSeatOffer = () => {
  const nav = useNav();
  const [left, setLeft] = React.useState(27 * 60 + 41);
  React.useEffect(() => { const t = setInterval(() => setLeft(s => Math.max(0, s - 1)), 1000); return () => clearInterval(t); }, []);
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
  const pct = left / (30 * 60) * 100;
  return (
    <>
      <MiniHeader title="Освободилось место" sub="Вы первый в листе ожидания" onBack/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px', display:'flex', flexDirection:'column', gap:12}}>
        <div className="vt-card vt-card--hero" style={{padding:20, color:'var(--vt-on-hero)', textAlign:'center'}}>
          <div className="vt-cap" style={{opacity:.72}}>Место держится за вами</div>
          <div className="vt-mono" style={{fontSize:'var(--fs-5xl)', fontWeight:700, marginTop:8, lineHeight:1}}>{mm}:{ss}</div>
          <div className="vt-meter" style={{marginTop:14}}><i style={{width:`${pct}%`, background:'var(--vt-amber-on-hero)'}}/></div>
        </div>
        <PmEventCard/>
        {pmNote('Если не ответите за 30 минут, место предложим следующему в очереди. Вы останетесь в листе ожидания.')}
      </div>
      <PmFoot>
        <button onClick={() => nav.push('book', { event:{ title:'Основа · Пятница', date:'30 мая', joined:false } })} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full" style={{justifyContent:'space-between'}}><span>Беру место</span><span className="vt-mono" style={{opacity:.85}}>15,00 BYN</span></button>
        <button onClick={() => { nav.back(); setTimeout(() => nav.toast('Место передано следующему · вы в листе ожидания'), 80); }} className="vt-btn vt-btn--ghost vt-btn--full">Не смогу, предложить следующему</button>
      </PmFoot>
    </>
  );
};

const PlayerSeatTransfer = () => {
  const nav = useNav();
  const [to, setTo] = React.useState('');
  const [sent, setSent] = React.useState(false);
  return (
    <>
      <MiniHeader title="Передать место" sub="Основа · Пт, 30 мая" onBack/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px', display:'flex', flexDirection:'column', gap:12}}>
        <PmEventCard/>
        {!sent ? (<>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'6px 4px 0'}}>Кому</div>
          <input className="vt-field" value={to} onChange={(e) => setTo(e.target.value)} placeholder="@username или имя из группы"/>
          <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
            {['@nik_v', '@m_volk', '@son_vt'].map(u => (
              <button key={u} onClick={() => setTo(u)} className="vt-chip" style={{cursor:'pointer', minHeight:36, background: to === u ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: to === u ? 'var(--vt-paper)' : 'var(--vt-ink)', borderColor:'transparent'}}>{u}</button>
            ))}
          </div>
          {pmNote('Место перейдёт, когда человек подтвердит. Вашу оплату вернём или зачтём, когда он оплатит своё место. Лист ожидания не трогаем.', 'wallet')}
        </>) : (
          <div className="vt-card" style={{padding:16, borderColor:'var(--vt-amber)'}}>
            <span className="vt-chip vt-chip--amber vt-chip--dot" style={{fontSize:'var(--fs-2xs)'}}>ждём ответа</span>
            <div style={{fontSize:'var(--fs-sm)', fontWeight:600, marginTop:10}}>{to} получил предложение в бот</div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4, lineHeight:1.45}}>Ссылка действует 2 часа. Если не ответит, место останется за вами.</div>
          </div>
        )}
      </div>
      <PmFoot>
        {!sent
          ? <button disabled={!to} onClick={() => setSent(true)} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full">Отправить предложение</button>
          : <button onClick={() => { setSent(false); nav.toast('Передача отменена · место за вами'); }} className="vt-btn vt-btn--ghost vt-btn--full">Отменить передачу</button>}
        <button onClick={() => nav.toast('Ссылка скопирована · t.me/volleytime_bot?start=seat_8Hk2')} className="vt-btn vt-btn--ghost vt-btn--full"><Icon name="link" size={14}/> Скопировать ссылку</button>
      </PmFoot>
    </>
  );
};

const PlayerPartner = () => {
  const nav = useNav();
  const [who, setWho] = React.useState('@m_volk');
  return (
    <>
      <MiniHeader title="Записаться с напарником" sub="Основа · Пт, 30 мая" onBack/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px', display:'flex', flexDirection:'column', gap:12}}>
        <PmEventCard/>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'6px 4px 0'}}>Напарник</div>
        <div className="vt-card" style={{padding:'4px 14px'}}>
          {[['Маша', '@m_volk', 'МВ', 'grass', 'В2 · связующая'], ['Никита', '@nik_v', 'НВ', 'amber', 'В3 · доигровщик']].map(([n, u, init, tag, lv], i) => (
            <button key={u} onClick={() => setWho(u)} style={{display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 0', cursor:'pointer', textAlign:'left', boxShadow: i ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none'}}>
              <Avi size="sm" name={n} init={init} tag={tag}/>
              <div style={{flex:1}}><div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{n}</div><div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{lv}</div></div>
              <span style={{width:20, height:20, borderRadius:'50%', border: who === u ? '6px solid var(--vt-ink)' : '1.5px solid var(--vt-stroke-2)'}}/>
            </button>
          ))}
        </div>
        {pmNote('Запись подтвердится только для двоих сразу. Если напарник не ответит за 2 часа или мест останется одно, запись не создастся и деньги не спишутся.', 'users')}
      </div>
      <PmFoot>
        <button onClick={() => { nav.back(); setTimeout(() => nav.toast(`Приглашение отправлено ${who} · ждём подтверждения`), 80); }} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full" style={{justifyContent:'space-between'}}><span>Записаться вдвоём</span><span className="vt-mono" style={{opacity:.85}}>15,00 BYN</span></button>
      </PmFoot>
    </>
  );
};

const PlayerAutoSeries = () => {
  const nav = useNav();
  const [on, setOn] = React.useState(true);
  const [skip, setSkip] = React.useState(['6 июня']);
  const dates = ['30 мая', '6 июня', '13 июня', '20 июня'];
  return (
    <>
      <MiniHeader title="Автозапись" sub="Серия «Основа · Пятница»" onBack/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px', display:'flex', flexDirection:'column', gap:12}}>
        <div className="vt-card" style={{padding:16, display:'flex', alignItems:'center', gap:12}}>
          <div style={{flex:1}}>
            <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>Записывать меня каждую пятницу</div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:3, lineHeight:1.45}}>Запись создаётся в момент открытия, до общей очереди. Оплата — как обычно.</div>
          </div>
          <button role="switch" aria-checked={on} onClick={() => { setOn(!on); nav.toast(on ? 'Автозапись выключена' : 'Автозапись включена'); }} style={{width:44, height:26, borderRadius:'var(--r-pill)', padding:2, cursor:'pointer', flexShrink:0, background: on ? 'var(--vt-grass)' : 'var(--vt-stroke-2)', display:'flex', justifyContent: on ? 'flex-end' : 'flex-start'}}>
            <span style={{width:22, height:22, borderRadius:'var(--r-pill)', background:'var(--vt-paper)'}}/>
          </button>
        </div>
        {on && (<>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'6px 4px 0'}}>Ближайшие</div>
          <div className="vt-card" style={{padding:'4px 14px'}}>
            {dates.map((d, i) => {
              const off = skip.includes(d);
              return (
                <div key={d} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 0', boxShadow: i ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none'}}>
                  <div style={{flex:1, fontSize:'var(--fs-sm)', fontWeight:600, color: off ? 'var(--vt-mute-2)' : 'var(--vt-ink)'}}>Пт, {d}</div>
                  <span className={`vt-chip ${off ? 'vt-chip--state' : i === 0 ? 'vt-chip--grass vt-chip--dot' : ''}`} style={{fontSize:'var(--fs-2xs)'}}>{off ? 'пропускаю' : i === 0 ? 'записаны' : 'запишем'}</span>
                  <button onClick={() => setSkip(s => off ? s.filter(x => x !== d) : [...s, d])} className="vt-btn vt-btn--ghost vt-btn--sm">{off ? 'Вернуть' : 'Пропустить'}</button>
                </div>
              );
            })}
          </div>
          {pmNote('Отменить автозапись на конкретную дату можно до закрытия записи без штрафа. Организатор ограничивает число автозаписей в серии.', 'calendar')}
        </>)}
      </div>
    </>
  );
};

const PlayerCheckin = () => {
  const nav = useNav();
  const [done, setDone] = React.useState(false);
  return (
    <>
      <MiniHeader title="Отметка на входе" sub="Основа · сегодня 20:00" onBack/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px', display:'flex', flexDirection:'column', gap:12}}>
        {!done ? (
          <button onClick={() => setDone(true)} aria-label="Сканировать QR" style={{aspectRatio:'1', borderRadius:'var(--r-card)', background:'var(--vt-ink)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, cursor:'pointer', color:'var(--vt-paper)'}}>
            <span style={{width:'58%', aspectRatio:'1', border:'2px dashed var(--vt-on-hero-fill)', borderRadius:'var(--r-chip)', display:'flex', alignItems:'center', justifyContent:'center'}}><Icon name="qr" size={44} stroke="var(--vt-paper)"/></span>
            <span style={{fontSize:'var(--fs-sm)', opacity:.8}}>Наведите камеру на QR у организатора</span>
          </button>
        ) : (
          <div className="vt-card" style={{padding:20, borderColor:'var(--vt-grass)', textAlign:'center'}}>
            <span style={{width:52, height:52, borderRadius:'50%', background:'var(--vt-grass-soft)', display:'inline-flex', alignItems:'center', justifyContent:'center'}}><Icon name="check" size={24} stroke="var(--vt-grass-ink)" sw={2.4}/></span>
            <div style={{fontSize:'var(--fs-lg)', fontWeight:700, marginTop:12}}>Вы на месте</div>
            <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>Отмечено в 19:52 · Школа №24</div>
          </div>
        )}
        {done ? <PlayerPayCard amount={15}/> : pmNote('Одно сканирование отмечает приход и открывает оплату, если она ещё не закрыта. QR меняется каждую минуту.', 'qr')}
      </div>
    </>
  );
};

const NEARBY = [
  { g:'СпайкКлуб', t:'Открытая игра', when:'Сб, 31 мая · 11:00', place:'Фрунзенский · СК «Олимп»', lvl:'В2–В3', free:4, price:'12,00 BYN' },
  { g:'Пляж Минск', t:'Пляж 2×2', when:'Вс, 1 июня · 10:00', place:'Дрозды · песок', lvl:'В1–В2', free:2, price:'10,00 BYN' },
  { g:'VolleyTime Минск', t:'Микст', when:'Вс, 1 июня · 18:00', place:'Центральный · Школа №24', lvl:'В3–В4+', free:6, price:'15,00 BYN' },
];
const PlayerNearby = () => {
  const nav = useNav();
  const [lvl, setLvl] = React.useState('В2');
  return (
    <>
      <MiniHeader title="Открытые игры рядом" sub="Минск · публичные события других групп" onBack/>
      <div className="vt-phone__body" style={{padding:'4px 16px 16px'}}>
        <div style={{display:'flex', gap:6, overflowX:'auto', paddingBottom:4}}>
          {['В1','В2','В3','В4+'].map(l => <button key={l} onClick={() => setLvl(l)} className="vt-chip" style={{cursor:'pointer', minHeight:36, background: lvl === l ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: lvl === l ? 'var(--vt-paper)' : 'var(--vt-ink)', borderColor:'transparent'}}>мой уровень {l}</button>)}
        </div>
        {NEARBY.map((e, i) => (
          <button key={i} onClick={() => nav.toast(`${e.g} · откроется страница группы`)} style={{display:'block', width:'100%', textAlign:'left', cursor:'pointer', padding:'14px 0', boxShadow: i ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none'}}>
            <div style={{display:'flex', justifyContent:'space-between', gap:8}}>
              <div style={{fontSize:'var(--fs-md)', fontWeight:700}}>{e.t}</div>
              <span className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{e.price}</span>
            </div>
            <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:3}}>{e.when} · {e.place}</div>
            <div style={{display:'flex', gap:6, marginTop:8, flexWrap:'wrap'}}>
              <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>{e.g}</span>
              <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>{e.lvl}</span>
              <span className="vt-chip vt-chip--grass" style={{fontSize:'var(--fs-2xs)'}}>{e.free} мест</span>
            </div>
          </button>
        ))}
        <div style={{marginTop:8}}>{pmNote('Здесь только события, которые группы сами сделали публичными. Запись идёт по правилам группы.', 'globe')}</div>
      </div>
    </>
  );
};

const reportSheet = (nav, target) => nav.sheet({
  title:`Пожаловаться · ${target}`, sub:'Жалоба уйдёт в поддержку VolleyTime, не организатору',
  items:[
    { icon:'wallet', label:'Деньги не вернули после отмены', onClick: () => nav.toast('Жалоба отправлена · ответим в бот за 24 ч') },
    { icon:'calendar', label:'Игру отменили без предупреждения', onClick: () => nav.toast('Жалоба отправлена · ответим в бот за 24 ч') },
    { icon:'chat', label:'Грубость или неуважение', onClick: () => nav.toast('Жалоба отправлена · ответим в бот за 24 ч') },
    { icon:'more', label:'Другое', onClick: () => nav.toast('Опишите ситуацию в чате поддержки') },
  ]
});

Object.assign(window, { PlayerSeatOffer, PlayerSeatTransfer, PlayerPartner, PlayerAutoSeries, PlayerCheckin, PlayerNearby, reportSheet });
