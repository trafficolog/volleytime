// screens-extra.jsx — Notifications (player + org), Org Members, Org Reports

// ---- Reusable notification feed renderer ----
const NotifIcon = ({ tone, icon }) => (
  <div style={{
    width:36, height:36, borderRadius:'var(--r-chip)', flexShrink:0,
    display:'flex', alignItems:'center', justifyContent:'center',
    background: tone==='flame' ? 'var(--vt-accent-soft)'
      : tone==='grass' ? 'var(--vt-grass-soft)'
      : tone==='amber' ? 'var(--vt-amber-soft)'
      : tone==='rose' ? 'var(--vt-rose-soft)'
      : 'var(--vt-bone-2)',
    color: tone==='flame' ? 'var(--vt-flame-deep)'
      : tone==='grass' ? 'var(--vt-grass)'
      : tone==='amber' ? 'var(--vt-amber-ink)'
      : tone==='rose' ? 'var(--vt-rose)'
      : 'var(--vt-ink-3)',
  }}>
    <Icon name={icon} size={18}/>
  </div>
);

const NotifFeed = ({ groups, onAction }) => (
  <div className="vt-phone__body" style={{padding:'4px 16px 16px'}}>
    {groups.map((g, gi) => (
      <div key={gi} style={{marginBottom:16}}>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', padding:'10px 4px 8px'}}>{g.day}</div>
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {g.items.map((n, i) => (
            <div key={i} className="vt-card" style={{padding:'12px 14px', display:'flex', gap:12, alignItems:'flex-start', filter: n.read ? 'grayscale(1)' : 'none', position:'relative'}}>
              {!n.read && <span style={{position:'absolute', top:14, right:14, width:7, height:7, borderRadius:'var(--r-pill)', background:'var(--vt-flame)'}}/>}
              <NotifIcon tone={n.tone} icon={n.icon}/>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:'flex', justifyContent:'space-between', gap:8, alignItems:'baseline'}}>
                  <div style={{fontSize:'var(--fs-base)', fontWeight:600, lineHeight:1.25}}>{n.title}</div>
                  <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', flexShrink:0}}>{n.time}</span>
                </div>
                <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4, lineHeight:1.4}}>{n.body}</div>
                {n.actions && (
                  <div style={{display:'flex', gap:6, marginTop:10}}>
                    {n.actions.map((a, ai) => (
                      <button key={ai} onClick={() => onAction && onAction(a)} className={"vt-btn vt-btn--sm " + (a.primary ? 'vt-btn--primary' : 'vt-btn--ghost')} style={{padding:'6px 12px'}}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// ============================================================
// PLAYER · Notifications
// ============================================================
const PlayerNotifications = () => {
  const nav = useNav();
  const ds = useDataState();
  if (ds === 'empty') return (
    <>
      <MiniHeader title="Уведомления" onBack/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px'}}>
        <EmptyState icon="bell" title="Всё прочитано"
          body="Здесь появятся напоминания о тренировках, подтверждения оплат и свободные места из листа ожидания."/>
      </div>
      <TabBar active="home"/>
    </>
  );
  const groups = [
    { day:'Сегодня', items:[
      { icon:'clock', tone:'flame', title:'Через 2 часа · Основа', body:'Сегодня 20:00 · Школа №24. Запись закроется в 19:00.', time:'18:00', actions:[{label:'Подтверждаю', primary:true},{label:'Не смогу'}] },
      { icon:'check', tone:'grass', title:'Оплата подтверждена', body:'Иван П. подтвердил вашу оплату 15 Br за «Основа · 28 мая».', time:'14:22', read:true },
    ]},
    { day:'Вчера', items:[
      { icon:'bell', tone:'amber', title:'Освободилось место', body:'«Открытая игра · 30 мая». Вы первый в листе ожидания — подтвердите за 30 мин.', time:'08:14', actions:[{label:'Хочу войти', primary:true},{label:'Пас'}], read:true },
      { icon:'ticket', tone:'amber', title:'Абонемент скоро закончится', body:'Осталось 5 сессий, действует до 12 июня. Продлите заранее.', time:'09:00', read:true, actions:[{label:'Купить'}] },
    ]},
    { day:'Ранее', items:[
      { icon:'gift', tone:'flame', title:'Новый сбор', body:'«Новый комплект мячей» — цель 250 Br. Можно скинуться.', time:'25 мая', read:true },
      { icon:'home', tone:'grass', title:'Тренировка завершена', body:'«Основа · 21 мая». Списано 1 с абонемента. Спасибо за игру!', time:'21 мая', read:true },
    ]},
  ];
  return (
    <>
      <MiniHeader title="Уведомления" onBack right={
        <button onClick={() => nav.toast('Все отмечены прочитанными')} style={{fontSize:'var(--fs-sm)', fontWeight:600, color:'var(--vt-flame-ink)'}}>Прочитать всё</button>
      }/>
      <NotifFeed groups={groups} onAction={(a) => nav.toast(`${a.label}`)}/>
      <TabBar active="home"/>
    </>
  );
};

// ============================================================
// ORGANIZER · Notifications
// ============================================================
const OrgNotifications = () => {
  const nav = useNav();
  const ds = useDataState();
  if (ds === 'empty') return (
    <>
      <MiniHeader title="Уведомления" onBack/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px'}}>
        <EmptyState icon="bell" title="Новых событий нет"
          body="Сюда приходят записи и отмены, оплаты на подтверждение, обещания взносов и заявки в группу."/>
      </div>
      <OrgTabBar active="home"/>
    </>
  );
  const groups = [
    { day:'Сегодня', items:[
      { icon:'wallet', tone:'amber', title:'4 платежа ждут подтверждения', body:'По событиям «Основа» и «Микст». Самому старому 6 ч.', time:'14:30', actions:[{label:'Проверить', primary:true}] },
      { icon:'user', tone:'flame', title:'Новая запись', body:'Денис записался на «Открытая игра · 30 мая».', time:'13:08', read:true },
      { icon:'close', tone:'rose', title:'Отмена записи', body:'Катя отменила «Основа · 28 мая». Место ушло первому из листа ожидания.', time:'11:40', read:true },
    ]},
    { day:'Вчера', items:[
      { icon:'gift', tone:'grass', title:'Новое обещание взноса', body:'Соня обещала 20 Br в сбор «Новый комплект мячей».', time:'19:31', read:true, actions:[{label:'Подтвердить'}] },
      { icon:'card', tone:'amber', title:'Мало credits', body:'Осталось 8 credits — хватит примерно на 8 событий. Пополните.', time:'09:00', read:true, actions:[{label:'Пополнить'}] },
    ]},
    { day:'Ранее', items:[
      { icon:'users', tone:'flame', title:'Новый игрок в группе', body:'Лёша вступил по приглашению.', time:'24 мая', read:true },
    ]},
  ];
  return (
    <>
      <MiniHeader title="Уведомления" onBack right={
        <ActionMore items={[
          { icon:'check', label:'Прочитать всё', onClick: () => nav.toast('Все отмечены прочитанными') },
          { icon:'settings', label:'Настройки уведомлений', onClick: () => nav.toast('Открываем app.volleytime.by') },
        ]} title="Уведомления"/>
      }/>
      <NotifFeed groups={groups} onAction={(a) => {
        if (a.label === 'Проверить') nav.reset('payments');
        else if (a.label === 'Подтвердить') nav.toast('Взнос подтверждён');
        else nav.toast(a.label);
      }}/>
      <OrgTabBar active="home"/>
    </>
  );
};

// ============================================================
// ORGANIZER · Members (Игроки)
// ============================================================
const OrgMembers = () => {
  const nav = useNav();
  const [seg, setSeg] = React.useState('active');

  const members = PEOPLE.map((p, i) => ({
    ...p,
    role: i === 0 ? 'owner' : i === 1 ? 'organizer' : 'player',
    visits: [24, 18, 9, 32, 6, 12, 21, 4, 15, 11, 7, 19, 28, 3][i] ?? 5,
    sub: i % 3 === 0 ? '5/8' : i % 4 === 0 ? '0/4' : null,
    debt: i === 5 ? 15 : 0,
    last: ['вчера','сегодня','3 дня','6 ч','неделя','вчера','2 дня','5 дн','сегодня','вчера','3 дня','неделя','2 дня','сегодня'][i] ?? 'недавно',
  }));
  const pending = [
    { name:'Marina V.', init:'MV', tag:'flame', via:'по ссылке' },
    { name:'Олег Т.', init:'ОТ', tag:'ink', via:'по QR' },
  ];

  const memberSheet = (m) => nav.sheet({
    title: m.name, sub: `${m.role} · ${m.visits} тренировок`,
    items: [
      { icon:'tg', label:'Открыть профиль', onClick: () => nav.toast(`Профиль · ${m.name}`) },
      { icon:'send', label:'Написать в Telegram', onClick: () => nav.toast(`Чат с ${m.name}`) },
      { icon:'ticket', label:'История абонементов', onClick: () => nav.toast('История абонементов') },
      ...(m.role !== 'owner' ? [{ icon:'star', label:'Назначить организатором', onClick: () => nav.toast(`${m.name} → организатор`) }] : []),
      '---',
      { icon:'logout', tone:'danger', label:'Удалить из группы', onClick: () => nav.alert({
        title:`Удалить ${m.name}?`, body:'Игрок потеряет доступ к событиям группы.', confirm:'Удалить', danger:true,
        onConfirm: () => nav.toast(`${m.name} удалён`)
      })},
    ]
  });

  return (
    <>
      <MiniHeader title="Игроки" sub="VolleyTime Минск" right={
        <button onClick={() => nav.toast('Invite-link скопирован')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'6px 8px'}}>
          <Icon name="plus" size={16}/>
        </button>
      }/>

      {/* Segments */}
      <div style={{padding:'8px 16px 0', display:'flex', gap:4}}>
        {[['active','Активные',14],['pending','Заявки',2],['all','Все',16]].map(([id,label,n]) => (
          <button key={id} onClick={() => setSeg(id)} className="vt-btn vt-btn--sm" style={{
            flex:1, borderRadius:'var(--r-pill)', gap:6,
            background: seg===id ? 'var(--vt-ink)' : 'transparent',
            color: seg===id ? 'var(--vt-paper)' : 'var(--vt-mute-2)',
            fontWeight: seg===id ? 600 : 500,
          }}>{label}<span style={{
            fontSize:'var(--fs-2xs)', padding:'0 6px', borderRadius:'var(--r-pill)',
            background: id==='pending' && seg!==id ? 'var(--vt-amber)' : seg===id ? 'var(--vt-on-hero-line)' : 'var(--vt-bone-2)',
            color: id==='pending' && seg!==id ? 'var(--vt-ink)' : 'inherit'
          }}>{n}</span></button>
        ))}
      </div>

      <div className="vt-phone__body" style={{padding:'12px 16px 16px'}}>
        {seg === 'pending' ? (
          <>
            <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', padding:'2px 4px 12px'}}>Заявки на вступление по invite-ссылке. Подтвердите, чтобы открыть доступ.</div>
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              {pending.map((p, i) => (
                <div key={i} className="vt-card" style={{padding:14, display:'flex', alignItems:'center', gap:12}}>
                  <Avi name={p.name} init={p.init} tag={p.tag} size="md"/>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>{p.name}</div>
                    <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>заявка {p.via}</div>
                  </div>
                  <button onClick={() => nav.toast(`Отклонён · ${p.name}`)} className="vt-btn vt-btn--ghost vt-btn--sm">Отклонить</button>
                  <button onClick={() => nav.toast(`Принят · ${p.name}`)} className="vt-btn vt-btn--primary vt-btn--sm">Принять</button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Summary */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6, marginBottom:14}}>
              <div className="vt-card" style={{padding:'10px 8px', textAlign:'center'}}>
                <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-lg)'}}>14</div>
                <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:2, fontSize:'var(--fs-2xs)'}}>активных</div>
              </div>
              <div className="vt-card" style={{padding:'10px 8px', textAlign:'center'}}>
                <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-lg)'}}>9</div>
                <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:2, fontSize:'var(--fs-2xs)'}}>с абон.</div>
              </div>
              <div className="vt-card" style={{padding:'10px 8px', textAlign:'center'}}>
                <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-lg)', color:'var(--vt-rose)'}}>1</div>
                <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:2, fontSize:'var(--fs-2xs)'}}>с долгом</div>
              </div>
            </div>

            {/* Search */}
            <div className="vt-field" style={{display:'flex', alignItems:'center', gap:8, color:'var(--vt-mute)', fontSize:'var(--fs-sm)', marginBottom:12}}>
              <Icon name="search" size={15}/> Поиск по имени
            </div>

            <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
              {members.slice(0, 14).map((m, i, arr) => (
                <button key={i} onClick={() => memberSheet(m)} style={{display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderBottom: i<arr.length-1?'1px solid var(--vt-stroke)':'none', width:'100%', textAlign:'left', cursor:'pointer'}}>
                  <Avi name={m.name} init={m.init} tag={m.tag} size="md"/>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{display:'flex', alignItems:'center', gap:6}}>
                      <span style={{fontSize:'var(--fs-base)', fontWeight:600}}>{m.name}</span>
                      {m.role === 'owner' && <span className="vt-chip vt-chip--solid" style={{fontSize:'var(--fs-2xs)', padding:'2px 6px'}}>OWNER</span>}
                      {m.role === 'organizer' && <span className="vt-chip vt-chip--flame" style={{fontSize:'var(--fs-2xs)', padding:'2px 6px'}}>ORG</span>}
                    </div>
                    <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2}}>уровень {m.level} · был(а) {m.last}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{m.visits}</div>
                    <div className="vt-cap" style={{color:'var(--vt-mute-2)', fontSize:'var(--fs-2xs)'}}>трен.</div>
                  </div>
                  {m.debt > 0 && <span className="vt-chip vt-chip--rose" style={{fontSize:'var(--fs-2xs)'}}>−{m.debt} Br</span>}
                  {m.sub && m.debt === 0 && <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>{m.sub}</span>}
                  <Icon name="more" size={14} stroke="var(--vt-icon-idle)"/>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <OrgTabBar active="members"/>
    </>
  );
};

// ============================================================
// ORGANIZER · Reports (Отчёт за месяц)
// ============================================================
const OrgReports = () => {
  const nav = useNav();
  return (
    <>
      <MiniHeader title="Отчёт за месяц" onBack right={
        <ActionMore items={[
          { icon:'arrow-d', label:'Скачать CSV', onClick: () => nav.toast('CSV скачан · may-2026.csv') },
          { icon:'send', label:'Отправить в чат', onClick: () => nav.toast('Отчёт опубликован') },
          { icon:'calendar', label:'Сменить месяц', onClick: () => nav.sheet({ title:'Месяц', items:[
            { check:true, label:'Май 2026' }, { label:'Апрель 2026' }, { label:'Март 2026' },
          ]})},
        ]} title="Отчёт"/>
      }/>

      <div className="vt-phone__body" style={{padding:'4px 16px 16px'}}>
        {/* Month switcher */}
        <button onClick={() => nav.toast('Выбор месяца')} style={{display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', padding:'8px', cursor:'pointer'}}>
          <Icon name="chevron-l" size={16} stroke="var(--vt-icon-idle)"/>
          <span style={{fontFamily:'var(--f-display)', fontWeight:600, fontSize:'var(--fs-md)'}}>Май 2026</span>
          <Icon name="chevron-r" size={16} stroke="var(--vt-icon-idle)"/>
        </button>

        {/* Hero — net cash */}
        <div className="vt-card vt-card--hero" style={{padding:18, marginTop:6}}>
          <div className="vt-cap" style={{opacity:0.6}}>Итог месяца · касса</div>
          <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-4xl)', marginTop:6}}>+248,50 Br</div>
          <div style={{display:'flex', gap:18, marginTop:14}}>
            <div>
              <div className="vt-cap" style={{opacity:0.6}}>поступило</div>
              <div className="vt-mono" style={{fontWeight:600, fontSize:'var(--fs-base)', marginTop:4, color:'var(--vt-amber)'}}>+318,50</div>
            </div>
            <div>
              <div className="vt-cap" style={{opacity:0.6}}>расходы</div>
              <div className="vt-mono" style={{fontWeight:600, fontSize:'var(--fs-base)', marginTop:4, opacity:0.85}}>−70,00</div>
            </div>
            <div>
              <div className="vt-cap" style={{opacity:0.6}}>взносы</div>
              <div className="vt-mono" style={{fontWeight:600, fontSize:'var(--fs-base)', marginTop:4, color:'var(--vt-amber)'}}>+295,00</div>
            </div>
          </div>
        </div>

        {/* KPI grid */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10}}>
          {[
            ['Событий','12','+3 к апрелю'],
            ['Бронирований','168','87% заполнение'],
            ['Уникальных игроков','22','+4'],
            ['Куплено абонементов','5','110 Br ср.'],
          ].map(([l,v,d], i) => (
            <div key={i} className="vt-card" style={{padding:'12px 14px'}}>
              <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{l}</div>
              <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-xl)', marginTop:4}}>{v}</div>
              <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2}}>{d}</div>
            </div>
          ))}
        </div>

        {/* Attendance chart by week */}
        <div className="vt-card" style={{padding:16, marginTop:10}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Посещаемость по неделям</div>
            <span className="vt-mono" style={{fontSize:'var(--fs-xs)', fontWeight:600, color:'var(--vt-grass)'}}>87%</span>
          </div>
          <div style={{display:'flex', gap:8, alignItems:'flex-end', height:80, marginTop:14}}>
            {[72, 84, 79, 92].map((h, i) => (
              <div key={i} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6}}>
                <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{h}%</span>
                <div style={{width:'100%', height:`${h}%`, background: i===3?'var(--vt-flame)':'var(--vt-stroke-2)', borderRadius:'var(--r-xs)'}}/>
                <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>Н{i+1}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top players */}
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'20px 4px 8px'}}>Самые активные</div>
        <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
          {PEOPLE.slice(0, 5).map((p, i, arr) => (
            <div key={i} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderBottom: i<arr.length-1?'1px solid var(--vt-stroke)':'none'}}>
              <span className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:700, color: i===0?'var(--vt-flame)':'var(--vt-mute-2)', width:16}}>{i+1}</span>
              <Avi name={p.name} init={p.init} tag={p.tag} size="sm"/>
              <div style={{flex:1, fontSize:'var(--fs-sm)', fontWeight:500}}>{p.name}</div>
              <span className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{[12,11,10,9,8][i]}</span>
              <span className="vt-cap" style={{color:'var(--vt-mute-2)', fontSize:'var(--fs-2xs)'}}>трен.</span>
            </div>
          ))}
        </div>

        {/* Expense breakdown */}
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'20px 4px 8px'}}>Расходы по категориям</div>
        <div className="vt-card" style={{padding:14}}>
          {[
            ['Аренда залов', 42, 60, 'rent'],
            ['Мячи / инвентарь', 18, 26, 'balls'],
            ['Прочее', 10, 14, 'other'],
          ].map(([l, v, pct, k], i) => (
            <div key={i} style={{marginBottom: i<2?12:0}}>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'var(--fs-sm)', marginBottom:6}}>
                <span>{l}</span>
                <span className="vt-mono" style={{fontWeight:600}}>−{v},00 Br</span>
              </div>
              <div className="vt-meter"><i style={{width:`${pct}%`, background:'var(--vt-rose)'}}/></div>
            </div>
          ))}
        </div>

        <button onClick={() => nav.toast('CSV скачан · may-2026.csv')} className="vt-btn vt-btn--ink vt-btn--full vt-btn--lg" style={{marginTop:16, gap:8}}>
          <Icon name="arrow-d" size={16}/> Скачать отчёт CSV
        </button>
      </div>

      <OrgTabBar active="home"/>
    </>
  );
};

// ============================================================
// PLAYER · Мои записи
// ============================================================
const PlayerBookings = () => {
  const nav = useNav();
  const [seg, setSeg] = React.useState('up');
  const up = PLAYER_EVENTS.filter(e => e.joined).map(e => ({ ...e, seats: e.mySeats || 1, time: e.time.split(' ')[0], pay: e.pay || 'pending' }));
  const wait = PLAYER_EVENTS.filter(e => e.inWaitlist).map(e => ({ ...e, pos: e.waitPos, time: e.time.split(' ')[0] }));
  const past = [
    ['25 мая','Микст','пришёл','−1 сесс.'], ['23 мая','Открытая игра','пришёл','15,00 Br'],
    ['21 мая','Основа','пришёл','−1 сесс.'], ['18 мая','Основа','отменил','возврат'],
  ];
  const payChip = (p) => p === 'sub' ? <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>абонемент</span>
    : p === 'pending' ? <span className="vt-chip vt-chip--amber" style={{fontSize:'var(--fs-2xs)'}}>ждёт оплаты</span>
    : <span className="vt-chip vt-chip--state" style={{fontSize:'var(--fs-2xs)'}}>≈ сумма уточнится</span>;

  const cancel = (e) => nav.alert({
    title:'Отменить запись?', body:`${e.title} · ${e.date}. Место уйдёт первому из листа ожидания.`,
    confirm:'Отменить', danger:true, onConfirm: () => nav.toast('Запись отменена')
  });

  return (
    <>
      <MiniHeader title="Мои записи" onBack/>
      <div style={{padding:'0 16px 4px', display:'flex', gap:4}}>
        {[['up','Предстоящие',up.length+wait.length],['past','Прошедшие',past.length]].map(([id,l,n]) => (
          <button key={id} onClick={() => setSeg(id)} className="vt-btn vt-btn--sm" style={{
            flex:1, gap:6, background: seg===id?'var(--vt-ink)':'var(--vt-ctl)', color: seg===id?'var(--vt-paper)':'var(--vt-ink)'
          }}>{l}<span className="vt-mono" style={{fontSize:'var(--fs-2xs)', opacity:.7}}>{n}</span></button>
        ))}
      </div>

      <div className="vt-phone__body" style={{padding:'12px 16px 16px'}}>
        {seg === 'up' ? (
          <>
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              {up.map(e => (
                <div key={e.id} className="vt-card vt-card--raised" style={{padding:14}}>
                  <button onClick={() => nav.push('event', { event: e })} style={{display:'flex', gap:14, width:'100%', textAlign:'left', cursor:'pointer'}}>
                    <div style={{width:48, textAlign:'center', flexShrink:0}}>
                      <div className="vt-mono" style={{fontSize:'var(--fs-3xl)', fontWeight:700, lineHeight:1}}>{e.date.split(' ')[0]}</div>
                      <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:4}}>{e.day}</div>
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:'var(--fs-md)', fontWeight:700}}>{e.title}</div>
                      <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{e.time} · {e.venue}</div>
                      <div style={{display:'flex', gap:6, marginTop:8, flexWrap:'wrap'}}>
                        {payChip(e.pay)}
                        {e.seats > 1 && <span className="vt-chip vt-chip--state" style={{fontSize:'var(--fs-2xs)'}}>{e.seats} места</span>}
                      </div>
                    </div>
                  </button>
                  <div style={{display:'flex', gap:8, marginTop:12}}>
                    {e.pay === 'pending' && <button onClick={() => nav.toast('Реквизиты: Belarusbank · *3214')} className="vt-btn vt-btn--primary vt-btn--sm" style={{flex:1}}>Оплатить</button>}
                    <button onClick={() => cancel(e)} className="vt-btn vt-btn--ghost vt-btn--sm" style={{flex:1}}>Отменить</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'20px 4px 10px'}}>В листе ожидания</div>
            {wait.map(e => (
              <div key={e.id} className="vt-card" style={{padding:14, display:'flex', alignItems:'center', gap:14}}>
                <div style={{width:48, textAlign:'center', flexShrink:0}}>
                  <div className="vt-mono" style={{fontSize:'var(--fs-3xl)', fontWeight:700, lineHeight:1}}>{e.date.split(' ')[0]}</div>
                  <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:4}}>{e.day}</div>
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:'var(--fs-md)', fontWeight:700}}>{e.title}</div>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>Вы {e.pos}-й в очереди · уведомим</div>
                </div>
                <button onClick={() => nav.toast('Вы вышли из листа ожидания')} className="vt-btn vt-btn--ghost vt-btn--sm">Выйти</button>
              </div>
            ))}
          </>
        ) : (
          <div className="vt-card" style={{padding:'4px 14px'}}>
            {past.map(([d,t,s,v], i) => (
              <div key={i} style={{display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderTop: i ? '1px solid var(--vt-bone-2)' : 'none'}}>
                <span className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', width:48}}>{d}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>{t}</div>
                  <div style={{fontSize:'var(--fs-xs)', color: s==='отменил' ? 'var(--vt-rose)' : 'var(--vt-mute-2)', marginTop:2}}>{s}</div>
                </div>
                <span className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <TabBar active="me"/>
    </>
  );
};

// ============================================================
// Создание своей группы — онбординг организатора в Mini App
// ============================================================
const OrgOnboarding = () => {
  const nav = useNav();
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState('');
  const [city, setCity] = React.useState('Минск');
  const [days, setDays] = React.useState(['Ср']);
  const steps = ['Группа', 'Расписание', 'Готово'];
  const toggleDay = (d) => setDays(s => s.includes(d) ? s.filter(x => x !== d) : [...s, d]);

  return (
    <>
      <MiniHeader title="Своя группа" sub={`Шаг ${step+1} из 3`} onBack/>
      <div style={{padding:'0 16px 6px', display:'flex', gap:6}}>
        {steps.map((s, i) => (
          <div key={s} style={{flex:1}}>
            <div style={{height:4, borderRadius:'var(--r-pill)', background: i <= step ? 'var(--vt-flame)' : 'var(--vt-bone-2)'}}/>
            <div style={{fontSize:'var(--fs-2xs)', fontWeight:600, marginTop:6, color: i <= step ? 'var(--vt-ink)' : 'var(--vt-mute-2)'}}>{s}</div>
          </div>
        ))}
      </div>

      <div className="vt-phone__body" style={{padding:'14px 16px 16px'}}>
        {step === 0 && (
          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            <h2 style={{fontSize:'var(--fs-3xl)', lineHeight:1}}>Как назовём группу?</h2>
            <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', lineHeight:1.45}}>Название увидят игроки в приглашении и в боте.</div>
            <div>
              <label className="vt-label">Название</label>
              <input className="vt-field" value={name} onChange={e => setName(e.target.value)} placeholder="Напр. Волейбол по средам"/>
            </div>
            <div>
              <label className="vt-label">Город</label>
              <input className="vt-field" value={city} onChange={e => setCity(e.target.value)}/>
            </div>
          </div>
        )}
        {step === 1 && (
          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            <h2 style={{fontSize:'var(--fs-3xl)', lineHeight:1}}>Когда играете?</h2>
            <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', lineHeight:1.45}}>Можно пропустить — тренировки создаются и вручную.</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:6}}>
              {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => (
                <button key={d} onClick={() => toggleDay(d)} className="vt-btn vt-btn--sm" style={{
                  padding:'12px 0', background: days.includes(d) ? 'var(--vt-ink)' : 'var(--vt-ctl)',
                  color: days.includes(d) ? 'var(--vt-paper)' : 'var(--vt-ink)'
                }}>{d}</button>
              ))}
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
              <div><label className="vt-label">Время</label><div className="vt-field" style={{display:'flex', alignItems:'center', gap:8}}><Icon name="clock" size={14}/> 20:00</div></div>
              <div><label className="vt-label">Мест</label><div className="vt-field vt-mono" style={{fontWeight:700}}>14</div></div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div style={{display:'flex', flexDirection:'column', gap:12}}>
            <div className="vt-card vt-card--hero" style={{padding:20}}>
              <div className="vt-cap" style={{opacity:.72}}>Группа создана</div>
              <div style={{fontFamily:'var(--f-display)', fontSize:'var(--fs-3xl)', fontWeight:700, textTransform:'uppercase', lineHeight:1, marginTop:10}}>{name || 'Волейбол по средам'}</div>
              <div style={{fontSize:'var(--fs-sm)', opacity:.8, marginTop:8}}>{city} · {days.length ? days.join(', ') : 'расписание позже'}</div>
            </div>
            <div className="vt-card vt-card--warm" style={{padding:16, display:'flex', alignItems:'center', gap:14}}>
              <div className="vt-mono" style={{fontSize:'var(--fs-4xl)', fontWeight:700, lineHeight:1}}>5</div>
              <div style={{fontSize:'var(--fs-sm)', lineHeight:1.45}}><b>credits в подарок</b><br/><span style={{color:'var(--vt-mute-2)'}}>1 credit = 1 событие. Хватит на первые недели.</span></div>
            </div>
            <div className="vt-card" style={{padding:14}}>
              <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>Пригласите игроков</div>
              <div className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:6}}>t.me/volleytime_bot?start=org_9xQ2</div>
              <button onClick={() => nav.toast('Ссылка скопирована')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{marginTop:10, gap:6}}><Icon name="copy" size={13}/> Скопировать</button>
            </div>
          </div>
        )}
      </div>

      <div style={{padding:'12px 16px 16px', display:'flex', gap:8}}>
        {step === 1 && <button onClick={() => setStep(2)} className="vt-btn vt-btn--ghost vt-btn--lg" style={{flex:1}}>Пропустить</button>}
        <button onClick={() => step < 2 ? setStep(step+1) : (nav.reset('home'), setTimeout(() => nav.toast('Переключитесь на «Организатор», чтобы управлять группой'), 80))}
          className="vt-btn vt-btn--primary vt-btn--lg" style={{flex:2}} disabled={step===0 && !name.trim()}>
          {step === 0 ? 'Дальше' : step === 1 ? 'Создать группу' : 'Готово'}
        </button>
      </div>
    </>
  );
};

Object.assign(window, { PlayerNotifications, OrgNotifications, OrgMembers, OrgReports, PlayerBookings, OrgOnboarding });
