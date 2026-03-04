<?php

declare(strict_types=1);

namespace App\Application\Actions;

use JsonSerializable;

/**
 * Standard API response envelope.
 *
 * Success:  { "success": true,  "data": {...},  "message": null }
 * Error:    { "success": false, "data": null,   "error": { "type": "...", "description": "..." } }
 */
class ActionPayload implements JsonSerializable
{
    private int $statusCode;

    /** @var array|object|null */
    private $data;

    private ?ActionError $error;

    private ?string $message;

    public function __construct(
        int $statusCode = 200,
        $data = null,
        ?ActionError $error = null,
        ?string $message = null
    ) {
        $this->statusCode = $statusCode;
        $this->data = $data;
        $this->error = $error;
        $this->message = $message;
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    /** @return array|null|object */
    public function getData()
    {
        return $this->data;
    }

    public function getError(): ?ActionError
    {
        return $this->error;
    }

    public function getMessage(): ?string
    {
        return $this->message;
    }

    #[\ReturnTypeWillChange]
    public function jsonSerialize(): array
    {
        $success = $this->error === null;

        $payload = [
            'success' => $success,
        ];

        if ($success) {
            $payload['data'] = $this->data;
            if ($this->message !== null) {
                $payload['message'] = $this->message;
            }
        } else {
            $payload['error'] = $this->error;
            if ($this->message !== null) {
                $payload['message'] = $this->message;
            }
        }

        return $payload;
    }
}
