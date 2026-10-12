// screens-web-forms.jsx — Web SaaS forms & extra pages
// Uses window.WebShell, Icon, Avi, useNav, byn, PEOPLE, CAMPAIGNS

// ============================================================
// WebEventCreate — create/edit a training (also used by Обзор button)
// ============================================================
const WebEventCreate = () => {
  const nav = useNav();
  const [type, setType] = React.useState('Основа');
  const [cap, setCap] = React.useState(14);
  const [closeBefore, setCloseBefore] = React.useState('за 2 ч');
  const [priceMode, setPriceMode] = React.useState('fixed');
  const [price, setPrice] = React.useState(15);
  const [total, setTotal] = React.useState(180);
  const subsEnabled = true; // из настроек группы

  const [count, setCount] = React.useState(1);
  const create = () => { nav.reset('events'); setTimeout(() => nav.toast(count > 1 ? `Создана серия · ${trainings(count)} · −${count} credits` : 'Тренировка создана · −1 credit'), 80); };

  return (
  <WebShell activeNav="events" title={count > 1 ? 'Новая серия' : 'Новая тренировка'} sub={count > 1 ? `${trainings(count)} · по 1 credit за каждую` : 'Создание события · спишется 1 credit (останется 31)'}
    topRight={<>
      <button onClick={() => nav.reset('events')} className="vt-btn vt-btn--ghost vt-btn--sm">Отмена</button>
      <button onClick={create} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6}}><Icon name="check" size={14}/> {count > 1 ? `Создать ${trainings(count)}` : 'Создать'}</button>
    </>}>
    <div style={{display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:18, maxWidth:1000}}>
      {/* Left: main form */}
      <div className="vt-card" style={{padding:24}}>
        <h3 style={{fontSize:'var(--fs-md)'}}>Основное</h3>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:16}}>
          <div style={{gridColumn:'1/-1'}}>
            <label className="vt-label">Название</label>
            <input className="vt-field" defaultValue="Среда — основа"/>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <label className="vt-label">Тип / шаблон</label>
            <div style={{display:'flex', gap:6}}>
              {['Основа','Открытая игра','Микст','Турнир'].map(t => (
                <button key={t} onClick={() => setType(t)} className="vt-btn vt-btn--sm" style={{
                  background:type===t?'var(--vt-ink)':'var(--vt-ctl)', color:type===t?'var(--vt-paper)':'var(--vt-ink)', fontWeight:600
                }}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="vt-label">Дата</label>
            <div className="vt-field" style={{display:'flex', alignItems:'center', gap:8}}><Icon name="calendar" size={14}/> {count > 1 ? 'Первая — ' : ''}Сб, 6 июня 2026</div>
          </div>
          <div>
            <label className="vt-label">Время</label>
            <div style={{display:'flex', gap:8}}>
              <div className="vt-field" style={{display:'flex', alignItems:'center', gap:6}}><Icon name="clock" size={14}/> 11:00</div>
              <div className="vt-field" style={{display:'flex', alignItems:'center', gap:6}}>13:00</div>
            </div>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <label className="vt-label">Зал / площадка</label>
            <div className="vt-field" style={{display:'flex', alignItems:'center', gap:8}}>
              <Icon name="pin" size={14}/> Школа №24, малый зал
              <Icon name="chevron-d" size={14} style={{marginLeft:'auto'}}/>
            </div>
          </div>
          <div style={{gridColumn:'1/-1', paddingTop:6}}>
            <RecurrenceBlock onCount={setCount} wide/>
          </div>
        </div>
      </div>

      {/* Right: capacity, price, registration */}
      <div style={{display:'flex', flexDirection:'column', gap:18}}>
        <div className="vt-card" style={{padding:20}}>
          <h3 style={{fontSize:'var(--fs-md)'}}>Состав и запись</h3>
          <div style={{marginTop:14}}>
            <label className="vt-label">Основной состав — мест</label>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <button onClick={() => setCap(c => Math.max(2, c-1))} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'6px 12px'}}>−</button>
              <span className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-xl)', width:40, textAlign:'center'}}>{cap}</span>
              <button onClick={() => setCap(c => c+1)} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'6px 12px'}}>+</button>
              <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginLeft:4}}>сверх лимита — лист ожидания</span>
            </div>
          </div>
          <div className="vt-divider" style={{margin:'16px 0'}}/>
          <label className="vt-label">Тип оплаты</label>
          <div style={{display:'flex', gap:6}}>
            {[['fixed','Фикс. цена'],['split','Делим сумму']].map(([v,l]) => (
              <button key={v} onClick={() => setPriceMode(v)} className="vt-btn vt-btn--sm" style={{
                flex:1, background:priceMode===v?'var(--vt-ink)':'var(--vt-ctl)', color:priceMode===v?'var(--vt-paper)':'var(--vt-ink)', fontWeight:600
              }}>{l}</button>
            ))}
          </div>

          {priceMode === 'fixed' ? (
            <div style={{marginTop:14}}>
              <label className="vt-label">Цена за место</label>
              <div style={{display:'flex', gap:8}}>
                <input className="vt-field" value={price} onChange={e=>setPrice(+e.target.value||0)} style={{flex:1, fontFamily:'var(--f-mono)', fontWeight:600}}/>
                <div className="vt-field" style={{width:80, display:'flex', alignItems:'center', justifyContent:'center'}}>BYN</div>
              </div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:6}}>
                При полном составе соберётся <b className="vt-mono" style={{color:'var(--vt-ink)'}}>{price*cap} Br</b>. Списание абонемента = 1 сессия.
              </div>
            </div>
          ) : (
            <div style={{marginTop:14}}>
              <label className="vt-label">Общая сумма к сбору</label>
              <div style={{display:'flex', gap:8}}>
                <input className="vt-field" value={total} onChange={e=>setTotal(+e.target.value||0)} style={{flex:1, fontFamily:'var(--f-mono)', fontWeight:600}}/>
                <div className="vt-field" style={{width:80, display:'flex', alignItems:'center', justifyContent:'center'}}>BYN</div>
              </div>
              <div style={{marginTop:10, padding:'12px 14px', borderRadius:'var(--r-chip)', background:'var(--vt-amber-soft)'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', fontSize:'var(--fs-sm)'}}>
                  <span style={{color:'var(--vt-ink-3)'}}>Прогноз за место при полном составе</span>
                  <span className="vt-mono" style={{fontWeight:700}}>{(total/cap).toFixed(2).replace('.', ',')} Br</span>
                </div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:6, lineHeight:1.45}}>
                  Точная сумма за место определится <b style={{color:'var(--vt-ink)'}}>после закрытия записи</b> — чем меньше людей, тем дороже каждому.
                </div>
              </div>
              {subsEnabled && (
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:8, display:'flex', gap:8, alignItems:'flex-start'}}>
                  <Icon name="ticket" size={13} stroke="var(--vt-icon-idle)"/>
                  <span>Абонементы недоступны при делении суммы — стоимость сессии заранее неизвестна.</span>
                </div>
              )}
            </div>
          )}
          <div className="vt-divider" style={{margin:'16px 0'}}/>
          <label className="vt-label">Запись закрывается</label>
          <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
            {['за 1 ч','за 2 ч','за 6 ч','за 24 ч'].map(t => (
              <button key={t} onClick={() => setCloseBefore(t)} className="vt-btn vt-btn--sm" style={{
                background:closeBefore===t?'var(--vt-ink)':'var(--vt-ctl)', color:closeBefore===t?'var(--vt-paper)':'var(--vt-ink)', fontWeight:600
              }}>{t}</button>
            ))}
          </div>
        </div>

        <div className="vt-card" style={{padding:16, background:'var(--vt-bone-2)'}}>
          <div style={{display:'flex', alignItems:'center', gap:8, fontSize:'var(--fs-sm)'}}>
            <Icon name="ticket" size={15}/>
            <span>Будет списан <b>1 credit</b>. Останется <b className="vt-mono">31</b>.</span>
          </div>
        </div>
      </div>
    </div>
  </WebShell>
  );
};

// ============================================================
// WebLedgerEntry — manual income / expense form
// ============================================================
const WebLedgerEntry = () => {
  const nav = useNav();
  const kind = nav.data.kind || 'expense'; // 'income' | 'expense'
  const isIncome = kind === 'income';
  const [cat, setCat] = React.useState(isIncome ? 'training_fee' : 'rent');
  const [method, setMethod] = React.useState('cash');

  const incomeCats = [['training_fee','Оплата тренировки'],['subscription','Абонемент'],['contribution','Взнос в сбор'],['other','Прочее']];
  const expenseCats = [['rent','Аренда зала'],['balls','Мячи / инвентарь'],['referee','Судья / тренер'],['other','Прочее']];
  const cats = isIncome ? incomeCats : expenseCats;

  const save = () => { nav.reset('ledger'); setTimeout(() => nav.toast(isIncome ? 'Поступление добавлено' : 'Расход добавлен'), 80); };

  return (
  <WebShell activeNav="ledger" title={isIncome ? 'Новое поступление' : 'Новый расход'} sub="Ручная запись в кассу организации"
    topRight={<>
      <button onClick={() => nav.reset('ledger')} className="vt-btn vt-btn--ghost vt-btn--sm">Отмена</button>
      <button onClick={save} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6}}><Icon name="check" size={14}/> Сохранить</button>
    </>}>
    <div style={{maxWidth:640}}>
      {/* Kind switch */}
      <div style={{display:'flex', gap:2, padding:4, background:'var(--vt-bone-2)', borderRadius:'var(--r-chip)', width:'fit-content', marginBottom:18}}>
        {[['income','Поступление','arrow-d'],['expense','Расход','arrow-u']].map(([k,l,ic]) => (
          <button key={k} onClick={() => nav.setData({ kind:k })} className="vt-btn vt-btn--sm" style={{
            gap:6, background: kind===k ? 'var(--vt-paper)' : 'transparent',
            color: kind===k ? (k==='income'?'var(--vt-grass)':'var(--vt-rose)') : 'var(--vt-mute-2)',
            boxShadow: kind===k ? 'var(--vt-seg-shadow)' : 'none', fontWeight:600
          }}><Icon name={ic} size={14}/> {l}</button>
        ))}
      </div>

      <div className="vt-card" style={{padding:24}}>
        {/* Amount */}
        <label className="vt-label">Сумма</label>
        <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:4}}>
          <span className="vt-mono" style={{fontSize:'var(--fs-base)', color:isIncome?'var(--vt-grass)':'var(--vt-rose)', fontWeight:700}}>{isIncome?'+':'−'}</span>
          <input className="vt-field" defaultValue={isIncome ? '15' : '42'} style={{flex:1, fontSize:'var(--fs-xl)', fontWeight:700, fontFamily:'var(--f-mono)'}}/>
          <div className="vt-field" style={{width:80, display:'flex', alignItems:'center', justifyContent:'center'}}>BYN</div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:16}}>
          <div>
            <label className="vt-label">Категория</label>
            <div className="vt-field" style={{display:'flex', alignItems:'center', gap:8}}>
              {cats.find(c => c[0]===cat)?.[1] || 'Выбрать'}
              <Icon name="chevron-d" size={14} style={{marginLeft:'auto'}}/>
            </div>
            <div style={{display:'flex', gap:6, flexWrap:'wrap', marginTop:8}}>
              {cats.map(([v,l]) => (
                <button key={v} onClick={() => setCat(v)} className="vt-chip" style={{
                  cursor:'pointer', fontSize:'var(--fs-2xs)',
                  background: cat===v ? 'var(--vt-ink)' : 'var(--vt-ctl-track)',
                  color: cat===v ? 'var(--vt-paper)' : 'var(--vt-ink)', borderColor:'transparent'
                }}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="vt-label">Дата</label>
            <div className="vt-field" style={{display:'flex', alignItems:'center', gap:8}}><Icon name="calendar" size={14}/> Сегодня, 29 мая</div>
            <label className="vt-label" style={{marginTop:14}}>Способ</label>
            <div style={{display:'flex', gap:6}}>
              {[['cash','Наличные'],['transfer','Перевод']].map(([v,l]) => (
                <button key={v} onClick={() => setMethod(v)} className="vt-btn vt-btn--sm" style={{
                  flex:1, background:method===v?'var(--vt-ink)':'var(--vt-ctl)', color:method===v?'var(--vt-paper)':'var(--vt-ink)', fontWeight:600
                }}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        {isIncome && (
          <div style={{marginTop:14}}>
            <label className="vt-label">Привязать к игроку / событию (необязательно)</label>
            <div className="vt-field" style={{display:'flex', alignItems:'center', gap:8, color:'var(--vt-mute)'}}>
              <Icon name="search" size={14}/> Никита · Основа 28 мая
            </div>
          </div>
        )}

        <div style={{marginTop:14}}>
          <label className="vt-label">Комментарий</label>
          <textarea className="vt-field" rows={2} placeholder={isIncome ? 'Например: доплата за гостя' : 'Например: аренда Школа №24, 2 часа'}></textarea>
        </div>
      </div>

      <div className="vt-card" style={{padding:'14px 18px', marginTop:14, background:'var(--vt-bone-2)', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <span style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>Баланс кассы после записи</span>
        <span className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-md)'}}>{isIncome ? '+263,50 Br' : '+206,50 Br'}</span>
      </div>
    </div>
  </WebShell>
  );
};

// ============================================================
// WebContribCreate — new fundraising campaign
// ============================================================
const WebContribCreate = () => {
  const nav = useNav();
  const [icon, setIcon] = React.useState('ball');
  const [visibility, setVisibility] = React.useState('all');
  const icons = Object.keys(CAMPAIGN_ICONS);

  const create = () => { nav.reset('contributions'); setTimeout(() => nav.toast('Сбор создан'), 80); };

  return (
  <WebShell activeNav="contributions" title="Новый сбор" sub="Кампания по сбору средств"
    topRight={<>
      <button onClick={() => nav.reset('contributions')} className="vt-btn vt-btn--ghost vt-btn--sm">Отмена</button>
      <button onClick={create} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6}}><Icon name="check" size={14}/> Создать сбор</button>
    </>}>
    <div style={{display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:18, maxWidth:1000}}>
      <div className="vt-card" style={{padding:24}}>
        <h3 style={{fontSize:'var(--fs-md)'}}>О сборе</h3>
        <div style={{marginTop:16}}>
          <label className="vt-label">Иконка</label>
          <div style={{display:'flex', gap:8}}>
            {icons.map(k => (
              <button key={k} onClick={() => setIcon(k)} title={CAMPAIGN_ICONS[k].label} style={{
                padding:2, borderRadius:'var(--r-btn)', cursor:'pointer',
                boxShadow: icon===k ? '0 0 0 2px var(--vt-flame)' : 'none'
              }}><CampaignIcon name={k} size={44}/></button>
            ))}
          </div>
        </div>
        <div style={{marginTop:16}}>
          <label className="vt-label">Название</label>
          <input className="vt-field" defaultValue="Новый комплект мячей"/>
        </div>
        <div style={{marginTop:14}}>
          <label className="vt-label">Описание · на что собираем</label>
          <textarea className="vt-field" rows={3} defaultValue="3× Mikasa V200W на замену убитым. Хватит на сезон."></textarea>
        </div>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:18}}>
        <div className="vt-card" style={{padding:20}}>
          <h3 style={{fontSize:'var(--fs-md)'}}>Цель и срок</h3>
          <div style={{marginTop:14}}>
            <label className="vt-label">Целевая сумма</label>
            <div style={{display:'flex', gap:8}}>
              <input className="vt-field" defaultValue="250" style={{flex:1, fontFamily:'var(--f-mono)', fontWeight:600}}/>
              <div className="vt-field" style={{width:72, display:'flex', alignItems:'center', justifyContent:'center'}}>BYN</div>
            </div>
          </div>
          <div style={{marginTop:14}}>
            <label className="vt-label">Дедлайн</label>
            <div className="vt-field" style={{display:'flex', alignItems:'center', gap:8}}><Icon name="calendar" size={14}/> 5 июня 2026</div>
          </div>
          <div style={{marginTop:14}}>
            <label className="vt-label">Кто видит сбор</label>
            <div style={{display:'flex', flexDirection:'column', gap:6}}>
              {[['all','Вся группа'],['team','Только состав турнира'],['link','По ссылке']].map(([v,l]) => (
                <button key={v} onClick={() => setVisibility(v)} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:'var(--r-sm)', cursor:'pointer', textAlign:'left',
                  border: visibility===v ? '1px solid var(--vt-flame)' : '1px solid var(--vt-bone-2)',
                  background: visibility===v ? 'var(--vt-accent-soft)' : 'var(--vt-paper)'
                }}>
                  <span style={{width:16, height:16, borderRadius:'var(--r-pill)', border:`${visibility===v?5:2}px solid ${visibility===v?'var(--vt-flame)':'var(--vt-stroke)'}`, flexShrink:0}}/>
                  <span style={{fontSize:'var(--fs-sm)', fontWeight:500}}>{l}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="vt-card" style={{padding:16, background:'var(--vt-bone-2)'}}>
          <div style={{display:'flex', alignItems:'flex-start', gap:8, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>
            <Icon name="wallet" size={15} stroke="var(--vt-mute-2)"/>
            <span>Подтверждённые взносы попадут в кассу с категорией <b style={{color:'var(--vt-ink)'}}>contribution</b>.</span>
          </div>
        </div>
      </div>
    </div>
  </WebShell>
  );
};

// ============================================================
// WebReports — analytics / reports page
// ============================================================
const WebReports = () => {
  const nav = useNav();
  const [period, setPeriod] = React.useState('Май 2026');
  return (
  <WebShell activeNav="reports" title="Отчёты" sub="Аналитика по кассе, событиям и игрокам"
    topRight={<>
      <button onClick={() => nav.toast('PDF готовится')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="arrow-d" size={14}/> PDF</button>
      <button onClick={() => nav.push('reports-export', { type:'finance' })} className="vt-btn vt-btn--primary vt-btn--sm"><Icon name="arrow-d" size={14}/> Экспорт CSV</button>
    </>}>
    {/* Period selector */}
    <div style={{display:'flex', gap:8, marginBottom:18, alignItems:'center'}}>
      <div className="vt-field" style={{width:'auto', padding:'8px 12px', display:'flex', alignItems:'center', gap:8, fontSize:'var(--fs-sm)'}}>
        <Icon name="calendar" size={14}/> {period} <Icon name="chevron-d" size={12} style={{opacity:0.5}}/>
      </div>
      {['Май 2026','Апрель 2026','Q2 2026','Год'].map(p => (
        <button key={p} onClick={() => setPeriod(p)} className="vt-btn vt-btn--sm" style={{
          background:period===p?'var(--vt-ink)':'var(--vt-ctl)', color:period===p?'var(--vt-paper)':'var(--vt-ink)', fontWeight:600
        }}>{p}</button>
      ))}
    </div>

    {/* KPI row */}
    <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginBottom:18}}>
      {[
        ['Чистая касса','+248,50 Br','+82,50 неделя','grass'],
        ['Поступления','+318,50 Br','12 событий'],
        ['Расходы','−70,00 Br','3 категории','rose'],
        ['Заполняемость','87%','+5% к апрелю'],
      ].map(([l,v,d,c],i) => (
        <div key={i} className="vt-card" style={{padding:16}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{l}</div>
          <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-2xl)', marginTop:8, color:c==='grass'?'var(--vt-grass)':c==='rose'?'var(--vt-rose)':'inherit'}}>{v}</div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:6}}>{d}</div>
        </div>
      ))}
    </div>

    <div style={{display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:16}}>
      {/* Cash trend */}
      <div className="vt-card" style={{padding:20}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
          <h3 style={{fontSize:'var(--fs-md)'}}>Касса по неделям</h3>
          <span className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-grass)', fontWeight:600}}>+248,50 Br нетто</span>
        </div>
        <div style={{display:'flex', gap:10, alignItems:'flex-end', height:160, marginTop:20}}>
          {[[68,18],[84,26],[72,12],[92,14]].map(([inc,exp],i) => (
            <div key={i} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6, height:'100%', justifyContent:'flex-end'}}>
              <div style={{width:'100%', display:'flex', flexDirection:'column', justifyContent:'flex-end', height:'100%', gap:2}}>
                <div style={{height:`${inc}%`, background:'var(--vt-grass)', borderRadius:'4px 4px 0 0', opacity:0.85}}/>
                <div style={{height:`${exp}%`, background:'var(--vt-rose)', borderRadius:'0 0 4px 4px', opacity:0.7}}/>
              </div>
              <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>Н{i+1}</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex', gap:16, marginTop:14, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>
          <span style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:9,height:9,background:'var(--vt-grass)',borderRadius:'var(--r-xs)'}}/> Поступления</span>
          <span style={{display:'flex', alignItems:'center', gap:6}}><span style={{width:9,height:9,background:'var(--vt-rose)',borderRadius:'var(--r-xs)'}}/> Расходы</span>
        </div>
      </div>

      {/* Breakdown + top */}
      <div style={{display:'flex', flexDirection:'column', gap:16}}>
        <div className="vt-card" style={{padding:18}}>
          <h3 style={{fontSize:'var(--fs-base)'}}>Расходы по категориям</h3>
          <div style={{marginTop:14}}>
            {[['Аренда залов',42,60],['Мячи / инвентарь',18,26],['Прочее',10,14]].map(([l,v,pct],i) => (
              <div key={i} style={{marginBottom:i<2?12:0}}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:'var(--fs-sm)', marginBottom:6}}>
                  <span>{l}</span><span className="vt-mono" style={{fontWeight:600}}>−{v},00 Br</span>
                </div>
                <div className="vt-meter"><i style={{width:`${pct}%`, background:'var(--vt-rose)'}}/></div>
              </div>
            ))}
          </div>
        </div>
        <div className="vt-card" style={{padding:18}}>
          <h3 style={{fontSize:'var(--fs-base)'}}>Самые активные</h3>
          <div style={{marginTop:10}}>
            {PEOPLE.slice(0,4).map((p,i,a) => (
              <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:i<a.length-1?'1px solid var(--vt-bone-2)':'none'}}>
                <span className="vt-mono" style={{fontSize:'var(--fs-xs)', fontWeight:700, color:i===0?'var(--vt-flame)':'var(--vt-mute-2)', width:14}}>{i+1}</span>
                <Avi name={p.name} init={p.init} tag={p.tag} size="sm"/>
                <span style={{flex:1, fontSize:'var(--fs-sm)', fontWeight:500}}>{p.name}</span>
                <span className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{[12,11,10,9][i]} трен.</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Available reports list */}
    <h3 style={{fontSize:'var(--fs-md)', margin:'24px 0 12px'}}>Готовые отчёты</h3>
    <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14}}>
      {[
        ['Финансовый отчёт','Касса, поступления, расходы по категориям','wallet','finance'],
        ['Посещаемость','Кто сколько ходил, no-show, отмены','users','attendance'],
        ['Абонементы','Продажи, остатки, истечения','ticket','subs'],
      ].filter(r => r[3] !== 'subs' || getSetting('subsOn')).map(([t,d,ic,k],i) => (
        <button key={i} onClick={() => nav.push('reports-export', { type:k })} className="vt-card" style={{padding:18, textAlign:'left', cursor:'pointer', display:'flex', flexDirection:'column', gap:10}}>
          <Icon name={ic} size={22}/>
          <div>
            <div style={{fontFamily:'var(--f-display)', fontWeight:600, fontSize:'var(--fs-md)'}}>{t}</div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4, lineHeight:1.4}}>{d}</div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:6, fontSize:'var(--fs-xs)', color:'var(--vt-flame-ink)', fontWeight:600, marginTop:2}}>
            Скачать CSV <Icon name="arrow-d" size={12}/>
          </div>
        </button>
      ))}
    </div>
  </WebShell>
  );
};

// ============================================================
// WebPlanCreate — create/edit a subscription plan
// ============================================================
const WebPlanCreate = () => {
  const nav = useNav();
  const [kind, setKind] = React.useState('sessions'); // 'sessions' | 'unlimited'
  const [sessions, setSessions] = React.useState(8);
  const [price, setPrice] = React.useState(110);
  const [valid, setValid] = React.useState(45);
  const [visible, setVisible] = React.useState(true);
  const [popular, setPopular] = React.useState(false);

  const per = kind === 'sessions' && sessions > 0 ? (price / sessions) : 0;

  const create = () => { nav.reset('plans'); setTimeout(() => nav.toast('План абонемента создан'), 80); };

  return (
  <WebShell activeNav="plans" title="Новый план абонемента" sub="Тариф, по которому игроки покупают абонементы"
    topRight={<>
      <button onClick={() => nav.reset('plans')} className="vt-btn vt-btn--ghost vt-btn--sm">Отмена</button>
      <button onClick={create} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6}}><Icon name="check" size={14}/> Создать план</button>
    </>}>
    <div style={{display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:18, maxWidth:1000}}>
      {/* Left: form */}
      <div className="vt-card" style={{padding:24}}>
        <h3 style={{fontSize:'var(--fs-md)'}}>Параметры плана</h3>

        {/* Kind */}
        <div style={{marginTop:16}}>
          <label className="vt-label">Тип абонемента</label>
          <div style={{display:'flex', gap:6}}>
            {[['sessions','Пакет сессий'],['unlimited','Безлимит на период']].map(([v,l]) => (
              <button key={v} onClick={() => setKind(v)} className="vt-btn vt-btn--sm" style={{
                flex:1, background: kind===v?'var(--vt-ink)':'var(--vt-ctl)', color: kind===v?'var(--vt-paper)':'var(--vt-ink)', fontWeight:600
              }}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{marginTop:16}}>
          <label className="vt-label">Название</label>
          <input className="vt-field" defaultValue={kind==='sessions' ? `${sessions} сессий` : 'Безлимит / месяц'}/>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:16}}>
          {kind === 'sessions' && (
            <div>
              <label className="vt-label">Количество сессий</label>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <button onClick={() => setSessions(s => Math.max(1, s-1))} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'6px 12px'}}>−</button>
                <span className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-lg)', width:32, textAlign:'center'}}>{sessions}</span>
                <button onClick={() => setSessions(s => s+1)} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'6px 12px'}}>+</button>
              </div>
            </div>
          )}
          <div>
            <label className="vt-label">Срок действия (дней)</label>
            <input className="vt-field" value={valid} onChange={e => setValid(+e.target.value || 0)} style={{fontFamily:'var(--f-mono)', fontWeight:600}}/>
          </div>
          <div>
            <label className="vt-label">Цена</label>
            <div style={{display:'flex', gap:8}}>
              <input className="vt-field" value={price} onChange={e => setPrice(+e.target.value || 0)} style={{flex:1, fontFamily:'var(--f-mono)', fontWeight:600}}/>
              <div className="vt-field" style={{width:72, display:'flex', alignItems:'center', justifyContent:'center'}}>BYN</div>
            </div>
          </div>
        </div>

        <div className="vt-divider" style={{margin:'18px 0'}}/>
        <label className="vt-label">Доступность</label>
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          <button onClick={() => setVisible(v => !v)} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:'var(--r-sm)', cursor:'pointer', textAlign:'left', background:'var(--vt-paper)'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>Сразу в продаже</div>
              <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2}}>Игроки увидят план в Mini App. Иначе — черновик.</div>
            </div>
            <div style={{width:36, height:20, borderRadius:'var(--r-pill)', background:visible?'var(--vt-ink)':'var(--vt-stroke-2)', position:'relative', flexShrink:0}}>
              <span style={{position:'absolute', top:2, left: visible?18:2, width:16, height:16, borderRadius:'var(--r-pill)', background:'var(--vt-paper)', transition:'left .15s'}}/>
            </div>
          </button>
          <button onClick={() => setPopular(v => !v)} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:'var(--r-sm)', cursor:'pointer', textAlign:'left', background:'var(--vt-paper)'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>Отметить «Популярный»</div>
              <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2}}>Выделяется бейджем при покупке.</div>
            </div>
            <div style={{width:36, height:20, borderRadius:'var(--r-pill)', background:popular?'var(--vt-ink)':'var(--vt-stroke-2)', position:'relative', flexShrink:0}}>
              <span style={{position:'absolute', top:2, left: popular?18:2, width:16, height:16, borderRadius:'var(--r-pill)', background:'var(--vt-paper)', transition:'left .15s'}}/>
            </div>
          </button>
        </div>
      </div>

      {/* Right: live preview */}
      <div style={{display:'flex', flexDirection:'column', gap:14}}>
        <div>
          <label className="vt-label">Превью карточки</label>
          <div className="vt-card" style={{padding:20, position:'relative', borderColor: popular?'var(--vt-ink)':'var(--vt-stroke)'}}>
            {popular && <span className="vt-chip vt-chip--solid" style={{position:'absolute', top:-10, left:16, fontSize:'var(--fs-2xs)'}}>Популярный</span>}
            <div style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-3xl)', lineHeight:1}}>{kind==='sessions' ? sessions : '∞'}</div>
            <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>{kind==='sessions' ? `${sessions} сессий` : 'Безлимит / месяц'}</div>
            <div className="vt-divider" style={{margin:'14px 0'}}/>
            <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-xl)'}}>{price} Br</div>
            <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2}}>{per>0 ? `${per.toFixed(2).replace('.', ',')} Br/сессия · ` : ''}{valid} дней</div>
            <div style={{display:'flex', gap:6, marginTop:14}}>
              {visible
                ? <span className="vt-chip vt-chip--grass vt-chip--dot" style={{fontSize:'var(--fs-2xs)'}}>в продаже</span>
                : <span className="vt-chip vt-chip--amber" style={{fontSize:'var(--fs-2xs)'}}>черновик</span>}
            </div>
          </div>
        </div>
        <div className="vt-card" style={{padding:16, background:'var(--vt-bone-2)'}}>
          <div style={{display:'flex', alignItems:'flex-start', gap:8, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>
            <Icon name="ticket" size={15} stroke="var(--vt-mute-2)"/>
            <span>{kind==='sessions'
              ? <>Списывается 1 сессия при записи на тренировку. Возвращается при отмене.</>
              : <>Безлимитный доступ ко всем тренировкам в течение срока действия.</>}</span>
          </div>
        </div>
      </div>
    </div>
  </WebShell>
  );
};

// ============================================================
// WebReportsExport — period, fields, format, live preview
// ============================================================
const REPORT_TYPES = {
  finance: { t:'Финансовый отчёт', ic:'wallet',
    fields:[['date','Дата',1],['kind','Тип',1],['cat','Категория',1],['desc','Описание',1],['player','Игрок',1],['method','Способ',1],['amount','Сумма',1],['by','Кто внёс',0]],
    rows:[['01.05.2026','поступление','тренировка','Основа · 1 мая','Артём','наличные','15,00','Иван П.'],['01.05.2026','расход','аренда зала','Школа №24','—','перевод','−42,00','Иван П.'],['03.05.2026','поступление','абонемент','8 сессий','Соня','перевод','110,00','Иван П.'],['07.05.2026','поступление','сбор','Новые мячи','Маша','наличные','20,00','Иван П.']],
    count:64 },
  attendance: { t:'Посещаемость', ic:'users',
    fields:[['player','Игрок',1],['visits','Тренировок',1],['seats','Мест всего',1],['noshow','Неявки',1],['cancel','Отмены',1],['last','Последний визит',1],['level','Уровень',0]],
    rows:[['Артём','12','12','0','1','28.05.2026','A'],['Маша','10','18','1','0','28.05.2026','A'],['Игорь','9','24','0','2','25.05.2026','B'],['Никита','8','8','1','1','23.05.2026','B']],
    count:22 },
  subs: { t:'Абонементы', ic:'ticket',
    fields:[['player','Игрок',1],['plan','План',1],['bought','Куплен',1],['left','Осталось',1],['until','До',1],['paid','Оплачено',1]],
    rows:[['Соня','8 сессий','03.05.2026','5','12.06.2026','110,00'],['Артём','8 сессий','21.04.2026','2','05.06.2026','110,00'],['Лера','4 сессии','15.05.2026','3','14.06.2026','60,00'],['Денис','12 сессий','02.05.2026','9','01.07.2026','150,00']],
    count:9 },
};

const WebReportsExport = () => {
  const nav = useNav();
  const [type, setType] = React.useState(nav.data.type || 'finance');
  const [period, setPeriod] = React.useState('Май 2026');
  const [fmt, setFmt] = React.useState('csv');
  const [enc, setEnc] = React.useState('utf8');
  const types = Object.entries(REPORT_TYPES).filter(([k]) => k !== 'subs' || getSetting('subsOn'));
  const T = REPORT_TYPES[type];
  const [on, setOn] = React.useState(() => Object.fromEntries(T.fields.map(([k,,d]) => [k, !!d])));
  React.useEffect(() => { setOn(Object.fromEntries(T.fields.map(([k,,d]) => [k, !!d]))); }, [type]);
  const cols = T.fields.map((f, i) => [...f, i]).filter(([k]) => on[k]);
  const mult = { 'Май 2026':1, 'Апрель 2026':0.8, 'Последние 3 месяца':2.6, 'С начала года':4.4 }[period] || 1;
  const rowsN = type === 'finance' ? Math.round(T.count * mult) : T.count;
  const sizeKb = Math.max(1, Math.round(rowsN * cols.length * 11 / 1024 * 10) / 10);
  const seg = (v, cur, set, l) => (
    <button key={v} onClick={() => set(v)} className="vt-btn vt-btn--sm" style={{
      background: cur===v ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: cur===v ? 'var(--vt-paper)' : 'var(--vt-ink)', fontWeight:600
    }}>{l}</button>
  );

  return (
  <WebShell activeNav="reports" title="Экспорт отчёта" sub="Период, поля и формат выгрузки"
    topRight={<>
      <button onClick={() => nav.back()} className="vt-btn vt-btn--ghost vt-btn--sm">Отмена</button>
      <button onClick={() => { nav.back(); setTimeout(() => nav.toast(`Скачан ${type}-${period.replace(/\s/g,'-').toLowerCase()}.${fmt} · ${rowsN} строк`), 80); }} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6}}><Icon name="arrow-d" size={14}/> Скачать {fmt.toUpperCase()}</button>
    </>}>
    <div style={{display:'grid', gridTemplateColumns:'360px 1fr', gap:18}}>
      <div style={{display:'flex', flexDirection:'column', gap:14}}>
        <div className="vt-card vt-card--raised" style={{padding:18}}>
          <label className="vt-label">Отчёт</label>
          <div style={{display:'flex', flexDirection:'column', gap:6}}>
            {types.map(([k, v]) => (
              <button key={k} onClick={() => setType(k)} style={{display:'flex', alignItems:'center', gap:12, padding:'12px 12px', borderRadius:'var(--r-field)', cursor:'pointer', textAlign:'left',
                background: type===k ? 'var(--vt-blue-soft-tile)' : 'var(--vt-ctl)', color:'var(--vt-ink)'}}>
                <Icon name={v.ic} size={17} stroke={type===k ? 'var(--vt-flame)' : 'var(--vt-icon-idle)'}/>
                <span style={{flex:1, fontSize:'var(--fs-base)', fontWeight:600}}>{v.t}</span>
                {type===k && <Icon name="check" size={15} stroke="var(--vt-flame)" sw={2.4}/>}
              </button>
            ))}
          </div>

          <label className="vt-label" style={{marginTop:16}}>Период</label>
          <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
            {['Май 2026','Апрель 2026','Последние 3 месяца','С начала года'].map(p => seg(p, period, setPeriod, p))}
          </div>

          <label className="vt-label" style={{marginTop:16}}>Формат</label>
          <div style={{display:'flex', gap:6}}>{seg('csv', fmt, setFmt, 'CSV')}{seg('xlsx', fmt, setFmt, 'Excel')}</div>
          {fmt === 'csv' && (
            <>
              <label className="vt-label" style={{marginTop:14}}>Кодировка</label>
              <div style={{display:'flex', gap:6}}>{seg('utf8', enc, setEnc, 'UTF-8')}{seg('cp1251', enc, setEnc, 'Windows-1251')}</div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:8, lineHeight:1.45}}>
                {enc === 'cp1251' ? 'Для старого Excel — кириллица откроется без кракозябр.' : 'Подходит для Google Sheets и новых версий Excel.'}
              </div>
            </>
          )}
        </div>

        <div className="vt-card vt-card--raised" style={{padding:18}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
            <label className="vt-label" style={{margin:0}}>Колонки</label>
            <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{cols.length} из {T.fields.length}</span>
          </div>
          <div style={{display:'flex', flexWrap:'wrap', gap:6, marginTop:10}}>
            {T.fields.map(([k, l]) => (
              <button key={k} onClick={() => setOn(s => ({...s, [k]: !s[k]}))} className="vt-chip" style={{cursor:'pointer', gap:6,
                background: on[k] ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: on[k] ? 'var(--vt-paper)' : 'var(--vt-ink-3)', borderColor:'transparent'}}>
                {on[k] && <Icon name="check" size={11} sw={2.6}/>}{l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:14, minWidth:0}}>
        <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr', gap:14}}>
          <div className="vt-card vt-card--hero" style={{padding:18}}>
            <div className="vt-cap" style={{opacity:.72}}>{T.t}</div>
            <div className="vt-mono" style={{fontSize:'var(--fs-4xl)', fontWeight:700, marginTop:8}}>{rowsN}</div>
            <div style={{fontSize:'var(--fs-xs)', opacity:.8, marginTop:2}}>строк за «{period.toLowerCase()}»</div>
          </div>
          <div className="vt-card" style={{padding:18}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Колонки</div>
            <div className="vt-mono" style={{fontSize:'var(--fs-3xl)', fontWeight:700, marginTop:8}}>{cols.length}</div>
          </div>
          <div className="vt-card vt-card--warm" style={{padding:18}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Размер</div>
            <div className="vt-mono" style={{fontSize:'var(--fs-3xl)', fontWeight:700, marginTop:8}}>≈ {String(sizeKb).replace('.', ',')} КБ</div>
          </div>
        </div>

        <div className="vt-card vt-card--raised" style={{padding:0, overflow:'hidden'}}>
          <div style={{padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
            <h3 style={{fontSize:'var(--fs-base)'}}>Предпросмотр</h3>
            <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>первые {T.rows.length} из {rowsN}</span>
          </div>
          {cols.length === 0 ? (
            <div style={{padding:'28px 18px', textAlign:'center', fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>Выберите хотя бы одну колонку</div>
          ) : (
            <div style={{overflowX:'auto'}}>
              <div style={{display:'grid', gridTemplateColumns:`repeat(${cols.length}, minmax(96px, 1fr))`, minWidth: cols.length * 96}}>
                {cols.map(([k, l]) => <div key={k} className="vt-cap" style={{padding:'10px 14px', background:'var(--vt-bone)', color:'var(--vt-mute-2)'}}>{l}</div>)}
                {T.rows.map((r, ri) => cols.map(([k,,,i]) => (
                  <div key={ri + k} style={{padding:'10px 14px', fontSize:'var(--fs-sm)', borderTop:'1px solid var(--vt-bone-2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                    fontFamily: /^[−\d]/.test(r[i]) ? 'var(--f-num)' : 'var(--f-body)', fontWeight: k === 'amount' || k === 'paid' ? 700 : 400,
                    color: String(r[i]).startsWith('−') ? 'var(--vt-rose)' : 'var(--vt-ink)'}}>{r[i]}</div>
                )))}
              </div>
            </div>
          )}
        </div>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', display:'flex', gap:8, alignItems:'flex-start'}}>
          <Icon name="bell" size={14} stroke="var(--vt-icon-idle)"/>
          <span>Файл формируется по данным кассы на момент скачивания. Удалённые записи в выгрузку не попадают.</span>
        </div>
      </div>
    </div>
  </WebShell>
  );
};

Object.assign(window, { WebEventCreate, WebLedgerEntry, WebContribCreate, WebReports, WebPlanCreate, WebReportsExport });
