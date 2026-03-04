-- Seed: 001_seed_roles
-- Description: Insert base roles for RBAC

INSERT INTO `roles` (`id`, `name`, `description`) VALUES
    (1, 'admin',   'Platform administrator with full access'),
    (2, 'manager', 'Organization manager who creates brands and materials'),
    (3, 'rep',     'Medical representative who distributes materials during visits')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);
