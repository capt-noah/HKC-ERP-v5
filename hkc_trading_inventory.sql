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
INSERT INTO `pharma_products` VALUES ('P-1788854908608','ASH-ALT26025','ASHIVER 5','ASHIVER 5','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Box',100,35,3500.00,0.00,3500.00,0.00,0.00,0.00,0.00,0.00,47,'In Stock','ASHIVER 5',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788857345432','INF-251032','INFLAMGO','INFLAMGO','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',80,29,2320.00,0.00,2320.00,0.00,0.00,0.00,0.00,0.00,36,'In Stock','INFLAMGO',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788857446192','INF-260512','INFLAMGO','INFLAMGO','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',80,265,21200.00,0.00,21200.00,0.00,0.00,0.00,0.00,0.00,36,'In Stock','INFLAMGO',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788858054417','ALB-251036','ALBENTONG 2500','ALBENTONG 2500','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Box',40,206,8240.00,0.00,8240.00,848.00,848.00,6987520.00,0.00,0.00,36,'In Stock','ALBENTONG 2500',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788858377681','ALB-251034','ALBENTONG SUS 10','ALBENTONG SUS 10','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',30,87,2610.00,0.00,2610.00,0.00,0.00,0.00,0.00,0.00,36,'In Stock','ALBENTONG SUS 10',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788858567873','LIV-251035','LIVERFLUKE 1','LIVERFLUKE 1','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',30,77,2310.00,0.00,2310.00,0.00,0.00,0.00,0.00,0.00,36,'In Stock','LIVERFLUKE 1',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788859087961','ASH-AA12423','ASHITRAZ 12.5%','ASHITRAZ 12.5%','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',12,0,4.00,0.00,4.00,0.00,0.00,0.00,0.00,0.00,35,'In Stock','ASHITRAZ 12.5%',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788859302545','ASH-ALT25356','ASHITETRA 2000','ASHITETRA 2000','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Box',40,1,26.67,0.00,26.67,0.00,0.00,0.00,0.00,0.00,47,'In Stock','ASHITETRA 2000',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788859513561','ASH-ALI25077','ASHIVER 1% INJECTION','ASHIVER 1% INJECTION','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Vial',120,0,19.00,0.00,19.00,0.00,0.00,0.00,0.00,0.00,21,'In Stock','ASHIVER 1% INJECTION',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788859675153','TYSTK-D260392U','TY-VITAMINS','TY-VITAMINS','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',100,111,11120.00,0.00,11120.00,0.00,0.00,0.00,0.00,0.00,36,'In Stock','TY-VITAMINS',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788860002713','ASH-ALT26022','ASHIALBIN 2500','ASHIALBIN 2500','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Box',60,0,20.00,0.00,20.00,911.00,911.00,18219.98,0.00,0.00,47,'In Stock','ASHIALBIN 2500',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788860199689','ASH-ALL260448','ASHIENRO BH','ASHIENRO BH','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',100,11,1100.00,0.00,1100.00,433.00,433.00,476300.00,0.00,0.00,35,'In Stock','ASHIENRO BH',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788860444633','ASH-ALG26111','ASHOXY 20% 5GM','ASHOXY 20% 5GM','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Box',132,21,2824.00,0.00,2824.00,228.00,228.00,643872.02,0.00,0.00,35,'In Stock','ASHOXY 20% 5GM',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788860782033','FAS-ALT25393','FASINASH SHEEP','FASINASH SHEEP','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Box',330,3,990.00,0.00,990.00,410.00,410.00,405900.00,0.00,0.00,47,'In Stock','FASINASH SHEEP',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788861003705','ASH-ALG26109','ASHOXY 20% 100GM','ASHOXY 20% 100GM','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Box',12,133,1592.00,0.00,1592.00,1935.00,1935.00,3080520.77,0.00,0.00,35,'In Stock','ASHOXY 20% 100GM',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788919771878','ASH-ALL26041','ASHINERO 10% ORAL','ASHINERO 10% ORAL','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',100,15,1500.00,0.00,1500.00,239.00,239.00,358500.00,0.00,0.00,35,'In Stock','ASHINERO 10% ORAL',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788920432213','ASH-ALI26027','ASHTYL 20% INJ','ASHTYL 20% INJ','Veterinary Medicine',NULL,'WH2',NULL,NULL,NULL,'Room Temperature (15-25°C)','Vial',80,5,360.00,0.00,360.00,433.00,433.00,155880.00,0.00,0.00,35,'In Stock','ASHTYL 20% INJ',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788920639771','IVE-260505','IVERTONG GLASS','IVERTONG GLASS','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',100,600,60000.00,0.00,60000.00,65.00,65.00,3900000.00,0.00,0.00,36,'In Stock','IVERTONG GLASS',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788920860228','OXY-260516','OXYTONG 20','OXYTONG 20','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Sachet',150,60,9010.50,0.00,9010.50,206.00,206.00,1856163.00,0.00,0.00,36,'In Stock','OXYTONG 20',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788921168285','IVE-260509','IVERTONG PLASTIC','IVERTONG PLASTIC','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',100,1155,115500.00,0.00,115500.00,65.00,65.00,7507500.00,0.00,0.00,36,'In Stock','IVERTONG PLASTIC',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788921387242','HIV-260511','HIVITA TONG','HIVITA TONG','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Bottle',80,561,44880.00,0.00,44880.00,141.00,141.00,6328080.00,0.00,0.00,36,'In Stock','HIVITA TONG',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06'),('P-1788921559264','TRY-260514','TRYPATONG','TRYPATONG','Veterinary Medicine',NULL,'WH3',NULL,NULL,NULL,'Room Temperature (15-25°C)','Sachet',1000,93,93000.00,0.00,93000.00,30.00,30.00,2790000.00,0.00,0.00,60,'In Stock','TRYPATONG',NULL,NULL,'2026-09-13 13:03:06','2026-09-13 13:03:06');
/*!40000 ALTER TABLE `pharma_products` ENABLE KEYS */;
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
INSERT INTO `pharma_product_batches` VALUES ('BAT-1789317202925-k383','P-1789317140254','WH2-VET-ALEM','BT-3478','2026-09-13','2029-09-13',20.00,10.00,'Released',NULL,NULL,'2026-09-13 16:33:22','2026-09-13 16:33:22'),('BAT-1789317237628-bf3c','P-1789317140254','WH2-VET-ALEM','BT-3478','2026-09-13','2029-09-13',500.00,10.00,'Released',NULL,NULL,'2026-09-13 16:33:57','2026-09-13 16:33:57'),('BAT-1789317276607-xwbu','P-1789317140254','WH2-VET-ALEM','BT-3478','2026-09-13','2029-09-13',5.00,10.00,'Released',NULL,NULL,'2026-09-13 16:34:36','2026-09-13 16:34:36'),('batch-P-1788854908608-ALT26025','P-1788854908608','WH2','ALT26025','2026-01-01','2029-12-01',3500.00,0.00,'Released',NULL,'Initial batch for ASHIVER 5','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788857345432-251032','P-1788857345432','WH3','251032','2025-10-01','2028-10-01',2320.00,0.00,'Released',NULL,'Initial batch for INFLAMGO','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788857446192-260512','P-1788857446192','WH3','260512','2026-05-01','2029-05-01',21200.00,0.00,'Released',NULL,'Initial batch for INFLAMGO','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788858054417-251036','P-1788858054417','WH3','251036','2025-10-01','2028-10-01',8240.00,848.00,'Released',NULL,'Initial batch for ALBENTONG 2500','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788858377681-251034','P-1788858377681','WH3','251034','2025-10-01','2028-10-01',2610.00,0.00,'Released',NULL,'Initial batch for ALBENTONG SUS 10','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788858567873-251035','P-1788858567873','WH3','251035','2025-10-01','2028-10-01',2310.00,0.00,'Released',NULL,'Initial batch for LIVERFLUKE 1','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788859087961-AA12423','P-1788859087961','WH2','AA12423','2024-12-01','2027-11-01',4.00,0.00,'Released',NULL,'Initial batch for ASHITRAZ 12.5%','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788859302545-ALT25356','P-1788859302545','WH2','ALT25356','2025-06-01','2029-05-01',26.67,0.00,'Released',NULL,'Initial batch for ASHITETRA 2000','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788859513561-ALI25077','P-1788859513561','WH2','ALI25077','2025-04-01','2027-01-01',19.00,0.00,'Released',NULL,'Initial batch for ASHIVER 1% INJECTION','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788859675153-D260392U','P-1788859675153','WH3','D260392U','2026-03-01','2029-03-01',11120.00,0.00,'Released',NULL,'Initial batch for TY-VITAMINS','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788860002713-ALT26022','P-1788860002713','WH2','ALT26022','2026-01-01','2029-12-01',20.00,911.00,'Released',NULL,'Initial batch for ASHIALBIN 2500','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788860199689-ALL260448','P-1788860199689','WH2','ALL260448','2026-04-01','2029-03-01',1100.00,433.00,'Released',NULL,'Initial batch for ASHIENRO BH','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788860444633-ALG26111','P-1788860444633','WH2','ALG26111','2026-03-01','2029-02-01',2824.00,228.00,'Released',NULL,'Initial batch for ASHOXY 20% 5GM','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788860782033-ALT25393','P-1788860782033','WH2','ALT25393','2025-07-01','2029-06-01',990.00,410.00,'Released',NULL,'Initial batch for FASINASH SHEEP','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788861003705-ALG26109','P-1788861003705','WH2','ALG26109','2026-03-01','2029-02-01',1592.00,1935.00,'Released',NULL,'Initial batch for ASHOXY 20% 100GM','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788919771878-ALL26041','P-1788919771878','WH2','ALL26041','2026-04-01','2029-03-01',1500.00,239.00,'Released',NULL,'Initial batch for ASHINERO 10% ORAL','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788920432213-ALI26027','P-1788920432213','WH2','ALI26027','2026-04-01','2029-03-01',360.00,433.00,'Released',NULL,'Initial batch for ASHTYL 20% INJ','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788920639771-260504','P-1788920639771','WH3','260504','2026-05-01','2029-05-01',60000.00,65.00,'Released',NULL,'Initial batch for IVERTONG GLASS','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788920860228-260516','P-1788920860228','WH3','260516','2026-05-01','2029-05-01',9010.50,206.00,'Released',NULL,'Initial batch for OXYTONG 20','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788921168285-260509','P-1788921168285','WH3','260509','2026-05-01','2029-05-01',115500.00,65.00,'Released',NULL,'Initial batch for IVERTONG PLASTIC','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788921387242-260511','P-1788921387242','WH3','260511','2026-05-01','2029-05-01',44880.00,141.00,'Released',NULL,'Initial batch for HIVITA TONG','2026-09-13 13:03:06','2026-09-13 13:03:06'),('batch-P-1788921559264-260514','P-1788921559264','WH3','260514','2026-05-01','2031-05-01',93000.00,30.00,'Released',NULL,'Initial batch for TRYPATONG','2026-09-13 13:03:06','2026-09-13 13:03:06');
/*!40000 ALTER TABLE `pharma_product_batches` ENABLE KEYS */;
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
/*!40000 ALTER TABLE `stock_movements` ENABLE KEYS */;
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
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-13 20:53:42
