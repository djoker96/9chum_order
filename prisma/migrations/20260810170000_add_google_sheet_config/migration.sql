CREATE TABLE "google_sheet_configs" (
    "id" TEXT NOT NULL,
    "spreadsheet_id" TEXT NOT NULL,
    "sheet_name" TEXT NOT NULL,
    "updated_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "google_sheet_configs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "google_sheet_configs_updated_by_id_idx" ON "google_sheet_configs"("updated_by_id");

ALTER TABLE "google_sheet_configs" ADD CONSTRAINT "google_sheet_configs_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
