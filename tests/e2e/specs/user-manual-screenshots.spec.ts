/**
 * Kullanım kılavuzu ekran görüntüleri — docs/user-manual/screenshots/
 *
 * Çalıştırma (prod örneği):
 *   CCC_BASE_URL=https://yenitim.tire.bel.tr \
 *   MANUAL_SCREENSHOT_USER=operator MANUAL_SCREENSHOT_PASS='...' \
 *   npx playwright test specs/user-manual-screenshots.spec.ts
 */
import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve(__dirname, '../../../docs/user-manual/screenshots')
const USER = process.env.MANUAL_SCREENSHOT_USER ?? 'operator'
const PASS = process.env.MANUAL_SCREENSHOT_PASS ?? ''

async function login(page: Page) {
  test.skip(!PASS, 'MANUAL_SCREENSHOT_PASS gerekli')
  await page.addInitScript(() => {
    window.localStorage.setItem('ccc_language', 'tr')
  })
  await page.goto('/login')
  await page.locator('#username').fill(USER)
  await page.locator('#password').fill(PASS)
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  await expect(page).toHaveURL(/\/(dashboard|settings|my-tasks|citizen-directory)/, { timeout: 30_000 })
  await page.waitForTimeout(800)
}

async function shot(page: Page, fileName: string, fullPage = true) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(OUT_DIR, fileName), fullPage, animations: 'disabled' })
}

async function gotoAndShot(page: Page, url: string, fileName: string) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 }).catch(async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  })
  await page.waitForTimeout(600)
  await shot(page, fileName)
}

test.describe.configure({ mode: 'serial' })

test('kullanım kılavuzu ekran görüntüleri', async ({ page }) => {
  test.setTimeout(600_000)

  await login(page)

  // —— Ana sayfalar ——
  await gotoAndShot(page, '/dashboard/birimler', '01-anasayfa-birimler.png')
  await gotoAndShot(page, '/dashboard', '02-anasayfa-vatandas.png')
  await gotoAndShot(page, '/citizen-directory', '03-vatandas-bilgi-listesi.png')
  await gotoAndShot(page, '/requests/new', '04-talep-olustur-secim.png')
  await gotoAndShot(page, '/requests/new?kind=internal', '05-talep-olustur-birim-ici.png')
  await gotoAndShot(page, '/requests/new?kind=external', '06-talep-olustur-birim-disi.png')
  await gotoAndShot(page, '/requests/new?kind=citizen', '07-talep-olustur-vatandas.png')
  await gotoAndShot(page, '/my-requests?view=pending', '08-taleplerim.png')
  await gotoAndShot(page, '/incoming-requests?kind=all', '09-birime-gelen-talepler.png')
  await gotoAndShot(page, '/outgoing-requests', '10-birimden-giden-talepler.png')
  await gotoAndShot(page, '/my-tasks?view=pending', '11-gorevlerim.png')
  await gotoAndShot(page, '/department-tasks?flow=all', '12-birimdeki-gorevler.png')
  await gotoAndShot(page, '/routine-tasks/new', '13-rutin-gorev-olustur.png')
  await gotoAndShot(page, '/social', '14-vatandas-talepleri-sosyal.png')
  await gotoAndShot(page, '/whatsapp', '15-whatsapp-konusmalar.png')
  await gotoAndShot(page, '/sms-delivery-approval', '16-sms-onayi.png')
  await gotoAndShot(page, '/citizen-message-approval', '17-vatandasa-mesaj-onayi.png')
  await gotoAndShot(page, '/edevlet/activity-plan', '18-edevlet-faaliyet-plani-olustur.png')
  await gotoAndShot(page, '/edevlet/activity-plans', '19-edevlet-faaliyet-planlari.png')

  await gotoAndShot(page, '/display', '29-izleme-ekrani.png')

  // —— Yönetim (erişim yoksa login sayfasına düşebilir; yine de denenir) ——
  await gotoAndShot(page, '/departments', '30-birimler.png')
  await gotoAndShot(page, '/users', '31-kullanicilar.png')
  await gotoAndShot(page, '/audit', '32-denetim-kayitlari.png')
  await gotoAndShot(page, '/settings?tab=tenant', '33-ayarlar-kurum.png')
  await gotoAndShot(page, '/settings?tab=license', '34-ayarlar-lisans.png')
  await gotoAndShot(page, '/settings?tab=roles', '35-ayarlar-rol-yetkileri.png')

  // —— Giriş ekranı (logout) ——
  await page.getByRole('button', { name: 'Çıkış' }).click()
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
  await shot(page, '00-giris.png')
})

test('kullanım kılavuzu popup ekran görüntüleri', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page)

  await page.goto('/my-tasks?view=pending', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  const clickedGorev = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Detaylar')
    if (btn) { btn.click(); return true }
    return false
  })
  if (clickedGorev) {
    await page.waitForTimeout(600)

    const dialog = page.locator('[role="dialog"]').last()
    const tamamla = dialog.getByRole('button', { name: 'Tamamla', exact: true })
    if (await tamamla.isVisible().catch(() => false)) {
      await tamamla.click({ force: true })
      await page.waitForTimeout(500)
      await shot(page, '24-gorev-tamamla-modal.png', false)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }

    if (await dialog.isVisible().catch(() => false)) {
      const iptalEt = dialog.getByRole('button', { name: 'Görevi İptal Et', exact: true })
      if (await iptalEt.isVisible().catch(() => false)) {
        await iptalEt.click({ force: true })
        await page.waitForTimeout(500)
        await shot(page, '25-gorev-iptal-modal.png', false)
        await page.keyboard.press('Escape')
      }
    }

    await page.keyboard.press('Escape')
  }

  for (const view of ['pending', 'in-progress', 'all']) {
    await page.goto(`/my-tasks?view=${view}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(700)
    const opened = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Detaylar')
      if (btn) { btn.click(); return true }
      return false
    })
    if (!opened) continue

    await page.waitForTimeout(600)
    const dialog = page.locator('[role="dialog"]').last()
    const tamamla = dialog.getByRole('button', { name: 'Tamamla', exact: true })
    if (await tamamla.isVisible().catch(() => false)) {
      await tamamla.click({ force: true })
      await page.waitForTimeout(500)
      await shot(page, '24-gorev-tamamla-modal.png', false)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }
    if (await dialog.isVisible().catch(() => false)) {
      const iptalEt = dialog.getByRole('button', { name: 'Görevi İptal Et', exact: true })
      if (await iptalEt.isVisible().catch(() => false)) {
        await iptalEt.click({ force: true })
        await page.waitForTimeout(500)
        await shot(page, '25-gorev-iptal-modal.png', false)
        await page.keyboard.press('Escape')
      }
    }
    await page.keyboard.press('Escape')
    if (fs.existsSync(path.join(OUT_DIR, '24-gorev-tamamla-modal.png'))) break
  }

  await page.goto('/my-requests?view=pending', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  const clickedTalep = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Detaylar')
    if (btn) { btn.click(); return true }
    return false
  })
  if (clickedTalep) {
    await page.waitForTimeout(600)
    await shot(page, '20-talep-detay-popup.png', false)
    const duzenle = page.locator('[role="dialog"]').last().getByRole('button', { name: 'Düzenle', exact: true })
    if (await duzenle.isVisible().catch(() => false)) {
      await duzenle.click({ force: true })
      await page.waitForTimeout(500)
      await shot(page, '21-talep-detay-duzenle.png', false)
    }
    await page.keyboard.press('Escape')
  }

  for (const view of ['pending', 'approved', 'all']) {
    await page.goto(`/incoming-requests?kind=all&view=${view}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)
    const onayla = page.getByRole('button', { name: 'Onayla', exact: true }).first()
    if (await onayla.isVisible().catch(() => false)) {
      await onayla.click({ force: true })
      await page.waitForTimeout(600)
      await shot(page, '26-birime-gelen-onay-popup.png', false)
      await page.keyboard.press('Escape')
      break
    }
  }

  const kurumFab = page.getByRole('button', { name: 'Kurum İçi Mesajlar' })
  if (await kurumFab.isVisible().catch(() => false)) {
    await kurumFab.click()
    await page.waitForTimeout(700)
    await shot(page, '27-kurum-ici-mesajlar-fab.png', false)
  }

  await page.goto('/dashboard/birimler', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  const bildirim = page.getByLabel('Bildirimler', { exact: true })
  if (await bildirim.isVisible().catch(() => false)) {
    await bildirim.click()
    await page.waitForTimeout(500)
    await shot(page, '28-bildirimler-dropdown.png', false)
  }
})
