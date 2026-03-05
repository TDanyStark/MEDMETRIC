-- Seed: 003_seed_users
-- Description: Insert demo users per role for Abbott and Addion.
--              Reps belong to an org only; manager subscriptions are in seed 004.
--
-- Passwords:
--   superadmin@medmetric.com    -> superadmin1234
--   orgadmin.abbott@demo.com    -> orgadmin1234
--   orgadmin.addion@demo.com    -> orgadmin1234
--   manager.abbott@demo.com     -> manager1234
--   manager.addion@demo.com     -> manager1234
--   rep1.abbott@demo.com        -> rep1234
--   rep2.abbott@demo.com        -> rep1234
--   rep1.addion@demo.com        -> rep1234
--   rep2.addion@demo.com        -> rep1234
--
-- Role IDs:  1=superadmin, 2=org_admin, 3=manager, 4=rep
-- Org IDs:   1=Abbott, 2=Addion

INSERT INTO `users` (`id`, `organization_id`, `role_id`, `name`, `email`, `password_hash`, `active`) VALUES
    -- Superadmin (no organization - global access)
    (1, NULL, 1, 'Super Admin',           'superadmin@medmetric.com',    '$2y$10$eoNF4H.MojZFqiIh8eKdy..w0k0KiCQuaG5FAg5yfAAF6o09cSvxG', 1),

    -- Org Admins (one per organization)
    (2, 1, 2, 'Admin Abbott',          'orgadmin.abbott@demo.com',    '$2y$10$I.OJps4J61j63NeBHeSqz.CdfPKm0zCNWiFda3fNqjRqDOMClY5AC', 1),
    (3, 2, 2, 'Admin Addion',          'orgadmin.addion@demo.com',    '$2y$10$I.OJps4J61j63NeBHeSqz.CdfPKm0zCNWiFda3fNqjRqDOMClY5AC', 1),

    -- Managers
    (4, 1, 3, 'Gerente Abbott',        'manager.abbott@demo.com',     '$2y$10$rP6DQS6p6K2Cx.3wVX4KRedR37Cgior1e4thOqEL5FyHdK0fjfHxe', 1),
    (5, 2, 3, 'Gerente Addion',        'manager.addion@demo.com',     '$2y$10$rP6DQS6p6K2Cx.3wVX4KRedR37Cgior1e4thOqEL5FyHdK0fjfHxe', 1),

    -- Reps Abbott
    (6, 1, 4, 'Visitador Abbott 1',    'rep1.abbott@demo.com',        '$2y$10$46/IgYvKQKw46o/8F1MI6eu9QHayGzuMkbvA8yGlO4.a8ApqcuhT6', 1),
    (7, 1, 4, 'Visitador Abbott 2',    'rep2.abbott@demo.com',        '$2y$10$46/IgYvKQKw46o/8F1MI6eu9QHayGzuMkbvA8yGlO4.a8ApqcuhT6', 1),

    -- Reps Addion
    (8, 2, 4, 'Visitador Addion 1',    'rep1.addion@demo.com',        '$2y$10$46/IgYvKQKw46o/8F1MI6eu9QHayGzuMkbvA8yGlO4.a8ApqcuhT6', 1),
    (9, 2, 4, 'Visitador Addion 2',    'rep2.addion@demo.com',        '$2y$10$46/IgYvKQKw46o/8F1MI6eu9QHayGzuMkbvA8yGlO4.a8ApqcuhT6', 1)

ON DUPLICATE KEY UPDATE
    `name`          = VALUES(`name`),
    `password_hash` = VALUES(`password_hash`),
    `active`        = VALUES(`active`);
