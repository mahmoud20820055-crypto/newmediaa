<?php
declare(strict_types=1);

$CFG = require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function cfg(string $k) { global $CFG; return $CFG[$k] ?? null; }

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $path = cfg('db_path');
    $dir = dirname($path);
    if (!is_dir($dir)) mkdir($dir, 0750, true);
    $pdo = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;');
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token_hash TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            business TEXT NOT NULL DEFAULT "",
            category TEXT NOT NULL DEFAULT "",
            status TEXT NOT NULL DEFAULT "open",
            last_msg TEXT NOT NULL DEFAULT "",
            unread_admin INTEGER NOT NULL DEFAULT 0,
            unread_visitor INTEGER NOT NULL DEFAULT 0,
            ip TEXT NOT NULL DEFAULT "",
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conv_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            sender TEXT NOT NULL,
            body TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conv_id, id);
        CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS hits (ip TEXT NOT NULL, kind TEXT NOT NULL, ts INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_hits ON hits(ip, kind, ts);
    ');
    return $pdo;
}

function setting(string $k, ?string $default = null): ?string {
    $st = db()->prepare('SELECT v FROM settings WHERE k = ?');
    $st->execute([$k]);
    $v = $st->fetchColumn();
    return $v === false ? $default : $v;
}
function set_setting(string $k, string $v): void {
    db()->prepare('INSERT INTO settings(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')->execute([$k, $v]);
}

function out(array $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $msg, int $code = 400): never { out(['ok' => false, 'error' => $msg], $code); }

function input(): array {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('method', 405);
    $raw = file_get_contents('php://input', false, null, 0, 65536);
    $d = json_decode($raw ?: '', true);
    if (!is_array($d)) fail('bad_json');
    return $d;
}

function str(array $d, string $k, int $max, bool $required = false): string {
    $v = isset($d[$k]) && is_scalar($d[$k]) ? trim((string)$d[$k]) : '';
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    if (mb_strlen($v) > $max) $v = mb_substr($v, 0, $max);
    if ($required && $v === '') fail('missing_' . $k);
    return $v;
}

function client_ip(): string { return substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64); }

function rate_limit(string $kind, int $max, int $window = 60): void {
    $ip = client_ip(); $now = time();
    $pdo = db();
    $pdo->prepare('DELETE FROM hits WHERE ts < ?')->execute([$now - 3600]);
    $st = $pdo->prepare('SELECT COUNT(*) FROM hits WHERE ip = ? AND kind = ? AND ts > ?');
    $st->execute([$ip, $kind, $now - $window]);
    if ((int)$st->fetchColumn() >= $max) fail('rate_limited', 429);
    $pdo->prepare('INSERT INTO hits(ip, kind, ts) VALUES(?, ?, ?)')->execute([$ip, $kind, $now]);
}

function token_hash(string $t): string { return hash('sha256', $t); }

function auto_reply_text(string $name): string {
    $tpl = setting('auto_reply', cfg('auto_reply'));
    return strtr($tpl, [
        '{name}' => $name,
        '{site}' => cfg('site_name'),
        '{whatsapp}' => 'https://wa.me/' . preg_replace('/\D/', '', (string)cfg('whatsapp')),
    ]);
}

function add_message(int $convId, string $sender, string $body): array {
    $now = time();
    $pdo = db();
    $pdo->prepare('INSERT INTO messages(conv_id, sender, body, created_at) VALUES(?, ?, ?, ?)')
        ->execute([$convId, $sender, $body, $now]);
    $id = (int)$pdo->lastInsertId();
    if ($sender === 'auto') return ['id' => $id, 'sender' => $sender, 'body' => $body, 'created_at' => $now];
    $preview = mb_substr(preg_replace('/\s+/u', ' ', $body), 0, 120);
    if ($sender === 'visitor') {
        $pdo->prepare('UPDATE conversations SET last_msg = ?, updated_at = ?, unread_admin = unread_admin + 1,
                       status = CASE WHEN status = "closed" THEN "open" ELSE status END WHERE id = ?')
            ->execute([$preview, $now, $convId]);
    } else {
        $pdo->prepare('UPDATE conversations SET last_msg = ?, updated_at = ?, unread_visitor = unread_visitor + 1 WHERE id = ?')
            ->execute([$preview, $now, $convId]);
    }
    return ['id' => $id, 'sender' => $sender, 'body' => $body, 'created_at' => $now];
}

function notify_admin(string $subject, string $body): void {
    $to = (string)cfg('notify_email');
    if ($to === '' || !function_exists('mail')) return;
    $headers = "Content-Type: text/plain; charset=UTF-8\r\n";
    @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
}

/* ---------- Admin session ---------- */
function start_admin_session(): void {
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_name('hl_admin');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'secure' => $secure, 'samesite' => 'Strict']);
    session_start();
}
function require_admin(bool $mutating = true): void {
    if (empty($_SESSION['admin'])) fail('unauthorized', 401);
    if ($mutating) {
        $h = $_SERVER['HTTP_X_CSRF'] ?? '';
        if (!is_string($h) || !hash_equals($_SESSION['csrf'] ?? '', $h)) fail('csrf', 403);
    }
}
