<?php

declare(strict_types=1);

namespace App\Domain\MaterialStudy;

use JsonSerializable;

class MaterialStudy implements JsonSerializable
{
    public function __construct(
        private int      $id,
        private int      $materialId,
        private string   $title,
        private string   $type,
        private string   $storageDriver,
        private ?string  $storagePath,
        private ?string  $externalUrl,
        private ?string  $pdfCompressionStatus,
        private ?string  $pdfCompressionError,
        private ?string  $pdfCompressionCheckedAt,
        private string   $createdAt,
        private string   $updatedAt,
        private ?int     $viewCount = null
    ) {}

    public function getId(): int              { return $this->id; }
    public function getMaterialId(): int       { return $this->materialId; }
    public function getTitle(): string         { return $this->title; }
    public function getType(): string          { return $this->type; }
    public function getStorageDriver(): string { return $this->storageDriver; }
    public function getStoragePath(): ?string  { return $this->storagePath; }
    public function getExternalUrl(): ?string  { return $this->externalUrl; }
    public function getPdfCompressionStatus(): ?string { return $this->pdfCompressionStatus; }
    public function getPdfCompressionError(): ?string { return $this->pdfCompressionError; }
    public function getPdfCompressionCheckedAt(): ?string { return $this->pdfCompressionCheckedAt; }
    public function getCreatedAt(): string     { return $this->createdAt; }
    public function getUpdatedAt(): string     { return $this->updatedAt; }
    public function getViewCount(): ?int       { return $this->viewCount; }

    public function setViewCount(?int $count): void { $this->viewCount = $count; }

    public function isPdf(): bool  { return $this->type === 'pdf'; }
    public function isLink(): bool { return $this->type === 'link'; }

    public function jsonSerialize(): array
    {
        $data = [
            'id'                          => $this->id,
            'material_id'                 => $this->materialId,
            'title'                       => $this->title,
            'type'                        => $this->type,
            'storage_driver'              => $this->storageDriver,
            'storage_path'                => $this->storagePath,
            'external_url'                => $this->externalUrl,
            'pdf_compression_status'      => $this->pdfCompressionStatus,
            'pdf_compression_error'       => $this->pdfCompressionError,
            'pdf_compression_checked_at'  => $this->pdfCompressionCheckedAt,
            'created_at'                  => $this->createdAt,
            'updated_at'                  => $this->updatedAt,
        ];

        if ($this->viewCount !== null) {
            $data['view_count'] = $this->viewCount;
        }

        return $data;
    }

    public static function fromRow(array $row): self
    {
        return new self(
            id:                      (int) $row['id'],
            materialId:              (int) $row['material_id'],
            title:                   $row['title'],
            type:                    $row['type'],
            storageDriver:           $row['storage_driver'],
            storagePath:             $row['storage_path'] ?? null,
            externalUrl:             $row['external_url'] ?? null,
            pdfCompressionStatus:    $row['pdf_compression_status'] ?? null,
            pdfCompressionError:     $row['pdf_compression_error'] ?? null,
            pdfCompressionCheckedAt: $row['pdf_compression_checked_at'] ?? null,
            createdAt:               $row['created_at'],
            updatedAt:               $row['updated_at'],
        );
    }
}
