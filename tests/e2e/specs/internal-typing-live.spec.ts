import { expect, test, type Page } from '@playwright/test'

const USER_A = process.env.TYPING_TEST_USER_A ?? 'operator'
const PASS_A = process.env.TYPING_TEST_PASS_A ?? ''
const USER_B = process.env.TYPING_TEST_USER_B ?? 'lumespec'
const PASS_B = process.env.TYPING_TEST_PASS_B ?? ''

async function loginProd(page: Page, username: string, password: string) {
  await page.addInitScript(() => {
    window.localStorage.setItem('ccc_language', 'tr')
  })
  await page.goto('/')
  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  await expect(page).toHaveURL(/\/(dashboard|settings)/, { timeout: 20_000 })
}

test.describe.configure({ mode: 'serial' })

test('kurum içi yazıyor göstergesi — canlı iki oturum', async ({ browser }) => {
  test.setTimeout(120_000)
  test.skip(!PASS_A || !PASS_B, 'TYPING_TEST_PASS_A/B env gerekli')

  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  const typingPosts: string[] = []
  pageA.on('request', req => {
    if (req.url().includes('/internal-messages/typing') && req.method() === 'POST') {
      typingPosts.push(req.postData() ?? '')
    }
  })

  await loginProd(pageA, USER_A, PASS_A)
  await loginProd(pageB, USER_B, PASS_B)

  const openFab = async (page: typeof pageA) => {
    const fab = page.locator('.internal-messages-fab > button')
    await fab.scrollIntoViewIfNeeded()
    await fab.click()
    await expect(page.locator('.internal-messages-fab-panel')).toBeVisible({ timeout: 15_000 })
  }

  const openChatWith = async (page: typeof pageA, searchQuery: string, displayName?: string) => {
    await page.getByPlaceholder(/personel adı/i).fill(searchQuery)
    const row = displayName
      ? page.locator('.internal-messages-fab-panel div.min-h-0.flex-1.overflow-y-auto button').filter({ hasText: displayName }).first()
      : page.locator('.internal-messages-fab-panel div.min-h-0.flex-1.overflow-y-auto button').first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.click()
    await expect(page.getByPlaceholder(/mesaj yazın/i)).toBeVisible({ timeout: 15_000 })
  }

  await openFab(pageA)
  await openFab(pageB)

  await openChatWith(pageA, 'lumespec', 'lumespec')
  await openChatWith(pageB, 'Operatör', 'Vatandaş Operatörü')

  const userA = await pageA.evaluate(() => JSON.parse(localStorage.getItem('ccc_user') || '{}'))
  const userB = await pageB.evaluate(() => JSON.parse(localStorage.getItem('ccc_user') || '{}'))
  console.log('userA:', userA.userId, userA.displayName)
  console.log('userB:', userB.userId, userB.displayName)

  // SignalR bağlantısı için kısa bekleme
  await pageA.waitForTimeout(2500)
  await pageB.waitForTimeout(2500)

  const inputA = pageA.getByPlaceholder(/mesaj yazın/i)
  await inputA.click()
  await inputA.fill('canlı yazıyor testi — henüz gönderilmedi')

  // debounce 200ms + heartbeat
  await pageB.waitForTimeout(1500)

  const indicator = pageB.locator('.internal-messages-typing-indicator')
  const indicatorVisible = await indicator.isVisible()
  const indicatorText = indicatorVisible ? await indicator.innerText() : ''

  console.log('typing POST count (A):', typingPosts.length)
  console.log('typing POST bodies:', typingPosts.slice(0, 3))
  console.log('indicator visible (B):', indicatorVisible)
  console.log('indicator text (B):', indicatorText)

  await expect(indicator, 'Karşı tarafta Yazıyor göstergesi görünmeli').toBeVisible({ timeout: 8_000 })

  await contextA.close()
  await contextB.close()
})
