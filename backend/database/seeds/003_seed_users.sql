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
--   admin@steincares.com        -> KaRdgd3DBK6IbUs
--   jane.navarro@steincares.com -> jane26navarro
--   alvaro.sandoval@steincares.com   -> alvaro26
--   claudia.fernandez@steincares.com -> claudia26
--   johanna.jofre@steincares.com     -> johanna26
--   joel.hidalgo@steincares.com      -> hidalgo26
--   javiera.rivera@steincares.com    -> javiera26
--   gerente.*@steincares.com    -> 12345678
--
-- Role IDs:  1=superadmin, 2=org_admin, 3=manager, 4=rep
-- Org IDs:   1=Abbott, 2=Addion, 3=Steincares CL

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
    (9, 2, 4, 'Visitador Addion 2',    'rep2.addion@demo.com',        '$2y$10$46/IgYvKQKw46o/8F1MI6eu9QHayGzuMkbvA8yGlO4.a8ApqcuhT6', 1),

    -- Org Admin Steincares CL
    (10, 3, 2, 'Org Admin Steincares', 'admin@steincares.com',        '$2y$10$a6fNjDVJkgRDzVCD1we2ZeszE1QcperJnN3tznClDpKRpPPvJfY1C', 1),

    -- Managers Steincares CL
    (11, 3, 3, 'Jane Navarro',         'jane.navarro@steincares.com', '$2y$10$An4SLrQARek2/CLKMID17eH2BxqAQJShSu9FbgMgScAKqXRKjMxfm', 1),
    (17, 3, 3, 'Gerente Monofer',      'gerente.monofer@steincares.com', '$2y$10$67pkmwJXgsBRkZ1lKQfyIu2xGEQ27a30gHHaT5vQKe6wy7itiL3ni', 1),
    (18, 3, 3, 'Gerente Oramorph',     'gerente.oramorph@steincares.com', '$2y$10$67pkmwJXgsBRkZ1lKQfyIu2xGEQ27a30gHHaT5vQKe6wy7itiL3ni', 1),
    (19, 3, 3, 'Gerente Metoject',     'gerente.metoject@steincares.com', '$2y$10$67pkmwJXgsBRkZ1lKQfyIu2xGEQ27a30gHHaT5vQKe6wy7itiL3ni', 1),
    (20, 3, 3, 'Gerente Spectrila',    'gerente.spectrila@steincares.com', '$2y$10$67pkmwJXgsBRkZ1lKQfyIu2xGEQ27a30gHHaT5vQKe6wy7itiL3ni', 1),
    (21, 3, 3, 'Gerente Metadona',     'gerente.metadona@steincares.com', '$2y$10$67pkmwJXgsBRkZ1lKQfyIu2xGEQ27a30gHHaT5vQKe6wy7itiL3ni', 1),

    -- Reps Steincares CL
    (12, 3, 4, 'Alvaro Sandoval',      'alvaro.sandoval@steincares.com', '$2y$10$f4bArrURsZbS4OpNQIDaCuvBbBJ/672whmPlCtFlpFDE.Zhsn4OrO', 1),
    (13, 3, 4, 'Claudia Fernandez',    'claudia.fernandez@steincares.com', '$2y$10$zaCF8cqgYkngEE9n4evUkOe3NphAGHOK4ozpCGSzZ4ClivqpThasu', 1),
    (14, 3, 4, 'Johanna Jofre',        'johanna.jofre@steincares.com', '$2y$10$lfCva/kTT3i.umz2Fp5rYOZMoSwqsLZKKuTWniDITDS6mDVbWgrTW', 1),
    (15, 3, 4, 'Joel Hidalgo',         'joel.hidalgo@steincares.com', '$2y$10$72MnATvWUmKVEGVq8nIVx.63Fx4nk..nX/15ZPMrK1jc/bZKtkx4C', 1),
    (16, 3, 4, 'Javiera Rivera',       'javiera.rivera@steincares.com', '$2y$10$1tMeiJRS1I92DAGdolx3le6nU8BIgi/33OnXMlWKFl5ipb2xIvoQG', 1)

ON DUPLICATE KEY UPDATE
    `name`          = VALUES(`name`),
    `password_hash` = VALUES(`password_hash`),
    `active`        = VALUES(`active`);
