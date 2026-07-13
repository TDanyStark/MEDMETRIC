<?php

declare(strict_types=1);

namespace App\Application\Services\DeferredTasks;

/**
 * Spawns a genuinely detached background OS process (via `setsid ... &`) to
 * run PDF compression outside the request/response lifecycle entirely.
 *
 * WHY NOT fastcgi_finish_request()/litespeed_finish_request():
 *   Those let a PHP process keep running in the SAME request after the
 *   response is flushed to the client, which sounds ideal — but on this
 *   hosting (Hostinger shared, LiteSpeed + CloudLinux) it was empirically
 *   tested and confirmed unreliable: execution continues for a few seconds
 *   after finish_request() but gets killed abruptly for longer work like
 *   GhostScript PDF compression (~10s+ for a 15MB file) — no exception, no
 *   log entry, the process is simply gone (likely CloudLinux's LVE resource
 *   governor reaping "finished" requests after a short grace window).
 *
 *   A `setsid`-detached OS process launched via exec(), which fully leaves
 *   the web request's process group, was confirmed via a live test to
 *   survive well past the original request's lifetime and complete
 *   normally. This is the same pattern used by cron-less "fire and forget"
 *   jobs on shared hosting in general.
 */
class BackgroundProcessLauncher
{
    /**
     * @return bool True if the background process was actually launched
     *              (doesn't mean it will succeed — just that it started).
     *              False means exec() isn't available on this environment
     *              at all, so the caller should mark compression as
     *              'unavailable' rather than 'pending' (it will never run).
     */
    public function launchPdfCompression(
        int $materialId,
        string $tmpPath,
        string $rawKey,
        string $path,
        ?string $originalFilename
    ): bool {
        if (!function_exists('exec')) {
            // Can't background it on this environment — the raw upload
            // simply stays as the final file (never worse than before).
            return false;
        }

        $script = escapeshellarg(dirname(__DIR__, 4) . '/bin/compress_material.php');

        $cmd = sprintf(
            'setsid php %s %d %s %s %s %s > /dev/null 2>&1 &',
            $script,
            $materialId,
            escapeshellarg($tmpPath),
            escapeshellarg($rawKey),
            escapeshellarg($path),
            escapeshellarg($originalFilename ?? '')
        );

        exec($cmd);

        return true;
    }
}
