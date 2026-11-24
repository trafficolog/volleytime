// screens-seo-page.jsx — SEO-страница группы: хранилище, производные SEO-поля, рендер публичной страницы

const SEO_CITIES = [
  ['Минск','minsk','Минске','Центральный район'],
  ['Гомель','gomel','Гомеле','Советский район'],
  ['Брест','brest','Бресте','Ленинский район'],
  ['Гродно','grodno','Гродно','Октябрьский район'],
  ['Витебск','vitebsk','Витебске','Первомайский район'],
  ['Могилёв','mogilev','Могилёве','Ленинский район'],
];

const SEO_SECTION_TYPES = {
  hero:     { t:'Обложка',             d:'H1, подзаголовок, кнопка записи', src:'текст', req:true, icon:'star' },
  facts:    { t:'Коротко о группе',    d:'Факты для поиска и ИИ-ответов',   src:'авто',  req:true, icon:'search' },
  schedule: { t:'Расписание',          d:'Ближайшие события из кабинета',   src:'авто',  icon:'calendar' },
  formats:  { t:'Форматы и уровни',    d:'Тренировки, игры, микст',         src:'текст', icon:'ball' },
  prices:   { t:'Цены',                d:'Разовое, абонементы, делёж суммы', src:'авто', icon:'wallet' },
  venues:   { t:'Залы и адреса',       d:'Из «Залы и площадки»',            src:'авто',  icon:'pin' },
  howto:    { t:'Как записаться',      d:'Три шага через Telegram',         src:'авто',  icon:'tg' },
  faq:      { t:'Вопросы и ответы',    d:'Разметка FAQPage',                src:'текст', icon:'chat' },
  team:     { t:'Организаторы',        d:'Кто ведёт группу',                src:'текст', icon:'users' },
  gallery:  { t:'Фото с игр',          d:'С alt-текстом для поиска',        src:'фото',  icon:'eye' },
  reviews:  { t:'Отзывы игроков',      d:'Только от участников игр',        src:'игроки', icon:'star' },
  contacts: { t:'Контакты',            d:'Бот, канал, связь',               src:'авто',  icon:'send' },
  text:     { t:'Свой блок',           d:'Заголовок и текст',               src:'текст', icon:'edit', multi:true },
};

const SEO_SLOTS = [['Пн','20:00','Основа'],['Ср','20:00','Основа'],['Пт','19:30','Открытая игра'],['Вс','10:00','Микст']];
const SEO_VENUES = [
  { id:'v1', name:'Школа №24, малый зал', addr:'ул. Кропоткина, 91', note:'Пн, Ср, Вс', on:true },
  { id:'v2', name:'СК «Заслонова»', addr:'ул. Заслонова, 27', note:'Пт и аренда большого зала', on:true },
];
const SEO_LEVELS = [
  ['В1','Полупрофи','Перворазрядники, КМС, бывшие профессионалы.'],
  ['В2','Сильный любительский','Темповая и комбинационная игра: взлёты, волны, прострелы. Примерно Д1 ЛВЛ или выпускники спортшкол.'],
  ['В3','Средний любительский','Стабильная атака, двойной блок, один пасующий и игроки первого темпа. Средние и лидирующие команды Д2–Д3 ЛВЛ.'],
  ['В4','Продолжающие любители','Все основные элементы: подача, приём, передача, атака, блок. Выделенные пасующие, обычно двое. Уровень Д4 ЛВЛ.'],
  ['В4+','Начинающие','Перебрасываем мяч через сетку в своё удовольствие. Кто умеет — подаёт сверху и атакует выше троса.'],
];
const seoLevelsText = (lv) => { const o = SEO_LEVELS.map(x => x[0]).filter(x => lv.includes(x)); return o.length ? (o.length === 1 ? o[0] : o.slice(0, -1).join(', ') + ' и ' + o[o.length - 1]) : '—'; };
const SEO_PLANS = [['4 сессии',60],['8 сессий',110],['12 сессий',150]];

const SEO_STATE = {
  order: [
    { id:'hero', type:'hero', on:true }, { id:'facts', type:'facts', on:true },
    { id:'schedule', type:'schedule', on:true }, { id:'formats', type:'formats', on:true },
    { id:'prices', type:'prices', on:true }, { id:'venues', type:'venues', on:true },
    { id:'howto', type:'howto', on:true }, { id:'faq', type:'faq', on:true },
    { id:'team', type:'team', on:true }, { id:'gallery', type:'gallery', on:false },
    { id:'contacts', type:'contacts', on:true },
  ],
  hero: { auto:true, h1:'', sub:'Любительская группа: тренировки по будням, игры по выходным. Приходите одни или с друзьями.' },
  district: null, levels: ['В3','В4'],
  keywords: ['волейбол {город} тренировки','волейбол {город} игры','любительский волейбол {город}'],
  slug: 'vt-minsk', titleAuto:true, title:'', descAuto:true, desc:'',
  schedCount: 4, showSeats: true, showMap: true,
  venues: SEO_VENUES.map(v => v.id),
  formats: [
    ['Тренировки','Подача, приём, пас — упражнения и разбор ошибок. Понедельник и среда.'],
    ['Игры','Игровые вечера 6 на 6, составы меняются после каждой партии. Пятница.'],
    ['Микст','Смешанные команды и спокойный темп. Воскресенье утром.'],
  ],
  faq: [
    { q:'Можно ли прийти новичку?', a:'Да. Начните с тренировки «Основа» в понедельник или среду — там разбираем технику. На игры лучше приходить после 2–3 тренировок.' },
    { q:'Нужно ли брать свой мяч?', a:'Нет, мячи и сетка есть в зале. С собой — спортивная форма и сменная обувь для зала.' },
    { q:'Как отменить запись?', a:'auto:cancel' },
  ],
  team: [{ n:'Иван П.', init:'ИП', r:'Организатор', t:'Ведёт расписание, составы и кассу группы.' }],
  texts: {},
  contacts: { bot:'@volleytime_bot', channel:'t.me/vt_minsk', phone:false },
  dirty: false, publishedAt: '2 июня, 14:20',
};
const seoSubs = new Set();
const seoNotify = () => seoSubs.forEach(fn => fn());
const setSeo = (patch) => {
  Object.assign(SEO_STATE, typeof patch === 'function' ? patch(SEO_STATE) : patch, { dirty:true });
  seoNotify();
};
const seoPublish = () => { SEO_STATE.dirty = false; SEO_STATE.publishedAt = 'только что'; seoNotify(); };
const useSeoState = () => {
  const [, bump] = React.useState(0);
  React.useEffect(() => { const fn = () => bump(n => n + 1); seoSubs.add(fn); return () => seoSubs.delete(fn); }, []);
  return [SEO_STATE, setSeo];
};

// Every SEO string is derived from group data — the organizer edits facts once, the page follows.
// Любой город из каталога районных центров (24.1.2): slug транслитом, предложный падеж для H1 и title
const SEO_TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',' ':'-','-':'-' };
const seoSlugOf = (c) => c.toLowerCase().split('').map(ch => SEO_TR[ch] ?? ch).join('');
const SEO_LOC_FIX = { 'Марьина Горка':'Марьиной Горке', 'Старые Дороги':'Старых Дорогах', 'Октябрьский':'Октябрьском', 'Буда-Кошелёво':'Буда-Кошелёво' };
const seoLocOf = (c) => {
  if (SEO_LOC_FIX[c]) return SEO_LOC_FIX[c];
  if (/[иы]$/.test(c)) return c.slice(0, -1) + 'ах';
  if (/[ое]$/.test(c)) return c;
  if (/[ая]$/.test(c)) return c.slice(0, -1) + 'е';
  if (/ь$/.test(c)) return c.slice(0, -1) + 'е';
  return c + 'е';
};
const seoCity = (name) => SEO_CITIES.find(x => x[0] === name) || (name ? [name, seoSlugOf(name), seoLocOf(name), 'центр'] : SEO_CITIES[0]);

const seoDerive = (st, s) => {
  const c = seoCity(s.city);
  const [city, slug, loc, defDistrict] = c;
  const district = st.district || defDistrict;
  const isPublic = s.seoIndex;
  const invite = s.joinMode === 'invite';
  const h1 = st.hero.auto ? `Волейбол в ${loc} — тренировки и игры` : (st.hero.h1 || `Волейбол в ${loc}`);
  const title = st.titleAuto ? `Волейбол в ${loc}: тренировки и игры | VolleyTime` : st.title;
  const desc = st.descAuto
    ? `Любительский волейбол в ${loc}: тренировки по Пн и Ср в 20:00, игры по Пт и Вс. Уровни ${seoLevelsText(st.levels)}. Разовое — 15 BYN. Запись в Telegram.`
    : st.desc;
  const price = s.subsOn ? 'Разовое посещение — 15 BYN, абонемент — от 60 BYN за 4 сессии' : 'Разовое посещение — 15 BYN';
  const venues = SEO_VENUES.filter(v => st.venues.includes(v.id));
  const summary = `VolleyTime Минск — любительская волейбольная группа в ${loc} (${district}). Тренировки по понедельникам и средам в 20:00, игры по пятницам в 19:30 и по воскресеньям в 10:00. Играем ${venues.length ? 'в залах: ' + venues.map(v => `${v.name.split(',')[0]} (${v.addr})`).join(' и ') : 'в залах города'}. Уровни ${seoLevelsText(st.levels)}. ${price}. Запись через Telegram${invite ? ' — по приглашению организатора' : ''}.`;
  const kws = st.keywords.map(k => k.replace('{город}', city.toLowerCase()));
  return {
    city, slug, loc, district, isPublic, h1, title, desc, price, venues, summary, kws,
    url: `volleytime.by/${slug}/${st.slug}`,
    robots: isPublic ? 'index, follow' : 'noindex, nofollow',
    invite,
    cta: invite ? 'Запросить приглашение' : 'Записаться в Telegram',
    faqA: (a) => a === 'auto:cancel'
      ? (s.cancelAllowed ? `В Telegram-боте, не позже чем ${s.cancelCutoff === 'в любое время' ? 'до начала игры' : s.cancelCutoff.replace('за ', 'за ') + ' до начала'}. Место сразу уходит первому из листа ожидания.` : 'Отмена записи в группе выключена — если не можете прийти, напишите организатору.')
      : a,
  };
};
const seoOn = (st, type) => st.order.some(x => x.type === type && x.on);

// ---------- Публичная страница ----------
const seoH2 = (m) => ({ fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize: m ? 24 : 34, lineHeight:1.05, letterSpacing:'.003em', margin:0, textWrap:'balance' });
const seoP = (m) => ({ fontSize: m ? 15 : 16, lineHeight:1.6, color:'var(--vt-ink-3)', margin:0, textWrap:'pretty' });

const SeoFaqItem = ({ q, a, open, onToggle, m }) => (
  <div style={{background:'var(--vt-bone)', borderRadius:16}}>
    <button onClick={onToggle} style={{display:'flex', alignItems:'center', gap:12, width:'100%', padding: m ? '14px 16px' : '16px 20px', textAlign:'left', cursor:'pointer', background:'transparent', border:0, color:'var(--vt-ink)', font:'inherit'}}>
      <span style={{flex:1, fontSize: m ? 15 : 17, fontWeight:700}}>{q}</span>
      <span style={{transform: open ? 'rotate(180deg)' : 'none', transition:'transform .18s', display:'flex'}}><Icon name="chevron-d" size={18}/></span>
    </button>
    {open && <div style={{...seoP(m), padding: m ? '0 16px 16px' : '0 20px 18px', maxWidth:760}}>{a}</div>}
  </div>
);

const SeoPublicPage = ({ mode = 'desktop', sel, onSel, ring = 3, interactive }) => {
  const [st] = useSeoState();
  const [s] = useGroupSettings();
  const d = seoDerive(st, s);
  const m = mode === 'mobile';
  const [openFaq, setOpenFaq] = React.useState(0);
  const events = (typeof VT_EVENTS !== 'undefined' ? VT_EVENTS : []).filter(e => !e.past).slice(0, st.schedCount);
  const next = events.find(e => !e.closed && e.meter < 100) || events[0];
  const gap = m ? 14 : 20;
  const secPad = m ? 20 : 32;

  const R = {
    hero: () => (
      <div className="vt-card vt-card--hero" style={{padding: m ? 22 : 44, display:'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'minmax(0,1.55fr) minmax(0,1fr)', gap: m ? 20 : 36, alignItems:'end', boxShadow:'none'}}>
        <div style={{minWidth:0}}>
          <div className="vt-cap" style={{color:'var(--vt-on-hero-3)'}}>{d.city} · любительский волейбол</div>
          <h1 style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, fontSize: m ? 34 : 60, lineHeight:1, margin:'12px 0 0', textWrap:'balance', overflowWrap:'anywhere'}}>{d.h1}</h1>
          <p style={{fontSize: m ? 15 : 18, lineHeight:1.5, color:'var(--vt-on-hero-2)', margin:'16px 0 0', maxWidth:540, textWrap:'pretty'}}>{st.hero.sub}</p>
          <div style={{display:'flex', gap:10, marginTop:22, flexWrap:'wrap'}}>
            <span className="vt-btn" style={{background:'var(--vt-orange)', color:'var(--vt-on-hero)'}}><Icon name={d.invite ? 'lock' : 'tg'} size={16}/>{d.cta}</span>
            {seoOn(st,'schedule') && <span className="vt-btn" style={{background:'var(--vt-on-hero-fill)', color:'var(--vt-on-hero)'}}>Расписание</span>}
          </div>
        </div>
        {next && seoOn(st,'schedule') && (
          <div style={{background:'var(--vt-paper)', color:'var(--vt-ink)', borderRadius:20, padding: m ? 18 : 22}}>
            <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Ближайшая игра</div>
            <div style={{display:'flex', alignItems:'baseline', gap:10, marginTop:8}}>
              <span className="vt-mono" style={{fontSize: m ? 40 : 48, fontWeight:700, lineHeight:1}}>{next.t}</span>
              <span style={{fontSize:14, fontWeight:600}}>{next.dow[0] + next.dow.slice(1).toLowerCase()} {next.dnum} {next.month}</span>
            </div>
            <div style={{fontSize:15, fontWeight:700, marginTop:10}}>{next.m}</div>
            <div style={{fontSize:13, color:'var(--vt-mute-2)', marginTop:2}}>{next.venue}</div>
            {st.showSeats && <>
              <div className="vt-meter" style={{marginTop:12, borderRadius:'var(--r-pill)', overflow:'hidden'}}><div style={{width:`${next.meter}%`, height:'100%', background:'var(--vt-blue-ink)'}}/></div>
              <div style={{fontSize:13, color:'var(--vt-mute-2)', marginTop:6}}>занято <b style={{color:'var(--vt-ink)'}}>{next.main.split('/')[0]}</b> из {next.main.split('/')[1]}</div>
            </>}
          </div>
        )}
      </div>
    ),
    facts: () => (
      <section style={{padding:secPad, background:'var(--vt-bone)', borderRadius:24}}>
        <h2 style={seoH2(m)}>Коротко о группе</h2>
        <p style={{...seoP(m), marginTop:12, maxWidth:820}}>{d.summary}</p>
        <dl style={{display:'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'repeat(3, minmax(0,1fr))', gap:10, margin:'20px 0 0'}}>
          {[
            ['Город', `${d.city}, ${d.district}`],
            ['Когда', SEO_SLOTS.map(x => `${x[0]} ${x[1]}`).join(' · ')],
            ['Где', d.venues.length ? d.venues.map(v => v.name.split(',')[0]).join(', ') : '—'],
            ['Уровень', SEO_LEVELS.filter(x => st.levels.includes(x[0])).map(x => `${x[0]} · ${x[1].toLowerCase()}`).join(', ') || '—'],
            ['Стоимость', s.subsOn ? '15 BYN разово · абонемент от 60 BYN' : '15 BYN за посещение'],
            ['Запись', d.invite ? 'по приглашению организатора' : 'Telegram-бот, без звонков'],
          ].map(([k, v]) => (
            <div key={k} style={{background:'var(--vt-paper)', borderRadius:14, padding:'12px 14px', minWidth:0}}>
              <dt className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{k}</dt>
              <dd style={{margin:'4px 0 0', fontSize:15, fontWeight:600}}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    ),
    schedule: () => (
      <section style={{display:'flex', flexDirection:'column', gap:14}}>
        <h2 style={seoH2(m)}>Ближайшие игры в {d.loc}</h2>
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {events.map(e => {
            const full = e.meter >= 100, closed = e.closed;
            const [a, b] = e.main.split('/');
            return (
              <div key={e.id} style={{display:'grid', gridTemplateColumns: m ? '56px minmax(0,1fr)' : '72px minmax(0,1fr) 150px 120px 128px', gap: m ? 12 : 18, alignItems:'center', padding: m ? '12px 14px' : '14px 20px', background:'var(--vt-bone)', borderRadius:16}}>
                <div>
                  <div className="vt-mono" style={{fontSize: m ? 28 : 34, fontWeight:700, lineHeight:1}}>{e.dnum}</div>
                  <div style={{fontSize:12, color:'var(--vt-mute-2)', marginTop:2}}>{e.dow.toLowerCase()} · {e.month}</div>
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontSize: m ? 15 : 16, fontWeight:700, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>{e.t} · {e.m}{(e.join || s.joinMode) === 'invite' && <span className="vt-chip vt-chip--state" style={{fontSize:11, gap:4}}><Icon name="lock" size={11}/>по приглашению</span>}</div>
                  <div style={{fontSize:13, color:'var(--vt-mute-2)', marginTop:2}}>{e.venue}{m ? ` · ${e.priceMode === 'split' ? 'сумма делится' : '15 BYN'}` : ''}</div>
                  {m && st.showSeats && <div style={{fontSize:13, marginTop:4}}>{closed ? 'запись закрыта' : full ? 'мест нет · лист ожидания' : `занято ${a} из ${b}`}</div>}
                </div>
                {!m && <div style={{fontSize:14}}>{!st.showSeats ? '' : closed ? <span style={{color:'var(--vt-mute-2)'}}>запись закрыта</span> : full ? <span style={{color:'var(--vt-mute-2)'}}>мест нет · очередь</span> : <>занято <b>{a}</b> из {b}</>}</div>}
                {!m && <div className="vt-mono" style={{fontSize:15, fontWeight:700}}>{e.priceMode === 'split' ? <span>{e.total} BYN <span style={{fontFamily:'var(--f-body)', fontWeight:500, fontSize:12, color:'var(--vt-mute-2)'}}>на всех</span></span> : '15 BYN'}</div>}
                {!m && <span className="vt-btn vt-btn--sm" style={{background: closed ? 'var(--vt-bone-2)' : 'var(--vt-ink)', color: closed ? 'var(--vt-mute-2)' : 'var(--vt-paper)'}}>{closed ? 'Закрыто' : (e.join || s.joinMode) === 'invite' ? 'Запросить' : full ? 'В очередь' : 'Записаться'}</span>}
              </div>
            );
          })}
        </div>
      </section>
    ),
    formats: () => (
      <section style={{display:'flex', flexDirection:'column', gap:14}}>
        <h2 style={seoH2(m)}>Тренировки и игры</h2>
        <div style={{display:'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'repeat(3, minmax(0,1fr))', gap:10}}>
          {st.formats.map(([t, x], i) => (
            <div key={i} style={{padding: m ? 16 : 22, background: i === 0 ? 'var(--vt-blue-soft-tile)' : 'var(--vt-bone)', borderRadius:20}}>
              <h3 style={{fontSize: m ? 17 : 19, margin:0}}>{t}</h3>
              <p style={{...seoP(m), marginTop:6, fontSize:15}}>{x}</p>
            </div>
          ))}
        </div>
        <h3 style={{fontSize: m ? 17 : 19, margin:'8px 0 0'}}>Уровни игры в группе</h3>
        <div style={{display:'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'repeat(2, minmax(0,1fr))', gap:8}}>
          {SEO_LEVELS.filter(x => st.levels.includes(x[0])).map(([c, n, x]) => (
            <div key={c} style={{display:'flex', gap:12, padding:'12px 14px', background:'var(--vt-bone)', borderRadius:16}}>
              <span className="vt-mono" style={{fontSize:20, fontWeight:700, color:'var(--vt-blue-ink)', minWidth:40}}>{c}</span>
              <div style={{minWidth:0}}><div style={{fontSize:15, fontWeight:700}}>{n}</div><div style={{fontSize:13, color:'var(--vt-ink-3)', marginTop:2, lineHeight:1.45}}>{x}</div></div>
            </div>
          ))}
        </div>
        <div style={{fontSize:13, color:'var(--vt-mute-2)'}}>Шкала: {SEO_LEVELS.map(x => x[0]).join(' · ')} — от полупрофи до начинающих.</div>
      </section>
    ),
    prices: () => (
      <section style={{display:'flex', flexDirection:'column', gap:14}}>
        <h2 style={seoH2(m)}>Сколько стоит</h2>
        <div style={{display:'grid', gridTemplateColumns: m ? 'repeat(2, minmax(0,1fr))' : `repeat(${s.subsOn ? 5 : 2}, minmax(0,1fr))`, gap:10}}>
          <div style={{padding:18, background:'var(--vt-ink)', color:'var(--vt-paper)', borderRadius:20}}>
            <div style={{fontSize:13, opacity:.75}}>Разовое</div>
            <div className="vt-mono" style={{fontSize:32, fontWeight:700, marginTop:6}}>15 BYN</div>
            <div style={{fontSize:13, opacity:.75}}>за место</div>
          </div>
          {s.subsOn && SEO_PLANS.map(([n, p]) => (
            <div key={n} style={{padding:18, background:'var(--vt-bone)', borderRadius:20}}>
              <div style={{fontSize:13, color:'var(--vt-mute-2)'}}>Абонемент</div>
              <div className="vt-mono" style={{fontSize:32, fontWeight:700, marginTop:6}}>{p} BYN</div>
              <div style={{fontSize:13, color:'var(--vt-mute-2)'}}>{n}</div>
            </div>
          ))}
          <div style={{padding:18, background:'var(--vt-orange-soft)', borderRadius:20, gridColumn: m ? '1 / -1' : 'auto'}}>
            <div style={{fontSize:13, color:'var(--vt-orange-ink)', fontWeight:600}}>Аренда большого зала</div>
            <div className="vt-mono" style={{fontSize:32, fontWeight:700, marginTop:6}}>240 BYN</div>
            <div style={{fontSize:13, color:'var(--vt-ink-3)'}}>на всех · делится после закрытия записи</div>
          </div>
        </div>
        <p style={{...seoP(m), fontSize:14}}>Оплата наличными организатору или переводом на карту.{s.maxSeats > 1 ? ` Можно записать с собой до ${s.maxSeats - 1} ${s.maxSeats - 1 === 1 ? 'друга' : 'друзей'} — оплата за каждое место.` : ''}</p>
      </section>
    ),
    venues: () => (
      <section style={{display:'flex', flexDirection:'column', gap:14}}>
        <h2 style={seoH2(m)}>Где играем в {d.loc}</h2>
        <div style={{display:'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'repeat(2, minmax(0,1fr))', gap:10}}>
          {d.venues.map(v => (
            <div key={v.id} style={{background:'var(--vt-bone)', borderRadius:20, overflow:'hidden'}}>
              {st.showMap && <div style={{height: m ? 110 : 150, background:'repeating-linear-gradient(135deg, var(--vt-bone-2) 0 12px, var(--vt-bone) 12px 24px)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--vt-mute-2)', fontSize:13, gap:6}}><Icon name="pin" size={16}/> карта · {v.addr}</div>}
              <div style={{padding:'14px 18px'}}>
                <div style={{fontSize:16, fontWeight:700}}>{v.name}</div>
                <div style={{fontSize:14, color:'var(--vt-ink-3)', marginTop:2}}>{d.city}, {v.addr}</div>
                <div style={{fontSize:13, color:'var(--vt-mute-2)', marginTop:6}}>{v.note}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    ),
    howto: () => (
      <section style={{padding:secPad, background:'var(--vt-bone)', borderRadius:24}}>
        <h2 style={seoH2(m)}>Как записаться</h2>
        <ol style={{listStyle:'none', padding:0, margin:'18px 0 0', display:'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'repeat(3, minmax(0,1fr))', gap:10}}>
          {[
            d.invite ? ['Запросите приглашение','Запись по приглашению: организатор пришлёт личную ссылку.'] : ['Откройте бот','Нажмите «Записаться» — откроется VolleyTime в Telegram.'],
            ['Выберите игру', s.maxSeats > 1 ? `Укажите, сколько мест нужно — до ${s.maxSeats} на одного игрока.` : 'Одна запись — одно место.'],
            ['Приходите', s.cancelAllowed ? `Планы поменялись — отмените запись ${s.cancelCutoff === 'в любое время' ? 'до начала' : s.cancelCutoff + ' до начала'}.` : 'Оплата на месте или переводом организатору.'],
          ].map(([t, x], i) => (
            <li key={i} style={{background:'var(--vt-paper)', borderRadius:16, padding:16, display:'flex', gap:12}}>
              <span className="vt-mono" style={{fontSize:28, fontWeight:700, color:'var(--vt-blue-ink)', lineHeight:1}}>{i + 1}</span>
              <div><div style={{fontSize:16, fontWeight:700}}>{t}</div><div style={{fontSize:14, color:'var(--vt-ink-3)', marginTop:4, lineHeight:1.5}}>{x}</div></div>
            </li>
          ))}
        </ol>
      </section>
    ),
    faq: () => (
      <section style={{display:'flex', flexDirection:'column', gap:14}}>
        <h2 style={seoH2(m)}>Вопросы о волейболе в {d.loc}</h2>
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {st.faq.map((f, i) => <SeoFaqItem key={i} m={m} q={f.q || 'Вопрос без текста'} a={d.faqA(f.a)} open={openFaq === i} onToggle={(e) => { if (interactive) { e.stopPropagation(); setOpenFaq(openFaq === i ? -1 : i); } }}/>)}
        </div>
      </section>
    ),
    team: () => (
      <section style={{display:'flex', flexDirection:'column', gap:14}}>
        <h2 style={seoH2(m)}>Организаторы</h2>
        <div style={{display:'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'repeat(2, minmax(0,1fr))', gap:10}}>
          {st.team.map((p, i) => (
            <div key={i} style={{display:'flex', gap:14, alignItems:'center', padding:16, background:'var(--vt-bone)', borderRadius:20}}>
              <Avi size="lg" name={p.n} init={p.init} tag="ink"/>
              <div style={{minWidth:0}}><div style={{fontSize:16, fontWeight:700}}>{p.n}</div><div style={{fontSize:13, color:'var(--vt-mute-2)'}}>{p.r}</div><div style={{fontSize:14, color:'var(--vt-ink-3)', marginTop:4}}>{p.t}</div></div>
            </div>
          ))}
        </div>
      </section>
    ),
    gallery: () => (
      <section style={{display:'flex', flexDirection:'column', gap:14}}>
        <h2 style={seoH2(m)}>Фото с игр</h2>
        <div style={{display:'grid', gridTemplateColumns: m ? 'repeat(2, minmax(0,1fr))' : 'repeat(4, minmax(0,1fr))', gap:10}}>
          {[0,1,2,3].map(i => <div key={i} style={{aspectRatio:'4/3', borderRadius:16, background:'var(--vt-bone)', display:'flex', alignItems:'flex-end', padding:10, fontSize:12, color:'var(--vt-mute-2)'}}>фото {i + 1} · alt: волейбол в {d.loc}</div>)}
        </div>
      </section>
    ),
    reviews: () => (
      <section style={{display:'flex', flexDirection:'column', gap:14}}>
        <h2 style={seoH2(m)}>Отзывы игроков</h2>
        <div style={{padding:20, borderRadius:20, background:'var(--vt-bone)', fontSize:15, color:'var(--vt-ink-3)'}}>Отзывы появятся после игр — их оставляют только участники, организатор проверяет перед публикацией.</div>
      </section>
    ),
    contacts: () => (
      <section style={{display:'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'repeat(3, minmax(0,1fr))', gap:10}}>
        <h2 style={{...seoH2(m), gridColumn:'1 / -1'}}>Контакты</h2>
        {[['tg','Telegram-бот', st.contacts.bot], ['send','Канал группы', st.contacts.channel], ['users','Другие группы', `Волейбол в ${d.loc} на VolleyTime`]].map(([ic, k, v]) => (
          <div key={k} style={{display:'flex', gap:12, alignItems:'center', padding:16, background:'var(--vt-bone)', borderRadius:16, minWidth:0}}>
            <Icon name={ic} size={18}/><div style={{minWidth:0}}><div style={{fontSize:13, color:'var(--vt-mute-2)'}}>{k}</div><div style={{fontSize:15, fontWeight:600, overflowWrap:'anywhere'}}>{v}</div></div>
          </div>
        ))}
      </section>
    ),
    text: (sec) => {
      const t = st.texts[sec.id] || { h:'Новый блок', b:'Текст блока.' };
      return <section style={{display:'flex', flexDirection:'column', gap:10}}><h2 style={seoH2(m)}>{t.h}</h2><p style={{...seoP(m), maxWidth:760}}>{t.b}</p></section>;
    },
  };

  return (
    <div className="vt-frame vt-light" style={{background:'var(--vt-paper)', color:'var(--vt-ink)', fontFamily:'var(--f-body)', padding: m ? '14px 14px 28px' : '24px 40px 44px', display:'flex', flexDirection:'column', gap}}>
      <header style={{display:'flex', alignItems:'center', gap:16, justifyContent:'space-between'}}>
        <div style={{display:'flex', alignItems:'center', gap:16, minWidth:0}}>
          <span className="vt-stripe" style={{fontSize: m ? 18 : 20}}><span className="vt-ball"/><span>Volley<span style={{color:'var(--vt-flame-ink)'}}>Time</span></span></span>
          {!m && <nav aria-label="Хлебные крошки" style={{fontSize:13, color:'var(--vt-mute-2)', display:'flex', gap:6}}><span>{d.city}</span><span>›</span><span>Волейбол</span><span>›</span><span style={{color:'var(--vt-ink)'}}>VolleyTime Минск</span></nav>}
        </div>
        <span className="vt-btn vt-btn--sm vt-btn--ghost"><Icon name="tg" size={14}/>Войти</span>
      </header>
      {st.order.filter(x => x.on).map(sec => {
        const node = R[sec.type] ? R[sec.type](sec) : null;
        if (!onSel) return <div key={sec.id}>{node}</div>;
        const on = sel === sec.id;
        return (
          <div key={sec.id} data-seo-sec={sec.id} onClick={(e) => { e.stopPropagation(); onSel(sec.id); }} style={{position:'relative', cursor:'pointer', borderRadius:24, outline: on ? `${ring}px solid var(--vt-flame)` : 'none', outlineOffset: ring * 2}}>
            {node}
          </div>
        );
      })}
      <footer style={{display:'flex', flexWrap:'wrap', gap:'8px 18px', justifyContent:'space-between', fontSize:13, color:'var(--vt-mute-2)', paddingTop:8}}>
        <span>Страница группы на VolleyTime · {d.url}</span>
        <span>{d.isPublic ? `Все группы: волейбол в ${d.loc} →` : ''}</span>
      </footer>
    </div>
  );
};

Object.assign(window, { SEO_LEVELS, seoLevelsText, SEO_CITIES, seoCity, SEO_SECTION_TYPES, SEO_SLOTS, SEO_VENUES, SEO_STATE, setSeo, seoPublish, useSeoState, seoDerive, seoOn, SeoPublicPage });
