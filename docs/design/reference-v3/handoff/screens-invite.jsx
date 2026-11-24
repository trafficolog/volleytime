// M-08 · Запись по приглашению — 4 состояния экрана события
const INVITE_EVENT = { title:'Основа · Пятница', date:'30 мая', time:'20:00–22:00', venue:'СК «Заслонова»', hall:'зал 2', main:'11 / 14', meterPct:79, joinedCount:11 };

const InviteNote = ({ icon, tone = 'state', title, children }) => {
  const bg = { state:'var(--vt-bone-2)', amber:'var(--vt-amber-soft)', grass:'var(--vt-grass-soft)', rose:'var(--vt-rose-soft)' }[tone];
  const ink = { state:'var(--vt-icon-idle)', amber:'var(--vt-amber-ink)', grass:'var(--vt-grass-ink)', rose:'var(--vt-rose-ink)' }[tone];
  return (
    <div style={{padding:'12px 14px', borderRadius:'var(--r-chip)', background:bg, display:'flex', gap:10, alignItems:'flex-start'}}>
      <Icon name={icon} size={15} stroke={ink} sw={2}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{title}</div>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:3, lineHeight:1.45}}>{children}</div>
      </div>
    </div>
  );
};

const PlayerInvite = () => {
  const nav = useNav();
  const online = canBook(useDataState());
  const [st, setSt] = React.useState(nav.data.inviteState || window.VT_INVITE_STATE || 'none');
  React.useEffect(() => { if (nav.data.inviteState) setSt(nav.data.inviteState); }, [nav.data.inviteState]);
  const e = INVITE_EVENT;
  const organizer = { name:'Иван П.', init:'ИП', tag:'ink' };

  const request = () => { if (!online) return; setSt('sent'); nav.toast('Запрос отправлен организатору'); };
  const withdraw = () => nav.alert({
    title:'Отозвать запрос?', body:'Организатор больше не увидит ваш запрос. Отправить новый можно в любой момент.',
    confirm:'Отозвать', danger:true, onConfirm: () => { setSt('none'); nav.toast('Запрос отозван'); }
  });

  const chip = {
    none:    <span className="vt-chip vt-chip--state" style={{fontSize:'var(--fs-2xs)'}}><Icon name="lock" size={10}/> по приглашению</span>,
    sent:    <span className="vt-chip vt-chip--amber vt-chip--dot" style={{fontSize:'var(--fs-2xs)'}}>запрос отправлен</span>,
    ok:      <span className="vt-chip vt-chip--grass vt-chip--dot" style={{fontSize:'var(--fs-2xs)'}}>вы приглашены</span>,
    expired: <span className="vt-chip vt-chip--rose vt-chip--dot" style={{fontSize:'var(--fs-2xs)'}}>ссылка просрочена</span>,
  }[st];

  return (
    <>
      <MiniHeader title={e.title} sub={`${e.date} · ${e.time}`} onBack/>
      <div className="vt-phone__body">
        <div style={{padding:'4px 16px 0'}}>
          <div className="vt-card" style={{padding:16}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', display:'flex', alignItems:'center', gap:6}}><Icon name="pin" size={12}/> {`${e.venue}, ${e.hall}`}</div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4, display:'flex', alignItems:'center', gap:6}}><Icon name="clock" size={12}/> <span style={{whiteSpace:'nowrap'}}>Закроется через 2 д 1 ч</span></div>
              </div>
              <div style={{display:'flex', gap:4, flexWrap:'wrap', justifyContent:'flex-end'}}>{chip}</div>
            </div>
            <div className="vt-divider" style={{margin:'12px 0'}}/>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10}}>
              <div><div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Цена</div><div className="vt-mono" style={{fontWeight:600, fontSize:'var(--fs-md)', marginTop:4}}>15,00 BYN</div></div>
              <div><div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Уровень</div><div style={{fontWeight:600, fontSize:'var(--fs-base)', marginTop:4}}>В3</div></div>
              <div><div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Длительность</div><div style={{fontWeight:600, fontSize:'var(--fs-base)', marginTop:4}}>2 ч</div></div>
            </div>
          </div>
        </div>

        <div style={{padding:'12px 16px 0'}}>
          {st === 'none' && (
            <InviteNote icon="lock" title="Запись по приглашению">
              Организатор сам решает, кто играет в этот раз. Отправьте запрос — ответ придёт в бот.
            </InviteNote>
          )}
          {st === 'sent' && (
            <div className="vt-card" style={{padding:16}}>
              <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Ваш запрос</div>
              {[
                { done:true, t:'Запрос отправлен', s:'сегодня, 19:24' },
                { done:false, t:'Организатор рассматривает', s:'обычно отвечает за несколько часов' },
                { done:false, t:'Ответ придёт в бот', s:'и появится здесь' },
              ].map((r, i, arr) => (
                <div key={i} style={{display:'flex', gap:10}}>
                  <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                    <span style={{width:10, height:10, borderRadius:'50%', marginTop:4, background: r.done ? 'var(--vt-amber)' : 'transparent', border: r.done ? 'none' : '1.5px solid var(--vt-stroke-2)'}}/>
                    {i < arr.length - 1 && <span style={{flex:1, width:1.5, background:'var(--vt-stroke-2)', margin:'3px 0'}}/>}
                  </div>
                  <div style={{paddingBottom: i < arr.length - 1 ? 12 : 0}}>
                    <div style={{fontSize:'var(--fs-sm)', fontWeight: r.done ? 600 : 500, color: r.done ? 'var(--vt-ink)' : 'var(--vt-ink-3)'}}>{r.t}</div>
                    <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{r.s}</div>
                  </div>
                </div>
              ))}
              <div className="vt-divider" style={{margin:'12px 0'}}/>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <Avi size="sm" {...organizer}/>
                <div style={{fontSize:'var(--fs-sm)', fontWeight:500}}>Иван Петренко · организатор</div>
              </div>
            </div>
          )}
          {st === 'ok' && (
            <div className="vt-card" style={{padding:16, borderColor:'var(--vt-grass)'}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <Avi size="sm" {...organizer}/>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>Иван Петренко пригласил вас</div>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>по личной ссылке</div>
                </div>
                <Icon name="check" size={16} stroke="var(--vt-grass-ink)" sw={2.2}/>
              </div>
              <div className="vt-divider" style={{margin:'12px 0'}}/>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', lineHeight:1.45}}>
                Ссылка одноразовая и действует до <b style={{color:'var(--vt-ink)'}}>29 мая, 20:00</b>. Место не держится, пока вы не запишетесь.
              </div>
            </div>
          )}
          {st === 'expired' && (
            <InviteNote icon="clock" tone="rose" title="Ссылка больше не действует">
              Срок приглашения истёк 28 мая в 20:00. Попросите новое — организатор получит запрос в бот.
            </InviteNote>
          )}
        </div>

        <div style={{padding:'16px 16px 0'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Основной состав</div>
            <span className="vt-mono" style={{fontSize:'var(--fs-xs)', fontWeight:600}}>{e.main}</span>
          </div>
          <div className="vt-meter"><i style={{width:`${e.meterPct}%`, background: meterTint(e.meterPct)}}/></div>
          <div style={{marginTop:12, display:'flex', alignItems:'center', gap:10}}>
            <div className="vt-stack">{[0,1,2,3,4].map(i => <Avi key={i} idx={i} size="sm"/>)}</div>
            <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>и ещё 6 · 3 места свободно</span>
          </div>
        </div>

        <div style={{padding:'18px 16px 20px', display:'flex', flexDirection:'column', gap:8}}>
          {st === 'none' && (
            <button onClick={request} disabled={!online} className="vt-btn vt-btn--primary vt-btn--full vt-btn--lg">Запросить приглашение</button>
          )}
          {st === 'sent' && (<>
            <button disabled className="vt-btn vt-btn--primary vt-btn--full vt-btn--lg" style={{justifyContent:'space-between'}}>
              <span>Записаться</span><span className="vt-mono" style={{opacity:.85}}>после ответа</span>
            </button>
            <button onClick={withdraw} className="vt-btn vt-btn--ghost vt-btn--full">Отозвать запрос</button>
          </>)}
          {st === 'ok' && (
            <button onClick={() => online && nav.push('book', { event: { ...e, joined:false } })} disabled={!online} className="vt-btn vt-btn--primary vt-btn--full vt-btn--lg" style={{justifyContent:'space-between'}}>
              <span>Записаться</span><span className="vt-mono" style={{opacity:.85}}>15,00 BYN</span>
            </button>
          )}
          {st === 'expired' && (<>
            <button onClick={request} disabled={!online} className="vt-btn vt-btn--primary vt-btn--full vt-btn--lg">Запросить новое приглашение</button>
            <button onClick={() => nav.push('schedule')} className="vt-btn vt-btn--ghost vt-btn--full">Другие события группы</button>
          </>)}
          {!online && <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', textAlign:'center'}}>{OFFLINE_REASON}</div>}
        </div>
      </div>
      <TabBar active="home"/>
    </>
  );
};

Object.assign(window, { PlayerInvite });
