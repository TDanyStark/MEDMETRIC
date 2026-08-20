<?php

declare(strict_types=1);

namespace Tests\Infrastructure\Support;

use App\Infrastructure\Support\DeviceClassifier;
use Tests\TestCase;

/**
 * Unit coverage for App\Infrastructure\Support\DeviceClassifier — the
 * server-side user_agent -> 'mobile'/'desktop' classifier that lets
 * /v1/rep/metrics/device-split answer without ever exposing a raw
 * user_agent value (spec "Doctor Privacy", sdd/rep-metrics-module).
 *
 * Pure/static, no PDO — safe to test with real UA strings, no fixtures.
 */
class DeviceClassifierTest extends TestCase
{
    public function testClassifiesCommonIosAgentsAsMobile(): void
    {
        $this->assertSame('mobile', DeviceClassifier::classify(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
        ));
    }

    public function testClassifiesIpadAsMobile(): void
    {
        $this->assertSame('mobile', DeviceClassifier::classify(
            'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
        ));
    }

    public function testClassifiesCommonAndroidAgentAsMobile(): void
    {
        $this->assertSame('mobile', DeviceClassifier::classify(
            'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'
        ));
    }

    public function testClassifiesWindowsDesktopChromeAsDesktop(): void
    {
        $this->assertSame('desktop', DeviceClassifier::classify(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        ));
    }

    public function testClassifiesMacDesktopSafariAsDesktop(): void
    {
        $this->assertSame('desktop', DeviceClassifier::classify(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
        ));
    }

    public function testNullUserAgentDefaultsToDesktop(): void
    {
        $this->assertSame('desktop', DeviceClassifier::classify(null));
    }

    public function testEmptyOrWhitespaceUserAgentDefaultsToDesktop(): void
    {
        $this->assertSame('desktop', DeviceClassifier::classify(''));
        $this->assertSame('desktop', DeviceClassifier::classify('   '));
    }

    public function testClassificationIsCaseInsensitive(): void
    {
        $this->assertSame('mobile', DeviceClassifier::classify('some-custom-agent android/14'));
    }
}
