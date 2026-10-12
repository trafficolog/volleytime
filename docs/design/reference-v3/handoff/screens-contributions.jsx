// screens-contributions.jsx — Сборы (Contributions, Phase 11)
// Player: see campaigns, pledge a contribution.
// Organizer: manage campaigns, confirm pledges.

// Shared mock data
const CAMPAIGNS = [
  {
    id:'c1', icon:'ball', title:'Новый комплект мячей',
    desc:'3× Mikasa V200W на замену убитым. Хватит на сезон.',
    target:250, collected:175, deadline:'до 5 июня', daysLeft:8,
    contributors:12, status:'active', mine:'pledged', myAmount:15,
  },
  {
    id:'c2', icon:'trophy', title:'Аренда зала на турнир',
    desc:'Большой зал на воскресный внутренний турнир, 6 часов.',
    target:400, collected:120, deadline:'до 15 июня', daysLeft:18,
    contributors:8, status:'active', mine:null,
  },
  {
    id:'c3', icon:'shirt', title:'Форма команды',
    desc:'Единые майки с номерами для сыгранного состава.',
    target:600, collected:600, deadline:'завершён 2 мая', daysLeft:0,
    contributors:18, status:'done', mine:'paid', myAmount:35,
  },
];

const pct = (c) => Math.min(100, Math.round((c.collected / c.target) * 100));

// ============================================================
// PLAYER · ContribHub
// ============================================================
const ContribHub = () => {
  const nav = useNav();
  const ds = useDataState();
  if (ds === 'empty') return (
    <>
      <MiniHeader title="Сборы" sub="VolleyTime Минск"/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px'}}>
        <EmptyState icon="gift" tone="warm" title="Сборов нет"
          body="Когда организатор запустит сбор на мячи, форму или аренду зала, он появится здесь — можно будет скинуться или обещать взнос."/>
      </div>
      <TabBar active="contrib"/>
    </>
  );
  const active = CAMPAIGNS.filter(c => c.status === 'active');
  const done = CAMPAIGNS.filter(c => c.status === 'done');

  const Card = (c) => (
    <button key={c.id} onClick={() => nav.push('contrib-detail', { campaign: c })} className="vt-card vt-card--raised" style={{padding:16, textAlign:'left', cursor:'pointer', width:'100%', filter: c.status==='done' ? 'grayscale(1)' : 'none'}}>
      <div style={{display:'flex', gap:12, alignItems:'flex-start'}}>
        <CampaignIcon name={c.icon} size={44}/>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:'flex', justifyContent:'space-between', gap:8, alignItems:'flex-start'}}>
            <div style={{fontFamily:'var(--f-display)', fontWeight:600, fontSize:'var(--fs-md)', lineHeight:1.25}}>{c.title}</div>
            {c.mine === 'pledged' && <span className="vt-chip vt-chip--amber" style={{fontSize:'var(--fs-2xs)', flexShrink:0}}>обещано {c.myAmount}</span>}
            {c.mine === 'paid' && <span className="vt-chip vt-chip--grass vt-chip--dot" style={{fontSize:'var(--fs-2xs)', flexShrink:0}}>внесли {c.myAmount}</span>}
          </div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:6, lineHeight:1.4}}>{c.desc}</div>

          <div style={{display:'flex', alignItems:'center', gap:8, marginTop:12}}>
            <div className="vt-meter vt-meter--grass" style={{flex:1, height:6}}><i style={{width:`${pct(c)}%`, background: c.status==='done' ? 'var(--vt-grass)' : 'var(--vt-flame)'}}/></div>
            <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', fontWeight:600}}>{pct(c)}%</span>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8}}>
            <span className="vt-mono" style={{fontSize:'var(--fs-xs)', fontWeight:600}}>{byn(c.collected)} <span style={{color:'var(--vt-mute-2)', fontWeight:400}}>/ {byn(c.target)}</span></span>
            <span style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{c.deadline}</span>
          </div>
        </div>
      </div>
    </button>
  );

  return (
    <>
      <MiniHeader title="Сборы" sub="VolleyTime Минск"/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px'}}>
        <div style={{padding:'2px 4px 10px', fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', lineHeight:1.45}}>
          Скидываемся на инвентарь, залы и турниры. Можно обещать взнос — организатор подтвердит, когда получит деньги.
        </div>

        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'8px 4px 10px'}}>Активные · {active.length}</div>
        <div style={{display:'flex', flexDirection:'column', gap:10}}>
          {active.map(Card)}
        </div>

        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'22px 4px 10px'}}>Завершённые</div>
        <div style={{display:'flex', flexDirection:'column', gap:10}}>
          {done.map(Card)}
        </div>
      </div>
      <TabBar active="contrib"/>
    </>
  );
};

// ============================================================
// PLAYER · ContribDetail
// ============================================================
const ContribDetail = () => {
  const nav = useNav();
  const c = nav.data.campaign || CAMPAIGNS[0];
  const contribList = PEOPLE.slice(0, 8).map((p, i) => ({
    ...p,
    amount: [15, 20, 15, 10, 25, 15, 20, 30][i],
    status: i < 6 ? 'paid' : 'pledged',
  }));

  const moreItems = [
    { icon:'send', label:'Поделиться сбором', onClick: () => nav.toast('Ссылка на сбор скопирована') },
    { icon:'bell', label:'Уведомлять о прогрессе', onClick: () => nav.toast('Уведомления включены') },
  ];

  return (
    <>
      <MiniHeader title={c.title} sub={c.deadline} onBack right={<ActionMore items={moreItems} title={c.title}/>}/>
      <div className="vt-phone__body">
        {/* Hero progress */}
        <div style={{padding:'4px 16px 0'}}>
          <div className="vt-card vt-card--hero" style={{padding:18, position:'relative', overflow:'hidden'}}>
            <div style={{position:'absolute', right:-24, top:-24, width:120, height:120, borderRadius:'50%', background:'var(--vt-orange)', opacity:0.9, display:'flex', alignItems:'center', justifyContent:'center'}}>
              <span style={{marginLeft:-22, marginTop:22}}><CampaignIcon name={c.icon} size={48} onDark/></span>
            </div>
            <div style={{position:'relative'}}>
              <div className="vt-cap" style={{opacity:0.6}}>{c.status === 'done' ? 'сбор завершён' : 'собрано'}</div>
              <div style={{marginTop:8, display:'flex', alignItems:'baseline', gap:8}}>
                <div className="vt-mono" style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-4xl)', lineHeight:1}}>{byn(c.collected)}</div>
                <div style={{opacity:0.7, fontSize:'var(--fs-sm)'}}>из {byn(c.target)}</div>
              </div>
              <div style={{marginTop:14, height:8, borderRadius:'var(--r-pill)', background:'var(--vt-on-hero-line)', overflow:'hidden'}}>
                <div style={{width:`${pct(c)}%`, height:'100%', background: c.status==='done' ? 'var(--vt-grass)' : 'var(--vt-amber)', borderRadius:'var(--r-pill)'}}/>
              </div>
              <div style={{marginTop:12, display:'flex', justifyContent:'space-between', fontSize:'var(--fs-xs)'}}>
                <span style={{opacity:0.7}}>{c.contributors} участников</span>
                <span style={{opacity:0.7}}>{c.status === 'done' ? c.deadline : `осталось ${c.daysLeft} дн.`}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div style={{padding:'14px 16px 0'}}>
          <div style={{fontSize:'var(--fs-base)', color:'var(--vt-ink-3)', lineHeight:1.5}}>{c.desc}</div>
          <div style={{display:'flex', alignItems:'center', gap:8, marginTop:12, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>
            <Avi size="sm" name="Иван П." init="ИП" tag="ink"/>
            <span>Сбор организует Иван Петренко</span>
          </div>
        </div>

        {/* My contribution */}
        {c.mine && (
          <div style={{padding:'16px 16px 0'}}>
            <div className="vt-card" style={{padding:'12px 14px', display:'flex', alignItems:'center', gap:10, borderColor: c.mine==='paid'?'var(--vt-grass)':'var(--vt-amber)'}}>
              <Icon name={c.mine==='paid'?'check':'clock'} size={18} stroke={c.mine==='paid'?'var(--vt-grass)':'var(--vt-amber)'}/>
              <div style={{flex:1}}>
                <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{c.mine === 'paid' ? 'Вы внесли' : 'Вы обещали'} {byn(c.myAmount)}</div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{c.mine === 'paid' ? 'спасибо за вклад!' : 'ждём подтверждения от организатора'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Contributors */}
        <div style={{padding:'18px 16px 0'}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Уже скинулись</div>
          <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
            {contribList.map((p, i) => (
              <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom: i<contribList.length-1?'1px solid var(--vt-stroke)':'none'}}>
                <Avi name={p.name} init={p.init} tag={p.tag} size="sm"/>
                <div style={{flex:1, fontSize:'var(--fs-sm)', fontWeight:500}}>{p.name}</div>
                {p.status === 'pledged' && <span className="vt-chip vt-chip--amber" style={{fontSize:'var(--fs-2xs)'}}>обещал</span>}
                <span className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600, color: p.status==='paid'?'var(--vt-grass)':'var(--vt-mute-2)'}}>{byn(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      {c.status !== 'done' && (
        <div style={{padding:'12px 16px', borderTop:'1px solid var(--vt-stroke)', background:'var(--vt-paper)'}}>
          <button onClick={() => nav.push('contrib-pledge', { campaign: c })} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full">
            {c.mine ? 'Изменить мой взнос' : 'Внести / обещать взнос'}
          </button>
        </div>
      )}
    </>
  );
};

// ============================================================
// PLAYER · ContribPledge
// ============================================================
const ContribPledge = () => {
  const nav = useNav();
  const c = nav.data.campaign || CAMPAIGNS[0];
  const [amount, setAmount] = React.useState(c.myAmount || 15);
  const [method, setMethod] = React.useState('cash');

  const presets = [10, 15, 20, 25, 30, 50];

  const submit = () => {
    nav.back();
    setTimeout(() => nav.back(), 30);
    setTimeout(() => nav.toast(method === 'now' ? `Спасибо! Внесли ${byn(amount)}` : `Обещано ${byn(amount)} · ждём оплаты`), 100);
  };

  return (
    <>
      <MiniHeader title="Мой взнос" sub={c.title} onBack/>
      <div className="vt-phone__body" style={{padding:'12px 16px 16px'}}>
        {/* Amount picker */}
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'4px 4px 12px'}}>Сумма взноса</div>
        <div style={{textAlign:'center', padding:'8px 0 18px'}}>
          <div style={{display:'inline-flex', alignItems:'baseline', gap:6}}>
            <span className="vt-mono" style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-6xl)', lineHeight:1}}>{amount}</span>
            <span style={{fontSize:'var(--fs-lg)', color:'var(--vt-mute-2)', fontWeight:600}}>Br</span>
          </div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8}}>
          {presets.map(v => (
            <button key={v} onClick={() => setAmount(v)} className="vt-btn vt-btn--sm" style={{
              padding:'12px 0', borderRadius:'var(--r-chip)',
              background: amount===v ? 'var(--vt-ink)' : 'var(--vt-ctl)',
              color: amount===v ? 'var(--vt-paper)' : 'var(--vt-ink)',
              border: '1px solid var(--vt-stroke)',
              fontFamily:'var(--f-mono)', fontWeight:700, fontSize:'var(--fs-md)',
              transition:'all .12s'
            }}>{v} Br</button>
          ))}
        </div>

        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'22px 4px 10px'}}>Как внесёте</div>
        {[
          { id:'now', t:'Внести сейчас', s:'Наличными организатору на тренировке', tag:'отметим сразу' },
          { id:'cash', t:'Обещать · наличными', s:'Подтвердят, когда передадите деньги', tag:'обещание' },
          { id:'transfer', t:'Переводом на карту', s:'Belarusbank · *3214', tag:'обещание' },
        ].map((o, i, a) => {
          const sel = method === o.id;
          return (
            <button key={o.id} onClick={() => setMethod(o.id)} className="vt-card" style={{
              display:'flex', alignItems:'center', gap:12, padding:14, marginBottom:10, width:'100%', textAlign:'left', cursor:'pointer',
              borderColor: sel ? 'var(--vt-flame)' : 'var(--vt-stroke)',
              boxShadow: sel ? '0 0 0 2px var(--vt-ring)' : 'none', transition:'all .12s'
            }}>
              <span style={{width:18, height:18, borderRadius:'var(--r-pill)', border:`${sel?5:2}px solid ${sel?'var(--vt-flame)':'var(--vt-stroke)'}`, flexShrink:0, transition:'border .12s'}}/>
              <div style={{flex:1}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                  <div style={{fontWeight:600, fontSize:'var(--fs-base)'}}>{o.t}</div>
                  <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>{o.tag}</span>
                </div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4}}>{o.s}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{padding:'12px 16px', borderTop:'1px solid var(--vt-stroke)', background:'var(--vt-paper)'}}>
        <button onClick={submit} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full" style={{justifyContent:'space-between'}}>
          <span>{method === 'now' ? 'Внести' : 'Обещать взнос'}</span>
          <span className="vt-mono" style={{opacity:.85}}>{byn(amount)}</span>
        </button>
      </div>
    </>
  );
};

// ============================================================
// ORGANIZER · OrgContribs (Mini App)
// ============================================================
const OrgContribs = () => {
  const nav = useNav();
  const ds = useDataState();
  if (ds === 'empty') return (
    <>
      <MiniHeader title="Сборы" sub="управление кампаниями"/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px'}}>
        <EmptyState icon="gift" tone="warm" title="Запустите первый сбор"
          body="Мячи, форма, аренда зала на турнир — укажите цель и дедлайн, игроки увидят сбор в приложении."
          action="Новый сбор" onAction={() => nav.push('contrib-create')}/>
      </div>
      <OrgTabBar active="contrib"/>
    </>
  );
  const active = CAMPAIGNS.filter(c => c.status === 'active');
  const done = CAMPAIGNS.filter(c => c.status === 'done');

  const Card = (c) => (
    <button key={c.id} onClick={() => nav.push('contrib-manage', { campaign: c })} className="vt-card vt-card--raised" style={{padding:14, textAlign:'left', cursor:'pointer', width:'100%', filter: c.status==='done' ? 'grayscale(1)' : 'none'}}>
      <div style={{display:'flex', gap:10, alignItems:'center'}}>
        <CampaignIcon name={c.icon} size={40}/>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontFamily:'var(--f-display)', fontWeight:600, fontSize:'var(--fs-base)'}}>{c.title}</div>
          <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2}}>{c.contributors} участников · {c.deadline}</div>
        </div>
        {c.status === 'active'
          ? <span className="vt-chip vt-chip--flame" style={{fontSize:'var(--fs-2xs)'}}>{pct(c)}%</span>
          : <span className="vt-chip vt-chip--grass vt-chip--dot" style={{fontSize:'var(--fs-2xs)'}}>готово</span>}
      </div>
      <div style={{display:'flex', alignItems:'center', gap:8, marginTop:10}}>
        <div className="vt-meter vt-meter--grass" style={{flex:1, height:6}}><i style={{width:`${pct(c)}%`, background: c.status==='done'?'var(--vt-grass)':'var(--vt-flame)'}}/></div>
        <span className="vt-mono" style={{fontSize:'var(--fs-xs)', fontWeight:600}}>{byn(c.collected)} <span style={{color:'var(--vt-mute-2)', fontWeight:400}}>/ {c.target}</span></span>
      </div>
    </button>
  );

  return (
    <>
      <MiniHeader title="Сборы" sub="управление кампаниями" right={
        <button onClick={() => nav.push('contrib-create')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{gap:6, padding:'6px 8px'}}><Icon name="plus" size={14}/></button>
      }/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px'}}>
        {/* Summary */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14}}>
          <div className="vt-card" style={{padding:'12px 14px'}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Активных</div>
            <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-xl)', marginTop:4}}>{active.length}</div>
          </div>
          <div className="vt-card" style={{padding:'12px 14px'}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Собрано всего</div>
            <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-xl)', marginTop:4, color:'var(--vt-grass)'}}>295 Br</div>
          </div>
        </div>

        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'4px 4px 10px'}}>Активные</div>
        <div style={{display:'flex', flexDirection:'column', gap:10}}>{active.map(Card)}</div>

        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'22px 4px 10px'}}>Завершённые</div>
        <div style={{display:'flex', flexDirection:'column', gap:10}}>{done.map(Card)}</div>

        <button onClick={() => nav.push('contrib-create')} className="vt-btn vt-btn--ink vt-btn--full vt-btn--lg" style={{marginTop:16, gap:8}}>
          <Icon name="plus" size={16}/> Новый сбор
        </button>
      </div>
      <OrgTabBar active="contrib"/>
    </>
  );
};

// ============================================================
// ORGANIZER · OrgContribManage (Mini App)
// ============================================================
const OrgContribManage = () => {
  const nav = useNav();
  const c = nav.data.campaign || CAMPAIGNS[0];
  const [pledges, setPledges] = React.useState(
    PEOPLE.slice(0, 4).map((p, i) => ({ ...p, amount: [15, 20, 10, 25][i] }))
  );
  const paid = PEOPLE.slice(4, 10).map((p, i) => ({ ...p, amount: [15, 20, 15, 10, 25, 15][i] }));

  const confirm = (p) => {
    setPledges(s => s.filter(x => x.name !== p.name));
    nav.toast(`Подтверждено · ${p.name} · +${byn(p.amount)}`);
  };

  const moreItems = [
    { icon:'edit', label:'Редактировать сбор', onClick: () => nav.toast('Редактирование сбора') },
    { icon:'send', label:'Напомнить участникам', onClick: () => nav.toast('Напоминание отправлено 4 участникам') },
    { icon:'send', label:'Опубликовать в чате', onClick: () => nav.toast('Опубликовано в чате группы') },
    '---',
    { icon:'check', label:'Завершить сбор', onClick: () => nav.alert({
      title:'Завершить сбор?', body:'Новые взносы будут закрыты. Собранное останется в кассе.',
      confirm:'Завершить', onConfirm: () => { nav.back(); setTimeout(() => nav.toast('Сбор завершён'), 80); }
    })},
    { icon:'trash', tone:'danger', label:'Удалить сбор', onClick: () => nav.alert({
      title:'Удалить сбор?', body:'Все взносы и обещания будут удалены без возврата в кассу.',
      confirm:'Удалить', danger:true, onConfirm: () => { nav.back(); setTimeout(() => nav.toast('Сбор удалён'), 80); }
    })},
  ];

  return (
    <>
      <MiniHeader title={c.title} sub={`${c.deadline} · ${pct(c)}%`} onBack right={<ActionMore items={moreItems} title={c.title}/>}/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px'}}>
        {/* Progress card */}
        <div className="vt-card" style={{padding:16}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
            <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-2xl)'}}>{byn(c.collected)}</div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>цель {byn(c.target)}</div>
          </div>
          <div className="vt-meter vt-meter--grass" style={{marginTop:10, height:8}}><i style={{width:`${pct(c)}%`}}/></div>
          <div style={{display:'flex', gap:16, marginTop:14}}>
            <div>
              <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>внесли</div>
              <div className="vt-mono" style={{fontWeight:600, fontSize:'var(--fs-base)', marginTop:4, color:'var(--vt-grass)'}}>{byn(c.collected)}</div>
            </div>
            <div>
              <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>обещано</div>
              <div className="vt-mono" style={{fontWeight:600, fontSize:'var(--fs-base)', marginTop:4, color:'var(--vt-amber)'}}>+70,00 Br</div>
            </div>
            <div>
              <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>осталось</div>
              <div className="vt-mono" style={{fontWeight:600, fontSize:'var(--fs-base)', marginTop:4}}>{byn(c.target - c.collected)}</div>
            </div>
          </div>
        </div>

        {/* Pending pledges */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', margin:'20px 4px 10px'}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Обещали · ждут подтверждения</div>
          <span className="vt-chip vt-chip--amber" style={{fontSize:'var(--fs-2xs)'}}>{pledges.length}</span>
        </div>
        <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
          {pledges.length === 0 && (
            <div style={{padding:'24px', textAlign:'center', color:'var(--vt-mute-2)', fontSize:'var(--fs-sm)'}}>Все обещания подтверждены</div>
          )}
          {pledges.map((p, i, arr) => (
            <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderBottom: i<arr.length-1?'1px solid var(--vt-stroke)':'none'}}>
              <Avi name={p.name} init={p.init} tag={p.tag} size="sm"/>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:'var(--fs-sm)', fontWeight:500}}>{p.name}</div>
                <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>обещал наличными</div>
              </div>
              <span className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{byn(p.amount)}</span>
              <button onClick={() => confirm(p)} className="vt-btn vt-btn--primary vt-btn--sm" style={{padding:'6px 10px'}}>✓</button>
            </div>
          ))}
        </div>

        {/* Paid */}
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'20px 4px 10px'}}>Внесли · {paid.length}</div>
        <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
          {paid.map((p, i, arr) => (
            <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderBottom: i<arr.length-1?'1px solid var(--vt-stroke)':'none', filter:'grayscale(1)'}}>
              <Icon name="check" size={14} stroke="var(--vt-grass)" sw={2.4}/>
              <div style={{flex:1, fontSize:'var(--fs-sm)', fontWeight:500}}>{p.name}</div>
              <span className="vt-mono" style={{fontSize:'var(--fs-xs)', fontWeight:600, color:'var(--vt-grass)'}}>+{byn(p.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// ============================================================
// ORGANIZER · OrgContribCreate (Mini App)
// ============================================================
const OrgContribCreate = () => {
  const nav = useNav();
  const DEADLINE_OPTS = ['5 июня', '15 июня', '30 июня', '15 июля', '31 июля'];
  const [deadline, setDeadline] = React.useState('5 июня');
  const [icon, setIcon] = React.useState('ball');
  const [name, setName] = React.useState('Новый комплект мячей');

  const create = () => {
    nav.back();
    setTimeout(() => nav.toast(`Создан сбор «${name}»`), 80);
  };

  return (
    <>
      <MiniHeader title="Новый сбор" onBack right={
        <button onClick={create} style={{fontSize:'var(--fs-base)', fontWeight:600, color:'var(--vt-flame-ink)'}}>Создать</button>
      }/>
      <div className="vt-phone__body" style={{padding:'12px 16px 20px'}}>
        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          <div>
            <label className="vt-label">Иконка и название</label>
            <div style={{display:'flex', gap:8}}>
              <button onClick={() => nav.sheet({
                title:'Иконка сбора',
                items:[
                  ...Object.entries(CAMPAIGN_ICONS).map(([k, m]) => ({ icon:k, label:m.label, check: icon===k, onClick: () => setIcon(k) })),
                ]
              })} style={{cursor:'pointer', padding:0, flexShrink:0}}><CampaignIcon name={icon} size={46}/></button>
              <input className="vt-field" value={name} onChange={(e) => setName(e.target.value)} style={{flex:1}}/>
            </div>
          </div>

          <div>
            <label className="vt-label">Описание</label>
            <textarea className="vt-field" rows={3} defaultValue="Зачем собираем и на что пойдут деньги."/>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
            <div>
              <label className="vt-label">Цель сбора</label>
              <div style={{display:'flex', gap:6}}>
                <input className="vt-field" defaultValue="250"/>
                <div className="vt-field" style={{width:64, display:'flex', alignItems:'center', justifyContent:'center'}}>BYN</div>
              </div>
            </div>
            <button onClick={() => nav.sheet({ title:'Дедлайн сбора', items: DEADLINE_OPTS.map(d => ({ radio: d === deadline, label: `до ${d}`, onClick: () => setDeadline(d) })) })} style={{textAlign:'left', cursor:'pointer'}}>
              <label className="vt-label">Дедлайн</label>
              <div className="vt-field" style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
                <Icon name="calendar" size={14}/> {`до ${deadline}`}
              </div>
            </button>
          </div>

          <div>
            <label className="vt-label">Кто видит сбор</label>
            <div style={{display:'flex', gap:6}}>
              {['Вся группа', 'Только состав турнира'].map((t, i) => (
                <button key={t} className="vt-btn vt-btn--sm" style={{
                  flex:1, background: i===0?'var(--vt-ink)':'transparent',
                  color: i===0?'var(--vt-paper)':'var(--vt-ink)',
                  border:'1px solid var(--vt-stroke)', fontWeight:600
                }}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{padding:'10px 12px', background:'var(--vt-bone)', borderRadius:'var(--r-chip)', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', display:'flex', gap:8}}>
            <Icon name="wallet" size={14} stroke="var(--vt-mute-2)"/>
            <span>Подтверждённые взносы автоматически попадут в кассу группы с категорией <b style={{color:'var(--vt-ink)'}}>contribution</b>.</span>
          </div>
        </div>
      </div>
    </>
  );
};

Object.assign(window, {
  CAMPAIGNS,
  ContribHub, ContribDetail, ContribPledge,
  OrgContribs, OrgContribManage, OrgContribCreate,
});
