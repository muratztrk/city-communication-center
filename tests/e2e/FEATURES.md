# Feature Inventory And Scenarios

## Auth

- Login ekrani tenant baglamini custom domain veya tek-tenant resolution ile otomatik cozebilmelidir.
- Tek tenant kurulumunda tenant selector gizlenmeli, kurum baglami dogrudan gosterilmelidir.
- `/connect/token` password grant explicit `tenant_id` ile calismalidir.
- Tek tenant kurulumunda `/connect/token` `tenant_id` olmadan tenant auto resolution yapabilmelidir.
- Trusted network ve external network interactive auth akislari frontend'de ayri semantiklerle gorunmelidir.
- Invalid login anlamli hata gostermelidir.
- Reload session'i korumali, logout local storage auth state'ini temizlemelidir.

## Dashboard

- Ozet kartlari API snapshot ile render edilmelidir.
- Login sonrasi dashboard acilabilmeli ve ana navigasyona gecis saglam kalmalidir.

## Tasks

- Task listesi artik scope bazli calisir: `mine`, `department-pool`, `pending-approval`, `all`.
- Frontend yeni task summary alanlarini tuketir: `TargetDepartmentName`, `AssignedDepartmentName`, `AssignedUserDisplayName`.
- Manuel task create akisi desteklenen enum degerleriyle korunur.
- Approval gereken task'lar `PendingApproval` olur.
- Manager onayladigi task'i `pending-approval` scope'undan kaybettikten sonra `all` scope'unda gorebilmelidir.
- Department pool task'lari `claim` aksiyonu ile staff tarafindan ustlenilebilmelidir.
- Manager'i olmayan hedef departman icin submit sonrasi task dogrudan `Assigned` olur.
- Assign/reassign akisi manager/system-admin tarafinda korunur.
- Atama hedefleri tamamen temizlenirse backend validation UI'da gorulmelidir.
- Rejected ve completed kayitlar uygun roller tarafindan kapatilabilmelidir.

## Social Messages

- Mesaj listesi bos durumda hata vermeden render edilir.
- Route aksiyonu mesaji sadece departmana yonlendirir; kullanici atamasi gorev workflow'unda sonra yapilir.
- Convert-to-task akisi API shape ile uyumlu kalir.
- Sosyal mesajdan dogan task yeni scope modelinde gorev ekraninda gorunmeye devam eder.

## Departments

- Seed departmanlar render edilir.
- Yeni departman create akisi tabloya aninda yansir.

## Users

- Kullanici listesi rol, departman, kaynak ve aktiflik alanlarini gosterir.
- Yerel kullanici olusturma akisi username/password ile tamamlanir.
- LDAP onboarding explicit admin linking semantigiyle anlatilir; login-time auto-provision vaadi kalmaz.
- LDAP dizin aramasinda bagli olmayan kayitlar secilip uygulamaya baglanabilir.

## Audit

- Audit tablosu bos durumda dahi saglikli render olur.

## Settings

- Settings navigasyonu yalnizca `SystemAdmin` icin gorunur.
- `Manager` token'i admin endpoint'lerinde `403` alir.
- LDAP ayarlari bolumu explicit admin onboarding notu icerir ve auto-provision kontrolu gostermez.
- Kimlik politikasi, sosyal ayarlar ve routing sekmeleri birlikte calisir.
- Tab secimi URL query state ile korunur.

## End-To-End Workflow Summary

- `auth-navigation.spec.ts`: tenant resolution, token contract, navigation, invalid login, session durability
- `adaptive-auth.spec.ts`: trusted-header/trusted-network ve dis-ag second-factor varyantlari
- `admin-surfaces.spec.ts`: dashboard, departments, users temel admin yuzeyleri
- `user-management.spec.ts`: local user creation, explicit LDAP linking, source badge dogrulamasi
- `settings.spec.ts`: settings visibility, LDAP onboarding copy, manager authorization guard
- `routing-settings.spec.ts`: routing CRUD ve test endpoint coverage
- `social-task-flow.spec.ts`: department-level social message routing, task conversion, manager approval, explicit assignment, completion, closure
- `task-workflow.spec.ts`: manual approval, department-pool claim, rejection branch, direct assignment, assignment validation, department-filtered assignee listesi

Environment note: Playwright config repo root `.env` dosyasini auto-load eder; `CCC_INITIAL_PASSWORD` ve host/port varsayimlari docker-compose ile hizalidir.
