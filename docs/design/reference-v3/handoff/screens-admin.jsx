// screens-admin.jsx — Root admin (platform owner) screens
// Distinct from org SaaS: dark sidebar = "platform" mode signal.

const AdminShell = ({ activeNav, title, sub, topRight, children }) => {
  const nav = typeof useNav === 'function' ? useNav() : null;
  const handleNav = (k) => {
    if (!nav) return;
    const map = { overview:'overview', orgs:'orgs', users:'users', credits:'credits', audit:'audit', payouts:'payouts', settings:'settings' };
    if (map[k]) nav.reset(map[k]);
  };
  const nav_ = [
    ['overview', 'chart', 'Обзор платформы'],
    ['orgs', 'building', 'Организации'],
    ['users', 'users', 'Пользователи'],
    ['credits', 'card', 'Credits & тарифы'],
    ['payouts', 'wallet', 'Подписки & выплаты'],
    ['audit', 'clock', 'Аудит'],
    ['settings', 'settings', 'Настройки'],
  ];
  return (
    <div className="vt-web" style={{gridTemplateColumns:'234px 1fr'}}>
      <aside style={{
        background:'var(--vt-blue-ink)',
        color:'var(--vt-paper)',
        padding:'18px 12px',
        display:'flex', flexDirection:'column', gap:2,
        overflow:'auto',
      }}>
        <div style={{display:'flex', alignItems:'center', gap:10, padding:'2px 8px 6px'}}>
          <span className="vt-ball vt-ball--on-dark" style={{fontSize:'var(--fs-xl)'}}/>
          <div style={{flex:1}}>
            <div style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-md)'}}>Volley<span style={{color:'var(--vt-flame-ink)'}}>Time</span></div>
            <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', opacity:0.55, letterSpacing:'0.08em'}}>PLATFORM ROOT</div>
          </div>
        </div>

        <div style={{
          padding:'10px 12px', margin:'10px 0 6px',
          background:'color-mix(in oklab, var(--vt-orange) 14%, transparent)',
          border:'1px solid color-mix(in oklab, var(--vt-orange) 32%, transparent)',
          borderRadius:'var(--r-sm)', fontSize:'var(--fs-2xs)', lineHeight:1.4
        }}>
          <div className="vt-cap" style={{color:'var(--vt-orange)', fontSize:'var(--fs-2xs)'}}>Внимание</div>
          <div style={{marginTop:4, opacity:0.85}}>Действия здесь влияют на всех пользователей. Логируются.</div>
        </div>

        {nav_.map(([k, ic, l]) => (
          <a key={k} onClick={() => handleNav(k)} style={{
            display:'flex', alignItems:'center', gap:10,
            padding:'8px 10px', borderRadius:'var(--r-sm)', cursor:'pointer',
            fontSize:'var(--fs-sm)', fontWeight:500,
            color: activeNav===k ? 'var(--vt-ink)' : 'var(--vt-on-hero-3)',
            background: activeNav===k ? 'var(--vt-paper)' : 'transparent',
            fontFamily:'var(--f-body)',
          }}>
            <Icon name={ic} size={15}/>
            <span>{l}</span>
          </a>
        ))}

        <div style={{marginTop:'auto', paddingTop:14}}>
          <div className="vt-cap" style={{opacity:0.4, padding:'0 10px 6px'}}>Health</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, padding:'0 4px'}}>
            <div style={{padding:'8px 10px', borderRadius:'var(--r-sm)', background:'color-mix(in oklab, var(--vt-grass) 20%, transparent)', border:'1px solid color-mix(in oklab, var(--vt-grass) 36%, transparent)'}}>
              <div className="vt-cap" style={{opacity:0.7, fontSize:'var(--fs-2xs)'}}>API</div>
              <div style={{display:'flex', alignItems:'center', gap:6, marginTop:4}}>
                <span style={{width:6, height:6, borderRadius:'var(--r-pill)', background:'var(--vt-grass)'}}/>
                <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', fontWeight:600}}>p99 142ms</span>
              </div>
            </div>
            <div style={{padding:'8px 10px', borderRadius:'var(--r-sm)', background:'color-mix(in oklab, var(--vt-grass) 20%, transparent)', border:'1px solid color-mix(in oklab, var(--vt-grass) 36%, transparent)'}}>
              <div className="vt-cap" style={{opacity:0.7, fontSize:'var(--fs-2xs)'}}>Bot</div>
              <div style={{display:'flex', alignItems:'center', gap:6, marginTop:4}}>
                <span style={{width:6, height:6, borderRadius:'var(--r-pill)', background:'var(--vt-grass)'}}/>
                <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', fontWeight:600}}>up 28d</span>
              </div>
            </div>
          </div>
          <div style={{padding:'10px 10px 0', fontSize:'var(--fs-2xs)', filter:'grayscale(1)', fontFamily:'var(--f-mono)'}}>
            v0.8.1-rc4 · ru-vps-01
          </div>
        </div>
      </aside>

      <main className="vt-web__main">
        <div className="vt-web__topbar">
          <div style={{flexShrink:0, minWidth:0, marginRight:16}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <h2 style={{fontSize:'var(--fs-xl)', whiteSpace:'nowrap'}}>{title}</h2>
              <span className="vt-chip vt-chip--solid" style={{fontSize:'var(--fs-2xs)', flexShrink:0}}>ROOT</span>
            </div>
            {sub && <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{sub}</div>}
          </div>
          <div style={{display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0, justifyContent:'flex-end'}}>
            {topRight}
            <div className="vt-field" style={{width:260, padding:'8px 12px', display:'flex', alignItems:'center', gap:8, color:'var(--vt-mute)', fontSize:'var(--fs-sm)'}}>
              <Icon name="search" size={14}/> <span>org / user / id...</span>
            </div>
            <button onClick={() => nav && nav.toast('Уведомлений нет')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'8px 10px'}}><Icon name="bell" size={16}/></button>
            <div style={{display:'flex', alignItems:'center', gap:8, padding:'4px 10px 4px 4px', borderRadius:'var(--r-pill)', background:'var(--vt-bone-2)'}}>
              <Avi size="sm" name="Root" init="R" tag="ink"/>
              <span style={{fontSize:'var(--fs-sm)', fontWeight:600}}>root@volleytime</span>
            </div>
          </div>
        </div>
        <div style={{padding:'24px 28px'}}>{children}</div>
      </main>
    </div>
  );
};

// ============================================================
// AdminOverview
// ============================================================
const AdminOverview = () => {
  const nav = useNav();
  return (
  <AdminShell
    activeNav="overview"
    title="Обзор платформы"
    sub="May 2026 · Private Beta · 5 организаций"
    topRight={<button onClick={() => nav.toast('Метрики выгружены · platform-may-2026.csv')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="arrow-d" size={14}/> Экспорт метрик</button>}
  >
    {/* North star row */}
    <div style={{display:'grid', gridTemplateColumns:'minmax(0,1.35fr) minmax(0,1fr) minmax(0,1fr)', gridTemplateRows:'auto auto', gap:16, marginBottom:18}}>
      <div className="vt-card vt-card--hero" style={{padding:24, position:'relative', overflow:'hidden', gridRow:'span 2', display:'flex', flexDirection:'column'}}>
        <div style={{position:'absolute', right:-50, top:-50, width:180, height:180, borderRadius:'50%', background:'var(--vt-orange)'}}/>
        <div style={{position:'relative', display:'flex', flexDirection:'column', flex:1}}>
          <div className="vt-cap" style={{color:'var(--vt-on-hero-3)'}}>Главная метрика · активные группы за неделю</div>
          <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-7xl)', marginTop:'auto', paddingTop:28, lineHeight:1}}>4</div>
          <div style={{display:'flex', alignItems:'center', gap:8, marginTop:10, fontSize:'var(--fs-sm)'}}>
            <span style={{color:'var(--vt-grass-on-hero)', display:'inline-flex', alignItems:'center', gap:4}}><Icon name="arrow-u" size={12}/> +1 за неделю</span>
            <span style={{color:'var(--vt-on-hero-3)'}}>из 5 зарегистрированных</span>
          </div>
        </div>
      </div>
      {[
        ['MRR · прогноз', '52 Br', '+12 Br', 'grass'],
        ['Событий за неделю', '38', '+9'],
        ['Записей за неделю', '438', '+87'],
      ].map(([l, v, d, c], i) => (
        <div key={i} className="vt-card" style={{padding:18, gridColumn: i === 2 ? 'span 2' : undefined, background:['var(--vt-orange-soft)','var(--vt-blue-soft-tile)','var(--vt-bone)'][i]}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{l}</div>
          <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-4xl)', lineHeight:1, marginTop:14}}>{v}</div>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-ink-3)', marginTop:8, display:'inline-flex', alignItems:'center', gap:4}}>
            <span style={{color: c==='grass' ? 'var(--vt-grass)' : 'var(--vt-ink)'}}><Icon name="arrow-u" size={11}/></span> {d} к прошлой
          </div>
        </div>
      ))}
    </div>

    <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:16}}>
      {/* Activity feed */}
      <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
        <div style={{padding:'16px 18px', borderBottom:'1px solid var(--vt-bone-2)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h3 style={{fontSize:'var(--fs-md)'}}>Активность за 24 часа</h3>
          <div style={{display:'flex', gap:4}}>
            {['Все','События','Регистрации','Биллинг','Ошибки'].map((t,i) => (
              <button key={t} className="vt-btn vt-btn--sm" style={{
                background:i===0?'var(--vt-ink)':'transparent',
                color:i===0?'var(--vt-paper)':'var(--vt-mute-2)',
                fontSize:'var(--fs-2xs)', padding:'4px 10px', fontWeight:600,
              }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{padding:'4px 0'}}>
          {[
            ['14:22', 'event.payment.confirmed', 'VT Минск', 'Иван П. подтвердил оплату Никиты · 15 Br', 'grass'],
            ['13:08', 'org.member.invited', 'СОК Витебск', 'sergey приглашён в команду · org_3', 'ink'],
            ['12:30', 'billing.credits.purchased', 'СпайкКлуб', 'Купил пакет 30 credits · +120 Br', 'flame'],
            ['11:15', 'event.created', 'VT Минск', '«Основа · 4 июня · 20:00» · −1 credit', 'ink'],
            ['10:48', 'auth.user.signed_up', '—', 'Новый пользователь @marina_v (через invite org_2)', 'grass'],
            ['09:02', 'billing.credits.granted', 'СОК Витебск', 'root@volleytime выдал +10 credits (промо)', 'amber'],
            ['08:44', 'system.error.handled', 'apps/bot', 'Telegram 429 rate limit · retried 3x', 'rose'],
          ].map(([t, ev, org, msg, c], i, arr) => (
            <div key={i} style={{display:'grid', gridTemplateColumns:'60px 220px 1fr 100px', gap:14, padding:'10px 18px', borderBottom: i<arr.length-1?'1px solid var(--vt-bone-2)':'none', alignItems:'center'}}>
              <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{t}</div>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span style={{width:6, height:6, borderRadius:'var(--r-pill)', background:`var(--vt-${c})`}}/>
                <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-ink-3)'}}>{ev}</span>
              </div>
              <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-ink-3)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{msg}</div>
              <div style={{fontSize:'var(--fs-xs)', fontWeight:500, textAlign:'right'}}>{org}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right column */}
      <div style={{display:'flex', flexDirection:'column', gap:14}}>
        {/* Hypothesis tracker */}
        <div className="vt-card" style={{padding:18}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
            <h3 style={{fontSize:'var(--fs-md)'}}>Гипотезы Phase 10</h3>
            <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>2 / 4</span>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:14}}>
            {[
              ['H1', 'Telegram-first', 82, 'на пути', 'grass', '≥80%'],
              ['H2', 'Event credits', 30, 'надо больше', 'amber', '≥30%'],
              ['H3', 'Manual payments OK', 94, 'подтв.', 'grass', '≥90%'],
              ['H4', 'Абонементы — киллер', 21, 'риск', 'rose', '≥30%'],
            ].map(([id, name, pct, st, c, target], i) => (
              <div key={i}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', fontSize:'var(--fs-xs)'}}>
                  <span><b style={{fontFamily:'var(--f-mono)', color:'var(--vt-mute-2)'}}>{id}</b>  {name}</span>
                  <span className="vt-mono" style={{fontWeight:600, color:`var(--vt-${c})`}}>{pct}%</span>
                </div>
                <div className="vt-meter" style={{marginTop:6, height:5}}><i style={{width:`${pct}%`, background:`var(--vt-${c})`}}/></div>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:4, fontFamily:'var(--f-mono)'}}>
                  <span>target: {target}</span>
                  <span>{st}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mini chart */}
        <div className="vt-card" style={{padding:18}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
            <h3 style={{fontSize:'var(--fs-base)'}}>Bookings · 14 дней</h3>
            <span className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-grass)', fontWeight:600}}>+87</span>
          </div>
          <div style={{display:'flex', gap:4, alignItems:'flex-end', height:80, marginTop:16}}>
            {[28,34,18,42,38,52,44,32,48,55,68,71,58,87].map((h, i) => (
              <div key={i} style={{flex:1, height:`${h}%`, background:i===13?'var(--vt-flame)':'var(--vt-stroke-2)', borderRadius:'var(--r-xs)'}}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  </AdminShell>
  );
};

// ============================================================
// AdminOrgs
// ============================================================
const AdminOrgs = () => {
  const nav = useNav();
  const orgs = [
    { name:'VolleyTime Минск',   slug:'vt-minsk',    owner:'Иван П.',     plan:'beta',  credits:32, members:14, events:12, last:'5 мин', mrr:0,  health:'grass', flag:'pilot' },
    { name:'СпайкКлуб',          slug:'spike-club',  owner:'Антон К.',    plan:'beta',  credits:14, members:22, events:18, last:'1 ч',   mrr:0,  health:'grass' },
    { name:'СОК Витебск',        slug:'sok-vit',     owner:'Сергей Б.',   plan:'beta',  credits:8,  members:9,  events:6,  last:'3 ч',   mrr:0,  health:'amber' },
    { name:'MinskVolley.PRO',    slug:'mv-pro',      owner:'Ольга Р.',    plan:'beta',  credits:2,  members:6,  events:3,  last:'2 д',   mrr:0,  health:'amber', flag:'low' },
    { name:'Тестовая (sandbox)', slug:'sandbox',     owner:'root',        plan:'demo',  credits:5,  members:1,  events:0,  last:'14 д',  mrr:0,  health:'mute', flag:'sandbox' },
  ];
  return (
    <AdminShell
      activeNav="orgs"
      title="Организации"
      sub="5 всего · 4 активных за неделю · 1 в риске"
      topRight={
        <>
          <button onClick={() => nav.toast('CSV организаций скачан')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="arrow-d" size={13}/> CSV</button>
          <button onClick={() => nav.push('org-create')} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6}}><Icon name="plus" size={14}/> Создать вручную</button>
        </>
      }
    >
      <div style={{display:'flex', gap:8, marginBottom:14, alignItems:'center'}}>
        {[
          ['Все', 5, true],
          ['Активные', 4],
          ['Demo', 1],
          ['В риске', 1, false, 'amber'],
          ['Заблокированы', 0],
        ].map(([l, n, act, tint], i) => (
          <button key={l} className="vt-btn vt-btn--sm" style={{
            background: act?'var(--vt-ink)':'var(--vt-ctl)',
            color: act?'var(--vt-paper)':'var(--vt-ink)',
            gap:6, fontWeight:600
          }}>{l} <span style={{
            padding:'0 6px', borderRadius:'var(--r-pill)', fontSize:'var(--fs-2xs)',
            background: tint==='amber' ? 'var(--vt-amber)' : act?'var(--vt-on-hero-fill)':'var(--vt-bone-2)',
            color: tint==='amber' ? 'var(--vt-ink)' : 'inherit'
          }}>{n}</span></button>
        ))}
        <div style={{marginLeft:'auto', display:'flex', gap:6}}>
          <button onClick={() => nav.sheet({
            title:'Фильтры организаций',
            items:[
              { icon:'card', label:'План: beta', onClick: () => nav.toast('Фильтр: beta') },
              { icon:'card', label:'План: demo', onClick: () => nav.toast('Фильтр: demo') },
              { icon:'wallet', label:'Низкий баланс credits (<5)', onClick: () => nav.toast('Фильтр: low credits') },
              { icon:'clock', label:'Неактивны >7 дней', onClick: () => nav.toast('Фильтр: inactive') },
              { icon:'chart', label:'По убыванию событий', onClick: () => nav.toast('Сортировка: events') },
            ]
          })} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="filter" size={13}/> Фильтры</button>
        </div>
      </div>

      <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
        <div style={{display:'grid', gridTemplateColumns:'2fr 140px 90px 100px 90px 110px 90px 40px', padding:'10px 18px', borderBottom:'1px solid var(--vt-bone-2)'}}>
          {['Организация','Владелец','План','Credits','Игроки','Событий / мес','Активн.',''].map((h,i)=>(
            <div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>
          ))}
        </div>
        {orgs.map((o, i) => (
          <div key={i} onClick={() => nav.push('org-detail', { org: o })} style={{display:'grid', gridTemplateColumns:'2fr 140px 90px 100px 90px 110px 90px 40px', padding:'14px 18px', borderBottom: i<orgs.length-1?'1px solid var(--vt-bone-2)':'none', alignItems:'center', cursor:'pointer'}}
            onMouseEnter={ev => ev.currentTarget.style.background='var(--vt-bone-2)'}
            onMouseLeave={ev => ev.currentTarget.style.background='transparent'}
          >
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <span className="vt-avi vt-avi--sm" style={{
                background: `linear-gradient(135deg, var(--vt-${['flame','blue-ink','grass','orange','night'][i]}), var(--vt-night))`,
                color:'var(--vt-on-hero)', fontSize:'var(--fs-2xs)', fontWeight:700
              }}>{o.name.slice(0,2).toUpperCase()}</span>
              <div>
                <div style={{fontSize:'var(--fs-base)', fontWeight:600, display:'flex', alignItems:'center', gap:6}}>
                  {o.name}
                  {o.flag === 'pilot' && <span className="vt-chip vt-chip--flame" style={{fontSize:'var(--fs-2xs)'}}>pilot</span>}
                  {o.flag === 'low' && <span className="vt-chip vt-chip--amber" style={{fontSize:'var(--fs-2xs)'}}>низкий баланс</span>}
                  {o.flag === 'sandbox' && <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>sandbox</span>}
                </div>
                <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>org_{o.slug}</div>
              </div>
            </div>
            <div style={{fontSize:'var(--fs-sm)'}}>{o.owner}</div>
            <div><span className="vt-chip" style={{fontSize:'var(--fs-2xs)', background: o.plan==='beta'?'var(--vt-bone-2)':'var(--vt-accent-soft)'}}>{o.plan}</span></div>
            <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-sm)', color: o.credits<5?'var(--vt-amber)':'inherit'}}>{o.credits}</div>
            <div className="vt-mono" style={{fontSize:'var(--fs-sm)'}}>{o.members}</div>
            <div>
              <div className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{o.events}</div>
              <div className="vt-meter" style={{marginTop:4, width:80}}><i style={{width:`${Math.min(100, o.events*5)}%`, background:'var(--vt-grass)'}}/></div>
            </div>
            <div style={{fontSize:'var(--fs-xs)', display:'flex', alignItems:'center', gap:6}}>
              <span style={{width:6, height:6, borderRadius:'var(--r-pill)', background:`var(--vt-${o.health})`}}/>
              {o.last}
            </div>
            <div onClick={ev => ev.stopPropagation()}><ActionMore mode="popover" align="right" items={[
              { icon:'globe', label:'Войти как owner', onClick: () => nav.toast(`Импер-сессия · ${o.name}`) },
              { icon:'gift', label:'Выдать credits', onClick: () => nav.toast('+10 credits выдано') },
              { icon:'settings', label:'Feature flags', onClick: () => nav.toast('Открыты feature-флаги') },
              '---',
              { icon:'trash', tone:'danger', label:'Заблокировать организацию', onClick: () => nav.alert({
                title:`Заблокировать «${o.name}»?`, body:'Доступ владельцу и игрокам будет приостановлен. Это можно отменить.',
                confirm:'Заблокировать', danger:true, onConfirm: () => nav.toast(`${o.name} заблокирован`)
              })},
            ]}/></div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
};

// ============================================================
// AdminOrgDetail
// ============================================================
const AdminOrgDetail = () => {
  const nav = useNav();
  return (
  <AdminShell
    activeNav="orgs"
    title="VolleyTime Минск"
    sub="org_vt-minsk · pilot · создана 18 марта 2026"
    topRight={
      <>
        <button onClick={() => nav.toast(`Импер-сессия · войдите как owner`)} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="globe" size={13}/> Открыть как owner</button>
        <button onClick={() => nav.alert({
          title:'Заблокировать организацию?', body:'Доступ владельцу и игрокам будет приостановлен.',
          confirm:'Заблокировать', danger:true, onConfirm: () => { nav.reset('orgs'); setTimeout(() => nav.toast('Организация заблокирована'), 80); }
        })} className="vt-btn vt-btn--ghost vt-btn--sm" style={{color:'var(--vt-rose)'}}>Заблокировать</button>
      </>
    }
  >
    {/* Tabs */}
    <div style={{display:'flex', gap:2, borderBottom:'1px solid var(--vt-bone-2)', marginBottom:18}}>
      {['Обзор','Члены','События','Credits','Финансы','Аудит'].map((t,i) => (
        <button key={t} style={{
          padding:'10px 14px', fontSize:'var(--fs-sm)', fontWeight:600,
          color: i===0?'var(--vt-ink)':'var(--vt-mute-2)',
          borderBottom: i===0?'2px solid var(--vt-flame)':'2px solid transparent',
          marginBottom:-1,
        }}>{t}</button>
      ))}
    </div>

    {/* Summary cards */}
    <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginBottom:18}}>
      {[
        ['Credits balance', '32', '−12 в месяц', 'flame'],
        ['Игроков', '14', '+2 за неделю'],
        ['Events за май', '12', '87% заполнение'],
        ['Касса org', '+248,50 Br', '+82,50 неделя', 'grass'],
      ].map(([l, v, d, c], i) => (
        <div key={i} className="vt-card" style={{padding:16}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{l}</div>
          <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-2xl)', marginTop:8, color: c==='flame'?'var(--vt-flame)':c==='grass'?'var(--vt-grass)':'inherit'}}>{v}</div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:6}}>{d}</div>
        </div>
      ))}
    </div>

    <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:16}}>
      {/* Left: org meta + actions */}
      <div style={{display:'flex', flexDirection:'column', gap:14}}>
        <div className="vt-card" style={{padding:18}}>
          <h3 style={{fontSize:'var(--fs-md)'}}>Профиль</h3>
          <div style={{display:'grid', gridTemplateColumns:'180px 1fr', columnGap:14, rowGap:10, marginTop:14, fontSize:'var(--fs-sm)'}}>
            <span style={{color:'var(--vt-mute-2)'}}>ID</span><span className="vt-mono">org_vt-minsk · 7gK4nT</span>
            <span style={{color:'var(--vt-mute-2)'}}>Владелец</span><span>Иван Петренко · @ivan_p · <span className="vt-mono" style={{color:'var(--vt-mute-2)'}}>usr_92F8</span></span>
            <span style={{color:'var(--vt-mute-2)'}}>Создана</span><span>18 марта 2026 · 4 мес назад</span>
            <span style={{color:'var(--vt-mute-2)'}}>Город / TZ</span><span>Минск · Europe/Minsk (UTC+3)</span>
            <span style={{color:'var(--vt-mute-2)'}}>Phase 10 cohort</span><span><span className="vt-chip vt-chip--flame" style={{fontSize:'var(--fs-2xs)'}}>Pilot</span> · попала в Private Beta 22 апр</span>
            <span style={{color:'var(--vt-mute-2)'}}>Feature flags</span>
            <span style={{display:'flex', gap:6, flexWrap:'wrap'}}>
              <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>subscriptions</span>
              <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>ledger</span>
              <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>credits</span>
              <span className="vt-chip" style={{fontSize:'var(--fs-2xs)', opacity:0.5}}>contributions: off</span>
              <span className="vt-chip" style={{fontSize:'var(--fs-2xs)', opacity:0.5}}>online_payments: off</span>
            </span>
          </div>
        </div>

        {/* Activity timeline */}
        <div className="vt-card" style={{padding:18}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
            <h3 style={{fontSize:'var(--fs-md)'}}>События организации · 7 дней</h3>
            <button className="vt-btn vt-btn--ghost vt-btn--sm" style={{fontSize:'var(--fs-xs)'}}>Полный аудит</button>
          </div>
          <div style={{display:'flex', flexDirection:'column', marginTop:14}}>
            {[
              ['14:22', 'payment.confirmed', 'Иван П.', '+15 Br · Никита · Основа 28 мая', 'grass'],
              ['12:08', 'payment.confirmed', 'Иван П.', '+15 Br · Маша · Открытая 30 мая', 'grass'],
              ['10:00', 'event.created', 'Иван П.', 'Основа · 4 июня 20:00 · −1 credit', 'flame'],
              ['Вчера 19:31', 'subscription.purchased', 'Соня', '8 сессий · 110 Br', 'ink'],
              ['Вчера 14:02', 'member.joined', 'Лёша', 'через invite org_7gK4nT', 'grass'],
              ['Вчера 09:50', 'ledger.expense', 'Иван П.', '−42 Br · rent / Школа №24', 'rose'],
              ['22 мая 16:10', 'credits.purchased', 'Иван П.', '+30 credits · 120 Br пакет', 'flame'],
            ].map(([t, ev, who, msg, c], i, arr) => (
              <div key={i} style={{display:'grid', gridTemplateColumns:'90px 170px 80px 1fr', gap:12, padding:'8px 0', borderBottom:i<arr.length-1?'1px solid var(--vt-bone-2)':'none', alignItems:'center'}}>
                <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{t}</div>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <span style={{width:6, height:6, borderRadius:'var(--r-pill)', background:`var(--vt-${c})`}}/>
                  <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-ink-3)'}}>{ev}</span>
                </div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{who}</div>
                <div style={{fontSize:'var(--fs-sm)'}}>{msg}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: admin actions */}
      <div style={{display:'flex', flexDirection:'column', gap:14}}>
        <div className="vt-card vt-card--hero" style={{padding:18}}>
          <h3 style={{fontSize:'var(--fs-md)'}}>Действия root</h3>
          <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:14}}>
            <button onClick={() => nav.sheet({
              title:'Выдать credits', sub:'Promo, compensation или manual grant',
              items:[
                { icon:'gift', label:'+5 credits · промо', onClick: () => nav.toast('+5 credits выдано · промо за фидбек') },
                { icon:'gift', label:'+10 credits · промо', onClick: () => nav.toast('+10 credits выдано') },
                { icon:'gift', label:'+1 credit · compensation', onClick: () => nav.toast('+1 credit · компенсация') },
              ]
            })} className="vt-btn" style={{background:'var(--vt-on-hero-fill)', color:'var(--vt-paper)', justifyContent:'space-between', width:'100%'}}>
              <span style={{display:'flex', alignItems:'center', gap:8}}><Icon name="gift" size={14}/> Выдать credits</span>
              <Icon name="chevron-r" size={14}/>
            </button>
            <button onClick={() => nav.toast('Feature flags · contributions, online_payments, crm_pro')} className="vt-btn" style={{background:'var(--vt-on-hero-fill)', color:'var(--vt-paper)', justifyContent:'space-between', width:'100%'}}>
              <span style={{display:'flex', alignItems:'center', gap:8}}><Icon name="settings" size={14}/> Feature flags</span>
              <Icon name="chevron-r" size={14}/>
            </button>
            <button onClick={() => nav.toast('Импер-сессия активна · вы видите интерфейс как owner')} className="vt-btn" style={{background:'var(--vt-on-hero-fill)', color:'var(--vt-paper)', justifyContent:'space-between', width:'100%'}}>
              <span style={{display:'flex', alignItems:'center', gap:8}}><Icon name="globe" size={14}/> Войти как owner</span>
              <Icon name="chevron-r" size={14}/>
            </button>
            <button onClick={() => nav.alert({
              title:'Заблокировать организацию?', body:'Доступ владельцу и игрокам будет приостановлен. Это записывается в аудит.',
              confirm:'Заблокировать', danger:true, onConfirm: () => { nav.reset('orgs'); setTimeout(() => nav.toast('Организация заблокирована'), 80); }
            })} className="vt-btn" style={{background:'color-mix(in oklab, var(--vt-rose) 20%, transparent)', color:'var(--vt-rose-on-ink)', justifyContent:'space-between', width:'100%', border:'1px solid color-mix(in oklab, var(--vt-rose) 30%, transparent)'}}>
              <span style={{display:'flex', alignItems:'center', gap:8}}><Icon name="trash" size={14}/> Заблокировать org</span>
              <Icon name="chevron-r" size={14}/>
            </button>
          </div>
          <div style={{fontSize:'var(--fs-2xs)', opacity:0.55, marginTop:14, lineHeight:1.4}}>
            Все действия логируются в платформенный аудит и видны owner-у организации.
          </div>
        </div>

        {/* Credit balance widget */}
        <div className="vt-card" style={{padding:18}}>
          <h3 style={{fontSize:'var(--fs-base)'}}>Credits · история</h3>
          <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:10}}>
            <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-4xl)'}}>32</div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>осталось</div>
          </div>
          <div className="vt-card" style={{marginTop:14, padding:0, overflow:'hidden', background:'var(--vt-paper)'}}>
            {[
              ['Сегодня',  'event.spend', '−1'],
              ['25 мая',   'event.spend', '−1'],
              ['22 мая',   'pack30 purchase', '+30'],
              ['15 мая',   'event.refund', '+1'],
              ['1 мая',    'demo grant', '+5'],
            ].map(([d, t, v], i, a) => (
              <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderBottom: i<a.length-1?'1px solid var(--vt-bone-2)':'none', fontSize:'var(--fs-xs)'}}>
                <span className="vt-mono" style={{color:'var(--vt-mute-2)', width:54}}>{d}</span>
                <span style={{flex:1, fontFamily:'var(--f-mono)', fontSize:'var(--fs-2xs)', color:'var(--vt-ink-3)'}}>{t}</span>
                <span className="vt-mono" style={{fontWeight:700, color: v.startsWith('+') ? 'var(--vt-grass)' : 'var(--vt-ink)'}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </AdminShell>
  );
};

// ============================================================
// AdminCredits — pricing config
// ============================================================
const AdminCredits = () => {
  const nav = useNav();
  return (
  <AdminShell
    activeNav="credits"
    title="Credits & тарифы"
    sub="Конфиг пакетов · demo-квоты · ручные грантования"
    topRight={<button onClick={() => nav.push('credits-history')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="clock" size={13}/> История изменений</button>}
  >
    {/* Section 1: Demo quota */}
    <div className="vt-card" style={{padding:22, marginBottom:18}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          <h3 style={{fontSize:'var(--fs-md)'}}>Demo-квота новой организации</h3>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>Сколько credits получает каждая новая организация бесплатно при регистрации.</div>
        </div>
        <span className="vt-chip vt-chip--solid" style={{fontSize:'var(--fs-2xs)'}}>Phase 7</span>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginTop:18}}>
        <div>
          <label className="vt-label">Сейчас</label>
          <div style={{display:'flex', alignItems:'baseline', gap:8}}>
            <div className="vt-mono" style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-5xl)'}}>5</div>
            <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>credits</span>
          </div>
        </div>
        <div>
          <label className="vt-label">Изменить</label>
          <div style={{display:'flex', gap:6}}>
            <input className="vt-field" defaultValue="5" style={{width:90}}/>
            <button className="vt-btn vt-btn--ghost vt-btn--sm">−</button>
            <button className="vt-btn vt-btn--ghost vt-btn--sm">+</button>
          </div>
          <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:6}}>Применяется только к новым организациям.</div>
        </div>
        <div>
          <label className="vt-label">Конверсия demo → paid</label>
          <div style={{display:'flex', alignItems:'baseline', gap:8}}>
            <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-xl)', color:'var(--vt-grass)'}}>40%</div>
            <span style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>2 из 5 за месяц</span>
          </div>
          <div className="vt-meter vt-meter--grass" style={{marginTop:8}}><i style={{width:'40%'}}/></div>
        </div>
      </div>
    </div>

    {/* Section 2: Packages */}
    <div className="vt-card" style={{padding:22, marginBottom:18}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
        <div>
          <h3 style={{fontSize:'var(--fs-md)'}}>Пакеты credits</h3>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>Цены, видимость и стимулы. Изменения применяются на следующую покупку.</div>
        </div>
        <button onClick={() => nav.push('pack-create')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="plus" size={13}/> Новый пакет</button>
      </div>

      <div style={{marginTop:16, background:'var(--vt-paper)', borderRadius:'var(--r-tile)', overflow:'hidden'}}>
        <div style={{display:'grid', gridTemplateColumns:'80px 100px 110px 130px 100px 90px 100px 1fr 40px', padding:'10px 16px', borderBottom:'1px solid var(--vt-bone-2)'}}>
          {['Credits','Цена','За credit','Бейдж','Видимый','Продаж','Доход',''].map((h,i)=>(
            <div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>
          ))}
          <div></div>
        </div>
        {[
          { c:10,  p:50,  per:5.00,  badge:'',           shown:true,  sold:3, rev:150 },
          { c:30,  p:120, per:4.00,  badge:'Популярный', shown:true,  sold:7, rev:840 },
          { c:100, p:350, per:3.50,  badge:'−30%',       shown:true,  sold:1, rev:350 },
          { c:200, p:600, per:3.00,  badge:'',           shown:false, sold:0, rev:0,  draft:true },
        ].map((p, i, arr) => (
          <div key={i} style={{display:'grid', gridTemplateColumns:'80px 100px 110px 130px 100px 90px 100px 1fr 40px', padding:'12px 16px', borderBottom: i<arr.length-1?'1px solid var(--vt-bone-2)':'none', alignItems:'center', filter: p.draft ? 'grayscale(1)' : 'none'}}>
            <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-md)'}}>{p.c}</div>
            <div className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{p.p} Br</div>
            <div className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{p.per.toFixed(2).replace('.', ',')} Br</div>
            <div>{p.badge && <span className="vt-chip vt-chip--solid" style={{fontSize:'var(--fs-2xs)'}}>{p.badge}</span>}</div>
            <div>
              <div style={{width:32, height:18, borderRadius:'var(--r-pill)', background: p.shown?'var(--vt-ink)':'var(--vt-stroke-2)', position:'relative'}}>
                <span style={{position:'absolute', top:2, left: p.shown?16:2, width:14, height:14, borderRadius:'var(--r-pill)', background:'var(--vt-paper)'}}/>
              </div>
            </div>
            <div className="vt-mono" style={{fontSize:'var(--fs-sm)'}}>{p.sold}</div>
            <div className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600, color: p.rev>0 ? 'var(--vt-grass)' : 'var(--vt-mute-2)'}}>{p.rev>0 ? `+${p.rev} Br` : '—'}</div>
            <div>{p.draft && <span className="vt-chip vt-chip--amber" style={{fontSize:'var(--fs-2xs)'}}>черновик</span>}</div>
            <ActionMore mode="popover" align="right" items={[
              { icon:'edit', label:'Редактировать пакет', onClick: () => nav.toast(`Редактируем пакет ${p.c}`) },
              { icon:'copy', label:'Дублировать', onClick: () => nav.toast('Дублирован') },
              { icon:'globe', label: p.shown ? 'Скрыть из витрины' : 'Показать в витрине', onClick: () => nav.toast(p.shown ? 'Пакет скрыт' : 'Пакет показан') },
              '---',
              { icon:'trash', tone:'danger', label:'Удалить пакет', onClick: () => nav.toast('Пакет удалён') },
            ]}/>
          </div>
        ))}
      </div>
    </div>

    {/* Section 3: Manual grants */}
    <div className="vt-card" style={{padding:22}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
        <div>
          <h3 style={{fontSize:'var(--fs-md)'}}>Ручные грантования</h3>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>Compensation, промо, исправление багов. Указывайте причину — пригодится в аудите.</div>
        </div>
        <button onClick={() => nav.sheet({
          title:'Выдать credits', sub:'Выберите организацию',
          items:[
            { icon:'building', label:'VolleyTime Минск', onClick: () => nav.push('grant-credits', { org:'VolleyTime Минск' }) },
            { icon:'building', label:'СпайкКлуб', onClick: () => nav.push('grant-credits', { org:'СпайкКлуб' }) },
            { icon:'building', label:'СОК Витебск', onClick: () => nav.push('grant-credits', { org:'СОК Витебск' }) },
          ]
        })} className="vt-btn vt-btn--ink vt-btn--sm" style={{gap:6}}><Icon name="plus" size={13}/> Выдать credits</button>
      </div>

      <div style={{marginTop:14, background:'var(--vt-paper)', borderRadius:'var(--r-tile)', overflow:'hidden'}}>
        <div style={{display:'grid', gridTemplateColumns:'130px 220px 80px 1fr 120px', padding:'10px 16px', borderBottom:'1px solid var(--vt-bone-2)'}}>
          {['Дата','Организация','Кол-во','Причина','Кем'].map((h,i)=>(
            <div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>
          ))}
        </div>
        {[
          ['Сегодня 09:02', 'СОК Витебск', '+10', 'Промо за фидбек по Phase 10', 'root@volleytime'],
          ['22 мая',        'VolleyTime Минск', '+5', 'Compensation: bug #142 (списан credit без события)', 'root@volleytime'],
          ['18 марта',      'VolleyTime Минск', '+5', 'Demo grant · auto', 'system'],
        ].map(([d, o, n, r, w], i, a) => (
          <div key={i} style={{display:'grid', gridTemplateColumns:'130px 220px 80px 1fr 120px', padding:'12px 16px', borderBottom: i<a.length-1?'1px solid var(--vt-bone-2)':'none', alignItems:'center', fontSize:'var(--fs-sm)'}}>
            <span className="vt-mono" style={{color:'var(--vt-mute-2)'}}>{d}</span>
            <span style={{fontWeight:600}}>{o}</span>
            <span className="vt-mono" style={{fontWeight:700, color:'var(--vt-grass)'}}>{n}</span>
            <span style={{color:'var(--vt-ink-3)'}}>{r}</span>
            <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{w}</span>
          </div>
        ))}
      </div>
    </div>
  </AdminShell>
  );
};

// ============================================================
// AdminAudit
// ============================================================
const AdminAudit = () => {
  const nav = useNav();
  return (
  <AdminShell
    activeNav="audit"
    title="Аудит платформы"
    sub="Append-only журнал · все root-действия и системные события"
    topRight={
      <>
        <button onClick={() => nav.toast('audit-log.json скачан')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="arrow-d" size={13}/> Экспорт JSON</button>
      </>
    }
  >
    {/* Filters */}
    <div style={{display:'grid', gridTemplateColumns:'200px 200px 200px 1fr', gap:10, marginBottom:14}}>
      <div className="vt-field" style={{padding:'8px 12px', display:'flex', alignItems:'center', gap:8, fontSize:'var(--fs-sm)'}}>
        <Icon name="calendar" size={13}/> Последние 7 дней <Icon name="chevron-d" size={11} style={{marginLeft:'auto', opacity:0.5}}/>
      </div>
      <div className="vt-field" style={{padding:'8px 12px', display:'flex', alignItems:'center', gap:8, fontSize:'var(--fs-sm)'}}>
        <Icon name="building" size={13}/> Все организации <Icon name="chevron-d" size={11} style={{marginLeft:'auto', opacity:0.5}}/>
      </div>
      <div className="vt-field" style={{padding:'8px 12px', display:'flex', alignItems:'center', gap:8, fontSize:'var(--fs-sm)'}}>
        <Icon name="filter" size={13}/> Все категории <Icon name="chevron-d" size={11} style={{marginLeft:'auto', opacity:0.5}}/>
      </div>
      <div className="vt-field" style={{padding:'8px 12px', display:'flex', alignItems:'center', gap:8, fontSize:'var(--fs-sm)', color:'var(--vt-mute)'}}>
        <Icon name="search" size={13}/> поиск по сообщению или actor
      </div>
    </div>

    {/* Severity counters */}
    <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:8, marginBottom:14}}>
      {[
        ['Все', '1 248', 'ink'],
        ['Info', '1 184', 'mute-2'],
        ['Success', '52', 'grass'],
        ['Warning', '9', 'amber'],
        ['Error', '3', 'rose'],
      ].map(([l, n, c], i) => (
        <div key={i} className="vt-card" style={{padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer'}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{l}</div>
          <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-md)', color: c==='rose'?'var(--vt-rose)':c==='amber'?'var(--vt-amber)':c==='grass'?'var(--vt-grass)':'var(--vt-ink)'}}>{n}</div>
        </div>
      ))}
    </div>

    {/* Log table */}
    <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
      <div style={{display:'grid', gridTemplateColumns:'100px 60px 220px 160px 160px 1fr', padding:'10px 18px', borderBottom:'1px solid var(--vt-bone-2)'}}>
        {['Время','Ур.','Событие','Кто','Объект','Детали'].map((h,i)=>(
          <div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>
        ))}
      </div>
      {[
        ['14:22:08', 'INFO',  'grass',  'payment.confirmed',         'user:ivan_p',    'org:vt-minsk',     'payment=pay_8X2 · 15 BYN'],
        ['14:18:44', 'INFO',  'ink',    'event.created',             'user:ivan_p',    'event:ev_T44m',    'credit-=1 · «Основа 4 июня»'],
        ['13:08:11', 'INFO',  'ink',    'org.member.invited',        'user:sergey_b',  'org:sok-vit',      'invite=inv_kQ2 · TTL 7d'],
        ['12:30:02', 'OK',    'flame',  'billing.credits.purchased', 'user:anton_k',   'org:spike-club',   'pack30 · 120 BYN · stripe_test'],
        ['11:48:55', 'WARN',  'amber',  'subscription.depleted',     'system',         'sub:sub_0143',     'attempted spend on empty sub'],
        ['10:48:21', 'INFO',  'grass',  'auth.user.signed_up',       'system',         'user:marina_v',    'via invite org:mv-pro'],
        ['09:02:14', 'INFO',  'amber',  'billing.credits.granted',   'root@volleytime','org:sok-vit',      '+10 credits · reason="промо за фидбек"'],
        ['08:44:38', 'ERROR', 'rose',   'telegram.api.error',        'apps/bot',       'chat:847291',      '429 Too Many Requests · retry=3 ok'],
        ['08:30:00', 'INFO',  'mute',   'scheduler.job.executed',    'system',         '—',                'reminder-24h · 12 messages sent'],
        ['07:15:02', 'OK',    'grass',  'org.created',               'user:olga_r',    'org:mv-pro',       'demo credits +5 granted'],
        ['Вчера 22:05', 'INFO', 'ink',  'event.finished',            'scheduler',      'event:ev_T19s',    'attendees=12/14 · auto-finalized'],
      ].map(([t, lvl, c, ev, actor, target, detail], i, arr) => (
        <div key={i} style={{display:'grid', gridTemplateColumns:'100px 60px 220px 160px 160px 1fr', padding:'10px 18px', borderBottom:i<arr.length-1?'1px solid var(--vt-bone-2)':'none', alignItems:'center'}}>
          <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{t}</span>
          <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', fontWeight:700, color:`var(--vt-${c})`}}>{lvl}</span>
          <span className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)'}}>{ev}</span>
          <span className="vt-mono" style={{fontSize:'var(--fs-xs)'}}>{actor}</span>
          <span className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-flame-ink)'}}>{target}</span>
          <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{detail}</span>
        </div>
      ))}
    </div>

    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>
      <span className="vt-mono">cursor=2026-05-26T11:15Z · 11 of 1 248 shown</span>
      <button className="vt-btn vt-btn--ghost vt-btn--sm">Загрузить ещё <Icon name="chevron-d" size={12}/></button>
    </div>
  </AdminShell>
  );
};

// ============================================================
// AdminUsers
// ============================================================
const AdminUsers = () => {
  const nav = useNav();
  return (
  <AdminShell
    activeNav="users"
    title="Пользователи"
    sub="148 учётных записей · 87 активных за неделю"
    topRight={<button className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="arrow-d" size={13}/> Экспорт</button>}
  >
    <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginBottom:18}}>
      {[
        ['Всего', '148', '+12 за нед'],
        ['Связаны Telegram', '142', '96%'],
        ['Связан email', '76', '51%'],
        ['Активны 7d', '87', 'WAU 59%'],
      ].map(([l, v, d], i) => (
        <div key={i} className="vt-card" style={{padding:16}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{l}</div>
          <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-2xl)', marginTop:8}}>{v}</div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4}}>{d}</div>
        </div>
      ))}
    </div>

    <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
      <div style={{display:'grid', gridTemplateColumns:'2fr 130px 130px 110px 130px 110px 40px', padding:'10px 18px', borderBottom:'1px solid var(--vt-bone-2)'}}>
        {['Пользователь','Telegram','Email','Групп','Записей','Активн.',''].map((h,i)=>(
          <div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>
        ))}
      </div>
      {[
        { n:'Иван Петренко',  tg:'@ivan_p',     email:'ivan@…',     orgs:1, role:'owner',     bk:34, act:'5 мин',  health:'grass' },
        { n:'Артём Кравцов',  tg:'@artyomk',    email:'—',           orgs:2, role:'player',    bk:24, act:'2 ч',    health:'grass' },
        { n:'Антон Климов',   tg:'@anton_k',    email:'a.kli@…',     orgs:1, role:'owner',     bk:18, act:'1 ч',    health:'grass' },
        { n:'Сергей Богдан',  tg:'@sergey_b',   email:'—',           orgs:1, role:'organizer', bk:9,  act:'3 ч',    health:'grass' },
        { n:'Никита',         tg:'@nik_v',      email:'—',           orgs:1, role:'player',    bk:18, act:'6 ч',    health:'grass' },
        { n:'Маша',           tg:'@m_volk',     email:'maria@…',     orgs:2, role:'player',    bk:14, act:'4 ч',    health:'grass' },
        { n:'Соня',           tg:'@son_vt',     email:'—',           orgs:1, role:'player',    bk:10, act:'1 д',    health:'amber' },
        { n:'Marina V.',      tg:'@marina_v',   email:'—',           orgs:1, role:'pending',   bk:0,  act:'только что', health:'flame' },
      ].map((u, i, a) => (
        <div key={i} style={{display:'grid', gridTemplateColumns:'2fr 130px 130px 110px 130px 110px 40px', padding:'12px 18px', borderBottom: i<a.length-1?'1px solid var(--vt-bone-2)':'none', alignItems:'center'}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <Avi name={u.n} init={u.n.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase()} tag={['flame','ink','grass','amber','orange'][i%5]} size="sm"/>
            <div>
              <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>{u.n}</div>
              <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>usr_{(i+90).toString(16).toUpperCase()}{i}{i}</div>
            </div>
          </div>
          <div className="vt-mono" style={{fontSize:'var(--fs-xs)', color: u.tg==='—'?'var(--vt-mute-2)':'var(--vt-flame-deep)'}}>{u.tg}</div>
          <div className="vt-mono" style={{fontSize:'var(--fs-xs)', color: u.email==='—'?'var(--vt-mute-2)':'var(--vt-ink-3)'}}>{u.email}</div>
          <div style={{fontSize:'var(--fs-sm)'}}><span className="vt-mono" style={{fontWeight:600}}>{u.orgs}</span> <span style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>· {u.role}</span></div>
          <div className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{u.bk}</div>
          <div style={{fontSize:'var(--fs-xs)', display:'flex', alignItems:'center', gap:6}}>
            <span style={{width:6, height:6, borderRadius:'var(--r-pill)', background:`var(--vt-${u.health})`}}/> {u.act}
          </div>
          <ActionMore mode="popover" align="right" items={[
            { icon:'tg', label:'Открыть профиль', onClick: () => nav.toast(`Открыт профиль ${u.n}`) },
            { icon:'send', label:'Связаться в Telegram', onClick: () => nav.toast(`Открываем чат ${u.tg}`) },
            { icon:'building', label:'Список организаций', onClick: () => nav.toast(`${u.n} в ${u.orgs} орг.`) },
            '---',
            { icon:'logout', tone:'danger', label:'Заблокировать пользователя', onClick: () => nav.alert({
              title:`Заблокировать ${u.n}?`, body:'Пользователь не сможет войти в платформу. Сессии будут закрыты.',
              confirm:'Заблокировать', danger:true, onConfirm: () => nav.toast(`${u.n} заблокирован`)
            })},
          ]}/>
        </div>
      ))}
    </div>
  </AdminShell>
  );
};

Object.assign(window, { AdminShell, AdminOverview, AdminOrgs, AdminOrgDetail, AdminCredits, AdminAudit, AdminUsers });
