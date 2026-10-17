<?php
/**
 * ArtaSat — form handler for contact.html and collaborate.html (all languages).
 * Messages are emailed to $TO below. This file runs on the server, so the
 * address is never sent to visitors' browsers.
 *
 * Requirements: any PHP 7.2+ host (cPanel / DirectAdmin).
 * Delivery: uses PHP mail() by default. If messages land in spam or never
 * arrive, turn on SMTP below (e.g. Gmail with an App Password).
 */

// ───────────── settings ─────────────
$TO        = 'amir6haddadi@gmail.com';      // where submissions are delivered
$SITE_NAME = 'ArtaSat';
$FROM      = 'noreply@' . preg_replace('/^www\./', '', $_SERVER['HTTP_HOST'] ?? 'artasat.com');
$SAVE_COPY = true;                           // also keep a CSV copy in /messages (protected)

$SMTP = [
  'enabled'  => false,                       // true = send through SMTP instead of mail()
  'host'     => 'ssl://smtp.gmail.com',
  'port'     => 465,
  'user'     => 'amir6haddadi@gmail.com',
  'pass'     => '',                          // Gmail → Google Account → Security → App passwords
];
// ────────────────────────────────────

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function out($ok, $code = 200, $msg = '') { http_response_code($code); echo json_encode(['ok' => $ok, 'error' => $msg]); exit; }

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') out(false, 405, 'method');

// accept JSON or regular form posts
$raw = file_get_contents('php://input');
$in  = json_decode($raw, true);
if (!is_array($in)) $in = $_POST;

// honeypot: bots fill hidden fields
if (!empty($in['website'])) out(true);

// simple rate limit: 6 submissions / 10 minutes / IP
$ip = $_SERVER['REMOTE_ADDR'] ?? '0';
$rl = sys_get_temp_dir() . '/artasat_rl_' . md5($ip);
$hits = array_filter(@json_decode(@file_get_contents($rl), true) ?: [], function ($t) { return $t > time() - 600; });
if (count($hits) >= 6) out(false, 429, 'rate');
$hits[] = time(); @file_put_contents($rl, json_encode(array_values($hits)));

function clean($v, $max = 2000) {
  if (is_array($v)) $v = implode(', ', $v);
  $v = trim(strip_tags((string)$v));
  $v = preg_replace('/[\r\n]+/', "\n", $v);
  return mb_substr($v, 0, $max, 'UTF-8');
}
$form = ($in['form'] ?? '') === 'collaboration' ? 'collaboration' : 'contact';
$fields = [
  'type_label'   => 'Collaboration type',
  'name'         => 'Name',
  'organization' => 'Organisation',
  'role'         => 'Position',
  'email'        => 'Email',
  'phone'        => 'Phone',
  'link'         => 'Link',
  'sector'       => 'Sector',
  'region'       => 'Region',
  'area'         => 'Area (ha)',
  'crops'        => 'Crops',
  'module'       => 'Module',
  'modules'      => 'Modules',
  'message'      => 'Message',
  'lang'         => 'Site language',
  'page'         => 'Page',
];
$d = [];
foreach ($fields as $k => $label) if (isset($in[$k]) && $in[$k] !== '') $d[$k] = clean($in[$k], $k === 'message' ? 6000 : 400);

if (empty($d['name']) || empty($d['message'])) out(false, 422, 'required');
if (empty($d['email']) || !filter_var($d['email'], FILTER_VALIDATE_EMAIL)) out(false, 422, 'email');
if ($form === 'collaboration' && (empty($d['phone']) || empty($d['type_label']))) out(false, 422, 'required');

$subjectTxt = ($form === 'collaboration' ? "Collaboration request — " . $d['type_label'] : "Contact message")
            . " — " . ($d['organization'] ?? $d['name']) . " | $SITE_NAME";
$subject = '=?UTF-8?B?' . base64_encode($subjectTxt) . '?=';

$rows = '';
foreach ($fields as $k => $label) {
  if (!isset($d[$k])) continue;
  $val = nl2br(htmlspecialchars($d[$k], ENT_QUOTES, 'UTF-8'));
  $rows .= "<tr><td style=\"padding:8px 12px;background:#f3f6f4;font-weight:bold;white-space:nowrap;vertical-align:top\">$label</td><td style=\"padding:8px 12px;vertical-align:top\" dir=\"auto\">$val</td></tr>";
}
$when = gmdate('Y-m-d H:i') . ' UTC';
$html = "<!doctype html><html><body style=\"font-family:Tahoma,Arial,sans-serif;font-size:14px;color:#0d1b2a\">"
      . "<h2 style=\"color:#0b2e59;margin:0 0 12px\">" . htmlspecialchars($subjectTxt, ENT_QUOTES, 'UTF-8') . "</h2>"
      . "<table style=\"border-collapse:collapse;border:1px solid #dce4df\">$rows</table>"
      . "<p style=\"color:#55657a;font-size:12px\">$when · IP $ip</p></body></html>";

$sent = false;
if ($SMTP['enabled']) {
  $sent = smtp_send($SMTP, $FROM, $TO, $d['email'], $subject, $html, $SITE_NAME);
} else {
  $headers  = "MIME-Version: 1.0\r\n";
  $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
  $headers .= "From: =?UTF-8?B?" . base64_encode($SITE_NAME . ' website') . "?= <$FROM>\r\n";
  $headers .= "Reply-To: " . $d['email'] . "\r\n";
  $sent = @mail($TO, $subject, $html, $headers, "-f$FROM");
}

if ($SAVE_COPY) {
  $dir = __DIR__ . '/messages';
  if (!is_dir($dir)) { @mkdir($dir, 0750); @file_put_contents("$dir/.htaccess", "Require all denied\nDeny from all\n"); }
  $f = "$dir/" . date('Y-m') . '.csv';
  $new = !file_exists($f);
  if ($fh = @fopen($f, 'a')) {
    if ($new) fputcsv($fh, array_merge(['time', 'form', 'ip'], array_keys($fields)));
    $line = [$when, $form, $ip];
    foreach ($fields as $k => $_) $line[] = $d[$k] ?? '';
    fputcsv($fh, $line); fclose($fh);
  }
}

out($sent || $SAVE_COPY, $sent || $SAVE_COPY ? 200 : 500, $sent ? '' : 'mail');

// ───────── minimal SMTP client (SSL + AUTH LOGIN) ─────────
function smtp_send($c, $from, $to, $replyTo, $subject, $html, $name) {
  $s = @fsockopen($c['host'], $c['port'], $en, $es, 15);
  if (!$s) return false;
  $r = function () use ($s) { $d = ''; while ($l = fgets($s, 515)) { $d .= $l; if (substr($l, 3, 1) === ' ') break; } return $d; };
  $w = function ($cmd) use ($s, $r) { fwrite($s, $cmd . "\r\n"); return $r(); };
  $r();
  $w('EHLO ' . ($_SERVER['HTTP_HOST'] ?? 'localhost'));
  if (strpos($w('AUTH LOGIN'), '334') !== 0) return false;
  $w(base64_encode($c['user']));
  if (strpos($w(base64_encode($c['pass'])), '235') !== 0) return false;
  $w("MAIL FROM:<{$c['user']}>");
  $w("RCPT TO:<$to>");
  $w('DATA');
  $msg  = "From: =?UTF-8?B?" . base64_encode($name . ' website') . "?= <{$c['user']}>\r\n";
  $msg .= "To: <$to>\r\nReply-To: $replyTo\r\nSubject: $subject\r\n";
  $msg .= "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
  $msg .= chunk_split(base64_encode($html));
  $ok = strpos($w($msg . "\r\n."), '250') === 0;
  $w('QUIT'); fclose($s);
  return $ok;
}
