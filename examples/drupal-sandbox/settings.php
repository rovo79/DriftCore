<?php
$databases['default']['default'] = [
  'database' => getenv('DRUPAL_DB_NAME') ?: 'drupal',
  'username' => getenv('DRUPAL_DB_USER') ?: 'drupal',
  'password' => getenv('DRUPAL_DB_PASSWORD') ?: 'drupal',
  'host' => getenv('DRUPAL_DB_HOST') ?: 'database',
  'driver' => 'mysql',
  'prefix' => '',
];

$settings['config_sync_directory'] = '/var/www/html/config/sync';
$settings['trusted_host_patterns'] = ['^localhost$', '^driftcore-sandbox$'];
