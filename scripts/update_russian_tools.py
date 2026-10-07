#!/usr/bin/env python3
"""Apply the dated, sourced additions without reimporting the historical catalogue."""
from pathlib import Path
from html import escape
from urllib.parse import urlsplit
import json
from catalog_model import load_catalog, resource_id, canonical
from fetch_russian_resource_icons import slug

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'content/catalog.json'
SOURCE = ROOT / 'research/russian-tools-source-2026-10-07.json'

# Primary direction, skills, subject placements, description, first action, limit,
# dictionary menu group, search aliases. No ratings or unverified result claims.
ADDITIONS = {
 'Puzzle English': (6, ['Грамматика','Слушать','Слова'], [('grammar',1),('listening',6),('vocabulary',2),('watch/courses',1)],
  'Видеопазлы помогают разбирать английскую речь по коротким фрагментам. Здесь же есть упражнения на грамматику, словарные тренировки и игры с объяснениями на русском.',
  'Откройте короткий видеопазл, соберите услышанную фразу и сохраните незнакомые слова.',
  'Часть заданий и учебных программ доступна по подписке.', '', ['Пазл Инглиш']),
 'Simpler': (6, ['Грамматика','Слова','Слушать'], [('grammar',1),('vocabulary',2),('listening',6),('watch/courses',1)],
  'Приложение объясняет английскую грамматику через схемы и сборку предложений. Русские подсказки, словарные задания и истории дают материал для короткого занятия.',
  'Начните с одного правила и соберите несколько предложений в тренажёре.',
  'Нужна установка приложения; часть функций предлагается за отдельную плату.', '', ['Симплер']),
 'EWA': (1, ['Читать','Слова','Слушать'], [('reading',7),('vocabulary',2),('watch/cinema-tv',5)],
  'Книги с переводом по нажатию и короткие фрагменты фильмов помогают знакомиться с английским в контексте. Найденные слова можно повторять в упражнениях и играх.',
  'Выберите знакомую историю, прочитайте небольшой фрагмент и сохраните пять слов.',
  'Основная практика проходит в приложении; часть материалов доступна по подписке.', '', ['Эва']),
 'English Galaxy': (6, ['Грамматика','Слова','Слушать'], [('grammar',1),('vocabulary',2),('listening',6),('watch/courses',1)],
  'Последовательные уроки английского с объяснениями на русском, упражнениями на слова и построение фраз. Задания на слух дополняют грамматическую практику.',
  'Выберите урок своего уровня и выполните одну серию упражнений.',
  'Нужна установка приложения; доступ к отдельным урокам и функциям зависит от тарифа.', '', ['Инглиш Гэлакси','Английский Галакси']),
 'Полиглот — английский язык': (6, ['Грамматика','Писать'], [('grammar',1),('watch/courses',1)],
  'Курс из 16 уроков тренирует построение английских предложений. В заданиях нужно переводить фразы с русского и применять изученные грамматические схемы.',
  'Пройдите первый урок и потренируйте утвердительные, отрицательные и вопросительные фразы.',
  'Ссылка ведёт на приложение в App Store; перед загрузкой проверьте цену и совместимость устройства.', '', ['Polyglot','Полиглот 16 уроков']),
 'Lim English': (6, ['Грамматика','Слушать','Слова','Писать'], [('grammar',1),('listening',6),('vocabulary',2),('watch/courses',1)],
  'Онлайн-самоучитель сочетает короткие тексты, диктанты, перевод и аудирование. Русские объяснения и личный словарь помогают разобрать материал после упражнения.',
  'Выберите небольшой текст, прослушайте его и выполните одно задание на перевод.',
  'Полный объём курса зависит от выбранного доступа; условия указаны на сайте.', '', ['Лим Инглиш']),
 'Mondly': (5, ['Слова','Говорить','Слушать'], [('vocabulary',2),('speaking',1),('watch/courses',1)],
  'Короткие тематические уроки знакомят с английскими словами и бытовыми фразами. В приложении есть задания на произношение и русский интерфейс.',
  'Выберите английский и пройдите урок на знакомую бытовую тему.',
  'Русский язык выбирается в приложении; часть курсов и функций платная.', '', ['Мондли']),
 'ReWord': (5, ['Слова'], [('vocabulary',3)],
  'Английские слова с русским переводом повторяются в карточках по интервальному расписанию. Можно учить готовые наборы или добавлять собственные слова.',
  'Добавьте пять слов, которые встретились сегодня, и пройдите первое повторение.',
  'Используйте именно английско-русскую версию; возможности доступа указаны в приложении.', '', ['Реворд','РеВорд']),
 'easy ten': (5, ['Слова','Слушать'], [('vocabulary',3)],
  'Небольшие ежедневные наборы английских слов с русским переводом, озвучкой и проверочными заданиями. Приложение возвращает изученную лексику в повторение.',
  'Выберите подходящий набор и проверьте, какие слова уже знаете.',
  'Ссылка ведёт в App Store; в приложении предлагаются платные покупки.', '', ['Изи Тен']),
 'WordBit — английский язык': (5, ['Слова'], [('vocabulary',3)],
  'Приложение для Android показывает английские слова и примеры при разблокировке телефона. Английско-русская версия помогает повторять лексику между другими делами.',
  'Выберите уровень и небольшой набор слов для экрана блокировки.',
  'Нужен Android и разрешение на работу с экраном блокировки.', '', ['Вордбит','WordBit English']),
 'Lingust': (6, ['Грамматика','Слушать'], [('grammar',1),('listening',6),('watch/courses',1)],
  'Уроки английского для начинающих с русскими объяснениями грамматики, примерами и аудиозаписями. Материал идёт последовательно и подходит для занятий по одному уроку.',
  'Откройте первый подходящий урок, прослушайте примеры и выполните задания.',
  'Это самоучитель: проверять свои ответы и планировать повторение нужно самостоятельно.', '', ['Лингуст']),
 'Study.ru': (6, ['Грамматика'], [('grammar',1),('vocabulary',8)],
  'Грамматические тесты и материалы по английскому на русском. Можно выбрать отдельную тему или пройти тест уровня, чтобы наметить, что повторить.',
  'Выберите одну грамматическую тему и разберите ошибки после теста.',
  'Онлайн-тест даёт ориентир и не заменяет официальный экзамен.', '', ['Студи ру']),
 'Begin English': (6, ['Грамматика','Слова','Читать'], [('grammar',1),('vocabulary',2),('reading',1)],
  'Русскоязычный сайт с уроками, грамматическими справками и подборками английских слов. Можно найти объяснение конкретного правила или начать с материалов для новичков.',
  'Найдите правило, которое вызывает трудности, и составьте три примера с ним.',
  'Материалы нужно выбирать под свой уровень; единого персонального плана здесь нет.', '', ['Бегин Инглиш']),
 'Engblog': (6, ['Грамматика','Читать'], [('grammar',1),('reading',4)],
  'Статьи об английской грамматике с объяснениями на русском и примерами. Темы собраны в справочник, к которому удобно возвращаться при разборе сложной фразы.',
  'Откройте нужную грамматическую тему и сравните примеры со своим предложением.',
  'Это справочные статьи; самостоятельную практику к ним нужно добавлять отдельно.', '', ['Ингблог']),
 'WooordHunt': (5, ['Слова','Слушать','Писать'], [('vocabulary',4),('writing',3)],
  'Англо-русский словарь с озвучкой, примерами и вариантами перевода. Личный словарь и тренировки позволяют возвращаться к словам, которые встретились при чтении.',
  'Найдите слово, прослушайте произношение и сравните несколько примеров.',
  'Перевод зависит от контекста: проверяйте значение всей фразы.', 'Перевод и контекст', ['Вордхант','WordHunt','Word Hunt']),
 'Мультитран': (5, ['Слова','Писать'], [('vocabulary',4),('writing',3)],
  'Англо-русский словарь с переводами по тематикам: от повседневной речи до технических терминов. Пометки помогают сравнить значения, когда обычного перевода недостаточно.',
  'Введите термин и выберите значение из нужной предметной области.',
  'Переводы пополняются пользователями; проверяйте тематику и контекст.', 'Перевод и контекст', ['Multitran']),
 'PROMT.One': (5, ['Слова','Писать'], [('vocabulary',4),('writing',3)],
  'Переводчик и словарь для английского и русского с примерами употребления. Подходит для разбора слова, словосочетания или чернового перевода короткого текста.',
  'Введите английскую фразу и сравните перевод с примерами словарных значений.',
  'Автоматический перевод стоит проверять по контексту, особенно для специальных терминов.', 'Перевод и контекст', ['Промт','PROMT']),
 'Яндекс Переводчик': (5, ['Слова','Писать','Слушать'], [('vocabulary',4),('writing',3)],
  'Перевод английского текста, словарные значения, транскрипция и озвучка в русском интерфейсе. Примеры помогают разобраться, какое значение подходит в конкретной фразе.',
  'Выберите английский и русский, найдите слово и прослушайте его произношение.',
  'Машинный перевод может ошибаться; проверяйте неоднозначные фразы.', 'Перевод и контекст', ['Yandex Translate']),
 'Smart Book / Билингва': (1, ['Читать','Слова'], [('reading',7),('vocabulary',3)],
  'Читалка позволяет разбирать английские книги с переводом слов и фраз. Можно открывать свои тексты и сохранять незнакомую лексику для повторения.',
  'Откройте короткий английский текст и сохраните несколько полезных слов.',
  'Ссылка ведёт на приложение для Android; отдельные функции и переводы могут быть платными.', '', ['SmartBook','Смарт Бук','Билингва']),
 'Алиса AI': (3, ['Говорить','Слушать','Грамматика','Писать'], [('speaking',1),('grammar',1),('writing',1)],
  'С Алисой можно потренировать разговор на английском и попросить объяснить ошибку на русском. Текстовый чат также подходит для составления примеров и небольших упражнений.',
  'Попросите начать короткий диалог на английском по знакомой теме, затем разобрать ошибки.',
  'Возможности зависят от режима и устройства; ответы ИИ и исправления стоит перепроверять.', '', ['Alice AI','YandexGPT','Алиса']),
 'ГигаЧат': (4, ['Писать','Грамматика','Слова'], [('writing',1),('grammar',1),('vocabulary',5)],
  'Русскоязычный ИИ-помощник может объяснить английское правило, придумать упражнения и разобрать ваш текст. Задайте уровень и тему, чтобы получить более подходящие примеры.',
  'Пришлите несколько своих предложений и попросите объяснить исправления на русском.',
  'Может потребоваться вход; языковые объяснения и оценки ИИ нужно перепроверять.', '', ['GigaChat','Гига чат'])
}

RUSSIAN_URLS = {
 'Duolingo':'https://ru.duolingo.com/',
 'Busuu':'https://www.busuu.com/ru/course/uchit-angliskiy-online',
 'Memrise':'https://www.memrise.com/ru/uchit-angliiskii/kurs-angliiskogo',
 'Loecsen':'https://www.loecsen.com/ru/k%D1%83%D1%80%D1%81%D1%8B-%D0%B0%D0%BD%D0%B3%D0%BB%D0%B8%D0%B9%D1%81%D0%BA%D0%B8%D0%B9',
 '50 Languages':'https://50languages.com/ru/learn/basics/en',
 'Lingvist':'https://lingvist.com/ru/kursy/izuchit-angliyskiy-online/',
 'Quizlet':'https://quizlet.com/ru',
 'Reverso Context':'https://context.reverso.net/перевод/английский-русский/',
 'Cambridge Dictionary':'https://dictionary.cambridge.org/ru/%D1%81%D0%BB%D0%BE%D0%B2%D0%B0%D1%80%D1%8C/%D0%B0%D0%BD%D0%B3%D0%BB%D0%BE-%D1%80%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9/',
 'WordReference':'https://www.wordreference.com/enru/',
 'Forvo':'https://ru.forvo.com/languages/en/',
 'Google Translate':'https://translate.google.com/?hl=ru&sl=en&tl=ru',
 'DeepL Translate':'https://www.deepl.com/ru/translator',
 'AnyLang Books':'https://anylang.net/ru/books/en',
 'Beelinguapp':'https://beelinguapp.com/ru/courses/learn-english',
 'LingQ':'https://www.lingq.com/ru/',
 'ORORO':'https://ororo.tv/ru',
 'Tandem':'https://tandem.net/ru',
 'HelloTalk':'https://www.hellotalk.com/?lang=ru',
 'Talkpal':'https://talkpal.ai/ru/',
 'EF SET':'https://www.efset.org/ru/',
 'LanguageTool':'https://languagetool.org/ru',
 'Wordwall':'https://wordwall.net/ru'
}
ALIASES = {'Lingualeo':['Лингвалео'], 'Duolingo':['Дуолинго'], 'Busuu':['Бусуу'],
           'Memrise':['Мемрайз'], 'Lingvist':['Лингвист'], 'Drops':['Дропс'],
           'Anki':['Анки'], 'Quizlet':['Квизлет'], 'Reverso Context':['Реверсо','Контекст Реверсо'],
           'Cambridge Dictionary':['Кембриджский словарь'], 'Google Translate':['Гугл переводчик'],
           'DeepL Translate':['Дипл'], 'AnyLang Books':['Эниланг'], 'ORORO':['Ороро'],
           'InOriginal':['Иноригинал'], 'Tandem':['Тандем'], 'HelloTalk':['Хелло Ток'],
           'Praktika':['Практика'], 'Talkpal':['Толкпал']}

def main():
    data=load_catalog(); rows=data['resources']; before=len(rows)
    research=json.loads(SOURCE.read_text())['resources']; added=[]; updated=[]
    by_name={r['name']:r for r in rows}
    for name,url in RUSSIAN_URLS.items():
        row=by_name[name]
        if row['url']==url: continue
        updated.append({'id':row['id'],'name':name,'oldUrl':row['url'],'url':url})
        row['url']=url
    for name,aliases in ALIASES.items():
        row=by_name[name]; row['aliases']=list(dict.fromkeys(row.get('aliases',[])+aliases))
    icon_report={r['name']:r for r in json.loads((ROOT/'research/russian-resource-icons-2026-10-07.json').read_text())}
    for source in research:
        if source.get('catalogId'): continue
        name=source['name']
        if name in by_name: continue
        direction,skills,places,description,start,limit,dictionary,aliases=ADDITIONS[name]
        placements=[]
        for page,number in places:
            group=page.replace('/','-')+'-list-'+str(number)
            order=1+max((p.get('order',0) for r in rows for p in r['placements'] if p['page']==page and p['group']==group),default=0)
            placements.append({'page':page,'group':group,'order':order})
        kind='Перевод и контекст' if dictionary else source['category']
        row={'id':resource_id(source['url']),'name':name,'url':source['url'],
             'category':source['category'],'kind':kind,'skills':skills,'price':'',
             'description':description,'start':start,'limit':limit,
             'sections':list(dict.fromkeys(p['page'] for p in placements)),
             'subcategories':list(dict.fromkeys(next(g['label'] for g in data['pages'][p['page']]['groups'] if g['id']==p['group']) for p in placements)),
             'placements':placements,'aliases':aliases,'dictionaryGroup':dictionary,
             'catalogGroup':'all-tools-list-'+str(direction)}
        icon=icon_report.get(name,{})
        if icon.get('file') and (ROOT/'dist/brand/resource-icons'/icon['file']).is_file():
            row['icon']='/brand/resource-icons/'+icon['file']
        rows.append(row); by_name[name]=row; added.append({'id':row['id'],'name':name,'url':row['url']})
    report_path=ROOT/'research/russian-tools-update-2026-10-07.json'
    if not added and not updated and report_path.is_file():
        print('The dated Russian-language update is already applied; original change report retained.')
        return
    # Validate the entire new catalogue before replacing the live source.
    candidate=ROOT/'content/.catalog-russian-tools-candidate.json'
    candidate.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    load_catalog(candidate)
    candidate.replace(CATALOG)
    # Existing homepage previews retain their design and point to the same data.
    home=ROOT/'dist/index.html'; markup=home.read_text()
    for change in updated:
        markup=markup.replace('href="'+escape(change['oldUrl'],quote=True)+'"', 'href="'+escape(change['url'],quote=True)+'"')
    home.write_text(markup)
    report={'checkedAt':'2026-10-07','before':before,'after':len(rows),'added':added,'updatedUrls':updated,
            'researchedTools':len(research),'researchedToolsPresent':sum((r.get('catalogName') or r['name']) in by_name for r in research),
            'dictionaryCount':sum(bool(r.get('dictionaryGroup')) for r in rows)}
    report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v if not isinstance(v,list) else len(v) for k,v in report.items()},ensure_ascii=False,indent=2))

if __name__=='__main__': main()
