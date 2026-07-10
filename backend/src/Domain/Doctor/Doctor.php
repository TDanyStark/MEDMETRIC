<?php

declare(strict_types=1);

namespace App\Domain\Doctor;

use DateTime;
use JsonSerializable;

class Doctor implements JsonSerializable
{
    public function __construct(
        private int     $id,
        private int     $organizationId,
        private ?string $externalId,
        private string  $name,
        private ?string $document,
        private ?string $specialty,
        private ?string $country,
        private ?string $region,
        private ?string $provincia,
        private ?string $comuna,
        private ?string $institution,
        private ?string $category,
        private ?string $lastVisitDate,
        private ?string $product,
        private ?string $adoptionLevel,
        private ?int    $assignedRepId,
        private ?string $email,
        private ?string $phone,
        private ?string $mobilePhone,
        private ?string $address,
        private ?int    $createdById,
        private bool    $active,
        private string  $createdAt,
        private string  $updatedAt,
        private ?string $assignedRepName = null
    ) {}

    public function getId(): int                    { return $this->id; }
    public function getOrganizationId(): int          { return $this->organizationId; }
    public function getExternalId(): ?string         { return $this->externalId; }
    public function getName(): string                { return $this->name; }
    public function getDocument(): ?string            { return $this->document; }
    public function getSpecialty(): ?string           { return $this->specialty; }
    public function getCountry(): ?string             { return $this->country; }
    public function getRegion(): ?string              { return $this->region; }
    public function getProvincia(): ?string           { return $this->provincia; }
    public function getComuna(): ?string              { return $this->comuna; }
    public function getInstitution(): ?string         { return $this->institution; }
    public function getCategory(): ?string            { return $this->category; }
    public function getLastVisitDate(): ?string       { return $this->lastVisitDate; }
    public function getProduct(): ?string             { return $this->product; }
    public function getAdoptionLevel(): ?string       { return $this->adoptionLevel; }
    public function getAssignedRepId(): ?int          { return $this->assignedRepId; }
    public function getEmail(): ?string               { return $this->email; }
    public function getPhone(): ?string               { return $this->phone; }
    public function getMobilePhone(): ?string         { return $this->mobilePhone; }
    public function getAddress(): ?string             { return $this->address; }
    public function getCreatedById(): ?int            { return $this->createdById; }
    public function isActive(): bool                  { return $this->active; }
    public function getCreatedAt(): string            { return $this->createdAt; }
    public function getUpdatedAt(): string             { return $this->updatedAt; }

    /**
     * Days elapsed since last_visit_date, computed on the fly (not persisted).
     * Null when the doctor has no recorded visit yet.
     */
    public function getDaysSinceLastVisit(): ?int
    {
        if ($this->lastVisitDate === null) {
            return null;
        }

        $lastVisit = new DateTime($this->lastVisitDate);
        $today     = new DateTime('today');

        return (int) $today->diff($lastVisit)->format('%r%a') * -1;
    }

    public function jsonSerialize(): array
    {
        return [
            'id'                    => $this->id,
            'organization_id'       => $this->organizationId,
            'external_id'           => $this->externalId,
            'name'                  => $this->name,
            'document'              => $this->document,
            'specialty'             => $this->specialty,
            'country'               => $this->country,
            'region'                => $this->region,
            'provincia'             => $this->provincia,
            'comuna'                => $this->comuna,
            'institution'           => $this->institution,
            'category'              => $this->category,
            'last_visit_date'       => $this->lastVisitDate,
            'days_since_last_visit' => $this->getDaysSinceLastVisit(),
            'product'               => $this->product,
            'adoption_level'        => $this->adoptionLevel,
            'assigned_rep_id'       => $this->assignedRepId,
            'assigned_rep_name'     => $this->assignedRepName,
            'email'                 => $this->email,
            'phone'                 => $this->phone,
            'mobile_phone'          => $this->mobilePhone,
            'address'               => $this->address,
            'created_by_id'         => $this->createdById,
            'active'                => $this->active,
            'created_at'            => $this->createdAt,
            'updated_at'            => $this->updatedAt,
        ];
    }

    /**
     * Lightweight representation used by the search endpoint (typeahead / select).
     */
    public function toSearchResult(): array
    {
        return [
            'id'          => $this->id,
            'name'        => $this->name,
            'institution' => $this->institution,
            'comuna'      => $this->comuna,
            'document'    => $this->document,
        ];
    }

    public static function fromRow(array $row): self
    {
        return new self(
            id:              (int) $row['id'],
            organizationId:  (int) $row['organization_id'],
            externalId:      $row['external_id'] ?? null,
            name:            $row['name'],
            document:        $row['document'] ?? null,
            specialty:       $row['specialty'] ?? null,
            country:         $row['country'] ?? null,
            region:          $row['region'] ?? null,
            provincia:       $row['provincia'] ?? null,
            comuna:          $row['comuna'] ?? null,
            institution:     $row['institution'] ?? null,
            category:        $row['category'] ?? null,
            lastVisitDate:   $row['last_visit_date'] ?? null,
            product:         $row['product'] ?? null,
            adoptionLevel:   $row['adoption_level'] ?? null,
            assignedRepId:   isset($row['assigned_rep_id']) ? (int) $row['assigned_rep_id'] : null,
            email:           $row['email'] ?? null,
            phone:           $row['phone'] ?? null,
            mobilePhone:     $row['mobile_phone'] ?? null,
            address:         $row['address'] ?? null,
            createdById:     isset($row['created_by_id']) ? (int) $row['created_by_id'] : null,
            active:          (bool) $row['active'],
            createdAt:       $row['created_at'],
            updatedAt:       $row['updated_at'],
            assignedRepName: $row['assigned_rep_name'] ?? null,
        );
    }
}
