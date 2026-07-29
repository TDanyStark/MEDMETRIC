<?php

// Pin the PHP default timezone for test determinism. Without this, PHP
// falls back to whatever the machine's php.ini `date.timezone` is (e.g.
// Europe/Berlin locally vs UTC on Hostinger prod), causing tests that
// implicitly rely on "now" or on naive-string date comparisons to shift
// by that machine's offset. Production should set `date.timezone = UTC`
// in php.ini; this bootstrap only guarantees the test suite itself is
// machine-independent. Business-logic date conversion (OrgDateRange) is
// unaffected either way since it always constructs explicit named
// DateTimeZone instances rather than relying on the default.
date_default_timezone_set('UTC');

require __DIR__ . '/../vendor/autoload.php';
