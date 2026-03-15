-- Fix Tire department names
UPDATE Departments SET Name = N'Yazı İşleri Müdürlüğü' WHERE DepartmentId = 'A632DDC9-E03B-4428-93B8-36904D66F5C6';
UPDATE Departments SET Name = N'Fen İşleri Müdürlüğü' WHERE DepartmentId = '0E29FB34-64DA-429E-B7C0-E6016A0C10A7';

-- Add Tire users
DECLARE @TireTenantId UNIQUEIDENTIFIER = 'B2C3D4E5-F6A7-5B6C-9D0E-1F2A3B4C5D6E';
DECLARE @TireDept1 UNIQUEIDENTIFIER = 'A632DDC9-E03B-4428-93B8-36904D66F5C6';
DECLARE @TireDept2 UNIQUEIDENTIFIER = '0E29FB34-64DA-429E-B7C0-E6016A0C10A7';

-- Tire: Yazı İşleri - Müdür and Staff
DECLARE @TireYM UNIQUEIDENTIFIER = NEWID();
DECLARE @TireYC1 UNIQUEIDENTIFIER = NEWID();

INSERT INTO Users (UserId, TenantId, DepartmentId, DisplayName, Email, RoleCode, IsActive, ManagerUserId, CreatedAtUtc)
VALUES (@TireYM, @TireTenantId, @TireDept1, N'Ali Yıldız', 'ali.yildiz@tire.bel.tr', 'DepartmentHead', 1, NULL, GETUTCDATE());

INSERT INTO Users (UserId, TenantId, DepartmentId, DisplayName, Email, RoleCode, IsActive, ManagerUserId, CreatedAtUtc)
VALUES (@TireYC1, @TireTenantId, @TireDept1, N'Selin Aydın', 'selin.aydin@tire.bel.tr', 'Staff', 1, @TireYM, GETUTCDATE());

-- Tire: Fen İşleri - Müdür and Staff
DECLARE @TireFM UNIQUEIDENTIFIER = NEWID();
DECLARE @TireFC1 UNIQUEIDENTIFIER = NEWID();

INSERT INTO Users (UserId, TenantId, DepartmentId, DisplayName, Email, RoleCode, IsActive, ManagerUserId, CreatedAtUtc)
VALUES (@TireFM, @TireTenantId, @TireDept2, N'Zeynep Kara', 'zeynep.kara@tire.bel.tr', 'DepartmentHead', 1, NULL, GETUTCDATE());

INSERT INTO Users (UserId, TenantId, DepartmentId, DisplayName, Email, RoleCode, IsActive, ManagerUserId, CreatedAtUtc)
VALUES (@TireFC1, @TireTenantId, @TireDept2, N'Emre Çelik', 'emre.celik@tire.bel.tr', 'Staff', 1, @TireFM, GETUTCDATE());

-- Tire: Admin
INSERT INTO Users (UserId, TenantId, DepartmentId, DisplayName, Email, RoleCode, IsActive, ManagerUserId, CreatedAtUtc)
VALUES (NEWID(), @TireTenantId, @TireDept1, N'Tire Admin', 'admin@tire.bel.tr', 'Admin', 1, NULL, GETUTCDATE());

-- Show all users with hierarchy
SELECT u.DisplayName, u.Email, u.RoleCode, 
    (SELECT m.DisplayName FROM Users m WHERE m.UserId = u.ManagerUserId) AS Yonetici
FROM Users u
ORDER BY u.TenantId, u.DepartmentId, u.RoleCode DESC;