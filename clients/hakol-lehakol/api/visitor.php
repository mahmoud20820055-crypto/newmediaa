<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';

/*  API للزوار
    POST {action:"start", name, phone, business?, category?, message}  → {conv:{id,token}, messages:[...]}
    POST {action:"send",  token, message}                               → {message}
    POST {action:"thread", token, since?}                               → {conv, messages}
    POST {action:"list",  tokens:[...]}                                 → {conversations}
*/

$d = input();
$action = str($d, 'action', 20, true);

function conv_by_token(string $token): array {
    if (!preg_match('/^[a-f0-9]{32}$/', $token)) fail('not_found', 404);
    $st = db()->prepare('SELECT * FROM conversations WHERE token_hash = ?');
    $st->execute([token_hash($token)]);
    $c = $st->fetch();
    if (!$c) fail('not_found', 404);
    return $c;
}
function public_conv(array $c): array {
    return [
        'id' => (int)$c['id'], 'name' => $c['name'], 'category' => $c['category'], 'status' => $c['status'],
        'last_msg' => $c['last_msg'], 'unread' => (int)$c['unread_visitor'],
        'created_at' => (int)$c['created_at'], 'updated_at' => (int)$c['updated_at'],
    ];
}

switch ($action) {
    case 'start': {
        if (!empty($d['_gotcha'])) out(['ok' => true]); // honeypot
        rate_limit('msg', (int)cfg('rate_per_minute'));
        $name = str($d, 'name', 80, true);
        $phone = str($d, 'phone', 20, true);
        if (!preg_match('/^[0-9+\-\s]{9,20}$/', $phone)) fail('bad_phone');
        $business = str($d, 'business', 100);
        $category = str($d, 'category', 60);
        $message = str($d, 'message', 2000, true);

        $token = bin2hex(random_bytes(16));
        $now = time();
        $pdo = db();
        $pdo->beginTransaction();
        $pdo->prepare('INSERT INTO conversations(token_hash, name, phone, business, category, ip, created_at, updated_at)
                       VALUES(?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([token_hash($token), $name, $phone, $business, $category, client_ip(), $now, $now]);
        $id = (int)$pdo->lastInsertId();
        $m1 = add_message($id, 'visitor', $message);
        $m2 = add_message($id, 'auto', auto_reply_text($name));
        $pdo->commit();

        notify_admin('פנייה חדשה מהאתר – ' . $name,
            "שם: $name\nטלפון: $phone\nעסק: $business\nתחום: $category\n\n$message");
        out(['ok' => true, 'conv' => ['id' => $id, 'token' => $token], 'messages' => [$m1, $m2]]);
    }

    case 'send': {
        rate_limit('msg', (int)cfg('rate_per_minute'));
        $c = conv_by_token(str($d, 'token', 64, true));
        $message = str($d, 'message', 2000, true);
        $m = add_message((int)$c['id'], 'visitor', $message);
        notify_admin('הודעה חדשה מ' . $c['name'], $message);
        out(['ok' => true, 'message' => $m]);
    }

    case 'thread': {
        rate_limit('read', 120);
        $c = conv_by_token(str($d, 'token', 64, true));
        $since = max(0, (int)($d['since'] ?? 0));
        $st = db()->prepare('SELECT id, sender, body, created_at FROM messages WHERE conv_id = ? AND id > ? ORDER BY id');
        $st->execute([$c['id'], $since]);
        $msgs = $st->fetchAll();
        foreach ($msgs as &$m) { $m['id'] = (int)$m['id']; $m['created_at'] = (int)$m['created_at']; }
        if ((int)$c['unread_visitor'] > 0) {
            db()->prepare('UPDATE conversations SET unread_visitor = 0 WHERE id = ?')->execute([$c['id']]);
        }
        out(['ok' => true, 'conv' => public_conv($c), 'messages' => $msgs]);
    }

    case 'list': {
        rate_limit('read', 120);
        $tokens = is_array($d['tokens'] ?? null) ? array_slice($d['tokens'], 0, 30) : [];
        $hashes = [];
        foreach ($tokens as $t) if (is_string($t) && preg_match('/^[a-f0-9]{32}$/', $t)) $hashes[token_hash($t)] = $t;
        if (!$hashes) out(['ok' => true, 'conversations' => []]);
        $in = implode(',', array_fill(0, count($hashes), '?'));
        $st = db()->prepare("SELECT * FROM conversations WHERE token_hash IN ($in) ORDER BY updated_at DESC");
        $st->execute(array_keys($hashes));
        $list = [];
        foreach ($st->fetchAll() as $c) $list[] = public_conv($c) + ['token' => $hashes[$c['token_hash']]];
        out(['ok' => true, 'conversations' => $list]);
    }

    default: fail('unknown_action');
}
