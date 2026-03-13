-- Seed: 002_seed_organizations
-- Description: Insert demo organizations

INSERT INTO `organizations` (`id`, `name`, `slug`, `active`) VALUES
    (1, 'Abbott',  'abbott',  1),
    (2, 'Addion',  'addion',  1),
    (3, 'Steincares CL', 'steincares-cl', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `slug` = VALUES(`slug`);
