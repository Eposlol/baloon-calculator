<?php
/**
 * Приём заявки из калькулятора шаров.
 * Ожидает JSON (POST) от assets/script.js, проверяет Яндекс SmartCaptcha
 * и отправляет письмо через mail(). Отвечает JSON: {ok:true} или {ok:false,error:"..."}.
 */

declare(strict_types=1);

// ======================= НАСТРОЙКИ =======================
const CAPTCHA_SERVER_KEY = '__YANDEX_SERVER_KEY__';   // серверный ключ SmartCaptcha (Yandex Cloud)
const MAIL_TO            = '__MAIL_TO__';             // куда слать заявки
const MAIL_SUBJECT       = 'Заявка на печать на шарах';
// From должен быть на домене сайта, иначе письмо почти наверняка уйдёт в спам.
// При необходимости замените на конкретный ящик, например 'noreply@example.ru'.
define('MAIL_FROM', 'noreply@' . preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost'));
// =========================================================

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $code, array $payload): void
{
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Строка без HTML и управляющих символов, обрезанная по длине. */
function clean($value, int $max): string
{
    if (!is_scalar($value)) {
        return '';
    }
    $s = strip_tags((string) $value);
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    return mb_substr(trim($s), 0, $max);
}

/** Для заголовков письма: ещё и без переводов строк (защита от header injection). */
function headerSafe(string $s): string
{
    return str_replace(["\r", "\n"], '', $s);
}

function encodeHeader(string $s): string
{
    return '=?UTF-8?B?' . base64_encode($s) . '?=';
}

// ---------- Метод и тело ----------
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'Метод не поддерживается']);
}

$raw  = file_get_contents('php://input') ?: '';
$data = json_decode($raw, true);
if (!is_array($data)) {
    respond(400, ['ok' => false, 'error' => 'Некорректный запрос']);
}

// ---------- Honeypot ----------
// Ботам отвечаем «успех», чтобы не подсказывать, на чём они спалились.
if (!empty($data['website'])) {
    respond(200, ['ok' => true]);
}

// ---------- Поля ----------
$name  = clean($data['name']  ?? '', 100);
$phone = clean($data['phone'] ?? '', 40);
$email = clean($data['email'] ?? '', 120);
$msg   = clean($data['msg']   ?? '', 2000);
$token = is_string($data['token'] ?? null) ? $data['token'] : '';

$digits = preg_replace('/\D/', '', $phone) ?? '';
if (strlen($digits) < 6 || strlen($digits) > 15) {
    respond(400, ['ok' => false, 'error' => 'Укажите корректный телефон']);
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(400, ['ok' => false, 'error' => 'Укажите корректный e-mail']);
}
if ($token === '') {
    respond(400, ['ok' => false, 'error' => 'Проверка капчи не пройдена']);
}

// Данные заказа (из калькулятора)
$shar     = clean($data['shar']   ?? '', 60);
$option   = clean($data['option'] ?? '', 60);
$qty      = (int) ($data['qty'] ?? 0);
$perBall  = is_numeric($data['pricePerBall'] ?? null) ? (float) $data['pricePerBall'] : null;
$total    = is_numeric($data['total'] ?? null) ? (float) $data['total'] : null;
$same     = $data['sameBothSides'] ?? null;
$colorsA  = is_array($data['colorsA'] ?? null) ? array_map(fn($c) => clean($c, 40), $data['colorsA']) : [];
$colorsB  = is_array($data['colorsB'] ?? null) ? array_map(fn($c) => clean($c, 40), $data['colorsB']) : null;

// ---------- Проверка SmartCaptcha ----------
if (CAPTCHA_SERVER_KEY === '' || strpos(CAPTCHA_SERVER_KEY, '__') === 0) {
    error_log('send.php: CAPTCHA_SERVER_KEY не задан');
    respond(500, ['ok' => false, 'error' => 'Сервис временно недоступен']);
}

$ch = curl_init('https://smartcaptcha.yandexcloud.net/validate');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => http_build_query([
        'secret' => CAPTCHA_SERVER_KEY,
        'token'  => $token,
        'ip'     => $_SERVER['REMOTE_ADDR'] ?? '',
    ]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 5,
    CURLOPT_CONNECTTIMEOUT => 3,
]);
$captchaRaw  = curl_exec($ch);
$captchaCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr     = curl_error($ch);
curl_close($ch);

if ($captchaRaw === false || $captchaCode !== 200) {
    error_log('send.php: SmartCaptcha недоступна: HTTP ' . $captchaCode . ' ' . $curlErr);
    respond(502, ['ok' => false, 'error' => 'Сервис проверки временно недоступен. Попробуйте позже.']);
}
$captcha = json_decode((string) $captchaRaw, true);
if (($captcha['status'] ?? '') !== 'ok') {
    respond(400, ['ok' => false, 'error' => 'Проверка капчи не пройдена. Попробуйте ещё раз.']);
}

// ---------- Письмо ----------
$fmt = fn(?float $v): string => $v === null ? '—' : number_format($v, 2, ',', ' ') . ' ₽';

$sidesText = $same === null ? '' : ($same ? 'одинаковая с двух сторон' : 'разная на сторонах');

$lines = [
    'Новая заявка с калькулятора печати на шарах',
    '',
    '--- Заказ ---',
    'Цвет шара:      ' . ($shar ?: '—'),
    'Печать:         ' . ($option ?: '—') . ($sidesText ? " ($sidesText)" : ''),
    'Тираж:          ' . ($qty > 0 ? $qty . ' шт.' : '—'),
    'Цвета логотипа: ' . ($colorsA ? implode(', ', $colorsA) : '—'),
];
if ($colorsB) {
    $lines[] = 'Цвета (сторона B): ' . implode(', ', $colorsB);
}
$lines = array_merge($lines, [
    'Цена за шар:    ' . $fmt($perBall),
    'Итого:          ' . $fmt($total),
    '',
    '--- Контакты ---',
    'Имя:      ' . ($name ?: '—'),
    'Телефон:  ' . $phone,
    'E-mail:   ' . ($email ?: '—'),
    'Сообщение:',
    $msg !== '' ? $msg : '—',
    '',
    '--- Служебное ---',
    'IP:    ' . ($_SERVER['REMOTE_ADDR'] ?? '—'),
    'Дата:  ' . date('d.m.Y H:i:s'),
    'Сайт:  ' . ($_SERVER['HTTP_HOST'] ?? '—'),
]);
$body = implode("\r\n", $lines);

$subject = MAIL_SUBJECT . ($qty > 0 ? ": $qty шт." : '');

$headers = [
    'From: ' . encodeHeader('Калькулятор шаров') . ' <' . headerSafe(MAIL_FROM) . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'X-Mailer: PHP/' . PHP_VERSION,
];
if ($email !== '') {
    $headers[] = 'Reply-To: ' . headerSafe($email);
}

$sent = @mail(MAIL_TO, encodeHeader($subject), $body, implode("\r\n", $headers), '-f' . headerSafe(MAIL_FROM));

if (!$sent) {
    error_log('send.php: mail() вернул false');
    respond(500, ['ok' => false, 'error' => 'Не удалось отправить письмо. Попробуйте позже.']);
}

respond(200, ['ok' => true]);
