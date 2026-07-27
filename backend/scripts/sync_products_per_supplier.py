import pymysql
import asyncpg
import asyncio
import uuid
import json
import time
import sys
sys.path.insert(0, '/www/wwwroot/Clawith/backend')
from app.services.wecom_album.szwego_client import WecomAlbumSzwegoClient, normalize_product, compute_source_hash

TENANT_ID = '5a913146-66f7-4984-ad4d-1f7b59c67504'

async def fetch_products_for_supplier(client, album_id, max_pages=50):
    all_items = []
    seen_ids = set()
    page_timestamp = ''
    for page_num in range(1, max_pages + 1):
        params = {
            'album_id': album_id,
            'searchValue': '',
            'searchImg': '',
            'noCache': 0,
            'slipType': 1,
            'requestDataType': '',
            '_t': str(int(time.time() * 1000)),
        }
        if page_timestamp:
            params['timestamp'] = page_timestamp
        try:
            data = await client._get('https://www.szwego.com/album/moments', params=params)
        except Exception:
            break
        result = data.get('result', {})
        items = result.get('items', result.get('list', []))
        if not items:
            break
        new_count = 0
        for item in items:
            gid = str(item.get('goods_id', item.get('item_id', item.get('id', ''))))
            if gid and gid not in seen_ids:
                seen_ids.add(gid)
                all_items.append(item)
                new_count += 1
        if new_count == 0:
            break
        pagination = result.get('pagination', {})
        if not pagination.get('isLoadMore', False):
            break
        next_ts = pagination.get('pageTimestamp', '')
        if not next_ts or str(next_ts) == str(page_timestamp):
            break
        page_timestamp = str(next_ts)
    return all_items

async def main():
    mysql = pymysql.connect(host='127.0.0.1', port=3306, user='lnzx', password='lnzx890610', database='lnzx', charset='utf8mb4')
    cur = mysql.cursor()
    cur.execute('SELECT token FROM lnzx_wecom_goods_config LIMIT 1')
    token = cur.fetchone()[0]
    cur.close()
    mysql.close()

    pg = await asyncpg.connect(user='aifactory', password='arW2ZMXIdCI8wjHPFSt4', database='clawith', host='127.0.0.1', port=5432)

    suppliers = await pg.fetch(
        "SELECT id, album_id, name FROM wecom_album_suppliers WHERE tenant_id = $1 AND is_active = True AND album_id IS NOT NULL AND album_id != ''",
        uuid.UUID(TENANT_ID)
    )
    print(f'Active suppliers with album_id: {len(suppliers)}')

    client = WecomAlbumSzwegoClient(token)
    total_created = 0
    total_updated = 0
    total_skipped = 0

    for s in suppliers:
        album_id = s['album_id']
        name = s['name']
        products = await fetch_products_for_supplier(client, album_id, max_pages=50)
        created = 0
        updated = 0
        skipped = 0
        for raw in products:
            norm = normalize_product(raw)
            if not norm['goods_id']:
                continue
            new_hash = compute_source_hash(raw)
            existing = await pg.fetchrow(
                'SELECT id, source_hash FROM wecom_album_products WHERE tenant_id = $1 AND goods_id = $2',
                uuid.UUID(TENANT_ID), norm['goods_id']
            )
            if existing:
                if existing['source_hash'] == new_hash:
                    skipped += 1
                    continue
                await pg.execute('''UPDATE wecom_album_products SET
                    title=$1, price=$2, images=$3::jsonb, main_image=$4, video_url=$5,
                    shop_name=$6, source_url=$7, tags=$8::jsonb, attributes=$9::jsonb,
                    source_hash=$10, szwego_created_at=$11, supplier_id=$12
                    WHERE id=$13''',
                    norm['title'], norm['price'], json.dumps(norm['images']), norm['main_image'], norm['video_url'],
                    norm['shop_name'], norm['source_url'], json.dumps(norm['tags']), json.dumps(norm['attributes']),
                    new_hash, norm['szwego_created_at'], s['id'], existing['id'])
                updated += 1
            else:
                await pg.execute('''INSERT INTO wecom_album_products
                    (id, tenant_id, supplier_id, goods_id, title, price, images, main_image, video_url,
                     shop_name, shop_id, source_url, tags, attributes, szwego_created_at, source_hash)
                    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16)''',
                    uuid.uuid4(), uuid.UUID(TENANT_ID), s['id'], norm['goods_id'],
                    norm['title'], norm['price'], json.dumps(norm['images']), norm['main_image'], norm['video_url'],
                    norm['shop_name'], norm.get('shop_id',''), norm['source_url'], json.dumps(norm['tags']), json.dumps(norm['attributes']),
                    norm['szwego_created_at'], new_hash)
                created += 1
        total_created += created
        total_updated += updated
        total_skipped += skipped
        print(f'  {name[:25]}: {len(products)} api, {created} new, {updated} up, {skipped} dup')

    print(f'\nTotal: {total_created} created, {total_updated} updated, {total_skipped} dup')
    await pg.close()

asyncio.run(main())
