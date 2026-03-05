-- Seed: 001_seed_roles
-- Description: Insert base roles for RBAC
-- Roles: 1=superadmin, 2=org_admin, 3=manager, 4=rep

INSERT INTO `roles` (`id`, `name`, `description`) VALUES
    (1, 'superadmin', 'Platform super administrator with full access to all organizations'),
    (2, 'org_admin',  'Organization administrator who manages their assigned organization'),
    (3, 'manager',    'Organization manager who creates materials and manages reps'),
    (4, 'rep',        'Medical representative who distributes materials during visits')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);
