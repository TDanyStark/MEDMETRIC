<?php

/**
 * MEDMETRIC - Import de medicos desde Excel Kardex
 *
 * Lee un archivo Excel (hoja "data") con el listado de medicos (Kardex) y hace
 * upsert en la tabla `doctors` para una organizacion, matcheando o creando el
 * usuario "representante" (rol rep) asociado a cada medico.
 *
 * Uso:
 *   php database/import_doctors.php --file=database/imports/medicos_kardex.xlsx --org=3
 *   php database/import_doctors.php --file=database/imports/medicos_kardex.xlsx --org=3 --dry-run
 *
 * Opciones:
 *   --file=<path>         Ruta al .xlsx (relativa al cwd o absoluta). Requerido.
 *   --org=<id>             organization_id destino. Requerido.
 *   --dry-run              No escribe en la base de datos, solo simula y reporta.
 *   --created-by=<user_id> ID de usuario a usar como created_by_id en doctors.
 *                           Si se omite, se intenta resolver automaticamente
 *                           (primer org_admin de la organizacion). Ver notas
 *                           en el reporte final si la columna es NOT NULL y no
 *                           se pudo resolver.
 *   --batch-size=<n>       Tamano de lote para commits (default 100).
 */

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;
use PhpOffice\PhpSpreadsheet\IOFactory;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function getArg(array $argv, string $name, ?string $default = null): ?string
{
    foreach ($argv as $arg) {
        if (str_starts_with($arg, "--{$name}=")) {
            return substr($arg, strlen("--{$name}="));
        }
    }
    return $default;
}

function hasFlag(array $argv, string $name): bool
{
    return in_array("--{$name}", $argv, true);
}

$args = array_slice($argv, 1);

$filePathArg   = getArg($args, 'file');
$orgIdArg      = getArg($args, 'org');
$dryRun        = hasFlag($args, 'dry-run');
$createdByArg  = getArg($args, 'created-by');
$batchSize     = (int) getArg($args, 'batch-size', '100');

if ($filePathArg === null || $orgIdArg === null) {
    fwrite(STDERR, "Uso: php database/import_doctors.php --file=<ruta.xlsx> --org=<id> [--dry-run] [--created-by=<user_id>] [--batch-size=100]" . PHP_EOL);
    exit(1);
}

$organizationId = (int) $orgIdArg;
if ($organizationId <= 0) {
    fwrite(STDERR, "[ERROR] --org debe ser un entero positivo." . PHP_EOL);
    exit(1);
}

$filePath = str_starts_with($filePathArg, '/') || preg_match('/^[A-Za-z]:\\\\/', $filePathArg)
    ? $filePathArg
    : __DIR__ . '/../' . $filePathArg;

if (!is_file($filePath)) {
    fwrite(STDERR, "[ERROR] Archivo no encontrado: {$filePath}" . PHP_EOL);
    exit(1);
}

// ---------------------------------------------------------------------------
// Bootstrap DB (misma logica que database/migrate.php)
// ---------------------------------------------------------------------------

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

$host    = $_ENV['DB_HOST']    ?? '127.0.0.1';
$port    = $_ENV['DB_PORT']    ?? '3306';
$dbName  = $_ENV['DB_NAME']    ?? 'medmetric';
$user    = $_ENV['DB_USER']    ?? 'root';
$pass    = $_ENV['DB_PASS']    ?? '';
$charset = $_ENV['DB_CHARSET'] ?? 'utf8mb4';

$dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset={$charset}";

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    fwrite(STDERR, "[ERROR] No se pudo conectar a la base de datos: " . $e->getMessage() . PHP_EOL);
    exit(1);
}

// ---------------------------------------------------------------------------
// Verificaciones previas de esquema
// ---------------------------------------------------------------------------

function tableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare("SHOW TABLES LIKE :table");
    $stmt->execute([':table' => $table]);
    return $stmt->fetchColumn() !== false;
}

if (!tableExists($pdo, 'doctors')) {
    fwrite(STDERR, "[ERROR] La tabla `doctors` no existe todavia. Ejecuta las migraciones primero: php database/migrate.php" . PHP_EOL);
    exit(1);
}

if (!tableExists($pdo, 'users') || !tableExists($pdo, 'roles')) {
    fwrite(STDERR, "[ERROR] Tablas `users`/`roles` no encontradas. Ejecuta las migraciones primero." . PHP_EOL);
    exit(1);
}

$stmt = $pdo->prepare("SELECT id FROM organizations WHERE id = :id");
$stmt->execute([':id' => $organizationId]);
if ($stmt->fetchColumn() === false) {
    fwrite(STDERR, "[ERROR] organization_id={$organizationId} no existe en `organizations`." . PHP_EOL);
    exit(1);
}

// Determinar si doctors.created_by_id es NOT NULL, para decidir si es
// obligatorio resolver un usuario "creador".
$createdByNullable = true;
$stmt = $pdo->query("SHOW COLUMNS FROM doctors LIKE 'created_by_id'");
$col = $stmt->fetch();
if ($col && isset($col['Null'])) {
    $createdByNullable = strtoupper($col['Null']) === 'YES';
}

$repRoleId = (int) $pdo->query("SELECT id FROM roles WHERE name = 'rep' LIMIT 1")->fetchColumn();
if ($repRoleId <= 0) {
    fwrite(STDERR, "[ERROR] No se encontro el rol 'rep' en la tabla `roles`." . PHP_EOL);
    exit(1);
}

$orgAdminRoleId = (int) $pdo->query("SELECT id FROM roles WHERE name = 'org_admin' LIMIT 1")->fetchColumn();

// Resolver created_by_id
$createdById = null;
if ($createdByArg !== null) {
    $createdById = (int) $createdByArg;
    $stmt = $pdo->prepare("SELECT id FROM users WHERE id = :id");
    $stmt->execute([':id' => $createdById]);
    if ($stmt->fetchColumn() === false) {
        fwrite(STDERR, "[ERROR] --created-by={$createdById} no corresponde a un usuario existente." . PHP_EOL);
        exit(1);
    }
} elseif (!$createdByNullable && $orgAdminRoleId > 0) {
    $stmt = $pdo->prepare("SELECT id FROM users WHERE organization_id = :org AND role_id = :role ORDER BY id ASC LIMIT 1");
    $stmt->execute([':org' => $organizationId, ':role' => $orgAdminRoleId]);
    $found = $stmt->fetchColumn();
    if ($found !== false) {
        $createdById = (int) $found;
        echo "[INFO] doctors.created_by_id es NOT NULL. Usando org_admin id={$createdById} como creador (puedes forzar otro con --created-by=)." . PHP_EOL;
    } else {
        fwrite(STDERR, "[ERROR] doctors.created_by_id es NOT NULL y no se encontro ningun org_admin para organization_id={$organizationId}. Pasa --created-by=<user_id>." . PHP_EOL);
        exit(1);
    }
}

// ---------------------------------------------------------------------------
// Helpers de normalizacion / parsing
// ---------------------------------------------------------------------------

function removeAccents(string $s): string
{
    static $map = [
        'á' => 'a', 'à' => 'a', 'ä' => 'a', 'â' => 'a', 'ã' => 'a',
        'Á' => 'A', 'À' => 'A', 'Ä' => 'A', 'Â' => 'A', 'Ã' => 'A',
        'é' => 'e', 'è' => 'e', 'ë' => 'e', 'ê' => 'e',
        'É' => 'E', 'È' => 'E', 'Ë' => 'E', 'Ê' => 'E',
        'í' => 'i', 'ì' => 'i', 'ï' => 'i', 'î' => 'i',
        'Í' => 'I', 'Ì' => 'I', 'Ï' => 'I', 'Î' => 'I',
        'ó' => 'o', 'ò' => 'o', 'ö' => 'o', 'ô' => 'o', 'õ' => 'o',
        'Ó' => 'O', 'Ò' => 'O', 'Ö' => 'O', 'Ô' => 'O', 'Õ' => 'O',
        'ú' => 'u', 'ù' => 'u', 'ü' => 'u', 'û' => 'u',
        'Ú' => 'U', 'Ù' => 'U', 'Ü' => 'U', 'Û' => 'U',
        'ñ' => 'n', 'Ñ' => 'N', 'ç' => 'c', 'Ç' => 'C',
    ];
    return strtr($s, $map);
}

function normalizeName(string $s): string
{
    $s = trim(preg_replace('/\s+/', ' ', $s) ?? '');
    $s = removeAccents($s);
    return mb_strtolower($s, 'UTF-8');
}

/** Limpieza generica de texto: colapsa espacios, marca '', '--' como null. */
function cleanText(mixed $v): ?string
{
    if ($v === null) {
        return null;
    }
    $s = trim((string) $v);
    $s = preg_replace('/\s+/', ' ', $s) ?? $s;
    if ($s === '' || $s === '--') {
        return null;
    }
    return $s;
}

/** Igual que cleanText pero ademas trata '0' literal como null (placeholder
 *  de "sin dato" observado en columnas de email/telefono/documento del Kardex). */
function cleanOptional(mixed $v): ?string
{
    $s = cleanText($v);
    if ($s === '0') {
        return null;
    }
    return $s;
}

/** Parsea "07 Apr 2026" (dia, mes abreviado EN INGLES, anio) -> "2026-04-07". */
function parseLastVisitDate(mixed $raw): ?string
{
    $s = cleanText($raw);
    if ($s === null) {
        return null;
    }
    $dt = DateTime::createFromFormat('!d M Y', $s);
    if ($dt === false) {
        return null;
    }
    return $dt->format('Y-m-d');
}

function slugPart(string $s): string
{
    $s = removeAccents($s);
    $s = mb_strtolower($s, 'UTF-8');
    $s = preg_replace('/[^a-z0-9]/', '', $s) ?? '';
    return $s;
}

/** Extrae el primer representante cuando vienen varios separados por coma. */
function firstRepresentativeName(?string $raw): ?string
{
    $s = cleanText($raw);
    if ($s === null) {
        return null;
    }
    if (str_contains($s, ',')) {
        $s = trim(explode(',', $s, 2)[0]);
    }
    return $s === '' ? null : $s;
}

// ---------------------------------------------------------------------------
// Cargar Excel
// ---------------------------------------------------------------------------

echo "Leyendo: {$filePath}" . PHP_EOL;

$reader = IOFactory::createReaderForFile($filePath);
$reader->setLoadSheetsOnly(['data']);
$spreadsheet = $reader->load($filePath);
$sheet = $spreadsheet->getSheetByName('data');

if ($sheet === null) {
    fwrite(STDERR, "[ERROR] No se encontro la hoja 'data' en el archivo." . PHP_EOL);
    exit(1);
}

// formatData=true convierte celdas RichText a texto plano y aplica formato,
// evitando tener que manejar objetos RichText manualmente.
$rows = $sheet->toArray(null, true, true, false);

if (count($rows) < 2) {
    fwrite(STDERR, "[ERROR] La hoja 'data' no tiene filas de datos." . PHP_EOL);
    exit(1);
}

$header = $rows[0];
$colIndex = [];
foreach ($header as $idx => $name) {
    $name = trim((string) $name);
    if ($name !== '') {
        $colIndex[$name] = $idx;
    }
}

$requiredHeaders = [
    'ID', 'Nombre', 'Representante', '# Documento', 'Especialidad', 'País',
    'Comuna', 'Provincia', 'Institución', 'Categorías', 'Fecha de última visita',
    'Producto', 'Región', 'Nivel de adopción 2',
];

$missingHeaders = array_filter($requiredHeaders, fn($h) => !array_key_exists($h, $colIndex));
if (!empty($missingHeaders)) {
    fwrite(STDERR, "[ERROR] Faltan columnas esperadas en el Excel: " . implode(', ', $missingHeaders) . PHP_EOL);
    exit(1);
}

function col(array $row, array $colIndex, string $name): mixed
{
    $idx = $colIndex[$name] ?? null;
    if ($idx === null) {
        return null;
    }
    return $row[$idx] ?? null;
}

// ---------------------------------------------------------------------------
// Preload de representantes (reps) existentes de la organizacion
// ---------------------------------------------------------------------------

$repCache = []; // normalizedName => user_id
$repWordSets = []; // user_id => array of normalized name words (for fuzzy fallback)

$stmt = $pdo->prepare("SELECT id, name FROM users WHERE organization_id = :org AND role_id = :role");
$stmt->execute([':org' => $organizationId, ':role' => $repRoleId]);
foreach ($stmt->fetchAll() as $row) {
    $key = normalizeName($row['name']);
    if (!isset($repCache[$key])) {
        $repCache[$key] = (int) $row['id'];
    }
    $repWordSets[(int) $row['id']] = array_values(array_filter(explode(' ', $key)));
}

/**
 * True si $needle aparece como subsecuencia ordenada dentro de $haystack
 * (todas las palabras de needle estan en haystack, en el mismo orden
 * relativo, no necesariamente consecutivas).
 */
function isWordSubsequence(array $needle, array $haystack): bool
{
    $pos = 0;
    foreach ($needle as $word) {
        $found = false;
        for ($j = $pos; $j < count($haystack); $j++) {
            if ($haystack[$j] === $word) {
                $pos = $j + 1;
                $found = true;
                break;
            }
        }
        if (!$found) {
            return false;
        }
    }
    return true;
}

/**
 * Busca un match difuso cuando el nombre exacto no coincide. El Kardex y el
 * sistema pueden tener versiones distintas del mismo nombre en CUALQUIER
 * direccion:
 *   - Kardex incompleto, usuario con nombre completo
 *     (Excel "Joel Hidalgo" vs BD "Joel Eliseo Hidalgo Concha"), o
 *   - Usuario con nombre abreviado, Kardex con nombre completo
 *     (Excel "Karen Tamara Yicella Contreras Mora" vs BD "Karen Contreras").
 * Se considera match si el nombre mas corto es subsecuencia ordenada del
 * mas largo (en cualquiera de los dos sentidos). Se exige un minimo de 2
 * palabras en el nombre mas corto para evitar matches demasiado laxos (un
 * solo nombre de pila). Si hay mas de un candidato ambiguo, NO se hace
 * match (se prefiere crear un usuario nuevo antes que asociar erroneamente
 * a la persona equivocada).
 */
function fuzzyMatchRepId(string $normalizedName, array $repWordSets): ?int
{
    $needleWords = array_values(array_filter(explode(' ', $normalizedName)));

    $matches = [];
    foreach ($repWordSets as $userId => $haystackWords) {
        $shorterCount = min(count($needleWords), count($haystackWords));
        if ($shorterCount < 2) {
            continue; // muy poco especifico para intentar fuzzy match
        }

        $isMatch = count($needleWords) >= count($haystackWords)
            ? isWordSubsequence($haystackWords, $needleWords)
            : isWordSubsequence($needleWords, $haystackWords);

        if ($isMatch) {
            $matches[] = $userId;
        }
    }

    $unique = array_values(array_unique($matches));
    return count($unique) === 1 ? $unique[0] : null;
}

$existingEmailsCache = []; // email => true (emails generados o vistos en esta corrida)

function emailExistsInDb(PDO $pdo, string $email): bool
{
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE email = :email");
    $stmt->execute([':email' => $email]);
    return (int) $stmt->fetchColumn() > 0;
}

function buildRepEmail(PDO $pdo, string $fullName, array &$usedEmails): string
{
    $words = array_values(array_filter(preg_split('/\s+/', trim($fullName)) ?: []));
    if (empty($words)) {
        $words = ['rep'];
    }

    $first = slugPart($words[0]);
    $last  = count($words) > 1 ? slugPart(end($words)) : '';
    $localBase = $last !== '' ? "{$first}.{$last}" : $first;
    if ($localBase === '') {
        $localBase = 'rep';
    }

    $domain = 'steincares.import';
    $candidate = "{$localBase}@{$domain}";
    $suffix = 1;

    while (isset($usedEmails[$candidate]) || emailExistsInDb($pdo, $candidate)) {
        $suffix++;
        $candidate = "{$localBase}{$suffix}@{$domain}";
    }

    $usedEmails[$candidate] = true;
    return $candidate;
}

$repsMatched = []; // nombre => user_id (ya existian)
$repsCreated = []; // nombre => ['id' => int, 'email' => string]
$repsFuzzyMatched = []; // nombre excel (parcial) => user_id (match difuso, nombre completo distinto)

$repPasswordHash = password_hash('Steincares2026!', PASSWORD_BCRYPT);

$insertUserStmt = $pdo->prepare(
    'INSERT INTO users (organization_id, role_id, name, email, password_hash, active)
     VALUES (:organization_id, :role_id, :name, :email, :password_hash, 1)'
);

function resolveRepUserId(
    PDO $pdo,
    ?string $repName,
    int $organizationId,
    int $repRoleId,
    string $repPasswordHash,
    array &$repCache,
    array &$existingEmailsCache,
    array &$repsMatched,
    array &$repsCreated,
    \PDOStatement $insertUserStmt,
    bool $dryRun,
    array $repWordSets = [],
    array &$fuzzyMatches = []
): ?int {
    if ($repName === null || $repName === '') {
        return null;
    }

    $key = normalizeName($repName);

    if (isset($repCache[$key])) {
        $repsMatched[$key] = ['name' => $repName, 'id' => $repCache[$key]];
        return $repCache[$key];
    }

    $fuzzyId = fuzzyMatchRepId($key, $repWordSets);
    if ($fuzzyId !== null) {
        $repCache[$key] = $fuzzyId;
        $repsMatched[$key] = ['name' => $repName, 'id' => $fuzzyId];
        $fuzzyMatches[$key] = ['name' => $repName, 'id' => $fuzzyId];
        return $fuzzyId;
    }

    // Crear nuevo rep
    $email = buildRepEmail($pdo, $repName, $existingEmailsCache);

    if ($dryRun) {
        // En dry-run no insertamos; usamos un id negativo ficticio para que
        // el resto del flujo (conteo, mapeo) funcione sin tocar la BD.
        $fakeId = -1 * (count($repsCreated) + 1);
        $repCache[$key] = $fakeId;
        $repsCreated[$key] = ['name' => $repName, 'id' => $fakeId, 'email' => $email];
        return $fakeId;
    }

    $insertUserStmt->execute([
        ':organization_id' => $organizationId,
        ':role_id'         => $repRoleId,
        ':name'            => $repName,
        ':email'           => $email,
        ':password_hash'   => $repPasswordHash,
    ]);

    $newId = (int) $pdo->lastInsertId();
    $repCache[$key] = $newId;
    $repsCreated[$key] = ['name' => $repName, 'id' => $newId, 'email' => $email];

    return $newId;
}

// ---------------------------------------------------------------------------
// Upsert de doctors
// ---------------------------------------------------------------------------

$selectDoctorStmt = $pdo->prepare(
    'SELECT id FROM doctors WHERE organization_id = :org AND external_id = :external_id LIMIT 1'
);

$updateFields = [
    'name', 'document', 'specialty', 'country', 'region', 'provincia', 'comuna',
    'institution', 'category', 'last_visit_date', 'product', 'adoption_level',
    'assigned_rep_id', 'email', 'phone', 'mobile_phone', 'address', 'active',
];

$updateSql = 'UPDATE doctors SET ' . implode(', ', array_map(fn($f) => "{$f} = :{$f}", $updateFields))
    . ' WHERE id = :id';
$updateDoctorStmt = $pdo->prepare($updateSql);

$insertFields = array_merge(['organization_id', 'external_id'], $updateFields, ['created_by_id']);
$insertSql = 'INSERT INTO doctors (' . implode(', ', $insertFields) . ') VALUES ('
    . implode(', ', array_map(fn($f) => ":{$f}", $insertFields)) . ')';
$insertDoctorStmt = $pdo->prepare($insertSql);

$totalRows = 0;
$created = 0;
$updated = 0;
$skipped = [];
$warnings = [];

$batchSize = $batchSize > 0 ? $batchSize : 100;
$rowCountInBatch = 0;

$startTransaction = function () use ($pdo, $dryRun) {
    if (!$pdo->inTransaction()) {
        $pdo->beginTransaction();
    }
};

$commitBatch = function () use ($pdo, $dryRun) {
    if ($pdo->inTransaction()) {
        if ($dryRun) {
            $pdo->rollBack();
        } else {
            $pdo->commit();
        }
    }
};

$startTransaction();

$dataRows = array_slice($rows, 1);

foreach ($dataRows as $i => $row) {
    $excelRowNumber = $i + 2; // fila real en excel (1 = header)
    $totalRows++;

    $externalId = cleanText(col($row, $colIndex, 'ID'));
    $name       = cleanText(col($row, $colIndex, 'Nombre'));

    if ($externalId === null || $name === null) {
        $skipped[] = "Fila {$excelRowNumber}: falta ID o Nombre (external_id=" . var_export($externalId, true) . ", nombre=" . var_export($name, true) . ")";
        continue;
    }

    $document      = cleanOptional(col($row, $colIndex, '# Documento'));
    $specialty     = cleanText(col($row, $colIndex, 'Especialidad'));
    $country       = cleanText(col($row, $colIndex, 'País'));
    $comuna        = cleanText(col($row, $colIndex, 'Comuna'));
    $provincia     = cleanText(col($row, $colIndex, 'Provincia'));
    $institution   = cleanText(col($row, $colIndex, 'Institución'));
    $category      = cleanText(col($row, $colIndex, 'Categorías'));
    $product       = cleanText(col($row, $colIndex, 'Producto'));
    $region        = cleanText(col($row, $colIndex, 'Región'));
    $adoptionLevel = cleanText(col($row, $colIndex, 'Nivel de adopción 2'));
    $email         = cleanOptional(col($row, $colIndex, 'Correo electrónico'));
    $phone         = cleanOptional(col($row, $colIndex, 'Teléfonos'));
    $mobilePhone   = cleanOptional(col($row, $colIndex, 'Teléfono móvil'));
    $address       = cleanText(col($row, $colIndex, 'Dirección'));

    $rawDate = col($row, $colIndex, 'Fecha de última visita');
    $lastVisitDate = parseLastVisitDate($rawDate);
    if ($lastVisitDate === null && cleanText($rawDate) !== null) {
        $warnings[] = "Fila {$excelRowNumber} (ID={$externalId}): fecha de ultima visita no parseable: " . var_export($rawDate, true);
    }

    if ($document === null) {
        $warnings[] = "Fila {$excelRowNumber} (ID={$externalId}): documento vacio";
    }

    $repNameRaw = firstRepresentativeName(cleanText(col($row, $colIndex, 'Representante')));
    $assignedRepId = null;

    if ($repNameRaw === null) {
        $warnings[] = "Fila {$excelRowNumber} (ID={$externalId}): sin representante asignado";
    } else {
        $assignedRepId = resolveRepUserId(
            $pdo,
            $repNameRaw,
            $organizationId,
            $repRoleId,
            $repPasswordHash,
            $repCache,
            $existingEmailsCache,
            $repsMatched,
            $repsCreated,
            $insertUserStmt,
            $dryRun,
            $repWordSets,
            $repsFuzzyMatched
        );
    }

    try {
        $selectDoctorStmt->execute([':org' => $organizationId, ':external_id' => $externalId]);
        $existingId = $selectDoctorStmt->fetchColumn();

        $params = [
            'name'             => $name,
            'document'         => $document,
            'specialty'        => $specialty,
            'country'          => $country,
            'region'           => $region,
            'provincia'        => $provincia,
            'comuna'           => $comuna,
            'institution'      => $institution,
            'category'         => $category,
            'last_visit_date'  => $lastVisitDate,
            'product'          => $product,
            'adoption_level'   => $adoptionLevel,
            'assigned_rep_id'  => $assignedRepId,
            'email'            => $email,
            'phone'            => $phone,
            'mobile_phone'     => $mobilePhone,
            'address'          => $address,
            'active'           => 1,
        ];

        if ($existingId !== false) {
            $params['id'] = (int) $existingId;
            $updateDoctorStmt->execute($params);
            $updated++;
        } else {
            $params['organization_id'] = $organizationId;
            $params['external_id']     = $externalId;
            $params['created_by_id']   = $createdById;
            $insertDoctorStmt->execute($params);
            $created++;
        }
    } catch (PDOException $e) {
        $warnings[] = "Fila {$excelRowNumber} (ID={$externalId}): ERROR al guardar doctor: " . $e->getMessage();
    }

    $rowCountInBatch++;
    if ($rowCountInBatch >= $batchSize) {
        $commitBatch();
        $startTransaction();
        $rowCountInBatch = 0;
    }
}

$commitBatch();

// ---------------------------------------------------------------------------
// Reporte final
// ---------------------------------------------------------------------------

echo PHP_EOL . "=== Reporte de importacion" . ($dryRun ? " (DRY RUN - sin cambios en BD)" : "") . " ===" . PHP_EOL;
echo "Archivo:            {$filePath}" . PHP_EOL;
echo "Organizacion:        {$organizationId}" . PHP_EOL;
echo "Filas procesadas:    {$totalRows}" . PHP_EOL;
echo "Doctors creados:     {$created}" . PHP_EOL;
echo "Doctors actualizados:{$updated}" . PHP_EOL;
echo "Filas omitidas:      " . count($skipped) . PHP_EOL;
echo "Representantes ya existentes (matcheados): " . count($repsMatched) . PHP_EOL;
echo "Representantes nuevos creados: " . count($repsCreated) . PHP_EOL;
echo "Representantes matcheados por nombre parcial (fuzzy): " . count($repsFuzzyMatched) . PHP_EOL;

if (!empty($repsFuzzyMatched)) {
    echo PHP_EOL . "-- Representantes con match difuso (nombre Excel vs nombre en BD no identico) --" . PHP_EOL;
    foreach ($repsFuzzyMatched as $info) {
        echo "  \"{$info['name']}\" -> user_id={$info['id']}" . PHP_EOL;
    }
}

if (!empty($repsCreated)) {
    echo PHP_EOL . "-- Representantes nuevos --" . PHP_EOL;
    foreach ($repsCreated as $info) {
        echo "  {$info['name']} -> {$info['email']}" . PHP_EOL;
    }
}

if (!empty($skipped)) {
    echo PHP_EOL . "-- Filas omitidas (" . count($skipped) . ") --" . PHP_EOL;
    foreach (array_slice($skipped, 0, 50) as $s) {
        echo "  {$s}" . PHP_EOL;
    }
    if (count($skipped) > 50) {
        echo "  ... y " . (count($skipped) - 50) . " mas." . PHP_EOL;
    }
}

if (!empty($warnings)) {
    echo PHP_EOL . "-- Warnings (" . count($warnings) . ") --" . PHP_EOL;
    foreach (array_slice($warnings, 0, 50) as $w) {
        echo "  {$w}" . PHP_EOL;
    }
    if (count($warnings) > 50) {
        echo "  ... y " . (count($warnings) - 50) . " mas." . PHP_EOL;
    }
}

echo PHP_EOL . ($dryRun ? "[DRY RUN] No se escribio nada en la base de datos." : "Importacion completada.") . PHP_EOL;
