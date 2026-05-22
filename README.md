# Meme Sampler

Браузерный сэмплер для мем-звуков с драм-машиной, MIDI-импортом, чопами длинной аудио-дорожки,
AI-генерацией драм-паттернов, записью перфоманса в луп и экспортом в WAV.

## Фичи

- **16 пэдов (4×4)** с встроенными мем-пресетами на синтезаторе Tone.js: BOOM, AIR HORN, TADA, OOF, BRUH, WOW, YEAH, HUH, LAZER, COIN, POP, BELL, ALARM, SIREN, DING, ERROR.
- **QWERTY-хоткеи**: `1 2 3 4 / Q W E R / A S D F / Z X C V`, `Space` — play/stop.
- **Drag-and-drop** аудиофайла на любой пэд — он становится сэмплом этого пэда.
- **Per-pad FX** на каждом пэде: pitch (-24..+24 semitones), lowpass filter (80–20000 Hz), bitcrusher (1–8 bits), reverb send (0–100%), gain. Hover над пэдом → кнопка `fx`.
- **Step-sequencer 16×4** для драм-машины (kick / snare / closed hat / open hat).
- **AI Drums** — кнопка генерирует драм-паттерн в одном из 6 стилей (four-on-floor, trap, boom-bap, breakbeat, dnb, half-time) с лёгкой рандомизацией.
- **MIDI импорт**: загрузи `.mid` файл, выбери режим:
  - `melody` — все ноты проигрываются одним пэдом с pitch-shift'ом по высоте ноты (отсчёт от C4 = MIDI 60);
  - `drums` — ноты раскладываются по 16 пэдам по `pitch mod 16`.
- **Чопы аудио-дорожки**: загрузи длинный аудиофайл, увидь волновую форму, потаскай зелёные ползунки чтобы выделить кусок, и привяжи к любому пэду.
- **Запись перфоманса**: кнопка `REC` пишет нажатия пэдов (в т.ч. через хоткеи и MIDI) в Tone.Part, после остановки луп воспроизводится в цикле поверх драмов.
- **Транспорт**: Play / Stop, BPM (40-220), master volume, `Clear drums`, `Clear rec`.
- **Loop** включён по умолчанию — рисунок постоянно крутится.
- **Export WAV** — записывает 1 такт текущего лупа (драмы + записанные пэды + MIDI) и скачивает как `.wav` (16-bit PCM).

## Локальный запуск

```bash
npm install
npm run dev
```

Открой `http://localhost:5173/` в Chrome / Firefox / Safari / Edge.

Первый клик/нажатие клавиши на странице запускает аудио-контекст (требование браузера).

## Сборка

```bash
npm run build
```

Соберёт статичный сайт в `dist/`.

## Стэк

- [Vite](https://vite.dev) + React 19 + TypeScript
- [Tone.js](https://tonejs.github.io/) — аудио-движок, синтезаторы, транспорт, секвенсор, эффекты (Filter, BitCrusher, PitchShift, Reverb)
- [@tonejs/midi](https://github.com/Tonejs/Midi) — парсинг `.mid`
- [Zustand](https://github.com/pmndrs/zustand) — стейт
- [Tailwind CSS](https://tailwindcss.com/) — стили

## Архитектура аудио

- Per-pad chain: `input → filter (lowpass) → bitcrusher (wet=0 by default) → outDry → master`
  с параллельным send в общий reverb-бус.
- Pitch: для синтезированных пресетов передаётся через `semitones` параметр; для сэмплов и чопов — через `Tone.PitchShift`.
- MIDI: `Tone.Part` шедулит ноты, каждая нота вызывает `triggerPad(padIndex, vel, semis, time)`.
- Recording: `triggerPad` пишет события в буфер; на стопе создаётся looped `Tone.Part`.
- Export: `MediaRecorder` поверх `MediaStreamDestination` снимает мастер на 1 такт, декодирует в `AudioBuffer` и кодирует в 16-bit WAV.

## Roadmap

- Запись MIDI-входа (Web MIDI API) — играть на физической MIDI-клавиатуре прямо в пэды.
- MIDI-learn для назначения внешнего контроллера на пэды и FX-ручки.
- Choke-groups (открытый/закрытый хет режут друг друга).
- Side-chain ducking бочкой по фоновой музыке.
- Шаринг пресетов по URL/облаку.
- Видео-экспорт лупа с визуализацией для Reels/TikTok.

## Лицензия

MIT
