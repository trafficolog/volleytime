// screens-seo.jsx — конструктор SEO-страницы группы (кабинет организатора) + полный предпросмотр

const SeoSwitch = ({ on, onChange, label, disabled }) => (
  <button role="switch" aria-checked={on} aria-label={label} disabled={disabled}
    onClick={(e) => { e.stopPropagation(); onChange(!on); }}
    style={{width:36, height:20, borderRadius:'var(--r-pill)', background:on ? 'var(--vt-ink)' : 'var(--vt-stroke-2)', position:'relative', flexShrink:0, cursor: disabled ? 'not-allowed' : 'pointer', border:0, opacity: disabled ? .4 : 1}}>
    <span style={{position:'absolute', top:2, left:on ? 18 : 2, width:16, height:16, borderRadius:'var(--r-pill)', background:'var(--vt-paper)', transition:'left .15s'}}/>
  </button>
);

const SeoSeg = ({ value, options, onChange }) => (
  <div style={{display:'flex', gap:2, padding:3, background:'var(--vt-ctl-track, var(--vt-bone-2))', borderRadius:'var(--r-chip)', width:'fit-content'}}>
    {options.map(([v, l]) => (
      <button key={v} onClick={() => onChange(v)} className="vt-btn vt-btn--sm" style={{background: value === v ? 'var(--vt-paper)' : 'transparent', boxShadow: value === v ? 'var(--vt-seg-shadow)' : 'none', color:'var(--vt-ink)', fontWeight: value === v ? 700 : 500, padding:'6px 12px'}}>{l}</button>
    ))}
  </div>
);

const SeoCount = ({ n, min, max }) => {
  const ok = n >= (min || 0) && n <= max;
  return <span className="vt-mono" style={{fontSize:'var(--fs-2xs)', color: ok ? 'var(--vt-grass-ink)' : 'var(--vt-amber-ink)'}}>{n} / {min ? `${min}–${max}` : max}</span>;
};

const SeoHint = ({ children, icon = 'bell' }) => (
  <div style={{display:'flex', gap:8, alignItems:'flex-start', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', lineHeight:1.45}}>
    <span style={{display:'flex', marginTop:1}}><Icon name={icon} size={13} stroke="var(--vt-icon-idle)"/></span><span>{children}</span>
  </div>
);

// Масштабирует страницу дизайн-ширины в колонку предпросмотра
const SeoScaled = ({ designW, children }) => {
  const outer = React.useRef(), inner = React.useRef();
  const [sc, setSc] = React.useState(0.4);
  const [h, setH] = React.useState(400);
  React.useLayoutEffect(() => {
    const fit = () => {
      if (!outer.current || !inner.current) return;
      const k = Math.min(1, outer.current.clientWidth / designW);
      setSc(k); setH(inner.current.offsetHeight * k);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(outer.current); ro.observe(inner.current);
    return () => ro.disconnect();
  }, [designW]);
  return (
    <div ref={outer} style={{width:'100%'}}>
      <div style={{height:h, width:designW * sc, margin:'0 auto', position:'relative', overflow:'hidden', borderRadius:16, boxShadow:'var(--vt-shadow-card)', background:'var(--vt-paper)'}}>
        <div ref={inner} style={{width:designW, transform:`scale(${sc})`, transformOrigin:'top left', position:'absolute', top:0, left:0}}>{children(sc)}</div>
      </div>
    </div>
  );
};

const seoChecks = (st, s, d) => {
  const faqN = st.faq.filter(f => f.q).length;
  return [
    { ok:d.isPublic, t: d.isPublic ? 'Индексация разрешена' : 'Индексация выключена', s: d.isPublic ? 'index, follow · страница в sitemap.xml' : 'Вы скрыли страницу от поиска — остальные проверки не важны', hard:true },
    { ok: /волейбол/i.test(d.h1) && d.h1.includes(d.loc), t:'H1 содержит «волейбол» и город', s:d.h1 },
    { ok: d.title.length > 0 && d.title.length <= 60, t:`Title — ${d.title.length} символов`, s:'Не длиннее 60, иначе обрежется в выдаче' },
    { ok: d.desc.length >= 110 && d.desc.length <= 160, t:`Description — ${d.desc.length} символов`, s:'Оптимально 110–160' },
    { ok: seoOn(st,'facts'), t:'Блок «Коротко о группе»', s:'Факты одним абзацем — их цитируют ИИ-ассистенты' },
    { ok: seoOn(st,'faq') && faqN >= 3, t:`Вопросы и ответы — ${faqN}`, s:'Минимум 3 вопроса для разметки FAQPage' },
    { ok: seoOn(st,'venues') && d.venues.length > 0, t:'Адреса залов на странице', s:'Нужны для поиска «рядом» и карт' },
    { ok: seoOn(st,'schedule'), t:'Расписание с разметкой событий', s:'Каждая игра — Event с датой, местом и ценой' },
    { ok: seoOn(st,'gallery'), t:'Фото с игр', s:'Добавьте 4+ фото с подписями — блок сейчас выключен', soft:true },
  ];
};

const seoSchema = (st, d) => [
  ['SportsOrganization', 'Группа, город, контакты', true],
  ['SportsActivityLocation', `${d.venues.length} ${d.venues.length === 1 ? 'зал' : 'зала'} с адресом`, seoOn(st,'venues')],
  ['Event', `${st.schedCount} ближайших игр`, seoOn(st,'schedule')],
  ['Offer', 'Цены и абонементы', seoOn(st,'prices')],
  ['FAQPage', `${st.faq.length} вопроса`, seoOn(st,'faq')],
  ['BreadcrumbList', `VolleyTime › ${d.city} › Волейбол`, true],
];

const seoHas = (txt, kw) => kw.split(' ').every(w => txt.toLowerCase().includes(w.slice(0, Math.max(4, w.length - 2))));

// ---------- Инспектор: поля выбранной секции ----------
const SeoSectionInspector = ({ sec, st, set, s, d, nav }) => {
  if (!sec) return <SeoHint>Выберите секцию слева или кликните по ней в предпросмотре.</SeoHint>;
  const T = SEO_SECTION_TYPES[sec.type];
  const head = (
    <div style={{display:'flex', alignItems:'center', gap:10}}>
      <span style={{width:34, height:34, borderRadius:10, background:'var(--vt-ctl)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}><Icon name={T.icon} size={16}/></span>
      <div style={{minWidth:0}}><div style={{fontSize:'var(--fs-base)', fontWeight:700}}>{T.t}</div><div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{T.d}</div></div>
    </div>
  );
  const goSettings = (label) => <button onClick={() => nav.reset('settings')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{alignSelf:'flex-start'}}>{label} <Icon name="chevron-r" size={13}/></button>;
  const auto = (rows, label) => (
    <>
      <div style={{display:'flex', flexDirection:'column', gap:6}}>
        {rows.map(([k, v, from]) => (
          <div key={k} style={{background:'var(--vt-ctl)', borderRadius:12, padding:'10px 12px'}}>
            <div style={{display:'flex', justifyContent:'space-between', gap:8}}><span style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{k}</span><span style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{from}</span></div>
            <div style={{fontSize:'var(--fs-sm)', fontWeight:600, marginTop:2}}>{v}</div>
          </div>
        ))}
      </div>
      <SeoHint icon="check">Заполняется автоматически — поменяете в настройках, страница обновится сама.</SeoHint>
      {label && goSettings(label)}
    </>
  );
  let body = null;
  switch (sec.type) {
    case 'hero': body = <>
      <div>
        <label className="vt-label">Заголовок H1</label>
        <SeoSeg value={st.hero.auto ? 'auto' : 'own'} options={[['auto','По шаблону'],['own','Свой']]} onChange={(v) => set({ hero:{ ...st.hero, auto: v === 'auto', h1: st.hero.h1 || d.h1 } })}/>
        {st.hero.auto
          ? <div style={{marginTop:8, padding:'10px 12px', borderRadius:12, background:'var(--vt-ctl)', fontSize:'var(--fs-sm)', fontWeight:600}}>{d.h1}</div>
          : <input className="vt-field" style={{marginTop:8}} value={st.hero.h1} onChange={(e) => set({ hero:{ ...st.hero, h1:e.target.value } })}/>}
        <div style={{marginTop:6}}><SeoHint>Шаблон: «Волейбол в {'{городе}'} — тренировки и игры». Город берётся из профиля группы.</SeoHint></div>
      </div>
      <div>
        <label className="vt-label">Подзаголовок</label>
        <textarea className="vt-field" rows={3} value={st.hero.sub} onChange={(e) => set({ hero:{ ...st.hero, sub:e.target.value } })}/>
      </div>
      <div>
        <label className="vt-label">Кнопка</label>
        <div style={{padding:'10px 12px', borderRadius:12, background:'var(--vt-ctl)', fontSize:'var(--fs-sm)', display:'flex', alignItems:'center', gap:8}}><Icon name={d.invite ? 'lock' : 'tg'} size={14}/>{d.cta}</div>
        <div style={{marginTop:6}}><SeoHint>{d.invite ? 'Запись по приглашению (настройка «Записи и оплата») — кнопка просит приглашение.' : 'Ведёт в Mini App группы.'}</SeoHint></div>
      </div>
    </>; break;
    case 'facts': body = <>
      <div>
        <label className="vt-label">Уровни игроков · можно несколько</label>
        <div style={{display:'flex', flexDirection:'column', gap:4}}>
          {SEO_LEVELS.map(([c, n]) => {
            const on = st.levels.includes(c);
            return (
              <button key={c} onClick={() => set({ levels: on ? st.levels.filter(x => x !== c) : [...st.levels, c] })} aria-pressed={on}
                style={{display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:12, border:0, cursor:'pointer', textAlign:'left', font:'inherit', color:'var(--vt-ink)', background: on ? 'var(--vt-paper)' : 'var(--vt-ctl)', boxShadow: on ? '0 0 0 2px var(--vt-ink)' : 'none'}}>
                <span style={{width:18, height:18, borderRadius:6, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background: on ? 'var(--vt-ink)' : 'transparent', boxShadow: on ? 'none' : 'inset 0 0 0 2px var(--vt-icon-idle)', color:'var(--vt-paper)'}}>{on && <Icon name="check" size={11} sw={2.6}/>}</span>
                <span className="vt-mono" style={{fontWeight:700, minWidth:30}}>{c}</span>
                <span style={{fontSize:'var(--fs-sm)'}}>{n}</span>
              </button>
            );
          })}
        </div>
        {st.levels.length === 0 && <div style={{marginTop:6}}><SeoHint>Выберите хотя бы один уровень — без него игрок не поймёт, подходит ли ему группа.</SeoHint></div>}
      </div>
      {auto([
        ['Город и район', `${d.city}, ${d.district}`, 'Профиль'],
        ['Расписание', SEO_SLOTS.map(x => `${x[0]} ${x[1]}`).join(' · '), 'Шаблоны'],
        ['Залы', d.venues.map(v => v.name.split(',')[0]).join(', ') || '—', 'Залы'],
        ['Цена', d.price, 'Записи и оплата'],
      ], 'Открыть настройки')}
    </>; break;
    case 'schedule': body = <>
      <div>
        <label className="vt-label">Сколько ближайших событий показать</label>
        <div style={{display:'flex', gap:6}}>{[2,3,4,5].map(n => <button key={n} onClick={() => set({ schedCount:n })} className="vt-btn vt-btn--sm" style={{background: st.schedCount === n ? 'var(--vt-ink)' : 'var(--vt-ctl)', color: st.schedCount === n ? 'var(--vt-paper)' : 'var(--vt-ink)', minWidth:40}}>{n}</button>)}</div>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:12, background:'var(--vt-ctl)'}}>
        <div style={{flex:1, fontSize:'var(--fs-sm)', fontWeight:600}}>Показывать занятые места</div>
        <SeoSwitch on={st.showSeats} onChange={(v) => set({ showSeats:v })} label="Показывать занятые места"/>
      </div>
      <SeoHint icon="calendar">События берутся из кабинета и обновляются сами. Каждое размечено как Event — поисковик может показать даты прямо в выдаче.</SeoHint>
    </>; break;
    case 'formats': body = <>
      {st.formats.map(([t, x], i) => (
        <div key={i} style={{display:'flex', flexDirection:'column', gap:6, padding:12, borderRadius:12, background:'var(--vt-ctl)'}}>
          <input className="vt-field" value={t} style={{fontWeight:700, background:'var(--vt-paper)'}} onChange={(e) => { const f = st.formats.map(r => [...r]); f[i][0] = e.target.value; set({ formats:f }); }}/>
          <textarea className="vt-field" rows={2} value={x} style={{background:'var(--vt-paper)'}} onChange={(e) => { const f = st.formats.map(r => [...r]); f[i][1] = e.target.value; set({ formats:f }); }}/>
        </div>
      ))}
    </>; break;
    case 'prices': body = auto([
      ['Разовое', '15 BYN за место', 'Записи и оплата'],
      ['Абонементы', s.subsOn ? SEO_PLANS.map(([n, p]) => `${n} — ${p} BYN`).join(' · ') : 'выключены в группе — блок их не покажет', 'Абонементы'],
      ['Делёж суммы', 'Аренда большого зала — 240 BYN на всех', 'События'],
    ], 'Записи и оплата'); break;
    case 'venues': body = <>
      {SEO_VENUES.map(v => {
        const on = st.venues.includes(v.id);
        return (
          <div key={v.id} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:12, background:'var(--vt-ctl)'}}>
            <Icon name="pin" size={15}/>
            <div style={{flex:1, minWidth:0}}><div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{v.name}</div><div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{v.addr}</div></div>
            <SeoSwitch on={on} label={`Показывать ${v.name}`} onChange={(n) => set({ venues: n ? [...st.venues, v.id] : st.venues.filter(x => x !== v.id) })}/>
          </div>
        );
      })}
      <div style={{display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:12, background:'var(--vt-ctl)'}}>
        <div style={{flex:1, fontSize:'var(--fs-sm)', fontWeight:600}}>Карта под адресом</div>
        <SeoSwitch on={st.showMap} onChange={(v) => set({ showMap:v })} label="Карта"/>
      </div>
      {goSettings('Залы и площадки')}
    </>; break;
    case 'howto': body = auto([
      ['Шаг 1', d.invite ? 'Запросить приглашение' : 'Открыть бот в Telegram', 'Запись на события'],
      ['Шаг 2', `Выбрать игру и до ${s.maxSeats} мест`, 'Мест на игрока'],
      ['Шаг 3', s.cancelAllowed ? `Отмена ${s.cancelCutoff} до начала` : 'Оплата на месте', 'Политика отмены'],
    ], 'Записи и оплата'); break;
    case 'faq': body = <>
      {st.faq.map((f, i) => (
        <div key={i} style={{display:'flex', flexDirection:'column', gap:6, padding:12, borderRadius:12, background:'var(--vt-ctl)'}}>
          <div style={{display:'flex', gap:6}}>
            <input className="vt-field" value={f.q} placeholder="Вопрос" style={{fontWeight:700, background:'var(--vt-paper)'}} onChange={(e) => set({ faq: st.faq.map((x, j) => j === i ? { ...x, q:e.target.value } : x) })}/>
            <button aria-label="Удалить вопрос" onClick={() => set({ faq: st.faq.filter((_, j) => j !== i) })} className="vt-btn vt-btn--sm" style={{background:'transparent', padding:'6px 8px'}}><Icon name="trash" size={14}/></button>
          </div>
          {f.a === 'auto:cancel'
            ? <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', lineHeight:1.45, padding:'4px 2px'}}>{d.faqA(f.a)} <span style={{color:'var(--vt-mute-2)'}}>· авто из политики отмены</span></div>
            : <textarea className="vt-field" rows={2} value={f.a} placeholder="Ответ" style={{background:'var(--vt-paper)'}} onChange={(e) => set({ faq: st.faq.map((x, j) => j === i ? { ...x, a:e.target.value } : x) })}/>}
        </div>
      ))}
      <button onClick={() => set({ faq:[...st.faq, { q:'', a:'' }] })} className="vt-btn vt-btn--ghost vt-btn--sm" style={{alignSelf:'flex-start'}}><Icon name="plus" size={13}/> Вопрос</button>
      <div>
        <div className="vt-label">Частые вопросы игроков</div>
        <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
          {[['Есть ли раздевалка и душ?','Уточните у организатора — зависит от зала.'],['Сколько длится игра?','Полтора-два часа, включая разминку.'],['С какого возраста можно?','С 16 лет, младше — с родителями.']].filter(([q]) => !st.faq.some(f => f.q === q)).map(([q, a]) => (
            <button key={q} onClick={() => set({ faq:[...st.faq, { q, a }] })} className="vt-chip" style={{cursor:'pointer', border:0}}>+ {q}</button>
          ))}
        </div>
      </div>
    </>; break;
    case 'team': body = st.team.map((p, i) => (
      <div key={i} style={{display:'flex', flexDirection:'column', gap:6, padding:12, borderRadius:12, background:'var(--vt-ctl)'}}>
        <div style={{display:'flex', gap:6}}>
          <input className="vt-field" value={p.n} style={{background:'var(--vt-paper)', fontWeight:700}} onChange={(e) => set({ team: st.team.map((x, j) => j === i ? { ...x, n:e.target.value } : x) })}/>
          <input className="vt-field" value={p.r} style={{background:'var(--vt-paper)'}} onChange={(e) => set({ team: st.team.map((x, j) => j === i ? { ...x, r:e.target.value } : x) })}/>
        </div>
        <textarea className="vt-field" rows={2} value={p.t} style={{background:'var(--vt-paper)'}} onChange={(e) => set({ team: st.team.map((x, j) => j === i ? { ...x, t:e.target.value } : x) })}/>
      </div>
    )); break;
    case 'gallery': body = <>
      <button onClick={() => nav.toast('Выбор фото')} className="vt-btn vt-btn--ghost vt-btn--sm" style={{alignSelf:'flex-start'}}><Icon name="plus" size={13}/> Загрузить фото</button>
      <SeoHint icon="eye">Подпись к фото обязательна — она станет alt-текстом. Подставим «Волейбол в {d.loc}, {SEO_VENUES[0].name.split(',')[0]}», её можно поправить.</SeoHint>
    </>; break;
    case 'reviews': body = <SeoHint icon="star">Отзыв может оставить только игрок, который был на игре. Перед публикацией вы его проверяете — придуманные отзывы поисковики штрафуют.</SeoHint>; break;
    case 'contacts': body = <>
      <div><label className="vt-label">Telegram-бот</label><div style={{padding:'10px 12px', borderRadius:12, background:'var(--vt-ctl)', fontSize:'var(--fs-sm)'}}>{st.contacts.bot}</div></div>
      <div><label className="vt-label">Канал группы</label><input className="vt-field" value={st.contacts.channel} onChange={(e) => set({ contacts:{ ...st.contacts, channel:e.target.value } })}/></div>
    </>; break;
    case 'text': {
      const t = st.texts[sec.id] || { h:'Новый блок', b:'Текст блока.' };
      body = <>
        <div><label className="vt-label">Заголовок H2</label><input className="vt-field" value={t.h} onChange={(e) => set({ texts:{ ...st.texts, [sec.id]:{ ...t, h:e.target.value } } })}/></div>
        <div><label className="vt-label">Текст</label><textarea className="vt-field" rows={5} value={t.b} onChange={(e) => set({ texts:{ ...st.texts, [sec.id]:{ ...t, b:e.target.value } } })}/></div>
        <SeoHint>Хорошо работают тексты про район, парковку, как найти вход в зал.</SeoHint>
      </>;
    } break;
  }
  return <div style={{display:'flex', flexDirection:'column', gap:14}}>{head}{!sec.on && <SeoHint icon="eye">Секция скрыта — на странице её не видно.</SeoHint>}{body}</div>;
};

// ---------- Инспектор: SEO ----------

// Город из каталога районных центров (24.1.2): ≈120 городов, поиск и группы по областям
const SeoCityPicker = ({ value, onPick, initialOpen = false }) => {
  const [open, setOpen] = React.useState(initialOpen);
  const [q, setQ] = React.useState('');
  const box = React.useRef();
  React.useEffect(() => {
    if (!open) return;
    const out = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', out); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc); };
  }, [open]);
  const norm = (x) => x.toLowerCase().replace(/ё/g, 'е');
  const regions = (window.MOD_REGIONS || SEO_CITIES.map(c => [c[0], [c[0]]]))
    .map(([r, list]) => [r, list.filter(c => !q || norm(c).includes(norm(q)))])
    .filter(([, list]) => list.length);
  const total = (window.MOD_REGIONS || []).reduce((n, [, l]) => n + l.length, 0) || SEO_CITIES.length;
  const pick = (c) => { onPick(c); setOpen(false); setQ(''); };
  return (
    <div ref={box} style={{position:'relative'}}>
      <button aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(o => !o)} className="vt-field" style={{display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', textAlign:'left', width:'100%'}}>
        {value}<Icon name="chevron-d" size={14}/>
      </button>
      {open && (
        <div role="listbox" aria-label="Город" style={{position:'absolute', zIndex:30, top:'calc(100% + 6px)', left:0, width:300, background:'var(--vt-paper)', borderRadius:14, boxShadow:'0 12px 32px rgba(14,14,16,.18), 0 0 0 1px var(--vt-bone-2)', padding:8}}>
          <div style={{position:'relative'}}>
            <span style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--vt-mute-2)', display:'flex'}}><Icon name="search" size={14}/></span>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Найти среди ${total} городов`} aria-label="Поиск города" className="vt-field" style={{paddingLeft:30}}/>
          </div>
          <div style={{maxHeight:280, overflowY:'auto', marginTop:6}}>
            {regions.length === 0 && <div style={{padding:'14px 8px', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>Такого районного центра нет в каталоге. Проверьте написание или выберите ближайший город.</div>}
            {regions.map(([r, list]) => (
              <div key={r}>
                <div className="vt-cap" style={{color:'var(--vt-mute-2)', padding:'8px 8px 4px'}}>{r === 'Минск' ? 'Минск' : r + ' обл.'}</div>
                {list.map(c => (
                  <button key={c} role="option" aria-selected={c === value} onClick={() => pick(c)} style={{display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', minHeight:36, padding:'0 8px', borderRadius:8, cursor:'pointer', textAlign:'left', fontSize:'var(--fs-sm)', fontWeight: c === value ? 600 : 400, background: c === value ? 'var(--vt-bone)' : 'transparent'}}>
                    <span>{c}</span>
                    <span style={{display:'flex', alignItems:'center', gap:6, fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>/{seoCity(c)[1]}{c === value && <Icon name="check" size={14}/>}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SeoMetaInspector = ({ st, set, s, d, nav }) => {
  const off = !d.isPublic;
  return (
    <div style={{display:'flex', flexDirection:'column', gap:16}}>
      {off && <div style={{padding:12, borderRadius:12, background:'var(--vt-paper)', display:'flex', gap:10}}>
        <Icon name="lock" size={16}/>
        <div style={{fontSize:'var(--fs-xs)', lineHeight:1.45, color:'var(--vt-ink-3)'}}>Индексация выключена — поисковики эти поля не увидят. Настройки сохранятся и заработают, когда включите индексацию.</div>
      </div>}
      <div>
        <div className="vt-label">Как страница выглядит в выдаче</div>
        <div style={{padding:14, borderRadius:14, background:'var(--vt-paper)', opacity: off ? .55 : 1}}>
          <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{d.url.replace(/\//g, ' › ')}</div>
          <div style={{fontSize:'var(--fs-base)', fontWeight:600, color:'var(--vt-flame-ink)', marginTop:4, lineHeight:1.3}}>{d.title.length > 60 ? d.title.slice(0, 58) + '…' : d.title}</div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', marginTop:4, lineHeight:1.45}}>{d.desc.length > 160 ? d.desc.slice(0, 158) + '…' : d.desc}</div>
          {seoOn(st,'schedule') && <div style={{display:'flex', gap:6, flexWrap:'wrap', marginTop:8}}>
            {(VT_EVENTS || []).filter(e => !e.past).slice(0, 3).map(e => <span key={e.id} className="vt-chip" style={{fontSize:'var(--fs-2xs)'}}>{e.dow[0] + e.dow.slice(1).toLowerCase()} {e.dnum} {e.month} · {e.t}</span>)}
          </div>}
        </div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:8}}>
        <div>
          <label className="vt-label">Город</label>
          <SeoCityPicker value={d.city} onPick={(c) => { setSetting('city', c); setSeo({ slug: 'vt-' + seoCity(c)[1], district:null }); nav.toast(`Город — ${c}. H1, title и адрес обновлены`); }}/>
        </div>
        <div>
          <label className="vt-label">Район</label>
          <input className="vt-field" value={d.district} onChange={(e) => set({ district:e.target.value })}/>
        </div>
      </div>
      <div>
        <label className="vt-label">Адрес страницы</label>
        <div style={{display:'flex'}}>
          <div className="vt-field" style={{width:'auto', flexShrink:0, borderRadius:'var(--r-field) 0 0 var(--r-field)', color:'var(--vt-mute-2)', fontSize:'var(--fs-xs)', paddingRight:4}}>…/{d.slug}/</div>
          <input className="vt-field" value={st.slug} style={{borderRadius:'0 var(--r-field) var(--r-field) 0', paddingLeft:2}} onChange={(e) => set({ slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}/>
        </div>
        <div style={{marginTop:6}}><SeoHint icon="link">Город в адресе помогает в локальном поиске. Старый адрес автоматически перенаправит сюда (301).</SeoHint></div>
      </div>
      <div>
        <label className="vt-label">Поисковые запросы</label>
        <div style={{display:'flex', flexDirection:'column', gap:6}}>
          {d.kws.map((k, i) => {
            const hits = [['H1', d.h1], ['title', d.title], ['описание', d.desc]].filter(([, t]) => seoHas(t, k)).map(([n]) => n);
            return (
              <div key={i} style={{padding:'8px 10px', borderRadius:12, background:'var(--vt-paper)', display:'flex', alignItems:'center', gap:8}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{k}</div>
                  <div style={{fontSize:'var(--fs-2xs)', color: hits.length ? 'var(--vt-grass-ink)' : 'var(--vt-amber-ink)'}}>{hits.length ? 'есть в: ' + hits.join(', ') : 'нигде не встречается — добавьте в текст'}</div>
                </div>
                <button aria-label="Убрать запрос" onClick={() => set({ keywords: st.keywords.filter((_, j) => j !== i) })} className="vt-btn vt-btn--sm" style={{background:'transparent', padding:'4px 6px'}}><Icon name="close" size={13}/></button>
              </div>
            );
          })}
          <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
            {['волейбол {город} для начинающих','пляжный волейбол {город}','волейбол {город} взрослые'].filter(k => !st.keywords.includes(k)).map(k => (
              <button key={k} onClick={() => set({ keywords:[...st.keywords, k] })} className="vt-chip" style={{cursor:'pointer', border:0}}>+ {k.replace('{город}', d.city.toLowerCase())}</button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}><label className="vt-label">Title</label><SeoCount n={d.title.length} max={60}/></div>
        <SeoSeg value={st.titleAuto ? 'auto' : 'own'} options={[['auto','Авто'],['own','Свой']]} onChange={(v) => set({ titleAuto: v === 'auto', title: st.title || d.title })}/>
        {!st.titleAuto && <input className="vt-field" style={{marginTop:8}} value={st.title} onChange={(e) => set({ title:e.target.value })}/>}
      </div>
      <div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}><label className="vt-label">Description</label><SeoCount n={d.desc.length} min={110} max={160}/></div>
        <SeoSeg value={st.descAuto ? 'auto' : 'own'} options={[['auto','Авто'],['own','Свой']]} onChange={(v) => set({ descAuto: v === 'auto', desc: st.desc || d.desc })}/>
        {!st.descAuto && <textarea className="vt-field" rows={3} style={{marginTop:8}} value={st.desc} onChange={(e) => set({ desc:e.target.value })}/>}
      </div>
      <div>
        <div className="vt-label">Разметка Schema.org · собирается сама</div>
        <div style={{display:'flex', flexDirection:'column', gap:4}}>
          {seoSchema(st, d).map(([t, x, on]) => (
            <div key={t} style={{display:'flex', alignItems:'center', gap:8, fontSize:'var(--fs-xs)', padding:'4px 0', opacity: on && !off ? 1 : .5}}>
              <Icon name={on ? 'check' : 'close'} size={13} stroke={on ? 'var(--vt-grass-ink)' : 'var(--vt-icon-idle)'}/>
              <span className="vt-code" style={{fontWeight:600}}>{t}</span><span style={{color:'var(--vt-mute-2)'}}>{on ? x : 'секция выключена'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------- Инспектор: проверка ----------
const SeoAudit = ({ st, s, d, nav }) => {
  const checks = seoChecks(st, s, d);
  return (
    <div style={{display:'flex', flexDirection:'column', gap:14}}>
      <div style={{display:'flex', flexDirection:'column', gap:6}}>
        {checks.map((c, i) => {
          const tone = c.ok ? 'grass' : c.soft ? 'amber' : c.hard ? 'state' : 'rose';
          return (
            <div key={i} style={{display:'flex', gap:10, padding:'10px 12px', borderRadius:12, background:'var(--vt-paper)'}}>
              <span style={{width:20, height:20, borderRadius:'var(--r-pill)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background: c.ok ? 'var(--vt-grass)' : tone === 'amber' ? 'var(--vt-amber)' : tone === 'state' ? 'var(--vt-ink)' : 'var(--vt-rose)', color:'var(--vt-paper)'}}>
                <Icon name={c.ok ? 'check' : tone === 'state' ? 'lock' : 'close'} size={12} sw={2.4}/>
              </span>
              <div style={{minWidth:0}}>
                <div style={{fontSize:'var(--fs-sm)', fontWeight:600}}>{c.t}</div>
                <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', marginTop:2, lineHeight:1.4, overflowWrap:'anywhere'}}>{c.s}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div>
        <div className="vt-label">Что получит поисковик</div>
        <pre className="vt-code" style={{margin:0, padding:12, borderRadius:12, background:'var(--vt-ink)', color:'var(--vt-paper)', fontSize:11, lineHeight:1.6, whiteSpace:'pre-wrap', overflowWrap:'anywhere'}}>
{`<title>${d.title}</title>
<meta name="robots" content="${d.robots}">
<link rel="canonical" href="https://${d.url}">
${d.isPublic ? 'sitemap.xml: страница есть\nкаталог города: группа есть' : 'X-Robots-Tag: noindex\nsitemap.xml: страницы нет\nкаталог города: группы нет'}`}
        </pre>
      </div>
    </div>
  );
};

// ---------- Статус индексации ----------
const SeoIndexStatus = ({ d, nav, st }) => {
  // 24.1.3 · R-06: если root скрыл страницу или поставил noindex — вместо статуса баннер с причиной
  if (window.ModSeoBanner && window.VT_SEO_MOD && window.VT_SEO_MOD !== 'none') return <ModSeoBanner kind={window.VT_SEO_MOD} d={d}/>;
  const toggle = (v) => v
    ? (setSetting('seoIndex', true), nav.toast('Индексация включена · страница отправлена в sitemap.xml'))
    : nav.alert({
        title:'Скрыть страницу от поиска?',
        body:'Страница получит noindex, пропадёт из sitemap.xml и каталога «Волейбол в ' + d.loc + '». Открыть её по ссылке по-прежнему можно. Запись на события это не меняет.',
        confirm:'Скрыть от поиска', danger:true,
        onConfirm: () => { setSetting('seoIndex', false); nav.toast('Страница скрыта от поиска · noindex'); },
      });
  return (
    <div className={'vt-card ' + (d.isPublic ? '' : 'vt-card--warm')} style={{padding:'14px 18px', display:'flex', alignItems:'center', gap:14, marginBottom:16}}>
      <span style={{width:40, height:40, borderRadius:12, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background: d.isPublic ? 'var(--vt-grass)' : 'var(--vt-ink)', color:'var(--vt-paper)'}}><Icon name={d.isPublic ? 'globe' : 'eye'} size={18}/></span>
      <div style={{flex:1, minWidth:0}}>
        <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
          <span style={{fontSize:'var(--fs-base)', fontWeight:700}}>{d.isPublic ? 'Страница индексируется — её находят в поиске' : 'Страница скрыта от поиска'}</span>
          <span className="vt-code" style={{fontSize:'var(--fs-2xs)', padding:'2px 8px', borderRadius:'var(--r-pill)', background:'var(--vt-ctl)'}}>{d.robots}</span>
        </div>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:3}}>
          {d.isPublic
            ? `Есть в sitemap.xml и в каталоге «Волейбол в ${d.loc}» · опубликовано ${st.publishedAt}`
            : 'Открывается по прямой ссылке. Нет в sitemap.xml и каталоге города, ИИ-поиску не отдаётся.'}
          {' · '}Запись: {d.invite ? 'по приглашению' : 'свободная'} — <a onClick={() => nav.reset('settings')} style={{color:'var(--vt-flame-ink)', cursor:'pointer', fontWeight:600}}>в настройках</a>
        </div>
      </div>
      <span style={{fontSize:'var(--fs-sm)', fontWeight:600}}>Индексировать</span>
      <SeoSwitch on={d.isPublic} onChange={toggle} label="Индексировать страницу группы"/>
    </div>
  );
};

// ---------- Экран конструктора ----------
const WebSeoBuilder = () => {
  const nav = useNav();
  const [st, set] = useSeoState();
  const [s] = useGroupSettings();
  const d = seoDerive(st, s);
  const [sel, setSel] = React.useState('hero');
  const [tab, setTab] = React.useState('section');
  const [device, setDevice] = React.useState('desktop');
  const [drag, setDrag] = React.useState(null);
  const addRef = React.useRef();
  const checks = seoChecks(st, s, d);
  const passed = checks.filter(c => c.ok).length;
  const secObj = st.order.find(x => x.id === sel);

  const move = (from, to) => {
    if (to < 0 || to >= st.order.length || from === to) return;
    const o = [...st.order]; const [x] = o.splice(from, 1); o.splice(to, 0, x); set({ order:o });
  };
  const pick = (id) => { setSel(id); setTab('section'); };
  const addSection = () => {
    const free = Object.entries(SEO_SECTION_TYPES).filter(([k, v]) => v.multi || !st.order.some(x => x.type === k));
    nav.popover({ anchor: addRef.current, align:'left', items: free.map(([k, v]) => ({ icon:v.icon, label:v.t, sub:v.d, onClick: () => {
      const id = v.multi ? `${k}-${Date.now() % 100000}` : k;
      set({ order:[...st.order, { id, type:k, on:true }] }); pick(id); nav.toast(`Добавлено · ${v.t}`);
    } })) });
  };
  const publish = () => { seoPublish(); nav.toast(d.isPublic ? 'Опубликовано · sitemap обновлён, поисковики получат сигнал' : 'Сохранено · страница доступна по ссылке, в поиск не попадёт'); };

  return (
    <WebShell activeNav="seo" title="Страница группы" sub={`SEO-страница для поиска · ${d.url}`}
      topRight={<>
        {st.dirty && <span className="vt-chip vt-chip--amber">есть неопубликованные изменения</span>}
        <button onClick={() => nav.push('seo-preview', { device })} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="eye" size={14}/> Предпросмотр</button>
        <button onClick={publish} disabled={!st.dirty} className="vt-btn vt-btn--primary vt-btn--sm">{d.isPublic ? 'Опубликовать' : 'Сохранить'}</button>
      </>}>
      <SeoIndexStatus d={d} nav={nav} st={st}/>
      <div style={{display:'grid', gridTemplateColumns:'236px minmax(0,1fr) 330px', gap:16, height:640}}>
        {/* Секции */}
        <div className="vt-card" style={{padding:12, display:'flex', flexDirection:'column', gap:4, overflow:'auto'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'2px 4px 8px'}}>
            <span style={{fontSize:'var(--fs-sm)', fontWeight:700}}>Секции</span>
            <span style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>{st.order.filter(x => x.on).length} на странице</span>
          </div>
          {st.order.map((x, i) => {
            const T = SEO_SECTION_TYPES[x.type];
            const on = sel === x.id;
            const title = x.type === 'text' ? ((st.texts[x.id] || {}).h || T.t) : T.t;
            return (
              <div key={x.id} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { move(drag, i); setDrag(null); }}
                onClick={() => pick(x.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') pick(x.id); }}
                style={{display:'flex', alignItems:'center', gap:8, padding:'8px 8px', borderRadius:12, cursor:'pointer',
                  background: on ? 'var(--vt-paper)' : 'transparent', boxShadow: on ? 'var(--vt-shadow-card)' : 'none', opacity: x.on ? 1 : .55, outline: drag === i ? '2px dashed var(--vt-hairline)' : 'none'}}>
                <span style={{display:'flex', cursor:'grab'}} aria-hidden="true"><Icon name="grip" size={14} stroke="var(--vt-icon-idle)"/></span>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:'var(--fs-sm)', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{title}</div>
                  <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{T.req ? 'обязательная · ' : ''}{T.src}</div>
                </div>
                {on && <div style={{display:'flex', gap:2}}>
                  <button aria-label="Выше" onClick={(e) => { e.stopPropagation(); move(i, i - 1); }} className="vt-btn vt-btn--sm" style={{padding:'3px 4px', background:'transparent'}}><Icon name="arrow-u" size={12}/></button>
                  <button aria-label="Ниже" onClick={(e) => { e.stopPropagation(); move(i, i + 1); }} className="vt-btn vt-btn--sm" style={{padding:'3px 4px', background:'transparent'}}><Icon name="arrow-d" size={12}/></button>
                </div>}
                {T.req ? <span style={{width:36}}/> : <SeoSwitch on={x.on} label={`Показывать «${title}»`} onChange={(v) => set({ order: st.order.map(y => y.id === x.id ? { ...y, on:v } : y) })}/>}
              </div>
            );
          })}
          <button ref={addRef} onClick={addSection} className="vt-btn vt-btn--ghost vt-btn--sm" style={{marginTop:8}}><Icon name="plus" size={13}/> Добавить секцию</button>
        </div>

        {/* Предпросмотр */}
        <div style={{display:'flex', flexDirection:'column', gap:10, minWidth:0}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <SeoSeg value={device} options={[['desktop','Десктоп'],['mobile','Телефон']]} onChange={setDevice}/>
            <span style={{flex:1, minWidth:0, fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Кликните по блоку, чтобы его настроить</span>
          </div>
          <div style={{flex:1, overflow:'auto', borderRadius:'var(--r-card)', background:'var(--vt-bone)', padding:16}}>
            <SeoScaled designW={device === 'desktop' ? 1120 : 390}>
              {(sc) => <SeoPublicPage mode={device} sel={sel} onSel={pick} ring={Math.max(2, Math.round(2.5 / sc))}/>}
            </SeoScaled>
          </div>
        </div>

        {/* Инспектор */}
        <div className="vt-card" style={{padding:14, display:'flex', flexDirection:'column', gap:14, overflow:'hidden'}}>
          <div style={{display:'flex', gap:2, padding:3, background:'var(--vt-paper)', borderRadius:'var(--r-chip)'}}>
            {[['section','Секция'],['seo','SEO'],['audit',`Проверка · ${passed}/${checks.length}`]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className="vt-btn vt-btn--sm" style={{flex:1, padding:'6px 6px', background: tab === k ? 'var(--vt-ink)' : 'transparent', color: tab === k ? 'var(--vt-paper)' : 'var(--vt-ink)', fontWeight: tab === k ? 700 : 500}}>{l}</button>
            ))}
          </div>
          <div style={{flex:1, overflow:'auto', margin:'0 -4px', padding:'0 4px'}}>
            {tab === 'section' && <SeoSectionInspector sec={secObj} st={st} set={set} s={s} d={d} nav={nav}/>}
            {tab === 'seo' && <SeoMetaInspector st={st} set={set} s={s} d={d} nav={nav}/>}
            {tab === 'audit' && <SeoAudit st={st} s={s} d={d} nav={nav}/>}
          </div>
        </div>
      </div>
    </WebShell>
  );
};

// ---------- Полный предпросмотр страницы ----------
const WebSeoPreview = () => {
  const nav = useNav();
  const [st] = useSeoState();
  const [s] = useGroupSettings();
  const d = seoDerive(st, s);
  const [device, setDevice] = React.useState(nav.data.device || 'desktop');
  return (
    <div style={{height:'100%', overflow:'auto', background:'var(--vt-bone)'}}>
      <div style={{position:'sticky', top:0, zIndex:5, display:'flex', alignItems:'center', gap:12, padding:'12px 24px', background:'var(--vt-paper)', boxShadow:'0 1px 0 var(--vt-bone-2)'}}>
        <button onClick={() => nav.back()} className="vt-btn vt-btn--ghost vt-btn--sm"><Icon name="chevron-l" size={14}/> К конструктору</button>
        <span style={{fontSize:'var(--fs-sm)', fontWeight:600}}>Предпросмотр</span>
        <span className="vt-code" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{d.url}</span>
        <span style={{flex:1}}/>
        <span className={'vt-chip ' + (d.isPublic ? 'vt-chip--grass' : 'vt-chip--state')}><Icon name={d.isPublic ? 'globe' : 'lock'} size={12}/>{d.robots}</span>
        <SeoSeg value={device} options={[['desktop','Десктоп'],['mobile','Телефон']]} onChange={setDevice}/>
      </div>
      <div style={{padding:'24px 0 48px'}}>
        <div style={{maxWidth: device === 'desktop' ? 1200 : 390, margin:'0 auto', borderRadius:20, overflow:'hidden', boxShadow:'var(--vt-shadow-card)'}}>
          <SeoPublicPage mode={device} interactive/>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { WebSeoBuilder, WebSeoPreview });
