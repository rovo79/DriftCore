FROM drupal:11-apache

RUN set -eux; \
    apt-get update; \
    apt-get install -y git unzip mariadb-client; \
    rm -rf /var/lib/apt/lists/*;

COPY ./settings.php /var/www/html/sites/default/settings.local.php
COPY ./config /var/www/html/config

RUN chown -R www-data:www-data /var/www/html/config
