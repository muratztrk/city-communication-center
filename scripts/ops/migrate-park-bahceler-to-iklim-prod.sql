-- Park ve Bahçeler Birimi → İklim Değişikliği ve Sıfır Atık Müdürlüğü (prod #3472)
-- Tire Belediyesi tenant: b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e
-- Park:  ad89f863-efa1-4f45-a44a-bec99199510d
-- İklim: 7c6d06b4-f4fa-431b-86f5-5fcd2bcdf897

BEGIN;

-- 1) Talep hedef birim bağlantıları
UPDATE jobdepartments
SET departmentid = '7c6d06b4-f4fa-431b-86f5-5fcd2bcdf897'
WHERE departmentid = 'ad89f863-efa1-4f45-a44a-bec99199510d';

-- 2) Görevler
UPDATE tasks
SET assigneddepartmentid = '7c6d06b4-f4fa-431b-86f5-5fcd2bcdf897',
    updatedatutc = NOW()
WHERE assigneddepartmentid = 'ad89f863-efa1-4f45-a44a-bec99199510d';

-- 3) Sosyal mesajlar
UPDATE socialmessages
SET assigneddepartmentid = '7c6d06b4-f4fa-431b-86f5-5fcd2bcdf897',
    updatedatutc = NOW()
WHERE assigneddepartmentid = 'ad89f863-efa1-4f45-a44a-bec99199510d';

-- 4) Atama geçmişi
UPDATE assignmenthistory
SET todepartmentid = '7c6d06b4-f4fa-431b-86f5-5fcd2bcdf897'
WHERE todepartmentid = 'ad89f863-efa1-4f45-a44a-bec99199510d';

UPDATE assignmenthistory
SET fromdepartmentid = '7c6d06b4-f4fa-431b-86f5-5fcd2bcdf897'
WHERE fromdepartmentid = 'ad89f863-efa1-4f45-a44a-bec99199510d';

-- 5) Kullanıcı birincil birimleri
UPDATE users
SET departmentid = '7c6d06b4-f4fa-431b-86f5-5fcd2bcdf897',
    updatedatutc = NOW()
WHERE departmentid = 'ad89f863-efa1-4f45-a44a-bec99199510d';

-- 6) Park ek birim atamalarını kaldır
DELETE FROM userdepartmentassignments
WHERE departmentid = 'ad89f863-efa1-4f45-a44a-bec99199510d';

-- 7) Birincil birimi İklim olan kullanıcıların gereksiz İklim ek atamasını kaldır
DELETE FROM userdepartmentassignments uda
WHERE uda.departmentid = '7c6d06b4-f4fa-431b-86f5-5fcd2bcdf897'
  AND uda.isprimary = false
  AND EXISTS (
    SELECT 1
    FROM users u
    WHERE u.userid = uda.userid
      AND u.departmentid = '7c6d06b4-f4fa-431b-86f5-5fcd2bcdf897'
  );

-- 8) Denetim kaydı
INSERT INTO auditlogs (
    auditlogid,
    tenantid,
    entitytype,
    entityid,
    action,
    actoruserid,
    eventtimeutc,
    details,
    createdatutc
) VALUES (
    gen_random_uuid(),
    'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e',
    'Department',
    'ad89f863-efa1-4f45-a44a-bec99199510d',
    'DepartmentDeleted',
    NULL,
    NOW(),
    'Park ve Bahçeler Birimi talepleri İklim Değişikliği ve Sıfır Atık Müdürlüğü''ne aktarıldı; birim silindi (ops migrasyon #3472).',
    NOW()
);

-- 9) Birimi sil
DELETE FROM departments
WHERE departmentid = 'ad89f863-efa1-4f45-a44a-bec99199510d';

COMMIT;
