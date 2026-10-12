// screens-public.jsx — Public event share page (no auth) · Bento Bold

// mode: 'fixed' — фиксированная цена · 'split' — делим сумму, запись открыта · 'split-closed' — сумма распределена
const PublicEvent = ({ mode = 'fixed' }) => {
  const isSplit = mode !== 'fixed';
  const isClosed = mode === 'split-closed';
  const cap = 14, unit = 15;
  const total = cap * unit;                    // 210 Br — сумма к сбору при делении
  const taken = isClosed ? 12 : 9;
  const pct = Math.round(taken / cap * 100);
  const perHead = total / taken;
  const money = (n) => `${n.toFixed(2).replace('.', ',')} Br`;
  const priceTile = !isSplit
    ? { label:'Цена', value:'15 Br', sub:'за одно место' }
    : isClosed
      ? { label:'Итог с человека', value: money(perHead), sub:`${total} Br ÷ ${taken} игроков` }
      : { label:'Цена · делим сумму', value:`≈ ${money(perHead)}`, sub:`при полном составе — ${money(unit)}` };
  const D = { fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, lineHeight:0.95, letterSpacing:0 };
  const N = { fontFamily:'var(--f-num)', fontWeight:700, lineHeight:1, letterSpacing:0 };

  const Tile = ({ label, value, sub, tone }) => (
    <div className="vt-card" style={{
      padding:'18px 20px', border:0,
      background: tone === 'orange' ? 'var(--vt-orange-soft)' : tone === 'blue' ? 'var(--vt-blue-soft-tile)' : 'var(--vt-bone)',
    }}>
      <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{label}</div>
      <div style={{...N, fontSize:'var(--fs-3xl)', marginTop:10}}>{value}</div>
      {sub && <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:6}}>{sub}</div>}
    </div>
  );

  return (
  <div style={{height:'100%', overflow:'auto', background:'var(--vt-paper)'}}>
    {/* Top bar */}
    <div style={{
      padding:'14px 32px', display:'flex', alignItems:'center', gap:14,
      position:'sticky', top:0, background:'color-mix(in oklab, var(--vt-paper) 92%, transparent)',
      backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', zIndex:5
    }}>
      <div className="vt-stripe" style={{fontSize:'var(--fs-md)'}}>
        <span className="vt-ball" style={{fontSize:'var(--fs-md)'}}/>
        <span style={{fontFamily:'var(--f-display)', textTransform:'uppercase'}}>Volley<span style={{color:'var(--vt-flame-ink)'}}>Time</span></span>
      </div>
      <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', padding:'6px 12px', background:'var(--vt-bone)', borderRadius:'var(--r-pill)'}}>volleytime.by/e/7gK4nT</div>
      <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:8}}>
        <button className="vt-btn vt-btn--ghost vt-btn--sm" style={{gap:6}}><Icon name="copy" size={14}/> Поделиться</button>
        <button className="vt-btn vt-btn--ink vt-btn--sm" style={{gap:6}}><Icon name="tg" size={14}/> Войти через Telegram</button>
      </div>
    </div>

    <div style={{maxWidth:1120, margin:'0 auto', padding:'24px 32px 40px'}}>
      {/* Organizer line */}
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:20}}>
        <span className="vt-avi vt-avi--brand" style={{width:32, height:32}}></span>
        <span style={{fontSize:'var(--fs-base)', fontWeight:600}}>VolleyTime Минск</span>
        <span style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>любительская группа · 14 игроков</span>
      </div>

      {/* Bento: hero + facts + roster */}
      <div style={{display:'grid', gridTemplateColumns:'1.35fr 1fr', gap:16}}>
        {/* Hero */}
        <div className="vt-card vt-card--hero" style={{padding:32, display:'flex', flexDirection:'column', minHeight:420, position:'relative', overflow:'hidden'}}>
          <div style={{position:'absolute', right:-60, top:-60, width:220, height:220, borderRadius:'50%', background:'var(--vt-orange)', opacity:0.9}}/>
          <div style={{position:'relative'}}>
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
              <span className="vt-chip" style={{background:'var(--vt-on-hero-fill)', color:'var(--vt-on-hero)', borderColor:'transparent'}}>{isClosed ? 'Запись закрыта' : 'Открытая запись'}</span>
              {isSplit && <span className="vt-chip" style={{background:'var(--vt-on-hero-fill)', color:'var(--vt-on-hero)', borderColor:'transparent'}}>Делим сумму {total} Br</span>}
            </div>
            <h1 style={{...D, fontSize:'var(--fs-7xl)', lineHeight:1, marginTop:22, color:'var(--vt-on-hero)'}}>Открытая<br/>игра</h1>
            <div style={{fontSize:'var(--fs-md)', color:'var(--vt-on-hero-2)', marginTop:18, lineHeight:1.5, maxWidth:460}}>
              Микс из играющих регулярно и новых ребят. Уровень B/A, 2 часа без перерыва.
            </div>
          </div>
          <div style={{marginTop:'auto', paddingTop:28, display:'flex', gap:10, flexWrap:'wrap', position:'relative'}}>
            <button className="vt-btn vt-btn--lg" style={{background:'var(--vt-orange)', color:'var(--vt-on-hero)', gap:8}}>
              <Icon name="tg" size={17}/> {isClosed ? 'Открыть в Telegram' : 'Записаться через Telegram'}
            </button>
            <button className="vt-btn vt-btn--lg" style={{background:'var(--vt-on-hero-fill)', color:'var(--vt-on-hero)', gap:8}}>
              <Icon name="calendar" size={17}/> В календарь
            </button>
          </div>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-on-hero-3)', marginTop:12, position:'relative'}}>
            {isClosed
              ? 'Запись закрылась за 2 часа до старта. Участники получили сумму к оплате в Telegram.'
              : isSplit
                ? 'Цена зависит от числа игроков — чем больше запишется, тем дешевле каждому.'
                : 'Войдёшь в Telegram — попадёшь в свою запись. Никакой регистрации.'}
          </div>
        </div>

        {/* Facts + capacity */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:'auto auto 1fr', gap:16}}>
          <Tile label="Пятница" value="30 мая" sub="19:30 — 22:00"/>
          <Tile label={priceTile.label} value={priceTile.value} sub={priceTile.sub} tone="orange"/>
          <div className="vt-card" style={{gridColumn:'1 / -1', padding:'18px 20px', border:0, background:'var(--vt-bone)', display:'flex', alignItems:'center', gap:14}}>
            <div style={{width:44, height:44, borderRadius:'var(--r-btn)', background:'var(--vt-paper)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
              <Icon name="pin" size={20}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:'var(--fs-md)', fontWeight:700}}>СК «Заслонова»</div>
              <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:2}}>ул. Заслонова, 27 · Минск</div>
            </div>
          </div>
          <div className="vt-card vt-card--raised" style={{gridColumn:'1 / -1', padding:'20px 22px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
              <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Состав</div>
              <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>обновлено только что</span>
            </div>
            <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:10}}>
              <span style={{...N, fontSize:'var(--fs-6xl)'}}>{taken}</span>
              <span style={{...N, fontSize:'var(--fs-2xl)', color:'var(--vt-mute-2)'}}>/ {cap}</span>
              <span style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginLeft:4}}>{isClosed ? 'мест · состав финальный' : 'мест занято'}</span>
            </div>
            <div style={{display:'flex', gap:4, marginTop:14}}>
              {Array.from({length:cap}).map((_, i) => (
                <span key={i} style={{flex:1, height:8, borderRadius:'var(--r-pill)', background: i < taken ? meterTint(pct) : 'var(--vt-bone-2)'}}/>
              ))}
            </div>
            <div style={{display:'flex', alignItems:'center', gap:10, marginTop:16}}>
              <div className="vt-stack">
                {PEOPLE.slice(0, 5).map((p, i) => <Avi key={i} name={p.name} init={p.init} tag={p.tag} size="sm"/>)}
              </div>
              <span style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>Артём, Никита, Маша и ещё {taken - 3}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Info row */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginTop:16}}>
        {[
          ['pin', 'Как добраться', 'От м. «Площадь Победы» 9 минут пешком. Парковка во дворе.'],
          ['star', 'Что взять', 'Сменка для зала, форма любая. Мячи свои не нужны — есть Mikasa MVA200.'],
          ['wallet', 'Оплата', isClosed
            ? 'Сумма к оплате отправлена участникам в Telegram. Наличными организатору или переводом.'
            : isSplit
              ? 'Точную сумму узнаете после закрытия записи — придёт в Telegram. Абонементы здесь не применяются.'
              : 'Наличными организатору или переводом на карту. Онлайн-оплата — скоро.'],
        ].map(([ic, h, p]) => (
          <div key={h} className="vt-card" style={{padding:'20px 22px', border:0, background:'var(--vt-bone)'}}>
            <Icon name={ic} size={20} stroke="var(--vt-flame)"/>
            <div style={{fontSize:'var(--fs-md)', fontWeight:700, marginTop:12}}>{h}</div>
            <div style={{fontSize:'var(--fs-base)', lineHeight:1.5, color:'var(--vt-ink-3)', marginTop:6}}>{p}</div>
          </div>
        ))}
      </div>

      {/* Rules + QR */}
      <div style={{display:'grid', gridTemplateColumns:'1.35fr 1fr', gap:16, marginTop:16}}>
        {isSplit ? (
        <div className="vt-card" style={{padding:'20px 22px', border:0, background:'var(--vt-bone)'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{isClosed ? 'Как посчитана цена' : 'Как считается цена'}</div>
            <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{total} Br ÷ число игроков</span>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8, marginTop:14}}>
            {[9, 11, 12, 14].map(n => {
              const now = n === taken;
              return (
                <div key={n} style={{padding:'12px', borderRadius:'var(--r-btn)', background: now ? 'var(--vt-inverse-bg)' : 'var(--vt-raised)', color: now ? 'var(--vt-inverse-fg)' : 'var(--vt-ink)'}}>
                  <div style={{fontSize:'var(--fs-xs)', color: now ? 'color-mix(in oklab, var(--vt-inverse-fg) 70%, transparent)' : 'var(--vt-mute-2)'}}>{n} игроков{now ? (isClosed ? ' · итог' : ' · сейчас') : ''}</div>
                  <div style={{...N, fontSize:'var(--fs-xl)', marginTop:6}}>{money(total / n)}</div>
                </div>
              );
            })}
          </div>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:14, lineHeight:1.45}}>
            {isClosed
              ? <>Сумма зафиксирована 30 мая в 17:30. Кто занял несколько мест, платит за каждое: 3 места — <b style={{color:'var(--vt-ink)'}}>{money(perHead * 3)}</b>.</>
              : <>Итог зафиксируется при закрытии записи — <b style={{color:'var(--vt-ink)'}}>30 мая в 17:30</b>, за 2 ч до старта. Можно занять до 3 мест одной записью.</>}
          </div>
        </div>
        ) : (
        <div className="vt-card" style={{padding:'20px 22px', border:0, background:'var(--vt-bone)'}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Правила записи</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:12}}>
            <div>
              <div style={{...N, fontSize:'var(--fs-2xl)'}}>за 2 ч</div>
              <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>закрывается запись до старта</div>
            </div>
            <div>
              <div style={{...N, fontSize:'var(--fs-2xl)'}}>до 3</div>
              <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>мест можно занять одной записью</div>
            </div>
          </div>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:14, lineHeight:1.45}}>
            Освободившееся место уйдёт первому из листа ожидания — он получит сообщение в Telegram.
          </div>
        </div>
        )}
        <div className="vt-card" style={{padding:'20px 22px', border:0, background:'var(--vt-bone)', display:'flex', alignItems:'center', gap:18}}>
          <div style={{width:96, height:96, borderRadius:'var(--r-btn)', background:'var(--vt-paper)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
            <Icon name="qr" size={70} sw={1.2}/>
          </div>
          <div>
            <div style={{fontSize:'var(--fs-md)', fontWeight:700}}>QR-код события</div>
            <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:6, lineHeight:1.45}}>Покажите друзьям на тренировке — откроется эта же страница.</div>
          </div>
        </div>
      </div>

      {/* Platform CTA */}
      <div style={{
        marginTop:16, padding:'26px 30px', borderRadius:'var(--r-card)',
        background:'var(--vt-night)', color:'var(--vt-on-hero)',
        display:'flex', alignItems:'center', gap:20
      }}>
        <div style={{flex:1}}>
          <div className="vt-cap" style={{color:'var(--vt-on-hero-3)'}}>Запись сделана в VolleyTime</div>
          <div style={{...D, fontSize:'var(--fs-3xl)', marginTop:8}}>Свой клуб? Сделай так же.</div>
          <div style={{fontSize:'var(--fs-base)', color:'var(--vt-on-hero-3)', marginTop:6}}>Telegram-first платформа для тренировок и турниров.</div>
        </div>
        <button className="vt-btn vt-btn--lg" style={{background:'var(--vt-orange)', color:'var(--vt-on-hero)', gap:8}}>volleytime.by <Icon name="arrow-r" size={16}/></button>
      </div>

      <div style={{marginTop:22, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', textAlign:'center'}}>
        © VolleyTime 2026 · поддержка @volleytime_help · политика конфиденциальности
      </div>
    </div>
  </div>
  );
};

Object.assign(window, { PublicEvent });
