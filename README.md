# baloon-calculator

Калькулятор печати на шарах с формой заказа. Форма защищена невидимой **Яндекс SmartCaptcha**
и отправляет заявку на почту через `send.php` (PHP `mail()`), без перезагрузки страницы.

## Настройка перед публикацией

1. **Ключи капчи.** В [Yandex Cloud](https://console.cloud.yandex.ru/) → сервис *SmartCaptcha* → «Создать капчу».
   Тип — **невидимая**, в списке доменов укажите домен сайта (для локальной отладки добавьте `localhost`).
   После создания скопируйте два ключа:
   - **Ключ клиента** → `index.html`, атрибут `data-captcha-key="..."` на `<form id="order-form">`.
   - **Ключ сервера** → `send.php`, константа `CAPTCHA_SERVER_KEY`.
2. **Почта.** В `send.php` укажите `MAIL_TO` — адрес, куда приходят заявки.
   `MAIL_FROM` по умолчанию `noreply@<домен сайта>`; если хостинг требует существующий ящик, впишите его.
3. **Хостинг.** Нужен PHP ≥ 7.4 с расширениями `curl` и `mbstring`, а также рабочий `mail()`
   (sendmail/postfix). На большинстве shared-хостингов (Beget, Timeweb, reg.ru) это есть из коробки.

## Локальная проверка

```bash
php -S localhost:8000
```

Открыть <http://localhost:8000>. Локально `mail()` обычно не отправляет письма —
достаточно убедиться, что `POST send.php` возвращает `{"ok":true}`.
Ошибки сервера пишутся в лог PHP (`error_log`).

## Как это работает

- `assets/script.js`: валидация → `smartCaptcha.execute()` → в `callback(token)` fetch на `send.php`.
- `send.php`: honeypot → валидация → запрос к `smartcaptcha.yandexcloud.net/validate` → `mail()`.
