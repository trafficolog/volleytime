// brand-screens.jsx — экранные паттерны в бренд-системе: живые компоненты из продукта

const DemoPhone = ({ children, height = 720, label }) => {
  const { ctx, sheet, popover, toast, alertCfg } = useNavState('demo');
  return (
    <div style={{display:'flex', flexDirection:'column', gap:10, alignItems:'flex-start'}}>
      {label && <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{label}</div>}
      <NavContext.Provider value={ctx}>
        <div className="vt-phone vt-frame" data-vt-popover-root="" style={{
          width:390, height, borderRadius:32, overflow:'hidden', position:'relative',
          display:'flex', flexDirection:'column', background:'var(--vt-paper)',
          boxShadow:'0 1px 2px rgba(21,22,26,.06), 0 18px 40px -18px rgba(21,22,26,.28)'
        }}>
          {children}
          <NavOverlays sheet={sheet} popover={popover} toast={toast} alertCfg={alertCfg} ctx={ctx}/>
        </div>
      </NavContext.Provider>
    </div>
  );
};

const Sub = ({ n, title, children }) => (
  <div style={{marginTop: n === 1 ? 0 : 40}}>
    <div style={{display:'flex', alignItems:'baseline', gap:10, marginBottom:14}}>
      <span className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:700, color:'var(--vt-mute-2)'}}>{String(n).padStart(2, '0')}</span>
      <span style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:'var(--fs-2xl)', letterSpacing:0}}>{title}</span>
    </div>
    {children}
  </div>
);

const Note = ({ children }) => (
  <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-ink-3)', lineHeight:1.55}}>{children}</div>
);

// ---------- 1 · Статусная модель ----------
const StatusDemo = () => {
  const rows = [
    { title:'Основа',          time:'20:00', venue:'Школа №24',      main:'12/14', meterPct:86,  joined:true },
    { title:'Микст',           time:'10:00', venue:'Школа №24',      main:'14/14', meterPct:100, status:'full', inWaitlist:true, waitPos:2 },
    { title:'Открытая игра',   time:'19:30', venue:'СК «Заслонова»', main:'9/14',  meterPct:64 },
    { title:'Воскресная игра', time:'11:00', venue:'Школа №24',      main:'12/16', meterPct:75,  status:'closed', joined:true },
    { title:'Основа',          time:'20:00', venue:'Школа №24',      main:'13/14', meterPct:93,  past:true },
  ];
  return (
    <div style={{display:'grid', gridTemplateColumns:'minmax(0,1.1fr) minmax(0,1fr)', gap:16}}>
      <div className="vt-card vt-card--raised" style={{padding:'6px 18px'}}>
        {rows.map((e, i) => {
          const st = eventStateOf(e);
          return (
            <div key={i} style={{display:'flex', alignItems:'center', gap:14, padding:'14px 0', boxShadow: i ? 'inset 0 1px 0 var(--vt-bone-2)' : 'none', filter: e.past ? 'grayscale(1)' : 'none'}}>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:'var(--fs-base)', fontWeight:700}}>{e.title}</div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4}}>
                  {e.time} · {e.venue}{st ? <> · <span style={{color:'var(--vt-ink-3)', fontWeight:600}}>{st.toLowerCase()}</span></> : null}
                </div>
              </div>
              <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8}}>
                <MyChip e={e}/>
                <SeatsMini e={e} width={52}/>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        {[
          ['Моё участие', 'Чип словом, фирменный синий. Только у игрока. Не записан — чипа нет. «Иду» остаётся синим и после закрытия записи.',
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}><MyChip e={{joined:true}}/><MyChip e={{inWaitlist:true, waitPos:2}}/></div>],
          ['Событие', 'Нейтральный серый, словом. В строке списка — в мета-строке под названием, а не рядом с участием.',
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}><span className="vt-chip vt-chip--state">Запись закрыта</span><span className="vt-chip vt-chip--state">Прошла</span><span className="vt-chip vt-chip--state">Отменена</span></div>],
          ['Места', 'Только цифра и шкала. Цвет живёт на шкале, текст нейтральный. Прошедшее и закрытое — серая шкала.',
            <div style={{display:'flex', gap:14, flexWrap:'wrap'}}><SeatsMini e={{main:'6/14', meterPct:43}}/><SeatsMini e={{main:'12/14', meterPct:86}}/><SeatsMini e={{main:'14/14', meterPct:100}}/></div>],
          ['Оплата', 'Отдельная ось. Amber — нужно действие, grass — в порядке. Согласование числа: «1 ждёт / 2 ждут».',
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}><span className="vt-chip vt-chip--amber">1 ждёт оплаты</span><span className="vt-chip vt-chip--grass vt-chip--dot">оплачено</span><span className="vt-chip">абонемент</span></div>],
        ].map(([h, p, demo]) => (
          <div key={h} className="vt-card" style={{padding:16}}>
            <div style={{fontSize:'var(--fs-sm)', fontWeight:700}}>{h}</div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', lineHeight:1.5, marginTop:4}}>{p}</div>
            <div style={{marginTop:10}}>{demo}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------- 5 · Логотип группы ----------
const OrgLogoDemo = () => (
  <div className="vt-card" style={{padding:20, display:'flex', gap:28, flexWrap:'wrap', alignItems:'flex-end'}}>
    {[['VolleyTime Минск', LOGO_URL], ['СпайкКлуб'], ['МинскВолей · Воскресные'], ['СОК Витебск'], ['Гомель Пляж']].map(([n, l]) => (
      <div key={n} style={{display:'flex', flexDirection:'column', alignItems:'center', gap:8, width:96}}>
        <OrgLogo name={n} logo={l} size={56}/>
        <div style={{display:'flex', gap:6, alignItems:'center'}}><OrgLogo name={n} logo={l} size={32}/><OrgLogo name={n} logo={l} size={20}/></div>
        <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', textAlign:'center', lineHeight:1.3}}>{l ? 'свой логотип' : n}</div>
      </div>
    ))}
    <Note>Нет логотипа — монограмма из двух букв в Oswald на тоновой плитке. Цвет плитки выбирается по хэшу названия, поэтому у группы он всегда один и тот же.</Note>
  </div>
);

// ---------- static overlay frames ----------
const SheetFrame = () => (
  <DemoPhone height={560} label="Шторка · выбор группы">
    <div style={{padding:'18px 18px 0', filter:'blur(0.4px)'}}>
      <div style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:'var(--fs-3xl)'}}>Ближайшая игра</div>
      <div className="vt-card vt-card--hero" style={{height:160, marginTop:14}}/>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}><div className="vt-card vt-card--warm" style={{height:96}}/><div className="vt-card vt-card--cool" style={{height:96}}/></div>
    </div>
    <ActionSheet title="Группы" onClose={() => {}} items={[
      { org:true, radio:true, logo:LOGO_URL, label:'VolleyTime Минск', sub:'владелец · 14 игроков' },
      { org:true, radio:false, label:'СпайкКлуб', sub:'игрок · 22 игрока' },
      '---',
      { icon:'plus', label:'Создать группу' },
      { icon:'qr', label:'Вступить по ссылке' },
    ]}/>
  </DemoPhone>
);

const AlertFrame = () => (
  <DemoPhone height={560} label="Подтверждение · опасное действие">
    <MiniHeader title="Основа · 28 мая" sub="20:00 · Школа №24" onBack/>
    <div className="vt-phone__body" style={{padding:'12px 16px'}}><div className="vt-card" style={{height:180}}/></div>
    <AlertModal title="Отменить запись?" body="Место уйдёт первому из листа ожидания. Абонемент вернётся." confirm="Отменить запись" cancel="Оставить" danger onClose={() => {}}/>
  </DemoPhone>
);

const EmptyFrame = () => (
  <DemoPhone height={560} label="Пустое состояние · офлайн · тост">
    <MiniHeader title="Сборы"/>
    <div style={{paddingTop:8}}><OfflineBanner onRetry={() => {}}/></div>
    <div className="vt-phone__body">
      <EmptyState icon="gift" title="Сборов пока нет" body="Когда организатор начнёт сбор на мячи или аренду, он появится здесь." action="Как это работает" tone="warm"/>
    </div>
    <Toast msg="Ссылка скопирована" tone="ok"/>
    <TabBar active="contrib"/>
  </DemoPhone>
);

// ---------- section ----------
const BrandScreens = () => (
  <div>
    <Sub n={1} title="Статусная модель">
      <StatusDemo/>
    </Sub>

    <Sub n={2} title="Расписание на месяц">
      <div style={{display:'flex', flexWrap:'wrap', gap:28, alignItems:'flex-start'}}>
        <DemoPhone height={780}><ScheduleMonth role="player"/></DemoPhone>
        <div style={{display:'flex', flexDirection:'column', gap:12, flex:'1 1 300px', minWidth:0}}>
          {[
            ['Точка в ячейке — тренировка', <span style={{display:'inline-flex', gap:6}}><i style={{width:7, height:7, borderRadius:'50%', background:'var(--vt-flame)', display:'inline-block'}}/><i style={{width:7, height:7, borderRadius:'50%', boxShadow:'inset 0 0 0 1.5px var(--vt-flame)', display:'inline-block'}}/></span>,
              'Залитая синяя — вы идёте, контурная — просто тренировка в этот день. Больше двух — показываем две точки и не пытаемся уместить всё.'],
            ['Выбранный день', null, 'Ячейка заливается ink, под сеткой — список тренировок этого дня в формате строки расписания.'],
            ['Два вида', null, '«Календарь» — сетка месяца, «Список» — по неделям. Фильтр «Мои» есть только у игрока.'],
            ['Вход', null, 'Кнопка «Смотреть все» на главной у игрока и организатора. Переключение месяцев — стрелками в шапке.'],
          ].map(([h, mark, p]) => (
            <div key={h} className="vt-card" style={{padding:16}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>{mark}<span style={{fontSize:'var(--fs-sm)', fontWeight:700}}>{h}</span></div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', lineHeight:1.5, marginTop:6}}>{p}</div>
            </div>
          ))}
        </div>
      </div>
    </Sub>

    <Sub n={3} title="Серия тренировок">
      <div style={{display:'grid', gridTemplateColumns:'minmax(0,1.2fr) minmax(0,1fr)', gap:16, alignItems:'start'}}>
        <div className="vt-card vt-card--raised" style={{padding:20}}><RecurrenceBlock wide/></div>
        <div className="vt-card" style={{padding:18}}>
          <Note>
            Одно действие вместо десятков. Повтор × дни недели × срок, ниже — живой предпросмотр: сколько тренировок, диапазон дат, правило словами и сами даты чипами.
            <br/><br/>
            Конфликт зала превращает дату в черновик, а не блокирует всю серию. Credits списываются по 1 за тренировку: если их не хватает, публикуются первые N, остальные ждут пополнения.
          </Note>
        </div>
      </div>
    </Sub>

    <Sub n={4} title="Шторки, подтверждения и состояния">
      <div style={{display:'flex', flexWrap:'wrap', gap:24}}>
        <SheetFrame/><AlertFrame/><EmptyFrame/>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:12, marginTop:16}}>
        {[
          ['Шторка', 'Выбор из списка и действия над объектом. Текущий вариант — залитый синий круг с галочкой. Разделитель отделяет выбор от действий.'],
          ['Подтверждение', 'Только для необратимого: отмена записи, удаление, блокировка. Опасная кнопка — красная, безопасная — слева и называется по смыслу («Оставить»).'],
          ['Пустое и офлайн', 'Пустой экран объясняет причину одной строкой и даёт следующий шаг. Офлайн-баннер сверху, кэшированный контент под ним остаётся читаемым.'],
        ].map(([h, p]) => (
          <div key={h} className="vt-card" style={{padding:16}}>
            <div style={{fontSize:'var(--fs-sm)', fontWeight:700}}>{h}</div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', lineHeight:1.5, marginTop:4}}>{p}</div>
          </div>
        ))}
      </div>
    </Sub>

    <Sub n={5} title="Логотип группы">
      <OrgLogoDemo/>
    </Sub>

    <Sub n={6} title="Навигация Mini App">
      <div style={{display:'flex', flexWrap:'wrap', gap:24}}>
        {[['Игрок', <TabBar active="home"/>], ['Организатор', <OrgTabBar active="home"/>]].map(([l, bar]) => (
          <div key={l} style={{display:'flex', flexDirection:'column', gap:10}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{l}</div>
            <div className="vt-phone vt-frame" style={{width:390, borderRadius:24, overflow:'hidden', position:'relative', background:'var(--vt-paper)', boxShadow:'0 1px 2px rgba(21,22,26,.06), 0 18px 40px -18px rgba(21,22,26,.28)', display:'flex', flexDirection:'column'}}>
              <MiniHeader title="Расписание" sub="9 тренировок" onBack/>
              <div style={{height:120, background:'var(--vt-bone)', margin:'0 16px 16px', borderRadius:'var(--r-card)'}}/>
              {bar}
            </div>
          </div>
        ))}
      </div>
      <div style={{marginTop:12}}><Note>Четыре вкладки у обеих ролей. Плавающая плашка таб-бара с тенью, активная вкладка — ink. Шапка экрана: назад слева, название Oswald, подпись — одна строка контекста.</Note></div>
    </Sub>
  </div>
);

Object.assign(window, { BrandScreens, DemoPhone, Sub });
