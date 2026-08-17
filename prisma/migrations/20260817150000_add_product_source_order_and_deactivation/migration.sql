ALTER TABLE "products" ADD COLUMN "source_order" INTEGER;

ALTER TABLE "product_sync_logs"
    ADD COLUMN "deactivated_count" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "products_source_order_idx" ON "products"("source_order");
