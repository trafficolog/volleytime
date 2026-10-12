// screens-admin-forms.jsx — Root Admin: forms & extra pages
// Uses window.AdminShell, Icon, Avi, useNav, byn, PEOPLE

// ============================================================
// AdminOrgCreate — manually create an organization
// ============================================================
const AdminOrgCreate = () => {
  const nav = useNav();
  const [plan, setPlan] = React.useState('beta');
  const [demo, setDemo] = React.useState(5);
  const create = () => { nav.reset('orgs'); setTimeout(() => nav.toast('Организация создана · приглашение владельцу отправлено'), 80); };
  return (
  <AdminShell activeNav="orgs" title="Новая организация" sub="Ручное создание (обычно регистрируются сами через бота)"
    topRight={<>
      <button onClick={() => nav.reset('orgs')} className="vt-btn vt-btn--ghost vt-btn--sm">Отмена</button>
      <button onClick={create} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6}}><Icon name="check" size={14}/> Создать</button>
    </>}>
    <div style={{display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:18, maxWidth:1000}}>
      <div className="vt-card" style={{padding:24}}>
        <h3 style={{fontSize:'var(--fs-md)'}}>Профиль организации</h3>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:16}}>
          <div style={{gridColumn:'1/-1'}}>
            <label className="vt-label">Название</label>
            <input className="vt-field" placeholder="Напр. VolleyTime Гомель"/>
          </div>
          <div>
            <label className="vt-label">Короткий slug</label>
            <div style={{display:'flex'}}>
              <div className="vt-field" style={{width:90, borderRight:'none', borderRadius:'10px 0 0 10px', background:'var(--vt-bone-2)', color:'var(--vt-mute-2)', fontSize:'var(--fs-xs)', display:'flex', alignItems:'center'}}>org_</div>
              <input className="vt-field" defaultValue="vt-gomel" style={{borderRadius:'0 10px 10px 0'}}/>
            </div>
          </div>
          <div>
            <label className="vt-label">Город</label>
            <input className="vt-field" defaultValue="Гомель"/>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <label className="vt-label">Владелец · Telegram или email</label>
            <div className="vt-field" style={{display:'flex', alignItems:'center', gap:8, color:'var(--vt-mute)'}}>
              <Icon name="search" size={14}/> @username или user@mail — найти / пригласить
            </div>
          </div>
        </div>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:18}}>
        <div className="vt-card" style={{padding:20}}>
          <h3 style={{fontSize:'var(--fs-md)'}}>Тариф и старт</h3>
          <label className="vt-label" style={{marginTop:14}}>План</label>
          <div style={{display:'flex', gap:6}}>
            {[['beta','Beta · бесплатно'],['demo','Demo · sandbox']].map(([v,l]) => (
              <button key={v} onClick={() => setPlan(v)} className="vt-btn vt-btn--sm" style={{flex:1, background:plan===v?'var(--vt-ink)':'var(--vt-ctl)', color:plan===v?'var(--vt-paper)':'var(--vt-ink)', fontWeight:600}}>{l}</button>
            ))}
          </div>
          <label className="vt-label" style={{marginTop:16}}>Стартовые credits</label>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <button onClick={() => setDemo(d => Math.max(0, d-1))} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'6px 12px'}}>−</button>
            <span className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-lg)', width:34, textAlign:'center'}}>{demo}</span>
            <button onClick={() => setDemo(d => d+1)} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'6px 12px'}}>+</button>
          </div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:8}}>Будет выдано при создании. По умолчанию — demo-квота платформы.</div>
        </div>
        <div className="vt-card" style={{padding:16, background:'var(--vt-orange-soft)', borderColor:'color-mix(in oklab, var(--vt-orange) 30%, transparent)'}}>
          <div style={{display:'flex', gap:8, fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)'}}>
            <Icon name="bell" size={15} stroke="var(--vt-orange)"/>
            <span>Создание вручную логируется в аудит как <b className="vt-mono">org.created</b> с actor=root.</span>
          </div>
        </div>
      </div>
    </div>
  </AdminShell>
  );
};

// ============================================================
// AdminPackCreate — new credits package
// ============================================================
const AdminPackCreate = () => {
  const nav = useNav();
  const [credits, setCredits] = React.useState(30);
  const [price, setPrice] = React.useState(120);
  const [visible, setVisible] = React.useState(true);
  const per = credits>0 ? price/credits : 0;
  const save = () => { nav.reset('credits'); setTimeout(() => nav.toast('Пакет credits создан'), 80); };
  return (
  <AdminShell activeNav="credits" title="Новый пакет credits" sub="Тариф покупки credits для организаций"
    topRight={<>
      <button onClick={() => nav.reset('credits')} className="vt-btn vt-btn--ghost vt-btn--sm">Отмена</button>
      <button onClick={save} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6}}><Icon name="check" size={14}/> Создать пакет</button>
    </>}>
    <div style={{display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:18, maxWidth:1000}}>
      <div className="vt-card" style={{padding:24}}>
        <h3 style={{fontSize:'var(--fs-md)'}}>Параметры пакета</h3>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:16}}>
          <div>
            <label className="vt-label">Количество credits</label>
            <input className="vt-field" value={credits} onChange={e=>setCredits(+e.target.value||0)} style={{fontFamily:'var(--f-mono)', fontWeight:600}}/>
          </div>
          <div>
            <label className="vt-label">Цена</label>
            <div style={{display:'flex', gap:8}}>
              <input className="vt-field" value={price} onChange={e=>setPrice(+e.target.value||0)} style={{flex:1, fontFamily:'var(--f-mono)', fontWeight:600}}/>
              <div className="vt-field" style={{width:64, display:'flex', alignItems:'center', justifyContent:'center'}}>BYN</div>
            </div>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <label className="vt-label">Бейдж (необязательно)</label>
            <div style={{display:'flex', gap:6}}>
              {['—','Популярный','−30%','Лучшая цена'].map((b,i) => (
                <button key={b} className="vt-btn vt-btn--sm" style={{background:i===1?'var(--vt-ink)':'var(--vt-ctl)', color:i===1?'var(--vt-paper)':'var(--vt-ink)', fontWeight:600}}>{b}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="vt-divider" style={{margin:'18px 0'}}/>
        <button onClick={() => setVisible(v=>!v)} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:'var(--r-chip)', cursor:'pointer', textAlign:'left', width:'100%', background:'var(--vt-paper)'}}>
          <div style={{flex:1}}>
            <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>Показывать в витрине</div>
            <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2}}>Организации увидят пакет при покупке credits.</div>
          </div>
          <div style={{width:36, height:20, borderRadius:'var(--r-pill)', background:visible?'var(--vt-ink)':'var(--vt-stroke-2)', position:'relative', flexShrink:0}}>
            <span style={{position:'absolute', top:2, left: visible?18:2, width:16, height:16, borderRadius:'var(--r-pill)', background:'var(--vt-paper)', transition:'left .15s'}}/>
          </div>
        </button>
      </div>

      <div>
        <label className="vt-label">Превью</label>
        <div className="vt-card" style={{padding:18}}>
          <div style={{fontFamily:'var(--f-display)', fontWeight:700, fontSize:'var(--fs-4xl)', lineHeight:1}}>{credits}</div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4}}>credits</div>
          <div className="vt-divider" style={{margin:'14px 0'}}/>
          <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-xl)'}}>{price} Br</div>
          <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2}}>{per.toFixed(2).replace('.', ',')} Br / credit</div>
        </div>
      </div>
    </div>
  </AdminShell>
  );
};

// ============================================================
// AdminGrantCredits — grant credits to a chosen org
// ============================================================
const AdminGrantCredits = () => {
  const nav = useNav();
  const org = nav.data.org || 'VolleyTime Минск';
  const [amount, setAmount] = React.useState(10);
  const [reason, setReason] = React.useState('promo');
  const presets = [1, 5, 10, 30];
  const grant = () => { nav.reset('credits'); setTimeout(() => nav.toast(`+${amount} credits выдано · ${org}`), 80); };
  return (
  <AdminShell activeNav="credits" title="Выдать credits" sub={`Организация: ${org}`}
    topRight={<>
      <button onClick={() => nav.reset('credits')} className="vt-btn vt-btn--ghost vt-btn--sm">Отмена</button>
      <button onClick={grant} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6}}><Icon name="gift" size={14}/> Выдать</button>
    </>}>
    <div style={{maxWidth:560}}>
      <div className="vt-card" style={{padding:24}}>
        <div style={{display:'flex', alignItems:'center', gap:12, paddingBottom:16, borderBottom:'1px solid var(--vt-bone-2)'}}>
          <span className="vt-avi vt-avi--sm" style={{background:'linear-gradient(135deg, var(--vt-flame), var(--vt-night))', color:'var(--vt-on-hero)', fontSize:'var(--fs-2xs)', fontWeight:700}}>{org.slice(0,2).toUpperCase()}</span>
          <div>
            <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>{org}</div>
            <div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>текущий баланс: 32 credits</div>
          </div>
        </div>

        <label className="vt-label" style={{marginTop:16}}>Количество</label>
        <div style={{display:'flex', alignItems:'baseline', gap:8}}>
          <span className="vt-mono" style={{fontSize:'var(--fs-base)', color:'var(--vt-grass)', fontWeight:700}}>+</span>
          <input className="vt-field" value={amount} onChange={e=>setAmount(+e.target.value||0)} style={{flex:1, fontSize:'var(--fs-xl)', fontWeight:700, fontFamily:'var(--f-mono)'}}/>
        </div>
        <div style={{display:'flex', gap:6, marginTop:8}}>
          {presets.map(v => (
            <button key={v} onClick={() => setAmount(v)} className="vt-btn vt-btn--sm" style={{background:amount===v?'var(--vt-ink)':'var(--vt-ctl-track)', color:amount===v?'var(--vt-paper)':'var(--vt-ink)', fontWeight:600, fontFamily:'var(--f-mono)'}}>+{v}</button>
          ))}
        </div>

        <label className="vt-label" style={{marginTop:18}}>Причина</label>
        <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
          {[['promo','Промо'],['compensation','Компенсация'],['bugfix','Багфикс'],['manual','Вручную']].map(([v,l]) => (
            <button key={v} onClick={() => setReason(v)} className="vt-chip" style={{cursor:'pointer', background:reason===v?'var(--vt-ink)':'var(--vt-ctl-track)', color:reason===v?'var(--vt-paper)':'var(--vt-ink)', borderColor:'transparent'}}>{l}</button>
          ))}
        </div>

        <label className="vt-label" style={{marginTop:18}}>Комментарий (попадёт в аудит)</label>
        <textarea className="vt-field" rows={2} placeholder="Напр. промо за участие в Private Beta"></textarea>

        <div className="vt-card" style={{padding:'12px 14px', marginTop:16, background:'var(--vt-bone-2)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <span style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>Баланс после выдачи</span>
          <span className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-md)', color:'var(--vt-grass)'}}>{32 + amount} credits</span>
        </div>
      </div>
    </div>
  </AdminShell>
  );
};

// ============================================================
// AdminCreditsHistory — change log of pricing/grants
// ============================================================
const AdminCreditsHistory = () => {
  const nav = useNav();
  return (
  <AdminShell activeNav="credits" title="История изменений" sub="Тарифы, demo-квота и ручные грантования"
    topRight={<button onClick={() => nav.reset('credits')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="chevron-l" size={13}/> К тарифам</button>}>
    <div style={{display:'flex', gap:8, marginBottom:14}}>
      {['Все','Тарифы','Demo-квота','Грантования'].map((t,i) => (
        <button key={t} className="vt-btn vt-btn--sm" style={{background:i===0?'var(--vt-ink)':'var(--vt-ctl)', color:i===0?'var(--vt-paper)':'var(--vt-ink)', fontWeight:600}}>{t}</button>
      ))}
    </div>
    <div className="vt-card" style={{padding:0, overflow:'hidden', maxWidth:900}}>
      <div style={{display:'grid', gridTemplateColumns:'130px 150px 1fr 130px', padding:'10px 18px', borderBottom:'1px solid var(--vt-bone-2)'}}>
        {['Дата','Тип','Изменение','Кто'].map((h,i)=><div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>)}
      </div>
      {[
        ['Сегодня 09:02','grant','СОК Витебск +10 credits · причина: промо','root@volleytime','grass'],
        ['22 мая 16:10','grant','VolleyTime Минск +5 credits · bugfix #142','root@volleytime','grass'],
        ['18 мая 11:00','pricing','Пакет «30 credits»: 130 → 120 Br','root@volleytime','flame'],
        ['12 мая 14:30','demo_quota','Demo-квота новой org: 3 → 5 credits','root@volleytime','amber'],
        ['5 мая 10:15','pricing','Добавлен пакет «100 credits» · 350 Br','root@volleytime','flame'],
        ['1 мая 09:00','grant','Все пилоты +5 credits · старт Private Beta','system','grass'],
      ].map(([d,t,c,w,tone],i,a) => (
        <div key={i} style={{display:'grid', gridTemplateColumns:'130px 150px 1fr 130px', padding:'12px 18px', borderBottom:i<a.length-1?'1px solid var(--vt-bone-2)':'none', alignItems:'center', fontSize:'var(--fs-sm)'}}>
          <span className="vt-mono" style={{color:'var(--vt-mute-2)', fontSize:'var(--fs-2xs)'}}>{d}</span>
          <span><span className="vt-chip" style={{fontSize:'var(--fs-2xs)', background:`color-mix(in srgb, var(--vt-${tone}) 14%, transparent)`, color:`var(--vt-${tone})`, borderColor:'transparent'}}>{t}</span></span>
          <span style={{color:'var(--vt-ink-3)'}}>{c}</span>
          <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{w}</span>
        </div>
      ))}
    </div>
  </AdminShell>
  );
};

// ============================================================
// AdminPayouts — Подписки & выплаты
// ============================================================
const AdminPayouts = () => {
  const nav = useNav();
  const [seg, setSeg] = React.useState('revenue');
  return (
  <AdminShell activeNav="payouts" title="Подписки & выплаты" sub="Доходы платформы, инвойсы и выплаты"
    topRight={<>
      <button onClick={() => nav.toast('Отчёт MRR скачан')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="arrow-d" size={13}/> Экспорт</button>
    </>}>
    {/* KPI */}
    <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr 1fr', gap:14, marginBottom:18}}>
      <div className="vt-card vt-card--hero" style={{padding:18, position:'relative', overflow:'hidden'}}>
        <div style={{position:'absolute', right:-30, bottom:-30, width:160, height:160, borderRadius:'50%', background:'var(--vt-orange)', opacity:0.28}}/>
        <div style={{position:'relative'}}>
          <div className="vt-cap" style={{opacity:0.55}}>MRR (проекция)</div>
          <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-4xl)', marginTop:8}}>52 Br</div>
          <div style={{fontSize:'var(--fs-xs)', opacity:0.7, marginTop:6, display:'inline-flex', alignItems:'center', gap:4}}><Icon name="arrow-u" size={12}/> +12 Br за месяц</div>
        </div>
      </div>
      {[
        ['Выручка за месяц','+610 Br','5 покупок credits','grass'],
        ['К выплате','0 Br','выплат пока нет'],
        ['Платящих орг.','3','из 5 · 60%'],
      ].map(([l,v,d,c],i) => (
        <div key={i} className="vt-card" style={{padding:16}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{l}</div>
          <div className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-2xl)', marginTop:8, color:c==='grass'?'var(--vt-grass)':'inherit'}}>{v}</div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:6}}>{d}</div>
        </div>
      ))}
    </div>

    {/* Segments */}
    <div style={{display:'flex', gap:2, padding:4, background:'var(--vt-bone-2)', borderRadius:'var(--r-chip)', width:'fit-content', marginBottom:18}}>
      {[['revenue','Доходы по организациям'],['invoices','Инвойсы'],['payouts','Выплаты']].map(([k,l]) => (
        <button key={k} onClick={() => setSeg(k)} className="vt-btn vt-btn--sm" style={{background:seg===k?'var(--vt-paper)':'transparent', color:seg===k?'var(--vt-ink)':'var(--vt-mute-2)', boxShadow:seg===k?'var(--vt-seg-shadow)':'none', fontWeight:600}}>{l}</button>
      ))}
    </div>

    {seg === 'revenue' && (
      <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
        <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', padding:'10px 18px', borderBottom:'1px solid var(--vt-bone-2)'}}>
          {['Организация','План','Куплено credits','Потрачено','Выручка'].map((h,i)=><div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>)}
        </div>
        {[
          ['VolleyTime Минск','beta',35,'−12','+240 Br'],
          ['СпайкКлуб','beta',30,'−18','+120 Br'],
          ['СОК Витебск','beta',20,'−12','+250 Br'],
          ['MinskVolley.PRO','beta',0,'−2','0 Br'],
          ['Тестовая','demo',0,'0','0 Br'],
        ].map((r,i,a) => (
          <div key={i} style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', padding:'12px 18px', borderBottom:i<a.length-1?'1px solid var(--vt-bone-2)':'none', alignItems:'center', fontSize:'var(--fs-sm)'}}>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <span className="vt-avi vt-avi--sm" style={{background:`linear-gradient(135deg, var(--vt-${['flame','blue-ink','grass','orange','night'][i]}), var(--vt-night))`, color:'var(--vt-on-hero)', fontSize:'var(--fs-2xs)', fontWeight:700}}>{r[0].slice(0,2).toUpperCase()}</span>
              <span style={{fontWeight:600}}>{r[0]}</span>
            </div>
            <div><span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>{r[1]}</span></div>
            <div className="vt-mono">{r[2]}</div>
            <div className="vt-mono" style={{color:'var(--vt-mute-2)'}}>{r[3]}</div>
            <div className="vt-mono" style={{fontWeight:700, color: r[4]==='0 Br'?'var(--vt-mute-2)':'var(--vt-grass)'}}>{r[4]}</div>
          </div>
        ))}
      </div>
    )}

    {seg === 'invoices' && (
      <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
        <div style={{display:'grid', gridTemplateColumns:'140px 2fr 1fr 1fr 120px 40px', padding:'10px 18px', borderBottom:'1px solid var(--vt-bone-2)'}}>
          {['Инвойс','Организация','Сумма','Дата','Статус',''].map((h,i)=><div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>)}
        </div>
        {[
          ['INV-0007','СпайкКлуб','120 Br','22 мая','оплачен','grass'],
          ['INV-0006','СОК Витебск','120 Br','18 мая','оплачен','grass'],
          ['INV-0005','VolleyTime Минск','120 Br','22 апр','оплачен','grass'],
          ['INV-0008','MinskVolley.PRO','50 Br','сегодня','ожидает','amber'],
        ].map((r,i,a) => (
          <div key={i} style={{display:'grid', gridTemplateColumns:'140px 2fr 1fr 1fr 120px 40px', padding:'12px 18px', borderBottom:i<a.length-1?'1px solid var(--vt-bone-2)':'none', alignItems:'center', fontSize:'var(--fs-sm)'}}>
            <span className="vt-mono" style={{fontWeight:600, color:'var(--vt-flame-ink)'}}>{r[0]}</span>
            <span style={{fontWeight:600}}>{r[1]}</span>
            <span className="vt-mono" style={{fontWeight:600}}>{r[2]}</span>
            <span className="vt-mono" style={{color:'var(--vt-mute-2)', fontSize:'var(--fs-xs)'}}>{r[3]}</span>
            <span><span className="vt-chip" style={{fontSize:'var(--fs-2xs)', background:`color-mix(in srgb, var(--vt-${r[5]}) 14%, transparent)`, color:`var(--vt-${r[5]})`, borderColor:'transparent'}}>{r[4]}</span></span>
            <ActionMore mode="popover" align="right" items={[
              { icon:'arrow-d', label:'Скачать PDF', onClick: () => nav.toast(`${r[0]}.pdf`) },
              { icon:'send', label:'Отправить повторно', onClick: () => nav.toast('Инвойс отправлен') },
              ...(r[4]==='ожидает' ? [{ icon:'check', label:'Отметить оплаченным', onClick: () => nav.toast('Отмечен оплаченным') }] : []),
            ]}/>
          </div>
        ))}
      </div>
    )}

    {seg === 'payouts' && (
      <div className="vt-card" style={{padding:'48px 24px', textAlign:'center'}}>
        <div style={{width:48, height:48, borderRadius:'var(--r-field)', background:'var(--vt-bone-2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto'}}><Icon name="wallet" size={24} stroke="var(--vt-mute-2)"/></div>
        <div style={{fontFamily:'var(--f-display)', fontWeight:600, fontSize:'var(--fs-md)', marginTop:14}}>Выплат пока нет</div>
        <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:6, maxWidth:420, marginInline:'auto', lineHeight:1.5}}>Платформа продаёт credits организациям и не удерживает деньги игроков. Выплаты появятся при подключении эквайринга (Phase 12+).</div>
        <button onClick={() => nav.toast('Документация по эквайрингу')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{marginTop:16}}>Про эквайринг</button>
      </div>
    )}
  </AdminShell>
  );
};

// ============================================================
// AdminSettings — broad platform settings with subsections
// ============================================================
const AdminSettings = () => {
  const nav = useNav();
  const [tab, setTab] = React.useState('Платформа');
  const [flags, setFlags] = React.useState({ contributions:true, subscriptions:true, online_payments:false, tournaments:false, crm_pro:false });
  const tabs = ['Платформа','Команда & роли','Feature flags','Лимиты & квоты','Уведомления','Биллинг','Безопасность','API & вебхуки'];

  const Toggle = ({ on, onClick, label, sub, phase }) => (
    <button onClick={onClick} style={{display:'flex', alignItems:'center', gap:14, padding:'12px 14px', borderRadius:'var(--r-chip)', background:'var(--vt-ctl-track)', width:'100%', textAlign:'left', cursor:'pointer'}}>
      <div style={{flex:1}}>
        <div style={{fontSize:'var(--fs-base)', fontWeight:600, display:'flex', alignItems:'center', gap:8}}>{label}{phase && <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>{phase}</span>}</div>
        {sub && <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{sub}</div>}
      </div>
      <div style={{width:36, height:20, borderRadius:'var(--r-pill)', background:on?'var(--vt-ink)':'var(--vt-stroke-2)', position:'relative', flexShrink:0}}>
        <span style={{position:'absolute', top:2, left: on?18:2, width:16, height:16, borderRadius:'var(--r-pill)', background:'var(--vt-paper)', transition:'left .15s'}}/>
      </div>
    </button>
  );

  return (
  <AdminShell activeNav="settings" title="Настройки" sub="Платформа, роли, фичи, лимиты и интеграции">
    <div style={{display:'grid', gridTemplateColumns:'210px 1fr', gap:24}}>
      {/* Side nav */}
      <div style={{display:'flex', flexDirection:'column', gap:2}}>
        {tabs.map(t => (
          <a key={t} onClick={() => setTab(t)} style={{padding:'10px 12px', borderRadius:'var(--r-sm)', background: tab===t?'var(--vt-bone-2)':'transparent', fontSize:'var(--fs-base)', fontWeight: tab===t?600:500, color: tab===t?'var(--vt-ink)':'var(--vt-ink-3)', cursor:'pointer'}}>{t}</a>
        ))}
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:18}}>
        {tab === 'Платформа' && (
          <div className="vt-card" style={{padding:22}}>
            <h3 style={{fontSize:'var(--fs-md)'}}>Профиль платформы</h3>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:16}}>
              <div><label className="vt-label">Название</label><input className="vt-field" defaultValue="VolleyTime"/></div>
              <div><label className="vt-label">Домен</label><input className="vt-field" defaultValue="volleytime.by"/></div>
              <div><label className="vt-label">Поддержка</label><input className="vt-field" defaultValue="@volleytime_help"/></div>
              <div><label className="vt-label">Валюта по умолчанию</label><input className="vt-field" defaultValue="BYN"/></div>
              <div style={{gridColumn:'1/-1'}}><label className="vt-label">Регион / TZ</label><input className="vt-field" defaultValue="Беларусь · Europe/Minsk (UTC+3)"/></div>
            </div>
            <div style={{display:'flex', justifyContent:'flex-end', marginTop:18}}><button onClick={() => nav.toast('Сохранено')} className="vt-btn vt-btn--ink vt-btn--sm">Сохранить</button></div>
          </div>
        )}

        {tab === 'Команда & роли' && (
          <div className="vt-card" style={{padding:22}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
              <h3 style={{fontSize:'var(--fs-md)'}}>Команда платформы</h3>
              <button onClick={() => nav.toast('Приглашение отправлено')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{gap:6}}><Icon name="plus" size={13}/> Пригласить</button>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:14}}>
              {[['Иван П.','root@volleytime','Owner','ink'],['Анна К.','anna@volleytime','Admin','flame'],['Поддержка','support@volleytime','Support','grass']].map((m,i) => (
                <div key={i} style={{display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:'var(--r-chip)'}}>
                  <Avi name={m[0]} init={m[0].slice(0,2)} tag={m[3]} size="sm"/>
                  <div style={{flex:1}}><div style={{fontSize:'var(--fs-base)', fontWeight:600}}>{m[0]}</div><div className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{m[1]}</div></div>
                  <span className="vt-chip vt-chip--solid" style={{fontSize:'var(--fs-2xs)'}}>{m[2]}</span>
                  <ActionMore mode="popover" align="right" items={[{icon:'star',label:'Изменить роль',onClick:()=>nav.toast('Роль изменена')},'---',{icon:'logout',tone:'danger',label:'Удалить из команды',onClick:()=>nav.toast('Удалён')}]}/>
                </div>
              ))}
            </div>
            <div style={{marginTop:16}}>
              <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:10}}>Матрица ролей</div>
              <div style={{background:'var(--vt-paper)', borderRadius:'var(--r-tile)', overflow:'hidden'}}>
                <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', padding:'8px 14px', background:'var(--vt-bone-2)'}}>
                  {['Право','Owner','Admin','Support'].map((h,i)=><div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>)}
                </div>
                {[['Организации',1,1,0],['Выдача credits',1,1,0],['Тарифы',1,0,0],['Аудит',1,1,1],['Команда',1,0,0]].map((r,i,a)=>(
                  <div key={i} style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', padding:'10px 14px', borderTop:'1px solid var(--vt-bone-2)', alignItems:'center', fontSize:'var(--fs-sm)'}}>
                    <span>{r[0]}</span>
                    {[r[1],r[2],r[3]].map((v,j)=><span key={j}>{v?<Icon name="check" size={14} stroke="var(--vt-grass)" sw={2.4}/>:<span style={{color:'var(--vt-stroke-2)'}}>—</span>}</span>)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'Feature flags' && (
          <div className="vt-card" style={{padding:22}}>
            <h3 style={{fontSize:'var(--fs-md)'}}>Глобальные feature flags</h3>
            <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4}}>Включают модули для всех организаций. Можно переопределить на уровне отдельной org.</div>
            <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:16}}>
              <Toggle on={flags.subscriptions} onClick={()=>setFlags(f=>({...f,subscriptions:!f.subscriptions}))} label="Абонементы" sub="Покупка и списание сессий" phase="Phase 6"/>
              <Toggle on={flags.contributions} onClick={()=>setFlags(f=>({...f,contributions:!f.contributions}))} label="Сборы (contributions)" sub="Кампании по сбору средств" phase="Phase 11"/>
              <Toggle on={flags.online_payments} onClick={()=>setFlags(f=>({...f,online_payments:!f.online_payments}))} label="Онлайн-оплата (bePaid)" sub="Эквайринг картой" phase="Phase 12"/>
              <Toggle on={flags.tournaments} onClick={()=>setFlags(f=>({...f,tournaments:!f.tournaments}))} label="Турниры" sub="Сетки, группы, расписание" phase="Phase 16"/>
              <Toggle on={flags.crm_pro} onClick={()=>setFlags(f=>({...f,crm_pro:!f.crm_pro}))} label="CRM Pro" sub="Расширенная аналитика игроков" phase="Phase 18"/>
            </div>
          </div>
        )}

        {tab === 'Лимиты & квоты' && (
          <div className="vt-card" style={{padding:22}}>
            <h3 style={{fontSize:'var(--fs-md)'}}>Лимиты и квоты</h3>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:16}}>
              <div><label className="vt-label">Demo-квота новой org (credits)</label><input className="vt-field" defaultValue="5" style={{fontFamily:'var(--f-mono)', fontWeight:600}}/></div>
              <div><label className="vt-label">Макс. игроков в org (beta)</label><input className="vt-field" defaultValue="50" style={{fontFamily:'var(--f-mono)', fontWeight:600}}/></div>
              <div><label className="vt-label">Макс. событий / день</label><input className="vt-field" defaultValue="10" style={{fontFamily:'var(--f-mono)', fontWeight:600}}/></div>
              <div><label className="vt-label">Бронь до подтверждения (мин)</label><input className="vt-field" defaultValue="15" style={{fontFamily:'var(--f-mono)', fontWeight:600}}/></div>
              <div><label className="vt-label">TTL продвижения из листа ожидания (мин)</label><input className="vt-field" defaultValue="30" style={{fontFamily:'var(--f-mono)', fontWeight:600}}/></div>
              <div><label className="vt-label">Rate limit бота (msg/сек)</label><input className="vt-field" defaultValue="25" style={{fontFamily:'var(--f-mono)', fontWeight:600}}/></div>
            </div>
            <div style={{display:'flex', justifyContent:'flex-end', marginTop:18}}><button onClick={() => nav.toast('Лимиты сохранены')} className="vt-btn vt-btn--ink vt-btn--sm">Сохранить</button></div>
          </div>
        )}

        {tab === 'Уведомления' && (
          <div className="vt-card" style={{padding:22}}>
            <h3 style={{fontSize:'var(--fs-md)'}}>Системные уведомления</h3>
            <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:16}}>
              <Toggle on={true} onClick={()=>nav.toast('переключено')} label="Алерт при ошибках бота" sub="В Telegram-канал команды"/>
              <Toggle on={true} onClick={()=>nav.toast('переключено')} label="Новая регистрация организации" sub="Письмо + канал"/>
              <Toggle on={false} onClick={()=>nav.toast('переключено')} label="Еженедельный дайджест метрик" sub="Понедельник 09:00"/>
              <Toggle on={true} onClick={()=>nav.toast('переключено')} label="Низкий баланс credits у org" sub="Когда осталось < 5"/>
            </div>
          </div>
        )}

        {tab === 'Биллинг' && (
          <div className="vt-card" style={{padding:22}}>
            <h3 style={{fontSize:'var(--fs-md)'}}>Биллинг платформы</h3>
            <div style={{display:'grid', gridTemplateColumns:'auto 1fr', columnGap:14, rowGap:12, marginTop:16, fontSize:'var(--fs-sm)', alignItems:'center'}}>
              <span style={{color:'var(--vt-mute-2)'}}>Модель</span><span>Pay-as-you-go · продажа credits организациям</span>
              <span style={{color:'var(--vt-mute-2)'}}>Эквайринг</span><span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:8,height:8,borderRadius:'var(--r-pill)',background:'var(--vt-amber)'}}/> bePaid — не подключён (Phase 12)</span>
              <span style={{color:'var(--vt-mute-2)'}}>Реквизиты</span><span className="vt-mono" style={{fontSize:'var(--fs-xs)'}}>Belarusbank · УНП 191234567</span>
              <span style={{color:'var(--vt-mute-2)'}}>Инвойсы</span><span>Авто-генерация при покупке пакета</span>
            </div>
            <button onClick={() => nav.toast('Настройка эквайринга')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{marginTop:16}}>Подключить bePaid</button>
          </div>
        )}

        {tab === 'Безопасность' && (
          <div className="vt-card" style={{padding:22}}>
            <h3 style={{fontSize:'var(--fs-md)'}}>Безопасность</h3>
            <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:16}}>
              <Toggle on={true} onClick={()=>nav.toast('переключено')} label="2FA для команды платформы" sub="Обязательно для Admin и Owner"/>
              <Toggle on={true} onClick={()=>nav.toast('переключено')} label="Логировать импер-сессии" sub="«Войти как owner» пишется в аудит"/>
              <Toggle on={false} onClick={()=>nav.toast('переключено')} label="IP-allowlist для root" sub="Доступ только с доверенных адресов"/>
            </div>
            <div style={{marginTop:16}}>
              <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:8}}>Активные сессии команды</div>
              <div className="vt-card" style={{padding:0, overflow:'hidden', background:'var(--vt-paper)'}}>
                {[['root@volleytime','Минск · Chrome','сейчас'],['anna@volleytime','Минск · Safari','2 ч назад']].map((s,i,a)=>(
                  <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:i<a.length-1?'1px solid var(--vt-bone-2)':'none', fontSize:'var(--fs-sm)'}}>
                    <Icon name="user" size={14} stroke="var(--vt-mute-2)"/>
                    <span className="vt-mono" style={{flex:1}}>{s[0]}</span>
                    <span style={{color:'var(--vt-mute-2)'}}>{s[1]}</span>
                    <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{s[2]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'API & вебхуки' && (
          <div className="vt-card" style={{padding:22}}>
            <h3 style={{fontSize:'var(--fs-md)'}}>API & вебхуки</h3>
            <label className="vt-label" style={{marginTop:14}}>Telegram webhook</label>
            <div style={{display:'flex', gap:8}}>
              <div className="vt-field vt-mono" style={{flex:1, fontSize:'var(--fs-xs)', display:'flex', alignItems:'center', color:'var(--vt-ink-3)'}}>https://api.volleytime.by/tg/webhook</div>
              <span style={{display:'flex', alignItems:'center', gap:6, padding:'0 12px', fontSize:'var(--fs-xs)'}}><span style={{width:8,height:8,borderRadius:'var(--r-pill)',background:'var(--vt-grass)'}}/> active</span>
            </div>
            <label className="vt-label" style={{marginTop:16}}>API-ключи</label>
            <div className="vt-card" style={{padding:0, overflow:'hidden', background:'var(--vt-paper)'}}>
              {[['prod','vt_live_••••••8f2a','создан 18 марта'],['test','vt_test_••••••3c1b','создан 1 мая']].map((k,i,a)=>(
                <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderBottom:i<a.length-1?'1px solid var(--vt-bone-2)':'none', fontSize:'var(--fs-sm)'}}>
                  <span className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>{k[0]}</span>
                  <span className="vt-mono" style={{flex:1}}>{k[1]}</span>
                  <span style={{color:'var(--vt-mute-2)', fontSize:'var(--fs-2xs)'}}>{k[2]}</span>
                  <button onClick={() => nav.toast('Скопировано')} style={{color:'var(--vt-mute)', cursor:'pointer'}}><Icon name="copy" size={14}/></button>
                </div>
              ))}
            </div>
            <button onClick={() => nav.toast('Новый ключ создан')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{marginTop:14, gap:6}}><Icon name="plus" size={13}/> Создать ключ</button>
          </div>
        )}
      </div>
    </div>
  </AdminShell>
  );
};

Object.assign(window, { AdminOrgCreate, AdminPackCreate, AdminGrantCredits, AdminCreditsHistory, AdminPayouts, AdminSettings });
