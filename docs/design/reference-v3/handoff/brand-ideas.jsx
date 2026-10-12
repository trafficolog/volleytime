// brand-ideas.jsx — паттерны гипотез и Mini App после гипотез в бренд-системе

const IdTile = ({ title, sub, children, pad = 16 }) => {
  const { ctx, sheet, popover, toast, alertCfg } = useNavState('demo');
  return (
    <div style={{display:'flex', flexDirection:'column', gap:10, minWidth:0}}>
      <div>
        <div style={{fontSize:'var(--fs-sm)', fontWeight:700}}>{title}</div>
        {sub && <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', lineHeight:1.5, marginTop:4}}>{sub}</div>}
      </div>
      <NavContext.Provider value={ctx}>
        <div className="vt-phone vt-frame" data-vt-popover-root="" style={{position:'relative', borderRadius:24, overflow:'hidden', background:'var(--vt-paper)', padding:pad, display:'flex', flexDirection:'column', gap:12,
          boxShadow:'0 1px 2px rgba(21,22,26,.06), 0 18px 40px -18px rgba(21,22,26,.28)', minHeight:0}}>
          {children}
          <NavOverlays sheet={sheet} popover={popover} toast={toast} alertCfg={alertCfg} ctx={ctx}/>
        </div>
      </NavContext.Provider>
    </div>
  );
};

const IdGrid = ({ children }) => <div style={{display:'flex', flexWrap:'wrap', gap:28, alignItems:'flex-start'}}>{children}</div>;
const IdTiles = ({ children }) => <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap:24, alignItems:'start'}}>{children}</div>;

const IdRule = ({ items }) => (
  <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12, marginTop:16}}>
    {items.map(([h, p]) => (
      <div key={h} className="vt-card" style={{padding:16}}>
        <div style={{fontSize:'var(--fs-sm)', fontWeight:700}}>{h}</div>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-ink-3)', lineHeight:1.5, marginTop:4}}>{p}</div>
      </div>
    ))}
  </div>
);

const IdChips = () => {
  const [on, setOn] = React.useState('Подача');
  return (
    <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
      {['Подача','Приём','Пас','Нападение'].map(x => <IdeaPick key={x} on={on === x} onClick={() => setOn(x)}>{x}</IdeaPick>)}
    </div>
  );
};

const IdSeg = () => {
  const [v, setV] = React.useState('game');
  return <WSeg v={v} set={setV}/>;
};

const IdGroupDots = () => (
  <div style={{display:'flex', flexDirection:'column', gap:10}}>
    {[['var(--vt-blue-ink)','VolleyTime Минск'],['var(--vt-orange)','МинскВолей · Воскресные'],['var(--vt-grass)','СпайкКлуб']].map(([c, n]) => (
      <div key={n} style={{display:'flex', alignItems:'center', gap:10, fontSize:'var(--fs-sm)'}}><FDot c={c} size={10}/>{n}</div>
    ))}
    <div style={{display:'flex', flexWrap:'wrap', gap:8, marginTop:4}}>
      <span className="vt-chip vt-chip--mine" style={{gap:4}}><Icon name="check" size={12} sw={2.4}/>Иду</span>
      <span className="vt-chip vt-chip--queue" style={{gap:4}}><Icon name="clock" size={12} sw={2.4}/>В очереди · 2-й</span>
      <span className="vt-chip vt-chip--state">есть места</span>
      <span className="vt-chip vt-chip--state">мест нет</span>
      <span className="vt-chip" style={{background:'var(--vt-amber-soft)', color:'var(--vt-amber-ink)'}}>пересечение</span>
    </div>
  </div>
);

const BrandIdeas = () => (
  <div>
    <Sub n={1} title="Мой календарь · все группы">
      <IdGrid>
        <DemoPhone height={780}><MyCalendar/></DemoPhone>
        <div style={{display:'flex', flexDirection:'column', gap:20, flex:'1 1 300px', minWidth:0}}>
          <IdTile title="Цвет группы и статусы записи" sub="У каждой группы свой цвет — точкой в строке и в сетке месяца. Статус записи — те же чипы, что в расписании группы; «пересечение» — янтарный, когда две записи совпали по времени.">
            <IdGroupDots/>
          </IdTile>
          <IdRule items={[
            ['Где живёт', 'Отдельная вкладка «Календарь» в таб-баре игрока во всех вариантах Mini App.'],
            ['Фильтр', '«Только мои» по умолчанию. Тумблер добавляет игры, куда можно записаться, — серыми строками.'],
          ]}/>
        </div>
      </IdGrid>
    </Sub>

    <Sub n={2} title="Главная после гипотез · блоки">
      <IdTiles>
        <IdTile title="Шапка нескольких групп" sub="Стопка логотипов групп вместо одной, имя игрока и счётчик. По тапу — шторка «Мои группы». Справа — чип серии." pad={0}>
          <div style={{padding:'8px 0 16px'}}><FGroupsHead right={<FStreak/>}/></div>
        </IdTile>
        <IdTile title="Ближайшая игра · герой" sub="Время — Oswald крупно, статус «Иду» — белый чип на синем. Ниже место через «занято N из M».">
          <FNextHero/>
        </IdTile>
        <IdTile title="Разминка в составе игры" sub="Нейтральная карточка. После «Пропустить» — голубая с галочкой и кнопкой «Отменить». На синем герое кнопки инвертируются.">
          <FWarmInGame time="21:00"/>
          <FWarmInGame tone="hero" time="21:00"/>
        </IdTile>
        <IdTile title="После игры" sub="Тёплая карточка-приглашение: два равных действия, тёмное — основное.">
          <FPostGame/>
        </IdTile>
        <IdTile title="Полоса недели плана" sub="7 дней, сегодня — белая плитка. Иконки: мяч — игра, точка — тренировка, кольцо — мобильность, галочка — сделано. Легенда всегда под полосой.">
          <div className="vt-card vt-card--cool" style={{padding:14}}><div className="vt-cap" style={{color:'var(--vt-blue-ink)'}}>Тренер · подача · неделя 2</div><FWeekStrip/></div>
        </IdTile>
        <IdTile title="Таб-бар с новой вкладкой" sub="Новая вкладка помечается оранжевой точкой до первого открытия. Максимум 5 вкладок." pad={0}>
          <div style={{height:24}}/>
          <FTabBar active="home" tabs={[['home','Главная','home'],['cal','Календарь','calendar',true],['form','Форма','ball',true],['wallet','Кошелёк','wallet'],['me','Профиль','user']]}/>
        </IdTile>
      </IdTiles>
    </Sub>

    <Sub n={3} title="Контролы гипотез">
      <IdTiles>
        <IdTile title="Сегмент-пилюля" sub="Два варианта, активный — белая пилюля с тенью на сером треке. Используется для режимов («Своя / В составе игры», «Месяц / Сезон»).">
          <IdSeg/>
        </IdTile>
        <IdTile title="Чипы выбора" sub="Ответы агенту и фильтры: активный — ink, остальные — серый тон контрола. Высота 40, тап-зона не меньше 44 с отступом.">
          <IdChips/>
        </IdTile>
        <IdTile title="Радар навыков" sub="6 осей, текущий период — заливка синим, прошлый — контур. Подписи осей — Golos 12, значения — Oswald.">
          <div style={{display:'flex', justifyContent:'center'}}><IdeaRadar a={[2.8,3.6,3.2,3.4,2.6,3.5]} b={[2.5,3.2,3.2,3.3,2.6,3.1]} size={240}/></div>
        </IdTile>
      </IdTiles>
    </Sub>

    <Sub n={4} title="Экран события с программой">
      <IdGrid>
        <DemoPhone height={720}><WarmupEventDemo/></DemoPhone>
        <div style={{flex:'1 1 300px', minWidth:0}}>
          <IdRule items={[
            ['Программа события', 'Строка: время Oswald 44 px · пункт · чип справа. Пункт, который ведёт организатор, — жирный с чипом «в игре».'],
            ['Пропуск', 'Пропущенный пункт зачёркивается и бледнеет, чип меняется на «пропущена». Действие обратимо — без подтверждения.'],
            ['Демо-переключатель', 'Подпись над сегментом объясняет, что это настройка организатора, а не выбор игрока.'],
          ]}/>
        </div>
      </IdGrid>
    </Sub>
  </div>
);

const WarmupEventDemo = () => {
  const [m, setM] = React.useState('game');
  return <WarmupEvent mode={m} setMode={setM} onStart={() => {}}/>;
};

Object.assign(window, { BrandIdeas });
