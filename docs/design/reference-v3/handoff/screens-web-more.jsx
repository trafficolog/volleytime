// Кабинет: долги и ограничения (W-18), разрез отчётов (W-19)
const WebDebtPanel = () => {
  const nav = useNav();
  const [rule, setRule] = React.useState(true);
  return (
    <div className="vt-card" style={{padding:18, marginBottom:14, display:'grid', gridTemplateColumns:'minmax(0,1.3fr) minmax(0,1fr)', gap:20}}>
      <div>
        <div style={{display:'flex', alignItems:'baseline', gap:10}}>
          <h3 style={{fontSize:'var(--fs-md)'}}>Долги</h3>
          <span className="vt-mono" style={{fontWeight:700, color:'var(--vt-rose)'}}>−45,00 BYN</span>
          <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>у 3 игроков</span>
        </div>
        <div style={{display:'flex', flexDirection:'column', marginTop:10}}>
          {[['Лера', '15,00', 'Основа 21 мая', 'ЛС', 'rose'], ['Денис', '15,00', 'Открытая 23 мая', 'ДН', 'amber'], ['Соня', '15,00', 'Основа 28 мая', 'СН', 'grass']].map(([n, a, ev, init, tag], i) => (
            <div key={n} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop: i ? '1px solid var(--vt-bone-2)' : 'none'}}>
              <Avi size="sm" name={n} init={init} tag={tag}/>
              <span style={{fontSize:'var(--fs-sm)', fontWeight:600, width:70}}>{n}</span>
              <span style={{flex:1, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{ev}</span>
              <span className="vt-mono" style={{fontSize:'var(--fs-sm)', fontWeight:600, color:'var(--vt-rose)'}}>−{a}</span>
              <ActionMore mode="popover" align="right" items={[
                { icon:'send', label:'Напомнить', onClick: () => nav.toast(`Напоминание с реквизитами отправлено · ${n}`) },
                { icon:'check', label:'Отметить оплаченным', onClick: () => nav.toast(`${n} · оплата записана в кассу`) },
                { icon:'close', label:'Списать долг', onClick: () => nav.toast(`Долг ${n} списан · запись в кассе «списание»`) },
              ]}/>
            </div>
          ))}
        </div>
        <button onClick={() => nav.toast('Напоминание с реквизитами ушло 3 игрокам в бот')} className="vt-btn vt-btn--primary vt-btn--sm" style={{marginTop:10, gap:6}}><Icon name="send" size={13}/> Напомнить всем</button>
      </div>
      <div style={{borderLeft:'1px solid var(--vt-bone-2)', paddingLeft:20}}>
        <h3 style={{fontSize:'var(--fs-md)'}}>Правила записи</h3>
        {[
          [rule, setRule, 'Не пускать с долгом', 'Запись закрыта, пока долг больше 15,00 BYN'],
          [true, () => nav.toast('Изменено'), 'Заморозка за no-show', '3 неявки подряд → запись на 14 дней по одобрению'],
        ].map(([on, set, t, s], i) => (
          <div key={t} style={{display:'flex', alignItems:'flex-start', gap:12, padding:'10px 0', borderTop: i ? '1px solid var(--vt-bone-2)' : 'none'}}>
            <div style={{flex:1}}><div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{t}</div><div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{s}</div></div>
            <TeamSwitch on={on} onChange={(v) => set(v)} label={t}/>
          </div>
        ))}
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:6}}>Сейчас ограничены: Денис (долг), Марат (no-show до 9 июня)</div>
      </div>
    </div>
  );
};

const restrictItems = (nav, name) => [
  { icon:'lock', label:'Ограничить запись', onClick: () => nav.sheet({ title:`Ограничить · ${name}`, items:[
    { label:'Только по одобрению', sub:'Игрок видит события, запись ждёт вашего ответа', onClick: () => nav.toast(`${name} · запись по одобрению`) },
    { label:'Заморозить на 14 дней', sub:'Записаться нельзя, уведомления приходят', onClick: () => nav.toast(`${name} · заморожен до 9 июня`) },
    { label:'Заблокировать в группе', sub:'Не видит события, не получает уведомлений', tone:'danger', onClick: () => nav.toast(`${name} · заблокирован в группе`) },
  ]}) },
  { icon:'chat', label:'Заметка организатора', onClick: () => nav.toast(`Заметка видна только команде · ${name}`) },
];

const WebReportsBreakdown = () => {
  const [cut, setCut] = React.useState('coach');
  const data = {
    coach: [['Ольга Романова', 9, '88%', '1 215,00', '378,00'], ['Дмитрий Ковалёв', 4, '71%', '480,00', '168,00'], ['Без тренера', 5, '79%', '645,00', '210,00']],
    venue: [['Школа №24, малый зал', 10, '86%', '1 350,00', '420,00'], ['СК «Заслонова», зал 2', 6, '75%', '810,00', '264,00'], ['СК «Олимп»', 2, '64%', '180,00', '72,00']],
    series: [['Основа · Ср', 5, '90%', '750,00', '210,00'], ['Основа · Пт', 4, '84%', '540,00', '168,00'], ['Микст · Вс', 4, '71%', '480,00', '168,00'], ['Разовые', 5, '76%', '570,00', '210,00']],
  }[cut];
  const cols = 'minmax(0,2fr) 90px 120px 140px 140px';
  return (
    <div className="vt-card" style={{padding:0, overflow:'hidden', marginBottom:18}}>
      <div style={{display:'flex', alignItems:'center', gap:8, padding:'14px 18px', borderBottom:'1px solid var(--vt-bone-2)'}}>
        <h3 style={{fontSize:'var(--fs-md)', flex:1}}>В разрезе</h3>
        {[['coach','По тренерам'],['venue','По залам'],['series','По сериям']].map(([k, l]) => (
          <button key={k} onClick={() => setCut(k)} className="vt-btn vt-btn--sm" style={{background: cut === k ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: cut === k ? 'var(--vt-paper)' : 'var(--vt-ink)', fontWeight:600}}>{l}</button>
        ))}
      </div>
      <div style={{display:'grid', gridTemplateColumns:cols, gap:12, padding:'10px 18px', borderBottom:'1px solid var(--vt-bone-2)'}}>
        {['', 'Игр', 'Заполняемость', 'Выручка, BYN', 'Аренда, BYN'].map((h, i) => <div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>)}
      </div>
      {data.map(([n, g, f, r, a], i) => (
        <div key={n} style={{display:'grid', gridTemplateColumns:cols, gap:12, padding:'11px 18px', borderBottom: i < data.length - 1 ? '1px solid var(--vt-bone-2)' : 'none', alignItems:'center', fontSize:'var(--fs-sm)'}}>
          <div style={{fontWeight:600}}>{n}</div>
          <div className="vt-mono">{g}</div>
          <div style={{display:'flex', alignItems:'center', gap:8}}><div className="vt-meter" style={{width:50}}><i style={{width:f, background: meterTint(parseInt(f))}}/></div><span className="vt-mono">{f}</span></div>
          <div className="vt-mono" style={{fontWeight:600}}>{r}</div>
          <div className="vt-mono" style={{color:'var(--vt-mute-2)'}}>{a}</div>
        </div>
      ))}
    </div>
  );
};

Object.assign(window, { WebDebtPanel, restrictItems, WebReportsBreakdown });
