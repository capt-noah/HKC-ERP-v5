-- MySQL dump 10.13  Distrib 26.7.0, for macos15.7 (arm64)
--
-- Host: 127.0.0.1    Database: hkc_trading
-- ------------------------------------------------------
-- Server version	26.7.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `attendance_records`
--

DROP TABLE IF EXISTS `attendance_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_records` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_attendance_records_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_records`
--

LOCK TABLES `attendance_records` WRITE;
/*!40000 ALTER TABLE `attendance_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chart_of_accounts`
--

DROP TABLE IF EXISTS `chart_of_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chart_of_accounts` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json DEFAULT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `peachtree_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parent_account_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_group` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_chart_of_accounts_created_at` (`created_at` DESC),
  KEY `idx_coa_code` (`code`),
  KEY `idx_coa_account_type` (`account_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chart_of_accounts`
--

LOCK TABLES `chart_of_accounts` WRITE;
/*!40000 ALTER TABLE `chart_of_accounts` DISABLE KEYS */;
INSERT INTO `chart_of_accounts` VALUES ('1000','{\"id\": \"1000\", \"code\": \"1000\", \"name\": \"CASH\", \"is_group\": true, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Cash\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.660','1000','CASH','Asset','Cash',NULL,1,1),('1000-01-01','{\"id\": \"1000-01-01\", \"code\": \"1000-01-01\", \"name\": \"PETTY CASH-HEAD OFFICE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Cash\", \"parent_account_id\": \"1000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.665','1000-01-01','PETTY CASH-HEAD OFFICE','Asset','Cash','1000',0,1),('1000-02-10','{\"id\": \"1000-02-10\", \"code\": \"1000-02-10\", \"name\": \"ABAY_TAB_AC_1722015651591011\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Cash\", \"parent_account_id\": \"1000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.666','1000-02-10','ABAY_TAB_AC_1722015651591011','Asset','Cash','1000',0,1),('1000-02-13','{\"id\": \"1000-02-13\", \"code\": \"1000-02-13\", \"name\": \"AIB_GFB_AC_01304807538500\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Cash\", \"parent_account_id\": \"1000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.666','1000-02-13','AIB_GFB_AC_01304807538500','Asset','Cash','1000',0,1),('1000-02-17','{\"id\": \"1000-02-17\", \"code\": \"1000-02-17\", \"name\": \"BOA_RDB_35292853\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Cash\", \"parent_account_id\": \"1000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.667','1000-02-17','BOA_RDB_35292853','Asset','Cash','1000',0,1),('1000-02-20','{\"id\": \"1000-02-20\", \"code\": \"1000-02-20\", \"name\": \"OIB_DRB_1074/3834909/001/3001/\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Cash\", \"parent_account_id\": \"1000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.667','1000-02-20','OIB_DRB_1074/3834909/001/3001/','Asset','Cash','1000',0,1),('1000-02-21','{\"id\": \"1000-02-21\", \"code\": \"1000-02-21\", \"name\": \"BOA_FIB_40467351/104878358\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Cash\", \"parent_account_id\": \"1000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.668','1000-02-21','BOA_FIB_40467351/104878358','Asset','Cash','1000',0,1),('1000-02-26','{\"id\": \"1000-02-26\", \"code\": \"1000-02-26\", \"name\": \"CBE_ECB_AC_1000465135224\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Cash\", \"parent_account_id\": \"1000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.668','1000-02-26','CBE_ECB_AC_1000465135224','Asset','Cash','1000',0,1),('1000-02-29','{\"id\": \"1000-02-29\", \"code\": \"1000-02-29\", \"name\": \"UNB_RDB_ECX_1737116287486015\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Cash\", \"parent_account_id\": \"1000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.669','1000-02-29','UNB_RDB_ECX_1737116287486015','Asset','Cash','1000',0,1),('1000-02-31','{\"id\": \"1000-02-31\", \"code\": \"1000-02-31\", \"name\": \"UNB_RDB_ECX_1737116287486015 (Sec)\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Cash\", \"parent_account_id\": \"1000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.669','1000-02-31','UNB_RDB_ECX_1737116287486015 (Sec)','Asset','Cash','1000',0,1),('1000-02-33','{\"id\": \"1000-02-33\", \"code\": \"1000-02-33\", \"name\": \"CBO_CATB_AC_1059900010301\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Cash\", \"parent_account_id\": \"1000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.670','1000-02-33','CBO_CATB_AC_1059900010301','Asset','Cash','1000',0,1),('1000-02-41','{\"id\": \"1000-02-41\", \"code\": \"1000-02-41\", \"name\": \"AHADU\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Cash\", \"parent_account_id\": \"1000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.671','1000-02-41','AHADU','Asset','Cash','1000',0,1),('1100-03','{\"id\": \"1100-03\", \"code\": \"1100-03\", \"name\": \"PURCHASE ADVANCE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Accounts Receivable\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.672','1100-03','PURCHASE ADVANCE','Asset','Accounts Receivable',NULL,0,1),('1101-03','{\"id\": \"1101-03\", \"code\": \"1101-03\", \"name\": \"NIGUSE ABERA\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Accounts Receivable\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.673','1101-03','NIGUSE ABERA','Asset','Accounts Receivable',NULL,0,1),('1101-04','{\"id\": \"1101-04\", \"code\": \"1101-04\", \"name\": \"LIYEW MENGISTE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Accounts Receivable\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.674','1101-04','LIYEW MENGISTE','Asset','Accounts Receivable',NULL,0,1),('1200-03','{\"id\": \"1200-03\", \"code\": \"1200-03\", \"name\": \"PRE-PAIED INSURANCE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Accounts Receivable\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.674','1200-03','PRE-PAIED INSURANCE','Asset','Accounts Receivable',NULL,0,1),('1200-06','{\"id\": \"1200-06\", \"code\": \"1200-06\", \"name\": \"ESL CONTAINER DEPOSIT\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Accounts Receivable\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.676','1200-06','ESL CONTAINER DEPOSIT','Asset','Accounts Receivable',NULL,0,1),('1300-03','{\"id\": \"1300-03\", \"code\": \"1300-03\", \"name\": \"VET MEDICEN SALES RECIVABLE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Accounts Receivable\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.677','1300-03','VET MEDICEN SALES RECIVABLE','Asset','Accounts Receivable',NULL,0,1),('1300-08','{\"id\": \"1300-08\", \"code\": \"1300-08\", \"name\": \"SUNDARY RECEIVABLE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Accounts Receivable\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.677','1300-08','SUNDARY RECEIVABLE','Asset','Accounts Receivable',NULL,0,1),('1310','{\"id\": \"1310\", \"code\": \"1310\", \"name\": \"OWNER RECEIVABLE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Accounts Receivable\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.678','1310','OWNER RECEIVABLE','Asset','Accounts Receivable',NULL,0,1),('1320-06-01','{\"id\": \"1320-06-01\", \"code\": \"1320-06-01\", \"name\": \"WITHOLD TAX RECIVABLE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Accounts Receivable\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.679','1320-06-01','WITHOLD TAX RECIVABLE','Asset','Accounts Receivable',NULL,0,1),('1320-06-02','{\"id\": \"1320-06-02\", \"code\": \"1320-06-02\", \"name\": \"VAT RECIVABLE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Accounts Receivable\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.679','1320-06-02','VAT RECIVABLE','Asset','Accounts Receivable',NULL,0,1),('1410-01','{\"id\": \"1410-01\", \"code\": \"1410-01\", \"name\": \"STOCK OF GREEN MUNG\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Inventory\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.680','1410-01','STOCK OF GREEN MUNG','Asset','Inventory',NULL,0,1),('1410-03','{\"id\": \"1410-03\", \"code\": \"1410-03\", \"name\": \"STOCK OF REDISH SESAME SEED\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Inventory\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.681','1410-03','STOCK OF REDISH SESAME SEED','Asset','Inventory',NULL,0,1),('1500-09','{\"id\": \"1500-09\", \"code\": \"1500-09\", \"name\": \"GIT LC- TF260852143701 $171600\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Inventory\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.681','1500-09','GIT LC- TF260852143701 $171600','Asset','Inventory',NULL,0,1),('1500-10','{\"id\": \"1500-10\", \"code\": \"1500-10\", \"name\": \"GIT LC101ILSN260920003 $299999\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Inventory\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.682','1500-10','GIT LC101ILSN260920003 $299999','Asset','Inventory',NULL,0,1),('1800-01','{\"id\": \"1800-01\", \"code\": \"1800-01\", \"name\": \"CIP (FARM LAND PREPARATION )\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"peachtree_type\": \"Other Assets\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.683','1800-01','CIP (FARM LAND PREPARATION )','Asset','Other Assets',NULL,0,1),('2000-02','{\"id\": \"2000-02\", \"code\": \"2000-02\", \"name\": \"INCOME TAX PAYABLE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Liability\", \"peachtree_type\": \"Other Current Liabilities\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.683','2000-02','INCOME TAX PAYABLE','Liability','Other Current Liabilities',NULL,0,1),('2000-03','{\"id\": \"2000-03\", \"code\": \"2000-03\", \"name\": \"PENSION TAX PAYABLE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Liability\", \"peachtree_type\": \"Other Current Liabilities\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.683','2000-03','PENSION TAX PAYABLE','Liability','Other Current Liabilities',NULL,0,1),('2000-04','{\"id\": \"2000-04\", \"code\": \"2000-04\", \"name\": \"WHT PAYABLE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Liability\", \"peachtree_type\": \"Other Current Liabilities\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.684','2000-04','WHT PAYABLE','Liability','Other Current Liabilities',NULL,0,1),('2000-05','{\"id\": \"2000-05\", \"code\": \"2000-05\", \"name\": \"VAT PAYABLE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Liability\", \"peachtree_type\": \"Other Current Liabilities\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.685','2000-05','VAT PAYABLE','Liability','Other Current Liabilities',NULL,0,1),('2100-06','{\"id\": \"2100-06\", \"code\": \"2100-06\", \"name\": \"OTHER ACCRUALS\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Liability\", \"peachtree_type\": \"Other Current Liabilities\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.685','2100-06','OTHER ACCRUALS','Liability','Other Current Liabilities',NULL,0,1),('3000','{\"id\": \"3000\", \"code\": \"3000\", \"name\": \"SHARE CAPITAL\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Equity\", \"peachtree_type\": \"Equity\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.686','3000','SHARE CAPITAL','Equity','Equity',NULL,0,1),('3200','{\"id\": \"3200\", \"code\": \"3200\", \"name\": \"RETAINED EARNINGS\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Equity\", \"peachtree_type\": \"Equity\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.686','3200','RETAINED EARNINGS','Equity','Equity',NULL,0,1),('4000-01-01','{\"id\": \"4000-01-01\", \"code\": \"4000-01-01\", \"name\": \"SALES OF VETERINARY DRUG\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Revenue\", \"peachtree_type\": \"Income\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.687','4000-01-01','SALES OF VETERINARY DRUG','Revenue','Income',NULL,0,1),('4000-03-02','{\"id\": \"4000-03-02\", \"code\": \"4000-03-02\", \"name\": \"CLEANING SERVICE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Revenue\", \"peachtree_type\": \"Income\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.688','4000-03-02','CLEANING SERVICE','Revenue','Income',NULL,0,1),('4000-03-03','{\"id\": \"4000-03-03\", \"code\": \"4000-03-03\", \"name\": \"STORAGE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Revenue\", \"peachtree_type\": \"Income\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.689','4000-03-03','STORAGE','Revenue','Income',NULL,0,1),('4200','{\"id\": \"4200\", \"code\": \"4200\", \"name\": \"OTHER INCOME\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Revenue\", \"peachtree_type\": \"Income\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.689','4200','OTHER INCOME','Revenue','Income',NULL,0,1),('6000','{\"id\": \"6000\", \"code\": \"6000\", \"name\": \"SELLING AND DISTRIBUTION\", \"is_group\": true, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Cost of Sales\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.690','6000','SELLING AND DISTRIBUTION','Expense','Cost of Sales',NULL,1,1),('6000-01','{\"id\": \"6000-01\", \"code\": \"6000-01\", \"name\": \"SALARY AND BENEFIT\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Cost of Sales\", \"parent_account_id\": \"6000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.690','6000-01','SALARY AND BENEFIT','Expense','Cost of Sales','6000',0,1),('6000-02','{\"id\": \"6000-02\", \"code\": \"6000-02\", \"name\": \"OVER TIME\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Cost of Sales\", \"parent_account_id\": \"6000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.691','6000-02','OVER TIME','Expense','Cost of Sales','6000',0,1),('6000-04','{\"id\": \"6000-04\", \"code\": \"6000-04\", \"name\": \"PACKING AND BAGING\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Cost of Sales\", \"parent_account_id\": \"6000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.692','6000-04','PACKING AND BAGING','Expense','Cost of Sales','6000',0,1),('6000-08','{\"id\": \"6000-08\", \"code\": \"6000-08\", \"name\": \"TRANSPORT COST\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Cost of Sales\", \"parent_account_id\": \"6000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.692','6000-08','TRANSPORT COST','Expense','Cost of Sales','6000',0,1),('6000-10','{\"id\": \"6000-10\", \"code\": \"6000-10\", \"name\": \"LOADING UNLOADING\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Cost of Sales\", \"parent_account_id\": \"6000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.693','6000-10','LOADING UNLOADING','Expense','Cost of Sales','6000',0,1),('6000-22','{\"id\": \"6000-22\", \"code\": \"6000-22\", \"name\": \"OTHER\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Cost of Sales\", \"parent_account_id\": \"6000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.693','6000-22','OTHER','Expense','Cost of Sales','6000',0,1),('8000','{\"id\": \"8000\", \"code\": \"8000\", \"name\": \"ADMINISTRATIVE & GENERAL EXPENSES\", \"is_group\": true, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Expenses\", \"parent_account_id\": null}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.694','8000','ADMINISTRATIVE & GENERAL EXPENSES','Expense','Expenses',NULL,1,1),('8000-01','{\"id\": \"8000-01\", \"code\": \"8000-01\", \"name\": \"SALARY AND WAGE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Expenses\", \"parent_account_id\": \"8000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.694','8000-01','SALARY AND WAGE','Expense','Expenses','8000',0,1),('8000-02','{\"id\": \"8000-02\", \"code\": \"8000-02\", \"name\": \"TRANSPORT ALLOWANCE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Expenses\", \"parent_account_id\": \"8000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.695','8000-02','TRANSPORT ALLOWANCE','Expense','Expenses','8000',0,1),('8000-06','{\"id\": \"8000-06\", \"code\": \"8000-06\", \"name\": \"PENSION CONTRIBUTION\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Expenses\", \"parent_account_id\": \"8000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.696','8000-06','PENSION CONTRIBUTION','Expense','Expenses','8000',0,1),('8000-07','{\"id\": \"8000-07\", \"code\": \"8000-07\", \"name\": \"STATIONERY, PRINTING & OFF SUP\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Expenses\", \"parent_account_id\": \"8000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.696','8000-07','STATIONERY, PRINTING & OFF SUP','Expense','Expenses','8000',0,1),('8000-08','{\"id\": \"8000-08\", \"code\": \"8000-08\", \"name\": \"OFFICE RENT\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Expenses\", \"parent_account_id\": \"8000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.697','8000-08','OFFICE RENT','Expense','Expenses','8000',0,1),('8000-09','{\"id\": \"8000-09\", \"code\": \"8000-09\", \"name\": \"TELEPHONE AND INTERNET\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Expenses\", \"parent_account_id\": \"8000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.697','8000-09','TELEPHONE AND INTERNET','Expense','Expenses','8000',0,1),('8000-16','{\"id\": \"8000-16\", \"code\": \"8000-16\", \"name\": \"INSURANCE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Expenses\", \"parent_account_id\": \"8000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.698','8000-16','INSURANCE','Expense','Expenses','8000',0,1),('8000-18','{\"id\": \"8000-18\", \"code\": \"8000-18\", \"name\": \"AUDIT FEE & PROFFESSIONAL FEE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Expenses\", \"parent_account_id\": \"8000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.698','8000-18','AUDIT FEE & PROFFESSIONAL FEE','Expense','Expenses','8000',0,1),('8000-25','{\"id\": \"8000-25\", \"code\": \"8000-25\", \"name\": \"BANK SERVICE CHARGE\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Expenses\", \"parent_account_id\": \"8000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.699','8000-25','BANK SERVICE CHARGE','Expense','Expenses','8000',0,1),('8000-28','{\"id\": \"8000-28\", \"code\": \"8000-28\", \"name\": \"PENALITY\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Expenses\", \"parent_account_id\": \"8000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.699','8000-28','PENALITY','Expense','Expenses','8000',0,1),('8000-30','{\"id\": \"8000-30\", \"code\": \"8000-30\", \"name\": \"MICELLANOUS\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"peachtree_type\": \"Expenses\", \"parent_account_id\": \"8000\"}','2026-08-29 05:49:31.205','2026-09-13 12:41:44.700','8000-30','MICELLANOUS','Expense','Expenses','8000',0,1),('ACC-1000','{\"id\": \"acc-1000\", \"code\": \"1000\", \"name\": \"Assets\", \"is_group\": true, \"is_active\": true, \"account_type\": \"Asset\", \"parent_account_id\": null}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.700','1000','Assets','Asset',NULL,NULL,1,1),('acc-1010','{\"id\": \"ACC-1010\", \"code\": \"1010\", \"name\": \"Cash & Bank Accounts\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"parent_account_id\": \"ACC-1000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.701','1010','Cash & Bank Accounts','Asset',NULL,'ACC-1000',0,1),('ACC-1200','{\"id\": \"acc-1200\", \"code\": \"1200\", \"name\": \"Accounts Receivable (AR)\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"parent_account_id\": \"ACC-1000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.701','1200','Accounts Receivable (AR)','Asset',NULL,'ACC-1000',0,1),('ACC-1410','{\"id\": \"acc-1410\", \"code\": \"1410\", \"name\": \"Stock in Hand / Inventory Asset\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"parent_account_id\": \"ACC-1000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.702','1410','Stock in Hand / Inventory Asset','Asset',NULL,'ACC-1000',0,1),('ACC-1500','{\"id\": \"acc-1500\", \"code\": \"1500\", \"name\": \"Fixed Capital Assets\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"parent_account_id\": \"ACC-1000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.702','1500','Fixed Capital Assets','Asset',NULL,'ACC-1000',0,1),('ACC-1510','{\"id\": \"ACC-1510\", \"code\": \"1510\", \"name\": \"Assets Group\", \"is_group\": true, \"is_active\": true, \"account_type\": \"Asset\", \"parent_account_id\": null}','2026-08-19 18:02:15.112','2026-09-13 12:41:44.703','1510','Assets Group','Asset',NULL,NULL,1,1),('ACC-1511','{\"id\": \"ACC-1511\", \"code\": \"1511\", \"name\": \"Abyssinia Account\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Asset\", \"parent_account_id\": \"ACC-1510\"}','2026-08-19 18:03:32.981','2026-09-13 12:41:44.703','1511','Abyssinia Account','Asset',NULL,'ACC-1510',0,1),('ACC-2000','{\"id\": \"acc-2000\", \"code\": \"2000\", \"name\": \"Liabilities\", \"is_group\": true, \"is_active\": true, \"account_type\": \"Liability\", \"parent_account_id\": null}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.704','2000','Liabilities','Liability',NULL,NULL,1,1),('ACC-2100','{\"id\": \"acc-2100\", \"code\": \"2100\", \"name\": \"Accounts Payable (AP)\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Liability\", \"parent_account_id\": \"ACC-2000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.705','2100','Accounts Payable (AP)','Liability',NULL,'ACC-2000',0,1),('ACC-2120','{\"id\": \"acc-2120\", \"code\": \"2120\", \"name\": \"Stock Received Not Billed (Clearing)\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Liability\", \"parent_account_id\": \"ACC-2000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.705','2120','Stock Received Not Billed (Clearing)','Liability',NULL,'ACC-2000',0,1),('ACC-2210','{\"id\": \"acc-2210\", \"code\": \"2210\", \"name\": \"VAT & Tax Payable\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Liability\", \"parent_account_id\": \"ACC-2000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.706','2210','VAT & Tax Payable','Liability',NULL,'ACC-2000',0,1),('ACC-2300','{\"id\": \"acc-2300\", \"code\": \"2300\", \"name\": \"Payroll Payable\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Liability\", \"parent_account_id\": \"ACC-2000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.706','2300','Payroll Payable','Liability',NULL,'ACC-2000',0,1),('ACC-3000','{\"id\": \"acc-3000\", \"code\": \"3000\", \"name\": \"Equity\", \"is_group\": true, \"is_active\": true, \"account_type\": \"Equity\", \"parent_account_id\": null}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.707','3000','Equity','Equity',NULL,NULL,1,1),('ACC-3100','{\"id\": \"acc-3100\", \"code\": \"3100\", \"name\": \"Share Capital\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Equity\", \"parent_account_id\": \"ACC-3000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.707','3100','Share Capital','Equity',NULL,'ACC-3000',0,1),('ACC-3200','{\"id\": \"acc-3200\", \"code\": \"3200\", \"name\": \"Retained Earnings\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Equity\", \"parent_account_id\": \"ACC-3000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.707','3200','Retained Earnings','Equity',NULL,'ACC-3000',0,1),('ACC-4000','{\"id\": \"acc-4000\", \"code\": \"4000\", \"name\": \"Income / Revenue\", \"is_group\": true, \"is_active\": true, \"account_type\": \"Revenue\", \"parent_account_id\": null}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.708','4000','Income / Revenue','Revenue',NULL,NULL,1,1),('ACC-4002','{\"id\": \"acc-4002\", \"code\": \"4002\", \"name\": \"Service Processing Revenue\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Revenue\", \"parent_account_id\": \"ACC-4000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.709','4002','Service Processing Revenue','Revenue',NULL,'ACC-4000',0,1),('ACC-4010','{\"id\": \"acc-4010\", \"code\": \"4010\", \"name\": \"Sales Revenue\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Revenue\", \"parent_account_id\": \"ACC-4000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.709','4010','Sales Revenue','Revenue',NULL,'ACC-4000',0,1),('ACC-4020','{\"id\": \"acc-4020\", \"code\": \"4020\", \"name\": \"Other Operating Income\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Revenue\", \"parent_account_id\": \"ACC-4000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.709','4020','Other Operating Income','Revenue',NULL,'ACC-4000',0,1),('ACC-5000','{\"id\": \"acc-5000\", \"code\": \"5000\", \"name\": \"Expenses\", \"is_group\": true, \"is_active\": true, \"account_type\": \"Expense\", \"parent_account_id\": null}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.710','5000','Expenses','Expense',NULL,NULL,1,1),('ACC-5001','{\"id\": \"acc-5001\", \"code\": \"5001\", \"name\": \"Cost of Goods Sold (COGS)\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"parent_account_id\": \"ACC-5000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.710','5001','Cost of Goods Sold (COGS)','Expense',NULL,'ACC-5000',0,1),('ACC-5010','{\"id\": \"acc-5010\", \"code\": \"5010\", \"name\": \"Salaries & Employee Wages\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"parent_account_id\": \"ACC-5000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.710','5010','Salaries & Employee Wages','Expense',NULL,'ACC-5000',0,1),('ACC-5200','{\"id\": \"acc-5200\", \"code\": \"5200\", \"name\": \"Software & SaaS Expenses\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"parent_account_id\": \"ACC-5000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.711','5200','Software & SaaS Expenses','Expense',NULL,'ACC-5000',0,1),('ACC-5300','{\"id\": \"acc-5300\", \"code\": \"5300\", \"name\": \"Research & Development\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"parent_account_id\": \"ACC-5000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.712','5300','Research & Development','Expense',NULL,'ACC-5000',0,1),('ACC-5400','{\"id\": \"acc-5400\", \"code\": \"5400\", \"name\": \"Vehicle Fleet Repairs & Maintenance\", \"is_group\": false, \"is_active\": true, \"account_type\": \"Expense\", \"parent_account_id\": \"ACC-5000\"}','2026-08-12 16:32:45.011','2026-09-13 12:41:44.712','5400','Vehicle Fleet Repairs & Maintenance','Expense',NULL,'ACC-5000',0,1);
/*!40000 ALTER TABLE `chart_of_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `company_settings`
--

DROP TABLE IF EXISTS `company_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `company_settings` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `company_settings`
--

LOCK TABLES `company_settings` WRITE;
/*!40000 ALTER TABLE `company_settings` DISABLE KEYS */;
INSERT INTO `company_settings` VALUES ('default','{\"id\": \"default\", \"address\": \"Bole Subcity, Woreda 03, Addis Ababa, Ethiopia\", \"created_at\": \"2026-07-25T07:58:11.315Z\", \"tin_number\": \"0012345678\", \"updated_at\": \"2026-09-03T06:26:23.019Z\", \"company_name\": \"HKC Trading PLC\", \"base_currency\": \"ETB\", \"contact_email\": \"info@hkctrading.com\", \"contact_phone\": \"+251 11 662 4580\", \"exchange_rates\": {\"EUR\": 63.2, \"USD\": 58.5}, \"fiscal_year_start\": \"July\", \"storage_free_days\": 30, \"auto_delivery_notes\": true, \"tax_brackets_config\": [{\"max\": 2000, \"min\": 0, \"deductible\": 0, \"ratePercent\": 0}, {\"max\": 4000, \"min\": 2001, \"deductible\": 300, \"ratePercent\": 15}, {\"max\": 7000, \"min\": 4001, \"deductible\": 500, \"ratePercent\": 20}, {\"max\": 10000, \"min\": 7001, \"deductible\": 850, \"ratePercent\": 25}, {\"max\": 14000, \"min\": 10001, \"deductible\": 1350, \"ratePercent\": 30}, {\"max\": null, \"min\": 14001, \"deductible\": 2050, \"ratePercent\": 35}], \"pension_expat_exempt\": true, \"default_payment_terms\": \"Net 30 Days\", \"default_reorder_level\": 50, \"max_storage_month_cap\": 4, \"pension_employee_rate\": 7, \"pension_employer_rate\": 11, \"prevent_negative_stock\": true, \"tax_payable_account_id\": \"2000-05\", \"default_cash_account_id\": \"1000-01-01\", \"default_cogs_account_id\": \"6000\", \"default_damage_account_id\": \"6000-22\", \"default_revenue_account_id\": \"4000-01-01\", \"payroll_expense_account_id\": \"8000-01\", \"payroll_payable_account_id\": \"2000-02\", \"processing_rate_per_quintal\": 150, \"storage_increment_per_month\": 0.25, \"default_inventory_account_id\": \"1410-01\", \"base_storage_rate_per_quintal_day\": 1.25, \"unrealized_exchange_gain_loss_account_id\": \"\"}','2026-07-25 10:58:11.315','2026-09-14 00:44:51.648');
/*!40000 ALTER TABLE `company_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_customers_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_employees_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `expenses`
--

DROP TABLE IF EXISTS `expenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenses` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_expenses_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenses`
--

LOCK TABLES `expenses` WRITE;
/*!40000 ALTER TABLE `expenses` DISABLE KEYS */;
/*!40000 ALTER TABLE `expenses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `export_products`
--

DROP TABLE IF EXISTS `export_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `export_products` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `commodity_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Agricultural Commodity',
  `warehouse_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `crop_year` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grade` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `origin` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `moisture_content` decimal(5,2) DEFAULT NULL,
  `clean_yield_pct` decimal(5,2) DEFAULT NULL,
  `unit` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Quintal',
  `quantity` decimal(18,2) NOT NULL DEFAULT '0.00',
  `quantity_sold` decimal(18,2) NOT NULL DEFAULT '0.00',
  `total_quantity` decimal(18,2) NOT NULL DEFAULT '0.00',
  `unit_cost` decimal(18,2) NOT NULL DEFAULT '0.00',
  `selling_price` decimal(18,2) NOT NULL DEFAULT '0.00',
  `total_stock_value` decimal(18,2) NOT NULL DEFAULT '0.00',
  `reorder_level` decimal(18,2) DEFAULT '0.00',
  `min_stock_level` decimal(18,2) DEFAULT '0.00',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'In Stock',
  `description` text COLLATE utf8mb4_unicode_ci,
  `supplier_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `supplier_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `voucher_no` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plate_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `driver_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_exp_prod_wh` (`warehouse_id`),
  KEY `idx_exp_prod_commodity` (`commodity_type`),
  KEY `idx_exp_prod_sku` (`sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `export_products`
--

LOCK TABLES `export_products` WRITE;
/*!40000 ALTER TABLE `export_products` DISABLE KEYS */;
/*!40000 ALTER TABLE `export_products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `export_warehouse_movements`
--

DROP TABLE IF EXISTS `export_warehouse_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `export_warehouse_movements` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `warehouse_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `movement_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `voucher_no` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batch_no` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `party_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plate_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gross_quantity` decimal(18,2) DEFAULT '0.00',
  `reject_quantity` decimal(18,2) DEFAULT '0.00',
  `net_quantity` decimal(18,2) DEFAULT '0.00',
  `uom` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Quintal',
  `unit_price` decimal(18,2) DEFAULT '0.00',
  `movement_date` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `created_by` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ewm_wh` (`warehouse_id`),
  KEY `idx_ewm_prod` (`product_id`),
  KEY `idx_ewm_date` (`movement_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `export_warehouse_movements`
--

LOCK TABLES `export_warehouse_movements` WRITE;
/*!40000 ALTER TABLE `export_warehouse_movements` DISABLE KEYS */;
/*!40000 ALTER TABLE `export_warehouse_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `gl_account_mappings`
--

DROP TABLE IF EXISTS `gl_account_mappings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gl_account_mappings` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `normal_posting` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Debit',
  `is_system_default` tinyint(1) NOT NULL DEFAULT '0',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mapping_category` (`category`),
  KEY `idx_mapping_account_id` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gl_account_mappings`
--

LOCK TABLES `gl_account_mappings` WRITE;
/*!40000 ALTER TABLE `gl_account_mappings` DISABLE KEYS */;
INSERT INTO `gl_account_mappings` VALUES ('ap_advance_prepayment','Supplier Advance & Prepayment Asset','Purchasing & AP','1100-03','1100-03','PURCHASE ADVANCE','Debit',1,'Cash prepayments issued to suppliers prior to goods receipt.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('ap_trade_payable','Trade Accounts Payable (Supplier Bills)','Purchasing & AP','2100-06','2100-06','OTHER ACCRUALS','Credit',1,'Supplier liability credited upon recording vendor purchase bill.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('bank_interest_income','Bank Interest Income Earned','Banking & Treasury','4200','4200','OTHER INCOME','Credit',1,'Interest income credited during monthly bank statement reconciliation.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('bank_service_charge_expense','Bank Service Charges & Fees','Banking & Treasury','8000-25','8000-25','BANK SERVICE CHARGE','Debit',1,'Bank ledger fee debited during monthly bank statement reconciliation.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('cogs_stock_fulfillment','Cost of Goods Sold (Delivery Notes / Stock Fulfillment)','Inventory & COGS','6000-04','6000-04','PACKING AND BAGING','Debit',1,'Cost of sales recognized upon dispatching customer delivery note.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:59:28'),('customer_receipt_bank','Customer Receipt Default Bank Account','Banking & Treasury','1000-02-26','1000-02-26','CBE_ECB_AC_1000465135224','Debit',1,'Default bank account receiving customer settlement funds.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('expense_default_debit','Default General / Administrative Expense','Expenses & Taxes','8000-30','8000-30','MICELLANOUS','Debit',1,'Fallback operating expense account for operational payment vouchers.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('expense_default_payment','Default Petty Cash / Expense Disbursing Account','Expenses & Taxes','1000-01-01','1000-01-01','PETTY CASH-HEAD OFFICE','Credit',1,'Cash account credited for head office petty cash and minor expenses.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('expense_vat_input','VAT Input / Receivable Asset (15%)','Expenses & Taxes','1320-06-02','1320-06-02','VAT RECIVABLE','Debit',1,'Input VAT paid on business purchases, claimable against output VAT.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('expense_wht_payable','Withholding Tax Payable (Deducted from Vendors)','Expenses & Taxes','2000-04','2000-04','WHT PAYABLE','Credit',1,'2% or 30% tax withheld from suppliers, payable to tax authority.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('fx_unrealized_gain_loss','Unrealized Foreign Exchange Gain / Loss','Banking & Treasury','4200','4200','OTHER INCOME','Credit',1,'Variance account for foreign currency bank account revaluations.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('inventory_stock_in_hand','Commodity Stock In Hand Asset','Inventory & COGS','1410-01','1410-01','STOCK OF GREEN MUNG','Debit',1,'Core balance sheet inventory asset representing warehouse commodities.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('payroll_accrued_clearing','Accrued Net Payroll Payable','Payroll & HR','2100-06','2100-06','OTHER ACCRUALS','Credit',1,'Net salary liability credited on accrual, cleared upon payroll bank transfer.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('payroll_gross_salary_expense','Gross Salaries & Wages Expense','Payroll & HR','8000-01','8000-01','SALARY AND WAGE','Debit',1,'Total gross compensation debited on monthly payroll accrual run.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('payroll_income_tax_payable','Employee Income Tax (PAYE) Payable','Payroll & HR','2000-05','2000-05','VAT PAYABLE','Credit',1,'Personal income tax withheld from employee payroll, payable to government.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('payroll_pension_payable','Pension Contribution Payable (7% + 11%)','Payroll & HR','2000-03','2000-03','PENSION TAX PAYABLE','Credit',1,'Mandatory employee (7%) and employer (11%) pension contributions payable.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('po_grni_clearing','Goods Received Not Invoiced / Other Accruals','Purchasing & AP','2100-06','2100-06','OTHER ACCRUALS','Credit',1,'Clearing accrual liability credited on GRN and debited upon vendor bill receipt.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('po_grni_inventory','Inventory Stock-In-Hand (PO Goods Receipt / GRN)','Purchasing & AP','1410-01','1410-01','STOCK OF GREEN MUNG','Debit',1,'Inventory asset debited when warehouse procurement receiving voucher is logged.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('sales_cash_clearing','Cash / Bank (Direct Cash Sales)','Sales & Revenue','1000-02-26','1000-02-26','CBE_ECB_AC_1000465135224','Debit',1,'Operating bank/cash account debited upon immediate cash sales issue.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('sales_credit_ar','Trade Accounts Receivable (Credit Invoicing)','Sales & Revenue','1300-03','1300-03','VET MEDICEN SALES RECIVABLE','Debit',1,'Customer balance due debited upon issuing a credit sales invoice.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('sales_revenue_domestic','Domestic Commercial Sales Revenue','Sales & Revenue','4000-01-01','4000-01-01','SALES OF VETERINARY DRUG','Credit',1,'Operating sales revenue recognized from domestic product sales.','System Reset','2026-09-13 12:42:08','2026-09-13 17:25:46'),('sales_revenue_services','Service Revenue (Cleaning & Storage)','Sales & Revenue','4000-03-02','4000-03-02','CLEANING SERVICE','Credit',1,'Revenue earned from warehouse grain cleaning, handling, and storage.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('sales_vat_output','VAT Output Payable (15%)','Sales & Revenue','2000-05','2000-05','VAT PAYABLE','Credit',1,'Value Added Tax collected from customers, payable to tax authorities.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('sales_wht_withheld','Withholding Tax Receivable Asset (Client Withheld)','Sales & Revenue','1320-06-01','1320-06-01','WITHOLD TAX RECIVABLE','Debit',1,'Tax withheld by clients (2% or 30%), claimable against annual corporate tax.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('stock_adjustment_gain','Physical Inventory Surplus / Count Gain','Inventory & COGS','4200','4200','OTHER INCOME','Credit',1,'Gain recognized when physical audit count reveals positive stock surplus.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('stock_shrinkage_loss','Physical Inventory Shrinkage / Count Loss','Inventory & COGS','6000-22','6000-22','OTHER','Debit',1,'Write-off expense debited when physical count reveals negative variance.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('supplier_payment_ap','Supplier Payment (AP Clearing Debit)','Purchasing & AP','2100-06','2100-06','OTHER ACCRUALS','Debit',1,'Clearing supplier liability upon issuing an AP payment voucher.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08'),('supplier_payment_bank','Supplier Payment Disbursing Bank Account','Banking & Treasury','1000-02-26','1000-02-26','CBE_ECB_AC_1000465135224','Credit',1,'Default corporate bank account used to disburse supplier payments.','System Initializer','2026-09-13 12:42:08','2026-09-13 12:42:08');
/*!40000 ALTER TABLE `gl_account_mappings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hkc_doc_records`
--

DROP TABLE IF EXISTS `hkc_doc_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hkc_doc_records` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_hkc_doc_records_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hkc_doc_records`
--

LOCK TABLES `hkc_doc_records` WRITE;
/*!40000 ALTER TABLE `hkc_doc_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `hkc_doc_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoices` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_invoices_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoices`
--

LOCK TABLES `invoices` WRITE;
/*!40000 ALTER TABLE `invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `journal_entries`
--

DROP TABLE IF EXISTS `journal_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `journal_entries` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_journal_entries_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_entries`
--

LOCK TABLES `journal_entries` WRITE;
/*!40000 ALTER TABLE `journal_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `journal_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `journal_entry_lines`
--

DROP TABLE IF EXISTS `journal_entry_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `journal_entry_lines` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_journal_entry_lines_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_entry_lines`
--

LOCK TABLES `journal_entry_lines` WRITE;
/*!40000 ALTER TABLE `journal_entry_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `journal_entry_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leave_requests`
--

DROP TABLE IF EXISTS `leave_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_requests` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_leave_requests_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leave_requests`
--

LOCK TABLES `leave_requests` WRITE;
/*!40000 ALTER TABLE `leave_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `leave_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leave_types`
--

DROP TABLE IF EXISTS `leave_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_types` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_leave_types_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leave_types`
--

LOCK TABLES `leave_types` WRITE;
/*!40000 ALTER TABLE `leave_types` DISABLE KEYS */;
INSERT INTO `leave_types` VALUES ('LT-ANNUAL','{\"id\": \"LT-ANNUAL\", \"name\": \"Annual Paid Leave\", \"isUnpaid\": false, \"carriesForward\": true, \"maxDaysPerYear\": 24}','2026-07-25 10:58:25.852','2026-08-04 07:08:02.553'),('LT-COMPASSIONATE','{\"id\": \"LT-COMPASSIONATE\", \"name\": \"Compassionate Leave\", \"isUnpaid\": false, \"carriesForward\": false, \"maxDaysPerYear\": 5}','2026-07-25 10:58:28.534','2026-08-04 07:08:01.998'),('LT-MATERNITY','{\"id\": \"LT-MATERNITY\", \"name\": \"Maternity / Paternity Leave\", \"isUnpaid\": false, \"carriesForward\": false, \"maxDaysPerYear\": 90}','2026-07-25 10:58:27.367','2026-08-04 07:08:00.796'),('LT-SICK','{\"id\": \"LT-SICK\", \"name\": \"Medical / Sick Leave\", \"isUnpaid\": false, \"carriesForward\": false, \"maxDaysPerYear\": 12}','2026-07-25 10:58:26.659','2026-08-04 07:08:03.028'),('LT-UNPAID','{\"id\": \"LT-UNPAID\", \"name\": \"Unpaid Special Leave\", \"isUnpaid\": true, \"carriesForward\": false, \"maxDaysPerYear\": 30}','2026-07-25 10:58:27.987','2026-08-04 07:08:01.351');
/*!40000 ALTER TABLE `leave_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_payments_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payroll_periods`
--

DROP TABLE IF EXISTS `payroll_periods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payroll_periods` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_payroll_periods_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payroll_periods`
--

LOCK TABLES `payroll_periods` WRITE;
/*!40000 ALTER TABLE `payroll_periods` DISABLE KEYS */;
/*!40000 ALTER TABLE `payroll_periods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payroll_records`
--

DROP TABLE IF EXISTS `payroll_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payroll_records` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_payroll_records_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payroll_records`
--

LOCK TABLES `payroll_records` WRITE;
/*!40000 ALTER TABLE `payroll_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `payroll_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pharma_product_batches`
--

DROP TABLE IF EXISTS `pharma_product_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pharma_product_batches` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `warehouse_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch_no` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mfg_date` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiry_date` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(18,2) NOT NULL DEFAULT '0.00',
  `unit_cost` decimal(18,2) DEFAULT '0.00',
  `qa_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Released',
  `location` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_batch_prod` (`product_id`),
  KEY `idx_batch_wh` (`warehouse_id`),
  KEY `idx_batch_expiry` (`expiry_date`),
  KEY `idx_batch_status` (`qa_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pharma_product_batches`
--

LOCK TABLES `pharma_product_batches` WRITE;
/*!40000 ALTER TABLE `pharma_product_batches` DISABLE KEYS */;
INSERT INTO `pharma_product_batches` VALUES ('batch-P-1788854908608-ALT26025','P-1788854908608','WH2','ALT26025','2026-01-01','2029-12-01',3500.00,0.00,'Released',NULL,'Initial batch for ASHIVER 5','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788857345432-251032','P-1788857345432','WH3','251032','2025-10-01','2028-10-01',2320.00,0.00,'Released',NULL,'Initial batch for INFLAMGO','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788857446192-260512','P-1788857446192','WH3','260512','2026-05-01','2029-05-01',21200.00,0.00,'Released',NULL,'Initial batch for INFLAMGO','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788858054417-251036','P-1788858054417','WH3','251036','2025-10-01','2028-10-01',8240.00,848.00,'Released',NULL,'Initial batch for ALBENTONG 2500','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788858377681-251034','P-1788858377681','WH3','251034','2025-10-01','2028-10-01',2610.00,0.00,'Released',NULL,'Initial batch for ALBENTONG SUS 10','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788858567873-251035','P-1788858567873','WH3','251035','2025-10-01','2028-10-01',2310.00,0.00,'Released',NULL,'Initial batch for LIVERFLUKE 1','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788859087961-AA12423','P-1788859087961','WH2','AA12423','2024-12-01','2027-11-01',4.00,0.00,'Released',NULL,'Initial batch for ASHITRAZ 12.5%','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788859302545-ALT25356','P-1788859302545','WH2','ALT25356','2025-06-01','2029-05-01',26.67,0.00,'Released',NULL,'Initial batch for ASHITETRA 2000','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788859513561-ALI25077','P-1788859513561','WH2','ALI25077','2025-04-01','2027-01-01',19.00,0.00,'Released',NULL,'Initial batch for ASHIVER 1% INJECTION','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788859675153-D260392U','P-1788859675153','WH3','D260392U','2026-03-01','2029-03-01',11120.00,0.00,'Released',NULL,'Initial batch for TY-VITAMINS','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788860002713-ALT26022','P-1788860002713','WH2','ALT26022','2026-01-01','2029-12-01',20.00,911.00,'Released',NULL,'Initial batch for ASHIALBIN 2500','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788860199689-ALL260448','P-1788860199689','WH2','ALL260448','2026-04-01','2029-03-01',1100.00,433.00,'Released',NULL,'Initial batch for ASHIENRO BH','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788860444633-ALG26111','P-1788860444633','WH2','ALG26111','2026-03-01','2029-02-01',2824.00,228.00,'Released',NULL,'Initial batch for ASHOXY 20% 5GM','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788860782033-ALT25393','P-1788860782033','WH2','ALT25393','2025-07-01','2029-06-01',990.00,410.00,'Released',NULL,'Initial batch for FASINASH SHEEP','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788861003705-ALG26109','P-1788861003705','WH2','ALG26109','2026-03-01','2029-02-01',1592.00,1935.00,'Released',NULL,'Initial batch for ASHOXY 20% 100GM','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788919771878-ALL26041','P-1788919771878','WH2','ALL26041','2026-04-01','2029-03-01',1500.00,239.00,'Released',NULL,'Initial batch for ASHINERO 10% ORAL','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788920432213-ALI26027','P-1788920432213','WH2','ALI26027','2026-04-01','2029-03-01',360.00,433.00,'Released',NULL,'Initial batch for ASHTYL 20% INJ','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788920639771-260504','P-1788920639771','WH3','260504','2026-05-01','2029-05-01',60000.00,65.00,'Released',NULL,'Initial batch for IVERTONG GLASS','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788920860228-260516','P-1788920860228','WH3','260516','2026-05-01','2029-05-01',9010.50,206.00,'Released',NULL,'Initial batch for OXYTONG 20','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788921168285-260509','P-1788921168285','WH3','260509','2026-05-01','2029-05-01',115500.00,65.00,'Released',NULL,'Initial batch for IVERTONG PLASTIC','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788921387242-260511','P-1788921387242','WH3','260511','2026-05-01','2029-05-01',44880.00,141.00,'Released',NULL,'Initial batch for HIVITA TONG','2026-09-13 10:03:06','2026-09-13 10:03:06'),('batch-P-1788921559264-260514','P-1788921559264','WH3','260514','2026-05-01','2031-05-01',93000.00,30.00,'Released',NULL,'Initial batch for TRYPATONG','2026-09-13 10:03:06','2026-09-13 10:03:06');
/*!40000 ALTER TABLE `pharma_product_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pharma_products`
--

DROP TABLE IF EXISTS `pharma_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pharma_products` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `generic_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sub_category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `warehouse_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dosage_form` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `strength` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shelf_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `storage_condition` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Box',
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
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'In Stock',
  `description` text COLLATE utf8mb4_unicode_ci,
  `supplier_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `supplier_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pharma_prod_wh` (`warehouse_id`),
  KEY `idx_pharma_prod_category` (`category`),
  KEY `idx_pharma_prod_sku` (`sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pharma_products`
--

LOCK TABLES `pharma_products` WRITE;
/*!40000 ALTER TABLE `pharma_products` DISABLE KEYS */;
INSERT INTO `pharma_products` VALUES ('P-1788854908608','ASH-ALT26025','ASHIVER 5','ASHIVER 5','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Box',100,35,3500.00,0.00,3500.00,0.00,0.00,0.00,0.00,0.00,47,'In Stock','ASHIVER 5',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788857345432','INF-251032','INFLAMGO','INFLAMGO','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',80,29,2320.00,0.00,2320.00,0.00,0.00,0.00,0.00,0.00,36,'In Stock','INFLAMGO',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788857446192','INF-260512','INFLAMGO','INFLAMGO','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',80,265,21200.00,0.00,21200.00,0.00,0.00,0.00,0.00,0.00,36,'In Stock','INFLAMGO',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788858054417','ALB-251036','ALBENTONG 2500','ALBENTONG 2500','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Box',40,206,8240.00,0.00,8240.00,848.00,848.00,6987520.00,0.00,0.00,36,'In Stock','ALBENTONG 2500',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788858377681','ALB-251034','ALBENTONG SUS 10','ALBENTONG SUS 10','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',30,87,2610.00,0.00,2610.00,0.00,0.00,0.00,0.00,0.00,36,'In Stock','ALBENTONG SUS 10',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788858567873','LIV-251035','LIVERFLUKE 1','LIVERFLUKE 1','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',30,77,2310.00,0.00,2310.00,0.00,0.00,0.00,0.00,0.00,36,'In Stock','LIVERFLUKE 1',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788859087961','ASH-AA12423','ASHITRAZ 12.5%','ASHITRAZ 12.5%','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',12,0,4.00,0.00,4.00,0.00,0.00,0.00,0.00,0.00,35,'In Stock','ASHITRAZ 12.5%',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788859302545','ASH-ALT25356','ASHITETRA 2000','ASHITETRA 2000','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Box',40,1,26.67,0.00,26.67,0.00,0.00,0.00,0.00,0.00,47,'In Stock','ASHITETRA 2000',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788859513561','ASH-ALI25077','ASHIVER 1% INJECTION','ASHIVER 1% INJECTION','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Vial',120,0,19.00,0.00,19.00,0.00,0.00,0.00,0.00,0.00,21,'In Stock','ASHIVER 1% INJECTION',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788859675153','TYSTK-D260392U','TY-VITAMINS','TY-VITAMINS','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',100,111,11120.00,0.00,11120.00,0.00,0.00,0.00,0.00,0.00,36,'In Stock','TY-VITAMINS',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788860002713','ASH-ALT26022','ASHIALBIN 2500','ASHIALBIN 2500','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Box',60,0,20.00,0.00,20.00,911.00,911.00,18220.00,0.00,0.00,47,'In Stock','ASHIALBIN 2500',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788860199689','ASH-ALL260448','ASHIENRO BH','ASHIENRO BH','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',100,11,1100.00,0.00,1100.00,433.00,433.00,476300.00,0.00,0.00,35,'In Stock','ASHIENRO BH',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788860444633','ASH-ALG26111','ASHOXY 20% 5GM','ASHOXY 20% 5GM','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Box',132,21,2824.00,0.00,2824.00,228.00,228.00,643872.00,0.00,0.00,35,'In Stock','ASHOXY 20% 5GM',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788860782033','FAS-ALT25393','FASINASH SHEEP','FASINASH SHEEP','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Box',330,3,990.00,0.00,990.00,410.00,410.00,405900.00,0.00,0.00,47,'In Stock','FASINASH SHEEP',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788861003705','ASH-ALG26109','ASHOXY 20% 100GM','ASHOXY 20% 100GM','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Box',12,133,1592.00,0.00,1592.00,1935.00,1935.00,3080520.00,0.00,0.00,35,'In Stock','ASHOXY 20% 100GM',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788919771878','ASH-ALL26041','ASHINERO 10% ORAL','ASHINERO 10% ORAL','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',100,15,1500.00,0.00,1500.00,239.00,239.00,358500.00,0.00,0.00,35,'In Stock','ASHINERO 10% ORAL',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788920432213','ASH-ALI26027','ASHTYL 20% INJ','ASHTYL 20% INJ','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Vial',80,5,360.00,0.00,360.00,433.00,433.00,155880.00,0.00,0.00,35,'In Stock','ASHTYL 20% INJ',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788920639771','IVE-260505','IVERTONG GLASS','IVERTONG GLASS','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',100,600,60000.00,0.00,60000.00,65.00,65.00,3900000.00,0.00,0.00,36,'In Stock','IVERTONG GLASS',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788920860228','OXY-260516','OXYTONG 20','OXYTONG 20','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Sachet',150,60,9010.50,0.00,9010.50,206.00,206.00,1856163.00,0.00,0.00,36,'In Stock','OXYTONG 20',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788921168285','IVE-260509','IVERTONG PLASTIC','IVERTONG PLASTIC','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',100,1155,115500.00,0.00,115500.00,65.00,65.00,7507500.00,0.00,0.00,36,'In Stock','IVERTONG PLASTIC',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788921387242','HIV-260511','HIVITA TONG','HIVITA TONG','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',80,561,44880.00,0.00,44880.00,141.00,141.00,6328080.00,0.00,0.00,36,'In Stock','HIVITA TONG',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06'),('P-1788921559264','TRY-260514','TRYPATONG','TRYPATONG','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Sachet',1000,93,93000.00,0.00,93000.00,30.00,30.00,2790000.00,0.00,0.00,60,'In Stock','TRYPATONG',NULL,NULL,'2026-09-13 10:03:06','2026-09-13 10:03:06');
/*!40000 ALTER TABLE `pharma_products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `processing_services`
--

DROP TABLE IF EXISTS `processing_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `reject_reason` text COLLATE utf8mb4_unicode_ci,
  `net_deliverable_quantity` decimal(18,2) DEFAULT NULL,
  `reject_recorded_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_processing_services_created_at` (`created_at` DESC),
  KEY `idx_processing_services_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `processing_services`
--

LOCK TABLES `processing_services` WRITE;
/*!40000 ALTER TABLE `processing_services` DISABLE KEYS */;
/*!40000 ALTER TABLE `processing_services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_orders`
--

DROP TABLE IF EXISTS `purchase_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_orders` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `po_number` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `voucher_no` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `paid_to` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `supplier` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `supplier_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reason_for_payment` text COLLATE utf8mb4_unicode_ci,
  `bank_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Cheque',
  `cheque_no` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `amount_paid` decimal(18,2) NOT NULL DEFAULT '0.00',
  `balance_due` decimal(18,2) NOT NULL DEFAULT '0.00',
  `payment_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Cash',
  `payment_terms` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `due_date` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PAID',
  `settlement_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Fully Settled',
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ETB',
  `amount_in_words` text COLLATE utf8mb4_unicode_ci,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_advice_attachment` json DEFAULT NULL,
  `attachments` json DEFAULT NULL,
  `installment_payments` json DEFAULT NULL,
  `items` json DEFAULT NULL,
  `account_entries` json DEFAULT NULL,
  `prepared_by` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_by` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paid_by` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_purchase_orders_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_orders`
--

LOCK TABLES `purchase_orders` WRITE;
/*!40000 ALTER TABLE `purchase_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recurring_expense_schedules`
--

DROP TABLE IF EXISTS `recurring_expense_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recurring_expense_schedules` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_recurring_expense_schedules_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recurring_expense_schedules`
--

LOCK TABLES `recurring_expense_schedules` WRITE;
/*!40000 ALTER TABLE `recurring_expense_schedules` DISABLE KEYS */;
/*!40000 ALTER TABLE `recurring_expense_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_issue_items`
--

DROP TABLE IF EXISTS `sales_issue_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_issue_items`
--

LOCK TABLES `sales_issue_items` WRITE;
/*!40000 ALTER TABLE `sales_issue_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_issue_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_issues`
--

DROP TABLE IF EXISTS `sales_issues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_issues`
--

LOCK TABLES `sales_issues` WRITE;
/*!40000 ALTER TABLE `sales_issues` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_issues` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_orders`
--

DROP TABLE IF EXISTS `sales_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_orders` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_sales_orders_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_orders`
--

LOCK TABLES `sales_orders` WRITE;
/*!40000 ALTER TABLE `sales_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shipment_documents`
--

DROP TABLE IF EXISTS `shipment_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shipment_documents`
--

LOCK TABLES `shipment_documents` WRITE;
/*!40000 ALTER TABLE `shipment_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `shipment_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_movements`
--

DROP TABLE IF EXISTS `stock_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_movements` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `warehouse_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'WH1',
  `movement_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INBOUND_RECEIPT',
  `quantity` decimal(18,2) NOT NULL DEFAULT '0.00',
  `unit_cost` decimal(18,2) DEFAULT '0.00',
  `unit_price` decimal(15,2) DEFAULT NULL,
  `balance_after` decimal(18,2) NOT NULL DEFAULT '0.00',
  `batch_no` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiry_date` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `performed_by` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `movement_date` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_stock_movements_created_at` (`created_at` DESC),
  KEY `idx_mov_prod_date` (`product_id`,`movement_date`),
  KEY `idx_mov_wh_date` (`warehouse_id`,`movement_date`),
  KEY `idx_mov_ref` (`reference_type`,`reference_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_movements`
--

LOCK TABLES `stock_movements` WRITE;
/*!40000 ALTER TABLE `stock_movements` DISABLE KEYS */;
INSERT INTO `stock_movements` VALUES ('SM-INIT-batch-P-1788854908608-ALT26025','P-1788854908608','WH2','RECEIPT',3500.00,0.00,0.00,3500.00,'ALT26025','2029-12-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: ASHIVER 5 [Batch: ALT26025]','System Migration','2026-01-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788857345432-251032','P-1788857345432','WH3','RECEIPT',2320.00,0.00,0.00,2320.00,'251032','2028-10-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: INFLAMGO [Batch: 251032]','System Migration','2025-10-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788857446192-260512','P-1788857446192','WH3','RECEIPT',21200.00,0.00,0.00,21200.00,'260512','2029-05-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: INFLAMGO [Batch: 260512]','System Migration','2026-05-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788858054417-251036','P-1788858054417','WH3','RECEIPT',8240.00,848.00,848.00,8240.00,'251036','2028-10-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: ALBENTONG 2500 [Batch: 251036]','System Migration','2025-10-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788858377681-251034','P-1788858377681','WH3','RECEIPT',2610.00,0.00,0.00,2610.00,'251034','2028-10-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: ALBENTONG SUS 10 [Batch: 251034]','System Migration','2025-10-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788858567873-251035','P-1788858567873','WH3','RECEIPT',2310.00,0.00,0.00,2310.00,'251035','2028-10-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: LIVERFLUKE 1 [Batch: 251035]','System Migration','2025-10-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788859087961-AA12423','P-1788859087961','WH2','RECEIPT',4.00,0.00,0.00,4.00,'AA12423','2027-11-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: ASHITRAZ 12.5% [Batch: AA12423]','System Migration','2024-12-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788859302545-ALT25356','P-1788859302545','WH2','RECEIPT',26.67,0.00,0.00,26.67,'ALT25356','2029-05-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: ASHITETRA 2000 [Batch: ALT25356]','System Migration','2025-06-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788859513561-ALI25077','P-1788859513561','WH2','RECEIPT',19.00,0.00,0.00,19.00,'ALI25077','2027-01-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: ASHIVER 1% INJECTION [Batch: ALI25077]','System Migration','2025-04-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788859675153-D260392U','P-1788859675153','WH3','RECEIPT',11120.00,0.00,0.00,11120.00,'D260392U','2029-03-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: TY-VITAMINS [Batch: D260392U]','System Migration','2026-03-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788860002713-ALT26022','P-1788860002713','WH2','RECEIPT',20.00,911.00,911.00,20.00,'ALT26022','2029-12-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: ASHIALBIN 2500 [Batch: ALT26022]','System Migration','2026-01-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788860199689-ALL260448','P-1788860199689','WH2','RECEIPT',1100.00,433.00,433.00,1100.00,'ALL260448','2029-03-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: ASHIENRO BH [Batch: ALL260448]','System Migration','2026-04-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788860444633-ALG26111','P-1788860444633','WH2','RECEIPT',2824.00,228.00,228.00,2824.00,'ALG26111','2029-02-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: ASHOXY 20% 5GM [Batch: ALG26111]','System Migration','2026-03-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788860782033-ALT25393','P-1788860782033','WH2','RECEIPT',990.00,410.00,410.00,990.00,'ALT25393','2029-06-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: FASINASH SHEEP [Batch: ALT25393]','System Migration','2025-07-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788861003705-ALG26109','P-1788861003705','WH2','RECEIPT',1592.00,1935.00,1935.00,1592.00,'ALG26109','2029-02-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: ASHOXY 20% 100GM [Batch: ALG26109]','System Migration','2026-03-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788919771878-ALL26041','P-1788919771878','WH2','RECEIPT',1500.00,239.00,239.00,1500.00,'ALL26041','2029-03-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: ASHINERO 10% ORAL [Batch: ALL26041]','System Migration','2026-04-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788920432213-ALI26027','P-1788920432213','WH2','RECEIPT',360.00,433.00,433.00,360.00,'ALI26027','2029-03-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: ASHTYL 20% INJ [Batch: ALI26027]','System Migration','2026-04-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788920639771-260504','P-1788920639771','WH3','RECEIPT',60000.00,65.00,65.00,60000.00,'260504','2029-05-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: IVERTONG GLASS [Batch: 260504]','System Migration','2026-05-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788920860228-260516','P-1788920860228','WH3','RECEIPT',9010.50,206.00,206.00,9010.50,'260516','2029-05-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: OXYTONG 20 [Batch: 260516]','System Migration','2026-05-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788921168285-260509','P-1788921168285','WH3','RECEIPT',115500.00,65.00,65.00,115500.00,'260509','2029-05-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: IVERTONG PLASTIC [Batch: 260509]','System Migration','2026-05-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788921387242-260511','P-1788921387242','WH3','RECEIPT',44880.00,141.00,141.00,44880.00,'260511','2029-05-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: HIVITA TONG [Batch: 260511]','System Migration','2026-05-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000'),('SM-INIT-batch-P-1788921559264-260514','P-1788921559264','WH3','RECEIPT',93000.00,30.00,30.00,93000.00,'260514','2031-05-01','STOCK_RECEIPT','INITIAL_DEPOSIT','Initial Stock Deposit: TRYPATONG [Batch: 260514]','System Migration','2026-05-01','2026-09-14 00:52:48.000','2026-09-14 00:52:48.000');
/*!40000 ALTER TABLE `stock_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `store_transfer_items`
--

DROP TABLE IF EXISTS `store_transfer_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `store_transfer_items` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `transfer_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batch_no` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(18,2) NOT NULL DEFAULT '0.00',
  `uom` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit_cost` decimal(18,2) DEFAULT '0.00',
  `notes` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_item_transfer` (`transfer_id`),
  KEY `idx_item_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `store_transfer_items`
--

LOCK TABLES `store_transfer_items` WRITE;
/*!40000 ALTER TABLE `store_transfer_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `store_transfer_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `store_transfers`
--

DROP TABLE IF EXISTS `store_transfers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `store_transfers` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `transfer_no` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `from_warehouse_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'WH2',
  `to_warehouse_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'WH3',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Draft',
  `requested_by` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_by` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `request_date` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `completed_date` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_store_transfers_created_at` (`created_at` DESC),
  KEY `idx_transfer_from` (`from_warehouse_id`),
  KEY `idx_transfer_to` (`to_warehouse_id`),
  KEY `idx_transfer_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `store_transfers`
--

LOCK TABLES `store_transfers` WRITE;
/*!40000 ALTER TABLE `store_transfers` DISABLE KEYS */;
/*!40000 ALTER TABLE `store_transfers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_suppliers_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tax_rules`
--

DROP TABLE IF EXISTS `tax_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tax_rules` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_tax_rules_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tax_rules`
--

LOCK TABLES `tax_rules` WRITE;
/*!40000 ALTER TABLE `tax_rules` DISABLE KEYS */;
INSERT INTO `tax_rules` VALUES ('TAX-001','{\"id\": \"TAX-001\", \"name\": \"Standard VAT (15%)\", \"rate\": 15, \"type\": \"VAT/GST\", \"accountCode\": \"\", \"description\": \"Standard Ethiopian Value Added Tax rate of 15%\", \"isInclusive\": false, \"ratePercent\": 15, \"is_inclusive\": false, \"gl_account_code\": \"2210\"}','2026-08-12 16:32:45.335','2026-08-29 16:07:48.466'),('TAX-002','{\"id\": \"TAX-002\", \"name\": \"Withholding Tax (TDS 2%)\", \"rate\": 2, \"type\": \"Withholding Tax (TDS)\", \"accountCode\": \"2210\", \"description\": \"2% Tax Deducted at Source for commercial services\", \"isInclusive\": false, \"ratePercent\": 2, \"is_inclusive\": false, \"gl_account_code\": \"2210\"}','2026-08-12 16:32:45.335','2026-08-29 16:07:48.466'),('TAX-003','{\"id\": \"TAX-003\", \"name\": \"Import Customs Duty (10%)\", \"rate\": 10, \"type\": \"Import Duty\", \"accountCode\": \"2210\", \"description\": \"Customs duty rate on imported agricultural & tech goods\", \"isInclusive\": false, \"ratePercent\": 10, \"is_inclusive\": false, \"gl_account_code\": \"2210\"}','2026-08-12 16:32:45.335','2026-08-29 16:07:48.466'),('TAX-TOT-2','{\"id\": \"TAX-TOT-2\", \"name\": \"Turnover Tax (2% TOT)\", \"type\": \"Turnover Tax (TOT)\", \"appliesTo\": \"SALES\", \"is_active\": true, \"accountCode\": \"2000-05\", \"description\": \"2% Turnover Tax for non-VAT registered service transactions\", \"isDeduction\": false, \"isInclusive\": false, \"ratePercent\": 2}','2026-08-29 05:49:31.181','2026-09-14 00:44:51.652'),('TAX-VAT-15','{\"id\": \"TAX-VAT-15\", \"name\": \"Standard VAT (15%)\", \"type\": \"VAT/GST\", \"appliesTo\": \"BOTH\", \"is_active\": true, \"accountCode\": \"2000-05\", \"description\": \"Standard 15% Ethiopian Value Added Tax (Output VAT / Input VAT)\", \"isDeduction\": false, \"isInclusive\": false, \"ratePercent\": 15}','2026-08-29 05:49:31.181','2026-09-14 00:44:51.649'),('TAX-WHT-2','{\"id\": \"TAX-WHT-2\", \"name\": \"Withholding Tax (2% Services)\", \"type\": \"Withholding Tax (TDS)\", \"appliesTo\": \"BOTH\", \"is_active\": true, \"accountCode\": \"1320-06-01\", \"description\": \"2% Tax Deducted at Source for commercial service contracts\", \"isDeduction\": true, \"isInclusive\": false, \"ratePercent\": 2}','2026-08-29 05:49:31.181','2026-09-14 00:44:51.650'),('TAX-WHT-3','{\"id\": \"TAX-WHT-3\", \"name\": \"Withholding Tax (3% Goods/Rent)\", \"type\": \"Withholding Tax (TDS)\", \"appliesTo\": \"BOTH\", \"is_active\": true, \"accountCode\": \"1320-06-01\", \"description\": \"3% Withholding Tax asset deducted on goods supplies and rental\", \"isDeduction\": true, \"isInclusive\": false, \"ratePercent\": 3}','2026-08-29 05:49:31.181','2026-09-14 00:44:51.651'),('TAX-ZERO','{\"id\": \"TAX-ZERO\", \"name\": \"Zero-Rated / Export Exempt (0%)\", \"type\": \"Exempt\", \"appliesTo\": \"BOTH\", \"is_active\": true, \"accountCode\": \"2000-05\", \"description\": \"Zero-rated export commodities (Green Mung, Sesame) and exempt supplies\", \"isDeduction\": false, \"isInclusive\": false, \"ratePercent\": 0}','2026-08-29 05:49:31.181','2026-09-14 00:44:51.652');
/*!40000 ALTER TABLE `tax_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_activity_logs`
--

DROP TABLE IF EXISTS `user_activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_activity_logs`
--

LOCK TABLES `user_activity_logs` WRITE;
/*!40000 ALTER TABLE `user_activity_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_activity_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_sessions`
--

DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_sessions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `device_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'desktop',
  `os_name` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `browser_name` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_revoked` tinyint(1) NOT NULL DEFAULT '0',
  `last_active_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_sessions_user_id` (`user_id`),
  KEY `idx_user_sessions_lookup` (`id`,`is_revoked`,`expires_at`),
  CONSTRAINT `fk_user_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_sessions`
--

LOCK TABLES `user_sessions` WRITE;
/*!40000 ALTER TABLE `user_sessions` DISABLE KEYS */;
INSERT INTO `user_sessions` VALUES ('sess_2ec318f7966149ed8603ce29813e97e1','390993a5-1618-4b15-b8a1-5cd13a0b2bde','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36','desktop','macOS','Chrome',0,'2026-09-14 00:45:31','2026-09-14 05:26:52','2026-09-13 17:31:47','2026-09-14 00:45:31'),('sess_5abe030bd85f4b649a130e022b24259f','30a99eaa-ae3e-4726-973c-c19bfa82513a','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36','desktop','macOS','Chrome',0,'2026-09-13 17:25:23','2026-09-13 23:25:23','2026-09-13 17:25:23','2026-09-13 17:25:23'),('sess_95c997b626f94c13a301e3622746cac2','30a99eaa-ae3e-4726-973c-c19bfa82513a','127.0.0.1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36','desktop','macOS','Chrome',0,'2026-09-13 17:25:42','2026-09-13 23:25:43','2026-09-13 17:25:42','2026-09-13 17:25:42');
/*!40000 ALTER TABLE `user_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('30a99eaa-ae3e-4726-973c-c19bfa82513a','no','$2b$10$A56rPL41.TNdyw.pnZ6mWOTHqbUoKPWTasEu8407I4GMmVW8kd0mq','[\"inventory_admin\", \"hkc_docs_manager\"]','inventory_admin','active','Noah tesfaye',NULL,'[\"WH2-VET-IND\", \"WH3-VET-CHN\"]',NULL,NULL,NULL,1,'2026-08-14 02:09:55.261','2026-09-02 20:04:42.979'),('390993a5-1618-4b15-b8a1-5cd13a0b2bde','admin','$2b$10$Roxf5M9hchWaTJUXkn62QeUAAwDzJijeuzcSGRBIlmX9zpUFyu2R2','[\"superadmin\"]','viewer','active','Habtom',NULL,'[]',NULL,NULL,NULL,1,'2026-08-13 11:04:58.809','2026-09-01 09:18:59.327'),('USR-3d8938f0','selam','$2b$10$FzNFJrHww/qE8ubIBnG1juCMByLzGof73zWLEFMnsrAIc/4mAspbu','[\"sales_manager\"]','sales_manager','active','selam shikur',NULL,'[]',NULL,'selam','shikur',1,'2026-09-04 07:00:46.081','2026-09-04 07:00:46.081'),('USR-b82d46d6','yad','$2b$10$JiL.X/4O0pUDMjSgrWguQ.FIoDuBKHfQc2XOUcTYrRCJ9p9VROC.u','[\"inventory_admin\", \"sales_manager\"]','inventory_admin','active','Yadeal Adnew',NULL,'[\"WH1-AGRI-EXP\"]','WH1-AGRI-EXP','Yadeal','Adnew',1,'2026-09-03 16:14:03.716','2026-09-04 09:35:05.826'),('USR-ca107596','Hilena','$2b$10$YIcPYAh4nbuMYE5eoD/ipO9Slb/j1EsnClXZkrAdVisruORRFN4sC','[\"hkc_docs_manager\", \"inventory_admin\"]','hkc_docs_manager','active','Hilena Abera',NULL,'[\"WH1-AGRI-EXP\"]',NULL,'Hilena','Abera',1,'2026-09-04 06:49:58.736','2026-09-04 06:51:28.847');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicles`
--

DROP TABLE IF EXISTS `vehicles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicles` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_vehicles_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicles`
--

LOCK TABLES `vehicles` WRITE;
/*!40000 ALTER TABLE `vehicles` DISABLE KEYS */;
/*!40000 ALTER TABLE `vehicles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `warehouses`
--

DROP TABLE IF EXISTS `warehouses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `warehouses` (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `warehouse_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PHARMA_WH',
  `type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_warehouses_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `warehouses`
--

LOCK TABLES `warehouses` WRITE;
/*!40000 ALTER TABLE `warehouses` DISABLE KEYS */;
INSERT INTO `warehouses` VALUES ('WH1','WH1 - Ethiopia Agricultural Export Hub','WH1-AGRI-EXP','Modjo Export Terminal, Ethiopia','EXPORT_WH','Export Hub','2026-07-25 10:58:16.207','2026-09-13 13:03:06.681'),('WH2','WH2 - Veterinary Import Hub (alem bank)','WH2-VET-ALEM','Alem Bank Hub, Addis Ababa, Ethiopia','PHARMA_WH','Import & Distribution Hub','2026-07-25 10:58:16.796','2026-09-13 13:03:06.681'),('WH3','WH3 - Veterinary Import Hub (LEBU)','WH3-VET-LEBU','Lebu Commercial Center, Addis Ababa, Ethiopia','PHARMA_WH','Import & Distribution Hub','2026-07-25 10:58:17.428','2026-09-13 13:03:06.681');
/*!40000 ALTER TABLE `warehouses` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-14  3:55:05
