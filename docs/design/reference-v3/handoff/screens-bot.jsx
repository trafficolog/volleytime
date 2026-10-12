// screens-bot.jsx — Telegram Bot, сверено с реальными возможностями Bot API
// Ограничения, которые соблюдаем:
//  · inline-кнопки — только текст (эмодзи допустимы), никакой графики
//  · тело сообщения — подмножество HTML: b/i/u/s/a/code/pre/blockquote/tg-spoiler
//    никаких подложек, колонок, выравнивания и цвета
//  · нажатие inline-кнопки не создаёт сообщение пользователя:
//    answerCallbackQuery (тост) + editMessageText (правка на месте)
//  · reply-клавиатура живёт над полем ввода и отправляет текст от пользователя
//  · сообщения статичны — никаких тикающих таймеров, только абсолютный дедлайн

const TgShell = ({ children, botName = "VolleyTime Bot", replyKeyboard, toast }) => (
  <Phone>
    <div style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'6px 14px 10px',
      background:'var(--vt-bone)',
      borderBottom:'1px solid var(--vt-stroke)'
    }}>
      <Icon name="chevron-l" size={18} stroke="var(--vt-flame)" sw={2}/>
      <div style={{
        width:36, height:36, borderRadius:'50%',
        background:'var(--vt-on-hero)',
        backgroundImage:'url(assets/logo/vt-mark-color.svg)',
        backgroundSize:'78%', backgroundPosition:'center', backgroundRepeat:'no-repeat',
        border:0,
        flexShrink:0
      }}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontFamily:'var(--f-display)', fontWeight:600, fontSize:'var(--fs-md)'}}>{botName}</div>
        <div style={{fontSize:'var(--fs-xs)', color:'var(--vt-mute-2)'}}>bot · @volleytime_bot</div>
      </div>
      <Icon name="more" size={20} stroke="var(--vt-icon-idle)"/>
    </div>

    <div className="vt-phone__body" style={{padding:'14px 12px 8px', background:'var(--vt-bone)', position:'relative'}}>
      {children}
      {toast && (
        <div style={{
          position:'sticky', bottom:6, marginTop:10,
          background:'var(--vt-toast-bg)', color:'var(--vt-paper)',
          padding:'10px 14px', borderRadius:'var(--r-chip)', fontSize:'var(--fs-sm)', lineHeight:1.35,
          display:'flex', gap:8, alignItems:'flex-start'
        }}>
          <span style={{flexShrink:0}}>✓</span>
          <span>{toast}</span>
        </div>
      )}
    </div>

    {replyKeyboard && (
      <div style={{padding:'6px 8px', background:'var(--vt-bone-2)', borderTop:'1px solid var(--vt-stroke)', display:'flex', flexDirection:'column', gap:6}}>
        {replyKeyboard.map((row, ri) => (
          <div key={ri} style={{display:'flex', gap:6}}>
            {row.map((label, ci) => (
              <button key={ci} style={{
                flex:1, padding:'10px 8px', borderRadius:'var(--r-sm)',
                background:'var(--vt-paper)', border:0,
                fontSize:'var(--fs-sm)', fontWeight:500, color:'var(--vt-ink)',
                fontFamily:'var(--f-body)', textAlign:'center', lineHeight:1.2,
              }}>{label}</button>
            ))}
          </div>
        ))}
      </div>
    )}

    <div style={{padding:'8px 12px 12px', borderTop:'1px solid var(--vt-stroke)', background:'var(--vt-paper)', display:'flex', alignItems:'center', gap:8}}>
      <button style={{
        padding:'8px 12px', borderRadius:'var(--r-pill)', flexShrink:0,
        background:'var(--vt-bone-2)', border:0,
        fontSize:'var(--fs-xs)', fontWeight:600, color:'var(--vt-ink-3)',
        fontFamily:'var(--f-body)', display:'inline-flex', alignItems:'center', gap:6
      }}>
        <Icon name="menu" size={13}/> Menu
      </button>
      <div className="vt-field" style={{flex:1, padding:'10px 14px', borderRadius:'var(--r-pill)', color:'var(--vt-mute-2)', fontSize:'var(--fs-sm)'}}>Сообщение</div>
      <button style={{padding:'8px', borderRadius:'var(--r-pill)', flexShrink:0, color:'var(--vt-icon-idle)'}}><Icon name="send" size={17}/></button>
    </div>
  </Phone>
);

const Line = ({ children, dim, mono, bold }) => (
  <div style={{
    fontSize: dim ? 'var(--fs-sm)' : 'var(--fs-base)',
    color: dim ? 'var(--vt-mute-2)' : 'var(--vt-ink)',
    fontWeight: bold ? 700 : 400,
    fontFamily: mono ? 'var(--f-mono)' : 'var(--f-body)',
    lineHeight: 1.45,
  }}>{children}</div>
);

const BotMsg = ({ time = '19:24', children, keyboard, edited }) => (
  <div style={{display:'flex', gap:8, marginBottom:8, alignItems:'flex-end'}}>
    <div style={{
      maxWidth:'87%',
      background:'var(--vt-paper)',
      borderRadius:'14px 14px 14px 4px',
      padding:'10px 12px 6px',
      border:0,
      minWidth:0
    }}>
      <div style={{display:'flex', flexDirection:'column', gap:2}}>{children}</div>

      {keyboard && (
        <div style={{marginTop:10, display:'flex', flexDirection:'column', gap:4, marginInline:-4, marginBottom:2}}>
          {keyboard.map((row, ri) => (
            <div key={ri} style={{display:'flex', gap:4}}>
              {row.map((b, ci) => {
                const label = typeof b === 'string' ? b : b.label;
                return (
                  <button key={ci} style={{
                    flex:1, padding:'10px 10px', borderRadius:'var(--r-sm)',
                    background:'var(--vt-bone-2)',
                    border:0,
                    color:'var(--vt-flame-ink)',
                    fontSize:'var(--fs-sm)', fontWeight:600, textAlign:'center',
                    fontFamily:'var(--f-body)', lineHeight:1.25,
                  }}>{label}</button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div style={{fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)', textAlign:'right', marginTop:4, fontFamily:'var(--f-mono)'}}>
        {edited && <span>изменено </span>}{time}
      </div>
    </div>
  </div>
);

const SysLine = ({ children }) => (
  <div style={{textAlign:'center', margin:'10px 0', fontSize:'var(--fs-2xs)', color:'var(--vt-mute-2)'}}>
    <span style={{background:'var(--vt-paper)', padding:'4px 10px', borderRadius:'var(--r-pill)', border:0}}>{children}</span>
  </div>
);

const UserMsg = ({ time = '19:24', children }) => (
  <div style={{display:'flex', justifyContent:'flex-end', marginBottom:8}}>
    <div style={{
      maxWidth:'85%',
      background:'var(--vt-flame)',
      color:'var(--vt-on-accent)',
      borderRadius:'14px 14px 4px 14px',
      padding:'10px 12px 6px',
      fontSize:'var(--fs-base)', lineHeight:1.45,
    }}>
      <div>{children}</div>
      <div style={{fontSize:'var(--fs-2xs)', opacity:0.85, textAlign:'right', marginTop:4, fontFamily:'var(--f-mono)'}}>{time} ✓✓</div>
    </div>
  </div>
);

// ---------- BotDeeplink: онбординг по ссылке ----------
const BotDeeplink = () => (
  <TgShell toast="Вы в группе «VolleyTime Минск»">
    <SysLine>22 мая</SysLine>

    <UserMsg time="14:02">/start org_7gK4nT</UserMsg>

    <BotMsg time="14:02"
      keyboard={[
        [{ label:'Открыть приглашение', app:true }],
        ['Кто уже играет'],
        ['Не сейчас'],
      ]}
    >
      <Line>👋 Привет, Артём!</Line>
      <Line><b>Иван Петренко</b> приглашает тебя в группу <b>«VolleyTime Минск»</b>.</Line>
      <Line dim>14 человек · тренировки по средам, пятницам и воскресеньям.</Line>
    </BotMsg>

    <BotMsg time="14:05" edited
      keyboard={[[{ label:'Открыть VolleyTime', app:true }]]}
    >
      <Line>✅ Ты в группе <b>VolleyTime Минск</b>.</Line>
      <Line dim>Сюда буду присылать напоминания и подтверждения оплат. Записи и состав — в приложении.</Line>
    </BotMsg>

    <SysLine>Сегодня</SysLine>

    <BotMsg time="19:24" keyboard={[['Записаться'], [{ label:'Открыть тренировку', app:true }]]}>
      <Line bold>Ср · 28 мая · 20:00</Line>
      <Line>Основа · Школа №24 · 15 Br</Line>
      <Line dim>Свободно 5 из 14 мест.</Line>
    </BotMsg>
  </TgShell>
);

// ---------- BotNotifications ----------
const BotNotifications = () => (
  <TgShell>
    <SysLine>27 мая</SysLine>

    <BotMsg time="20:00" keyboard={[['Не смогу прийти']]}>
      <Line bold>⏰ Напоминание · за 24 часа</Line>
      <Line>Завтра <b>Основа</b> · 28 мая, 20:00</Line>
      <Line>Школа №24, малый зал.</Line>
      <Line dim>Ты в основном составе.</Line>
    </BotMsg>

    <SysLine>28 мая</SysLine>

    <BotMsg time="18:00" keyboard={[['Буду', 'Не смогу']]}>
      <Line bold>🏐 Через 2 часа · Основа</Line>
      <Line dim>Запись закроется в 19:00.</Line>
    </BotMsg>

    <BotMsg time="19:14" keyboard={[[{ label:'Подтвердить оплату', app:true }]]}>
      <Line bold>💸 Никита отметил оплату наличными</Line>
      <Line>+15,00 Br · Основа · 28 мая</Line>
      <Line dim>Касса после подтверждения: 248,50 Br</Line>
    </BotMsg>

    <BotMsg time="22:05">
      <Line bold>📊 Тренировка завершена</Line>
      <Line>Основа · 28 мая · пришли 12 из 12.</Line>
      <Line dim>Списано с абонементов: 2 · касса +30 Br.</Line>
    </BotMsg>

    <SysLine>30 мая</SysLine>

    <BotMsg time="08:14" keyboard={[['Беру место', 'Пропущу']]}>
      <Line bold>🔔 Освободилось место</Line>
      <Line>Открытая игра · 30 мая, 19:30.</Line>
      <Line>Ты первый в листе ожидания.</Line>
      <Line dim>Подтверди до <b>08:44</b> — потом место уйдёт следующему.</Line>
    </BotMsg>
  </TgShell>
);

// ---------- BotMenu: reply-клавиатура ----------
const BotMenu = () => (
  <TgShell replyKeyboard={[
    ['Расписание', 'Мой абонемент'],
    ['Мои записи', 'Сборы'],
    ['Помощь'],
  ]}>
    <SysLine>Сегодня</SysLine>

    <UserMsg time="14:00">/menu</UserMsg>

    <BotMsg time="14:00" keyboard={[[{ label:'Открыть приложение', app:true }]]}>
      <Line bold>VolleyTime Минск</Line>
      <Line>14 игроков · ближайшая тренировка в среду, 20:00.</Line>
      <Line dim>Меню закреплено под полем ввода.</Line>
    </BotMsg>

    <UserMsg time="14:01">Расписание</UserMsg>

    <BotMsg time="14:01" keyboard={[[{ label:'Записаться в приложении', app:true }]]}>
      <Line bold>На этой неделе</Line>
      <Line>🟡 <b>Основа</b> — ср 28 мая, 20:00</Line>
      <Line dim>Школа №24 · занято 12 из 14</Line>
      <Line>🟢 <b>Открытая игра</b> — пт 30 мая, 19:30</Line>
      <Line dim>СК «Заслонова» · занято 9 из 14</Line>
      <Line>🔴 <b>Микст</b> — вс 1 июня, 10:00</Line>
      <Line dim>Школа №24 · мест нет, в листе ожидания 2</Line>
    </BotMsg>

    <UserMsg time="14:02">Помощь</UserMsg>

    <BotMsg time="14:02">
      <Line bold>Команды</Line>
      <Line mono dim>/menu — главное меню</Line>
      <Line mono dim>/app — открыть приложение</Line>
      <Line mono dim>/upcoming — ближайшие</Line>
      <Line mono dim>/subscription — абонемент</Line>
      <Line dim>Полный список — по кнопке Menu слева от поля ввода.</Line>
    </BotMsg>
  </TgShell>
);

Object.assign(window, { BotDeeplink, BotNotifications, BotMenu });
