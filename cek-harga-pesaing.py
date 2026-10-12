import json, re, time, urllib.request, os

TOKEN = os.environ['APIFY_TOKEN']
OBS = []


def fx(u):
    rq = urllib.request.Request(u, headers={'Authorization': 'Bearer ' + TOKEN,
                                            'Content-Type': 'application/json',
                                            'Accept': 'application/json, text/event-stream'})
    with urllib.request.urlopen(rq, timeout=60) as r:
        return json.load(r)


# === A. pesaing Google Maps di segmen "lead": harganya berapa? ===
for kw in ['google maps email leads', 'google maps scraper']:
    try:
        d = fx('https://api.apify.com/v2/store?search=' + urllib.parse.quote(kw) + '&limit=50')['data']
    except Exception as e:
        print(kw, 'ERR', e)
        continue
    items = (d.get('data', {}).get('items') if isinstance(d.get('data'), dict) else d.get('items')) or []
    print('=== ' + kw)
    for a in sorted(items, key=lambda x: -(((x.get('stats') or {}).get('totalUsers30Days') or 0)))[:9]:
        st = a.get('stats') or {}
        pi = a.get('currentPricingInfo') or {}
        ev = ((pi.get('pricingPerEvent') or {}).get('actorChargeEvents') or {})
        harga = []
        for k, v in list(ev.items())[:3]:
            har = (v.get('eventTieredPricingUsd') or {}).get('FREE', {}).get('tieredEventPriceUsd')
            if har is None:
                har = v.get('eventPriceUsd')
            harga.append(f"{v.get('eventTitle') or k}={har}")
        obs = {
            'kw': kw, 'actor': a['username'] + '/' + a['name'],
            'u30': st.get('totalUsers30Days'), 'users': st.get('totalUsers'),
            'model': pi.get('pricingModel'), 'harga': harga,
        }
        OBS.append(obs)
        print(f"  u30={obs['u30']:>5} users={str(obs['users']):>6} {obs['model']:<14} {'; '.join(harga)[:80]}  {obs['actor'][:44]}")
    print()

with open('harga-gmaps.json', 'w', encoding='utf-8') as f:
    json.dump(OBS, f, ensure_ascii=False, indent=1)
print('disimpan:', len(OBS), 'observasi')
