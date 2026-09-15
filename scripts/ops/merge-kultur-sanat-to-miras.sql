-- Birim birlestirme: Kultur Sanat ve Sosyal Isler Birimi -> Kulturel Miras Koruma Mudurlugu
-- Canli: 2026-09-15 (manuel operasyon scripti)

BEGIN;

UPDATE jobdepartments
SET departmentid = '0f6797d1-9421-426f-b641-14a06951422c'::uuid,
    updatedatutc = NOW()
WHERE departmentid = 'c32ebcf4-736f-455d-ab93-53e53f0fd33b'::uuid;

UPDATE socialmessages
SET assigneddepartmentid = '0f6797d1-9421-426f-b641-14a06951422c'::uuid,
    updatedatutc = NOW()
WHERE assigneddepartmentid = 'c32ebcf4-736f-455d-ab93-53e53f0fd33b'::uuid;

UPDATE users
SET departmentid = '0f6797d1-9421-426f-b641-14a06951422c'::uuid,
    updatedatutc = NOW()
WHERE departmentid = 'c32ebcf4-736f-455d-ab93-53e53f0fd33b'::uuid;

DELETE FROM userdepartmentassignments
WHERE departmentid = 'c32ebcf4-736f-455d-ab93-53e53f0fd33b'::uuid;

UPDATE tasks
SET assigneddepartmentid = '0f6797d1-9421-426f-b641-14a06951422c'::uuid,
    updatedatutc = NOW()
WHERE assigneddepartmentid = 'c32ebcf4-736f-455d-ab93-53e53f0fd33b'::uuid;

UPDATE assignmenthistory
SET fromdepartmentid = '0f6797d1-9421-426f-b641-14a06951422c'::uuid
WHERE fromdepartmentid = 'c32ebcf4-736f-455d-ab93-53e53f0fd33b'::uuid;

UPDATE assignmenthistory
SET todepartmentid = '0f6797d1-9421-426f-b641-14a06951422c'::uuid
WHERE todepartmentid = 'c32ebcf4-736f-455d-ab93-53e53f0fd33b'::uuid;

DELETE FROM routingrules
WHERE targetdepartmentid = 'c32ebcf4-736f-455d-ab93-53e53f0fd33b'::uuid;

UPDATE departments
SET parentdepartmentid = NULL
WHERE parentdepartmentid = 'c32ebcf4-736f-455d-ab93-53e53f0fd33b'::uuid;

INSERT INTO auditlogs (
  auditlogid, tenantid, entitytype, entityid, action, actoruserid, eventtimeutc, details, createdatutc
)
SELECT
  gen_random_uuid(),
  d.tenantid,
  'Department',
  'c32ebcf4-736f-455d-ab93-53e53f0fd33b',
  'DepartmentMerged',
  NULL,
  NOW(),
  'Birim birlestirme: Kültür Sanat ve Sosyal İşler Birimi -> Kültürel Miras Koruma Müdürlüğü. Kullanici/talep/mesaj kayitlari tasindi, kaynak birim silindi.',
  NOW()
FROM departments d
WHERE d.departmentid = 'c32ebcf4-736f-455d-ab93-53e53f0fd33b'::uuid;

DELETE FROM departments
WHERE departmentid = 'c32ebcf4-736f-455d-ab93-53e53f0fd33b'::uuid;

COMMIT;
