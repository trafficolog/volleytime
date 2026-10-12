// screens-organizer.jsx — Mini App, организатор · interactive

// ---------- OrgHome ----------
const OrgHome = () => {
  const nav = useNav();

  const events = [
    { id:'e1', day:'Ср', date:'28', time:'20:00', title:'Основа', venue:'Школа №24', m:'12/14', meter:86, pay:'pending', payCount: pendingOf(12) },
    { id:'e2', day:'Пт', date:'30', time:'19:30', title:'Открытая игра', venue:'СК «Заслонова»', m:'9/14', meter:64, pay:'all-ok' },
    { id:'e3', day:'Вс', date:'1', time:'10:00', title:'Микст', venue:'Школа №24', m:'14/14', meter:100, pay:'wait', wait:2 },
    { id:'e5', day:'Сб', date:'7', time:'12:00', title:'Аренда большого зала', venue:'СК «Заслонова»', m:'8/16', meter:50, pay:'pending',
      priceMode:'split', total:240, joinedCount:8, status:'open', payCount: pendingOf(8, { isSplit:true }) },
    { id:'e6', day:'Вс', date:'8', time:'11:00', title:'Воскресная игра', venue:'Школа №24', m:'12/16', meter:75, pay:'pending',
      priceMode:'split', total:180, joinedCount:12, status:'closed', payCount: pendingOf(12, { isSplit:true }) },
  ];

  const orgMenu = () => nav.sheet({
    title:'Группы',
    items:[
      { org:true, radio:true, logo:LOGO_URL, label:'VolleyTime Минск', sub:'владелец · 14 игроков' },
      { org:true, radio:false, label:'СпайкКлуб', sub:'организатор · 22 игрока', onClick: () => nav.toast('Переключено на «СпайкКлуб»') },
      '---',
      { icon:'card', label:'Пополнить credits', sub:'в веб-кабинете', onClick: () => nav.toast('Открываем app.volleytime.by/billing') },
      { icon:'settings', label:'Настройки группы', sub:'в веб-кабинете', onClick: () => nav.toast('Открываем app.volleytime.by/settings') },
      '---',
      { icon:'plus', label:'Создать группу', onClick: () => nav.push('org-new') },
    ]
  });

  // Организатор: amber = нужно действие · grass = всё в порядке · серый = информация
  const chipsFor = (e) => {
    const out = [];
    if (e.priceMode === 'split' && e.status === 'closed') out.push(['vt-chip--amber', 'нужно распределить']);
    else if (e.payCount > 0) out.push(['vt-chip--amber', `${e.payCount} ${e.payCount % 10 === 1 && e.payCount % 100 !== 11 ? 'ждёт' : 'ждут'} оплаты`]);
    else out.push(['vt-chip--grass', 'все оплатили']);
    if (e.wait) out.push(['vt-chip--state', `очередь · ${e.wait}`]);
    if (e.status === 'closed') out.push(['vt-chip--state', 'запись закрыта']);
    return out;
  };
  const quick = [
    ['plus', 'Тренировка', () => nav.push('create')],
    ['users', 'Пригласить', () => nav.toast('Ссылка-приглашение скопирована')],
    ['arrow-u', 'Расход', () => nav.sheet({ title:'Расход', items:[
      { icon:'pin', label:'Аренда зала', onClick: () => nav.toast('Расход добавлен') },
      { icon:'ball', label:'Мячи / инвентарь', onClick: () => nav.toast('Расход добавлен') },
      { icon:'wallet', label:'Прочее', onClick: () => nav.toast('Расход добавлен') },
    ]})],
    ['chart', 'Отчёт', () => nav.push('reports')],
  ];

  return (
    <>
      {/* Header */}
      <div style={{padding:'4px 16px 0', display:'flex', alignItems:'center', gap:12}}>
        <button onClick={orgMenu} style={{display:'flex', alignItems:'center', gap:12, flex:1, minWidth:0, textAlign:'left', cursor:'pointer'}}>
          <span style={{width:40, height:40, borderRadius:'var(--r-field)', flexShrink:0, background:`var(--vt-bone) url(${LOGO_URL}) center/70% no-repeat`}}></span>
          <div style={{minWidth:0, flex:1}}>
            <div style={{fontSize:'var(--fs-md)', fontWeight:700, display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap', overflow:'hidden'}}>
              VolleyTime Минск <Icon name="chevron-d" size={14} stroke="var(--vt-icon-idle)"/>
            </div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2, display:'flex', alignItems:'center', gap:6}}>
              <span className="vt-chip vt-chip--solid" style={{fontSize:'var(--fs-2xs)', padding:'2px 6px'}}>Владелец</span> 14 игроков
            </div>
          </div>
        </button>
        <button onClick={() => nav.push('notifications')} className="vt-btn vt-btn--ghost" style={{width:44, height:44, padding:0, flexShrink:0, position:'relative'}}>
          <Icon name="bell" size={18}/>
          {hasUnread(useDataState()) && <span style={{position:'absolute', top:11, right:12, width:8, height:8, borderRadius:'var(--r-pill)', background:'var(--vt-orange)', boxShadow:'0 0 0 2px var(--vt-bone)'}}/>}
        </button>
      </div>

      <div className="vt-phone__body" style={{padding:'20px 16px 16px'}}>
        <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>Май · 12 событий</div>
        <h2 style={{fontSize:'var(--fs-4xl)', marginTop:4}}>Обзор группы</h2>

        {/* Bento */}
        <div style={{display:'grid', gridTemplateColumns:'1.3fr 1fr', gridTemplateRows:'1fr 1fr', gap:12, marginTop:16}}>
          <button onClick={() => nav.reset('ledger')} className="vt-card vt-card--hero" style={{gridRow:'span 2', padding:18, display:'flex', flexDirection:'column', textAlign:'left', cursor:'pointer', color:'var(--vt-on-hero)'}}>
            <div className="vt-cap" style={{opacity:.72}}>Касса · май</div>
            <div className="vt-mono" style={{fontSize:'var(--fs-5xl)', fontWeight:700, lineHeight:.95, marginTop:12}}>+248<span style={{fontSize:'var(--fs-2xl)', opacity:.7}}>,50</span></div>
            <div style={{fontSize:'var(--fs-xs)', opacity:.75, marginTop:4}}>белорусских рублей</div>
            <div style={{marginTop:'auto', paddingTop:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:'var(--fs-xs)'}}>
              <div><div style={{opacity:.7}}>пришло</div><div className="vt-mono" style={{fontSize:'var(--fs-md)', fontWeight:700, color:'var(--vt-amber)', marginTop:2}}>+318,50</div></div>
              <div><div style={{opacity:.7}}>ушло</div><div className="vt-mono" style={{fontSize:'var(--fs-md)', fontWeight:700, marginTop:2}}>−70,00</div></div>
            </div>
          </button>
          <button onClick={() => nav.push('payments')} className="vt-card vt-card--warm" style={{padding:16, textAlign:'left', cursor:'pointer', display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
            <Icon name="wallet" size={18} stroke="var(--vt-orange-ink)"/>
            <div>
              <div className="vt-mono" style={{fontSize:'var(--fs-4xl)', fontWeight:700, lineHeight:1}}>{PENDING_PAYMENTS.length}</div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:4}}>ждут подтверждения</div>
            </div>
          </button>
          <button onClick={() => nav.toast('Покупка credits — в веб-кабинете')} className="vt-card" style={{padding:16, textAlign:'left', cursor:'pointer', display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
            <Icon name="card" size={18} stroke="var(--vt-ink-3)"/>
            <div>
              <div className="vt-mono" style={{fontSize:'var(--fs-4xl)', fontWeight:700, lineHeight:1}}>32</div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:4}}>credits ≈ 2,5 мес.</div>
            </div>
          </button>
        </div>

        {/* Quick actions */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginTop:12}}>
          {quick.map(([ic, l, fn]) => (
            <button key={l} onClick={fn} style={{display:'flex', flexDirection:'column', alignItems:'center', gap:6, cursor:'pointer'}}>
              <span style={{width:'100%', aspectRatio:'1/1', maxWidth:64, borderRadius:'var(--r-tile)', background:'var(--vt-bone)', display:'flex', alignItems:'center', justifyContent:'center'}}>
                <Icon name={ic} size={22} stroke="var(--vt-ink)"/>
              </span>
              <span style={{fontSize:'var(--fs-xs)', fontWeight:600, color:'var(--vt-ink-3)'}}>{l}</span>
            </button>
          ))}
        </div>

        {/* Events — rows without surfaces */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:28}}>
          <h2 style={{fontSize:'var(--fs-xl)'}}>События</h2>
          <button onClick={() => nav.push('schedule')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{gap:4}}>Смотреть все <Icon name="chevron-r" size={14}/></button>
        </div>
        <div style={{marginTop:4}}>
          {events.map((e, i) => {
            const chips = chipsFor(e);
            return (
              <button key={e.id} onClick={() => nav.push('event-detail', { event: e })} style={{
                display:'flex', alignItems:'center', gap:16, width:'100%', textAlign:'left', cursor:'pointer',
                padding:'12px 0', boxShadow: i ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none'
              }}>
                <div style={{width:44, textAlign:'center', flexShrink:0}}>
                  <div className="vt-mono" style={{fontSize:'var(--fs-3xl)', fontWeight:700, lineHeight:1}}>{e.date}</div>
                  <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:4}}>{e.day}</div>
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:'var(--fs-md)', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{e.title}</div>
                  <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>{e.time} · {e.venue}</div>
                  <div style={{display:'flex', alignItems:'center', gap:8, marginTop:8}}>
                    <div className="vt-meter" style={{flex:1, maxWidth:120}}><i style={{width:`${e.meter}%`, background: meterTint(e.meter)}}/></div>
                    <span className="vt-mono" style={{fontSize:'var(--fs-sm)'}}>{e.m}</span>
                    {e.priceMode === 'split' && <span className="vt-mono" style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>· {e.status === 'closed' ? '' : '≈ '}{byn(e.total/e.joinedCount)}</span>}
                  </div>
                </div>
                <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0}}>
                  {chips.map(([tone, label]) => <span key={label} className={`vt-chip ${tone}`}>{label}</span>)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <OrgTabBar active="home"/>
    </>
  );
};

// ---------- OrgEvent (roster management) ----------
const OrgEvent = () => {
  const nav = useNav();
  const e = nav.data.event || { title:'Основа · 28 мая', time:'20:00', venue:'Школа №24' };
  const isSplit = e.priceMode === 'split';
  const isClosed = e.status === 'closed';
  const splitTotal = e.total || 240;
  const headCount = e.joinedCount || (e.m ? parseInt(e.m, 10) : 12);
  const perHead = splitTotal / headCount;
  const seatPrice = isSplit ? perHead : 15;
  const [tab, setTab] = React.useState('roster');

  const main = buildRoster(headCount, { isSplit });
  const waitlist = isClosed ? [] : PEOPLE.slice(headCount, headCount + 2);
  const pendingCount = main.filter(p => p.pay === 'pending').length;
  const paidCount = main.filter(p => p.pay === 'paid').length;
  const paidSeats = main.filter(p => p.pay === 'paid').reduce((s, p) => s + p.seats, 0);

  const playerSheet = (p) => nav.sheet({
    title: p.name,
    sub: `${p.seats > 1 ? `${p.seats} места · ` : `уровень ${p.level} · `}${p.pay === 'pending' ? 'ожидает оплаты' : p.pay === 'subs' ? 'с абонемента' : 'оплачено'}`,
    items: [
      ...(p.pay === 'pending' ? [
        { icon:'check', label:'Подтвердить оплату', onClick: () => nav.toast(`Подтверждено · ${p.name}`) },
        { icon:'send', label:'Напомнить в Telegram', onClick: () => nav.toast('Напоминание отправлено') },
      ] : []),
      { icon:'arrow-d', label:'Перевести в лист ожидания', onClick: () => nav.toast(`${p.name} → лист ожидания`) },
      { icon:'tg', label:'Открыть профиль', onClick: () => nav.toast('Профиль игрока') },
      '---',
      { icon:'close', tone:'danger', label:'Удалить из состава', onClick: () => nav.toast(`${p.name} удалён · место освободилось`) },
    ]
  });

  const eventMore = [
    { icon:'edit', label:'Редактировать событие', onClick: () => nav.toast('Редактирование') },
    { icon:'copy', label:'Дублировать в следующую неделю', onClick: () => nav.toast('Дублировано · 4 июня 20:00') },
    { icon:'send', label:'Отправить в чат группы', onClick: () => nav.toast('Опубликовано в чате') },
    { icon:'qr', label:'QR-код события', onClick: () => nav.toast('Открыт QR-код') },
    '---',
    { icon:'close', tone:'danger', label:'Отменить событие', onClick: () => nav.alert({
      title:'Отменить событие?', body:'Все записи будут отменены. Если запись ещё не открывалась, credit вернётся.',
      confirm:'Отменить событие', danger:true,
      onConfirm: () => { nav.back(); setTimeout(() => nav.toast('Событие отменено · +1 credit'), 80); }
    })},
  ];

  return (
    <>
      <MiniHeader
        title={e.title}
        sub={`${e.time} · ${e.venue}`}
        onBack
        right={<ActionMore items={eventMore} title={e.title}/>}
      />

      <div style={{padding:'8px 16px 0', display:'flex', gap:4}}>
        {[
          ['roster','Состав'],
          ['payments','Платежи'],
          ['share','Шеринг'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className="vt-btn vt-btn--sm" style={{
            flex:1, borderRadius:'var(--r-pill)',
            background: tab===id ? 'var(--vt-ink)' : 'transparent',
            color: tab===id ? 'var(--vt-paper)' : 'var(--vt-mute-2)',
            fontWeight: tab===id ? 600 : 500,
            transition:'all .12s'
          }}>{label}</button>
        ))}
      </div>

      <div className="vt-phone__body" style={{padding:'12px 16px 16px'}}>
        {tab === 'roster' && (
          <>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6, marginBottom:12}}>
              <div className="vt-card" style={{padding:'10px 8px', textAlign:'center'}}>
                <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-lg)'}}>{headCount}</div>
                <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:2, fontSize:'var(--fs-2xs)'}}>мест занято</div>
              </div>
              <div className="vt-card" style={{padding:'10px 8px', textAlign:'center'}}>
                <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-lg)'}}>{waitlist.length}</div>
                <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:2, fontSize:'var(--fs-2xs)'}}>лист ожид.</div>
              </div>
              <button onClick={() => setTab('payments')} className="vt-card" style={{padding:'10px 8px', textAlign:'center', cursor:'pointer'}}>
                <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-lg)', color:'var(--vt-amber)'}}>{pendingCount}</div>
                <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:2, fontSize:'var(--fs-2xs)'}}>оплатить</div>
              </button>
            </div>

            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 4px 10px'}}>
              <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Основной состав · {e.m || `${headCount} / 14`}{main.length !== headCount ? ` · ${main.length} игроков` : ''}</div>
              <button onClick={() => nav.toast('Открываем app.volleytime.by')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{gap:6, padding:'4px 8px'}}>
                <Icon name="plus" size={12}/> Добавить
              </button>
            </div>

            <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
              {main.map((p, i) => (
                <button key={i} onClick={() => playerSheet(p)} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderBottom: i<main.length-1?'1px solid var(--vt-bone-2)':'none', width:'100%', textAlign:'left', cursor:'pointer'}}>
                  <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', width:14}}>{i+1}</span>
                  <Avi name={p.name} init={p.init} tag={p.tag} size="sm"/>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:'var(--fs-sm)', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'flex', alignItems:'center', gap:6}}>
                      {p.name}
                      {p.seats > 1 && <span className="vt-chip vt-chip--flame" style={{fontSize:'var(--fs-2xs)', padding:'2px 6px'}}>+{p.seats-1}</span>}
                    </div>
                    <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2}}>
                      {p.seats > 1 ? `занял ${p.seats} места · ${byn(seatPrice * p.seats)}` : `уровень ${p.level}`}
                    </div>
                  </div>
                  {p.pay === 'pending' && <span className="vt-chip vt-chip--amber" style={{fontSize:'var(--fs-2xs)'}}>ждёт оплаты</span>}
                  {p.pay === 'subs' && <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>с абон.</span>}
                  {p.pay === 'paid' && <Icon name="check" size={14} stroke="var(--vt-grass)" sw={2.2}/>}
                  <Icon name="more" size={14} stroke="var(--vt-icon-idle)"/>
                </button>
              ))}
            </div>

            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 4px 10px'}}>
              <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Лист ожидания · войдут при отмене</div>
            </div>
            <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
              {waitlist.map((p, i) => (
                <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderBottom: i<waitlist.length-1?'1px solid var(--vt-bone-2)':'none'}}>
                  <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', width:14}}>{i+1}</span>
                  <Avi name={p.name} init={p.init} tag={p.tag} size="sm"/>
                  <div style={{flex:1, fontSize:'var(--fs-sm)', fontWeight:500}}>{p.name}</div>
                  <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>уровень {p.level}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'payments' && (
          <>
            {isSplit && (
              <div className="vt-card" style={{padding:16, marginBottom:12, borderColor: isClosed ? 'var(--vt-grass)' : 'var(--vt-amber)'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                  <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Делим общую сумму</div>
                  {isClosed
                    ? <span className="vt-chip vt-chip--grass vt-chip--dot" style={{fontSize:'var(--fs-2xs)'}}>распределено</span>
                    : <span className="vt-chip vt-chip--amber" style={{fontSize:'var(--fs-2xs)'}}>запись открыта</span>}
                </div>
                <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:10}}>
                  <span className="vt-mono" style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-2xl)', lineHeight:1}}>
                    {isClosed ? byn(perHead) : `≈ ${byn(perHead)}`}
                  </span>
                  <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>за место</span>
                </div>
                <div className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:6}}>
                  {byn(splitTotal)} ÷ {headCount} мест · собрано {byn(perHead * paidSeats)}
                </div>
                <div className="vt-meter vt-meter--grass" style={{marginTop:10}}><i style={{width:`${Math.round(paidSeats/headCount*100)}%`}}/></div>
                {!isClosed ? (
                  <button onClick={() => nav.alert({
                    title:'Закрыть запись и распределить?',
                    body:`Состав зафиксируется на ${headCount} местах (${main.length} игроков), по ${byn(perHead)} за место. Кто занял несколько мест — платит за каждое. Игроки получат уведомление с точной суммой.`,
                    confirm:'Закрыть и распределить',
                    onConfirm: () => nav.toast(`Распределено · ${byn(perHead)} × ${headCount} мест`)
                  })} className="vt-btn vt-btn--ink vt-btn--full" style={{marginTop:14, gap:8}}>
                    <Icon name="check" size={15}/> Закрыть запись и распределить
                  </button>
                ) : (
                  <div style={{marginTop:12, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', lineHeight:1.45}}>
                    Сумма разослана игрокам. Осталось подтвердить поступления ниже.
                  </div>
                )}
              </div>
            )}
            <div style={{marginTop:4, marginBottom:10, padding:'10px 12px', background:'var(--vt-bone)', borderRadius:'var(--r-chip)', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>
              Подтверждение оплат · можно подтверждать прямо отсюда.
            </div>
            <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
              {main.filter(p => p.pay === 'pending').map((p, i, arr) => (
                <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'12px', borderBottom: i<arr.length-1?'1px solid var(--vt-bone-2)':'none'}}>
                  <Avi name={p.name} init={p.init} tag={p.tag} size="md"/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{p.name}</div>
                    <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{methodLabel('cash')} · {byn(seatPrice * p.seats)}{p.seats > 1 ? ` · ${p.seats} места` : ''} · 6 ч назад</div>
                  </div>
                  <button onClick={() => nav.toast(`Подтверждено · ${p.name}`)} className="vt-btn vt-btn--primary vt-btn--sm" style={{padding:'6px 12px'}}>✓</button>
                </div>
              ))}
              {main.filter(p => p.pay === 'paid').map((p, i, arr) => (
                <div key={`paid-${i}`} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderBottom:i<arr.length-1?'1px solid var(--vt-bone-2)':'none'}}>
                  <Icon name="check" size={14} stroke="var(--vt-grass)" sw={2.4}/>
                  <div style={{flex:1, fontSize:'var(--fs-sm)', color:'var(--vt-ink-3)'}}>{p.name}{p.seats > 1 ? <span style={{color:'var(--vt-mute-2)'}}> · {p.seats} места</span> : ''}</div>
                  <span className="vt-mono" style={{fontSize:'var(--fs-xs)', fontWeight:600, color:'var(--vt-mute-2)'}}>+{byn(seatPrice * p.seats)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'share' && (
          <div style={{display:'flex', flexDirection:'column', gap:14, marginTop:4}}>
            <div className="vt-card" style={{padding:18}}>
              <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Публичная ссылка</div>
              <div className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:6, padding:'8px 10px', background:'var(--vt-bone-2)', borderRadius:'var(--r-sm)'}}>volleytime.by/e/7gK4nT</div>
              <button onClick={() => nav.toast('Ссылка скопирована')} className="vt-btn vt-btn--ink vt-btn--full" style={{marginTop:10, gap:8}}>
                <Icon name="copy" size={14}/> Скопировать
              </button>
            </div>

            <div className="vt-card" style={{padding:18, display:'flex', flexDirection:'column', alignItems:'center'}}>
              <div className="vt-cap" style={{color:'var(--vt-mute-2)', alignSelf:'flex-start'}}>QR · для зала</div>
              <div style={{width:160, height:160, background:'var(--vt-bone-2)', borderRadius:'var(--r-chip)', marginTop:12, padding:14, display:'flex', alignItems:'center', justifyContent:'center'}}>
                <Icon name="qr" size={130} sw={1} stroke="var(--vt-ink)"/>
              </div>
              <button onClick={() => nav.toast('QR-код сохранён')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{marginTop:12, gap:6}}>
                <Icon name="arrow-d" size={13}/> Сохранить PNG
              </button>
            </div>

            <button onClick={() => nav.toast('Отправлено · в чат VT Минск')} className="vt-btn vt-btn--ghost vt-btn--full" style={{gap:8, padding:'12px 0'}}>
              <Icon name="send" size={14}/> Отправить в Telegram-чат группы
            </button>
          </div>
        )}
      </div>
    </>
  );
};

// ---------- OrgPayments ----------
const OrgPayments = () => {
  const nav = useNav();
  const [items, setItems] = React.useState(PENDING_PAYMENTS.map(p => ({ ...p, time: p.ago + ' назад' })));

  const due = (it) => it.amount * (it.seats || 1);
  const confirm = (it) => {
    setItems(p => p.filter(x => x.id !== it.id));
    nav.toast(`Подтверждено · ${it.name} · +${byn(due(it))}`);
  };
  const reject = (it) => nav.alert({
    title:'Отклонить платёж?', body:`Игрок ${it.name} получит уведомление. Бронь будет отменена.`,
    confirm:'Отклонить', danger:true,
    onConfirm: () => {
      setItems(p => p.filter(x => x.id !== it.id));
      nav.toast(`Отклонён · ${it.name}`, 'danger');
    }
  });

  const total = items.reduce((s, i) => s + due(i), 0);

  return (
    <>
      <MiniHeader
        title="Ожидают подтверждения"
        sub={`${items.length} платежа · сумма ${byn(total)}`}
        onBack
        right={<ActionMore items={[
          { icon:'check', label:'Подтвердить все', onClick: () => { setItems([]); nav.toast(`Подтверждено · +${total} Br в кассу`); } },
          { icon:'filter', label:'Фильтр по методу', onClick: () => nav.toast('Фильтры') },
        ]} title="Действия"/>}
      />

      <div className="vt-phone__body" style={{padding:'8px 16px 16px'}}>
        <div style={{display:'flex', flexDirection:'column', gap:10}}>
          {items.length === 0 && (
            <div style={{padding:'40px 20px', textAlign:'center', color:'var(--vt-mute-2)'}}>
              <Icon name="check" size={36} stroke="var(--vt-grass)" sw={2}/>
              <div style={{marginTop:12, fontFamily:'var(--f-display)', fontWeight:600, fontSize:'var(--fs-md)', color:'var(--vt-ink)'}}>Всё подтверждено</div>
              <div style={{fontSize:'var(--fs-sm)', marginTop:4}}>Ни одного pending-платежа</div>
            </div>
          )}
          {items.map((p) => (
            <div key={p.id} className="vt-card vt-card--raised" style={{padding:14}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <Avi name={p.name} init={p.init} tag={p.tag} size="md"/>
                <div style={{flex:1}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8}}>
                    <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>{p.name}</div>
                    <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-md)'}}>{byn(due(p))}</div>
                  </div>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{p.event}</div>
                </div>
              </div>

              <div style={{display:'flex', gap:6, alignItems:'center', marginTop:10, flexWrap:'wrap'}}>
                <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>{p.method === 'cash' ? 'Наличные' : 'Перевод'}</span>
                {p.seats > 1 && <span className="vt-chip vt-chip--flame" style={{fontSize:'var(--fs-2xs)'}}>{`${p.seats} места × ${byn(p.perSeat || p.amount)}`}</span>}
                {p.split && <span className="vt-chip vt-chip--amber" style={{fontSize:'var(--fs-2xs)'}}>делёж суммы</span>}
                {p.sub && <span className="vt-chip vt-chip--flame" style={{fontSize:'var(--fs-2xs)'}}>Абонемент 8s</span>}
                <span style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginLeft:'auto'}}>{p.time}</span>
              </div>

              <div style={{display:'flex', gap:6, marginTop:12}}>
                <button onClick={() => reject(p)} className="vt-btn vt-btn--ghost" style={{flex:1, padding:'10px 0'}}>Отклонить</button>
                <button onClick={() => confirm(p)} className="vt-btn vt-btn--primary" style={{flex:1.6, padding:'10px 0', gap:6}}>
                  <Icon name="check" size={14}/> Подтвердить
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'22px 4px 8px'}}>Недавно подтверждено</div>
        <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
          {[
            ['Артём', 'Основа · 21 мая', 15, '2 дня'],
            ['Лера', 'Открытая · 23 мая', 15, '1 день'],
          ].map(([n,e,a,t], i, arr) => (
            <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom: i<arr.length-1?'1px solid var(--vt-bone-2)':'none'}}>
              <Icon name="check" size={14} stroke="var(--vt-grass)" sw={2.2}/>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:'var(--fs-sm)', fontWeight:500, color:'var(--vt-ink-3)'}}>{n}</div>
                <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{e}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600}}>+{byn(a)}</div>
                <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{t} назад</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <OrgTabBar active="cash"/>
    </>
  );
};

// ---------- OrgLedger ----------
const OrgLedger = () => {
  const nav = useNav();

  const entries = [
    { type:'in', amount:30, label:'Артём, Никита · Основа 28 мая', day:'Сегодня', t:'14:22' },
    { type:'in', amount:90, label:'Игорь · Аренда большого зала · 3 места', day:'Сегодня', t:'12:08' },
    { type:'out', amount:42, label:'Аренда Школа №24', cat:'rent', day:'Сегодня', t:'09:50' },
    { type:'in', amount:110, label:'Соня · Абонемент 8s', day:'Вчера', t:'19:31' },
    { type:'in', amount:60, label:'Маша · Аренда большого зала · 2 места', day:'Вчера', t:'14:11' },
    { type:'out', amount:18, label:'Мячи Mikasa MVA200 ×2', cat:'balls', day:'24 мая', t:'17:00' },
  ];

  const expense = () => nav.sheet({
    title:'Расход', sub:'категория',
    items:[
      { icon:'pin', label:'Аренда зала', onClick: () => nav.toast('Расход добавлен · −42 Br') },
      { icon:'gift', label:'Мячи / инвентарь', onClick: () => nav.toast('Расход добавлен · −18 Br') },
      { icon:'users', label:'Судья / организатор', onClick: () => nav.toast('Расход добавлен') },
      { icon:'wallet', label:'Прочее', onClick: () => nav.toast('Расход добавлен') },
    ]
  });
  const income = () => nav.sheet({ title:'Поступление', items:[{ icon:'users', label:'Оплата от игрока', onClick:()=>nav.push('payments') },{ icon:'gift', label:'Взнос в сбор', onClick:()=>nav.reset('contribs') },{ icon:'wallet', label:'Прочее поступление', onClick:()=>nav.toast('Поступление добавлено') }] });

  return (
    <>
      <MiniHeader
        title="Касса"
        sub="май · текущий месяц"
        right={<ActionMore items={[
          { icon:'arrow-d', label:'Экспорт CSV', onClick: () => nav.toast('CSV сохранён') },
          { icon:'chart', label:'Графики и отчёты', onClick: () => nav.toast('Открываем app.volleytime.by') },
          { icon:'filter', label:'Фильтр по категории', onClick: () => nav.toast('Фильтры') },
        ]} title="Касса"/>}
      />

      <div className="vt-phone__body" style={{padding:'4px 16px 16px'}}>
        <div className="vt-card vt-card--hero" style={{padding:18}}>
          <div className="vt-cap" style={{opacity:0.65}}>Баланс кассы</div>
          <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-4xl)', marginTop:6}}>+248,50 Br</div>
          <div style={{display:'flex', gap:18, marginTop:14}}>
            <div>
              <div className="vt-cap" style={{opacity:0.6}}>поступило</div>
              <div className="vt-mono" style={{fontWeight:600, fontSize:'var(--fs-base)', marginTop:4, color:'var(--vt-amber)'}}>+318,50 Br</div>
            </div>
            <div>
              <div className="vt-cap" style={{opacity:0.6}}>списано</div>
              <div className="vt-mono" style={{fontWeight:600, fontSize:'var(--fs-base)', marginTop:4, color:'var(--vt-paper)', opacity:0.85}}>−70,00 Br</div>
            </div>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10}}>
          <button onClick={expense} className="vt-btn vt-btn--ghost" style={{justifyContent:'flex-start', gap:8, padding:'12px 14px'}}>
            <Icon name="plus" size={16}/> Расход
          </button>
          <button onClick={income} className="vt-btn vt-btn--ghost" style={{justifyContent:'flex-start', gap:8, padding:'12px 14px'}}>
            <Icon name="arrow-d" size={16}/> Поступление
          </button>
        </div>

        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'20px 4px 8px'}}>Журнал</div>

        {['Сегодня', 'Вчера', '24 мая'].map((day, gi) => (
          <div key={day} style={{marginBottom:14}}>
            <div style={{display:'flex', alignItems:'center', gap:8, padding:'4px 4px 6px'}}>
              <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', fontWeight:600}}>{day}</div>
              <div style={{flex:1, height:1, background:'var(--vt-stroke)'}}/>
            </div>
            <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
              {entries.filter(e => e.day === day).map((e, i, arr) => (
                <button key={i} onClick={() => nav.sheet({
                  title: e.label, sub: `${e.day} · ${e.t}`,
                  items:[
                    { icon:'edit', label:'Редактировать', onClick: () => nav.toast('Редактирование') },
                    { icon:'copy', label:'Дублировать', onClick: () => nav.toast('Дублировано') },
                    '---',
                    { icon:'trash', tone:'danger', label:'Удалить', onClick: () => nav.toast('Удалено') },
                  ]
                })} style={{display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderBottom: i<arr.length-1?'1px solid var(--vt-bone-2)':'none', width:'100%', textAlign:'left', cursor:'pointer'}}>
                  <div style={{width:30, height:30, borderRadius:'var(--r-sm)', background: e.type==='in'?'var(--vt-grass-soft)':'var(--vt-rose-soft)', display:'flex', alignItems:'center', justifyContent:'center', color: e.type==='in'?'var(--vt-grass)':'var(--vt-rose)', flexShrink:0}}>
                    <Icon name={e.type === 'in' ? 'arrow-d' : 'arrow-u'} size={14} sw={2.2}/>
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:'var(--fs-sm)', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{e.label}</div>
                    <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2, fontFamily:'var(--f-mono)'}}>{e.t}{e.cat ? ` · ${catLabel(e.cat)}` : ''}</div>
                  </div>
                  <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-base)', color: e.type==='in'?'var(--vt-grass)':'var(--vt-rose)'}}>
                    {e.type === 'in' ? '+' : '−'}{e.amount} Br
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

        <button onClick={() => nav.toast('Загрузка...')} className="vt-btn vt-btn--ghost vt-btn--full" style={{marginTop:4, gap:6, color:'var(--vt-mute-2)'}}>
          Показать всё за май  <Icon name="chevron-d" size={14}/>
        </button>
      </div>

      <OrgTabBar active="cash"/>
    </>
  );
};

// ---------- OrgCreate ----------
const OrgCreate = () => {
  const nav = useNav();
  const DATE_OPTS = ['Пт · 5 июня', 'Сб · 6 июня', 'Вс · 7 июня', 'Сб · 13 июня', 'Сб · 20 июня'];
  const TIME_OPTS = ['10:00', '11:00', '12:00', '18:00', '19:00', '20:00'];
  const [date, setDate] = React.useState('Сб · 6 июня');
  const [time, setTime] = React.useState('11:00');
  const [type, setType] = React.useState('Основа');
  const [closeBefore, setCloseBefore] = React.useState('за 2 ч');
  const [priceMode, setPriceMode] = React.useState('fixed');
  const [price, setPrice] = React.useState(15);
  const [total, setTotal] = React.useState(180);
  const [main, setMain] = React.useState(14);
  const [name, setName] = React.useState('Среда — основа');

  const [count, setCount] = React.useState(1);
  const create = () => {
    nav.back();
    setTimeout(() => nav.toast(count > 1
      ? `Создана серия · ${trainings(count)} · −${count} credits`
      : `Создано · «${name}» · −1 credit`), 80);
  };

  return (
    <>
      <MiniHeader title="Новая тренировка" onBack
        right={<button onClick={create} style={{fontSize:'var(--fs-base)', fontWeight:600, color:'var(--vt-flame-ink)'}}>{count > 1 ? `Создать ${count}` : 'Создать'}</button>}
      />

      <div className="vt-phone__body" style={{padding:'8px 16px 20px'}}>
        <div style={{padding:'4px 4px 14px'}}>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', display:'flex', gap:6, alignItems:'center'}}>
            <Icon name="ticket" size={12}/> <span>{count > 32 ? <>Нужно <b style={{color:'var(--vt-ink)'}}>{count} credits</b>, на балансе 32</> : <>Будет списано <b style={{color:'var(--vt-ink)'}}>{count} {plural(count, 'credit', 'credits', 'credits')}</b>. Останется {32 - count}.</>}</span>
          </div>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          <div>
            <label className="vt-label">Название</label>
            <input className="vt-field" value={name} onChange={(e) => setName(e.target.value)}/>
          </div>

          <div>
            <label className="vt-label">Шаблон</label>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6}}>
              {['Основа','Открытая','Микст'].map((t) => (
                <button key={t} onClick={() => setType(t)} className="vt-btn vt-btn--sm" style={{
                  background: type===t ? 'var(--vt-ink)' : 'var(--vt-ctl)',
                  color: type===t ? 'var(--vt-paper)' : 'var(--vt-ink)',
                  fontWeight:600, transition:'all .12s'
                }}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:10}}>
            <button onClick={() => nav.sheet({ title:'Дата', items: DATE_OPTS.map(d => ({ radio: d === date, label: d, onClick: () => setDate(d) })) })} style={{textAlign:'left', cursor:'pointer'}}>
              <label className="vt-label">Дата</label>
              <div className="vt-field" style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
                <Icon name="calendar" size={14}/> {count > 1 ? `С ${date.charAt(0).toLowerCase()}${date.slice(1)}` : date}
              </div>
            </button>
            <button onClick={() => nav.sheet({ title:'Время', items: TIME_OPTS.map(t => ({ radio: t === time, label: t, onClick: () => setTime(t) })) })} style={{textAlign:'left', cursor:'pointer'}}>
              <label className="vt-label">Время</label>
              <div className="vt-field" style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
                <Icon name="clock" size={14}/> {time}
              </div>
            </button>
          </div>

          <RecurrenceBlock onCount={setCount}/>

          <button onClick={() => nav.sheet({
            title:'Зал', items:[
              { check:true, icon:'pin', label:'Школа №24, малый зал', sub:'15 Br за час' },
              { icon:'pin', label:'СК «Заслонова»', sub:'20 Br за час' },
              '---',
              { icon:'plus', label:'Добавить зал', onClick: () => nav.toast('Новый зал — в веб-кабинете, раздел «Залы»') },
            ]
          })} style={{textAlign:'left', cursor:'pointer', display:'block', width:'100%'}}>
            <label className="vt-label">Зал</label>
            <div className="vt-field" style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
              <Icon name="pin" size={14}/> Школа №24, малый зал
              <Icon name="chevron-d" size={14} style={{marginLeft:'auto'}}/>
            </div>
          </button>

          <div>
            <label className="vt-label">Основной состав</label>
            <div className="vt-card" style={{padding:'12px 14px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <div style={{fontSize:'var(--fs-sm)'}}>Количество мест</div>
                  <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2}}>Сверх лимита — лист ожидания</div>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <button onClick={() => setMain(m => Math.max(2, m - 1))} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'4px 8px'}}>−</button>
                  <span className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-md)', width:28, textAlign:'center'}}>{main}</span>
                  <button onClick={() => setMain(m => m + 1)} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'4px 8px'}}>+</button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="vt-label">Тип оплаты</label>
            <div style={{display:'flex', gap:6}}>
              {[['fixed','Фикс. цена'],['split','Делим сумму']].map(([v,l]) => (
                <button key={v} onClick={() => setPriceMode(v)} className="vt-btn vt-btn--sm" style={{
                  flex:1, background:priceMode===v?'var(--vt-ink)':'var(--vt-ctl)',
                  color:priceMode===v?'var(--vt-paper)':'var(--vt-ink)', fontWeight:600, transition:'all .12s'
                }}>{l}</button>
              ))}
            </div>
          </div>

          {priceMode === 'fixed' ? (
            <div>
              <label className="vt-label">Цена за место</label>
              <div style={{display:'flex', gap:8}}>
                <input className="vt-field" value={price} onChange={e=>setPrice(+e.target.value||0)} style={{fontFamily:'var(--f-mono)', fontWeight:600}}/>
                <div className="vt-field" style={{width:80, display:'flex', alignItems:'center', justifyContent:'center'}}>BYN</div>
              </div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:6}}>При полном составе — {price*main} Br. Списание абонемента = 1 сессия.</div>
            </div>
          ) : (
            <div>
              <label className="vt-label">Общая сумма к сбору</label>
              <div style={{display:'flex', gap:8}}>
                <input className="vt-field" value={total} onChange={e=>setTotal(+e.target.value||0)} style={{fontFamily:'var(--f-mono)', fontWeight:600}}/>
                <div className="vt-field" style={{width:80, display:'flex', alignItems:'center', justifyContent:'center'}}>BYN</div>
              </div>
              <div style={{marginTop:10, padding:'12px 12px', borderRadius:'var(--r-chip)', background:'var(--vt-amber-soft)'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', fontSize:'var(--fs-sm)'}}>
                  <span style={{color:'var(--vt-ink-3)'}}>Прогноз за место</span>
                  <span className="vt-mono" style={{fontWeight:700}}>{(total/main).toFixed(2).replace('.', ',')} Br</span>
                </div>
                <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:6, lineHeight:1.45}}>
                  Точная сумма распределится после закрытия записи. Абонементы в этом режиме не работают.
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="vt-label">Запись закрывается</label>
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
              {['за 1 ч', 'за 2 ч', 'за 6 ч', 'за 24 ч'].map((t) => (
                <button key={t} onClick={() => setCloseBefore(t)} className="vt-btn vt-btn--sm" style={{
                  background: closeBefore===t ? 'var(--vt-ink)' : 'transparent',
                  color: closeBefore===t ? 'var(--vt-paper)' : 'var(--vt-ink)',
                  border: '1px solid var(--vt-bone-2)',
                  transition:'all .12s'
                }}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

Object.assign(window, { OrgHome, OrgEvent, OrgPayments, OrgLedger, OrgCreate });
