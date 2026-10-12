// brand.jsx — Brand identity cards (logo, type, components)

const BrandIdentity = () => (
  <div style={{display:'grid', gridTemplateRows:'auto 1fr', gap:22, height:'100%'}}>
    {/* Logo lockup */}
    <div style={{display:'flex', alignItems:'center', gap:24}}>
      <div style={{
        width:104, height:104, borderRadius:'var(--r-tile)', background:'var(--vt-on-hero)',
        border:'1px solid var(--vt-stroke)',
        display:'flex', alignItems:'center', justifyContent:'center',
        flexShrink:0,
      }}>
        <img src={(window.__resources && window.__resources.logo) || 'assets/logo/vt-mark-color.svg'} alt="VolleyTime" style={{width:'78%', height:'78%', objectFit:'contain'}}/>
      </div>
      <div style={{flex:1}}>
        <h1 style={{fontSize:'var(--fs-5xl)', letterSpacing:0, lineHeight:1}}>
          Volley<span style={{color:'var(--vt-flame-ink)'}}>Time</span>
        </h1>
        <div style={{marginTop:8, fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', fontFamily:'var(--f-mono)'}}>
          volleytime.by  ·  Telegram-first sport platform
        </div>
        <div style={{marginTop:10, display:'flex', gap:6}}>
          <span className="vt-chip vt-chip--flame">бренд · синий</span>
          <span className="vt-chip vt-chip--orange">энергия · оранжевый</span>
          <span className="vt-chip vt-chip--solid">ink</span>
        </div>
      </div>
      <div style={{textAlign:'right', alignSelf:'flex-start'}}>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Tagline</div>
        <div style={{fontFamily:'var(--f-display)', fontWeight:600, fontSize:'var(--fs-md)', maxWidth:240, textAlign:'right', marginTop:4, lineHeight:1.25}}>
          Тренировки, записи и&nbsp;касса — в&nbsp;одном Telegram.
        </div>
      </div>
    </div>

    {/* Color blocks */}
    <div style={{display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:10, alignSelf:'stretch'}}>
      {[
        ['Brand Blue', 'var(--vt-flame)',   '#2437C9', 'primary'],
        ['Deep Blue',  'var(--vt-blue-ink)','var(--vt-blue-ink)', 'logo'],
        ['Orange',     'var(--vt-orange)',  'var(--vt-orange)', 'accent'],
        ['Ink',        'var(--vt-ink)',     '#0E0E10', 'text / dark'],
        ['Tile',       'var(--vt-bone)',    '#F4F4F6', 'surfaces'],
        ['Grass',      'var(--vt-grass)',   '#4E7F3B', 'success'],
      ].map(([name, v, hex, role]) => (
        <div key={name} className="vt-card" style={{padding:0, overflow:'hidden'}}>
          <div style={{height:84, background:v, borderBottom:'1px solid var(--vt-stroke)'}}/>
          <div style={{padding:'10px 12px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:4}}>
              <div style={{fontFamily:'var(--f-display)', fontWeight:600, fontSize:'var(--fs-sm)'}}>{name}</div>
              <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{role}</div>
            </div>
            <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2}}>{hex}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const BrandType = () => (
  <div style={{display:'flex', flexDirection:'column', gap:18, height:'100%'}}>
    <div>
      <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Display · Oswald</div>
      <div style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-7xl)', lineHeight:1, letterSpacing:0, textTransform:'uppercase', marginTop:6}}>
        Запись<br/>за два тапа.
      </div>
    </div>

    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24}}>
      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Body · Golos Text</div>
        <div style={{marginTop:10, fontSize:'var(--fs-md)', lineHeight:1.5, maxWidth:320}}>
          Платформа помогает организаторам тренировок, открытых игр, клубов и соревнований управлять записями, абонементами и кассой — всё в одном месте.
        </div>
        <div style={{marginTop:14, display:'flex', flexDirection:'column', gap:6, fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>
          <div><span style={{color:'var(--vt-ink)'}}>14 Regular</span> — описания, мета</div>
          <div><span style={{color:'var(--vt-ink)', fontWeight:500}}>14 Medium</span> — лейблы</div>
          <div><span style={{color:'var(--vt-ink)', fontWeight:600}}>14 Semibold</span> — кнопки</div>
        </div>
      </div>

      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Numbers · Oswald</div>
        <div style={{display:'flex', alignItems:'baseline', gap:14, marginTop:10}}>
          <div className="vt-mono" style={{fontSize:'var(--fs-6xl)', fontWeight:700, letterSpacing:0, lineHeight:1}}>12/14</div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>мест занято</div>
        </div>
        <div style={{display:'flex', gap:24, marginTop:18}}>
          <div>
            <div className="vt-mono" style={{fontSize:'var(--fs-2xl)', fontWeight:600}}>15,00 Br</div>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:4}}>Цена сессии</div>
          </div>
          <div>
            <div className="vt-mono" style={{fontSize:'var(--fs-2xl)', fontWeight:600, color:'var(--vt-grass)'}}>+82 Br</div>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:4}}>Касса +</div>
          </div>
          <div>
            <div className="vt-mono" style={{fontSize:'var(--fs-2xl)', fontWeight:600, color:'var(--vt-rose)'}}>−42 Br</div>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:4}}>Касса −</div>
          </div>
        </div>
      </div>
    </div>

    {/* Scale */}
    <div style={{marginTop:'auto', display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8, padding:'14px 0', borderTop:'1px solid var(--vt-stroke)'}}>
      {[
        ['H1', 44, 'display'], ['H2', 28, 'display'], ['H3', 20, 'body'], ['H4', 16, 'body'],
      ].map(([k, sz, fam]) => (
        <div key={k}>
          <div style={{
            fontFamily: fam === 'display' ? 'var(--f-display)' : 'var(--f-body)',
            textTransform: fam === 'display' ? 'uppercase' : 'none',
            fontWeight:700, fontSize:sz, lineHeight:1
          }}>Аа</div>
          <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:8}}>{k} · {sz}px · {fam === 'display' ? 'Oswald' : 'Golos Text'}</div>
        </div>
      ))}
    </div>
  </div>
);

const BrandComponents = () => (
  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, height:'100%'}}>
    <div style={{display:'flex', flexDirection:'column', gap:18}}>
      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Buttons</div>
        <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
          <button className="vt-btn vt-btn--primary">Записаться</button>
          <button className="vt-btn vt-btn--ink">Подтвердить</button>
          <button className="vt-btn vt-btn--ghost">Отмена</button>
          <button className="vt-btn vt-btn--primary vt-btn--lg">Записаться · 15 Br</button>
        </div>
      </div>

      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Chips · статусы</div>
        <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
          <span className="vt-chip vt-chip--mine" style={{gap:4}}><Icon name="check" size={12} sw={2.4}/>Иду</span>
          <span className="vt-chip vt-chip--queue" style={{gap:4}}><Icon name="clock" size={12} sw={2.4}/>В очереди · 2-й</span>
          <span className="vt-chip vt-chip--state">Запись закрыта</span>
          <span className="vt-chip vt-chip--amber">Ждёт оплаты</span>
          <span className="vt-chip vt-chip--grass">Оплачено</span>
          <span className="vt-chip vt-chip--solid">Владелец</span>
        </div>
      </div>

      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Avatars · аватары</div>
        <div className="vt-stack">
          {[0,1,2,3,4].map(i => <Avi key={i} idx={i} size="md"/>)}
          <span className="vt-avi" style={{background:'var(--vt-bone-2)', color:'var(--vt-mute-2)'}}>+8</span>
        </div>
        <div style={{display:'flex', gap:8, marginTop:10}}>
          <Avi size="sm" idx={0}/><Avi size="md" idx={1}/><Avi size="lg" idx={2}/>
        </div>
      </div>

      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Meter · заполненность</div>
        <div style={{display:'flex', flexDirection:'column', gap:8, maxWidth:260}}>
          <div>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:'var(--fs-xs)', marginBottom:4}}>
              <span>Основной состав</span><span className="vt-mono">12/14</span>
            </div>
            <div className="vt-meter"><i style={{width:'86%'}}/></div>
          </div>
          <div>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:'var(--fs-xs)', marginBottom:4}}>
              <span>Кампания «Новый мяч»</span><span className="vt-mono">175 / 250 Br</span>
            </div>
            <div className="vt-meter vt-meter--grass"><i style={{width:'70%'}}/></div>
          </div>
        </div>
      </div>
    </div>

    <div style={{display:'flex', flexDirection:'column', gap:18}}>
      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Event card · превью</div>
        <div className="vt-card" style={{padding:14, maxWidth:320}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
            <div>
              <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Ср · 28 мая</div>
              <div style={{fontFamily:'var(--f-display)', fontWeight:600, fontSize:'var(--fs-md)', marginTop:2}}>Основа · 20:00</div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>Школа №24 · малый зал</div>
            </div>
            <span className="vt-chip vt-chip--flame">Основной 12/14</span>
          </div>
          <div className="vt-meter" style={{marginTop:12}}><i style={{width:'86%'}}/></div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12}}>
            <div className="vt-stack">
              {[0,1,2,3].map(i => <Avi key={i} idx={i} size="sm"/>)}
              <span className="vt-avi vt-avi--sm" style={{background:'var(--vt-bone-2)', color:'var(--vt-mute-2)'}}>+8</span>
            </div>
            <button className="vt-btn vt-btn--primary vt-btn--sm">Записаться</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Reusable inline dropdown (desktop pattern): click opens an anchored option list.
const VtSelect = ({ value, options, onChange, icon, width }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef();
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const current = options.find(o => (o.value ?? o) === value);
  const label = current ? (current.label ?? current) : value;
  return (
    <div ref={ref} style={{position:'relative', width: width || '100%'}}>
      <button onClick={() => setOpen(o => !o)} className="vt-field" style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', width:'100%', textAlign:'left',
        borderColor: open ? 'var(--vt-ink)' : 'var(--vt-stroke)', boxShadow: open ? '0 0 0 3px rgba(14,14,16,0.08)' : 'none'}}>
        {icon && <Icon name={icon} size={14}/>}
        <span style={{flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{label}</span>
        <Icon name="chevron-d" size={14} stroke="var(--vt-mute)" style={{transition:'transform .15s', transform: open?'rotate(180deg)':'none'}}/>
      </button>
      {open && (
        <div style={{position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:20,
          background:'var(--vt-paper)', border:'1px solid var(--vt-stroke)', borderRadius:'var(--r-chip)',
          boxShadow:'0 12px 32px rgba(0,0,0,0.15), 0 0 0 0.5px rgba(0,0,0,0.04)', padding:6,
          maxHeight:240, overflow:'auto'}}>
          {options.map((o,i) => {
            const v = o.value ?? o; const l = o.label ?? o; const sel = v === value;
            return (
              <button key={i} onClick={() => { onChange(v); setOpen(false); }} style={{display:'flex', alignItems:'center', gap:10, width:'100%', padding:'8px 10px', borderRadius:'var(--r-sm)', textAlign:'left', cursor:'pointer',
                background: sel ? 'var(--vt-ctl-track)' : 'transparent', fontSize:'var(--fs-sm)', fontWeight: sel?600:500}}
                onMouseEnter={e => { if(!sel) e.currentTarget.style.background='var(--vt-bone)'; }}
                onMouseLeave={e => { if(!sel) e.currentTarget.style.background='transparent'; }}>
                {o.sub != null
                  ? <span style={{flex:1}}><span>{l}</span><span style={{display:'block', fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', fontWeight:400, marginTop:2}}>{o.sub}</span></span>
                  : <span style={{flex:1}}>{l}</span>}
                {sel && <Icon name="check" size={15} stroke="var(--vt-flame)" sw={2.4}/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Forms & controls reference — toggles, segments, fields, stepper
const BrandControls = () => {
  const [tog, setTog] = React.useState({ a: true, b: false });
  const [seg, setSeg] = React.useState('list');
  const [pay, setPay] = React.useState('cash');
  const [qty, setQty] = React.useState(8);
  const [venue, setVenue] = React.useState('v1');
  const [level, setLevel] = React.useState('ba');
  return (
  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, height:'100%'}}>
    {/* Left column */}
    <div style={{display:'flex', flexDirection:'column', gap:18}}>
      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Toggle · переключатели</div>
        <div style={{display:'flex', flexDirection:'column', gap:8, maxWidth:300}}>
          {[['a','Разрешить отмену записи'],['b','Еженедельный отчёт']].map(([k,l]) => (
            <button key={k} onClick={() => setTog(s => ({...s, [k]: !s[k]}))} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:'var(--r-chip)', background:'var(--vt-ctl)', border:'1px solid var(--vt-stroke)', cursor:'pointer', textAlign:'left'}}>
              <span style={{flex:1, fontSize:'var(--fs-sm)', fontWeight:500}}>{l}</span>
              <span style={{width:36, height:20, borderRadius:'var(--r-pill)', background:tog[k]?'var(--vt-ink)':'var(--vt-stroke-2)', position:'relative', flexShrink:0}}>
                <span style={{position:'absolute', top:2, left: tog[k]?18:2, width:16, height:16, borderRadius:'var(--r-pill)', background:'var(--vt-paper)', transition:'left .15s'}}/>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Segmented · сегменты</div>
        <div style={{display:'inline-flex', padding:4, gap:2, background:'var(--vt-bone-2)', borderRadius:'var(--r-chip)'}}>
          {[['list','Список'],['cal','Календарь']].map(([v,l]) => (
            <button key={v} onClick={() => setSeg(v)} className="vt-btn vt-btn--sm" style={{
              background: seg===v?'var(--vt-paper)':'transparent', boxShadow: seg===v?'0 1px 2px rgba(0,0,0,0.06)':'none', fontWeight:600
            }}>{l}</button>
          ))}
        </div>
        <div style={{marginTop:10, display:'flex', gap:6, flexWrap:'wrap'}}>
          {['за 1 ч','за 2 ч','за 6 ч','за 24 ч'].map((t,i) => (
            <button key={t} onClick={() => setPay(t)} className="vt-btn vt-btn--sm" style={{
              background: pay===t?'var(--vt-ink)':'transparent', color: pay===t?'var(--vt-paper)':'var(--vt-ink)',
              border:'1px solid var(--vt-stroke)', fontWeight:600
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Radio · выбор оплаты</div>
        <div style={{display:'flex', flexDirection:'column', gap:8, maxWidth:300}}>
          {[['cash','Наличными организатору'],['transfer','Переводом на карту']].map(([v,l]) => {
            const sel = pay === v;
            return (
              <button key={v} onClick={() => setPay(v)} style={{display:'flex', alignItems:'center', gap:12, padding:'12px', borderRadius:'var(--r-chip)', cursor:'pointer', textAlign:'left',
                border:`1px solid ${sel?'var(--vt-flame)':'var(--vt-stroke)'}`, background: sel?'var(--vt-accent-soft)':'var(--vt-ctl)'}}>
                <span style={{width:18, height:18, borderRadius:'var(--r-pill)', border:`${sel?5:2}px solid ${sel?'var(--vt-flame)':'var(--vt-stroke)'}`, flexShrink:0}}/>
                <span style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{l}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>

    {/* Right column */}
    <div style={{display:'flex', flexDirection:'column', gap:18}}>
      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Fields · поля</div>
        <div style={{display:'flex', flexDirection:'column', gap:12, maxWidth:320}}>
          <div>
            <label className="vt-label">Название</label>
            <input className="vt-field" defaultValue="Среда — основа" />
          </div>
          <div style={{display:'flex', gap:8}}>
            <div style={{flex:1}}>
              <label className="vt-label">Цена</label>
              <input className="vt-field" defaultValue="15" />
            </div>
            <div style={{width:90}}>
              <label className="vt-label">Валюта</label>
              <div className="vt-field" style={{display:'flex', alignItems:'center', justifyContent:'center'}}>BYN</div>
            </div>
          </div>
          <div>
            <label className="vt-label">Зал</label>
            <VtSelect value={venue} icon="pin" onChange={setVenue} options={[
              { value:'v1', label:'Школа №24, малый зал', sub:'15 Br/ч' },
              { value:'v2', label:'СК «Заслонова»', sub:'20 Br/ч' },
              { value:'v3', label:'Школа №3, большой зал', sub:'25 Br/ч' },
            ]}/>
          </div>
          <div>
            <label className="vt-label">Уровень</label>
            <VtSelect value={level} onChange={setLevel} options={[
              { value:'all', label:'Любой' },
              { value:'ba', label:'B / A' },
              { value:'a', label:'A · продвинутый' },
              { value:'c', label:'C · новички' },
            ]}/>
          </div>
        </div>
      </div>

      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Stepper · счётчик</div>
        <div className="vt-card" style={{padding:'12px 14px', maxWidth:320, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <span style={{fontSize:'var(--fs-sm)'}}>Сессий в абонементе</span>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <button onClick={() => setQty(q => Math.max(1, q-1))} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'4px 10px'}}>−</button>
            <span className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-md)', width:28, textAlign:'center'}}>{qty}</span>
            <button onClick={() => setQty(q => q+1)} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'4px 10px'}}>+</button>
          </div>
        </div>
      </div>

      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Chip-buttons · чипы-кнопки</div>
        <div style={{display:'flex', gap:6, flexWrap:'wrap', maxWidth:320}}>
          {['Аренда зала','Мячи','Судья','Прочее'].map((c,i) => (
            <button key={c} onClick={() => setSeg(c)} className="vt-chip" style={{cursor:'pointer',
              background: seg===c?'var(--vt-ink)':'var(--vt-ctl-track)', color: seg===c?'var(--vt-paper)':'var(--vt-ink)', borderColor:'transparent'}}>{c}</button>
          ))}
        </div>
      </div>
    </div>
  </div>
  );
};

// Domain patterns — paid-model, seats and statuses introduced across app screens
const BrandPatterns = () => {
  const money = (n) => `${n.toFixed(2).replace('.', ',')} Br`;
  return (
  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, height:'100%'}}>
    <div style={{display:'flex', flexDirection:'column', gap:18}}>
      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Модель оплаты · два режима</div>
        <div style={{display:'flex', flexDirection:'column', gap:8, maxWidth:340}}>
          <div className="vt-card" style={{padding:'12px 14px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
              <span style={{fontSize:'var(--fs-sm)', fontWeight:600}}>Фиксированная цена</span>
              <span className="vt-mono" style={{fontWeight:700}}>{money(15)}</span>
            </div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4}}>Сумма известна сразу · абонемент применим</div>
          </div>
          <div className="vt-card" style={{padding:'12px 14px', borderColor:'var(--vt-flame)'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
              <span style={{fontSize:'var(--fs-sm)', fontWeight:600}}>Делим общую сумму</span>
              <span className="vt-mono" style={{fontWeight:700}}>≈ {money(30)}</span>
            </div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4}}>240,00 Br ÷ 8 мест · точная сумма после закрытия записи</div>
            <div style={{display:'flex', gap:6, marginTop:8}}>
              <span className="vt-chip vt-chip--flame" style={{fontSize:'var(--fs-2xs)'}}>делёж суммы</span>
              <span className="vt-chip vt-chip--amber" style={{fontSize:'var(--fs-2xs)'}}>уточнится</span>
            </div>
          </div>
        </div>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:10, lineHeight:1.45, maxWidth:340}}>
          Знак <b style={{color:'var(--vt-ink)'}}>≈</b> стоит, пока запись открыта. После закрытия исчезает — сумма зафиксирована. Абонементы в режиме делёжа недоступны.
        </div>
      </div>

      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Несколько мест одной записью</div>
        <div className="vt-card" style={{padding:0, overflow:'hidden', maxWidth:340}}>
          {[
            { n:'Артём', init:'АР', tag:'flame', seats:1, lvl:'A' },
            { n:'Маша', init:'МА', tag:'amber', seats:2 },
            { n:'Игорь', init:'ИГ', tag:'ink', seats:3 },
          ].map((p, i, arr) => (
            <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderBottom: i<arr.length-1?'1px solid var(--vt-stroke)':'none'}}>
              <Avi name={p.n} init={p.init} tag={p.tag} size="sm"/>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:'var(--fs-sm)', fontWeight:500, display:'flex', alignItems:'center', gap:6}}>
                  {p.n}
                  {p.seats > 1 && <span className="vt-chip vt-chip--flame" style={{fontSize:'var(--fs-2xs)', padding:'2px 6px'}}>+{p.seats-1}</span>}
                </div>
                <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2}}>
                  {p.seats > 1 ? `${p.seats} места · ${money(30*p.seats)}` : `уровень ${p.lvl}`}
                </div>
              </div>
              <Icon name="check" size={14} stroke="var(--vt-grass)" sw={2.2}/>
            </div>
          ))}
        </div>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:8, lineHeight:1.45, maxWidth:340}}>
          Строка одна, мест несколько. Чип <b style={{color:'var(--vt-ink)'}}>+N</b> — сколько гостей приводит игрок. Счётчики «мест занято» и «игроков» расходятся — это нормально.
        </div>
      </div>
    </div>

    <div style={{display:'flex', flexDirection:'column', gap:18}}>
      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Статусная модель · три оси</div>
        <div style={{display:'flex', flexDirection:'column', gap:12, maxWidth:360}}>
          {[
            ['Моё участие', 'словом · фирменный синий · только у игрока', <>
              <span className="vt-chip vt-chip--mine" style={{gap:4}}><Icon name="check" size={12} sw={2.4}/>Иду</span>
              <span className="vt-chip vt-chip--queue" style={{gap:4}}><Icon name="clock" size={12} sw={2.4}/>В очереди · 2-й</span>
            </>],
            ['Событие', 'словом · нейтральный серый', <>
              <span className="vt-chip vt-chip--state">Запись закрыта</span>
              <span className="vt-chip vt-chip--state">Прошла</span>
            </>],
            ['Места', 'цифрой и шкалой · цвет только на шкале', <>
              <SeatsMini e={{main:'9/14', meterPct:64}}/>
              <SeatsMini e={{main:'12/14', meterPct:86}}/>
              <SeatsMini e={{main:'14/14', meterPct:100, status:'full'}}/>
            </>],
            ['Оплата', 'amber — нужно действие · grass — в порядке', <>
              <span className="vt-chip vt-chip--amber">ждёт оплаты</span>
              <span className="vt-chip vt-chip--grass">оплачено</span>
              <span className="vt-chip vt-chip--state">абонемент</span>
            </>],
          ].map(([k, sub, chips]) => (
            <div key={k}>
              <div style={{display:'flex', alignItems:'baseline', gap:8}}>
                <span style={{fontSize:'var(--fs-sm)', fontWeight:700}}>{k}</span>
                <span style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{sub}</span>
              </div>
              <div style={{display:'flex', flexWrap:'wrap', alignItems:'center', gap:6, marginTop:6}}>{chips}</div>
            </div>
          ))}
        </div>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:12, lineHeight:1.45, maxWidth:360}}>
          Оси не смешиваются в одном чипе. «Иду» остаётся синим и после закрытия записи: закрытие — отдельный серый чип рядом. Подписи человеческие, в коде <span className="vt-mono" style={{fontSize:'var(--fs-2xs)'}}>pending / paid / subs</span>.
        </div>
      </div>

      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Шкала заполненности · один цвет-код</div>
        <div style={{display:'flex', flexDirection:'column', gap:10, maxWidth:340}}>
          {[['Свободно', 50, 'grass'], ['Почти полно', 86, 'amber'], ['Мест нет', 100, 'rose']].map(([l, pct, c]) => (
            <div key={l}>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'var(--fs-xs)', marginBottom:6}}>
                <span>{l}</span>
                <span className="vt-mono" style={{fontWeight:600}}>{pct}%</span>
              </div>
              <div className="vt-meter"><i style={{width:`${pct}%`, background:`var(--vt-${c})`}}/></div>
            </div>
          ))}
        </div>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:8, lineHeight:1.45, maxWidth:340}}>
          Правило одно на всё приложение: <span className="vt-mono" style={{fontSize:'var(--fs-2xs)'}}>≥100 rose · &gt;70 amber · иначе grass</span>. Список и карточка не могут разойтись.
        </div>
      </div>

      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Опциональные модули</div>
        <div className="vt-card" style={{padding:'12px 14px', maxWidth:340, display:'flex', alignItems:'center', gap:12}}>
          <Icon name="ticket" size={17}/>
          <div style={{flex:1}}>
            <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>Абонементы</div>
            <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2}}>Выключение убирает раздел из навигации, KPI и состава</div>
          </div>
          <span style={{width:36, height:20, borderRadius:'var(--r-pill)', background:'var(--vt-ink)', position:'relative', flexShrink:0}}>
            <span style={{position:'absolute', top:2, left:18, width:16, height:16, borderRadius:'var(--r-pill)', background:'var(--vt-paper)'}}/>
          </span>
        </div>
      </div>
    </div>
  </div>
  );
};

// Bento Bold foundations — spacing, radii, elevation, composition
const BrandBento = () => (
  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:32}}>
    <div style={{display:'flex', flexDirection:'column', gap:28}}>
      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:12}}>Отступы · шкала 4</div>
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {[[4,'иконка ↔ подпись'],[8,'внутри чипа, строки'],[12,'между карточками'],[16,'поля экрана, padding плитки'],[24,'между секциями'],[32,'крупные блоки на десктопе']].map(([n,l]) => (
            <div key={n} style={{display:'flex', alignItems:'center', gap:12}}>
              <span className="vt-mono" style={{width:28, fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>{n}</span>
              <span style={{width:n*3, height:12, borderRadius:'var(--r-xs)', background:'var(--vt-flame)'}}/>
              <span style={{fontSize:'var(--fs-sm)', color:'var(--vt-ink-3)'}}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:12}}>Скругления</div>
        <div style={{display:'flex', gap:12, alignItems:'flex-end'}}>
          {[['Карточка',20,72],['Плитка',18,60],['Кнопка',14,44],['Поле',12,44],['Чип',10,28]].map(([l,r,h]) => (
            <div key={l} style={{textAlign:'center'}}>
              <div style={{width:64, height:h, borderRadius:r, background:'var(--vt-bone)'}}/>
              <div style={{fontSize:'var(--fs-xs)', marginTop:6, color:'var(--vt-ink-3)'}}>{l}</div>
              <div className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{r}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:12}}>Поверхности · без обводок</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12}}>
          {[['Тон','vt-card',''],['Приподнятая','vt-card vt-card--raised',''],['Акцент','vt-card vt-card--hero','']].map(([l,c]) => (
            <div key={l} className={c} style={{height:84, padding:14, display:'flex', alignItems:'flex-end', fontSize:'var(--fs-sm)', fontWeight:600}}>{l}</div>
          ))}
        </div>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:10, lineHeight:1.5}}>
          Тон — по умолчанию. Тень — только для того, что парит над контентом: карточка события в ленте, таб-бар, sheet. Акцент — один на экран.
        </div>
      </div>
    </div>

    <div>
      <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:12}}>Бенто · композиция экрана</div>
      <div style={{display:'grid', gridTemplateColumns:'1.25fr 1fr', gridTemplateRows:'auto auto', gap:12}}>
        <div className="vt-card vt-card--hero" style={{gridRow:'span 2', padding:18, display:'flex', flexDirection:'column'}}>
          <div className="vt-cap" style={{opacity:.7}}>Среда</div>
          <div className="vt-mono" style={{fontSize:'var(--fs-6xl)', fontWeight:700, lineHeight:.9, marginTop:12}}>20:00</div>
          <div style={{fontSize:'var(--fs-sm)', opacity:.8, marginTop:6}}>28 мая · основа</div>
          <div style={{fontSize:'var(--fs-sm)', filter:'grayscale(1)', marginTop:'auto', paddingTop:16}}>Школа №24 · 12 из 14</div>
          <div className="vt-btn" style={{marginTop:12, background:'var(--vt-orange)', color:'#1A0C04'}}>Открыть</div>
        </div>
        <div className="vt-card vt-card--warm" style={{padding:16}}>
          <div className="vt-mono" style={{fontSize:'var(--fs-4xl)', fontWeight:700, lineHeight:1}}>5/8</div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:6}}>абонемент</div>
        </div>
        <div className="vt-card" style={{padding:16}}>
          <div className="vt-mono" style={{fontSize:'var(--fs-4xl)', fontWeight:700, lineHeight:1}}>96%</div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:6}}>посещаемость</div>
        </div>
      </div>
      <h2 style={{fontSize:'var(--fs-xl)', margin:'24px 0 8px'}}>Расписание</h2>
      {[['30','пт','Открытая игра','19:30 · СК «Заслонова»','9/14','grass'],['1','вс','Микст','10:00 · Школа №24','14/14','rose']].map(([n,w,t,s,c,tone], i) => (
        <div key={n} style={{display:'flex', alignItems:'center', gap:16, padding:'12px 0', boxShadow: i ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none'}}>
          <div style={{width:48, textAlign:'center'}}>
            <div className="vt-mono" style={{fontSize:'var(--fs-3xl)', fontWeight:700, lineHeight:1}}>{n}</div>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:2}}>{w}</div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:'var(--fs-md)', fontWeight:700}}>{t}</div>
            <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:2}}>{s}</div>
          </div>
          <span className={`vt-chip vt-chip--${tone}`}>{c}</span>
        </div>
      ))}
      <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:12, lineHeight:1.5}}>
        Один герой на экран, рядом — 2 плитки-метрики. Списки — без подложек: ритм даёт отступ 12 и тонкий разделитель.
      </div>
    </div>
  </div>
);

// Surfaces × controls — тест «серое на сером» и правило инверсии тона
const BrandSurfaces = () => {
  const [mode, setMode] = React.useState('after');
  const [stats, setStats] = React.useState({});
  const rootRef = React.useRef();

  const SURF = [
    { id:'paper', name:'Холст',        sub:'фон экрана',            cls:'vt-on-paper', style:{background:'var(--vt-paper)', boxShadow:'inset 0 0 0 1px var(--vt-bone-2)'} },
    { id:'bone',  name:'Плитка',       sub:'.vt-card',              cls:'vt-card' },
    { id:'warm',  name:'Тёплая',       sub:'.vt-card--warm',        cls:'vt-card vt-card--warm' },
    { id:'cool',  name:'Холодная',     sub:'.vt-card--cool',        cls:'vt-card vt-card--cool' },
    { id:'raised',name:'Белая в сером',sub:'.vt-card--raised',      cls:'vt-card vt-card--raised', nested:true },
    { id:'hero',  name:'Герой',        sub:'.vt-card--hero',        cls:'vt-card vt-card--hero' },
  ];

  // contrast between a control and the surface it sits on (alpha composited)
  React.useEffect(() => {
    const parse = (s) => { const n = (s.match(/[\d.]+/g) || []).map(Number); return { rgb:n.slice(0,3), a: n.length > 3 ? n[3] : 1 }; };
    const solid = (el) => {
      const chain = []; let p = el;
      while (p) { const b = getComputedStyle(p).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)/.test(b) && b !== 'transparent') chain.push(parse(b)); p = p.parentElement; }
      let out = [255,255,255];
      for (let i = chain.length - 1; i >= 0; i--) { const s = chain[i]; out = out.map((v, j) => s.rgb[j] * s.a + v * (1 - s.a)); }
      return out;
    };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126*f(c[0]) + .7152*f(c[1]) + .0722*f(c[2]); };
    const ratio = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + .05) / (Math.min(A, B) + .05); };
    const t = setTimeout(() => {
      const out = {};
      rootRef.current.querySelectorAll('[data-surf]').forEach(s => {
        const ctl = s.querySelector('[data-probe]');
        if (!ctl) return;
        out[s.dataset.surf] = ratio(solid(ctl), solid(s)).toFixed(2);
      });
      setStats(out);
    }, 60);
    return () => clearTimeout(t);
  }, [mode]);

  const Controls = ({ hero }) => (
    <div style={{display:'flex', flexDirection:'column', gap:10}}>
      <div style={{display:'flex', gap:8}}>
        <button data-probe className="vt-btn vt-btn--ghost vt-btn--sm" style={{flex:1}}>Отмена</button>
        <button className="vt-btn vt-btn--sm" style={{flex:1, background: hero ? 'var(--vt-orange)' : 'var(--vt-ink)', color:'#fff'}}>Сохранить</button>
      </div>
      <input className="vt-field" defaultValue="Основа · среда" aria-label="Название"/>
      <div className="vt-field" style={{display:'flex', alignItems:'center', gap:8}}>
        <Icon name="pin" size={14}/> <span style={{flex:1}}>Школа №24</span><Icon name="chevron-d" size={14}/>
      </div>
      <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
        <span className="vt-chip">за 2 ч</span><span className="vt-chip">до 3 мест</span>
      </div>
      <div style={{display:'flex', padding:3, gap:2, borderRadius:'var(--r-btn)', background:'var(--vt-ctl-track)'}}>
        <span style={{flex:1, textAlign:'center', padding:'7px 0', borderRadius:'var(--r-field)', background: hero ? 'var(--vt-on-hero)' : 'var(--vt-ink)', color: hero ? 'var(--vt-blue-ink)' : '#fff', fontSize:'var(--fs-xs)', fontWeight:700}}>Список</span>
        <span style={{flex:1, textAlign:'center', padding:'7px 0', fontSize:'var(--fs-xs)', fontWeight:600, color:'var(--vt-ctl-ink)'}}>Календарь</span>
      </div>
    </div>
  );

  const Surface = ({ s }) => {
    const box = (
      <div data-surf={s.id} className={s.cls} style={{padding:16, borderRadius:'var(--r-card)', ...(s.style || {})}}>
        <Controls hero={s.id === 'hero'}/>
      </div>
    );
    return (
      <div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8}}>
          <div>
            <div style={{fontSize:'var(--fs-sm)', fontWeight:700}}>{s.name}</div>
            <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{s.sub}</div>
          </div>
          <span className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:700,
            color: !stats[s.id] ? 'var(--vt-mute-2)' : +stats[s.id] < 1.05 ? 'var(--vt-rose-ink)' : 'var(--vt-grass-ink)'}}>
            {stats[s.id] ? `${stats[s.id]}:1` : '—'}
          </span>
        </div>
        {s.nested
          ? <div className="vt-card" style={{padding:10, borderRadius:'var(--r-card)'}}>{box}</div>
          : box}
      </div>
    );
  };

  return (
    <div ref={rootRef}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, marginBottom:18, flexWrap:'wrap'}}>
        <div style={{display:'inline-flex', padding:3, gap:2, background:'var(--vt-bone-2)', borderRadius:'var(--r-btn)'}}>
          {[['before','До · общий серый'],['after','После · инверсия тона']].map(([v, l]) => (
            <button key={v} onClick={() => setMode(v)} className="vt-btn vt-btn--sm" style={{
              background: mode === v ? 'var(--vt-paper)' : 'transparent', color:'var(--vt-ink)',
              boxShadow: mode === v ? 'var(--vt-seg-shadow)' : 'none'}}>{l}</button>
          ))}
        </div>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', maxWidth:420, lineHeight:1.45}}>
          Справа у каждой поверхности — замер контраста «кнопка ↔ фон». 1,00 означает, что контрол сливается с блоком.
        </div>
      </div>

      <div className={mode === 'before' ? 'vt-legacy-ctl' : ''} style={{display:'grid', gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:16}}>
        {SURF.map(s => <Surface key={s.id} s={s}/>)}
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:12, marginTop:22}}>
        {[
          ['1', 'Инверсия тона', 'На сером и тонированном блоке контролы становятся белыми. Разница та же, что у плитки на холсте, поэтому система читается одинаково на любой глубине.'],
          ['2', 'Белое внутри серого', 'Внутри приподнятой белой карточки контролы снова серые. Правило зеркальное: контрол всегда на шаг отличается от своего родителя.'],
          ['3', 'Синий герой', 'На синем — полупрозрачный белый 14% и белый текст. Активный сегмент — белый с синим текстом.'],
          ['4', 'Hover — подъём, не затемнение', 'Белый контрол на сером при наведении получает мягкую тень. Затемнять белое до серого нельзя: он снова сольётся с блоком.'],
          ['5', 'Не глубже двух уровней', 'Холст → плитка → контрол. Если нужен третий уровень, внутреннюю группу делаем белой приподнятой карточкой, а не ещё одним серым.'],
          ['6', 'Подпись обязательна', 'Заливка отличает контрол от фона всего на ~1,1:1. Поэтому у кнопки всегда есть текст, у поля — подпись над ним, а фокус показывается синим кольцом.'],
        ].map(([n, h, p]) => (
          <div key={n} className="vt-card" style={{padding:16}}>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <span className="vt-mono" style={{width:26, height:26, borderRadius:'var(--r-sm)', background:'var(--vt-paper)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'var(--fs-sm)', fontWeight:700}}>{n}</span>
              <span style={{fontSize:'var(--fs-sm)', fontWeight:700}}>{h}</span>
            </div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:8, lineHeight:1.5}}>{p}</div>
          </div>
        ))}
      </div>

      <div className="vt-card vt-card--cool" style={{padding:16, marginTop:12, display:'flex', gap:14, alignItems:'flex-start'}}>
        <Icon name="settings" size={18}/>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', lineHeight:1.55}}>
          <b style={{color:'var(--vt-ink)'}}>Как это устроено в коде.</b> Контролы берут заливку не из <span className="vt-code">--vt-bone</span>, а из <span className="vt-code">--vt-ctl</span>, <span className="vt-code">--vt-ctl-chip</span> и <span className="vt-code">--vt-ctl-track</span>. Каждая поверхность переопределяет эти токены у себя, поэтому вложенность работает без классов-модификаторов. Для блоков без <span className="vt-code">.vt-card</span> есть утилиты <span className="vt-code">.vt-on-tone</span>, <span className="vt-code">.vt-on-paper</span>, <span className="vt-code">.vt-on-hero</span>. В тёмной теме «белый» означает «светлее поверхности».
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { BrandIdentity, BrandType, BrandComponents, BrandControls, BrandPatterns, BrandBento, BrandSurfaces, VtSelect });
