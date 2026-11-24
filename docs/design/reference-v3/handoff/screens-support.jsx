// screens-support.jsx — Техподдержка и база знаний
// Mini App (игрок, организатор, тренер): помощь, новое обращение, переписка.
// Кабинет организатора: раздел «Поддержка». Root Admin: очередь обращений и карточка обращения.
// Бот: ответ поддержки приходит сообщением. help.volleytime.by: база знаний с формой обращения.
// Ответ всегда уходит в бот и сохраняется в «Моих обращениях».

// ---------- Данные ----------
const SUP_TOPICS = [
  { k:'booking', t:'Запись и оплата', ic:'ticket' },
  { k:'subs', t:'Абонементы', ic:'card' },
  { k:'bot', t:'Бот и уведомления', ic:'bell' },
  { k:'login', t:'Вход и аккаунт', ic:'lock' },
  { k:'bug', t:'Ошибка в приложении', ic:'settings' },
  { k:'org', t:'Группа и события', ic:'users', org:true },
  { k:'billing', t:'Баланс событий и тариф', ic:'wallet', org:true },
  { k:'page', t:'Страница группы', ic:'globe', org:true },
  { k:'other', t:'Другое', ic:'chat' },
];
const SUP_ST = {
  new:     ['новое', 'vt-chip--state'],
  open:    ['в работе', 'vt-chip--amber'],
  answered:['есть ответ', 'vt-chip--grass'],
  waiting: ['ждём вас', 'vt-chip--amber'],
  solved:  ['решено', 'vt-chip--state'],
};
const SUP_ARTICLES = {
  player: [
    ['Как отменить запись и вернуть деньги', 'Запись и оплата'],
    ['Как работает лист ожидания', 'Запись и оплата'],
    ['Абонемент: сколько осталось и когда сгорает', 'Абонементы'],
    ['Не приходят напоминания от бота', 'Бот и уведомления'],
  ],
  organizer: [
    ['Как создать серию тренировок', 'Группа и события'],
    ['Подтверждение оплат «Я оплатил»', 'Запись и оплата'],
    ['Баланс событий: что списывается и когда', 'Баланс событий и тариф'],
    ['Почему страницу группы скрыли из поиска', 'Страница группы'],
  ],
  coach: [
    ['Как отметить пришедших', 'Группа и события'],
    ['Тренер и приём оплаты', 'Запись и оплата'],
    ['Переключение «Веду» и «Играю»', 'Вход и аккаунт'],
  ],
};
const SUP_MY = [
  { id:'S-1042', topic:'Запись и оплата', title:'Списали два занятия с абонемента', st:'answered', upd:'сегодня, 12:40', unread:true },
  { id:'S-0987', topic:'Бот и уведомления', title:'Не пришло напоминание за 2 часа', st:'solved', upd:'14 мая' },
];
const SUP_THREAD = [
  { from:'me', at:'вчера, 21:14', text:'Записался на «Основу» 28 мая, а с абонемента списали 2 занятия вместо одного.' },
  { from:'sys', at:'вчера, 21:14', text:'Обращение S-1042 создано. Приложили: роль — игрок, группа VolleyTime Минск, событие «Основа · 28 мая», версия 0.8.1.' },
  { from:'agent', who:'Анна · поддержка VolleyTime', at:'сегодня, 12:40', text:'Проверили: вы заняли 2 места — за себя и «+1». Если второе место не нужно, отмените его в карточке записи, занятие вернётся на абонемент сразу.' },
];

// ============================================================
// Mini App
// ============================================================
const SupStatus = ({ st }) => <span className={'vt-chip ' + SUP_ST[st][1]} style={{fontSize:'var(--fs-2xs)'}}>{SUP_ST[st][0]}</span>;

const SupportHub = () => {
  const nav = useNav();
  const role = typeof RoleContext !== 'undefined' ? (React.useContext(RoleContext).person || 'player') : 'player';
  const arts = SUP_ARTICLES[role] || SUP_ARTICLES.player;
  return (
    <>
      <MiniHeader title="Помощь" sub="База знаний и обращения" onBack/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px', display:'flex', flexDirection:'column', gap:14}}>
        <button onClick={() => nav.toast('Открываем help.volleytime.by')} className="vt-field" style={{display:'flex', alignItems:'center', gap:10, padding:'12px 14px', textAlign:'left', color:'var(--vt-mute)', fontSize:'var(--fs-base)', cursor:'pointer'}}>
          <Icon name="search" size={16}/> Поиск по базе знаний
        </button>

        <div>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'4px 4px 8px'}}>{role === 'organizer' ? 'Для организатора' : role === 'coach' ? 'Для тренера' : 'Частые вопросы'}</div>
          <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
            {arts.map(([t, c], i) => (
              <button key={t} onClick={() => nav.toast(`Статья «${t}»`)} style={{display:'flex', alignItems:'center', gap:12, padding:'12px 14px', width:'100%', textAlign:'left', borderBottom: i < arts.length - 1 ? '1px solid var(--vt-stroke)' : 'none', cursor:'pointer'}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:'var(--fs-base)', fontWeight:500}}>{t}</div>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{c}</div>
                </div>
                <Icon name="chevron-r" size={14} stroke="var(--vt-icon-idle)"/>
              </button>
            ))}
          </div>
          <button onClick={() => nav.toast('Открываем help.volleytime.by')} className="vt-btn vt-btn--ghost vt-btn--full" style={{marginTop:8, gap:8}}><Icon name="globe" size={15}/> Вся база знаний</button>
        </div>

        <div>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'4px 4px 8px'}}>Мои обращения</div>
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {SUP_MY.map(s => (
              <button key={s.id} onClick={() => nav.push('support-ticket')} className="vt-card" style={{padding:'12px 14px', textAlign:'left', cursor:'pointer', display:'flex', gap:12, alignItems:'center'}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:'flex', gap:6, alignItems:'center'}}>
                    <span className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{s.id}</span>
                    <SupStatus st={s.st}/>
                    {s.unread && <span aria-label="новое сообщение" style={{width:8, height:8, borderRadius:99, background:'var(--vt-flame)'}}/>}
                  </div>
                  <div style={{fontSize:'var(--fs-base)', fontWeight:600, marginTop:4}}>{s.title}</div>
                  <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{s.topic} · {s.upd}</div>
                </div>
                <Icon name="chevron-r" size={14} stroke="var(--vt-icon-idle)"/>
              </button>
            ))}
          </div>
        </div>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', textAlign:'center'}}>Отвечаем в течение рабочего дня. Ответ придёт в бот.</div>
      </div>
      <div style={{padding:'10px 16px 16px', borderTop:'1px solid var(--vt-stroke)'}}>
        <button onClick={() => nav.push('support-new')} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full" style={{gap:8}}><Icon name="chat" size={16}/> Написать в поддержку</button>
      </div>
    </>
  );
};

const SupportNew = () => {
  const nav = useNav();
  const role = typeof RoleContext !== 'undefined' ? (React.useContext(RoleContext).person || 'player') : 'player';
  const topics = SUP_TOPICS.filter(t => !t.org || role !== 'player');
  const [topic, setTopic] = React.useState('subs');
  const [text, setText] = React.useState('');
  const hint = { subs:'Абонемент: сколько осталось и когда сгорает', booking:'Как отменить запись и вернуть деньги', bot:'Не приходят напоминания от бота', login:'Не получается войти через Telegram', billing:'Баланс событий: что списывается и когда', page:'Почему страницу группы скрыли из поиска' }[topic];
  return (
    <>
      <MiniHeader title="Новое обращение" sub="Поддержка VolleyTime" onBack/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px', display:'flex', flexDirection:'column', gap:14}}>
        <fieldset style={{border:0, padding:0, margin:0}}>
          <legend className="vt-label" style={{marginBottom:8}}>Тема</legend>
          <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
            {topics.map(t => (
              <button key={t.k} type="button" aria-pressed={topic === t.k} onClick={() => setTopic(t.k)} className="vt-btn vt-btn--sm"
                style={{background: topic === t.k ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: topic === t.k ? 'var(--vt-paper)' : 'var(--vt-ink)', fontWeight:600}}>{t.t}</button>
            ))}
          </div>
        </fieldset>
        {hint && (
          <button onClick={() => nav.toast(`Статья «${hint}»`)} className="vt-card" style={{padding:'10px 12px', textAlign:'left', display:'flex', gap:10, alignItems:'center', background:'var(--vt-blue-soft-tile, var(--vt-bone))', cursor:'pointer'}}>
            <Icon name="star" size={15}/>
            <div style={{flex:1}}>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>Возможно, ответ уже есть</div>
              <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{hint}</div>
            </div>
            <Icon name="chevron-r" size={14} stroke="var(--vt-icon-idle)"/>
          </button>
        )}
        <div>
          <div className="vt-label" style={{marginBottom:6}}>К чему относится</div>
          <button onClick={() => nav.sheet({ title:'К чему относится', items:[
            { radio:true, label:'Основа · ср 28 мая, 20:00' }, { radio:false, label:'Абонемент «8 сессий»' }, { radio:false, label:'Группа VolleyTime Минск' }, { radio:false, label:'Ни к чему конкретному' } ] })}
            className="vt-field" style={{width:'100%', display:'flex', alignItems:'center', gap:10, padding:'11px 12px', textAlign:'left', cursor:'pointer', fontSize:'var(--fs-sm)'}}>
            <Icon name="calendar" size={15}/><span style={{flex:1}}>Основа · ср 28 мая, 20:00</span><Icon name="chevron-d" size={14}/>
          </button>
        </div>
        <div>
          <label className="vt-label" htmlFor="sup-text">Что случилось</label>
          <textarea id="sup-text" className="vt-field" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Опишите, что делали и что пошло не так"
            style={{width:'100%', boxSizing:'border-box', marginTop:6, padding:'10px 12px', fontFamily:'var(--f-body)', fontSize:'var(--fs-base)', resize:'none'}}/>
        </div>
        <button onClick={() => nav.toast('Выбор скриншота')} className="vt-btn vt-btn--ghost vt-btn--full" style={{gap:8, justifyContent:'flex-start'}}><Icon name="plus" size={15}/> Приложить скриншот</button>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', lineHeight:1.45}}>Чтобы не переспрашивать, приложим роль, группу, выбранное событие и версию приложения. Ответ придёт в бот и останется в «Моих обращениях».</div>
      </div>
      <div style={{padding:'10px 16px 16px', borderTop:'1px solid var(--vt-stroke)'}}>
        <button disabled={!text.trim()} onClick={() => { nav.replace('support-ticket'); setTimeout(() => nav.toast('Обращение S-1043 отправлено'), 60); }}
          className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full" style={{opacity: text.trim() ? 1 : .5}}>Отправить</button>
      </div>
    </>
  );
};

const SupBubble = ({ m, compact }) => m.from === 'sys' ? (
  <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', textAlign:'center', padding:'2px 12px', lineHeight:1.45}}>{m.text}</div>
) : (
  <div style={{alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: compact ? '86%' : '72%'}}>
    {m.who && <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', margin:'0 4px 4px'}}>{m.who}</div>}
    <div style={{padding:'10px 12px', borderRadius: m.from === 'me' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
      background: m.from === 'me' ? 'var(--vt-flame)' : m.from === 'note' ? 'var(--vt-amber-soft)' : 'var(--vt-bone)', color: m.from === 'me' ? 'var(--vt-on-accent, #fff)' : 'var(--vt-ink)',
      fontSize:'var(--fs-sm)', lineHeight:1.45}}>{m.text}</div>
    <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', margin:'4px 4px 0', textAlign: m.from === 'me' ? 'right' : 'left'}}>{m.at}</div>
  </div>
);

const SupportTicket = () => {
  const nav = useNav();
  const [solved, setSolved] = React.useState(false);
  const [rate, setRate] = React.useState(0);
  return (
    <>
      <MiniHeader title="S-1042" sub="Абонементы · есть ответ" onBack/>
      <div className="vt-phone__body" style={{padding:'8px 16px 16px', display:'flex', flexDirection:'column', gap:12}}>
        <div className="vt-card" style={{padding:'10px 12px'}}>
          <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>Списали два занятия с абонемента</div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>Основа · ср 28 мая · VolleyTime Минск</div>
        </div>
        {SUP_THREAD.map((m, i) => <SupBubble key={i} m={m} compact/>)}
        {solved && (
          <div className="vt-card" style={{padding:14, textAlign:'center'}}>
            <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>Оцените ответ</div>
            <div role="radiogroup" aria-label="Оценка" style={{display:'flex', gap:6, justifyContent:'center', marginTop:8}}>
              {[1,2,3,4,5].map(n => <button key={n} role="radio" aria-checked={rate === n} aria-label={`${n} из 5`} onClick={() => { setRate(n); nav.toast('Спасибо за оценку'); }}
                style={{width:36, height:36, borderRadius:'var(--r-pill)', background: n <= rate ? 'var(--vt-flame)' : 'var(--vt-bone)', color: n <= rate ? '#fff' : 'var(--vt-ink)', display:'inline-flex', alignItems:'center', justifyContent:'center'}}><Icon name="star" size={15}/></button>)}
            </div>
          </div>
        )}
      </div>
      <div style={{padding:'10px 16px 16px', borderTop:'1px solid var(--vt-stroke)', display:'flex', flexDirection:'column', gap:8}}>
        {!solved && <button onClick={() => setSolved(true)} className="vt-btn vt-btn--ghost vt-btn--full" style={{gap:8}}><Icon name="check" size={15}/> Вопрос решён</button>}
        <div style={{display:'flex', gap:8}}>
          <label htmlFor="sup-reply" style={{position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(0 0 0 0)'}}>Ответ</label>
          <input id="sup-reply" className="vt-field" placeholder="Ответить" style={{flex:1, padding:'11px 12px', fontSize:'var(--fs-base)', fontFamily:'var(--f-body)'}}/>
          <button aria-label="Отправить" onClick={() => nav.toast('Сообщение отправлено')} className="vt-btn vt-btn--primary" style={{padding:'0 14px'}}><Icon name="send" size={16}/></button>
        </div>
      </div>
    </>
  );
};

// ============================================================
// Кабинет организатора · «Поддержка»
// ============================================================
const ORG_TICKETS = [
  { id:'S-1051', title:'Не списался баланс за отменённое событие', topic:'Баланс событий и тариф', st:'answered', upd:'сегодня, 11:05', who:'Иван П. · владелец', unread:true },
  { id:'S-1038', title:'Тренер не видит кнопку «Принять оплату»', topic:'Группа и события', st:'waiting', upd:'вчера', who:'Ольга Р. · тренер' },
  { id:'S-0990', title:'Почему страницу группы скрыли из поиска', topic:'Страница группы', st:'solved', upd:'30 апр', who:'Иван П. · владелец' },
];
const ORG_THREAD = [
  { from:'me', at:'вчера, 18:20', text:'Отменили «Микст» 1 июня, а событие с баланса не вернулось. Сейчас 32, было 33.' },
  { from:'sys', at:'вчера, 18:20', text:'Приложили: организация VolleyTime Минск, событие «Микст · 1 июня», раздел «Баланс и оплата».' },
  { from:'agent', who:'Анна · поддержка VolleyTime', at:'сегодня, 11:05', text:'Событие списывается, когда в нём появилась первая запись, и не возвращается при отмене позже чем за 24 часа. «Микст» отменили за 6 часов. Начислили 1 событие в виде исключения — баланс снова 33.' },
];

const WebSupport = () => {
  const nav = useNav();
  const [sel, setSel] = React.useState(nav.data.new || nav.current === 'support-new' ? 'new' : 'S-1051');
  const [topic, setTopic] = React.useState('billing');
  const t = ORG_TICKETS.find(x => x.id === sel);
  return (
    <WebShell activeNav="support" title="Поддержка" sub="Обращения команды группы · ответ приходит сюда и в бот"
      topRight={<button onClick={() => setSel('new')} className="vt-btn vt-btn--primary vt-btn--sm"><Icon name="plus" size={14}/> Новое обращение</button>}>
      <div style={{display:'grid', gridTemplateColumns:'340px minmax(0,1fr)', gap:16, alignItems:'start'}}>
        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          <div className="vt-card" style={{padding:6}}>
            {ORG_TICKETS.map(s => (
              <button key={s.id} aria-pressed={sel === s.id} onClick={() => setSel(s.id)} style={{display:'block', width:'100%', textAlign:'left', padding:'10px 12px', borderRadius:'var(--r-sm)', cursor:'pointer',
                background: sel === s.id ? 'var(--vt-paper)' : 'transparent', boxShadow: sel === s.id ? 'var(--vt-shadow-card)' : 'none'}}>
                <div style={{display:'flex', gap:6, alignItems:'center'}}>
                  <span className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{s.id}</span><SupStatus st={s.st}/>
                  {s.unread && <span aria-label="новое сообщение" style={{width:8, height:8, borderRadius:99, background:'var(--vt-flame)'}}/>}
                  <span style={{flex:1}}/><span style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{s.upd}</span>
                </div>
                <div style={{fontSize:'var(--fs-sm)', fontWeight:600, marginTop:4}}>{s.title}</div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{s.topic} · {s.who}</div>
              </button>
            ))}
          </div>
          <div className="vt-card" style={{padding:14}}>
            <div style={{fontSize:'var(--fs-sm)', fontWeight:700}}>База знаний для организатора</div>
            {SUP_ARTICLES.organizer.map(([a]) => (
              <button key={a} onClick={() => nav.toast(`help.volleytime.by · «${a}»`)} style={{display:'flex', gap:8, alignItems:'center', width:'100%', textAlign:'left', padding:'8px 0', borderTop:'1px solid var(--vt-bone-2)', marginTop:6, fontSize:'var(--fs-sm)', color:'var(--vt-flame-ink)', cursor:'pointer'}}>
                <span style={{flex:1}}>{a}</span><Icon name="arrow-r" size={13}/>
              </button>
            ))}
          </div>
        </div>

        {sel === 'new' ? (
          <div className="vt-card" style={{padding:20, display:'flex', flexDirection:'column', gap:14}}>
            <div style={{fontSize:'var(--fs-lg)', fontWeight:700}}>Новое обращение</div>
            <fieldset style={{border:0, padding:0, margin:0}}>
              <legend className="vt-label" style={{marginBottom:8}}>Тема</legend>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {SUP_TOPICS.map(x => (
                  <button key={x.k} type="button" aria-pressed={topic === x.k} onClick={() => setTopic(x.k)} className="vt-btn vt-btn--sm" style={{gap:6, background: topic === x.k ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: topic === x.k ? 'var(--vt-paper)' : 'var(--vt-ink)', fontWeight:600}}><Icon name={x.ic} size={13}/>{x.t}</button>
                ))}
              </div>
            </fieldset>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <div><label className="vt-label" htmlFor="ws-subj">Коротко</label><input id="ws-subj" className="vt-field" placeholder="Например: не вернулось событие на баланс" style={{width:'100%', boxSizing:'border-box', marginTop:6, padding:'10px 12px', fontSize:'var(--fs-sm)'}}/></div>
              <div><label className="vt-label" htmlFor="ws-rel">К чему относится</label><select id="ws-rel" className="vt-field" style={{width:'100%', marginTop:6, padding:'10px 12px', fontSize:'var(--fs-sm)'}}><option>Микст · 1 июня</option><option>Баланс и оплата</option><option>Страница группы</option><option>Ни к чему конкретному</option></select></div>
            </div>
            <div><label className="vt-label" htmlFor="ws-text">Подробности</label><textarea id="ws-text" className="vt-field" rows={6} placeholder="Что делали, что ожидали, что получилось" style={{width:'100%', boxSizing:'border-box', marginTop:6, padding:'10px 12px', fontFamily:'var(--f-body)', fontSize:'var(--fs-sm)', resize:'vertical'}}/></div>
            <div className="vt-card" style={{padding:'10px 12px', background:'var(--vt-bone)', display:'flex', gap:10, alignItems:'center'}}>
              <Icon name="star" size={15}/><span style={{flex:1, fontSize:'var(--fs-sm)'}}>Возможно, поможет: <b>Баланс событий: что списывается и когда</b></span>
              <button onClick={() => nav.toast('Открываем статью')} className="vt-btn vt-btn--ghost vt-btn--sm">Открыть</button>
            </div>
            <div style={{display:'flex', gap:10, alignItems:'center'}}>
              <button onClick={() => nav.toast('Выбор файла')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{gap:6}}><Icon name="plus" size={13}/> Скриншот или файл</button>
              <span style={{flex:1, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>Приложим организацию, ваш раздел и браузер. Ответ придёт сюда и в бот.</span>
              <button onClick={() => { setSel('S-1051'); nav.toast('Обращение S-1052 отправлено'); }} className="vt-btn vt-btn--primary">Отправить</button>
            </div>
          </div>
        ) : (
          <div className="vt-card" style={{padding:0, overflow:'hidden', display:'flex', flexDirection:'column', minHeight:560}}>
            <div style={{padding:'14px 18px', borderBottom:'1px solid var(--vt-bone-2)', display:'flex', gap:10, alignItems:'center'}}>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:'flex', gap:8, alignItems:'center'}}><span className="vt-mono" style={{color:'var(--vt-mute-2)', fontSize:'var(--fs-sm)'}}>{t.id}</span><SupStatus st={t.st}/></div>
                <div style={{fontSize:'var(--fs-md)', fontWeight:700, marginTop:4}}>{t.title}</div>
                <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{t.topic} · {t.who}</div>
              </div>
              {t.st !== 'solved' && <button onClick={() => nav.toast(`${t.id} закрыто · спасибо!`)} className="vt-btn vt-btn--ghost vt-btn--sm" style={{gap:6}}><Icon name="check" size={13}/> Вопрос решён</button>}
            </div>
            <div style={{flex:1, padding:18, display:'flex', flexDirection:'column', gap:12}}>
              {ORG_THREAD.map((m, i) => <SupBubble key={i} m={m}/>)}
            </div>
            <div style={{padding:'12px 18px', borderTop:'1px solid var(--vt-bone-2)', display:'flex', gap:8}}>
              <label htmlFor="ws-reply" style={{position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(0 0 0 0)'}}>Ответ</label>
              <input id="ws-reply" className="vt-field" placeholder="Ответить поддержке" style={{flex:1, padding:'10px 12px', fontSize:'var(--fs-sm)'}}/>
              <button aria-label="Приложить файл" onClick={() => nav.toast('Выбор файла')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="plus" size={14}/></button>
              <button onClick={() => nav.toast('Отправлено')} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6}}><Icon name="send" size={13}/> Отправить</button>
            </div>
          </div>
        )}
      </div>
    </WebShell>
  );
};

// ============================================================
// Root Admin · «Поддержка»
// ============================================================
const ROOT_TICKETS = [
  { id:'S-1053', who:'Маша Волкова', role:'игрок', org:'VolleyTime Минск', ch:'Mini App', topic:'Запись и оплата', title:'Оплатила, а запись «ждёт подтверждения» уже сутки', st:'new', age:'25 мин', sla:'ok' },
  { id:'S-1052', who:'Иван Петренко', role:'организатор', org:'VolleyTime Минск', ch:'Кабинет', topic:'Баланс событий и тариф', title:'Не вернулось событие на баланс', st:'new', age:'1 ч', sla:'ok' },
  { id:'S-1050', who:'Ольга Р.', role:'тренер', org:'VolleyTime Минск', ch:'Mini App', topic:'Группа и события', title:'Не вижу кнопку «Принять оплату»', st:'open', age:'3 ч', sla:'warn', agent:'Анна' },
  { id:'S-1049', who:'без входа · lena@…', role:'посетитель', org:'—', ch:'help.volleytime.by', topic:'Вход и аккаунт', title:'Не приходит код входа в кабинет', st:'open', age:'5 ч', sla:'late', agent:'Сергей' },
  { id:'S-1042', who:'Артём Кравцов', role:'игрок', org:'VolleyTime Минск', ch:'Бот', topic:'Абонементы', title:'Списали два занятия с абонемента', st:'waiting', age:'1 д', sla:'ok', agent:'Анна' },
  { id:'S-1038', who:'Антон К.', role:'организатор', org:'СпайкКлуб', ch:'Кабинет', topic:'Страница группы', title:'Как вернуть страницу в поиск', st:'solved', age:'2 д', sla:'ok', agent:'Анна' },
];
const SLA = { ok:['в срок','var(--vt-grass-ink)'], warn:['осталось 1 ч','var(--vt-amber-ink)'], late:['просрочено','var(--vt-rose-ink)'] };

const AdminSupport = () => {
  const nav = useNav();
  const [f, setF] = React.useState('active');
  const [role, setRole] = React.useState('all');
  const rows = ROOT_TICKETS.filter(t => (f === 'all' || (f === 'active' ? t.st !== 'solved' : f === 'new' ? t.st === 'new' : t.agent === 'Анна' && t.st !== 'solved')) && (role === 'all' || t.role === role));
  const cols = '76px minmax(0,2.2fr) minmax(0,1.3fr) 120px 110px 90px 100px';
  return (
    <AdminShell activeNav="support" title="Поддержка" sub="Обращения игроков, тренеров и организаторов · первый ответ в течение 4 рабочих часов">
      <div style={{display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:12, marginBottom:16}}>
        {[['Новые','2','без ответа'],['В работе','2','1 близко к сроку'],['Ждут пользователя','1','закроются через 3 дня'],['Первый ответ','1 ч 40 мин','медиана за 7 дней']].map(([l, v, d]) => (
          <div key={l} className="vt-card" style={{padding:'12px 16px'}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{l}</div>
            <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:6}}><span className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-xl)'}}>{v}</span><span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{d}</span></div>
          </div>
        ))}
      </div>
      <div style={{display:'flex', gap:8, marginBottom:14, alignItems:'center', flexWrap:'wrap'}}>
        {[['active','Активные'],['new','Новые'],['mine','Мои'],['all','Все']].map(([k, l]) => (
          <button key={k} aria-pressed={f === k} onClick={() => setF(k)} className="vt-btn vt-btn--sm" style={{background: f === k ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: f === k ? 'var(--vt-paper)' : 'var(--vt-ink)', fontWeight:600}}>{l}</button>
        ))}
        <span style={{width:1, height:22, background:'var(--vt-stroke)', margin:'0 4px'}}/>
        {[['all','Все роли'],['игрок','Игроки'],['тренер','Тренеры'],['организатор','Организаторы']].map(([k, l]) => (
          <button key={k} aria-pressed={role === k} onClick={() => setRole(k)} className="vt-btn vt-btn--sm" style={{background: role === k ? 'var(--vt-bone-2)' : 'transparent', fontWeight: role === k ? 700 : 500}}>{l}</button>
        ))}
      </div>
      <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
        <div style={{display:'grid', gridTemplateColumns:cols, gap:12, padding:'10px 18px', borderBottom:'1px solid var(--vt-bone-2)'}}>
          {['№','Обращение','Кто','Канал','Статус','Ждёт','Срок'].map(h => <div key={h} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>)}
        </div>
        {rows.map((t, i) => (
          <button key={t.id} onClick={() => nav.push('support-ticket', { id:t.id })} style={{display:'grid', gridTemplateColumns:cols, gap:12, padding:'12px 18px', alignItems:'center', width:'100%', textAlign:'left', cursor:'pointer', borderBottom: i < rows.length - 1 ? '1px solid var(--vt-bone-2)' : 'none', fontSize:'var(--fs-sm)'}}>
            <span className="vt-mono" style={{color:'var(--vt-mute-2)'}}>{t.id}</span>
            <div style={{minWidth:0}}><div style={{fontWeight:600}}>{t.title}</div><div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{t.topic}{t.agent ? ' · ' + t.agent : ''}</div></div>
            <div style={{minWidth:0}}><div>{t.who}</div><div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{t.role} · {t.org}</div></div>
            <span style={{fontSize:'var(--fs-xs)'}}>{t.ch}</span>
            <span><SupStatus st={t.st}/></span>
            <span className="vt-mono" style={{color:'var(--vt-mute-2)'}}>{t.age}</span>
            <span style={{fontSize:'var(--fs-xs)', fontWeight:600, color: t.st === 'solved' ? 'var(--vt-mute-2)' : SLA[t.sla][1]}}>{t.st === 'solved' ? '—' : SLA[t.sla][0]}</span>
          </button>
        ))}
      </div>
    </AdminShell>
  );
};

const AdminSupportTicket = () => {
  const nav = useNav();
  const [mode, setMode] = React.useState('reply');
  const [st, setSt] = React.useState('open');
  const tpl = [
    'Абонемент: как считаются места «+1»',
    'Возврат занятия на абонемент вручную',
    'Попросить скриншот и время',
  ];
  return (
    <AdminShell activeNav="support" title="S-1042 · Списали два занятия с абонемента" sub="Артём Кравцов · игрок · VolleyTime Минск · через бота"
      topRight={<button onClick={() => nav.canGoBack ? nav.back() : nav.reset('support')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="chevron-l" size={13}/> К очереди</button>}>
      <div style={{display:'grid', gridTemplateColumns:'minmax(0,1fr) 330px', gap:16, alignItems:'start'}}>
        <div className="vt-card" style={{padding:0, overflow:'hidden', display:'flex', flexDirection:'column'}}>
          <div style={{padding:18, display:'flex', flexDirection:'column', gap:12, minHeight:380}}>
            {SUP_THREAD.map((m, i) => <SupBubble key={i} m={m.from === 'me' ? { ...m, from:'agent', who:'Артём Кравцов' } : m.from === 'agent' ? { ...m, from:'me', who:null } : m}/>)}
            <SupBubble m={{ from:'note', who:'Внутренняя заметка · Анна', at:'сегодня, 12:38', text:'В записи 2 места (себя +1), списание корректное. Если попросит — вернуть вручную через «Абонементы» в организации.' }}/>
          </div>
          <div style={{borderTop:'1px solid var(--vt-bone-2)', padding:14, display:'flex', flexDirection:'column', gap:10}}>
            <div role="tablist" style={{display:'flex', gap:4}}>
              {[['reply','Ответ пользователю'],['note','Внутренняя заметка']].map(([k, l]) => (
                <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className="vt-btn vt-btn--sm" style={{background: mode === k ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: mode === k ? 'var(--vt-paper)' : 'var(--vt-ink)', fontWeight:600}}>{l}</button>
              ))}
              <span style={{flex:1}}/>
              <button onClick={() => nav.popover({ anchor: document.activeElement, items: tpl.map(x => ({ icon:'copy', label:x, onClick: () => nav.toast(`Шаблон «${x}» вставлен`) })) })} className="vt-btn vt-btn--ghost vt-btn--sm" style={{gap:6}}><Icon name="copy" size={13}/> Шаблоны</button>
              <button onClick={() => nav.toast('Ссылка на статью вставлена')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{gap:6}}><Icon name="link" size={13}/> Статья</button>
            </div>
            <label htmlFor="as-reply" style={{position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(0 0 0 0)'}}>{mode === 'reply' ? 'Ответ пользователю' : 'Внутренняя заметка'}</label>
            <textarea id="as-reply" className="vt-field" rows={3} placeholder={mode === 'reply' ? 'Ответ уйдёт в бот и в «Мои обращения»' : 'Видно только команде поддержки'}
              style={{width:'100%', boxSizing:'border-box', padding:'10px 12px', fontFamily:'var(--f-body)', fontSize:'var(--fs-sm)', resize:'vertical', background: mode === 'note' ? 'var(--vt-amber-soft)' : undefined}}/>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <span style={{flex:1, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{mode === 'reply' ? 'После ответа статус станет «ждём пользователя». Без ответа 3 дня — закроется сам.' : 'Заметка не уходит пользователю.'}</span>
              <button onClick={() => { setSt('waiting'); nav.toast(mode === 'reply' ? 'Ответ отправлен в бот' : 'Заметка сохранена'); }} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6}}><Icon name="send" size={13}/> {mode === 'reply' ? 'Отправить' : 'Сохранить'}</button>
            </div>
          </div>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          <div className="vt-card" style={{padding:14}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:8}}>Обращение</div>
            <div style={{display:'grid', gridTemplateColumns:'90px 1fr', gap:'8px 10px', fontSize:'var(--fs-sm)', alignItems:'center'}}>
              <span style={{color:'var(--vt-mute-2)'}}>Статус</span>
              <select aria-label="Статус" className="vt-field" value={st} onChange={(e) => setSt(e.target.value)} style={{padding:'6px 8px', fontSize:'var(--fs-sm)'}}>
                <option value="new">новое</option><option value="open">в работе</option><option value="waiting">ждём пользователя</option><option value="solved">решено</option>
              </select>
              <span style={{color:'var(--vt-mute-2)'}}>Исполнитель</span><span>Анна</span>
              <span style={{color:'var(--vt-mute-2)'}}>Тема</span><span>Абонементы</span>
              <span style={{color:'var(--vt-mute-2)'}}>Канал</span><span>Бот · ответ уходит в бот</span>
              <span style={{color:'var(--vt-mute-2)'}}>Срок</span><span style={{color:'var(--vt-grass-ink)', fontWeight:600}}>первый ответ дан</span>
            </div>
          </div>
          <div className="vt-card" style={{padding:14}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:8}}>Пользователь</div>
            <div style={{fontSize:'var(--fs-sm)', fontWeight:700}}>Артём Кравцов <span className="vt-code" style={{fontWeight:400, color:'var(--vt-mute-2)'}}>@artyomk</span></div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>игрок · VolleyTime Минск, МинскВолей · 24 тренировки</div>
            <div style={{display:'flex', gap:6, marginTop:10}}>
              <button onClick={() => nav.reset('users')} className="vt-btn vt-btn--ghost vt-btn--sm">Профиль</button>
              <button onClick={() => nav.reset('org-detail')} className="vt-btn vt-btn--ghost vt-btn--sm">Организация</button>
            </div>
          </div>
          <div className="vt-card" style={{padding:14}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:8}}>Контекст из приложения</div>
            <div style={{display:'grid', gridTemplateColumns:'90px 1fr', gap:'6px 10px', fontSize:'var(--fs-sm)'}}>
              <span style={{color:'var(--vt-mute-2)'}}>Событие</span><span>Основа · 28 мая</span>
              <span style={{color:'var(--vt-mute-2)'}}>Запись</span><span>2 места · абонемент</span>
              <span style={{color:'var(--vt-mute-2)'}}>Абонемент</span><span>«8 сессий» · осталось 5</span>
              <span style={{color:'var(--vt-mute-2)'}}>Версия</span><span className="vt-code">0.8.1 · iOS Telegram</span>
            </div>
          </div>
          <div className="vt-card" style={{padding:14}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:8}}>Прошлые обращения</div>
            <div style={{fontSize:'var(--fs-sm)'}}>S-0987 · Не пришло напоминание · <span style={{color:'var(--vt-mute-2)'}}>решено 14 мая</span></div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
};

// ============================================================
// Бот · ответ поддержки
// ============================================================
const BotSupport = () => (
  <TgShell>
    <SysLine>Вчера</SysLine>
    <BotMsg time="21:14">
      <Line bold>📨 Обращение S-1042 принято</Line>
      <Line>Тема: абонементы. Ответим в течение рабочего дня — сообщение придёт сюда.</Line>
    </BotMsg>
    <SysLine>Сегодня</SysLine>
    <BotMsg time="12:40" keyboard={[[{ label:'Ответить', app:true }, { label:'✅ Вопрос решён' }]]}>
      <Line bold>💬 Ответ поддержки · S-1042</Line>
      <Line>Вы заняли 2 места — за себя и «+1». Если второе не нужно, отмените его в карточке записи, занятие вернётся на абонемент.</Line>
      <Line dim>Анна · поддержка VolleyTime</Line>
    </BotMsg>
  </TgShell>
);

// ============================================================
// help.volleytime.by · база знаний
// ============================================================
const KB_CATS = {
  player: [
    ['ticket', 'Запись и отмена', 8, 'Записаться, отменить, лист ожидания, «+1»'],
    ['wallet', 'Оплата', 6, 'Способы оплаты, «Я оплатил», возвраты'],
    ['card', 'Абонементы', 5, 'Покупка, остаток, сгорание'],
    ['bell', 'Бот и уведомления', 4, 'Напоминания, команды, отписка'],
    ['lock', 'Вход и аккаунт', 4, 'Telegram, email, удаление данных'],
    ['star', 'Новые функции', 6, 'Календарь, разминка, самооценка'],
  ],
  coach: [
    ['users', 'Состав и отметки', 5, 'Отметить пришедших, QR на входе'],
    ['wallet', 'Приём оплаты', 3, 'Когда тренер принимает оплату'],
    ['calendar', 'Мои тренировки', 3, 'Расписание, замены'],
    ['settings', 'Режимы «Веду» и «Играю»', 2, 'Переключение ролей'],
  ],
  organizer: [
    ['building', 'Начало работы', 7, 'Группа, бот, приглашения, первый запуск'],
    ['calendar', 'События и серии', 9, 'Создание, повтор, режим записи'],
    ['wallet', 'Оплаты и касса', 8, 'Подтверждение, расходы, отчёты'],
    ['card', 'Баланс событий и тариф', 5, 'Списания, пополнение, возвраты'],
    ['users', 'Игроки и команда', 6, 'Роли, тренеры, долги и ограничения'],
    ['globe', 'Страница группы', 5, 'Конструктор, индексация, модерация'],
  ],
};
const KB_ROLE_L = { player:'Игрокам', coach:'Тренерам', organizer:'Организаторам' };

const KbHeader = ({ go, q }) => (
  <div style={{display:'flex', alignItems:'center', gap:16, padding:'14px 32px', borderBottom:'1px solid var(--vt-bone-2)', background:'var(--vt-paper)', position:'sticky', top:0, zIndex:5}}>
    <button onClick={() => go('home')} style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
      <span style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:'var(--fs-md)'}}>Volley<span style={{color:'var(--vt-flame-ink)'}}>Time</span></span>
      <span style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', fontWeight:600}}>Помощь</span>
    </button>
    {q !== undefined && <div className="vt-field" style={{flex:1, maxWidth:420, display:'flex', alignItems:'center', gap:8, padding:'8px 12px', fontSize:'var(--fs-sm)', color:'var(--vt-mute)'}}><Icon name="search" size={14}/>{q || 'Поиск по базе знаний'}</div>}
    <span style={{flex:1}}/>
    <a style={{fontSize:'var(--fs-sm)', color:'var(--vt-ink-3)'}}>volleytime.by</a>
    <button onClick={() => go('contact')} className="vt-btn vt-btn--ink vt-btn--sm" style={{gap:6}}><Icon name="chat" size={14}/> Написать в поддержку</button>
  </div>
);

const KbFooterCta = ({ go }) => (
  <div style={{marginTop:28, padding:'22px 26px', borderRadius:'var(--r-card)', background:'var(--vt-blue-ink)', color:'var(--vt-on-hero)', display:'flex', alignItems:'center', gap:18}}>
    <div style={{flex:1}}>
      <div style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:'var(--fs-2xl)'}}>Не нашли ответ?</div>
      <div style={{fontSize:'var(--fs-sm)', opacity:.8, marginTop:4}}>Напишите в поддержку — ответим в течение рабочего дня в Telegram.</div>
    </div>
    <button onClick={() => go('contact')} className="vt-btn vt-btn--lg" style={{background:'var(--vt-orange)', color:'var(--vt-on-hero)', gap:8}}><Icon name="chat" size={16}/> Написать в поддержку</button>
  </div>
);

const KbHome = ({ go }) => {
  const [role, setRole] = React.useState('organizer');
  return (
    <>
      <div style={{padding:'44px 32px 30px', background:'var(--vt-bone)'}}>
        <div style={{maxWidth:1080, margin:'0 auto'}}>
          <div style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:52, lineHeight:1}}>Чем помочь?</div>
          <div className="vt-field" style={{marginTop:18, display:'flex', alignItems:'center', gap:10, padding:'14px 16px', background:'var(--vt-paper)', fontSize:'var(--fs-md)', color:'var(--vt-mute)', maxWidth:680}}>
            <Icon name="search" size={18}/> Например: как отменить запись
          </div>
          <div style={{display:'flex', gap:8, marginTop:12, flexWrap:'wrap', fontSize:'var(--fs-sm)', color:'var(--vt-ink-3)'}}>
            Часто ищут: {['отмена записи', 'абонемент', 'баланс событий', 'не приходит код'].map(x => <button key={x} onClick={() => go('search')} style={{color:'var(--vt-flame-ink)', fontWeight:600, cursor:'pointer'}}>{x}</button>)}
          </div>
        </div>
      </div>
      <div style={{maxWidth:1080, margin:'0 auto', padding:'26px 32px 40px'}}>
        <div role="tablist" aria-label="Для кого" style={{display:'flex', gap:4, padding:3, background:'var(--vt-bone-2)', borderRadius:'var(--r-chip)', width:'fit-content'}}>
          {Object.entries(KB_ROLE_L).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={role === k} onClick={() => setRole(k)} className="vt-btn vt-btn--sm" style={{background: role === k ? 'var(--vt-paper)' : 'transparent', boxShadow: role === k ? 'var(--vt-seg-shadow)' : 'none', fontWeight: role === k ? 700 : 500, padding:'8px 16px'}}>{l}</button>
          ))}
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:12, marginTop:16}}>
          {KB_CATS[role].map(([ic, t, n, d]) => (
            <button key={t} onClick={() => go('section')} className="vt-card" style={{padding:18, textAlign:'left', cursor:'pointer', display:'flex', flexDirection:'column', gap:8}}>
              <span style={{width:36, height:36, borderRadius:10, background:'var(--vt-bone)', display:'flex', alignItems:'center', justifyContent:'center'}}><Icon name={ic} size={18}/></span>
              <span style={{fontSize:'var(--fs-md)', fontWeight:700}}>{t}</span>
              <span style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>{d}</span>
              <span className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{n} статей</span>
            </button>
          ))}
        </div>
        <div style={{display:'grid', gridTemplateColumns:'minmax(0,2fr) minmax(0,1fr)', gap:16, marginTop:24}}>
          <div className="vt-card" style={{padding:18}}>
            <div style={{fontSize:'var(--fs-md)', fontWeight:700}}>Популярное</div>
            {[...SUP_ARTICLES[role], ...SUP_ARTICLES.player.slice(0, 2)].slice(0, 5).map(([a, c]) => (
              <button key={a} onClick={() => go('article')} style={{display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left', padding:'10px 0', borderTop:'1px solid var(--vt-bone-2)', marginTop:6, cursor:'pointer'}}>
                <span style={{flex:1, fontSize:'var(--fs-sm)', fontWeight:600}}>{a}</span><span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{c}</span><Icon name="chevron-r" size={13}/>
              </button>
            ))}
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:12}}>
            <div className="vt-card" style={{padding:18}}>
              <div style={{fontSize:'var(--fs-md)', fontWeight:700}}>Статус сервисов</div>
              {[['Mini App', true], ['Бот', true], ['Кабинет', true]].map(([s, ok]) => (
                <div key={s} style={{display:'flex', alignItems:'center', gap:8, marginTop:10, fontSize:'var(--fs-sm)'}}><span aria-hidden="true" style={{width:8, height:8, borderRadius:99, background:'var(--vt-grass)'}}/><span style={{flex:1}}>{s}</span><span style={{color:'var(--vt-grass-ink)', fontWeight:600}}>работает</span></div>
              ))}
            </div>
            <div className="vt-card" style={{padding:18}}>
              <div style={{fontSize:'var(--fs-md)', fontWeight:700}}>Мои обращения</div>
              <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:6}}>Войдите через Telegram, чтобы видеть переписку.</div>
              <button onClick={() => go('contact')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{marginTop:10, gap:6}}><Icon name="tg" size={13}/> Войти через Telegram</button>
            </div>
          </div>
        </div>
        <KbFooterCta go={go}/>
      </div>
    </>
  );
};

const KbSection = ({ go }) => (
  <div style={{maxWidth:1080, margin:'0 auto', padding:'24px 32px 40px'}}>
    <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}><button onClick={() => go('home')} style={{color:'var(--vt-flame-ink)', cursor:'pointer'}}>Помощь</button> › Организаторам</div>
    <div style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:40, marginTop:10}}>Баланс событий и тариф</div>
    <div style={{fontSize:'var(--fs-base)', color:'var(--vt-ink-3)', marginTop:6, maxWidth:'60ch'}}>Как платформа считает события, когда списывает и как пополнить.</div>
    <div className="vt-card" style={{padding:0, marginTop:20, overflow:'hidden'}}>
      {[['Баланс событий: что списывается и когда', 'Списание при первой записи, возврат при отмене за 24 ч', '4 мин'],
        ['Как пополнить баланс', 'Пакеты, оплата картой и по счёту', '2 мин'],
        ['Отменили событие — вернётся ли оно на баланс', 'Правила возврата и исключения', '2 мин'],
        ['Тарифы для клубов и школ', 'Когда выгоднее подписка', '3 мин'],
        ['Закрывающие документы', 'Акт и счёт для юрлиц', '2 мин']].map(([t, d, m], i) => (
        <button key={t} onClick={() => go('article')} style={{display:'flex', alignItems:'center', gap:14, width:'100%', textAlign:'left', padding:'16px 20px', borderTop: i ? '1px solid var(--vt-bone-2)' : 'none', cursor:'pointer'}}>
          <div style={{flex:1}}><div style={{fontSize:'var(--fs-md)', fontWeight:600}}>{t}</div><div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:2}}>{d}</div></div>
          <span className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{m}</span><Icon name="chevron-r" size={14}/>
        </button>
      ))}
    </div>
    <KbFooterCta go={go}/>
  </div>
);

const KbArticle = ({ go }) => {
  const [vote, setVote] = React.useState(null);
  return (
    <div style={{maxWidth:1080, margin:'0 auto', padding:'24px 32px 40px', display:'grid', gridTemplateColumns:'240px minmax(0,1fr)', gap:32}}>
      <nav aria-label="Раздел" style={{fontSize:'var(--fs-sm)'}}>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:8}}>Баланс событий и тариф</div>
        {['Баланс событий: что списывается и когда', 'Как пополнить баланс', 'Отменили событие — вернётся ли оно на баланс', 'Тарифы для клубов и школ', 'Закрывающие документы'].map((t, i) => (
          <button key={t} onClick={() => go('article')} aria-current={i === 0 ? 'page' : undefined} style={{display:'block', width:'100%', textAlign:'left', padding:'8px 10px', borderRadius:'var(--r-sm)', background: i === 0 ? 'var(--vt-bone-2)' : 'transparent', fontWeight: i === 0 ? 600 : 400, cursor:'pointer'}}>{t}</button>
        ))}
      </nav>
      <article>
        <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}><button onClick={() => go('home')} style={{color:'var(--vt-flame-ink)', cursor:'pointer'}}>Помощь</button> › <button onClick={() => go('section')} style={{color:'var(--vt-flame-ink)', cursor:'pointer'}}>Организаторам · Баланс событий</button></div>
        <h1 style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:36, lineHeight:1.05, margin:'10px 0 0'}}>Баланс событий: что списывается и когда</h1>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:8}}>Обновлено 18 ноября · 4 минуты</div>
        <div style={{fontSize:'var(--fs-base)', lineHeight:1.65, marginTop:18, maxWidth:'68ch'}}>
          <p style={{margin:'0 0 12px'}}>Баланс — это количество событий, которые группа может провести на платформе. Одно событие — одна тренировка или игра, независимо от числа игроков.</p>
          <h2 style={{fontSize:'var(--fs-lg)', margin:'20px 0 8px'}}>Когда событие списывается</h2>
          <ol style={{paddingLeft:20, margin:0}}>
            <li>Событие создано — баланс не меняется.</li>
            <li>Появилась первая запись — событие списывается.</li>
            <li>Событие отменено больше чем за 24 часа — событие возвращается.</li>
          </ol>
          <div style={{margin:'16px 0', padding:'12px 14px', borderRadius:'var(--r-sm)', background:'var(--vt-amber-soft)', fontSize:'var(--fs-sm)'}}><b>Важно.</b> При отмене меньше чем за 24 часа событие не возвращается: игроки уже получили напоминания.</div>
          <div style={{height:180, borderRadius:'var(--r-card)', background:'var(--vt-bone)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--vt-mute-2)', fontSize:'var(--fs-sm)'}}>Скриншот: Кабинет → Баланс и оплата</div>
        </div>
        <div className="vt-card" style={{padding:16, marginTop:22, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
          <span style={{fontSize:'var(--fs-sm)', fontWeight:600, flex:1}}>{vote === null ? 'Статья помогла?' : vote ? 'Спасибо, что отметили!' : 'Жаль. Напишите нам — разберёмся с вашим случаем.'}</span>
          {vote === null && <>
            <button onClick={() => setVote(true)} className="vt-btn vt-btn--ghost vt-btn--sm">Да</button>
            <button onClick={() => setVote(false)} className="vt-btn vt-btn--ghost vt-btn--sm">Нет</button>
          </>}
          {vote === false && <button onClick={() => go('contact')} className="vt-btn vt-btn--ink vt-btn--sm" style={{gap:6}}><Icon name="chat" size={13}/> Написать в поддержку</button>}
        </div>
      </article>
    </div>
  );
};

const KbSearch = ({ go }) => (
  <div style={{maxWidth:1080, margin:'0 auto', padding:'24px 32px 40px'}}>
    <div style={{fontSize:'var(--fs-lg)', fontWeight:700}}>Найдено 4 статьи по запросу «отмена записи»</div>
    <div style={{display:'flex', gap:6, marginTop:12}}>
      {['Все', 'Игрокам', 'Тренерам', 'Организаторам'].map((x, i) => <span key={x} className="vt-chip" style={{background: i === 0 ? 'var(--vt-ink)' : undefined, color: i === 0 ? 'var(--vt-paper)' : undefined}}>{x}</span>)}
    </div>
    <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:16}}>
      {[['Как отменить запись и вернуть деньги', 'Игрокам · Запись и отмена', 'Отменить запись можно до закрытия записи в карточке события…'],
        ['Отменили событие — вернётся ли оно на баланс', 'Организаторам · Баланс событий', 'При отмене больше чем за 24 часа событие возвращается…'],
        ['Как работает лист ожидания', 'Игрокам · Запись и отмена', 'Когда кто-то отменяет запись, место предлагается первому в очереди…'],
        ['Правила отмены в настройках группы', 'Организаторам · События и серии', 'Срок, до которого игрок может отменить запись без штрафа…']].map(([t, c, s]) => (
        <button key={t} onClick={() => go('article')} className="vt-card" style={{padding:16, textAlign:'left', cursor:'pointer'}}>
          <div style={{fontSize:'var(--fs-md)', fontWeight:700}}>{t}</div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{c}</div>
          <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-ink-3)', marginTop:6}}>{s}</div>
        </button>
      ))}
    </div>
    <KbFooterCta go={go}/>
  </div>
);

const KbContact = ({ go }) => {
  const [auth, setAuth] = React.useState('tg');
  const [sent, setSent] = React.useState(false);
  if (sent) return (
    <div style={{maxWidth:560, margin:'60px auto', padding:'0 32px', textAlign:'center'}}>
      <span style={{width:56, height:56, borderRadius:'50%', background:'var(--vt-grass-soft)', display:'inline-flex', alignItems:'center', justifyContent:'center'}}><Icon name="check" size={26} stroke="var(--vt-grass-ink)" sw={2.4}/></span>
      <div style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:32, marginTop:14}}>Обращение S-1054 принято</div>
      <div style={{fontSize:'var(--fs-base)', color:'var(--vt-ink-3)', marginTop:8, lineHeight:1.5}}>{auth === 'tg' ? 'Ответ придёт в бот @volleytime_bot и появится в «Моих обращениях» в приложении.' : 'Ответ придёт на lena@example.com. Ссылка на переписку — в письме.'}</div>
      <button onClick={() => go('home')} className="vt-btn vt-btn--ghost" style={{marginTop:18}}>Вернуться в базу знаний</button>
    </div>
  );
  return (
    <div style={{maxWidth:1080, margin:'0 auto', padding:'24px 32px 40px', display:'grid', gridTemplateColumns:'minmax(0,1fr) 320px', gap:24}}>
      <div className="vt-card" style={{padding:22, display:'flex', flexDirection:'column', gap:14}}>
        <div style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:32}}>Написать в поддержку</div>
        <fieldset style={{border:0, padding:0, margin:0}}>
          <legend className="vt-label" style={{marginBottom:8}}>Куда ответить</legend>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            {[['tg', 'Telegram', 'Войдём через Telegram, ответ придёт в бот'], ['email', 'Email', 'Если нет доступа к Telegram или кабинету']].map(([k, t, d]) => (
              <label key={k} style={{display:'flex', gap:10, alignItems:'flex-start', padding:'12px 14px', borderRadius:'var(--r-chip)', cursor:'pointer', background: auth === k ? 'var(--vt-bone-2)' : 'var(--vt-bone)'}}>
                <input type="radio" name="kb-auth" checked={auth === k} onChange={() => setAuth(k)} style={{marginTop:3, accentColor:'var(--vt-flame)'}}/>
                <span><span style={{display:'block', fontWeight:600}}>{t}</span><span style={{display:'block', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{d}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        {auth === 'tg'
          ? <div className="vt-card" style={{padding:'10px 12px', background:'var(--vt-bone)', display:'flex', alignItems:'center', gap:10}}><Icon name="tg" size={16}/><span style={{flex:1, fontSize:'var(--fs-sm)'}}>Вы вошли как <b>Иван Петренко</b> · организатор VolleyTime Минск</span><button className="vt-btn vt-btn--ghost vt-btn--sm">Сменить</button></div>
          : <div><label className="vt-label" htmlFor="kb-email">Email для ответа</label><input id="kb-email" className="vt-field" type="email" defaultValue="lena@example.com" style={{width:'100%', boxSizing:'border-box', marginTop:6, padding:'10px 12px', fontSize:'var(--fs-sm)'}}/></div>}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <div><label className="vt-label" htmlFor="kb-who">Я</label><select id="kb-who" className="vt-field" style={{width:'100%', marginTop:6, padding:'10px 12px', fontSize:'var(--fs-sm)'}}><option>Организатор</option><option>Тренер</option><option>Игрок</option></select></div>
          <div><label className="vt-label" htmlFor="kb-topic">Тема</label><select id="kb-topic" className="vt-field" style={{width:'100%', marginTop:6, padding:'10px 12px', fontSize:'var(--fs-sm)'}}>{SUP_TOPICS.map(t => <option key={t.k}>{t.t}</option>)}</select></div>
        </div>
        <div><label className="vt-label" htmlFor="kb-text">Что случилось</label><textarea id="kb-text" className="vt-field" rows={6} placeholder="Что делали, что ожидали, что получилось. Если есть — название группы и дата события." style={{width:'100%', boxSizing:'border-box', marginTop:6, padding:'10px 12px', fontFamily:'var(--f-body)', fontSize:'var(--fs-sm)', resize:'vertical'}}/></div>
        <div style={{display:'flex', gap:10, alignItems:'center'}}>
          <button className="vt-btn vt-btn--ghost vt-btn--sm" style={{gap:6}}><Icon name="plus" size={13}/> Скриншот</button>
          <span style={{flex:1}}/>
          <button onClick={() => setSent(true)} className="vt-btn vt-btn--primary">Отправить</button>
        </div>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        <div className="vt-card" style={{padding:16}}>
          <div style={{fontSize:'var(--fs-sm)', fontWeight:700}}>Перед отправкой</div>
          {SUP_ARTICLES.organizer.slice(0, 3).map(([a]) => <button key={a} onClick={() => go('article')} style={{display:'block', width:'100%', textAlign:'left', padding:'8px 0', borderTop:'1px solid var(--vt-bone-2)', marginTop:6, fontSize:'var(--fs-sm)', color:'var(--vt-flame-ink)', cursor:'pointer'}}>{a}</button>)}
        </div>
        <div className="vt-card" style={{padding:16, fontSize:'var(--fs-sm)', lineHeight:1.5}}>
          <div style={{fontWeight:700}}>Когда ответим</div>
          <div style={{color:'var(--vt-ink-3)', marginTop:4}}>Пн–пт 9:00–20:00, сб–вс 10:00–18:00. Первый ответ — в течение 4 рабочих часов.</div>
          <div style={{color:'var(--vt-ink-3)', marginTop:8}}>Жалоба на организатора или игрока — через кнопку «Пожаловаться» в приложении.</div>
        </div>
      </div>
    </div>
  );
};

const KbApp = ({ initial = 'home' }) => {
  const [v, setV] = React.useState(initial);
  const ref = React.useRef(null);
  const go = (x) => { setV(x); if (ref.current) ref.current.scrollTop = 0; };
  React.useEffect(() => { setV(initial); }, [initial]);
  const V = { home:KbHome, section:KbSection, article:KbArticle, search:KbSearch, contact:KbContact }[v] || KbHome;
  return (
    <div ref={ref} style={{height:'100%', overflow:'auto', background:'var(--vt-paper)'}}>
      <KbHeader go={go} q={v === 'home' ? undefined : v === 'search' ? 'отмена записи' : ''}/>
      <V go={go}/>
    </div>
  );
};

Object.assign(window, { SupportHub, SupportNew, SupportTicket, WebSupport, AdminSupport, AdminSupportTicket, BotSupport, KbApp, SUP_TOPICS });
