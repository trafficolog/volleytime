// screens-player.jsx — Telegram Mini App, игрок · interactive

// ---------- PlayerHome ----------
const PlayerHome = () => {
  const nav = useNav();
  const ds = useDataState();
  const events = ds === 'empty' ? [] : PLAYER_EVENTS;

  const switchOrg = () => nav.sheet({
    title:'Группы',
    items:[
      { org:true, radio:true, logo:LOGO_URL, label:'VolleyTime Минск', sub:'14 игроков' },
      { org:true, radio:false, label:'МинскВолей · Воскресные', sub:'9 игроков', onClick: () => nav.toast('Переключено на «МинскВолей»') },
      '---',
      { icon:'link', label:'Вступить по ссылке', onClick: () => nav.push('onboard') },
      { icon:'plus', label:'Создать группу', onClick: () => nav.push('org-new') },
    ],
  });

  const next = events.find(e => e.joined) || events[0] || PLAYER_EVENTS[0];
  const rest = events.filter(e => e !== next);

  return (
    <>
      {/* Header — org switch + notifications */}
      <div style={{padding:'4px 16px 0', display:'flex', alignItems:'center', gap:12}}>
        <button onClick={switchOrg} style={{display:'flex', alignItems:'center', gap:12, flex:1, minWidth:0, textAlign:'left', cursor:'pointer'}}>
          <span className="vt-avi vt-avi--brand" style={{width:40, height:40, borderRadius:'var(--r-field)', flexShrink:0, background:`var(--vt-bone) url(${LOGO_URL}) center/70% no-repeat`}}></span>
          <div style={{minWidth:0, flex:1}}>
            <div style={{fontSize:'var(--fs-md)', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'flex', alignItems:'center', gap:4}}>
              VolleyTime Минск <Icon name="chevron-d" size={14} stroke="var(--vt-icon-idle)"/>
            </div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>14 игроков</div>
          </div>
        </button>
        <button onClick={() => nav.push('notifications')} className="vt-btn vt-btn--ghost" style={{width:44, height:44, padding:0, flexShrink:0, position:'relative'}}>
          <Icon name="bell" size={18}/>
          {hasUnread(ds) && <span style={{position:'absolute', top:11, right:12, width:8, height:8, borderRadius:'var(--r-pill)', background:'var(--vt-orange)', boxShadow:'0 0 0 2px var(--vt-bone)'}}/>}
        </button>
      </div>

      {ds === 'empty' ? (
        <div className="vt-phone__body" style={{padding:'8px 16px 16px'}}>
          <EmptyState icon="calendar" title="Тренировок пока нет"
            body="Организатор ещё не опубликовал расписание. Как только появится событие, пришлём уведомление в бот."
            action="Включить уведомления" onAction={() => nav.toast('Уведомления включены')}/>
        </div>
      ) : (
      <div className="vt-phone__body" style={{padding:'20px 16px 16px'}}>
        <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>Привет, Артём</div>
        <h2 style={{fontSize:'var(--fs-4xl)', marginTop:4}}>Ближайшая игра</h2>

        {/* Bento: hero + two metric tiles */}
        <div style={{display:'grid', gridTemplateColumns:'1.3fr 1fr', gridTemplateRows:'1fr 1fr', gap:12, marginTop:16}}>
          <button onClick={() => nav.push('event', { event: next })} className="vt-card vt-card--hero" style={{gridRow:'span 2', padding:18, display:'flex', flexDirection:'column', textAlign:'left', cursor:'pointer', color:'var(--vt-on-hero)'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:6}}>
              <div className="vt-cap" style={{opacity:.72}}>{next.day} · {next.date}</div>
              <span style={{display:'flex', alignItems:'center', gap:4}}>
                <MyChip e={next} onDark/>
                <Icon name="chevron-r" size={16} stroke="var(--vt-on-hero-2)" sw={2.2}/>
              </span>
            </div>
            <div className="vt-mono" style={{fontSize:'var(--fs-6xl)', fontWeight:700, lineHeight:.9, marginTop:12}}>{next.time.split(' ')[0]}</div>
            <div style={{fontSize:'var(--fs-base)', fontWeight:600, marginTop:8}}>{next.title}</div>
            <div style={{fontSize:'var(--fs-xs)', opacity:.75, marginTop:2}}>{next.venue}</div>
            <div style={{marginTop:'auto', paddingTop:16}}>
              <div style={{height:6, borderRadius:'var(--r-pill)', background:'var(--vt-on-hero-line)', overflow:'hidden'}}>
                <i style={{display:'block', height:'100%', width:`${next.meterPct}%`, background: meterTintOnDark(next.meterPct), borderRadius:'var(--r-pill)'}}/>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:8, fontSize:'var(--fs-xs)'}}>
                <span style={{opacity:.75}}>{eventStateOf(next) || 'занято'}</span>
                <span className="vt-mono" style={{fontSize:'var(--fs-md)', fontWeight:700}}>{isFull(next) ? 'мест нет' : next.main}</span>
              </div>
            </div>
          </button>
          <button onClick={() => nav.reset('subs')} className="vt-card vt-card--warm" style={{padding:16, textAlign:'left', cursor:'pointer', display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <Icon name="ticket" size={18} stroke="var(--vt-orange-ink)"/>
              <Icon name="chevron-r" size={16} stroke="var(--vt-orange-ink)" sw={2.2}/>
            </div>
            <div>
              <div style={{display:'flex', alignItems:'baseline', gap:6}}>
                <span className="vt-mono" style={{fontSize:'var(--fs-4xl)', fontWeight:700, lineHeight:1}}>5</span>
                <span style={{fontSize:'var(--fs-sm)', color:'var(--vt-ink-3)'}}>из 8</span>
              </div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:4}}>сессий осталось</div>
            </div>
          </button>
          <button onClick={() => nav.push('bookings')} className="vt-card" style={{padding:16, textAlign:'left', cursor:'pointer', display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <Icon name="calendar" size={18} stroke="var(--vt-ink-3)"/>
              <Icon name="chevron-r" size={16} stroke="var(--vt-icon-idle)" sw={2.2}/>
            </div>
            <div>
              <div className="vt-mono" style={{fontSize:'var(--fs-4xl)', fontWeight:700, lineHeight:1}}>{events.filter(e => e.joined).length}</div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:4}}>мои записи</div>
            </div>
          </button>
        </div>

        {/* Schedule — rows without surfaces */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:28}}>
          <h2 style={{fontSize:'var(--fs-xl)'}}>Расписание</h2>
          <button onClick={() => nav.push('schedule')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{gap:4}}>Смотреть все <Icon name="chevron-r" size={14}/></button>
        </div>
        <div style={{marginTop:4}}>
          {rest.map((e, i) => {
            const st = eventStateOf(e);
            return (
              <button key={e.id} onClick={() => nav.push('event', { event: e })} style={{
                display:'flex', alignItems:'center', gap:16, width:'100%', textAlign:'left', cursor:'pointer',
                padding:'12px 0', boxShadow: i ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none'
              }}>
                <div style={{width:44, textAlign:'center', flexShrink:0}}>
                  <div className="vt-mono" style={{fontSize:'var(--fs-3xl)', fontWeight:700, lineHeight:1}}>{e.date.split(' ')[0]}</div>
                  <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:4}}>{e.day}</div>
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:'var(--fs-md)', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{e.title}</div>
                  <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>
                    {e.time.split(' ')[0]} · {e.venue}{st ? <> · <span style={{color:'var(--vt-ink-3)', fontWeight:600}}>{st.toLowerCase()}</span></> : null}
                  </div>
                  {e.priceMode === 'split' && (
                    <div className="vt-mono" style={{fontSize:'var(--fs-sm)', marginTop:4, color: e.status === 'closed' ? 'var(--vt-ink)' : 'var(--vt-mute-2)'}}>
                      {e.status === 'closed' ? '' : '≈ '}{byn(e.total/e.joinedCount)} за место
                    </div>
                  )}
                </div>
                <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0}}>
                  <MyChip e={e}/>
                  <SeatsMini e={e}/>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      )}
      <TabBar active="home"/>
    </>
  );
};

// ---------- PlayerEvent ----------
const PlayerEvent = () => {
  const nav = useNav();
  const online = canBook(useDataState());
  const e = nav.data.event || { title:'Основа · Среда', date:'28 мая', time:'20:00–22:00', venue:'Школа №24', hall:'малый зал', joined:true };
  const isJoined = e.joined === true;
  const isSplit = e.priceMode === 'split';
  const isClosed = e.status === 'closed';
  const headCount = e.joinedCount || (e.main ? parseInt(e.main, 10) : 12);
  const perHead = isSplit ? e.total / headCount : 15;
  const mySeats = e.mySeats || 1;   // сколько мест держит сам зритель
  const slots = {
    main: buildRoster(headCount, { isSplit }),
    waitlist: isClosed ? [] : PEOPLE.slice(headCount, headCount + 2),
  };

  const cancel = () => nav.alert({
    title: 'Отменить запись?',
    body: 'Сессия абонемента вернётся. Место уйдёт первому из листа ожидания.',
    confirm: 'Отменить запись',
    danger: true,
    onConfirm: () => { nav.back(); setTimeout(() => nav.toast('Запись отменена · +1 на абонемент'), 80); }
  });

  const moreItems = [
    { icon:'send', label:'Поделиться в Telegram', onClick: () => nav.toast('Ссылка скопирована') },
    { icon:'calendar', label:'Добавить в календарь', onClick: () => nav.toast('Скачан .ics файл') },
    { icon:'pin', label:'Открыть на карте', onClick: () => nav.toast('Открываем maps.google.com') },
    '---',
    { icon:'close', tone:'danger',
      label: isJoined ? 'Отменить запись' : e.inWaitlist ? 'Выйти из листа ожидания' : 'Скрыть событие',
      onClick: isJoined ? cancel
        : e.inWaitlist ? () => nav.alert({ title:'Выйти из листа ожидания?', body:`Вы ${e.waitPos}-й в очереди. Место в очереди не сохранится.`, confirm:'Выйти', danger:true, onConfirm: () => nav.toast('Вы вышли из листа ожидания') })
        : () => nav.toast('Скрыто из списка') },
  ];

  return (
    <>
      <MiniHeader
        title={e.title || 'Основа · Среда'}
        sub={`${e.date || '28 мая'} · ${e.time || '20:00–22:00'}`}
        onBack
        right={<ActionMore items={moreItems} title={e.title || 'Событие'} sub={`${e.date || '28 мая'} · ${e.time || '20:00'}`}/>}
      />

      <div className="vt-phone__body">
        <div style={{padding:'4px 16px 0'}}>
          <div className="vt-card" style={{padding:16}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
              <div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', display:'flex', alignItems:'center', gap:6}}>
                  <Icon name="pin" size={12}/> {e.venue}{e.hall ? `, ${e.hall}` : ''}
                </div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4, display:'flex', alignItems:'center', gap:6}}>
                  <Icon name="clock" size={12}/> {isClosed ? 'Запись закрыта · состав финальный' : 'Запись закроется через 1 д 4 ч'}
                </div>
              </div>
              <div style={{display:'flex', gap:4, flexWrap:'wrap', justifyContent:'flex-end'}}>
                <MyChip e={e}/><StateChip e={e}/>
              </div>
            </div>
            <div className="vt-divider" style={{margin:'12px 0'}}/>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10}}>
              <div>
                <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{isSplit ? (isClosed ? 'За место' : 'Прогноз') : 'Цена'}</div>
                <div className="vt-mono" style={{fontWeight:600, fontSize:'var(--fs-md)', marginTop:4}}>
                  {isSplit ? (isClosed ? byn(perHead) : `≈ ${byn(perHead)}`) : '15,00 Br'}
                </div>
              </div>
              <div>
                <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Уровень</div>
                <div style={{fontWeight:600, fontSize:'var(--fs-base)', marginTop:4}}>B / A</div>
              </div>
              <div>
                <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Длительность</div>
                <div style={{fontWeight:600, fontSize:'var(--fs-base)', marginTop:4}}>2 ч</div>
              </div>
            </div>
          </div>
        </div>

        {isSplit && (
          <div style={{padding:'12px 16px 0'}}>
            <div className="vt-card" style={{padding:16, borderColor: isClosed ? 'var(--vt-grass)' : 'var(--vt-stroke-2)'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{isClosed ? 'Итоговый расчёт' : 'Делим общую сумму'}</div>
                {isClosed
                  ? <span className="vt-chip vt-chip--grass vt-chip--dot" style={{fontSize:'var(--fs-2xs)'}}>зафиксировано</span>
                  : <span className="vt-chip vt-chip--amber" style={{fontSize:'var(--fs-2xs)'}}>предварительно</span>}
              </div>

              <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:10}}>
                <span className="vt-mono" style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-3xl)', lineHeight:1}}>
                  {isClosed ? byn(perHead) : `≈ ${byn(perHead)}`}
                </span>
                <span style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>за место</span>
              </div>

              <div className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:8}}>
                {byn(e.total)} ÷ {headCount} {headCount < 5 ? 'места' : 'мест'}
              </div>

              {!isClosed && (
                <>
                  <div className="vt-divider" style={{margin:'14px 0'}}/>
                  <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:8}}>Как меняется цена</div>
                  <div style={{display:'flex', flexDirection:'column', gap:6}}>
                    {[headCount, headCount + 2, headCount + 4].map((n, i) => (
                      <div key={n} style={{display:'flex', alignItems:'center', gap:10}}>
                        <span className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', width:56}}>{n} мест</span>
                        <div className="vt-meter" style={{flex:1}}>
                          <i style={{width:`${(headCount/n)*100}%`, background: i === 0 ? 'var(--vt-flame)' : 'var(--vt-stroke-2)'}}/>
                        </div>
                        <span className="vt-mono" style={{fontSize:'var(--fs-xs)', fontWeight: i === 0 ? 700 : 500, color: i === 0 ? 'var(--vt-ink)' : 'var(--vt-mute-2)', width:64, textAlign:'right'}}>
                          {byn(e.total/n)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:12, lineHeight:1.45}}>
                    Чем больше мест займут, тем дешевле каждое. Точная сумма зафиксируется при закрытии записи.
                  </div>
                </>
              )}

              {isClosed && (
                <div style={{marginTop:14, padding:'12px 14px', borderRadius:'var(--r-chip)', background:'var(--vt-grass-soft)', display:'flex', gap:10, alignItems:'flex-start'}}>
                  <Icon name="check" size={14} stroke="var(--vt-grass-ink)" sw={2.2}/>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', lineHeight:1.45}}>
                    Запись закрыта, состав больше не меняется — с вас <b style={{color:'var(--vt-ink)'}}>{byn(perHead * mySeats)}</b>{mySeats > 1 ? ` за ${mySeats} места` : ''}. Организатор подтвердит оплату после получения.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{padding:'16px 16px 0'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Основной состав</div>
            <span className="vt-mono" style={{fontSize:'var(--fs-xs)', fontWeight:600}}>{e.main || '12 / 14'}</span>
          </div>
          <div className="vt-meter"><i style={{width:`${e.meterPct || 86}%`, background: meterTint(e.meterPct || 86)}}/></div>
          {slots.main.some(p => seatsOf(p) > 1) && (
            <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:8, display:'flex', gap:6, alignItems:'center'}}>
              <Icon name="users" size={12} stroke="var(--vt-icon-idle)"/>
              <span>{slots.main.length} игроков заняли {headCount} мест — кто-то приводит гостей</span>
            </div>
          )}

          <div style={{marginTop:14, display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:6}}>
            {slots.main.map((p, i) => (
              <button key={i} onClick={() => nav.toast(seatsOf(p) > 1 ? `${p.name} · ${seatsOf(p)} места` : `${p.name} · уровень ${p.level}`)} style={{display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:'var(--r-sm)', background:'var(--vt-ctl)', textAlign:'left', cursor:'pointer'}}>
                <Avi name={p.name} init={p.init} tag={p.tag} size="sm"/>
                <div style={{flex:1, minWidth:0, fontSize:'var(--fs-sm)', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{p.name}</div>
                {seatsOf(p) > 1
                  ? <span className="vt-chip vt-chip--flame" style={{fontSize:'var(--fs-2xs)', padding:'2px 6px'}}>+{seatsOf(p)-1}</span>
                  : <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{p.level}</span>}
              </button>
            ))}
          </div>

          {slots.waitlist.length > 0 && (
            <>
              <div style={{marginTop:18, display:'flex', justifyContent:'space-between'}}>
                <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Лист ожидания</div>
                <span className="vt-mono" style={{fontSize:'var(--fs-xs)', fontWeight:600}}>{slots.waitlist.length}</span>
              </div>
              <div style={{marginTop:8, display:'flex', flexDirection:'column', gap:6}}>
                {slots.waitlist.map((p, i) => (
                  <div key={i} style={{display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:'var(--r-sm)', background:'var(--vt-bone-2)'}}>
                    <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', width:14}}>{i+1}</span>
                    <Avi name={p.name} init={p.init} tag={p.tag} size="sm"/>
                    <div style={{flex:1, fontSize:'var(--fs-sm)', fontWeight:500}}>{p.name}</div>
                    <span className="vt-chip" style={{fontSize:'var(--fs-2xs)', padding:'2px 6px'}}>Войдёт при отмене</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{padding:'18px 16px 20px'}}>
          {isClosed ? (
            <div className="vt-card" style={{padding:'14px 16px', display:'flex', gap:10, alignItems:'center'}}>
              <Icon name="clock" size={17} stroke="var(--vt-icon-idle)"/>
              <div style={{flex:1}}>
                <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>Запись закрыта</div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>
                  {isSplit ? `Состав зафиксирован, с вас ${byn(perHead * mySeats)}${mySeats > 1 ? ` за ${mySeats} места` : ''}` : 'Отменить запись уже нельзя'}
                </div>
              </div>
            </div>
          ) : isJoined ? (
            <button onClick={cancel} className="vt-btn vt-btn--ghost vt-btn--full vt-btn--lg" style={{justifyContent:'space-between'}}>
              <span>Отменить запись</span>
              <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>
                {isSplit ? '·  цена вырастет остальным' : '·  +1 на абонемент'}
              </span>
            </button>
          ) : e.inWaitlist ? (
            <button onClick={() => nav.alert({
              title:'Выйти из листа ожидания?', body:`Вы ${e.waitPos}-й в очереди на «${e.title}». Место в очереди не сохранится.`,
              confirm:'Выйти', danger:true, onConfirm: () => { nav.back(); setTimeout(() => nav.toast('Вы вышли из листа ожидания'), 80); }
            })} className="vt-btn vt-btn--ghost vt-btn--full vt-btn--lg" style={{justifyContent:'space-between'}}>
              <span>Выйти из листа ожидания</span>
              <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>·  вы {e.waitPos}-й</span>
            </button>
          ) : (
            <button onClick={() => online && nav.push('book', { event: e })} disabled={!online} className="vt-btn vt-btn--primary vt-btn--full vt-btn--lg" style={{justifyContent:'space-between'}}>
              <span>{e.status === 'full' ? 'Встать в лист ожидания' : 'Записаться'}</span>
              <span className="vt-mono" style={{opacity:.85}}>
                {e.status === 'full' ? 'без оплаты' : isSplit ? `≈ ${byn(perHead)}` : '15,00 Br'}
              </span>
            </button>
          )}
          {!online && <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', textAlign:'center', marginTop:8}}>{OFFLINE_REASON}</div>}
        </div>
      </div>

      <TabBar active="home"/>
    </>
  );
};

// Replace the empty ActionMore use above with a proper bound version
// (kept for reference)

// ---------- PlayerBook ----------
const PlayerBook = () => {
  const nav = useNav();
  const online = canBook(useDataState());
  const e = nav.data.event || { title:'Открытая игра', date:'Пт 30 мая', venue:'СК «Заслонова»', time:'19:30–22:00', main:'9 / 14', meterPct:64 };
  const [method, setMethod] = React.useState('sub');
  const [seats, setSeats] = React.useState(1);
  // из настроек группы
  const subsEnabled = true;
  const maxSeats = 3;
  const priceMode = e.priceMode || 'fixed';   // 'fixed' | 'split'
  const unit = 15;
  const headCount = e.joinedCount || 12;
  const forecast = priceMode === 'split' ? e.total / headCount : unit;
  const perSeat = forecast;
  const isWaitlist = e.status === 'full';

  const opts = [
    ...(subsEnabled && priceMode === 'fixed'
      ? [{ id:'sub', label:'С абонемента', sub:'«8 сессий», осталось 5. До 12 июня.', tag:`−${seats} сесс.` }]
      : []),
    { id:'cash', label:'Наличными организатору', sub:'Подтверждение от организатора после оплаты', tag:byn(perSeat*seats) },
    { id:'transfer', label:'Переводом на карту', sub:'Belarusbank · *3214 · покажу реквизиты', tag:byn(perSeat*seats) },
  ];

  React.useEffect(() => {
    if (!opts.some(o => o.id === method)) setMethod(opts[0].id);
  }, [priceMode, subsEnabled]);

  const submit = () => {
    nav.back();
    const seatTxt = seats > 1 ? ` · ${seats} места` : '';
    setTimeout(() => nav.toast(
      isWaitlist ? `В листе ожидания${seatTxt} · уведомим, когда освободится место`
      : method === 'sub' ? `Записаны${seatTxt} · −${seats} сесс.`
      : priceMode === 'split' ? `Записаны${seatTxt} · сумма после закрытия записи`
      : `Записаны${seatTxt} · ожидает подтверждения оплаты`
    ), 80);
  };

  return (
    <>
      <MiniHeader title={isWaitlist ? 'Лист ожидания' : 'Запись'} sub={`${e.title} · ${e.date}`} onBack />

      <div className="vt-phone__body" style={{padding:'8px 16px 16px'}}>
        <div className="vt-card" style={{padding:14}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
            <div>
              <div style={{fontFamily:'var(--f-display)', fontWeight:600, fontSize:'var(--fs-lg)'}}>{e.title}</div>
              <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>{e.venue} · {e.time}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-xl)'}}>{priceMode === 'split' && !isWaitlist ? `≈ ${byn(perSeat)}` : byn(perSeat)}</div>
              <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{isWaitlist ? 'если получите место' : priceMode === 'split' ? 'прогноз' : 'цена сессии'}</div>
            </div>
          </div>
          <div style={{marginTop:10, display:'flex', alignItems:'center', gap:8}}>
            <div className="vt-meter" style={{flex:1}}><i style={{width:`${e.meterPct || 64}%`}}/></div>
            <span className="vt-mono" style={{fontSize:'var(--fs-xs)', fontWeight:600}}>{e.main}</span>
          </div>
        </div>

        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'18px 4px 10px'}}>{isWaitlist ? 'Сколько мест резервируете' : 'Сколько мест'}</div>
        <div className="vt-card" style={{padding:'14px 16px'}}>
          <div style={{display:'flex', alignItems:'center', gap:14}}>
            <div style={{flex:1}}>
              <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>{seats === 1 ? 'Только я' : `Я и ещё ${seats-1}`}</div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>Можно занять до {maxSeats} мест</div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <button onClick={() => setSeats(s => Math.max(1, s-1))} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'6px 14px', opacity: seats<=1?0.4:1}}>−</button>
              <span className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-lg)', width:24, textAlign:'center'}}>{seats}</span>
              <button onClick={() => setSeats(s => Math.min(maxSeats, s+1))} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'6px 14px', opacity: seats>=maxSeats?0.4:1}}>+</button>
            </div>
          </div>
          {seats > 1 && (
            <div style={{marginTop:12, paddingTop:12, borderTop:'1px solid var(--vt-stroke)', display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
              <span style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>{isWaitlist ? 'Спишется при получении мест' : 'За все места'}</span>
              <span className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-md)'}}>
                {method === 'sub' ? `−${seats} сесс.` : byn(perSeat*seats)}
              </span>
            </div>
          )}
        </div>

        {isWaitlist ? (
          <>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'18px 4px 10px'}}>Как это работает</div>
            <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
              {[
                ['users', 'Вы встанете в очередь', 'Сейчас в листе ожидания 2 человека — вы будете третьим.'],
                ['bell', 'Придёт уведомление', 'Как только кто-то отменит запись, место предложат первому в очереди.'],
                ['clock', 'Подтвердить за 30 минут', 'Не успеете — место уйдёт следующему, а вы останетесь в очереди.'],
                ['wallet', 'Оплата — потом', 'Сейчас ничего не списываем. Способ выберете, когда получите место.'],
              ].map(([ic, t, s], i, a) => (
                <div key={i} style={{display:'flex', gap:12, padding:'12px 14px', borderBottom: i<a.length-1?'1px solid var(--vt-stroke)':'none', alignItems:'flex-start'}}>
                  <Icon name={ic} size={16} stroke="var(--vt-icon-idle)"/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{t}</div>
                    <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2, lineHeight:1.4}}>{s}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'18px 4px 10px'}}>Как оплатите</div>

        {opts.map(o => {
          const sel = method === o.id;
          return (
            <button key={o.id} onClick={() => setMethod(o.id)} className="vt-card" style={{
              display:'flex', alignItems:'center', gap:12, padding:14, marginBottom:10, width:'100%', textAlign:'left', cursor:'pointer',
              borderColor: sel ? 'var(--vt-flame)' : 'var(--vt-stroke)',
              boxShadow: sel ? '0 0 0 2px var(--vt-ring)' : 'none',
              transition: 'all .12s'
            }}>
              <span style={{width:18, height:18, borderRadius:'var(--r-pill)', border:`${sel?5:2}px solid ${sel?'var(--vt-flame)':'var(--vt-stroke)'}`, flexShrink:0, transition:'border .12s'}}/>
              <div style={{flex:1}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                  <div style={{fontWeight:600, fontSize:'var(--fs-base)'}}>{o.label}</div>
                  <div className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{o.tag}</div>
                </div>
                <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>{o.sub}</div>
              </div>
            </button>
          );
        })}

        <div style={{marginTop:14, padding:'10px 12px', background:'var(--vt-bone)', borderRadius:'var(--r-chip)', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', display:'flex', gap:8}}>
          <Icon name="bell" size={14} stroke="var(--vt-mute-2)"/>
          <span>Бронь сохранится 15 мин. Если оплата не подтверждена — место уйдёт первому из листа ожидания.</span>
        </div>

        {priceMode === 'split' && (
          <div style={{marginTop:10, padding:'12px 14px', background:'var(--vt-amber-soft)', borderRadius:'var(--r-chip)', fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', display:'flex', gap:8, lineHeight:1.45}}>
            <Icon name="clock" size={14} stroke="var(--vt-amber-ink)"/>
            <span>Цена предварительная: делим {byn(e.total || 180)} на всех записавшихся. Сейчас их {headCount} — выйдет по {byn(perSeat)}. Точная сумма придёт после закрытия записи.</span>
          </div>
        )}
          </>
        )}
      </div>

      <div style={{padding:'12px 16px', borderTop:'1px solid var(--vt-stroke)', background:'var(--vt-paper)'}}>
        {!online && <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', textAlign:'center', marginBottom:8}}>{OFFLINE_REASON}</div>}
        <button onClick={() => online && submit()} disabled={!online} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full" style={{justifyContent:'space-between'}}>
          <span>{isWaitlist
            ? (seats > 1 ? `В лист ожидания · ${seats} места` : 'Встать в лист ожидания')
            : (seats > 1 ? `Записаться · ${seats} места` : 'Записаться')}</span>
          <span className="vt-mono" style={{opacity:.85}}>
            {isWaitlist ? 'без оплаты'
              : method === 'sub' ? `−${seats} сесс.`
              : priceMode === 'split' ? `≈ ${byn(perSeat*seats)}` : byn(perSeat*seats)}
          </span>
        </button>
      </div>
    </>
  );
};

// ---------- PlayerSubs ----------
const PlayerSubs = () => {
  const nav = useNav();
  return (
    <>
      <MiniHeader title="Мои абонементы" right={<ActionMore items={[
        { icon:'send', label:'Поделиться абонементом', onClick: () => nav.toast('Передача абонемента — Phase 11') },
        { icon:'edit', label:'Уровень и амплуа', onClick: () => nav.reset('profile') },
      ]} title="Действия"/>}/>

      <div className="vt-phone__body" style={{padding:'8px 16px 16px'}}>
        <div className="vt-card vt-card--hero" style={{padding:18, position:'relative', overflow:'hidden'}}>
          <div style={{position:'absolute', right:-30, top:-30, width:140, height:140, borderRadius:'50%', background:'var(--vt-orange)', opacity:0.9}}/>
          <div style={{position:'relative'}}>
            <div className="vt-cap" style={{opacity:0.6}}>активный</div>
            <div style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-2xl)', marginTop:6}}>8 сессий</div>
            <div style={{marginTop:14, display:'flex', alignItems:'baseline', gap:8}}>
              <div className="vt-mono" style={{fontSize:'var(--fs-4xl)', fontWeight:600, lineHeight:1}}>5</div>
              <div style={{opacity:0.7, fontSize:'var(--fs-sm)'}}>осталось из 8</div>
            </div>
            <div style={{marginTop:14, display:'flex', alignItems:'center', gap:6}}>
              {Array.from({length:8}).map((_,i) => (
                <span key={i} style={{flex:1, height:6, borderRadius:'var(--r-pill)', background: i<3 ? 'var(--vt-on-hero-line)' : 'var(--vt-amber)'}}/>
              ))}
            </div>
            <div style={{marginTop:16, display:'flex', justifyContent:'space-between', fontSize:'var(--fs-xs)'}}>
              <span style={{opacity:0.7}}>До 12 июня · 18 дней</span>
              <span style={{opacity:0.7, fontFamily:'var(--f-mono)'}}>#SUB-0143</span>
            </div>
          </div>
        </div>

        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'20px 4px 8px'}}>История</div>
        <div className="vt-card" style={{padding:14, filter:'grayscale(1)'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
            <div>
              <div style={{fontFamily:'var(--f-display)', fontWeight:600, fontSize:'var(--fs-md)'}}>4 сессии</div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>11 апр — 5 мая</div>
            </div>
            <span className="vt-chip vt-chip--dot">Завершён</span>
          </div>
          <div style={{marginTop:10, display:'flex', alignItems:'center', gap:6}}>
            {Array.from({length:4}).map((_,i) => (
              <span key={i} style={{flex:1, height:6, borderRadius:'var(--r-pill)', background:'var(--vt-stroke-2)'}}/>
            ))}
          </div>
        </div>

        <button onClick={() => nav.push('buy')} className="vt-btn vt-btn--ink vt-btn--full vt-btn--lg" style={{marginTop:16, justifyContent:'space-between'}}>
          <span>Купить новый абонемент</span>
          <Icon name="arrow-r" size={16}/>
        </button>

        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'22px 4px 8px'}}>Последние списания</div>
        <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
          {[
            ['Среда · Основа', '21 мая', '−1'],
            ['Пятница · Открытая', '23 мая', '−1'],
            ['Воскресенье · Микст', '25 мая', '−1'],
          ].map(([t,d,v], i, arr) => (
            <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', borderBottom: i<arr.length-1?'1px solid var(--vt-stroke)':'none'}}>
              <div>
                <div style={{fontSize:'var(--fs-base)', fontWeight:500}}>{t}</div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{d}</div>
              </div>
              <div className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <TabBar active="subs"/>
    </>
  );
};

// ---------- PlayerBuy ----------
const PlayerBuy = () => {
  const nav = useNav();
  const [plan, setPlan] = React.useState(8);
  const [pay, setPay] = React.useState('cash');

  const plans = [
    { sessions:4,  price:60,  perSess:15, valid:'30 дней' },
    { sessions:8,  price:110, perSess:13.75, valid:'45 дней', popular:true },
    { sessions:12, price:150, perSess:12.50, valid:'60 дней' },
  ];
  const selected = plans.find(p => p.sessions === plan);

  const buy = () => {
    nav.back();
    setTimeout(() => nav.toast(`Куплен абонемент «${plan} сессий» · ${selected.price} Br`), 80);
  };

  return (
    <>
      <MiniHeader title="Купить абонемент" onBack/>

      <div className="vt-phone__body" style={{padding:'8px 16px 16px'}}>
        <div style={{padding:'4px 4px 14px'}}>
          <div style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-xl)'}}>Чем больше — тем дешевле каждая.</div>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:6}}>Списывается автоматически при записи. Сессия возвращается при отмене.</div>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:10}}>
          {plans.map((p) => {
            const sel = plan === p.sessions;
            return (
              <button key={p.sessions} onClick={() => setPlan(p.sessions)} className="vt-card" style={{
                padding:16, display:'flex', alignItems:'center', gap:14, cursor:'pointer',
                borderColor: sel ? 'var(--vt-flame)' : p.popular ? 'var(--vt-ink-3)' : 'var(--vt-stroke)',
                boxShadow: sel ? '0 0 0 2px var(--vt-ring)' : 'none',
                position:'relative', width:'100%', textAlign:'left', transition:'all .12s'
              }}>
                {p.popular && (
                  <span className="vt-chip vt-chip--solid" style={{position:'absolute', top:-10, right:14, fontSize:'var(--fs-2xs)'}}>Популярный</span>
                )}
                <span style={{width:18, height:18, borderRadius:'var(--r-pill)', border:`${sel?5:2}px solid ${sel?'var(--vt-flame)':'var(--vt-stroke)'}`, flexShrink:0, transition:'border .12s'}}/>
                <div style={{flex:1}}>
                  <div style={{display:'flex', alignItems:'baseline', gap:6}}>
                    <span style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-xl)'}}>{p.sessions}</span>
                    <span style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>{p.sessions === 4 ? 'сессии' : 'сессий'}</span>
                  </div>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{p.valid} · {p.perSess.toFixed(2).replace('.', ',')} Br за сессию</div>
                </div>
                <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-lg)'}}>{p.price} Br</div>
              </button>
            );
          })}
        </div>

        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'22px 4px 10px'}}>Способ оплаты</div>
        <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
          {[
            { id:'cash', t:'Наличными организатору', s:'Касса будет обновлена после подтверждения' },
            { id:'transfer', t:'Переводом на карту', s:'Belarusbank · *3214' },
            { id:'online', t:'Картой онлайн', s:'скоро · через bePaid', dis:true },
          ].map((o, i, a) => {
            const sel = pay === o.id;
            return (
              <button
                key={o.id}
                onClick={() => o.dis ? nav.toast('Онлайн-оплата — Phase 12') : setPay(o.id)}
                style={{
                  display:'flex', alignItems:'center', gap:12, padding:'14px 14px',
                  borderBottom:i<a.length-1?'1px solid var(--vt-stroke)':'none',
                  opacity: o.dis?0.45:1, width:'100%', textAlign:'left', cursor:'pointer', background:'transparent'
                }}>
                <span style={{width:18, height:18, borderRadius:'var(--r-pill)', border:`${sel?5:2}px solid ${sel?'var(--vt-flame)':'var(--vt-stroke)'}`, flexShrink:0, transition:'border .12s'}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>{o.t}</div>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{o.s}</div>
                </div>
                {o.dis && <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>Phase 12</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{padding:'12px 16px', borderTop:'1px solid var(--vt-stroke)', background:'var(--vt-paper)'}}>
        <button onClick={buy} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full" style={{justifyContent:'space-between'}}>
          <span>Купить «{plan} сессий»</span>
          <span className="vt-mono">{selected.price} Br</span>
        </button>
      </div>
    </>
  );
};

// ---------- PlayerProfile ----------
const PlayerProfile = () => {
  const nav = useNav();

  const orgMenu = (orgName) => nav.sheet({
    title: orgName,
    items:[
      { icon:'globe', label:'Открыть страницу группы', onClick: () => nav.toast('Открыта страница группы') },
      { icon:'bell', label:'Уведомления', sub:'24 ч и 2 ч', onClick: () => nav.toast('Настройки уведомлений') },
      '---',
      { icon:'logout', tone:'danger', label:'Покинуть группу', onClick: () => nav.toast('Покинули группу') },
    ]
  });

  const profileEdit = () => nav.sheet({
    title:'Профиль',
    items:[
      { icon:'edit', label:'Изменить имя', onClick: () => nav.toast('Редактирование имени') },
      { icon:'star', label:'Уровень и амплуа', onClick: () => nav.toast('B · доигровщик') },
      { icon:'tg', label:'Привязать email', onClick: () => nav.toast('Отправлен код на email') },
    ]
  });

  return (
    <>
      <MiniHeader title="Профиль"/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px'}}>
        <div style={{display:'flex', alignItems:'center', gap:14, padding:'6px 4px 18px'}}>
          <Avi size="lg" name="Артём Кравцов" init="АК" tag="flame"/>
          <div style={{flex:1}}>
            <div style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-lg)', lineHeight:1.1}}>Артём Кравцов</div>
            <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4, display:'flex', alignItems:'center', gap:4}}>
              <Icon name="tg" size={12}/> @artyomk · уровень B
            </div>
          </div>
          <button onClick={profileEdit} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="edit" size={14}/></button>
        </div>

        <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)'}}>
            {[
              ['24', 'тренировок'],
              ['96%', 'посещ.'],
              ['3', 'no-show'],
            ].map(([n, l], i) => (
              <div key={i} style={{padding:'14px 12px', textAlign:'center', borderRight: i<2 ? '1px solid var(--vt-stroke)' : 'none'}}>
                <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-xl)', lineHeight:1}}>{n}</div>
                <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:6}}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'22px 4px 8px'}}>Мои группы</div>
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          <button onClick={() => orgMenu('VolleyTime Минск')} className="vt-card" style={{padding:'12px 14px', display:'flex', alignItems:'center', gap:12, textAlign:'left', cursor:'pointer'}}>
            <span className="vt-avi vt-avi--brand"></span>
            <div style={{flex:1}}>
              <div style={{fontWeight:600, fontSize:'var(--fs-base)'}}>VolleyTime Минск</div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>Игрок · с 18 марта</div>
            </div>
            <span className="vt-chip vt-chip--grass vt-chip--dot">актив.</span>
          </button>
          <button onClick={() => orgMenu('МинскВолей')} className="vt-card" style={{padding:'12px 14px', display:'flex', alignItems:'center', gap:12, filter:'grayscale(1)', textAlign:'left', cursor:'pointer'}}>
            <span className="vt-avi vt-avi--ink">МВ</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:600, fontSize:'var(--fs-base)'}}>МинскВолей · Воскресные</div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>Игрок · с 5 января</div>
            </div>
          </button>
          <button onClick={() => nav.push('onboard')} className="vt-btn vt-btn--ghost vt-btn--full" style={{marginTop:4, justifyContent:'flex-start', gap:10, padding:'12px 14px'}}>
            <Icon name="plus" size={16}/> Вступить по ссылке
          </button>
          <button onClick={() => nav.push('org-new')} className="vt-btn vt-btn--ghost vt-btn--full" style={{justifyContent:'flex-start', gap:10, padding:'12px 14px'}}>
            <Icon name="plus" size={16}/> Создать группу
          </button>
        </div>

        <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'22px 4px 8px'}}>Настройки</div>
        <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
          {[
            ['Мои записи', 'предстоящие и прошедшие', 'calendar', () => nav.push('bookings')],
            ['Напоминания', '24 ч и 2 ч до тренировки', 'bell', () => nav.toast('Настройки уведомлений')],
            ['Уровень и амплуа', 'B · доигровщик', 'star', () => nav.toast('Уровень и амплуа')],
            ['Язык', 'Русский', 'globe', () => nav.sheet({ title:'Язык', items:[
              { check:true, label:'Русский' }, { label:'English' }, { label:'Беларуская' },
            ]})],
            ['Выйти из аккаунта', '', 'logout', () => nav.alert({
              title:'Выйти из аккаунта?', body:'Можно войти заново через тот же Telegram-аккаунт.',
              confirm:'Выйти', danger:true, onConfirm: () => nav.toast('Сессия закрыта')
            })],
          ].map(([t,s,ic, action], i, a) => (
            <button key={i} onClick={action} style={{display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderBottom:i<a.length-1?'1px solid var(--vt-stroke)':'none', width:'100%', textAlign:'left', cursor:'pointer'}}>
              <Icon name={ic} size={16} stroke="var(--vt-mute-2)"/>
              <div style={{flex:1}}>
                <div style={{fontSize:'var(--fs-base)', fontWeight:500}}>{t}</div>
                {s && <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{s}</div>}
              </div>
              <Icon name="chevron-r" size={14} stroke="var(--vt-icon-idle)"/>
            </button>
          ))}
        </div>
      </div>
      <TabBar active="me"/>
    </>
  );
};

// ---------- PlayerOnboard ----------
const PlayerOnboard = () => {
  const nav = useNav();

  const join = () => {
    nav.reset('home');
    setTimeout(() => nav.toast('Добро пожаловать в VolleyTime Минск!'), 80);
  };

  return (
    <>
      <div className="vt-phone__body" style={{padding:'24px 22px', display:'flex', flexDirection:'column'}}>
        <div style={{textAlign:'center', padding:'12px 0 18px'}}>
          <div style={{display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:'var(--r-pill)', background:'var(--vt-bone)', fontSize:'var(--fs-2xs)', fontWeight:600, color:'var(--vt-mute-2)'}}>
            <Icon name="tg" size={11}/>  Приглашение
          </div>
        </div>

        <div className="vt-card" style={{padding:24, textAlign:'center'}}>
          <span className="vt-avi vt-avi--brand vt-avi--lg" style={{width:60, height:60, fontSize:'var(--fs-xl)', marginInline:'auto', display:'flex'}}></span>
          <div style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-xl)', marginTop:14}}>VolleyTime Минск</div>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:6}}>14 человек · тренировки 3 раза в неделю</div>

          <div style={{display:'flex', justifyContent:'center', marginTop:18}}>
            <div className="vt-stack">
              {[0,1,2,3,4].map(i => <Avi key={i} idx={i} size="md"/>)}
              <span className="vt-avi" style={{background:'var(--vt-bone-2)', color:'var(--vt-mute-2)'}}>+9</span>
            </div>
          </div>

          <div className="vt-divider" style={{margin:'20px 0'}}/>

          <div style={{textAlign:'left'}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:6}}>Вас пригласил</div>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <Avi size="sm" name="Иван П." init="ИП" tag="ink"/>
              <div style={{fontSize:'var(--fs-sm)', fontWeight:500}}>Иван Петренко · организатор</div>
            </div>
          </div>
        </div>

        <div style={{marginTop:18, fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', lineHeight:1.5}}>
          Вступая, вы сможете записываться на тренировки, видеть состав и платить абонементом или наличными организатору.
        </div>

        <div style={{marginTop:'auto', paddingTop:18, display:'flex', flexDirection:'column', gap:8}}>
          <button onClick={join} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full">Вступить в группу</button>
          <button onClick={() => { nav.toast('Сохранено · решите позже'); }} className="vt-btn vt-btn--ghost vt-btn--full">Посмотреть и решить позже</button>
        </div>
      </div>
    </>
  );
};

Object.assign(window, {
  PlayerHome, PlayerEvent, PlayerBook, PlayerSubs, PlayerBuy, PlayerProfile, PlayerOnboard
});
