<?php

declare(strict_types=1);

use App\Application\Middleware\MultipartFormDataMiddleware;
use App\Application\Middleware\SessionMiddleware;
use Slim\App;

return function (App $app) {
    $app->add(SessionMiddleware::class);

    // Parses PUT/PATCH + multipart/form-data bodies, which PHP does not
    // populate into $_POST/$_FILES automatically (only POST gets that).
    // See MultipartFormDataMiddleware docblock for full rationale.
    $app->add(MultipartFormDataMiddleware::class);
};
