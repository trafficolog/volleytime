// screens-auth.jsx — Авторизация: Web SaaS + Mini App, все состояния

const AuthShell = ({ children, footer }) => (
  <div style={{height:'100%', display:'flex', flexDirection:'column', background:'var(--vt-paper)'}}>
    <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 28px'}}>
      <div style={{width:'100%', maxWidth:360}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:26}}>
          <span className="vt-ball" style={{fontSize:'var(--fs-2xl)'}}/>
          <span style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, letterSpacing:0, fontSize:'var(--fs-xl)'}}>Volley<span style={{color:'var(--vt-flame-ink)'}}>Time</span></span>
        </div>
        {children}
      </div>
    </div>
    <div style={{padding:'14px 28px', background:'var(--vt-bone)', display:'flex', justifyContent:'space-between', fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>
      <span>{footer || 'volleytime.by'}</span>
      <span style={{display:'flex', gap:14}}><a href="#" style={{color:'var(--vt-mute-2)', textDecoration:'none'}}>Помощь</a><a href="#" style={{color:'var(--vt-mute-2)', textDecoration:'none'}}>Условия</a></span>
    </div>
  </div>
);

const H = ({ t, s }) => (
  <div style={{marginBottom:20}}>
    <h1 style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, letterSpacing:0, fontSize:'var(--fs-4xl)', lineHeight:1}}>{t}</h1>
    {s && <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:8, lineHeight:1.45}}>{s}</div>}
  </div>
);

const TgButton = ({ onClick, label = 'Войти через Telegram' }) => (
  <button onClick={onClick} className="vt-btn vt-btn--lg vt-btn--full" style={{background:'var(--vt-tg-blue)', color:'var(--vt-on-accent)', gap:10}}>
    <Icon name="tg" size={17}/> {label}
  </button>
);

const Divider = ({ label = 'или' }) => (
  <div style={{display:'flex', alignItems:'center', gap:12, margin:'18px 0'}}>
    <span style={{flex:1, height:1, background:'var(--vt-bone-2)'}}/>
    <span style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute)', fontWeight:600}}>{label}</span>
    <span style={{flex:1, height:1, background:'var(--vt-bone-2)'}}/>
  </div>
);

const Spinner = ({ size = 18, color = 'currentColor' }) => (
  <span style={{width:size, height:size, borderRadius:'50%', border:`2px solid ${color}`, borderTopColor:'transparent', display:'inline-block', animation:'vt-spin .7s linear infinite'}}/>
);

const Banner = ({ tone = 'rose', icon = 'close', title, body }) => (
  <div className="vt-card" style={{padding:'12px 14px', display:'flex', gap:12, alignItems:'flex-start', marginBottom:16,
    border:0, borderRadius:'var(--r-tile)',
    background: tone==='rose'?'var(--vt-rose-soft)':tone==='amber'?'var(--vt-amber-soft)':'var(--vt-grass-soft)'}}>
    <Icon name={icon} size={17} stroke={tone==='rose'?'var(--vt-rose-ink)':tone==='amber'?'var(--vt-amber-ink)':'var(--vt-grass-ink)'}/>
    <div style={{flex:1}}>
      <div style={{fontSize:'var(--fs-base)', fontWeight:700, color: tone==='rose'?'var(--vt-rose-ink)':tone==='amber'?'var(--vt-amber-ink)':'var(--vt-grass-ink)'}}>{title}</div>
      {body && <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:4, lineHeight:1.4}}>{body}</div>}
    </div>
  </div>
);

const OtpBoxes = ({ value = '', error }) => (
  <div style={{display:'flex', gap:8}}>
    {Array.from({length:6}).map((_,i) => (
      <div key={i} style={{flex:1, aspectRatio:'1/1.15', borderRadius:'var(--r-btn)', display:'flex', alignItems:'center', justifyContent:'center',
        border:0,
        background: error ? 'var(--vt-rose-soft)' : value[i] ? 'var(--vt-paper)' : 'var(--vt-bone)',
        boxShadow: !error && value[i] ? 'var(--vt-shadow-card)' : (i === value.length && !error ? 'inset 0 0 0 2px var(--vt-flame)' : 'none'),
        fontFamily:'var(--f-num)', fontWeight:700, fontSize:'var(--fs-2xl)',
        color: error ? 'var(--vt-rose-ink)' : 'var(--vt-ink)'}}>
        {value[i] || ''}
      </div>
    ))}
  </div>
);

// ============================================================
// WEB · состояния авторизации
// ============================================================

const AuthWebStart = ({ onEmail, onTg }) => (
  <AuthShell>
    <H t="Кабинет организатора" s="Войдите тем же аккаунтом, которым пользуетесь в Telegram-боте."/>
    <TgButton onClick={onTg}/>
    <Divider/>
    <label className="vt-label">Email</label>
    <input className="vt-field" placeholder="ivan@example.com"/>
    <button onClick={onEmail} className="vt-btn vt-btn--ink vt-btn--lg vt-btn--full" style={{marginTop:10}}>Получить код</button>
    <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:16, lineHeight:1.45}}>
      Нет организации? Создайте её в боте <span className="vt-mono" style={{color:'var(--vt-ink)'}}>@volleytime_bot</span> — займёт минуту.
    </div>
  </AuthShell>
);

const AuthWebOtp = ({ onBack, onSubmit }) => (
  <AuthShell>
    <button onClick={onBack} className="vt-btn vt-btn--ghost vt-btn--sm" style={{marginBottom:14, gap:6, padding:'6px 10px'}}><Icon name="chevron-l" size={13}/> Назад</button>
    <H t="Введите код" s={<>Отправили 6 цифр на <b style={{color:'var(--vt-ink)'}}>ivan@example.com</b>. Код живёт 10 минут.</>}/>
    <OtpBoxes value="4271"/>
    <button onClick={onSubmit} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full" style={{marginTop:16}}>Войти</button>
    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14, fontSize:'var(--fs-xs)'}}>
      <span style={{color:'var(--vt-mute-2)'}}>Не пришёл код?</span>
      <span className="vt-mono" style={{color:'var(--vt-mute-2)'}}>Повтор через 0:42</span>
    </div>
  </AuthShell>
);

const AuthWebOtpError = ({ onBack }) => (
  <AuthShell>
    <button onClick={onBack} className="vt-btn vt-btn--ghost vt-btn--sm" style={{marginBottom:14, gap:6, padding:'6px 10px'}}><Icon name="chevron-l" size={13}/> Назад</button>
    <H t="Введите код"/>
    <Banner tone="rose" icon="close" title="Неверный код" body="Осталось 2 попытки, потом код придётся запросить заново."/>
    <OtpBoxes value="427193" error/>
    <button className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full" style={{marginTop:16}}>Попробовать снова</button>
    <button className="vt-btn vt-btn--ghost vt-btn--full" style={{marginTop:8}}>Отправить новый код</button>
  </AuthShell>
);

const AuthWebLoading = () => (
  <AuthShell>
    <H t="Проверяем вход" s="Секунду — сверяем код и подтягиваем ваши организации."/>
    <div className="vt-card vt-card--raised" style={{padding:'20px', display:'flex', alignItems:'center', gap:14}}>
      <Spinner size={22} color="var(--vt-flame)"/>
      <div style={{fontSize:'var(--fs-sm)', fontWeight:500}}>Авторизация…</div>
    </div>
    <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:16}}>
      {[['check','Код подтверждён',true],['check','Аккаунт найден',true],['clock','Загрузка организаций',false]].map(([ic,l,done],i) => (
        <div key={i} style={{display:'flex', alignItems:'center', gap:10, fontSize:'var(--fs-sm)', color: done?'var(--vt-ink)':'var(--vt-mute-2)'}}>
          {done ? <Icon name="check" size={14} stroke="var(--vt-grass)" sw={2.4}/> : <Spinner size={13} color="var(--vt-mute)"/>}
          {l}
        </div>
      ))}
    </div>
  </AuthShell>
);

const AuthWebOrgPick = ({ onPick }) => (
  <AuthShell>
    <H t="Выберите организацию" s="Вы состоите в нескольких — можно переключаться в любой момент."/>
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      {[['VolleyTime Минск','Владелец · 14 игроков','ink'],['СпайкКлуб','Организатор · 22 игрока','flame']].map(([n,r,t],i) => (
        <button key={i} onClick={onPick} className="vt-card vt-card--raised" style={{padding:'14px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', textAlign:'left'}}>
          <span className={`vt-avi vt-avi--${t}`} style={{width:34, height:34, fontSize:'var(--fs-xs)'}}>{n.slice(0,2).toUpperCase()}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>{n}</div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>{r}</div>
          </div>
          <Icon name="chevron-r" size={16} stroke="var(--vt-icon-idle)"/>
        </button>
      ))}
    </div>
    <Divider label="или"/>
    <button className="vt-btn vt-btn--ghost vt-btn--full" style={{gap:8}}><Icon name="plus" size={15}/> Создать новую организацию</button>
  </AuthShell>
);

const AuthWebNoAccess = () => (
  <AuthShell>
    <H t="Нет доступа к кабинету"/>
    <Banner tone="amber" icon="user" title="Вы игрок, не организатор" body="Веб-кабинет доступен владельцам и организаторам групп."/>
    <div className="vt-card vt-card--cool" style={{padding:16, display:'flex', flexDirection:'column', gap:12}}>
      <div style={{fontSize:'var(--fs-sm)', lineHeight:1.5, color:'var(--vt-ink-3)'}}>
        Записываться на тренировки, смотреть состав и абонементы удобнее в Mini App — прямо в Telegram.
      </div>
      <TgButton label="Открыть Mini App"/>
    </div>
    <button className="vt-btn vt-btn--ghost vt-btn--full" style={{marginTop:10}}>Войти другим аккаунтом</button>
  </AuthShell>
);

const AuthWebBlocked = () => (
  <AuthShell>
    <H t="Доступ приостановлен"/>
    <Banner tone="rose" icon="logout" title="Организация заблокирована" body="Обратитесь в поддержку платформы — расскажем причину и что делать."/>
    <div className="vt-card" style={{padding:16}}>
      <div style={{display:'grid', gridTemplateColumns:'auto 1fr', columnGap:12, rowGap:8, fontSize:'var(--fs-sm)'}}>
        <span style={{color:'var(--vt-mute-2)'}}>Организация</span><span style={{fontWeight:600}}>MinskVolley.PRO</span>
        <span style={{color:'var(--vt-mute-2)'}}>Дата</span><span className="vt-mono">14 сентября 2026</span>
        <span style={{color:'var(--vt-mute-2)'}}>Тикет</span><span className="vt-mono" style={{color:'var(--vt-flame-ink)'}}>#SUP-0184</span>
      </div>
    </div>
    <button className="vt-btn vt-btn--ink vt-btn--lg vt-btn--full" style={{marginTop:12, gap:8}}><Icon name="tg" size={16}/> Написать в поддержку</button>
  </AuthShell>
);

// ============================================================
// MINI APP · состояния авторизации
// ============================================================

const AuthMiniSplash = () => (
  <>
    <StatusBar time="19:24"/>
    <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:18, padding:24}}>
      <div style={{width:84, height:84, borderRadius:'var(--r-card)', background:'var(--vt-on-hero)', boxShadow:'var(--vt-shadow-card)', display:'flex', alignItems:'center', justifyContent:'center'}}>
        <span className="vt-ball" style={{fontSize:'var(--fs-5xl)'}}/>
      </div>
      <div style={{textAlign:'center'}}>
        <div style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, letterSpacing:0, fontSize:'var(--fs-2xl)'}}>Volley<span style={{color:'var(--vt-flame-ink)'}}>Time</span></div>
        <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:6}}>Проверяем Telegram-аккаунт…</div>
      </div>
      <Spinner size={22} color="var(--vt-flame)"/>
    </div>
  </>
);

const AuthMiniError = ({ onRetry }) => (
  <>
    <StatusBar time="19:24"/>
    <div style={{flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'24px 22px'}}>
      <div style={{width:60, height:60, borderRadius:'var(--r-card)', background:'var(--vt-rose-soft)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18}}>
        <Icon name="close" size={26} stroke="var(--vt-rose-ink)" sw={2}/>
      </div>
      <h1 style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, letterSpacing:0, fontSize:'var(--fs-3xl)', lineHeight:1}}>Не удалось войти</h1>
      <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:8, lineHeight:1.5}}>
        Telegram не передал данные авторизации. Обычно помогает перезапуск приложения из чата с ботом.
      </div>
      <div className="vt-card" style={{padding:'12px 14px', marginTop:16}}>
        <div className="vt-cap" style={{color:'var(--vt-mute-2)'}}>Код ошибки</div>
        <div className="vt-mono" style={{fontSize:'var(--fs-xs)', marginTop:4, color:'var(--vt-ink-3)'}}>AUTH_INITDATA_INVALID</div>
      </div>
      <div style={{marginTop:'auto', paddingTop:20, display:'flex', flexDirection:'column', gap:8}}>
        <button onClick={onRetry} className="vt-btn vt-btn--primary vt-btn--lg vt-btn--full">Попробовать снова</button>
        <button className="vt-btn vt-btn--ghost vt-btn--full" style={{gap:8}}><Icon name="tg" size={15}/> Написать в поддержку</button>
      </div>
    </div>
  </>
);

const AuthMiniNoOrg = () => (
  <>
    <StatusBar time="19:24"/>
    <div style={{flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'24px 22px'}}>
      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:20}}>
        <Avi size="lg" name="Артём" init="АК" tag="flame"/>
        <div>
          <div style={{fontSize:'var(--fs-md)', fontWeight:600}}>Артём Кравцов</div>
          <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', display:'flex', alignItems:'center', gap:4, marginTop:2}}><Icon name="tg" size={11}/> @artyomk</div>
        </div>
      </div>
      <h1 style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, letterSpacing:0, fontSize:'var(--fs-3xl)', lineHeight:1}}>Вы вошли, но групп пока нет</h1>
      <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:8, lineHeight:1.5}}>
        Чтобы записываться на тренировки, вступите в группу по ссылке от организатора — или создайте свою.
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:20}}>
        <button className="vt-card vt-card--raised" style={{padding:'16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', textAlign:'left'}}>
          <Icon name="qr" size={20}/>
          <div style={{flex:1}}>
            <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>У меня есть приглашение</div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>Ссылка или QR-код от организатора</div>
          </div>
          <Icon name="chevron-r" size={15} stroke="var(--vt-icon-idle)"/>
        </button>
        <button className="vt-card vt-card--raised" style={{padding:'16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', textAlign:'left'}}>
          <Icon name="building" size={20}/>
          <div style={{flex:1}}>
            <div style={{fontSize:'var(--fs-base)', fontWeight:600}}>Я организатор</div>
            <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)', marginTop:2}}>Создать группу · 5 credits в подарок</div>
          </div>
          <Icon name="chevron-r" size={15} stroke="var(--vt-icon-idle)"/>
        </button>
      </div>
    </div>
  </>
);

const AuthMiniBlocked = () => (
  <>
    <StatusBar time="19:24"/>
    <div style={{flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'24px 22px'}}>
      <div style={{width:60, height:60, borderRadius:'var(--r-card)', background:'var(--vt-amber-soft)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18}}>
        <Icon name="logout" size={25} stroke="var(--vt-amber-ink)" sw={2}/>
      </div>
      <h1 style={{fontFamily:'var(--f-display)', textTransform:'uppercase', fontWeight:700, letterSpacing:0, fontSize:'var(--fs-3xl)', lineHeight:1}}>Доступ к группе закрыт</h1>
      <div style={{fontSize:'var(--fs-sm)', color:'var(--vt-mute-2)', marginTop:8, lineHeight:1.5}}>
        Организатор ограничил ваш доступ в «VolleyTime Минск». Записи и абонементы недоступны.
      </div>
      <div className="vt-card vt-card--raised" style={{padding:14, marginTop:18}}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <Avi size="sm" name="Иван П." init="ИП" tag="ink"/>
          <div style={{flex:1, fontSize:'var(--fs-sm)'}}>Иван Петренко · организатор</div>
          <button className="vt-btn vt-btn--ghost vt-btn--sm" style={{padding:'6px 10px', fontSize:'var(--fs-xs)'}}>Написать</button>
        </div>
      </div>
      <div style={{marginTop:'auto', paddingTop:20}}>
        <button className="vt-btn vt-btn--ghost vt-btn--full">Вступить в другую группу</button>
      </div>
    </div>
  </>
);

if (typeof document !== 'undefined' && !document.getElementById('vt-spin-kf')) {
  const s = document.createElement('style');
  s.id = 'vt-spin-kf';
  s.textContent = '@keyframes vt-spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(s);
}

Object.assign(window, {
  AuthShell, AuthWebStart, AuthWebOtp, AuthWebOtpError, AuthWebLoading, AuthWebOrgPick,
  AuthWebNoAccess, AuthWebBlocked,
  AuthMiniSplash, AuthMiniError, AuthMiniNoOrg, AuthMiniBlocked,
});
