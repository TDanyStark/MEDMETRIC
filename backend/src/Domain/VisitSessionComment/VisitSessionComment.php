<?php

declare(strict_types=1);

namespace App\Domain\VisitSessionComment;

use JsonSerializable;

class VisitSessionComment implements JsonSerializable
{
    public function __construct(
        private int     $id,
        private int     $visitSessionId,
        private ?int    $materialId,
        private int     $organizationId,
        private string  $authorType,
        private ?int    $authorUserId,
        private ?int    $doctorId,
        private string  $body,
        private ?string $userAgent,
        private ?string $ipAddress,
        private bool    $active,
        private string  $createdAt,
        private ?string $updatedAt,
        // parent_id is intentionally NOT a constructor param exposed to callers —
        // it is dormant (future threading) and is never read/written by MVP code.
        private ?bool   $canDelete = null,
        // Display-name enrichment fields (authenticated list only — see
        // DbVisitSessionCommentRepository::listForScope()). $doctorName is the
        // sentinel for "this row came from the enriched query": every
        // visit_session has a required, non-null doctor_name (see
        // CreateVisitSessionAction), so a null $doctorName reliably means the
        // row was built from a non-enriched query (e.g. the public endpoint)
        // and none of these fields should be serialized at all.
        private ?string $doctorName = null,
        private ?string $repName = null,
        private ?string $materialTitle = null,
        private ?string $authorName = null
    ) {}

    public function getId(): int               { return $this->id; }
    public function getVisitSessionId(): int    { return $this->visitSessionId; }
    public function getMaterialId(): ?int       { return $this->materialId; }
    public function getOrganizationId(): int    { return $this->organizationId; }
    public function getAuthorType(): string     { return $this->authorType; }
    public function getAuthorUserId(): ?int     { return $this->authorUserId; }
    public function getDoctorId(): ?int         { return $this->doctorId; }
    public function getBody(): string           { return $this->body; }
    public function getUserAgent(): ?string     { return $this->userAgent; }
    public function getIpAddress(): ?string     { return $this->ipAddress; }
    public function isActive(): bool            { return $this->active; }
    public function getCreatedAt(): string      { return $this->createdAt; }
    public function getUpdatedAt(): ?string     { return $this->updatedAt; }
    public function getCanDelete(): ?bool        { return $this->canDelete; }
    public function getDoctorName(): ?string     { return $this->doctorName; }
    public function getRepName(): ?string        { return $this->repName; }
    public function getMaterialTitle(): ?string  { return $this->materialTitle; }
    public function getAuthorName(): ?string     { return $this->authorName; }

    /**
     * NOTE: `parent_id` is deliberately NEVER serialized. It exists in the
     * table only to support future threading and must not leak into the
     * MVP API surface.
     */
    public function jsonSerialize(): array
    {
        $data = [
            'id'               => $this->id,
            'visit_session_id' => $this->visitSessionId,
            'material_id'      => $this->materialId,
            'organization_id'  => $this->organizationId,
            'author_type'      => $this->authorType,
            'author_user_id'   => $this->authorUserId,
            'doctor_id'        => $this->doctorId,
            'body'             => $this->body,
            'user_agent'       => $this->userAgent,
            'ip_address'       => $this->ipAddress,
            'active'           => $this->active,
            'created_at'       => $this->createdAt,
            'updated_at'       => $this->updatedAt,
        ];

        if ($this->canDelete !== null) {
            $data['can_delete'] = $this->canDelete;
        }

        // Enrichment fields are added as a group, gated on $doctorName as the
        // enriched-row sentinel (see constructor doc). material_title is
        // intentionally included even when it is itself null ("abierto" /
        // open comment) — it must be a present key, not an absent one, so
        // the frontend can distinguish "no material" from "field missing".
        if ($this->doctorName !== null) {
            $data['doctor_name']     = $this->doctorName;
            $data['rep_name']        = $this->repName;
            $data['material_title']  = $this->materialTitle;
            $data['author_name']     = $this->authorName;
        }

        return $data;
    }

    public static function fromRow(array $row): self
    {
        return new self(
            id:             (int) $row['id'],
            visitSessionId: (int) $row['visit_session_id'],
            materialId:     isset($row['material_id']) ? (int) $row['material_id'] : null,
            organizationId: (int) $row['organization_id'],
            authorType:     $row['author_type'],
            authorUserId:   isset($row['author_user_id']) ? (int) $row['author_user_id'] : null,
            doctorId:       isset($row['doctor_id']) ? (int) $row['doctor_id'] : null,
            body:           $row['body'],
            userAgent:      $row['user_agent'] ?? null,
            ipAddress:      $row['ip_address'] ?? null,
            active:         (bool) $row['active'],
            createdAt:      $row['created_at'],
            updatedAt:      $row['updated_at'] ?? null,
            canDelete:      array_key_exists('can_delete', $row) ? (bool) $row['can_delete'] : null,
            doctorName:     $row['doctor_name'] ?? null,
            repName:        $row['rep_name'] ?? null,
            materialTitle:  array_key_exists('material_title', $row) ? $row['material_title'] : null,
            authorName:     $row['author_name'] ?? null,
        );
    }
}
