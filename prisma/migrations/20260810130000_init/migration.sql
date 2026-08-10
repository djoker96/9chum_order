CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF');
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'COD');
CREATE TYPE "ShippingMethod" AS ENUM ('FREE', 'DELIVERY_APP', 'COURIER');
CREATE TYPE "InvoiceStatus" AS ENUM ('CONFIRMED', 'CANCELLED');
CREATE TYPE "SyncSource" AS ENUM ('GOOGLE_SHEETS', 'EXCEL');
CREATE TYPE "SyncStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "concentration" TEXT NOT NULL,
    "volume" TEXT NOT NULL,
    "price" DECIMAL(14,0) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "shipping_method" "ShippingMethod" NOT NULL,
    "shipping_fee" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,0) NOT NULL,
    "total" DECIMAL(14,0) NOT NULL,
    "note" TEXT,
    "issue_invoice" BOOLEAN NOT NULL DEFAULT false,
    "company_name" TEXT,
    "invoice_address" TEXT,
    "invoice_email" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'CONFIRMED',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "volume" TEXT NOT NULL,
    "concentration" TEXT NOT NULL,
    "unit_price" DECIMAL(14,0) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total" DECIMAL(14,0) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_sync_logs" (
    "id" TEXT NOT NULL,
    "source" "SyncSource" NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "unchanged_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "detail_json" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    CONSTRAINT "product_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_number_sequences" (
    "date_key" TEXT NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invoice_number_sequences_pkey" PRIMARY KEY ("date_key")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE INDEX "users_is_active_idx" ON "users"("is_active");
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
CREATE UNIQUE INDEX "products_external_id_key" ON "products"("external_id");
CREATE INDEX "products_name_idx" ON "products"("name");
CREATE INDEX "products_is_active_idx" ON "products"("is_active");
CREATE INDEX "products_name_volume_concentration_idx" ON "products"("name", "volume", "concentration");
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");
CREATE INDEX "invoices_customer_name_idx" ON "invoices"("customer_name");
CREATE INDEX "invoices_phone_idx" ON "invoices"("phone");
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at");
CREATE INDEX "invoices_created_by_id_idx" ON "invoices"("created_by_id");
CREATE INDEX "invoices_status_idx" ON "invoices"("status");
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");
CREATE INDEX "invoice_items_product_id_idx" ON "invoice_items"("product_id");
CREATE INDEX "product_sync_logs_source_idx" ON "product_sync_logs"("source");
CREATE INDEX "product_sync_logs_status_idx" ON "product_sync_logs"("status");
CREATE INDEX "product_sync_logs_started_at_idx" ON "product_sync_logs"("started_at");
CREATE INDEX "product_sync_logs_created_by_id_idx" ON "product_sync_logs"("created_by_id");

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_sync_logs" ADD CONSTRAINT "product_sync_logs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
