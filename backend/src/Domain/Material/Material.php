<?php

declare(strict_types=1);

namespace App\Domain\Material;

use JsonSerializable;

class Material implements JsonSerializable
{
    public function __construct(
        private int      $id,
        private int      $organizationId,
        private int      $brandId,
        private int      $managerId,
        private string   $title,
        private ?string  $description,
        private ?string  $coverPath,
        private string   $type,
        private string   $status,
        private string   $storageDriver,
        private ?string  $storagePath,
        private ?string  $externalUrl,
        private ?string  $approvedAt,
        private ?int     $approvedBy,
        private string   $createdAt,
        private string   $updatedAt,
        private ?string  $brandName = null,
        private ?string  $managerName = null,
        private ?string  $coverUrl = null
    ) {}

    public function getId(): int           { return $this->id; }
    public function getOrganizationId(): int { return $this->organizationId; }
    public function getBrandId(): int      { return $this->brandId; }
    public function getManagerId(): int    { return $this->managerId; }
    public function getTitle(): string     { return $this->title; }
    public function getDescription(): ?string { return $this->description; }
    public function getCoverPath(): ?string   { return $this->coverPath; }
    public function getType(): string      { return $this->type; }
    public function getStatus(): string    { return $this->status; }
    public function getStorageDriver(): string { return $this->storageDriver; }
    public function getStoragePath(): ?string { return $this->storagePath; }
    public function getExternalUrl(): ?string { return $this->externalUrl; }
    public function getApprovedAt(): ?string { return $this->approvedAt; }
    public function getApprovedBy(): ?int   { return $this->approvedBy; }
    public function getCreatedAt(): string { return $this->createdAt; }
    public function getUpdatedAt(): string { return $this->updatedAt; }
    public function getBrandName(): ?string { return $this->brandName; }
    public function getManagerName(): ?string { return $this->managerName; }
    public function getCoverUrl(): ?string  { return $this->coverUrl; }

    public function setCoverUrl(?string $url): void { $this->coverUrl = $url; }

    public function isPdf(): bool    { return $this->type === 'pdf'; }
    public function isVideo(): bool  { return $this->type === 'video'; }
    public function isLink(): bool   { return $this->type === 'link'; }
    public function isApproved(): bool { return $this->status === 'approved'; }
    public function isDraft(): bool  { return $this->status === 'draft'; }

    public function jsonSerialize(): array
    {
        return [
            'id'              => $this->id,
            'organization_id' => $this->organizationId,
            'brand_id'        => $this->brandId,
            'manager_id'      => $this->managerId,
            'title'           => $this->title,
            'description'     => $this->description,
            'cover_path'      => $this->coverPath,
            'type'            => $this->type,
            'status'          => $this->status,
            'storage_driver'  => $this->storageDriver,
            'storage_path'    => $this->storagePath,
            'external_url'    => $this->externalUrl,
            'approved_at'     => $this->approvedAt,
            'approved_by'     => $this->approvedBy,
            'created_at'      => $this->createdAt,
            'updated_at'      => $this->updatedAt,
            'brand_name'      => $this->brandName,
            'manager_name'    => $this->managerName,
            'cover_url'       => $this->coverUrl,
        ];
    }

    public static function fromRow(array $row): self
    {
        return new self(
            id:              (int) $row['id'],
            organizationId:  (int) $row['organization_id'],
            brandId:         (int) $row['brand_id'],
            managerId:       (int) $row['manager_id'],
            title:           $row['title'],
            description:     $row['description'] ?? null,
            coverPath:       $row['cover_path'] ?? null,
            type:            $row['type'],
            status:          $row['status'],
            storageDriver:   $row['storage_driver'],
            storagePath:     $row['storage_path'] ?? null,
            externalUrl:     $row['external_url'] ?? null,
            approvedAt:      $row['approved_at'] ?? null,
            approvedBy:      isset($row['approved_by']) ? (int) $row['approved_by'] : null,
            createdAt:       $row['created_at'],
            updatedAt:       $row['updated_at'],
            brandName:       $row['brand_name'] ?? null,
            managerName:     $row['manager_name'] ?? null,
        );
    }
}
