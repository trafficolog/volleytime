// Кабинет · Настройки → Команда (W-17): роли в группе, тренеры, право принимать оплату
const ROLE_RU = { owner:'Владелец', organizer:'Организатор', coach:'Тренер', player:'Игрок', guest:'Гость' };
const ROLE_TONE = {
  owner:['var(--vt-ink)','var(--vt-paper)'], organizer:['var(--vt-flame)','var(--vt-on-hero)'],
  coach:['var(--vt-grass-soft)','var(--vt-grass-ink)'], player:['var(--vt-bone)','var(--vt-ink)'], guest:['var(--vt-bone-2)','var(--vt-ink)']
};
const RoleChip = ({ role }) => (
  <span className="vt-chip" style={{fontSize:'var(--fs-2xs)', background:ROLE_TONE[role][0], color:ROLE_TONE[role][1], borderColor:'transparent'}}>{ROLE_RU[role]}</span>
);

const TeamSwitch = ({ on, onChange, label }) => (
  <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} style={{
    width:40, height:24, borderRadius:'var(--r-pill)', padding:2, cursor:'pointer', flexShrink:0,
    background: on ? 'var(--vt-grass)' : 'var(--vt-stroke-2)', display:'flex', justifyContent: on ? 'flex-end' : 'flex-start'
  }}>
    <span style={{width:20, height:20, borderRadius:'var(--r-pill)', background:'var(--vt-paper)'}}/>
  </button>
);

const TEAM_INIT = [
  { id:1, name:'Иван Петренко', init:'ИП', tag:'ink', roles:['owner','player'], leads:'все события', pay:'always' },
  { id:2, name:'Анна Сидорова', init:'АС', tag:'flame', roles:['organizer'], leads:'—', pay:'always' },
  { id:3, name:'Ольга Романова', init:'ОР', tag:'grass', roles:['coach','player'], leads:'Основа · Ср, Пт', pay:true },
  { id:4, name:'Дмитрий Ковалёв', init:'ДК', tag:'amber', roles:['coach'], leads:'Микст · Вс', pay:false },
];

const TEAM_MATRIX = [
  ['Состав и посещаемость', '●', '●', '●'],
  ['Приём и подтверждение оплаты', '●', '●', 'если разрешено'],
  ['События и серии', '●', '●', '—'],
  ['Игроки и приглашения', '●', '●', '—'],
  ['Касса, сборы, абонементы, отчёты', '●', '●', '—'],
  ['Баланс событий и оплата платформы', '●', '—', '—'],
  ['Настройки, роли, страница группы', '●', '—', '—'],
];

const WebTeamSettings = () => {
  const nav = useNav();
  const [team, setTeam] = React.useState(TEAM_INIT);
  const setPay = (id, v) => {
    const p = team.find(x => x.id === id);
    setTeam(t => t.map(x => x.id === id ? { ...x, pay:v } : x));
    nav.toast(v ? `${p.name} принимает оплату · подтверждения пойдут в кассу с её именем` : `${p.name} больше не принимает оплату`);
  };
  const cols = 'minmax(0,1.6fr) minmax(0,1.2fr) minmax(0,1.2fr) 150px 40px';
  return (
    <div style={{display:'flex', flexDirection:'column', gap:18}}>
      <div className="vt-card" style={{padding:22}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16}}>
          <div>
            <h3 style={{fontSize:'var(--fs-md)'}}>Команда</h3>
            <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:4, maxWidth:'60ch'}}>Кто управляет группой и ведёт тренировки. Роли действуют только в этой группе. Любой из команды может записываться на игры как игрок.</div>
          </div>
          <button onClick={() => nav.toast('Ссылка-приглашение в команду скопирована · действует 24 ч')} className="vt-btn vt-btn--primary vt-btn--sm" style={{gap:6, flexShrink:0}}><Icon name="plus" size={14}/> Пригласить</button>
        </div>
        <div style={{marginTop:18, borderTop:'1px solid var(--vt-bone-2)'}}>
          <div style={{display:'grid', gridTemplateColumns:cols, gap:12, padding:'10px 0', borderBottom:'1px solid var(--vt-bone-2)'}}>
            {['Человек','Роли','Ведёт','Приём оплаты',''].map((h, i) => <div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>)}
          </div>
          {team.map((p, i) => {
            const isCoach = p.roles.includes('coach') && !p.roles.includes('owner') && !p.roles.includes('organizer');
            return (
              <div key={p.id} style={{display:'grid', gridTemplateColumns:cols, gap:12, padding:'12px 0', alignItems:'center', borderBottom: i < team.length - 1 ? '1px solid var(--vt-bone-2)' : 'none'}}>
                <div style={{display:'flex', alignItems:'center', gap:10, minWidth:0}}>
                  <Avi size="sm" name={p.name} init={p.init} tag={p.tag}/>
                  <span style={{fontSize:'var(--fs-sm)', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{p.name}</span>
                </div>
                <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>{p.roles.map(r => <RoleChip key={r} role={r}/>)}</div>
                <div style={{fontSize:'var(--fs-sm)', color: p.leads === '—' ? 'var(--vt-mute-2)' : 'var(--vt-ink)'}}>{p.leads}</div>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  {isCoach
                    ? <><TeamSwitch on={p.pay} onChange={(v) => setPay(p.id, v)} label={`Приём оплаты · ${p.name}`}/><span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>{p.pay ? 'разрешено' : 'нет'}</span></>
                    : <span style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>по роли</span>}
                </div>
                <ActionMore mode="popover" align="right" items={p.roles.includes('owner') ? [
                  { icon:'edit', label:'Передать владение', onClick: () => nav.toast('Передача владения · в «Опасной зоне»') },
                ] : [
                  { icon:'edit', label: isCoach ? 'Сделать организатором' : 'Сделать тренером', onClick: () => nav.toast(`${p.name} · роль изменена · записано в историю`) },
                  { icon:'calendar', label:'Назначить на серию', onClick: () => nav.toast('Выберите серию в «Событиях»') },
                  '---',
                  { icon:'close', tone:'danger', label:'Убрать из команды', onClick: () => nav.alert({
                    title:`Убрать ${p.name} из команды?`, body:'Человек останется в группе игроком. Назначения на серии снимутся, события останутся без тренера.',
                    confirm:'Убрать', danger:true, onConfirm: () => { setTeam(t => t.filter(x => x.id !== p.id)); nav.toast(`${p.name} теперь игрок`); }
                  })},
                ]}/>
              </div>
            );
          })}
        </div>
      </div>

      <div className="vt-card" style={{padding:22}}>
        <h3 style={{fontSize:'var(--fs-md)'}}>Что доступно роли</h3>
        <div style={{marginTop:14}}>
          <div style={{display:'grid', gridTemplateColumns:'minmax(0,2fr) repeat(3, minmax(0,1fr))', gap:12, padding:'8px 0', borderBottom:'1px solid var(--vt-bone-2)'}}>
            {['','Владелец','Организатор','Тренер'].map((h, i) => <div key={i} className="vt-cap" style={{color:'var(--vt-mute-2)'}}>{h}</div>)}
          </div>
          {TEAM_MATRIX.map(([t, ...v], i) => (
            <div key={t} style={{display:'grid', gridTemplateColumns:'minmax(0,2fr) repeat(3, minmax(0,1fr))', gap:12, padding:'9px 0', borderBottom: i < TEAM_MATRIX.length - 1 ? '1px solid var(--vt-bone-2)' : 'none', fontSize:'var(--fs-sm)'}}>
              <div>{t}</div>
              {v.map((x, j) => <div key={j} style={{color: x === '—' ? 'var(--vt-mute)' : 'var(--vt-ink)', fontSize: x.length > 2 ? 'var(--fs-xs)' : 'var(--fs-sm)'}}>{x}</div>)}
            </div>
          ))}
        </div>
      </div>

      <div className="vt-card" style={{padding:22}}>
        <h3 style={{fontSize:'var(--fs-md)'}}>История изменений</h3>
        <div style={{marginTop:10}}>
          {[
            ['Сегодня 12:10', 'Иван П. разрешил Ольге Р. принимать оплату'],
            ['24 мая 18:02', 'Иван П. назначил Дмитрия К. тренером серии «Микст · Вс»'],
            ['3 мая 09:30', 'Анна С. стала организатором'],
          ].map(([d, t], i) => (
            <div key={i} style={{display:'flex', gap:16, padding:'9px 0', borderBottom: i < 2 ? '1px solid var(--vt-bone-2)' : 'none'}}>
              <span className="vt-mono" style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', width:110, flexShrink:0}}>{d}</span>
              <span style={{fontSize:'var(--fs-sm)'}}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { ROLE_RU, RoleChip, WebTeamSettings });
