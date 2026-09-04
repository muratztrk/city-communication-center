# Ortamlar ve Branch Akışı

Hazırlanma tarihi: 4 Eylül 2026

## Karar: tek repo, iki branch

| Ortam | URL | Sunucu | Git branch | Deploy |
| --- | --- | --- | --- | --- |
| **Test** | https://testtim.tire.bel.tr | `192.168.0.37` | `develop` | `./deploy-test.sh` |
| **Prod** | https://yenitim.tire.bel.tr | `192.168.0.36` | `main` | `./deploy.sh` |

Ayrı `city-communication-center-demo` repo **testtim için artık kullanılmaz** (eski demo/Lumespec senkronu; drift riski). Test ve prod aynı repoda kalır.

## Günlük akış

1. **`develop` üzerinde geliştir** (veya kısa ömürlü feature branch → `develop` merge).
2. Build/lint yeşil → **`git push origin develop`**.
3. VPN ile test sunucusuna erişim → **`./deploy-test.sh`** (yalnızca `develop` checkout'ından).
4. testtim'de manuel QA.
5. Onay sonrası **`./scripts/promote-develop-to-main.sh`** → `main`/`master` push + **`./deploy.sh`** (prod).

Acil hotfix gerekiyorsa: `main`'den küçük düzeltme → prod deploy → aynı commit'i `develop`'a merge/rebase (drift önleme).

## İlk kurulum (test sunucusu)

Test sunucusunda repo yoksa veya eski `main` checkout'u varsa (VPN gerekir):

```bash
ssh tim@192.168.0.37
sudo mkdir -p /opt/city-communication-center
sudo chown tim:tim /opt/city-communication-center
git clone https://github.com/muratztrk/city-communication-center.git \
  /opt/city-communication-center/city-communication-center
cd /opt/city-communication-center/city-communication-center
git checkout develop
# .env prod benzeri test secret'ları ile doldurulmalı
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Yerel makineden güncel `develop` deploy:

```bash
git checkout develop
git pull origin develop
./deploy-test.sh
```

## Agent / Trello notu

- **Test aşaması:** push hedefi `develop`; prod'a doğrudan push yok.
- **Prod aşaması:** yalnızca test onayı sonrası `promote-develop-to-main.sh` veya kontrollü `main` merge.

## Veritabanı

Test ve prod **ayrı PostgreSQL volume** kullanır. Testte silme/purge güvenlidir; prod verisi `.36`'dadır.

## SMS (testtim)

Test ortamında gerçek SMS gönderimi **kapalı** olmalıdır. Sunucu `.env` dosyasında:

```bash
CCC_SMS_LIVE_SEND_ENABLED=false
```

Bu ayar `Sms:LiveSendEnabled=false` olarak API'ye geçer; sağlayıcıya çıkılmaz, denemeler simülasyon olarak loglanır (Test SMS dahil). Prod `.env`'de bu satır yok veya `true` olmalıdır.
