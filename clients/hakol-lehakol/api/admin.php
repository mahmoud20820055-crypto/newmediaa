<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
start_admin_session();

/*  API للمدير (جلسة + CSRF)
    state | setup | login | logout | stats | conversations | thread | reply | status | delete | settings | save_settings | password
*/

$d = input();
$action = str($d, 'action', 30, true);

function conv(int $id): array {
    $st = db()->prepare('SELECT * FROM conversations WHERE id = ?');
    $st->execute([$id]);
    $c = $st->fetch();
    if (!$c) fail('not_found', 404);
    return $c;
}
function admin_conv(array $c): array {
    foreach (['id', 'unread_admin', 'unread_visitor', 'created_at', 'updated_at'] as $k) $c[$k] = (int)$c[$k];
    unset($c['token_hash']);
    return $c;
}
function login_ok(): array {
    session_regenerate_id(true);
    $_SESSION['admin'] = true;
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return ['ok' => true, 'csrf' => $_SESSION['csrf']];
}

switch ($action) {
    case 'state': {
        $hasPass = setting('admin_hash') !== null;
        $logged = !empty($_SESSION['admin']);
        out(['ok' => true, 'needs_setup' => !$hasPass, 'logged_in' => $logged, 'csrf' => $logged ? $_SESSION['csrf'] : null]);
    }

    case 'setup': {
        rate_limit('login', 5, 300);
        if (setting('admin_hash') !== null) fail('already_setup', 409);
        $key = str($d, 'setup_key', 200, true);
        if (cfg('setup_key') === 'CHANGE-ME-before-upload' || !hash_equals((string)cfg('setup_key'), $key)) fail('bad_setup_key', 403);
        $pass = str($d, 'password', 200, true);
        if (mb_strlen($pass) < 8) fail('weak_password');
        set_setting('admin_hash', password_hash($pass, PASSWORD_DEFAULT));
        out(login_ok());
    }

    case 'login': {
        rate_limit('login', 8, 300);
        $hash = setting('admin_hash');
        $pass = str($d, 'password', 200, true);
        if ($hash === null || !password_verify($pass, $hash)) fail('bad_password', 401);
        out(login_ok());
    }

    case 'logout': {
        $_SESSION = [];
        session_destroy();
        out(['ok' => true]);
    }

    case 'stats': {
        require_admin(false);
        $pdo = db();
        $today = strtotime('today');
        $week = strtotime('-6 days', $today);
        $q = fn(string $sql, array $p = []) => (function () use ($pdo, $sql, $p) { $s = $pdo->prepare($sql); $s->execute($p); return (int)$s->fetchColumn(); })();
        $byCat = $pdo->query('SELECT CASE WHEN category = "" THEN "ללא" ELSE category END AS category, COUNT(*) AS n
                              FROM conversations GROUP BY 1 ORDER BY n DESC')->fetchAll();
        $daysSt = $pdo->prepare('SELECT date(created_at, "unixepoch", "localtime") AS day, COUNT(*) AS n FROM conversations
                                 WHERE created_at >= ? GROUP BY day');
        $daysSt->execute([$week]);
        $daysMap = array_column($daysSt->fetchAll(), 'n', 'day');
        $days = [];
        for ($i = 6; $i >= 0; $i--) { $day = date('Y-m-d', strtotime("-$i days", $today)); $days[] = ['day' => $day, 'n' => (int)($daysMap[$day] ?? 0)]; }
        out(['ok' => true,
            'total' => $q('SELECT COUNT(*) FROM conversations'),
            'open' => $q('SELECT COUNT(*) FROM conversations WHERE status = "open"'),
            'unread' => $q('SELECT COUNT(*) FROM conversations WHERE unread_admin > 0'),
            'today' => $q('SELECT COUNT(*) FROM conversations WHERE created_at >= ?', [$today]),
            'by_category' => $byCat,
            'days' => $days,
        ]);
    }

    case 'conversations': {
        require_admin(false);
        $status = str($d, 'status', 10);
        $search = str($d, 'q', 60);
        $sql = 'SELECT * FROM conversations WHERE 1';
        $p = [];
        if (in_array($status, ['open', 'closed'], true)) { $sql .= ' AND status = ?'; $p[] = $status; }
        if ($status === 'unread') $sql .= ' AND unread_admin > 0';
        if ($search !== '') {
            $sql .= ' AND (name LIKE ? ESCAPE "\\" OR phone LIKE ? ESCAPE "\\" OR business LIKE ? ESCAPE "\\" OR last_msg LIKE ? ESCAPE "\\")';
            $like = '%' . addcslashes($search, '%_\\') . '%';
            array_push($p, $like, $like, $like, $like);
        }
        $sql .= ' ORDER BY updated_at DESC LIMIT 300';
        $st = db()->prepare($sql);
        $st->execute($p);
        out(['ok' => true, 'conversations' => array_map('admin_conv', $st->fetchAll())]);
    }

    case 'thread': {
        require_admin(false);
        $c = conv((int)($d['id'] ?? 0));
        $since = max(0, (int)($d['since'] ?? 0));
        $st = db()->prepare('SELECT id, sender, body, created_at FROM messages WHERE conv_id = ? AND id > ? ORDER BY id');
        $st->execute([$c['id'], $since]);
        $msgs = $st->fetchAll();
        foreach ($msgs as &$m) { $m['id'] = (int)$m['id']; $m['created_at'] = (int)$m['created_at']; }
        if ((int)$c['unread_admin'] > 0) {
            db()->prepare('UPDATE conversations SET unread_admin = 0 WHERE id = ?')->execute([$c['id']]);
            $c['unread_admin'] = 0;
        }
        out(['ok' => true, 'conv' => admin_conv($c), 'messages' => $msgs]);
    }

    case 'reply': {
        require_admin();
        $c = conv((int)($d['id'] ?? 0));
        $m = add_message((int)$c['id'], 'admin', str($d, 'message', 4000, true));
        out(['ok' => true, 'message' => $m]);
    }

    case 'status': {
        require_admin();
        $c = conv((int)($d['id'] ?? 0));
        $s = str($d, 'status', 10, true);
        if (!in_array($s, ['open', 'closed'], true)) fail('bad_status');
        db()->prepare('UPDATE conversations SET status = ? WHERE id = ?')->execute([$s, $c['id']]);
        out(['ok' => true]);
    }

    case 'delete': {
        require_admin();
        $c = conv((int)($d['id'] ?? 0));
        db()->prepare('DELETE FROM conversations WHERE id = ?')->execute([$c['id']]);
        out(['ok' => true]);
    }

    case 'settings': {
        require_admin(false);
        out(['ok' => true, 'auto_reply' => setting('auto_reply', cfg('auto_reply')), 'whatsapp' => cfg('whatsapp')]);
    }

    case 'save_settings': {
        require_admin();
        set_setting('auto_reply', str($d, 'auto_reply', 2000, true));
        out(['ok' => true]);
    }

    case 'password': {
        require_admin();
        $hash = setting('admin_hash');
        if (!password_verify(str($d, 'current', 200, true), (string)$hash)) fail('bad_password', 401);
        $new = str($d, 'new', 200, true);
        if (mb_strlen($new) < 8) fail('weak_password');
        set_setting('admin_hash', password_hash($new, PASSWORD_DEFAULT));
        out(['ok' => true]);
    }

    default: fail('unknown_action');
}
