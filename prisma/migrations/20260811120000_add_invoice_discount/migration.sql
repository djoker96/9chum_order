CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'AMOUNT');

ALTER TABLE "invoices"
    ADD COLUMN "discount_type" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    ADD COLUMN "discount_value" DECIMAL(14,0) NOT NULL DEFAULT 0,
    ADD COLUMN "discount_amount" DECIMAL(14,0) NOT NULL DEFAULT 0;
