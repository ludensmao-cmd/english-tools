---
name: English.tools catalogue
description: Реализованная поверхность 12 страниц /links/ с data-page=catalog; не глобальная замена бренда.
colors:
  accent: "#cf9bff"
  folder-top: "#dfaaff"
  folder-bottom: "#c98bef"
  ground: "#141117"
  sidebar: "#17131c"
  surface: "#1b1820"
  line: "#332a3b"
  text: "#f7f2fa"
  secondary: "#bfb0c8"
  control-border: "#846395"
  action-text: "#d1b5e1"
  folder-ink: "#211128"
  hover-surface: "#282031"
typography:
  display:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "clamp(2rem, 3.6vw, 3.35rem)"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.4
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  image: "8px"
  action: "10px"
  field: "12px"
  card: "14px"
spacing:
  form-gap: "12px"
  card-gap: "14px"
  card-inset: "22px"
  card-inset-mobile: "18px"
  content-inset-desktop: "40px"
  content-inset-mobile: "20px"
components:
  search-button:
    textColor: "{colors.folder-ink}"
    rounded: "{rounded.field}"
    padding: "12px 20px"
  secondary-action:
    textColor: "{colors.action-text}"
    rounded: "{rounded.action}"
    padding: "10px 22px"
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.field}"
    padding: "14px 18px"
    height: "58px"
  resource-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "22px"
  folder-label:
    textColor: "{colors.folder-ink}"
    typography: "{typography.headline}"
    padding: "10px 27px 12px 22px"
---

# Design System: English.tools catalogue

## Overview

**Creative North Star: "Тёмный каталог с папками"**

Это фиксация реализованного каталога по [утверждённому макету](../../.impeccable/mocks/all-tools-lobby-reference-v1.png) и [brief](catalogue-approved.md). Лавандовая закладка связывает подборку с мотивом папки на главной. Пользователь работает с поиском, направлениями и реальными ресурсами; спокойная оболочка помогает читать длинные описания.

**Key Characteristics:**

- Открытый заголовок Manrope с одним слабым фиолетовым светом.
- Левое меню на широком экране, лавандовые закладки и плоские карточки.
- Настоящие локальные логотипы с учётом исходного разрешения.
- Полные описания и адаптивная высота карточек.

**The Catalogue Scope Rule.** Контракт применяется только к 12 страницам `/links/` с `.catalog-lobby[data-page="catalog"]`. Главная, ИИ, блог, справка и кабинеты сохраняют свои существующие контракты в [DESIGN.md](../DESIGN.md).

Источник фактических значений — [catalog-lobby.css](../dist/catalog-lobby.css), адаптации разметки — [catalog_lobby.py](../scripts/catalog_lobby.py). Расширения со snippet-компонентами, движением и breakpoints — [.impeccable/catalogue-design.json](../../.impeccable/catalogue-design.json); sidecar ограничен каталогом и не заменяет глобальный design.json.

## Colors

### Primary

`accent` обозначает выбранное направление, Telegram и клавиатурный фокус. `folder-top` и `folder-bottom` образуют лавандовый градиент закладок и кнопки «Найти»; `folder-ink` даёт тёмный текст на этих светлых поверхностях.

### Neutral

`ground`, `sidebar` и `surface` разделяют страницу, меню и карточки тёмными сливовыми тонами. `line` используется для спокойных разделителей; `control-border` — для границ input, select и действий раскрытия/сброса. `text` применяется к заголовкам, `secondary` — к описаниям и счётчику, `action-text` — к вторичным действиям. `hover-surface` выделяет карточку или действие без яркой постоянной заливки.

## Typography

Локальные Manrope 400–800; системный sans-serif используется как fallback. Нормативная шкала выше описывает обычную ширину. До 767px заголовок страницы становится 30px / 1.18, закладка — 17px, название ресурса — 16px, описание — 14px. Строки и длинные названия переносятся, ресурсные описания не обрезаются.

## Layout

| Ширина CSS viewport | Геометрия |
| --- | --- |
| От 1180px | Шапка 88px, sidebar 288px, две колонки карточек с зазором 14px. |
| 960–1179px | Та же шапка и sidebar, одна колонка карточек. |
| 768–959px | Шапка 76px; фиксированная панель направлений 48px под ней; sidebar открывается существующим управлением; одна колонка. |
| До 767px | Та же мобильная оболочка; поле поиска в первом ряду, select и «Найти» во втором; поля высотой 52px; одна колонка карточек. |

Контейнер содержимого ограничен 1280px. У блока страницы от 960px отступы 42px сверху, 40px сбоку и 96px снизу; на ширине 768–959px — 32px / 24px / 80px; до 767px — 28px / 20px / 72px. У внешнего блока `.VPContent.has-sidebar` до 959px верхний padding 48px; от 960px он равен высоте шапки, а левый padding — ширине sidebar. Эти два слоя отступов не заменяют друг друга.

Поля и select занимают 58px по высоте до компактного breakpoint. На ширине до 420px слово Telegram скрыто, иконка сохраняет доступное имя и цель минимум 44px. Минимальная высота карточки — 142px, до 767px — 120px; реальная высота зависит от описания, элементы одного ряда растягиваются по высоте ряда.

## Elevation & Depth

Карточки плоские: тень отсутствует и при наведении. Глубина создаётся тёмными поверхностями, границей и одним radial-gradient за заголовком (`ellipse at 34% 46%, rgba(109,55,158,.13), transparent 68%`). Этот свет не превращается в рамку или отдельную панель. Состояние карточки меняет фон и границу за 0.18s; смещение и масштабирование отсутствуют. При `prefers-reduced-motion: reduce` переходы и анимация отключаются.

## Shapes

Карточки, поля и вторичные действия используют разные радиусы из frontmatter. Закладка раздела — геометрия CSS с небольшим поднятым плечом, округлённым верхом и скошенным правым краем; текст остаётся семантическим h2. У карточки тонкая граница (1px), у input/select и действий — отдельная контрастная граница (1px). Фокус — outline акцентного цвета (2px) с отступом (4px).

## Components

### Search and fields

Поиск — native GET-форма; запрос и направление сохраняются в `q` и `skill`. Видимый placeholder: «Название, тема или формат», начальная опция: «Все направления». Семантические label остаются доступны скринридеру; у поля поиска слева inline SVG-лупа и padding 54px. Select сохраняет нативное поведение. «Найти» использует тот же градиент, что закладка; его hover — #e5b9ff.

### Secondary actions

«Показать ещё», «Свернуть» и сброс используют общий контурный стиль с высотой не менее 44px. Hover: фон `hover-surface`, основной текст и граница #956fad. Начально в каждой группе показано шесть карточек; поиск охватывает скрытые записи. «Свернуть» возвращает группу к шести, подпись не содержит «до 6». Поведение принадлежит существующему [catalog.js](../dist/catalog.js).

### Resource cards

Карточка — обычная ссылка на сохранённый URL, без вымышленных оценок и статусов. На широкой странице внутренний отступ 22px и промежуток между логотипом/текстом 22px; до 767px — 18px и 16px. При hover/focus фон становится `hover-surface`, граница — #816192; карточка не двигается, её opacity остаётся 1.

Контейнер логотипа — 72×72px, до 767px — 56×56px, внутренний padding 4px. Обычное изображение имеет максимум 64px / 48px и `object-fit:contain`; helper ограничивает маленькие исходники: BNE 16×16px, ESL Fast внутри 31×31px. News in Levels — отдельное окно 52×52px, `object-fit:none; object-position:left center`, без масштабирования. Источники, происхождение и ограничения — [asset-manifest.md](../research/catalog-lobby-2026-10-06/asset-manifest.md).

### Navigation and folder headings

Sidebar использует спокойный hover #211b29 и выбранную поверхность #2b2234; активный текст — `accent`. Значки меню — 22px; для «Все инструменты» существующий голубой глобус совпадает со знаком в заголовке. Остальные 18 каталоговых SVG имеют единую геометрию 24×24, stroke 1.8. Логотип English.tools — существующий прозрачный PNG 1774×887, его пропорции сохраняются.

Закладка сопровождается тонкой линией; h2 сохраняет anchor для клавиатурной навигации. У `.VPDoc` нет правого aside. Общая шапка содержит «Инструменты», «Урок с ИИ», «Блог», «Словари» и отдельное действие Telegram; поиск находится в содержимом каталога.

## Do's and Don'ts

### Do:

- **Do** применять этот контракт только к 12 каталоговым страницам и собирать их через `assemble_englinks_pages.py --catalog-only`.
- **Do** сохранять все 685 ресурсных записей, полные описания, URL и существующее поведение поиска/раскрытия.
- **Do** сохранять реальные логотипы, их пропорции и ограничения по исходному разрешению.
- **Do** проверять источники и browser captures отдельно; документация сама по себе не является визуальным verdict.

### Don't:

- **Don't** переносить палитру или геометрию каталога на главную, ИИ, блог и кабинеты без отдельного запроса.
- **Don't** обрезать описания ради точной высоты generated mockup или подменять реальные бренды его приблизительными логотипами.
- **Don't** добавлять постоянную яркую заливку карточкам, тени при наведении или контур вокруг света за заголовком.

Доказательства текущего состояния: [source-check.json](../research/catalog-lobby-2026-10-06/source-check.json), [source-validation.json](../research/catalog-lobby-2026-10-06/source-validation.json), [catalogue-validation.json](../research/catalog-lobby-2026-10-06/catalogue-validation.json), [mobile measurements](../research/catalog-lobby-2026-10-06/browser-mobile-final.json) и [desktop measurements](../research/catalog-lobby-2026-10-06/browser-wide-final.json). Реальные captures доступны в [review](../../.impeccable/review/); наличие файлов не означает визуальную сертификацию всех размеров экрана, внешних URL или публикации.
