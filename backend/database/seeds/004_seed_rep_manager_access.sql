-- Seed: 004_seed_rep_manager_access
-- Description: Subscribe demo reps to their respective managers.
--              Both reps of Abbott are subscribed to the Abbott manager.
--              Both reps of Addion are subscribed to the Addion manager.
--
-- User IDs:
--   2 = Gerente Abbott   (org 1)
--   3 = Gerente Addion   (org 2)
--   4 = Visitador Abbott 1 (org 1)
--   5 = Visitador Abbott 2 (org 1)
--   6 = Visitador Addion 1 (org 2)
--   7 = Visitador Addion 2 (org 2)

INSERT INTO `rep_manager_access` (`rep_id`, `manager_id`, `active`) VALUES
    (4, 2, 1),  -- Visitador Abbott 1 -> Gerente Abbott
    (5, 2, 1),  -- Visitador Abbott 2 -> Gerente Abbott
    (6, 3, 1),  -- Visitador Addion 1 -> Gerente Addion
    (7, 3, 1)   -- Visitador Addion 2 -> Gerente Addion
ON DUPLICATE KEY UPDATE `active` = VALUES(`active`);
