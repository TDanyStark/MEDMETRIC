<?php

declare(strict_types=1);

namespace App\Infrastructure\Database;

use PDO;
use PDOException;

final class Connection
{
    private static ?PDO $pdo = null;

    public static function getConnection(): PDO
    {
        if (self::$pdo === null) {
            self::$pdo = self::createConnection();
        }

        return self::$pdo;
    }

    public static function testConnection(): array
    {
        try {
            $pdo = self::getConnection();
            $pdo->query('SELECT 1');

            return [
                'status' => 'ok',
                'message' => 'Connected to database',
            ];
        } catch (PDOException $exception) {
            return [
                'status' => 'error',
                'message' => $exception->getMessage(),
            ];
        }
    }

    private static function createConnection(): PDO
    {
        $host = $_ENV['DB_HOST'] ?? '127.0.0.1';
        $port = $_ENV['DB_PORT'] ?? '3306';
        $database = $_ENV['DB_NAME'] ?? 'medmetric';
        $user = $_ENV['DB_USER'] ?? 'root';
        $password = $_ENV['DB_PASS'] ?? '';
        $charset = $_ENV['DB_CHARSET'] ?? 'utf8mb4';

        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            $host,
            $port,
            $database,
            $charset
        );

        return new PDO($dsn, $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
}
