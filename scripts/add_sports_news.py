#!/usr/bin/env python3
"""Add English sports publishers to the shared catalogue without reimporting it."""
from pathlib import Path
import json
from catalog_model import canonical, load_catalog, resource_id

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'content/catalog.json'
SOURCE = ROOT / 'research/sports-news-source-2026-10-07.json'
REPORT = ROOT / 'research/sports-news-update-2026-10-07.json'

def main():
    data = load_catalog()
    rows = data['resources']
    sources = json.loads(SOURCE.read_text())['resources']
    before = len(rows)
    existing_urls = {canonical(row['url']) for row in rows}
    added = []
    for source in sources:
        if canonical(source['url']) in existing_urls:
            continue
        row = {key: source[key] for key in ('name', 'url', 'description', 'start', 'limit', 'aliases', 'icon')}
        row.update({'id': resource_id(row['url']), 'category': 'Чтение', 'kind': 'Новости',
                    'skills': ['Читать', 'Слова'], 'price': '', 'sections': ['reading'],
                    'subcategories': ['Чтение', 'Новости', 'Спорт'], 'dictionaryGroup': '',
                    'catalogGroup': 'all-tools-list-1',
                    'placements': [{'page': 'reading', 'group': 'reading-list-2',
                                    'order': 0, 'anchor': source['anchor']}]})
        rows.append(row)
        existing_urls.add(canonical(row['url']))
        added.append({'id': row['id'], 'name': row['name'], 'url': row['url']})
    if not added:
        print('Sports news resources are already present; original change report retained.')
        return
    sports_ids = {resource_id(source['url']) for source in sources}
    news = [(row, placement) for row in rows for placement in row['placements']
            if placement['page'] == 'reading' and placement['group'] == 'reading-list-2']
    old_news = sorted((item for item in news if item[0]['id'] not in sports_ids),
                      key=lambda item: item[1].get('order', 0))
    sports = sorted((item for item in news if item[0]['id'] in sports_ids),
                    key=lambda item: next(i for i, source in enumerate(sources)
                                          if resource_id(source['url']) == item[0]['id']))
    for order, (row, placement) in enumerate(old_news[:6] + sports + old_news[6:]):
        placement['order'] = order
    candidate = ROOT / 'content/.catalog-sports-candidate.json'
    candidate.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    load_catalog(candidate)
    candidate.replace(CATALOG)
    report = {'checkedAt': '2026-10-07', 'before': before, 'after': len(rows),
              'added': added, 'newsGroup': 'reading-list-2',
              'sportsPositions': [item[1]['order'] for item in sports]}
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
