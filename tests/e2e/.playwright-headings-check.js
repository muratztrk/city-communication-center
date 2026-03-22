const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("http://localhost:13000");
  await page.getByLabel(/Municipality|Belediye/).selectOption("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");
  await page.getByLabel(/Username|Kullanıcı Adı/).fill("admin");
  await page.getByLabel(/Password|Şifre/).fill(process.env.CCC_INITIAL_PASSWORD || "");
  await page.getByRole("button", { name: /Sign In|Giriş Yap/ }).click();
  await page.waitForURL(/dashboard/, { timeout: 10000 });
  await page.getByRole("button", { name: /Settings|Ayarlar/ }).click();
  await page.waitForTimeout(1000);
  const headings = await page.getByRole("heading").allInnerTexts();
  const authHeadingCount = await page.getByRole("heading", { name: /Tenant authentication policy|Tenant kimlik politikası/i }).count();
  console.log(JSON.stringify(headings));
  console.log(String(authHeadingCount));
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
