<?php
if (!defined('_GNUBOARD_')) exit;
?>
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<?php
/* REDUE_AI_STUDIO_RENDER:START */
if (function_exists('redue_render_full_schema')) {
    echo redue_render_full_schema();
}
/* REDUE_AI_STUDIO_RENDER:END */
?>
<title><?php echo $g5_head_title; ?></title>
<?php /* Canonical / og:url / description / OG / Twitter / JSON-LD 는 redue_render_full_schema() 에서만 1회 출력합니다. */ ?>
</head>
