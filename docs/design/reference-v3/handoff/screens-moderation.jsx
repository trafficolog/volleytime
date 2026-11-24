// screens-moderation.jsx — Задача 24.1.3 / R-06 · Модерация страниц групп
// 4b Root Admin → Страницы групп: каталог городов (≈120 районных центров) → страницы групп (скрыть / noindex / вернуть), жалобы.
// 5 Public Pages → Страница группы: кнопка «Пожаловаться».
// 4 Кабинет → Страница группы: баннер с причиной вместо статуса индексации + то же сообщение в боте.
// «Скрыть» = 404, как у неопубликованной. «Noindex» = открыта по ссылке, закрыта от поиска поверх настройки владельца.

// ---------- Справочник городов: все районные центры + Минск ----------
const MOD_REGIONS = [
  ['Минск', ['Минск']],
  ['Брестская', ['Брест','Барановичи','Пинск','Кобрин','Берёза','Ганцевичи','Дрогичин','Жабинка','Иваново','Ивацевичи','Каменец','Лунинец','Ляховичи','Малорита','Пружаны','Столин']],
  ['Витебская', ['Витебск','Орша','Новополоцк','Полоцк','Бешенковичи','Браслав','Верхнедвинск','Глубокое','Городок','Докшицы','Дубровно','Лепель','Лиозно','Миоры','Поставы','Россоны','Сенно','Толочин','Ушачи','Чашники','Шарковщина','Шумилино']],
  ['Гомельская', ['Гомель','Мозырь','Жлобин','Светлогорск','Речица','Брагин','Буда-Кошелёво','Ветка','Добруш','Ельск','Житковичи','Калинковичи','Корма','Лельчицы','Лоев','Наровля','Октябрьский','Петриков','Рогачёв','Хойники','Чечерск']],
  ['Гродненская', ['Гродно','Лида','Слоним','Волковыск','Берестовица','Вороново','Дятлово','Зельва','Ивье','Кореличи','Мосты','Новогрудок','Островец','Ошмяны','Свислочь','Сморгонь','Щучин']],
  ['Минская', ['Борисов','Солигорск','Молодечно','Жодино','Слуцк','Березино','Вилейка','Воложин','Дзержинск','Клецк','Копыль','Крупки','Логойск','Любань','Марьина Горка','Мядель','Несвиж','Смолевичи','Старые Дороги','Столбцы','Узда','Червень']],
  ['Могилёвская', ['Могилёв','Бобруйск','Горки','Кричев','Осиповичи','Белыничи','Быхов','Глуск','Дрибин','Кировск','Климовичи','Кличев','Костюковичи','Краснополье','Круглое','Мстиславль','Славгород','Хотимск','Чаусы','Чериков','Шклов']],
];
const MOD_TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',' ':'-','-':'-' };
const modSlug = (s) => s.toLowerCase().split('').map(ch => MOD_TR[ch] ?? ch).join('');
const modNorm = (s) => s.toLowerCase().replace(/ё/g, 'е');

// Страницы групп: st — index (в поиске) · own (noindex владельца) · noindex (root) · hidden (root, 404)
const MOD_PAGES = {
  'Минск': [
    { g:'VolleyTime Минск', slug:'vt-minsk', st:'index', comp:0, upd:'2 июня' },
    { g:'Волей на Немиге', slug:'nemiga', st:'noindex', comp:4, upd:'20 мая', reason:'Цены не совпадают с записью', who:'anna@volleytime', at:'20 мая, 18:40', note:'Цена на странице 10 BYN, в записи 15 BYN. Исправьте блок «Цены» или настройки группы.' },
    { g:'Пляж Минск', slug:'plyazh', st:'index', comp:1, upd:'14 мая' },
    { g:'Ночная лига', slug:'night', st:'hidden', comp:2, upd:'30 апр', reason:'Группа не проводит игры', who:'root@volleytime', at:'30 апр, 11:15', note:'Нет событий больше 60 дней. Создайте событие и запросите проверку.' },
    { g:'СпайкКлуб', slug:'spikeclub', st:'own', comp:0, upd:'12 апр' },
    { g:'Волей Сухарево', slug:'suharevo', st:'index', comp:0, upd:'10 апр' },
    { g:'Микст по средам', slug:'mixt-sreda', st:'index', comp:0, upd:'2 апр' },
  ],
  'Брест': [{ g:'Брест Волей', slug:'brest-volley', st:'index', comp:0, upd:'3 июня' }, { g:'Пляж Брест', slug:'plyazh-brest', st:'index', comp:0, upd:'21 мая' }],
  'Пинск': [{ g:'Пинск Волей', slug:'pinsk', st:'index', comp:0, upd:'11 мая' }],
  'Барановичи': [{ g:'Волей Барановичи', slug:'baranovichi', st:'own', comp:0, upd:'6 мая' }],
  'Витебск': [{ g:'Витебск Микст', slug:'vitebsk-mixt', st:'index', comp:0, upd:'30 мая' }],
  'Новополоцк': [{ g:'Нафтан Волей', slug:'naftan', st:'index', comp:0, upd:'19 мая' }],
  'Гомель': [{ g:'Волейбол 24/7', slug:'v247', st:'index', comp:0, upd:'1 июня' }, { g:'Гомель Микст', slug:'mixt', st:'own', comp:0, upd:'9 мая' }],
  'Мозырь': [{ g:'Мозырь Волей', slug:'mozyr', st:'index', comp:0, upd:'15 мая' }],
  'Гродно': [{ g:'СпайкКлуб Гродно', slug:'spike-grodno', st:'index', comp:0, upd:'28 мая' }],
  'Лида': [{ g:'Лида Волей', slug:'lida', st:'index', comp:1, upd:'4 мая' }],
  'Борисов': [{ g:'Борисов Волей', slug:'borisov', st:'index', comp:0, upd:'27 мая' }],
  'Солигорск': [{ g:'Шахтёр Волей', slug:'shahter', st:'index', comp:0, upd:'22 мая' }],
  'Могилёв': [{ g:'Могилёв Волей', slug:'volley', st:'index', comp:1, upd:'2 мая' }],
  'Бобруйск': [{ g:'Бобруйск Микст', slug:'bobruysk', st:'index', comp:0, upd:'18 мая' }],
};
const modBuildCities = () => MOD_REGIONS.map(([r, list]) => ({ r, cities: list.map(c => ({ c, slug: modSlug(c), pages: (MOD_PAGES[c] || []).map(p => ({ ...p })) })) }));

const MOD_ST = {
  index:  ['в поиске', 'vt-chip--grass'],
  own:    ['noindex · владелец', 'vt-chip--state'],
  noindex:['noindex · root', 'vt-chip--amber'],
  hidden: ['скрыта · 404', 'vt-chip--rose'],
};
const modIssue = (p) => p.st === 'hidden' || p.st === 'noindex' || p.comp > 0;

const MOD_REASONS = [
  { k:'price', t:'Цены не совпадают с записью', d:'Цена на странице отличается от цены при записи' },
  { k:'pay', t:'Оплата в обход записи', d:'Ссылки на сторонние сайты оплаты, реквизиты' },
  { k:'promise', t:'Вводящие в заблуждение обещания', d:'«Гарантированное место», «бесплатно» при платной записи' },
  { k:'media', t:'Чужие или неподходящие фото', d:'Фото без прав или не про волейбол' },
  { k:'inactive', t:'Группа не проводит игры', d:'Нет событий больше 60 дней' },
  { k:'spam', t:'Спам или контакты в заголовках', d:'Телефоны, @ники, ключевые слова в H1 и Title' },
];
const MOD_PUBLIC_REASONS = ['Цены не совпадают с записью', 'Группа не существует или не играет', 'Чужие фото или текст', 'Обман или мошенничество', 'Другое'];

const MOD_COMPLAINTS = [
  { id:'PC-31', g:'Волей на Немиге', city:'Минск', slug:'nemiga', reason:'Цены не совпадают с записью', text:'На странице 10 BYN, а при записи списали 15', from:'@lera_s', age:'6 ч', st:'new', same:4 },
  { id:'PC-30', g:'Могилёв Волей', city:'Могилёв', slug:'volley', reason:'Чужие фото или текст', text:'Фото зала взяты с сайта нашего клуба', from:'без входа', age:'1 д', st:'new', same:1 },
  { id:'PC-29', g:'Лида Волей', city:'Лида', slug:'lida', reason:'Другое', text:'', from:'@m_volk', age:'2 д', st:'new', same:1 },
  { id:'PC-28', g:'Пляж Минск', city:'Минск', slug:'plyazh', reason:'Группа не существует или не играет', text:'Игр не было три недели', from:'без входа', age:'3 д', st:'new', same:1 },
  { id:'PC-27', g:'Ночная лига', city:'Минск', slug:'night', reason:'Группа не существует или не играет', text:'Пришли по адресу — игр нет с весны', from:'без входа', age:'4 д', st:'done', result:'Страница скрыта · 30 апр' },
];

// ---------- Общие куски ----------
const ModTabs = ({ active }) => {
  const nav = useNav();
  const tabs = [['pages','Каталог городов', null],['page-complaints','Жалобы', MOD_COMPLAINTS.filter(x => x.st === 'new').length]];
  return (
    <div role="tablist" aria-label="Разделы модерации" style={{display:'flex', gap:4, padding:3, background:'var(--vt-bone-2)', borderRadius:'var(--r-chip)', width:'fit-content', marginBottom:16}}>
      {tabs.map(([k, l, n]) => (
        <button key={k} role="tab" aria-selected={active === k} onClick={() => nav.reset(k)} className="vt-btn vt-btn--sm"
          style={{background: active === k ? 'var(--vt-paper)' : 'transparent', boxShadow: active === k ? 'var(--vt-seg-shadow)' : 'none', color:'var(--vt-ink)', fontWeight: active === k ? 700 : 500, padding:'7px 14px', gap:8}}>
          {l}{n ? <span className="vt-chip vt-chip--rose" style={{fontSize:'var(--fs-2xs)', padding:'1px 7px'}}>{n}</span> : null}
        </button>
      ))}
    </div>
  );
};

const ModKpis = ({ items }) => (
  <div style={{display:'grid', gridTemplateColumns:`repeat(${items.length}, minmax(0,1fr))`, gap:12, marginBottom:16}}>
    {items.map(([l, v, d]) => (
      <div key={l} className="vt-card" style={{padding:'12px 16px'}}>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{l}</div>
        <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:6}}>
          <span className="vt-mono" style={{fontWeight:700, fontSize:'var(--fs-xl)'}}>{v}</span>
          <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{d}</span>
        </div>
      </div>
    ))}
  </div>
);

const ModHead = ({ cols, heads }) => (
  <div style={{display:'grid', gridTemplateColumns:cols, gap:12, padding:'10px 18px', borderBottom:'1px solid var(--vt-bone-2)'}}>
    {heads.map((h, i) => <div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>)}
  </div>
);

const ModModal = ({ title, sub, onClose, children, width = 540 }) => (
  <>
    <div onClick={onClose} style={{position:'absolute', inset:0, background:'var(--vt-scrim)', zIndex:90}}/>
    <div role="dialog" aria-modal="true" aria-label={title} style={{position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width, maxHeight:'90%', overflow:'auto',
      background:'var(--vt-paper)', borderRadius:'var(--r-card)', padding:22, zIndex:91, boxShadow:'var(--vt-modal-shadow)'}}>
      <div style={{display:'flex', alignItems:'flex-start', gap:12}}>
        <div style={{flex:1}}>
          <div style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize:'var(--fs-xl)'}}>{title}</div>
          {sub && <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4, lineHeight:1.45}}>{sub}</div>}
        </div>
        <button onClick={onClose} aria-label="Закрыть" className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'6px 8px'}}><Icon name="close" size={14}/></button>
      </div>
      <div style={{marginTop:16}}>{children}</div>
    </div>
  </>
);

const ModFact = ({ ok, l, bg = 'var(--vt-paper)' }) => (
  <div style={{display:'flex', gap:8, alignItems:'center', padding:'8px 10px', borderRadius:'var(--r-sm)', background:bg, fontSize:'var(--fs-xs)'}}>
    <span aria-hidden="true" style={{width:18, height:18, borderRadius:'var(--r-pill)', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      background: ok ? 'var(--vt-grass-soft)' : 'var(--vt-rose-soft)', color: ok ? 'var(--vt-grass-ink)' : 'var(--vt-rose-ink)'}}>{ok ? <Icon name="check" size={11} sw={2.6}/> : <Icon name="close" size={10} sw={2.6}/>}</span>
    <span>{l}<span style={{position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(0 0 0 0)'}}>{ok ? ' — да' : ' — нет'}</span></span>
  </div>
);
const modFacts = (kind, loc) => kind === 'hidden'
  ? [[false,'Открывается по ссылке · 404'],[false,'В поиске и sitemap'],[false,`В каталоге «${loc}»`],[true,'Запись в Telegram']]
  : [[true,'Открывается по ссылке'],[false,'В поиске и sitemap'],[false,`В каталоге «${loc}»`],[true,'Запись в Telegram']];

// Сообщение бота организатору
const ModBotMsg = ({ kind, g, reason, note }) => (
  <div style={{borderRadius:16, padding:10, background:'#DCE6F2'}}>
    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
      <span style={{width:22, height:22, borderRadius:'var(--r-pill)', background:'#2437C9', color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center'}}><Icon name="tg" size={12}/></span>
      <span style={{fontSize:'var(--fs-xs)', fontWeight:700, color:'#15161A'}}>VolleyTime Bot</span>
    </div>
    <div style={{background:'#fff', borderRadius:'4px 14px 14px 14px', padding:'10px 12px', fontSize:'var(--fs-xs)', lineHeight:1.5, color:'#15161A'}}>
      <b>{kind === 'hidden' ? '⛔ Страница группы скрыта' : '🔍 Страница закрыта от поиска'}</b><br/>
      «{g}» · {kind === 'hidden' ? 'по ссылке теперь не открывается' : 'по ссылке открывается, в поиске её нет'}<br/>
      Причина: {reason || '—'}{note ? <><br/><span style={{color:'#4A4B52'}}>{note}</span></> : null}
      <div style={{display:'flex', gap:6, marginTop:8}}>
        <span style={{flex:1, textAlign:'center', padding:'6px 0', borderRadius:8, background:'#EEF1F6', fontWeight:600, color:'#1F2E96'}}>Открыть кабинет</span>
        <span style={{flex:1, textAlign:'center', padding:'6px 0', borderRadius:8, background:'#EEF1F6', fontWeight:600, color:'#1F2E96'}}>Ответить</span>
      </div>
    </div>
  </div>
);

// ---------- Форма «Скрыть» / «Принудительный noindex» ----------
const ModActionDialog = ({ kind, row, preset, onClose, onDone }) => {
  const [r, setR] = React.useState(preset || 'price');
  const [note, setNote] = React.useState(row.note || '');
  const reason = MOD_REASONS.find(x => x.k === r);
  const hide = kind === 'hidden';
  return (
    <ModModal width={760} onClose={onClose}
      title={hide ? `Скрыть страницу · ${row.g}` : `Принудительный noindex · ${row.g}`}
      sub={hide
        ? 'Страница перестанет открываться: по ссылке будет тот же 404, что у неопубликованной. Пропадёт из поиска, sitemap и каталога города.'
        : 'Страница откроется по ссылке, но получит noindex и пропадёт из sitemap и каталога города — даже если владелец включил индексацию.'}>
      <div style={{display:'grid', gridTemplateColumns:'minmax(0,1fr) 280px', gap:18}}>
        <div>
          <fieldset style={{border:0, padding:0, margin:0}}>
            <legend className="vt-label" style={{marginBottom:8}}>Причина · её увидит организатор</legend>
            <div style={{display:'grid', gap:4}}>
              {MOD_REASONS.map(x => (
                <label key={x.k} style={{display:'flex', gap:10, alignItems:'flex-start', padding:'8px 10px', borderRadius:'var(--r-sm)', cursor:'pointer', background: r === x.k ? 'var(--vt-bone-2)' : 'transparent'}}>
                  <input type="radio" name="mod-reason" checked={r === x.k} onChange={() => setR(x.k)} style={{marginTop:3, accentColor:'var(--vt-flame)'}}/>
                  <span><span style={{display:'block', fontSize:'var(--fs-sm)', fontWeight:600}}>{x.t}</span><span style={{display:'block', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{x.d}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="vt-label" htmlFor="mod-note" style={{display:'block', marginTop:12}}>Что исправить · необязательно</label>
          <textarea id="mod-note" className="vt-field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Конкретно: какой блок и что поменять" style={{width:'100%', boxSizing:'border-box', resize:'vertical', fontFamily:'var(--f-body)', fontSize:'var(--fs-sm)', padding:'10px 12px', marginTop:6}}/>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:10}}>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Что произойдёт</div>
          <div style={{display:'grid', gap:6}}>{modFacts(kind, row.city || 'город').map(([ok, l]) => <ModFact key={l} ok={ok} l={l} bg="var(--vt-bone)"/>)}</div>
          <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginTop:4}}>Уведомление в бот</div>
          <ModBotMsg kind={kind} g={row.g} reason={reason.t} note={note}/>
        </div>
      </div>
      <div style={{display:'flex', gap:10, alignItems:'center', marginTop:18, paddingTop:14, borderTop:'1px solid var(--vt-bone-2)'}}>
        <span style={{flex:1, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>Сохраним, кто и когда, и запишем в журнал аудита. Вернуть можно в любой момент.</span>
        <button type="button" onClick={onClose} className="vt-btn vt-btn--ghost vt-btn--sm">Отмена</button>
        <button type="button" onClick={() => onDone(reason.t, note)} className="vt-btn vt-btn--sm" style={hide ? {background:'var(--vt-rose)', color:'var(--vt-on-hero)'} : {background:'var(--vt-ink)', color:'var(--vt-paper)'}}>{hide ? 'Скрыть страницу' : 'Закрыть от поиска'}</button>
      </div>
    </ModModal>
  );
};

const ModHistoryDialog = ({ row, onClose }) => (
  <ModModal title={`История · ${row.g}`} sub={`volleytime.by/${modSlug(row.city || 'Минск')}/${row.slug}`} onClose={onClose} width={520}>
    <div className="vt-card" style={{padding:14, background:'var(--vt-bone)'}}>
      <div className="vt-cap" style={{color:'var(--vt-mute-2)', marginBottom:8}}>Состояние модерации</div>
      <div style={{display:'grid', gridTemplateColumns:'110px 1fr', gap:'6px 12px', fontSize:'var(--fs-sm)'}}>
        <span style={{color:'var(--vt-mute-2)'}}>Состояние</span><span><span className={'vt-chip ' + MOD_ST[row.st][1]} style={{fontSize:'var(--fs-2xs)'}}>{MOD_ST[row.st][0]}</span></span>
        <span style={{color:'var(--vt-mute-2)'}}>Причина</span><span>{row.reason || '—'}</span>
        <span style={{color:'var(--vt-mute-2)'}}>Кто</span><span className="vt-code">{row.who || '—'}</span>
        <span style={{color:'var(--vt-mute-2)'}}>Когда</span><span>{row.at || '—'}</span>
      </div>
    </div>
    <div className="vt-cap" style={{color:'var(--vt-mute-2)', margin:'16px 0 6px'}}>Журнал аудита</div>
    {(row.st === 'index' || row.st === 'own'
      ? [[row.upd, 'Владелец опубликовал страницу', 'владелец']]
      : [[row.at, (row.st === 'hidden' ? 'Скрыта · ' : 'Принудительный noindex · ') + row.reason, row.who], ['18 мая', 'Жалоба с публичной страницы', 'посетитель'], ['2 апр', 'Владелец опубликовал страницу', 'владелец']]
    ).map(([d, t, w], i) => (
      <div key={i} style={{display:'grid', gridTemplateColumns:'100px 1fr', gap:12, padding:'8px 0', borderTop: i ? '1px solid var(--vt-bone-2)' : 'none', fontSize:'var(--fs-sm)'}}>
        <span className="vt-mono" style={{color:'var(--vt-mute-2)'}}>{d}</span>
        <span>{t} <span className="vt-code" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>· {w}</span></span>
      </div>
    ))}
  </ModModal>
);

const ModRowActions = ({ p, onAct }) => (
  <div style={{display:'flex', gap:6, justifyContent:'flex-end'}}>
    <button onClick={() => onAct('history', p)} aria-label={`История · ${p.g}`} className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'6px 8px'}}><Icon name="clock" size={14}/></button>
    {p.st === 'hidden' && <button onClick={() => onAct('restore', p)} className="vt-btn vt-btn--ink vt-btn--sm">Вернуть</button>}
    {p.st === 'noindex' && <button onClick={() => onAct('restore', p)} className="vt-btn vt-btn--ink vt-btn--sm">Вернуть индексацию</button>}
    {(p.st === 'index' || p.st === 'own') && <button onClick={() => onAct('noindex', p)} className="vt-btn vt-btn--ghost vt-btn--sm" disabled={p.st === 'own'} title={p.st === 'own' ? 'Владелец уже закрыл страницу от поиска' : undefined} style={{opacity: p.st === 'own' ? .45 : 1}}>Noindex</button>}
    {p.st !== 'hidden' && <button onClick={() => onAct('hidden', p)} className="vt-btn vt-btn--ghost vt-btn--sm" style={{color:'var(--vt-rose-ink)'}}>Скрыть</button>}
  </div>
);

const useModActions = (patch) => {
  const nav = useNav();
  const [dlg, setDlg] = React.useState(null);
  const onAct = (kind, p, extra = {}) => {
    if (kind === 'restore') {
      nav.alert({
        title: p.st === 'hidden' ? `Вернуть «${p.g}»?` : `Вернуть индексацию «${p.g}»?`,
        body: p.st === 'hidden'
          ? 'Страница снова откроется по ссылке. В поиск она попадёт, если индексацию включил владелец. Организатор получит уведомление в бот.'
          : 'Индексация снова зависит от настройки владельца. Организатор получит уведомление в бот.',
        confirm:'Вернуть',
        onConfirm: () => { patch(p.slug, { st:'index', reason:null, who:null, at:null, note:null }); nav.toast(`«${p.g}» возвращена · записано в журнал`); },
      });
      return;
    }
    setDlg({ kind, p, ...extra });
  };
  const dialog = dlg && (dlg.kind === 'history'
    ? <ModHistoryDialog row={dlg.p} onClose={() => setDlg(null)}/>
    : <ModActionDialog kind={dlg.kind} row={dlg.p} preset={dlg.preset} onClose={() => setDlg(null)} onDone={(reason, note) => {
        patch(dlg.p.slug, { st:dlg.kind, reason, note, who:'root@volleytime', at:'сегодня, 13:20' });
        nav.toast(dlg.kind === 'hidden' ? `«${dlg.p.g}» скрыта · причина ушла в кабинет и бот` : `«${dlg.p.g}» · noindex · причина ушла в кабинет и бот`);
        dlg.after && dlg.after(); setDlg(null);
      }}/>);
  return { onAct, dialog, nav };
};

// ============================================================
// 4b · Каталог городов → страницы групп
// ============================================================
const ModCities = () => {
  const [regions, setRegions] = React.useState(modBuildCities);
  const [sel, setSel] = React.useState('Минск');           // город или '*' — вся страна
  const [scope, setScope] = React.useState('pages');         // pages · issues · all — какие города показывать слева
  const [pf, setPf] = React.useState('all');                 // фильтр страниц справа
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState({ 'Минск':true, 'Минская':true });
  const patch = (slug, d) => setRegions(rs => rs.map(r => ({ ...r, cities: r.cities.map(c => ({ ...c, pages: c.pages.map(p => p.slug === slug ? { ...p, ...d } : p) })) })));
  const { onAct, dialog } = useModActions(patch);

  const allCities = regions.flatMap(r => r.cities.map(c => ({ ...c, r:r.r })));
  const allPages = allCities.flatMap(c => c.pages.map(p => ({ ...p, city:c.c })));
  const nq = modNorm(q.trim());
  const cityHit = (c) => !nq || modNorm(c.c).includes(nq) || c.slug.includes(nq);
  const cityIn = (c) => scope === 'all' || (scope === 'pages' ? c.pages.length > 0 : c.pages.some(modIssue));
  const groupHits = nq.length >= 2 ? allPages.filter(p => modNorm(p.g).includes(nq) || p.slug.includes(nq)).slice(0, 6) : [];
  const issuesCount = allCities.filter(c => c.pages.some(modIssue)).length;

  const cur = sel === '*' ? null : allCities.find(c => c.c === sel);
  const scopePages = (cur ? cur.pages.map(p => ({ ...p, city:cur.c })) : allPages)
    .filter(p => pf === 'all' || (pf === 'mod' ? (p.st === 'hidden' || p.st === 'noindex') : p.comp > 0));
  const cols = sel === '*' ? 'minmax(0,1.4fr) 110px minmax(0,1.6fr) 64px 76px auto' : 'minmax(0,1.5fr) minmax(0,1.7fr) 64px 76px auto';
  const pick = (c) => { setSel(c); setPf('all'); };

  return (
    <>
      <AdminShell activeNav="pages" title="Страницы групп" sub="Каталог городов · районные центры и страницы групп в них">
        <ModTabs active="pages"/>
        <ModKpis items={[
          ['Городов в каталоге', String(allCities.length), `${allCities.filter(c => c.pages.length).length} со страницами`],
          ['Страниц групп', String(allPages.length), `${allPages.filter(p => p.st === 'index').length} в поиске`],
          ['Noindex · root', String(allPages.filter(p => p.st === 'noindex').length), 'открыты по ссылке'],
          ['Скрыто · root', String(allPages.filter(p => p.st === 'hidden').length), 'отдают 404'],
        ]}/>
        <div style={{display:'grid', gridTemplateColumns:'300px minmax(0,1fr)', gap:16, alignItems:'start'}}>
          {/* Навигатор городов */}
          <div className="vt-card" style={{padding:10, display:'flex', flexDirection:'column', gap:8, height:560}}>
            <label htmlFor="mod-city-q" style={{position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(0 0 0 0)'}}>Город или группа</label>
            <div className="vt-field" style={{display:'flex', alignItems:'center', gap:8, padding:'0 10px'}}>
              <Icon name="search" size={14} stroke="var(--vt-mute)"/>
              <input id="mod-city-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Город или группа" autoComplete="off"
                style={{flex:1, minWidth:0, border:0, outline:'none', background:'transparent', padding:'9px 0', fontSize:'var(--fs-sm)', fontFamily:'var(--f-body)', color:'var(--vt-ink)'}}/>
              {q && <button onClick={() => setQ('')} aria-label="Очистить поиск" style={{display:'flex', padding:2}}><Icon name="close" size={12}/></button>}
            </div>
            <div role="group" aria-label="Какие города показывать" style={{display:'flex', gap:2, padding:3, background:'var(--vt-bone-2)', borderRadius:'var(--r-chip)'}}>
              {[['pages','Со страницами'],['issues',`Внимание · ${issuesCount}`],['all',`Все · ${allCities.length}`]].map(([k, l]) => (
                <button key={k} aria-pressed={scope === k} onClick={() => setScope(k)} className="vt-btn vt-btn--sm" style={{flex:1, padding:'5px 4px', fontSize:'var(--fs-2xs)', background: scope === k ? 'var(--vt-paper)' : 'transparent', boxShadow: scope === k ? 'var(--vt-seg-shadow)' : 'none', color:'var(--vt-ink)', fontWeight: scope === k ? 700 : 500}}>{l}</button>
              ))}
            </div>
            <div style={{flex:1, overflow:'auto', margin:'0 -4px', padding:'0 4px'}}>
              <button aria-pressed={sel === '*'} onClick={() => pick('*')} style={{display:'flex', alignItems:'center', gap:10, width:'100%', padding:'9px 10px', borderRadius:'var(--r-sm)', textAlign:'left',
                background: sel === '*' ? 'var(--vt-paper)' : 'transparent', boxShadow: sel === '*' ? 'var(--vt-shadow-card)' : 'none'}}>
                <Icon name="globe" size={14}/><span style={{flex:1, fontSize:'var(--fs-sm)', fontWeight:600}}>Вся страна</span>
                <span className="vt-mono" style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>{allPages.length}</span>
              </button>

              {groupHits.length > 0 && (
                <div style={{margin:'6px 0 4px'}}>
                  <div className="vt-cap" style={{color:'var(--vt-mute-2)', padding:'6px 10px 2px', fontSize:'var(--fs-2xs)'}}>Группы</div>
                  {groupHits.map(p => (
                    <button key={p.slug} onClick={() => { pick(p.city); setOpen(o => ({ ...o, [allCities.find(c => c.c === p.city).r]:true })); }} style={{display:'flex', alignItems:'center', gap:8, width:'100%', padding:'7px 10px', borderRadius:'var(--r-sm)', textAlign:'left'}}>
                      <span style={{flex:1, minWidth:0}}>
                        <span style={{display:'block', fontSize:'var(--fs-sm)', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{p.g}</span>
                        <span style={{display:'block', fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{p.city}</span>
                      </span>
                      <span className={'vt-chip ' + MOD_ST[p.st][1]} style={{fontSize:'var(--fs-2xs)'}}>{MOD_ST[p.st][0]}</span>
                    </button>
                  ))}
                </div>
              )}

              {regions.map(r => {
                const list = r.cities.filter(c => cityHit(c) && (nq ? true : cityIn(c)));
                if (!list.length) return null;
                const isOpen = !!nq || open[r.r] || r.r === 'Минск';
                const withPages = r.cities.filter(c => c.pages.length).length;
                const issues = r.cities.filter(c => c.pages.some(modIssue)).length;
                return (
                  <div key={r.r} style={{marginTop:4}}>
                    {r.r !== 'Минск' && (
                      <button aria-expanded={isOpen} onClick={() => setOpen(o => ({ ...o, [r.r]: !isOpen }))} style={{display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 10px', textAlign:'left'}}>
                        <span style={{display:'flex', transform: isOpen ? 'none' : 'rotate(-90deg)', transition:'transform .15s'}}><Icon name="chevron-d" size={12}/></span>
                        <span className="vt-cap" style={{flex:1, color:'var(--vt-ink-3)'}}>{r.r} обл.</span>
                        {issues > 0 && <span className="vt-chip vt-chip--amber" style={{fontSize:'var(--fs-2xs)', padding:'1px 6px'}}>{issues}</span>}
                        <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{withPages}/{r.cities.length}</span>
                      </button>
                    )}
                    {isOpen && list.map(c => {
                      const on = sel === c.c;
                      const iss = c.pages.filter(modIssue).length;
                      return (
                        <button key={c.c} aria-pressed={on} onClick={() => pick(c.c)} style={{display:'flex', alignItems:'center', gap:8, width:'100%', padding:'7px 10px 7px 30px', borderRadius:'var(--r-sm)', textAlign:'left',
                          background: on ? 'var(--vt-paper)' : 'transparent', boxShadow: on ? 'var(--vt-shadow-card)' : 'none', color: c.pages.length ? 'var(--vt-ink)' : 'var(--vt-mute-2)'}}>
                          <span style={{flex:1, minWidth:0, fontSize:'var(--fs-sm)', fontWeight: c.pages.length ? 600 : 400}}>{c.c}</span>
                          {iss > 0 && <span className="vt-chip vt-chip--amber" style={{fontSize:'var(--fs-2xs)', padding:'1px 6px'}}>{iss}</span>}
                          <span className="vt-mono" style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', minWidth:14, textAlign:'right'}}>{c.pages.length || '—'}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {nq && !groupHits.length && !allCities.some(cityHit) && <div style={{padding:'16px 10px', fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>Ничего не нашли. Город добавляется в каталог в задаче 24.1.2.</div>}
            </div>
            <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', padding:'2px 6px'}}>Города из каталога 24.1.2 · «—» — страниц пока нет</div>
          </div>

          {/* Страницы выбранного города */}
          <div style={{minWidth:0}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap'}}>
              <h3 style={{fontSize:'var(--fs-lg)'}}>{cur ? cur.c : 'Вся страна'}</h3>
              {cur && <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{cur.r === 'Минск' ? 'столица' : cur.r + ' обл.'}</span>}
              {cur && <span className="vt-code" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>volleytime.by/{cur.slug}</span>}
              <span style={{flex:1}}/>
              {[['all','Все'],['mod','Скрытые и noindex'],['comp','С жалобами']].map(([k, l]) => (
                <button key={k} aria-pressed={pf === k} onClick={() => setPf(k)} className="vt-btn vt-btn--sm" style={{background: pf === k ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: pf === k ? 'var(--vt-paper)' : 'var(--vt-ink)', fontWeight:600}}>{l}</button>
              ))}
            </div>
            <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
              <ModHead cols={cols} heads={sel === '*' ? ['Группа','Город','Состояние','Жалобы','Обновлена',''] : ['Группа','Состояние','Жалобы','Обновлена','']}/>
              {cur && cur.pages.length === 0 && <div style={{padding:'28px 18px', fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', maxWidth:'60ch'}}>В городе {cur.c} пока нет страниц групп. Город есть в каталоге, его страница закрыта от индексации, пока в ней нет групп.</div>}
              {(!cur || cur.pages.length > 0) && scopePages.length === 0 && <div style={{padding:'28px 18px', fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>Под фильтр ничего не подошло.</div>}
              <div style={{maxHeight:452, overflow:'auto'}}>
                {scopePages.map((p, i) => (
                  <div key={p.slug} style={{display:'grid', gridTemplateColumns:cols, gap:12, padding:'11px 18px', alignItems:'center', borderBottom: i < scopePages.length - 1 ? '1px solid var(--vt-bone-2)' : 'none', fontSize:'var(--fs-sm)',
                    background: p.st === 'hidden' ? 'color-mix(in oklab, var(--vt-rose) 4%, transparent)' : p.st === 'noindex' ? 'color-mix(in oklab, var(--vt-amber) 5%, transparent)' : 'transparent'}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontWeight:600}}>{p.g}</div>
                      <div className="vt-code" style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>/{modSlug(p.city)}/{p.slug}</div>
                    </div>
                    {sel === '*' && <button onClick={() => pick(p.city)} style={{textAlign:'left', fontSize:'var(--fs-sm)', color:'var(--vt-flame-ink)', fontWeight:600}}>{p.city}</button>}
                    <div style={{minWidth:0}}>
                      <span className={'vt-chip ' + MOD_ST[p.st][1]} style={{fontSize:'var(--fs-2xs)'}}>{MOD_ST[p.st][0]}</span>
                      {p.reason && <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-ink-3)', marginTop:4}}>{p.reason} · <span className="vt-code">{p.who}</span> · {p.at}</div>}
                    </div>
                    <span className="vt-mono" style={{color: p.comp ? 'var(--vt-rose-ink)' : 'var(--vt-mute-2)', fontWeight: p.comp ? 700 : 400}}>{p.comp || '—'}</span>
                    <span className="vt-mono" style={{color:'var(--vt-mute-2)'}}>{p.upd}</span>
                    <ModRowActions p={p} onAct={onAct}/>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', lineHeight:1.5}}><b>Noindex</b> — открыта по ссылке, но закрыта от поиска, sitemap и каталога города, даже если владелец включил индексацию.</div>
              <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', lineHeight:1.5}}><b>Скрыть</b> — страница отдаёт 404, как неопубликованная. Запись в Telegram работает в обоих случаях.</div>
            </div>
          </div>
        </div>
      </AdminShell>
      {dialog}
    </>
  );
};

// ============================================================
// 4b · Жалобы
// ============================================================
const ModComplaints = () => {
  const [items, setItems] = React.useState(MOD_COMPLAINTS);
  const [f, setF] = React.useState('new');
  const base = React.useMemo(() => Object.fromEntries(Object.entries(MOD_PAGES).flatMap(([city, ps]) => ps.map(p => [p.slug, { ...p, city }]))), []);
  const [over, setOver] = React.useState({});
  const { onAct, dialog, nav } = useModActions((slug, d) => setOver(o => ({ ...o, [slug]: { ...(o[slug] || {}), ...d } })));
  const close = (id, result) => setItems(x => x.map(y => y.id === id ? { ...y, st:'done', result } : y));
  const rows = items.filter(c => f === 'all' || c.st === f);
  const cols = '64px minmax(0,1.3fr) minmax(0,2.1fr) 90px 54px auto';
  return (
    <>
      <AdminShell activeNav="pages" title="Страницы групп" sub="Жалобы с публичных страниц групп · кнопка «Пожаловаться»">
        <ModTabs active="page-complaints"/>
        <ModKpis items={[['Новые', String(items.filter(x => x.st === 'new').length), 'старшей 3 дня'], ['Решено за 30 дней', '6', 'среднее время 11 ч'], ['Отсечено лимитом', '14', 'больше 3 в сутки с устройства']]}/>
        <div style={{display:'flex', gap:8, marginBottom:14}}>
          {[['new','Новые'],['done','Решённые'],['all','Все']].map(([k, l]) => (
            <button key={k} aria-pressed={f === k} onClick={() => setF(k)} className="vt-btn vt-btn--sm" style={{background: f === k ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: f === k ? 'var(--vt-paper)' : 'var(--vt-ink)', fontWeight:600}}>{l}</button>
          ))}
        </div>
        <div className="vt-card" style={{padding:0, overflow:'hidden'}}>
          <ModHead cols={cols} heads={['№','Страница','Причина и текст','От кого','Когда','']}/>
          {rows.length === 0 && <div style={{padding:'28px 18px', fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)'}}>Новых жалоб нет.</div>}
          {rows.map((c, i) => {
            const p = { ...base[c.slug], ...(over[c.slug] || {}) };
            const preset = c.reason.startsWith('Цены') ? 'price' : c.reason.startsWith('Чужие') ? 'media' : 'inactive';
            return (
              <div key={c.id} style={{display:'grid', gridTemplateColumns:cols, gap:12, padding:'12px 18px', alignItems:'center', borderBottom: i < rows.length - 1 ? '1px solid var(--vt-bone-2)' : 'none', fontSize:'var(--fs-sm)'}}>
                <span className="vt-code" style={{color:'var(--vt-mute-2)', fontSize:'var(--fs-xs)'}}>{c.id}</span>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:600}}>{c.g} <span style={{fontWeight:400, color:'var(--vt-mute-2)'}}>· {c.city}</span></div>
                  <div style={{display:'flex', gap:6, alignItems:'center', marginTop:3, flexWrap:'wrap'}}>
                    <span className={'vt-chip ' + MOD_ST[p.st][1]} style={{fontSize:'var(--fs-2xs)'}}>{MOD_ST[p.st][0]}</span>
                    {c.same > 1 && <span style={{fontSize:'var(--fs-2xs)', color:'var(--vt-rose-ink)', fontWeight:600}}>ещё {c.same - 1} с той же причиной</span>}
                  </div>
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:600}}>{c.reason}</div>
                  <div style={{fontSize:'var(--fs-xs)', color: c.text ? 'var(--vt-ink-3)' : 'var(--vt-mute-2)', marginTop:2}}>{c.text ? `«${c.text}»` : 'без текста'}</div>
                  {c.result && <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-grass-ink)', marginTop:4, fontWeight:600}}>{c.result}</div>}
                </div>
                <span className="vt-code" style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)'}}>{c.from}</span>
                <span className="vt-mono" style={{color:'var(--vt-mute-2)'}}>{c.age}</span>
                {c.st === 'new' ? (
                  <div style={{display:'flex', gap:6, justifyContent:'flex-end'}}>
                    <button onClick={() => { close(c.id, 'Отклонена · нарушений нет'); nav.toast(`${c.id} отклонена`); }} className="vt-btn vt-btn--ghost vt-btn--sm">Отклонить</button>
                    {p.st !== 'noindex' && p.st !== 'hidden' && <button onClick={() => onAct('noindex', p, { preset, after: () => close(c.id, 'Принудительный noindex') })} className="vt-btn vt-btn--ghost vt-btn--sm">Noindex</button>}
                    {p.st !== 'hidden' && <button onClick={() => onAct('hidden', p, { preset, after: () => close(c.id, 'Страница скрыта') })} className="vt-btn vt-btn--sm" style={{background:'var(--vt-rose)', color:'var(--vt-on-hero)'}}>Скрыть</button>}
                  </div>
                ) : <span/>}
              </div>
            );
          })}
        </div>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:12, maxWidth:'72ch'}}>Жалобы на организатора и оплату — в разделе <a onClick={() => nav.reset('complaints')} style={{color:'var(--vt-flame-ink)', fontWeight:600, cursor:'pointer'}}>Жалобы</a>. Здесь только содержание публичной страницы.</div>
      </AdminShell>
      {dialog}
    </>
  );
};

// ============================================================
// 5 Public Pages · страница группы + «Пожаловаться»
// ============================================================
const ModGroupPublic = () => {
  const [open, setOpen] = React.useState(true);
  const [r, setR] = React.useState(MOD_PUBLIC_REASONS[0]);
  const [text, setText] = React.useState('');
  const [sent, setSent] = React.useState(false);
  return (
    <div style={{height:'100%', overflow:'auto', background:'var(--vt-bone)'}}>
      <div style={{maxWidth:1200, margin:'0 auto', padding:'24px 24px 32px'}}>
        <div style={{borderRadius:20, overflow:'hidden', boxShadow:'var(--vt-shadow-card)'}}>
          {window.SeoPublicPage ? <SeoPublicPage mode="desktop" interactive/> : null}
        </div>
        <div style={{display:'flex', alignItems:'center', gap:12, marginTop:14, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>
          <span>Страница не похожа на правду?</span>
          <button onClick={() => { setOpen(true); setSent(false); }} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="chat" size={13}/> Пожаловаться</button>
        </div>
      </div>
      {open && (
        <ModModal title={sent ? 'Спасибо' : 'Пожаловаться на страницу'} sub={sent ? 'Модератор посмотрит в течение суток. Если нарушение подтвердится, страница изменится или исчезнет.' : 'Модератор VolleyTime проверит страницу. Организатор не узнает, кто отправил жалобу.'} onClose={() => setOpen(false)} width={460}>
          {sent ? (
            <button onClick={() => setOpen(false)} className="vt-btn vt-btn--ink vt-btn--full">Закрыть</button>
          ) : (
            <>
              <fieldset style={{border:0, padding:0, margin:0}}>
                <legend className="vt-label" style={{marginBottom:8}}>Что не так</legend>
                <div style={{display:'grid', gap:4}}>
                  {MOD_PUBLIC_REASONS.map(x => (
                    <label key={x} style={{display:'flex', gap:10, alignItems:'center', padding:'9px 10px', borderRadius:'var(--r-sm)', cursor:'pointer', fontSize:'var(--fs-sm)', background: r === x ? 'var(--vt-bone-2)' : 'transparent'}}>
                      <input type="radio" name="pub-reason" checked={r === x} onChange={() => setR(x)} style={{accentColor:'var(--vt-flame)'}}/>{x}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="vt-label" htmlFor="pub-text" style={{display:'block', marginTop:12}}>Подробности · необязательно</label>
              <textarea id="pub-text" className="vt-field" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Например: на странице 15 BYN, при записи списали 20" style={{width:'100%', boxSizing:'border-box', resize:'vertical', fontFamily:'var(--f-body)', fontSize:'var(--fs-sm)', padding:'10px 12px', marginTop:6}}/>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:4}}>
                <span>Не больше 3 жалоб в сутки</span><span className="vt-mono">{text.length} / 500</span>
              </div>
              <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:16}}>
                <button onClick={() => setOpen(false)} className="vt-btn vt-btn--ghost vt-btn--sm">Отмена</button>
                <button onClick={() => setSent(true)} className="vt-btn vt-btn--primary vt-btn--sm">Отправить жалобу</button>
              </div>
            </>
          )}
        </ModModal>
      )}
    </div>
  );
};

// ============================================================
// 4 Кабинет · баннер модерации в «Странице группы» (вместо статуса индексации)
// ============================================================
const ModSeoBanner = ({ kind, d }) => {
  const nav = useNav();
  const [sent, setSent] = React.useState(false);
  const [bot, setBot] = React.useState(false);
  const hide = kind === 'hidden';
  const loc = (d && d.city) || 'Минск';
  const reason = hide ? 'Группа не проводит игры' : 'Цены не совпадают с записью';
  const note = hide ? 'Нет событий больше 60 дней. Создайте событие и запросите проверку.' : 'Цена на странице 10 BYN, в записи 15 BYN. Исправьте блок «Цены» или настройки группы.';
  return (
    <div className="vt-card" style={{padding:'16px 18px', marginBottom:16, background: hide ? 'var(--vt-rose-soft)' : 'var(--vt-amber-soft)'}}>
      <div style={{display:'flex', gap:14, alignItems:'flex-start'}}>
        <span style={{width:40, height:40, borderRadius:12, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background: hide ? 'var(--vt-rose)' : 'var(--vt-ink)', color:'var(--vt-on-hero)'}}><Icon name={hide ? 'lock' : 'eye'} size={18}/></span>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
            <span style={{fontSize:'var(--fs-base)', fontWeight:700}}>{hide ? 'Администрация VolleyTime скрыла страницу' : 'Администрация VolleyTime закрыла страницу от поиска'}</span>
            <span className="vt-code" style={{fontSize:'var(--fs-2xs)', padding:'2px 8px', borderRadius:'var(--r-pill)', background:'var(--vt-paper)'}}>{hide ? '404 по ссылке' : 'noindex'}</span>
          </div>
          <div style={{fontSize:'var(--fs-sm)', marginTop:4}}>Причина: <b>{reason}</b> · <span style={{color:'var(--vt-ink-3)'}}>{note}</span></div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:4}}>{hide ? '30 апр, 11:15' : '20 мая, 18:40'} · копия пришла в бот · <a onClick={() => setBot(b => !b)} role="button" tabIndex={0} aria-expanded={bot} style={{color:'var(--vt-flame-ink)', fontWeight:600, cursor:'pointer'}}>{bot ? 'скрыть сообщение' : 'показать сообщение'}</a></div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:10, flexShrink:0}}>
          <span style={{fontSize:'var(--fs-sm)', fontWeight:600, color:'var(--vt-ink-3)'}}>Индексировать</span>
          <button role="switch" aria-checked={!hide} aria-disabled="true" aria-label="Индексировать — сейчас решает администрация" onClick={() => nav.toast('Пока действует решение администрации, переключатель не работает')}
            style={{width:36, height:20, borderRadius:'var(--r-pill)', background: hide ? 'var(--vt-stroke-2)' : 'color-mix(in oklab, var(--vt-ink) 45%, transparent)', position:'relative', border:0, cursor:'not-allowed'}}>
            <span style={{position:'absolute', top:2, left: hide ? 2 : 18, width:16, height:16, borderRadius:'var(--r-pill)', background:'var(--vt-paper)', display:'flex', alignItems:'center', justifyContent:'center'}}><Icon name="lock" size={9} stroke="var(--vt-mute)"/></span>
          </button>
        </div>
      </div>
      <div style={{display:'grid', gridTemplateColumns: bot ? 'minmax(0,1fr) 300px' : '1fr', gap:14, marginTop:12, marginLeft:54}}>
        <div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:8}}>{modFacts(kind, loc).map(([ok, l]) => <ModFact key={l} ok={ok} l={l}/>)}</div>
          {!hide && <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:8}}>Индексация у вас включена, но сейчас её перекрывает решение администрации.</div>}
          <div style={{display:'flex', gap:8, alignItems:'center', marginTop:10}}>
            <button onClick={() => { setSent(true); nav.toast('Запрос отправлен модератору · ответ придёт в бот'); }} disabled={sent} className="vt-btn vt-btn--ink vt-btn--sm" style={{opacity: sent ? .5 : 1}}>{sent ? 'Ждёт проверки' : 'Исправил — запросить проверку'}</button>
            <button onClick={() => nav.toast('Ответ модератору отправлен')} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="chat" size={13}/> Ответить модератору</button>
            <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)'}}>Правки можно публиковать — они сохранятся, но в поиск попадут после проверки.</span>
          </div>
        </div>
        {bot && <ModBotMsg kind={kind} g="VolleyTime Минск" reason={reason} note={note}/>}
      </div>
    </div>
  );
};

Object.assign(window, { ModCities, ModComplaints, ModGroupPublic, ModSeoBanner, MOD_REGIONS });
