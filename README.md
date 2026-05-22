# Meme Sampler

Браузерный сэмплер для мем-звуков с драм-машиной и луп-секвенсором.

Открой в браузере, жми пэды мышкой или клавишами, рисуй ритм в драм-машине, всё крутится в луп.
Хочешь свой звук — перетащи аудиофайл прямо на пэд, он заменит пресет.

## Фичи MVP

- **16 пэдов (4×4)** с встроенными мем-пресетами на синтезаторе Tone.js: BOOM, AIR HORN, TADA, OOF, BRUH, WOW, YEAH, HUH, LAZER, COIN, POP, BELL, ALARM, SIREN, DING, ERROR.
- **QWERTY-хоткеи**: `1 2 3 4 / Q W E R / A S D F / Z X C V`.
- **Drag-and-drop** аудиофайла на любой пэд — он становится сэмплом этого пэда.
- **Step-sequencer 16×4** для драм-машины (kick / snare / closed hat / open hat).
- **Транспорт**: Play / Stop (пробел), BPM (40-220), master volume, очистка драмов.
- **Loop** включён по умолчанию — рисунок постоянно крутится.

## План на дальше

- Загрузка `.mid` файлов и проигрывание пэдов по нотам (с pitch-shift).
- Запись перфоманса в луп.
- Загрузка длинной аудио-дорожки + нарезка ползунками (chops) на пэды.
- Эффекты per-pad (reverb / delay / bitcrusher / filter).
- AI-генерация мелодий через Magenta.js.
- Экспорт в WAV / MP4.

## Локальный запуск

```bash
npm install
npm run dev
```

Открыть `http://localhost:5173/`.

## Сборка

```bash
npm run build
```

## Стэк

- [Vite](https://vite.dev) + React + TypeScript
- [Tone.js](https://tonejs.github.io/) — аудио-движок, синты, транспорт, секвенсор
- [Zustand](https://github.com/pmndrs/zustand) — стейт
- [Tailwind CSS](https://tailwindcss.com/) — стили

## Лицензия

MIT
