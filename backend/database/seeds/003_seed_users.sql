-- Seed: 003_seed_users
-- Description: Insert demo users per role for Abbott and Addion.
--              Reps belong to an org only; manager subscriptions are in seed 004.
--
-- Passwords (bcrypt, cost 10):
--   admin@medmetric.com      -> admin1234
--   manager.abbott@demo.com  -> manager1234
--   manager.addion@demo.com  -> manager1234
--   rep1.abbott@demo.com     -> rep1234
--   rep2.abbott@demo.com     -> rep1234
--   rep1.addion@demo.com     -> rep1234
--   rep2.addion@demo.com     -> rep1234
--
-- Role IDs:  1=admin, 2=manager, 3=rep
-- Org IDs:   1=Abbott, 2=Addion

INSERT INTO `users` (`id`, `organization_id`, `role_id`, `name`, `email`, `password_hash`, `active`) VALUES
    -- Admin (org 1 as default, has global access)
    (1, 1, 1, 'Admin Sistema',      'admin@medmetric.com',       '$2y$10$FlijpuJ.V2wuDmERv7vOteS7mKdiT6m4sr8mqR3WhMwe8Vzg2azkO', 1),

    -- Managers
    (2, 1, 2, 'Gerente Abbott',     'manager.abbott@demo.com',   '$2y$10$LLaJwKzrg5cBacCbBeSK8O/guZz0BouIa3qzTPs0TxiVwy3YT0mlq', 1),
    (3, 2, 2, 'Gerente Addion',     'manager.addion@demo.com',   '$2y$10$LLaJwKzrg5cBacCbBeSK8O/guZz0BouIa3qzTPs0TxiVwy3YT0mlq', 1),

    -- Reps Abbott
    (4, 1, 3, 'Visitador Abbott 1', 'rep1.abbott@demo.com',      '$2y$10$0fDWAR.T5OK8HpByy0X/meA3ByaFTroHb7uSRjR1CY.7bzFRAHImy', 1),
    (5, 1, 3, 'Visitador Abbott 2', 'rep2.abbott@demo.com',      '$2y$10$0fDWAR.T5OK8HpByy0X/meA3ByaFTroHb7uSRjR1CY.7bzFRAHImy', 1),

    -- Reps Addion
    (6, 2, 3, 'Visitador Addion 1', 'rep1.addion@demo.com',      '$2y$10$0fDWAR.T5OK8HpByy0X/meA3ByaFTroHb7uSRjR1CY.7bzFRAHImy', 1),
    (7, 2, 3, 'Visitador Addion 2', 'rep2.addion@demo.com',      '$2y$10$0fDWAR.T5OK8HpByy0X/meA3ByaFTroHb7uSRjR1CY.7bzFRAHImy', 1)

ON DUPLICATE KEY UPDATE
    `name`          = VALUES(`name`),
    `password_hash` = VALUES(`password_hash`),
    `active`        = VALUES(`active`);
