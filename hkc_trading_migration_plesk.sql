-- ============================================================================
-- HKC Trading ERP - Complete Database Migration Dump
-- Target Platform: Plesk / phpMyAdmin / MySQL 5.7+ & 8.0+
-- Generated Date: 2026-09-28T20:16:29.986Z
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ----------------------------------------------------------------------------
-- Table structure for table `attendance_records`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `attendance_records`;
CREATE TABLE `attendance_records` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_attendance_records_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `attendance_records`

-- ----------------------------------------------------------------------------
-- Table structure for table `chart_of_accounts`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `chart_of_accounts`;
CREATE TABLE `chart_of_accounts` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json DEFAULT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `peachtree_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parent_account_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_group` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_chart_of_accounts_created_at` (`created_at` DESC),
  KEY `idx_coa_code` (`code`),
  KEY `idx_coa_account_type` (`account_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `chart_of_accounts` (243 rows)
INSERT INTO `chart_of_accounts` (`id`, `payload`, `created_at`, `updated_at`, `code`, `name`, `account_type`, `peachtree_type`, `parent_account_id`, `is_group`, `is_active`) VALUES
('1000', '{"id":"1000","code":"1000","name":"CASH","is_group":true,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":null}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.640', '1000', 'CASH', 'Asset', 'Cash', NULL, 1, 1),
('1000-01', '{"id":"1000-01","code":"1000-01","name":"PETTY CASH","is_group":true,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000"}', '2026-09-24 18:16:41.699', '2026-09-28 13:20:57.663', '1000-01', 'PETTY CASH', 'Asset', 'Cash', '1000', 1, 1),
('1000-01-01', '{"id":"1000-01-01","code":"1000-01-01","name":"PETTY CASH-HEAD OFFICE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-01"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.678', '1000-01-01', 'PETTY CASH-HEAD OFFICE', 'Asset', 'Cash', '1000-01', 0, 1),
('1000-01-02', '{"id":"1000-01-02","code":"1000-01-02","name":"PETTY CASH- WHEREHOUSE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-01"}', '2026-09-24 18:16:41.706', '2026-09-28 13:20:57.680', '1000-01-02', 'PETTY CASH- WHEREHOUSE', 'Asset', 'Cash', '1000-01', 0, 1),
('1000-02', '{"id":"1000-02","code":"1000-02","name":"CASH AT BANK","is_group":true,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000"}', '2026-09-24 18:16:41.711', '2026-09-28 13:20:57.681', '1000-02', 'CASH AT BANK', 'Asset', 'Cash', '1000', 1, 1),
('1000-02-01', '{"id":"1000-02-01","code":"1000-02-01","name":"UNB_RDB_1731816287486039","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.712', '2026-09-28 13:20:57.688', '1000-02-01', 'UNB_RDB_1731816287486039', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-02', '{"id":"1000-02-02","code":"1000-02-02","name":"CBE_AAB_1000243792839","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.713', '2026-09-28 13:20:57.692', '1000-02-02', 'CBE_AAB_1000243792839', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-03', '{"id":"1000-02-03","code":"1000-02-03","name":"UNB_RDB_21356507165014_A","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.713', '2026-09-28 13:20:57.695', '1000-02-03', 'UNB_RDB_21356507165014_A', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-04', '{"id":"1000-02-04","code":"1000-02-04","name":"UNB_RDB_21356507165025_B","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.714', '2026-09-28 13:20:57.696', '1000-02-04', 'UNB_RDB_21356507165025_B', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-042', '{"id":"1000-02-042","code":"1000-02-042","name":"BANK LOAN","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.715', '2026-09-28 13:20:57.697', '1000-02-042', 'BANK LOAN', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-05', '{"id":"1000-02-05","code":"1000-02-05","name":"UNB_RDB_ECX_1736016611485014","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.716', '2026-09-28 13:20:57.701', '1000-02-05', 'UNB_RDB_ECX_1736016611485014', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-06', '{"id":"1000-02-06","code":"1000-02-06","name":"CBE_AAB_ECX_1000282643697","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.716', '2026-09-28 13:20:57.703', '1000-02-06', 'CBE_AAB_ECX_1000282643697', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-07', '{"id":"1000-02-07","code":"1000-02-07","name":"DGB_STB_AC_1092101637851","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.717', '2026-09-28 13:20:57.710', '1000-02-07', 'DGB_STB_AC_1092101637851', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-08', '{"id":"1000-02-08","code":"1000-02-08","name":"CBE_FIB_AC_1000306160568","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.717', '2026-09-28 13:20:57.712', '1000-02-08', 'CBE_FIB_AC_1000306160568', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-09', '{"id":"1000-02-09","code":"1000-02-09","name":"CBO_SHB_AC_1000044369544","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.718', '2026-09-28 13:20:57.714', '1000-02-09', 'CBO_SHB_AC_1000044369544', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-10', '{"id":"1000-02-10","code":"1000-02-10","name":"ABAY_TAB_AC_1722015651591011","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.715', '1000-02-10', 'ABAY_TAB_AC_1722015651591011', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-11', '{"id":"1000-02-11","code":"1000-02-11","name":"CBE_RDB_AC_1000309664365","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.719', '2026-09-28 13:20:57.732', '1000-02-11', 'CBE_RDB_AC_1000309664365', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-12', '{"id":"1000-02-12","code":"1000-02-12","name":"ABAY_TAB_ECX_1720215651969012","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.720', '2026-09-28 13:20:57.734', '1000-02-12', 'ABAY_TAB_ECX_1720215651969012', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-13', '{"id":"1000-02-13","code":"1000-02-13","name":"AIB_GFB_AC_01304807538500","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.741', '1000-02-13', 'AIB_GFB_AC_01304807538500', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-14', '{"id":"1000-02-14","code":"1000-02-14","name":"CBO_ECX_AC_1000044382087","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.722', '2026-09-28 13:20:57.744', '1000-02-14', 'CBO_ECX_AC_1000044382087', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-15', '{"id":"1000-02-15","code":"1000-02-15","name":"CBE_AC_1000191551838","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.723', '2026-09-28 13:20:57.746', '1000-02-15', 'CBE_AC_1000191551838', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-16', '{"id":"1000-02-16","code":"1000-02-16","name":"BOA_SHB_AC_23720051","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.724', '2026-09-28 13:20:57.767', '1000-02-16', 'BOA_SHB_AC_23720051', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-17', '{"id":"1000-02-17","code":"1000-02-17","name":"BOA_RDB_35292853","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.776', '1000-02-17', 'BOA_RDB_35292853', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-18', '{"id":"1000-02-18","code":"1000-02-18","name":"BEB_GUB_AC_20000520346034","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.725', '2026-09-28 13:20:57.788', '1000-02-18', 'BEB_GUB_AC_20000520346034', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-19', '{"id":"1000-02-19","code":"1000-02-19","name":"CBO_SHB_ECX_1001200016831","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.730', '2026-09-28 13:20:57.792', '1000-02-19', 'CBO_SHB_ECX_1001200016831', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-20', '{"id":"1000-02-20","code":"1000-02-20","name":"OIB_DRB_1074/3834909/001/3001/","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.799', '1000-02-20', 'OIB_DRB_1074/3834909/001/3001/', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-21', '{"id":"1000-02-21","code":"1000-02-21","name":"BOA_FIB_40467351/104878358","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.801', '1000-02-21', 'BOA_FIB_40467351/104878358', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-22', '{"id":"1000-02-22","code":"1000-02-22","name":"CBE_AAB_USD_AC_1000000000462","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.771', '2026-09-28 13:20:57.803', '1000-02-22', 'CBE_AAB_USD_AC_1000000000462', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-23', '{"id":"1000-02-23","code":"1000-02-23","name":"CBE_AAB_USD_AC_1000000000551","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.771', '2026-09-28 13:20:57.805', '1000-02-23', 'CBE_AAB_USD_AC_1000000000551', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-24', '{"id":"1000-02-24","code":"1000-02-24","name":"CBE_R_AC_1000423376558","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.772', '2026-09-28 13:20:57.808', '1000-02-24', 'CBE_R_AC_1000423376558', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-25', '{"id":"1000-02-25","code":"1000-02-25","name":"ABB_R_AC_1722425651591014","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.773', '2026-09-28 13:20:57.811', '1000-02-25', 'ABB_R_AC_1722425651591014', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-26', '{"id":"1000-02-26","code":"1000-02-26","name":"CBE_ECB_AC_1000465135224","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.813', '1000-02-26', 'CBE_ECB_AC_1000465135224', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-27', '{"id":"1000-02-27","code":"1000-02-27","name":"BUNA_CPB_AC_1599601000590","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.774', '2026-09-28 13:20:57.819', '1000-02-27', 'BUNA_CPB_AC_1599601000590', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-28', '{"id":"1000-02-28","code":"1000-02-28","name":"ABB_TAB_ECX_1720215651591013","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.775', '2026-09-28 13:20:57.821', '1000-02-28', 'ABB_TAB_ECX_1720215651591013', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-29', '{"id":"1000-02-29","code":"1000-02-29","name":"UNB_RDB_ECX_1737116287486015","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.823', '1000-02-29', 'UNB_RDB_ECX_1737116287486015', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-30', '{"id":"1000-02-30","code":"1000-02-30","name":"CBO_SHB_R_100200042271","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.776', '2026-09-28 13:20:57.824', '1000-02-30', 'CBO_SHB_R_100200042271', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-31', '{"id":"1000-02-31","code":"1000-02-31","name":"UNB_RDB_ECX_1737116287486015","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.826', '1000-02-31', 'UNB_RDB_ECX_1737116287486015', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-32', '{"id":"1000-02-32","code":"1000-02-32","name":"BUB_COB_1599601000590","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.780', '2026-09-28 13:20:57.827', '1000-02-32', 'BUB_COB_1599601000590', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-33', '{"id":"1000-02-33","code":"1000-02-33","name":"CBO_CATB_AC_1059900010301","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.830', '1000-02-33', 'CBO_CATB_AC_1059900010301', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-34', '{"id":"1000-02-34","code":"1000-02-34","name":"AMB_9900003181425","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.782', '2026-09-28 13:20:57.831', '1000-02-34', 'AMB_9900003181425', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-35', '{"id":"1000-02-35","code":"1000-02-35","name":"SINQB_1045373611218","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.784', '2026-09-28 13:20:57.832', '1000-02-35', 'SINQB_1045373611218', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-36', '{"id":"1000-02-36","code":"1000-02-36","name":"UNB_OD_AC_1732416287486028","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.784', '2026-09-28 13:20:57.833', '1000-02-36', 'UNB_OD_AC_1732416287486028', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-37', '{"id":"1000-02-37","code":"1000-02-37","name":"WEGAG","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.785', '2026-09-28 13:20:57.834', '1000-02-37', 'WEGAG', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-38', '{"id":"1000-02-38","code":"1000-02-38","name":"DAB","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.785', '2026-09-28 13:20:57.835', '1000-02-38', 'DAB', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-39', '{"id":"1000-02-39","code":"1000-02-39","name":"BOA USD-239535151","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.786', '2026-09-28 13:20:57.837', '1000-02-39', 'BOA USD-239535151', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-40', '{"id":"1000-02-40","code":"1000-02-40","name":"ZEMEN 1404110452242019","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.787', '2026-09-28 13:20:57.837', '1000-02-40', 'ZEMEN 1404110452242019', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-41', '{"id":"1000-02-41","code":"1000-02-41","name":"AHADU","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.838', '1000-02-41', 'AHADU', 'Asset', 'Cash', '1000-02', 0, 1),
('1000-02-42', '{"id":"1000-02-42","code":"1000-02-42","name":"BLOCKED ACC UNB","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Cash","parent_account_id":"1000-02"}', '2026-09-24 18:16:41.788', '2026-09-28 13:20:57.839', '1000-02-42', 'BLOCKED ACC UNB', 'Asset', 'Cash', '1000-02', 0, 1),
('1100', '{"id":"1100","code":"1100","name":"WORK ADVANCE","is_group":true,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":null}', '2026-09-24 18:16:41.789', '2026-09-28 13:20:57.840', '1100', 'WORK ADVANCE', 'Asset', 'Other Current Assets', NULL, 1, 1),
('1100-01', '{"id":"1100-01","code":"1100-01","name":"DANIEL KEBEDE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1100"}', '2026-09-24 18:16:41.789', '2026-09-28 13:20:57.841', '1100-01', 'DANIEL KEBEDE', 'Asset', 'Other Current Assets', '1100', 0, 1);
INSERT INTO `chart_of_accounts` (`id`, `payload`, `created_at`, `updated_at`, `code`, `name`, `account_type`, `peachtree_type`, `parent_account_id`, `is_group`, `is_active`) VALUES
('1100-02', '{"id":"1100-02","code":"1100-02","name":"SEWAGEGN GETACHEW","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1100"}', '2026-09-24 18:16:41.790', '2026-09-28 13:20:57.842', '1100-02', 'SEWAGEGN GETACHEW', 'Asset', 'Other Current Assets', '1100', 0, 1),
('1100-03', '{"id":"1100-03","code":"1100-03","name":"PURCHASE ADVANCE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1100"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.843', '1100-03', 'PURCHASE ADVANCE', 'Asset', 'Other Current Assets', '1100', 0, 1),
('1101', '{"id":"1101","code":"1101","name":"STAFF ADVANCE","is_group":true,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":null}', '2026-09-24 18:16:41.793', '2026-09-28 13:20:57.843', '1101', 'STAFF ADVANCE', 'Asset', 'Other Current Assets', NULL, 1, 1),
('1101-01', '{"id":"1101-01","code":"1101-01","name":"DEJAZMACHE GEBEYEHU","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1101"}', '2026-09-24 18:16:41.794', '2026-09-28 13:20:57.844', '1101-01', 'DEJAZMACHE GEBEYEHU', 'Asset', 'Other Current Assets', '1101', 0, 1),
('1101-02', '{"id":"1101-02","code":"1101-02","name":"MEKONNEN ADANE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1101"}', '2026-09-24 18:16:41.794', '2026-09-28 13:20:57.845', '1101-02', 'MEKONNEN ADANE', 'Asset', 'Other Current Assets', '1101', 0, 1),
('1101-03', '{"id":"1101-03","code":"1101-03","name":"NIGUSE ABERA","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1101"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.846', '1101-03', 'NIGUSE ABERA', 'Asset', 'Other Current Assets', '1101', 0, 1),
('1101-04', '{"id":"1101-04","code":"1101-04","name":"LIYEW MENGISTE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1101"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.846', '1101-04', 'LIYEW MENGISTE', 'Asset', 'Other Current Assets', '1101', 0, 1),
('1101-05', '{"id":"1101-05","code":"1101-05","name":"SELAMAWIT G/MEDHIN","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1101"}', '2026-09-24 18:16:41.796', '2026-09-28 13:20:57.847', '1101-05', 'SELAMAWIT G/MEDHIN', 'Asset', 'Other Current Assets', '1101', 0, 1),
('1101-06', '{"id":"1101-06","code":"1101-06","name":"TAMRAT ARASHO","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1101"}', '2026-09-24 18:16:41.797', '2026-09-28 13:20:57.848', '1101-06', 'TAMRAT ARASHO', 'Asset', 'Other Current Assets', '1101', 0, 1),
('1200', '{"id":"1200","code":"1200","name":"PRE-PAYMENTS","is_group":true,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":null}', '2026-09-25 23:22:56.747', '2026-09-28 23:16:07.968', '1200', 'PRE-PAYMENTS', 'Asset', 'Other Current Assets', NULL, 1, 1),
('1200-01', '{"id":"1200-01","code":"1200-01","name":"PRE-PAIED WAREHOUSE RENT","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1200"}', '2026-09-24 18:16:41.799', '2026-09-28 13:20:57.854', '1200-01', 'PRE-PAIED WAREHOUSE RENT', 'Asset', 'Other Current Assets', '1200', 0, 1),
('1200-02', '{"id":"1200-02","code":"1200-02","name":"PRE-PAID OFFICE RENT","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1200"}', '2026-09-24 18:16:41.800', '2026-09-28 13:20:57.855', '1200-02', 'PRE-PAID OFFICE RENT', 'Asset', 'Other Current Assets', '1200', 0, 1),
('1200-03', '{"id":"1200-03","code":"1200-03","name":"PRE-PAIED INSURANCE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1200"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.857', '1200-03', 'PRE-PAIED INSURANCE', 'Asset', 'Other Current Assets', '1200', 0, 1),
('1200-04', '{"id":"1200-04","code":"1200-04","name":"DEPOSIT (ETHIO TELECOM)","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1200"}', '2026-09-24 18:16:41.801', '2026-09-28 13:20:57.858', '1200-04', 'DEPOSIT (ETHIO TELECOM)', 'Asset', 'Other Current Assets', '1200', 0, 1),
('1200-05', '{"id":"1200-05","code":"1200-05","name":"ECX MEMBERSHIP DEPOSIT","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1200"}', '2026-09-24 18:16:41.802', '2026-09-28 13:20:57.859', '1200-05', 'ECX MEMBERSHIP DEPOSIT', 'Asset', 'Other Current Assets', '1200', 0, 1),
('1200-06', '{"id":"1200-06","code":"1200-06","name":"ESL CONTAINER DEPOSIT","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1200"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.860', '1200-06', 'ESL CONTAINER DEPOSIT', 'Asset', 'Other Current Assets', '1200', 0, 1),
('1200-07', '{"id":"1200-07","code":"1200-07","name":"ERCA DEPOSIT","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1200"}', '2026-09-24 18:16:41.803', '2026-09-28 13:20:57.862', '1200-07', 'ERCA DEPOSIT', 'Asset', 'Other Current Assets', '1200', 0, 1),
('1210-08', '{"id":"1210-08","code":"1210-08","name":"SUSPENCE ACCOUNT","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":null}', '2026-09-24 18:16:41.803', '2026-09-28 13:20:57.863', '1210-08', 'SUSPENCE ACCOUNT', 'Asset', 'Other Current Assets', NULL, 0, 1),
('1300', '{"id":"1300","code":"1300","name":"TRADE RECIVEABLE","is_group":true,"is_active":true,"account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":null}', '2026-09-24 18:16:41.804', '2026-09-28 13:20:57.864', '1300', 'TRADE RECIVEABLE', 'Asset', 'Accounts Receivable', NULL, 1, 1),
('1300-01', '{"id":"1300-01","code":"1300-01","name":"EXPORT SALES RECIVEABLE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":"1300"}', '2026-09-24 18:16:41.804', '2026-09-28 13:20:57.864', '1300-01', 'EXPORT SALES RECIVEABLE', 'Asset', 'Accounts Receivable', '1300', 0, 1),
('1300-02', '{"id":"1300-02","code":"1300-02","name":"TRANSPORT SERVICE RECIVABLE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":"1300"}', '2026-09-24 18:16:41.805', '2026-09-28 13:20:57.865', '1300-02', 'TRANSPORT SERVICE RECIVABLE', 'Asset', 'Accounts Receivable', '1300', 0, 1),
('1300-03', '{"id":"1300-03","code":"1300-03","name":"VET MEDICEN SALES RECIVABLE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":"1300"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.865', '1300-03', 'VET MEDICEN SALES RECIVABLE', 'Asset', 'Accounts Receivable', '1300', 0, 1),
('1300-04', '{"id":"1300-04","code":"1300-04","name":"CAR SALES  RECIEVABLE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":"1300"}', '2026-09-24 18:16:41.809', '2026-09-28 13:20:57.866', '1300-04', 'CAR SALES  RECIEVABLE', 'Asset', 'Accounts Receivable', '1300', 0, 1),
('1300-05', '{"id":"1300-05","code":"1300-05","name":"CLEANING SERVICE  RECIEVABLE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":"1300"}', '2026-09-24 18:16:41.810', '2026-09-28 13:20:57.866', '1300-05', 'CLEANING SERVICE  RECIEVABLE', 'Asset', 'Accounts Receivable', '1300', 0, 1),
('1300-08', '{"id":"1300-08","code":"1300-08","name":"SUNDARY RECEIVABLE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":"1300"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.867', '1300-08', 'SUNDARY RECEIVABLE', 'Asset', 'Accounts Receivable', '1300', 0, 1),
('1300-09', '{"id":"1300-09","code":"1300-09","name":"HOPE IMPORT & EXPORT PLC","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":"1300"}', '2026-09-24 18:16:41.811', '2026-09-28 13:20:57.868', '1300-09', 'HOPE IMPORT & EXPORT PLC', 'Asset', 'Accounts Receivable', '1300', 0, 1),
('1310', '{"id":"1310","code":"1310","name":"OWNER RECEIVABLE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accounts Receivable","parent_account_id":null}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.868', '1310', 'OWNER RECEIVABLE', 'Asset', 'Accounts Receivable', NULL, 0, 1),
('1320-06', '{"id":"1320-06","code":"1320-06","name":"TAX RECEIVABE","is_group":true,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":null}', '2026-09-24 18:16:41.813', '2026-09-28 13:20:57.869', '1320-06', 'TAX RECEIVABE', 'Asset', 'Other Current Assets', NULL, 1, 1),
('1320-06-01', '{"id":"1320-06-01","code":"1320-06-01","name":"WITHOLD TAX RECIVABLE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1320-06"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.869', '1320-06-01', 'WITHOLD TAX RECIVABLE', 'Asset', 'Other Current Assets', '1320-06', 0, 1),
('1320-06-02', '{"id":"1320-06-02","code":"1320-06-02","name":"VAT RECIVABLE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1320-06"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.870', '1320-06-02', 'VAT RECIVABLE', 'Asset', 'Other Current Assets', '1320-06', 0, 1),
('1320-06-03', '{"id":"1320-06-03","code":"1320-06-03","name":"PROFIT TAX QUARTER PREPAYMENT","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Current Assets","parent_account_id":"1320-06"}', '2026-09-24 18:16:41.814', '2026-09-28 13:20:57.871', '1320-06-03', 'PROFIT TAX QUARTER PREPAYMENT', 'Asset', 'Other Current Assets', '1320-06', 0, 1),
('1400', '{"id":"1400","code":"1400","name":"STOCK IMPORT ITEMS","is_group":true,"is_active":true,"account_type":"Asset","peachtree_type":"Inventory","parent_account_id":null}', '2026-09-24 18:16:41.815', '2026-09-28 13:20:57.871', '1400', 'STOCK IMPORT ITEMS', 'Asset', 'Inventory', NULL, 1, 1),
('1400-01', '{"id":"1400-01","code":"1400-01","name":"STOCK OF VETERINARY DRUG","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Inventory","parent_account_id":"1400"}', '2026-09-24 18:16:41.816', '2026-09-28 13:20:57.872', '1400-01', 'STOCK OF VETERINARY DRUG', 'Asset', 'Inventory', '1400', 0, 1),
('1400-02', '{"id":"1400-02","code":"1400-02","name":"STOCK OF VEHICLE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Inventory","parent_account_id":"1400"}', '2026-09-24 18:16:41.816', '2026-09-28 13:20:57.873', '1400-02', 'STOCK OF VEHICLE', 'Asset', 'Inventory', '1400', 0, 1),
('1410', '{"id":"1410","code":"1410","name":"STOCK EXPORT ITEMS","is_group":true,"is_active":true,"account_type":"Asset","peachtree_type":"Inventory","parent_account_id":null}', '2026-09-25 23:22:56.765', '2026-09-28 23:16:07.968', '1410', 'STOCK EXPORT ITEMS', 'Asset', 'Inventory', NULL, 1, 1),
('1410-01', '{"id":"1410-01","code":"1410-01","name":"STOCK OF GREEN MUNG","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Inventory","parent_account_id":"1410"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.874', '1410-01', 'STOCK OF GREEN MUNG', 'Asset', 'Inventory', '1410', 0, 1),
('1410-02', '{"id":"1410-02","code":"1410-02","name":"STOCK OF SOYA BEAN","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Inventory","parent_account_id":"1410"}', '2026-09-24 18:16:41.818', '2026-09-28 13:20:57.875', '1410-02', 'STOCK OF SOYA BEAN', 'Asset', 'Inventory', '1410', 0, 1),
('1410-03', '{"id":"1410-03","code":"1410-03","name":"STOCK OF REDISH SESAME SEED","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Inventory","parent_account_id":"1410"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.876', '1410-03', 'STOCK OF REDISH SESAME SEED', 'Asset', 'Inventory', '1410', 0, 1),
('1410-04', '{"id":"1410-04","code":"1410-04","name":"STOCK OF SESEAM SEED","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Inventory","parent_account_id":"1410"}', '2026-09-24 18:16:41.819', '2026-09-28 13:20:57.877', '1410-04', 'STOCK OF SESEAM SEED', 'Asset', 'Inventory', '1410', 0, 1),
('1410-05', '{"id":"1410-05","code":"1410-05","name":"STOCK BLACK BEANS","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Inventory","parent_account_id":"1410"}', '2026-09-24 18:16:41.819', '2026-09-28 13:20:57.879', '1410-05', 'STOCK BLACK BEANS', 'Asset', 'Inventory', '1410', 0, 1),
('1500', '{"id":"1500","code":"1500","name":"GOOS IN TRANSIT","is_group":true,"is_active":true,"account_type":"Asset","peachtree_type":"Inventory","parent_account_id":null}', '2026-09-25 23:22:56.769', '2026-09-28 23:16:07.968', '1500', 'GOOS IN TRANSIT', 'Asset', 'Inventory', NULL, 1, 1),
('1500-09', '{"id":"1500-09","code":"1500-09","name":"GIT LC- TF260852143701 $171600","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Inventory","parent_account_id":"1500"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.880', '1500-09', 'GIT LC- TF260852143701 $171600', 'Asset', 'Inventory', '1500', 0, 1),
('1500-10', '{"id":"1500-10","code":"1500-10","name":"GIT LC101ILSN260920003 $299999","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Inventory","parent_account_id":"1500"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.881', '1500-10', 'GIT LC101ILSN260920003 $299999', 'Asset', 'Inventory', '1500', 0, 1),
('1500-11', '{"id":"1500-11","code":"1500-11","name":"GIT LC         $","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Inventory","parent_account_id":"1500"}', '2026-09-24 18:16:41.822', '2026-09-28 13:20:57.881', '1500-11', 'GIT LC         $', 'Asset', 'Inventory', '1500', 0, 1),
('1500-12', '{"id":"1500-12","code":"1500-12","name":"GIT LC         $","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Inventory","parent_account_id":"1500"}', '2026-09-24 18:16:41.823', '2026-09-28 13:20:57.883', '1500-12', 'GIT LC         $', 'Asset', 'Inventory', '1500', 0, 1),
('1600', '{"id":"1600","code":"1600","name":"FIXED ASSETS","is_group":true,"is_active":true,"account_type":"Asset","peachtree_type":"Fixed Assets","parent_account_id":null}', '2026-09-24 18:16:41.824', '2026-09-28 13:20:57.885', '1600', 'FIXED ASSETS', 'Asset', 'Fixed Assets', NULL, 1, 1),
('1600-01', '{"id":"1600-01","code":"1600-01","name":"BUILDING","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Fixed Assets","parent_account_id":"1600"}', '2026-09-24 18:16:41.825', '2026-09-28 13:20:57.886', '1600-01', 'BUILDING', 'Asset', 'Fixed Assets', '1600', 0, 1),
('1600-01-1', '{"id":"1600-01-1","code":"1600-01-1","name":"ACCMULATED DEP BUILDING","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accumulated Depreciation","parent_account_id":"1600"}', '2026-09-24 18:16:41.826', '2026-09-28 13:20:57.887', '1600-01-1', 'ACCMULATED DEP BUILDING', 'Asset', 'Accumulated Depreciation', '1600', 0, 1),
('1600-02', '{"id":"1600-02","code":"1600-02","name":"PLANT AND MACHINERY","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Fixed Assets","parent_account_id":"1600"}', '2026-09-24 18:16:41.826', '2026-09-28 13:20:57.888', '1600-02', 'PLANT AND MACHINERY', 'Asset', 'Fixed Assets', '1600', 0, 1),
('1600-02-1', '{"id":"1600-02-1","code":"1600-02-1","name":"ACC DEPR PLANT AND MACHINERY","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accumulated Depreciation","parent_account_id":"1600"}', '2026-09-24 18:16:41.826', '2026-09-28 13:20:57.888', '1600-02-1', 'ACC DEPR PLANT AND MACHINERY', 'Asset', 'Accumulated Depreciation', '1600', 0, 1);
INSERT INTO `chart_of_accounts` (`id`, `payload`, `created_at`, `updated_at`, `code`, `name`, `account_type`, `peachtree_type`, `parent_account_id`, `is_group`, `is_active`) VALUES
('1600-03', '{"id":"1600-03","code":"1600-03","name":"EQUIPMENT AND FURNITURE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Fixed Assets","parent_account_id":"1600"}', '2026-09-24 18:16:41.827', '2026-09-28 13:20:57.890', '1600-03', 'EQUIPMENT AND FURNITURE', 'Asset', 'Fixed Assets', '1600', 0, 1),
('1600-03-1', '{"id":"1600-03-1","code":"1600-03-1","name":"ACCM DEPREC OFFICE FUR & EQU","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accumulated Depreciation","parent_account_id":"1600"}', '2026-09-24 18:16:41.827', '2026-09-28 13:20:57.890', '1600-03-1', 'ACCM DEPREC OFFICE FUR & EQU', 'Asset', 'Accumulated Depreciation', '1600', 0, 1),
('1600-04', '{"id":"1600-04","code":"1600-04","name":"COMPUTER","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Fixed Assets","parent_account_id":"1600"}', '2026-09-24 18:16:41.828', '2026-09-28 13:20:57.891', '1600-04', 'COMPUTER', 'Asset', 'Fixed Assets', '1600', 0, 1),
('1600-04-1', '{"id":"1600-04-1","code":"1600-04-1","name":"ACCM DEPR COMPUTER","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accumulated Depreciation","parent_account_id":"1600"}', '2026-09-24 18:16:41.828', '2026-09-28 13:20:57.891', '1600-04-1', 'ACCM DEPR COMPUTER', 'Asset', 'Accumulated Depreciation', '1600', 0, 1),
('1600-05', '{"id":"1600-05","code":"1600-05","name":"MOTOR VEHICLE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Fixed Assets","parent_account_id":"1600"}', '2026-09-24 18:16:41.829', '2026-09-28 13:20:57.892', '1600-05', 'MOTOR VEHICLE', 'Asset', 'Fixed Assets', '1600', 0, 1),
('1600-05-1', '{"id":"1600-05-1","code":"1600-05-1","name":"ACCMU DEPR MOTOR VEHICLE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accumulated Depreciation","parent_account_id":"1600"}', '2026-09-24 18:16:41.829', '2026-09-28 13:20:57.893', '1600-05-1', 'ACCMU DEPR MOTOR VEHICLE', 'Asset', 'Accumulated Depreciation', '1600', 0, 1),
('1600-06', '{"id":"1600-06","code":"1600-06","name":"TRUCK","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Fixed Assets","parent_account_id":"1600"}', '2026-09-24 18:16:41.830', '2026-09-28 13:20:57.894', '1600-06', 'TRUCK', 'Asset', 'Fixed Assets', '1600', 0, 1),
('1600-06-1', '{"id":"1600-06-1","code":"1600-06-1","name":"ACC DEP TRUCK","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accumulated Depreciation","parent_account_id":"1600"}', '2026-09-24 18:16:41.830', '2026-09-28 13:20:57.894', '1600-06-1', 'ACC DEP TRUCK', 'Asset', 'Accumulated Depreciation', '1600', 0, 1),
('1600-07', '{"id":"1600-07","code":"1600-07","name":"SINO TRAILER","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Fixed Assets","parent_account_id":"1600"}', '2026-09-24 18:16:41.831', '2026-09-28 13:20:57.895', '1600-07', 'SINO TRAILER', 'Asset', 'Fixed Assets', '1600', 0, 1),
('1600-07-1', '{"id":"1600-07-1","code":"1600-07-1","name":"ACC DEP TRAILER","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accumulated Depreciation","parent_account_id":"1600"}', '2026-09-24 18:16:41.831', '2026-09-28 13:20:57.895', '1600-07-1', 'ACC DEP TRAILER', 'Asset', 'Accumulated Depreciation', '1600', 0, 1),
('1600-08', '{"id":"1600-08","code":"1600-08","name":"OTHERS","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Fixed Assets","parent_account_id":"1600"}', '2026-09-24 18:16:41.832', '2026-09-28 13:20:57.896', '1600-08', 'OTHERS', 'Asset', 'Fixed Assets', '1600', 0, 1),
('1600-08-1', '{"id":"1600-08-1","code":"1600-08-1","name":"ACC DEP OTHERS","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accumulated Depreciation","parent_account_id":"1600"}', '2026-09-24 18:16:41.833', '2026-09-28 13:20:57.896', '1600-08-1', 'ACC DEP OTHERS', 'Asset', 'Accumulated Depreciation', '1600', 0, 1),
('1600-09', '{"id":"1600-09","code":"1600-09","name":"WERAREHOUSE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Fixed Assets","parent_account_id":"1600"}', '2026-09-24 18:16:41.834', '2026-09-28 13:20:57.897', '1600-09', 'WERAREHOUSE', 'Asset', 'Fixed Assets', '1600', 0, 1),
('1600-09-1', '{"id":"1600-09-1","code":"1600-09-1","name":"ACC. DEP. WERAREHOUSE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accumulated Depreciation","parent_account_id":"1600"}', '2026-09-24 18:16:41.834', '2026-09-28 13:20:57.898', '1600-09-1', 'ACC. DEP. WERAREHOUSE', 'Asset', 'Accumulated Depreciation', '1600', 0, 1),
('1600-10', '{"id":"1600-10","code":"1600-10","name":"RIGHT USE OF ASSET","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Fixed Assets","parent_account_id":"1600"}', '2026-09-24 18:16:41.835', '2026-09-28 13:20:57.899', '1600-10', 'RIGHT USE OF ASSET', 'Asset', 'Fixed Assets', '1600', 0, 1),
('1700', '{"id":"1700","code":"1700","name":"INVESTMENT","is_group":true,"is_active":true,"account_type":"Asset","peachtree_type":"Other Assets","parent_account_id":null}', '2026-09-24 18:16:41.836', '2026-09-28 13:20:57.900', '1700', 'INVESTMENT', 'Asset', 'Other Assets', NULL, 1, 1),
('1700-01', '{"id":"1700-01","code":"1700-01","name":"INVESTMENT","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Assets","parent_account_id":"1700"}', '2026-09-24 18:16:41.836', '2026-09-28 13:20:57.901', '1700-01', 'INVESTMENT', 'Asset', 'Other Assets', '1700', 0, 1),
('1700-02', '{"id":"1700-02","code":"1700-02","name":"INVESTMENT ENAT BANK","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Assets","parent_account_id":"1700"}', '2026-09-24 18:16:41.837', '2026-09-28 13:20:57.901', '1700-02', 'INVESTMENT ENAT BANK', 'Asset', 'Other Assets', '1700', 0, 1),
('1700-03', '{"id":"1700-03","code":"1700-03","name":"INVESTMENT IN MEDIN CROSS BORD","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Assets","parent_account_id":"1700"}', '2026-09-24 18:16:41.837', '2026-09-28 13:20:57.902', '1700-03', 'INVESTMENT IN MEDIN CROSS BORD', 'Asset', 'Other Assets', '1700', 0, 1),
('1800', '{"id":"1800","code":"1800","name":"CONSTRUCTION IN PROGRESS","is_group":true,"is_active":true,"account_type":"Asset","peachtree_type":"Other Assets","parent_account_id":null}', '2026-09-24 18:16:41.837', '2026-09-28 13:20:57.903', '1800', 'CONSTRUCTION IN PROGRESS', 'Asset', 'Other Assets', NULL, 1, 1),
('1800-01', '{"id":"1800-01","code":"1800-01","name":"CIP (FARM LAND PREPARATION )","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Other Assets","parent_account_id":"1800"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.903', '1800-01', 'CIP (FARM LAND PREPARATION )', 'Asset', 'Other Assets', '1800', 0, 1),
('2000', '{"id":"2000","code":"2000","name":"TAX PAYABLE","is_group":true,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":null}', '2026-09-25 23:22:56.790', '2026-09-28 23:16:07.968', '2000', 'TAX PAYABLE', 'Liability', 'Other Current Liabilities', NULL, 1, 1),
('2000-01', '{"id":"2000-01","code":"2000-01","name":"INCOE TAX PAYABLE","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":"2000"}', '2026-09-24 18:16:41.840', '2026-09-28 13:20:57.905', '2000-01', 'INCOE TAX PAYABLE', 'Liability', 'Other Current Liabilities', '2000', 0, 1),
('2000-02', '{"id":"2000-02","code":"2000-02","name":"INCOME TAX PAYABLE","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":"2000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.906', '2000-02', 'INCOME TAX PAYABLE', 'Liability', 'Other Current Liabilities', '2000', 0, 1),
('2000-03', '{"id":"2000-03","code":"2000-03","name":"PENSION TAX PAYABLE","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":"2000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.906', '2000-03', 'PENSION TAX PAYABLE', 'Liability', 'Other Current Liabilities', '2000', 0, 1),
('2000-04', '{"id":"2000-04","code":"2000-04","name":"WHT PAYABLE","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":"2000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.907', '2000-04', 'WHT PAYABLE', 'Liability', 'Other Current Liabilities', '2000', 0, 1),
('2000-05', '{"id":"2000-05","code":"2000-05","name":"VAT PAYABLE","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":"2000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.907', '2000-05', 'VAT PAYABLE', 'Liability', 'Other Current Liabilities', '2000', 0, 1),
('2000-06', '{"id":"2000-06","code":"2000-06","name":"PROFIT TAX PAYABLE","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":"2000"}', '2026-09-24 18:16:41.842', '2026-09-28 13:20:57.908', '2000-06', 'PROFIT TAX PAYABLE', 'Liability', 'Other Current Liabilities', '2000', 0, 1),
('2100', '{"id":"2100","code":"2100","name":"ACCRUED PAYABLE","is_group":true,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":null}', '2026-09-25 23:22:56.793', '2026-09-28 23:16:07.968', '2100', 'ACCRUED PAYABLE', 'Liability', 'Other Current Liabilities', NULL, 1, 1),
('2100-01', '{"id":"2100-01","code":"2100-01","name":"ACCRUED TRANSPOT PAYABLE","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":"2100"}', '2026-09-24 18:16:41.844', '2026-09-28 13:20:57.909', '2100-01', 'ACCRUED TRANSPOT PAYABLE', 'Liability', 'Other Current Liabilities', '2100', 0, 1),
('2100-02', '{"id":"2100-02","code":"2100-02","name":"AUDIT FEE PAYABLE","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":"2100"}', '2026-09-24 18:16:41.844', '2026-09-28 13:20:57.910', '2100-02', 'AUDIT FEE PAYABLE', 'Liability', 'Other Current Liabilities', '2100', 0, 1),
('2100-03', '{"id":"2100-03","code":"2100-03","name":"ACCRUED INTEREST PAYABLE","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":"2100"}', '2026-09-24 18:16:41.846', '2026-09-28 13:20:57.911', '2100-03', 'ACCRUED INTEREST PAYABLE', 'Liability', 'Other Current Liabilities', '2100', 0, 1),
('2100-04', '{"id":"2100-04","code":"2100-04","name":"OUTSTANDING CHECK PAYABLE","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":"2100"}', '2026-09-24 18:16:41.847', '2026-09-28 13:20:57.911', '2100-04', 'OUTSTANDING CHECK PAYABLE', 'Liability', 'Other Current Liabilities', '2100', 0, 1),
('2100-05', '{"id":"2100-05","code":"2100-05","name":"TRANSIT FEE PAYABLE","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":"2100"}', '2026-09-24 18:16:41.847', '2026-09-28 13:20:57.912', '2100-05', 'TRANSIT FEE PAYABLE', 'Liability', 'Other Current Liabilities', '2100', 0, 1),
('2100-06', '{"id":"2100-06","code":"2100-06","name":"OTHER ACCRUALS","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":"2100"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.913', '2100-06', 'OTHER ACCRUALS', 'Liability', 'Other Current Liabilities', '2100', 0, 1),
('2200', '{"id":"2200","code":"2200","name":"SUNDARY PAYABLE","is_group":true,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":null}', '2026-09-24 18:16:41.848', '2026-09-28 13:20:57.913', '2200', 'SUNDARY PAYABLE', 'Liability', 'Other Current Liabilities', NULL, 1, 1),
('2200-01', '{"id":"2200-01","code":"2200-01","name":"DANIEL KEBEDE","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":"2200"}', '2026-09-24 18:16:41.849', '2026-09-28 13:20:57.914', '2200-01', 'DANIEL KEBEDE', 'Liability', 'Other Current Liabilities', '2200', 0, 1),
('2200-02', '{"id":"2200-02","code":"2200-02","name":"KEBAD GIZACHEW","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":"2200"}', '2026-09-24 18:16:41.849', '2026-09-28 13:20:57.915', '2200-02', 'KEBAD GIZACHEW', 'Liability', 'Other Current Liabilities', '2200', 0, 1),
('2200-03', '{"id":"2200-03","code":"2200-03","name":"TADESSE GOBENA","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Other Current Liabilities","parent_account_id":"2200"}', '2026-09-24 18:16:41.849', '2026-09-28 13:20:57.918', '2200-03', 'TADESSE GOBENA', 'Liability', 'Other Current Liabilities', '2200', 0, 1),
('2300', '{"id":"2300","code":"2300","name":"BANK LOAN","is_group":true,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":null}', '2026-09-25 23:22:56.796', '2026-09-28 23:16:07.968', '2300', 'BANK LOAN', 'Liability', 'Long Term Liabilities', NULL, 1, 1),
('2300-01', '{"id":"2300-01","code":"2300-01","name":"COOPRATIVE BANK LOAN","is_group":true,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":"2300"}', '2026-09-24 18:16:41.850', '2026-09-28 13:20:57.919', '2300-01', 'COOPRATIVE BANK LOAN', 'Liability', 'Long Term Liabilities', '2300', 1, 1),
('2300-01-01', '{"id":"2300-01-01","code":"2300-01-01","name":"CBO_SHB_AC_1000200004906","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":"2300-01"}', '2026-09-24 18:16:41.851', '2026-09-28 13:20:57.920', '2300-01-01', 'CBO_SHB_AC_1000200004906', 'Liability', 'Long Term Liabilities', '2300-01', 0, 1),
('2300-02', '{"id":"2300-02","code":"2300-02","name":"UNITED BANK LOAN","is_group":true,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":"2300"}', '2026-09-24 18:16:41.851', '2026-09-28 13:20:57.921', '2300-02', 'UNITED BANK LOAN', 'Liability', 'Long Term Liabilities', '2300', 1, 1),
('2300-02-01', '{"id":"2300-02-01","code":"2300-02-01","name":"UNB_173ADPR24277001","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":"2300-02"}', '2026-09-24 18:16:41.852', '2026-09-28 13:20:57.922', '2300-02-01', 'UNB_173ADPR24277001', 'Liability', 'Long Term Liabilities', '2300-02', 0, 1),
('2300-02-02', '{"id":"2300-02-02","code":"2300-02-02","name":"UNB_RDB_LOAN_173ADPR251990001","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":"2300-02"}', '2026-09-24 18:16:41.853', '2026-09-28 13:20:57.922', '2300-02-02', 'UNB_RDB_LOAN_173ADPR251990001', 'Liability', 'Long Term Liabilities', '2300-02', 0, 1),
('2300-02-03', '{"id":"2300-02-03","code":"2300-02-03","name":"UNB_RDB_LOAN_173ADPR252050001","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":"2300-02"}', '2026-09-24 18:16:41.853', '2026-09-28 13:20:57.923', '2300-02-03', 'UNB_RDB_LOAN_173ADPR252050001', 'Liability', 'Long Term Liabilities', '2300-02', 0, 1),
('2300-02-04', '{"id":"2300-02-04","code":"2300-02-04","name":"UNB_RDB_LOAN_173ADPR252550001","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":"2300-02"}', '2026-09-24 18:16:41.853', '2026-09-28 13:20:57.924', '2300-02-04', 'UNB_RDB_LOAN_173ADPR252550001', 'Liability', 'Long Term Liabilities', '2300-02', 0, 1),
('2300-02-05', '{"id":"2300-02-05","code":"2300-02-05","name":"UNB_RDB_LOAN_173ADPR253090001","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":"2300-02"}', '2026-09-24 18:16:41.854', '2026-09-28 13:20:57.925', '2300-02-05', 'UNB_RDB_LOAN_173ADPR253090001', 'Liability', 'Long Term Liabilities', '2300-02', 0, 1),
('2300-02-06', '{"id":"2300-02-06","code":"2300-02-06","name":"UNB_RDB_LOAN_173ADPR253350001","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":"2300-02"}', '2026-09-24 18:16:41.854', '2026-09-28 13:20:57.925', '2300-02-06', 'UNB_RDB_LOAN_173ADPR253350001', 'Liability', 'Long Term Liabilities', '2300-02', 0, 1),
('2300-02-07', '{"id":"2300-02-07","code":"2300-02-07","name":"UNB_RDB_LOAN_173ADPR260920001","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":"2300-02"}', '2026-09-24 18:16:41.854', '2026-09-28 13:20:57.926', '2300-02-07', 'UNB_RDB_LOAN_173ADPR260920001', 'Liability', 'Long Term Liabilities', '2300-02', 0, 1);
INSERT INTO `chart_of_accounts` (`id`, `payload`, `created_at`, `updated_at`, `code`, `name`, `account_type`, `peachtree_type`, `parent_account_id`, `is_group`, `is_active`) VALUES
('2300-03', '{"id":"2300-03","code":"2300-03","name":"ABAY BANK LOAN","is_group":true,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":"2300"}', '2026-09-24 18:16:41.855', '2026-09-28 13:20:57.927', '2300-03', 'ABAY BANK LOAN', 'Liability', 'Long Term Liabilities', '2300', 1, 1),
('2300-03-01', '{"id":"2300-03-01","code":"2300-03-01","name":"ABB_REVL_233570001","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":"2300-03"}', '2026-09-24 18:16:41.855', '2026-09-28 13:20:57.927', '2300-03-01', 'ABB_REVL_233570001', 'Liability', 'Long Term Liabilities', '2300-03', 0, 1),
('2300-03-02', '{"id":"2300-03-02","code":"2300-03-02","name":"ABAY-72REVL261430502","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":"2300-03"}', '2026-09-24 18:16:41.855', '2026-09-28 13:20:57.928', '2300-03-02', 'ABAY-72REVL261430502', 'Liability', 'Long Term Liabilities', '2300-03', 0, 1),
('2300-03-03', '{"id":"2300-03-03","code":"2300-03-03","name":"ABAY-172REVL260410001","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":"2300-03"}', '2026-09-24 18:16:41.856', '2026-09-28 13:20:57.928', '2300-03-03', 'ABAY-172REVL260410001', 'Liability', 'Long Term Liabilities', '2300-03', 0, 1),
('2300-03-04', '{"id":"2300-03-04","code":"2300-03-04","name":"ABAY-","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":"2300-03"}', '2026-09-24 18:16:41.856', '2026-09-28 13:20:57.929', '2300-03-04', 'ABAY-', 'Liability', 'Long Term Liabilities', '2300-03', 0, 1),
('2300-03-05', '{"id":"2300-03-05","code":"2300-03-05","name":"ABAY-","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":"2300-03"}', '2026-09-24 18:16:41.857', '2026-09-28 13:20:57.930', '2300-03-05', 'ABAY-', 'Liability', 'Long Term Liabilities', '2300-03', 0, 1),
('2400', '{"id":"2400","code":"2400","name":"LEASE PAYABLE","is_group":false,"is_active":true,"account_type":"Liability","peachtree_type":"Long Term Liabilities","parent_account_id":null}', '2026-09-24 18:16:41.857', '2026-09-28 13:20:57.931', '2400', 'LEASE PAYABLE', 'Liability', 'Long Term Liabilities', NULL, 0, 1),
('3000', '{"id":"3000","code":"3000","name":"EQUITY","is_group":true,"is_active":true,"account_type":"Equity","peachtree_type":"Equity","parent_account_id":null}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.931', '3000', 'EQUITY', 'Equity', 'Equity', NULL, 1, 1),
('3000-01', '{"id":"3000-01","code":"3000-01","name":"HABTOM KEBEDE\'S CAPITAL","is_group":false,"is_active":true,"account_type":"Equity","peachtree_type":"Equity","parent_account_id":"3000"}', '2026-09-24 18:16:41.881', '2026-09-28 13:20:57.932', '3000-01', 'HABTOM KEBEDE\'S CAPITAL', 'Equity', 'Equity', '3000', 0, 1),
('3000-02', '{"id":"3000-02","code":"3000-02","name":"OWNER WITHDRWAL","is_group":false,"is_active":true,"account_type":"Equity","peachtree_type":"Equity","parent_account_id":"3000"}', '2026-09-24 18:16:41.882', '2026-09-28 13:20:57.933', '3000-02', 'OWNER WITHDRWAL', 'Equity', 'Equity', '3000', 0, 1),
('3000-03', '{"id":"3000-03","code":"3000-03","name":"OWNERS CONTRIBUTION","is_group":false,"is_active":true,"account_type":"Equity","peachtree_type":"Equity","parent_account_id":"3000"}', '2026-09-24 18:16:41.882', '2026-09-28 13:20:57.933', '3000-03', 'OWNERS CONTRIBUTION', 'Equity', 'Equity', '3000', 0, 1),
('3000-04', '{"id":"3000-04","code":"3000-04","name":"RETAIND EARNINGS","is_group":false,"is_active":true,"account_type":"Equity","peachtree_type":"Equity","parent_account_id":"3000"}', '2026-09-24 18:16:41.883', '2026-09-28 13:20:57.934', '3000-04', 'RETAIND EARNINGS', 'Equity', 'Equity', '3000', 0, 1),
('3000-05', '{"id":"3000-05","code":"3000-05","name":"CUSTOM VALUATION","is_group":false,"is_active":true,"account_type":"Equity","peachtree_type":"Equity","parent_account_id":"3000"}', '2026-09-24 18:16:41.883', '2026-09-28 13:20:57.935', '3000-05', 'CUSTOM VALUATION', 'Equity', 'Equity', '3000', 0, 1),
('3000-06', '{"id":"3000-06","code":"3000-06","name":"PRIOR YEAR ADJUSTMENT","is_group":false,"is_active":true,"account_type":"Equity","peachtree_type":"Equity","parent_account_id":"3000"}', '2026-09-24 18:16:41.884', '2026-09-28 13:20:57.935', '3000-06', 'PRIOR YEAR ADJUSTMENT', 'Equity', 'Equity', '3000', 0, 1),
('3200', '{"id":"3200","code":"3200","name":"RETAINED EARNINGS","is_group":false,"is_active":true,"account_type":"Equity","peachtree_type":"Equity","parent_account_id":null}', '2026-08-29 11:49:31.205', '2026-09-24 18:32:26.022', '3200', 'RETAINED EARNINGS', 'Equity', 'Equity', NULL, 0, 1),
('4000', '{"id":"4000","code":"4000","name":"SALES","is_group":true,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":null}', '2026-09-25 23:22:56.803', '2026-09-28 23:16:07.968', '4000', 'SALES', 'Revenue', 'Income', NULL, 1, 1),
('4000-01', '{"id":"4000-01","code":"4000-01","name":"LOCAL SALES","is_group":true,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":"4000"}', '2026-09-24 18:16:41.886', '2026-09-28 13:20:57.937', '4000-01', 'LOCAL SALES', 'Revenue', 'Income', '4000', 1, 1),
('4000-01-01', '{"id":"4000-01-01","code":"4000-01-01","name":"SALES OF VETERINARY DRUG","is_group":false,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":"4000-01"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.937', '4000-01-01', 'SALES OF VETERINARY DRUG', 'Revenue', 'Income', '4000-01', 0, 1),
('4000-01-02', '{"id":"4000-01-02","code":"4000-01-02","name":"SALES OF TRUCK","is_group":false,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":"4000-01"}', '2026-09-24 18:16:41.887', '2026-09-28 13:20:57.938', '4000-01-02', 'SALES OF TRUCK', 'Revenue', 'Income', '4000-01', 0, 1),
('4000-02', '{"id":"4000-02","code":"4000-02","name":"EXPORT SALES","is_group":true,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":"4000"}', '2026-09-24 18:16:41.888', '2026-09-28 13:20:57.939', '4000-02', 'EXPORT SALES', 'Revenue', 'Income', '4000', 1, 1),
('4000-02-01', '{"id":"4000-02-01","code":"4000-02-01","name":"EXPORT SALES GREEN MUNG","is_group":false,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":"4000-02"}', '2026-09-24 18:16:41.888', '2026-09-28 13:20:57.939', '4000-02-01', 'EXPORT SALES GREEN MUNG', 'Revenue', 'Income', '4000-02', 0, 1),
('4000-02-02', '{"id":"4000-02-02","code":"4000-02-02","name":"EXPORT SALES SOYA BEAN","is_group":false,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":"4000-02"}', '2026-09-24 18:16:41.889', '2026-09-28 13:20:57.940', '4000-02-02', 'EXPORT SALES SOYA BEAN', 'Revenue', 'Income', '4000-02', 0, 1),
('4000-02-03', '{"id":"4000-02-03","code":"4000-02-03","name":"EXPORT SALES REDISH SESEAM SEE","is_group":false,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":"4000-02"}', '2026-09-24 18:16:41.889', '2026-09-28 13:20:57.941', '4000-02-03', 'EXPORT SALES REDISH SESEAM SEE', 'Revenue', 'Income', '4000-02', 0, 1),
('4000-02-04', '{"id":"4000-02-04","code":"4000-02-04","name":"EXPORT SALES SESEAM SEED","is_group":false,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":"4000-02"}', '2026-09-24 18:16:41.890', '2026-09-28 13:20:57.941', '4000-02-04', 'EXPORT SALES SESEAM SEED', 'Revenue', 'Income', '4000-02', 0, 1),
('4000-03', '{"id":"4000-03","code":"4000-03","name":"SALES OF SERVICE","is_group":true,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":"4000"}', '2026-09-24 18:16:41.890', '2026-09-28 13:20:57.942', '4000-03', 'SALES OF SERVICE', 'Revenue', 'Income', '4000', 1, 1),
('4000-03-01', '{"id":"4000-03-01","code":"4000-03-01","name":"TRANSPORT","is_group":false,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":"4000-03"}', '2026-09-24 18:16:41.894', '2026-09-28 13:20:57.943', '4000-03-01', 'TRANSPORT', 'Revenue', 'Income', '4000-03', 0, 1),
('4000-03-02', '{"id":"4000-03-02","code":"4000-03-02","name":"CLEANING SERVICE","is_group":false,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":"4000-03"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.943', '4000-03-02', 'CLEANING SERVICE', 'Revenue', 'Income', '4000-03', 0, 1),
('4000-03-03', '{"id":"4000-03-03","code":"4000-03-03","name":"STORAGE","is_group":false,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":"4000-03"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.944', '4000-03-03', 'STORAGE', 'Revenue', 'Income', '4000-03', 0, 1),
('4000-03-04', '{"id":"4000-03-04","code":"4000-03-04","name":"COMMISSION","is_group":false,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":"4000-03"}', '2026-09-24 18:16:41.896', '2026-09-28 13:20:57.945', '4000-03-04', 'COMMISSION', 'Revenue', 'Income', '4000-03', 0, 1),
('4100', '{"id":"4100","code":"4100","name":"FINANCIAL INCOME","is_group":true,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":null}', '2026-09-24 18:16:41.896', '2026-09-28 13:20:57.945', '4100', 'FINANCIAL INCOME', 'Revenue', 'Income', NULL, 1, 1),
('4100-01', '{"id":"4100-01","code":"4100-01","name":"GAIN / LOSS/  IN EXCHANGE","is_group":false,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":"4100"}', '2026-09-24 18:16:41.897', '2026-09-28 13:20:57.946', '4100-01', 'GAIN / LOSS/  IN EXCHANGE', 'Revenue', 'Income', '4100', 0, 1),
('4100-02', '{"id":"4100-02","code":"4100-02","name":"INTEREST INCOME","is_group":false,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":"4100"}', '2026-09-24 18:16:41.897', '2026-09-28 13:20:57.947', '4100-02', 'INTEREST INCOME', 'Revenue', 'Income', '4100', 0, 1),
('4200', '{"id":"4200","code":"4200","name":"OTHER INCOME","is_group":false,"is_active":true,"account_type":"Revenue","peachtree_type":"Income","parent_account_id":null}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.947', '4200', 'OTHER INCOME', 'Revenue', 'Income', NULL, 0, 1),
('5000', '{"id":"5000","code":"5000","name":"COST OF GOODS IMPORT","is_group":true,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":null}', '2026-09-25 23:22:56.809', '2026-09-28 23:16:07.968', '5000', 'COST OF GOODS IMPORT', 'Expense', 'Cost of Sales', NULL, 1, 1),
('5000-01', '{"id":"5000-01","code":"5000-01","name":"COST OF VETERINARY DRUG","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"5000"}', '2026-09-24 18:16:41.898', '2026-09-28 13:20:57.949', '5000-01', 'COST OF VETERINARY DRUG', 'Expense', 'Cost of Sales', '5000', 0, 1),
('5000-02', '{"id":"5000-02","code":"5000-02","name":"COST OF TRUCK","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"5000"}', '2026-09-24 18:16:41.899', '2026-09-28 13:20:57.950', '5000-02', 'COST OF TRUCK', 'Expense', 'Cost of Sales', '5000', 0, 1),
('5010', '{"id":"5010","code":"5010","name":"COST OF GOODS EXPORT","is_group":true,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":null}', '2026-09-25 23:22:56.810', '2026-09-28 23:16:07.968', '5010', 'COST OF GOODS EXPORT', 'Expense', 'Cost of Sales', NULL, 1, 1),
('5010-01', '{"id":"5010-01","code":"5010-01","name":"COST OF SALES GREEN MUNG","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"5010"}', '2026-09-24 18:16:41.899', '2026-09-28 13:20:57.952', '5010-01', 'COST OF SALES GREEN MUNG', 'Expense', 'Cost of Sales', '5010', 0, 1),
('5010-02', '{"id":"5010-02","code":"5010-02","name":"COST OF SALES SOYA BEAN","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"5010"}', '2026-09-24 18:16:41.900', '2026-09-28 13:20:57.953', '5010-02', 'COST OF SALES SOYA BEAN', 'Expense', 'Cost of Sales', '5010', 0, 1),
('5010-03', '{"id":"5010-03","code":"5010-03","name":"COST OF REDISH SESAME SEED","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"5010"}', '2026-09-24 18:16:41.900', '2026-09-28 13:20:57.956', '5010-03', 'COST OF REDISH SESAME SEED', 'Expense', 'Cost of Sales', '5010', 0, 1),
('5010-04', '{"id":"5010-04","code":"5010-04","name":"COST OF SESEAM SEED","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"5010"}', '2026-09-24 18:16:41.900', '2026-09-28 13:20:57.956', '5010-04', 'COST OF SESEAM SEED', 'Expense', 'Cost of Sales', '5010', 0, 1),
('6000', '{"id":"6000","code":"6000","name":"SELLING AND DISTRIBUTION","is_group":true,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":null}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.957', '6000', 'SELLING AND DISTRIBUTION', 'Expense', 'Cost of Sales', NULL, 1, 1),
('6000-01', '{"id":"6000-01","code":"6000-01","name":"SALARY AND BENEFIT","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.958', '6000-01', 'SALARY AND BENEFIT', 'Expense', 'Cost of Sales', '6000', 0, 1),
('6000-02', '{"id":"6000-02","code":"6000-02","name":"OVER TIME","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.958', '6000-02', 'OVER TIME', 'Expense', 'Cost of Sales', '6000', 0, 1),
('6000-03', '{"id":"6000-03","code":"6000-03","name":"CLEANING SERVICE","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-09-24 18:16:41.901', '2026-09-28 13:20:57.959', '6000-03', 'CLEANING SERVICE', 'Expense', 'Cost of Sales', '6000', 0, 1),
('6000-04', '{"id":"6000-04","code":"6000-04","name":"PACKING AND BAGING","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.959', '6000-04', 'PACKING AND BAGING', 'Expense', 'Cost of Sales', '6000', 0, 1),
('6000-05', '{"id":"6000-05","code":"6000-05","name":"COMMISSION ON PURCHASE ECX","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-09-24 18:16:41.902', '2026-09-28 13:20:57.960', '6000-05', 'COMMISSION ON PURCHASE ECX', 'Expense', 'Cost of Sales', '6000', 0, 1),
('6000-06', '{"id":"6000-06","code":"6000-06","name":"FUMIGATION","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-09-24 18:16:41.902', '2026-09-28 13:20:57.961', '6000-06', 'FUMIGATION', 'Expense', 'Cost of Sales', '6000', 0, 1),
('6000-07', '{"id":"6000-07","code":"6000-07","name":"WAREHOUSE RENT","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-09-24 18:16:41.902', '2026-09-28 13:20:57.961', '6000-07', 'WAREHOUSE RENT', 'Expense', 'Cost of Sales', '6000', 0, 1),
('6000-08', '{"id":"6000-08","code":"6000-08","name":"TRANSPORT COST","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.962', '6000-08', 'TRANSPORT COST', 'Expense', 'Cost of Sales', '6000', 0, 1);
INSERT INTO `chart_of_accounts` (`id`, `payload`, `created_at`, `updated_at`, `code`, `name`, `account_type`, `peachtree_type`, `parent_account_id`, `is_group`, `is_active`) VALUES
('6000-09', '{"id":"6000-09","code":"6000-09","name":"ELECTRIC AND WATER","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-09-24 18:16:41.903', '2026-09-28 13:20:57.962', '6000-09', 'ELECTRIC AND WATER', 'Expense', 'Cost of Sales', '6000', 0, 1),
('6000-10', '{"id":"6000-10","code":"6000-10","name":"LOADING UNLOADING","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.963', '6000-10', 'LOADING UNLOADING', 'Expense', 'Cost of Sales', '6000', 0, 1),
('6000-11', '{"id":"6000-11","code":"6000-11","name":"REPAIER AND MAINTANCE","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-09-24 18:16:41.904', '2026-09-28 13:20:57.964', '6000-11', 'REPAIER AND MAINTANCE', 'Expense', 'Cost of Sales', '6000', 0, 1),
('6000-13', '{"id":"6000-13","code":"6000-13","name":"COMMISSION","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-09-24 18:16:41.904', '2026-09-28 13:20:57.964', '6000-13', 'COMMISSION', 'Expense', 'Cost of Sales', '6000', 0, 1),
('6000-14', '{"id":"6000-14","code":"6000-14","name":"PER-DIEM AND TRAVILLING","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-09-24 18:16:41.905', '2026-09-28 13:20:57.965', '6000-14', 'PER-DIEM AND TRAVILLING', 'Expense', 'Cost of Sales', '6000', 0, 1),
('6000-15', '{"id":"6000-15","code":"6000-15","name":"ANNUAL INSPECTION AND REGISTR","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-09-24 18:16:41.905', '2026-09-28 13:20:57.965', '6000-15', 'ANNUAL INSPECTION AND REGISTR', 'Expense', 'Cost of Sales', '6000', 0, 1),
('6000-16', '{"id":"6000-16","code":"6000-16","name":"INSURANCE FOR TRUCK","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-09-24 18:16:41.905', '2026-09-28 13:20:57.966', '6000-16', 'INSURANCE FOR TRUCK', 'Expense', 'Cost of Sales', '6000', 0, 1),
('6000-17', '{"id":"6000-17","code":"6000-17","name":"FREIGHT AND TRANSPORT","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-09-24 18:16:41.906', '2026-09-28 13:20:57.966', '6000-17', 'FREIGHT AND TRANSPORT', 'Expense', 'Cost of Sales', '6000', 0, 1),
('6000-18', '{"id":"6000-18","code":"6000-18","name":"TRANSIT SERVICE","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-09-24 18:16:41.906', '2026-09-28 13:20:57.967', '6000-18', 'TRANSIT SERVICE', 'Expense', 'Cost of Sales', '6000', 0, 1),
('6000-19', '{"id":"6000-19","code":"6000-19","name":"INSPECTION ,CERTEFICATE AND OT","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-09-24 18:16:41.906', '2026-09-28 13:20:57.967', '6000-19', 'INSPECTION ,CERTEFICATE AND OT', 'Expense', 'Cost of Sales', '6000', 0, 1),
('6000-21', '{"id":"6000-21","code":"6000-21","name":"DEPREC PLANT AND MACHINERY","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accumulated Depreciation","parent_account_id":"1600"}', '2026-09-24 18:16:41.907', '2026-09-28 13:20:57.968', '6000-21', 'DEPREC PLANT AND MACHINERY', 'Asset', 'Accumulated Depreciation', '1600', 0, 1),
('6000-22', '{"id":"6000-22","code":"6000-22","name":"OTHER","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Cost of Sales","parent_account_id":"6000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.969', '6000-22', 'OTHER', 'Expense', 'Cost of Sales', '6000', 0, 1),
('8000', '{"id":"8000","code":"8000","name":"ADMINISTRATION","is_group":true,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":null}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.969', '8000', 'ADMINISTRATION', 'Expense', 'Expenses', NULL, 1, 1),
('8000-01', '{"id":"8000-01","code":"8000-01","name":"SALARY AND WAGE","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.970', '8000-01', 'SALARY AND WAGE', 'Expense', 'Expenses', '8000', 0, 1),
('8000-02', '{"id":"8000-02","code":"8000-02","name":"TRANSPORT ALLOWANCE","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.970', '8000-02', 'TRANSPORT ALLOWANCE', 'Expense', 'Expenses', '8000', 0, 1),
('8000-03', '{"id":"8000-03","code":"8000-03","name":"BONES","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.908', '2026-09-28 13:20:57.971', '8000-03', 'BONES', 'Expense', 'Expenses', '8000', 0, 1),
('8000-04', '{"id":"8000-04","code":"8000-04","name":"OVER TIME","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.909', '2026-09-28 13:20:57.971', '8000-04', 'OVER TIME', 'Expense', 'Expenses', '8000', 0, 1),
('8000-05', '{"id":"8000-05","code":"8000-05","name":"HEALTH INSURANCE","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.909', '2026-09-28 13:20:57.972', '8000-05', 'HEALTH INSURANCE', 'Expense', 'Expenses', '8000', 0, 1),
('8000-06', '{"id":"8000-06","code":"8000-06","name":"PENSION CONTRIBUTION","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.972', '8000-06', 'PENSION CONTRIBUTION', 'Expense', 'Expenses', '8000', 0, 1),
('8000-07', '{"id":"8000-07","code":"8000-07","name":"STATIONERY, PRINTING & OFF SUP","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.973', '8000-07', 'STATIONERY, PRINTING & OFF SUP', 'Expense', 'Expenses', '8000', 0, 1),
('8000-08', '{"id":"8000-08","code":"8000-08","name":"OFFICE RENT","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.973', '8000-08', 'OFFICE RENT', 'Expense', 'Expenses', '8000', 0, 1),
('8000-09', '{"id":"8000-09","code":"8000-09","name":"TELEPHONE AND INTERNET","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.974', '8000-09', 'TELEPHONE AND INTERNET', 'Expense', 'Expenses', '8000', 0, 1),
('8000-10', '{"id":"8000-10","code":"8000-10","name":"PER-DIEM AND TRAVILLING","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.910', '2026-09-28 13:20:57.975', '8000-10', 'PER-DIEM AND TRAVILLING', 'Expense', 'Expenses', '8000', 0, 1),
('8000-11', '{"id":"8000-11","code":"8000-11","name":"FUEL AND LUBRICANTS","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.911', '2026-09-28 13:20:57.975', '8000-11', 'FUEL AND LUBRICANTS', 'Expense', 'Expenses', '8000', 0, 1),
('8000-12', '{"id":"8000-12","code":"8000-12","name":"POSTAGE AND PHOTOCOPY","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.911', '2026-09-28 13:20:57.976', '8000-12', 'POSTAGE AND PHOTOCOPY', 'Expense', 'Expenses', '8000', 0, 1),
('8000-13', '{"id":"8000-13","code":"8000-13","name":"REPAIER AND MAINTANCE","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.911', '2026-09-28 13:20:57.976', '8000-13', 'REPAIER AND MAINTANCE', 'Expense', 'Expenses', '8000', 0, 1),
('8000-14', '{"id":"8000-14","code":"8000-14","name":"UTILITY","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.912', '2026-09-28 13:20:57.977', '8000-14', 'UTILITY', 'Expense', 'Expenses', '8000', 0, 1),
('8000-15', '{"id":"8000-15","code":"8000-15","name":"REGISTRATION AND LICENCE","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.912', '2026-09-28 13:20:57.977', '8000-15', 'REGISTRATION AND LICENCE', 'Expense', 'Expenses', '8000', 0, 1),
('8000-16', '{"id":"8000-16","code":"8000-16","name":"INSURANCE","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.978', '8000-16', 'INSURANCE', 'Expense', 'Expenses', '8000', 0, 1),
('8000-17', '{"id":"8000-17","code":"8000-17","name":"MEMBERSHIP, REGISTRATION ANNU","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.913', '2026-09-28 13:20:57.979', '8000-17', 'MEMBERSHIP, REGISTRATION ANNU', 'Expense', 'Expenses', '8000', 0, 1),
('8000-18', '{"id":"8000-18","code":"8000-18","name":"AUDIT FEE & PROFFESSIONAL FEE","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.980', '8000-18', 'AUDIT FEE & PROFFESSIONAL FEE', 'Expense', 'Expenses', '8000', 0, 1),
('8000-19', '{"id":"8000-19","code":"8000-19","name":"EDUCATION AND TITIUTION FEE","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.913', '2026-09-28 13:20:57.980', '8000-19', 'EDUCATION AND TITIUTION FEE', 'Expense', 'Expenses', '8000', 0, 1),
('8000-20', '{"id":"8000-20","code":"8000-20","name":"CAR RENT","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.914', '2026-09-28 13:20:57.981', '8000-20', 'CAR RENT', 'Expense', 'Expenses', '8000', 0, 1),
('8000-21', '{"id":"8000-21","code":"8000-21","name":"DONATION","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.914', '2026-09-28 13:20:57.981', '8000-21', 'DONATION', 'Expense', 'Expenses', '8000', 0, 1),
('8000-22', '{"id":"8000-22","code":"8000-22","name":"ENTERTAINMENT","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.914', '2026-09-28 13:20:57.982', '8000-22', 'ENTERTAINMENT', 'Expense', 'Expenses', '8000', 0, 1),
('8000-23', '{"id":"8000-23","code":"8000-23","name":"SPONSERSHIP","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.915', '2026-09-28 13:20:57.984', '8000-23', 'SPONSERSHIP', 'Expense', 'Expenses', '8000', 0, 1),
('8000-24', '{"id":"8000-24","code":"8000-24","name":"UNCLAIMED VAT","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.915', '2026-09-28 13:20:57.985', '8000-24', 'UNCLAIMED VAT', 'Expense', 'Expenses', '8000', 0, 1),
('8000-25', '{"id":"8000-25","code":"8000-25","name":"BANK SERVICE CHARGE","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.985', '8000-25', 'BANK SERVICE CHARGE', 'Expense', 'Expenses', '8000', 0, 1),
('8000-26', '{"id":"8000-26","code":"8000-26","name":"STAMP DUTY","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.916', '2026-09-28 13:20:57.986', '8000-26', 'STAMP DUTY', 'Expense', 'Expenses', '8000', 0, 1),
('8000-27', '{"id":"8000-27","code":"8000-27","name":"INTEREST EXPENSE","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-09-24 18:16:41.917', '2026-09-28 13:20:57.987', '8000-27', 'INTEREST EXPENSE', 'Expense', 'Expenses', '8000', 0, 1),
('8000-28', '{"id":"8000-28","code":"8000-28","name":"PENALITY","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.987', '8000-28', 'PENALITY', 'Expense', 'Expenses', '8000', 0, 1),
('8000-29', '{"id":"8000-29","code":"8000-29","name":"DEPRECIATION EXPENSE","is_group":false,"is_active":true,"account_type":"Asset","peachtree_type":"Accumulated Depreciation","parent_account_id":"1600"}', '2026-09-24 18:16:41.918', '2026-09-28 13:20:57.988', '8000-29', 'DEPRECIATION EXPENSE', 'Asset', 'Accumulated Depreciation', '1600', 0, 1),
('8000-30', '{"id":"8000-30","code":"8000-30","name":"MICELLANOUS","is_group":false,"is_active":true,"account_type":"Expense","peachtree_type":"Expenses","parent_account_id":"8000"}', '2026-08-29 11:49:31.205', '2026-09-28 13:20:57.988', '8000-30', 'MICELLANOUS', 'Expense', 'Expenses', '8000', 0, 1);

-- ----------------------------------------------------------------------------
-- Table structure for table `company_settings`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `company_settings`;
CREATE TABLE `company_settings` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `company_settings` (1 rows)
INSERT INTO `company_settings` (`id`, `payload`, `created_at`, `updated_at`) VALUES
('default', '{"id":"default","address":"Bole Subcity, Woreda 03, Addis Ababa, Ethiopia","tin_number":"0012345678","company_name":"HKC Trading PLC","base_currency":"ETB","contact_email":"info@hkctrading.com","contact_phone":"+251 11 662 4580","exchange_rates":{"EUR":63.2,"USD":58.5},"fiscal_year_start":"July","storage_free_days":7,"auto_delivery_notes":true,"pension_expat_exempt":true,"default_payment_terms":"Net 30 Days","default_reorder_level":50,"max_storage_month_cap":4,"pension_employee_rate":7,"pension_employer_rate":11,"prevent_negative_stock":true,"tax_payable_account_id":"2000-05","default_cash_account_id":"1000-01-01","default_cogs_account_id":"6000","default_damage_account_id":"6000-22","default_revenue_account_id":"4000-01-01","payroll_expense_account_id":"8000-01","payroll_payable_account_id":"2000-02","processing_rate_per_quintal":150,"storage_increment_per_month":0.25,"default_inventory_account_id":"1410-01","base_storage_rate_per_quintal_day":1.25,"unrealized_exchange_gain_loss_account_id":""}', '2026-07-25 16:58:11.315', '2026-09-28 13:20:57.802');

-- ----------------------------------------------------------------------------
-- Table structure for table `customers`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_customers_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `customers`

-- ----------------------------------------------------------------------------
-- Table structure for table `employees`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `employees`;
CREATE TABLE `employees` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_employees_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `employees`

-- ----------------------------------------------------------------------------
-- Table structure for table `expenses`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `expenses`;
CREATE TABLE `expenses` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_expenses_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `expenses`

-- ----------------------------------------------------------------------------
-- Table structure for table `export_products`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `export_products`;
CREATE TABLE `export_products` (
  `id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `commodity_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Agricultural Commodity',
  `warehouse_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `crop_year` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grade` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `origin` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `moisture_content` decimal(5,2) DEFAULT NULL,
  `clean_yield_pct` decimal(5,2) DEFAULT NULL,
  `unit` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Quintal',
  `quantity` decimal(18,2) NOT NULL DEFAULT '0.00',
  `quantity_sold` decimal(18,2) NOT NULL DEFAULT '0.00',
  `total_quantity` decimal(18,2) NOT NULL DEFAULT '0.00',
  `unit_cost` decimal(18,2) NOT NULL DEFAULT '0.00',
  `selling_price` decimal(18,2) NOT NULL DEFAULT '0.00',
  `total_stock_value` decimal(18,2) NOT NULL DEFAULT '0.00',
  `reorder_level` decimal(18,2) DEFAULT '0.00',
  `min_stock_level` decimal(18,2) DEFAULT '0.00',
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'In Stock',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `supplier_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `supplier_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `voucher_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plate_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `driver_name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_exp_prod_wh` (`warehouse_id`),
  KEY `idx_exp_prod_commodity` (`commodity_type`),
  KEY `idx_exp_prod_sku` (`sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `export_products` (1 rows)
INSERT INTO `export_products` (`id`, `sku`, `name`, `commodity_type`, `category`, `warehouse_id`, `crop_year`, `grade`, `origin`, `moisture_content`, `clean_yield_pct`, `unit`, `quantity`, `quantity_sold`, `total_quantity`, `unit_cost`, `selling_price`, `total_stock_value`, `reorder_level`, `min_stock_level`, `status`, `description`, `supplier_id`, `supplier_name`, `voucher_no`, `plate_number`, `driver_name`, `created_at`, `updated_at`) VALUES
('P-1789991499832', 'GRE-WH1', 'GREEN MUNG', NULL, NULL, 'WH1-AGRI-EXP', NULL, NULL, NULL, NULL, NULL, 'Quintal', '500.00', '0.00', '500.00', '1200.00', '1450.00', '600000.00', '0.00', '0.00', 'In Stock', 'GREEN MUNG', NULL, NULL, '1323', NULL, NULL, '2026-09-21 17:51:40', '2026-09-28 20:48:40');

-- ----------------------------------------------------------------------------
-- Table structure for table `export_warehouse_movements`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `export_warehouse_movements`;
CREATE TABLE `export_warehouse_movements` (
  `id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `warehouse_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `movement_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `voucher_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batch_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `party_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plate_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gross_quantity` decimal(18,2) DEFAULT '0.00',
  `reject_quantity` decimal(18,2) DEFAULT '0.00',
  `net_quantity` decimal(18,2) DEFAULT '0.00',
  `uom` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Quintal',
  `unit_price` decimal(18,2) DEFAULT '0.00',
  `selling_price` decimal(18,2) DEFAULT NULL,
  `movement_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ewm_wh` (`warehouse_id`),
  KEY `idx_ewm_prod` (`product_id`),
  KEY `idx_ewm_date` (`movement_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `export_warehouse_movements` (1 rows)
INSERT INTO `export_warehouse_movements` (`id`, `warehouse_id`, `product_id`, `movement_type`, `voucher_no`, `batch_no`, `party_name`, `plate_number`, `gross_quantity`, `reject_quantity`, `net_quantity`, `uom`, `unit_price`, `selling_price`, `movement_date`, `reason`, `created_by`, `created_at`, `updated_at`) VALUES
('EWM-INIT-P-1789991499832', 'WH1-AGRI-EXP', 'P-1789991499832', 'GRV_ENTRY', '1323', 'GRV-1323', 'Initial Harvest Intake', 'ET-3-12844', '500.00', '0.00', '500.00', 'Quintal', '1200.00', '1450.00', '2026-09-28', 'Initial Stock Registration', 'Warehouse Officer', '2026-09-28 20:48:40', '2026-09-28 20:48:40');

-- ----------------------------------------------------------------------------
-- Table structure for table `gl_account_mappings`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `gl_account_mappings`;
CREATE TABLE `gl_account_mappings` (
  `id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `normal_posting` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Debit',
  `is_system_default` tinyint(1) NOT NULL DEFAULT '0',
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mapping_category` (`category`),
  KEY `idx_mapping_account_id` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `gl_account_mappings` (28 rows)
INSERT INTO `gl_account_mappings` (`id`, `label`, `category`, `account_id`, `account_code`, `account_name`, `normal_posting`, `is_system_default`, `description`, `updated_by`, `created_at`, `updated_at`) VALUES
('ap_advance_prepayment', 'Supplier Advance & Prepayment Asset', 'Purchasing & AP', '1100-03', '1100-03', 'PURCHASE ADVANCE', 'Debit', 1, 'Cash prepayments issued to suppliers prior to goods receipt.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('ap_trade_payable', 'Trade Accounts Payable (Supplier Bills)', 'Purchasing & AP', '2100-06', '2100-06', 'OTHER ACCRUALS', 'Credit', 1, 'Supplier liability credited upon recording vendor purchase bill.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('bank_interest_income', 'Bank Interest Income Earned', 'Banking & Treasury', '4200', '4200', 'OTHER INCOME', 'Credit', 1, 'Interest income credited during monthly bank statement reconciliation.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('bank_service_charge_expense', 'Bank Service Charges & Fees', 'Banking & Treasury', '8000-25', '8000-25', 'BANK SERVICE CHARGE', 'Debit', 1, 'Bank ledger fee debited during monthly bank statement reconciliation.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('cogs_stock_fulfillment', 'Cost of Goods Sold (Delivery Notes / Stock Fulfillment)', 'Inventory & COGS', '6000-04', '6000-04', 'PACKING AND BAGING', 'Debit', 1, 'Cost of sales recognized upon dispatching customer delivery note.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:59:28'),
('customer_receipt_bank', 'Customer Receipt Default Bank Account', 'Banking & Treasury', '1000-02-26', '1000-02-26', 'CBE_ECB_AC_1000465135224', 'Debit', 1, 'Default bank account receiving customer settlement funds.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('expense_default_debit', 'Default General / Administrative Expense', 'Expenses & Taxes', '8000-30', '8000-30', 'MICELLANOUS', 'Debit', 1, 'Fallback operating expense account for operational payment vouchers.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('expense_default_payment', 'Default Petty Cash / Expense Disbursing Account', 'Expenses & Taxes', '1000-01-01', '1000-01-01', 'PETTY CASH-HEAD OFFICE', 'Credit', 1, 'Cash account credited for head office petty cash and minor expenses.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('expense_vat_input', 'VAT Input / Receivable Asset (15%)', 'Expenses & Taxes', '1320-06-02', '1320-06-02', 'VAT RECIVABLE', 'Debit', 1, 'Input VAT paid on business purchases, claimable against output VAT.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('expense_wht_payable', 'Withholding Tax Payable (Deducted from Vendors)', 'Expenses & Taxes', '2000-04', '2000-04', 'WHT PAYABLE', 'Credit', 1, '2% or 30% tax withheld from suppliers, payable to tax authority.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('fx_unrealized_gain_loss', 'Unrealized Foreign Exchange Gain / Loss', 'Banking & Treasury', '4200', '4200', 'OTHER INCOME', 'Credit', 1, 'Variance account for foreign currency bank account revaluations.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('inventory_stock_in_hand', 'Commodity Stock In Hand Asset', 'Inventory & COGS', '1410-01', '1410-01', 'STOCK OF GREEN MUNG', 'Debit', 1, 'Core balance sheet inventory asset representing warehouse commodities.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('payroll_accrued_clearing', 'Accrued Net Payroll Payable', 'Payroll & HR', '2100-06', '2100-06', 'OTHER ACCRUALS', 'Credit', 1, 'Net salary liability credited on accrual, cleared upon payroll bank transfer.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('payroll_gross_salary_expense', 'Gross Salaries & Wages Expense', 'Payroll & HR', '8000-01', '8000-01', 'SALARY AND WAGE', 'Debit', 1, 'Total gross compensation debited on monthly payroll accrual run.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('payroll_income_tax_payable', 'Employee Income Tax (PAYE) Payable', 'Payroll & HR', '2000-02', '2000-02', 'INCOME TAX PAYABLE', 'Credit', 1, 'Personal income tax withheld from employee payroll, payable to government.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-14 19:19:04'),
('payroll_pension_payable', 'Pension Contribution Payable (7% + 11%)', 'Payroll & HR', '2000-03', '2000-03', 'PENSION TAX PAYABLE', 'Credit', 1, 'Mandatory employee (7%) and employer (11%) pension contributions payable.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('po_grni_clearing', 'Goods Received Not Invoiced / Other Accruals', 'Purchasing & AP', '2100-06', '2100-06', 'OTHER ACCRUALS', 'Credit', 1, 'Clearing accrual liability credited on GRN and debited upon vendor bill receipt.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('po_grni_inventory', 'Inventory Stock-In-Hand (PO Goods Receipt / GRN)', 'Purchasing & AP', '1410-01', '1410-01', 'STOCK OF GREEN MUNG', 'Debit', 1, 'Inventory asset debited when warehouse procurement receiving voucher is logged.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('sales_cash_clearing', 'Cash / Bank (Direct Cash Sales)', 'Sales & Revenue', '1000-02-26', '1000-02-26', 'CBE_ECB_AC_1000465135224', 'Debit', 1, 'Operating bank/cash account debited upon immediate cash sales issue.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('sales_credit_ar', 'Trade Accounts Receivable (Credit Invoicing)', 'Sales & Revenue', '1300-03', '1300-03', 'VET MEDICEN SALES RECIVABLE', 'Debit', 1, 'Customer balance due debited upon issuing a credit sales invoice.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('sales_revenue_domestic', 'Domestic Commercial Sales Revenue', 'Sales & Revenue', '4000-01-01', '4000-01-01', 'SALES OF VETERINARY DRUG', 'Credit', 1, 'Operating sales revenue recognized from domestic product sales.', 'System Reset', '2026-09-13 18:42:08', '2026-09-13 23:25:46'),
('sales_revenue_services', 'Service Revenue (Cleaning & Storage)', 'Sales & Revenue', '4000-03-02', '4000-03-02', 'CLEANING SERVICE', 'Credit', 1, 'Revenue earned from warehouse grain cleaning, handling, and storage.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('sales_vat_output', 'VAT Output Payable (15%)', 'Sales & Revenue', '2000-05', '2000-05', 'VAT PAYABLE', 'Credit', 1, 'Value Added Tax collected from customers, payable to tax authorities.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('sales_wht_withheld', 'Withholding Tax Receivable Asset (Client Withheld)', 'Sales & Revenue', '1320-06-01', '1320-06-01', 'WITHOLD TAX RECIVABLE', 'Debit', 1, 'Tax withheld by clients (2% or 30%), claimable against annual corporate tax.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('stock_adjustment_gain', 'Physical Inventory Surplus / Count Gain', 'Inventory & COGS', '4200', '4200', 'OTHER INCOME', 'Credit', 1, 'Gain recognized when physical audit count reveals positive stock surplus.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('stock_shrinkage_loss', 'Physical Inventory Shrinkage / Count Loss', 'Inventory & COGS', '6000-22', '6000-22', 'OTHER', 'Debit', 1, 'Write-off expense debited when physical count reveals negative variance.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('supplier_payment_ap', 'Supplier Payment (AP Clearing Debit)', 'Purchasing & AP', '2100-06', '2100-06', 'OTHER ACCRUALS', 'Debit', 1, 'Clearing supplier liability upon issuing an AP payment voucher.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08'),
('supplier_payment_bank', 'Supplier Payment Disbursing Bank Account', 'Banking & Treasury', '1000-02-26', '1000-02-26', 'CBE_ECB_AC_1000465135224', 'Credit', 1, 'Default corporate bank account used to disburse supplier payments.', 'System Initializer', '2026-09-13 18:42:08', '2026-09-13 18:42:08');

-- ----------------------------------------------------------------------------
-- Table structure for table `hkc_doc_records`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `hkc_doc_records`;
CREATE TABLE `hkc_doc_records` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_hkc_doc_records_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `hkc_doc_records`

-- ----------------------------------------------------------------------------
-- Table structure for table `invoices`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `invoices`;
CREATE TABLE `invoices` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_invoices_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `invoices`

-- ----------------------------------------------------------------------------
-- Table structure for table `journal_entries`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `journal_entries`;
CREATE TABLE `journal_entries` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_journal_entries_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `journal_entries`

-- ----------------------------------------------------------------------------
-- Table structure for table `journal_entry_lines`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `journal_entry_lines`;
CREATE TABLE `journal_entry_lines` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_journal_entry_lines_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `journal_entry_lines`

-- ----------------------------------------------------------------------------
-- Table structure for table `leave_requests`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `leave_requests`;
CREATE TABLE `leave_requests` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_leave_requests_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `leave_requests`

-- ----------------------------------------------------------------------------
-- Table structure for table `leave_types`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `leave_types`;
CREATE TABLE `leave_types` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_leave_types_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `leave_types`

-- ----------------------------------------------------------------------------
-- Table structure for table `payments`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_payments_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `payments`

-- ----------------------------------------------------------------------------
-- Table structure for table `payroll_periods`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `payroll_periods`;
CREATE TABLE `payroll_periods` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_payroll_periods_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `payroll_periods`

-- ----------------------------------------------------------------------------
-- Table structure for table `payroll_records`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `payroll_records`;
CREATE TABLE `payroll_records` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_payroll_records_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `payroll_records`

-- ----------------------------------------------------------------------------
-- Table structure for table `pharma_product_batches`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `pharma_product_batches`;
CREATE TABLE `pharma_product_batches` (
  `id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `warehouse_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `mfg_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiry_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(18,2) NOT NULL DEFAULT '0.00',
  `unit_cost` decimal(18,2) DEFAULT '0.00',
  `selling_price` decimal(18,2) DEFAULT NULL,
  `qa_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Released',
  `location` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_batch_prod` (`product_id`),
  KEY `idx_batch_wh` (`warehouse_id`),
  KEY `idx_batch_expiry` (`expiry_date`),
  KEY `idx_batch_status` (`qa_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `pharma_product_batches` (22 rows)
INSERT INTO `pharma_product_batches` (`id`, `product_id`, `warehouse_id`, `batch_no`, `mfg_date`, `expiry_date`, `quantity`, `unit_cost`, `selling_price`, `qa_status`, `location`, `notes`, `created_at`, `updated_at`) VALUES
('batch-P-1788854908608-ALT26025', 'P-1788854908608', 'WH2', 'ALT26025', '2026-01-01', '2029-12-01', '3500.00', '185.33', '235.00', 'Released', 'Shelf A-1', 'Initial batch for ASHIVER 5', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788857345432-251032', 'P-1788857345432', 'WH3', '251032', '2025-10-01', '2028-10-01', '2320.00', '189.02', '200.00', 'Released', 'Shelf A-1', 'Initial batch for INFLAMGO', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788857446192-260512', 'P-1788857446192', 'WH3', '260512', '2026-05-01', '2029-05-01', '21200.00', '188.42', '215.00', 'Released', 'Shelf A-1', 'Initial batch for INFLAMGO', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788858054417-251036', 'P-1788858054417', 'WH3', '251036', '2025-10-01', '2028-10-01', '6560.00', '707.92', '848.00', 'Released', 'Shelf A-1', 'Initial batch for ALBENTONG 2500', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788858377681-251034', 'P-1788858377681', 'WH3', '251034', '2025-10-01', '2028-10-01', '2610.00', '401.79', '465.00', 'Released', 'Shelf A-1', 'Initial batch for ALBENTONG SUS 10', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788858567873-251035', 'P-1788858567873', 'WH3', '251035', '2025-10-01', '2028-10-01', '2310.00', '382.66', '440.00', 'Released', 'Shelf A-1', 'Initial batch for LIVERFLUKE 1', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788859087961-AA12423', 'P-1788859087961', 'WH2', 'AA12423', '2024-12-01', '2027-11-01', '240.00', '1166.74', '1290.00', 'Released', 'Shelf A-1', 'Initial batch for ASHITRAZ 12.5%', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788859302545-ALT25356', 'P-1788859302545', 'WH2', 'ALT25356', '2025-06-01', '2029-05-01', '400.00', '630.92', '690.00', 'Released', 'Shelf A-1', 'Initial batch for ASHITETRA 2000', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788859513561-ALI25077', 'P-1788859513561', 'WH2', 'ALI25077', '2025-04-01', '2027-01-01', '600.00', '84.00', '84.00', 'Released', 'Shelf A-1', 'Initial batch for ASHIVER 1% INJECTION', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788859675153-D260392U', 'P-1788859675153', 'WH3', 'D260392U', '2026-03-01', '2029-03-01', '3980.00', '128.20', '170.00', 'Released', 'Shelf A-1', 'Initial batch for TY-VITAMINS', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788860002713-ALT26022', 'P-1788860002713', 'WH2', 'ALT26022', '2026-01-01', '2029-12-01', '240.00', '806.51', '911.00', 'Released', 'Shelf A-1', 'Initial batch for ASHIALBIN 2500', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788860199689-ALL260448', 'P-1788860199689', 'WH2', 'ALL260448', '2026-04-01', '2029-03-01', '1100.00', '383.09', '433.00', 'Released', 'Shelf A-1', 'Initial batch for ASHIENRO BH', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788860444633-ALG26111', 'P-1788860444633', 'WH2', 'ALG26111', '2026-03-01', '2029-02-01', '2772.00', '201.63', '228.00', 'Released', 'Shelf A-1', 'Initial batch for ASHOXY 20% 5GM', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788860782033-ALT25393', 'P-1788860782033', 'WH2', 'ALT25393', '2025-07-01', '2029-06-01', '660.00', '362.93', '410.00', 'Released', 'Shelf A-1', 'Initial batch for FASINASH SHEEP', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788861003705-ALG26109', 'P-1788861003705', 'WH2', 'ALG26109', '2026-03-01', '2029-02-01', '1512.00', '1713.83', '1935.00', 'Released', 'Shelf A-1', 'Initial batch for ASHOXY 20% 100GM', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788919771878-ALL26041', 'P-1788919771878', 'WH2', 'ALL26041', '2026-04-01', '2029-03-01', '1500.00', '211.71', '239.00', 'Released', 'Shelf A-1', 'Initial batch for ASHINERO 10% ORAL', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788920432213-ALI26027', 'P-1788920432213', 'WH2', 'ALI26027', '2026-04-01', '2029-03-01', '400.00', '383.09', '433.00', 'Released', 'Shelf A-1', 'Initial batch for ASHTYL 20% INJ', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788920639771-260504', 'P-1788920639771', 'WH3', '260504', '2026-05-01', '2029-05-01', '60000.00', '56.53', '65.00', 'Released', 'Shelf A-1', 'Initial batch for IVERTONG GLASS', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788920860228-260516', 'P-1788920860228', 'WH3', '260516', '2026-05-01', '2029-05-01', '7500.00', '181.59', '206.00', 'Released', 'Shelf A-1', 'Initial batch for OXYTONG 20', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788921168285-260509', 'P-1788921168285', 'WH3', '260509', '2026-05-01', '2029-05-01', '105500.00', '56.53', '65.00', 'Released', 'Shelf A-1', 'Initial batch for IVERTONG PLASTIC', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788921387242-260511', 'P-1788921387242', 'WH3', '260511', '2026-05-01', '2029-05-01', '40080.00', '123.52', '141.00', 'Released', 'Shelf A-1', 'Initial batch for HIVITA TONG', '2026-09-28 20:48:40', '2026-09-28 23:15:43'),
('batch-P-1788921559264-260514', 'P-1788921559264', 'WH3', '260514', '2026-05-01', '2031-05-01', '93000.00', '26.17', '30.00', 'Released', 'Shelf A-1', 'Initial batch for TRYPATONG', '2026-09-28 20:48:40', '2026-09-28 23:15:43');

-- ----------------------------------------------------------------------------
-- Table structure for table `pharma_products`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `pharma_products`;
CREATE TABLE `pharma_products` (
  `id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `generic_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sub_category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `warehouse_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mfg_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiry_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dosage_form` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `strength` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shelf_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `storage_condition` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Box',
  `quantity_per_pack` int DEFAULT '1',
  `number_of_cartons` int DEFAULT '0',
  `quantity` decimal(18,2) NOT NULL DEFAULT '0.00',
  `quantity_sold` decimal(18,2) NOT NULL DEFAULT '0.00',
  `total_quantity` decimal(18,2) NOT NULL DEFAULT '0.00',
  `unit_cost` decimal(18,2) NOT NULL DEFAULT '0.00',
  `selling_price` decimal(18,2) NOT NULL DEFAULT '0.00',
  `total_stock_value` decimal(18,2) NOT NULL DEFAULT '0.00',
  `reorder_level` decimal(18,2) DEFAULT '0.00',
  `min_stock_level` decimal(18,2) DEFAULT '0.00',
  `shelf_life_months` int DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'In Stock',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `supplier_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `supplier_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pharma_prod_wh` (`warehouse_id`),
  KEY `idx_pharma_prod_category` (`category`),
  KEY `idx_pharma_prod_sku` (`sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `pharma_products` (22 rows)
INSERT INTO `pharma_products` (`id`, `sku`, `name`, `generic_name`, `category`, `sub_category`, `warehouse_id`, `batch_no`, `mfg_date`, `expiry_date`, `dosage_form`, `strength`, `shelf_number`, `storage_condition`, `unit`, `quantity_per_pack`, `number_of_cartons`, `quantity`, `quantity_sold`, `total_quantity`, `unit_cost`, `selling_price`, `total_stock_value`, `reorder_level`, `min_stock_level`, `shelf_life_months`, `status`, `description`, `supplier_id`, `supplier_name`, `created_at`, `updated_at`) VALUES
('P-1788854908608', 'ASH-ALT26025', 'ASHIVER 5', 'ASHIVER 5', 'Veterinary Medicine', NULL, 'WH2', 'ALT26025', '2026-01-01', '2029-12-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Box', 100, 35, '3500.00', '0.00', '3500.00', '185.33', '235.00', '648655.00', '0.00', '0.00', 47, 'In Stock', 'ASHIVER 5', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788857345432', 'INF-251032', 'INFLAMGO', 'INFLAMGO', 'Veterinary Medicine', NULL, 'WH3', '251032', '2025-10-01', '2028-10-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Bottle', 80, 29, '2320.00', '0.00', '2320.00', '189.02', '200.00', '438526.40', '0.00', '0.00', 36, 'In Stock', 'INFLAMGO', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788857446192', 'INF-260512', 'INFLAMGO', 'INFLAMGO', 'Veterinary Medicine', NULL, 'WH3', '260512', '2026-05-01', '2029-05-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Bottle', 80, 265, '21200.00', '0.00', '21200.00', '188.42', '215.00', '3994504.00', '0.00', '0.00', 36, 'In Stock', 'INFLAMGO', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788858054417', 'ALB-251036', 'ALBENTONG 2500', 'ALBENTONG 2500', 'Veterinary Medicine', NULL, 'WH3', '251036', '2025-10-01', '2028-10-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Box', 40, 164, '6560.00', '0.00', '6560.00', '707.92', '848.00', '4643955.20', '0.00', '0.00', 36, 'In Stock', 'ALBENTONG 2500', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788858377681', 'ALB-251034', 'ALBENTONG SUS 10', 'ALBENTONG SUS 10', 'Veterinary Medicine', NULL, 'WH3', '251034', '2025-10-01', '2028-10-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Bottle', 30, 87, '2610.00', '0.00', '2610.00', '401.79', '465.00', '1048671.90', '0.00', '0.00', 36, 'In Stock', 'ALBENTONG SUS 10', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788858567873', 'LIV-251035', 'LIVERFLUKE 1', 'LIVERFLUKE 1', 'Veterinary Medicine', NULL, 'WH3', '251035', '2025-10-01', '2028-10-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Bottle', 30, 77, '2310.00', '0.00', '2310.00', '382.66', '440.00', '883944.60', '0.00', '0.00', 36, 'In Stock', 'LIVERFLUKE 1', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788859087961', 'ASH-AA12423', 'ASHITRAZ 12.5%', 'ASHITRAZ 12.5%', 'Veterinary Medicine', NULL, 'WH2', 'AA12423', '2024-12-01', '2027-11-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Bottle', 12, 20, '240.00', '0.00', '240.00', '1166.74', '1290.00', '280017.60', '0.00', '0.00', 35, 'In Stock', 'ASHITRAZ 12.5%', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788859302545', 'ASH-ALT25356', 'ASHITETRA 2000', 'ASHITETRA 2000', 'Veterinary Medicine', NULL, 'WH2', 'ALT25356', '2025-06-01', '2029-05-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Box', 40, 10, '400.00', '0.00', '400.00', '630.92', '690.00', '252368.00', '0.00', '0.00', 47, 'In Stock', 'ASHITETRA 2000', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788859513561', 'ASH-ALI25077', 'ASHIVER 1% INJECTION', 'ASHIVER 1% INJECTION', 'Veterinary Medicine', NULL, 'WH2', 'ALI25077', '2025-04-01', '2027-01-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Vial', 120, 5, '600.00', '0.00', '600.00', '84.00', '84.00', '50400.00', '0.00', '0.00', 21, 'In Stock', 'ASHIVER 1% INJECTION', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788859675153', 'TYSTK-D260392U', 'TY-VITAMINS', 'TY-VITAMINS', 'Veterinary Medicine', NULL, 'WH3', 'D260392U', '2026-03-01', '2029-03-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Bottle', 100, 39, '3980.00', '0.00', '3980.00', '128.20', '170.00', '510236.00', '0.00', '0.00', 36, 'In Stock', 'TY-VITAMINS', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788860002713', 'ASH-ALT26022', 'ASHIALBIN 2500', 'ASHIALBIN 2500', 'Veterinary Medicine', NULL, 'WH2', 'ALT26022', '2026-01-01', '2029-12-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Box', 60, 4, '240.00', '0.00', '240.00', '806.51', '911.00', '193562.40', '0.00', '0.00', 47, 'In Stock', 'ASHIALBIN 2500', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788860199689', 'ASH-ALL260448', 'ASHIENRO BH', 'ASHIENRO BH', 'Veterinary Medicine', NULL, 'WH2', 'ALL260448', '2026-04-01', '2029-03-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Bottle', 100, 11, '1100.00', '0.00', '1100.00', '383.09', '433.00', '421399.00', '0.00', '0.00', 35, 'In Stock', 'ASHIENRO BH', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788860444633', 'ASH-ALG26111', 'ASHOXY 20% 5GM', 'ASHOXY 20% 5GM', 'Veterinary Medicine', NULL, 'WH2', 'ALG26111', '2026-03-01', '2029-02-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Box', 132, 21, '2772.00', '0.00', '2772.00', '201.63', '228.00', '558918.36', '0.00', '0.00', 35, 'In Stock', 'ASHOXY 20% 5GM', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788860782033', 'FAS-ALT25393', 'FASINASH SHEEP', 'FASINASH SHEEP', 'Veterinary Medicine', NULL, 'WH2', 'ALT25393', '2025-07-01', '2029-06-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Box', 330, 2, '660.00', '0.00', '660.00', '362.93', '410.00', '239533.80', '0.00', '0.00', 47, 'In Stock', 'FASINASH SHEEP', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788861003705', 'ASH-ALG26109', 'ASHOXY 20% 100GM', 'ASHOXY 20% 100GM', 'Veterinary Medicine', NULL, 'WH2', 'ALG26109', '2026-03-01', '2029-02-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Box', 12, 126, '1512.00', '0.00', '1512.00', '1713.83', '1935.00', '2591310.96', '0.00', '0.00', 35, 'In Stock', 'ASHOXY 20% 100GM', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788919771878', 'ASH-ALL26041', 'ASHINERO 10% ORAL', 'ASHINERO 10% ORAL', 'Veterinary Medicine', NULL, 'WH2', 'ALL26041', '2026-04-01', '2029-03-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Bottle', 100, 15, '1500.00', '0.00', '1500.00', '211.71', '239.00', '317565.00', '0.00', '0.00', 35, 'In Stock', 'ASHINERO 10% ORAL', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788920432213', 'ASH-ALI26027', 'ASHTYL 20% INJ', 'ASHTYL 20% INJ', 'Veterinary Medicine', NULL, 'WH2', 'ALI26027', '2026-04-01', '2029-03-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Vial', 80, 5, '400.00', '0.00', '400.00', '383.09', '433.00', '153236.00', '0.00', '0.00', 35, 'In Stock', 'ASHTYL 20% INJ', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788920639771', 'IVE-260505', 'IVERTONG GLASS', 'IVERTONG GLASS', 'Veterinary Medicine', NULL, 'WH3', '260504', '2026-05-01', '2029-05-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Bottle', 100, 600, '60000.00', '0.00', '60000.00', '56.53', '65.00', '3391800.00', '0.00', '0.00', 36, 'In Stock', 'IVERTONG GLASS', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788920860228', 'OXY-260516', 'OXYTONG 20', 'OXYTONG 20', 'Veterinary Medicine', NULL, 'WH3', '260516', '2026-05-01', '2029-05-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Sachet', 150, 50, '7500.00', '0.00', '7500.00', '181.59', '206.00', '1361925.00', '0.00', '0.00', 36, 'In Stock', 'OXYTONG 20', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788921168285', 'IVE-260509', 'IVERTONG PLASTIC', 'IVERTONG PLASTIC', 'Veterinary Medicine', NULL, 'WH3', '260509', '2026-05-01', '2029-05-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Bottle', 100, 1055, '105500.00', '0.00', '105500.00', '56.53', '65.00', '5963915.00', '0.00', '0.00', 36, 'In Stock', 'IVERTONG PLASTIC', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788921387242', 'HIV-260511', 'HIVITA TONG', 'HIVITA TONG', 'Veterinary Medicine', NULL, 'WH3', '260511', '2026-05-01', '2029-05-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Bottle', 80, 501, '40080.00', '0.00', '40080.00', '123.52', '141.00', '4950681.60', '0.00', '0.00', 36, 'In Stock', 'HIVITA TONG', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40'),
('P-1788921559264', 'TRY-260514', 'TRYPATONG', 'TRYPATONG', 'Veterinary Medicine', NULL, 'WH3', '260514', '2026-05-01', '2031-05-01', NULL, NULL, NULL, 'Room Temperature (15-25Â°C)', 'Sachet', 1000, 93, '93000.00', '0.00', '93000.00', '26.17', '30.00', '2433810.00', '0.00', '0.00', 60, 'In Stock', 'TRYPATONG', NULL, NULL, '2026-09-13 10:03:06', '2026-09-28 20:48:40');

-- ----------------------------------------------------------------------------
-- Table structure for table `processing_services`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `processing_services`;
CREATE TABLE `processing_services` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_company_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `goods_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `quantity` decimal(15,4) DEFAULT '1.0000',
  `uom` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Quintal',
  `entry_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `agreed_price` decimal(15,2) DEFAULT '0.00',
  `currency` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'ETB',
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Received',
  `status_history` json DEFAULT NULL,
  `assigned_to` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoice_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `contract_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `contract_file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `locked_processing_rate` decimal(15,4) DEFAULT NULL,
  `locked_processing_fee` decimal(15,2) DEFAULT NULL,
  `locked_storage_fee` decimal(15,2) DEFAULT NULL,
  `locked_total_fee` decimal(15,2) DEFAULT NULL,
  `processed_at` timestamp(3) NULL DEFAULT NULL,
  `delivered_at` timestamp(3) NULL DEFAULT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `reject_quantity` decimal(18,2) DEFAULT '0.00',
  `reject_reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `net_deliverable_quantity` decimal(18,2) DEFAULT NULL,
  `reject_recorded_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_processing_services_created_at` (`created_at` DESC),
  KEY `idx_processing_services_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `processing_services`

-- ----------------------------------------------------------------------------
-- Table structure for table `purchase_orders`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `purchase_orders`;
CREATE TABLE `purchase_orders` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `po_number` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `voucher_no` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `paid_to` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `supplier` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `supplier_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reason_for_payment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `bank_name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_method` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Cheque',
  `cheque_no` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `amount_paid` decimal(18,2) NOT NULL DEFAULT '0.00',
  `balance_due` decimal(18,2) NOT NULL DEFAULT '0.00',
  `payment_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Cash',
  `payment_terms` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `due_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PAID',
  `settlement_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Fully Settled',
  `currency` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ETB',
  `amount_in_words` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_advice_attachment` json DEFAULT NULL,
  `attachments` json DEFAULT NULL,
  `installment_payments` json DEFAULT NULL,
  `items` json DEFAULT NULL,
  `account_entries` json DEFAULT NULL,
  `prepared_by` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_by` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paid_by` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_purchase_orders_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `purchase_orders`

-- ----------------------------------------------------------------------------
-- Table structure for table `quarantine_records`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `quarantine_records`;
CREATE TABLE `quarantine_records` (
  `id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `warehouse_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sku` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batch_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(18,2) NOT NULL DEFAULT '0.00',
  `unit` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Box',
  `quarantine_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `proposed_release_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Quarantined',
  `reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name_entered` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bin_card_entry_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `disposal_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `quarantine_records`

-- ----------------------------------------------------------------------------
-- Table structure for table `recurring_expense_schedules`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `recurring_expense_schedules`;
CREATE TABLE `recurring_expense_schedules` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_recurring_expense_schedules_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `recurring_expense_schedules`

-- ----------------------------------------------------------------------------
-- Table structure for table `sales_issue_items`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `sales_issue_items`;
CREATE TABLE `sales_issue_items` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sales_issue_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batch_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batch_no` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batch_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(15,4) NOT NULL DEFAULT '1.0000',
  `unit_price` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_price` decimal(15,2) NOT NULL DEFAULT '0.00',
  `amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sales_issue_items_issue_id` (`sales_issue_id`),
  CONSTRAINT `fk_sales_issue_items_issue` FOREIGN KEY (`sales_issue_id`) REFERENCES `sales_issues` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `sales_issue_items`

-- ----------------------------------------------------------------------------
-- Table structure for table `sales_issues`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `sales_issues`;
CREATE TABLE `sales_issues` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `fs_no` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_no` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sales_order_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `issue_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sale_date` date DEFAULT NULL,
  `customer_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `warehouse_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Draft',
  `total_quantity` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `subtotal_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `payment_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Unpaid',
  `payment_method` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `posted_by` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `posted_at` timestamp(3) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sales_issues_created_at` (`created_at` DESC),
  KEY `idx_sales_issues_status` (`status`),
  KEY `idx_sales_issues_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `sales_issues`

-- ----------------------------------------------------------------------------
-- Table structure for table `sales_orders`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `sales_orders`;
CREATE TABLE `sales_orders` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sales_orders_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `sales_orders`

-- ----------------------------------------------------------------------------
-- Table structure for table `shipment_documents`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `shipment_documents`;
CREATE TABLE `shipment_documents` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'purchase_order',
  `document_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Other',
  `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` decimal(15,2) DEFAULT '1024.00',
  `file_url` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `uploaded_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `uploaded_by` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Current User',
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_shipment_documents_record` (`record_id`,`record_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `shipment_documents`

-- ----------------------------------------------------------------------------
-- Table structure for table `stock_movements`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `stock_movements`;
CREATE TABLE `stock_movements` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `warehouse_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'WH1',
  `movement_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INBOUND_RECEIPT',
  `quantity` decimal(18,2) NOT NULL DEFAULT '0.00',
  `unit_cost` decimal(18,2) DEFAULT '0.00',
  `unit_price` decimal(15,2) DEFAULT NULL,
  `selling_price` decimal(18,2) DEFAULT NULL,
  `balance_after` decimal(18,2) NOT NULL DEFAULT '0.00',
  `batch_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiry_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mfg_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `party` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `performed_by` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `movement_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_stock_movements_created_at` (`created_at` DESC),
  KEY `idx_mov_prod_date` (`product_id`,`movement_date`),
  KEY `idx_mov_wh_date` (`warehouse_id`,`movement_date`),
  KEY `idx_mov_ref` (`reference_type`,`reference_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `stock_movements` (22 rows)
INSERT INTO `stock_movements` (`id`, `product_id`, `warehouse_id`, `movement_type`, `quantity`, `unit_cost`, `unit_price`, `selling_price`, `balance_after`, `batch_no`, `expiry_date`, `mfg_date`, `reference_type`, `reference_id`, `notes`, `party`, `performed_by`, `movement_date`, `created_at`, `updated_at`) VALUES
('SM-INIT-P-1788854908608', 'P-1788854908608', 'WH2', 'RECEIPT', '3500.00', '185.33', '185.33', '235.00', '3500.00', 'ALT26025', '2029-12-01', '2026-01-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788857345432', 'P-1788857345432', 'WH3', 'RECEIPT', '2320.00', '189.02', '189.02', '200.00', '2320.00', '251032', '2028-10-01', '2025-10-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788857446192', 'P-1788857446192', 'WH3', 'RECEIPT', '21200.00', '188.42', '188.42', '215.00', '21200.00', '260512', '2029-05-01', '2026-05-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788858054417', 'P-1788858054417', 'WH3', 'RECEIPT', '6560.00', '707.92', '707.92', '848.00', '6560.00', '251036', '2028-10-01', '2025-10-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788858377681', 'P-1788858377681', 'WH3', 'RECEIPT', '2610.00', '401.79', '401.79', '465.00', '2610.00', '251034', '2028-10-01', '2025-10-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788858567873', 'P-1788858567873', 'WH3', 'RECEIPT', '2310.00', '382.66', '382.66', '440.00', '2310.00', '251035', '2028-10-01', '2025-10-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788859087961', 'P-1788859087961', 'WH2', 'RECEIPT', '240.00', '1166.74', '1166.74', '1290.00', '240.00', 'AA12423', '2027-11-01', '2024-12-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788859302545', 'P-1788859302545', 'WH2', 'RECEIPT', '400.00', '630.92', '630.92', '690.00', '400.00', 'ALT25356', '2029-05-01', '2025-06-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788859513561', 'P-1788859513561', 'WH2', 'RECEIPT', '600.00', '84.00', '84.00', '84.00', '600.00', 'ALI25077', '2027-01-01', '2025-04-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788859675153', 'P-1788859675153', 'WH3', 'RECEIPT', '3980.00', '128.20', '128.20', '170.00', '3980.00', 'D260392U', '2029-03-01', '2026-03-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788860002713', 'P-1788860002713', 'WH2', 'RECEIPT', '240.00', '806.51', '806.51', '911.00', '240.00', 'ALT26022', '2029-12-01', '2026-01-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788860199689', 'P-1788860199689', 'WH2', 'RECEIPT', '1100.00', '383.09', '383.09', '433.00', '1100.00', 'ALL260448', '2029-03-01', '2026-04-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788860444633', 'P-1788860444633', 'WH2', 'RECEIPT', '2772.00', '201.63', '201.63', '228.00', '2772.00', 'ALG26111', '2029-02-01', '2026-03-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788860782033', 'P-1788860782033', 'WH2', 'RECEIPT', '660.00', '362.93', '362.93', '410.00', '660.00', 'ALT25393', '2029-06-01', '2025-07-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788861003705', 'P-1788861003705', 'WH2', 'RECEIPT', '1512.00', '1713.83', '1713.83', '1935.00', '1512.00', 'ALG26109', '2029-02-01', '2026-03-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788919771878', 'P-1788919771878', 'WH2', 'RECEIPT', '1500.00', '211.71', '211.71', '239.00', '1500.00', 'ALL26041', '2029-03-01', '2026-04-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788920432213', 'P-1788920432213', 'WH2', 'RECEIPT', '400.00', '383.09', '383.09', '433.00', '400.00', 'ALI26027', '2029-03-01', '2026-04-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788920639771', 'P-1788920639771', 'WH3', 'RECEIPT', '60000.00', '56.53', '56.53', '65.00', '60000.00', '260504', '2029-05-01', '2026-05-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788920860228', 'P-1788920860228', 'WH3', 'RECEIPT', '7500.00', '181.59', '181.59', '206.00', '7500.00', '260516', '2029-05-01', '2026-05-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788921168285', 'P-1788921168285', 'WH3', 'RECEIPT', '105500.00', '56.53', '56.53', '65.00', '105500.00', '260509', '2029-05-01', '2026-05-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788921387242', 'P-1788921387242', 'WH3', 'RECEIPT', '40080.00', '123.52', '123.52', '141.00', '40080.00', '260511', '2029-05-01', '2026-05-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000'),
('SM-INIT-P-1788921559264', 'P-1788921559264', 'WH3', 'RECEIPT', '93000.00', '26.17', '26.17', '30.00', '93000.00', '260514', '2031-05-01', '2026-05-01', 'GRV_ENTRY', 'INIT-001', 'Initial Stock Registration', 'Initial Stock Deposit', 'System Admin', '2026-09-28', '2026-09-28 20:48:40.000', '2026-09-28 20:48:40.000');

-- ----------------------------------------------------------------------------
-- Table structure for table `store_transfer_items`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `store_transfer_items`;
CREATE TABLE `store_transfer_items` (
  `id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `transfer_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batch_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(18,2) NOT NULL DEFAULT '0.00',
  `uom` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit_cost` decimal(18,2) DEFAULT '0.00',
  `notes` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_item_transfer` (`transfer_id`),
  KEY `idx_item_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `store_transfer_items`

-- ----------------------------------------------------------------------------
-- Table structure for table `store_transfers`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `store_transfers`;
CREATE TABLE `store_transfers` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `transfer_no` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `from_warehouse_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'WH2',
  `to_warehouse_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'WH3',
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Draft',
  `requested_by` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_by` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `request_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `completed_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_store_transfers_created_at` (`created_at` DESC),
  KEY `idx_transfer_from` (`from_warehouse_id`),
  KEY `idx_transfer_to` (`to_warehouse_id`),
  KEY `idx_transfer_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `store_transfers`

-- ----------------------------------------------------------------------------
-- Table structure for table `suppliers`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `suppliers`;
CREATE TABLE `suppliers` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_suppliers_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `suppliers`

-- ----------------------------------------------------------------------------
-- Table structure for table `tax_rules`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `tax_rules`;
CREATE TABLE `tax_rules` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_tax_rules_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `tax_rules` (8 rows)
INSERT INTO `tax_rules` (`id`, `payload`, `created_at`, `updated_at`) VALUES
('TAX-001', '{"id":"TAX-001","name":"Standard VAT (15%)","rate":15,"type":"VAT/GST","accountCode":"","description":"Standard Ethiopian Value Added Tax rate of 15%","isInclusive":false,"ratePercent":15,"is_inclusive":false,"gl_account_code":"2210"}', '2026-08-12 22:32:45.335', '2026-08-29 22:07:48.466'),
('TAX-002', '{"id":"TAX-002","name":"Withholding Tax (TDS 2%)","rate":2,"type":"Withholding Tax (TDS)","accountCode":"2210","description":"2% Tax Deducted at Source for commercial services","isInclusive":false,"ratePercent":2,"is_inclusive":false,"gl_account_code":"2210"}', '2026-08-12 22:32:45.335', '2026-08-29 22:07:48.466'),
('TAX-003', '{"id":"TAX-003","name":"Import Customs Duty (10%)","rate":10,"type":"Import Duty","accountCode":"2210","description":"Customs duty rate on imported agricultural & tech goods","isInclusive":false,"ratePercent":10,"is_inclusive":false,"gl_account_code":"2210"}', '2026-08-12 22:32:45.335', '2026-08-29 22:07:48.466'),
('TAX-TOT-2', '{"id":"TAX-TOT-2","name":"Turnover Tax (2% TOT)","type":"Turnover Tax (TOT)","appliesTo":"SALES","is_active":true,"accountCode":"2000-05","description":"2% Turnover Tax for non-VAT registered service transactions","isDeduction":false,"isInclusive":false,"ratePercent":2}', '2026-08-29 11:49:31.181', '2026-09-28 13:20:57.811'),
('TAX-VAT-15', '{"id":"TAX-VAT-15","name":"Standard VAT (15%)","type":"VAT/GST","appliesTo":"BOTH","is_active":true,"accountCode":"2000-05","description":"Standard 15% Ethiopian Value Added Tax (Output VAT / Input VAT)","isDeduction":false,"isInclusive":false,"ratePercent":15}', '2026-08-29 11:49:31.181', '2026-09-28 13:20:57.804'),
('TAX-WHT-2', '{"id":"TAX-WHT-2","name":"Withholding Tax (2% Services)","type":"Withholding Tax (TDS)","appliesTo":"BOTH","is_active":true,"accountCode":"1320-06-01","description":"2% Tax Deducted at Source for commercial service contracts","isDeduction":true,"isInclusive":false,"ratePercent":2}', '2026-08-29 11:49:31.181', '2026-09-28 13:20:57.808'),
('TAX-WHT-3', '{"id":"TAX-WHT-3","name":"Withholding Tax (3% Goods/Rent)","type":"Withholding Tax (TDS)","appliesTo":"BOTH","is_active":true,"accountCode":"1320-06-01","description":"3% Withholding Tax asset deducted on goods supplies and rental","isDeduction":true,"isInclusive":false,"ratePercent":3}', '2026-08-29 11:49:31.181', '2026-09-28 13:20:57.810'),
('TAX-ZERO', '{"id":"TAX-ZERO","name":"Zero-Rated / Export Exempt (0%)","type":"Exempt","appliesTo":"BOTH","is_active":true,"accountCode":"2000-05","description":"Zero-rated export commodities (Green Mung, Sesame) and exempt supplies","isDeduction":false,"isInclusive":false,"ratePercent":0}', '2026-08-29 11:49:31.181', '2026-09-28 13:20:57.813');

-- ----------------------------------------------------------------------------
-- Table structure for table `user_activity_logs`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `user_activity_logs`;
CREATE TABLE `user_activity_logs` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `fullname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `resource` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `module` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `details` json DEFAULT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_user_activity_logs_created_at` (`created_at` DESC),
  KEY `idx_user_activity_logs_module` (`module`),
  KEY `fk_user_activity_logs_user` (`user_id`),
  CONSTRAINT `fk_user_activity_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `user_activity_logs`

-- ----------------------------------------------------------------------------
-- Table structure for table `user_sessions`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `user_sessions`;
CREATE TABLE `user_sessions` (
  `id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `device_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'desktop',
  `os_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `browser_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_revoked` tinyint(1) NOT NULL DEFAULT '0',
  `last_active_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_sessions_user_id` (`user_id`),
  KEY `idx_user_sessions_lookup` (`id`,`is_revoked`,`expires_at`),
  CONSTRAINT `fk_user_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `user_sessions` (130 rows)
INSERT INTO `user_sessions` (`id`, `user_id`, `ip_address`, `user_agent`, `device_type`, `os_name`, `browser_name`, `is_revoked`, `last_active_at`, `expires_at`, `created_at`, `updated_at`) VALUES
('sess_00628ccdb6b943d7919b524eb5ba7ce5', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.190.60.93', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-15 22:09:45', '2026-09-16 07:06:41', '2026-09-15 22:06:41', '2026-09-16 01:44:09'),
('sess_0174102adf4d473ca4497964600f89b0', 'USR-6b974442', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 1, '2026-09-16 12:17:02', '2026-09-16 21:12:50', '2026-09-16 12:12:50', '2026-09-16 14:26:27'),
('sess_01c57d3fd7e84ba4bf1e6ddb44e03940', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.152.127', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-15 02:33:19', '2026-09-15 11:32:06', '2026-09-15 02:32:05', '2026-09-15 09:12:23'),
('sess_029ea22c25b34d0d92ccde19b2a8c635', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.144.67', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 0, '2026-09-19 14:44:27', '2026-09-19 23:37:28', '2026-09-19 14:37:28', '2026-09-19 14:44:27'),
('sess_05df258aed334534bd71d0d4aad26351', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 1, '2026-09-18 13:53:33', '2026-09-18 21:54:58', '2026-09-18 12:54:58', '2026-09-18 21:06:19'),
('sess_09a927eac8424727a993a03aafd7e03c', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '15.204.43.197', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-19 15:05:25', '2026-09-20 00:05:20', '2026-09-19 15:05:19', '2026-09-19 15:05:25'),
('sess_0a733e0452a84ad6872fc59039840741', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.188.241.190', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-21 19:40:40', '2026-09-22 04:40:07', '2026-09-21 19:40:06', '2026-09-21 19:40:40'),
('sess_1169c1016c1d4335bebe264637bf12c1', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.152.243', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-19 14:11:04', '2026-09-19 23:03:01', '2026-09-19 14:03:01', '2026-09-19 14:24:20'),
('sess_13565bd7289247f199c4b6ba9d144c14', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', '', 'desktop', 'Unknown OS', 'Web Browser', 1, '2026-09-16 00:26:37', '2026-09-16 06:26:37', '2026-09-16 00:26:37', '2026-09-16 01:44:09'),
('sess_14cecca6ef824bf4b7db9065acab8480', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.191.60.164', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.145 Mobile/15E148 Safari/604.1', 'mobile', 'iOS', 'Chrome', 0, '2026-09-19 19:18:56', '2026-09-19 23:36:17', '2026-09-19 14:36:17', '2026-09-19 19:18:56'),
('sess_14f9a5cf77c04419bcd1cb9a6c546b75', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.57.227', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-16 01:51:42', '2026-09-16 10:50:51', '2026-09-16 01:50:51', '2026-09-16 01:51:42'),
('sess_18658fe032a24cc09a5be328b409ec50', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-28 00:13:35', '2026-09-28 05:34:26', '2026-09-27 23:34:25', '2026-09-28 00:13:35'),
('sess_19c5136a60364e37b294ea4041ce369e', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-24 19:35:22', '2026-09-25 00:17:01', '2026-09-24 18:17:01', '2026-09-24 19:35:22'),
('sess_1bb1d085ee91499593ad4fd7968c36ff', 'USR-204adf5d', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 0, '2026-09-18 12:53:57', '2026-09-18 21:53:44', '2026-09-18 12:53:43', '2026-09-18 12:53:57'),
('sess_1cff308c8dbd4f6fafebf79fe18a2b4c', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.152.237', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 1, '2026-09-15 17:07:50', '2026-09-16 01:39:43', '2026-09-15 16:39:43', '2026-09-16 01:44:09'),
('sess_1ecbf17676c14e9880f75cc6fb0ce309', 'USR-6b974442', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 1, '2026-09-15 12:19:49', '2026-09-15 21:16:14', '2026-09-15 12:16:14', '2026-09-16 14:26:27'),
('sess_21c4a33e043c4cbfb040aede9da57854', 'USR-6b974442', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 0, '2026-09-18 17:51:18', '2026-09-18 21:37:50', '2026-09-18 12:37:50', '2026-09-18 17:51:18'),
('sess_21f618bc47c9474f8cab59db8a990cd4', 'USR-6b974442', '196.189.56.121', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-16 12:20:34', '2026-09-16 21:20:22', '2026-09-16 12:20:22', '2026-09-16 14:26:27'),
('sess_229e2a5d29de475c8c8a7156d24ec954', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.145.192', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.145 Mobile/15E148 Safari/604.1', 'mobile', 'iOS', 'Chrome', 0, '2026-09-19 00:25:19', '2026-09-19 06:00:20', '2026-09-18 21:00:20', '2026-09-19 00:25:19'),
('sess_22a5463786be4eb09200964f3f551919', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.188.228.18', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-23 18:28:31', '2026-09-24 01:03:22', '2026-09-23 16:03:21', '2026-09-23 18:28:31'),
('sess_22b9ebd66e6d4ab3b178b05172e89839', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', 'node', 'desktop', 'Unknown OS', 'Web Browser', 1, '2026-09-15 16:06:02', '2026-09-15 22:06:02', '2026-09-15 16:06:02', '2026-09-16 01:44:09'),
('sess_24cd16621a9843f0b1101c26060ef2e9', 'USR-6b974442', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 0, '2026-09-16 14:34:50', '2026-09-16 23:32:22', '2026-09-16 14:32:22', '2026-09-16 14:34:50'),
('sess_24db8ec6f89c4324a3ea51c3661acba1', 'USR-0ef480d2', '196.189.88.16', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 0, '2026-09-23 13:31:02', '2026-09-23 22:17:39', '2026-09-23 13:17:38', '2026-09-23 13:31:02'),
('sess_255cddde22de4976ba91df11b1e2d7d4', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.152.243', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-19 14:26:17', '2026-09-19 23:22:10', '2026-09-19 14:22:09', '2026-09-19 14:27:23'),
('sess_297ba46a0bca47b495f8a9a19dfd856f', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.56.121', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-16 14:25:18', '2026-09-16 21:24:43', '2026-09-16 12:24:43', '2026-09-16 14:36:08'),
('sess_2a558ad3e34b4f109ae5963df4ebe0db', 'USR-204adf5d', '196.189.69.56', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36', 'mobile', 'Android', 'Chrome', 0, '2026-09-16 15:03:27', '2026-09-17 00:01:33', '2026-09-16 15:01:32', '2026-09-16 15:03:27'),
('sess_2de1457e67b245218bcb2b6ea82f312c', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.152.243', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-19 15:04:38', '2026-09-19 23:27:12', '2026-09-19 14:27:11', '2026-09-19 15:04:38'),
('sess_2f69aaff96b6476daabf3578110e1dc4', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.56.121', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-16 14:27:40', '2026-09-16 23:26:35', '2026-09-16 14:26:34', '2026-09-16 14:36:11'),
('sess_2f9f44f999b64d8fb3f65e1c6bd6eab2', 'USR-40a189d8', '212.83.137.177', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 0, '2026-09-21 18:41:30', '2026-09-22 01:05:18', '2026-09-21 16:05:18', '2026-09-21 18:41:30'),
('sess_30f337ea6e954f818f7751f66ac3399d', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-28 13:36:33', '2026-09-28 19:13:15', '2026-09-28 13:13:15', '2026-09-28 13:36:33'),
('sess_319895622ad94da9ab4d65d1df4b3eff', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-27 14:00:28', '2026-09-27 19:58:44', '2026-09-27 13:58:44', '2026-09-27 14:00:28'),
('sess_351d83b667b645ffbde7ceeb49e18ef5', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', '', 'desktop', 'Unknown OS', 'Web Browser', 1, '2026-09-16 00:27:43', '2026-09-16 06:27:43', '2026-09-16 00:27:43', '2026-09-16 01:44:09'),
('sess_38d6d7afc7844999b54edf472c7dd6ad', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.188.228.38', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-15 17:28:38', '2026-09-16 02:10:26', '2026-09-15 17:10:25', '2026-09-16 01:44:09'),
('sess_3bba03afeb414cfc989c3c4f4517e155', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.56.121', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-16 14:29:50', '2026-09-16 23:29:22', '2026-09-16 14:29:22', '2026-09-16 14:36:17'),
('sess_3d6bd8701f7745519eda7d078c9d0d79', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.154.181', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/134.0.6998.99 Mobile/15E148 Safari/604.1', 'mobile', 'iOS', 'Chrome', 0, '2026-09-23 22:42:46', '2026-09-24 05:37:45', '2026-09-23 20:37:45', '2026-09-23 22:42:46'),
('sess_3dcd44510f1647cb9170ee2795f86446', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.57.132', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 1, '2026-09-20 15:46:35', '2026-09-21 00:46:36', '2026-09-20 15:46:35', '2026-09-20 15:48:05'),
('sess_43adcd77a1da47d39f460b8e1ca58de5', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 0, '2026-09-16 15:11:22', '2026-09-16 23:34:57', '2026-09-16 14:34:57', '2026-09-16 15:11:22'),
('sess_471ff91fa3dd4b798f9b54c5e94fd0da', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', 'node', 'desktop', 'Unknown OS', 'Web Browser', 1, '2026-09-15 16:05:07', '2026-09-15 22:05:07', '2026-09-15 16:05:07', '2026-09-16 01:44:09'),
('sess_47dfb70efdc04fa5801ef8af00a1b5f9', 'USR-6b974442', '196.189.56.121', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-16 14:29:14', '2026-09-16 23:28:43', '2026-09-16 14:28:42', '2026-09-16 14:34:49'),
('sess_4b514a2d68194f4f8b5ecef40efb1bdb', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.188.33.242', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-15 17:29:07', '2026-09-16 02:28:43', '2026-09-15 17:28:42', '2026-09-16 01:44:09'),
('sess_4f1338bc222a44bd852bce7d5521ca27', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.69.56', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.145 Mobile/15E148 Safari/604.1', 'mobile', 'iOS', 'Chrome', 1, '2026-09-16 14:36:55', '2026-09-16 23:36:54', '2026-09-16 14:36:54', '2026-09-16 14:37:16'),
('sess_505b74140d824a77bca81baa49dae52a', 'USR-204adf5d', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 0, '2026-09-19 13:23:07', '2026-09-19 21:21:31', '2026-09-19 12:21:30', '2026-09-19 13:23:07'),
('sess_5265018a7faa4177a5a9958036e28801', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-26 00:37:03', '2026-09-26 05:22:56', '2026-09-25 23:22:56', '2026-09-26 00:37:03'),
('sess_52851f566eea423190f888b8bc2fce48', 'USR-6b974442', '196.190.61.72', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-22 14:07:35', '2026-09-22 23:07:36', '2026-09-22 14:07:35', '2026-09-22 14:07:35'),
('sess_541cd5c7cddc4d3987d677cd6ae0e8e5', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.152.127', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-15 02:31:51', '2026-09-15 11:31:20', '2026-09-15 02:31:19', '2026-09-15 09:12:25'),
('sess_551f0b5cbf084e22ad5b5a799c702c97', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '51.158.254.164', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 0, '2026-09-23 18:52:59', '2026-09-24 03:31:49', '2026-09-23 12:32:35', '2026-09-23 18:52:59'),
('sess_5760488aab2a40f2bf3fac1e5efbbe74', 'USR-9f0d365d', '51.158.195.11', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 0, '2026-09-21 13:41:41', '2026-09-21 22:39:17', '2026-09-21 13:39:16', '2026-09-21 13:41:41'),
('sess_57adfc193e6d47ebaffa5b52e2f1d325', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.56.121', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-16 14:28:36', '2026-09-16 23:28:22', '2026-09-16 14:28:21', '2026-09-16 14:36:14'),
('sess_5c0eb4e32100499ca1c019836aae049a', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.57.132', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 1, '2026-09-20 15:23:25', '2026-09-21 00:23:25', '2026-09-20 15:23:25', '2026-09-20 15:48:14'),
('sess_5c131b842a5f48638d40fc9802d4b49e', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-28 23:46:22', '2026-09-29 03:56:50', '2026-09-28 21:56:50', '2026-09-28 23:46:22');
INSERT INTO `user_sessions` (`id`, `user_id`, `ip_address`, `user_agent`, `device_type`, `os_name`, `browser_name`, `is_revoked`, `last_active_at`, `expires_at`, `created_at`, `updated_at`) VALUES
('sess_5e6c6f5c1af84c658b9fc02817353586', 'USR-9f0d365d', '51.158.195.11', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 0, '2026-09-21 17:20:28', '2026-09-22 02:20:28', '2026-09-21 17:20:27', '2026-09-21 17:20:28'),
('sess_5fd8966b6c5d4e60809331a9cc38a072', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', 'node', 'desktop', 'Unknown OS', 'Web Browser', 1, '2026-09-15 16:09:05', '2026-09-15 22:09:05', '2026-09-15 16:09:05', '2026-09-16 01:44:09'),
('sess_618be73e62d0472383a05b483dcc974d', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.57.132', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 1, '2026-09-20 15:35:16', '2026-09-21 00:35:16', '2026-09-20 15:35:16', '2026-09-20 15:48:08'),
('sess_676386353b084984b08118fe5d214e6b', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 1, '2026-09-19 13:43:49', '2026-09-19 22:09:25', '2026-09-19 13:09:24', '2026-09-19 14:24:35'),
('sess_67e12d64e07d401f80fb65445d5f20e1', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.188.225.123', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-16 18:56:38', '2026-09-17 03:56:32', '2026-09-16 18:56:32', '2026-09-16 18:56:38'),
('sess_68d9813f227041f0b01f33bcb08c899f', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.144.62', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-17 20:12:47', '2026-09-18 04:11:32', '2026-09-17 19:11:31', '2026-09-17 20:12:47'),
('sess_730deb08f38f4de8844bc57f54091b96', 'USR-6b974442', '196.189.56.121', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-16 14:28:08', '2026-09-16 23:27:51', '2026-09-16 14:27:50', '2026-09-16 14:29:14'),
('sess_74dc8f6b043e4f38987a9cbda2e56719', 'USR-6b974442', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 1, '2026-09-16 12:19:42', '2026-09-16 21:19:35', '2026-09-16 12:19:34', '2026-09-16 14:26:27'),
('sess_75a6ced86811451b8697856ef5a454fc', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '212.83.137.177', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 0, '2026-09-21 20:13:17', '2026-09-22 03:42:04', '2026-09-21 18:42:03', '2026-09-21 20:13:17'),
('sess_795e8e7d1d3445ae80e41dd8bd2e9fc3', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-28 15:37:17', '2026-09-28 19:37:35', '2026-09-28 13:37:34', '2026-09-28 15:37:17'),
('sess_7b2ddb6bb3a94659b97104f6e8a914f7', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-15 17:02:12', '2026-09-15 20:56:42', '2026-09-15 14:56:42', '2026-09-16 01:44:09'),
('sess_7ea291b4cbd841468011447e1ed30de5', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.190.61.72', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-22 14:07:27', '2026-09-22 22:49:37', '2026-09-22 13:49:36', '2026-09-22 14:07:27'),
('sess_8092b3e80fc24676995f43c14c4c6f87', 'USR-6b974442', '196.189.56.121', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-16 14:26:27', '2026-09-16 23:25:53', '2026-09-16 14:25:53', '2026-09-16 14:29:14'),
('sess_83bf17084647457e9da68f85e04d415c', 'USR-6b974442', '196.189.154.93', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-18 03:40:30', '2026-09-18 12:39:39', '2026-09-18 03:39:38', '2026-09-18 03:40:30'),
('sess_83fdd80bf4c04760a8b38a1331b1984a', 'USR-6b974442', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 0, '2026-09-19 14:08:55', '2026-09-19 20:27:06', '2026-09-19 11:27:06', '2026-09-19 14:08:55'),
('sess_89deb326b49846be989bd88085d17f1a', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.191.221.153', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.145 Mobile/15E148 Safari/604.1', 'mobile', 'iOS', 'Chrome', 1, '2026-09-15 16:08:55', '2026-09-16 01:01:27', '2026-09-15 16:01:27', '2026-09-15 17:02:52'),
('sess_8c49d11667414b248540f609bd57d6cd', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.152.127', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-15 10:49:04', '2026-09-15 18:12:05', '2026-09-15 09:12:04', '2026-09-16 01:44:09'),
('sess_8cadfc4e1c3c42d49fee4738a7ed5ccb', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '51.158.254.160', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 0, '2026-09-21 15:48:16', '2026-09-21 22:37:00', '2026-09-21 13:37:00', '2026-09-21 15:48:16'),
('sess_90067546b33444239590f4185b16de18', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.152.243', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-19 14:21:57', '2026-09-19 23:11:33', '2026-09-19 14:11:33', '2026-09-19 14:24:21'),
('sess_903159ec211a45c9bc4681335eb2da0f', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.57.132', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.145 Mobile/15E148 Safari/604.1', 'mobile', 'iOS', 'Chrome', 0, '2026-09-20 15:51:39', '2026-09-21 00:25:07', '2026-09-20 15:25:06', '2026-09-20 15:51:39'),
('sess_911e2a915c7b4a6ab29fabef5c9d24b3', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.154.93', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-18 03:39:27', '2026-09-18 12:37:20', '2026-09-18 03:37:19', '2026-09-18 03:39:27'),
('sess_957f584da7c546eea22eff63be613aec', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.157.53', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.145 Mobile/15E148 Safari/604.1', 'mobile', 'iOS', 'Chrome', 0, '2026-09-19 20:59:07', '2026-09-20 05:55:16', '2026-09-19 20:55:16', '2026-09-19 20:59:07'),
('sess_977c6b95a55e4c51b7eff48e1776e603', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.152.127', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-15 02:31:08', '2026-09-15 11:26:49', '2026-09-15 02:26:48', '2026-09-15 09:12:27'),
('sess_98f3a8051f3f4792af313817d8b76a79', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.57.227', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-15 21:37:41', '2026-09-16 06:37:42', '2026-09-15 21:37:41', '2026-09-16 01:44:09'),
('sess_993b34e314e144909d94ae42575327c1', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', '', 'desktop', 'Unknown OS', 'Web Browser', 1, '2026-09-16 00:27:43', '2026-09-16 06:27:43', '2026-09-16 00:27:43', '2026-09-16 01:44:09'),
('sess_9975ad4e053242318b589e3ecc18b822', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-24 01:25:18', '2026-09-24 06:17:06', '2026-09-24 00:17:05', '2026-09-24 01:25:18'),
('sess_9dbd07e87ba04b218d3d22c870b19565', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 0, '2026-09-18 15:50:06', '2026-09-18 20:55:18', '2026-09-18 11:55:18', '2026-09-18 15:50:06'),
('sess_9ee384e422eb4896b4c336c5674c97b9', 'USR-6b974442', '196.189.152.243', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-19 14:27:01', '2026-09-19 23:26:43', '2026-09-19 14:26:42', '2026-09-19 14:27:01'),
('sess_a38df5900b744852903da8a71a5e2f0d', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.152.243', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/134.0.6998.99 Mobile/15E148 Safari/604.1', 'mobile', 'iOS', 'Chrome', 0, '2026-09-19 14:29:29', '2026-09-19 23:29:16', '2026-09-19 14:29:15', '2026-09-19 14:29:29'),
('sess_a3b665463cf847cf80ac84f3c87dd1a8', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.152.127', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-15 02:36:41', '2026-09-15 11:33:27', '2026-09-15 02:33:27', '2026-09-15 09:12:21'),
('sess_a4e87af7740e4094bb2c2b37daa5c6d2', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.154.181', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-23 20:47:13', '2026-09-24 05:46:57', '2026-09-23 20:46:56', '2026-09-23 20:47:13'),
('sess_a73c90de109040a29381be3d0eaabebe', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-15 02:13:21', '2026-09-15 07:40:55', '2026-09-15 01:40:55', '2026-09-16 01:44:09'),
('sess_a891927d942d4f5580540e8b874639b0', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.154.181', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-23 14:03:18', '2026-09-23 22:58:35', '2026-09-23 13:58:34', '2026-09-23 14:03:18'),
('sess_aa2533311a9046039b310d5839222819', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.152.243', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 1, '2026-09-19 14:34:40', '2026-09-19 23:30:31', '2026-09-19 14:30:30', '2026-09-19 14:43:34'),
('sess_aa79f0ea5ad246f5a025a0899c6c0fe3', 'USR-6b974442', '51.158.254.168', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 0, '2026-09-21 13:51:57', '2026-09-21 22:45:54', '2026-09-21 13:45:53', '2026-09-21 13:51:57'),
('sess_afaa5d5483314701be15d552023495ac', 'USR-7fb220d5', '127.0.0.1', '', 'desktop', 'Unknown OS', 'Web Browser', 0, '2026-09-16 00:27:43', '2026-09-16 06:27:44', '2026-09-16 00:27:43', '2026-09-16 00:27:43'),
('sess_b178cf1dae8f4403986aa5a63855df43', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.188.226.54', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-21 03:02:20', '2026-09-21 09:47:37', '2026-09-21 00:47:36', '2026-09-21 03:02:20'),
('sess_b23c3a244ce34bfeb70540c664850684', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.154.148', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-21 19:15:45', '2026-09-21 23:07:09', '2026-09-21 14:07:08', '2026-09-21 19:15:45'),
('sess_b35f06e461fa4cfd97430f1713c0dfbe', 'USR-9f0d365d', '51.158.195.11', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 0, '2026-09-21 17:20:17', '2026-09-21 22:42:00', '2026-09-21 13:42:00', '2026-09-21 17:20:17'),
('sess_b4656c8715564c89b00810a529675749', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.190.61.72', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-22 14:09:07', '2026-09-22 23:07:47', '2026-09-22 14:07:47', '2026-09-22 14:09:07'),
('sess_b46780b394e74cd1baf15cadb1d4ca11', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 0, '2026-09-16 20:04:25', '2026-09-17 05:03:14', '2026-09-16 20:03:13', '2026-09-16 20:04:25'),
('sess_b90f25681a7b4f999607435d7b34dc6e', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-15 19:55:32', '2026-09-15 23:02:24', '2026-09-15 17:02:23', '2026-09-16 01:44:09'),
('sess_baad9865fd9046b39372d1016a358c38', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.188.225.123', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36', 'mobile', 'Android', 'Chrome', 0, '2026-09-16 17:05:50', '2026-09-17 02:04:52', '2026-09-16 17:04:51', '2026-09-16 17:05:50'),
('sess_bf8e2fdd80e44ea8a3aae73a2d73a8d2', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 1, '2026-09-19 12:26:42', '2026-09-19 20:58:46', '2026-09-19 11:58:46', '2026-09-19 14:24:37'),
('sess_c124b2d9b6f9468682614805b9c99339', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.57.132', 'Mozilla/5.0 (Windows NT 6.2; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36 Edg/109.0.1518.140', 'desktop', 'Windows', 'Edge', 1, '2026-09-20 15:49:22', '2026-09-21 00:49:22', '2026-09-20 15:49:22', '2026-09-20 15:50:27'),
('sess_c3cd2795485541b08d31d595f6b64afc', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', '', 'desktop', 'Unknown OS', 'Web Browser', 1, '2026-09-16 00:27:47', '2026-09-16 06:27:48', '2026-09-16 00:27:47', '2026-09-16 01:44:09'),
('sess_c4f1caf5b04d4bb8bf48bae6b4b80702', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.152.127', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-15 15:30:11', '2026-09-16 00:26:54', '2026-09-15 15:26:54', '2026-09-16 01:44:09'),
('sess_c850c68616e34ee2b5c6119b97ff9e3a', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.144.67', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/134.0.6998.99 Mobile/15E148 Safari/604.1', 'mobile', 'iOS', 'Chrome', 0, '2026-09-19 14:44:13', '2026-09-19 23:33:57', '2026-09-19 14:33:57', '2026-09-19 14:44:13'),
('sess_c96ed95dcbfa4816a5913666f48b4396', 'USR-6b974442', '196.190.61.72', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-22 14:07:42', '2026-09-22 23:07:42', '2026-09-22 14:07:42', '2026-09-22 14:07:42'),
('sess_cb1916e88f4141e68ec097d732d8b179', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.152.243', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-19 13:41:20', '2026-09-19 21:35:53', '2026-09-19 12:35:52', '2026-09-19 14:24:26');
INSERT INTO `user_sessions` (`id`, `user_id`, `ip_address`, `user_agent`, `device_type`, `os_name`, `browser_name`, `is_revoked`, `last_active_at`, `expires_at`, `created_at`, `updated_at`) VALUES
('sess_cd192d552ad84b9aa6ed8123fd0e8612', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '104.28.220.16', 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_3_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/152.0.7977.64 Mobile/15E148 Safari/604.1', 'mobile', 'iOS', 'Chrome', 1, '2026-09-18 13:33:50', '2026-09-18 22:04:05', '2026-09-18 13:04:05', '2026-09-18 21:06:13'),
('sess_cd3d5f86c5ff4b56bdb26781286967ac', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', '', 'desktop', 'Unknown OS', 'Web Browser', 1, '2026-09-16 00:27:43', '2026-09-16 06:27:43', '2026-09-16 00:27:43', '2026-09-16 01:44:09'),
('sess_cd7443eeec364bb3acf2dec7e7a6343a', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 1, '2026-09-16 14:31:55', '2026-09-16 21:08:17', '2026-09-16 12:08:17', '2026-09-16 14:36:21'),
('sess_cee62f69f0004b58ae84434416e76e96', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.57.132', 'Mozilla/5.0 (Windows NT 6.2; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36 Edg/109.0.1518.140', 'desktop', 'Windows', 'Edge', 1, '2026-09-20 15:50:15', '2026-09-21 00:50:15', '2026-09-20 15:50:15', '2026-09-20 15:50:34'),
('sess_cf315307f6b34a1ab4b88db6e0cf37bc', 'USR-451607d8', '196.190.61.72', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-22 14:10:19', '2026-09-22 23:10:16', '2026-09-22 14:10:16', '2026-09-22 14:10:19'),
('sess_cf87bcf0b79d415d8405b23c70e5f209', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', 'node', 'desktop', 'Unknown OS', 'Web Browser', 1, '2026-09-15 16:06:15', '2026-09-15 22:06:16', '2026-09-15 16:06:15', '2026-09-16 01:44:09'),
('sess_d1db1d914b554215aaf5587b1f198a18', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '51.158.195.13', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 0, '2026-09-23 19:03:32', '2026-09-24 03:55:52', '2026-09-23 18:55:52', '2026-09-23 19:03:32'),
('sess_d2093910e72c41fbb52488177699dc4b', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.190.62.136', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36', 'mobile', 'Android', 'Chrome', 1, '2026-09-15 12:57:09', '2026-09-15 21:55:29', '2026-09-15 12:55:28', '2026-09-15 16:03:14'),
('sess_d5d457b73ba64ac88661bf31fb89a3fe', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.69.56', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1', 'mobile', 'iOS', 'Safari', 0, '2026-09-16 15:35:46', '2026-09-16 23:52:43', '2026-09-16 14:52:43', '2026-09-16 15:35:46'),
('sess_d663143d80ed40b5a8c346f0f114d44a', 'USR-204adf5d', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 0, '2026-09-16 20:02:53', '2026-09-17 05:02:01', '2026-09-16 20:02:01', '2026-09-16 20:02:53'),
('sess_ddbc73928a234423ba8849e2ac191f3f', 'USR-40a189d8', '212.83.137.177', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0', 'desktop', 'Windows 10/11', 'Edge', 0, '2026-09-21 16:05:14', '2026-09-22 00:49:16', '2026-09-21 15:49:15', '2026-09-21 16:05:14'),
('sess_e1fc90d648774dc79cb8fb15bc49e329', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.57.132', 'Mozilla/5.0 (Windows NT 6.2; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36 Edg/109.0.1518.140', 'desktop', 'Windows', 'Edge', 1, '2026-09-20 15:24:25', '2026-09-21 00:24:26', '2026-09-20 15:24:25', '2026-09-20 15:48:12'),
('sess_e2cbe94ae5f14ddbb363c0a66b713d85', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.190.61.72', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-22 15:22:47', '2026-09-22 23:11:02', '2026-09-22 14:11:01', '2026-09-22 15:22:47'),
('sess_e5363d1fab2348ada04a5e8546c0522f', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.88.16', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 1, '2026-09-23 13:51:25', '2026-09-23 22:31:37', '2026-09-23 13:31:36', '2026-09-23 16:08:09'),
('sess_e5df8de1d7184000bef107aa3c72596c', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', '', 'desktop', 'Unknown OS', 'Web Browser', 1, '2026-09-16 00:27:43', '2026-09-16 06:27:43', '2026-09-16 00:27:43', '2026-09-16 01:44:09'),
('sess_e6c68174c1454c17a0abb7d3928d41ff', 'USR-40a189d8', '196.189.88.16', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 0, '2026-09-23 18:54:02', '2026-09-24 03:53:29', '2026-09-23 18:53:29', '2026-09-23 18:54:02'),
('sess_e7085532b1aa4eaeac7d0e4fb0120a77', 'USR-451607d8', '196.190.61.72', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-22 14:09:56', '2026-09-22 23:09:13', '2026-09-22 14:09:13', '2026-09-22 14:09:56'),
('sess_eb433ef329da4d4c9e544c249031413a', 'USR-0ef480d2', '196.189.88.16', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 0, '2026-09-23 19:29:53', '2026-09-23 22:51:31', '2026-09-23 13:51:30', '2026-09-23 19:29:53'),
('sess_ec913bb344c348108b9bb07e2206a741', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.152.243', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 1, '2026-09-19 14:35:41', '2026-09-19 23:31:49', '2026-09-19 14:31:49', '2026-09-19 14:43:26'),
('sess_ed54709af50a42919c4d49769b067661', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.188.228.38', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-15 22:06:37', '2026-09-16 06:45:58', '2026-09-15 21:45:58', '2026-09-16 01:44:09'),
('sess_eeb0a3c6617c4004b19c968ddbdc8700', 'USR-6b974442', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 1, '2026-09-16 12:19:17', '2026-09-16 21:18:02', '2026-09-16 12:18:02', '2026-09-16 14:26:27'),
('sess_efedbfa6213640bd9428a29136081aae', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 1, '2026-09-16 12:12:44', '2026-09-16 21:11:19', '2026-09-16 12:11:18', '2026-09-16 14:36:02'),
('sess_f32bc8327098434692ab7fdbb8167bb7', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.56.121', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-16 12:20:09', '2026-09-16 21:08:36', '2026-09-16 12:08:35', '2026-09-16 14:36:05'),
('sess_f37c2e17a1f648b1b7983079b704d96d', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '127.0.0.1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-16 01:44:09', '2026-09-16 05:14:50', '2026-09-15 23:14:49', '2026-09-16 01:51:34'),
('sess_f4aa076844bf41c5add2acf3459730dc', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.189.57.132', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 1, '2026-09-20 15:22:51', '2026-09-21 00:22:52', '2026-09-20 15:22:51', '2026-09-20 15:47:55'),
('sess_f676ccdf781c48d8955026e676b0c32e', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '196.188.225.123', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 0, '2026-09-16 18:56:13', '2026-09-17 03:34:58', '2026-09-16 18:34:58', '2026-09-16 18:56:13'),
('sess_fc850ddc31674faaa183826025093e3e', 'USR-6b974442', '196.189.69.56', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'desktop', 'Windows 10/11', 'Chrome', 1, '2026-09-16 12:10:50', '2026-09-16 21:07:07', '2026-09-16 12:07:07', '2026-09-16 14:26:27'),
('sess_fd6c0d7c9634429288fecbee05ad31fe', '390993a5-1618-4b15-b8a1-5cd13a0b2bde', '104.28.220.16', 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_3_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/152.0.7977.64 Mobile/15E148 Safari/604.1', 'mobile', 'iOS', 'Chrome', 0, '2026-09-19 13:48:05', '2026-09-19 22:47:23', '2026-09-19 13:47:22', '2026-09-19 13:48:05'),
('sess_feb9d2762acb4d9cbbbb4c458e02d2b1', 'USR-6b974442', '196.189.56.121', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'desktop', 'macOS', 'Chrome', 1, '2026-09-16 12:24:36', '2026-09-16 21:20:49', '2026-09-16 12:20:48', '2026-09-16 14:26:27'),
('sess_ff8c01e6fe8444f6ba9d6f63cdbe9b6d', 'USR-6b974442', '127.0.0.1', '', 'desktop', 'Unknown OS', 'Web Browser', 1, '2026-09-16 00:27:43', '2026-09-16 06:27:44', '2026-09-16 00:27:43', '2026-09-16 14:26:27');

-- ----------------------------------------------------------------------------
-- Table structure for table `users`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `roles` json DEFAULT NULL,
  `role` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'viewer',
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `fullname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `employee_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `warehouse_ids` json DEFAULT NULL,
  `warehouse_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `first_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `idx_users_created_at` (`created_at` DESC),
  KEY `idx_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `users` (9 rows)
INSERT INTO `users` (`id`, `username`, `password_hash`, `roles`, `role`, `status`, `fullname`, `employee_id`, `warehouse_ids`, `warehouse_id`, `first_name`, `last_name`, `is_active`, `created_at`, `updated_at`) VALUES
('390993a5-1618-4b15-b8a1-5cd13a0b2bde', 'admin', '$2b$10$Roxf5M9hchWaTJUXkn62QeUAAwDzJijeuzcSGRBIlmX9zpUFyu2R2', '["superadmin"]', 'viewer', 'active', 'Habtom', NULL, '[]', NULL, NULL, NULL, 1, '2026-08-13 11:04:59.000', '2026-09-01 09:18:59.000'),
('USR-0ef480d2', 'YADENE', '$2b$10$A5QkglIt5wLBF6lBJJSNmeb3qvH.Xleuhyoi4xAN4MgCk50mirq2S', '["finance_manager"]', 'finance_manager', 'active', 'YADENE TEMSGEN', NULL, '[]', NULL, 'YADENE', 'TEMSGEN', 1, '2026-09-21 15:45:33.146', '2026-09-21 15:45:33.146'),
('USR-204adf5d', 'sewa', '$2b$10$qpL58ZuPHwxDg1juz9T9X.LVmccF1s1NeouzPVEA8.E5x7oFfZ7Iu', '["inventory_admin"]', 'inventory_admin', 'active', 'sewagegnew getachew', NULL, '["WH3-VET-LEBU","WH2-VET-ALEM"]', 'WH3-VET-LEBU', 'sewagegnew', 'getachew', 1, '2026-09-16 15:00:10.192', '2026-09-16 15:00:10.192'),
('USR-40a189d8', 'Dejazmach', '$2b$10$DSzlsHyv2778H1HJqPOJ5.g6OMpUIe13ibmn8bKLbII8OlsdO4vKu', '["finance_manager","inventory_admin","hr_manager"]', 'finance_manager', 'active', 'DEJAZMACH GEBEYEHU', NULL, '["WH1-AGRI-EXP"]', 'WH1-AGRI-EXP', 'DEJAZMACH', 'GEBEYEHU', 1, '2026-09-16 14:56:00.977', '2026-09-21 19:03:15.516'),
('USR-451607d8', 'capt', '$2b$10$ANGmLUmlaiHkgdz8No1EsupL2Z96htTsyJ4km.TSjOXiwOee0tzXC', '["inventory_admin"]', 'inventory_admin', 'active', 'noah tesf', NULL, '[]', NULL, 'noah', 'tesf', 1, '2026-09-22 14:09:02.353', '2026-09-22 14:09:51.000'),
('USR-6b974442', 'selam', '$2b$10$CKG9Ca1qqu8X4fmmypSlsOVR./3p18PYkojWU0iBx5jibSRen9UMS', '["sales_manager"]', 'sales_manager', 'active', 'selam shikur', NULL, '["WH1-AGRI-EXP","WH2-VET-ALEM","WH3-VET-LEBU"]', 'WH1-AGRI-EXP', 'selam', 'shikur', 1, '2026-09-14 07:13:37.000', '2026-09-22 14:08:06.685'),
('USR-7fb220d5', 'sheleme', '$2b$10$P0mP8KKR0lFwdO.PtooxYOljMXNjCiDnXkF46lObbL7zl7iI5OVy2', '["inventory_admin"]', 'inventory_admin', 'active', 'sheleme megrsa', NULL, '["WH1-AGRI-EXP"]', 'WH1-AGRI-EXP', 'sheleme', 'megrsa', 1, '2026-09-14 06:51:34.000', '2026-09-14 06:56:23.000'),
('USR-9f0d365d', 'hilena', '$2b$10$X4nsC6z0Z/PQyl.QeGOk4eKOXG3K8ix7fBUY5GlpFfo/XkZ/0a/4S', '["hkc_docs_manager"]', 'hkc_docs_manager', 'active', 'Hilena abera', NULL, '[]', NULL, 'Hilena', 'abera', 1, '2026-09-21 13:38:24.342', '2026-09-21 13:41:24.000'),
('USR-SUPERADMIN-001', 'superadmin', '$2b$10$izrXeHIx6wV56uYKzIueYeEojkRCctdIRaDQHXvfl4PygHa5.vBum', '["superadmin"]', 'superadmin', 'active', 'Super Administrator', NULL, NULL, NULL, 'Super', 'Admin', 1, '2026-09-21 16:05:13.000', '2026-09-21 16:05:13.000');

-- ----------------------------------------------------------------------------
-- Table structure for table `vehicles`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `vehicles`;
CREATE TABLE `vehicles` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_vehicles_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No data to dump for table `vehicles`

-- ----------------------------------------------------------------------------
-- Table structure for table `warehouses`
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `warehouses`;
CREATE TABLE `warehouses` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `warehouse_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PHARMA_WH',
  `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `manager` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `specialization` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_markets` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Active',
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_warehouses_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `warehouses` (3 rows)
INSERT INTO `warehouses` (`id`, `name`, `code`, `location`, `warehouse_type`, `type`, `manager`, `specialization`, `target_markets`, `status`, `created_at`, `updated_at`) VALUES
('WH1', 'WH1 - Ethiopia Agricultural Export Hub', 'WH1-AGRI-EXP', 'Modjo Export Terminal, Ethiopia', 'EXPORT_WH', 'Export Hub', 'sheleme megrsa', 'Agricultural Commodities', NULL, 'Active', '2026-07-25 16:58:16.207', '2026-09-13 16:03:06.000'),
('WH2', 'WH2 - Veterinary Import Hub (alem bank)IND', 'WH2-VET-ALEM', 'Alem Bank Hub, Addis Ababa, Ethiopia', 'PHARMA_WH', 'Pharmaceutical Hub', 'sewagegnew getachew', 'Veterinary Drugs & Biologicals', NULL, 'Active', '2026-07-25 16:58:16.796', '2026-09-13 13:03:06.000'),
('WH3', 'WH3 - Veterinary Import Hub (LEBU)CHINA', 'WH3-VET-LEBU', 'Lebu Commercial Center, Addis Ababa, Ethiopia', 'PHARMA_WH', 'Pharmaceutical Hub', 'sewagegnew getachew', 'Veterinary Supplies & Consumables', NULL, 'Active', '2026-07-25 16:58:17.428', '2026-09-13 13:03:06.000');

-- ============================================================================
-- End of Migration Dump
-- ============================================================================
SET FOREIGN_KEY_CHECKS = 1;
