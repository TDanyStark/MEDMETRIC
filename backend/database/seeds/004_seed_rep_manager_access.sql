-- Seed: 004_seed_rep_manager_access
-- Description: Subscribe demo reps to their respective managers.
--              Both reps of Abbott are subscribed to the Abbott manager.
--              Both reps of Addion are subscribed to the Addion manager.
--
-- User IDs:
--   4 = Gerente Abbott      (org 1)
--   5 = Gerente Addion      (org 2)
--   6 = Visitador Abbott 1  (org 1)
--   7 = Visitador Abbott 2  (org 1)
--   8 = Visitador Addion 1  (org 2)
--   9 = Visitador Addion 2  (org 2)

INSERT INTO `rep_manager_access` (`rep_id`, `manager_id`, `active`) VALUES
    (6, 4, 1),  -- Visitador Abbott 1 -> Gerente Abbott
    (7, 4, 1),  -- Visitador Abbott 2 -> Gerente Abbott
    (8, 5, 1),  -- Visitador Addion 1 -> Gerente Addion
    (9, 5, 1)   -- Visitador Addion 2 -> Gerente Addion
ON DUPLICATE KEY UPDATE `active` = VALUES(`active`);
